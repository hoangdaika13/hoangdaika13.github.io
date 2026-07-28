(function (root) {
  "use strict";

  const GAME_ID = "astral-realms";
  const SCHEMA_VERSION = 6;
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
  const CHARACTER_VISUAL_VERSION = 11;
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
    leftFoot: ["LeftFoot", "foot.L", "mixamorigLeftFoot", "foot_l"],
    rightFoot: ["RightFoot", "foot.R", "mixamorigRightFoot", "foot_r"]
  });
  const CHARACTER_MOTION_LIBRARY = Object.freeze({
    idle: ["idle", "breathing", "stand"],
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
    { id: "metahuman", name: "MetaHuman Web Hero", role: "GLB đã retopology cho hero/cinematic", state: "Kiểm tra khi nhập" },
    { id: "makehuman", name: "MakeHuman / MPFB", role: "Nguồn NPC được tối ưu bên ngoài", state: "Kiểm tra skeleton" },
    { id: "readyplayerme", name: "Ready Player Me", role: "Avatar GLB do người chơi tạo", state: "Draco/Meshopt/KTX2" },
    { id: "mixamo", name: "Mixamo", role: "Clip locomotion có sẵn trong GLB", state: "Phát clip theo tên" },
    { id: "rokoko", name: "Rokoko Vision", role: "Motion capture xuất GLB", state: "Nhập clip cục bộ" },
    { id: "mediapipe", name: "MediaPipe Face", role: "52 blendshape trên thiết bị", state: "Opt-in camera" },
    { id: "environment", name: "HH Volumetric World", role: "Địa hình mesh 3D và panorama chỉ dùng làm IBL", state: "Không dùng ảnh làm phông nền" },
    { id: "three", name: "Three.js GLTF", role: "GLB rigged, mixer, morph, viseme và 3D LOD", state: "Runtime V11" }
  ]);
  const APPEARANCE_VERSION = 5;
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
    baseModels: ["human-adult-a01", "human-adult-b01"],
    skins: ["warm-04", "neutral-03", "cool-02", "deep-05"],
    hairs: ["astral-layered-07", "aurora-short-02", "void-long-04", "solar-braid-03"],
    beards: ["none", "shadow-01", "short-boxed-02", "astral-goatee-03"],
    brows: ["natural-01", "soft-02", "defined-03", "bold-04"],
    makeups: ["none", "natural", "nebula", "cyber", "solar"],
    accessories: ["none", "ear-cuff", "visor", "astral-mark"],
    outfits: ["central-jacket-02", "combat-boots-01", "aurora-suit-01", "void-coat-01"],
    lighting: ["daylight", "night", "neon", "cinematic"]
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
    "human-adult-a01": "./assets/astral-realms/hh-human-asteria-v1.glb",
    "human-adult-b01": "./assets/astral-realms/hh-human-vanguard-v1.glb"
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
    return {
      appearanceVersion: APPEARANCE_VERSION,
      baseModel: ["cael", "sol"].includes(characterId) ? "human-adult-b01" : "human-adult-a01",
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
    return {
      ...base,
      appearanceVersion: APPEARANCE_VERSION,
      baseModel: APPEARANCE_ASSETS.baseModels.includes(recipe.baseModel) ? recipe.baseModel : base.baseModel,
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
        lastSavedAt: "",
        creatorCompletedAt: "",
        creatorVersion: 0
      },
      inventory: {
        "starter-blade": { quantity: 1, favorite: true, locked: true, acquiredAt: nowIso() }
      },
      quests: defaultQuestState(),
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
        characterMode: "rigged",
        characterQuality: "adaptive",
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
      inventory: input.inventory && typeof input.inventory === "object" ? input.inventory : base.inventory,
      quests: { ...base.quests, ...(input.quests || {}) },
      world: {
        ...base.world,
        ...(input.world || {}),
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
    if (!["auto", "low", "medium", "high", "cinematic"].includes(state.settings.quality)) state.settings.quality = "auto";
    if (!["realistic", "cinematic", "anime"].includes(state.settings.renderStyle)) state.settings.renderStyle = "realistic";
    if (!["auto", "webgpu", "webgl"].includes(state.settings.rendererMode)) state.settings.rendererMode = "auto";
    if (!["photoreal", "hybrid", "performance"].includes(state.settings.visualStyle)) state.settings.visualStyle = "photoreal";
    if (!["rigged", "portrait"].includes(state.settings.characterMode)) state.settings.characterMode = "rigged";
    if (!["adaptive", "hero", "near", "crowd"].includes(state.settings.characterQuality)) state.settings.characterQuality = "adaptive";
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
      this.builtInCharacterStatus = "pending";
      this.characterDetailTextures = null;
      this.lastCharacterQa = null;
      this.motionState = { gaitPhase: 0, foot: "", yawVelocity: 0 };
      this.facePilot = { status: "off", stream: null, video: null, landmarker: null, frame: 0, blendshapes: {}, error: "", lastDetectionAt: 0, lastResultAt: 0 };
      this.facePreview = { expression: "neutral", viseme: "neutral", until: 0 };
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
      this.cameraPitch = 0.58;
      this.cameraDistance = 12;
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
                <div class="har-genesis__scan"><i></i><i></i><i></i></div>
                <div class="har-genesis__camera-note"><strong data-genesis-model-name>ASTERIA HUMAN</strong><span>Giữ và kéo trên nhân vật để xoay camera</span></div>
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
        this.setLoading(69, "Đang nạp hai Human Rig 3D và chuyển động toàn thân...");
        await this.loadBuiltInCharacterAssets();
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

    renderGenesisCreator() {
      const id = this.state.roster.activeId;
      const recipe = this.activeAppearanceRecipe();
      const group = APPEARANCE_GROUPS.find((item) => item.id === this.appearanceGroup) || APPEARANCE_GROUPS[0];
      const mesh = this.characterMeshes.get(id);
      const runtime = this.characterRuntimes.get(id);
      const fit = this.buildAppearanceFitReport(recipe, mesh);
      const modelLabels = {
        "human-adult-a01": ["Asteria Human", "Human Rig · 16K vertices · Digital Human runtime"],
        "human-adult-b01": ["Vanguard Human", "Combat Rig · 7K vertices · LOD hiệu năng"]
      };
      const faceChannels = Math.min(52, Number(runtime?.facialChannels || 0));
      const dna = encodeCharacterDNA(recipe, id);
      const option = (value, label, selected) => `<option value="${value}" ${selected === value ? "selected" : ""}>${label}</option>`;
      return `
        <div class="har-genesis-editor__intro">
          <small>DIGITAL HUMAN CORE V${CHARACTER_VISUAL_VERSION} · ${escapeHtml(modelLabels[recipe.baseModel]?.[0] || "HUMAN RIG")}</small>
          <h2>Tạo con người 3D của bạn</h2>
          <p>Chỉnh trực tiếp mesh có xương, vật liệu da nhiều lớp, biểu cảm, viseme và LOD trong khung hình thật của game.</p>
        </div>
        <div class="har-genesis-capabilities" aria-label="Năng lực Digital Human">
          <div><small>FACE DRIVER</small><strong>478 / 52</strong><span>landmark / blendshape · ${faceChannels} native morph</span></div>
          <div><small>SURFACE</small><strong>5 lớp</strong><span>pore · roughness · SSS · flush · wetness</span></div>
          <div><small>MOTION</small><strong>8 hướng</strong><span>crossfade · inertial response · IK-ready</span></div>
          <div><small>LOD</small><strong>${escapeHtml(mesh?.userData?.modelTier || "hero")}</strong><span>${CHARACTER_MODEL_TIERS[mesh?.userData?.modelTier || "hero"]?.updateHz || 60} Hz update</span></div>
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
      if (name) name.textContent = recipe.baseModel === "human-adult-b01" ? "VANGUARD HUMAN" : "ASTERIA HUMAN";
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
      this.playerMesh.position.set(this.state.player.x, this.state.player.y, this.state.player.z);
      this.setGenesisMotion("idle");
      this.refreshGenesisCreator();
      this.updateCamera(true, 0.016);
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
      this.updateCamera(true, 0.016);
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
      this.restoreGenesisLighting();
      await this.saveProgress("Hoàn tất Character Genesis");
      const section = this.root.querySelector("[data-har-genesis]");
      if (section) section.hidden = true;
      this.root.classList.remove("is-genesis");
      this.genesisActive = false;
      this.genesisCompleting = false;
      this.updateUi(true);
      this.beginRuntimeSession(`${this.state.player.name} đã sẵn sàng · bước vào H-Central.`);
    }

    resetGraphicsAfterFailure() {
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
      this.streamingGroups.clear();
      this.zoneFxGroups.clear();
      this.livingWorldActors = [];
      this.footprints = [];
      Object.values(this.photorealAssets).forEach((texture) => texture?.dispose?.());
      this.photorealAssets = { panorama: null };
      this.disposeBuiltInCharacterAssets();
      this.photorealStatus = "pending";
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
      this.clock = new THREE.Clock();
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

    async loadBuiltInCharacterAssets() {
      if (!this.GLTFLoaderClass || !this.cloneSkinnedCharacter) {
        this.builtInCharacterStatus = "fallback";
        this.root.dataset.builtInCharacter = "fallback";
        return;
      }
      this.builtInCharacterStatus = "loading";
      const loader = new this.GLTFLoaderClass();
      const entries = Object.entries(BUILTIN_CHARACTER_ASSETS);
      const results = await Promise.allSettled(entries.map(async ([id, url]) => {
        const gltf = await Promise.race([
          loader.loadAsync(url),
          new Promise((_, reject) => root.setTimeout(() => reject(new Error(`Quá thời gian tải ${url}`)), 12000))
        ]);
        this.sanitizeBuiltInCharacterAsset(gltf);
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
      this.builtInCharacterStatus = "pending";
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
      this.createElementalPuzzles();
      this.createWeatherField();
      this.createLivingWorldEffects();
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
        roughness: 0.18,
        metalness: 0.06,
        transparent: true,
        opacity: 0.72,
        clearcoat: 0.85,
        clearcoatRoughness: 0.12,
        side: THREE.DoubleSide
      });
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
        actor.angle += dt * actor.speed;
        actor.mesh.position.x = Math.cos(actor.angle) * actor.radius;
        actor.mesh.position.z = Math.sin(actor.angle) * actor.radius;
        actor.mesh.position.y = actor.baseY + Math.sin(time * 0.0013 + actor.radius) * actor.vertical;
        actor.mesh.rotation.y = -actor.angle + Math.PI / 2;
        actor.mesh.rotation.z += dt * 0.18;
      });
      this.zoneFxGroups.forEach((group) => {
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
          } else if (role === "eyes") {
            material.color?.set(recipe.eyeColor);
            if ("roughness" in material) material.roughness = 0.08;
            if ("clearcoat" in material) material.clearcoat = 0.78 + (recipe.morphs.eyeReflection || 0.5) * 0.22;
            if ("ior" in material) material.ior = 1.376;
            if ("transmission" in material) material.transmission = 0.04;
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

    createBuiltInRiggedCharacter(profile, scale = 1) {
      const recipe = normalizeAppearanceRecipe(this.state.appearance?.recipes?.[profile.id], profile.id);
      const modelId = BUILTIN_CHARACTER_ASSETS[recipe.baseModel] ? recipe.baseModel : defaultAppearanceRecipe(profile.id).baseModel;
      const source = this.builtInCharacterAssets.get(modelId);
      if (!source?.scene || !this.cloneSkinnedCharacter) return null;
      const assetNeedsVisualRecovery = Number(source.userData?.hhTextureFallbacks || 0) > 0
        || Number(source.userData?.hhRenderableMeshes || 0) < 1;
      const THREE = this.THREE;
      const wrapper = new THREE.Group();
      wrapper.name = `HHHumanRig:${profile.id}`;
      wrapper.scale.setScalar(scale);
      const asset = this.cloneSkinnedCharacter(source.scene);
      asset.name = `${modelId}:${profile.id}`;
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
            materialRole: materialName.includes("visor") ? "eyes" : "outfit",
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
      const crowdProxy = this.createCharacterMesh({ body: profile.body, accent: profile.accent, scale: 0.94 });
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
        visualMode,
        sourceProvider: assetNeedsVisualRecovery
          ? "HH Articulated PBR Recovery"
          : modelId === "human-adult-a01" ? "HH Asteria Human Rig" : "HH Vanguard Human Rig",
        modelTier: initialTier,
        appearanceCapability: "skeleton-proportions",
        gameplayCollider: { radius: 0.48, height: 2.95 },
        gltfAsset: asset,
        builtInModelId: modelId,
        builtInAnimations: this.builtInCharacterAssets.get("human-adult-b01")?.animations || source.animations || [],
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
            const image = texture.image || texture.source?.data;
            report.maxTextureSize = Math.max(report.maxTextureSize, Number(image?.width || 0), Number(image?.height || 0));
          });
        });
      });
      report.materials = materials.size;
      report.textures = textures.size;
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
        motionSpeed: 0,
        motionDirection: 0,
        secondaryBones: [],
        lastLodUpdateAt: 0,
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
          const lodMatch = String(object.name || "").match(/^lod([0-3])(?:\b|_)/i);
          if (lodMatch) {
            const lodTier = ["hero", "near", "crowd", "impostor"][Number(lodMatch[1])];
            runtime.lodVariants[lodTier] ||= [];
            runtime.lodVariants[lodTier].push(object);
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
      if (runtime.currentAction) runtime.currentAction.crossFadeTo(next, transitionSeconds, true);
      else next.fadeIn(Math.min(0.16, transitionSeconds));
      next.play();
      runtime.currentAction = next;
      runtime.actionTimeScale = fittedTimeScale;
      runtime.transition = {
        from: runtime.previousState,
        to: state,
        startedAt: performance.now(),
        duration: transitionSeconds,
        mode: "inertial-crossfade"
      };
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
      const drivenFace = pilot || (previewFresh ? this.facePreview.values : null) || talkViseme;
      const lowHealth = 1 - clamp(this.state.player.health / Math.max(1, this.state.player.maxHealth), 0, 1);
      if (!drivenFace && time >= faceState.nextBlinkAt && !faceState.blinkStartedAt) {
        faceState.blinkStartedAt = time;
        faceState.nextBlinkAt = time + 1900 + Math.random() * 4200;
      }
      const blinkElapsed = faceState.blinkStartedAt ? time - faceState.blinkStartedAt : -1;
      const blink = drivenFace
        ? Math.max(drivenFace.eyeBlinkLeft || 0, drivenFace.eyeBlinkRight || 0)
        : blinkElapsed >= 0 && blinkElapsed < 180
          ? Math.sin((blinkElapsed / 180) * Math.PI)
          : 0;
      if (blinkElapsed >= 180) faceState.blinkStartedAt = 0;
      const smile = drivenFace
        ? ((drivenFace.mouthSmileLeft || 0) + (drivenFace.mouthSmileRight || 0)) * 0.5
        : motion === "idle" ? 0.08 : 0;
      const pain = motion === "hit" || motion === "defeated" ? 0.9 : lowHealth * 0.28;
      const jawOpen = drivenFace?.jawOpen || (["skill", "ultimate"].includes(motion) ? 0.26 : 0);
      const neutralFace = Object.fromEntries(MEDIAPIPE_FACE_CHANNELS.map((channel) => [channel, 0]));
      const faceValues = {
        ...neutralFace,
        ...(drivenFace || {
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
      if (!parts?.eyes || !parts?.mouth) return;
      if (time >= faceState.nextSaccadeAt) {
        faceState.nextSaccadeAt = time + 420 + Math.random() * 1900;
        faceState.saccadeX = (Math.random() - 0.5) * 0.018;
        faceState.saccadeY = (Math.random() - 0.5) * 0.012;
      }
      parts.eyes.forEach((eye, index) => {
        const pilotBlink = index === 0 ? faceValues.eyeBlinkLeft : faceValues.eyeBlinkRight;
        const value = drivenFace ? pilotBlink || 0 : blink;
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
      const forced = this.state.settings.characterMode === "portrait"
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

    applyFootContactIK(runtime, phase, strength = 1) {
      if (!runtime || runtime.lodSuspended || !this.state.settings.naturalMotion) return;
      const leftFoot = runtime.bones?.leftFoot;
      const rightFoot = runtime.bones?.rightFoot;
      [[leftFoot, phase], [rightFoot, -phase]].forEach(([foot, wave]) => {
        if (!foot) return;
        foot.userData ||= {};
        foot.userData.hhFootBase ??= { x: foot.rotation.x, z: foot.rotation.z };
        const base = foot.userData.hhFootBase;
        const plant = clamp(1 - Math.max(0, wave) * 1.8, 0, 1);
        foot.rotation.x += ((base.x - wave * 0.055 * strength) - foot.rotation.x) * (0.12 + plant * 0.12);
        foot.rotation.z += (base.z - foot.rotation.z) * 0.18;
      });
      runtime.ikState = {
        foot: "raycast-ready",
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
      asset.position.x -= center.x;
      asset.position.z -= center.z;
      asset.position.y -= fitted.min.y;
      const importedMeshes = [];
      asset.traverse((object) => {
        if (!object.isMesh && !object.isSkinnedMesh) return;
        importedMeshes.push(object);
        object.castShadow = true;
        object.receiveShadow = true;
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        materials.filter(Boolean).forEach((material) => {
          material.envMapIntensity = Math.max(material.envMapIntensity || 0, this.photorealAssets.panorama ? 0.72 : 0.18);
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

    applyStateToWorld() {
      const player = this.state.player;
      const activeId = CHARACTERS[this.state.roster.activeId] ? this.state.roster.activeId : "lyra";
      const activeProfile = CHARACTERS[activeId];
      this.characterMeshes.forEach((mesh, id) => {
        mesh.visible = id === activeId;
        mesh.position.set(player.x, player.y, player.z);
        mesh.rotation.y = player.rotation;
      });
      this.playerMesh = this.characterMeshes.get(activeId) || this.playerMesh;
      this.playerWeapon = this.playerMesh?.userData?.weapon || this.playerWeapon;
      player.name = activeProfile.name;
      player.element = activeProfile.element;
      this.playerMesh.position.set(player.x, player.y, player.z);
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
      this.listen(this.root, "click", (event) => {
        const genesisGroup = event.target.closest("[data-genesis-group]");
        if (genesisGroup) {
          this.appearanceGroup = genesisGroup.dataset.genesisGroup;
          const group = APPEARANCE_GROUPS.find((item) => item.id === this.appearanceGroup);
          this.appearanceFocus = group?.focus || "body";
          this.cameraDistance = this.appearanceFocus === "head" ? 5.1 : 7.8;
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
            this.cameraDistance = 7.8;
          } else if (genesisAction === "focus-head") {
            this.appearanceFocus = "head";
            this.cameraDistance = 5.1;
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
      this.listen(this.root, "change", (event) => {
        if (event.target.matches("[data-genesis-morph], [data-genesis-setting], [data-genesis-decal], [data-genesis-surface]")) {
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
        if (/^(INPUT|TEXTAREA|SELECT)$/.test(event.target?.tagName || "")) return;
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
        this.cameraDistance = clamp(this.cameraDistance + Math.sign(event.deltaY) * 1.25, 6.5, 20);
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
        mesh.position.set(this.state.player.x, this.state.player.y, this.state.player.z);
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
      const lowDetailTier = ["crowd", "impostor"].includes(mesh.userData?.modelTier);
      if (runtime) {
        const targetSpeed = moving ? clamp(input?.magnitude || 1, 0, 1) * (sprinting ? 1.35 : 1) : 0;
        runtime.motionSpeed += (targetSpeed - runtime.motionSpeed) * (1 - Math.exp(-dt * 12));
        runtime.motionDirection += (Math.atan2(input?.x || 0, input?.z || 1) - runtime.motionDirection) * (1 - Math.exp(-dt * 10));
        runtime.motionWarp = {
          speed: runtime.motionSpeed,
          direction: runtime.motionDirection,
          target: this.lockedTargetId || "",
          mode: this.lockedTargetId ? "combat-facing" : "locomotion-facing"
        };
      }
      if (runtime?.mixer && !runtime.lodSuspended) {
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
      }

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
      this.applyFootContactIK(runtime, phase, moving && this.isGrounded ? 1 : 0.25);
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
            }
            this.applyProceduralFacialPerformance(this.playerMesh, time, this.genesisMotion || "idle");
            this.updateSecondaryCharacterMotion(runtime, time, {
              moving: ["walk", "run", "strafe"].includes(this.genesisMotion),
              sprinting: this.genesisMotion === "run",
              direction: this.genesisMotion === "strafe" ? 0.8 : 0
            });
            if (this.genesisTurntable && !this.state.settings.reduceEffects) {
              this.cameraYaw = (this.cameraYaw + dt * 0.34) % (Math.PI * 2);
            }
          }
          this.updateCamera(false, dt);
          this.renderer.render(this.scene, this.camera);
          this.lastRenderSuccessAt = time;
          this.trackFps(time);
          if (time - this.lastUiAt > 120) {
            this.lastUiAt = time;
            this.updateUi(false);
          }
          if (time - this.lastMinimapAt > 180) {
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

      this.playerMesh.position.set(player.x, player.y, player.z);
      this.characterMeshes.forEach((mesh, id) => {
        if (id === this.state.roster.activeId) return;
        mesh.position.set(player.x, player.y, player.z);
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
      this.world.traverse((object) => {
        if (object.userData?.spin) object.rotation.z += dt * object.userData.spin;
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
      if (this.moonDisc) this.moonDisc.position.set(Math.cos(celestialAngle + Math.PI) * 150, Math.sin(celestialAngle + Math.PI) * 110, -82);
      if (this.sunLight) this.sunLight.position.set(
        Math.cos(celestialAngle) * 58,
        Math.max(8, Math.sin(celestialAngle) * 68),
        Math.sin(celestialAngle * 0.7) * 38
      );
      const dayColor = new this.THREE.Color().setRGB(
        0.018 + dayAmount * 0.035,
        0.026 + dayAmount * 0.04,
        0.07 + dayAmount * 0.08
      );
      if (this.scene.background?.isColor) this.scene.background.copy(dayColor);
      const biomeProfile = BIOME_PROFILES[this.currentZone.id] || BIOME_PROFILES.central;
      const biomeFog = new this.THREE.Color(biomeProfile.fog).lerp(dayColor, 0.24 + dayAmount * 0.16);
      this.scene.fog.color.lerp(biomeFog, clamp(dt * 2.6, 0, 1));
      this.scene.fog.density += (biomeProfile.fogDensity - this.scene.fog.density) * clamp(dt * 1.8, 0, 1);
      this.hemisphereLight.intensity = 0.85 + dayAmount * 1.2;
      this.sunLight.intensity = 0.45 + dayAmount * 2.15;
      this.hLight.intensity = 35 + (1 - dayAmount) * 25;
      if (this.fillLight) this.fillLight.intensity = 0.28 + dayAmount * 0.45;
      if (this.rimLight) this.rimLight.intensity = 0.38 + (1 - dayAmount) * 0.52;
      if (this.skyDome) {
        this.skyDome.material.color.set(dayAmount > 0.4 ? 0x8fa9d8 : 0x524084);
        this.skyDome.material.color.multiplyScalar(0.42 + dayAmount * 0.58);
      }
      if (this.auroraVeil) {
        this.auroraVeil.rotation.z += dt * 0.018;
        this.auroraVeil.material.opacity = (1 - dayAmount) * 0.18 + (this.currentZone.id === "aurora" ? 0.09 : 0.02);
      }
      this.cloudLayers.forEach((cloud) => {
        cloud.rotation.y += dt * 0.006;
        cloud.position.x += dt * cloud.userData.drift;
        if (cloud.position.x > 115) cloud.position.x = -115;
      });
      this.waterSurfaces.forEach((water, index) => {
        water.position.y = water.userData.baseY + Math.sin(time * 0.0017 + index) * 0.035;
        water.rotation.z += dt * (water.userData.lava ? 0.035 : -0.012);
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
        for (let index = 1; index < positions.length; index += 3) {
          const fallSpeed = this.currentZone.id === "crimson"
            ? 1.1
            : this.currentZone.id === "sky"
              ? 6.2
              : this.currentZone.id === "abyss"
                ? 0.65
                : 3.2;
          positions[index] -= dt * fallSpeed;
          if (positions[index] < 1) positions[index] = 18 + Math.random() * 8;
        }
        this.weatherField.geometry.attributes.position.needsUpdate = true;
      }
    }

    updateWorldStreaming() {
      const player = this.state.player;
      const quality = this.state.settings.quality;
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
      this.world.traverse((object) => {
        if (!object.isMesh || object === this.playerMesh || object.userData?.boss) return;
        if (object.userData.baseCastShadow === undefined) object.userData.baseCastShadow = Boolean(object.castShadow);
        const distance = Math.hypot(player.x - object.position.x, player.z - object.position.z);
        object.castShadow = Boolean(object.userData.baseCastShadow && this.renderer.shadowMap?.enabled && distance < shadowRadius);
      });
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
      this.weatherField.material.size = mode === "crimson" || mode === "abyss" ? 0.34 : mode === "aurora" || mode === "ocean" ? 0.24 : 0.18;
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
      const horizontal = Math.cos(this.cameraPitch) * this.cameraDistance;
      let desired = new this.THREE.Vector3(
        player.x + Math.sin(this.cameraYaw) * horizontal,
        player.y + 2.2 + Math.sin(this.cameraPitch) * this.cameraDistance,
        player.z + Math.cos(this.cameraYaw) * horizontal
      );
      const focus = new this.THREE.Vector3(player.x, player.y + 1.35, player.z);
      if (this.currentPanel === "creator" || this.genesisActive) {
        const focusOffset = this.genesisActive
          ? ({ head: 2.35, upper: 1.78, body: 1.46, lower: 0.76 }[this.appearanceFocus] ?? 1.46)
          : ({ head: 1.1, upper: 0.62, body: 0.88, lower: 0.28 }[this.appearanceFocus] ?? 0.88);
        focus.set(player.x, player.y + focusOffset, player.z);
        const creatorDistance = this.genesisActive
          ? clamp(this.cameraDistance, 4.5, 8.5)
          : clamp(this.cameraDistance, 6.5, 12);
        const creatorHorizontal = Math.cos(this.cameraPitch) * creatorDistance;
        desired.set(
          player.x + Math.sin(this.cameraYaw) * creatorHorizontal,
          player.y + focusOffset + Math.sin(this.cameraPitch) * creatorDistance,
          player.z + Math.cos(this.cameraYaw) * creatorHorizontal
        );
      }
      desired = this.updateCinematicCamera(desired, focus, dt);
      if (!this.photoMode) {
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
        text.textContent = active
          ? "Lõi H đã nhận diện cộng hưởng của bạn. Aurora Vale đang phát tín hiệu cầu cứu; hãy giúp tôi tái lập mạng cổng trước khi Hư Không lan tới thành phố."
          : "Các cổng đang phản hồi theo tiến trình của bạn. Nếu bị lạc, hãy mở Bản đồ và quay lại checkpoint đã kích hoạt.";
        choices.innerHTML = `
          ${active ? '<button class="har-primary-button" type="button" data-dialogue-action="accept">Tôi sẽ tới Aurora Vale</button>' : ""}
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
      this.playerMesh.position.set(this.state.player.x, this.state.player.y, this.state.player.z);
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
      this.root.querySelector("[data-har-weather]").textContent = this.currentZone.weather;
      const hour = Math.floor(this.state.worldTime);
      const minute = Math.floor((this.state.worldTime % 1) * 60);
      this.root.querySelector("[data-har-time]").textContent = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
      this.root.querySelector("[data-har-fps]").textContent = this.fps ? `${this.fps} FPS · scale ${Math.round(this.renderScale * 100)}%` : "Đang đo";
      this.root.querySelector("[data-har-renderer]").textContent = `${this.rendererBackend === "webgpu" ? "WEBGPU" : "WEBGL2"} · ${this.photorealStatus === "ready" ? "IBL PBR" : "MESH PBR"}`;
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
      const activeQuest = this.activeQuest();
      this.root.querySelector("[data-har-quest-title]").textContent = activeQuest?.title || "Hành trình hiện tại đã hoàn tất";
      this.root.querySelector("[data-har-quest-progress]").textContent = activeQuest
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
          return `<li class="har-character-card ${active ? "is-active" : ""}" style="--character-color:${profile.accent};--portrait-x:${index * 33.333333}%">
            <div class="har-character-card__avatar"><i aria-hidden="true"></i><strong>${profile.short}</strong><span>${ELEMENTS[profile.element].short}</span></div>
            <div><strong>${escapeHtml(profile.name)}</strong><span>${escapeHtml(profile.role)}</span><small>${escapeHtml(profile.description)}</small><small>Lv.${member.level || 1} · ${Math.round(member.health || 100)}/${member.maxHealth || 100} HP · ${ELEMENTS[profile.element].label}</small><small>${escapeHtml(asset)} · ${runtime?.state || "idle"}</small></div>
            <button class="har-chip ${active ? "is-active" : ""}" type="button" data-panel-action="switch-character" data-character="${id}">${active ? "Đang dùng" : `Đổi [${index + 1}]`}</button>
          </li>`;
        }).join("")}</ul>
        <div class="har-section"><h3>Character Pipeline</h3><div class="har-character-pipeline">${CHARACTER_PIPELINE.map((item) => `<div><strong>${escapeHtml(item.name)}</strong><span>${escapeHtml(item.role)}</span><small>${escapeHtml(item.id === "three" ? `Runtime V${CHARACTER_VISUAL_VERSION}` : item.state)}</small></div>`).join("")}</div></div>
        <div class="har-section"><h3>Nguồn hình học nhân vật</h3><p>Hai Human Rig tích hợp sẵn dùng mesh 3D PBR ở khoảng cách gần và proxy 3D ở xa. Bạn vẫn có thể nhập GLB đã tối ưu có SkinnedMesh, animation và morph; Character QA chỉ gắn nhãn “rigged” khi dữ liệu quét thực tế đáp ứng yêu cầu.</p>
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
      const dna = encodeCharacterDNA(recipe, id);
      return `
        <div class="har-creator">
          <div class="har-creator__hero">
            <div><small>DIGITAL HUMAN CORE V${CHARACTER_VISUAL_VERSION} · ${escapeHtml(profile.name)}</small><h3>${recipe.style === "human-cinematic" ? "Web Digital Human" : "Anime Realistic"}</h3><p>${escapeHtml(capability)} · collider gameplay giữ cố định để multiplayer công bằng.</p></div>
            <span class="har-chip ${trulyRigged ? "is-active" : ""}">${trulyRigged ? "RIGGED GLB" : gltfActive ? "GLB FALLBACK" : "PBR FALLBACK"}</span>
          </div>
          <div class="har-character-runtime-grid">
            <div><small>Motion</small><strong>${escapeHtml(runtime?.state || this.activeAnimation || "idle")}</strong><span>${runtime?.clips?.size || 0} clip GLB</span></div>
            <div><small>Skeleton</small><strong>${runtime ? Object.keys(runtime.bones || {}).length : 0}/${Object.keys(HH_HUMANOID_SKELETON).length}</strong><span>HH slots nhận diện</span></div>
            <div><small>Face</small><strong>52 driver</strong><span>${nativeFaceChannels}/52 native morph · ${runtime?.faceFallback?.driver || "procedural fallback"}</span></div>
            <div><small>LOD</small><strong>${escapeHtml(mesh?.userData?.modelTier || "hero")}</strong><span>${escapeHtml(lodCapability)}</span></div>
          </div>
          <div class="har-section har-digital-human-stack">
            <div><small>HEAD TARGET</small><strong>18–28K</strong><span>GLB nhập vào được đo thực tế; Human Rig tích hợp không giả nhận đủ chuẩn head mesh.</span></div>
            <div><small>SKIN STACK</small><strong>5 lớp</strong><span>micro-normal · roughness · SSS approximation · flush · wetness</span></div>
            <div><small>EYE SYSTEM</small><strong>3 lớp</strong><span>iris · cornea · tear response khi model có mesh tách</span></div>
            <div><small>ANIMATION</small><strong>8 hướng</strong><span>inertial crossfade · foot contact · secondary bones</span></div>
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
            <label class="har-field">Model nền<select data-appearance-setting="baseModel">${APPEARANCE_ASSETS.baseModels.map((value) => `<option value="${value}" ${recipe.baseModel === value ? "selected" : ""}>${value}</option>`).join("")}</select></label>
            <label class="har-field">Preset cơ thể<select data-appearance-setting="bodyPreset">${Object.entries(APPEARANCE_PRESETS).map(([value, item]) => `<option value="${value}" ${recipe.bodyPreset === value ? "selected" : ""}>${item.label}</option>`).join("")}</select></label>
            <label class="har-field">Phong cách<select data-appearance-setting="style"><option value="anime-realistic" ${recipe.style === "anime-realistic" ? "selected" : ""}>Anime Realistic</option><option value="human-cinematic" ${recipe.style === "human-cinematic" ? "selected" : ""}>Human Cinematic</option></select></label>
          </div>
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
      } else if (["baseModel", "bodyPreset", "style", "skinColor", "eyeColor", "hairColor", "hair", "beard", "brow", "makeup", "accessory", "lighting", "expression", "viseme"].includes(key)) recipe[key] = value;
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
            if (setting === "baseModel") this.rebuildActiveBuiltInCharacter();
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
          }
        },
        livingWorld: {
          enabled: this.state.settings.livingWorld,
          actors: this.livingWorldActors.length,
          biome: this.currentZone?.id || "central",
          footprints: this.footprints.filter((footprint) => footprint.visible).length
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
        companions: Object.fromEntries(Object.entries(this.state.companions || {}).map(([id, record]) => [id, { bond: record.bond, storyStage: record.storyStage, unlocked: record.unlocked }]))
      };
    }

    async destroy() {
      if (this.destroyed) return;
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
