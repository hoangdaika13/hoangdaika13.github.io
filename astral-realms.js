(function (root) {
  "use strict";

  const GAME_ID = "astral-realms";
  const SCHEMA_VERSION = 7;
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
      id: "lyra", name: "Lyra H", role: "Astral Vanguard", element: "plasma", short: "LH",
      body: "#43dfff", accent: "#ff69cc", hair: "#dffbff", eyes: "#63efff",
      attackScale: 1, speedScale: 1, description: "Kiếm sĩ cân bằng, tạo nhịp Plasma liên hoàn."
    },
    cael: {
      id: "cael", name: "Cael Aurora", role: "Cryo Ranger", element: "cryo", short: "CA",
      body: "#5d86ff", accent: "#8ff7ff", hair: "#e5ecff", eyes: "#8aeaff",
      attackScale: 0.92, speedScale: 1.12, description: "Xạ thủ Băng tinh nhanh, kiểm soát mục tiêu từ xa."
    },
    nyx: {
      id: "nyx", name: "Nyx Veyra", role: "Void Dancer", element: "void", short: "NV",
      body: "#6d43b8", accent: "#d66cff", hair: "#27174b", eyes: "#ff7de4",
      attackScale: 1.08, speedScale: 1.06, description: "Vũ công Hư không gây sát thương bùng nổ và dịch chuyển."
    },
    sol: {
      id: "sol", name: "Sol Riven", role: "Solar Guardian", element: "solar", short: "SR",
      body: "#d47433", accent: "#ffd96a", hair: "#fff2c4", eyes: "#ffbd58",
      attackScale: 1.18, speedScale: 0.94, description: "Hộ vệ Nhật quang có đòn nặng và khả năng hồi phục."
    }
  });
  const CHARACTER_ORDER = Object.freeze(Object.keys(CHARACTERS));
  const CHARACTER_VISUAL_VERSION = 13;
  const HERO_CHARACTER_MODEL_ID = "valid-asian-f-1-casual";
  const HERO_CHARACTER_ASSET_URL = "./assets/astral-realms/characters/default/valid-asian-f-1-casual.glb";
  const CHARACTER_MODEL_TIERS = Object.freeze({
    hero: { label: "Hero Prime · Full Quality", triangles: "58K+", texture: "Full atlas", face: 52, distance: Infinity, updateHz: 60 }
  });
  const CHARACTER_ASSET_CLASSES = Object.freeze({
    hero: { id: "hero-prime", label: "Hero Prime · Full Quality", color: "#6ff2ff" },
    unsupported: { id: "unsupported", label: "Không được phép dùng", color: "#ff6b9f" }
  });
  const HERO_ASSET_REQUIREMENTS = Object.freeze({
    headVerticesMin: 20000,
    headVerticesMax: 28000,
    nativeFaceMorphs: 52,
    bonesMin: 80,
    bonesMax: 120,
    skeletonCoverage: 0.8,
    textureMax: 2048,
    lodGroups: 1
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
    leftShoulder: ["LeftShoulder", "clavicle.L", "mixamorigLeftShoulder", "clavicle_l"],
    rightShoulder: ["RightShoulder", "clavicle.R", "mixamorigRightShoulder", "clavicle_r"],
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
    leftThumb: ["LeftHandThumb1", "thumb.01.L", "mixamorigLeftHandThumb1", "thumb_01_l"],
    rightThumb: ["RightHandThumb1", "thumb.01.R", "mixamorigRightHandThumb1", "thumb_01_r"],
    leftIndex: ["LeftHandIndex1", "f_index.01.L", "mixamorigLeftHandIndex1", "index_01_l"],
    rightIndex: ["RightHandIndex1", "f_index.01.R", "mixamorigRightHandIndex1", "index_01_r"],
    leftMiddle: ["LeftHandMiddle1", "f_middle.01.L", "mixamorigLeftHandMiddle1", "middle_01_l"],
    rightMiddle: ["RightHandMiddle1", "f_middle.01.R", "mixamorigRightHandMiddle1", "middle_01_r"],
    leftRing: ["LeftHandRing1", "f_ring.01.L", "mixamorigLeftHandRing1", "ring_01_l"],
    rightRing: ["RightHandRing1", "f_ring.01.R", "mixamorigRightHandRing1", "ring_01_r"],
    leftPinky: ["LeftHandPinky1", "f_pinky.01.L", "mixamorigLeftHandPinky1", "pinky_01_l"],
    rightPinky: ["RightHandPinky1", "f_pinky.01.R", "mixamorigRightHandPinky1", "pinky_01_r"]
  });
  const CHARACTER_MOTION_LIBRARY = Object.freeze({
    idle: ["idle", "breathing", "stand"],
    start: ["start", "run_start", "walk_start"],
    stop: ["stop", "run_stop", "walk_stop"],
    turnLeft: ["turn_left", "turnleft", "turn_-90"],
    turnRight: ["turn_right", "turnright", "turn_90"],
    walk: ["walk", "walking"],
    run: ["run", "jog", "running"],
    sprint: ["sprint", "fast_run"],
    strafe: ["strafe", "sidestep"],
    jump: ["jump", "takeoff"],
    fall: ["fall", "air"],
    land: ["land", "landing"],
    glide: ["glide", "fly"],
    swim: ["swim"],
    climb: ["climb", "ladder"],
    dodge: ["dodge", "roll", "evade"],
    attack1: ["attack_1", "attack1", "slash"],
    attack2: ["attack_2", "attack2", "combo"],
    attack3: ["attack_3", "attack3", "heavy"],
    skill: ["skill", "cast"],
    ultimate: ["ultimate", "special"],
    hit: ["hit", "damage", "impact"],
    defeated: ["death", "defeated", "knockdown"],
    talk: ["talk", "conversation", "gesture"]
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
  const CHARACTER_VISEMES = Object.freeze({
    neutral: {},
    A: { jawOpen: 0.72, mouthFunnel: 0.08, mouthStretchLeft: 0.18, mouthStretchRight: 0.18 },
    E: { jawOpen: 0.34, mouthStretchLeft: 0.62, mouthStretchRight: 0.62, mouthSmileLeft: 0.22, mouthSmileRight: 0.22 },
    I: { jawOpen: 0.24, mouthStretchLeft: 0.78, mouthStretchRight: 0.78 },
    O: { jawOpen: 0.55, mouthFunnel: 0.84, mouthPucker: 0.42 },
    U: { jawOpen: 0.3, mouthFunnel: 0.68, mouthPucker: 0.74 },
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
    { id: "hero-core", name: "HH Hero Prime", role: "Một GLB duy nhất · Full Quality Only", state: "Local asset · Retry khi lỗi" },
    { id: "mediapipe", name: "MediaPipe Face", role: "52 blendshape trên thiết bị", state: "Opt-in camera" },
    { id: "three", name: "Three.js GLTF", role: "GLB rigged, IK, morph và viseme", state: "Runtime V13 · Hero only" }
  ]);
  const GENESIS_STEPS = Object.freeze([
    { id: "identity", number: "01", label: "Nền nhân vật", focus: "body", group: "face" },
    { id: "face", number: "02", label: "Sculpt khuôn mặt", focus: "head", group: "face" },
    { id: "skin", number: "03", label: "Da & tuổi", focus: "head", group: "face" },
    { id: "eyes", number: "04", label: "Mắt & makeup", focus: "head", group: "eyes" },
    { id: "hair", number: "05", label: "Tóc & râu", focus: "head", group: "brows" },
    { id: "body", number: "06", label: "Tỷ lệ cơ thể", focus: "body", group: "body" },
    { id: "wardrobe", number: "07", label: "Trang phục", focus: "body", group: "shoulders" },
    { id: "performance", number: "08", label: "Giọng & Motion DNA", focus: "body", group: "expression" },
    { id: "preview", number: "09", label: "Kiểm tra studio", focus: "body", group: "expression" },
    { id: "dna", number: "10", label: "DNA & Prologue", focus: "body", group: "face" }
  ]);
  const MOTION_DNA_PRESETS = Object.freeze({
    balanced: { label: "Cân bằng", posture: 0.52, stride: 0.52, acceleration: 0.58, braking: 0.58, turnResponse: 0.62, combatWeight: 0.52, secondaryMotion: 0.55, dodgeStyle: "sidestep" },
    agile: { label: "Nhanh nhẹn", posture: 0.58, stride: 0.66, acceleration: 0.82, braking: 0.78, turnResponse: 0.86, combatWeight: 0.38, secondaryMotion: 0.68, dodgeStyle: "dash" },
    grounded: { label: "Vững chãi", posture: 0.72, stride: 0.46, acceleration: 0.42, braking: 0.66, turnResponse: 0.48, combatWeight: 0.78, secondaryMotion: 0.34, dodgeStyle: "roll" },
    cinematic: { label: "Điện ảnh", posture: 0.64, stride: 0.6, acceleration: 0.54, braking: 0.52, turnResponse: 0.58, combatWeight: 0.64, secondaryMotion: 0.76, dodgeStyle: "spin" }
  });
  const CHARACTER_VOICES = Object.freeze([
    { id: "aurora-soft", label: "Aurora · ấm và mềm" },
    { id: "central-clear", label: "Central · rõ và cân bằng" },
    { id: "void-low", label: "Void · trầm và bí ẩn" },
    { id: "solar-bold", label: "Solar · mạnh và sáng" }
  ]);
  const APPEARANCE_VERSION = 13;
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
    baseModels: [HERO_CHARACTER_MODEL_ID],
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
    central: { label: "H-Central", short: "HC", background: 0x06121f, floor: 0x163a4d, key: 0xa9f8ff, rim: 0xff68cb, accent: 0x6feeff },
    aurora: { label: "Aurora Lake", short: "AU", background: 0x061c25, floor: 0x0f5260, key: 0xc8fff4, rim: 0x79a8ff, accent: 0x65f1c7 },
    crimson: { label: "Crimson Forge", short: "CF", background: 0x1a0809, floor: 0x4c1714, key: 0xffd0a2, rim: 0xff4f72, accent: 0xff805f },
    void: { label: "Void Garden", short: "VG", background: 0x10071d, floor: 0x291447, key: 0xe2c9ff, rim: 0x8f69ff, accent: 0xae78ff },
    deep: { label: "Deep Space", short: "DS", background: 0x02050f, floor: 0x111c38, key: 0xb4d9ff, rim: 0xf46dff, accent: 0x79a8ff },
    neutral: { label: "Neutral Studio", short: "NS", background: 0x9aa5b2, floor: 0xc8d0d7, key: 0xffffff, rim: 0xb9d8ff, accent: 0xeef7ff }
  });
  const APPEARANCE_PRESETS = Object.freeze({
    balanced: { label: "Cân bằng", bodyPreset: "balanced", morphs: {} },
    athletic: { label: "Thể thao", bodyPreset: "athletic", morphs: { shoulderWidth: 0.62, upperArm: 0.61, thighSize: 0.6, calfSize: 0.58, muscle: 0.68, tone: 0.72, bodyFat: 0.36, abs: 0.64 } },
    soft: { label: "Mềm mại", bodyPreset: "soft", morphs: { cheekFullness: 0.62, faceFullness: 0.58, shoulderWidth: 0.45, waist: 0.47, chestFullness: 0.61, hipWidth: 0.6, gluteFullness: 0.62, softness: 0.7, muscle: 0.38 } },
    heroic: { label: "Anh hùng", bodyPreset: "heroic", morphs: { height: 0.67, jawWidth: 0.58, shoulderWidth: 0.7, chestWidth: 0.65, chestSize: 0.6, backWidth: 0.64, muscle: 0.72, posture: 0.7 } },
    agile: { label: "Nhanh nhẹn", bodyPreset: "agile", morphs: { height: 0.54, shoulderWidth: 0.48, armLength: 0.58, legLength: 0.66, waist: 0.43, bodyMass: 0.38, muscle: 0.54, tone: 0.66 } }
  });
  const PHOTOREAL_ASSETS = Object.freeze({
    panorama: "./assets/astral-realms/astral-realms-panorama-v1.webp"
  });
  const BUILTIN_CHARACTER_ASSETS = Object.freeze({
    [HERO_CHARACTER_MODEL_ID]: HERO_CHARACTER_ASSET_URL
  });
  const CHARACTER_PIPELINE_SOURCES = Object.freeze(["hero-core"]);
  const LICENSED_ENVIRONMENT_ASSETS = Object.freeze({
    boulder: "./assets/astral-realms/environment/boulder_01.glb",
    grass: "./assets/astral-realms/environment/grass_medium_01.glb",
    mossRocks: "./assets/astral-realms/environment/rock_moss_set_01.glb",
    shrub: "./assets/astral-realms/environment/shrub_01.glb",
    deadTree: "./assets/astral-realms/environment/dead_tree_trunk_02.glb",
    fern: "./assets/astral-realms/environment/fern_02.glb"
  });
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
  const WORLD_ART_VERSION = 3;
  const WORLD_ART_PROFILES = Object.freeze({
    central: Object.freeze({
      truth: "Identity",
      motif: "fifth-heartbeat-archive",
      landmark: "Genesis Archive Spire",
      horizon: "#244c69",
      zenith: "#07152b",
      lowerSky: "#130d24",
      ground: "#506575",
      fog: "#123249",
      key: "#c9ecff",
      fill: "#76b9ff",
      rim: "#ff69c8",
      fogDensity: 0.0058,
      exposure: 1.04,
      wetness: 0.58,
      emissive: 0.42,
      wind: 0.36,
      life: 0.84
    }),
    aurora: Object.freeze({
      truth: "Memory",
      motif: "three-hundred-seventeen-memories",
      landmark: "House That Never Existed",
      horizon: "#285b68",
      zenith: "#111b46",
      lowerSky: "#10262e",
      ground: "#55766f",
      fog: "#1a4650",
      key: "#c9fff4",
      fill: "#72d8ff",
      rim: "#b18cff",
      fogDensity: 0.0082,
      exposure: 1,
      wetness: 0.48,
      emissive: 0.52,
      wind: 0.54,
      life: 0.68
    }),
    crimson: Object.freeze({
      truth: "Sacrifice",
      motif: "thirteenth-survivor",
      landmark: "Sacrifice Reactor",
      horizon: "#6d3025",
      zenith: "#220c16",
      lowerSky: "#32130e",
      ground: "#62433a",
      fog: "#482018",
      key: "#ffd0a8",
      fill: "#ff6c42",
      rim: "#fff0bd",
      fogDensity: 0.0094,
      exposure: 1.02,
      wetness: 0.08,
      emissive: 0.68,
      wind: 0.78,
      life: 0.42
    }),
    void: Object.freeze({
      truth: "Fear",
      motif: "nyx-aion-resonance",
      landmark: "Twin Resonance Tree",
      horizon: "#39205e",
      zenith: "#100921",
      lowerSky: "#1d0d2b",
      ground: "#423154",
      fog: "#24133d",
      key: "#dbc9ff",
      fill: "#6ae5dc",
      rim: "#d36fff",
      fogDensity: 0.0102,
      exposure: 1.01,
      wetness: 0.38,
      emissive: 0.62,
      wind: 0.22,
      life: 0.56
    }),
    sky: Object.freeze({
      truth: "Freedom",
      motif: "last-free-vote",
      landmark: "Free Constellation Archive",
      horizon: "#7193b5",
      zenith: "#18345a",
      lowerSky: "#344b62",
      ground: "#667782",
      fog: "#405b75",
      key: "#eff8ff",
      fill: "#9bdcff",
      rim: "#fff1b8",
      fogDensity: 0.006,
      exposure: 1.06,
      wetness: 0.3,
      emissive: 0.46,
      wind: 1.18,
      life: 0.62
    }),
    ocean: Object.freeze({
      truth: "Grief",
      motif: "million-quantum-funerals",
      landmark: "Mira Memory Lighthouse",
      horizon: "#176581",
      zenith: "#071f45",
      lowerSky: "#06283a",
      ground: "#376b78",
      fog: "#0c435d",
      key: "#c9f5ff",
      fill: "#55cfff",
      rim: "#ff78cf",
      fogDensity: 0.0088,
      exposure: 1,
      wetness: 0.94,
      emissive: 0.5,
      wind: 0.62,
      life: 0.72
    }),
    station: Object.freeze({
      truth: "Betrayal",
      motif: "gate-seven-audit",
      landmark: "Immutable Gate 7",
      horizon: "#4d5062",
      zenith: "#151927",
      lowerSky: "#24222d",
      ground: "#59606b",
      fog: "#292d3b",
      key: "#fff3d0",
      fill: "#8adfff",
      rim: "#ffc65e",
      fogDensity: 0.0048,
      exposure: 1.06,
      wetness: 0.12,
      emissive: 0.55,
      wind: 0.08,
      life: 0.9
    }),
    abyss: Object.freeze({
      truth: "Truth",
      motif: "voluntary-erasure-order",
      landmark: "Original Erasure Archive",
      horizon: "#4a163c",
      zenith: "#09030f",
      lowerSky: "#1f0618",
      ground: "#33253a",
      fog: "#190718",
      key: "#ffd0e4",
      fill: "#8b5cff",
      rim: "#ffbd65",
      fogDensity: 0.012,
      exposure: 0.94,
      wetness: 0.2,
      emissive: 0.76,
      wind: 0.18,
      life: 0.18
    })
  });
  const STORY_ENVIRONMENT_VARIANTS = Object.freeze({
    central: Object.freeze({
      publish: Object.freeze({ kind: "neon-rain", accent: "#72efff", fog: "#103449", fogDensity: 0.0072, exposure: 1.02, wetness: 0.85, wind: 0.48, life: 0.96, emissive: 0.72, landmarkState: "civilian-inquiry" }),
      seal: Object.freeze({ kind: "controlled-clear", accent: "#8ab8ff", fog: "#13283a", fogDensity: 0.0048, exposure: 1.08, wetness: 0.15, wind: 0.12, life: 0.38, emissive: 0.44, landmarkState: "core-quarantine" })
    }),
    aurora: Object.freeze({
      past: Object.freeze({ kind: "memory-snow", accent: "#98ddff", fog: "#173e52", fogDensity: 0.01, exposure: 0.98, wetness: 0.52, wind: 0.28, life: 0.52, emissive: 0.78, landmarkState: "echo-houses" }),
      present: Object.freeze({ kind: "dawn-snow", accent: "#ffe6c2", fog: "#244e58", fogDensity: 0.0068, exposure: 1.1, wetness: 0.36, wind: 0.42, life: 0.9, emissive: 0.46, landmarkState: "present-home" })
    }),
    crimson: Object.freeze({
      people: Object.freeze({ kind: "settling-ash", accent: "#ffb07c", fog: "#3b2723", fogDensity: 0.0065, exposure: 0.98, wetness: 0.06, wind: 0.18, life: 0.88, emissive: 0.5, landmarkState: "survivor-memorial" }),
      forge: Object.freeze({ kind: "industrial-heatstorm", accent: "#ff5f36", fog: "#4b1812", fogDensity: 0.012, exposure: 1.05, wetness: 0.02, wind: 1, life: 0.28, emissive: 0.9, landmarkState: "military-bastion" })
    }),
    void: Object.freeze({
      share: Object.freeze({ kind: "resonant-spores", accent: "#c982ff", fog: "#251142", fogDensity: 0.013, exposure: 1.08, wetness: 0.42, wind: 0.2, life: 0.8, emissive: 0.92, landmarkState: "living-gate" }),
      sever: Object.freeze({ kind: "void-silence", accent: "#b9adc9", fog: "#17131f", fogDensity: 0.0075, exposure: 0.92, wetness: 0.18, wind: 0.02, life: 0.16, emissive: 0.24, landmarkState: "severed-scar" })
    }),
    sky: Object.freeze({
      free: Object.freeze({ kind: "branching-wind", accent: "#b8e8ff", fog: "#405b75", fogDensity: 0.0055, exposure: 1.08, wetness: 0.28, wind: 1.4, life: 0.86, emissive: 0.68, landmarkState: "independent-docks" }),
      unified: Object.freeze({ kind: "ordered-clouds", accent: "#dceeff", fog: "#51647a", fogDensity: 0.006, exposure: 1.02, wetness: 0.2, wind: 0.55, life: 0.7, emissive: 0.48, landmarkState: "anchor-lattice" })
    }),
    ocean: Object.freeze({
      embody: Object.freeze({ kind: "rebirth-star-rain", accent: "#7cf5ff", fog: "#0d4663", fogDensity: 0.01, exposure: 1.04, wetness: 1, wind: 0.35, life: 0.76, emissive: 0.84, landmarkState: "mira-echo" }),
      release: Object.freeze({ kind: "memorial-tide", accent: "#78bfe8", fog: "#0b3852", fogDensity: 0.009, exposure: 0.96, wetness: 0.92, wind: 0.25, life: 0.44, emissive: 0.52, landmarkState: "tide-memorial" })
    }),
    station: Object.freeze({
      forgive: Object.freeze({ kind: "transparent-aurora", accent: "#ffe19a", fog: "#25303e", fogDensity: 0.0038, exposure: 1.1, wetness: 0.08, wind: 0.06, life: 1, emissive: 0.7, landmarkState: "public-audit" }),
      detain: Object.freeze({ kind: "lockdown-dust", accent: "#ffbd61", fog: "#332b25", fogDensity: 0.006, exposure: 0.93, wetness: 0.04, wind: 0.03, life: 0.34, emissive: 0.4, landmarkState: "gate-lockdown" })
    }),
    abyss: Object.freeze({
      accept: Object.freeze({ kind: "truce-eclipse", accent: "#ffd0a1", fog: "#170817", fogDensity: 0.01, exposure: 0.9, wetness: 0.14, wind: 0.04, life: 0.36, emissive: 0.66, landmarkState: "ceasefire-archive" }),
      destroy: Object.freeze({ kind: "probability-shards", accent: "#ff5e9f", fog: "#230719", fogDensity: 0.015, exposure: 1.02, wetness: 0.12, wind: 0.65, life: 0.12, emissive: 1, landmarkState: "shattered-destiny" })
    })
  });
  const WORLD_ART_BUDGETS = Object.freeze({
    static: Object.freeze({ vistaInstances: 6, localParticles: 12, activeRadius: 70, shadowRadius: 28, skyUpdateMs: 120 }),
    balanced: Object.freeze({ vistaInstances: 10, localParticles: 28, activeRadius: 92, shadowRadius: 44, skyUpdateMs: 72 }),
    cinematic: Object.freeze({ vistaInstances: 16, localParticles: 48, activeRadius: 112, shadowRadius: 62, skyUpdateMs: 48 })
  });
  const WORLD_WEATHER_KIND_ALIASES = Object.freeze({
    clear: "controlled-clear",
    aurora: "snow",
    embers: "embers",
    storm: "spores",
    "quantum-wind": "quantum-wind",
    "star-rain": "star-rain",
    "artificial-aurora": "orbital-dust",
    eclipse: "gravity-shards"
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
    lyra: { title: "Tín hiệu của Lyra", summary: "Tìm lại bản ghi đầu tiên của lõi H.", support: "Có thể ổn định Plasma trong puzzle." },
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
    central: { core: "stable", restored: true, occupation: "h-central", weather: "clear", environmentVariant: "", resources: 100, lastBossAt: "" },
    aurora: { core: "unstable", restored: false, occupation: "aurora-keepers", weather: "aurora", environmentVariant: "", resources: 100, lastBossAt: "" },
    crimson: { core: "corrupted", restored: false, occupation: "crimson-union", weather: "embers", environmentVariant: "", resources: 100, lastBossAt: "" },
    void: { core: "sealed", restored: false, occupation: "void-cult", weather: "storm", environmentVariant: "", resources: 100, lastBossAt: "" },
    sky: { core: "unstable", restored: false, occupation: "free-travelers", weather: "quantum-wind", environmentVariant: "", resources: 100, lastBossAt: "" },
    ocean: { core: "unstable", restored: false, occupation: "aurora-keepers", weather: "star-rain", environmentVariant: "", resources: 100, lastBossAt: "" },
    station: { core: "corrupted", restored: false, occupation: "astral-researchers", weather: "artificial-aurora", environmentVariant: "", resources: 100, lastBossAt: "" },
    abyss: { core: "sealed", restored: false, occupation: "void-cult", weather: "eclipse", environmentVariant: "", resources: 100, lastBossAt: "" }
  });
  const ITEMS = Object.freeze({
    "starter-blade": { id: "starter-blade", name: "Đoản kiếm H", type: "weapon", rarity: "Khởi đầu", description: "Vũ khí tiêu chuẩn của Nhà du hành H.", attack: 8 },
    "aurora-shard": { id: "aurora-shard", name: "Mảnh Aurora", type: "material", rarity: "Phổ thông", description: "Tinh thể lạnh thu được tại Aurora Vale." },
    "plasma-core": { id: "plasma-core", name: "Lõi Plasma", type: "material", rarity: "Hiếm", description: "Lõi năng lượng còn nóng của sinh vật Crimson." },
    "void-fiber": { id: "void-fiber", name: "Sợi Hư Không", type: "material", rarity: "Hiếm", description: "Vật chất bất ổn từ Void Garden." },
    "healing-tonic": { id: "healing-tonic", name: "Tinh dược hồi phục", type: "consumable", rarity: "Phổ thông", description: "Hồi 35 HP khi sử dụng.", heal: 35 },
    "astral-edge": { id: "astral-edge", name: "Astral Edge", type: "weapon", rarity: "Sử thi", description: "Lưỡi kiếm cộng hưởng với sáu nguyên tố.", attack: 22 }
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
  const STORY_VERSION = 2;
  const STORY_VERSION_LABEL = "STORY V2";
  const STORY_METRIC_KEYS = Object.freeze(["identityIntegrity", "memoryDebt", "causalityPressure"]);
  const STORY_METRIC_DEFAULTS = Object.freeze({ identityIntegrity: 76, memoryDebt: 8, causalityPressure: 12 });
  const STORY_BELIEF_KEYS = Object.freeze(["freeWill", "coreOrder", "playerIsThreat", "aionMayBeRight"]);
  const STORY_ZONE_ORDER = Object.freeze(["central", "aurora", "crimson", "void", "sky", "ocean", "station", "abyss"]);
  const TRUTH_SHARDS = Object.freeze({
    central: { title: "Identity", color: "#6feeff", question: "Ai đã tạo Character DNA của bạn?", revelation: "Character Genesis không tạo ra bạn; nó phục hồi một mẫu người đã bị xóa khỏi mọi kho lưu trữ." },
    aurora: { title: "Memory", color: "#65f1c7", question: "Vì sao Cael nhớ một cuộc đời chưa từng xảy ra?", revelation: "Cael từng sống cùng bạn trong 317 dòng thời gian và đang đánh đổi ký ức hiện tại để nhớ lại chúng." },
    crimson: { title: "Sacrifice", color: "#ff805f", question: "Ai đã ra lệnh đóng cổng Void?", revelation: "Sol từng hy sinh Crimson Forge theo chính mệnh lệnh của một phiên bản tương lai của bạn." },
    void: { title: "Fear", color: "#ae78ff", question: "Tiếng nói trong Nyx thuộc về ai?", revelation: "Nyx mang cộng hưởng của Aion; cô có thể khóa Nexus hoặc trở thành vật chủ cuối cùng của nó." },
    sky: { title: "Freedom", color: "#9ad7ff", question: "Tự do có đáng giá hơn một tương lai hoàn hảo?", revelation: "Sky Ruins tự phá hủy dòng thời gian ổn định vì cư dân từ chối sống trong một lịch sử đã được chọn hộ." },
    ocean: { title: "Grief", color: "#4de1ff", question: "Người đã chết còn tồn tại ở đâu?", revelation: "Đại dương lượng tử lưu ký ức của những người bị xóa, trong đó có Mira và hàng nghìn phiên bản của bạn." },
    station: { title: "Betrayal", color: "#ffd36b", question: "Ai đã giao nộp bạn cho The Archivist?", revelation: "Lyra đã giao nộp bạn, nhưng bản ghi cho thấy chính bạn yêu cầu cô giữ kín sự phản bội đó." },
    abyss: { title: "Truth", color: "#ff5e9f", question: "Vì sao toàn bộ thế giới phải quên bạn?", revelation: "Bạn từng tự yêu cầu bị xóa sau khi nhìn thấy HH Core sụp đổ trong mọi tương lai có mình." }
  });
  const ECHO_MEMORIES = Object.freeze([
    { id: "central-genesis", zoneId: "central", title: "Mẫu DNA số 0", witness: "HH Core", summary: "Một hồ sơ Genesis mang khuôn mặt của bạn đã tồn tại trước ngày hệ thống được xây dựng." },
    { id: "central-mira", zoneId: "central", title: "Tên bị gạch khỏi tàu H-07", witness: "Mira", summary: "Bản ghi cứu nạn có năm nhịp tim, trong khi mọi báo cáo chính thức chỉ công nhận bốn người." },
    { id: "aurora-home", zoneId: "aurora", title: "Ngôi nhà không có trong lịch sử", witness: "Cael", summary: "Cael gọi đúng tên căn phòng bạn từng sống dù căn nhà chưa từng được xây." },
    { id: "aurora-cost", zoneId: "aurora", title: "Cái giá của hồi tưởng", witness: "Cael", summary: "Mỗi lần Cael nhớ lại bạn, một ký ức về gia đình anh biến mất." },
    { id: "crimson-order", zoneId: "crimson", title: "Mệnh lệnh mang chữ ký của bạn", witness: "Sol", summary: "Lệnh thiêu hủy thành phố dùng khóa sinh trắc học khớp Character DNA hiện tại." },
    { id: "crimson-survivor", zoneId: "crimson", title: "Người sống sót thứ 13", witness: "Forge Archive", summary: "Một nhân chứng nói Sol đã cứu trẻ em trái lệnh, nhưng hồ sơ đã bị cắt bỏ." },
    { id: "void-bloodline", zoneId: "void", title: "Cộng hưởng của Nyx", witness: "Nexus", summary: "Tần số năng lượng của Nyx và Aion chỉ khác nhau một sai số nhỏ như người cùng huyết hệ." },
    { id: "void-whisper", zoneId: "void", title: "Lời thì thầm ngược thời gian", witness: "Nyx", summary: "Giọng nói trong Abyss không ra lệnh phá hủy; nó cầu xin Nyx đừng để bạn nhớ lại." },
    { id: "sky-vote", zoneId: "sky", title: "Lá phiếu cuối cùng", witness: "Free Constellation", summary: "Cư dân Sky Ruins đã tự chọn hỗn loạn thay vì giao tương lai cho một thuật toán hoàn hảo." },
    { id: "sky-fall", zoneId: "sky", title: "Ngày bầu trời rơi", witness: "Aion", summary: "Aion từng cố cứu họ, nhưng chính sự can thiệp của hắn khiến các đảo vỡ quỹ đạo." },
    { id: "ocean-mira", zoneId: "ocean", title: "Giọng nói dưới Ocean Moon", witness: "Mira", summary: "Mira nhớ lần bạn hứa sẽ tìm cô dù cả vũ trụ phủ nhận cô từng tồn tại." },
    { id: "ocean-funerals", zoneId: "ocean", title: "Một triệu tang lễ", witness: "Quantum Sea", summary: "Mỗi làn sóng lưu một kết thúc khác nhau của cùng những con người." },
    { id: "station-handover", zoneId: "station", title: "Biên bản bàn giao", witness: "Lyra", summary: "Lyra giao bạn cho Archivist tại cổng số 7 và yêu cầu đổi lấy sự sống của H-Central." },
    { id: "station-promise", zoneId: "station", title: "Lời hứa không được phép nhớ", witness: "Bạn", summary: "Chính giọng của bạn bảo Lyra: ‘Khi tôi trở lại, đừng tin tôi ngay lập tức.’" },
    { id: "abyss-request", zoneId: "abyss", title: "Yêu cầu xóa bản thân", witness: "Bạn của tương lai", summary: "Lệnh xóa được ký tự nguyện sau khi bạn xem hàng triệu tương lai HH Core tan vỡ." },
    { id: "abyss-purpose", zoneId: "abyss", title: "Mục đích thật của Genesis", witness: "Aion", summary: "Genesis là đường thoát bạn bí mật để lại: khôi phục tự do khi dòng thời gian hoàn hảo trở thành nhà tù." }
  ]);
  const STORY_MISSIONS = Object.freeze([
    { zoneId: "central", title: "Người không tồn tại", mechanic: "Điều tra hiện trường bằng dư ảnh thời gian", summary: "Đối chiếu DNA, dấu va chạm và nhịp tim thứ năm trên tàu H-07.", steps: ["Quét buồng Genesis bị cháy", "Dựng lại 12 giây trước va chạm", "Đối chất Navigator Luma"], echoes: ["central-genesis", "central-mira"], prompt: "H-Central sẽ đối diện với sự thật bằng cách nào?", choices: [
      { id: "publish", label: "Công bố hồ sơ Mira", outcome: "Người dân biết lịch sử đã bị sửa; thành phố bất ổn nhưng mở cuộc điều tra độc lập.", weather: "Mưa neon điều tra", economy: 1.08, control: "civilian-council", companion: "lyra", trust: 1, metrics: { identityIntegrity: 4, memoryDebt: 5, causalityPressure: 6 }, beliefs: { lyra: { freeWill: 2, coreOrder: -1, playerIsThreat: -1, aionMayBeRight: -1 } } },
      { id: "seal", label: "Niêm phong để bảo vệ Core", outcome: "HH Core ổn định nhanh hơn, nhưng Luma và Lyra nghi ngờ bạn đang lặp lại lựa chọn cũ.", weather: "Trời quang kiểm soát", economy: 0.96, control: "h-central", companion: "lyra", trust: -1, metrics: { identityIntegrity: -3, memoryDebt: 1, causalityPressure: -4 }, beliefs: { lyra: { freeWill: -1, coreOrder: 2, playerIsThreat: 1, aionMayBeRight: 1 } } }
    ] },
    { zoneId: "aurora", title: "Cuộc đời chưa xảy ra", mechanic: "Chơi lại cùng sự kiện từ ba góc nhìn", summary: "Bước qua ký ức của Cael trước khi chúng xóa mất con người hiện tại của anh.", steps: ["Theo dấu chân không có chủ", "Sống lại ký ức của Cael", "Tách ký ức thật khỏi Echo giả"], echoes: ["aurora-home", "aurora-cost"], prompt: "Bạn sẽ giữ lại ký ức nào cho Cael?", choices: [
      { id: "past", label: "Trả lại cuộc đời đã mất", outcome: "Cael nhớ bạn rõ hơn nhưng quên một phần gia đình hiện tại; Aurora xuất hiện những ngôi nhà từ dòng thời gian cũ.", weather: "Cực quang ký ức", economy: 0.92, control: "aurora-keepers", companion: "cael", trust: 2, memory: -2, metrics: { identityIntegrity: 2, memoryDebt: 12, causalityPressure: 7 }, beliefs: { cael: { freeWill: 1, playerIsThreat: 1, aionMayBeRight: -1 } } },
      { id: "present", label: "Bảo vệ con người hiện tại", outcome: "Cael mất bằng chứng về quá khứ nhưng giữ gia đình; anh tin lựa chọn của bạn dù đau đớn.", weather: "Tuyết trong bình minh", economy: 1.02, control: "aurora-keepers", companion: "cael", trust: 1, memory: 1, metrics: { identityIntegrity: 4, memoryDebt: -6, causalityPressure: -3 }, beliefs: { cael: { freeWill: 1, coreOrder: 1, playerIsThreat: -1 } } }
    ] },
    { zoneId: "crimson", title: "Thành phố phải cháy", mechanic: "Boss fight đan xen đối thoại giữa các phase", summary: "Đi qua lò phản ứng sụp đổ và buộc Sol đối diện mệnh lệnh mang chữ ký của bạn.", steps: ["Hộ tống lõi qua lò rèn", "Đàm phán với Forge Warden", "Khóa phản ứng dây chuyền"], echoes: ["crimson-order", "crimson-survivor"], prompt: "Crimson Forge sẽ được tái thiết theo giá nào?", choices: [
      { id: "people", label: "Cứu khu dân cư trước", outcome: "Lò rèn mất sản lượng, giá trang bị tăng nhưng các gia đình sống sót và Sol đặt con người lên trên mệnh lệnh.", weather: "Tro tàn lắng xuống", economy: 1.18, control: "crimson-union", companion: "sol", trust: 2, metrics: { identityIntegrity: 5, memoryDebt: 3, causalityPressure: 5 }, beliefs: { sol: { freeWill: 2, coreOrder: -2, playerIsThreat: -1, aionMayBeRight: -1 } } },
      { id: "forge", label: "Giữ lò rèn hoạt động", outcome: "Crimson trở thành thành trì quân sự mạnh, đổi lại một quận dân cư bị bỏ hoang.", weather: "Bão nhiệt công nghiệp", economy: 0.82, control: "h-central", companion: "sol", trust: 1, fear: 1, metrics: { identityIntegrity: -3, memoryDebt: 5, causalityPressure: -5 }, beliefs: { sol: { freeWill: -1, coreOrder: 2, playerIsThreat: 1, aionMayBeRight: 1 } } }
    ] },
    { zoneId: "void", title: "Vật chủ cuối cùng", mechanic: "Xâm nhập có thể chuyển thành đàm phán hoặc chiến đấu", summary: "Đi cùng Nyx vào khu vườn nơi thực vật lặp lại giọng nói của Aion.", steps: ["Ẩn mình qua bào tử nghe lén", "Giải mã tiếng nói Nexus", "Đối thoại với bản sao Nyx"], echoes: ["void-bloodline", "void-whisper"], prompt: "Bạn sẽ làm gì với liên kết giữa Nyx và Aion?", choices: [
      { id: "share", label: "Chia sẻ sức mạnh cùng Nyx", outcome: "Nyx kiểm soát được cổng nhưng Void lan thành hoa phát sáng; một số kỹ năng nguy hiểm được mở.", weather: "Mưa bào tử cộng hưởng", economy: 1.04, control: "void-cult", companion: "nyx", trust: 2, dangerous: 1, metrics: { identityIntegrity: 3, memoryDebt: 8, causalityPressure: 10 }, beliefs: { nyx: { freeWill: 2, playerIsThreat: 2, aionMayBeRight: -1 } } },
      { id: "sever", label: "Cắt đứt cộng hưởng", outcome: "Void Garden yên ổn hơn nhưng Nyx mất một phần năng lực và lo sợ bạn sẽ xóa cô khi cần thiết.", weather: "Khoảng lặng hư không", economy: 0.98, control: "astral-researchers", companion: "nyx", trust: -1, fear: 2, metrics: { identityIntegrity: -2, memoryDebt: 2, causalityPressure: -7 }, beliefs: { nyx: { freeWill: -2, coreOrder: 1, playerIsThreat: 2, aionMayBeRight: 1 } } }
    ] },
    { zoneId: "sky", title: "Quyền được sai lầm", mechanic: "Truy đuổi giữa môi trường đang sụp đổ", summary: "Bắt kịp kho lưu trữ tự do trước khi đảo cuối cùng rơi khỏi quỹ đạo.", steps: ["Lướt qua ba đảo vỡ", "Cứu hội đồng hay kho dữ liệu", "Neo lại thành phố trên mây"], echoes: ["sky-vote", "sky-fall"], prompt: "Ai được quyền quyết định tương lai Sky Ruins?", choices: [
      { id: "free", label: "Trao quyền cho từng đảo", outcome: "Sky Ruins tách thành các cộng đồng tự trị; tuyến vận chuyển khó hơn nhưng nhiệm vụ đa dạng hơn.", weather: "Gió tự do phân nhánh", economy: 1.12, control: "free-travelers", metrics: { identityIntegrity: 6, memoryDebt: 2, causalityPressure: 9 }, beliefsAll: { freeWill: 1, coreOrder: -1, aionMayBeRight: -1 } },
      { id: "unified", label: "Lập hội đồng thống nhất", outcome: "Đường bay an toàn và hàng hóa rẻ hơn, nhưng các đảo phản kháng xuất hiện.", weather: "Mây trật tự", economy: 0.86, control: "h-central", metrics: { identityIntegrity: -3, memoryDebt: 0, causalityPressure: -8 }, beliefsAll: { freeWill: -1, coreOrder: 1, aionMayBeRight: 1 } }
    ] },
    { zoneId: "ocean", title: "Biển nhớ người chết", mechanic: "Nhiệm vụ ký ức làm thay đổi trọng lực và thời gian", summary: "Lặn vào đại dương lượng tử để tìm Mira mà không đánh mất hiện tại.", steps: ["Đi theo giọng hát dưới vực", "Ghép một triệu tang lễ", "Đưa một ký ức trở về bờ"], echoes: ["ocean-mira", "ocean-funerals"], prompt: "Bạn sẽ để người đã mất tồn tại theo cách nào?", choices: [
      { id: "embody", label: "Cho ký ức một cơ thể mới", outcome: "Mira trở lại như một Echo hữu hạn; bầu trời Ocean Moon luôn mang dấu hiệu của hai dòng thời gian.", weather: "Mưa sao hồi sinh", economy: 1.06, control: "aurora-keepers", metrics: { identityIntegrity: 4, memoryDebt: 14, causalityPressure: 12 }, beliefsAll: { freeWill: 1, playerIsThreat: 1, aionMayBeRight: -1 } },
      { id: "release", label: "Để ký ức hòa vào biển", outcome: "Mira không trở lại, nhưng mọi người có thể nghe lời cuối của người đã mất khi thủy triều lên.", weather: "Thủy triều tưởng niệm", economy: 0.94, control: "astral-researchers", metrics: { identityIntegrity: 2, memoryDebt: -8, causalityPressure: -5 }, beliefsAll: { freeWill: 1, playerIsThreat: -1 } }
    ] },
    { zoneId: "station", title: "Lời hứa phản bội", mechanic: "Bảo vệ nhân chứng có mục tiêu bí mật riêng", summary: "Hộ tống Lyra qua ga số 7 trong khi cô tìm cách xóa chính biên bản bàn giao.", steps: ["Đột nhập kho audit", "Bảo vệ nhân chứng chạy trốn", "Khôi phục biên bản bàn giao"], echoes: ["station-handover", "station-promise"], prompt: "Bạn sẽ phán xét Lyra bằng ký ức nào?", choices: [
      { id: "forgive", label: "Tin vào lời hứa cũ", outcome: "Lyra ở lại và công khai toàn bộ audit; Astral Station mất niềm tin ngắn hạn nhưng mở hệ thống minh bạch.", weather: "Cực quang minh bạch", economy: 1.03, control: "astral-researchers", companion: "lyra", trust: 3, metrics: { identityIntegrity: 6, memoryDebt: 7, causalityPressure: 6 }, beliefs: { lyra: { freeWill: 2, coreOrder: -1, playerIsThreat: -2, aionMayBeRight: -1 } } },
      { id: "detain", label: "Tạm giữ Lyra để điều tra", outcome: "Trạm ổn định nhưng Lyra rời đội cho tới khi bạn tìm đủ bằng chứng ở Abyss.", weather: "Đèn vàng phong tỏa", economy: 0.9, control: "h-central", companion: "lyra", trust: -3, departed: true, metrics: { identityIntegrity: -4, memoryDebt: 2, causalityPressure: -6 }, beliefs: { lyra: { freeWill: -2, coreOrder: 2, playerIsThreat: 3, aionMayBeRight: 2 } } }
    ] },
    { zoneId: "abyss", title: "Sự thật bạn đã chọn quên", mechanic: "Đối thoại quyết định diễn ra giữa các phase của Aion", summary: "Đối mặt Aion, phiên bản tương lai của bạn, tại nơi HH Core lưu lệnh xóa gốc.", steps: ["Đi ngược trọng lực Nexus", "Đấu với các tương lai của chính mình", "Mở lệnh xóa nguyên bản"], echoes: ["abyss-request", "abyss-purpose"], prompt: "Bạn sẽ làm gì với bằng chứng của Aion?", choices: [
      { id: "accept", label: "Chấp nhận bằng chứng, giữ quyền chọn", outcome: "Aion ngừng chiến đấu để chờ phán quyết cuối; không dòng thời gian nào bị xóa ngay lập tức.", weather: "Nhật thực đình chiến", economy: 1, control: "free-travelers", trustAll: 1, metrics: { identityIntegrity: 3, memoryDebt: 6, causalityPressure: -4 }, beliefsAll: { freeWill: 1, playerIsThreat: -1, aionMayBeRight: 2 } },
      { id: "destroy", label: "Phá máy lưu trữ định mệnh", outcome: "Các tương lai không còn bị dự đoán, nhưng HH Core mất khả năng cảnh báo thảm họa và đồng đội sợ sức mạnh của bạn.", weather: "Bão xác suất", economy: 1.1, control: "void-cult", dangerous: 2, fearAll: 1, metrics: { identityIntegrity: 5, memoryDebt: -2, causalityPressure: 18 }, beliefsAll: { freeWill: 2, coreOrder: -2, playerIsThreat: 3, aionMayBeRight: -2 } }
    ] }
  ]);
  const STORY_OBJECTIVES = Object.freeze({
    central: [
      { event: "beacon", label: "Tìm và tương tác Dư ảnh Genesis cạnh HH Core", target: 1 },
      { event: "scan", label: "Dùng Deep Scan tại H-Central", target: 1 },
      { event: "dialogue", npcId: "luma", label: "Đối chất Navigator Luma về nhịp tim thứ năm", target: 1 }
    ],
    aurora: [
      { event: "enter-zone", label: "Đặt chân tới Aurora Vale", target: 1 },
      { event: "beacon", label: "Chạm Dư ảnh của Cael để sống lại ký ức", target: 1 },
      { event: "puzzle", puzzleId: "aurora-resonance", label: "Giải Aurora Resonance bằng lõi Băng tinh", target: 1 }
    ],
    crimson: [
      { event: "enter-zone", label: "Tiến vào Crimson Forge", target: 1 },
      { event: "defeat", archetype: "forge-hound", label: "Mở đường qua Forge Hound", target: 2 },
      { event: "puzzle", puzzleId: "forge-ignition", label: "Khóa phản ứng dây chuyền tại Forge Ignition", target: 1 }
    ],
    void: [
      { event: "enter-zone", label: "Xâm nhập Void Garden", target: 1 },
      { event: "beacon", label: "Giải mã lời thì thầm trong Dư ảnh Nyx", target: 1 },
      { event: "puzzle", puzzleId: "void-lattice", label: "Ổn định Void Lattice bằng lõi Hư không", target: 1 }
    ],
    sky: [
      { event: "enter-zone", label: "Lướt tới Sky Ruins", target: 1 },
      { event: "collect", nodeId: "sky-node-1", label: "Thu hồi Lá phiếu cuối cùng trên đảo vỡ", target: 1 },
      { event: "defeat", archetype: "sky-sentinel", label: "Bảo vệ neo quỹ đạo khỏi Sky Sentinel", target: 2 }
    ],
    ocean: [
      { event: "enter-zone", label: "Hạ cánh xuống Ocean Moon", target: 1 },
      { event: "collect", nodeId: "ocean-node-1", label: "Thu Echo từ đại dương lượng tử", target: 1 },
      { event: "beacon", label: "Tương tác Dư ảnh Mira bên bờ thủy triều", target: 1 }
    ],
    station: [
      { event: "enter-zone", label: "Cập bến Astral Station", target: 1 },
      { event: "defeat", archetype: "station-drone", label: "Bảo vệ nhân chứng khỏi Station Drone", target: 2 },
      { event: "beacon", label: "Mở audit Dư ảnh tại ga số 7", target: 1 }
    ],
    abyss: [
      { event: "enter-zone", label: "Bước vào Nexus Abyss", target: 1 },
      { event: "defeat", archetype: "abyss-herald", label: "Đánh bại hai tương lai của chính mình", target: 2 },
      { event: "beacon", label: "Mở lệnh xóa nguyên bản trong Dư ảnh Aion", target: 1 }
    ]
  });
  const STORY_INTERLUDES = Object.freeze([
    {
      id: "fifth-heartbeat",
      title: "Interlude I · Nhịp tim thứ năm",
      teaser: "Một chữ ký giọng nói tồn tại trước khi Character Genesis phục hồi bạn.",
      revelation: "HH Core xác nhận chính Voice DNA của bạn đã cấp quyền Protocol Null, nhưng dấu thời gian của lệnh sớm hơn lần phục hồi hiện tại 31 năm. Bản ghi có thể đến từ tương lai hoặc đã bị Aion dựng lại.",
      unlock: [
        { type: "signal", key: "voiceAuthorizationRecovered", label: "Khôi phục ủy quyền giọng nói trong Prologue" },
        { type: "truth", zoneId: "central", label: "Thu Truth Shard Identity" },
        { type: "echo", echoId: "central-mira", label: "Mở Echo Tên bị gạch khỏi tàu H-07" }
      ]
    },
    {
      id: "burned-command",
      title: "Interlude II · Mệnh lệnh cháy ngược",
      teaser: "Sol nhớ một mệnh lệnh có chữ ký hợp lệ nhưng thời gian không hợp lệ.",
      revelation: "Khóa sinh trắc trên lệnh thiêu hủy Crimson là thật. Điều không thể là khóa ấy được tạo ba giờ sau khi thành phố đã cháy, khiến lời khai của Sol và Forge Archive cùng đúng nhưng không thể cùng thuộc một dòng thời gian.",
      unlock: [
        { type: "shards", min: 3, label: "Thu ít nhất 3 Truth Shard" },
        { type: "echo", echoId: "crimson-order", label: "Mở Echo Mệnh lệnh mang chữ ký của bạn" },
        { type: "companionTrust", companionId: "sol", min: 2, label: "Đạt Trust 2 với Sol" }
      ]
    },
    {
      id: "mira-two-deaths",
      title: "Interlude III · Hai cái chết của Mira",
      teaser: "H-Central và Ocean Moon nhớ hai kết thúc khác nhau của cùng một người.",
      revelation: "Mira vừa bị xóa trên H-07 vừa chết già bên Ocean Moon. Memory Debt không phải số ký ức bạn giữ, mà là số cuộc đời khác phải quên để ký ức ấy tiếp tục tồn tại.",
      unlock: [
        { type: "shards", min: 6, label: "Thu ít nhất 6 Truth Shard" },
        { type: "echo", echoId: "ocean-mira", label: "Mở Echo Giọng nói dưới Ocean Moon" },
        { type: "metric", key: "memoryDebt", min: 25, label: "Memory Debt đạt 25" }
      ]
    },
    {
      id: "archivist-invited",
      title: "Interlude IV · Kẻ phản bội được mời vào",
      teaser: "Biên bản giao nộp Lyra giấu một người ra lệnh thứ ba.",
      revelation: "Lyra không tự tìm The Archivist. Một phiên bản của bạn đã mở cổng, giao khóa Genesis và buộc cô đóng vai kẻ phản bội để Aion tin rằng kế hoạch xóa đã hoàn tất.",
      unlock: [
        { type: "shards", min: 7, label: "Thu ít nhất 7 Truth Shard" },
        { type: "echo", echoId: "station-promise", label: "Mở Echo Lời hứa không được phép nhớ" },
        { type: "links", min: 4, label: "Nối ít nhất 4 cặp Echo" }
      ]
    },
    {
      id: "aion-remembers-cycle",
      title: "Interlude Ω · Aion nhớ vòng lặp",
      teaser: "Có người khác ngoài bạn giữ ký ức qua New Game+.",
      revelation: "Aion gọi đúng số vòng chơi trước khi bạn nói. Hắn không đứng ngoài vòng lặp: mỗi New Game+ làm ký ức của hắn rõ hơn và đẩy Causality Pressure của thế giới mới lên cao hơn.",
      unlock: [
        { type: "ngPlus", min: 1, label: "Bắt đầu ít nhất một New Game+" },
        { type: "signal", key: "aionRecognizesCycle", label: "Nhận tín hiệu Aion nhận ra vòng lặp" }
      ]
    }
  ]);
  const STORY_TESTIMONIES = Object.freeze([
    {
      id: "central-authorization",
      zoneId: "central",
      title: "Ai cho phép xóa Mira?",
      left: { speaker: "Navigator Luma", text: "Mira chưa từng có tên trong thủy thủ đoàn H-07." },
      right: { speaker: "Voice DNA của bạn", text: "Xác nhận Protocol Null: xóa nhân chứng M-01 trước khi xóa chủ thể H." },
      insight: "Hai lời khai đều vượt kiểm tra toàn vẹn. Xung đột nằm ở dòng thời gian, không nằm ở người nói.",
      unlock: [
        { type: "signal", key: "voiceAuthorizationRecovered", label: "Nghe bản ủy quyền Voice DNA" },
        { type: "echo", echoId: "central-mira", label: "Mở Echo của Mira" }
      ]
    },
    {
      id: "aurora-family",
      zoneId: "aurora",
      title: "Cael đã sống cùng ai?",
      left: { speaker: "Cael", text: "Tôi nhớ bạn trong căn nhà ở triền băng suốt mười hai năm." },
      right: { speaker: "Aurora Census", text: "Nền móng căn nhà chưa từng được xây; gia đình Cael không có thành viên thứ năm." },
      insight: "Ký ức của Cael mang nhiệt độ và cảm giác thật, còn hồ sơ vật chất không có dấu hiệu bị sửa.",
      unlock: [
        { type: "truth", zoneId: "aurora", label: "Thu Truth Shard Memory" },
        { type: "echo", echoId: "aurora-home", label: "Mở Echo Ngôi nhà không có trong lịch sử" }
      ]
    },
    {
      id: "crimson-order-time",
      zoneId: "crimson",
      title: "Ai ký lệnh thiêu hủy?",
      left: { speaker: "Sol", text: "Tôi nhận lệnh trực tiếp từ bạn trước khi cổng Void vỡ." },
      right: { speaker: "Forge Archive", text: "Khóa sinh trắc của lệnh được phát hành sau thảm họa ba giờ." },
      insight: "Lệnh có thể đã đi ngược thời gian, hoặc một trong hai nhân chứng thuộc về dòng lịch sử khác.",
      unlock: [
        { type: "interlude", interludeId: "burned-command", label: "Mở Interlude Mệnh lệnh cháy ngược" }
      ]
    },
    {
      id: "void-voice",
      zoneId: "void",
      title: "Tiếng nói muốn cứu hay chiếm Nyx?",
      left: { speaker: "Nyx", text: "Giọng nói bảo tôi mở Nexus để cứu bạn." },
      right: { speaker: "Aion", text: "Tôi đã cầu xin Nyx đóng cổng vì bạn sẽ dùng nó để nhớ lại." },
      insight: "Cả hai bản âm đều cùng tần số nhưng khác chiều thời gian; chưa thể xác định câu nào đến trước.",
      unlock: [
        { type: "truth", zoneId: "void", label: "Thu Truth Shard Fear" },
        { type: "echo", echoId: "void-whisper", label: "Mở Echo Lời thì thầm ngược thời gian" }
      ]
    },
    {
      id: "ocean-mira-life",
      zoneId: "ocean",
      title: "Mira chết lúc nào?",
      left: { speaker: "Ký ức H-07", text: "Mira bị xóa lúc 08:52 ngay trước mắt bạn." },
      right: { speaker: "Quantum Sea", text: "Mira sống thêm 63 năm và để lại lời nhắn cuối dưới đáy biển." },
      insight: "Ocean Moon không lưu bóng ma; nó lưu một cuộc đời hoàn chỉnh mà H-Central đã đánh đổi.",
      unlock: [
        { type: "interlude", interludeId: "mira-two-deaths", label: "Mở Interlude Hai cái chết của Mira" }
      ]
    },
    {
      id: "station-betrayal",
      zoneId: "station",
      title: "Lyra phản bội hay giữ lời?",
      left: { speaker: "Lyra", text: "Tôi giao bạn cho Archivist để cứu H-Central." },
      right: { speaker: "Giọng của bạn", text: "Khi tôi trở lại, hãy phản bội tôi lần nữa nếu đó là cách duy nhất để giữ cửa Genesis." },
      insight: "Sự phản bội có thể là phần cuối của lời hứa, nhưng không xóa trách nhiệm của Lyra với những gì đã xảy ra.",
      unlock: [
        { type: "truth", zoneId: "station", label: "Thu Truth Shard Betrayal" },
        { type: "echo", echoId: "station-promise", label: "Mở Echo Lời hứa không được phép nhớ" }
      ]
    },
    {
      id: "abyss-request",
      zoneId: "abyss",
      title: "Bạn là nạn nhân hay người khởi xướng?",
      left: { speaker: "Aion", text: "Chính bạn yêu cầu tôi xóa bạn khỏi mọi dòng thời gian." },
      right: { speaker: "Genesis Escape Route", text: "Chính bạn để lại đường phục hồi nhằm phá dòng thời gian hoàn hảo của Aion." },
      insight: "Hai mệnh lệnh đối nghịch đều dùng cùng Character DNA. Có thể bạn đã dự phòng chống lại chính quyết định của mình.",
      unlock: [
        { type: "truth", zoneId: "abyss", label: "Thu Truth Shard Truth" },
        { type: "echo", echoId: "abyss-purpose", label: "Mở Echo Mục đích thật của Genesis" },
        { type: "interlude", interludeId: "archivist-invited", label: "Mở Interlude Kẻ phản bội được mời vào" }
      ]
    }
  ]);
  const STORY_ENDINGS = Object.freeze([
    { id: "restoration", title: "Restoration", color: "#72efff", premise: "Khôi phục mọi dòng thời gian và chấp nhận một vũ trụ hỗn loạn nhưng đầy ký ức." },
    { id: "perfect-silence", title: "Perfect Silence", color: "#d6ddff", premise: "Tự xóa mình để một dòng lịch sử ổn định tiếp tục mà không còn biết cái giá đã trả." },
    { id: "one-true-world", title: "One True World", color: "#ffd36b", premise: "Chọn một thế giới duy nhất và gánh trách nhiệm với những thực tại không được chọn." },
    { id: "free-constellation", title: "Free Constellation", color: "#b98cff", premise: "Tách tám khu vực thành các thực tại tự trị, tự do nhưng không còn một Core chung." },
    { id: "astral-rebirth", title: "Astral Rebirth", color: "#ff78cf", premise: "Trở thành HH Core sống, giữ mọi thế giới tồn tại nhưng đánh đổi danh tính cá nhân." }
  ]);
  const STORY_PROLOGUE = Object.freeze({
    awakening: { kicker: "00:01 · H-07 ĐANG RƠI", title: "Bạn tỉnh dậy giữa một tai nạn chưa từng được ghi nhận", text: "Character Genesis vừa hoàn tất thì khoang ngủ đông bật tung. Bên dưới, H-Central lao tới trong mưa neon; hệ thống khẳng định con tàu không có tên trong lịch sử.", next: "dna-signal", action: "Bám lấy thành tàu" },
    "dna-signal": { kicker: "02:14 · TÍN HIỆU KHÔNG NGUỒN", title: "Một giọng nói gọi đúng tên bạn", text: "‘{player}, đừng để họ quét lại Character DNA. Nếu Core nhận ra bạn, lịch sử sẽ bắt đầu tự xóa lần nữa.’ Tín hiệu biết cả những chỉnh sửa bạn vừa chọn trong Genesis.", ngPlusText: "‘{player}, vòng {cycle} đã bắt đầu.’ Giọng Aion đọc đúng số lần thế giới được tái tạo rồi nhắc lại một lựa chọn bạn chưa thực hiện trong vòng này.", next: "mirror-attack", action: "Mở kênh khẩn cấp" },
    "mirror-attack": { kicker: "04:47 · H-CENTRAL", title: "Kẻ tấn công mang khuôn mặt của bạn", text: "Sinh vật tràn qua quảng trường. Mỗi con có cùng gương mặt, vết sẹo và ánh mắt của bạn, nhưng chuyển động như những tương lai đang tranh nhau một cơ thể.", next: "first-choice", action: "Chống trả và tìm đường tới Core" },
    "first-choice": { kicker: "07:31 · LỰA CHỌN KHÔNG THỂ HOÀN TÁC", title: "Mira bị kẹt trong ga dân sự; HH Core sắp vỡ", text: "Bạn chỉ đủ thời gian đi một hướng. Mira nói cô biết vì sao mọi hồ sơ đều thiếu tên bạn. Sol yêu cầu bảo vệ Core để cứu hàng triệu người.", choice: true },
    erasure: { kicker: "08:52 · MIRA / RECORD NOT FOUND", title: "Mira bị xóa hai lần trước mắt bạn", text: "Mira tan thành bụi sáng; ngay sau đó ảnh, tên và ghế cứu nạn của cô biến mất khỏi con tàu. Lyra, Cael, Nyx và Sol đồng loạt hỏi ‘Mira là ai?’. Chỉ bạn còn nhớ, và ký ức ấy bắt đầu làm đau như một món nợ.", next: "voice-authorization", action: "Giữ tên Mira trong trí nhớ" },
    "voice-authorization": { kicker: "09:17 · PROTOCOL NULL / VOICE MATCH", title: "Chính giọng của bạn đã cho phép cuộc xóa", text: "HH Core phát một bản dựng từ Voice DNA — không dùng microphone hiện tại. Giọng nhân vật của bạn nói: ‘Xác nhận Protocol Null. Xóa Mira trước. Xóa tôi sau.’ Chữ ký sinh trắc hợp lệ, nhưng bạn không nhớ từng nói câu đó.", ngPlusText: "HH Core phát lại Voice DNA. Lần này bản ghi thêm một câu không có ở vòng trước: ‘Nếu đây là vòng {cycle}, Aion đã bắt đầu nhớ. Đừng tin cả tôi.’", next: "aion-reveal", action: "Đối chiếu chữ ký Voice DNA" },
    "aion-reveal": { kicker: "09:44 · TÍN HIỆU CỦA THE ARCHIVIST", title: "Phản diện tháo mặt nạ", text: "Khuôn mặt phía sau mặt nạ là bạn, già hơn và kiệt sức. Aion nói: ‘Tôi không săn đuổi chúng ta. Tôi đang hoàn thành điều chính bạn từng yêu cầu.’", ngPlusText: "Khuôn mặt phía sau mặt nạ vẫn là bạn. Aion nhìn thẳng vào ký ức của vòng {cycle}: ‘Lần trước bạn gọi tôi là quái vật. Lần này, hãy hỏi ai đã dạy tôi nhớ qua mỗi lần tái sinh.’", next: "departure", action: "Yêu cầu hắn đưa bằng chứng" },
    departure: { kicker: "10:00 · MISSION CONSTELLATION", title: "Tám mảnh sự thật đã thức tỉnh", text: "HH Core Star vỡ thành tám Truth Shard. Mỗi thế giới nhớ một phiên bản khác nhau về bạn. Hành trình bắt đầu bằng câu hỏi: vì sao cả vũ trụ phải quên bạn để tiếp tục tồn tại?", finish: true, action: "Bước vào H-Central" }
  });
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

  function normalizeBoneName(value) {
    return String(value || "")
      .replace(/^.*[:|]/, "")
      .replace(/[._\-\s]/g, "")
      .replace(/mixamorig/gi, "")
      .toLowerCase();
  }

  function classifyCharacterAsset(report = {}) {
    const checks = [
      { id: "head", label: "Head mesh 20–28K", pass: report.headVertices >= HERO_ASSET_REQUIREMENTS.headVerticesMin && report.headVertices <= HERO_ASSET_REQUIREMENTS.headVerticesMax, value: `${Number(report.headVertices || 0).toLocaleString("vi-VN")} vertices` },
      { id: "face", label: "52 facial morph native", pass: report.faceMorphTargets >= HERO_ASSET_REQUIREMENTS.nativeFaceMorphs, value: `${report.faceMorphTargets || 0}/52` },
      { id: "skeleton", label: "Skeleton web 80–120 bone", pass: report.bones >= HERO_ASSET_REQUIREMENTS.bonesMin && report.bones <= HERO_ASSET_REQUIREMENTS.bonesMax, value: `${report.bones || 0} bone` },
      { id: "coverage", label: "HH Humanoid coverage ≥ 80%", pass: Number(report.skeletonCoverage || 0) >= HERO_ASSET_REQUIREMENTS.skeletonCoverage, value: `${Math.round(Number(report.skeletonCoverage || 0) * 100)}%` },
      { id: "anatomy", label: "Mắt, giác mạc, tear line, răng, lưỡi, lông mi, tóc tách mesh", pass: report.separateEyeMeshes >= 2 && report.corneaMeshes >= 1 && report.tearLineMeshes >= 1 && report.teethMeshes >= 1 && report.tongueMeshes >= 1 && report.eyelashMeshes >= 1 && report.hairCardMeshes >= 1, value: `${report.separateEyeMeshes || 0}/2 mắt · ${[report.corneaMeshes, report.tearLineMeshes, report.teethMeshes, report.tongueMeshes, report.eyelashMeshes, report.hairCardMeshes].filter(Boolean).length}/6 module` },
      { id: "pbr", label: "PBR skin maps", pass: report.normalMaps >= 1 && report.roughnessMaps >= 1 && report.thicknessMaps >= 1, value: `N${report.normalMaps || 0} · R${report.roughnessMaps || 0} · T${report.thicknessMaps || 0}` },
      { id: "textures", label: "Texture tối đa 2K", pass: report.maxTextureSize > 0 && report.maxTextureSize <= HERO_ASSET_REQUIREMENTS.textureMax, value: `${report.maxTextureSize || 0}px` },
      { id: "single-hero", label: "Một Hero mesh duy nhất", pass: report.skinnedMeshes >= 1, value: `${report.skinnedMeshes || 0} SkinnedMesh · không proxy` }
    ];
    const passed = checks.filter((check) => check.pass).length;
    const heroReady = checks.every((check) => check.pass);
    const assetClass = report.skinnedMeshes && report.bones
      ? CHARACTER_ASSET_CLASSES.hero
      : CHARACTER_ASSET_CLASSES.unsupported;
    return { assetClass: assetClass.id, assetClassLabel: assetClass.label, heroReady, heroChecks: checks, heroScore: Math.round((passed / checks.length) * 100) };
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
    if (!report.skinnedMeshes) warnings.push("Không có SkinnedMesh; Hero Prime sẽ bị từ chối thay vì thay bằng proxy.");
    if (!report.bones) warnings.push("Không phát hiện skeleton humanoid.");
    if (!report.animations) warnings.push("Không có animation clip; runtime giữ pose gốc.");
    if ((report.skeletonCoverage || 0) < 0.55 && report.bones) warnings.push("Skeleton chưa khớp tốt với HH Humanoid.");
    if (report.rootMotionTracks) warnings.push(`${report.rootMotionTracks} root-motion track X/Z sẽ được chuyển thành in-place để tránh trôi nhân vật.`);
      if (report.headVertices && report.headVertices < HERO_ASSET_REQUIREMENTS.headVerticesMin) warnings.push("Head mesh dưới 20K vertices; phù hợp gameplay/NPC nhưng chưa đạt Hero V13.");
    if ((report.faceMorphTargets || 0) < 52) warnings.push(`Model có ${report.faceMorphTargets || 0}/52 facial morph native; các kênh còn thiếu không được giả bằng model chất lượng thấp.`);
    if ((report.maxTextureSize || 0) > 2048) warnings.push("Texture trên 2K sẽ tốn bộ nhớ; nên xuất KTX2 2K cho Web Hero.");
    if ((report.bones || 0) > 120) warnings.push("Skeleton trên 120 bone; nên giảm bone phụ cho bản web.");
    const classification = classifyCharacterAsset(report);
    if (!classification.heroReady) warnings.push(`Hero gate kỹ thuật đạt ${classification.heroScore}%; đây vẫn là asset mạnh nhất đang được khóa duy nhất, không có visual fallback.`);
    return {
      valid: errors.length === 0,
      errors,
      warnings,
      score: clamp(100 - errors.length * 28 - warnings.length * 5, 0, 100),
      ...classification
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
    return {
      appearanceVersion: APPEARANCE_VERSION,
      baseModel: HERO_CHARACTER_MODEL_ID,
      sourceProvider: "hero-core",
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
      voice: { id: "central-clear", pitch: 0.5, pace: 0.5, emotion: 0.58 },
      motionDNA: { preset: "balanced", ...MOTION_DNA_PRESETS.balanced, rootMotion: true, motionWarp: true, upperBodyLayer: true },
      outfit: ["central-jacket-02", "combat-boots-01"],
      decals: { freckles: 0, scars: 0, moles: 0, makeup: 0, tattoos: 0, wrinkles: 0, eyeShadow: 0, age: 0 },
      surface: { pores: 0.72, subsurface: 0.58, roughness: 0.52, flush: 0.18, wetness: 0 },
      evolution: { persistentScars: 0, clothingDamage: 0, fatigueMemory: 0, auraPower: 0, tattooResponse: 0 },
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
    return {
      ...base,
      appearanceVersion: APPEARANCE_VERSION,
      baseModel: HERO_CHARACTER_MODEL_ID,
      sourceProvider: "hero-core",
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
      voice: {
        id: CHARACTER_VOICES.some((voice) => voice.id === recipe.voice?.id) ? recipe.voice.id : base.voice.id,
        pitch: Number.isFinite(Number(recipe.voice?.pitch)) ? clamp(recipe.voice.pitch, 0, 1) : base.voice.pitch,
        pace: Number.isFinite(Number(recipe.voice?.pace)) ? clamp(recipe.voice.pace, 0, 1) : base.voice.pace,
        emotion: Number.isFinite(Number(recipe.voice?.emotion)) ? clamp(recipe.voice.emotion, 0, 1) : base.voice.emotion
      },
      motionDNA: (() => {
        const presetId = MOTION_DNA_PRESETS[recipe.motionDNA?.preset] ? recipe.motionDNA.preset : base.motionDNA.preset;
        const preset = MOTION_DNA_PRESETS[presetId];
        const bounded = ["posture", "stride", "acceleration", "braking", "turnResponse", "combatWeight", "secondaryMotion"];
        return {
          preset: presetId,
          ...Object.fromEntries(bounded.map((key) => [key, Number.isFinite(Number(recipe.motionDNA?.[key])) ? clamp(recipe.motionDNA[key], 0, 1) : preset[key]])),
          dodgeStyle: ["sidestep", "dash", "roll", "spin"].includes(recipe.motionDNA?.dodgeStyle) ? recipe.motionDNA.dodgeStyle : preset.dodgeStyle,
          rootMotion: recipe.motionDNA?.rootMotion !== false,
          motionWarp: recipe.motionDNA?.motionWarp !== false,
          upperBodyLayer: recipe.motionDNA?.upperBodyLayer !== false
        };
      })(),
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
      evolution: Object.fromEntries(Object.keys(base.evolution).map((id) => [
        id,
        Number.isFinite(Number(recipe.evolution?.[id])) ? clamp(recipe.evolution[id], 0, 1) : base.evolution[id]
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
      voice: {
        id: normalized.voice.id,
        pitch: Number(normalized.voice.pitch.toFixed(3)),
        pace: Number(normalized.voice.pace.toFixed(3)),
        emotion: Number(normalized.voice.emotion.toFixed(3))
      },
      motionDNA: {
        ...normalized.motionDNA,
        posture: Number(normalized.motionDNA.posture.toFixed(3)),
        stride: Number(normalized.motionDNA.stride.toFixed(3)),
        acceleration: Number(normalized.motionDNA.acceleration.toFixed(3)),
        braking: Number(normalized.motionDNA.braking.toFixed(3)),
        turnResponse: Number(normalized.motionDNA.turnResponse.toFixed(3)),
        combatWeight: Number(normalized.motionDNA.combatWeight.toFixed(3)),
        secondaryMotion: Number(normalized.motionDNA.secondaryMotion.toFixed(3))
      },
      outfit: normalized.outfit.slice(0, 4),
      decals: Object.fromEntries(Object.entries(normalized.decals).map(([id, value]) => [id, Number(value.toFixed(3))])),
      surface: Object.fromEntries(Object.entries(normalized.surface).map(([id, value]) => [id, Number(value.toFixed(3))])),
      evolution: Object.fromEntries(Object.entries(normalized.evolution).map(([id, value]) => [id, Number(value.toFixed(3))]))
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

  function defaultStoryMissionState() {
    return Object.fromEntries(STORY_MISSIONS.map((mission, index) => [mission.zoneId, {
      status: index === 0 ? "active" : "locked",
      progress: 0,
      objectiveProgress: 0,
      completedEventKeys: [],
      choice: "",
      completedAt: ""
    }]));
  }

  function defaultCompanionBeliefs(id) {
    const defaults = {
      lyra: { freeWill: 2, coreOrder: 0, playerIsThreat: 1, aionMayBeRight: 0 },
      cael: { freeWill: 1, coreOrder: 0, playerIsThreat: 0, aionMayBeRight: 0 },
      nyx: { freeWill: 2, coreOrder: -1, playerIsThreat: 1, aionMayBeRight: 1 },
      sol: { freeWill: 0, coreOrder: 2, playerIsThreat: 1, aionMayBeRight: 1 }
    };
    return { ...(defaults[id] || defaults.lyra) };
  }

  function defaultStoryInterludeState() {
    return Object.fromEntries(STORY_INTERLUDES.map((interlude) => [interlude.id, {
      unlocked: false,
      viewed: false,
      unlockedAt: "",
      viewedAt: ""
    }]));
  }

  function migrateStoryV2Metrics(inputStory) {
    const story = inputStory && typeof inputStory === "object" ? inputStory : null;
    if (!story) return { ...STORY_METRIC_DEFAULTS };
    const sourceVersion = Number(story.version || 1);
    const existing = story.metrics && typeof story.metrics === "object" ? story.metrics : null;
    if (sourceVersion >= STORY_VERSION && existing) {
      return Object.fromEntries(STORY_METRIC_KEYS.map((key) => [key, clamp(existing[key] ?? STORY_METRIC_DEFAULTS[key], 0, 100)]));
    }
    const decisions = Array.isArray(story.decisions) ? story.decisions.length : 0;
    const echoes = story.echoes && typeof story.echoes === "object"
      ? Object.values(story.echoes).filter((record) => record?.unlocked === true).length
      : 0;
    const links = Array.isArray(story.constellationLinks) ? story.constellationLinks.length : 0;
    const dangerous = Number(story.endingFlags?.dangerousPowerUses || 0);
    const cycle = Number(story.newGamePlus || 0);
    return {
      identityIntegrity: clamp(STORY_METRIC_DEFAULTS.identityIntegrity + Math.min(16, echoes) - dangerous * 4 + Math.min(8, decisions), 0, 100),
      memoryDebt: clamp(STORY_METRIC_DEFAULTS.memoryDebt + decisions * 3 + cycle * 8 - Math.min(12, links * 2), 0, 100),
      causalityPressure: clamp(STORY_METRIC_DEFAULTS.causalityPressure + decisions * 5 + dangerous * 8 + cycle * 10, 0, 100)
    };
  }

  function normalizeStoryMetrics(value, fallback = STORY_METRIC_DEFAULTS) {
    const source = value && typeof value === "object" ? value : {};
    return Object.fromEntries(STORY_METRIC_KEYS.map((key) => [key, Math.round(clamp(source[key] ?? fallback[key], 0, 100))]));
  }

  function normalizeCompanionBeliefs(input, id) {
    const source = input && typeof input === "object" ? input : {};
    const fallback = defaultCompanionBeliefs(id);
    return Object.fromEntries(STORY_BELIEF_KEYS.map((key) => [key, clamp(source[key] ?? fallback[key], key === "playerIsThreat" ? 0 : -10, 10)]));
  }

  function migrateCompanionBeliefs(inputState, id) {
    const existing = inputState?.companions?.[id]?.beliefs;
    if (existing && typeof existing === "object") return normalizeCompanionBeliefs(existing, id);
    const beliefs = defaultCompanionBeliefs(id);
    STORY_MISSIONS.forEach((mission) => {
      const choiceId = inputState?.story?.missions?.[mission.zoneId]?.choice;
      const choice = mission.choices.find((item) => item.id === choiceId);
      const delta = { ...(choice?.beliefsAll || {}), ...(choice?.beliefs?.[id] || {}) };
      STORY_BELIEF_KEYS.forEach((key) => {
        beliefs[key] = clamp(Number(beliefs[key] || 0) + Number(delta[key] || 0), key === "playerIsThreat" ? 0 : -10, 10);
      });
    });
    return beliefs;
  }

  function storyConditionMet(state, condition = {}) {
    const story = state?.story || state || {};
    const companions = state?.companions || story.companions || {};
    const truths = story.truthShards || {};
    const echoes = story.echoes || {};
    const metrics = story.metrics || {};
    switch (condition.type) {
      case "truth": return truths[condition.zoneId]?.discovered === true;
      case "echo": return echoes[condition.echoId]?.unlocked === true;
      case "shards": return Object.values(truths).filter((record) => record?.discovered).length >= Number(condition.min || 0);
      case "links": return Array.isArray(story.constellationLinks) && story.constellationLinks.length >= Number(condition.min || 0);
      case "signal": return Boolean(story.hiddenSignals?.[condition.key]);
      case "metric": {
        const value = Number(metrics[condition.key] || 0);
        return value >= Number(condition.min ?? 0) && (condition.max === undefined || value <= Number(condition.max));
      }
      case "ngPlus": return Number(story.newGamePlus || 0) >= Number(condition.min || 0);
      case "prologue": return Boolean(story.prologueCompletedAt);
      case "companionTrust": return Number(companions?.[condition.companionId]?.trust || 0) >= Number(condition.min || 0);
      case "interlude": return story.interludes?.[condition.interludeId]?.unlocked === true;
      case "decision": return story.missions?.[condition.zoneId]?.choice === condition.choice;
      default: return false;
    }
  }

  function storyUnlockStatus(state, unlock = []) {
    return unlock.map((condition) => ({
      met: storyConditionMet(state, condition),
      label: String(condition.label || "Điều kiện ẩn")
    }));
  }

  function defaultStoryState() {
    return {
      version: STORY_VERSION,
      chapter: "prologue",
      prologueStage: "awakening",
      prologueCompletedAt: "",
      identityStatus: "erased",
      aionEvidence: 0,
      metrics: { ...STORY_METRIC_DEFAULTS },
      interludes: defaultStoryInterludeState(),
      truthShards: Object.fromEntries(STORY_ZONE_ORDER.map((zoneId) => [zoneId, { discovered: false, collectedAt: "" }])),
      echoes: Object.fromEntries(ECHO_MEMORIES.map((echo) => [echo.id, { unlocked: false, viewed: false, unlockedAt: "" }])),
      constellationLinks: [],
      missions: defaultStoryMissionState(),
      decisions: [],
      hiddenSignals: {},
      longTermConsequences: [],
      dialogueHistory: [],
      recapQueue: [],
      endingFlags: { dangerousPowerUses: 0, genesisPurpose: false, selected: "" },
      newGamePlus: 0,
      lastRecapAt: ""
    };
  }

  function reconcileStoryState(state) {
    const story = state?.story;
    if (!story?.missions) return state;

    story.metrics = normalizeStoryMetrics(story.metrics, STORY_METRIC_DEFAULTS);
    story.interludes ||= defaultStoryInterludeState();
    STORY_INTERLUDES.forEach((interlude) => {
      const record = story.interludes[interlude.id] ||= { unlocked: false, viewed: false, unlockedAt: "", viewedAt: "" };
      if (!record.unlocked && interlude.unlock.every((condition) => storyConditionMet(state, condition))) {
        record.unlocked = true;
        record.unlockedAt ||= nowIso();
      }
      record.unlocked = record.unlocked === true;
      record.viewed = record.unlocked && record.viewed === true;
      record.unlockedAt = String(record.unlockedAt || "").slice(0, 40);
      record.viewedAt = String(record.viewedAt || "").slice(0, 40);
    });

    const seenLinks = new Set();
    story.constellationLinks = (story.constellationLinks || []).filter((link) => {
      const pair = [link.from, link.to].sort().join("::");
      if (!link.from || !link.to || link.from === link.to || seenLinks.has(pair)) return false;
      seenLinks.add(pair);
      return true;
    });

    let openMissionFound = false;
    let completedMissionCount = 0;
    STORY_MISSIONS.forEach((mission) => {
      const record = story.missions[mission.zoneId];
      const validChoice = mission.choices.some((choice) => choice.id === record.choice);
      const validCompletion = !openMissionFound && record.status === "completed" && validChoice;
      if (validCompletion) {
        record.progress = mission.steps.length;
        record.objectiveProgress = 0;
        story.truthShards[mission.zoneId].discovered = true;
        story.truthShards[mission.zoneId].collectedAt ||= record.completedAt || nowIso();
        completedMissionCount += 1;
        if (state.checkpoints) state.checkpoints[mission.zoneId] = true;
        return;
      }

      if (!openMissionFound) {
        record.status = record.progress >= mission.steps.length ? "decision" : "active";
        record.choice = "";
        record.completedAt = "";
        if (state.checkpoints) state.checkpoints[mission.zoneId] = true;
        openMissionFound = true;
        return;
      }

      record.status = "locked";
      record.choice = "";
      record.completedAt = "";
    });

    // Mission reconciliation can discover Truth Shards/checkpoints; run the
    // unlock pass once more so a migrated V1 save exposes every eligible V2
    // interlude immediately on first load.
    STORY_INTERLUDES.forEach((interlude) => {
      const record = story.interludes[interlude.id];
      if (record && !record.unlocked && interlude.unlock.every((condition) => storyConditionMet(state, condition))) {
        record.unlocked = true;
        record.unlockedAt ||= nowIso();
      }
    });

    story.aionEvidence = Math.max(Number(story.aionEvidence || 0), completedMissionCount);
    const activeMission = STORY_MISSIONS.find((mission) => ["active", "decision"].includes(story.missions[mission.zoneId].status));
    story.chapter = story.endingFlags.selected
      ? "epilogue"
      : activeMission?.zoneId || (completedMissionCount === STORY_MISSIONS.length ? "finale" : story.prologueCompletedAt ? "central" : "prologue");

    const abyssEchoIds = ECHO_MEMORIES.filter((echo) => echo.zoneId === "abyss").map((echo) => echo.id);
    const hasAbyssLink = abyssEchoIds.length === 2 && story.constellationLinks.some((link) => (
      [link.from, link.to].includes(abyssEchoIds[0]) && [link.from, link.to].includes(abyssEchoIds[1])
    ));
    if (hasAbyssLink) story.endingFlags.genesisPurpose = true;
    return state;
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
      choiceHistory: [],
      lastSyncAt: nowIso()
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
        name: "Lyra H",
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
        characterSlots: [],
        versionHistory: [],
        lastSavedAt: "",
        creatorCompletedAt: "",
        creatorVersion: 0
      },
      inventory: {
        "starter-blade": { quantity: 1, favorite: true, locked: true, acquiredAt: nowIso() }
      },
      quests: defaultQuestState(),
      story: defaultStoryState(),
      world: {
        version: 1,
        zones: Object.fromEntries(Object.entries(WORLD_ZONE_DEFAULTS).map(([id, value]) => [id, { ...value, discovered: id === "central", updatedAt: nowIso() }])),
        factions: Object.fromEntries(FACTIONS.map((faction) => [faction.id, { reputation: 0, rank: "Neutral", supportedEvents: 0, updatedAt: nowIso() }])),
        eventLog: [],
        activeEvent: null,
        choiceHistory: [],
        lastSyncAt: nowIso()
      },
      companions: Object.fromEntries(CHARACTER_ORDER.map((id) => [id, {
        unlocked: id === "lyra",
        bond: id === "lyra" ? 1 : 0,
        trust: id === "lyra" ? 1 : 0,
        fear: 0,
        loyalty: id === "lyra" ? 1 : 0,
        memoryIntegrity: 10,
        promiseFlags: [],
        beliefs: defaultCompanionBeliefs(id),
        injured: false,
        departed: false,
        betrayed: false,
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
        weapon: "starter-blade",
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
        characterMode: "hero",
        characterQuality: "hero",
        characterPipeline: "hero-core",
        characterStudio: "central",
        facialAnimation: true,
        surfaceFx: true,
        microDetail: true,
        naturalMotion: true,
        eyePerformance: true,
        secondaryMotion: true,
        digitalHumanQuality: "hero",
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
    const storyMetrics = migrateStoryV2Metrics(input.story);
    const legacyStory = Number(input.story?.version || 1) < STORY_VERSION;
    const legacyPrologueCompleted = Boolean(input.story?.prologueCompletedAt);
    const legacyVoiceStagePassed = legacyStory && ["aion-reveal", "departure"].includes(input.story?.prologueStage);
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
        characterSlots: Array.isArray(input.appearance?.characterSlots)
          ? input.appearance.characterSlots.slice(-6).map((slot) => ({
            id: String(slot?.id || uid("slot")).slice(0, 80),
            name: String(slot?.name || "Nhà du hành").slice(0, 40),
            characterId: CHARACTERS[slot?.characterId] ? slot.characterId : "lyra",
            recipe: normalizeAppearanceRecipe(slot?.recipe, slot?.characterId),
            createdAt: String(slot?.createdAt || nowIso()).slice(0, 40),
            updatedAt: String(slot?.updatedAt || slot?.createdAt || nowIso()).slice(0, 40)
          }))
          : [],
        versionHistory: Array.isArray(input.appearance?.versionHistory)
          ? input.appearance.versionHistory.slice(-30).map((entry) => ({
            id: String(entry?.id || uid("look-version")).slice(0, 80),
            characterId: CHARACTERS[entry?.characterId] ? entry.characterId : "lyra",
            label: String(entry?.label || "Cập nhật ngoại hình").slice(0, 80),
            recipe: compactAppearanceRecipe(entry?.recipe, entry?.characterId),
            createdAt: String(entry?.createdAt || nowIso()).slice(0, 40)
          }))
          : [],
        lastSavedAt: String(input.appearance?.lastSavedAt || "").slice(0, 40),
        creatorCompletedAt: String(input.appearance?.creatorCompletedAt || "").slice(0, 40),
        creatorVersion: clamp(input.appearance?.creatorVersion ?? 0, 0, CHARACTER_VISUAL_VERSION)
      },
      inventory: input.inventory && typeof input.inventory === "object" ? input.inventory : base.inventory,
      quests: { ...base.quests, ...(input.quests || {}) },
      story: {
        ...base.story,
        ...(input.story || {}),
        version: STORY_VERSION,
        chapter: String(input.story?.chapter || base.story.chapter).slice(0, 40),
        prologueStage: STORY_PROLOGUE[input.story?.prologueStage] ? input.story.prologueStage : base.story.prologueStage,
        prologueCompletedAt: String(input.story?.prologueCompletedAt || "").slice(0, 40),
        identityStatus: ["erased", "remembered", "core"].includes(input.story?.identityStatus) ? input.story.identityStatus : "erased",
        aionEvidence: clamp(input.story?.aionEvidence ?? 0, 0, STORY_ZONE_ORDER.length),
        metrics: normalizeStoryMetrics(input.story?.metrics, storyMetrics),
        interludes: Object.fromEntries(STORY_INTERLUDES.map((interlude) => {
          const record = input.story?.interludes?.[interlude.id] || {};
          return [interlude.id, {
            unlocked: record.unlocked === true,
            viewed: record.viewed === true,
            unlockedAt: String(record.unlockedAt || "").slice(0, 40),
            viewedAt: String(record.viewedAt || "").slice(0, 40)
          }];
        })),
        truthShards: Object.fromEntries(STORY_ZONE_ORDER.map((zoneId) => [zoneId, {
          discovered: input.story?.truthShards?.[zoneId]?.discovered === true,
          collectedAt: String(input.story?.truthShards?.[zoneId]?.collectedAt || "").slice(0, 40)
        }])),
        echoes: Object.fromEntries(ECHO_MEMORIES.map((echo) => [echo.id, {
          unlocked: input.story?.echoes?.[echo.id]?.unlocked === true,
          viewed: input.story?.echoes?.[echo.id]?.viewed === true,
          unlockedAt: String(input.story?.echoes?.[echo.id]?.unlockedAt || "").slice(0, 40)
        }])),
        constellationLinks: Array.isArray(input.story?.constellationLinks)
          ? input.story.constellationLinks.slice(-40).map((link) => ({
            id: String(link?.id || uid("echo-link")).slice(0, 100),
            from: ECHO_MEMORIES.some((echo) => echo.id === link?.from) ? link.from : "",
            to: ECHO_MEMORIES.some((echo) => echo.id === link?.to) ? link.to : "",
            createdAt: String(link?.createdAt || nowIso()).slice(0, 40)
          })).filter((link) => link.from && link.to && link.from !== link.to)
          : [],
        missions: Object.fromEntries(STORY_MISSIONS.map((mission, index) => {
          const record = input.story?.missions?.[mission.zoneId] || {};
          return [mission.zoneId, {
            status: ["locked", "active", "decision", "completed"].includes(record.status) ? record.status : (index === 0 ? "active" : "locked"),
            progress: clamp(record.progress ?? 0, 0, mission.steps.length),
            objectiveProgress: clamp(record.objectiveProgress ?? 0, 0, STORY_OBJECTIVES[mission.zoneId]?.[clamp(record.progress ?? 0, 0, mission.steps.length - 1)]?.target || 1),
            completedEventKeys: Array.isArray(record.completedEventKeys) ? [...new Set(record.completedEventKeys.map((key) => String(key).slice(0, 100)))].slice(-24) : [],
            choice: mission.choices.some((choice) => choice.id === record.choice) ? record.choice : "",
            completedAt: String(record.completedAt || "").slice(0, 40)
          }];
        })),
        decisions: Array.isArray(input.story?.decisions) ? input.story.decisions.slice(-60).map((decision) => ({
          id: String(decision?.id || uid("story-choice")).slice(0, 100),
          zoneId: STORY_ZONE_ORDER.includes(decision?.zoneId) ? decision.zoneId : "central",
          choice: String(decision?.choice || "").slice(0, 60),
          title: String(decision?.title || "Lựa chọn").slice(0, 120),
          outcome: String(decision?.outcome || "").slice(0, 360),
          metrics: normalizeStoryMetrics(decision?.metrics, STORY_METRIC_DEFAULTS),
          permanent: decision?.permanent !== false,
          createdAt: String(decision?.createdAt || nowIso()).slice(0, 40)
        })) : [],
        hiddenSignals: input.story?.hiddenSignals && typeof input.story.hiddenSignals === "object"
          ? Object.fromEntries(Object.entries(input.story.hiddenSignals).slice(-50).map(([key, value]) => [String(key).slice(0, 60), typeof value === "boolean" ? value : String(value).slice(0, 120)]))
          : {},
        longTermConsequences: Array.isArray(input.story?.longTermConsequences) ? input.story.longTermConsequences.slice(-40).map((item) => ({
          id: String(item?.id || uid("consequence")).slice(0, 100),
          zoneId: STORY_ZONE_ORDER.includes(item?.zoneId) ? item.zoneId : "central",
          title: String(item?.title || "Hậu quả").slice(0, 120),
          detail: String(item?.detail || "").slice(0, 360),
          visibleAtChapter: String(item?.visibleAtChapter || "").slice(0, 40),
          createdAt: String(item?.createdAt || nowIso()).slice(0, 40)
        })) : [],
        dialogueHistory: Array.isArray(input.story?.dialogueHistory) ? input.story.dialogueHistory.slice(-80).map((entry) => ({
          id: String(entry?.id || uid("dialogue")).slice(0, 100),
          speaker: String(entry?.speaker || "Unknown").slice(0, 80),
          text: String(entry?.text || "").slice(0, 500),
          zoneId: STORY_ZONE_ORDER.includes(entry?.zoneId) ? entry.zoneId : "central",
          createdAt: String(entry?.createdAt || nowIso()).slice(0, 40)
        })) : [],
        recapQueue: Array.isArray(input.story?.recapQueue) ? input.story.recapQueue.slice(-12).map((entry) => ({
          id: String(entry?.id || uid("recap")).slice(0, 100),
          title: String(entry?.title || "Astral update").slice(0, 120),
          detail: String(entry?.detail || "").slice(0, 360),
          createdAt: String(entry?.createdAt || nowIso()).slice(0, 40)
        })) : [],
        endingFlags: {
          dangerousPowerUses: clamp(input.story?.endingFlags?.dangerousPowerUses ?? 0, 0, 99),
          genesisPurpose: input.story?.endingFlags?.genesisPurpose === true,
          selected: STORY_ENDINGS.some((ending) => ending.id === input.story?.endingFlags?.selected) ? input.story.endingFlags.selected : ""
        },
        newGamePlus: clamp(input.story?.newGamePlus ?? 0, 0, 99),
        lastRecapAt: String(input.story?.lastRecapAt || "").slice(0, 40)
      },
      world: {
        ...base.world,
        ...(input.world || {}),
        zones: Object.fromEntries(Object.entries(WORLD_ZONE_DEFAULTS).map(([id, fallback]) => [id, {
          ...fallback,
          ...(input.world?.zones?.[id] || {}),
          resources: clamp(input.world?.zones?.[id]?.resources ?? fallback.resources, 0, 100),
          economyModifier: clamp(input.world?.zones?.[id]?.economyModifier ?? 1, 0.5, 1.5),
          weatherSeverity: clamp(input.world?.zones?.[id]?.weatherSeverity ?? 0.58, 0.1, 1),
          weatherLabel: String(input.world?.zones?.[id]?.weatherLabel || "").slice(0, 80),
          controlState: String(input.world?.zones?.[id]?.controlState || "").slice(0, 60),
          environmentVariant: String(input.world?.zones?.[id]?.environmentVariant || "").slice(0, 60),
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
        choiceHistory: Array.isArray(input.world?.choiceHistory) ? input.world.choiceHistory.slice(-40).map((choice) => ({
          id: String(choice?.id || uid("choice")).slice(0, 80),
          option: String(choice?.option || "").slice(0, 80),
          outcome: String(choice?.outcome || "").slice(0, 240),
          createdAt: String(choice?.createdAt || nowIso()).slice(0, 40)
        })) : [],
        lastSyncAt: String(input.world?.lastSyncAt || nowIso()).slice(0, 40)
      },
      companions: Object.fromEntries(CHARACTER_ORDER.map((id) => {
        const record = input.companions?.[id] || {};
        return [id, {
          unlocked: id === "lyra" || record.unlocked === true,
          bond: clamp(record.bond ?? (id === "lyra" ? 1 : 0), 0, 10),
          trust: clamp(record.trust ?? (id === "lyra" ? 1 : 0), -10, 10),
          fear: clamp(record.fear ?? 0, 0, 10),
          loyalty: clamp(record.loyalty ?? (id === "lyra" ? 1 : 0), -10, 10),
          memoryIntegrity: clamp(record.memoryIntegrity ?? 10, 0, 10),
          promiseFlags: Array.isArray(record.promiseFlags) ? record.promiseFlags.slice(-12).map((flag) => String(flag).slice(0, 60)) : [],
          beliefs: normalizeCompanionBeliefs(record.beliefs || migrateCompanionBeliefs(input, id), id),
          injured: record.injured === true,
          departed: record.departed === true,
          betrayed: record.betrayed === true,
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
        return [id, {
          role: ["damage", "support", "control", "exploration"].includes(loadout.role) ? loadout.role : base.loadouts[id].role,
          weapon: ITEMS[loadout.weapon] ? loadout.weapon : base.loadouts[id].weapon,
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
    if (legacyStory && (legacyPrologueCompleted || legacyVoiceStagePassed)) {
      state.story.hiddenSignals.voiceAuthorizationRecovered = true;
      state.story.hiddenSignals.legacyVoiceAuthorization = true;
      state.story.hiddenSignals.playerAuthorizedErasure = true;
    }
    if (state.story.hiddenSignals.aionRecognizesCycle && Number(state.story.newGamePlus || 0) < 1) {
      state.story.newGamePlus = clamp(Number(state.story.hiddenSignals.aionRecognizesCycle), 0, 99);
    }
    if (!["auto", "low", "medium", "high", "cinematic"].includes(state.settings.quality)) state.settings.quality = "auto";
    if (!["realistic", "cinematic", "anime"].includes(state.settings.renderStyle)) state.settings.renderStyle = "realistic";
    if (!["auto", "webgpu", "webgl"].includes(state.settings.rendererMode)) state.settings.rendererMode = "auto";
    if (!["photoreal", "hybrid", "performance"].includes(state.settings.visualStyle)) state.settings.visualStyle = "photoreal";
    state.settings.characterMode = "hero";
    state.settings.characterQuality = "hero";
    state.settings.characterPipeline = "hero-core";
    if (!GENESIS_STUDIOS[state.settings.characterStudio]) state.settings.characterStudio = "central";
    state.settings.facialAnimation = state.settings.facialAnimation !== false;
    state.settings.surfaceFx = state.settings.surfaceFx !== false;
    state.settings.microDetail = state.settings.microDetail !== false;
    state.settings.naturalMotion = state.settings.naturalMotion !== false;
    state.settings.eyePerformance = state.settings.eyePerformance !== false;
    state.settings.secondaryMotion = state.settings.secondaryMotion !== false;
    state.settings.digitalHumanQuality = "hero";
    if (!["static", "balanced", "cinematic"].includes(state.settings.vfxLevel)) state.settings.vfxLevel = "balanced";
    state.settings.livingWorld = state.settings.livingWorld !== false;
    state.settings.dynamicResolution = state.settings.dynamicResolution !== false;
    state.settings.weatherDensity = clamp(state.settings.weatherDensity, 0, 100);
    state.settings.cameraShake = clamp(state.settings.cameraShake, 0, 100);
    if (!CHARACTERS[state.roster.activeId]) state.roster.activeId = "lyra";
    state.roster.unlocked = Array.isArray(state.roster.unlocked)
      ? state.roster.unlocked.filter((id) => CHARACTERS[id]).slice(0, CHARACTER_ORDER.length)
      : [...CHARACTER_ORDER];
    if (!state.roster.unlocked.length) state.roster.unlocked = ["lyra"];
    state.activatedGates = Array.isArray(state.activatedGates) ? [...new Set(state.activatedGates)].slice(0, 8) : [];
    state.collectedNodes = Array.isArray(state.collectedNodes) ? [...new Set(state.collectedNodes)].slice(0, 200) : [];
    return reconcileStoryState(state);
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
      this.characterPipelineStatus = "not-configured";
      this.licensedEnvironmentAssets = new Map();
      this.licensedEnvironmentStatus = "pending";
      this.builtInCharacterStatus = "pending";
      this.characterDetailTextures = null;
      this.lastCharacterQa = null;
      this.motionState = { gaitPhase: 0, foot: "", yawVelocity: 0, wasMoving: false, movementChangedAt: 0, facing: 0 };
      this.facePilot = { status: "off", stream: null, video: null, landmarker: null, frame: 0, blendshapes: {}, error: "", lastDetectionAt: 0, lastResultAt: 0 };
      this.facePreview = { expression: "neutral", viseme: "neutral", until: 0 };
      this.gazeTarget = { type: "camera", x: 0, y: 0, weight: 0.35 };
      this.genesisLighting = "cinematic";
      this.genesisOriginalLighting = null;
      this.lastSurfaceUpdateAt = 0;
      this.toonGradient = null;
      this.photorealAssets = { panorama: null };
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
      this.storyBeacons = new Map();
      this.storyEnvironmentGroups = new Map();
      this.worldArtSurfaces = new Map();
      this.worldArtZoneLights = new Map();
      this.worldArtAnimatedObjects = [];
      this.worldArtShadowCandidates = [];
      this.worldArtCurrent = null;
      this.worldArtTarget = null;
      this.worldArtSignature = "";
      this.worldArtLastSkyUpdateAt = 0;
      this.worldArtScratchPosition = null;
      this.cloudLayers = [];
      this.waterSurfaces = [];
      this.climbables = [];
      this.keys = new Set();
      this.gamepads = [];
      this.touchMove = { x: 0, z: 0 };
      this.running = false;
      this.paused = true;
      this.menuPaused = false;
      this.genesisActive = false;
      this.genesisCompleting = false;
      this.genesisTurntable = false;
      this.genesisStep = "identity";
      this.genesisCompare = { a: null, b: null, active: "live" };
      this.genesisScene = null;
      this.genesisCamera = null;
      this.genesisStudioGroup = null;
      this.genesisStudioId = "central";
      this.genesisActualModel = null;
      this.genesisOriginalParent = null;
      this.genesisOriginalTransform = null;
      this.genesisAttachmentVisibility = [];
      this.genesisVisibility = null;
      this.lastEvolutionUpdateAt = 0;
      this.runtimeStarted = false;
      this.destroyed = false;
      this.started = false;
      this.visible = document.visibilityState !== "hidden";
      this.lastFrameAt = performance.now();
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
      this.cameraPitch = 0.38;
      this.cameraDistance = 8.6;
      this.cameraShake = 0;
      this.cameraFovTarget = 58;
      this.cinematicTarget = null;
      this.photoMode = false;
      this.photoSettings = { fov: 48, exposure: 1.08, time: 8.2, weather: "auto", hideUi: true };
      this.draggingCamera = false;
      this.pointerStart = null;
      this.lockedTargetId = "";
      this.nearby = null;
      this.currentZone = ZONES[0];
      this.currentPanel = "";
      this.storyOverlayMode = "";
      this.storyReplayStage = "awakening";
      this.storyFocusReturn = null;
      this.pendingStoryChoice = null;
      this.pendingStoryEnding = "";
      this.pendingStoryNewGamePlus = false;
      this.lastStoryFrameAt = 0;
      this.appearanceGroup = "face";
      this.appearanceHistory = [];
      this.appearanceFuture = [];
      this.appearanceCompareRecipe = null;
      this.appearanceDirty = true;
      this.appearanceFocus = "";
      this.toastTimer = 0;
      this.frameHandle = 0;
      this.autosaveTimer = 0;
      this.pendingSaveLabel = "";
      this.fpsFrames = 0;
      this.fpsStartedAt = performance.now();
      this.fps = 0;
      this.renderScale = 1;
      this.dynamicResolution = 1;
      this.forceCompatibility = false;
      this.lastStreamingAt = 0;
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
            <button type="button" data-har-panel="story"><span>✺</span>Cốt truyện</button>
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
                  <strong data-har-player-name>Lyra H</strong>
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

          <section class="har-story-overlay" data-har-story-overlay hidden role="dialog" aria-modal="true" aria-live="polite" aria-label="Astral Story">
            <div class="har-story-overlay__nebula" aria-hidden="true"><i></i><i></i><i></i></div>
            <article class="har-story-cinematic" data-har-story-content></article>
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
                <ol data-genesis-journey>
                  ${GENESIS_STEPS.map((step, index) => `<li class="${index === 0 ? "is-active" : ""}"><button type="button" data-genesis-step="${step.id}"><span>${step.number}</span>${step.label}</button></li>`).join("")}
                </ol>
                </aside>
                <div class="har-genesis__viewport" aria-label="Xem trước nhân vật 3D">
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
                <div class="har-start-feature"><strong>08</strong>Chương cốt truyện</div>
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
                  <button class="har-secondary-button" type="button" data-har-safe-mode>Khởi động lại Hero Prime</button>
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
      this.syncMotionPreference();
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
      this.state.settings.characterMode = "hero";
      this.state.settings.characterQuality = "hero";
      this.state.settings.characterPipeline = "hero-core";
      this.state.settings.digitalHumanQuality = "hero";
      this.state.settings.visualStyle = "photoreal";
      this.state.settings.microDetail = true;
      this.state.settings.facialAnimation = true;
      this.state.settings.eyePerformance = true;
      this.state.settings.secondaryMotion = true;
      this.root.dataset.compatibility = constrained ? "hero-required" : "hero-only";
      this.syncMotionPreference();
      return constrained;
    }

    async startGame({ fresh = false } = {}) {
      if (this.started || this.destroyed) return;
      this.started = true;
      const continueButton = this.root.querySelector("[data-har-continue]");
      const newButton = this.root.querySelector("[data-har-new]");
      const recovery = this.root.querySelector("[data-har-loading-recovery]");
      const loadingText = this.root.querySelector("[data-har-loading-text]");
      if (recovery) recovery.hidden = true;
      this.root.dataset.characterPreview = "loading";
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
        this.syncMotionPreference();
        this.setLoading(12, "Đang kiểm tra trình duyệt và bộ nhớ đồ họa...");
        if (!this.supportsRenderer()) throw new Error("Trình duyệt không hỗ trợ WebGL hoặc WebGPU. Hãy bật tăng tốc phần cứng hoặc dùng trình duyệt mới hơn.");
        this.setLoading(28, compatibilityMode
          ? "Thiết bị giới hạn đã được phát hiện · Hero Prime vẫn giữ nguyên chất lượng..."
          : "Đang chọn WebGPU hoặc WebGL2 cho Hero Prime...");
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
        this.setLoading(69, "Đang nạp Hero Prime duy nhất · không dùng model thay thế...");
        await this.loadCharacterAssetsFromPipeline();
        this.createWorld();
        this.setLoading(76, "Đang dựng nhân vật rigged PBR, sinh vật và Nexus Warden...");
        this.createActors();
        this.setLoading(84, "Đang khôi phục nhiệm vụ và kho đồ...");
        this.applyStateToWorld();
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
        this.root.querySelector("[data-har-start]").hidden = true;
        this.autosaveTimer = root.setInterval(() => this.saveProgress("Autosave"), AUTOSAVE_MS);
        this.lastFrameAt = performance.now();
        this.frameHandle = requestAnimationFrame((time) => this.frame(time));
        this.updateUi(true);
        if (needsGenesis) this.openGenesisCreator();
        else this.beginRuntimeSession(this.savedRecord?.data ? "Đã khôi phục checkpoint gần nhất." : "Hành trình mới bắt đầu tại H-Central.");
      } catch (error) {
        root.__astralLastError = {
          message: String(error?.message || error || "Unknown error"),
          stack: String(error?.stack || ""),
          at: nowIso()
        };
        this.root.dataset.heroErrorStack = String(error?.stack || error?.message || error || "Unknown error");
        console.error?.("[HH Astral Realms] Hero Prime startup failed", error);
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
      this.reconcileStoryObjective();
      this.syncCloud(false);
      root.setTimeout(() => {
        if (this.destroyed || !this.runtimeStarted) return;
        if (!this.state.story?.prologueCompletedAt) this.showStoryPrologue();
        else if (this.state.story?.recapQueue?.length) this.showStoryRecap();
      }, 420);
    }

    renderGenesisCreator() {
      const id = this.state.roster.activeId;
      const recipe = this.activeAppearanceRecipe();
      const stepIndex = Math.max(0, GENESIS_STEPS.findIndex((item) => item.id === this.genesisStep));
      const step = GENESIS_STEPS[stepIndex] || GENESIS_STEPS[0];
      const groupsByStep = {
        face: ["face", "nose", "mouth", "ears"],
        eyes: ["eyes", "brows"],
        body: ["torso", "body", "shoulders", "arms", "legs", "chest", "hips"],
        performance: ["expression"]
      };
      const visibleGroupIds = groupsByStep[step.id] || APPEARANCE_GROUPS.map((item) => item.id);
      const group = APPEARANCE_GROUPS.find((item) => item.id === this.appearanceGroup && visibleGroupIds.includes(item.id))
        || APPEARANCE_GROUPS.find((item) => item.id === visibleGroupIds[0])
        || APPEARANCE_GROUPS[0];
      const mesh = this.characterMeshes.get(id);
      const runtime = this.characterRuntimes.get(id);
      const fit = this.buildAppearanceFitReport(recipe, mesh);
      const modelLabel = ["HH Hero Prime", "58K+ triangles · 114 joints · facial morph · full quality only"];
      const faceChannels = Math.min(52, Number(runtime?.facialChannels || 0));
      const boneCount = runtime?.bones ? Object.values(runtime.bones).filter(Boolean).length : 0;
      const visibility = this.genesisVisibility?.report;
      const qa = runtime?.qaReport || mesh?.userData?.qaReport || {};
      const heroGate = qa.heroChecks ? qa : { ...qa, ...classifyCharacterAsset(qa) };
      const dna = encodeCharacterDNA(recipe, id);
      const slots = this.state.appearance.characterSlots || [];
      const option = (value, label, selected) => `<option value="${value}" ${selected === value ? "selected" : ""}>${label}</option>`;
      const navigation = `<div class="har-genesis-navigation" data-genesis-action-dock data-genesis-stage="dna" role="navigation" aria-label="Điều hướng Character Genesis">
        <button type="button" data-genesis-action="previous-step" ${stepIndex === 0 ? "disabled" : ""}>← Bước trước</button>
        ${stepIndex < GENESIS_STEPS.length - 1
          ? `<button type="button" class="is-primary" data-genesis-action="next-step"><span>Tiếp tục · ${escapeHtml(GENESIS_STEPS[stepIndex + 1].label)}</span><small>Bước ${GENESIS_STEPS[stepIndex + 1].number}/10 →</small></button>`
          : `<button class="har-genesis-confirm" type="button" data-genesis-action="confirm" data-character-dna-version="Character DNA V13"><span>✓ Hoàn tất & bắt đầu Prologue</span><small>Lưu Character DNA V13 và vào H-Central</small></button>`}
      </div>`;
      return `
        <nav class="har-genesis-stepper" aria-label="10 bước tạo nhân vật">
          ${GENESIS_STEPS.map((item, index) => `<button type="button" class="${index === stepIndex ? "is-active" : index < stepIndex ? "is-done" : ""}" data-genesis-step="${item.id}" aria-current="${index === stepIndex ? "step" : "false"}"><small>${item.number}</small><span>${item.label}</span></button>`).join("")}
        </nav>
        <div class="har-genesis-editor__intro">
          <small>DIGITAL HUMAN CORE V${CHARACTER_VISUAL_VERSION} · BƯỚC ${step.number}/10</small>
          <h2>${escapeHtml(step.label)}</h2>
          <p>${escapeHtml(modelLabel[0])} · Character DNA lưu ngoại hình, giọng nói, Motion DNA và tiến hóa gameplay.</p>
        </div>
        ${navigation}
        <div class="har-genesis-capabilities" aria-label="Năng lực Digital Human">
          <div><small>ASSET CLASS</small><strong>Hero Prime duy nhất</strong><span>Không LOD thấp · không proxy · không thay model</span></div>
          <div><small>FACE DRIVER</small><strong>${faceChannels} native / 52 driver</strong><span>${boneCount} nhóm xương nhận diện · cập nhật 60 Hz</span></div>
          <div><small>SURFACE</small><strong>5 lớp</strong><span>pore · roughness · SSS · flush · wetness</span></div>
          <div><small>MOTION DNA</small><strong>${escapeHtml(MOTION_DNA_PRESETS[recipe.motionDNA.preset]?.label || recipe.motionDNA.preset)}</strong><span>8 hướng · foot lock · motion warp</span></div>
        </div>
        <div class="har-hero-gate is-ready">
          <div><small>HERO PRIME LOCK</small><strong>Full Quality Only</strong><span>${visibility?.ready ? "Hero đang hiển thị ổn định trong camera." : "Đang xác minh chính Hero; nếu lỗi, game sẽ yêu cầu Thử lại."}</span></div>
          <div class="har-hero-gate__checks">${(heroGate.heroChecks || []).map((check) => `<span class="${check.pass ? "is-pass" : "is-missing"}" title="${escapeHtml(check.value)}">${check.pass ? "✓" : "○"} ${escapeHtml(check.label)}</span>`).join("")}</div>
        </div>
        <div class="har-genesis-fit ${fit.level}" data-genesis-stage="wardrobe" ${step.id === "wardrobe" ? "" : "hidden"} aria-live="polite">
          <div><span class="har-genesis-fit__orb"></span><div><small>FIT & SILHOUETTE CHECK</small><strong>${escapeHtml(fit.label)} · ${fit.score}%</strong><span>${escapeHtml(fit.summary)}</span></div></div>
          <div class="har-genesis-fit__actions">
            <button type="button" data-genesis-action="auto-fit">Tự cân đối</button>
            <button type="button" class="${this.genesisTurntable ? "is-active" : ""}" data-genesis-action="toggle-turntable" aria-pressed="${this.genesisTurntable}">${this.genesisTurntable ? "Dừng xoay 360°" : "Xoay 360°"}</button>
          </div>
          ${fit.warnings.length ? `<ul>${fit.warnings.map((warning) => `<li>${escapeHtml(warning)}</li>`).join("")}</ul>` : ""}
        </div>
        <div class="har-evolution-preview" data-genesis-stage="wardrobe" ${step.id === "wardrobe" ? "" : "hidden"}><small>APPEARANCE EVOLUTION</small><span>Mưa/tuyết · bụi/máu/bỏng · sẹo tồn tại · hư hỏng trang phục · mắt/aura/hình xăm phản ứng theo sức mạnh.</span></div>
        <label class="har-genesis-name" data-genesis-stage="identity" ${step.id === "identity" ? "" : "hidden"}>Tên Nhà du hành
          <input type="text" maxlength="40" value="${escapeHtml(this.state.player.name || "")}" data-genesis-name autocomplete="off">
        </label>
        <div class="har-genesis-block" data-genesis-stage="identity" ${step.id === "identity" ? "" : "hidden"}>
          <div class="har-genesis-block__title"><strong>Nền cơ thể 3D · đã khóa</strong><span>${runtime?.triangles?.toLocaleString("vi-VN") || 0} triangles</span></div>
          <div class="har-genesis-models">
            <article class="is-active" data-hero-prime-lock><i></i><strong>${modelLabel[0]}</strong><span>${modelLabel[1]}</span><small>Không có bản máy yếu</small></article>
          </div>
        </div>
        <div class="har-genesis-block" data-genesis-stage="body" ${step.id === "body" ? "" : "hidden"}>
          <div class="har-genesis-block__title"><strong>Kiểu vóc dáng</strong><span>giữ collider gameplay cân bằng</span></div>
          <div class="har-genesis-presets">
            ${Object.entries(APPEARANCE_PRESETS).map(([value, item]) => `<button type="button" class="${recipe.bodyPreset === value ? "is-active" : ""}" data-genesis-preset="${value}">${item.label}</button>`).join("")}
          </div>
        </div>
        <div class="har-genesis-colors" data-genesis-stage="surface" ${["skin", "eyes", "hair"].includes(step.id) ? "" : "hidden"}>
          <label>Da<input type="color" value="${recipe.skinColor}" data-genesis-setting="skinColor"></label>
          <label>Mắt<input type="color" value="${recipe.eyeColor}" data-genesis-setting="eyeColor"></label>
          <label>Tóc<input type="color" value="${recipe.hairColor}" data-genesis-setting="hairColor"></label>
          <span><strong>Digital Skin</strong><small>micro-normal · roughness zones · skin response</small></span>
        </div>
        <div class="har-genesis-assets" data-genesis-stage="modules" ${["eyes", "hair", "wardrobe"].includes(step.id) ? "" : "hidden"}>
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
        <div class="har-genesis-tabs" data-genesis-stage="sculpt" ${["face", "eyes", "body", "performance"].includes(step.id) ? "" : "hidden"} role="tablist" aria-label="Nhóm chỉnh ngoại hình">
          ${APPEARANCE_GROUPS.filter((item) => visibleGroupIds.includes(item.id)).map((item) => `<button type="button" class="${item.id === group.id ? "is-active" : ""}" data-genesis-group="${item.id}" role="tab" aria-selected="${item.id === group.id}">${item.label}</button>`).join("")}
        </div>
        <div class="har-genesis-sliders" data-genesis-stage="sculpt" ${["face", "eyes", "body", "performance"].includes(step.id) ? "" : "hidden"}>
          ${group.controls.map(([controlId, label]) => {
            const control = APPEARANCE_CONTROL_MAP[controlId];
            const value = recipe.morphs[controlId] ?? control.defaultValue;
            return `<label><span>${escapeHtml(label)}<output data-genesis-output="${controlId}">${Math.round(value * 100)}</output></span><input type="range" min="0" max="1" step="0.01" value="${value}" data-genesis-morph="${controlId}" aria-label="${escapeHtml(label)}"></label>`;
          }).join("")}
        </div>
        <div class="har-genesis-detail-grid" data-genesis-stage="skin" ${step.id === "skin" ? "" : "hidden"}>
          <fieldset><legend>Chi tiết khuôn mặt</legend>
            ${Object.entries(recipe.decals).map(([key, value]) => `<label><span>${escapeHtml({ freckles: "Tàn nhang", scars: "Sẹo", moles: "Nốt ruồi", makeup: "Cường độ makeup", tattoos: "Hình xăm", wrinkles: "Nếp nhăn", eyeShadow: "Quầng mắt", age: "Tuổi sinh học" }[key] || key)}<output>${Math.round(value * 100)}</output></span><input type="range" min="0" max="1" step="0.01" value="${value}" data-genesis-decal="${key}"></label>`).join("")}
          </fieldset>
          <fieldset><legend>Vật liệu da</legend>
            ${Object.entries(recipe.surface).map(([key, value]) => `<label><span>${escapeHtml({ pores: "Lỗ chân lông", subsurface: "Tán xạ da", roughness: "Độ nhám", flush: "Độ ửng đỏ", wetness: "Độ ẩm" }[key] || key)}<output>${Math.round(value * 100)}</output></span><input type="range" min="0" max="1" step="0.01" value="${value}" data-genesis-surface="${key}"></label>`).join("")}
          </fieldset>
        </div>
        <div class="har-genesis-performance" data-genesis-stage="performance" ${step.id === "performance" ? "" : "hidden"}>
          <div><span>Biểu cảm</span>${Object.keys(CHARACTER_EXPRESSION_PRESETS).map((name) => `<button type="button" class="${recipe.expression === name ? "is-active" : ""}" data-genesis-expression="${name}">${name}</button>`).join("")}</div>
          <div><span>Khẩu hình</span>${Object.keys(CHARACTER_VISEMES).map((name) => `<button type="button" class="${recipe.viseme === name ? "is-active" : ""}" data-genesis-viseme="${name}">${name}</button>`).join("")}</div>
          <div><span>Ánh sáng thử</span>${APPEARANCE_ASSETS.lighting.map((name) => `<button type="button" class="${recipe.lighting === name ? "is-active" : ""}" data-genesis-lighting="${name}">${name}</button>`).join("")}</div>
        </div>
        <div class="har-motion-dna" data-genesis-stage="performance" ${step.id === "performance" ? "" : "hidden"}>
          <div class="har-motion-dna__head"><div><small>MOTION DNA</small><strong>Dáng đi và phản xạ riêng</strong><span>Không thay tốc độ gameplay; chỉ điều khiển cảm giác chuyển động.</span></div><label>Preset<select data-genesis-motion-preset>${Object.entries(MOTION_DNA_PRESETS).map(([value, preset]) => option(value, preset.label, recipe.motionDNA.preset)).join("")}</select></label></div>
          <div class="har-genesis-assets"><label>Giọng nói<select data-genesis-voice="id">${CHARACTER_VOICES.map((voice) => option(voice.id, voice.label, recipe.voice.id)).join("")}</select></label><label>Kiểu né<select data-genesis-motion-dna="dodgeStyle">${["sidestep", "dash", "roll", "spin"].map((value) => option(value, value, recipe.motionDNA.dodgeStyle)).join("")}</select></label></div>
          <div class="har-motion-dna__ranges">${[["posture", "Tư thế"], ["stride", "Độ dài bước"], ["acceleration", "Tăng tốc"], ["braking", "Dừng"], ["turnResponse", "Đổi hướng"], ["combatWeight", "Trọng lượng chiến đấu"], ["secondaryMotion", "Tóc & vải"]].map(([key, label]) => `<label><span>${label}<output>${Math.round(recipe.motionDNA[key] * 100)}</output></span><input type="range" min="0" max="1" step="0.01" value="${recipe.motionDNA[key]}" data-genesis-motion-dna="${key}"></label>`).join("")}</div>
          <div class="har-motion-dna__ranges">${[["pitch", "Cao độ giọng"], ["pace", "Nhịp nói"], ["emotion", "Cường độ cảm xúc"]].map(([key, label]) => `<label><span>${label}<output>${Math.round(recipe.voice[key] * 100)}</output></span><input type="range" min="0" max="1" step="0.01" value="${recipe.voice[key]}" data-genesis-voice="${key}"></label>`).join("")}</div>
        </div>
        <div class="har-genesis-motion" data-genesis-stage="preview" ${step.id === "preview" ? "" : "hidden"}>
          <span>Kiểm tra chuyển động</span>
          ${["idle", "walk", "run", "sprint", "strafe", "jump", "dodge", "attack1", "talk"].map((motion) => `<button type="button" class="${this.genesisMotion === motion ? "is-active" : ""}" data-genesis-motion="${motion}">${motion}</button>`).join("")}
        </div>
        <div class="har-compare-lab" data-genesis-stage="preview" ${step.id === "preview" ? "" : "hidden"}>
          <div><small>A/B LOOK LAB</small><strong>${this.genesisCompare.active === "live" ? "Bản đang chỉnh" : `Đang xem bản ${this.genesisCompare.active.toUpperCase()}`}</strong><span>Chụp hai Character DNA rồi đổi tức thời trong cùng studio.</span></div>
          <button type="button" data-genesis-action="capture-a">Lưu A</button><button type="button" data-genesis-action="capture-b">Lưu B</button><button type="button" data-genesis-action="view-a" ${this.genesisCompare.a ? "" : "disabled"}>Xem A</button><button type="button" data-genesis-action="view-b" ${this.genesisCompare.b ? "" : "disabled"}>Xem B</button>
        </div>
        <div class="har-genesis-tools">
          <button type="button" data-genesis-action="undo" ${this.appearanceHistory.length ? "" : "disabled"}>↶ Hoàn tác</button>
          <button type="button" data-genesis-action="redo" ${this.appearanceFuture.length ? "" : "disabled"}>↷ Làm lại</button>
          <button type="button" data-genesis-action="random">Ngẫu nhiên</button>
          <button type="button" data-genesis-action="reset">Khôi phục</button>
        </div>
        <div class="har-genesis-dna" data-genesis-stage="dna" ${step.id === "dna" ? "" : "hidden"}>
          <label>Character DNA V13<textarea rows="3" spellcheck="false" data-genesis-dna>${escapeHtml(dna)}</textarea></label>
          <div><button type="button" data-genesis-action="copy-dna">Sao chép DNA</button><button type="button" data-genesis-action="apply-dna">Nạp DNA</button><button type="button" data-genesis-action="save-slot">Lưu ô nhân vật</button></div>
        </div>
        <div class="har-character-slots" data-genesis-stage="dna" ${step.id === "dna" ? "" : "hidden"}>${slots.length ? slots.map((slot) => `<article><div><small>${escapeHtml(slot.characterId.toUpperCase())}</small><strong>${escapeHtml(slot.name)}</strong><span>${new Date(slot.updatedAt).toLocaleDateString("vi-VN")}</span></div><button type="button" data-genesis-slot="${escapeHtml(slot.id)}">Nạp</button></article>`).join("") : "<p>Chưa có ô nhân vật. Bạn có thể lưu tối đa 6 Character DNA.</p>"}</div>
        <div class="har-version-summary" data-genesis-stage="dna" ${step.id === "dna" ? "" : "hidden"}><small>VERSION HISTORY</small><strong>${this.state.appearance.versionHistory?.length || 0} mốc ngoại hình</strong><span>Có thể chỉnh lại sau Prologue; lịch sử không chứa email hoặc dữ liệu camera.</span></div>`;
    }

    refreshGenesisCreator() {
      if (!this.genesisActive) return;
      const content = this.root.querySelector("[data-har-genesis-content]");
      if (content) content.innerHTML = this.renderGenesisCreator();
      const activeIndex = Math.max(0, GENESIS_STEPS.findIndex((step) => step.id === this.genesisStep));
      this.root.querySelectorAll("[data-genesis-journey] li").forEach((item, index) => {
        item.classList.toggle("is-active", index === activeIndex);
        item.classList.toggle("is-done", index < activeIndex);
      });
      const recipe = this.activeAppearanceRecipe();
      const name = this.root.querySelector("[data-genesis-model-name]");
      if (name) {
        name.textContent = "HH HERO PRIME";
      }
      const status = this.root.querySelector("[data-genesis-status]");
      if (status) {
        const runtime = this.characterRuntimes.get(this.state.roster.activeId);
        status.textContent = `${runtime?.mixer ? "Rigged + animation" : "3D PBR"} · ${this.rendererBackend.toUpperCase()} · đã sẵn sàng`;
      }
    }

    setGenesisStep(stepId) {
      const nextIndex = GENESIS_STEPS.findIndex((step) => step.id === stepId);
      if (nextIndex < 0) return;
      this.commitAppearanceDraft();
      const step = GENESIS_STEPS[nextIndex];
      this.genesisStep = step.id;
      this.appearanceGroup = step.group;
      this.appearanceFocus = step.focus;
      this.fitGenesisCamera(this.genesisActualModel, step.focus);
      this.refreshGenesisCreator();
      this.root.querySelector("[data-har-genesis-content]")?.scrollTo?.({ top: 0, behavior: this.state.settings.reduceEffects ? "auto" : "smooth" });
    }

    updateCharacterPerformance(section, key, rawValue) {
      const recipe = this.activeAppearanceRecipe();
      if (!this.appearanceInputStart) this.appearanceInputStart = clone(recipe);
      if (section === "motionDNA") {
        if (key === "preset" && MOTION_DNA_PRESETS[rawValue]) {
          recipe.motionDNA = { ...recipe.motionDNA, ...MOTION_DNA_PRESETS[rawValue], preset: rawValue };
        } else if (key === "dodgeStyle" && ["sidestep", "dash", "roll", "spin"].includes(rawValue)) {
          recipe.motionDNA.dodgeStyle = rawValue;
        } else if (key in recipe.motionDNA) {
          recipe.motionDNA[key] = clamp(Number(rawValue), 0, 1);
        }
      } else if (section === "voice") {
        if (key === "id" && CHARACTER_VOICES.some((voice) => voice.id === rawValue)) recipe.voice.id = rawValue;
        else if (key in recipe.voice) recipe.voice[key] = clamp(Number(rawValue), 0, 1);
      }
      recipe.updatedAt = nowIso();
      this.applyAppearanceToMesh(this.characterMeshes.get(this.state.roster.activeId), recipe, this.state.roster.activeId);
      this.appearanceDirty = true;
    }

    setGenesisCompareSlot(slot) {
      if (!["a", "b"].includes(slot)) return;
      this.genesisCompare[slot] = clone(this.activeAppearanceRecipe());
      this.genesisCompare.active = slot;
      this.toast(`Đã chụp ngoại hình ${slot.toUpperCase()} để so sánh.`, "success");
      this.refreshGenesisCreator();
    }

    viewGenesisCompareSlot(slot) {
      const snapshot = this.genesisCompare?.[slot];
      if (!snapshot) return;
      const id = this.state.roster.activeId;
      const before = clone(this.activeAppearanceRecipe());
      this.state.appearance.recipes[id] = normalizeAppearanceRecipe(snapshot, id);
      this.applyAppearanceToMesh(this.characterMeshes.get(id), this.state.appearance.recipes[id], id);
      if (before.baseModel !== snapshot.baseModel) this.rebuildActiveBuiltInCharacter();
      this.genesisCompare.active = slot;
      this.refreshGenesisCreator();
    }

    saveCharacterSlot() {
      const id = this.state.roster.activeId;
      const timestamp = nowIso();
      const slot = {
        id: uid("slot"),
        name: String(this.state.player.name || CHARACTERS[id]?.name || "Nhà du hành").slice(0, 40),
        characterId: id,
        recipe: clone(this.activeAppearanceRecipe()),
        createdAt: timestamp,
        updatedAt: timestamp
      };
      this.state.appearance.characterSlots = [...(this.state.appearance.characterSlots || []), slot].slice(-6);
      this.state.appearance.lastSavedAt = timestamp;
      this.saveProgress("Lưu ô Character DNA");
      this.toast(`Đã lưu ô “${slot.name}” (${this.state.appearance.characterSlots.length}/6).`, "success");
      this.refreshGenesisCreator();
    }

    loadCharacterSlot(slotId) {
      const slot = (this.state.appearance.characterSlots || []).find((item) => item.id === slotId);
      if (!slot) return;
      const id = this.state.roster.activeId;
      const before = clone(this.activeAppearanceRecipe());
      this.state.appearance.recipes[id] = normalizeAppearanceRecipe(slot.recipe, id);
      this.state.player.name = slot.name;
      this.applyAppearanceToMesh(this.characterMeshes.get(id), this.state.appearance.recipes[id], id);
      if (before.baseModel !== slot.recipe.baseModel) this.rebuildActiveBuiltInCharacter();
      this.recordAppearanceChange(before, `Nạp ô ${slot.name}`);
      this.toast(`Đã nạp Character DNA “${slot.name}”.`, "success");
      this.refreshGenesisCreator();
    }

    openGenesisCreator() {
      this.genesisActive = true;
      this.genesisStep = "identity";
      this.genesisMotion = "idle";
      this.genesisTurntable = false;
      this.genesisCompare = { a: null, b: null, active: "live" };
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
      this.root.scrollTop = 0;
      this.root.scrollLeft = 0;
      const section = this.root.querySelector("[data-har-genesis]");
      if (section) {
        section.hidden = false;
        section.scrollTop = 0;
        section.scrollLeft = 0;
      }
      this.root.dataset.characterPreview = "validating";
      this.setupGenesisPreview();
      this.setGenesisMotion("idle");
      this.refreshGenesisCreator();
      root.requestAnimationFrame?.(() => {
        this.resize();
        this.fitGenesisCamera(this.genesisActualModel, "body");
      });
    }

    setupGenesisPreview() {
      if (!this.THREE || !this.renderer || !this.playerMesh) return;
      this.teardownGenesisPreview({ restorePlayer: true });
      const THREE = this.THREE;
      this.genesisScene = new THREE.Scene();
      this.genesisCamera = new THREE.PerspectiveCamera(38, 1, 0.04, 90);
      this.genesisCamera.position.set(0, 1.55, 5.2);
      this.genesisCameraTarget = new THREE.Vector3(0, 1.48, 0);

      const ambient = new THREE.HemisphereLight(0xc8edff, 0x11101b, 1.12);
      ambient.name = "GenesisStudioAmbient";
      const key = new THREE.DirectionalLight(0xffffff, 2.55);
      key.name = "GenesisStudioKey";
      key.position.set(3.8, 5.4, 4.7);
      const fill = new THREE.DirectionalLight(0x79cfff, 1.12);
      fill.name = "GenesisStudioFill";
      fill.position.set(-4.2, 2.7, 2.2);
      const rim = new THREE.PointLight(0xff68cb, 1.92, 16, 1.5);
      rim.name = "GenesisStudioRim";
      rim.position.set(0.5, 3.3, -3.2);
      this.genesisScene.add(ambient, key, fill, rim);
      this.genesisLights = { ambient, key, fill, rim };

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
      this.setGenesisModelOpacity(this.playerMesh, 1);

      this.genesisVisibility = {
        consecutiveFrames: 0,
        validated: false,
        startedAt: performance.now(),
        report: null
      };
      this.root.dataset.characterPreview = "validating";
      this.setGenesisStudio(this.state.settings.characterStudio || "central", { save: false });
      this.updateCharacterLod(this.playerMesh, 0);
      this.genesisAttachmentVisibility = (this.playerMesh.userData?.lodVariants?.attachments || []).map((object) => ({ object, visible: object.visible }));
      this.genesisAttachmentVisibility.forEach(({ object }) => { object.visible = false; });
      this.fitGenesisCamera(this.playerMesh, "body");
    }

    teardownGenesisPreview({ restorePlayer = true } = {}) {
      if (!this.genesisScene && !this.genesisActualModel) return;
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
      this.disposeGenesisObject(this.genesisStudioGroup);
      this.genesisAttachmentVisibility.forEach(({ object, visible }) => { object.visible = visible; });
      this.genesisAttachmentVisibility = [];
      this.genesisScene = null;
      this.genesisCamera = null;
      this.genesisCameraTarget = null;
      this.genesisStudioGroup = null;
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
        this.genesisLights.fill.color.setHex(studio.accent);
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

    fitGenesisCamera(object = this.genesisActualModel, focus = this.appearanceFocus || "body") {
      if (!object || !this.genesisCamera || !this.THREE) return false;
      object.updateMatrixWorld(true);
      const box = new this.THREE.Box3().setFromObject(object);
      const size = box.getSize(new this.THREE.Vector3());
      const center = box.getCenter(new this.THREE.Vector3());
      if (![size.x, size.y, size.z, center.x, center.y, center.z].every(Number.isFinite) || size.y < 0.2) return false;
      const targetY = focus === "head"
        ? box.max.y - size.y * 0.14
        : focus === "upper"
          ? box.min.y + size.y * 0.67
          : center.y;
      this.genesisCameraTarget.set(center.x, targetY, center.z);
      const focusHeight = focus === "head" ? size.y * 0.38 : focus === "upper" ? size.y * 0.62 : size.y;
      const focusWidth = focus === "head"
        ? Math.max(Math.min(size.x, focusHeight * 0.82), focusHeight * 0.72)
        : Math.min(size.x, focusHeight * (focus === "upper" ? 0.64 : 0.5));
      const verticalFov = this.THREE.MathUtils.degToRad(this.genesisCamera.fov);
      const aspect = Math.max(0.45, Number(this.genesisCamera.aspect || 1));
      const horizontalFov = 2 * Math.atan(Math.tan(verticalFov / 2) * aspect);
      const handMargin = focus === "head" ? 1.18 : focus === "upper" ? 1.28 : 1.25;
      const verticalDistance = (focusHeight * 0.5 * handMargin) / Math.tan(verticalFov / 2);
      const horizontalDistance = (focusWidth * 0.5 * handMargin) / Math.tan(horizontalFov / 2);
      this.cameraDistance = clamp(Math.max(verticalDistance, horizontalDistance) + size.z * 0.55, 2.7, 10.5);
      this.updateGenesisCamera();
      return true;
    }

    updateGenesisCamera() {
      if (!this.genesisCamera || !this.genesisCameraTarget) return;
      const yaw = this.cameraYaw || 0;
      const pitch = clamp(this.cameraPitch - 0.28, -0.02, 0.8);
      const distance = Math.max(2.5, this.cameraDistance || 5.2);
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
      this.genesisCamera.updateMatrixWorld(true);
      this.genesisCamera.updateProjectionMatrix();
      const box = new THREE.Box3().setFromObject(object);
      const size = box.getSize(new THREE.Vector3());
      const center = box.getCenter(new THREE.Vector3());
      const finiteBounds = [box.min.x, box.min.y, box.min.z, box.max.x, box.max.y, box.max.z].every(Number.isFinite);
      let triangles = 0;
      let visibleMaterials = 0;
      object.traverse?.((node) => {
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
      const safeHalfWidth = Math.min(size.x * 0.5, size.y * 0.27);
      const displayMinX = center.x - safeHalfWidth;
      const displayMaxX = center.x + safeHalfWidth;
      const projectedCorners = finiteBounds
        ? [
            [displayMinX, box.min.y, box.min.z], [displayMinX, box.min.y, box.max.z],
            [displayMinX, box.max.y, box.min.z], [displayMinX, box.max.y, box.max.z],
            [displayMaxX, box.min.y, box.min.z], [displayMaxX, box.min.y, box.max.z],
            [displayMaxX, box.max.y, box.min.z], [displayMaxX, box.max.y, box.max.z]
          ].map(([x, y, z]) => new THREE.Vector3(x, y, z).project(this.genesisCamera))
        : [];
      const fullyContained = projectedCorners.length === 8 && projectedCorners.every((point) => (
        Math.abs(point.x) <= 0.9 && Math.abs(point.y) <= 0.9 && point.z >= -1 && point.z <= 1
      ));
      const projectedCenter = center.clone().project(this.genesisCamera);
      const sphere = box.getBoundingSphere(new THREE.Sphere());
      const distance = Math.max(0.01, this.genesisCamera.position.distanceTo(sphere.center));
      const projectedRatio = (2 * Math.atan(Math.max(0.001, sphere.radius) / distance)) / THREE.MathUtils.degToRad(this.genesisCamera.fov);
      const centered = Math.abs(projectedCenter.x) <= 0.84 && Math.abs(projectedCenter.y) <= 0.84 && projectedCenter.z >= -1 && projectedCenter.z <= 1;
      const adequateSize = projectedRatio >= 0.18 && projectedRatio <= 1.22 && size.y >= 0.35;
      const ready = finiteBounds && triangles > 0 && visibleMaterials > 0 && inFrustum && fullyContained && centered && adequateSize;
      return {
        ready,
        finiteBounds,
        inFrustum,
        fullyContained,
        centered,
        adequateSize,
        triangles,
        visibleMaterials,
        projectedRatio,
        size: { x: size.x, y: size.y, z: size.z },
        reason: ready
          ? "ready"
          : !finiteBounds
            ? "invalid-bounds"
            : !triangles
              ? "no-triangles"
              : !visibleMaterials
                ? "invisible-material"
                : !inFrustum || !fullyContained
                  ? "outside-camera"
                  : !centered
                    ? "off-center"
                    : projectedRatio > 1.22
                      ? "too-large"
                      : "too-small"
      };
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
      this.genesisRenderSize ||= new this.THREE.Vector2();
      this.renderer.getSize(this.genesisRenderSize);
      if (Math.abs(this.genesisRenderSize.x - fullWidth) > 1 || Math.abs(this.genesisRenderSize.y - fullHeight) > 1) {
        this.renderer.setSize(fullWidth, fullHeight, false);
      }
      const x = clamp(viewRect.left - canvasRect.left, 0, fullWidth - 1);
      const y = clamp(canvasRect.bottom - viewRect.bottom, 0, fullHeight - 1);
      const width = clamp(viewRect.width, 1, fullWidth - x);
      const height = clamp(viewRect.height, 1, fullHeight - y);
      const nextAspect = width / height;
      const aspectChanged = Math.abs(this.genesisCamera.aspect - nextAspect) > 0.01;
      this.genesisCamera.aspect = nextAspect;
      this.genesisCamera.updateProjectionMatrix();
      if (aspectChanged) this.fitGenesisCamera(this.genesisActualModel, this.appearanceFocus || "body");
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
      this.root.dataset.characterProjection = Number.isFinite(report.projectedRatio)
        ? report.projectedRatio.toFixed(3)
        : "invalid";
      this.root.dataset.characterBounds = report.size
        ? `${report.size.x.toFixed(2)}x${report.size.y.toFixed(2)}x${report.size.z.toFixed(2)}`
        : "missing";
      this.genesisVisibility ||= { consecutiveFrames: 0, validated: false, startedAt: time, report: null };
      this.genesisVisibility.report = report;
      this.genesisVisibility.consecutiveFrames = report.ready ? this.genesisVisibility.consecutiveFrames + 1 : 0;
      const status = this.root.querySelector("[data-genesis-status]");
      const lodStatus = this.root.querySelector("[data-genesis-lod-status]");

      if (!this.genesisVisibility.validated && this.genesisVisibility.consecutiveFrames >= 2) {
        this.genesisVisibility.validated = true;
        this.fitGenesisCamera(this.genesisActualModel, this.appearanceFocus || "body");
      }
      if (this.genesisVisibility.validated) {
        this.setGenesisModelOpacity(this.genesisActualModel, 1);
        this.root.dataset.characterPreview = "hero";
        if (status) status.textContent = `${report.triangles.toLocaleString("vi-VN")} triangles · Hero Prime · 2/2 frame`;
        if (lodStatus) lodStatus.textContent = "Hero Full Quality · khóa 60 Hz";
      } else {
        this.root.dataset.characterPreview = "validating";
        this.setGenesisModelOpacity(this.genesisActualModel, 1);
        if (lodStatus) lodStatus.textContent = "Đang kiểm tra chính Hero Prime";
        if (time - this.genesisVisibility.startedAt > 1200) {
          if (status) status.textContent = `Hero Prime chưa qua kiểm tra khung hình · ${report.reason} · hãy dùng Thử lại nếu model không xuất hiện`;
        } else if (status) {
          status.textContent = `Đang kiểm tra Hero Prime · ${this.genesisVisibility.consecutiveFrames}/2 frame`;
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
      if (runtime?.qaReport && runtime.qaReport.faceMorphTargets < 52) warnings.push(`GLB hiện có ${runtime.qaReport.faceMorphTargets || 0}/52 morph native; các kênh thiếu được bỏ qua, không thay bằng model yếu.`);
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
        this.fitGenesisCamera(this.genesisActualModel, this.appearanceFocus || "body");
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
        this.setGenesisModelOpacity(next, 1);
        this.genesisVisibility = { consecutiveFrames: 0, validated: false, startedAt: performance.now(), report: null };
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
      this.cameraPitch = 0.42;
      this.cameraDistance = 6.5;
      this.updateCamera(true, 0.016);
      this.updateUi(true);
      this.beginRuntimeSession(`${this.state.player.name} đã sẵn sàng · bước vào H-Central.`);
    }

    syncMotionPreference() {
      if (!this.root) return;
      const reduced = this.state.settings.reduceEffects === true || this.state.settings.vfxLevel === "static";
      this.root.dataset.reduceEffects = String(reduced);
      this.root.classList.toggle("is-reduced-motion", reduced);
    }

    setStoryOverlayOpen(mode) {
      const overlay = this.root.querySelector("[data-har-story-overlay]");
      if (!overlay) return;
      if (!this.storyOverlayMode) {
        const active = document.activeElement;
        this.storyFocusReturn = active instanceof HTMLElement && this.root.contains(active) ? active : null;
      }
      this.storyOverlayMode = mode;
      this.keys.clear();
      Array.from(this.root.children).forEach((child) => {
        if (child !== overlay && !child.matches(".har-toast")) child.inert = true;
      });
      this.syncMotionPreference();
      overlay.hidden = false;
      this.root.classList.add("is-story");
      this.menuPaused = true;
      this.lastStoryFrameAt = performance.now();
      this.renderStoryOverlay();
    }

    focusStoryOverlay() {
      const overlay = this.root.querySelector("[data-har-story-overlay]");
      root.requestAnimationFrame?.(() => {
        if (!this.storyOverlayMode || !overlay || overlay.hidden) return;
        const target = overlay.querySelector("[data-story-action]:not([disabled]), button:not([disabled]), [tabindex='0']")
          || overlay.querySelector("[data-har-story-content]");
        if (target && !target.hasAttribute("tabindex") && target.tagName !== "BUTTON") target.setAttribute("tabindex", "-1");
        target?.focus?.({ preventScroll: true });
      });
    }

    trapStoryFocus(event) {
      if (event.key !== "Tab") return;
      const overlay = this.root.querySelector("[data-har-story-overlay]");
      const focusable = Array.from(overlay?.querySelectorAll("button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])") || [])
        .filter((element) => !element.hidden && element.getClientRects().length);
      if (!focusable.length) {
        event.preventDefault();
        overlay?.querySelector("[data-har-story-content]")?.focus?.();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    showStoryPrologue({ replay = false } = {}) {
      const overlay = this.root.querySelector("[data-har-story-overlay]");
      if (!overlay) return;
      const mode = replay ? "replay" : "prologue";
      if (replay) this.storyReplayStage = "awakening";
      this.setStoryOverlayOpen(mode);
    }

    showStoryRecap() {
      const overlay = this.root.querySelector("[data-har-story-overlay]");
      if (!overlay || !this.state.story?.prologueCompletedAt) return;
      this.setStoryOverlayOpen("recap");
    }

    showStoryEnding(endingId) {
      if (!STORY_ENDINGS.some((ending) => ending.id === endingId)) return;
      const overlay = this.root.querySelector("[data-har-story-overlay]");
      if (!overlay) return;
      this.pendingStoryNewGamePlus = false;
      this.setStoryOverlayOpen(`ending:${endingId}`);
    }

    closeStoryOverlay() {
      const overlay = this.root.querySelector("[data-har-story-overlay]");
      if (overlay) overlay.hidden = true;
      Array.from(this.root.children).forEach((child) => { child.inert = false; });
      this.root.classList.remove("is-story");
      this.storyOverlayMode = "";
      this.menuPaused = Boolean(this.currentPanel) && !this.authoritative;
      this.lastFrameAt = performance.now();
      const focusReturn = this.storyFocusReturn;
      this.storyFocusReturn = null;
      if (focusReturn?.isConnected) root.requestAnimationFrame?.(() => focusReturn.focus?.({ preventScroll: true }));
    }

    storyText(value) {
      return String(value || "")
        .replaceAll("{player}", this.state.player.name || "Nhà du hành")
        .replaceAll("{cycle}", String(Math.max(0, Number(this.state.story?.newGamePlus || 0))));
    }

    renderStoryOverlay() {
      const content = this.root.querySelector("[data-har-story-content]");
      if (!content) return;
      if (this.storyOverlayMode === "recap") {
        const entries = (this.state.story.recapQueue || []).slice(-4).reverse();
        const currentMission = STORY_MISSIONS.find((mission) => ["active", "decision"].includes(this.state.story.missions?.[mission.zoneId]?.status));
        content.innerHTML = `
          <div class="har-story-cinematic__time">PREVIOUSLY IN ASTRAL REALMS</div>
          <small class="har-story-cinematic__kicker">STORY RECAP · NG+${this.state.story.newGamePlus}</small>
          <h2>${entries[0] ? escapeHtml(entries[0].title) : "Những ký ức đang tự viết lại"}</h2>
          <div class="har-story-recap-list">${entries.length ? entries.map((entry) => `<div><i></i><strong>${escapeHtml(entry.title)}</strong><span>${escapeHtml(entry.detail)}</span></div>`).join("") : `<div><i></i><strong>Không có thay đổi mới</strong><span>Memory Constellation vẫn giữ nguyên từ lần chơi trước.</span></div>`}</div>
          ${currentMission ? `<p class="har-story-cinematic__objective"><b>Tiếp theo:</b> ${escapeHtml(currentMission.title)} · ${escapeHtml(currentMission.mechanic)}</p>` : ""}
          <div class="har-story-cinematic__actions"><button class="har-primary-button" type="button" data-story-action="close-recap">Tiếp tục công việc gần nhất</button><button class="har-secondary-button" type="button" data-story-action="open-story-board">Mở Mission Constellation</button></div>`;
        this.focusStoryOverlay();
        return;
      }
      if (this.storyOverlayMode.startsWith("ending:")) {
        const endingId = this.storyOverlayMode.split(":")[1];
        const ending = STORY_ENDINGS.find((item) => item.id === endingId) || STORY_ENDINGS[0];
        content.innerHTML = `
          <div class="har-story-cinematic__time">EPILOGUE · ${String(this.state.story.decisions.length).padStart(2, "0")} LỰA CHỌN</div>
          <small class="har-story-cinematic__kicker" style="--story-accent:${ending.color}">ENDING UNLOCKED</small>
          <h2>${escapeHtml(ending.title)}</h2>
          <p>${escapeHtml(ending.premise)}</p>
          <div class="har-story-ending-orbit" style="--story-accent:${ending.color}"><i></i><span>H</span><i></i></div>
          <p class="har-story-cinematic__objective">Echo Memory vẫn được giữ. New Game+ sẽ đưa bạn về H-Central, đặt lại nhiệm vụ, kẻ địch, puzzle và hậu quả thế giới nhưng không xóa Character DNA.</p>
          ${this.pendingStoryNewGamePlus ? `<div class="har-story-confirm" role="alert"><b>Bắt đầu vòng thời gian mới?</b><span>Checkpoint hiện tại được lưu trước khi reset. Hành động này không thể hoàn tác trong vòng chơi mới.</span></div>` : ""}
          <div class="har-story-cinematic__actions"><button class="har-primary-button" type="button" data-story-action="${this.pendingStoryNewGamePlus ? "confirm-new-game-plus" : "new-game-plus"}">${this.pendingStoryNewGamePlus ? "Xác nhận New Game+" : "Bắt đầu New Game+"}</button>${this.pendingStoryNewGamePlus ? `<button class="har-secondary-button" type="button" data-story-action="cancel-new-game-plus">Quay lại</button>` : ""}<button class="har-secondary-button" type="button" data-story-action="close-ending">Ở lại thế giới này</button></div>`;
        this.focusStoryOverlay();
        return;
      }
      const replay = this.storyOverlayMode === "replay";
      const stageId = replay ? this.storyReplayStage : this.state.story.prologueStage;
      const stage = STORY_PROLOGUE[stageId] || STORY_PROLOGUE.awakening;
      const stageText = this.storyText(this.state.story.newGamePlus > 0 && stage.ngPlusText ? stage.ngPlusText : stage.text);
      content.innerHTML = `
        <div class="har-story-cinematic__time">${escapeHtml(stage.kicker.split(" · ")[0])}</div>
        <small class="har-story-cinematic__kicker">${escapeHtml(stage.kicker.split(" · ").slice(1).join(" · "))}</small>
        <h2>${escapeHtml(this.storyText(stage.title))}</h2>
        <p>${escapeHtml(stageText)}</p>
        ${stageId === "mirror-attack" ? `<div class="har-story-mirror" aria-hidden="true"><i></i><span>${escapeHtml((this.state.player.name || "H").slice(0, 1).toUpperCase())}</span><i></i></div>` : ""}
        <div class="har-story-cinematic__actions">
          ${stage.choice ? `
            <button class="har-primary-button" type="button" data-story-action="choose-prologue" data-choice="civilians">Cứu dân thường và Mira</button>
            <button class="har-secondary-button" type="button" data-story-action="choose-prologue" data-choice="core">Bảo vệ HH Core</button>`
            : `<button class="har-primary-button" type="button" data-story-action="${stage.finish ? (replay ? "close-replay" : "finish-prologue") : (replay ? "replay-next" : "prologue-next")}">${escapeHtml(stage.action)}</button>`}
          ${replay ? `<button class="har-secondary-button" type="button" data-story-action="close-replay">Thoát bản phát lại</button>` : ""}
        </div>
        <div class="har-story-cinematic__progress" style="grid-template-columns:repeat(${Object.keys(STORY_PROLOGUE).length},minmax(0,1fr))">${Object.keys(STORY_PROLOGUE).map((id) => `<i class="${id === stageId ? "is-active" : ""}"></i>`).join("")}</div>`;
      this.focusStoryOverlay();
    }

    recordStoryDialogue(speaker, text, zoneId = this.currentZone?.id || "central") {
      const entry = { id: uid("dialogue"), speaker: String(speaker).slice(0, 80), text: String(text).slice(0, 500), zoneId: STORY_ZONE_ORDER.includes(zoneId) ? zoneId : "central", createdAt: nowIso() };
      this.state.story.dialogueHistory = [...(this.state.story.dialogueHistory || []), entry].slice(-80);
      return entry;
    }

    queueStoryRecap(title, detail) {
      const entry = { id: uid("recap"), title: String(title).slice(0, 120), detail: String(detail).slice(0, 360), createdAt: nowIso() };
      this.state.story.recapQueue = [...(this.state.story.recapQueue || []), entry].slice(-12);
    }

    async handleStoryOverlayAction(action, data = {}) {
      const replay = this.storyOverlayMode === "replay";
      const stageId = replay ? this.storyReplayStage : this.state.story.prologueStage;
      const stage = STORY_PROLOGUE[stageId] || STORY_PROLOGUE.awakening;
      const stageText = this.storyText(this.state.story.newGamePlus > 0 && stage.ngPlusText ? stage.ngPlusText : stage.text);
      if (action === "prologue-next" && stage.next) {
        const speaker = stageId === "dna-signal" ? "Tín hiệu vô danh" : stageId === "voice-authorization" ? "Voice DNA của bạn" : "Astral Archive";
        this.recordStoryDialogue(speaker, stageText, "central");
        if (stageId === "voice-authorization") {
          this.state.story.hiddenSignals.voiceAuthorizationRecovered = true;
          this.state.story.hiddenSignals.playerAuthorizedErasure = true;
          this.applyStoryMetrics({ metrics: { identityIntegrity: -4, memoryDebt: 6, causalityPressure: 4 } });
          this.recordWorldEvent({ type: "story-authorization", title: "Voice DNA xác nhận Protocol Null", detail: "Một bản dựng giọng nói của người chơi đã cho phép xóa Mira và chủ thể H.", zoneId: "central" });
        }
        this.state.story.prologueStage = stage.next;
        this.refreshStoryInterludes();
        if (stageId === "voice-authorization") await this.saveProgress("Khôi phục ủy quyền Voice DNA");
        this.renderStoryOverlay();
      } else if (action === "replay-next" && stage.next) {
        this.storyReplayStage = stage.next;
        this.renderStoryOverlay();
      } else if (action === "choose-prologue") {
        if (replay) {
          this.storyReplayStage = "erasure";
          this.renderStoryOverlay();
          return;
        }
        const choice = data.choice === "core" ? "core" : "civilians";
        const outcome = choice === "civilians"
          ? "Bạn cứu được ga dân sự, nhưng HH Core mất một lớp khiên. Mira vẫn bị xóa ngay trước khi nói ra sự thật."
          : "Bạn giữ HH Core không sụp đổ, nhưng ga dân sự chịu thiệt hại nặng. Mira biến mất khỏi cả ký ức của những người được cứu.";
        const companion = this.state.companions[choice === "core" ? "sol" : "lyra"];
        companion.trust = clamp(Number(companion.trust || 0) + 1, -10, 10);
        this.applyStoryMetrics({ metrics: choice === "civilians"
          ? { identityIntegrity: 3, memoryDebt: 8, causalityPressure: 6 }
          : { identityIntegrity: -2, memoryDebt: 5, causalityPressure: -3 } });
        this.state.world.zones.central.resources = choice === "core" ? 100 : 82;
        this.state.world.zones.central.controlState = choice === "core" ? "core-priority" : "civilian-rescue";
        this.state.story.hiddenSignals.miraErased = true;
        this.state.story.decisions.push({ id: uid("story-choice"), zoneId: "central", choice, title: choice === "core" ? "Bảo vệ HH Core" : "Cứu dân thường", outcome, metrics: { ...this.state.story.metrics }, permanent: true, createdAt: nowIso() });
        this.state.world.choiceHistory = [...(this.state.world.choiceHistory || []), { id: uid("choice"), option: choice, outcome, createdAt: nowIso() }].slice(-40);
        this.recordWorldEvent({ type: "story-choice", title: "Lựa chọn đầu tiên", detail: outcome, zoneId: "central" });
        this.recordStoryDialogue("Mira", "Dù họ quên em, đừng để anh quên vì sao mình đã chọn.", "central");
        this.state.story.prologueStage = "erasure";
        this.refreshStoryInterludes();
        await this.saveProgress("Lựa chọn Prologue");
        this.renderStoryOverlay();
      } else if (action === "finish-prologue") {
        this.state.story.prologueStage = "departure";
        this.state.story.prologueCompletedAt = nowIso();
        this.state.story.chapter = "identity";
        this.state.story.missions.central.status = "active";
        this.state.story.hiddenSignals.futureSelfRevealed = true;
        this.refreshStoryInterludes();
        this.queueStoryRecap("Người không tồn tại", "Aion mang khuôn mặt tương lai của bạn. Tám Truth Shard đang giữ tám phiên bản khác nhau của sự thật.");
        this.recordStoryDialogue("Aion", "Tôi không muốn thống trị vũ trụ. Tôi đang hoàn thành điều chính chúng ta từng yêu cầu.", "central");
        await this.saveProgress("Hoàn tất Prologue");
        this.closeStoryOverlay();
        this.openPanel("story");
      } else if (action === "replay-next" && !stage.next) {
        this.closeStoryOverlay();
      } else if (["close-replay", "close-ending"].includes(action)) this.closeStoryOverlay();
      else if (action === "close-recap") {
        this.state.story.lastRecapAt = nowIso();
        this.state.story.recapQueue = [];
        await this.saveProgress("Đã xem Story Recap");
        this.closeStoryOverlay();
      } else if (action === "open-story-board") {
        this.state.story.lastRecapAt = nowIso();
        this.state.story.recapQueue = [];
        this.closeStoryOverlay();
        this.openPanel("story");
      } else if (action === "new-game-plus") {
        this.pendingStoryNewGamePlus = true;
        this.renderStoryOverlay();
      } else if (action === "cancel-new-game-plus") {
        this.pendingStoryNewGamePlus = false;
        this.renderStoryOverlay();
      } else if (action === "confirm-new-game-plus") {
        await this.startStoryNewGamePlus();
        this.closeStoryOverlay();
        this.openPanel("story");
      }
    }

    resetGraphicsAfterFailure() {
      this.teardownGenesisPreview({ restorePlayer: false });
      this.restoreGenesisLighting();
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
      this.puzzleNodes.clear();
      this.storyBeacons.clear();
      this.streamingGroups.clear();
      this.zoneFxGroups.clear();
      this.storyEnvironmentGroups.clear();
      this.worldArtSurfaces.clear();
      this.worldArtZoneLights.clear();
      this.worldArtAnimatedObjects = [];
      this.worldArtShadowCandidates = [];
      this.worldArtCurrent = null;
      this.worldArtTarget = null;
      this.worldArtSignature = "";
      this.worldArtScratchPosition = null;
      this.livingWorldActors = [];
      this.footprints = [];
      Object.values(this.photorealAssets).forEach((texture) => texture?.dispose?.());
      this.photorealAssets = { panorama: null };
      this.disposeBuiltInCharacterAssets();
      this.disposeLicensedEnvironmentAssets();
      this.photorealStatus = "pending";
      if (this.root) this.root.dataset.characterPreview = "hero-error";
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
      this.setLoading(0, `${reason} Hero Prime chưa được thay bằng bản yếu. Hãy bấm “Khởi động lại Hero Prime”.`);
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
      this.camera = new THREE.PerspectiveCamera(58, 1, 0.1, 420);
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
        this.camera = new THREE.PerspectiveCamera(58, 1, 0.1, 420);
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
      this.renderer.toneMappingExposure = quality === "cinematic" ? 1.18 : 1.04;
      if ("physicallyCorrectLights" in this.renderer) this.renderer.physicallyCorrectLights = true;
      if (this.renderer.shadowMap) {
        this.renderer.shadowMap.enabled = quality !== "low";
        this.renderer.shadowMap.type = THREE.PCFShadowMap;
        this.renderer.shadowMap.autoUpdate = true;
      }
      this.root.dataset.renderer = this.rendererBackend;
      const rendererLabel = this.root.querySelector("[data-har-renderer]");
      if (rendererLabel) rendererLabel.textContent = this.rendererBackend === "webgpu" ? "WEBGPU · PBR" : "WEBGL2 · PBR";
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
      const loadTexture = (url) => Promise.race([
        new Promise((resolve, reject) => loader.load(url, resolve, undefined, reject)),
        new Promise((_, reject) => root.setTimeout(() => reject(new Error(`Quá thời gian tải ${url}`)), 8000))
      ]);
      const panoramaPromise = saveData || lowMemory || this.state.settings.quality === "low"
        ? Promise.resolve(null)
        : loadTexture(PHOTOREAL_ASSETS.panorama);
      const [panoramaResult] = await Promise.allSettled([panoramaPromise]);
      if (panoramaResult.status === "fulfilled" && panoramaResult.value) {
        const texture = panoramaResult.value;
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.mapping = THREE.EquirectangularReflectionMapping;
        texture.minFilter = THREE.LinearMipmapLinearFilter;
        texture.magFilter = THREE.LinearFilter;
        this.photorealAssets.panorama = texture;
      }
      this.photorealStatus = this.photorealAssets.panorama ? "ready" : "mesh-pbr";
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
      const entries = Object.entries(LICENSED_ENVIRONMENT_ASSETS);
      const results = await Promise.allSettled(entries.map(async ([id, url]) => {
        const gltf = await Promise.race([
          loader.loadAsync(url),
          new Promise((_, reject) => root.setTimeout(() => reject(new Error(`Environment timeout: ${id}`)), 12000))
        ]);
        gltf.scene?.traverse?.((object) => {
          if (!object.isMesh) return;
          object.castShadow = true;
          object.receiveShadow = true;
          object.frustumCulled = true;
          const materials = Array.isArray(object.material) ? object.material : [object.material];
          materials.filter(Boolean).forEach((material) => {
            material.envMapIntensity = Math.max(0.35, Number(material.envMapIntensity || 0));
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
    }

    async loadCharacterPipelineManifest() {
      this.characterPipelineManifest = [{
        id: "hh-hero-prime-local",
        provider: "hero-core",
        modelId: HERO_CHARACTER_MODEL_ID,
        url: HERO_CHARACTER_ASSET_URL,
        label: "HH Hero Prime · Full Quality Only",
        quality: "full-quality",
        classification: CHARACTER_ASSET_CLASSES.hero.id,
        intendedRoles: ["hero"],
        heroEligible: true,
        license: "MIT"
      }];
      this.characterPipelineStatus = "hero-only";
      this.root.dataset.characterPipeline = this.characterPipelineStatus;
    }

    resolveCharacterAssetCandidates(modelId, requestedProvider = "hero-core") {
      if (modelId !== HERO_CHARACTER_MODEL_ID || requestedProvider !== "hero-core") return [];
      return [{
        id: "hh-hero-prime-local",
        provider: "hero-core",
        modelId: HERO_CHARACTER_MODEL_ID,
        url: HERO_CHARACTER_ASSET_URL,
        label: "HH Hero Prime · Full Quality Only",
        quality: "full-quality"
      }];
    }

    async loadBuiltInCharacterAssets() {
      return this.loadCharacterAssetsFromPipeline();
    }

    async loadCharacterAssetsFromPipeline() {
      if (!this.GLTFLoaderClass || !this.cloneSkinnedCharacter) {
        throw new Error("Hero Prime cần GLTFLoader và SkeletonUtils. Không có model thay thế; hãy tải lại trang bằng trình duyệt hỗ trợ WebGL2.");
      }
      await this.loadCharacterPipelineManifest();
      this.builtInCharacterStatus = "loading";
      let assetLoadError = false;
      const manager = this.THREE?.LoadingManager ? new this.THREE.LoadingManager() : undefined;
      if (manager) {
        manager.hhPreferTextureLoader = true;
        manager.onError = () => { assetLoadError = true; };
      }
      const loader = new this.GLTFLoaderClass(manager);
      if (this.MeshoptDecoder) loader.setMeshoptDecoder(this.MeshoptDecoder);
      assetLoadError = false;
      const gltf = await Promise.race([
        loader.loadAsync(HERO_CHARACTER_ASSET_URL),
        new Promise((_, reject) => root.setTimeout(() => reject(new Error("Hero Prime tải quá 15 giây. Không có model dự phòng; hãy kiểm tra mạng và bấm Thử lại.")), 15000))
      ]);
      gltf.userData ||= {};
      gltf.userData.hhSourceProvider = "hero-core";
      gltf.userData.hhSourceLabel = "HH Hero Prime · Full Quality Only";
      gltf.userData.hhAssetPath = HERO_CHARACTER_ASSET_URL;
      await new Promise((resolve) => root.setTimeout(resolve, 320));
      this.sanitizeBuiltInCharacterAsset(gltf);
      if (assetLoadError || Number(gltf.userData.hhTextureFallbacks || 0) > 0 || Number(gltf.userData.hhRenderableMeshes || 0) < 1) {
        throw new Error("Hero Prime không giải mã được đầy đủ mesh/texture. Game đã dừng để không thay bằng model yếu; hãy bấm Thử lại.");
      }
      gltf.scene.traverse?.((object) => {
        if (!object.isMesh && !object.isSkinnedMesh) return;
        object.userData ||= {};
        object.userData.sharedAsset = true;
        if (object.geometry?.userData) object.geometry.userData.sharedAsset = true;
        (Array.isArray(object.material) ? object.material : [object.material]).filter(Boolean).forEach((material) => {
          ["map", "normalMap", "roughnessMap", "metalnessMap", "aoMap", "emissiveMap", "alphaMap"].forEach((slot) => {
            if (!material[slot]?.isTexture) return;
            material[slot].userData ||= {};
            material[slot].userData.sharedAsset = true;
          });
        });
      });
      this.builtInCharacterAssets.clear();
      this.builtInCharacterSources.clear();
      this.builtInCharacterAssets.set(HERO_CHARACTER_MODEL_ID, gltf);
      this.builtInCharacterSources.set(HERO_CHARACTER_MODEL_ID, {
        provider: "hero-core",
        label: "HH Hero Prime · Full Quality Only",
        url: HERO_CHARACTER_ASSET_URL
      });
      this.builtInCharacterStatus = "ready";
      this.root.dataset.builtInCharacter = this.builtInCharacterStatus;
      this.root.dataset.characterModel = HERO_CHARACTER_MODEL_ID;
      this.root.dataset.characterSource = "hero-core";
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

    createTerrainTexture() {
      const THREE = this.THREE;
      const canvas = document.createElement("canvas");
      const size = this.state.settings.quality === "low" ? 256 : 512;
      canvas.width = size;
      canvas.height = size;
      const context = canvas.getContext("2d", { alpha: false });
      const image = context.createImageData(size, size);
      for (let y = 0; y < size; y += 1) {
        for (let x = 0; x < size; x += 1) {
          const index = (y * size + x) * 4;
          const broad = Math.sin(x * 0.057) * 12 + Math.cos(y * 0.049) * 10 + Math.sin((x + y) * 0.018) * 16;
          const grain = ((x * 17 + y * 31 + (x * y) % 67) % 29) - 14;
          const value = clamp(72 + broad + grain, 28, 126);
          image.data[index] = value * 0.82;
          image.data[index + 1] = value * 0.9;
          image.data[index + 2] = value;
          image.data[index + 3] = 255;
        }
      }
      context.putImageData(image, 0, 0);
      const texture = new THREE.CanvasTexture(canvas);
      texture.wrapS = THREE.RepeatWrapping;
      texture.wrapT = THREE.RepeatWrapping;
      texture.repeat.set(18, 18);
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.anisotropy = Math.min(8, this.renderer.capabilities?.getMaxAnisotropy?.() || 1);
      texture.needsUpdate = true;
      this.terrainTexture = texture;
      return texture;
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
      if (this.photorealAssets.panorama) {
        // The panorama is lighting data only. The visible world is always
        // geometry rendered by the engine, never a flat background image.
        this.scene.environment = this.photorealAssets.panorama;
        this.scene.fog = new THREE.FogExp2(0x17263a, 0.0068);
      }

      const hemisphere = new THREE.HemisphereLight(0xcce8ff, 0x271b19, 1.25);
      this.scene.add(hemisphere);
      this.hemisphereLight = hemisphere;

      const sun = new THREE.DirectionalLight(0xffe6bf, 2.8);
      sun.position.set(-24, 42, 18);
      sun.castShadow = Boolean(this.renderer.shadowMap?.enabled);
      const shadowSize = quality === "cinematic" ? 2048 : quality === "high" ? 1536 : quality === "medium" ? 1024 : 768;
      sun.shadow.mapSize.set(shadowSize, shadowSize);
      sun.shadow.camera.left = -75;
      sun.shadow.camera.right = 75;
      sun.shadow.camera.top = 75;
      sun.shadow.camera.bottom = -75;
      this.scene.add(sun);
      this.sunLight = sun;

      const hLight = new THREE.PointLight(0x69efff, 45, 60, 1.8);
      hLight.position.set(0, 10, 0);
      this.scene.add(hLight);
      this.hLight = hLight;

      const fill = new THREE.DirectionalLight(0x9bbdff, 0.55);
      fill.position.set(28, 18, -34);
      this.scene.add(fill);
      this.fillLight = fill;
      const rim = new THREE.DirectionalLight(0xff74c8, 0.72);
      rim.position.set(-18, 15, -42);
      this.scene.add(rim);
      this.rimLight = rim;

      const terrainTexture = this.createTerrainTexture();
      const terrainSegments = quality === "cinematic" ? 160 : quality === "high" ? 128 : quality === "low" ? 48 : 88;
      const terrainGeometry = new THREE.PlaneGeometry(376, 376, terrainSegments, terrainSegments);
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
        positions.setZ(index, -0.22 + macro * centralFlatten + edgeRise);
      }
      terrainGeometry.computeVertexNormals();
      const ground = new THREE.Mesh(
        terrainGeometry,
        new THREE.MeshPhysicalMaterial({
          color: 0x596676,
          map: terrainTexture,
          bumpMap: terrainTexture,
          bumpScale: 0.42,
          roughness: 0.88,
          metalness: 0.025,
          clearcoat: 0.12,
          clearcoatRoughness: 0.62,
          envMapIntensity: this.photorealAssets.panorama ? 0.48 : 0.16
        })
      );
      ground.rotation.x = -Math.PI / 2;
      ground.receiveShadow = true;
      ground.name = "AstralGround";
      this.groundMesh = ground;
      this.world.add(ground);

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
      this.createStoryBeacons();
      this.createWorldArtLandmarks();
      this.createWeatherField();
      this.createLivingWorldEffects();
      this.createFootprintPool();
      this.cacheWorldRuntimeObjects();
      this.applyBiomeVisualState(this.currentZone, { immediate: true });
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
          vertexColors: true,
          side: THREE.BackSide,
          fog: false,
          depthWrite: false,
          transparent: false,
          opacity: 1
        })
      );
      this.scene.add(this.skyDome);

      this.sunDisc = new THREE.Mesh(
        new THREE.SphereGeometry(5.2, 28, 20),
        new THREE.MeshBasicMaterial({ color: 0xffdf8b, fog: false })
      );
      this.scene.add(this.sunDisc);
      this.moonDisc = new THREE.Mesh(
        new THREE.SphereGeometry(3.2, 24, 16),
        new THREE.MeshBasicMaterial({ color: 0x9fc8ff, transparent: true, opacity: 0.8, fog: false })
      );
      this.scene.add(this.moonDisc);

      const cloudMaterial = new THREE.MeshPhysicalMaterial({
        color: 0xbec8dc,
        emissive: 0x293550,
        emissiveIntensity: 0.08,
        roughness: 0.94,
        metalness: 0,
        transparent: true,
        opacity: 0.16,
        depthWrite: false
      });
      const cloudCount = this.state.settings.reduceEffects ? 7 : 16;
      for (let index = 0; index < cloudCount; index += 1) {
        const cloud = new THREE.Group();
        const puffs = 3 + (index % 3);
        for (let part = 0; part < puffs; part += 1) {
          const puff = new THREE.Mesh(
            new THREE.SphereGeometry(2.6 + (part % 2) * 1.4, 12, 8),
            cloudMaterial
          );
          puff.position.set(part * 3.2 - puffs * 1.2, Math.sin(part) * 0.8, Math.cos(part) * 1.2);
          puff.scale.y = 0.42;
          cloud.add(puff);
        }
        const angle = (index / cloudCount) * Math.PI * 2;
        const radius = 55 + (index % 4) * 18;
        cloud.position.set(Math.cos(angle) * radius, 22 + (index % 5) * 4.2, Math.sin(angle) * radius);
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
      const waterMaterial = new THREE.MeshPhysicalMaterial({
        color: 0x3fdacb,
        emissive: 0x0c6d75,
        emissiveIntensity: 0.2,
        bumpMap: this.terrainTexture,
        bumpScale: 0.055,
        roughness: 0.18,
        metalness: 0.06,
        transparent: true,
        opacity: 0.72,
        clearcoat: 0.85,
        clearcoatRoughness: 0.12,
        envMapIntensity: this.photorealAssets.panorama ? 0.72 : 0.28,
        side: THREE.DoubleSide
      });
      const auroraLake = new THREE.Mesh(new THREE.CircleGeometry(13.5, 72), waterMaterial);
      auroraLake.rotation.x = -Math.PI / 2;
      auroraLake.position.set(-51, 1.12, 20);
      auroraLake.receiveShadow = true;
      auroraLake.userData = { water: true, baseY: 1.12, radius: 13.5, zoneId: "aurora" };
      this.world.add(auroraLake);
      this.waterSurfaces.push(auroraLake);

      const oceanMoonSea = new THREE.Mesh(new THREE.CircleGeometry(27, 96), waterMaterial.clone());
      oceanMoonSea.material.color.setHex(0x2f8fd9);
      oceanMoonSea.material.emissive.setHex(0x114c8d);
      oceanMoonSea.rotation.x = -Math.PI / 2;
      oceanMoonSea.position.set(122, 1.1, -42);
      oceanMoonSea.receiveShadow = true;
      oceanMoonSea.userData = { water: true, baseY: 1.1, radius: 27, zoneId: "ocean" };
      this.world.add(oceanMoonSea);
      this.waterSurfaces.push(oceanMoonSea);

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
      auroraGroup.add(grass);

      const rockProfiles = [
        ["central", 0, 0, 54, 0x33546d],
        ["aurora", -51, 20, 46, 0x267764],
        ["crimson", 52, 24, 48, 0x6d3128],
        ["void", 2, -62, 52, 0x4f2c76]
      ];
      rockProfiles.forEach(([zoneId, centerX, centerZ, baseCount, color], profileIndex) => {
        const group = this.streamingGroups.get(zoneId) || makeGroup(zoneId);
        const count = Math.max(14, Math.round(baseCount * density));
        const rocks = new THREE.InstancedMesh(
          new THREE.IcosahedronGeometry(0.72, 0),
          new THREE.MeshStandardMaterial({
            color,
            map: this.terrainTexture,
            bumpMap: this.terrainTexture,
            bumpScale: 0.16,
            roughness: 0.94,
            metalness: zoneId === "crimson" ? 0.12 : 0.02,
            envMapIntensity: this.photorealAssets.panorama ? 0.42 : 0.12
          }),
          count
        );
        for (let index = 0; index < count; index += 1) {
          const angle = seeded(index, profileIndex + 7) * Math.PI * 2;
          const radius = 7 + seeded(index, profileIndex + 11) * 21;
          const sx = 0.45 + seeded(index, 15) * 1.6;
          matrix.compose(
            new THREE.Vector3(centerX + Math.cos(angle) * radius, 1.18 + sx * 0.18, centerZ + Math.sin(angle) * radius),
            new THREE.Quaternion().setFromEuler(new THREE.Euler(seeded(index, 18), seeded(index, 19) * Math.PI, seeded(index, 20))),
            new THREE.Vector3(sx, sx * (0.7 + seeded(index, 21)), sx)
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
      const amountScale = quality === "low" ? 0.42 : quality === "medium" ? 0.68 : 1;
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
        ["grass", "aurora", 22, 0.9, 30]
      ];
      const seeded = (index, salt) => {
        const value = Math.sin(index * 71.137 + salt * 19.71) * 43758.5453;
        return value - Math.floor(value);
      };
      const instantiate = (source, targetHeight) => {
        const wrapper = new THREE.Group();
        const object = source.scene.clone(true);
        object.updateMatrixWorld(true);
        const bounds = new THREE.Box3().setFromObject(object);
        const size = bounds.getSize(new THREE.Vector3());
        const center = bounds.getCenter(new THREE.Vector3());
        const fit = targetHeight / Math.max(0.001, size.y);
        object.scale.setScalar(fit);
        object.position.set(-center.x * fit, -bounds.min.y * fit, -center.z * fit);
        wrapper.add(object);
        wrapper.userData = { licensedAsset: true, provider: "Poly Haven", lodPriority: "environment-near" };
        return wrapper;
      };
      placements.forEach(([assetId, zoneId, requestedCount, targetHeight, maxRadius], profileIndex) => {
        const source = this.licensedEnvironmentAssets.get(assetId);
        const zone = ZONES.find((entry) => entry.id === zoneId);
        if (!source?.scene || !zone) return;
        const parent = this.streamingGroups.get(zoneId) || this.world;
        const count = Math.max(2, Math.round(requestedCount * amountScale));
        for (let index = 0; index < count; index += 1) {
          const object = instantiate(source, targetHeight * (0.78 + seeded(index, profileIndex + 4) * 0.5));
          const angle = seeded(index, profileIndex + 9) * Math.PI * 2;
          const radius = 8 + seeded(index, profileIndex + 13) * Math.max(2, maxRadius - 8);
          object.position.set(zone.x + Math.cos(angle) * radius, 1.05, zone.z + Math.sin(angle) * radius);
          object.rotation.y = seeded(index, profileIndex + 17) * Math.PI * 2;
          object.userData.zoneId = zoneId;
          parent.add(object);
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
            new THREE.MeshPhysicalMaterial({
              color: solved ? color : 0x243047,
              emissive: color,
              emissiveIntensity: solved ? 0.85 : 0.16,
              roughness: solved ? 0.22 : 0.46,
              metalness: 0.58,
              clearcoat: 0.52,
              envMapIntensity: 0.56
            })
          );
          pylon.position.set(Math.cos(angle) * 1.8, 1.4, Math.sin(angle) * 1.8);
          group.add(pylon);
        }
        const core = new THREE.Mesh(
          new THREE.OctahedronGeometry(0.72, 1),
          new THREE.MeshPhysicalMaterial({
            color,
            emissive: color,
            emissiveIntensity: solved ? 1.4 : 0.36,
            roughness: 0.16,
            metalness: 0.4,
            clearcoat: 0.78,
            envMapIntensity: 0.68
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

    createStoryBeacons() {
      const THREE = this.THREE;
      STORY_ZONE_ORDER.forEach((zoneId, index) => {
        const zone = ZONES.find((item) => item.id === zoneId);
        const shard = TRUTH_SHARDS[zoneId];
        if (!zone || !shard) return;
        const angle = index * 0.91 + 0.4;
        const radius = zoneId === "central" ? 7 : Math.min(8, zone.radius * 0.3);
        const group = new THREE.Group();
        const material = new THREE.MeshStandardMaterial({
          color: new THREE.Color(shard.color).multiplyScalar(0.36),
          emissive: new THREE.Color(shard.color),
          emissiveIntensity: 0.72,
          metalness: 0.48,
          roughness: 0.22,
          transparent: true,
          opacity: 0.9
        });
        const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.72, 1), material);
        core.position.y = 1.55;
        const ring = new THREE.Mesh(
          new THREE.TorusGeometry(1.12, 0.055, 8, 42),
          new THREE.MeshBasicMaterial({ color: shard.color, transparent: true, opacity: 0.58, depthWrite: false })
        );
        ring.position.y = 1.55;
        ring.rotation.x = Math.PI / 2;
        group.add(core, ring);
        group.position.set(zone.x + Math.cos(angle) * radius, 1.08, zone.z + Math.sin(angle) * radius);
        group.userData = {
          type: "story-beacon",
          id: `story-beacon-${zoneId}`,
          zoneId,
          name: `Dư ảnh ${shard.title}`,
          core,
          ring
        };
        this.world.add(group);
        this.storyBeacons.set(zoneId, group);
      });
    }

    createWorldArtLandmarks() {
      const THREE = this.THREE;
      const reduced = this.state.settings.reduceEffects || this.state.settings.vfxLevel === "static";
      const budgetKey = reduced ? "static" : (this.state.settings.vfxLevel === "cinematic" ? "cinematic" : "balanced");
      const budget = WORLD_ART_BUDGETS[budgetKey];
      const shared = {
        box: new THREE.BoxGeometry(1.25, 2.8, 1.25),
        crystal: new THREE.ConeGeometry(0.72, 3.2, 7),
        forge: new THREE.CylinderGeometry(0.72, 1.05, 3.1, 10),
        tree: new THREE.CylinderGeometry(0.36, 0.78, 3.4, 8),
        island: new THREE.DodecahedronGeometry(1.25, 0),
        reef: new THREE.IcosahedronGeometry(1.08, 1),
        station: new THREE.BoxGeometry(1.35, 3.8, 1.35),
        fracture: new THREE.TetrahedronGeometry(1.25, 0)
      };
      const vistaGeometry = {
        central: shared.box,
        aurora: shared.crystal,
        crimson: shared.forge,
        void: shared.tree,
        sky: shared.island,
        ocean: shared.reef,
        station: shared.station,
        abyss: shared.fracture
      };
      const landmarkGeometry = (zoneId) => {
        if (zoneId === "central") return new THREE.OctahedronGeometry(1.45, 1);
        if (zoneId === "aurora") return new THREE.IcosahedronGeometry(1.36, 2);
        if (zoneId === "crimson") return new THREE.CylinderGeometry(1.2, 1.75, 3.8, 16);
        if (zoneId === "void") return new THREE.TorusKnotGeometry(1.05, 0.28, 74, 10, 2, 3);
        if (zoneId === "sky") return new THREE.TetrahedronGeometry(1.85, 1);
        if (zoneId === "ocean") return new THREE.SphereGeometry(1.55, 28, 18);
        if (zoneId === "station") return new THREE.BoxGeometry(2.15, 3.35, 0.62, 2, 3, 1);
        return new THREE.DodecahedronGeometry(1.72, 1);
      };
      const variantGeometry = (zoneId, variantIndex) => {
        if (variantIndex === 1) {
          if (zoneId === "sky") return new THREE.BoxGeometry(0.34, 3.4, 0.34);
          if (zoneId === "ocean") return new THREE.ConeGeometry(0.42, 2.4, 8);
          if (zoneId === "abyss") return new THREE.TetrahedronGeometry(0.72, 0);
          return new THREE.CylinderGeometry(0.25, 0.42, 2.8, 8);
        }
        if (zoneId === "central" || zoneId === "station") return new THREE.BoxGeometry(1.55, 0.92, 0.1);
        if (zoneId === "aurora") return new THREE.BoxGeometry(1.4, 1.75, 1.2);
        if (zoneId === "crimson") return new THREE.TorusGeometry(0.72, 0.16, 8, 28);
        if (zoneId === "void") return new THREE.OctahedronGeometry(0.68, 1);
        if (zoneId === "sky") return new THREE.TetrahedronGeometry(0.86, 0);
        if (zoneId === "ocean") return new THREE.SphereGeometry(0.58, 16, 10);
        return new THREE.DodecahedronGeometry(0.62, 0);
      };

      ZONES.forEach((zone, zoneIndex) => {
        const profile = WORLD_ART_PROFILES[zone.id] || WORLD_ART_PROFILES.central;
        const biome = BIOME_PROFILES[zone.id] || BIOME_PROFILES.central;
        const group = new THREE.Group();
        group.name = `WorldArtV${WORLD_ART_VERSION}:${zone.id}:${profile.motif}`;
        group.position.set(zone.x, 0, zone.z);
        group.userData.zoneId = zone.id;
        group.userData.worldArtVersion = WORLD_ART_VERSION;

        const surfaceMaterial = new THREE.MeshPhysicalMaterial({
          color: profile.ground,
          emissive: profile.accent || biome.accent,
          emissiveIntensity: 0.08,
          map: this.terrainTexture,
          bumpMap: this.terrainTexture,
          bumpScale: 0.28,
          roughness: clamp(0.92 - profile.wetness * 0.46, 0.32, 0.92),
          metalness: zone.id === "station" || zone.id === "central" ? 0.24 : 0.04,
          clearcoat: profile.wetness * 0.68,
          clearcoatRoughness: clamp(0.76 - profile.wetness * 0.52, 0.18, 0.78),
          transparent: true,
          opacity: 0.88,
          envMapIntensity: this.photorealAssets.panorama ? 0.58 : 0.24,
          side: THREE.DoubleSide
        });
        const storySurface = new THREE.Mesh(
          new THREE.RingGeometry(3.4, Math.min(8.4, zone.radius * 0.32), 72, 4),
          surfaceMaterial
        );
        storySurface.rotation.x = -Math.PI / 2;
        storySurface.position.y = 1.085;
        storySurface.receiveShadow = true;
        storySurface.userData = { zoneId: zone.id, worldArtSurface: true };
        group.add(storySurface);

        const vistaMaterial = new THREE.MeshPhysicalMaterial({
          color: new THREE.Color(profile.ground).multiplyScalar(zone.id === "abyss" ? 0.34 : 0.62),
          emissive: new THREE.Color(biome.accent),
          emissiveIntensity: zone.id === "abyss" ? 0.24 : 0.08,
          map: this.terrainTexture,
          bumpMap: this.terrainTexture,
          bumpScale: 0.22,
          roughness: zone.id === "station" ? 0.26 : 0.82,
          metalness: zone.id === "station" || zone.id === "central" ? 0.5 : 0.08,
          envMapIntensity: this.photorealAssets.panorama ? 0.48 : 0.2
        });
        const vistaCount = budget.vistaInstances;
        const vista = new THREE.InstancedMesh(vistaGeometry[zone.id], vistaMaterial, vistaCount);
        const matrix = new THREE.Matrix4();
        const quaternion = new THREE.Quaternion();
        for (let index = 0; index < vistaCount; index += 1) {
          const seed = Math.sin((index + 1) * 67.31 + zoneIndex * 19.73) * 43758.5453;
          const random = seed - Math.floor(seed);
          const angle = (index / vistaCount) * Math.PI * 2 + zoneIndex * 0.39;
          const radius = zone.radius * (0.58 + random * 0.3);
          const height = zone.id === "sky" ? 4 + (index % 4) * 1.8 : 1.15 + (index % 3) * 0.18;
          quaternion.setFromEuler(new THREE.Euler(
            zone.id === "sky" || zone.id === "abyss" ? random * 0.45 : 0,
            angle + random,
            zone.id === "abyss" ? random * 0.6 : 0
          ));
          const scale = 0.62 + random * 1.15;
          matrix.compose(
            new THREE.Vector3(Math.cos(angle) * radius, height, Math.sin(angle) * radius),
            quaternion,
            new THREE.Vector3(scale, zone.id === "central" || zone.id === "station" ? 0.85 + random * 2.2 : scale, scale)
          );
          vista.setMatrixAt(index, matrix);
        }
        vista.instanceMatrix.needsUpdate = true;
        vista.castShadow = !reduced;
        vista.receiveShadow = true;
        vista.userData = { zoneId: zone.id, worldArtVista: true };
        group.add(vista);

        const landmarkMaterial = new THREE.MeshPhysicalMaterial({
          color: new THREE.Color(biome.accent).multiplyScalar(0.42),
          emissive: new THREE.Color(biome.accent),
          emissiveIntensity: profile.emissive,
          roughness: 0.2,
          metalness: zone.id === "station" || zone.id === "central" ? 0.72 : 0.34,
          clearcoat: 0.82,
          clearcoatRoughness: 0.2,
          envMapIntensity: 0.72
        });
        const landmark = new THREE.Mesh(landmarkGeometry(zone.id), landmarkMaterial);
        landmark.position.y = zone.id === "crimson" || zone.id === "station" ? 3.15 : 3.45;
        landmark.castShadow = !reduced;
        landmark.userData = { zoneId: zone.id, worldArtLandmark: profile.landmark, storyMotion: "float" };
        group.add(landmark);

        const haloMaterial = new THREE.MeshBasicMaterial({
          color: biome.accent,
          transparent: true,
          opacity: 0.42,
          blending: THREE.AdditiveBlending,
          depthWrite: false
        });
        const halo = new THREE.Mesh(new THREE.TorusGeometry(2.55, 0.075, 8, 64), haloMaterial);
        halo.position.y = 3.45;
        halo.rotation.x = Math.PI / 2;
        halo.userData = { zoneId: zone.id, storyMotion: "orbit", spin: zoneIndex % 2 ? -0.09 : 0.09 };
        group.add(halo);

        const motifCounts = { central: 5, aurora: 8, crimson: 13, void: 2, sky: 8, ocean: 12, station: 7, abyss: 2 };
        const motifCount = motifCounts[zone.id] || 5;
        const motifMarkers = new THREE.InstancedMesh(
          new THREE.SphereGeometry(0.13, 8, 6),
          new THREE.MeshBasicMaterial({ color: biome.accent, transparent: true, opacity: 0.68, blending: THREE.AdditiveBlending, depthWrite: false }),
          motifCount
        );
        for (let index = 0; index < motifCount; index += 1) {
          const angle = (index / motifCount) * Math.PI * 2;
          const scale = zone.id === "central" && index === 4 ? 1.65 : 0.78 + (index % 3) * 0.14;
          matrix.compose(
            new THREE.Vector3(Math.cos(angle) * 3.15, 3.45 + Math.sin(angle * 2) * 0.16, Math.sin(angle) * 3.15),
            new THREE.Quaternion(),
            new THREE.Vector3(scale, scale, scale)
          );
          motifMarkers.setMatrixAt(index, matrix);
        }
        motifMarkers.instanceMatrix.needsUpdate = true;
        motifMarkers.userData = { zoneId: zone.id, storyMotif: profile.motif, spin: zoneIndex % 2 ? 0.055 : -0.055 };
        group.add(motifMarkers);

        const metricEchoes = new THREE.Group();
        metricEchoes.name = `MetricEchoes:${zone.id}`;
        for (let index = 0; index < 3; index += 1) {
          const echo = new THREE.Mesh(
            new THREE.OctahedronGeometry(0.38 + index * 0.08, 0),
            new THREE.MeshBasicMaterial({
              color: index === 0 ? profile.rim : biome.accent,
              transparent: true,
              opacity: 0,
              blending: THREE.AdditiveBlending,
              depthWrite: false
            })
          );
          const angle = (index / 3) * Math.PI * 2 + zoneIndex * 0.33;
          echo.position.set(Math.cos(angle) * (3.4 + index * 0.45), 2.6 + index * 1.2, Math.sin(angle) * (3.4 + index * 0.45));
          echo.userData = { zoneId: zone.id, metricEcho: index, storyMotion: "echo" };
          metricEchoes.add(echo);
        }
        group.add(metricEchoes);

        const variantGroups = new Map();
        Object.entries(STORY_ENVIRONMENT_VARIANTS[zone.id] || {}).forEach(([choiceId, variant], variantIndex) => {
          const variantGroup = new THREE.Group();
          variantGroup.name = `StoryVariant:${zone.id}:${choiceId}:${variant.landmarkState}`;
          variantGroup.userData = { zoneId: zone.id, storyVariant: choiceId, landmarkState: variant.landmarkState };
          const material = new THREE.MeshPhysicalMaterial({
            color: new THREE.Color(variant.accent).multiplyScalar(0.46),
            emissive: new THREE.Color(variant.accent),
            emissiveIntensity: variant.emissive,
            transparent: true,
            opacity: 0.82,
            roughness: variantIndex ? 0.38 : 0.2,
            metalness: zone.id === "central" || zone.id === "station" ? 0.64 : 0.18,
            clearcoat: 0.62,
            depthWrite: true
          });
          const count = reduced ? 4 : 7;
          const instances = new THREE.InstancedMesh(variantGeometry(zone.id, variantIndex), material, count);
          for (let index = 0; index < count; index += 1) {
            const angle = (index / count) * Math.PI * 2 + variantIndex * 0.37;
            const radius = variantIndex ? 4.5 + (index % 2) * 1.1 : 4.2 + (index % 3) * 0.72;
            const altitude = variantIndex
              ? 2.2 + (index % 3) * 0.5
              : zone.id === "sky" ? 3.1 + (index % 3) : 2.25 + (index % 2) * 1.15;
            quaternion.setFromEuler(new THREE.Euler(
              zone.id === "ocean" ? Math.PI / 2 : variantIndex ? 0 : Math.sin(angle) * 0.16,
              -angle + Math.PI / 2,
              zone.id === "abyss" ? angle * 0.22 : 0
            ));
            const scale = variantIndex ? 0.82 + (index % 2) * 0.22 : 0.72 + (index % 3) * 0.16;
            matrix.compose(
              new THREE.Vector3(Math.cos(angle) * radius, altitude, Math.sin(angle) * radius),
              quaternion,
              new THREE.Vector3(scale, scale, scale)
            );
            instances.setMatrixAt(index, matrix);
          }
          instances.instanceMatrix.needsUpdate = true;
          instances.castShadow = !reduced && variantIndex === 1;
          instances.userData = { zoneId: zone.id, storyVariant: choiceId };
          variantGroup.add(instances);
          const orbit = new THREE.Mesh(
            new THREE.TorusGeometry(4.7 + variantIndex * 0.65, 0.055 + variantIndex * 0.025, 8, 58),
            new THREE.MeshBasicMaterial({ color: variant.accent, transparent: true, opacity: 0.32, depthWrite: false, blending: THREE.AdditiveBlending })
          );
          orbit.position.y = 2.15 + variantIndex * 0.7;
          orbit.rotation.x = Math.PI / 2.25;
          orbit.userData = { zoneId: zone.id, storyVariant: choiceId, spin: (variantIndex ? -1 : 1) * 0.08 };
          variantGroup.add(orbit);
          variantGroup.visible = false;
          group.add(variantGroup);
          variantGroups.set(choiceId, variantGroup);
        });

        const atmosphere = new THREE.Mesh(
          new THREE.CylinderGeometry(zone.radius * 0.58, zone.radius * 0.78, 14, 40, 1, true),
          new THREE.MeshBasicMaterial({
            color: biome.accent,
            transparent: true,
            opacity: reduced ? 0.012 : 0.026,
            side: THREE.DoubleSide,
            depthWrite: false,
            blending: THREE.AdditiveBlending
          })
        );
        atmosphere.position.y = 7.2;
        atmosphere.userData = { zoneId: zone.id, worldArtAtmosphere: true };
        group.add(atmosphere);

        group.userData.worldArt = {
          profile,
          surface: storySurface,
          vista,
          landmark,
          halo,
          motifMarkers,
          atmosphere,
          metricEchoes,
          variantGroups
        };
        this.world.add(group);
        this.storyEnvironmentGroups.set(zone.id, group);
        this.worldArtSurfaces.set(zone.id, storySurface);
      });
      this.root.dataset.worldArt = `v${WORLD_ART_VERSION}`;
    }

    cacheWorldRuntimeObjects() {
      if (!this.world) return;
      this.worldArtAnimatedObjects = [];
      this.worldArtShadowCandidates = [];
      this.world.traverse((object) => {
        if (object.userData?.spin || object.userData?.storyMotion) this.worldArtAnimatedObjects.push(object);
        if (object.isMesh && object !== this.playerMesh && !object.userData?.boss) {
          object.userData.baseCastShadow = Boolean(object.castShadow);
          this.worldArtShadowCandidates.push(object);
        }
      });
      this.worldArtScratchPosition = new this.THREE.Vector3();
    }

    createStarfield() {
      const THREE = this.THREE;
      const count = this.state.settings.reduceEffects ? 300 : 720;
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
        new THREE.PointsMaterial({ size: 0.55, vertexColors: true, transparent: true, opacity: 0.8, sizeAttenuation: true })
      );
      this.scene.add(this.starfield);
    }

    createZonePlatforms() {
      const THREE = this.THREE;
      ZONES.forEach((zone) => {
        const color = new THREE.Color(zone.color);
        const platform = new THREE.Mesh(
          new THREE.CylinderGeometry(zone.radius, zone.radius + 2.5, 1.15, 96, 4),
          new THREE.MeshPhysicalMaterial({
            color: color.clone().multiplyScalar(0.2),
            emissive: color,
            emissiveIntensity: 0.055,
            map: this.terrainTexture,
            bumpMap: this.terrainTexture,
            bumpScale: 0.24,
            roughness: 0.86,
            metalness: 0.08,
            clearcoat: 0.08,
            envMapIntensity: 0.3
          })
        );
        platform.position.set(zone.x, 0.45, zone.z);
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
          new THREE.PlaneGeometry(4.2, length),
          new THREE.MeshStandardMaterial({
            color: new THREE.Color(color).multiplyScalar(0.14),
            emissive: new THREE.Color(color),
            emissiveIntensity: 0.05,
            transparent: true,
            opacity: 0.68,
            roughness: 0.8
          })
        );
        path.rotation.x = -Math.PI / 2;
        path.rotation.z = Math.atan2(dz, dx) - Math.PI / 2;
        path.position.set((x1 + x2) / 2, 1.05, (z1 + z2) / 2);
        this.world.add(path);
      });
    }

    createCentralCity() {
      const THREE = this.THREE;
      const towerMaterial = new THREE.MeshStandardMaterial({
        color: 0x152b47,
        emissive: 0x23546e,
        emissiveIntensity: 0.2,
        metalness: 0.62,
        roughness: 0.28
      });
      const glowMaterial = new THREE.MeshBasicMaterial({ color: 0x72efff, transparent: true, opacity: 0.68 });

      const coreBase = new THREE.Mesh(new THREE.CylinderGeometry(7.4, 9, 2.4, 48), towerMaterial);
      coreBase.position.set(0, 2.1, 0);
      coreBase.castShadow = true;
      coreBase.receiveShadow = true;
      this.world.add(coreBase);

      const core = new THREE.Mesh(
        new THREE.SphereGeometry(3.2, 32, 24),
        new THREE.MeshStandardMaterial({
          color: 0xffc463,
          emissive: 0xff5fae,
          emissiveIntensity: 1.2,
          roughness: 0.18,
          metalness: 0.2
        })
      );
      core.position.set(0, 8.7, 0);
      core.userData.floatBase = 8.7;
      this.world.add(core);
      this.centralCore = core;

      const hLabel = this.addWorldLabel("H", 0, 9.3, 0, "#ffffff", 2.5);
      hLabel.userData.followCore = true;

      [10, 14].forEach((radius, index) => {
        const ring = new THREE.Mesh(new THREE.TorusGeometry(radius, 0.08 + index * 0.03, 8, 96), glowMaterial.clone());
        ring.rotation.x = Math.PI / 2;
        ring.position.y = 1.25 + index * 0.18;
        ring.userData.spin = index ? -0.1 : 0.14;
        this.world.add(ring);
      });

      for (let index = 0; index < 9; index += 1) {
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
      this.createNpc("forge-master", "Thợ rèn Kael", 8, 8, "#ffbb72");

      this.createPortal("central", "Cổng H-Central", 0, 18, "#6feeff", { checkpoint: "central" });
    }

    createAuroraVale() {
      const THREE = this.THREE;
      const material = new THREE.MeshStandardMaterial({
        color: 0x0d594f,
        emissive: 0x2ac8a5,
        emissiveIntensity: 0.16,
        roughness: 0.82
      });
      for (let index = 0; index < 34; index += 1) {
        const angle = (index / 34) * Math.PI * 2 + (index % 4) * 0.14;
        const radius = 8 + (index * 7) % 24;
        const height = 1.4 + (index % 6) * 0.72;
        const crystal = new THREE.Mesh(new THREE.ConeGeometry(0.45 + (index % 3) * 0.12, height, 5), material);
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
      const crown = new THREE.MeshStandardMaterial({ color: 0x4d247d, emissive: 0xbb62ff, emissiveIntensity: 0.2, transparent: true, opacity: 0.86 });
      for (let index = 0; index < 28; index += 1) {
        const angle = (index / 28) * Math.PI * 2 + (index % 5) * 0.16;
        const radius = 9 + (index * 9) % 26;
        const height = 3 + (index % 4) * 1.1;
        const tree = new THREE.Group();
        const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.55, height, 7), trunk);
        stem.position.y = height / 2;
        const leaves = new THREE.Mesh(new THREE.IcosahedronGeometry(1.4 + (index % 3) * 0.3, 1), crown);
        leaves.position.y = height + 0.6;
        tree.add(stem, leaves);
        tree.position.set(2 + Math.cos(angle) * radius, 1.05, -62 + Math.sin(angle) * radius);
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
          [25.6, 26.4].forEach((radius, ringIndex) => {
            const shoreline = new THREE.Mesh(
              new THREE.RingGeometry(radius, radius + 0.22 + ringIndex * 0.08, 96),
              new THREE.MeshBasicMaterial({
                color: ringIndex ? 0x8ff6ff : 0xd4ffff,
                transparent: true,
                opacity: ringIndex ? 0.14 : 0.24,
                blending: THREE.AdditiveBlending,
                depthWrite: false,
                side: THREE.DoubleSide
              })
            );
            shoreline.rotation.x = -Math.PI / 2;
            shoreline.position.set(0, 1.145 + ringIndex * 0.006, 0);
            shoreline.userData = { zoneId: zone.id, spin: ringIndex ? -0.008 : 0.012, shorelineFoam: true };
            group.add(shoreline);
          });
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
      this.weatherField = new THREE.Points(
        geometry,
        new THREE.PointsMaterial({ size: 0.26, color: 0x79f7ff, transparent: true, opacity: 0.48 })
      );
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
      const worldBudget = WORLD_ART_BUDGETS[reduced ? "static" : (this.state.settings.vfxLevel === "cinematic" ? "cinematic" : "balanced")];

      ZONES.forEach((zone, zoneIndex) => {
        const profile = BIOME_PROFILES[zone.id] || BIOME_PROFILES.central;
        const group = new THREE.Group();
        group.name = `LivingBiome:${zone.id}`;
        group.position.set(zone.x, 0, zone.z);
        group.userData.zoneId = zone.id;
        this.world.add(group);
        this.zoneFxGroups.set(zone.id, group);

        const particleCount = Math.max(10, Math.round(worldBudget.localParticles * qualityScale));
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
                : new THREE.ConeGeometry(0.72, 1.45, 5);
          const actor = new THREE.Mesh(geometry, material);
          actor.scale.set(
            profile.actor === "void-mantas" || profile.actor === "sky-rays" ? 1.8 : 1,
            profile.actor === "lumen-fish" ? 0.58 : 1,
            profile.actor === "void-mantas" || profile.actor === "sky-rays" ? 0.34 : 1
          );
          const radius = 6 + index * 4.2;
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
      footprint.material.color.copy(this.worldArtCurrent?.accent || new this.THREE.Color(BIOME_PROFILES[this.currentZone.id]?.particle || 0x9fefff));
      footprint.material.opacity = 0.38;
      footprint.userData.life = footprint.userData.maxLife;
      footprint.visible = true;
      this.lastFootprintAt = time;
      this.lastFootprintPosition = { x: player.x, z: player.z };
    }

    resolveWorldArtState(zoneId = this.currentZone?.id || "central") {
      const base = WORLD_ART_PROFILES[zoneId] || WORLD_ART_PROFILES.central;
      const biome = BIOME_PROFILES[zoneId] || BIOME_PROFILES.central;
      const zoneDefinition = ZONES.find((zone) => zone.id === zoneId) || ZONES[0];
      const zoneState = this.state.world?.zones?.[zoneId] || WORLD_ZONE_DEFAULTS[zoneId] || WORLD_ZONE_DEFAULTS.central;
      const missionState = this.state.story?.missions?.[zoneId] || {};
      const persistedChoice = Object.entries(STORY_ENVIRONMENT_VARIANTS[zoneId] || {})
        .find(([, candidate]) => candidate.landmarkState === zoneState.environmentVariant)?.[0] || "";
      const choiceId = String(missionState.choice || persistedChoice);
      const variant = STORY_ENVIRONMENT_VARIANTS[zoneId]?.[choiceId] || null;
      const metrics = this.state.story?.metrics || STORY_METRIC_DEFAULTS;
      const identityIntegrity = clamp(Number(metrics.identityIntegrity ?? STORY_METRIC_DEFAULTS.identityIntegrity), 0, 100);
      const memoryDebt = clamp(Number(metrics.memoryDebt ?? STORY_METRIC_DEFAULTS.memoryDebt), 0, 100);
      const causalityPressure = clamp(Number(metrics.causalityPressure ?? STORY_METRIC_DEFAULTS.causalityPressure), 0, 100);
      const zoneEchoes = ECHO_MEMORIES.filter((echo) => echo.zoneId === zoneId);
      const unlockedEchoes = zoneEchoes.filter((echo) => this.state.story?.echoes?.[echo.id]?.unlocked).length;
      const echoRatio = zoneEchoes.length ? unlockedEchoes / zoneEchoes.length : 0;
      const restored = zoneState.restored === true;
      const discovered = zoneState.discovered === true || zoneId === "central";
      const ending = String(this.state.story?.endingFlags?.selected || "");
      const ngPlus = clamp(Number(this.state.story?.newGamePlus || 0), 0, 99);
      let fogDensity = Number(variant?.fogDensity ?? base.fogDensity);
      let exposure = Number(variant?.exposure ?? base.exposure);
      let wind = Number(variant?.wind ?? base.wind);
      let wetness = Number(variant?.wetness ?? base.wetness);
      let emissive = Number(variant?.emissive ?? base.emissive);
      let life = Number(variant?.life ?? base.life);
      let weatherStrength = clamp(Number(zoneState.weatherSeverity ?? (variant ? 0.66 : 0.48)), 0.06, 1);
      if (memoryDebt >= 50) fogDensity *= 1 + Math.min(0.16, (memoryDebt - 50) / 310);
      if (causalityPressure >= 60) weatherStrength = clamp(weatherStrength + Math.min(0.15, (causalityPressure - 60) / 260), 0.06, 1);
      if (identityIntegrity < 40) emissive = clamp(emissive + (40 - identityIntegrity) / 220, 0.1, 1.08);
      if (ending === "perfect-silence") {
        fogDensity *= 0.62;
        wind *= 0.12;
        weatherStrength = Math.min(weatherStrength, 0.24);
        emissive *= 0.62;
        life *= 0.35;
        exposure = Math.min(exposure, 0.96);
      } else if (ending === "restoration") {
        fogDensity *= 0.84;
        life = clamp(life + 0.18, 0, 1);
        emissive = clamp(emissive + 0.12, 0, 1.08);
      } else if (ending === "free-constellation") {
        wind = clamp(wind * 1.12, 0, 1.6);
        life = clamp(life + 0.12, 0, 1);
      } else if (ending === "astral-rebirth" && zoneId === "central") {
        exposure = 1.12;
        emissive = 1;
        weatherStrength = 0.28;
      } else if (ending === "one-true-world") {
        life *= zoneId === "central" ? 1 : 0.32;
        fogDensity *= zoneId === "central" ? 0.78 : 1.18;
      }
      return {
        version: WORLD_ART_VERSION,
        zoneId,
        zoneX: zoneDefinition.x,
        zoneZ: zoneDefinition.z,
        truth: base.truth,
        motif: base.motif,
        landmark: base.landmark,
        choiceId,
        landmarkState: variant?.landmarkState || "unresolved-echo",
        weatherKind: variant?.kind || WORLD_WEATHER_KIND_ALIASES[zoneState.weather] || biome.precipitation,
        weatherLabel: String(zoneState.weatherLabel || zoneDefinition.weather || ""),
        horizon: base.horizon,
        zenith: base.zenith,
        lowerSky: base.lowerSky,
        ground: base.ground,
        fog: variant?.fog || base.fog,
        key: base.key,
        fill: base.fill,
        rim: base.rim,
        accent: variant?.accent || biome.accent,
        fogDensity: clamp(fogDensity, 0.0032, 0.018),
        exposure: clamp(exposure, 0.86, 1.18),
        wetness: clamp(wetness, 0, 1),
        emissive: clamp(emissive, 0.08, 1.08),
        wind: clamp(wind, 0, 1.6),
        life: clamp(life, 0, 1),
        weatherStrength,
        identityIntegrity,
        memoryDebt,
        causalityPressure,
        echoRatio,
        restored,
        discovered,
        ending,
        ngPlus
      };
    }

    environmentSignature(snapshot) {
      return [
        snapshot.zoneId,
        snapshot.choiceId || "base",
        Math.floor(snapshot.identityIntegrity / 20),
        Math.floor(snapshot.memoryDebt / 25),
        Math.floor(snapshot.causalityPressure / 20),
        snapshot.restored ? 1 : 0,
        snapshot.discovered ? 1 : 0,
        snapshot.ending || "none",
        snapshot.ngPlus
      ].join(":");
    }

    makeWorldArtVisualState(snapshot) {
      const THREE = this.THREE;
      const horizon = new THREE.Color(snapshot.horizon);
      const accent = new THREE.Color(snapshot.accent);
      horizon.lerp(accent, snapshot.choiceId ? 0.16 : 0.06);
      return {
        snapshot,
        horizon,
        zenith: new THREE.Color(snapshot.zenith),
        lowerSky: new THREE.Color(snapshot.lowerSky),
        ground: new THREE.Color(snapshot.ground).lerp(accent, snapshot.restored ? 0.08 : 0.02),
        fog: new THREE.Color(snapshot.fog),
        key: new THREE.Color(snapshot.key),
        fill: new THREE.Color(snapshot.fill),
        rim: new THREE.Color(snapshot.rim),
        accent,
        fogDensity: snapshot.fogDensity,
        exposure: snapshot.exposure,
        wetness: snapshot.wetness,
        emissive: snapshot.emissive,
        wind: snapshot.wind,
        life: snapshot.life,
        weatherStrength: snapshot.weatherStrength
      };
    }

    cloneWorldArtVisualState(source) {
      return {
        snapshot: source.snapshot,
        horizon: source.horizon.clone(),
        zenith: source.zenith.clone(),
        lowerSky: source.lowerSky.clone(),
        ground: source.ground.clone(),
        fog: source.fog.clone(),
        key: source.key.clone(),
        fill: source.fill.clone(),
        rim: source.rim.clone(),
        accent: source.accent.clone(),
        fogDensity: source.fogDensity,
        exposure: source.exposure,
        wetness: source.wetness,
        emissive: source.emissive,
        wind: source.wind,
        life: source.life,
        weatherStrength: source.weatherStrength
      };
    }

    syncStoryEnvironmentGroups() {
      this.storyEnvironmentGroups.forEach((group, zoneId) => {
        const snapshot = this.resolveWorldArtState(zoneId);
        const art = group.userData.worldArt;
        if (!art) return;
        art.variantGroups.forEach((variantGroup, choiceId) => {
          variantGroup.visible = snapshot.choiceId === choiceId;
          variantGroup.children.forEach((child) => {
            if (!child.material) return;
            child.material.opacity = snapshot.choiceId === choiceId ? (snapshot.restored ? 0.88 : 0.6) : 0;
          });
        });
        art.landmark.material.emissive.set(snapshot.accent);
        art.landmark.material.emissiveIntensity = snapshot.restored ? snapshot.emissive : snapshot.discovered ? snapshot.emissive * 0.54 : 0.12;
        art.halo.material.color.set(snapshot.accent);
        art.halo.material.opacity = snapshot.restored ? 0.52 : snapshot.discovered ? 0.28 : 0.1;
        art.motifMarkers.material.color.set(snapshot.accent);
        art.motifMarkers.material.opacity = snapshot.restored ? 0.72 : snapshot.discovered ? 0.4 : 0.14;
        art.surface.material.color.set(snapshot.ground);
        art.surface.material.roughness = clamp(0.92 - snapshot.wetness * 0.48, 0.3, 0.92);
        art.surface.material.clearcoat = snapshot.wetness * 0.72;
        art.surface.material.emissive.set(snapshot.accent);
        art.surface.material.emissiveIntensity = snapshot.restored ? 0.13 : 0.045;
        art.atmosphere.material.color.set(snapshot.accent);
        art.atmosphere.material.opacity = (this.state.settings.reduceEffects ? 0.01 : 0.022) * (0.65 + snapshot.weatherStrength * 0.7);
        art.atmosphere.visible = zoneId === this.currentZone?.id;
        art.metricEchoes.children.forEach((echo, index) => {
          const memoryOpacity = snapshot.memoryDebt >= 25 ? clamp((snapshot.memoryDebt - 18) / 360, 0.025, 0.18) : 0;
          const ngPlusOpacity = index < Math.min(3, snapshot.ngPlus) ? 0.055 : 0;
          echo.material.opacity = Math.max(memoryOpacity * (1 - index * 0.18), ngPlusOpacity);
          echo.visible = echo.material.opacity > 0.01;
        });
        group.userData.environmentSnapshot = snapshot;
        group.userData.storySignature = this.environmentSignature(snapshot);
        const beacon = this.storyBeacons.get(zoneId);
        const shardFound = this.state.story?.truthShards?.[zoneId]?.discovered === true;
        if (beacon?.userData?.core?.material) {
          beacon.userData.core.material.emissiveIntensity = shardFound ? 1.22 : 0.72;
          beacon.userData.core.scale.setScalar(shardFound ? 1.16 : 1);
          beacon.userData.ring.material.opacity = shardFound ? 0.76 : 0.58;
        }
      });
    }

    applyBiomeVisualState(zone = this.currentZone, { immediate = false } = {}) {
      const snapshot = this.resolveWorldArtState(zone?.id || "central");
      const signature = this.environmentSignature(snapshot);
      const next = this.makeWorldArtVisualState(snapshot);
      if (!this.worldArtCurrent || immediate) this.worldArtCurrent = this.cloneWorldArtVisualState(next);
      this.worldArtTarget = next;
      this.worldArtSignature = signature;
      this.root.dataset.biome = snapshot.zoneId;
      this.root.dataset.precipitation = snapshot.weatherKind;
      this.root.dataset.storyEnvironment = snapshot.choiceId || "unresolved";
      this.root.dataset.truthMotif = snapshot.motif;
      this.root.dataset.worldArt = `v${WORLD_ART_VERSION}`;
      this.root.style.setProperty("--har-biome-accent", snapshot.accent);
      this.root.style.setProperty("--har-biome-wind", String(snapshot.wind));
      this.root.style.setProperty("--har-world-wetness", String(snapshot.wetness));
      this.root.style.setProperty("--har-world-pressure", String(snapshot.causalityPressure / 100));
      this.syncStoryEnvironmentGroups();
      if (immediate) this.updateWorldArtTransition(1, performance.now(), 0.58, true);
    }

    updateSkyGradient(time, dayAmount, force = false) {
      if (!this.skyDome?.geometry?.attributes?.color || !this.worldArtCurrent) return;
      const reduced = this.state.settings.reduceEffects || this.state.settings.vfxLevel === "static";
      const budget = WORLD_ART_BUDGETS[reduced ? "static" : (this.state.settings.vfxLevel === "cinematic" ? "cinematic" : "balanced")];
      if (!force && time - this.worldArtLastSkyUpdateAt < budget.skyUpdateMs) return;
      this.worldArtLastSkyUpdateAt = time;
      this.worldArtSkyPalette ||= {
        horizon: new this.THREE.Color(),
        zenith: new this.THREE.Color(),
        lower: new this.THREE.Color(),
        daylight: new this.THREE.Color(0xa9c8ef),
        scratch: new this.THREE.Color()
      };
      const palette = this.worldArtSkyPalette;
      palette.horizon.copy(this.worldArtCurrent.horizon).lerp(palette.daylight, dayAmount * 0.18);
      palette.zenith.copy(this.worldArtCurrent.zenith).lerp(palette.daylight, dayAmount * 0.1);
      palette.lower.copy(this.worldArtCurrent.lowerSky).lerp(palette.horizon, dayAmount * 0.12);
      const positions = this.skyDome.geometry.attributes.position;
      const colors = this.skyDome.geometry.attributes.color;
      for (let index = 0; index < positions.count; index += 1) {
        const y = positions.getY(index) / 280;
        palette.scratch.copy(palette.horizon).lerp(y >= 0 ? palette.zenith : palette.lower, clamp(Math.abs(y), 0, 1));
        colors.setXYZ(index, palette.scratch.r, palette.scratch.g, palette.scratch.b);
      }
      colors.needsUpdate = true;
      this.skyDome.material.color.set(0xffffff);
    }

    updateWorldArtTransition(dt, time, dayAmount, force = false) {
      const current = this.worldArtCurrent;
      const target = this.worldArtTarget;
      if (!current || !target || !this.scene) return;
      const reduced = this.state.settings.reduceEffects || this.state.settings.vfxLevel === "static";
      const blend = force || reduced ? 1 : clamp(1 - Math.exp(-dt * 2.35), 0, 1);
      ["horizon", "zenith", "lowerSky", "ground", "fog", "key", "fill", "rim", "accent"].forEach((key) => current[key].lerp(target[key], blend));
      ["fogDensity", "exposure", "wetness", "emissive", "wind", "life", "weatherStrength"].forEach((key) => {
        current[key] += (target[key] - current[key]) * blend;
      });
      current.snapshot = target.snapshot;
      if (this.scene.fog) {
        this.scene.fog.color.lerp(current.fog, clamp(dt * 3.4, 0, 1));
        this.scene.fog.density += (current.fogDensity - this.scene.fog.density) * clamp(dt * 2.2, 0, 1);
      }
      if (this.hemisphereLight) {
        this.hemisphereLight.color.lerp(current.fill, blend);
        this.hemisphereLight.groundColor.lerp(current.ground, blend);
        this.hemisphereLight.intensity = (0.72 + dayAmount * 1.08) * (0.78 + current.life * 0.24);
      }
      if (this.sunLight) {
        this.sunLight.color.lerp(current.key, blend);
        this.sunLight.intensity = (0.42 + dayAmount * 2.05) * (0.8 + current.exposure * 0.2);
      }
      if (this.fillLight) {
        this.fillLight.color.lerp(current.fill, blend);
        this.fillLight.intensity = (0.24 + dayAmount * 0.42) * (0.82 + current.life * 0.2);
      }
      if (this.rimLight) {
        this.rimLight.color.lerp(current.rim, blend);
        this.rimLight.intensity = 0.32 + (1 - dayAmount) * 0.5 + current.emissive * 0.12;
      }
      if (this.hLight) {
        this.hLight.color.lerp(current.accent, blend);
        this.hLight.intensity = 28 + (1 - dayAmount) * 22 + current.emissive * 12;
        this.hLight.position.x += (current.snapshot.zoneX - this.hLight.position.x) * blend;
        this.hLight.position.y += (9.5 - this.hLight.position.y) * blend;
        this.hLight.position.z += (current.snapshot.zoneZ - this.hLight.position.z) * blend;
      }
      if (this.groundMesh?.material) {
        this.groundMesh.material.color.lerp(current.ground, blend * 0.34);
        this.groundMesh.material.roughness += (clamp(0.94 - current.wetness * 0.48, 0.38, 0.94) - this.groundMesh.material.roughness) * blend;
        this.groundMesh.material.clearcoat += (current.wetness * 0.38 - this.groundMesh.material.clearcoat) * blend;
      }
      if (this.renderer && !this.photoMode) this.renderer.toneMappingExposure += (current.exposure - this.renderer.toneMappingExposure) * blend;
      this.updateSkyGradient(time, dayAmount, force);
      const activeGroup = this.storyEnvironmentGroups.get(current.snapshot.zoneId);
      const activeArt = activeGroup?.userData?.worldArt;
      if (activeArt) {
        activeArt.surface.material.color.lerp(current.ground, blend);
        activeArt.surface.material.roughness += (clamp(0.92 - current.wetness * 0.48, 0.3, 0.92) - activeArt.surface.material.roughness) * blend;
        activeArt.surface.material.clearcoat += (current.wetness * 0.72 - activeArt.surface.material.clearcoat) * blend;
        activeArt.landmark.material.emissive.lerp(current.accent, blend);
        activeArt.halo.material.color.lerp(current.accent, blend);
        activeArt.motifMarkers.material.color.lerp(current.accent, blend);
        activeArt.atmosphere.material.color.lerp(current.accent, blend);
      }
    }

    updateLivingWorld(dt, time) {
      const reduced = this.state.settings.reduceEffects || this.state.settings.vfxLevel === "static";
      this.livingWorldActors.forEach((actor) => {
        if (!actor.mesh.parent?.visible) return;
        const snapshot = this.storyEnvironmentGroups.get(actor.zoneId)?.userData?.environmentSnapshot;
        const life = snapshot?.life ?? 0.72;
        actor.mesh.visible = life > 0.18;
        if (reduced || !actor.mesh.visible) return;
        actor.angle += dt * actor.speed * (0.55 + life * 0.7);
        actor.mesh.position.x = Math.cos(actor.angle) * actor.radius;
        actor.mesh.position.z = Math.sin(actor.angle) * actor.radius;
        actor.mesh.position.y = actor.baseY + Math.sin(time * 0.0013 + actor.radius) * actor.vertical;
        actor.mesh.rotation.y = -actor.angle + Math.PI / 2;
        actor.mesh.rotation.z += dt * 0.18;
      });
      this.zoneFxGroups.forEach((group) => {
        if (!group.visible) return;
        const snapshot = this.storyEnvironmentGroups.get(group.userData.zoneId)?.userData?.environmentSnapshot;
        group.children.forEach((object) => {
          if (object.userData?.livingParticles) {
            object.rotation.y += dt * 0.012 * object.userData.wind * (reduced ? 0 : 1);
            object.material.opacity = object.userData.baseOpacity
              * (0.52 + (snapshot?.weatherStrength ?? 0.58) * 0.48)
              * (reduced ? 0.55 : 0.78 + Math.sin(time * 0.0015 + group.position.x) * 0.22);
          }
          if (object.userData?.hologram) {
            object.material.opacity = reduced ? 0.17 : 0.17 + Math.sin(time * 0.003 + object.position.x) * 0.08;
          }
          if (object.userData?.heatColumn) {
            object.scale.y = reduced ? 0.92 : 0.92 + Math.sin(time * 0.004 + object.position.x) * 0.12;
            object.material.opacity = reduced ? 0.035 : 0.04 + Math.abs(Math.sin(time * 0.002 + object.position.z)) * 0.05;
          }
        });
      });
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
        const distance = Math.hypot(this.state.player.x - npc.position.x, this.state.player.z - npc.position.z);
        this.updateCharacterLod(npc, distance);
        const updateInterval = 1000 / Math.max(1, runtime?.updateHz || 12);
        const shouldAnimate = runtime && time - Number(runtime.lastAnimationUpdateAt || 0) >= updateInterval;
        if (runtime?.mixer && shouldAnimate) {
          this.playCharacterClip(runtime, "walk");
          runtime.mixer.update(Math.min(0.1, updateInterval / 1000));
          runtime.lastAnimationUpdateAt = time;
        } else if (shouldAnimate) {
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
          runtime.lastAnimationUpdateAt = time;
        }
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

    buildNpcCharacterDNA(id, profileId = "sol") {
      const seed = [...String(id || "npc")].reduce((total, character) => ((total * 33) ^ character.charCodeAt(0)) >>> 0, 2166136261);
      const recipe = defaultAppearanceRecipe(profileId);
      const models = APPEARANCE_ASSETS.baseModels.filter((modelId) => modelId.startsWith("valid-"));
      recipe.baseModel = models[seed % models.length] || recipe.baseModel;
      recipe.bodyPreset = ["balanced", "athletic", "soft", "agile"][seed % 4];
      Object.values(APPEARANCE_CONTROL_MAP).forEach((control, index) => {
        if (control.group === "expression") return;
        const wave = Math.sin(seed * 0.00017 + index * 1.913) * 0.5 + 0.5;
        recipe.morphs[control.id] = Number((0.34 + wave * 0.32).toFixed(3));
      });
      const motionPreset = ["balanced", "agile", "grounded", "cinematic"][(seed >>> 4) % 4];
      recipe.motionDNA = { ...recipe.motionDNA, ...MOTION_DNA_PRESETS[motionPreset], preset: motionPreset };
      recipe.hair = APPEARANCE_ASSETS.hairs[(seed >>> 6) % APPEARANCE_ASSETS.hairs.length];
      recipe.outfit = [APPEARANCE_ASSETS.outfits[(seed >>> 8) % APPEARANCE_ASSETS.outfits.length]];
      recipe.updatedAt = nowIso();
      return normalizeAppearanceRecipe(recipe, profileId);
    }

    createNpc(id, name, x, z, color) {
      const npcProfile = id === "luma" ? CHARACTERS.cael : CHARACTERS.sol;
      const mesh = this.createPhotorealCharacterModel(npcProfile, 0.88);
      const npcDNA = this.buildNpcCharacterDNA(id, npcProfile.id);
      mesh.position.set(x, 1.08, z);
      mesh.userData = {
        ...mesh.userData,
        type: "npc",
        id,
        name,
        assetClass: CHARACTER_ASSET_CLASSES.hero.id,
        npcDNA: compactAppearanceRecipe(npcDNA, npcProfile.id),
        sharedSkeleton: "hh-humanoid-v12",
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
      const runtime = this.registerCharacterRuntime(mesh, npcProfile, `npc:${id}`, "npc", mesh.userData.builtInAnimations || []);
      runtime.motionDNA = npcDNA.motionDNA;
      runtime.deterministicSeed = id;
      this.applyAppearanceToMesh(mesh, npcDNA, npcProfile.id);
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
          envMapIntensity: this.photorealAssets.panorama ? 0.72 : 0.18,
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
      group.add(coat);

      const cape = new THREE.Mesh(
        new THREE.PlaneGeometry(0.9, 1.2, 1, 3),
        toon(profile.accent, { transparent: true, opacity: 0.82, emissive: profile.accent, emissiveIntensity: 0.2 })
      );
      cape.position.set(0, 1.5, 0.34);
      cape.rotation.x = 0.12;
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
            if (/hair|brow|lash|beard|groom/.test(identity)) role = "hair";
            else if (/eye|iris|cornea|sclera|tear/.test(identity)) role = "eyes";
            else if (/skin|dermis|face|head|body_nude/.test(identity)) role = "skin";
            else role = "outfit";
            material.userData.materialRole = role;
          }
          material.userData.baseRoughness ??= material.roughness;
          material.userData.baseClearcoat ??= material.clearcoat || 0;
          material.userData.baseEmissiveIntensity ??= material.emissiveIntensity || 0;
          if (material.color && !material.userData.hhOriginalColor) material.userData.hhOriginalColor = `#${material.color.getHexString()}`;
          if (role === "skin") {
            material.color?.set(recipe.skinColor);
            const drySkinRoughness = clamp(0.46 + recipe.surface.roughness * 0.34, 0.44, 0.76);
            const drySkinClearcoat = 0.006;
            if ("roughness" in material) material.roughness = clamp(drySkinRoughness - recipe.surface.wetness * 0.1, 0.38, 0.8);
            if ("metalness" in material) material.metalness = 0;
            if ("clearcoat" in material) material.clearcoat = clamp(drySkinClearcoat + recipe.surface.wetness * 0.38, 0, 0.48);
            if ("clearcoatRoughness" in material) material.clearcoatRoughness = 0.78;
            if ("sheen" in material) material.sheen = clamp(0.04 + recipe.surface.subsurface * 0.16, 0.04, 0.24);
            if ("ior" in material) material.ior = 1.38;
            if ("specularIntensity" in material) material.specularIntensity = clamp(0.2 + recipe.surface.subsurface * 0.14, 0.2, 0.36);
            if ("envMapIntensity" in material) material.envMapIntensity = clamp(0.48 + recipe.surface.wetness * 0.12, 0.48, 0.62);
            material.userData.baseRoughness = drySkinRoughness;
            material.userData.baseClearcoat = drySkinClearcoat;
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
          } else if (role === "eyes") {
            material.color?.set(recipe.eyeColor);
            if ("roughness" in material) material.roughness = 0.08;
            if ("clearcoat" in material) material.clearcoat = 0.78 + (recipe.morphs.eyeReflection || 0.5) * 0.22;
            if ("ior" in material) material.ior = 1.376;
            if ("transmission" in material) material.transmission = 0.04;
          } else if (role === "outfit") {
            const color = materialIndex % 2 ? outfitPalette[1] : outfitPalette[0];
            if (material.color && mesh.userData.visualMode !== "hero-prime-rigged") material.color.set(color);
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
      mesh.userData.motionDNA = { ...recipe.motionDNA };
      mesh.userData.voiceDNA = { ...recipe.voice };
      mesh.userData.evolution = { ...recipe.evolution };
      if (mesh.userData.characterRuntime) {
        mesh.userData.characterRuntime.motionDNA = mesh.userData.motionDNA;
        mesh.userData.characterRuntime.voiceDNA = mesh.userData.voiceDNA;
      }
      const parts = mesh.userData.parts;
      const morph = (id) => recipe.morphs[id] ?? APPEARANCE_CONTROL_MAP[id]?.defaultValue ?? 0.5;
      const delta = (id) => morph(id) - (APPEARANCE_CONTROL_MAP[id]?.defaultValue ?? 0.5);
      const hasProceduralRig = Boolean(parts.torso && parts.head && parts.leftArm && parts.rightArm && parts.leftLeg && parts.rightLeg);
      if (!hasProceduralRig) {
        this.applyDigitalHumanMaterials(mesh, recipe, characterId);
        const supportedTargets = this.applyNamedMorphTargets(mesh, recipe);
        if (mesh.userData.visualMode === "hero-prime-rigged") {
          this.applyRiggedBodyProportions(mesh, recipe);
        }
        mesh.userData.appearance = compactAppearanceRecipe(recipe, characterId);
        mesh.userData.appearanceFingerprint = appearanceFingerprint(recipe, characterId);
        mesh.userData.appearanceCapability = supportedTargets
          ? "gltf-morph-targets"
          : mesh.userData.visualMode === "hero-prime-rigged"
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
      mesh.userData.appearanceCapability = supportedTargets ? "gltf-morph-targets" : "native-skeleton";
      mesh.userData.visualHeight = 1 + delta("height") * 0.12;
      mesh.userData.gameplayCollider = { radius: 0.48, height: 2.95 };
    }

    applyCorrectiveMorphs(mesh) {
      if (!mesh) return;
      const runtime = mesh.userData?.characterRuntime;
      const parts = mesh.userData?.parts || {};
      const leftArm = runtime?.bones?.leftUpperArm;
      const rightArm = runtime?.bones?.rightUpperArm;
      const leftForeArm = runtime?.bones?.leftForeArm;
      const rightForeArm = runtime?.bones?.rightForeArm;
      if (!leftArm || !rightArm || !leftForeArm || !rightForeArm) return;
      const values = {
        correctiveShoulder: clamp((Math.abs(leftArm.rotation.x) + Math.abs(rightArm.rotation.x)) * 0.24, 0, 1),
        correctiveElbow: clamp((Math.abs(leftForeArm.rotation.x) + Math.abs(rightForeArm.rotation.x)) * 0.18, 0, 1),
        shoulderCorrective: clamp((Math.abs(leftArm.rotation.z) + Math.abs(rightArm.rotation.z)) * 0.22, 0, 1),
        wristAlignment: runtime.armIk?.enabled ? 1 : 0
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
      const captureTransform = (target) => {
        if (!target) return null;
        target.userData ||= {};
        target.userData.hhBasePosition ||= target.position.clone();
        target.userData.hhBaseQuaternion ||= target.quaternion.clone();
        return target.userData;
      };
      const setSegmentScale = (target, lengthScale = 1, radialScale = 1, radialDepthScale = radialScale) => {
        if (!target) return;
        const base = target.userData.hhBaseScale || { x: 1, y: 1, z: 1 };
        const child = target.children?.find((item) => item.isBone);
        const vector = child?.position;
        const axis = vector
          ? [Math.abs(vector.x), Math.abs(vector.y), Math.abs(vector.z)].indexOf(Math.max(Math.abs(vector.x), Math.abs(vector.y), Math.abs(vector.z)))
          : 1;
        const radialAxes = [0, 1, 2].filter((index) => index !== axis);
        const values = [1, 1, 1];
        values[axis] = lengthScale;
        values[radialAxes[0]] = radialScale;
        values[radialAxes[1]] = radialDepthScale;
        target.scale.set(base.x * values[0], base.y * values[1], base.z * values[2]);
      };
      const setPalmScale = (target, lengthScale = 1, widthScale = 1, depthScale = 1) => {
        if (!target) return;
        const base = target.userData.hhBaseScale || { x: 1, y: 1, z: 1 };
        const fingers = (target.children || []).filter((child) => child.isBone && !/thumb/i.test(child.name || ""));
        const axes = [0, 1, 2];
        const component = (vector, axis) => [vector.x, vector.y, vector.z][axis];
        const lengthAxis = axes.reduce((best, axis) => {
          const score = fingers.reduce((sum, child) => sum + Math.abs(component(child.position, axis)), 0);
          return score > best.score ? { axis, score } : best;
        }, { axis: 1, score: -1 }).axis;
        const radialAxes = axes.filter((axis) => axis !== lengthAxis);
        const widthAxis = radialAxes.reduce((best, axis) => {
          const values = fingers.map((child) => component(child.position, axis));
          const spread = values.length ? Math.max(...values) - Math.min(...values) : 0;
          return spread > best.spread ? { axis, spread } : best;
        }, { axis: radialAxes[0], spread: -1 }).axis;
        const depthAxis = radialAxes.find((axis) => axis !== widthAxis) ?? radialAxes[1];
        const values = [1, 1, 1];
        values[lengthAxis] = lengthScale;
        values[widthAxis] = widthScale;
        values[depthAxis] = depthScale;
        target.scale.set(base.x * values[0], base.y * values[1], base.z * values[2]);
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
      const leftShoulder = bone("LeftShoulder", "mixamorigLeftShoulder");
      const rightShoulder = bone("RightShoulder", "mixamorigRightShoulder");
      const leftHand = bone("LeftHand", "mixamorigLeftHand");
      const rightHand = bone("RightHand", "mixamorigRightHand");
      const leftUpLeg = bone("LeftUpLeg", "mixamorigLeftUpLeg");
      const rightUpLeg = bone("RightUpLeg", "mixamorigRightUpLeg");
      const leftLeg = bone("LeftLeg", "mixamorigLeftLeg");
      const rightLeg = bone("RightLeg", "mixamorigRightLeg");
      const headWidth = 1 + delta("jawWidth") * 0.16 + delta("faceFullness") * 0.1;
      const headHeight = 1 + delta("headLength") * 0.18 + delta("foreheadHeight") * 0.08;
      const headDepth = 1 + delta("faceFullness") * 0.14 + delta("noseProjection") * 0.05;
      setScale(head, headWidth, headHeight, headDepth);
      setScale(neck, 1 + delta("neckWidth") * 0.22, 1 + delta("neckLength") * 0.2, 1 + delta("neckWidth") * 0.2);
      setScale(chest, 1 + delta("chestWidth") * 0.08, 1 + delta("torsoLength") * 0.1, 1 + delta("chestSize") * 0.1);
      setScale(spine, 1 + delta("waist") * 0.18 + delta("bodyMass") * 0.12, 1 + delta("torsoLength") * 0.18, 1 + delta("belly") * 0.16);
      setScale(hips, 1 + delta("hipWidth") * 0.22, 1 + delta("legTorsoRatio") * -0.08, 1 + delta("gluteProjection") * 0.2);
      const armLength = clamp(1 + delta("armLength") * 0.1 + delta("height") * 0.03, 0.94, 1.06);
      const armMass = clamp(1.08 + delta("upperArm") * 0.12 + delta("muscle") * 0.055, 1.01, 1.16);
      const armDepth = clamp(1.055 + delta("upperArm") * 0.09 + delta("muscle") * 0.045, 1, 1.13);
      const forearmLength = clamp(1 + delta("armLength") * 0.07, 0.95, 1.05);
      const forearmMass = clamp(1.06 + delta("forearm") * 0.105 + delta("muscle") * 0.035, 1, 1.13);
      const forearmDepth = clamp(1.04 + delta("forearm") * 0.08 + delta("muscle") * 0.025, 0.995, 1.1);
      const palmLength = clamp(0.975 + delta("handSize") * 0.05, 0.95, 1);
      const palmWidth = clamp(1.075 + delta("handSize") * 0.1, 1.02, 1.13);
      const palmDepth = clamp(1.045 + delta("handSize") * 0.07, 1.01, 1.08);
      const fingerLengthScale = clamp(0.955 + delta("fingerLength") * 0.08, 0.915, 0.995);
      setSegmentScale(leftArm, armLength, armMass, armDepth);
      setSegmentScale(rightArm, armLength, armMass, armDepth);
      setSegmentScale(leftForeArm, forearmLength, forearmMass, forearmDepth);
      setSegmentScale(rightForeArm, forearmLength, forearmMass, forearmDepth);
      setPalmScale(leftHand, palmLength, palmWidth, palmDepth);
      setPalmScale(rightHand, palmLength, palmWidth, palmDepth);
      [
        bone(...HH_HUMANOID_SKELETON.leftThumb), bone(...HH_HUMANOID_SKELETON.rightThumb),
        bone(...HH_HUMANOID_SKELETON.leftIndex), bone(...HH_HUMANOID_SKELETON.rightIndex),
        bone(...HH_HUMANOID_SKELETON.leftMiddle), bone(...HH_HUMANOID_SKELETON.rightMiddle),
        bone(...HH_HUMANOID_SKELETON.leftRing), bone(...HH_HUMANOID_SKELETON.rightRing),
        bone(...HH_HUMANOID_SKELETON.leftPinky), bone(...HH_HUMANOID_SKELETON.rightPinky)
      ].filter(Boolean).forEach((fingerRoot) => setSegmentScale(fingerRoot, fingerLengthScale, 1.012, 1.005));
      const shoulderSpread = clamp(delta("shoulderWidth") * 0.09, -0.045, 0.045);
      [[leftShoulder, -1], [rightShoulder, 1]].forEach(([target, side]) => {
        const data = captureTransform(target);
        if (!data) return;
        const basePosition = data.hhBasePosition;
        target.position.set(
          basePosition.x + side * shoulderSpread,
          basePosition.y + side * delta("shoulderSlope") * 0.035,
          basePosition.z
        );
      });
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
      mesh.userData.armCalibration = {
        model: HERO_CHARACTER_MODEL_ID,
        shoulderSpread,
        armLength,
        armMass,
        armDepth,
        forearmLength,
        forearmMass,
        forearmDepth,
        palmLength,
        palmWidth,
        palmDepth,
        fingerLengthScale,
        handSize: morph("handSize"),
        bindPose: "captured"
      };
    }

    createBuiltInRiggedCharacter(profile, scale = 1) {
      const recipe = normalizeAppearanceRecipe(this.state.appearance?.recipes?.[profile.id], profile.id);
      const modelId = HERO_CHARACTER_MODEL_ID;
      const source = this.builtInCharacterAssets.get(modelId);
      if (!source?.scene || !this.cloneSkinnedCharacter) {
        throw new Error("Hero Prime chưa được tải. Không có model dự phòng; hãy bấm Thử lại.");
      }
      const assetNeedsVisualRecovery = Number(source.userData?.hhTextureFallbacks || 0) > 0
        || Number(source.userData?.hhRenderableMeshes || 0) < 1;
      if (assetNeedsVisualRecovery) {
        throw new Error("Hero Prime bị thiếu mesh hoặc texture. Game đã dừng thay vì hiển thị model chất lượng thấp.");
      }
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
      const heroMeshes = [];
      asset.traverse((object) => {
        if (!object.isMesh && !object.isSkinnedMesh) return;
        heroMeshes.push(object);
        object.castShadow = true;
        object.receiveShadow = true;
        object.userData ||= {};
        object.userData.sharedAsset = true;
        const sourceMaterials = Array.isArray(object.material) ? object.material : [object.material];
        const materials = sourceMaterials.filter(Boolean).map((sourceMaterial) => {
          const material = sourceMaterial.clone();
          const materialName = `${object.name} ${material.name}`.toLowerCase();
          material.userData = {
            ...(material.userData || {}),
            materialRole: /eye|gland|cornea|visor/.test(materialName)
              ? "eyes"
              : /teeth|tongue|mouth/.test(materialName)
                ? "teeth"
                : /highres|body|skin|face|head/.test(materialName)
                  ? "skin"
                  : "outfit",
            baseRoughness: material.roughness,
            baseClearcoat: material.clearcoat || 0,
            baseEmissiveIntensity: material.emissiveIntensity || 0
          };
          material.envMapIntensity = Math.max(material.envMapIntensity || 0, 0.82);
          if (materialName.includes("visor")) {
            material.color?.set(profile.eyes);
            material.emissive?.set(profile.accent);
            material.emissiveIntensity = Math.max(0.18, material.emissiveIntensity || 0);
          }
          return material;
        });
        object.material = Array.isArray(object.material) ? materials : materials[0];
      });
      wrapper.add(asset);
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
      (rightHand || wrapper).add(weaponAnchor);
      const heroDetails = [];
      let riggedHair = null;
      let riggedAccessory = null;
      if (headBone && modelId === HERO_CHARACTER_MODEL_ID) {
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
      heroMeshes.forEach((object) => { object.visible = true; });
      const activeHeroMeshes = [...heroMeshes, ...heroDetails];
      wrapper.userData = {
        characterId: profile.id,
        visualMode: "hero-prime-rigged",
        sourceProvider: sourceInfo.label || "HH Hero Prime · Full Quality Only",
        sourceProviderId: sourceInfo.provider,
        sourceAssetPath: sourceInfo.url,
        gameplayVisualLift: 1.35,
        modelTier: "hero",
        appearanceCapability: "skeleton-proportions",
        gameplayCollider: { radius: 0.48, height: 2.95 },
        gltfAsset: asset,
        builtInModelId: modelId,
        builtInAnimations: [],
        parts: {
          weaponAnchor,
          hair: riggedHair,
          accessory: riggedAccessory
        },
        lodVariants: {
          hero: activeHeroMeshes,
          heroDetails
        }
      };
      this.applyRiggedBodyProportions(wrapper, recipe);
      this.applyAppearanceToMesh(wrapper, recipe, profile.id);
      wrapper.userData.appearance = compactAppearanceRecipe(recipe, profile.id);
      wrapper.userData.appearanceFingerprint = appearanceFingerprint(recipe, profile.id);
      this.characterAssetStatus.set(profile.id, wrapper.userData.sourceProvider);
      return wrapper;
    }

    createPhotorealCharacterModel(profile, scale = 1) {
      const rigged = this.createBuiltInRiggedCharacter(profile, scale);
      if (!rigged) throw new Error("Hero Prime không thể khởi tạo và không có visual fallback.");
      return rigged;
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
        corneaMeshes: 0,
        tearLineMeshes: 0,
        teethMeshes: 0,
        tongueMeshes: 0,
        eyelashMeshes: 0,
        hairCardMeshes: 0,
        normalMaps: 0,
        roughnessMaps: 0,
        thicknessMaps: 0
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
        if (/cornea/.test(identity)) report.corneaMeshes += 1;
        if (/tear|tearline|waterline/.test(identity)) report.tearLineMeshes += 1;
        if (/teeth|tooth|dental/.test(identity)) report.teethMeshes += 1;
        if (/tongue/.test(identity)) report.tongueMeshes += 1;
        if (/eyelash|eye_lash|lashes/.test(identity)) report.eyelashMeshes += 1;
        if (/hair|groom|brow|lash/.test(identity)) report.hairCardMeshes += 1;
        const morphNames = Object.keys(object.morphTargetDictionary || {});
        report.morphTargets += morphNames.length;
        report.faceMorphTargets += morphNames.filter((name) => {
          const normalized = String(name)
            .replace(/^ARKit_/i, "")
            .replace(/^AR_/i, "")
            .replace(/_L$/i, "Left")
            .replace(/_R$/i, "Right");
          return MEDIAPIPE_FACE_CHANNELS.some((channel) => channel.toLowerCase() === normalized.toLowerCase());
        }).length;
        const objectMaterials = Array.isArray(object.material) ? object.material : [object.material];
        objectMaterials.filter(Boolean).forEach((material) => {
          materials.add(material);
          textureSlots.forEach((slot) => {
            const texture = material[slot];
            if (!texture?.isTexture) return;
            textures.add(texture);
            if (slot === "normalMap") report.normalMaps += 1;
            if (slot === "roughnessMap") report.roughnessMaps += 1;
            if (slot === "thicknessMap") report.thicknessMaps += 1;
            const image = texture.image || texture.source?.data;
            report.maxTextureSize = Math.max(report.maxTextureSize, Number(image?.width || 0), Number(image?.height || 0));
          });
        });
      });
      report.materials = materials.size;
      report.textures = textures.size;
      report.skeletonCoverage = matchedBones.size / Object.keys(HH_HUMANOID_SKELETON).length;
      const classification = classifyCharacterAsset(report);
      report.digitalHumanTier = classification.heroReady
        ? "web-hero-v12"
        : report.skinnedMeshes && report.bones
          ? "gameplay-rig"
          : "proxy";
      Object.assign(report, classification);
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
        tier: "hero",
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
        motionSpeed: 0,
        motionDirection: 0,
        directionalBlend: { forward: 0, backward: 0, left: 0, right: 0 },
        motionDNA: mesh.userData?.motionDNA || normalizeAppearanceRecipe(this.state.appearance?.recipes?.[profile.id], profile.id).motionDNA,
        skeletonContract: "hh-humanoid-v12",
        rootMotionPolicy: "extract-and-warp",
        footLock: { left: 0, right: 0 },
        secondaryBones: [],
        lastFacialUpdateAt: 0
      };
      runtime.qaReport = { ...runtime.qaReport, ...validateCharacterAsset(runtime.qaReport) };
      const normalizedAliases = Object.fromEntries(Object.entries(HH_HUMANOID_SKELETON).map(([slot, aliases]) => [
        slot,
        aliases.map(normalizeBoneName)
      ]));
      mesh.traverse?.((object) => {
        if (object.isBone) {
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
        }
        if (object.isMesh || object.isSkinnedMesh) {
          const count = object.geometry?.index?.count || object.geometry?.attributes?.position?.count || 0;
          runtime.triangles += object.geometry?.index ? Math.floor(count / 3) : Math.floor(count / 3);
          runtime.facialChannels += Object.keys(object.morphTargetDictionary || {}).length;
          if (object.morphTargetDictionary && object.morphTargetInfluences) {
            runtime.morphLookup.set(object, Object.fromEntries(
              Object.entries(object.morphTargetDictionary).map(([name, index]) => [String(name).toLowerCase(), index])
            ));
          }
        }
      });
      if (normalizedAnimations.length) {
        runtime.mixer = new this.THREE.AnimationMixer(mesh);
        normalizedAnimations.forEach((clip) => runtime.clips.set(String(clip.name || "").toLowerCase(), clip));
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
      if (state === "start") return this.findCharacterClip(runtime, "run");
      if (["stop", "turnLeft", "turnRight"].includes(state)) return this.findCharacterClip(runtime, "idle");
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
      if (!runtime?.mixer || (runtime.state === state && runtime.currentAction)) return;
      const clip = this.findCharacterClip(runtime, state);
      runtime.previousState = runtime.state;
      runtime.state = state;
      if (!clip) return;
      const next = runtime.mixer.clipAction(clip);
      if (runtime.currentAction === next) return;
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
      const dna = runtime.motionDNA || MOTION_DNA_PRESETS.balanced;
      const dnaTransition = clamp(transitionSeconds * (1.35 - Number(dna.turnResponse || 0.5) * 0.58), 0.08, 0.28);
      if (runtime.currentAction) runtime.currentAction.crossFadeTo(next, dnaTransition, true);
      else next.fadeIn(Math.min(0.16, dnaTransition));
      next.play();
      runtime.currentAction = next;
      runtime.actionTimeScale = fittedTimeScale;
      runtime.transition = {
        from: runtime.previousState,
        to: state,
        startedAt: performance.now(),
        duration: dnaTransition,
        mode: "inertial-crossfade",
        upperBodyLayer: Boolean(dna.upperBodyLayer && (state.startsWith("attack") || ["skill", "ultimate", "talk"].includes(state))),
        motionWarp: Boolean(dna.motionWarp && oneShot),
        rootMotion: Boolean(dna.rootMotion && oneShot)
      };
    }

    rotateHeroBoneTowardWorldTarget(bone, endBone, targetWorld, weight = 0.72) {
      if (!bone || !endBone || !targetWorld || !this.THREE) return false;
      const THREE = this.THREE;
      bone.updateWorldMatrix(true, false);
      endBone.updateWorldMatrix(true, false);
      const boneWorld = new THREE.Vector3();
      const endWorld = new THREE.Vector3();
      bone.getWorldPosition(boneWorld);
      endBone.getWorldPosition(endWorld);
      const currentDirection = endWorld.sub(boneWorld);
      const desiredDirection = targetWorld.clone().sub(boneWorld);
      if (currentDirection.lengthSq() < 1e-8 || desiredDirection.lengthSq() < 1e-8) return false;
      currentDirection.normalize();
      desiredDirection.normalize();
      const delta = new THREE.Quaternion().setFromUnitVectors(currentDirection, desiredDirection);
      const worldQuaternion = new THREE.Quaternion();
      bone.getWorldQuaternion(worldQuaternion);
      const desiredWorldQuaternion = delta.multiply(worldQuaternion);
      const parentWorldQuaternion = new THREE.Quaternion();
      if (bone.parent) bone.parent.getWorldQuaternion(parentWorldQuaternion);
      const desiredLocalQuaternion = parentWorldQuaternion.invert().multiply(desiredWorldQuaternion);
      bone.quaternion.slerp(desiredLocalQuaternion, clamp(weight, 0, 1));
      bone.updateWorldMatrix(true, false);
      return true;
    }

    solveHeroTwoBoneArm(runtime, sideName, targetWorld, poleWorld, weight = 0.78) {
      const mesh = runtime?.mesh;
      const bones = runtime?.bones || {};
      const upper = bones[`${sideName}UpperArm`];
      const forearm = bones[`${sideName}ForeArm`];
      const hand = bones[`${sideName}Hand`];
      if (!mesh || !this.THREE || !upper || !forearm || !hand || !targetWorld || !poleWorld) return null;
      const THREE = this.THREE;
      [upper, forearm, hand].forEach((bone) => {
        bone.userData ||= {};
        bone.userData.hhHeroIkBindQuaternion ||= bone.quaternion.clone();
      });
      mesh.updateMatrixWorld(true);
      const rootWorld = upper.getWorldPosition(new THREE.Vector3());
      const elbowWorld = forearm.getWorldPosition(new THREE.Vector3());
      const wristWorld = hand.getWorldPosition(new THREE.Vector3());
      const upperLength = rootWorld.distanceTo(elbowWorld);
      const forearmLength = elbowWorld.distanceTo(wristWorld);
      if (upperLength < 1e-4 || forearmLength < 1e-4) return null;

      const targetVector = targetWorld.clone().sub(rootWorld);
      let requestedDistance = targetVector.length();
      if (requestedDistance < 1e-5) {
        targetVector.copy(wristWorld).sub(rootWorld);
        requestedDistance = targetVector.length();
      }
      if (requestedDistance < 1e-5) return null;
      const targetDirection = targetVector.multiplyScalar(1 / requestedDistance);
      const shortestSegment = Math.min(upperLength, forearmLength);
      const minimumReach = Math.max(0.001, Math.abs(upperLength - forearmLength) + shortestSegment * 0.08);
      const maximumReach = Math.max(minimumReach + 0.001, (upperLength + forearmLength) * 0.985);
      const solvedDistance = clamp(requestedDistance, minimumReach, maximumReach);
      const solvedTarget = rootWorld.clone().addScaledVector(targetDirection, solvedDistance);

      const poleDirection = poleWorld.clone().sub(rootWorld);
      poleDirection.addScaledVector(targetDirection, -poleDirection.dot(targetDirection));
      if (poleDirection.lengthSq() < 1e-8) {
        poleDirection.copy(elbowWorld).sub(rootWorld);
        poleDirection.addScaledVector(targetDirection, -poleDirection.dot(targetDirection));
      }
      if (poleDirection.lengthSq() < 1e-8) {
        const anatomicalSide = Math.sign(mesh.worldToLocal(rootWorld.clone()).x) || (sideName === "left" ? -1 : 1);
        poleDirection.set(anatomicalSide, 0, 0).transformDirection(mesh.matrixWorld);
        poleDirection.addScaledVector(targetDirection, -poleDirection.dot(targetDirection));
      }
      if (poleDirection.lengthSq() < 1e-8) {
        const fallbackAxis = Math.abs(targetDirection.y) < 0.92
          ? new THREE.Vector3(0, 1, 0)
          : new THREE.Vector3(0, 0, 1);
        poleDirection.crossVectors(targetDirection, fallbackAxis);
      }
      poleDirection.normalize();

      const elbowAlong = clamp(
        (upperLength * upperLength - forearmLength * forearmLength + solvedDistance * solvedDistance) / (2 * solvedDistance),
        0,
        upperLength
      );
      const elbowHeight = Math.sqrt(Math.max(0, upperLength * upperLength - elbowAlong * elbowAlong));
      const elbowTarget = rootWorld.clone()
        .addScaledVector(targetDirection, elbowAlong)
        .addScaledVector(poleDirection, elbowHeight);
      const safeWeight = clamp(weight, 0, 1);
      this.rotateHeroBoneTowardWorldTarget(upper, forearm, elbowTarget, safeWeight);
      upper.updateWorldMatrix(true, true);
      this.rotateHeroBoneTowardWorldTarget(forearm, hand, solvedTarget, Math.min(1, safeWeight * 1.08));
      forearm.updateWorldMatrix(true, true);

      const handBind = hand.userData.hhHeroIkBindQuaternion;
      if (handBind) hand.quaternion.slerp(handBind, Math.min(1, safeWeight * 0.86));
      hand.updateWorldMatrix(true, true);
      return {
        upperLength,
        forearmLength,
        requestedDistance,
        solvedDistance,
        minimumReach,
        maximumReach,
        clamped: Math.abs(requestedDistance - solvedDistance) > 1e-4
      };
    }

    applyHeroArmIK(runtime, time, motion = "idle", dt = 0.016) {
      const mesh = runtime?.mesh;
      const bones = runtime?.bones || {};
      if (!mesh || !this.THREE || !bones.leftUpperArm || !bones.rightUpperArm || !bones.leftForeArm || !bones.rightForeArm || !bones.leftHand || !bones.rightHand) return false;
      const THREE = this.THREE;
      const locomotion = ["walk", "run", "sprint", "strafe", "climb", "swim"].includes(motion);
      const phase = Math.sin(time * 0.001 * (motion === "sprint" ? 10.8 : motion === "run" || motion === "strafe" ? 8.2 : motion === "walk" ? 5.1 : 1.15));
      const swing = locomotion ? phase * (motion === "sprint" ? 0.16 : motion === "walk" ? 0.08 : 0.12) : 0;
      const combat = Boolean(this.characterAction?.name && ["attack1", "attack2", "attack3", "skill", "ultimate"].includes(this.characterAction.name));
      mesh.updateMatrixWorld(true);
      const worldToLocal = (vector) => mesh.worldToLocal(vector.clone());
      const localToWorld = (vector) => vector.applyMatrix4(mesh.matrixWorld);
      const solutions = {};
      [["left", -1, swing], ["right", 1, -swing]].forEach(([sideName, side, armSwing]) => {
        const upper = bones[`${sideName}UpperArm`];
        const forearm = bones[`${sideName}ForeArm`];
        const hand = bones[`${sideName}Hand`];
        if (!upper || !forearm || !hand) return;
        const rootWorld = upper.getWorldPosition(new THREE.Vector3());
        const elbowWorld = forearm.getWorldPosition(new THREE.Vector3());
        const wristWorld = hand.getWorldPosition(new THREE.Vector3());
        const reach = Math.max(0.001, rootWorld.distanceTo(elbowWorld) + elbowWorld.distanceTo(wristWorld));
        const rootLocal = worldToLocal(rootWorld);
        const anatomicalSide = Math.sign(rootLocal.x) || side;
        const handLocal = rootLocal.clone().add(new THREE.Vector3(
          anatomicalSide * reach * (combat ? 0.32 : 0.12),
          -reach * (combat ? 0.67 : 0.965),
          reach * (0.025 + armSwing * 0.62)
        ));
        const poleLocal = rootLocal.clone().add(new THREE.Vector3(
          anatomicalSide * reach * (combat ? 0.46 : 0.16),
          -reach * (combat ? 0.26 : 0.46),
          reach * (combat ? 0.42 : 0.12)
        ));
        const ikWeight = combat ? 0.92 : locomotion ? 0.86 : 1;
        solutions[sideName] = this.solveHeroTwoBoneArm(
          runtime,
          sideName,
          localToWorld(handLocal),
          localToWorld(poleLocal),
          ikWeight
        );

        const fingerRoots = ["Thumb", "Index", "Middle", "Ring", "Pinky"]
          .map((finger) => bones[`${sideName}${finger}`])
          .filter(Boolean);
        fingerRoots.forEach((rootBone, fingerIndex) => {
          const relaxedCurl = [0.04, 0.065, 0.08, 0.095, 0.105][fingerIndex] || 0.065;
          const actionCurl = [0.065, 0.115, 0.14, 0.16, 0.175][fingerIndex] || 0.115;
          const curl = combat ? actionCurl : relaxedCurl;
          let jointIndex = 0;
          rootBone.traverse?.((fingerBone) => {
            if (!fingerBone.isBone) return;
            fingerBone.userData ||= {};
            fingerBone.userData.hhHeroFingerBase ||= fingerBone.quaternion.clone();
            const base = fingerBone.userData.hhHeroFingerBase;
            const hasBoneChild = fingerBone.children?.some((child) => child.isBone);
            const jointCurl = hasBoneChild ? curl * (0.78 + Math.min(jointIndex, 2) * 0.13) : 0;
            const offset = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), jointCurl);
            const target = base.clone().multiply(offset);
            fingerBone.quaternion.slerp(target, ikWeight * 0.76);
            jointIndex += 1;
          });
        });
      });
      if (!runtime.armIkDebugAt || time - runtime.armIkDebugAt > 500) {
        const point = (bone) => {
          if (!bone) return null;
          const value = new THREE.Vector3();
          bone.getWorldPosition(value);
          return { x: Number(value.x.toFixed(3)), y: Number(value.y.toFixed(3)), z: Number(value.z.toFixed(3)) };
        };
        this.root.dataset.heroArmDebug = JSON.stringify({
          leftShoulder: point(bones.leftShoulder || bones.leftUpperArm.parent),
          rightShoulder: point(bones.rightShoulder || bones.rightUpperArm.parent),
          leftElbow: point(bones.leftForeArm),
          rightElbow: point(bones.rightForeArm),
          leftHand: point(bones.leftHand),
          rightHand: point(bones.rightHand)
        });
        runtime.armIkDebugAt = time;
      }
      const solvedArms = Object.values(solutions).filter(Boolean);
      runtime.armIk = {
        enabled: solvedArms.length > 0,
        solver: "analytic-two-bone",
        elbowPole: "character-local-out-forward",
        wristAlignment: "bind-local",
        clampedTargets: solvedArms.filter((solution) => solution.clamped).length,
        maximumReach: solvedArms.length ? Math.max(...solvedArms.map((solution) => solution.maximumReach)) : 0,
        updatedAt: time
      };
      return runtime.armIk.enabled;
    }

    applyProceduralRigMotion(runtime, time, motion = "idle", dt = 0.016) {
      if (!runtime || runtime.mixer) return false;
      const bones = runtime.bones || {};
      const required = [bones.leftUpperArm, bones.rightUpperArm, bones.leftUpLeg, bones.rightUpLeg].filter(Boolean);
      if (required.length < 4) return false;
      const capture = (bone) => {
        if (!bone) return null;
        bone.userData ||= {};
        bone.userData.hhRigMotionBase ||= {
          x: bone.rotation.x,
          y: bone.rotation.y,
          z: bone.rotation.z
        };
        return bone.userData.hhRigMotionBase;
      };
      const blend = 1 - Math.exp(-Math.max(0.001, dt) * 9);
      const setRotation = (bone, offset = {}) => {
        const base = capture(bone);
        if (!bone || !base) return;
        ["x", "y", "z"].forEach((axis) => {
          const target = base[axis] + Number(offset[axis] || 0);
          bone.rotation[axis] += (target - bone.rotation[axis]) * blend;
        });
      };
      const locomotion = ["walk", "run", "sprint", "strafe", "climb", "swim"].includes(motion);
      const cadence = motion === "sprint" ? 10.8 : motion === "run" || motion === "strafe" ? 8.2 : motion === "walk" ? 5.1 : 1.15;
      const gait = Math.sin(time * 0.001 * cadence);
      const stride = locomotion ? gait * (motion === "sprint" ? 0.62 : motion === "walk" ? 0.3 : 0.46) : 0;
      const breathing = Math.sin(time * 0.00125) * 0.022;
      this.applyHeroArmIK(runtime, time, motion, dt);
      setRotation(bones.leftUpLeg, { x: stride });
      setRotation(bones.rightUpLeg, { x: -stride });
      setRotation(bones.leftLeg, { x: locomotion ? Math.max(0, -stride) * 0.48 : 0 });
      setRotation(bones.rightLeg, { x: locomotion ? Math.max(0, stride) * 0.48 : 0 });
      setRotation(bones.spine, { x: motion === "sprint" ? -0.09 : breathing * 0.22, z: motion === "strafe" ? gait * 0.06 : 0 });
      setRotation(bones.chest, { x: breathing * 0.35 });
      setRotation(bones.head, { y: Math.sin(time * 0.00055) * 0.045, x: Math.sin(time * 0.0008) * 0.012 });
      runtime.state = motion;
      runtime.proceduralRig = true;
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
      const isMoving = Boolean(input?.active);
      if (isMoving !== this.motionState.wasMoving) {
        this.motionState.wasMoving = isMoving;
        this.motionState.movementChangedAt = time;
      }
      const transitionAge = time - Number(this.motionState.movementChangedAt || 0);
      if (transitionAge < 180) return isMoving ? "start" : "stop";
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
          Object.entries(dictionary).forEach(([name, index]) => { morphLookup[String(name).toLowerCase()] = index; });
          object.userData ||= {};
          object.userData.hhMorphLookup = morphLookup;
          runtime?.morphLookup?.set(object, morphLookup);
        }
        Object.entries(values).forEach(([name, raw]) => {
          const aliases = [name, `ARKit_${name}`, `AR_${name}`, name.replace(/left$/i, "_L").replace(/right$/i, "_R")];
          const index = aliases.map((alias) => morphLookup[alias.toLowerCase()]).find(Number.isInteger);
          if (!Number.isInteger(index) || index >= influences.length) return;
          influences[index] += (clamp(raw, 0, 1) - influences[index]) * 0.42;
          applied += 1;
        });
      });
      return applied;
    }

    resetCharacterFace(mesh, { morphs = true } = {}) {
      if (!mesh) return;
      const faceChannels = new Set(MEDIAPIPE_FACE_CHANNELS.map((channel) => channel.toLowerCase()));
      if (morphs) {
        mesh.traverse?.((object) => {
          const dictionary = object.morphTargetDictionary;
          const influences = object.morphTargetInfluences;
          if (!dictionary || !influences) return;
          Object.entries(dictionary).forEach(([name, index]) => {
            const normalized = String(name)
              .replace(/^ARKit_/i, "")
              .replace(/^AR_/i, "")
              .replace(/_L$/i, "Left")
              .replace(/_R$/i, "Right")
              .toLowerCase();
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

    blendFacialLayers(layers = []) {
      const blended = Object.fromEntries(MEDIAPIPE_FACE_CHANNELS.map((channel) => [channel, 0]));
      layers.filter((layer) => layer?.values && layer.weight > 0).forEach((layer) => {
        Object.entries(layer.values).forEach(([channel, raw]) => {
          if (!(channel in blended)) return;
          const value = clamp(Number(raw) * clamp(layer.weight, 0, 1), 0, 1);
          blended[channel] = clamp(blended[channel] + value * (1 - blended[channel]), 0, 1);
        });
      });
      return blended;
    }

    applyFacialCorrectives(mesh, values = {}) {
      const correctiveValues = {
        correctiveSmile: Math.max(values.mouthSmileLeft || 0, values.mouthSmileRight || 0) * Math.max(values.cheekSquintLeft || 0, values.cheekSquintRight || 0),
        correctiveJawOpen: Math.max(0, (values.jawOpen || 0) - 0.55) / 0.45,
        correctiveLipSeal: (values.mouthClose || 0) * Math.max(values.mouthPressLeft || 0, values.mouthPressRight || 0),
        correctiveEyeSquint: Math.max(values.eyeSquintLeft || 0, values.eyeSquintRight || 0),
        correctiveNeck: Math.max(values.jawOpen || 0, values.mouthStretchLeft || 0, values.mouthStretchRight || 0) * 0.55
      };
      mesh?.traverse?.((object) => {
        if (!object.morphTargetDictionary || !object.morphTargetInfluences) return;
        const lookup = Object.fromEntries(Object.entries(object.morphTargetDictionary).map(([name, index]) => [String(name).replace(/[._\-\s]/g, "").toLowerCase(), index]));
        Object.entries(correctiveValues).forEach(([name, raw]) => {
          const index = lookup[name.toLowerCase()];
          if (!Number.isInteger(index)) return;
          object.morphTargetInfluences[index] += (clamp(raw, 0, 1) - object.morphTargetInfluences[index]) * 0.36;
        });
      });
      mesh.userData.facialCorrectives = correctiveValues;
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
        saccadeY: 0
      };
      const pilotFresh = this.facePilot.status === "running" && time - this.facePilot.lastResultAt < 320;
      const pilot = pilotFresh ? this.facePilot.blendshapes : null;
      const previewFresh = this.facePreview?.values && time < this.facePreview.until;
      const talkVisemeNames = ["A", "E", "O", "MBP", "I", "U", "L"];
      const talkViseme = motion === "talk"
        ? CHARACTER_VISEMES[talkVisemeNames[Math.floor(time / 145) % talkVisemeNames.length]]
        : null;
      const lowHealth = 1 - clamp(this.state.player.health / Math.max(1, this.state.player.maxHealth), 0, 1);
      const emotionWeight = Number(mesh.userData?.voiceDNA?.emotion || 0.58);
      const emotion = motion === "hit" || motion === "defeated"
        ? CHARACTER_EXPRESSION_PRESETS.pain
        : this.lockedTargetId
          ? CHARACTER_EXPRESSION_PRESETS.angry
          : lowHealth > 0.6
            ? CHARACTER_EXPRESSION_PRESETS.sad
            : null;
      const drivenFace = this.blendFacialLayers([
        { values: pilot, weight: pilot ? 1 : 0 },
        { values: previewFresh ? this.facePreview.values : null, weight: previewFresh ? 1 : 0 },
        { values: talkViseme, weight: talkViseme ? 0.9 : 0 },
        { values: emotion, weight: emotion ? emotionWeight : 0 }
      ]);
      const hasDrivenFace = pilot || previewFresh || talkViseme || emotion;
      if (!hasDrivenFace && time >= faceState.nextBlinkAt && !faceState.blinkStartedAt) {
        faceState.blinkStartedAt = time;
        faceState.nextBlinkAt = time + 1900 + Math.random() * 4200;
      }
      const blinkElapsed = faceState.blinkStartedAt ? time - faceState.blinkStartedAt : -1;
      const blink = hasDrivenFace
        ? Math.max(drivenFace.eyeBlinkLeft || 0, drivenFace.eyeBlinkRight || 0)
        : blinkElapsed >= 0 && blinkElapsed < 180
          ? Math.sin((blinkElapsed / 180) * Math.PI)
          : 0;
      if (blinkElapsed >= 180) faceState.blinkStartedAt = 0;
      const smile = hasDrivenFace
        ? ((drivenFace.mouthSmileLeft || 0) + (drivenFace.mouthSmileRight || 0)) * 0.5
        : motion === "idle" ? 0.08 : 0;
      const pain = motion === "hit" || motion === "defeated" ? 0.9 : lowHealth * 0.28;
      const jawOpen = drivenFace?.jawOpen || (["skill", "ultimate"].includes(motion) ? 0.26 : 0);
      const neutralFace = Object.fromEntries(MEDIAPIPE_FACE_CHANNELS.map((channel) => [channel, 0]));
      const faceValues = {
        ...neutralFace,
        ...(hasDrivenFace ? drivenFace : {
          eyeBlinkLeft: blink,
          eyeBlinkRight: blink,
          mouthSmileLeft: smile,
          mouthSmileRight: smile,
          jawOpen,
          browDownLeft: pain,
          browDownRight: pain
        })
      };
      this.applyFaceBlendshapes(mesh, faceValues);
      this.applyBoneFacialFallback(mesh, faceValues);
      this.applyFacialCorrectives(mesh, faceValues);
      if (!parts?.eyes || !parts?.mouth) return;
      if (time >= faceState.nextSaccadeAt) {
        faceState.nextSaccadeAt = time + 420 + Math.random() * 1900;
        faceState.saccadeX = (Math.random() - 0.5) * 0.018;
        faceState.saccadeY = (Math.random() - 0.5) * 0.012;
      }
      parts.eyes.forEach((eye, index) => {
        const pilotBlink = index === 0 ? faceValues.eyeBlinkLeft : faceValues.eyeBlinkRight;
        const value = hasDrivenFace ? pilotBlink || 0 : blink;
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
      const environment = this.worldArtTarget?.snapshot?.zoneId === this.currentZone?.id
        ? this.worldArtTarget.snapshot
        : this.resolveWorldArtState(this.currentZone?.id || "central");
      const precipitation = String(environment.weatherKind || "").toLowerCase();
      const wet = this.isSwimming
        ? 0.9
        : precipitation.includes("rain") || precipitation.includes("tide")
          ? clamp(environment.wetness * environment.weatherStrength, 0, 0.82)
          : 0;
      const snow = precipitation.includes("snow") ? clamp(environment.weatherStrength * 0.42, 0, 0.42) : 0;
      const heat = precipitation.includes("heat") || precipitation.includes("ember") || precipitation.includes("ash")
        ? clamp(environment.weatherStrength * 0.36, 0, 0.42)
        : 0;
      const exertion = 1 - clamp(this.state.player.stamina / Math.max(1, this.state.player.maxStamina), 0, 1);
      const injury = 1 - clamp(this.state.player.health / Math.max(1, this.state.player.maxHealth), 0, 1);
      const sweat = clamp(exertion * 0.72 + wet * 0.55, 0, 1);
      const dirt = clamp((this.currentZone?.id === "crimson" ? 0.28 : this.currentZone?.id === "void" ? 0.16 : 0.04) + injury * 0.12, 0, 0.5);
      const burn = clamp(heat * 0.74 + (this.state.player.status?.burn ? 0.5 : 0), 0, 1);
      const blood = clamp(injury * 0.52, 0, 0.58);
      const recipe = this.state.appearance?.recipes?.[this.state.roster.activeId];
      if (recipe?.evolution && time - this.lastEvolutionUpdateAt > 5000) {
        recipe.evolution.persistentScars = clamp(Math.max(recipe.evolution.persistentScars, injury > 0.72 ? injury * 0.42 : 0, burn * 0.35), 0, 1);
        recipe.evolution.clothingDamage = clamp(Math.max(recipe.evolution.clothingDamage, injury * 0.32 + burn * 0.28), 0, 1);
        recipe.evolution.fatigueMemory += (exertion - recipe.evolution.fatigueMemory) * 0.08;
        recipe.evolution.auraPower = clamp(this.state.player.ultimate / 100, 0, 1);
        recipe.evolution.tattooResponse = clamp((recipe.decals?.tattoos || 0) * recipe.evolution.auraPower, 0, 1);
        recipe.updatedAt = nowIso();
        mesh.userData.evolution = { ...recipe.evolution };
        this.lastEvolutionUpdateAt = time;
      }
      const evolution = recipe?.evolution || mesh.userData.evolution || { persistentScars: 0, clothingDamage: 0, fatigueMemory: 0, auraPower: 0, tattooResponse: 0 };
      this.restoreCharacterMaterialState(mesh, 0.72);
      mesh.traverse?.((object) => {
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        materials.filter(Boolean).forEach((material) => {
          if (!("roughness" in material)) return;
          material.userData ||= {};
          material.userData.baseRoughness ??= material.roughness;
          material.userData.baseClearcoat ??= material.clearcoat || 0;
          material.userData.baseEmissiveIntensity ??= material.emissiveIntensity || 0;
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
              material.color.lerp(new this.THREE.Color(0xb7464e), clamp(blood * 0.1 + exertion * 0.035 + evolution.persistentScars * 0.04, 0, 0.16));
              if (material.emissive) {
                material.emissive.set(evolution.tattooResponse > 0.1 ? 0x5feeff : 0x7a1f26);
                material.emissiveIntensity = Math.max(material.userData.baseEmissiveIntensity, clamp(exertion * 0.014 + burn * 0.025 + evolution.tattooResponse * 0.1, 0, 0.14));
              }
            } else if (material.userData.materialRole === "outfit") {
              material.color.lerp(new this.THREE.Color(0x44382f), dirt * 0.22 + evolution.clothingDamage * 0.16);
              if (snow) material.color.lerp(new this.THREE.Color(0xe8f6ff), snow * 0.16);
              material.roughness = clamp(material.roughness + evolution.clothingDamage * 0.14, 0.08, 1);
            } else if (material.userData.materialRole === "hair" || material.userData.materialRole === "hair-card") {
              material.roughness = clamp(material.roughness - wet * 0.18 + snow * 0.22, 0.08, 1);
              if (snow && material.color) material.color.lerp(new this.THREE.Color(0xe8f6ff), snow * 0.12);
            }
          }
        });
      });
      mesh.userData.surfaceState = { wet, snow, heat, sweat, dirt, blood, burn, wounds: injury, scars: evolution.persistentScars, clothingDamage: evolution.clothingDamage, aura: evolution.auraPower, tattooResponse: evolution.tattooResponse, updatedAt: time };
      this.lastSurfaceUpdateAt = time;
    }

    updateCharacterLod(mesh, distance = 0) {
      if (!mesh) return;
      const tier = "hero";
      const runtime = mesh.userData.characterRuntime;
      if (runtime) {
        runtime.updateHz = CHARACTER_MODEL_TIERS.hero.updateHz;
        runtime.faceChannelBudget = CHARACTER_MODEL_TIERS.hero.face;
      }
      if (mesh.userData.modelTier === tier) return;
      const lodVariants = mesh.userData.lodVariants || runtime?.lodVariants || {};
      const allVariants = new Set([...(lodVariants.hero || [])]);
      allVariants.forEach((object) => { object.visible = false; });
      const target = lodVariants.hero || [];
      target.forEach((object) => { object.visible = true; });
      (lodVariants.heroDetails || []).forEach((object) => { object.visible = true; });
      (lodVariants.attachments || []).forEach((object) => { object.visible = true; });
      mesh.userData.modelTier = tier;
      mesh.traverse?.((object) => {
        if (!object.isMesh && !object.isSkinnedMesh) return;
        object.castShadow = object.visible;
      });
      this.syncCharacterModuleVisibility(mesh, tier);
    }

    syncCharacterModuleVisibility(mesh, tier = mesh?.userData?.modelTier || "hero") {
      const parts = mesh?.userData?.parts;
      const recipe = mesh?.userData?.appearance;
      if (!parts || !recipe) return;
      const detailed = true;
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
      if (!runtime || !this.state.settings.secondaryMotion) return;
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

    applyFootContactIK(runtime, phase, strength = 1) {
      if (!runtime || !this.state.settings.naturalMotion) return;
      const leftFoot = runtime.bones?.leftFoot;
      const rightFoot = runtime.bones?.rightFoot;
      [[leftFoot, phase], [rightFoot, -phase]].forEach(([foot, wave]) => {
        if (!foot) return;
        foot.userData ||= {};
        foot.userData.hhFootBase ??= { x: foot.rotation.x, z: foot.rotation.z };
        const base = foot.userData.hhFootBase;
        const plant = clamp(1 - Math.max(0, wave) * 1.8, 0, 1);
        let slopeX = 0;
        let slopeZ = 0;
        let contactDistance = null;
        if (this.THREE && this.groundMesh && runtime.mesh?.visible && plant > 0.45) {
          this.footRaycaster ||= new this.THREE.Raycaster();
          const origin = foot.getWorldPosition(new this.THREE.Vector3());
          origin.y += 0.34;
          this.footRaycaster.set(origin, new this.THREE.Vector3(0, -1, 0));
          this.footRaycaster.far = 0.9;
          const hit = this.footRaycaster.intersectObject(this.groundMesh, false)[0];
          if (hit?.face?.normal) {
            const normal = hit.face.normal.clone().transformDirection(this.groundMesh.matrixWorld);
            slopeX = Math.atan2(normal.z, Math.max(0.001, normal.y));
            slopeZ = -Math.atan2(normal.x, Math.max(0.001, normal.y));
            contactDistance = hit.distance;
          }
        }
        foot.rotation.x += ((base.x + slopeX * plant - wave * 0.055 * strength) - foot.rotation.x) * (0.12 + plant * 0.12);
        foot.rotation.z += ((base.z + slopeZ * plant) - foot.rotation.z) * 0.18;
        runtime.footLock[foot === leftFoot ? "left" : "right"] = { plant, contactDistance, grounded: contactDistance !== null };
      });
      runtime.ikState = {
        foot: "terrain-raycast",
        hand: runtime.bones?.rightHand ? "weapon-socket" : "unavailable",
        lookAt: runtime.bones?.head ? "active" : "unavailable",
        updatedAt: performance.now()
      };
    }

    applyUpperBodyIK(runtime, dt, { combat = false } = {}) {
      if (!runtime || !this.state.settings.naturalMotion) return;
      const head = runtime.bones?.head;
      const chest = runtime.bones?.chest;
      const rightHand = runtime.bones?.rightHand;
      const targetObject = this.lockedTargetId
        ? this.enemies.get(this.lockedTargetId)
        : this.nearby?.object || null;
      const targetPosition = targetObject?.getWorldPosition?.(new this.THREE.Vector3());
      const actorPosition = runtime.mesh?.getWorldPosition?.(new this.THREE.Vector3());
      let yaw = 0;
      let pitch = 0;
      let weight = 0.18;
      if (targetPosition && actorPosition) {
        const dx = targetPosition.x - actorPosition.x;
        const dz = targetPosition.z - actorPosition.z;
        const dy = targetPosition.y - actorPosition.y;
        const facing = runtime.mesh.rotation.y || 0;
        yaw = Math.atan2(dx, dz) - facing;
        yaw = Math.atan2(Math.sin(yaw), Math.cos(yaw));
        pitch = -Math.atan2(dy, Math.max(0.1, Math.hypot(dx, dz)));
        weight = combat ? 0.72 : 0.42;
        runtime.gazeTarget = { type: combat ? "combat" : "interaction", id: this.lockedTargetId || this.nearby?.id || "", yaw, pitch, weight };
      } else {
        const cameraDelta = Math.atan2(Math.sin(this.cameraYaw - (runtime.mesh.rotation.y || 0)), Math.cos(this.cameraYaw - (runtime.mesh.rotation.y || 0)));
        yaw = cameraDelta * 0.24;
        runtime.gazeTarget = { type: "camera", id: "", yaw, pitch: 0, weight };
      }
      const damp = 1 - Math.exp(-Math.max(0.001, dt) * 9);
      [[head, clamp(yaw, -0.62, 0.62) * weight, clamp(pitch, -0.3, 0.3) * weight], [chest, clamp(yaw, -0.28, 0.28) * weight * 0.42, clamp(pitch, -0.16, 0.16) * weight * 0.3]].forEach(([bone, targetYaw, targetPitch]) => {
        if (!bone) return;
        bone.userData ||= {};
        bone.userData.hhLookBase ||= { x: bone.rotation.x, y: bone.rotation.y };
        bone.rotation.y += ((bone.userData.hhLookBase.y + targetYaw) - bone.rotation.y) * damp;
        bone.rotation.x += ((bone.userData.hhLookBase.x + targetPitch) - bone.rotation.x) * damp;
      });
      runtime.ikState ||= {};
      runtime.ikState.hand = runtime.armIk?.enabled
        ? "two-bone-arm-ik"
        : rightHand && runtime.mesh?.userData?.parts?.weaponAnchor
          ? "weapon-socket-locked"
          : "unavailable";
      runtime.ikState.lookAt = head ? "gaze-target-active" : "unavailable";
      runtime.ikState.aimOffset = combat && chest ? "upper-body-additive" : "idle";
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
      if (file.size > CHARACTER_IMPORT_LIMITS.fileBytes) return this.toast("Model vượt giới hạn kiểm tra 32 MB.", "error");
      this.characterImporting = true;
      this.toast("Đang kiểm tra cục bộ skeleton, texture và morph; Hero Prime sẽ không bị thay thế.");
      let dracoLoader = null;
      let ktx2Loader = null;
      let inspectedScene = null;
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
        inspectedScene = gltf.scene;
        const report = this.buildCharacterQaReport(gltf.scene, gltf.animations || [], file.size);
        const validation = validateCharacterAsset(report);
        this.lastCharacterQa = { ...report, ...validation, sourceName: file.name, checkedAt: nowIso() };
        if (!validation.valid) {
          throw new Error(validation.errors.join(" "));
        }
        const warning = validation.warnings.length ? ` · ${validation.warnings.length} cảnh báo` : "";
        this.toast(`Đã kiểm tra ${file.name} · ${validation.assetClassLabel} · Hero gate ${validation.heroScore}% · QA ${validation.score}/100${warning}. Hero Prime vẫn là model duy nhất.`, "success");
        this.renderCurrentPanel();
      } catch (error) {
        this.toast(`Không kiểm tra được GLB: ${error?.message || "file không hợp lệ"}`, "error");
      } finally {
        if (inspectedScene) this.disposeCharacterObject(inspectedScene);
        try { dracoLoader?.dispose?.(); } catch {}
        try { ktx2Loader?.dispose?.(); } catch {}
        this.characterImporting = false;
      }
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
      const canDetectFace = this.state.settings.facialAnimation;
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

    createPlayerWeapon(profile) {
      const THREE = this.THREE;
      const weapon = new THREE.Group();
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
      const blade = new THREE.Mesh(
        new THREE.BoxGeometry(0.09, profile.id === "sol" ? 1.75 : 1.52, 0.18),
        weaponSurface
      );
      blade.position.y = 0.45;
      weapon.add(blade);
      const guardMaterial = this.state.settings.renderStyle === "anime"
        ? new THREE.MeshToonMaterial({ color: profile.accent, emissive: profile.accent, emissiveIntensity: 0.55, gradientMap: this.toonGradient })
        : new (THREE.MeshPhysicalMaterial || THREE.MeshStandardMaterial)({ color: profile.accent, emissive: profile.accent, emissiveIntensity: 0.34, roughness: 0.22, metalness: 0.72, clearcoat: 0.58 });
      const guard = new THREE.Mesh(
        new THREE.BoxGeometry(0.58, 0.09, 0.14),
        guardMaterial
      );
      guard.position.y = -0.31;
      weapon.add(guard);
      weapon.rotation.z = -0.28;
      return weapon;
    }

    createActors() {
      CHARACTER_ORDER.forEach((id) => {
        const profile = CHARACTERS[id];
        const mesh = this.createPhotorealCharacterModel(profile, 1);
        const weapon = this.createPlayerWeapon(profile);
        mesh.userData.parts.weaponAnchor.add(weapon);
        mesh.userData.lodVariants.attachments = [weapon];
        weapon.visible = true;
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
      const scale = profile.boss ? 2.25 : type === "forge-hound" ? 1.15 : 1;
      const group = new THREE.Group();
      const material = new THREE.MeshToonMaterial({
        color: new THREE.Color(profile.color).multiplyScalar(0.55),
        emissive: new THREE.Color(profile.color),
        emissiveIntensity: profile.boss ? 0.7 : 0.35,
        gradientMap: this.toonGradient
      });
      const body = new THREE.Mesh(new THREE.IcosahedronGeometry(0.88 * scale, 1), material);
      body.position.y = 1.6 * scale;
      body.castShadow = true;
      group.add(body);
      const eye = new THREE.Mesh(
        new THREE.SphereGeometry(0.19 * scale, 12, 8),
        new THREE.MeshBasicMaterial({ color: 0xffffff })
      );
      eye.position.set(0, 1.68 * scale, 0.78 * scale);
      eye.userData.weakPoint = Boolean(profile.boss);
      if (profile.boss) eye.visible = false;
      group.add(eye);
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(1.18 * scale, 0.055 * scale, 8, 36),
        new THREE.MeshBasicMaterial({ color: profile.color, transparent: true, opacity: 0.65 })
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
      const lift = Number(mesh.userData?.gameplayVisualLift || 0);
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
      player.name = String(player.name || activeProfile.name).replace(/[<>{}[\]\\]/g, "").slice(0, 40) || activeProfile.name;
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
      this.currentZone = this.zoneAt(player.x, player.z);
      this.setElement(this.state.player.element, false);
      this.refreshWorldStateVisuals();
      this.updateCamera(true);
      this.reconcileStoryObjective();
    }

    refreshWorldStateVisuals() {
      if (!this.world) return;
      this.syncStoryEnvironmentGroups();
      this.applyBiomeVisualState(this.currentZone);
      if (this.weatherField) this.updateWeatherAppearance();
    }

    listen(target, event, handler, options) {
      target?.addEventListener?.(event, handler, options);
      this.cleanup.push(() => target?.removeEventListener?.(event, handler, options));
    }

    bindShellEvents() {
      this.listen(this.root, "click", (event) => {
        const storyAction = event.target.closest("[data-story-action]");
        if (storyAction) {
          this.handleStoryOverlayAction(storyAction.dataset.storyAction, storyAction.dataset);
          return;
        }
        const genesisStep = event.target.closest("[data-genesis-step]");
        if (genesisStep) {
          this.setGenesisStep(genesisStep.dataset.genesisStep);
          return;
        }
        const genesisSlot = event.target.closest("[data-genesis-slot]");
        if (genesisSlot) {
          this.loadCharacterSlot(genesisSlot.dataset.genesisSlot);
          return;
        }
        const genesisGroup = event.target.closest("[data-genesis-group]");
        if (genesisGroup) {
          this.appearanceGroup = genesisGroup.dataset.genesisGroup;
          const group = APPEARANCE_GROUPS.find((item) => item.id === this.appearanceGroup);
          this.appearanceFocus = group?.focus || "body";
          this.cameraDistance = this.appearanceFocus === "head" ? 5.1 : 7.8;
          this.refreshGenesisCreator();
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
            this.fitGenesisCamera(this.genesisActualModel, "body");
          } else if (genesisAction === "focus-head") {
            this.appearanceFocus = "head";
            this.fitGenesisCamera(this.genesisActualModel, "head");
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
            this.saveCharacterSlot();
          } else if (genesisAction === "capture-a") {
            this.setGenesisCompareSlot("a");
          } else if (genesisAction === "capture-b") {
            this.setGenesisCompareSlot("b");
          } else if (genesisAction === "view-a") {
            this.viewGenesisCompareSlot("a");
          } else if (genesisAction === "view-b") {
            this.viewGenesisCompareSlot("b");
          } else if (genesisAction === "previous-step") {
            const index = Math.max(0, GENESIS_STEPS.findIndex((step) => step.id === this.genesisStep));
            this.setGenesisStep(GENESIS_STEPS[Math.max(0, index - 1)].id);
          } else if (genesisAction === "next-step") {
            const index = Math.max(0, GENESIS_STEPS.findIndex((step) => step.id === this.genesisStep));
            this.setGenesisStep(GENESIS_STEPS[Math.min(GENESIS_STEPS.length - 1, index + 1)].id);
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
        const motionPreset = event.target.closest("[data-genesis-motion-preset]");
        if (motionPreset) {
          this.updateCharacterPerformance("motionDNA", "preset", motionPreset.value);
          return;
        }
        const motionDNA = event.target.closest("[data-genesis-motion-dna]");
        if (motionDNA) {
          this.updateCharacterPerformance("motionDNA", motionDNA.dataset.genesisMotionDna, motionDNA.value);
          const output = motionDNA.closest("label")?.querySelector("output");
          if (output && motionDNA.type === "range") output.textContent = String(Math.round(Number(motionDNA.value) * 100));
          return;
        }
        const voiceDNA = event.target.closest("[data-genesis-voice]");
        if (voiceDNA) {
          this.updateCharacterPerformance("voice", voiceDNA.dataset.genesisVoice, voiceDNA.value);
          const output = voiceDNA.closest("label")?.querySelector("output");
          if (output && voiceDNA.type === "range") output.textContent = String(Math.round(Number(voiceDNA.value) * 100));
          return;
        }
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
        const motionPreset = event.target.closest("[data-genesis-motion-preset]");
        const motionDNA = event.target.closest("[data-genesis-motion-dna]");
        const voiceDNA = event.target.closest("[data-genesis-voice]");
        if (motionPreset && !this.appearanceInputStart) this.updateCharacterPerformance("motionDNA", "preset", motionPreset.value);
        if (motionDNA && !this.appearanceInputStart) this.updateCharacterPerformance("motionDNA", motionDNA.dataset.genesisMotionDna, motionDNA.value);
        if (voiceDNA && !this.appearanceInputStart) this.updateCharacterPerformance("voice", voiceDNA.dataset.genesisVoice, voiceDNA.value);
        if (event.target.matches("[data-genesis-morph], [data-genesis-setting], [data-genesis-decal], [data-genesis-surface], [data-genesis-motion-preset], [data-genesis-motion-dna], [data-genesis-voice]")) {
          this.commitAppearanceDraft();
          this.refreshGenesisCreator();
        }
      });
    }

    bindGameEvents() {
      const canvas = this.root.querySelector("[data-har-world]");
      this.listen(root, "keydown", (event) => {
        if (!this.running || this.destroyed) return;
        if (this.genesisActive) return;
        if (this.storyOverlayMode) {
          this.keys.clear();
          if (event.key === "Tab") this.trapStoryFocus(event);
          else if (event.code === "Escape") {
            event.preventDefault();
            if (this.storyOverlayMode !== "prologue") this.closeStoryOverlay();
          }
          return;
        }
        if (/^(INPUT|TEXTAREA|SELECT|BUTTON|A)$/.test(event.target?.tagName || "") || event.target?.isContentEditable) return;
        const handled = [
          "KeyW", "KeyA", "KeyS", "KeyD", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight",
          "Space", "KeyF", "KeyE", "KeyR", "KeyQ", "KeyG", "KeyT", "KeyL", "Escape",
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
          KeyL: "lock"
        };
        if (actions[event.code]) this.performAction(actions[event.code]);
        if (event.code === "Escape") {
          if (!this.root.querySelector("[data-har-dialogue]").hidden) this.closeDialogue();
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
        this.cameraPitch = clamp(this.cameraPitch + (event.clientY - this.pointerStart.y) * 0.0035 * sensitivity, 0.18, 1.05);
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
      this.playerWeapon = this.playerMesh.userData.weapon;
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
      if (runtime) {
        const dna = runtime.motionDNA || mesh.userData.motionDNA || MOTION_DNA_PRESETS.balanced;
        const targetSpeed = moving ? clamp(input?.magnitude || 1, 0, 1) * (sprinting ? 1.35 : 1) : 0;
        const speedResponse = targetSpeed > runtime.motionSpeed
          ? 5 + Number(dna.acceleration || 0.5) * 13
          : 5 + Number(dna.braking || 0.5) * 15;
        runtime.motionSpeed += (targetSpeed - runtime.motionSpeed) * (1 - Math.exp(-dt * speedResponse));
        const wantedDirection = Math.atan2(input?.x || 0, input?.z || 1);
        const deltaDirection = Math.atan2(Math.sin(wantedDirection - runtime.motionDirection), Math.cos(wantedDirection - runtime.motionDirection));
        runtime.motionDirection += deltaDirection * (1 - Math.exp(-dt * (5 + Number(dna.turnResponse || 0.5) * 14)));
        const localX = clamp(input?.x || 0, -1, 1);
        const localZ = clamp(input?.z || 0, -1, 1);
        const blendRate = 1 - Math.exp(-dt * 14);
        const targets = { forward: Math.max(0, localZ), backward: Math.max(0, -localZ), left: Math.max(0, -localX), right: Math.max(0, localX) };
        Object.keys(targets).forEach((key) => { runtime.directionalBlend[key] += (targets[key] - runtime.directionalBlend[key]) * blendRate; });
        runtime.motionWarp = {
          speed: runtime.motionSpeed,
          direction: runtime.motionDirection,
          target: this.lockedTargetId || "",
          mode: this.lockedTargetId ? "combat-facing" : "locomotion-facing",
          enabled: dna.motionWarp !== false,
          rootMotion: dna.rootMotion !== false,
          footLock: this.isGrounded
        };
        runtime.additiveLayers = {
          breathing: clamp(0.22 + (1 - this.state.player.stamina / Math.max(1, this.state.player.maxStamina)) * 0.78, 0, 1),
          fatigue: clamp(1 - this.state.player.stamina / Math.max(1, this.state.player.maxStamina), 0, 1),
          injury: clamp(1 - this.state.player.health / Math.max(1, this.state.player.maxHealth), 0, 1),
          cold: String(this.worldArtTarget?.snapshot?.weatherKind || "").includes("snow") ? 0.65 : 0,
          weapon: this.playerWeapon ? 1 : 0
        };
      }
      if (runtime?.mixer) {
        this.playCharacterClip(runtime, targetAnimation);
        const locomotion = ["walk", "run", "sprint", "strafe", "swim", "climb"].includes(targetAnimation);
        runtime.mixer.timeScale = !locomotion
          ? 1
          : targetAnimation === "sprint"
            ? 1.22
            : targetAnimation === "walk"
              ? clamp(0.58 + (input?.magnitude || 0) * 0.48, 0.58, 0.92)
              : clamp(0.82 + (input?.magnitude || 0) * 0.28, 0.82, 1.1);
        runtime.mixer.update(dt);
        this.applyHeroArmIK(runtime, time, targetAnimation, dt);
      } else if (runtime) {
        this.applyProceduralRigMotion(runtime, time, targetAnimation, dt);
      }

      const strideDNA = Number(runtime?.motionDNA?.stride || 0.5);
      const cadence = (targetAnimation === "sprint"
        ? 11.2
        : targetAnimation === "run" || targetAnimation === "strafe"
          ? 8.1
          : targetAnimation === "walk"
            ? 5.2
            : targetAnimation === "climb"
              ? 4.6
              : 1.15) * (0.88 + strideDNA * 0.24);
      if (runtime) {
        runtime.gaitPhase = (runtime.gaitPhase + dt * cadence * Math.max(0.42, input?.magnitude || 0.42)) % (Math.PI * 2);
      }
      const gaitPhase = runtime?.gaitPhase ?? time * 0.002;
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

      if (parts?.leftLeg && parts?.rightLeg && parts?.leftArm && parts?.rightArm) {
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
      this.applyFootContactIK(runtime, phase, moving && this.isGrounded ? 1 : 0.25);
      this.applyUpperBodyIK(runtime, dt, { combat: Boolean(this.lockedTargetId) || targetAnimation.startsWith("attack") });
      this.updateSecondaryCharacterMotion(runtime, time, {
        moving,
        sprinting,
        direction: runtime?.motionDirection || 0
      });
      this.applyProceduralFacialPerformance(mesh, time, targetAnimation);
      this.updateCharacterSurface(mesh, time);
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
        this.cameraFovTarget = 58;
        this.camera.fov = 58;
        this.camera.updateProjectionMatrix();
        this.renderer.toneMappingExposure = 1.08;
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
      try {
        const dt = Math.min(0.05, Math.max(0.001, (time - this.lastFrameAt) / 1000));
        this.lastFrameAt = time;

        if (this.storyOverlayMode && !this.genesisActive && time - this.lastStoryFrameAt < 250) {
          this.frameHandle = requestAnimationFrame((next) => this.frame(next));
          return;
        }
        if (this.storyOverlayMode) this.lastStoryFrameAt = time;

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
              this.applyHeroArmIK(runtime, time, this.genesisMotion || "idle", dt);
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
            this.updateCamera(false, dt);
            this.renderer.render(this.scene, this.camera);
          }
          this.lastRenderSuccessAt = time;
          if (!this.storyOverlayMode) this.trackFps(time);
          if (!this.storyOverlayMode && time - this.lastUiAt > 120) {
            this.lastUiAt = time;
            this.updateUi(false);
          }
          if (!this.storyOverlayMode && time - this.lastMinimapAt > 180) {
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
      this.cameraPitch = clamp(this.cameraPitch + rightY * 0.025, 0.18, 1.05);
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
      const swimSurface = this.waterSurfaces.find((surface) => (
        !surface.userData?.lava
        && Math.hypot(player.x - surface.position.x, player.z - surface.position.z) < Number(surface.userData?.radius || 0) - 0.9
        && player.y < Number(surface.userData?.baseY || 1.1) + 0.7
      ));
      this.isSwimming = Boolean(swimSurface);
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
        this.progressStoryObjective("enter-zone", { zoneId: zone.id });
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
      const worldMotion = this.state.settings.reduceEffects || this.state.settings.vfxLevel === "static" ? 0 : 1;
      this.worldArtAnimatedObjects.forEach((object, index) => {
        if (!object.visible || !object.parent?.visible) return;
        if (object.userData?.spin) object.rotation.z += dt * object.userData.spin * worldMotion;
        if (!object.userData?.storyMotion || !worldMotion) return;
        if (object.userData.storyBaseY === undefined) object.userData.storyBaseY = object.position.y;
        if (object.userData.storyMotion === "float") {
          object.position.y = object.userData.storyBaseY + Math.sin(time * 0.00125 + index * 0.61) * 0.22;
          object.rotation.y += dt * 0.12;
        } else if (object.userData.storyMotion === "echo") {
          object.position.y = object.userData.storyBaseY + Math.sin(time * 0.0018 + index) * 0.28;
          object.rotation.y -= dt * 0.2;
        }
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
        if (runtime?.mixer) {
          this.playCharacterClip(runtime, moving ? "run" : "idle");
          runtime.mixer.timeScale = moving ? 0.94 : 1;
          runtime.mixer.update(dt);
        }
        const parts = remote.userData.parts;
        if (parts?.leftLeg && parts?.rightLeg) {
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
      if (this.moonDisc) this.moonDisc.position.set(Math.cos(celestialAngle + Math.PI) * 150, Math.sin(celestialAngle + Math.PI) * 110, -82);
      if (this.sunLight) this.sunLight.position.set(
        Math.cos(celestialAngle) * 58,
        Math.max(8, Math.sin(celestialAngle) * 68),
        Math.sin(celestialAngle * 0.7) * 38
      );
      this.worldArtDayColor ||= new this.THREE.Color();
      this.worldArtDayColor.setRGB(
        0.018 + dayAmount * 0.035,
        0.026 + dayAmount * 0.04,
        0.07 + dayAmount * 0.08
      );
      if (this.scene.background?.isColor) this.scene.background.lerp(this.worldArtDayColor, clamp(dt * 2.2, 0, 1));
      this.updateWorldArtTransition(dt, time, dayAmount);
      if (this.auroraVeil) {
        this.auroraVeil.rotation.z += dt * 0.018 * worldMotion;
        this.auroraVeil.material.opacity = (1 - dayAmount) * 0.18 + (this.currentZone.id === "aurora" ? 0.09 : 0.02);
      }
      this.cloudLayers.forEach((cloud) => {
        cloud.rotation.y += dt * 0.006 * worldMotion;
        cloud.position.x += dt * cloud.userData.drift * worldMotion;
        if (cloud.position.x > 115) cloud.position.x = -115;
      });
      this.waterSurfaces.forEach((water, index) => {
        water.position.y = water.userData.baseY + Math.sin(time * 0.0017 + index) * 0.035 * worldMotion;
        water.rotation.z += dt * (water.userData.lava ? 0.035 : -0.012) * worldMotion;
        water.material.emissiveIntensity = water.userData.lava
          ? 1.15 + Math.sin(time * 0.003) * 0.25
          : 0.16 + Math.sin(time * 0.0015) * 0.06;
      });
      this.puzzleNodes.forEach((puzzle) => {
        const core = puzzle.userData.core;
        core.rotation.y += dt * (puzzle.userData.solved ? 1.5 : 0.45);
        core.position.y = 1.8 + Math.sin(time * 0.002 + puzzle.position.x) * 0.18;
      });
      if (time - this.lastStreamingAt > 550) {
        this.lastStreamingAt = time;
        this.updateWorldStreaming();
      }

      if (this.weatherField) {
        this.weatherField.position.set(this.state.player.x, 0, this.state.player.z);
        const positions = this.weatherField.geometry.attributes.position.array;
        const motion = this.weatherField.userData.motion || { x: 0, y: -3.2, z: 0 };
        const motionScale = this.state.settings.reduceEffects || this.state.settings.vfxLevel === "static" ? 0 : 1;
        for (let index = 0; index < positions.length; index += 3) {
          const reverse = this.weatherField.userData.reverseEvery && (index / 3) % this.weatherField.userData.reverseEvery === 0 ? -0.34 : 1;
          positions[index] += dt * motion.x * motionScale;
          positions[index + 1] += dt * motion.y * reverse * motionScale;
          positions[index + 2] += dt * motion.z * motionScale;
          if (positions[index + 1] < 1) positions[index + 1] = 18 + ((index * 17) % 9);
          if (positions[index + 1] > 27) positions[index + 1] = 2 + ((index * 13) % 8);
          if (positions[index] < -28) positions[index] = 28;
          if (positions[index] > 28) positions[index] = -28;
          if (positions[index + 2] < -28) positions[index + 2] = 28;
          if (positions[index + 2] > 28) positions[index + 2] = -28;
        }
        this.weatherField.geometry.attributes.position.needsUpdate = true;
      }
    }

    updateWorldStreaming() {
      const player = this.state.player;
      const reduced = this.state.settings.reduceEffects || this.state.settings.vfxLevel === "static";
      const budget = WORLD_ART_BUDGETS[reduced ? "static" : (this.state.settings.vfxLevel === "cinematic" ? "cinematic" : "balanced")];
      const visibleRadius = budget.activeRadius;
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
      this.storyEnvironmentGroups.forEach((group, zoneId) => {
        const zone = ZONES.find((entry) => entry.id === zoneId);
        if (!zone) return;
        const distance = Math.hypot(player.x - zone.x, player.z - zone.z);
        group.visible = distance <= visibleRadius * 1.12 || zoneId === this.currentZone.id;
      });
      const scratch = this.worldArtScratchPosition || new this.THREE.Vector3();
      this.worldArtScratchPosition = scratch;
      this.worldArtShadowCandidates.forEach((object) => {
        object.getWorldPosition(scratch);
        const distance = Math.hypot(player.x - scratch.x, player.z - scratch.z);
        object.castShadow = Boolean(object.userData.baseCastShadow && this.renderer.shadowMap?.enabled && distance < budget.shadowRadius);
      });
    }

    updateWeatherAppearance() {
      if (!this.weatherField) return;
      this.applyBiomeVisualState(this.currentZone);
      const snapshot = this.resolveWorldArtState(this.currentZone.id);
      const override = this.photoMode ? this.photoSettings.weather : "auto";
      const kind = override === "auto" ? snapshot.weatherKind : override;
      const normalized = String(kind || "").toLowerCase();
      const isClear = normalized.includes("clear") || normalized.includes("silence");
      const isSnow = normalized.includes("snow") || normalized.includes("aurora");
      const isEmber = normalized.includes("ash") || normalized.includes("heat") || normalized.includes("ember");
      const isSpore = normalized.includes("spore");
      const isWind = normalized.includes("wind") || normalized.includes("cloud");
      const isRain = normalized.includes("rain") || normalized.includes("tide");
      const isAbyss = normalized.includes("eclipse") || normalized.includes("probability") || normalized.includes("shard");
      const color = isEmber ? "#ff8a62"
        : isSnow ? "#b8fff1"
          : isSpore ? "#c087ff"
            : isWind ? "#b8e8ff"
              : isRain ? "#62e9ff"
                : isAbyss ? "#ff6ba9"
                  : snapshot.accent;
      const consequenceSeverity = override === "auto" ? snapshot.weatherStrength : 0.58;
      this.root.dataset.weatherConsequence = snapshot.choiceId ? "active" : "default";
      this.root.dataset.precipitation = kind;
      this.weatherField.material.color.set(color);
      const density = clamp(this.state.settings.weatherDensity, 0, 100) / 100;
      this.weatherField.material.opacity = isClear || override === "clear"
        ? 0.035
        : clamp(consequenceSeverity * density, 0.04, 0.92);
      this.weatherField.material.size = isEmber || isAbyss ? 0.34 : isSnow || isRain || isSpore ? 0.24 : 0.18;
      this.weatherField.userData.motion = isEmber
        ? { x: snapshot.wind * 0.35, y: 1.25, z: snapshot.wind * -0.16 }
        : isWind
          ? { x: 6.4 + snapshot.wind * 2.2, y: -0.4, z: 2.1 }
          : isAbyss
            ? { x: snapshot.wind * 1.4, y: 0.62, z: -snapshot.wind * 0.8 }
            : isSpore
              ? { x: snapshot.wind * 0.42, y: 0.18, z: snapshot.wind * 0.28 }
              : { x: snapshot.wind * 0.72, y: isSnow ? -1.4 : -4.6, z: snapshot.wind * 0.22 };
      this.weatherField.userData.reverseEvery = normalized.includes("memory") || normalized.includes("probability") ? 7 : 0;
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
        : Number(this.playerMesh.userData?.gameplayVisualLift || 0);
      const originY = cameraOrigin.y + visualLift;
      const horizontal = Math.cos(this.cameraPitch) * this.cameraDistance;
      let desired = new this.THREE.Vector3(
        cameraOrigin.x + Math.sin(this.cameraYaw) * horizontal,
        originY + 2.2 + Math.sin(this.cameraPitch) * this.cameraDistance,
        cameraOrigin.z + Math.cos(this.cameraYaw) * horizontal
      );
      const focus = new this.THREE.Vector3(cameraOrigin.x, originY + 1.35, cameraOrigin.z);
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
      if (!this.photoMode && !this.genesisActive && this.currentPanel !== "creator") {
        const colliderObjects = this.climbables.map((entry) => entry.object).filter(Boolean);
        if (colliderObjects.length) {
          this.cameraRaycaster ||= new this.THREE.Raycaster();
          const direction = desired.clone().sub(focus);
          const distance = direction.length();
          direction.normalize();
          this.cameraRaycaster.set(focus, direction);
          this.cameraRaycaster.far = distance;
          const hit = this.cameraRaycaster.intersectObjects(colliderObjects, true)[0];
          if (hit && hit.distance < distance) desired = focus.clone().add(direction.multiplyScalar(Math.max(2.2, hit.distance - 0.55)));
        }
      }
      if (this.cameraShake > 0.001 && !this.state.settings.reduceEffects) {
        const intensity = this.cameraShake * clamp(this.state.settings.cameraShake, 0, 100) / 100;
        desired.x += (Math.random() - 0.5) * intensity;
        desired.y += (Math.random() - 0.5) * intensity * 0.55;
        desired.z += (Math.random() - 0.5) * intensity;
        this.cameraShake = Math.max(0, this.cameraShake - dt * 2.8);
      }
      if (immediate) this.camera.position.copy(desired);
      else this.camera.position.lerp(desired, 1 - Math.pow(0.001, dt));
      const locked = this.lockedTargetId ? this.enemies.get(this.lockedTargetId) : null;
      if (locked?.visible && !locked.userData.defeated && !this.photoMode) {
        const targetFocus = locked.position.clone();
        targetFocus.y += 1.2;
        focus.lerp(targetFocus, 0.38);
      }
      this.camera.lookAt(focus);
      if (!this.photoMode) {
        this.cameraFovTarget = this.activeAnimation === "sprint" ? 64 : this.lockedTargetId ? 60 : 58;
        this.camera.fov += (this.cameraFovTarget - this.camera.fov) * (1 - Math.pow(0.015, dt));
        this.camera.updateProjectionMatrix();
      }
    }

    updateCinematicCamera(desired, focus, dt) {
      const cinematic = this.cinematicTarget;
      if (!cinematic || performance.now() >= cinematic.until || !cinematic.object) {
        this.cinematicTarget = null;
        this.root.classList.remove("is-cinematic");
        return desired;
      }
      this.root.classList.add("is-cinematic");
      const targetPosition = cinematic.object.getWorldPosition
        ? cinematic.object.getWorldPosition(new this.THREE.Vector3())
        : cinematic.object.position.clone();
      const progress = clamp((cinematic.until - performance.now()) / 1250, 0, 1);
      const side = cinematic.phase === 3 ? -1 : 1;
      const cinematicPosition = targetPosition.clone().add(new this.THREE.Vector3(6.5 * side, 4.2 + progress * 1.5, 7.2));
      focus.lerp(targetPosition.clone().add(new this.THREE.Vector3(0, 1.4, 0)), 0.65);
      return desired.lerp(cinematicPosition, clamp(dt * 7.5, 0, 0.82));
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
      const cooldowns = { attack: 320, skill: 2600, ultimate: 9500 };
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

      const range = kind === "attack" ? 4.1 : kind === "skill" ? 8 : 12;
      const target = this.findTarget(range);
      const element = this.state.player.element;
      const characterId = this.state.roster.activeId;
      const damageBase = kind === "attack"
        ? 22 + this.combo * 7
        : kind === "skill"
          ? 68 + Number(this.state.skills.plasmaDrive || 0) * 9
          : 155;
      this.setCharacterAction(
        kind === "attack" ? `attack${this.combo || 1}` : kind,
        kind === "ultimate" ? 920 : kind === "skill" ? 680 : 430,
        kind === "ultimate" ? 1.5 : 1
      );
      this.swingAnimation(kind);
      this.spawnPulse(this.state.player.x, this.state.player.y + 1.2, this.state.player.z, ELEMENTS[element].color, kind === "ultimate" ? 1.2 : 0.42, kind === "ultimate" ? 8 : 3.2);
      this.spawnElementBurst(
        this.state.player.x,
        this.state.player.y + 1.1,
        this.state.player.z,
        element,
        kind === "ultimate" ? 2.2 : kind === "skill" ? 1.35 : 0.72
      );
      this.sound(kind);
      this.cameraShake = Math.max(this.cameraShake, kind === "ultimate" ? 0.95 : kind === "skill" ? 0.42 : 0.18);
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

      if (this.authoritative) {
        this.emitInput({ action: kind, targetId: target?.userData?.id || "", power: 1 });
      } else if (target) {
        this.damageTarget(target, damageBase, element, kind);
      }
    }

    swingAnimation(kind) {
      if (!this.playerWeapon) return;
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
      const defeatedZoneId = this.zoneAt(enemy.position.x, enemy.position.z).id;
      this.progressStoryObjective("defeat", { zoneId: defeatedZoneId, archetype: data.archetype, enemyId: data.id, boss: data.boss });
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
      this.storyBeacons.forEach((beacon) => add(beacon, 4.2));
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
          : data.type === "story-beacon"
            ? `G · Khôi phục ${data.name}`
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
      if (data.type === "story-beacon") return this.activateStoryBeacon(target);
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
      this.progressStoryObjective("puzzle", { zoneId: this.zoneAt(puzzle.position.x, puzzle.position.z).id, puzzleId: data.id });
      this.toast(`${data.name} đã cộng hưởng · +70 XP`, "success");
      this.saveProgress("Giải elemental puzzle");
    }

    collectNode(node) {
      if (!node.visible || this.state.collectedNodes.includes(node.userData.id)) return;
      node.visible = false;
      this.state.collectedNodes.push(node.userData.id);
      this.addItem(node.userData.itemId, 1, "Thu thập trong thế giới");
      this.progressQuest("collect", 1, { item: node.userData.itemId });
      this.progressStoryObjective("collect", { zoneId: this.zoneAt(node.position.x, node.position.z).id, nodeId: node.userData.id, itemId: node.userData.itemId });
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
        const remembersMira = this.state.story?.hiddenSignals?.miraErased === true;
        text.textContent = active
          ? "Lõi H đã nhận diện cộng hưởng của bạn. Aurora Vale đang phát tín hiệu cầu cứu; hãy giúp tôi tái lập mạng cổng trước khi Hư Không lan tới thành phố."
          : remembersMira
            ? "Hồ sơ tàu H-07 chỉ có bốn người. Tôi không tìm thấy bất kỳ Navigator nào tên Mira, nhưng vì sao bạn lại biết mật mã cứu nạn đã bị xóa?"
            : "Các cổng đang phản hồi theo tiến trình của bạn. Nếu bị lạc, hãy mở Bản đồ và quay lại checkpoint đã kích hoạt.";
        choices.innerHTML = `
          ${active ? '<button class="har-primary-button" type="button" data-dialogue-action="accept">Tôi sẽ tới Aurora Vale</button>' : ""}
          ${remembersMira ? '<button class="har-primary-button" type="button" data-dialogue-action="mira">Hỏi về nhịp tim thứ năm</button>' : ""}
          <button class="har-secondary-button" type="button" data-dialogue-action="map">Mở bản đồ</button>
          <button class="har-secondary-button" type="button" data-dialogue-action="close">Rời đi</button>`;
      } else {
        name.textContent = "Thợ rèn Kael";
        role.textContent = "Astral Forge";
        text.textContent = "Tôi có thể ghép Mảnh Aurora, Lõi Plasma và Sợi Hư Không thành trang bị thật. Nguyên liệu thiếu sẽ được ghi rõ, không có vật phẩm mẫu.";
        choices.innerHTML = `
          <button class="har-primary-button" type="button" data-dialogue-action="craft">Mở chế tạo</button>
          <button class="har-secondary-button" type="button" data-dialogue-action="close">Để sau</button>`;
      }
      this.recordStoryDialogue(name.textContent, text.textContent, this.currentZone.id);
      choices.onclick = (event) => {
        const action = event.target.closest("[data-dialogue-action]")?.dataset.dialogueAction;
        if (!action) return;
        if (action === "accept") {
          this.progressQuest("talk", 1, { npc: "luma" });
          this.closeDialogue();
        } else if (action === "map") {
          this.closeDialogue();
          this.openPanel("map");
        } else if (action === "craft") {
          this.closeDialogue();
          this.openPanel("craft");
        } else if (action === "mira") {
          const reply = "Không có người thứ năm. Nhưng audit của Core vừa tự xóa một dòng ngay khi tôi nói câu đó. Tôi sẽ ghi lại nghi vấn, không kết luận thay bạn.";
          text.textContent = reply;
          this.state.story.hiddenSignals.lumaDeniesMira = true;
          this.recordStoryDialogue("Navigator Luma", reply, "central");
          this.unlockStoryEcho("central-mira", "Đối chất Navigator Luma");
          this.progressStoryObjective("dialogue", { zoneId: "central", npcId: "luma", eventKey: "luma:mira" });
          this.saveProgress("Hội thoại về Mira");
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

    economyAdjustedRequirements(requirements) {
      const modifier = clamp(this.state.world?.zones?.[this.currentZone.id]?.economyModifier ?? 1, 0.5, 1.5);
      return Object.fromEntries(Object.entries(requirements || {}).map(([id, amount]) => [id, Math.max(1, Math.round(Number(amount || 0) * modifier))]));
    }

    craft(recipeId) {
      const recipe = RECIPES.find((item) => item.id === recipeId);
      if (!recipe) return;
      const requirements = this.economyAdjustedRequirements(recipe.requires);
      if (!this.removeItems(requirements)) {
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
      this.toast(`Đã trang bị ${item.name}.`, "success");
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
      const destinationZone = this.zoneAt(this.state.player.x, this.state.player.z);
      if (destinationZone.id !== this.currentZone.id) {
        this.currentZone = destinationZone;
        const zoneState = this.state.world?.zones?.[destinationZone.id];
        if (zoneState) {
          zoneState.discovered = true;
          zoneState.updatedAt = nowIso();
        }
        this.applyBiomeVisualState(destinationZone);
        this.updateWeatherAppearance();
        this.progressStoryObjective("enter-zone", { zoneId: destinationZone.id });
      }
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
      this.root.querySelector("[data-har-zone]").textContent = this.currentZone.name;
      this.root.querySelector("[data-har-weather]").textContent = this.state.world?.zones?.[this.currentZone.id]?.weatherLabel || this.currentZone.weather;
      const hour = Math.floor(this.state.worldTime);
      const minute = Math.floor((this.state.worldTime % 1) * 60);
      this.root.querySelector("[data-har-time]").textContent = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
      this.root.querySelector("[data-har-fps]").textContent = this.fps ? `${this.fps} FPS · scale ${Math.round(this.renderScale * 100)}%` : "Đang đo";
      this.root.querySelector("[data-har-renderer]").textContent = `${this.rendererBackend === "webgpu" ? "WEBGPU" : "WEBGL2"} · ${this.photorealStatus === "ready" ? "IBL PBR" : "MESH PBR"}`;
      const activeCharacterMesh = this.characterMeshes.get(this.state.roster.activeId);
      const activeCharacterRuntime = this.characterRuntimes.get(this.state.roster.activeId);
      const characterRuntimeLabel = this.root.querySelector("[data-har-character-runtime]");
      if (characterRuntimeLabel) {
        const source = activeCharacterMesh?.userData?.visualMode === "hero-prime-rigged" ? "HERO PRIME" : "HERO ĐANG TẢI";
        characterRuntimeLabel.textContent = `${source} · ${(activeCharacterRuntime?.state || this.activeAnimation || "idle").toUpperCase()}`;
      }
      const worldZone = this.state.world?.zones?.[this.currentZone.id];
      const worldArtState = this.worldArtTarget?.snapshot?.zoneId === this.currentZone.id
        ? this.worldArtTarget.snapshot
        : this.resolveWorldArtState(this.currentZone.id);
      const worldState = this.root.querySelector("[data-har-world-state]");
      if (worldState) {
        worldState.textContent = this.state.world?.activeEvent
          ? "EVENT ACTIVE"
          : worldArtState.choiceId
            ? `${worldArtState.truth.toUpperCase()} · ${worldArtState.choiceId.toUpperCase()}`
            : worldZone?.restored
              ? `${worldArtState.truth.toUpperCase()} · RESTORED`
              : worldZone?.discovered
                ? `${worldArtState.truth.toUpperCase()} · DISCOVERED`
                : `${worldArtState.truth.toUpperCase()} · UNSCANNED`;
        worldState.title = `${worldArtState.landmark} · World Art V${WORLD_ART_VERSION}`;
      }
      this.root.querySelector("[data-har-minimap-label]").textContent = this.currentZone.name;
      const activeQuest = this.activeQuest();
      const activeStoryMission = this.state.story?.prologueCompletedAt
        ? STORY_MISSIONS.find((mission) => ["active", "decision"].includes(this.state.story.missions?.[mission.zoneId]?.status))
        : null;
      const storyMissionState = activeStoryMission ? this.state.story.missions[activeStoryMission.zoneId] : null;
      this.root.querySelector("[data-har-quest-title]").textContent = activeStoryMission?.title || activeQuest?.title || "Hành trình hiện tại đã hoàn tất";
      this.root.querySelector("[data-har-quest-progress]").textContent = activeStoryMission
        ? storyMissionState.status === "decision"
          ? `${activeStoryMission.prompt} · lựa chọn dài hạn`
          : `${activeStoryMission.steps[storyMissionState.progress] || activeStoryMission.summary} · ${storyMissionState.progress}/${activeStoryMission.steps.length}`
        : activeQuest
          ? `${activeQuest.description} · ${this.state.quests[activeQuest.id].progress}/${activeQuest.target}`
          : "Khám phá thế giới và chuẩn bị cho nội dung tiếp theo.";

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
      const values = {
        attack: Math.max(0, 320 - (now - this.lastAttackAt)),
        skill: Math.max(0, 2600 - (now - this.lastSkillAt)),
        ultimate: this.state.player.ultimate >= 100 ? 0 : Math.max(0, 9500 - (now - this.lastUltimateAt)),
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

    trackFps(time) {
      this.fpsFrames += 1;
      const elapsed = time - this.fpsStartedAt;
      if (elapsed < 1000) return;
      this.fps = Math.round((this.fpsFrames * 1000) / elapsed);
      this.fpsFrames = 0;
      this.fpsStartedAt = time;
      if (this.state.settings.quality === "auto" && this.state.settings.dynamicResolution !== false) {
        if (this.fps < 42 && this.renderScale > 0.62) this.renderScale = Math.max(0.62, this.renderScale - 0.1);
        else if (this.fps > 57 && this.renderScale < 1) this.renderScale = Math.min(1, this.renderScale + 0.05);
        this.renderer.setPixelRatio(Math.min(2, (root.devicePixelRatio || 1) * this.renderScale));
        if (this.starfield) this.starfield.material.opacity = this.fps < 38 ? 0.35 : 0.8;
        if (this.weatherField) this.weatherField.visible = this.fps >= 30 || this.currentZone.id !== "central";
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
      if (this.currentPanel === "story") {
        this.pendingStoryChoice = null;
        this.pendingStoryEnding = "";
      }
      this.currentPanel = "";
      this.menuPaused = Boolean(this.storyOverlayMode) || this.genesisActive;
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
        story: () => this.renderStoryPanel(),
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
        story: ["Story Constellation", "The Person Who Never Existed", "#ff78d2"],
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
        <div class="har-section har-character-v9-hero"><small>HERO PRIME · FULL QUALITY ONLY · V${CHARACTER_VISUAL_VERSION}</small><h3>Nhân vật duy nhất · gương mặt, da, mắt, tay và chuyển động 60 Hz</h3><p>Bốn thân phận dùng chung một Hero Prime GLB mạnh nhất. Không có model máy yếu, không proxy và không tự hạ LOD; nếu asset lỗi, game dừng ở màn hình Retry để bảo toàn hình ảnh.</p></div>
        <ul class="har-character-list">${CHARACTER_ORDER.map((id, index) => {
          const profile = CHARACTERS[id];
          const member = this.state.roster.members[id] || {};
          const active = id === activeId;
          const runtime = this.characterRuntimes.get(id);
          const asset = this.characterAssetStatus.get(id) || "Web Hero PBR";
          return `<li class="har-character-card ${active ? "is-active" : ""}" style="--character-color:${profile.accent};--portrait-x:${index * 33.333333}%">
            <div class="har-character-card__avatar"><i aria-hidden="true"></i><strong>${profile.short}</strong><span>${ELEMENTS[profile.element].short}</span></div>
            <div><strong>${escapeHtml(profile.name)}</strong><span>${escapeHtml(profile.role)}</span><small>${escapeHtml(profile.description)}</small><small>Lv.${member.level || 1} · ${Math.round(member.health || 100)}/${member.maxHealth || 100} HP · ${ELEMENTS[profile.element].label}</small><small>${escapeHtml(asset)} · ${runtime?.state || "idle"}</small></div>
            <button class="har-chip ${active ? "is-active" : ""}" type="button" data-panel-action="switch-character" data-character="${id}">${active ? "Đang dùng" : `Đổi [${index + 1}]`}</button>
          </li>`;
        }).join("")}</ul>
        <div class="har-section"><h3>Character Pipeline · Hero only</h3><div class="har-character-pipeline">${CHARACTER_PIPELINE.map((item) => `<div><strong>${escapeHtml(item.name)}</strong><span>${escapeHtml(item.role)}</span><small>${escapeHtml(item.id === "three" ? `Runtime V${CHARACTER_VISUAL_VERSION}` : item.state)}</small></div>`).join("")}</div></div>
        <div class="har-section"><h3>Nguồn hình học nhân vật</h3><p>HH Hero Prime là asset duy nhất được tải: ${HERO_CHARACTER_ASSET_URL}. Các catalog, GLB dự phòng và procedural proxy đã bị loại khỏi player pipeline.</p>
          <div class="har-inline-actions"><button class="har-primary-button" type="button" data-panel-action="open-character-creator">Mở Character Creator</button></div>
        </div>`;
    }

    activeAppearanceRecipe() {
      const id = this.state.roster.activeId;
      this.state.appearance ||= { recipes: {}, savedPresets: [], characterSlots: [], versionHistory: [], lastSavedAt: "" };
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
      const gltfActive = mesh?.userData?.visualMode === "hero-prime-rigged";
      const trulyRigged = Boolean(
        gltfActive
        && qa?.skinnedMeshes
        && Number(qa?.skeletonCoverage || 0) >= 0.55
        && runtime?.bones?.hips
        && runtime?.bones?.head
      );
      const capability = `${this.characterAssetStatus.get(id) || "HH Hero Prime"} · ${trulyRigged ? "SkinnedMesh duy nhất" : "đang chờ Hero"}`;
      const lodCapability = "Hero Prime · không LOD thấp";
      const saved = this.state.appearance.savedPresets || [];
      const nativeFaceChannels = Math.min(52, Number(runtime?.facialChannels || 0));
      const dna = encodeCharacterDNA(recipe, id);
      return `
        <div class="har-creator">
          <div class="har-creator__hero">
            <div><small>DIGITAL HUMAN CORE V${CHARACTER_VISUAL_VERSION} · ${escapeHtml(profile.name)}</small><h3>${recipe.style === "human-cinematic" ? "Web Digital Human" : "Anime Realistic"}</h3><p>${escapeHtml(capability)} · collider gameplay giữ cố định để multiplayer công bằng.</p></div>
            <span class="har-chip ${trulyRigged ? "is-active" : ""}">${trulyRigged ? "HERO PRIME" : "HERO ĐANG TẢI"}</span>
          </div>
          <div class="har-character-runtime-grid">
            <div><small>Motion</small><strong>${escapeHtml(runtime?.state || this.activeAnimation || "idle")}</strong><span>${runtime?.clips?.size || 0} clip GLB</span></div>
            <div><small>Skeleton</small><strong>${runtime ? Object.keys(runtime.bones || {}).length : 0}/${Object.keys(HH_HUMANOID_SKELETON).length}</strong><span>HH slots nhận diện</span></div>
            <div><small>Face</small><strong>52 driver</strong><span>${nativeFaceChannels}/52 native morph · cập nhật cố định 60 Hz</span></div>
            <div><small>QUALITY</small><strong>HERO</strong><span>${escapeHtml(lodCapability)}</span></div>
          </div>
          <div class="har-section har-digital-human-stack">
            <div><small>HEAD TARGET</small><strong>20–28K</strong><span>GLB nhập vào được đo thực tế; Human Rig tích hợp không giả nhận đủ chuẩn head mesh.</span></div>
            <div><small>SKIN STACK</small><strong>5 lớp</strong><span>micro-normal · roughness · SSS approximation · flush · wetness</span></div>
            <div><small>EYE SYSTEM</small><strong>3 lớp</strong><span>iris · cornea · tear response khi model có mesh tách</span></div>
            <div><small>ANIMATION</small><strong>8 hướng</strong><span>inertial crossfade · foot contact · secondary bones</span></div>
          </div>
          <div class="har-section har-character-import"><div><h3>Hero Prime đã khóa</h3><p>Không cho thay bằng asset khác trong gameplay. Mọi lỗi tải hoặc giải mã đều hiển thị lý do và nút Retry, không dựng model thay thế.</p><small>GLB local · 58K+ triangles · 114 joints · 65 facial targets</small></div></div>
          ${qa ? `<div class="har-section har-character-qa"><h3>Hero Prime QA · ${Math.round(qa.score ?? 100)}/100 · ${escapeHtml(qa.assetClassLabel || qa.digitalHumanTier || "hero-prime")}</h3><p><strong>Asset duy nhất:</strong> ${qa.heroReady ? "Đạt toàn bộ gate kỹ thuật." : "Đang dùng asset mạnh nhất được khóa; các gate thiếu được báo minh bạch, không thay bằng proxy."}</p><div class="har-character-runtime-grid"><div><small>Geometry</small><strong>${Number(qa.triangles || 0).toLocaleString("vi-VN")}</strong><span>triangles</span></div><div><small>Head</small><strong>${Number(qa.headVertices || 0).toLocaleString("vi-VN")}</strong><span>vertices · đo thực tế</span></div><div><small>Face</small><strong>${qa.faceMorphTargets || 0}/52</strong><span>native facial morph</span></div><div><small>Rig</small><strong>${qa.skinnedMeshes || 0}</strong><span>SkinnedMesh · ${qa.bones || 0} bone</span></div><div><small>Eyes/Hair</small><strong>${qa.separateEyeMeshes || 0}/${qa.hairCardMeshes || 0}</strong><span>mesh tách nhận diện</span></div><div><small>PBR maps</small><strong>N${qa.normalMaps || 0} · R${qa.roughnessMaps || 0} · T${qa.thicknessMaps || 0}</strong><span>normal · roughness · thickness</span></div><div><small>Clips</small><strong>${qa.animations || 0}</strong><span>IK runtime · ${Number(qa.animationSeconds || 0).toFixed(1)} giây asset</span></div><div><small>Quality</small><strong>HERO</strong><span>Không LOD/proxy</span></div></div><div class="har-hero-gate__checks">${(qa.heroChecks || []).map((check) => `<span class="${check.pass ? "is-pass" : "is-missing"}">${check.pass ? "✓" : "○"} ${escapeHtml(check.label)} · ${escapeHtml(check.value)}</span>`).join("")}</div>${qa.warnings?.length ? `<p>${qa.warnings.map(escapeHtml).join("<br>")}</p>` : "<p>Không có cảnh báo tương thích.</p>"}</div>` : ""}
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
            <div class="har-field"><span>Hero model</span><strong>HH Hero Prime · Full Quality Only</strong></div>
            <label class="har-field">Preset cơ thể<select data-appearance-setting="bodyPreset">${Object.entries(APPEARANCE_PRESETS).map(([value, item]) => `<option value="${value}" ${recipe.bodyPreset === value ? "selected" : ""}>${item.label}</option>`).join("")}</select></label>
            <label class="har-field">Phong cách<select data-appearance-setting="style"><option value="anime-realistic" ${recipe.style === "anime-realistic" ? "selected" : ""}>Anime Realistic</option><option value="human-cinematic" ${recipe.style === "human-cinematic" ? "selected" : ""}>Human Cinematic</option></select></label>
          </div>
          <div class="har-section"><p><strong>Pipeline runtime:</strong> HH Hero Prime · ${this.characterPipelineStatus} · không có nguồn thay thế.</p></div>
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
          <div class="har-creator__finish" data-appearance-action-dock role="navigation" aria-label="Hoàn tất chỉnh sửa nhân vật">
            <div><small>CHARACTER DNA V${CHARACTER_VISUAL_VERSION}</small><strong>Ngoại hình đã sẵn sàng</strong><span>Lưu mọi thay đổi và trở lại H-Central.</span></div>
            <button class="har-primary-button" type="button" data-panel-action="appearance-finish"><span>✓ Lưu ngoại hình &amp; trở lại game</span><small>Tiếp tục với nhân vật này</small></button>
          </div>
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
          ${zoneState.weatherLabel || zoneState.controlState || zoneState.economyModifier ? `<div class="har-world-consequence"><b>Hậu quả đang hoạt động</b><span>Thời tiết: ${escapeHtml(zoneState.weatherLabel || this.currentZone.weather)} · Quản trị: ${escapeHtml(zoneState.controlState || FACTIONS.find((faction) => faction.id === zoneState.occupation)?.name || "Độc lập")} · Giá hàng hóa ×${Number(zoneState.economyModifier || 1).toFixed(2)}</span></div>` : ""}
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

    storyEndingStatus(endingId) {
      const shards = Object.values(this.state.story.truthShards || {}).filter((item) => item.discovered).length;
      const echoes = Object.values(this.state.story.echoes || {}).filter((item) => item.unlocked).length;
      const regionDecisions = STORY_MISSIONS.filter((mission) => {
        const record = this.state.story.missions?.[mission.zoneId];
        return record?.status === "completed" && mission.choices.some((choice) => choice.id === record.choice);
      }).length;
      const allTrust = CHARACTER_ORDER.every((id) => Number(this.state.companions[id]?.trust || 0) >= 5 && !this.state.companions[id]?.departed);
      const allShards = shards === STORY_ZONE_ORDER.length;
      const checks = {
        restoration: [allShards, Number(this.state.story.aionEvidence || 0) >= 6],
        "perfect-silence": [allShards],
        "one-true-world": [allShards, regionDecisions >= STORY_ZONE_ORDER.length],
        "free-constellation": [allShards, this.state.story.constellationLinks.length >= 4],
        "astral-rebirth": [allShards, echoes === ECHO_MEMORIES.length, allTrust, Number(this.state.story.endingFlags.dangerousPowerUses || 0) === 0, this.state.story.endingFlags.genesisPurpose === true]
      }[endingId] || [false];
      const labels = {
        restoration: [`${shards}/8 Truth Shard`, `${this.state.story.aionEvidence}/6 bằng chứng Aion`],
        "perfect-silence": [`${shards}/8 Truth Shard`],
        "one-true-world": [`${shards}/8 Truth Shard`, `${regionDecisions}/8 lựa chọn khu vực`],
        "free-constellation": [`${shards}/8 Truth Shard`, `${this.state.story.constellationLinks.length}/4 liên kết Echo`],
        "astral-rebirth": [`${shards}/8 Truth Shard`, `${echoes}/${ECHO_MEMORIES.length} Echo`, allTrust ? "4 đồng đội còn tin tưởng" : "Cần Trust ≥ 5 và đủ 4 đồng đội", `${this.state.story.endingFlags.dangerousPowerUses || 0} lần dùng quyền năng nguy hiểm`, this.state.story.endingFlags.genesisPurpose ? "Đã hiểu mục đích Genesis" : "Chưa hiểu mục đích Genesis"]
      }[endingId] || [];
      return { eligible: checks.every(Boolean), labels };
    }

    renderStoryInterludeSection() {
      const story = this.state.story;
      return `
        <section class="har-section" id="story-interludes"><h3>Interlude Revelations · các mảnh sự thật ở giữa</h3><p>Không có tiết lộ giả: mỗi hồ sơ chỉ mở khi các điều kiện bên dưới được đáp ứng. Bạn có thể xem lại sau khi đã mở.</p></section>
        <div class="har-echo-constellation">${STORY_INTERLUDES.map((interlude) => {
          const status = this.storyInterludeStatus(interlude);
          const record = story.interludes?.[interlude.id] || {};
          const conditions = status.conditions.map((condition) => `<span class="har-event-line"><b>${condition.met ? "✓" : "○"}</b> ${escapeHtml(condition.label)}</span>`).join("");
          const body = status.eligible
            ? `<span>${escapeHtml(record.viewed ? interlude.revelation : interlude.teaser)}</span>`
            : `<span>${escapeHtml(interlude.teaser)}</span>`;
          return `<article style="--story-accent:#ff78cf"><header><i></i><strong>${escapeHtml(interlude.title)}</strong><span>${status.eligible ? (record.viewed ? "ĐÃ XEM" : "MỚI") : "ĐANG KHÓA"}</span></header><div class="is-found"><b>${status.eligible ? "Revelation" : "Điều kiện mở"}</b>${body}</div><div>${conditions}</div>${status.eligible && !record.viewed ? `<button class="har-chip is-active" type="button" data-panel-action="story-view-interlude" data-interlude="${escapeHtml(interlude.id)}">Mở hồ sơ</button>` : ""}</article>`;
        }).join("")}</div>`;
    }

    renderStoryTestimonySection() {
      return `
        <section class="har-section" id="story-testimonies"><h3>Conflicting Testimony · Lời khai mâu thuẫn</h3><p>Hai lời khai được giữ nguyên cạnh nhau. Hệ thống không chọn “đúng” thay bạn; chỉ hiển thị nguồn, dữ liệu và điều kiện mở.</p></section>
        <div class="har-echo-constellation">${STORY_TESTIMONIES.map((testimony) => {
          const status = this.storyTestimonyStatus(testimony);
          const conditions = status.conditions.map((condition) => `<span class="har-event-line"><b>${condition.met ? "✓" : "○"}</b> ${escapeHtml(condition.label)}</span>`).join("");
          const testimonyBody = status.eligible
            ? `<div class="is-found"><b>${escapeHtml(testimony.left.speaker)}</b><span>${escapeHtml(testimony.left.text)}</span></div><div class="is-found"><b>${escapeHtml(testimony.right.speaker)}</b><span>${escapeHtml(testimony.right.text)}</span></div><div class="is-found"><b>Ghi chú điều tra</b><span>${escapeHtml(testimony.insight)}</span></div>`
            : `<div><b>Tín hiệu A</b><span>Lời khai đang được mã hóa cho tới khi đủ điều kiện.</span></div><div><b>Tín hiệu B</b><span>Điều kiện mở được hiển thị công khai bên dưới.</span></div>`;
          return `<article style="--story-accent:${escapeHtml(TRUTH_SHARDS[testimony.zoneId]?.color || "#ff78cf")}"><header><i></i><strong>${escapeHtml(testimony.title)}</strong><span>${status.eligible ? "ĐÃ MỞ" : "KHÓA"}</span></header>${testimonyBody}<div>${conditions}</div></article>`;
        }).join("")}</div>`;
    }

    storyChoiceImpactSummary(choice = {}) {
      const labels = { identityIntegrity: "Danh tính", memoryDebt: "Nợ ký ức", causalityPressure: "Nhân quả" };
      const metricSummary = STORY_METRIC_KEYS
        .map((key) => ({ key, value: Number(choice.metrics?.[key] || 0) }))
        .filter((item) => item.value !== 0)
        .map((item) => `${labels[item.key]} ${item.value > 0 ? "+" : ""}${item.value}`);
      const affected = choice.beliefsAll
        ? "Niềm tin: toàn đội"
        : Object.keys(choice.beliefs || {}).length
          ? `Niềm tin: ${Object.keys(choice.beliefs).map((id) => CHARACTERS[id]?.name || id).join(", ")}`
          : "";
      return [...metricSummary, affected].filter(Boolean).join(" · ");
    }

    renderStoryPanel() {
      const story = this.state.story;
      const shardCount = Object.values(story.truthShards).filter((item) => item.discovered).length;
      const echoCount = Object.values(story.echoes).filter((item) => item.unlocked).length;
      const metrics = normalizeStoryMetrics(story.metrics, STORY_METRIC_DEFAULTS);
      const currentMission = STORY_MISSIONS.find((mission) => ["active", "decision"].includes(story.missions[mission.zoneId]?.status));
      return `
        <div class="har-section har-story-hero">
          <div class="har-story-core" aria-hidden="true"><i></i><span>H</span><i></i></div>
          <small>${STORY_VERSION_LABEL} · ${escapeHtml(story.identityStatus.toUpperCase())}</small>
          <h3>${escapeHtml(this.state.player.name)} · Người không tồn tại</h3>
          <p>HH Core giữ tám phiên bản mâu thuẫn về bạn. Aion không muốn thống trị: hắn tin mọi tương lai có bạn đều kết thúc bằng đại thảm họa.</p>
          <div class="har-stat-grid"><div><small>Truth Shard</small><strong>${shardCount}/8</strong></div><div><small>Echo Memory</small><strong>${echoCount}/${ECHO_MEMORIES.length}</strong></div><div><small>Bằng chứng Aion</small><strong>${story.aionEvidence}/8</strong></div><div><small>New Game+</small><strong>${story.newGamePlus}</strong></div></div>
          <div class="har-stat-grid"><div><small>Toàn vẹn danh tính</small><strong>${metrics.identityIntegrity}%</strong></div><div><small>Nợ ký ức</small><strong>${metrics.memoryDebt}%</strong></div><div><small>Áp lực nhân quả</small><strong>${metrics.causalityPressure}%</strong></div><div><small>Ủy quyền giọng</small><strong>${story.hiddenSignals.voiceAuthorizationRecovered ? "ĐÃ ĐỐI CHIẾU" : "CHƯA BIẾT"}</strong></div></div>
          <div class="har-inline-actions"><button class="har-primary-button" type="button" data-panel-action="story-resume">${currentMission ? `Tiếp tục · ${escapeHtml(currentMission.title)}` : "Xem các kết thúc"}</button><button class="har-secondary-button" type="button" data-panel-action="story-recap">Story Recap</button><button class="har-secondary-button" type="button" data-panel-action="story-replay">Phát lại Prologue</button></div>
        </div>
        <nav class="har-story-tabs" aria-label="Đi tới phần cốt truyện"><button type="button" data-panel-action="story-scroll" data-story-target="story-missions">Mission Board</button><button type="button" data-panel-action="story-scroll" data-story-target="story-echoes">Echo Constellation</button><button type="button" data-panel-action="story-scroll" data-story-target="story-interludes">Interludes</button><button type="button" data-panel-action="story-scroll" data-story-target="story-testimonies">Lời khai</button><button type="button" data-panel-action="story-scroll" data-story-target="story-timeline">Timeline</button><button type="button" data-panel-action="story-scroll" data-story-target="story-endings">Endings</button></nav>
        <section class="har-section" id="story-missions"><h3>Mission Constellation · 8 mảnh sự thật</h3><p>Mỗi chương có cơ chế riêng và kết thúc bằng một lựa chọn làm đổi khu vực, đồng đội, kinh tế hoặc quyền kiểm soát.</p></section>
        <div class="har-story-missions">${STORY_MISSIONS.map((mission, index) => {
          const record = story.missions[mission.zoneId];
          const zone = ZONES.find((item) => item.id === mission.zoneId);
          const shard = TRUTH_SHARDS[mission.zoneId];
          const choice = mission.choices.find((item) => item.id === record.choice);
          const canTravel = Boolean(this.state.checkpoints[mission.zoneId]);
          const inZone = this.currentZone.id === mission.zoneId;
          const nextStep = mission.steps[Math.min(record.progress, mission.steps.length - 1)];
          const objective = STORY_OBJECTIVES[mission.zoneId]?.[Math.min(record.progress, mission.steps.length - 1)];
          const objectiveTarget = objective?.target || 1;
          const progressValue = record.status === "completed" ? 100 : Math.round(((record.progress + (record.objectiveProgress || 0) / objectiveTarget) / mission.steps.length) * 100);
          const pendingChoice = this.pendingStoryChoice?.zoneId === mission.zoneId
            ? mission.choices.find((item) => item.id === this.pendingStoryChoice.choiceId)
            : null;
          return `<article class="har-story-mission ${record.status === "active" || record.status === "decision" ? "is-active" : ""} ${record.status === "completed" ? "is-complete" : ""}" style="--story-accent:${shard.color}">
            <header><i>${String(index + 1).padStart(2, "0")}</i><div><small>${escapeHtml(zone.name)} · ${escapeHtml(shard.title)}</small><strong>${escapeHtml(mission.title)}</strong></div><span>${escapeHtml(record.status)}</span></header>
            <p>${escapeHtml(mission.summary)}</p><small class="har-story-mechanic">Cơ chế: ${escapeHtml(mission.mechanic)}</small>
            ${record.status !== "locked" ? `<div class="har-progress-row"><div class="har-meter har-meter--xp"><i style="--value:${progressValue}%"></i></div><output>${record.progress}/${mission.steps.length}</output></div>` : ""}
            ${record.status === "active" ? `<div class="har-story-step"><b>${escapeHtml(nextStep)}</b><span>Mục tiêu gameplay: ${escapeHtml(objective?.label || nextStep)}${objectiveTarget > 1 ? ` · ${record.objectiveProgress || 0}/${objectiveTarget}` : ""}</span></div><button class="har-chip is-active" type="button" data-panel-action="${!inZone ? "story-teleport" : objective?.event === "scan" ? "story-scan" : "story-play"}" data-zone="${mission.zoneId}" ${inZone || canTravel ? "" : "disabled"}>${!inZone ? canTravel ? `Đến ${escapeHtml(zone.name)}` : "Cổng chưa mở" : objective?.event === "scan" ? "Bắt đầu Deep Scan" : "Trở lại gameplay"}</button>` : ""}
            ${record.status === "decision" ? `<div class="har-story-decision"><strong>${escapeHtml(mission.prompt)}</strong>${mission.choices.map((item) => `<button type="button" data-panel-action="story-choice-preview" data-zone="${mission.zoneId}" data-choice="${item.id}" aria-pressed="${pendingChoice?.id === item.id}"><b>${escapeHtml(item.label)}</b><span>${escapeHtml(item.outcome)}</span><span>${escapeHtml(this.storyChoiceImpactSummary(item))}</span></button>`).join("")}${pendingChoice ? `<div class="har-story-confirm" role="alert"><b>Xác nhận lựa chọn dài hạn?</b><span>${escapeHtml(pendingChoice.outcome)}</span><span>${escapeHtml(this.storyChoiceImpactSummary(pendingChoice))}</span><div><button class="har-chip is-active" type="button" data-panel-action="story-choice-confirm" data-zone="${mission.zoneId}" data-choice="${pendingChoice.id}">Xác nhận hậu quả</button><button class="har-chip" type="button" data-panel-action="story-choice-cancel">Xem lại</button></div></div>` : ""}</div>` : ""}
            ${record.status === "completed" ? `<div class="har-story-consequence"><b>${escapeHtml(choice?.label || "Đã hoàn thành")}</b><span>${escapeHtml(choice?.outcome || shard.revelation)}</span></div>` : ""}
          </article>`;
        }).join("")}</div>
        <section class="har-section" id="story-echoes"><h3>Memory Constellation</h3><p>Tự nối các Echo để mở nghi vấn và lựa chọn mới. Game lưu bằng chứng nhưng không tự tuyên bố đâu là sự thật tuyệt đối.</p></section>
        <div class="har-echo-constellation">${STORY_ZONE_ORDER.map((zoneId) => {
          const zone = ZONES.find((item) => item.id === zoneId);
          const echoes = ECHO_MEMORIES.filter((echo) => echo.zoneId === zoneId);
          const records = echoes.map((echo) => story.echoes[echo.id]);
          const linked = story.constellationLinks.some((link) => echoes.some((echo) => echo.id === link.from) && echoes.some((echo) => echo.id === link.to));
          return `<article style="--story-accent:${TRUTH_SHARDS[zoneId].color}"><header><i></i><strong>${escapeHtml(zone.name)}</strong><span>${records.filter((item) => item.unlocked).length}/2</span></header>${echoes.map((echo) => `<div class="${story.echoes[echo.id].unlocked ? "is-found" : ""}"><b>${story.echoes[echo.id].unlocked ? escapeHtml(echo.title) : "Tín hiệu chưa xác định"}</b><span>${story.echoes[echo.id].unlocked ? escapeHtml(echo.summary) : "Hoàn thành bước nhiệm vụ hoặc quét khu vực để mở."}</span></div>`).join("")}${records.every((item) => item.unlocked) ? `<button class="har-chip ${linked ? "" : "is-active"}" type="button" data-panel-action="link-zone-echoes" data-zone="${zoneId}" ${linked ? "disabled" : ""}>${linked ? "Đã kết nối" : "Nối hai Echo"}</button>` : ""}</article>`;
        }).join("")}</div>
        ${this.renderStoryInterludeSection()}
        ${this.renderStoryTestimonySection()}
        <section class="har-section" id="story-timeline"><h3>Timeline & nghi vấn</h3><p>${story.decisions.length ? story.decisions.slice(-10).reverse().map((decision) => `<span class="har-event-line"><b>${escapeHtml(decision.title)}</b> · ${escapeHtml(decision.outcome)} <small>${new Date(decision.createdAt).toLocaleString("vi-VN")}</small></span>`).join("") : "Các phần chưa biết được che lại cho tới khi bạn thật sự tạo ra lựa chọn."}</p></section>
        <section class="har-section"><h3>Dialogue History</h3><p>${story.dialogueHistory.length ? story.dialogueHistory.slice(-8).reverse().map((entry) => `<span class="har-event-line"><b>${escapeHtml(entry.speaker)}</b> · ${escapeHtml(entry.text)}</span>`).join("") : "Chưa có đoạn hội thoại cốt truyện được ghi."}</p></section>
        <section class="har-section" id="story-endings"><h3>Năm kết thúc không tốt/xấu tuyệt đối</h3><p>Điều kiện dựa trên dữ liệu thật trong save. Astral Rebirth là kết thúc bí mật và không mở chỉ bằng việc hoàn thành tuyến chính.</p></section>
        <div class="har-story-endings">${STORY_ENDINGS.map((ending) => {
          const status = this.storyEndingStatus(ending.id);
          const selected = story.endingFlags.selected === ending.id;
          const pending = this.pendingStoryEnding === ending.id && !story.endingFlags.selected;
          const lockedByEnding = Boolean(story.endingFlags.selected) && !selected;
          return `<article class="${status.eligible ? "is-ready" : ""} ${selected ? "is-selected" : ""}" style="--story-accent:${ending.color}"><small>${ending.id === "astral-rebirth" ? "SECRET ENDING" : "ENDING"}</small><strong>${escapeHtml(ending.title)}</strong><p>${escapeHtml(ending.premise)}</p><span>${status.labels.map((label) => escapeHtml(label)).join(" · ")}</span><button class="har-chip ${status.eligible ? "is-active" : ""}" type="button" data-panel-action="${pending ? "choose-ending-confirm" : "choose-ending-preview"}" data-ending="${ending.id}" ${status.eligible && !selected && !lockedByEnding ? "" : "disabled"}>${selected ? "Đã khóa kết thúc" : lockedByEnding ? "Đã chọn dòng thời gian khác" : pending ? "Xác nhận kết thúc" : status.eligible ? "Xem trước hậu quả" : "Chưa đủ điều kiện"}</button>${pending ? `<button class="har-chip" type="button" data-panel-action="choose-ending-cancel">Chọn lại</button>` : ""}</article>`;
        }).join("")}</div>`;
    }

    renderCompanionPanel() {
      return `
        <div class="har-section"><h3>Companion Stories · quan hệ theo hậu quả</h3><p>Bond không tăng bằng quà tặng. Trust, Fear, Loyalty và Memory Integrity đổi theo lời hứa, người được cứu và cách bạn hoàn thành từng chương.</p></div>
        <ul class="har-list">${CHARACTER_ORDER.map((id) => {
          const profile = CHARACTERS[id];
          const story = COMPANION_STORIES[id];
          const record = this.state.companions?.[id] || { unlocked: id === "lyra", bond: 0, trust: 0, fear: 0, loyalty: 0, memoryIntegrity: 10, storyStage: 0, beliefs: defaultCompanionBeliefs(id) };
          const beliefs = normalizeCompanionBeliefs(record.beliefs, id);
          const secretZone = { lyra: "station", cael: "aurora", nyx: "void", sol: "crimson" }[id];
          const secret = this.state.story.truthShards[secretZone]?.discovered
            ? { lyra: "Lyra từng giao nộp bạn cho The Archivist theo một lời hứa bị xóa.", cael: "Cael nhớ các dòng thời gian đã mất nhưng mỗi lần nhớ lại sẽ quên hiện tại.", nyx: "Năng lượng của Nyx có quan hệ trực tiếp với Aion và Nexus Abyss.", sol: "Sol đã hy sinh một thành phố theo lệnh mang chữ ký Character DNA của bạn." }[id]
            : "Bí mật chưa được xác minh · hãy tìm Truth Shard liên quan.";
          const cooldown = record.lastActivityAt && Date.now() - new Date(record.lastActivityAt).getTime() < 60000;
          return `<li class="har-list-item ${id === this.state.roster.activeId ? "is-active" : ""} ${record.departed ? "is-departed" : ""}" style="--item-accent:${profile.accent}">
            <div><strong>${escapeHtml(profile.name)} · ${record.departed ? "Đã rời đội" : `Bond ${record.bond}/10`}</strong><span>${escapeHtml(story.title)} · ${escapeHtml(story.summary)}</span><small>Trust ${record.trust} · Fear ${record.fear} · Loyalty ${record.loyalty} · Memory ${record.memoryIntegrity}/10</small><small>Niềm tin · Tự do ${beliefs.freeWill} · Trật tự ${beliefs.coreOrder} · Nguy cơ ${beliefs.playerIsThreat} · Tin Aion ${beliefs.aionMayBeRight}</small><small>${escapeHtml(secret)}</small><small>${record.unlocked ? `Ký ức ${record.storyStage}/5 · Hỗ trợ: ${escapeHtml(story.support)}` : "Chưa mở khóa · quan hệ bắt đầu khi nhân vật tham gia đội"}</small></div>
            <div class="har-list-item__actions"><button class="har-chip ${record.unlocked && !record.departed ? "is-active" : ""}" type="button" data-panel-action="bond-companion" data-companion="${id}" ${cooldown || record.departed ? "disabled" : ""}>${record.departed ? "Đang vắng mặt" : cooldown ? "Đang suy ngẫm" : "Đối thoại"}</button></div>
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
        <div class="har-section"><h3>Truth Shards & nghi vấn</h3><p>${STORY_ZONE_ORDER.map((zoneId) => {
          const shard = TRUTH_SHARDS[zoneId];
          const found = this.state.story.truthShards[zoneId]?.discovered;
          return `<span class="har-event-line"><b>${escapeHtml(shard.title)}</b> · ${escapeHtml(found ? shard.revelation : shard.question)}</span>`;
        }).join("")}</p></div>
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
            const unlocked = Boolean(this.state.checkpoints[zone.id]);
            const current = this.currentZone.id === zone.id;
            return `<li class="har-list-item ${current ? "is-active" : ""}">
              <div><strong style="color:${zone.color}">${escapeHtml(zone.name)}</strong><span>${escapeHtml(zone.description)}</span><small>${escapeHtml(zone.weather)} · ${unlocked ? "Cổng đã kích hoạt" : "Chưa khám phá cổng"}</small></div>
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
      const storyMission = STORY_MISSIONS.find((mission) => ["active", "decision"].includes(this.state.story.missions[mission.zoneId]?.status));
      return `${storyMission ? `<div class="har-section har-story-quest"><small>MAIN STORY · ${escapeHtml(TRUTH_SHARDS[storyMission.zoneId].title)}</small><h3>${escapeHtml(storyMission.title)}</h3><p>${escapeHtml(storyMission.summary)}</p><div class="har-inline-actions"><button class="har-primary-button" type="button" data-panel-action="story-resume">Mở Story Constellation</button></div></div>` : ""}<div class="har-section"><h3>Nhiệm vụ thế giới</h3><p>Tuyến hoạt động ban đầu vẫn được giữ riêng với nhiệm vụ chính và Companion Mission.</p></div><ul class="har-list">${QUESTS.map((quest, index) => {
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
      const economyModifier = clamp(this.state.world?.zones?.[this.currentZone.id]?.economyModifier ?? 1, 0.5, 1.5);
      return `
        <div class="har-section"><h3>Chế tạo kiểm tra nguyên liệu thật</h3><p>Vật phẩm chỉ được thêm vào kho sau khi đã trừ đủ nguyên liệu. Kinh tế ${escapeHtml(this.currentZone.name)} đang áp dụng hệ số ×${economyModifier.toFixed(2)} từ hậu quả cốt truyện.</p></div>
        <ul class="har-list">${RECIPES.map((recipe) => {
          const requirements = Object.entries(this.economyAdjustedRequirements(recipe.requires));
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
          weapon.visible = true;
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

    recordAppearanceChange(beforeRecipe, label = "Cập nhật ngoại hình") {
      const id = this.state.roster.activeId;
      const after = appearanceFingerprint(this.activeAppearanceRecipe(), id);
      if (appearanceFingerprint(beforeRecipe, id) === after) return;
      this.appearanceHistory.push(normalizeAppearanceRecipe(beforeRecipe, id));
      this.appearanceHistory = this.appearanceHistory.slice(-30);
      this.appearanceFuture = [];
      this.appearanceDirty = true;
      this.state.appearance.lastSavedAt = nowIso();
      this.state.appearance.versionHistory = [...(this.state.appearance.versionHistory || []), {
        id: uid("look-version"),
        characterId: id,
        label: String(label || "Cập nhật ngoại hình").slice(0, 80),
        recipe: compactAppearanceRecipe(this.activeAppearanceRecipe(), id),
        createdAt: nowIso()
      }].slice(-30);
      this.saveProgress(label);
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
            <label class="har-field">Character runtime<select data-setting="characterMode"><option value="hero">Human Rig 3D · Hero Prime V${CHARACTER_VISUAL_VERSION}</option></select></label>
            <label class="har-field">Character quality<select data-setting="characterQuality"><option value="hero">Hero Prime · Full Quality Only</option></select></label>
            <label class="har-field">Khuôn mặt<select data-setting="facialAnimation"><option value="true">Chớp mắt, cảm xúc và lip-sync</option><option value="false">Tắt facial animation</option></select></label>
            <label class="har-field">Mắt tự nhiên<select data-setting="eyePerformance"><option value="true">Mí mắt, đồng tử và micro-saccade</option><option value="false">Mắt tĩnh</option></select></label>
            <label class="har-field">Chuyển động tự nhiên<select data-setting="naturalMotion"><option value="true">Analog gait · yaw smoothing</option><option value="false">Chuyển động cơ bản</option></select></label>
            <label class="har-field">Digital Human<select data-setting="digitalHumanQuality"><option value="hero">Hero Prime · facial 60 Hz</option></select></label>
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
        <div class="har-section"><h3>Điều khiển</h3><p>WASD di chuyển · Shift chạy · Space nhảy/lượn · F đánh · Q né · E kỹ năng · R tuyệt kỹ · G/T tương tác · L khóa mục tiêu · chuột phải xoay camera. Tab luôn dành cho điều hướng bàn phím.</p></div>
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
        if (event.target.matches("[data-inventory-filter]")) {
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
          if (key === "characterMode" || key === "characterQuality") {
            this.state.settings.characterMode = "hero";
            this.state.settings.characterQuality = "hero";
            this.refreshCharacterMaterials();
            this.characterMeshes.forEach((mesh) => { mesh.userData.modelTier = ""; });
            this.toast("Hero Prime đã khóa ở Full Quality.", "success");
          }
          if (key === "digitalHumanQuality") {
            this.state.settings.digitalHumanQuality = "hero";
            this.state.settings.characterQuality = "hero";
            this.characterMeshes.forEach((mesh) => { mesh.userData.modelTier = ""; });
            this.toast("Hero Prime facial 60 Hz đã được áp dụng.", "success");
          }
          if (key === "visualStyle") this.toast("Phong cách nhân vật và cảnh quan sẽ áp dụng ở lần mở game kế tiếp.");
          if (key === "vfxLevel") {
            this.root.dataset.vfx = value;
            this.syncMotionPreference();
            this.toast("Mức hiệu ứng đã được cập nhật.", "success");
          }
          if (key === "reduceEffects") this.syncMotionPreference();
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

    unlockStoryEcho(echoId, source = "Khám phá") {
      const echo = ECHO_MEMORIES.find((item) => item.id === echoId);
      const record = this.state.story.echoes?.[echoId];
      if (!echo || !record || record.unlocked) return false;
      record.unlocked = true;
      record.viewed = true;
      record.unlockedAt = nowIso();
      this.recordWorldEvent({ type: "echo-memory", title: `Echo mở khóa · ${echo.title}`, detail: `${source}: ${echo.summary}`, zoneId: echo.zoneId });
      this.recordStoryDialogue(echo.witness, echo.summary, echo.zoneId);
      this.queueStoryRecap(`Echo Memory · ${echo.title}`, echo.summary);
      this.refreshStoryInterludes();
      return true;
    }

    collectTruthShard(zoneId) {
      const shard = TRUTH_SHARDS[zoneId];
      const record = this.state.story.truthShards?.[zoneId];
      if (!shard || !record || record.discovered) return false;
      record.discovered = true;
      record.collectedAt = nowIso();
      if (!this.state.exploration.codex.includes(`truth:${zoneId}`)) this.state.exploration.codex.push(`truth:${zoneId}`);
      this.recordWorldEvent({ type: "truth-shard", title: `Truth Shard · ${shard.title}`, detail: shard.revelation, zoneId });
      this.queueStoryRecap(`Truth Shard · ${shard.title}`, shard.revelation);
      this.refreshStoryInterludes();
      return true;
    }

    applyStoryMetrics(choice = {}) {
      const before = normalizeStoryMetrics(this.state.story.metrics, STORY_METRIC_DEFAULTS);
      const delta = choice.metrics && typeof choice.metrics === "object" ? choice.metrics : {};
      this.state.story.metrics = Object.fromEntries(STORY_METRIC_KEYS.map((key) => [
        key,
        clamp(before[key] + Number(delta[key] || 0), 0, 100)
      ]));
      return { before, after: { ...this.state.story.metrics } };
    }

    applyCompanionBeliefs(choice = {}) {
      const allDelta = choice.beliefsAll && typeof choice.beliefsAll === "object" ? choice.beliefsAll : {};
      const targeted = choice.beliefs && typeof choice.beliefs === "object" ? choice.beliefs : {};
      CHARACTER_ORDER.forEach((id) => {
        const companion = this.state.companions[id] ||= { unlocked: false, bond: 0, trust: 0, fear: 0, loyalty: 0, memoryIntegrity: 10, beliefs: defaultCompanionBeliefs(id), storyStage: 0 };
        const current = normalizeCompanionBeliefs(companion.beliefs, id);
        const delta = { ...allDelta, ...(targeted[id] || {}) };
        companion.beliefs = Object.fromEntries(STORY_BELIEF_KEYS.map((key) => [
          key,
          clamp(current[key] + Number(delta[key] || 0), key === "playerIsThreat" ? 0 : -10, 10)
        ]));
      });
      return this.state.companions;
    }

    refreshStoryInterludes({ silent = false } = {}) {
      const unlocked = [];
      STORY_INTERLUDES.forEach((interlude) => {
        const record = this.state.story.interludes[interlude.id] ||= { unlocked: false, viewed: false, unlockedAt: "", viewedAt: "" };
        if (record.unlocked || !interlude.unlock.every((condition) => storyConditionMet(this.state, condition))) return;
        record.unlocked = true;
        record.unlockedAt = nowIso();
        unlocked.push(interlude);
        if (!silent) {
          this.recordStoryDialogue("HH Core", interlude.revelation, interlude.unlock[0]?.zoneId || this.currentZone?.id || "central");
          this.queueStoryRecap(interlude.title, interlude.revelation);
          this.toast(`${interlude.title} đã mở trong Story Constellation.`, "success");
        }
      });
      return unlocked;
    }

    markStoryInterludeViewed(interludeId) {
      const interlude = STORY_INTERLUDES.find((item) => item.id === interludeId);
      const record = this.state.story.interludes?.[interludeId];
      if (!interlude || !record?.unlocked) return this.toast("Interlude này chưa đủ điều kiện mở.", "error");
      record.viewed = true;
      record.viewedAt = nowIso();
      this.recordStoryDialogue("Story Archive", interlude.revelation, interlude.unlock[0]?.zoneId || "central");
      this.saveProgress(`Đã xem ${interlude.title}`);
      this.renderCurrentPanel();
    }

    storyInterludeStatus(interlude) {
      const conditions = storyUnlockStatus(this.state, interlude.unlock);
      const record = this.state.story.interludes?.[interlude.id] || {};
      return { eligible: record.unlocked === true || conditions.every((item) => item.met), viewed: record.viewed === true, conditions };
    }

    storyTestimonyStatus(testimony) {
      const conditions = storyUnlockStatus(this.state, testimony.unlock);
      return { eligible: conditions.every((item) => item.met), conditions };
    }

    storyObjective(zoneId) {
      const mission = STORY_MISSIONS.find((item) => item.zoneId === zoneId);
      const record = this.state.story.missions?.[zoneId];
      if (!mission || !record || record.status !== "active") return null;
      const index = clamp(record.progress, 0, mission.steps.length - 1);
      return { mission, record, index, objective: STORY_OBJECTIVES[zoneId]?.[index] || null };
    }

    storyEventKey(event, meta = {}) {
      const identity = meta.eventKey || meta.enemyId || meta.nodeId || meta.puzzleId || meta.npcId || meta.zoneId || "unknown";
      return `${String(event).slice(0, 32)}:${String(identity).slice(0, 64)}`;
    }

    matchesStoryObjective(objective, event, meta, zoneId) {
      if (!objective || objective.event !== event) return false;
      if (["enter-zone", "beacon", "scan", "defeat", "collect"].includes(event) && meta.zoneId !== zoneId) return false;
      if (objective.npcId && objective.npcId !== meta.npcId) return false;
      if (objective.puzzleId && objective.puzzleId !== meta.puzzleId) return false;
      if (objective.archetype && objective.archetype !== meta.archetype) return false;
      if (objective.nodeId && objective.nodeId !== meta.nodeId) return false;
      return true;
    }

    progressStoryObjective(event, meta = {}, { silent = false } = {}) {
      const active = STORY_MISSIONS.map((mission) => this.storyObjective(mission.zoneId)).find(Boolean);
      if (!active || !this.matchesStoryObjective(active.objective, event, meta, active.mission.zoneId)) return false;
      const eventKey = this.storyEventKey(event, meta);
      active.record.completedEventKeys ||= [];
      if (active.record.completedEventKeys.includes(eventKey)) return false;
      active.record.completedEventKeys = [...active.record.completedEventKeys, eventKey].slice(-24);
      active.record.objectiveProgress = clamp(Number(active.record.objectiveProgress || 0) + 1, 0, active.objective.target || 1);
      if (active.record.objectiveProgress < (active.objective.target || 1)) {
        if (!silent) this.toast(`${active.objective.label} · ${active.record.objectiveProgress}/${active.objective.target}`, "success");
        this.saveProgress(`Story objective · ${active.mission.title}`);
        if (["story", "quests"].includes(this.currentPanel)) this.renderCurrentPanel();
        return true;
      }
      const completedStep = active.index;
      active.record.progress = clamp(active.record.progress + 1, 0, active.mission.steps.length);
      active.record.objectiveProgress = 0;
      if (completedStep < active.mission.echoes.length) this.unlockStoryEcho(active.mission.echoes[completedStep], `Gameplay · ${active.objective.label}`);
      this.recordWorldEvent({ type: "story-progress", title: `${active.mission.title} · ${active.record.progress}/${active.mission.steps.length}`, detail: active.objective.label, zoneId: active.mission.zoneId });
      if (active.record.progress >= active.mission.steps.length) {
        active.record.status = "decision";
        if (!silent) this.toast("Gameplay đã mở một lựa chọn dài hạn. Hãy xem kỹ hậu quả trước khi xác nhận.", "success");
      } else if (!silent) this.toast(`Hoàn thành mục tiêu: ${active.objective.label}`, "success");
      this.saveProgress(`Story gameplay · ${active.mission.title}`);
      if (["story", "quests"].includes(this.currentPanel)) this.renderCurrentPanel();
      return true;
    }

    reconcileStoryObjective() {
      for (let guard = 0; guard < 8; guard += 1) {
        const active = STORY_MISSIONS.map((mission) => this.storyObjective(mission.zoneId)).find(Boolean);
        if (!active?.objective) return;
        const objective = active.objective;
        const zoneId = active.mission.zoneId;
        let progressed = false;
        if (objective.event === "enter-zone" && this.currentZone.id === zoneId) progressed = this.progressStoryObjective("enter-zone", { zoneId }, { silent: true });
        else if (objective.event === "scan" && this.state.exploration.scans.includes(`zone:${zoneId}:scan`)) progressed = this.progressStoryObjective("scan", { zoneId }, { silent: true });
        else if (objective.event === "puzzle" && this.state.puzzles[objective.puzzleId]?.solved) progressed = this.progressStoryObjective("puzzle", { zoneId, puzzleId: objective.puzzleId }, { silent: true });
        else if (objective.event === "collect" && this.state.collectedNodes.includes(objective.nodeId)) progressed = this.progressStoryObjective("collect", { zoneId, nodeId: objective.nodeId }, { silent: true });
        else if (objective.event === "dialogue" && objective.npcId === "luma" && this.state.story.hiddenSignals.lumaDeniesMira) progressed = this.progressStoryObjective("dialogue", { zoneId, npcId: "luma", eventKey: "luma:mira" }, { silent: true });
        else if (objective.event === "beacon" && this.state.story.hiddenSignals[`storyBeacon:${zoneId}`]) progressed = this.progressStoryObjective("beacon", { zoneId }, { silent: true });
        else if (objective.event === "defeat") {
          const defeatedIds = Object.keys(this.state.defeated || {}).filter((enemyId) => {
            const enemy = this.enemies.get(enemyId);
            return enemy?.userData?.archetype === objective.archetype && this.zoneAt(enemy.position.x, enemy.position.z).id === zoneId;
          });
          defeatedIds.forEach((enemyId) => { if (this.progressStoryObjective("defeat", { zoneId, archetype: objective.archetype, enemyId }, { silent: true })) progressed = true; });
        }
        if (!progressed) return;
      }
    }

    activateStoryBeacon(beacon) {
      const zoneId = beacon?.userData?.zoneId;
      if (!STORY_ZONE_ORDER.includes(zoneId)) return;
      this.state.story.hiddenSignals[`storyBeacon:${zoneId}`] = true;
      const progressed = this.progressStoryObjective("beacon", { zoneId, eventKey: beacon.userData.id });
      this.spawnNova(beacon.position.x, beacon.position.y + 1.4, beacon.position.z, TRUTH_SHARDS[zoneId].color);
      if (progressed) {
        beacon.userData.core.material.emissiveIntensity = 1.35;
        beacon.userData.ring.material.opacity = 0.9;
      } else {
        this.toast("Dư ảnh này đã được ghi vào Memory Constellation.");
        this.openPanel("story");
      }
    }

    revealLongTermConsequences(chapter) {
      (this.state.story.longTermConsequences || []).forEach((consequence) => {
        if (consequence.visibleAtChapter !== chapter) return;
        const signalKey = `consequence:${consequence.id}`;
        if (this.state.story.hiddenSignals[signalKey]) return;
        this.state.story.hiddenSignals[signalKey] = true;
        this.queueStoryRecap(`Hậu quả trở lại · ${consequence.title}`, consequence.detail);
        this.recordWorldEvent({ type: "story-consequence", title: consequence.title, detail: consequence.detail, zoneId: consequence.zoneId });
      });
    }

    async resolveStoryMissionChoice(zoneId, choiceId) {
      const mission = STORY_MISSIONS.find((item) => item.zoneId === zoneId);
      const record = this.state.story.missions?.[zoneId];
      const choice = mission?.choices.find((item) => item.id === choiceId);
      if (!mission || !record || record.status !== "decision" || !choice) return;
      record.status = "completed";
      record.choice = choice.id;
      record.completedAt = nowIso();
      const metricChange = this.applyStoryMetrics(choice);
      this.applyCompanionBeliefs(choice);
      const zoneState = this.state.world.zones[zoneId];
      zoneState.discovered = true;
      zoneState.restored = true;
      zoneState.core = "restored";
      zoneState.weatherLabel = choice.weather;
      zoneState.weatherSeverity = clamp(0.46 + Math.abs(Number(choice.economy || 1) - 1) * 1.8 + Number(choice.dangerous || 0) * 0.12, 0.35, 1);
      zoneState.economyModifier = clamp(choice.economy ?? 1, 0.5, 1.5);
      zoneState.controlState = String(choice.control || "independent").slice(0, 40);
      const environmentVariant = STORY_ENVIRONMENT_VARIANTS[zoneId]?.[choice.id];
      zoneState.environmentVariant = String(environmentVariant?.landmarkState || choice.id).slice(0, 60);
      if (FACTIONS.some((faction) => faction.id === choice.control)) zoneState.occupation = choice.control;
      zoneState.resources = clamp(Number(zoneState.resources || 0) + (choice.economy <= 0.9 ? 22 : 12), 0, 100);
      zoneState.updatedAt = nowIso();
      const landmarkId = `world-art-v${WORLD_ART_VERSION}:${zoneId}:${zoneState.environmentVariant}`;
      if (!this.state.exploration.landmarks.includes(landmarkId)) {
        this.state.exploration.landmarks = [...this.state.exploration.landmarks, landmarkId].slice(-100);
      }
      const companion = choice.companion ? this.state.companions[choice.companion] : null;
      if (companion) {
        companion.unlocked = true;
        companion.trust = clamp(Number(companion.trust || 0) + Number(choice.trust || 0), -10, 10);
        companion.fear = clamp(Number(companion.fear || 0) + Number(choice.fear || 0), 0, 10);
        companion.loyalty = clamp(Number(companion.loyalty || 0) + Math.sign(Number(choice.trust || 0)), -10, 10);
        companion.memoryIntegrity = clamp(Number(companion.memoryIntegrity ?? 10) + Number(choice.memory || 0), 0, 10);
        companion.departed = choice.departed === true;
        companion.storyStage = clamp(Number(companion.storyStage || 0) + 1, 0, 5);
      }
      if (choice.trustAll) CHARACTER_ORDER.forEach((id) => { this.state.companions[id].trust = clamp(Number(this.state.companions[id].trust || 0) + choice.trustAll, -10, 10); });
      if (choice.fearAll) CHARACTER_ORDER.forEach((id) => { this.state.companions[id].fear = clamp(Number(this.state.companions[id].fear || 0) + choice.fearAll, 0, 10); });
      this.state.story.endingFlags.dangerousPowerUses = clamp(Number(this.state.story.endingFlags.dangerousPowerUses || 0) + Number(choice.dangerous || 0), 0, 99);
      this.state.story.aionEvidence = clamp(Number(this.state.story.aionEvidence || 0) + 1, 0, 8);
      this.collectTruthShard(zoneId);
      const decision = { id: uid("story-choice"), zoneId, choice: choice.id, title: choice.label, outcome: choice.outcome, metrics: metricChange.after, permanent: true, createdAt: nowIso() };
      this.state.story.decisions = [...this.state.story.decisions, decision].slice(-60);
      this.state.story.longTermConsequences = [...this.state.story.longTermConsequences, { id: uid("consequence"), zoneId, title: choice.label, detail: choice.outcome, visibleAtChapter: STORY_ZONE_ORDER[STORY_ZONE_ORDER.indexOf(zoneId) + 2] || "epilogue", createdAt: nowIso() }].slice(-40);
      this.state.world.choiceHistory = [...(this.state.world.choiceHistory || []), { id: decision.id, option: choice.label, outcome: choice.outcome, createdAt: decision.createdAt }].slice(-40);
      this.recordWorldEvent({ type: "story-choice", title: choice.label, detail: choice.outcome, zoneId, factionId: zoneState.occupation });
      this.queueStoryRecap(`${mission.title} · ${choice.label}`, choice.outcome);
      const index = STORY_ZONE_ORDER.indexOf(zoneId);
      const nextZoneId = STORY_ZONE_ORDER[index + 1];
      if (nextZoneId) {
        this.state.story.missions[nextZoneId].status = "active";
        this.state.story.chapter = nextZoneId;
        this.state.checkpoints[nextZoneId] = true;
        const portal = this.portals.get(nextZoneId);
        if (portal) portal.userData.unlocked = true;
      } else {
        this.state.story.chapter = "finale";
        if (this.state.companions.lyra.departed && this.state.story.aionEvidence >= 7) {
          this.state.companions.lyra.departed = false;
          this.state.companions.lyra.trust = clamp(this.state.companions.lyra.trust + 2, -10, 10);
        }
      }
      this.pendingStoryChoice = null;
      this.revealLongTermConsequences(this.state.story.chapter);
      this.refreshStoryInterludes();
      this.refreshWorldStateVisuals();
      this.grantXp(240 + index * 40);
      this.spawnNova(this.state.player.x, this.state.player.y + 1, this.state.player.z, TRUTH_SHARDS[zoneId].color);
      this.toast(`Truth Shard ${TRUTH_SHARDS[zoneId].title} đã được lưu. Hậu quả đã áp dụng vào thế giới.`, "success");
      this.reconcileStoryObjective();
      await this.saveProgress(`Truth Shard · ${TRUTH_SHARDS[zoneId].title}`);
      this.renderCurrentPanel();
    }

    linkZoneEchoes(zoneId) {
      const echoes = ECHO_MEMORIES.filter((echo) => echo.zoneId === zoneId);
      if (echoes.length !== 2 || !echoes.every((echo) => this.state.story.echoes[echo.id]?.unlocked)) return;
      const alreadyLinked = this.state.story.constellationLinks.some((link) => (
        [link.from, link.to].includes(echoes[0].id) && [link.from, link.to].includes(echoes[1].id)
      ));
      if (alreadyLinked) {
        if (zoneId === "abyss") {
          this.state.story.endingFlags.genesisPurpose = true;
          this.state.story.hiddenSignals.genesisIsEscapeRoute = true;
        }
        return;
      }
      this.state.story.constellationLinks.push({ id: uid("echo-link"), from: echoes[0].id, to: echoes[1].id, createdAt: nowIso() });
      if (zoneId === "abyss") {
        this.state.story.endingFlags.genesisPurpose = true;
        this.state.story.hiddenSignals.genesisIsEscapeRoute = true;
      }
      this.recordWorldEvent({ type: "echo-link", title: `Memory Constellation · ${TRUTH_SHARDS[zoneId].title}`, detail: `Đã nối “${echoes[0].title}” với “${echoes[1].title}”.`, zoneId });
      this.toast("Hai Echo đã được nối. Một nghi vấn mới xuất hiện trong Codex.", "success");
      this.refreshStoryInterludes();
      this.saveProgress("Nối Echo Memory");
      this.renderCurrentPanel();
    }

    resumeStoryMission() {
      const mission = STORY_MISSIONS.find((item) => ["active", "decision"].includes(this.state.story.missions[item.zoneId]?.status));
      if (!mission) return this.openPanel("story");
      const record = this.state.story.missions[mission.zoneId];
      if (record.status === "decision") return this.openPanel("story");
      if (this.currentZone.id !== mission.zoneId && this.state.checkpoints[mission.zoneId]) {
        const zone = ZONES.find((item) => item.id === mission.zoneId);
        this.teleport(zone.x, zone.z + 5, zone.name);
      }
      const objective = STORY_OBJECTIVES[mission.zoneId]?.[record.progress];
      this.closePanel();
      if (objective) this.toast(`Mục tiêu: ${objective.label}`);
    }

    applyEndingConsequences(endingId) {
      const zones = this.state.world.zones;
      if (endingId === "restoration") {
        Object.values(zones).forEach((zone) => {
          zone.restored = true;
          zone.controlState = "restored-constellation";
          zone.weatherSeverity = Math.min(Number(zone.weatherSeverity || 0.58), 0.64);
        });
      } else if (endingId === "perfect-silence") {
        this.state.world.activeEvent = null;
        Object.values(zones).forEach((zone) => {
          zone.controlState = "archive-stable";
          zone.weatherLabel = "Tĩnh lặng hoàn hảo";
          zone.weatherSeverity = 0.24;
        });
      } else if (endingId === "one-true-world") {
        Object.entries(zones).forEach(([zoneId, zone]) => {
          zone.controlState = zoneId === "central" ? "prime-world" : "merged-into-prime";
          zone.economyModifier = zoneId === "central" ? 0.76 : 1.2;
        });
      } else if (endingId === "free-constellation") {
        Object.values(zones).forEach((zone) => {
          zone.controlState = "independent-reality";
          zone.economyModifier = 0.92;
        });
      } else if (endingId === "astral-rebirth") {
        zones.central.core = "awakened";
        zones.central.controlState = "traveler-core";
        zones.central.weatherLabel = "Bình minh Astral";
        zones.central.weatherSeverity = 0.36;
        this.state.player.ultimate = 100;
      }
      Object.values(zones).forEach((zone) => { zone.updatedAt = nowIso(); });
      this.refreshWorldStateVisuals();
      this.updateWeatherAppearance();
    }

    async chooseStoryEnding(endingId) {
      const ending = STORY_ENDINGS.find((item) => item.id === endingId);
      const status = this.storyEndingStatus(endingId);
      if (!ending || !status.eligible) return this.toast("Ending này chưa đủ điều kiện từ save hiện tại.", "error");
      if (this.state.story.endingFlags.selected) {
        this.toast("Dòng thời gian kết thúc đã được khóa cho vòng chơi này.", "error");
        return;
      }
      this.state.story.endingFlags.selected = endingId;
      this.pendingStoryEnding = "";
      this.state.story.chapter = "epilogue";
      this.state.story.identityStatus = endingId === "astral-rebirth" ? "core" : endingId === "perfect-silence" ? "erased" : "remembered";
      this.applyEndingConsequences(endingId);
      this.revealLongTermConsequences("epilogue");
      this.recordWorldEvent({ type: "ending", title: ending.title, detail: ending.premise, zoneId: "abyss" });
      this.queueStoryRecap(`Ending · ${ending.title}`, ending.premise);
      await this.saveProgress(`Ending · ${ending.title}`);
      this.showStoryEnding(endingId);
    }

    async startStoryNewGamePlus() {
      if (!this.state.story.endingFlags.selected) return this.toast("Hãy hoàn thành và khóa một ending trước khi bắt đầu New Game+.", "error");
      await this.saveProgress("Checkpoint trước New Game+");
      const retainedEchoes = clone(this.state.story.echoes);
      const retainedLinks = clone(this.state.story.constellationLinks);
      const retainedInterludes = clone(this.state.story.interludes || {});
      const retainedGenesisPurpose = this.state.story.endingFlags.genesisPurpose === true;
      const retainedCodex = [...(this.state.exploration.codex || [])];
      const nextCycle = Number(this.state.story.newGamePlus || 0) + 1;
      this.state.story = defaultStoryState();
      this.state.story.newGamePlus = nextCycle;
      this.state.story.prologueCompletedAt = nowIso();
      this.state.story.prologueStage = "departure";
      this.state.story.chapter = "identity";
      this.state.story.echoes = retainedEchoes;
      this.state.story.constellationLinks = retainedLinks;
      this.state.story.interludes = { ...defaultStoryInterludeState(), ...retainedInterludes };
      this.state.story.metrics = { ...STORY_METRIC_DEFAULTS, causalityPressure: clamp(STORY_METRIC_DEFAULTS.causalityPressure + nextCycle * 10, 0, 100) };
      this.state.story.endingFlags.genesisPurpose = retainedGenesisPurpose;
      this.state.story.hiddenSignals = {
        echoRetentionDetected: true,
        aionRecognizesCycle: nextCycle,
        aionAwarenessLevel: clamp(nextCycle, 1, 99),
        voiceAuthorizationRecovered: true,
        playerAuthorizedErasure: true
      };
      this.state.checkpoints = Object.fromEntries(ZONES.map((zone) => [zone.id, zone.id === "central"]));
      this.state.world = defaultWorldState();
      const explorationDefaults = defaultState().exploration;
      this.state.exploration = { ...explorationDefaults, codex: retainedCodex };
      this.state.activatedGates = [];
      this.state.collectedNodes = [];
      this.state.puzzles = {};
      this.state.defeated = {};
      Object.assign(this.state.player, {
        x: 0,
        y: 1.2,
        z: 5,
        rotation: 0,
        checkpoint: "central",
        health: this.state.player.maxHealth,
        stamina: this.state.player.maxStamina,
        ultimate: 0
      });
      this.queueStoryRecap(`New Game+ ${nextCycle}`, "Echo Memory còn nguyên nhưng Aion nhận ra vòng lặp. Một số tín hiệu và hội thoại sẽ thay đổi.");
      this.recordStoryDialogue("Aion", `Vòng ${nextCycle} không bắt đầu từ số không. Tôi nhớ cách bạn đã cố xóa chính mình, và lần này tôi đã giữ lại một phần giọng nói của bạn.`, "central");
      this.recordWorldEvent({ type: "new-game-plus", title: `New Game+ ${nextCycle}`, detail: "Character DNA và Echo Memory được giữ; Truth Shard và hậu quả thế giới đã tái phân nhánh.", zoneId: "central" });
      this.currentZone = ZONES.find((zone) => zone.id === "central") || ZONES[0];
      this.enemies.forEach((enemy) => {
        enemy.userData.health = enemy.userData.maxHealth;
        enemy.userData.defeated = false;
        enemy.userData.respawnAt = 0;
        enemy.visible = true;
      });
      this.collectibles.forEach((node) => { node.visible = true; });
      this.puzzleNodes.forEach((puzzle) => {
        puzzle.userData.solved = false;
        puzzle.children.forEach((child) => { if (child.material) child.material.emissiveIntensity = 0.18; });
      });
      this.storyBeacons.forEach((beacon) => {
        beacon.userData.core.material.emissiveIntensity = 0.72;
        beacon.userData.ring.material.opacity = 0.58;
      });
      reconcileStoryState(this.state);
      this.applyStateToWorld();
      this.updateWeatherAppearance();
      await this.saveProgress(`New Game+ ${nextCycle}`);
      this.toast(`New Game+ ${nextCycle} bắt đầu · Echo Memory được giữ.`, "success");
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
      const record = this.state.companions[id] || (this.state.companions[id] = { unlocked: id === "lyra", bond: 0, trust: 0, fear: 0, loyalty: 0, memoryIntegrity: 10, beliefs: defaultCompanionBeliefs(id), storyStage: 0, lastActivityAt: "" });
      if (record.departed) return this.toast("Đồng đội này đang rời đội; cần giải quyết hậu quả cốt truyện trước.", "error");
      if (record.lastActivityAt && Date.now() - new Date(record.lastActivityAt).getTime() < 60000) return this.toast("Đồng đội cần một phút để hồi phục sau cuộc trò chuyện.", "error");
      record.unlocked = true;
      record.bond = clamp(Number(record.bond || 0) + 1, 0, 10);
      record.trust = clamp(Number(record.trust || 0) + (record.fear > record.trust ? 0 : 1), -10, 10);
      record.loyalty = clamp(Number(record.loyalty || 0) + (record.bond % 2 === 0 ? 1 : 0), -10, 10);
      if (id === "cael" && record.storyStage >= 2) record.memoryIntegrity = clamp(Number(record.memoryIntegrity || 10) - 1, 0, 10);
      record.storyStage = Math.min(5, Math.floor(record.bond / 2));
      record.lastActivityAt = nowIso();
      this.state.progression.mastery[id].bond += 10;
      const dialogue = {
        lyra: "Tôi đã hứa sẽ bảo vệ bạn, nhưng không hứa rằng mình chưa từng phản bội bạn.",
        cael: "Tôi nhớ một căn nhà nơi chúng ta từng sống. Mỗi lần kể lại, tôi quên mất một căn phòng khác.",
        nyx: "Tiếng nói dưới Abyss gọi bạn bằng tên mà chính bạn cũng chưa biết.",
        sol: "Nếu lựa chọn của bạn đe dọa số đông, lòng trung thành của tôi sẽ có giới hạn."
      }[id];
      this.recordStoryDialogue(CHARACTERS[id].name, dialogue, this.currentZone.id);
      this.recordWorldEvent({ type: "companion", title: `Đối thoại: ${COMPANION_STORIES[id].title}`, detail: `${CHARACTERS[id].name} · Bond ${record.bond}/10 · Trust ${record.trust}.`, zoneId: this.currentZone.id });
      this.toast(`${CHARACTERS[id].name} đã chia sẻ một ký ức mới.`, "success");
      this.saveProgress("Đối thoại đồng đội");
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
      if (!STORY_ZONE_ORDER.includes(zone.id) || !this.state.world.zones[zone.id]) return this.toast("Bí cảnh này không có điểm neo ổn định để Deep Scan.", "error");
      const id = `zone:${zone.id}:scan`;
      if (this.state.exploration.scans.includes(id)) {
        const progressed = this.progressStoryObjective("scan", { zoneId: zone.id });
        return this.toast(progressed ? "Dữ liệu Deep Scan cũ đã được nối vào nhiệm vụ hiện tại." : "Khu vực này đã được quét.", progressed ? "success" : "info");
      }
      this.state.exploration.scans.push(id);
      this.state.exploration.codex.push(zone.id);
      this.state.exploration.mapFog[zone.id] = clamp((this.state.exploration.mapFog[zone.id] || 100) - 25, 0, 100);
      this.state.world.zones[zone.id].discovered = true;
      this.recordWorldEvent({ type: "scan", title: `Đã quét ${zone.name}`, detail: "Entry mới được thêm vào Astral Codex.", zoneId: zone.id });
      const hiddenEcho = ECHO_MEMORIES.find((echo) => echo.zoneId === zone.id && !this.state.story.echoes[echo.id]?.unlocked);
      if (hiddenEcho) this.unlockStoryEcho(hiddenEcho.id, `Deep Scan tại ${zone.name}`);
      this.progressStoryObjective("scan", { zoneId: zone.id });
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
        if (zone && this.state.checkpoints[zone.id]) this.teleport(zone.x, zone.z + 5, zone.name);
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
      else if (action === "story-resume") this.resumeStoryMission();
      else if (action === "story-play") {
        const active = this.storyObjective(data.zone);
        this.closePanel();
        if (active?.objective) this.toast(`Mục tiêu gameplay: ${active.objective.label}`);
      }
      else if (action === "story-scan") this.scanCurrentZone();
      else if (action === "story-choice-preview") {
        this.pendingStoryChoice = { zoneId: data.zone, choiceId: data.choice };
        this.renderCurrentPanel();
      }
      else if (action === "story-choice-confirm") await this.resolveStoryMissionChoice(data.zone, data.choice);
      else if (action === "story-choice-cancel") {
        this.pendingStoryChoice = null;
        this.renderCurrentPanel();
      }
      else if (action === "story-view-interlude") this.markStoryInterludeViewed(data.interlude);
      else if (action === "story-teleport") {
        const zone = ZONES.find((item) => item.id === data.zone);
        if (zone && this.state.checkpoints[zone.id]) {
          this.teleport(zone.x, zone.z + 5, zone.name);
        }
      }
      else if (action === "link-zone-echoes") this.linkZoneEchoes(data.zone);
      else if (action === "story-scroll") {
        this.root.querySelector(`#${String(data.storyTarget || "").replace(/[^a-z-]/g, "")}`)?.scrollIntoView?.({ behavior: this.state.settings.reduceEffects ? "auto" : "smooth", block: "start" });
      }
      else if (action === "choose-ending-preview") {
        this.pendingStoryEnding = data.ending;
        this.renderCurrentPanel();
      }
      else if (action === "choose-ending-confirm") await this.chooseStoryEnding(data.ending);
      else if (action === "choose-ending-cancel") {
        this.pendingStoryEnding = "";
        this.renderCurrentPanel();
      }
      else if (action === "story-recap") this.showStoryRecap();
      else if (action === "story-replay") this.showStoryPrologue({ replay: true });
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
      else if (action === "appearance-finish") {
        this.state.appearance.creatorVersion = CHARACTER_VISUAL_VERSION;
        this.state.appearance.lastSavedAt = nowIso();
        await this.saveProgress("Hoàn tất chỉnh sửa ngoại hình");
        this.closePanel();
        this.toast("Đã lưu ngoại hình. Chào mừng trở lại H-Central!", "success");
      }
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
        this.runtime?.pause?.({ gameId: GAME_ID, reason: "user" });
        this.openPanel("paused");
      } else {
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
      this.pendingSaveLabel = String(label || "Autosave").slice(0, 120);
      if (this.savingPromise) return this.savingPromise;
      this.savingPromise = (async () => {
        let latestRecord = this.savedRecord;
        while (this.pendingSaveLabel && !this.destroyed) {
          const label = this.pendingSaveLabel;
          this.pendingSaveLabel = "";
          this.state.updatedAt = nowIso();
          try {
            const record = await this.store.save(this.snapshot(), "slot1", label);
            this.savedRecord = record;
            this.state.saveVersion = record.version;
            this.lastSaveAt = Date.now();
            latestRecord = record;
            try {
              this.runtime?.checkpoint?.(this.snapshot(), { slot: "slot-1", label });
            } catch {
              // IndexedDB is authoritative; an optional shared runtime checkpoint
              // must never turn a successful local save into a visible failure.
            }
          } catch (error) {
            this.toast(error.message || "Không lưu được tiến trình.", "error");
          }
        }
        return latestRecord;
      })().finally(() => {
        this.savingPromise = null;
        if (this.pendingSaveLabel && !this.destroyed) this.saveProgress(this.pendingSaveLabel);
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
        story: this.state.story,
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
          sourceProviderId: activeCharacterMesh?.userData?.sourceProviderId || "hero-core",
          catalogModels: 0,
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
        worldArt: {
          version: WORLD_ART_VERSION,
          signature: this.worldArtSignature,
          environment: this.worldArtTarget?.snapshot || this.resolveWorldArtState(this.currentZone?.id || "central"),
          storyGroups: this.storyEnvironmentGroups.size,
          animatedObjects: this.worldArtAnimatedObjects.length,
          shadowCandidates: this.worldArtShadowCandidates.length,
          transition: this.state.settings.reduceEffects ? "instant" : "lerp",
          visibilityPaused: document.visibilityState === "hidden"
        },
        rendererHealth: {
          failures: this.runtimeFailureCount,
          lastFrameAt: this.lastRenderSuccessAt
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
        story: {
          version: this.state.story?.version || STORY_VERSION,
          chapter: this.state.story?.chapter || "prologue",
          prologueComplete: Boolean(this.state.story?.prologueCompletedAt),
          truthShards: Object.values(this.state.story?.truthShards || {}).filter((record) => record.discovered).length,
          echoes: Object.values(this.state.story?.echoes || {}).filter((record) => record.unlocked).length,
          links: this.state.story?.constellationLinks?.length || 0,
          decisions: this.state.story?.decisions?.length || 0,
          aionEvidence: this.state.story?.aionEvidence || 0,
          metrics: normalizeStoryMetrics(this.state.story?.metrics, STORY_METRIC_DEFAULTS),
          interludes: Object.values(this.state.story?.interludes || {}).filter((record) => record.unlocked).length,
          voiceAuthorization: Boolean(this.state.story?.hiddenSignals?.voiceAuthorizationRecovered),
          ending: this.state.story?.endingFlags?.selected || "",
          newGamePlus: this.state.story?.newGamePlus || 0
        },
        companions: Object.fromEntries(Object.entries(this.state.companions || {}).map(([id, record]) => [id, {
          bond: record.bond,
          trust: record.trust,
          fear: record.fear,
          loyalty: record.loyalty,
          memoryIntegrity: record.memoryIntegrity,
          beliefs: normalizeCompanionBeliefs(record.beliefs, id),
          storyStage: record.storyStage,
          unlocked: record.unlocked,
          departed: record.departed
        }]))
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
      if (this.scene) this.disposeCharacterObject(this.scene);
      Object.values(this.photorealAssets).forEach((texture) => texture?.dispose?.());
      this.disposeBuiltInCharacterAssets();
      this.disposeLicensedEnvironmentAssets();
      Object.values(this.characterDetailTextures || {}).forEach((texture) => texture?.dispose?.());
      this.toonGradient?.dispose?.();
      this.terrainTexture?.dispose?.();
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
