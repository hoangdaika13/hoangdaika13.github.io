(function (runtime) {
  "use strict";

  const VERSION = 2;
  const STORAGE_KEY = "hh.graphic-character.project.v1";
  const STYLE_ID = "hh-graphic-character-styles-v1";
  const MAX_HISTORY = 50;
  const STAGE = { width: 800, height: 800 };
  const PHONEMES = ["REST", "A", "E", "I", "O", "U", "M/B/P", "F/V", "L", "W/Q"];
  const CHARACTER_LIBRARY = {
    faces: [
      { id: "oval", label: "Trái xoan" }, { id: "round", label: "Tròn" },
      { id: "sharp", label: "Góc cạnh" }, { id: "square", label: "Vuông" }
    ],
    eyes: [
      { id: "anime", label: "Anime" }, { id: "soft", label: "Dịu" },
      { id: "sharp", label: "Sắc" }, { id: "round", label: "Tròn" }
    ],
    hair: [
      { id: "layered", label: "Layer" }, { id: "short", label: "Ngắn" },
      { id: "bob", label: "Bob" }, { id: "ponytail", label: "Đuôi ngựa" },
      { id: "spiky", label: "Dựng" }, { id: "long", label: "Dài" }
    ],
    outfits: [
      { id: "hoodie", label: "Hoodie" }, { id: "school", label: "Đồng phục" },
      { id: "jacket", label: "Áo khoác" }, { id: "suit", label: "Âu phục" },
      { id: "armor", label: "Giáp nhẹ" }
    ],
    accessories: [
      { id: "none", label: "Không" }, { id: "glasses", label: "Kính" },
      { id: "headphones", label: "Tai nghe" }, { id: "cat-ears", label: "Tai mèo" },
      { id: "hat", label: "Mũ" }
    ]
  };
  const ARCHETYPES = [
    { id: "male", label: "Nam", proportions: { height: 1.05, headScale: .92, shoulderWidth: 1.12, armLength: 1.04, legLength: 1.06 } },
    { id: "female", label: "Nữ", proportions: { height: 1, headScale: 1, shoulderWidth: .94, armLength: 1, legLength: 1.04 } },
    { id: "anime", label: "Anime", proportions: { height: 1, headScale: 1.14, shoulderWidth: .92, armLength: 1, legLength: 1.08 } },
    { id: "chibi", label: "Chibi", proportions: { height: .78, headScale: 1.48, shoulderWidth: .82, armLength: .82, legLength: .72 } },
    { id: "semi-realistic", label: "Bán thực", proportions: { height: 1.08, headScale: .88, shoulderWidth: 1.04, armLength: 1.04, legLength: 1.1 } }
  ];
  const CHARACTER_VIEWS = [
    { id: "front", label: "Chính diện" }, { id: "left", label: "Nghiêng trái" },
    { id: "right", label: "Nghiêng phải" }, { id: "back", label: "Quay lưng" }
  ];
  const EXPRESSIONS = [
    { id: "neutral", label: "Tự nhiên", icon: "•" },
    { id: "happy", label: "Vui", icon: "⌣" },
    { id: "sad", label: "Buồn", icon: "⌢" },
    { id: "angry", label: "Giận", icon: "⌁" },
    { id: "surprised", label: "Ngạc nhiên", icon: "○" },
    { id: "blink", label: "Chớp mắt", icon: "—" }
  ];
  const JOINT_DEFINITIONS = [
    { id: "head", label: "Đầu", parent: "neck", x: 400, y: 185 },
    { id: "neck", label: "Cổ", parent: "chest", x: 400, y: 285 },
    { id: "chest", label: "Ngực", parent: "torso", x: 400, y: 365 },
    { id: "torso", label: "Thân", parent: "hips", x: 400, y: 430 },
    { id: "hips", label: "Hông", parent: null, x: 400, y: 500 },
    { id: "leftShoulder", label: "Vai trái", parent: "chest", x: 335, y: 325 },
    { id: "leftElbow", label: "Khuỷu trái", parent: "leftShoulder", x: 285, y: 420 },
    { id: "leftHand", label: "Tay trái", parent: "leftElbow", x: 255, y: 515 },
    { id: "rightShoulder", label: "Vai phải", parent: "chest", x: 465, y: 325 },
    { id: "rightElbow", label: "Khuỷu phải", parent: "rightShoulder", x: 515, y: 420 },
    { id: "rightHand", label: "Tay phải", parent: "rightElbow", x: 545, y: 515 },
    { id: "leftHip", label: "Hông trái", parent: "hips", x: 365, y: 505 },
    { id: "leftKnee", label: "Gối trái", parent: "leftHip", x: 350, y: 625 },
    { id: "leftFoot", label: "Chân trái", parent: "leftKnee", x: 335, y: 745 },
    { id: "rightHip", label: "Hông phải", parent: "hips", x: 435, y: 505 },
    { id: "rightKnee", label: "Gối phải", parent: "rightHip", x: 450, y: 625 },
    { id: "rightFoot", label: "Chân phải", parent: "rightKnee", x: 465, y: 745 }
  ];
  const BONE_DEFINITIONS = JOINT_DEFINITIONS.filter((joint) => joint.parent).map((joint) => ({
    id: `${joint.parent}-${joint.id}`,
    from: joint.parent,
    to: joint.id,
    label: `${joint.parent} → ${joint.id}`
  }));
  const LAYER_TREE = [
    { id: "hairBack", label: "Tóc sau", group: "Đầu", icon: "◒" },
    { id: "head", label: "Khuôn mặt", group: "Đầu", icon: "◎" },
    { id: "eyes", label: "Mắt & lông mày", group: "Đầu", icon: "◉" },
    { id: "mouth", label: "Miệng / Lip-sync", group: "Đầu", icon: "⌣" },
    { id: "hairFront", label: "Tóc mái", group: "Đầu", icon: "◓" },
    { id: "torso", label: "Thân người", group: "Cơ thể", icon: "◇" },
    { id: "leftArm", label: "Tay trái", group: "Cơ thể", icon: "╱" },
    { id: "rightArm", label: "Tay phải", group: "Cơ thể", icon: "╲" },
    { id: "leftLeg", label: "Chân trái", group: "Cơ thể", icon: "│" },
    { id: "rightLeg", label: "Chân phải", group: "Cơ thể", icon: "│" },
    { id: "rig", label: "Rig & joint", group: "Điều khiển", icon: "✣" }
  ];
  const POSE_PRESETS = [
    { id: "idle", label: "Đứng tự nhiên", icon: "◇", description: "Pose cân bằng để bắt đầu" },
    { id: "wave", label: "Vẫy tay", icon: "⌁", description: "Giơ tay phải chào" },
    { id: "walk", label: "Đi bộ", icon: "↗", description: "Chu kỳ bước tự nhiên" },
    { id: "run", label: "Chạy", icon: "»", description: "Sải chân và đánh tay mạnh" },
    { id: "jump", label: "Nhảy lên", icon: "↑", description: "Co chân, nâng trọng tâm" },
    { id: "sit", label: "Ngồi", icon: "⌑", description: "Hạ hông và gập gối" },
    { id: "talk", label: "Trò chuyện", icon: "◌", description: "Tư thế thuyết trình" },
    { id: "fight", label: "Chiến đấu", icon: "×", description: "Thế thủ cân bằng" },
    { id: "dance", label: "Nhảy", icon: "✦", description: "Pose năng động toàn thân" }
  ];
  const MOTION_LIBRARY = [
    { id: "walk", label: "Đi bộ", duration: 1.2 }, { id: "run", label: "Chạy", duration: .8 },
    { id: "jump", label: "Nhảy", duration: 1.4 }, { id: "sit", label: "Ngồi", duration: 1.2 },
    { id: "talk", label: "Nói chuyện", duration: 2 }, { id: "fight", label: "Chiến đấu", duration: 1.5 }
  ];
  const hasDocument = typeof document !== "undefined";
  const hasWindow = typeof window !== "undefined";

  function uid(prefix) {
    return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  }

  function clamp(value, min, max) {
    const parsed = Number(value);
    return Math.min(max, Math.max(min, Number.isFinite(parsed) ? parsed : min));
  }

  function esc(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function isColor(value) {
    return /^#[0-9a-f]{6}$/i.test(String(value || ""));
  }

  function safeParse(value, fallback) {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === "object" ? parsed : fallback;
    } catch (_) {
      return fallback;
    }
  }

  function nowIso() {
    return new Date().toISOString();
  }

  function formatTime(seconds, fps) {
    const safe = Math.max(0, Number(seconds) || 0);
    const minutes = Math.floor(safe / 60).toString().padStart(2, "0");
    const secs = Math.floor(safe % 60).toString().padStart(2, "0");
    const frames = Math.floor((safe % 1) * (fps || 30)).toString().padStart(2, "0");
    return `${minutes}:${secs}:${frames}`;
  }

  function createJoints(overrides) {
    const source = overrides && typeof overrides === "object" ? overrides : {};
    return JOINT_DEFINITIONS.reduce((result, joint) => {
      result[joint.id] = {
        x: clamp(source[joint.id]?.x ?? joint.x, 0, STAGE.width),
        y: clamp(source[joint.id]?.y ?? joint.y, 0, STAGE.height),
        rotation: clamp(source[joint.id]?.rotation || 0, -360, 360)
      };
      return result;
    }, {});
  }

  function poseJoints(presetId) {
    const joints = createJoints();
    const set = (id, x, y, rotation) => {
      if (!joints[id]) return;
      joints[id] = { x, y, rotation: rotation || 0 };
    };
    if (presetId === "wave") {
      set("rightShoulder", 468, 325, -15);
      set("rightElbow", 535, 270, -52);
      set("rightHand", 505, 170, -18);
      set("leftHand", 248, 505, 8);
    } else if (presetId === "walk") {
      set("chest", 410, 360, 4);
      set("head", 414, 182, 3);
      set("leftElbow", 300, 380, -15);
      set("leftHand", 330, 460, 8);
      set("rightElbow", 500, 395, 12);
      set("rightHand", 475, 475, -8);
      set("leftKnee", 315, 615, -14);
      set("leftFoot", 270, 725, -12);
      set("rightKnee", 485, 615, 14);
      set("rightFoot", 520, 745, 10);
    } else if (presetId === "run") {
      set("head", 425, 188, 7); set("chest", 420, 370, 10); set("hips", 410, 500, 7);
      set("leftElbow", 350, 360, 42); set("leftHand", 410, 405, 28);
      set("rightElbow", 520, 365, -38); set("rightHand", 470, 430, -24);
      set("leftKnee", 285, 600, -34); set("leftFoot", 225, 685, -24);
      set("rightKnee", 500, 590, 40); set("rightFoot", 570, 640, 25);
    } else if (presetId === "jump") {
      set("head", 400, 145, 0); set("neck", 400, 245, 0); set("chest", 400, 325, 0);
      set("torso", 400, 390, 0); set("hips", 400, 455, 0);
      set("leftElbow", 275, 260, -45); set("leftHand", 235, 175, -15);
      set("rightElbow", 525, 260, 45); set("rightHand", 565, 175, 15);
      set("leftHip", 365, 460, 0); set("rightHip", 435, 460, 0);
      set("leftKnee", 330, 555, -32); set("leftFoot", 275, 625, -28);
      set("rightKnee", 470, 555, 32); set("rightFoot", 525, 625, 28);
    } else if (presetId === "sit") {
      set("hips", 400, 555, 0); set("torso", 400, 470, 0); set("chest", 400, 390, 0);
      set("leftHip", 365, 555, 0); set("rightHip", 435, 555, 0);
      set("leftKnee", 300, 625, -65); set("rightKnee", 500, 625, 65);
      set("leftFoot", 310, 740, 0); set("rightFoot", 490, 740, 0);
      set("leftElbow", 320, 455, -25); set("leftHand", 350, 535, 0);
      set("rightElbow", 480, 455, 25); set("rightHand", 450, 535, 0);
    } else if (presetId === "talk") {
      set("leftElbow", 305, 380, -24);
      set("leftHand", 355, 410, 5);
      set("rightElbow", 500, 380, 24);
      set("rightHand", 450, 410, -5);
      set("head", 404, 182, 2);
    } else if (presetId === "dance") {
      set("head", 420, 174, 10);
      set("neck", 410, 280, 6);
      set("chest", 390, 360, -8);
      set("leftShoulder", 330, 320, -18);
      set("leftElbow", 270, 255, -40);
      set("leftHand", 315, 170, 25);
      set("rightShoulder", 460, 330, 12);
      set("rightElbow", 535, 355, 42);
      set("rightHand", 585, 300, 20);
      set("leftKnee", 315, 610, -18);
      set("leftFoot", 260, 720, -20);
      set("rightKnee", 475, 625, 16);
      set("rightFoot", 500, 745, 12);
    } else if (presetId === "fight") {
      set("head", 410, 188, 4); set("chest", 410, 365, 5); set("hips", 395, 500, -4);
      set("leftShoulder", 330, 330, -12); set("leftElbow", 300, 385, 38); set("leftHand", 365, 365, 12);
      set("rightShoulder", 470, 325, 10); set("rightElbow", 505, 375, -42); set("rightHand", 445, 355, -12);
      set("leftKnee", 315, 625, -18); set("leftFoot", 270, 740, -10);
      set("rightKnee", 485, 610, 20); set("rightFoot", 535, 720, 12);
    }
    return joints;
  }

  function mirrorPose(joints) {
    const mirrored = createJoints(joints);
    Object.keys(mirrored).forEach((id) => {
      const pair = id.startsWith("left") ? id.replace("left", "right") : id.startsWith("right") ? id.replace("right", "left") : id;
      const source = joints[pair] || joints[id];
      mirrored[id] = { x: STAGE.width - source.x, y: source.y, rotation: -(source.rotation || 0) };
    });
    return mirrored;
  }

  function createMotionFrames(motionId) {
    const motion = MOTION_LIBRARY.find((item) => item.id === motionId) || MOTION_LIBRARY[0];
    const idle = poseJoints("idle");
    const pose = poseJoints(motion.id);
    const opposite = ["walk", "run", "fight"].includes(motion.id) ? mirrorPose(pose) : poseJoints("idle");
    const frames = motion.id === "sit"
      ? [idle, pose, pose]
      : motion.id === "jump"
        ? [idle, pose, idle]
        : [pose, opposite, pose];
    return frames.map((joints, index) => ({
      time: index * motion.duration / 2,
      joints,
      expression: motion.id === "fight" ? "angry" : motion.id === "talk" ? "happy" : "neutral",
      phoneme: motion.id === "talk" && index === 1 ? "A" : "REST"
    }));
  }

  function solveTwoBoneIK(joints, rootId, midId, endId, target, options) {
    const next = createJoints(joints);
    const root = next[rootId];
    const mid = next[midId];
    const end = next[endId];
    if (!root || !mid || !end) return next;
    const upper = Math.max(1, Math.hypot(mid.x - root.x, mid.y - root.y));
    const lower = Math.max(1, Math.hypot(end.x - mid.x, end.y - mid.y));
    const settings = options || {};
    const minDistance = Math.abs(upper - lower) + 1;
    const maxDistance = Math.max(minDistance, (upper + lower) * clamp(settings.maxStretch ?? 1, .75, 1.15) - 1);
    const dx = Number(target?.x) - root.x;
    const dy = Number(target?.y) - root.y;
    const rawDistance = Math.max(.001, Math.hypot(dx, dy));
    const distance = clamp(rawDistance, minDistance, maxDistance);
    const targetAngle = Math.atan2(dy, dx);
    const cosRoot = clamp((upper * upper + distance * distance - lower * lower) / (2 * upper * distance), -1, 1);
    const bend = settings.bendDirection === -1 ? -1 : 1;
    const rootAngle = targetAngle - bend * Math.acos(cosRoot);
    const limitedBend = clamp(Math.acos(clamp((upper * upper + lower * lower - distance * distance) / (2 * upper * lower), -1, 1)) * 180 / Math.PI, settings.minBend ?? 5, settings.maxBend ?? 175);
    const adjustedRootAngle = targetAngle - bend * (Math.PI - limitedBend * Math.PI / 180) * lower / (upper + lower);
    const angle = Number.isFinite(limitedBend) ? adjustedRootAngle : rootAngle;
    mid.x = root.x + Math.cos(angle) * upper;
    mid.y = root.y + Math.sin(angle) * upper;
    end.x = root.x + Math.cos(targetAngle) * distance;
    end.y = root.y + Math.sin(targetAngle) * distance;
    mid.rotation = angle * 180 / Math.PI;
    end.rotation = targetAngle * 180 / Math.PI;
    return next;
  }

  function applyIK(joints, endId, target, constraints) {
    const chains = {
      leftHand: ["leftShoulder", "leftElbow", "leftHand", "leftArm"],
      rightHand: ["rightShoulder", "rightElbow", "rightHand", "rightArm"],
      leftFoot: ["leftHip", "leftKnee", "leftFoot", "leftLeg"],
      rightFoot: ["rightHip", "rightKnee", "rightFoot", "rightLeg"]
    };
    const chain = chains[endId];
    if (!chain) return createJoints(joints);
    const settings = constraints?.[chain[3]] || {};
    return solveTwoBoneIK(joints, chain[0], chain[1], chain[2], target, settings);
  }

  function amplitudeToPhoneme(amplitude, index) {
    const value = clamp(amplitude, 0, 1);
    if (value < .025) return "REST";
    if (value < .055) return "M/B/P";
    if (value < .095) return index % 2 ? "F/V" : "E";
    if (value < .16) return index % 3 ? "A" : "I";
    return index % 2 ? "O" : "A";
  }

  function buildVisemeTimeline(samples, sampleRate, duration, step) {
    const data = samples || [];
    const interval = clamp(step ?? .12, .06, .5);
    const length = Math.max(0, Number(duration) || (data.length / Math.max(1, sampleRate)));
    const markers = [];
    let previous = "";
    for (let time = 0, index = 0; time <= length; time += interval, index += 1) {
      const from = Math.floor(time * sampleRate);
      const to = Math.min(data.length, Math.floor((time + interval) * sampleRate));
      let sum = 0;
      for (let cursor = from; cursor < to; cursor += 1) sum += data[cursor] * data[cursor];
      const rms = to > from ? Math.sqrt(sum / (to - from)) : 0;
      const phoneme = amplitudeToPhoneme(rms * 3.2, index);
      if (phoneme !== previous || phoneme !== "REST") markers.push({ id: uid("lip"), time: Number(time.toFixed(3)), phoneme, amplitude: Number(rms.toFixed(4)) });
      previous = phoneme;
    }
    return markers.slice(0, 1000);
  }

  function createKeyframe(time, joints, expression, phoneme) {
    return {
      id: uid("key"),
      time: clamp(time, 0, 3600),
      easing: "ease-in-out",
      joints: createJoints(joints),
      expression: EXPRESSIONS.some((item) => item.id === expression) ? expression : "neutral",
      phoneme: PHONEMES.includes(phoneme) ? phoneme : "REST"
    };
  }

  function createDefaultProject() {
    const joints = createJoints();
    return {
      version: VERSION,
      meta: {
        name: "Nhân vật anime HH",
        author: "HH Platform",
        createdAt: nowIso(),
        updatedAt: nowIso()
      },
      stage: { width: STAGE.width, height: STAGE.height, background: "#11172a", grid: true },
      character: {
        name: "Hikari",
        style: "anime-human",
        archetype: "anime",
        view: "front",
        faceId: "oval",
        eyeId: "anime",
        hairId: "layered",
        outfitId: "hoodie",
        accessoryId: "none",
        proportions: { height: 1, headScale: 1.14, shoulderWidth: .92, armLength: 1, legLength: 1.08 },
        skinTone: "#ffd6c8",
        hairColor: "#4338ca",
        hairHighlight: "#ec4899",
        eyeColor: "#22d3ee",
        outfitColor: "#7c3aed",
        accentColor: "#f472b6",
        expression: "neutral",
        blinking: true,
        blinkRate: 4,
        phoneme: "REST"
      },
      rig: {
        joints,
        bones: BONE_DEFINITIONS.map((bone) => ({ ...bone })),
        selectedJointId: "rightHand",
        showRig: true,
        mirrorEdit: false,
        footLock: { left: false, right: false },
        constraints: {
          leftArm: { minBend: 8, maxBend: 170, maxStretch: 1, bendDirection: 1 },
          rightArm: { minBend: 8, maxBend: 170, maxStretch: 1, bendDirection: -1 },
          leftLeg: { minBend: 5, maxBend: 165, maxStretch: 1, bendDirection: 1 },
          rightLeg: { minBend: 5, maxBend: 165, maxStretch: 1, bendDirection: -1 }
        }
      },
      layers: LAYER_TREE.map((layer, index) => ({ ...layer, order: index, visible: true, locked: false })),
      timeline: {
        duration: 6,
        fps: 30,
        speed: 1,
        loop: true,
        keyframes: [
          createKeyframe(0, joints, "neutral", "REST"),
          createKeyframe(3, poseJoints("wave"), "happy", "A"),
          createKeyframe(6, joints, "neutral", "REST")
        ],
        lipSync: [
          { id: uid("lip"), time: 2.7, phoneme: "M/B/P" },
          { id: uid("lip"), time: 3, phoneme: "A" },
          { id: uid("lip"), time: 3.25, phoneme: "E" }
        ],
        audio: { name: "", duration: 0, analyzed: false }
      },
      activePose: "idle"
    };
  }

  function normalizeProject(raw) {
    const fallback = createDefaultProject();
    const source = raw && typeof raw === "object" ? raw : fallback;
    const expression = EXPRESSIONS.some((item) => item.id === source.character?.expression)
      ? source.character.expression
      : "neutral";
    const layersById = new Map((Array.isArray(source.layers) ? source.layers : []).map((layer) => [String(layer.id), layer]));
    const joints = createJoints(source.rig?.joints);
    const duration = clamp(source.timeline?.duration ?? fallback.timeline.duration, 0.5, 300);
    const keyframes = (Array.isArray(source.timeline?.keyframes) ? source.timeline.keyframes : fallback.timeline.keyframes)
      .slice(0, 300)
      .map((frame) => ({
        id: String(frame.id || uid("key")),
        time: clamp(frame.time, 0, duration),
        easing: ["linear", "ease-in", "ease-out", "ease-in-out"].includes(frame.easing) ? frame.easing : "ease-in-out",
        joints: createJoints(frame.joints),
        expression: EXPRESSIONS.some((item) => item.id === frame.expression) ? frame.expression : "neutral",
        phoneme: PHONEMES.includes(frame.phoneme) ? frame.phoneme : "REST"
      }))
      .sort((a, b) => a.time - b.time);
    const lipSync = (Array.isArray(source.timeline?.lipSync) ? source.timeline.lipSync : fallback.timeline.lipSync)
      .slice(0, 500)
      .map((marker) => ({
        id: String(marker.id || uid("lip")),
        time: clamp(marker.time, 0, duration),
        phoneme: PHONEMES.includes(marker.phoneme) ? marker.phoneme : "REST",
        amplitude: clamp(marker.amplitude || 0, 0, 1)
      }))
      .sort((a, b) => a.time - b.time);
    const color = (value, defaultValue) => isColor(value) ? value : defaultValue;
    const project = {
      version: VERSION,
      meta: {
        name: String(source.meta?.name || fallback.meta.name).slice(0, 120),
        author: String(source.meta?.author || fallback.meta.author).slice(0, 120),
        createdAt: source.meta?.createdAt || fallback.meta.createdAt,
        updatedAt: nowIso()
      },
      stage: {
        width: STAGE.width,
        height: STAGE.height,
        background: color(source.stage?.background, fallback.stage.background),
        grid: source.stage?.grid !== false
      },
      character: {
        name: String(source.character?.name || fallback.character.name).slice(0, 80),
        style: "anime-human",
        archetype: source.character?.archetype === "custom" || ARCHETYPES.some((item) => item.id === source.character?.archetype) ? source.character.archetype : fallback.character.archetype,
        view: CHARACTER_VIEWS.some((item) => item.id === source.character?.view) ? source.character.view : fallback.character.view,
        faceId: CHARACTER_LIBRARY.faces.some((item) => item.id === source.character?.faceId) ? source.character.faceId : fallback.character.faceId,
        eyeId: CHARACTER_LIBRARY.eyes.some((item) => item.id === source.character?.eyeId) ? source.character.eyeId : fallback.character.eyeId,
        hairId: CHARACTER_LIBRARY.hair.some((item) => item.id === source.character?.hairId) ? source.character.hairId : fallback.character.hairId,
        outfitId: CHARACTER_LIBRARY.outfits.some((item) => item.id === source.character?.outfitId) ? source.character.outfitId : fallback.character.outfitId,
        accessoryId: CHARACTER_LIBRARY.accessories.some((item) => item.id === source.character?.accessoryId) ? source.character.accessoryId : fallback.character.accessoryId,
        proportions: {
          height: clamp(source.character?.proportions?.height ?? fallback.character.proportions.height, .65, 1.35),
          headScale: clamp(source.character?.proportions?.headScale ?? fallback.character.proportions.headScale, .7, 1.6),
          shoulderWidth: clamp(source.character?.proportions?.shoulderWidth ?? fallback.character.proportions.shoulderWidth, .7, 1.35),
          armLength: clamp(source.character?.proportions?.armLength ?? fallback.character.proportions.armLength, .7, 1.35),
          legLength: clamp(source.character?.proportions?.legLength ?? fallback.character.proportions.legLength, .65, 1.4)
        },
        skinTone: color(source.character?.skinTone, fallback.character.skinTone),
        hairColor: color(source.character?.hairColor, fallback.character.hairColor),
        hairHighlight: color(source.character?.hairHighlight, fallback.character.hairHighlight),
        eyeColor: color(source.character?.eyeColor, fallback.character.eyeColor),
        outfitColor: color(source.character?.outfitColor, fallback.character.outfitColor),
        accentColor: color(source.character?.accentColor, fallback.character.accentColor),
        expression,
        blinking: source.character?.blinking !== false,
        blinkRate: clamp(source.character?.blinkRate ?? fallback.character.blinkRate, 1, 12),
        phoneme: PHONEMES.includes(source.character?.phoneme) ? source.character.phoneme : "REST"
      },
      rig: {
        joints,
        bones: BONE_DEFINITIONS.map((bone) => ({ ...bone })),
        selectedJointId: JOINT_DEFINITIONS.some((joint) => joint.id === source.rig?.selectedJointId)
          ? source.rig.selectedJointId
          : "rightHand",
        showRig: source.rig?.showRig !== false,
        mirrorEdit: source.rig?.mirrorEdit === true,
        footLock: { left: source.rig?.footLock?.left === true, right: source.rig?.footLock?.right === true },
        constraints: ["leftArm", "rightArm", "leftLeg", "rightLeg"].reduce((result, id) => {
          const defaults = fallback.rig.constraints[id];
          const current = source.rig?.constraints?.[id] || {};
          result[id] = {
            minBend: clamp(current.minBend ?? defaults.minBend, 0, 90),
            maxBend: clamp(current.maxBend ?? defaults.maxBend, 90, 180),
            maxStretch: clamp(current.maxStretch ?? defaults.maxStretch, .75, 1.15),
            bendDirection: current.bendDirection === -1 ? -1 : 1
          };
          return result;
        }, {})
      },
      layers: LAYER_TREE.map((definition, index) => {
        const layer = layersById.get(definition.id) || {};
        return { ...definition, order: index, visible: layer.visible !== false, locked: layer.locked === true };
      }),
      timeline: {
        duration,
        fps: [24, 25, 30, 50, 60].includes(Number(source.timeline?.fps)) ? Number(source.timeline.fps) : 30,
        speed: [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2].includes(Number(source.timeline?.speed)) ? Number(source.timeline.speed) : 1,
        loop: source.timeline?.loop !== false,
        keyframes: keyframes.length ? keyframes : [createKeyframe(0, joints, expression, "REST")],
        lipSync,
        audio: {
          name: String(source.timeline?.audio?.name || "").slice(0, 180),
          duration: clamp(source.timeline?.audio?.duration || 0, 0, 3600),
          analyzed: source.timeline?.audio?.analyzed === true
        }
      },
      activePose: POSE_PRESETS.some((pose) => pose.id === source.activePose) ? source.activePose : "idle"
    };
    return project;
  }

  function easingValue(type, value) {
    const t = clamp(value, 0, 1);
    if (type === "linear") return t;
    if (type === "ease-in") return t * t;
    if (type === "ease-out") return 1 - Math.pow(1 - t, 2);
    return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  }

  function interpolateProject(project, time) {
    const frames = project.timeline.keyframes.slice().sort((a, b) => a.time - b.time);
    if (!frames.length) return { joints: clone(project.rig.joints), expression: project.character.expression, phoneme: project.character.phoneme };
    if (time <= frames[0].time) return { joints: createJoints(frames[0].joints), expression: frames[0].expression, phoneme: frames[0].phoneme };
    if (time >= frames[frames.length - 1].time) {
      const last = frames[frames.length - 1];
      return { joints: createJoints(last.joints), expression: last.expression, phoneme: last.phoneme };
    }
    const afterIndex = frames.findIndex((frame) => frame.time >= time);
    const before = frames[Math.max(0, afterIndex - 1)];
    const after = frames[afterIndex];
    const progress = easingValue(after.easing, (time - before.time) / Math.max(0.0001, after.time - before.time));
    const joints = {};
    JOINT_DEFINITIONS.forEach((definition) => {
      const start = before.joints[definition.id] || definition;
      const end = after.joints[definition.id] || definition;
      joints[definition.id] = {
        x: start.x + (end.x - start.x) * progress,
        y: start.y + (end.y - start.y) * progress,
        rotation: (start.rotation || 0) + ((end.rotation || 0) - (start.rotation || 0)) * progress
      };
    });
    const marker = project.timeline.lipSync.filter((item) => item.time <= time).at(-1);
    return {
      joints,
      expression: progress < 0.5 ? before.expression : after.expression,
      phoneme: marker && Math.abs(time - marker.time) < 0.32 ? marker.phoneme : (progress < 0.5 ? before.phoneme : after.phoneme)
    };
  }

  function ensureStyles() {
    if (!hasDocument || document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      .hc-studio{--hc-bg:#080b14;--hc-panel:#101623;--hc-line:#26364d;--hc-cyan:#63e6ee;--hc-pink:#f26dc1;--hc-violet:#9b7bff;--hc-text:#f5f7ff;--hc-muted:#98a5bb;display:flex;flex-direction:column;min-height:760px;background:radial-gradient(circle at 16% 0%,rgba(142,74,207,.16),transparent 30%),radial-gradient(circle at 84% 10%,rgba(32,211,238,.12),transparent 28%),var(--hc-bg);color:var(--hc-text);font:500 13px/1.45 Inter,system-ui,sans-serif;border:1px solid #263247;border-radius:12px;overflow:hidden}
      .hc-studio *{box-sizing:border-box}.hc-studio button,.hc-studio input,.hc-studio select{font:inherit}.hc-studio button{color:inherit;border:1px solid var(--hc-line);background:#121a29;border-radius:7px;min-height:34px;padding:6px 10px;cursor:pointer;transition:transform .18s ease,border-color .18s ease,background .18s ease}.hc-studio button:hover{border-color:#5ddce7;background:#172439;transform:translateY(-1px)}.hc-studio button:focus-visible,.hc-studio input:focus-visible,.hc-studio select:focus-visible{outline:2px solid var(--hc-cyan);outline-offset:2px}.hc-studio button[data-primary]{color:#061016;background:linear-gradient(120deg,#f4ff78,#62e1ef 55%,#f277c8);border-color:transparent;font-weight:800}.hc-studio button[data-active=true]{border-color:var(--hc-pink);background:linear-gradient(130deg,rgba(242,109,193,.18),rgba(99,230,238,.1));box-shadow:inset 3px 0 var(--hc-pink)}
      .hc-topbar{display:flex;align-items:center;gap:14px;padding:11px 14px;border-bottom:1px solid var(--hc-line);background:rgba(10,14,24,.9);backdrop-filter:blur(18px)}.hc-brand{display:flex;align-items:center;gap:10px;min-width:220px}.hc-logo{display:grid;place-items:center;width:38px;height:38px;border-radius:10px;background:linear-gradient(145deg,#f26dc1,#7d72ff 50%,#63e6ee);color:#07101a;font-weight:950;box-shadow:0 0 24px rgba(242,109,193,.24)}.hc-brand h2{margin:0;font-size:15px}.hc-brand p{margin:1px 0 0;color:var(--hc-muted);font-size:10px}.hc-actions{display:flex;align-items:center;justify-content:flex-end;gap:6px;margin-left:auto;flex-wrap:wrap}.hc-status{max-width:240px;color:#8af0c0;font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .hc-workspace{display:grid;grid-template-columns:264px minmax(380px,1fr) 292px;min-height:520px}.hc-sidebar,.hc-inspector{background:rgba(10,15,24,.88);padding:12px;overflow:auto;max-height:680px}.hc-sidebar{border-right:1px solid var(--hc-line)}.hc-inspector{border-left:1px solid var(--hc-line)}.hc-section-head{display:flex;align-items:center;justify-content:space-between;margin:4px 0 8px;color:#7ce5eb;text-transform:uppercase;font-size:10px;font-weight:800;letter-spacing:0}.hc-section-head span:last-child{color:var(--hc-muted);font-weight:600}.hc-search{width:100%;padding:9px 10px;color:var(--hc-text);background:#0b111c;border:1px solid var(--hc-line);border-radius:7px;margin-bottom:9px}
      .hc-layer-group{margin:12px 0 5px;color:#69788f;font-size:9px;text-transform:uppercase;font-weight:900}.hc-layer{display:grid;grid-template-columns:24px 1fr 28px 28px;align-items:center;gap:6px;width:100%;padding:5px 6px;margin:3px 0;border:1px solid transparent;border-radius:7px;color:#c5cede}.hc-layer[data-selected=true]{border-color:#3a7580;background:#132633;color:#fff}.hc-layer-icon{display:grid;place-items:center;width:23px;height:23px;border-radius:6px;border:1px solid #3b536e;color:var(--hc-cyan)}.hc-layer button{min-height:26px;padding:0;border-radius:5px}.hc-pose-grid{display:grid;grid-template-columns:1fr 1fr;gap:6px}.hc-pose{display:flex;align-items:center;gap:7px;text-align:left;padding:7px}.hc-pose strong,.hc-pose small{display:block}.hc-pose small{color:var(--hc-muted);font-size:9px}.hc-pose-icon{display:grid;place-items:center;min-width:28px;height:28px;border-radius:7px;background:rgba(242,109,193,.12);color:#ff87cf;font-size:16px}
      .hc-center{min-width:0;display:flex;flex-direction:column;background:#090e18}.hc-toolbar{display:flex;align-items:center;gap:6px;min-height:48px;padding:7px 10px;border-bottom:1px solid var(--hc-line);overflow:auto}.hc-toolbar label{display:flex;align-items:center;gap:6px;color:var(--hc-muted);white-space:nowrap}.hc-toolbar select,.hc-inspector input,.hc-inspector select{color:var(--hc-text);background:#0b111c;border:1px solid var(--hc-line);border-radius:6px;padding:7px}.hc-spacer{flex:1}.hc-stage-wrap{display:grid;place-items:center;min-height:470px;padding:14px;background-color:#0b111c;background-image:linear-gradient(45deg,#101827 25%,transparent 25%),linear-gradient(-45deg,#101827 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#101827 75%),linear-gradient(-45deg,transparent 75%,#101827 75%);background-size:20px 20px;background-position:0 0,0 10px,10px -10px,-10px 0}.hc-canvas-shell{position:relative;width:min(100%,520px);aspect-ratio:1;border:1px solid #39506e;border-radius:6px;overflow:hidden;box-shadow:0 18px 60px rgba(0,0,0,.42),0 0 35px rgba(99,230,238,.08)}.hc-canvas-shell canvas{display:block;width:100%;height:100%;touch-action:none;cursor:crosshair}.hc-canvas-badge{position:absolute;left:9px;top:9px;padding:4px 7px;border:1px solid rgba(99,230,238,.35);border-radius:5px;background:rgba(5,10,18,.72);color:#79e8ef;font-size:9px;pointer-events:none}.hc-canvas-help{position:absolute;right:9px;bottom:8px;padding:4px 7px;border-radius:5px;background:rgba(5,10,18,.72);color:#b6c0d1;font-size:9px;pointer-events:none}
      .hc-card{padding:10px;margin-bottom:9px;border:1px solid var(--hc-line);border-radius:8px;background:linear-gradient(145deg,rgba(25,34,51,.88),rgba(11,16,27,.88))}.hc-card h3{margin:0 0 9px;font-size:12px}.hc-grid-2{display:grid;grid-template-columns:1fr 1fr;gap:7px}.hc-field{display:flex;flex-direction:column;gap:4px;color:var(--hc-muted);font-size:10px}.hc-field input,.hc-field select{width:100%;min-width:0}.hc-field input[type=color]{padding:2px;height:34px}.hc-field input[type=range]{padding:0}.hc-wide{grid-column:1/-1}.hc-expression-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:5px}.hc-expression{display:flex;flex-direction:column;align-items:center;gap:2px;padding:6px 3px;font-size:9px}.hc-expression b{font-size:17px}.hc-switch{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:7px 0;color:#cbd4e4}.hc-permission{padding:7px;margin-top:6px;border-radius:6px;background:#0b121e;border:1px solid #23334a;color:#9ba9be;font-size:10px}.hc-permission[data-granted=true]{color:#8af0c0;border-color:#287251}.hc-permission-actions{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:7px}.hc-truth{display:block;margin-top:7px;color:#7f8ca0;font-size:9px}
      .hc-segmented,.hc-archetypes{display:grid;grid-template-columns:repeat(2,1fr);gap:5px}.hc-archetypes{grid-template-columns:repeat(3,1fr)}.hc-segmented button,.hc-archetypes button{min-width:0;padding:6px 4px;font-size:9px}.hc-library-grid{display:grid;grid-template-columns:1fr 1fr;gap:7px}.hc-proportion{display:grid;grid-template-columns:1fr 45px;gap:5px;align-items:center;margin:6px 0;color:var(--hc-muted);font-size:10px}.hc-proportion input{grid-column:1/-1;width:100%;accent-color:var(--hc-pink)}.hc-motion-grid{display:grid;grid-template-columns:1fr 1fr;gap:5px;margin:7px 0 13px}.hc-motion{display:flex;justify-content:space-between;align-items:center;text-align:left}.hc-motion small{color:var(--hc-cyan)}.hc-audio-row,.hc-export-grid{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:7px}.hc-media-preview{width:100%;aspect-ratio:16/9;margin-top:7px;border:1px solid var(--hc-line);border-radius:7px;background:#050913;object-fit:cover}.hc-media-preview[hidden]{display:none}.hc-support{display:flex;align-items:flex-start;gap:7px;margin-top:7px;padding:7px;border:1px solid #33445c;border-radius:6px;background:#0b121e;color:#9eabc0;font-size:9px}.hc-support[data-ok=true]{border-color:#2e7958;color:#89efbc}.hc-details{border-top:1px solid #29384e;margin-top:8px;padding-top:7px}.hc-details summary{cursor:pointer;color:#a9b7ca;font-size:10px;font-weight:800}.hc-locks{display:grid;grid-template-columns:1fr 1fr;gap:5px}.hc-file-name{display:block;margin-top:5px;color:#78dce5;font-size:9px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      .hc-timeline{border-top:1px solid var(--hc-line);background:#0b101a;min-height:190px}.hc-timeline-head{display:flex;align-items:center;gap:8px;padding:8px 12px;border-bottom:1px solid var(--hc-line)}.hc-timeline-head h3{margin:0;font-size:12px}.hc-timecode{color:#7ce8ee;font:700 11px ui-monospace,monospace}.hc-timeline-scroll{overflow:auto;padding:8px 12px 12px}.hc-scrub{width:100%;accent-color:#ec6bc1}.hc-ruler{position:relative;height:30px;margin-left:150px;border-bottom:1px solid #2a3950;background:repeating-linear-gradient(90deg,transparent 0,transparent calc(10% - 1px),#26354a calc(10% - 1px),#26354a 10%)}.hc-ruler span{position:absolute;top:3px;color:#6e7c91;font-size:8px;transform:translateX(-50%)}.hc-track{display:grid;grid-template-columns:150px minmax(500px,1fr);min-height:33px;border-bottom:1px solid #182334}.hc-track-name{display:flex;align-items:center;padding:0 9px;color:#b9c4d5;background:#0e1623;border-right:1px solid #27364c;font-size:10px}.hc-key-area{position:relative;background:repeating-linear-gradient(90deg,transparent 0,transparent calc(10% - 1px),rgba(51,67,91,.45) calc(10% - 1px),rgba(51,67,91,.45) 10%)}.hc-key,.hc-lip{position:absolute;top:9px;width:14px;height:14px;min-height:14px;padding:0;transform:translateX(-50%) rotate(45deg);border-radius:3px;background:#f26dc1;border:2px solid #ffc5e8}.hc-lip{top:7px;width:auto;min-width:24px;height:18px;transform:translateX(-50%);border-radius:5px;border:1px solid #45d5df;background:#153e49;color:#a7f9ff;font-size:7px}.hc-playhead{position:absolute;z-index:4;top:0;bottom:0;width:1px;background:#72edf4;box-shadow:0 0 10px #72edf4;pointer-events:none}.hc-playhead:before{content:"";position:absolute;top:0;left:-4px;border-left:5px solid transparent;border-right:5px solid transparent;border-top:7px solid #72edf4}
      @media(max-width:1050px){.hc-workspace{grid-template-columns:220px minmax(340px,1fr)}.hc-inspector{grid-column:1/-1;border-left:0;border-top:1px solid var(--hc-line);display:grid;grid-template-columns:repeat(3,1fr);gap:9px;max-height:none}.hc-inspector .hc-card{margin:0}.hc-studio{min-height:700px}}
      @media(max-width:720px){.hc-topbar{align-items:flex-start;flex-wrap:wrap}.hc-actions{width:100%;justify-content:flex-start;margin-left:0}.hc-workspace{display:flex;flex-direction:column}.hc-sidebar{border-right:0;border-bottom:1px solid var(--hc-line);max-height:none}.hc-layer-list{display:grid;grid-template-columns:1fr 1fr;gap:3px}.hc-layer-group{grid-column:1/-1}.hc-pose-grid{grid-template-columns:repeat(3,1fr)}.hc-inspector{display:block;padding:10px;max-height:none}.hc-inspector .hc-card{margin-bottom:8px}.hc-stage-wrap{min-height:360px;padding:8px}.hc-toolbar{flex-wrap:wrap}.hc-track{grid-template-columns:105px minmax(500px,1fr)}.hc-ruler{margin-left:105px}.hc-timeline-head{flex-wrap:wrap}.hc-status{max-width:100%}}
      @media(max-width:440px){.hc-layer-list{grid-template-columns:1fr}.hc-pose-grid{grid-template-columns:1fr 1fr}.hc-expression-grid{grid-template-columns:repeat(2,1fr)}.hc-brand p{display:none}.hc-actions button{flex:1}.hc-canvas-help{display:none}}
      @media(prefers-reduced-motion:reduce){.hc-studio *{scroll-behavior:auto!important;transition:none!important;animation:none!important}.hc-studio button:hover{transform:none}}
    `;
    document.head.appendChild(style);
  }

  function roundedRect(ctx, x, y, width, height, radius) {
    const r = Math.min(radius, Math.abs(width) / 2, Math.abs(height) / 2);
    ctx.beginPath();
    ctx.roundRect?.(x, y, width, height, r);
    if (!ctx.roundRect) {
      ctx.moveTo(x + r, y);
      ctx.lineTo(x + width - r, y);
      ctx.quadraticCurveTo(x + width, y, x + width, y + r);
      ctx.lineTo(x + width, y + height - r);
      ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
      ctx.lineTo(x + r, y + height);
      ctx.quadraticCurveTo(x, y + height, x, y + height - r);
      ctx.lineTo(x, y + r);
      ctx.quadraticCurveTo(x, y, x + r, y);
    }
  }

  function layerVisible(project, id) {
    return project.layers.find((layer) => layer.id === id)?.visible !== false;
  }

  function characterDisplayJoints(project, sourceJoints) {
    const source = createJoints(sourceJoints);
    const proportions = project.character.proportions || createDefaultProject().character.proportions;
    const center = source.hips;
    const result = createJoints(source);
    const upperIds = ["head", "neck", "chest", "torso", "leftShoulder", "rightShoulder", "leftElbow", "rightElbow", "leftHand", "rightHand"];
    const legIds = ["leftHip", "rightHip", "leftKnee", "rightKnee", "leftFoot", "rightFoot"];
    upperIds.forEach((id) => { result[id].y = center.y + (source[id].y - center.y) * proportions.height; });
    legIds.forEach((id) => { result[id].y = center.y + (source[id].y - center.y) * proportions.height * proportions.legLength; });
    ["leftShoulder", "rightShoulder"].forEach((id) => { result[id].x = center.x + (source[id].x - center.x) * proportions.shoulderWidth; });
    ["leftElbow", "leftHand", "rightElbow", "rightHand"].forEach((id) => {
      const shoulderId = id.startsWith("left") ? "leftShoulder" : "rightShoulder";
      result[id].x = result[shoulderId].x + (source[id].x - source[shoulderId].x) * proportions.armLength;
      result[id].y = result[shoulderId].y + (source[id].y - source[shoulderId].y) * proportions.armLength;
    });
    const view = project.character.view;
    if (view === "left" || view === "right") {
      const direction = view === "left" ? -1 : 1;
      Object.keys(result).forEach((id) => { result[id].x = center.x + (result[id].x - center.x) * .38 + direction * (id.startsWith("right") ? 13 : id.startsWith("left") ? -13 : 0); });
    }
    return result;
  }

  function drawCharacter(ctx, project, pose, time, options) {
    const joints = characterDisplayJoints(project, pose.joints);
    const character = project.character;
    const layer = (id) => layerVisible(project, id);
    const selected = project.rig.selectedJointId;
    const transparent = options?.transparent === true;
    ctx.clearRect(0, 0, STAGE.width, STAGE.height);
    if (!transparent) {
      const background = ctx.createLinearGradient(0, 0, STAGE.width, STAGE.height);
      background.addColorStop(0, project.stage.background);
      background.addColorStop(0.55, "#17152b");
      background.addColorStop(1, "#082535");
      ctx.fillStyle = background;
      ctx.fillRect(0, 0, STAGE.width, STAGE.height);
      const glow = ctx.createRadialGradient(400, 360, 30, 400, 380, 410);
      glow.addColorStop(0, "rgba(194,105,255,.22)");
      glow.addColorStop(0.55, "rgba(58,211,229,.08)");
      glow.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, STAGE.width, STAGE.height);
    }
    if (!transparent && project.stage.grid) {
      ctx.strokeStyle = "rgba(137,176,210,.09)";
      ctx.lineWidth = 1;
      for (let x = 0; x <= STAGE.width; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, STAGE.height); ctx.stroke(); }
      for (let y = 0; y <= STAGE.height; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(STAGE.width, y); ctx.stroke(); }
    }

    const segment = (from, to, color, width) => {
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.beginPath();
      ctx.moveTo(joints[from].x, joints[from].y);
      ctx.lineTo(joints[to].x, joints[to].y);
      ctx.stroke();
    };
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,.45)";
    ctx.shadowBlur = 16;
    if (layer("leftLeg")) { segment("leftHip", "leftKnee", character.outfitColor, 45); segment("leftKnee", "leftFoot", "#252f50", 38); }
    if (layer("rightLeg")) { segment("rightHip", "rightKnee", character.outfitColor, 45); segment("rightKnee", "rightFoot", "#252f50", 38); }
    ctx.shadowBlur = 0;
    ctx.fillStyle = "#10182d";
    [[joints.leftFoot.x - 32, joints.leftFoot.y - 10], [joints.rightFoot.x - 32, joints.rightFoot.y - 10]].forEach(([x, y]) => { roundedRect(ctx, x, y, 64, 25, 12); ctx.fill(); });

    if (layer("torso")) {
      const left = joints.leftShoulder;
      const right = joints.rightShoulder;
      const leftHip = joints.leftHip;
      const rightHip = joints.rightHip;
      const torsoGradient = ctx.createLinearGradient(left.x, left.y, rightHip.x, rightHip.y);
      torsoGradient.addColorStop(0, character.accentColor);
      torsoGradient.addColorStop(0.45, character.outfitColor);
      torsoGradient.addColorStop(1, "#313068");
      ctx.fillStyle = torsoGradient;
      ctx.beginPath();
      ctx.moveTo(left.x - 10, left.y - 5);
      ctx.quadraticCurveTo(joints.chest.x, joints.chest.y - 28, right.x + 10, right.y - 5);
      ctx.lineTo(rightHip.x + 15, rightHip.y + 16);
      ctx.quadraticCurveTo(joints.hips.x, joints.hips.y + 35, leftHip.x - 15, leftHip.y + 16);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,.25)";
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.save();
      ctx.strokeStyle = character.outfitId === "armor" ? "rgba(126,234,242,.75)" : "rgba(255,255,255,.42)";
      ctx.lineWidth = character.outfitId === "armor" ? 8 : 4;
      if (["jacket", "suit", "armor"].includes(character.outfitId)) {
        ctx.beginPath(); ctx.moveTo(joints.chest.x, joints.chest.y - 16); ctx.lineTo(joints.hips.x, joints.hips.y + 20); ctx.stroke();
      }
      if (character.outfitId === "school" || character.outfitId === "suit") {
        ctx.beginPath(); ctx.moveTo(joints.chest.x - 35, joints.chest.y - 18); ctx.lineTo(joints.chest.x, joints.chest.y + 34); ctx.lineTo(joints.chest.x + 35, joints.chest.y - 18); ctx.stroke();
      }
      if (character.outfitId === "hoodie") {
        ctx.beginPath(); ctx.arc(joints.neck.x, joints.neck.y + 35, 48, .2, Math.PI - .2); ctx.stroke();
      }
      ctx.restore();
    }
    if (layer("leftArm")) { segment("leftShoulder", "leftElbow", character.skinTone, 34); segment("leftElbow", "leftHand", character.skinTone, 30); }
    if (layer("rightArm")) { segment("rightShoulder", "rightElbow", character.skinTone, 34); segment("rightElbow", "rightHand", character.skinTone, 30); }
    [joints.leftHand, joints.rightHand].forEach((hand) => { ctx.fillStyle = character.skinTone; ctx.beginPath(); ctx.arc(hand.x, hand.y, 19, 0, Math.PI * 2); ctx.fill(); });

    const head = joints.head;
    const headScale = character.proportions?.headScale || 1;
    const headRadius = 72 * headScale;
    const faceWidth = character.faceId === "round" ? headRadius : character.faceId === "sharp" ? headRadius * .86 : character.faceId === "square" ? headRadius * .95 : headRadius * .92;
    const faceHeight = character.faceId === "round" ? headRadius : character.faceId === "sharp" ? headRadius * 1.12 : headRadius * 1.06;
    const viewOffset = character.view === "left" ? -10 : character.view === "right" ? 10 : 0;
    if (layer("hairBack")) {
      const hairGradient = ctx.createLinearGradient(head.x - 80, head.y - 80, head.x + 80, head.y + 100);
      hairGradient.addColorStop(0, character.hairHighlight);
      hairGradient.addColorStop(0.35, character.hairColor);
      hairGradient.addColorStop(1, "#15143e");
      ctx.fillStyle = hairGradient;
      ctx.beginPath();
      const hairWidth = character.hairId === "short" ? faceWidth * 1.08 : character.hairId === "spiky" ? faceWidth * 1.22 : faceWidth * 1.16;
      const hairHeight = ["long", "ponytail"].includes(character.hairId) ? faceHeight * 1.48 : character.hairId === "bob" ? faceHeight * 1.18 : faceHeight * 1.08;
      ctx.ellipse(head.x, head.y + (character.hairId === "long" ? 35 : 12), hairWidth, hairHeight, 0, 0, Math.PI * 2);
      ctx.fill();
      if (character.hairId === "ponytail") { ctx.beginPath(); ctx.ellipse(head.x + 75, head.y + 38, 34, 72, -.25, 0, Math.PI * 2); ctx.fill(); }
    }
    if (layer("head")) {
      ctx.fillStyle = character.skinTone;
      ctx.beginPath();
      ctx.ellipse(head.x + viewOffset, head.y, faceWidth, faceHeight, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,.35)";
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    if (layer("hairFront") && character.view !== "back") {
      const hairGradient = ctx.createLinearGradient(head.x - 70, head.y - 80, head.x + 70, head.y + 30);
      hairGradient.addColorStop(0, character.hairHighlight);
      hairGradient.addColorStop(0.45, character.hairColor);
      hairGradient.addColorStop(1, "#20205b");
      ctx.fillStyle = hairGradient;
      ctx.beginPath();
      ctx.moveTo(head.x - faceWidth, head.y - 18);
      ctx.quadraticCurveTo(head.x - faceWidth * .7, head.y - faceHeight * 1.1, head.x, head.y - faceHeight);
      ctx.quadraticCurveTo(head.x + faceWidth, head.y - faceHeight * .85, head.x + faceWidth, head.y - 12);
      if (character.hairId === "spiky") { ctx.lineTo(head.x + 25, head.y - 45); ctx.lineTo(head.x, head.y - 6); ctx.lineTo(head.x - 32, head.y - 48); }
      else { ctx.lineTo(head.x + 42, head.y - 35); ctx.lineTo(head.x + 15, head.y - 5); ctx.lineTo(head.x - 10, head.y - 38); ctx.lineTo(head.x - 38, head.y - 5); }
      ctx.closePath();
      ctx.fill();
    }

    const expression = pose.expression || character.expression;
    const reduced = runtime.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
    const blinkPeriod = Math.max(1, character.blinkRate);
    const autoBlink = character.blinking && !reduced && (time % blinkPeriod) > blinkPeriod - 0.12;
    const eyesClosed = expression === "blink" || autoBlink;
    const eyeY = head.y + (expression === "sad" ? 7 : 3);
    if (layer("eyes") && character.view !== "back") {
      [-31, 31].forEach((offset, index) => {
        if ((character.view === "left" && index === 1) || (character.view === "right" && index === 0)) return;
        const eyeX = head.x + viewOffset + offset * (character.view === "front" ? 1 : .52);
        ctx.strokeStyle = "#2a1838";
        ctx.lineWidth = eyesClosed ? 5 : 3;
        ctx.beginPath();
        if (eyesClosed) {
          ctx.moveTo(eyeX - 14, eyeY);
          ctx.quadraticCurveTo(eyeX, eyeY + 7, eyeX + 14, eyeY);
        } else {
          const eyeWidth = character.eyeId === "anime" ? 17 : character.eyeId === "sharp" ? 19 : character.eyeId === "round" ? 15 : 16;
          const eyeHeight = character.eyeId === "anime" ? 14 : character.eyeId === "sharp" ? 9 : character.eyeId === "round" ? 16 : 11;
          ctx.ellipse(eyeX, eyeY, eyeWidth, expression === "surprised" ? eyeHeight * 1.3 : eyeHeight, character.eyeId === "sharp" ? -.08 : 0, 0, Math.PI * 2);
        }
        ctx.stroke();
        if (!eyesClosed) {
          ctx.fillStyle = character.eyeColor;
          ctx.beginPath(); ctx.arc(eyeX, eyeY + 1, 9, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = "#08101a";
          ctx.beginPath(); ctx.arc(eyeX, eyeY + 2, 4, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = "white";
          ctx.beginPath(); ctx.arc(eyeX - 3, eyeY - 3, 2.5, 0, Math.PI * 2); ctx.fill();
        }
        ctx.strokeStyle = "#30203d";
        ctx.lineWidth = 4;
        ctx.beginPath();
        const browTilt = expression === "angry" ? (index === 0 ? 7 : -7) : expression === "sad" ? (index === 0 ? -5 : 5) : 0;
        ctx.moveTo(eyeX - 17, eyeY - 25 + browTilt);
        ctx.lineTo(eyeX + 17, eyeY - 25 - browTilt);
        ctx.stroke();
      });
    }
    if (layer("mouth") && character.view !== "back") {
      const mouthX = head.x + viewOffset;
      const mouthY = head.y + 47;
      const phoneme = pose.phoneme || character.phoneme;
      ctx.strokeStyle = "#a93d67";
      ctx.fillStyle = "#67223e";
      ctx.lineWidth = 4;
      ctx.beginPath();
      if (phoneme !== "REST") {
        const wide = ["A", "E", "I", "L"].includes(phoneme) ? 24 : 15;
        const high = ["O", "U", "W/Q"].includes(phoneme) ? 25 : 17;
        ctx.ellipse(mouthX, mouthY, wide, high, 0, 0, Math.PI * 2);
        ctx.fill(); ctx.stroke();
      } else if (expression === "happy") {
        ctx.arc(mouthX, mouthY - 7, 25, 0.15, Math.PI - 0.15);
        ctx.stroke();
      } else if (expression === "sad") {
        ctx.arc(mouthX, mouthY + 15, 22, Math.PI + 0.25, Math.PI * 2 - 0.25);
        ctx.stroke();
      } else if (expression === "surprised") {
        ctx.ellipse(mouthX, mouthY, 12, 18, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      } else {
        ctx.moveTo(mouthX - 18, mouthY); ctx.quadraticCurveTo(mouthX, mouthY + 5, mouthX + 18, mouthY); ctx.stroke();
      }
    }
    if (character.accessoryId === "glasses" && character.view !== "back") {
      ctx.strokeStyle = "#93e9f0"; ctx.lineWidth = 4;
      [-28, 28].forEach((offset) => { ctx.beginPath(); ctx.arc(head.x + viewOffset + offset, head.y + 4, 22, 0, Math.PI * 2); ctx.stroke(); });
      ctx.beginPath(); ctx.moveTo(head.x - 6 + viewOffset, head.y + 4); ctx.lineTo(head.x + 6 + viewOffset, head.y + 4); ctx.stroke();
    } else if (character.accessoryId === "headphones") {
      ctx.strokeStyle = character.accentColor; ctx.lineWidth = 12; ctx.beginPath(); ctx.arc(head.x, head.y, faceWidth + 12, Math.PI, 0); ctx.stroke();
    } else if (character.accessoryId === "cat-ears") {
      ctx.fillStyle = character.hairColor; ctx.beginPath(); ctx.moveTo(head.x - 58, head.y - faceHeight + 10); ctx.lineTo(head.x - 30, head.y - faceHeight - 45); ctx.lineTo(head.x - 5, head.y - faceHeight + 5); ctx.fill();
      ctx.beginPath(); ctx.moveTo(head.x + 58, head.y - faceHeight + 10); ctx.lineTo(head.x + 30, head.y - faceHeight - 45); ctx.lineTo(head.x + 5, head.y - faceHeight + 5); ctx.fill();
    } else if (character.accessoryId === "hat") {
      ctx.fillStyle = character.accentColor; roundedRect(ctx, head.x - 82, head.y - faceHeight - 8, 164, 22, 9); ctx.fill(); roundedRect(ctx, head.x - 54, head.y - faceHeight - 58, 108, 55, 16); ctx.fill();
    }
    ctx.restore();

    if (project.rig.showRig && layer("rig")) {
      ctx.save();
      ctx.strokeStyle = "rgba(105,232,241,.6)";
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 4]);
      BONE_DEFINITIONS.forEach((bone) => {
        ctx.beginPath();
        ctx.moveTo(joints[bone.from].x, joints[bone.from].y);
        ctx.lineTo(joints[bone.to].x, joints[bone.to].y);
        ctx.stroke();
      });
      ctx.setLineDash([]);
      JOINT_DEFINITIONS.forEach((definition) => {
        const joint = joints[definition.id];
        const isSelected = definition.id === selected;
        ctx.fillStyle = isSelected ? "#ff75c8" : "#79e8ef";
        ctx.strokeStyle = "#07101b";
        ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(joint.x, joint.y, isSelected ? 9 : 6, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      });
      ctx.restore();
    }
  }

  function downloadJson(filename, payload) {
    if (!hasDocument) return false;
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 500);
    return true;
  }

  function downloadBlob(filename, blob) {
    if (!hasDocument || !blob) return false;
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1200);
    return true;
  }

  function canvasBlob(canvas, type, quality) {
    return new Promise((resolve) => canvas.toBlob(resolve, type || "image/png", quality));
  }

  function transparentWebMSupport(scope) {
    const MediaRecorderClass = scope?.MediaRecorder;
    const canvas = hasDocument ? document.createElement("canvas") : null;
    const mimeTypes = ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"];
    const mimeType = mimeTypes.find((type) => MediaRecorderClass?.isTypeSupported?.(type)) || "";
    const supported = Boolean(MediaRecorderClass && canvas?.captureStream && mimeType);
    return {
      supported,
      mimeType,
      message: supported
        ? "MediaRecorder WebM khả dụng. Nền alpha được yêu cầu nhưng khả năng giữ trong suốt còn phụ thuộc codec và trình duyệt."
        : "Trình duyệt chưa hỗ trợ MediaRecorder WebM từ canvas; không tạo tệp giả."
    };
  }

  function createController(root, options) {
    ensureStyles();
    const storage = options.storage || runtime.localStorage || null;
    const saved = storage ? safeParse(storage.getItem(STORAGE_KEY), null) : null;
    let project = normalizeProject(options.project || saved || createDefaultProject());
    let time = 0;
    let playing = false;
    let raf = 0;
    let lastTick = 0;
    let mounted = true;
    let selectedLayerId = "rig";
    let cameraStream = null;
    let microphoneStream = null;
    let webcamConsent = false;
    let audioBuffer = null;
    let exportBusy = false;
    let dragState = null;
    let history = [clone(project)];
    let historyIndex = 0;

    root.classList.add("hc-studio");
    root.dataset.graphicCharacter = "mounted";
    root.setAttribute("aria-label", "HH Character Studio");

    function persist() {
      project.meta.updatedAt = nowIso();
      try { storage?.setItem(STORAGE_KEY, JSON.stringify(project)); } catch (_) { /* localStorage can be unavailable */ }
    }

    function pushHistory() {
      history = history.slice(0, historyIndex + 1);
      history.push(clone(project));
      if (history.length > MAX_HISTORY) history.shift();
      historyIndex = history.length - 1;
      persist();
    }

    function announce(message, tone) {
      const status = root.querySelector("[data-hc-status]");
      if (!status) return;
      status.textContent = message;
      status.dataset.tone = tone || "info";
    }

    function update(mutator, message, renderAll) {
      mutator(project);
      project = normalizeProject(project);
      pushHistory();
      if (renderAll !== false) render(); else draw();
      if (message) announce(message, "success");
    }

    function undo() {
      if (historyIndex <= 0) return announce("Không còn bước để hoàn tác");
      historyIndex -= 1;
      project = normalizeProject(history[historyIndex]);
      persist(); render(); announce("Đã hoàn tác", "success");
    }

    function redo() {
      if (historyIndex >= history.length - 1) return announce("Không còn bước để làm lại");
      historyIndex += 1;
      project = normalizeProject(history[historyIndex]);
      persist(); render(); announce("Đã làm lại", "success");
    }

    function currentPose() {
      return playing || time > 0 ? interpolateProject(project, time) : {
        joints: project.rig.joints,
        expression: project.character.expression,
        phoneme: project.character.phoneme
      };
    }

    function draw() {
      const canvas = root.querySelector("[data-hc-canvas]");
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      drawCharacter(ctx, project, currentPose(), time);
      root.querySelectorAll("[data-hc-time]").forEach((node) => { node.textContent = formatTime(time, project.timeline.fps); });
      const scrub = root.querySelector("[data-hc-scrub]");
      if (scrub && Number(scrub.value) !== time) scrub.value = String(time);
      const playhead = root.querySelector("[data-hc-playhead]");
      if (playhead) playhead.style.left = `${(time / project.timeline.duration) * 100}%`;
    }

    function renderLayers() {
      const container = root.querySelector("[data-hc-layers]");
      if (!container) return;
      let lastGroup = "";
      container.innerHTML = project.layers.map((layer) => {
        const group = layer.group !== lastGroup ? `<div class="hc-layer-group">${esc(layer.group)}</div>` : "";
        lastGroup = layer.group;
        return `${group}<div class="hc-layer" data-hc-layer="${esc(layer.id)}" data-selected="${layer.id === selectedLayerId}"><span class="hc-layer-icon">${esc(layer.icon)}</span><span>${esc(layer.label)}</span><button type="button" data-hc-visible="${esc(layer.id)}" aria-label="${layer.visible ? "Ẩn" : "Hiện"} ${esc(layer.label)}">${layer.visible ? "◉" : "○"}</button><button type="button" data-hc-lock="${esc(layer.id)}" aria-label="${layer.locked ? "Mở khóa" : "Khóa"} ${esc(layer.label)}">${layer.locked ? "▣" : "□"}</button></div>`;
      }).join("");
    }

    function renderInspector() {
      const inspector = root.querySelector("[data-hc-inspector]");
      if (!inspector) return;
      const selectedJoint = project.rig.joints[project.rig.selectedJointId];
      const libraryOptions = (items, selected) => items.map((item) => `<option value="${item.id}" ${item.id === selected ? "selected" : ""}>${item.label}</option>`).join("");
      const webm = transparentWebMSupport(runtime);
      inspector.innerHTML = `
        <div class="hc-card">
          <h3>Nhân vật & phong cách</h3>
          <div class="hc-archetypes">${ARCHETYPES.map((item) => `<button type="button" data-hc-archetype="${item.id}" data-active="${project.character.archetype === item.id}">${item.label}</button>`).join("")}</div>
          <div class="hc-segmented" style="margin-top:7px">${CHARACTER_VIEWS.map((item) => `<button type="button" data-hc-view="${item.id}" data-active="${project.character.view === item.id}">${item.label}</button>`).join("")}</div>
          <div class="hc-grid-2">
            <label class="hc-field hc-wide">Tên nhân vật<input data-hc-character="name" value="${esc(project.character.name)}" maxlength="80"></label>
          </div>
          <div class="hc-library-grid" style="margin-top:7px">
            <label class="hc-field">Khuôn mặt<select data-hc-character="faceId">${libraryOptions(CHARACTER_LIBRARY.faces, project.character.faceId)}</select></label>
            <label class="hc-field">Mắt<select data-hc-character="eyeId">${libraryOptions(CHARACTER_LIBRARY.eyes, project.character.eyeId)}</select></label>
            <label class="hc-field">Tóc<select data-hc-character="hairId">${libraryOptions(CHARACTER_LIBRARY.hair, project.character.hairId)}</select></label>
            <label class="hc-field">Trang phục<select data-hc-character="outfitId">${libraryOptions(CHARACTER_LIBRARY.outfits, project.character.outfitId)}</select></label>
            <label class="hc-field hc-wide">Phụ kiện<select data-hc-character="accessoryId">${libraryOptions(CHARACTER_LIBRARY.accessories, project.character.accessoryId)}</select></label>
          </div>
          <details class="hc-details"><summary>Màu sắc & tỉ lệ cơ thể</summary>
          <div class="hc-grid-2" style="margin-top:8px">
            <label class="hc-field">Da<input type="color" data-hc-character="skinTone" value="${project.character.skinTone}"></label>
            <label class="hc-field">Mắt<input type="color" data-hc-character="eyeColor" value="${project.character.eyeColor}"></label>
            <label class="hc-field">Tóc<input type="color" data-hc-character="hairColor" value="${project.character.hairColor}"></label>
            <label class="hc-field">Highlight<input type="color" data-hc-character="hairHighlight" value="${project.character.hairHighlight}"></label>
            <label class="hc-field">Trang phục<input type="color" data-hc-character="outfitColor" value="${project.character.outfitColor}"></label>
            <label class="hc-field">Điểm nhấn<input type="color" data-hc-character="accentColor" value="${project.character.accentColor}"></label>
          </div>
          ${[["height","Chiều cao"],["headScale","Tỉ lệ đầu"],["shoulderWidth","Độ rộng vai"],["armLength","Độ dài tay"],["legLength","Độ dài chân"]].map(([key,label]) => `<label class="hc-proportion"><span>${label}</span><output>${project.character.proportions[key].toFixed(2)}×</output><input type="range" min="${key === "height" || key === "legLength" ? ".65" : ".7"}" max="${key === "headScale" ? "1.6" : "1.4"}" step=".01" value="${project.character.proportions[key]}" data-hc-proportion="${key}"></label>`).join("")}
          </details>
        </div>
        <div class="hc-card">
          <h3>Biểu cảm & khẩu hình</h3>
          <div class="hc-expression-grid">${EXPRESSIONS.map((expression) => `<button type="button" class="hc-expression" data-hc-expression="${expression.id}" data-active="${project.character.expression === expression.id}"><b>${expression.icon}</b><span>${expression.label}</span></button>`).join("")}</div>
          <div class="hc-grid-2" style="margin-top:8px">
            <label class="hc-field">Khẩu hình<select data-hc-character="phoneme">${PHONEMES.map((phoneme) => `<option ${project.character.phoneme === phoneme ? "selected" : ""}>${phoneme}</option>`).join("")}</select></label>
            <label class="hc-field">Chu kỳ chớp mắt<input type="range" min="1" max="12" step=".5" value="${project.character.blinkRate}" data-hc-character="blinkRate"></label>
          </div>
          <label class="hc-switch"><span>Tự động chớp mắt</span><input type="checkbox" data-hc-character="blinking" ${project.character.blinking ? "checked" : ""}></label>
        </div>
        <div class="hc-card">
          <h3>Joint Inspector</h3>
          <div class="hc-grid-2">
            <label class="hc-field hc-wide">Điểm xương<select data-hc-select-joint>${JOINT_DEFINITIONS.map((joint) => `<option value="${joint.id}" ${joint.id === project.rig.selectedJointId ? "selected" : ""}>${joint.label}</option>`).join("")}</select></label>
            <label class="hc-field">X<input type="number" min="0" max="800" data-hc-joint="x" value="${Math.round(selectedJoint.x)}"></label>
            <label class="hc-field">Y<input type="number" min="0" max="800" data-hc-joint="y" value="${Math.round(selectedJoint.y)}"></label>
            <label class="hc-field hc-wide">Xoay<input type="range" min="-180" max="180" value="${selectedJoint.rotation || 0}" data-hc-joint="rotation"></label>
          </div>
          <label class="hc-switch"><span>Hiện rig trên canvas</span><input type="checkbox" data-hc-rig="showRig" ${project.rig.showRig ? "checked" : ""}></label>
          <label class="hc-switch"><span>Chỉnh đối xứng tay/chân</span><input type="checkbox" data-hc-rig="mirrorEdit" ${project.rig.mirrorEdit ? "checked" : ""}></label>
          <div class="hc-locks"><label class="hc-switch"><span>Khóa chân trái</span><input type="checkbox" data-hc-foot-lock="left" ${project.rig.footLock.left ? "checked" : ""}></label><label class="hc-switch"><span>Khóa chân phải</span><input type="checkbox" data-hc-foot-lock="right" ${project.rig.footLock.right ? "checked" : ""}></label></div>
          <details class="hc-details"><summary>Giới hạn IK</summary>
            <div class="hc-grid-2" style="margin-top:7px">
              <label class="hc-field">Gập tay tối đa<input type="number" min="90" max="180" value="${project.rig.constraints.leftArm.maxBend}" data-hc-constraint="arms"></label>
              <label class="hc-field">Gập chân tối đa<input type="number" min="90" max="180" value="${project.rig.constraints.leftLeg.maxBend}" data-hc-constraint="legs"></label>
            </div><small class="hc-truth">Kéo bàn tay hoặc bàn chân: solver hai xương giữ chiều dài chi và giới hạn góc.</small>
          </details>
        </div>
        <div class="hc-card">
          <h3>Audio, webcam & lip-sync</h3>
          <div class="hc-audio-row"><button type="button" data-hc-audio-open>Chọn tệp âm thanh</button><button type="button" data-hc-analyze-audio ${audioBuffer ? "" : "disabled"}>Tạo viseme</button></div>
          <input type="file" accept="audio/*" data-hc-audio hidden><span class="hc-file-name">${project.timeline.audio.name ? `${esc(project.timeline.audio.name)} · ${project.timeline.audio.duration.toFixed(1)} giây` : "Chưa chọn audio"}</span>
          <div class="hc-permission" data-hc-camera-status data-granted="${Boolean(cameraStream)}">Camera: ${cameraStream ? "đã cấp quyền trong phiên này" : "chưa yêu cầu quyền"}</div>
          <div class="hc-permission" data-hc-microphone-status data-granted="${Boolean(microphoneStream)}">Micro: ${microphoneStream ? "đã cấp quyền trong phiên này" : "chưa yêu cầu quyền"}</div>
          <label class="hc-switch"><span>Tôi đồng ý mở webcam trong phiên này</span><input type="checkbox" data-hc-webcam-consent ${webcamConsent ? "checked" : ""}></label>
          <div class="hc-permission-actions"><button type="button" data-hc-camera>Xin quyền camera</button><button type="button" data-hc-microphone>Xin quyền micro</button></div>
          <video class="hc-media-preview" data-hc-webcam-preview muted playsinline ${cameraStream ? "" : "hidden"}></video>
          <small class="hc-truth">Webcam chỉ hiển thị preview sau đồng ý rõ ràng. Không có face tracking hoặc AI nhận dạng. WebAudio chỉ phân tích biên độ để gợi ý viseme, không nhận dạng lời nói.</small>
        </div>
        <div class="hc-card">
          <h3>Xuất nhân vật</h3>
          <div class="hc-export-grid"><button type="button" data-hc-export>Project rig</button><button type="button" data-hc-sprite>Sprite sheet</button><button type="button" data-hc-png-sequence>PNG sequence</button><button type="button" data-hc-webm ${webm.supported ? "" : "disabled"}>WebM alpha</button></div>
          <div class="hc-support" data-ok="${webm.supported}"><span>${webm.supported ? "●" : "○"}</span><span>${webm.message}</span></div>
        </div>`;
      const preview = inspector.querySelector("[data-hc-webcam-preview]");
      if (preview && cameraStream) { preview.srcObject = cameraStream; preview.play?.().catch(() => {}); }
    }

    function renderTimeline() {
      const host = root.querySelector("[data-hc-timeline-body]");
      if (!host) return;
      const duration = project.timeline.duration;
      const ticks = Array.from({ length: 11 }, (_, index) => index * duration / 10);
      host.innerHTML = `
        <div class="hc-ruler">${ticks.map((tick, index) => `<span style="left:${index * 10}%">${tick.toFixed(tick < 10 ? 1 : 0)}s</span>`).join("")}<i class="hc-playhead" data-hc-playhead></i></div>
        <div class="hc-track"><div class="hc-track-name">◆ Pose & biểu cảm</div><div class="hc-key-area">${project.timeline.keyframes.map((frame) => `<button type="button" class="hc-key" data-hc-keyframe="${esc(frame.id)}" style="left:${(frame.time / duration) * 100}%" aria-label="Keyframe ${formatTime(frame.time, project.timeline.fps)}"></button>`).join("")}</div></div>
        <div class="hc-track"><div class="hc-track-name">◌ Lip-sync marker</div><div class="hc-key-area">${project.timeline.lipSync.map((marker) => `<button type="button" class="hc-lip" data-hc-lip="${esc(marker.id)}" style="left:${(marker.time / duration) * 100}%" aria-label="Khẩu hình ${esc(marker.phoneme)} tại ${formatTime(marker.time, project.timeline.fps)}">${esc(marker.phoneme)}</button>`).join("")}</div></div>`;
      draw();
    }

    function render() {
      if (!mounted) return;
      root.innerHTML = `
        <header class="hc-topbar">
          <div class="hc-brand"><span class="hc-logo">HC</span><div><h2>HH Character Creator 2.0</h2><p>Anime / human · IK rig · motion · viseme · local-first</p></div></div>
          <div class="hc-actions"><span class="hc-status" data-hc-status role="status" aria-live="polite">Sẵn sàng sáng tạo</span><button type="button" data-hc-undo title="Hoàn tác (Ctrl+Z)" aria-label="Hoàn tác">↶</button><button type="button" data-hc-redo title="Làm lại (Ctrl+Y)" aria-label="Làm lại">↷</button><button type="button" data-hc-import-open>Nhập JSON</button><input type="file" accept="application/json" data-hc-import hidden><button type="button" data-hc-export data-primary>Xuất project</button></div>
        </header>
        <div class="hc-workspace">
          <aside class="hc-sidebar">
            <input class="hc-search" type="search" placeholder="Tìm layer, pose..." data-hc-search aria-label="Tìm layer và pose">
            <div class="hc-section-head"><strong>Cấu trúc nhân vật</strong><span>${project.layers.length} layer</span></div>
            <div class="hc-layer-list" data-hc-layers></div>
            <div class="hc-section-head" style="margin-top:15px"><strong>Pose nhanh</strong><span>${POSE_PRESETS.length} preset</span></div>
            <div class="hc-pose-grid">${POSE_PRESETS.map((pose) => `<button type="button" class="hc-pose" data-hc-pose="${pose.id}" data-active="${project.activePose === pose.id}"><span class="hc-pose-icon">${pose.icon}</span><span><strong>${pose.label}</strong><small>${pose.description}</small></span></button>`).join("")}</div>
            <div class="hc-section-head" style="margin-top:15px"><strong>Thư viện chuyển động</strong><span>Tạo keyframe</span></div>
            <div class="hc-motion-grid">${MOTION_LIBRARY.map((motion) => `<button type="button" class="hc-motion" data-hc-motion="${motion.id}"><span>${motion.label}</span><small>${motion.duration}s</small></button>`).join("")}</div>
          </aside>
          <main class="hc-center">
            <div class="hc-toolbar"><button type="button" data-hc-play data-primary>${playing ? "Tạm dừng" : "Phát"}</button><button type="button" data-hc-stop>Dừng</button><button type="button" data-hc-add-key>+ Keyframe</button><button type="button" data-hc-add-lip>+ Lip marker</button><span class="hc-spacer"></span><label>Tốc độ<select data-hc-setting="speed">${[0.25,0.5,0.75,1,1.25,1.5,2].map((speed) => `<option value="${speed}" ${project.timeline.speed === speed ? "selected" : ""}>${speed}×</option>`).join("")}</select></label><label>FPS<select data-hc-setting="fps">${[24,25,30,50,60].map((fps) => `<option value="${fps}" ${project.timeline.fps === fps ? "selected" : ""}>${fps}</option>`).join("")}</select></label></div>
            <div class="hc-stage-wrap"><div class="hc-canvas-shell"><canvas width="800" height="800" data-hc-canvas aria-label="Canvas rig nhân vật anime và con người"></canvas><span class="hc-canvas-badge">IK RIG · ${esc(project.character.name)} · ${esc(CHARACTER_VIEWS.find((item) => item.id === project.character.view)?.label || "")}</span><span class="hc-canvas-help">Kéo bàn tay/chân dùng IK · phím 1–4 đổi góc nhìn</span></div></div>
          </main>
          <aside class="hc-inspector" data-hc-inspector></aside>
        </div>
        <section class="hc-timeline" aria-label="Timeline hoạt ảnh nhân vật">
          <div class="hc-timeline-head"><h3>Timeline / Keyframes</h3><span class="hc-timecode" data-hc-time>${formatTime(time, project.timeline.fps)}</span><button type="button" data-hc-add-key>+ Chụp pose hiện tại</button><button type="button" data-hc-add-lip>+ Khẩu hình tại playhead</button><span class="hc-spacer"></span><label class="hc-switch">Lặp <input type="checkbox" data-hc-setting="loop" ${project.timeline.loop ? "checked" : ""}></label><label class="hc-field" style="width:90px">Thời lượng<input type="number" min=".5" max="300" step=".5" value="${project.timeline.duration}" data-hc-setting="duration"></label></div>
          <div class="hc-timeline-scroll"><input class="hc-scrub" type="range" min="0" max="${project.timeline.duration}" step=".01" value="${time}" data-hc-scrub aria-label="Vị trí playhead"><div data-hc-timeline-body></div></div>
        </section>`;
      renderLayers(); renderInspector(); renderTimeline(); draw();
    }

    function mirrorJoint(id, value) {
      if (!project.rig.mirrorEdit) return;
      const mirrorId = id.startsWith("left") ? id.replace("left", "right") : id.startsWith("right") ? id.replace("right", "left") : null;
      if (!mirrorId || !project.rig.joints[mirrorId]) return;
      project.rig.joints[mirrorId] = {
        x: STAGE.width - value.x,
        y: value.y,
        rotation: -(value.rotation || 0)
      };
    }

    function applyPose(id) {
      update((next) => {
        next.rig.joints = poseJoints(id);
        next.activePose = id;
        if (id === "wave" || id === "dance") next.character.expression = "happy";
        if (id === "talk") next.character.phoneme = "A";
      }, `Đã áp dụng pose ${POSE_PRESETS.find((pose) => pose.id === id)?.label || id}`);
    }

    function applyArchetype(id) {
      const archetype = ARCHETYPES.find((item) => item.id === id);
      if (!archetype) return;
      update((next) => {
        next.character.archetype = archetype.id;
        next.character.proportions = clone(archetype.proportions);
      }, `Đã áp dụng kiểu ${archetype.label}`);
    }

    function applyMotionSequence(id) {
      const motion = MOTION_LIBRARY.find((item) => item.id === id);
      if (!motion) return;
      const frames = createMotionFrames(id);
      update((next) => {
        next.timeline.duration = motion.duration;
        next.timeline.keyframes = frames.map((frame) => createKeyframe(frame.time, frame.joints, frame.expression, frame.phoneme));
        next.timeline.lipSync = id === "talk"
          ? [{ id: uid("lip"), time: .25, phoneme: "M/B/P" }, { id: uid("lip"), time: .55, phoneme: "A" }, { id: uid("lip"), time: .9, phoneme: "E" }, { id: uid("lip"), time: 1.3, phoneme: "O" }, { id: uid("lip"), time: 1.75, phoneme: "REST" }]
          : [];
        next.rig.joints = createJoints(frames[0].joints);
        next.activePose = id;
      }, `Đã tạo chuyển động ${motion.label} với ${frames.length} keyframe`);
      time = 0;
    }

    function addKeyframe() {
      update((next) => {
        next.timeline.keyframes = next.timeline.keyframes.filter((frame) => Math.abs(frame.time - time) > 0.01);
        next.timeline.keyframes.push(createKeyframe(time, next.rig.joints, next.character.expression, next.character.phoneme));
        next.timeline.keyframes.sort((a, b) => a.time - b.time);
      }, `Đã chụp keyframe tại ${formatTime(time, project.timeline.fps)}`);
    }

    function addLipMarker() {
      update((next) => {
        next.timeline.lipSync.push({ id: uid("lip"), time, phoneme: next.character.phoneme === "REST" ? "A" : next.character.phoneme });
        next.timeline.lipSync.sort((a, b) => a.time - b.time);
      }, `Đã thêm marker khẩu hình tại ${formatTime(time, project.timeline.fps)}`);
    }

    async function loadAudioFile(file) {
      try {
        const AudioContextClass = runtime.AudioContext || runtime.webkitAudioContext;
        if (!AudioContextClass) throw new Error("Trình duyệt không hỗ trợ WebAudio");
        const context = new AudioContextClass();
        try {
          audioBuffer = await context.decodeAudioData(await file.arrayBuffer());
        } finally {
          await context.close?.().catch?.(() => {});
        }
        update((next) => {
          next.timeline.audio = { name: file.name, duration: audioBuffer.duration, analyzed: false };
        }, `Đã nạp ${file.name}`);
      } catch (error) {
        audioBuffer = null;
        announce(`Audio: ${error.message || "không đọc được tệp"}`, "error");
      }
    }

    function analyzeAudio() {
      if (!audioBuffer) return announce("Hãy chọn tệp âm thanh trước", "error");
      const samples = audioBuffer.getChannelData(0);
      const markers = buildVisemeTimeline(samples, audioBuffer.sampleRate, audioBuffer.duration, .12);
      update((next) => {
        next.timeline.duration = clamp(Math.max(next.timeline.duration, audioBuffer.duration), .5, 300);
        next.timeline.lipSync = markers.map((marker) => ({ ...marker, time: clamp(marker.time, 0, 300) }));
        next.timeline.audio = { name: next.timeline.audio.name, duration: audioBuffer.duration, analyzed: true };
      }, `Đã tạo ${markers.length} marker viseme từ biên độ WebAudio`);
    }

    function renderExportFrame(exportTime, transparent) {
      const canvas = document.createElement("canvas");
      canvas.width = STAGE.width; canvas.height = STAGE.height;
      const context = canvas.getContext("2d", { alpha: true });
      drawCharacter(context, project, interpolateProject(project, exportTime), exportTime, { transparent });
      return canvas;
    }

    async function exportSpriteSheet() {
      if (exportBusy) return announce("Một tác vụ xuất đang chạy");
      exportBusy = true;
      try {
        const columns = 4; const rows = 2; const cell = 256; const count = columns * rows;
        const sheet = document.createElement("canvas"); sheet.width = columns * cell; sheet.height = rows * cell;
        const context = sheet.getContext("2d", { alpha: true }); context.imageSmoothingQuality = "high";
        for (let index = 0; index < count; index += 1) {
          const exportTime = project.timeline.duration * index / Math.max(1, count - 1);
          const frame = renderExportFrame(exportTime, true);
          context.drawImage(frame, index % columns * cell, Math.floor(index / columns) * cell, cell, cell);
        }
        downloadBlob(`${project.meta.name.replace(/[^a-z0-9_-]+/gi, "-") || "character"}-spritesheet.png`, await canvasBlob(sheet));
        announce(`Đã xuất sprite sheet ${columns}×${rows}`, "success");
      } finally { exportBusy = false; }
    }

    async function exportPngSequence() {
      if (exportBusy) return announce("Một tác vụ xuất đang chạy");
      exportBusy = true;
      try {
        const count = Math.min(24, Math.max(8, Math.ceil(project.timeline.duration * 4)));
        for (let index = 0; index < count; index += 1) {
          const exportTime = project.timeline.duration * index / Math.max(1, count - 1);
          const blob = await canvasBlob(renderExportFrame(exportTime, true));
          downloadBlob(`hh-character-${String(index + 1).padStart(3, "0")}.png`, blob);
          await new Promise((resolve) => setTimeout(resolve, 70));
        }
        announce(`Đã yêu cầu tải ${count} khung PNG nền trong suốt`, "success");
      } finally { exportBusy = false; }
    }

    async function exportTransparentWebM() {
      const support = transparentWebMSupport(runtime);
      if (!support.supported) return announce(support.message, "error");
      if (exportBusy) return announce("Một tác vụ xuất đang chạy");
      exportBusy = true;
      const canvas = document.createElement("canvas"); canvas.width = STAGE.width; canvas.height = STAGE.height;
      const context = canvas.getContext("2d", { alpha: true });
      const stream = canvas.captureStream(project.timeline.fps);
      const chunks = [];
      const recorder = new runtime.MediaRecorder(stream, { mimeType: support.mimeType, videoBitsPerSecond: 4_000_000 });
      recorder.ondataavailable = (event) => { if (event.data?.size) chunks.push(event.data); };
      const finished = new Promise((resolve) => { recorder.onstop = resolve; });
      recorder.start(250);
      const started = performance.now();
      const duration = Math.min(30, project.timeline.duration);
      await new Promise((resolve) => {
        const frame = (stamp) => {
          const exportTime = Math.min(duration, (stamp - started) / 1000);
          drawCharacter(context, project, interpolateProject(project, exportTime), exportTime, { transparent: true });
          if (exportTime >= duration) resolve(); else runtime.requestAnimationFrame(frame);
        };
        runtime.requestAnimationFrame(frame);
      });
      recorder.stop(); await finished;
      stream.getTracks().forEach((track) => track.stop());
      downloadBlob(`${project.meta.name.replace(/[^a-z0-9_-]+/gi, "-") || "character"}.webm`, new Blob(chunks, { type: support.mimeType }));
      exportBusy = false;
      announce("Đã xuất WebM. Hãy kiểm tra alpha vì mức hỗ trợ tùy codec và trình duyệt.", "success");
    }

    function setTime(value) {
      time = clamp(value, 0, project.timeline.duration);
      draw();
    }

    function tick(timestamp) {
      if (!mounted) return;
      if (!lastTick) lastTick = timestamp;
      const delta = Math.min(0.1, Math.max(0, (timestamp - lastTick) / 1000));
      lastTick = timestamp;
      if (playing) {
        time += delta * project.timeline.speed;
        if (time >= project.timeline.duration) {
          if (project.timeline.loop) time %= project.timeline.duration;
          else { time = project.timeline.duration; playing = false; }
        }
        draw();
      }
      raf = runtime.requestAnimationFrame ? runtime.requestAnimationFrame(tick) : setTimeout(() => tick(Date.now()), 33);
    }

    function togglePlay() {
      playing = !playing;
      if (playing && time >= project.timeline.duration) time = 0;
      const button = root.querySelector("[data-hc-play]");
      if (button) button.textContent = playing ? "Tạm dừng" : "Phát";
      announce(playing ? "Đang phát preview" : "Đã tạm dừng", "success");
    }

    function stop() {
      playing = false; time = 0; draw();
      const button = root.querySelector("[data-hc-play]");
      if (button) button.textContent = "Phát";
      announce("Đã dừng preview", "success");
    }

    async function requestCameraPermission() {
      try {
        if (!webcamConsent) throw new Error("Hãy tích đồng ý mở webcam trước");
        if (!runtime.navigator?.mediaDevices?.getUserMedia) throw new Error("Trình duyệt không hỗ trợ camera");
        cameraStream = await runtime.navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        const status = root.querySelector("[data-hc-camera-status]");
        if (status) { status.textContent = "Camera: đã cấp quyền trong phiên này"; status.dataset.granted = "true"; }
        const preview = root.querySelector("[data-hc-webcam-preview]");
        if (preview) { preview.hidden = false; preview.srcObject = cameraStream; await preview.play?.().catch?.(() => {}); }
        announce("Đã mở preview camera. Không có face tracking hoặc AI nhận dạng.", "success");
      } catch (error) {
        announce(`Camera: ${error.message || "không thể cấp quyền"}`, "error");
      }
    }

    async function requestMicrophonePermission() {
      try {
        if (!runtime.navigator?.mediaDevices?.getUserMedia) throw new Error("Trình duyệt không hỗ trợ micro");
        microphoneStream = await runtime.navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        const status = root.querySelector("[data-hc-microphone-status]");
        if (status) { status.textContent = "Micro: đã cấp quyền trong phiên này"; status.dataset.granted = "true"; }
        announce("Đã mở micro. Nhận dạng âm vị tự động chưa được bật trong module này.", "success");
      } catch (error) {
        announce(`Micro: ${error.message || "không thể cấp quyền"}`, "error");
      }
    }

    function importProject(file) {
      const reader = new FileReader();
      reader.onload = () => {
        const parsed = safeParse(reader.result, null);
        const payload = parsed?.format === "hh-character-rig" ? parsed.project : parsed;
        if (!payload?.rig?.joints || !payload?.timeline) return announce("Project JSON không hợp lệ", "error");
        project = normalizeProject(payload); time = 0; history = [clone(project)]; historyIndex = 0; persist(); render(); announce("Đã nhập project", "success");
      };
      reader.onerror = () => announce("Không đọc được tệp JSON", "error");
      reader.readAsText(file);
    }

    function canvasPoint(event, canvas) {
      const rect = canvas.getBoundingClientRect();
      return { x: (event.clientX - rect.left) / rect.width * STAGE.width, y: (event.clientY - rect.top) / rect.height * STAGE.height };
    }

    function nearestJoint(point) {
      const pose = currentPose();
      const displayJoints = characterDisplayJoints(project, pose.joints);
      let nearest = null;
      let distance = 30;
      JOINT_DEFINITIONS.forEach((definition) => {
        const joint = displayJoints[definition.id];
        const current = Math.hypot(joint.x - point.x, joint.y - point.y);
        if (current < distance) { distance = current; nearest = definition.id; }
      });
      return nearest;
    }

    function handlePointerDown(event) {
      const canvas = event.target.closest?.("[data-hc-canvas]");
      if (!canvas || playing || !project.rig.showRig) return;
      const point = canvasPoint(event, canvas);
      const jointId = nearestJoint(point);
      if (!jointId) return;
      const rigLayer = project.layers.find((layer) => layer.id === "rig");
      if (rigLayer?.locked) return announce("Layer rig đang bị khóa");
      if (jointId === "leftFoot" && project.rig.footLock.left) return announce("Chân trái đang khóa sàn");
      if (jointId === "rightFoot" && project.rig.footLock.right) return announce("Chân phải đang khóa sàn");
      event.preventDefault();
      canvas.setPointerCapture?.(event.pointerId);
      project.rig.selectedJointId = jointId;
      dragState = {
        canvas, jointId, pointerId: event.pointerId, before: clone(project),
        footTargets: { left: clone(project.rig.joints.leftFoot), right: clone(project.rig.joints.rightFoot) }
      };
      draw();
    }

    function handlePointerMove(event) {
      if (!dragState || event.pointerId !== dragState.pointerId) return;
      const point = canvasPoint(event, dragState.canvas);
      const target = { x: clamp(point.x, 0, STAGE.width), y: clamp(point.y, 0, STAGE.height) };
      if (["leftHand", "rightHand", "leftFoot", "rightFoot"].includes(dragState.jointId)) {
        project.rig.joints = applyIK(project.rig.joints, dragState.jointId, target, project.rig.constraints);
      } else {
        const joint = project.rig.joints[dragState.jointId];
        joint.x = target.x; joint.y = target.y;
        mirrorJoint(dragState.jointId, joint);
      }
      if (project.rig.footLock.left && dragState.jointId !== "leftFoot") project.rig.joints = applyIK(project.rig.joints, "leftFoot", dragState.footTargets.left, project.rig.constraints);
      if (project.rig.footLock.right && dragState.jointId !== "rightFoot") project.rig.joints = applyIK(project.rig.joints, "rightFoot", dragState.footTargets.right, project.rig.constraints);
      project.activePose = "custom";
      draw();
    }

    function handlePointerUp(event) {
      if (!dragState || event.pointerId !== dragState.pointerId) return;
      dragState.canvas.releasePointerCapture?.(event.pointerId);
      dragState = null;
      pushHistory();
      renderInspector(); draw(); announce("Đã cập nhật pose bằng joint", "success");
    }

    function onClick(event) {
      const target = event.target.closest?.("[data-hc-pose],[data-hc-motion],[data-hc-archetype],[data-hc-view],[data-hc-expression],[data-hc-layer],[data-hc-visible],[data-hc-lock],[data-hc-play],[data-hc-stop],[data-hc-add-key],[data-hc-add-lip],[data-hc-keyframe],[data-hc-lip],[data-hc-undo],[data-hc-redo],[data-hc-export],[data-hc-import-open],[data-hc-camera],[data-hc-microphone],[data-hc-audio-open],[data-hc-analyze-audio],[data-hc-sprite],[data-hc-png-sequence],[data-hc-webm]");
      if (!target) return;
      if (target.dataset.hcPose) return applyPose(target.dataset.hcPose);
      if (target.dataset.hcMotion) return applyMotionSequence(target.dataset.hcMotion);
      if (target.dataset.hcArchetype) return applyArchetype(target.dataset.hcArchetype);
      if (target.dataset.hcView) return update((next) => { next.character.view = target.dataset.hcView; }, `Góc nhìn: ${CHARACTER_VIEWS.find((item) => item.id === target.dataset.hcView)?.label}`);
      if (target.dataset.hcExpression) return update((next) => { next.character.expression = target.dataset.hcExpression; }, `Biểu cảm: ${EXPRESSIONS.find((item) => item.id === target.dataset.hcExpression)?.label}`);
      if (target.dataset.hcLayer) { selectedLayerId = target.dataset.hcLayer; renderLayers(); return; }
      if (target.dataset.hcVisible) return update((next) => { const layer = next.layers.find((item) => item.id === target.dataset.hcVisible); layer.visible = !layer.visible; }, "Đã cập nhật hiển thị layer");
      if (target.dataset.hcLock) return update((next) => { const layer = next.layers.find((item) => item.id === target.dataset.hcLock); layer.locked = !layer.locked; }, "Đã cập nhật khóa layer");
      if (target.dataset.hcPlay !== undefined) return togglePlay();
      if (target.dataset.hcStop !== undefined) return stop();
      if (target.dataset.hcAddKey !== undefined) return addKeyframe();
      if (target.dataset.hcAddLip !== undefined) return addLipMarker();
      if (target.dataset.hcKeyframe) {
        const frame = project.timeline.keyframes.find((item) => item.id === target.dataset.hcKeyframe);
        if (frame) { setTime(frame.time); project.rig.joints = createJoints(frame.joints); project.character.expression = frame.expression; project.character.phoneme = frame.phoneme; renderInspector(); draw(); }
        return;
      }
      if (target.dataset.hcLip) {
        const marker = project.timeline.lipSync.find((item) => item.id === target.dataset.hcLip);
        if (marker) { setTime(marker.time); project.character.phoneme = marker.phoneme; renderInspector(); draw(); }
        return;
      }
      if (target.dataset.hcUndo !== undefined) return undo();
      if (target.dataset.hcRedo !== undefined) return redo();
      if (target.dataset.hcExport !== undefined) return downloadJson(`${project.meta.name.replace(/[^a-z0-9_-]+/gi, "-") || "hh-character"}.hhchar.json`, { format: "hh-character-rig", exportedAt: nowIso(), project });
      if (target.dataset.hcImportOpen !== undefined) return root.querySelector("[data-hc-import]")?.click();
      if (target.dataset.hcAudioOpen !== undefined) return root.querySelector("[data-hc-audio]")?.click();
      if (target.dataset.hcAnalyzeAudio !== undefined) return analyzeAudio();
      if (target.dataset.hcSprite !== undefined) return exportSpriteSheet();
      if (target.dataset.hcPngSequence !== undefined) return exportPngSequence();
      if (target.dataset.hcWebm !== undefined) return exportTransparentWebM();
      if (target.dataset.hcCamera !== undefined) return requestCameraPermission();
      if (target.dataset.hcMicrophone !== undefined) return requestMicrophonePermission();
    }

    function onChange(event) {
      const character = event.target.closest?.("[data-hc-character]");
      if (character) {
        const key = character.dataset.hcCharacter;
        const value = key === "blinking" ? character.checked : key === "blinkRate" ? Number(character.value) : character.value;
        return update((next) => { next.character[key] = value; }, `Đã cập nhật ${key}`);
      }
      const proportion = event.target.closest?.("[data-hc-proportion]");
      if (proportion) return update((next) => {
        next.character.proportions[proportion.dataset.hcProportion] = Number(proportion.value);
        next.character.archetype = "custom";
      }, `Đã cập nhật ${proportion.dataset.hcProportion}`);
      const jointField = event.target.closest?.("[data-hc-joint]");
      if (jointField) {
        const key = jointField.dataset.hcJoint;
        return update((next) => {
          const joint = next.rig.joints[next.rig.selectedJointId];
          joint[key] = Number(jointField.value);
          mirrorJoint(next.rig.selectedJointId, joint);
          next.activePose = "custom";
        }, `Đã cập nhật joint ${project.rig.selectedJointId}`);
      }
      if (event.target.matches("[data-hc-select-joint]")) {
        project.rig.selectedJointId = event.target.value; persist(); renderInspector(); draw(); return;
      }
      const rig = event.target.closest?.("[data-hc-rig]");
      if (rig) return update((next) => { next.rig[rig.dataset.hcRig] = rig.checked; }, "Đã cập nhật chế độ rig");
      const footLock = event.target.closest?.("[data-hc-foot-lock]");
      if (footLock) return update((next) => { next.rig.footLock[footLock.dataset.hcFootLock] = footLock.checked; }, `Đã ${footLock.checked ? "khóa" : "mở"} chân ${footLock.dataset.hcFootLock === "left" ? "trái" : "phải"}`);
      const constraint = event.target.closest?.("[data-hc-constraint]");
      if (constraint) return update((next) => {
        const ids = constraint.dataset.hcConstraint === "arms" ? ["leftArm", "rightArm"] : ["leftLeg", "rightLeg"];
        ids.forEach((id) => { next.rig.constraints[id].maxBend = Number(constraint.value); });
      }, "Đã cập nhật giới hạn IK");
      const setting = event.target.closest?.("[data-hc-setting]");
      if (setting) {
        const key = setting.dataset.hcSetting;
        const value = key === "loop" ? setting.checked : Number(setting.value);
        return update((next) => { next.timeline[key] = value; }, `Đã cập nhật ${key}`);
      }
      if (event.target.matches("[data-hc-import]")) {
        const file = event.target.files?.[0];
        if (file) importProject(file);
        event.target.value = "";
      }
      if (event.target.matches("[data-hc-audio]")) {
        const file = event.target.files?.[0];
        if (file) loadAudioFile(file);
        event.target.value = "";
      }
      if (event.target.matches("[data-hc-webcam-consent]")) webcamConsent = event.target.checked;
    }

    function onInput(event) {
      if (event.target.matches("[data-hc-scrub]")) return setTime(event.target.value);
      if (event.target.matches("[data-hc-search]")) {
        const query = event.target.value.trim().toLowerCase();
        root.querySelectorAll("[data-hc-layer]").forEach((node) => { node.hidden = query && !node.textContent.toLowerCase().includes(query); });
        root.querySelectorAll("[data-hc-pose]").forEach((node) => { node.hidden = query && !node.textContent.toLowerCase().includes(query); });
      }
    }

    function onKeydown(event) {
      const editing = ["INPUT", "SELECT", "TEXTAREA"].includes(document.activeElement?.tagName);
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") { event.preventDefault(); return event.shiftKey ? redo() : undo(); }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "y") { event.preventDefault(); return redo(); }
      if (editing) return;
      if (event.code === "Space") { event.preventDefault(); return togglePlay(); }
      if (event.key.toLowerCase() === "k") return addKeyframe();
      if (/^[1-4]$/.test(event.key)) return update((next) => { next.character.view = CHARACTER_VIEWS[Number(event.key) - 1].id; }, `Góc nhìn ${CHARACTER_VIEWS[Number(event.key) - 1].label}`);
      if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) {
        event.preventDefault();
        const step = event.shiftKey ? 10 : 2;
        const delta = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[event.key];
        return update((next) => {
          const id = next.rig.selectedJointId; const joint = next.rig.joints[id];
          const target = { x: clamp(joint.x + delta[0], 0, STAGE.width), y: clamp(joint.y + delta[1], 0, STAGE.height) };
          next.rig.joints = ["leftHand", "rightHand", "leftFoot", "rightFoot"].includes(id) ? applyIK(next.rig.joints, id, target, next.rig.constraints) : next.rig.joints;
          if (!["leftHand", "rightHand", "leftFoot", "rightFoot"].includes(id)) Object.assign(next.rig.joints[id], target);
          next.activePose = "custom";
        }, `Đã dịch joint ${project.rig.selectedJointId}`);
      }
    }

    function bind() {
      root.addEventListener("click", onClick);
      root.addEventListener("change", onChange);
      root.addEventListener("input", onInput);
      root.addEventListener("keydown", onKeydown);
      root.addEventListener("pointerdown", handlePointerDown);
      root.addEventListener("pointermove", handlePointerMove);
      root.addEventListener("pointerup", handlePointerUp);
      root.addEventListener("pointercancel", handlePointerUp);
    }

    function unmountController() {
      mounted = false;
      playing = false;
      if (runtime.cancelAnimationFrame && raf) runtime.cancelAnimationFrame(raf); else clearTimeout(raf);
      cameraStream?.getTracks?.().forEach((track) => track.stop());
      microphoneStream?.getTracks?.().forEach((track) => track.stop());
      const preview = root.querySelector("[data-hc-webcam-preview]");
      if (preview) preview.srcObject = null;
      audioBuffer = null;
      root.removeEventListener("click", onClick);
      root.removeEventListener("change", onChange);
      root.removeEventListener("input", onInput);
      root.removeEventListener("keydown", onKeydown);
      root.removeEventListener("pointerdown", handlePointerDown);
      root.removeEventListener("pointermove", handlePointerMove);
      root.removeEventListener("pointerup", handlePointerUp);
      root.removeEventListener("pointercancel", handlePointerUp);
      root.replaceChildren();
      root.classList.remove("hc-studio");
      delete root.dataset.graphicCharacter;
    }

    render(); bind();
    raf = runtime.requestAnimationFrame ? runtime.requestAnimationFrame(tick) : setTimeout(() => tick(Date.now()), 33);
    return {
      getProject: () => clone(project),
      setProject(next) { project = normalizeProject(next); time = 0; history = [clone(project)]; historyIndex = 0; persist(); render(); },
      applyPose,
      applyArchetype,
      applyMotionSequence,
      addKeyframe,
      addLipMarker,
      undo,
      redo,
      play: () => { if (!playing) togglePlay(); },
      pause: () => { if (playing) togglePlay(); },
      exportProject: () => clone(project),
      exportSpriteSheet,
      exportPngSequence,
      exportTransparentWebM,
      unmount: unmountController
    };
  }

  const instances = typeof WeakMap !== "undefined" ? new WeakMap() : new Map();

  function mount(root, options) {
    if (!root || typeof root.querySelector !== "function") return null;
    if (instances.has(root)) return instances.get(root);
    const controller = createController(root, options || {});
    instances.set(root, controller);
    return controller;
  }

  function unmount(root) {
    const controller = instances.get(root);
    if (!controller) return false;
    controller.unmount();
    instances.delete(root);
    return true;
  }

  const api = {
    VERSION,
    STORAGE_KEY,
    PHONEMES: PHONEMES.slice(),
    CHARACTER_LIBRARY: clone(CHARACTER_LIBRARY),
    ARCHETYPES: ARCHETYPES.map((item) => clone(item)),
    CHARACTER_VIEWS: CHARACTER_VIEWS.map((item) => ({ ...item })),
    EXPRESSIONS: EXPRESSIONS.map((item) => ({ ...item })),
    JOINT_DEFINITIONS: JOINT_DEFINITIONS.map((item) => ({ ...item })),
    BONE_DEFINITIONS: BONE_DEFINITIONS.map((item) => ({ ...item })),
    LAYER_TREE: LAYER_TREE.map((item) => ({ ...item })),
    POSE_PRESETS: POSE_PRESETS.map((item) => ({ ...item })),
    MOTION_LIBRARY: MOTION_LIBRARY.map((item) => ({ ...item })),
    createJoints,
    poseJoints,
    createMotionFrames,
    solveTwoBoneIK,
    applyIK,
    amplitudeToPhoneme,
    buildVisemeTimeline,
    characterDisplayJoints,
    transparentWebMSupport,
    createKeyframe,
    createDefaultProject,
    normalizeProject,
    interpolateProject,
    formatTime,
    mount,
    unmount
  };

  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (hasWindow) runtime.HHGraphicCharacter = api;
}(typeof window !== "undefined" ? window : globalThis));
