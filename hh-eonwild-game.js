(function (global, factory) {
  "use strict";
  const api = factory(global || {});
  if (typeof module === "object" && module.exports) module.exports = api;
  if (global) global.HHEonWild = api;
})(typeof window !== "undefined" ? window : globalThis, function createEonWild(global) {
  "use strict";

  const VERSION = "1.0.0";
  const STORAGE_KEY = "hh.game.eonwild.v1";
  const SCHEMA_VERSION = 1;
  const WORLD_SIZE = 4096;
  const VIEW_IDS = Object.freeze(["world", "species", "ecosystem", "timeline", "expeditions", "settings"]);
  const ERA_META = Object.freeze({
    paleozoic: { label: "Đại Cổ sinh", range: "541–252 triệu năm", color: "#58e6d2" },
    mesozoic: { label: "Đại Trung sinh", range: "252–66 triệu năm", color: "#ffb65f" },
    cenozoic: { label: "Đại Tân sinh", range: "66 triệu–11.700 năm", color: "#d894ff" },
    modern: { label: "Trái Đất hiện đại", range: "Hiện tại", color: "#72ef9d" }
  });
  const BIOMES = Object.freeze({
    ocean: { label: "Đại dương cổ", color: "#0b4667", accent: "#51d8ff" },
    reef: { label: "Rạn biển nông", color: "#176f78", accent: "#65f4cf" },
    wetland: { label: "Đầm lầy", color: "#244f45", accent: "#8be28c" },
    forest: { label: "Rừng nguyên sinh", color: "#153e32", accent: "#6ee78a" },
    grassland: { label: "Đồng cỏ", color: "#526432", accent: "#d7ef78" },
    desert: { label: "Hoang mạc", color: "#765331", accent: "#ffc86f" },
    tundra: { label: "Băng nguyên", color: "#607b86", accent: "#d8f7ff" },
    volcanic: { label: "Cao nguyên núi lửa", color: "#4d3436", accent: "#ff8469" }
  });
  const SPECIES_ROWS = Object.freeze([
    ["anomalocaris", "Anomalocaris", "Thợ săn biển Cambri", "paleozoic", "Cambri", "meat", "swim", "water", 0.15, 8, "#62e8d5", "Cảm nhận sóng áp suất"],
    ["opabinia", "Opabinia", "Sinh vật năm mắt", "paleozoic", "Cambri", "omnivore", "swim", "water", 0.02, 6, "#8adfff", "Thị giác toàn cảnh"],
    ["hallucigenia", "Hallucigenia", "Động vật gai Cambri", "paleozoic", "Cambri", "plant", "crawl", "water", 0.001, 2, "#d58cff", "Giáp gai"],
    ["dunkleosteus", "Dunkleosteus", "Cá giáp khổng lồ", "paleozoic", "Devon", "meat", "swim", "water", 900, 15, "#65b9d8", "Cú cắn bản lề"],
    ["tiktaalik", "Tiktaalik", "Cá vây thùy ven bờ", "paleozoic", "Devon", "meat", "amphibious", "wetland", 45, 7, "#82c79a", "Bò qua bãi cạn"],
    ["arthropleura", "Arthropleura", "Chân khớp khổng lồ", "paleozoic", "Carbon", "plant", "crawl", "land", 50, 5, "#9fba63", "Giáp đốt"],
    ["meganeura", "Meganeura", "Chuồn chuồn khổng lồ", "paleozoic", "Carbon", "meat", "fly", "air", 0.45, 22, "#73efc5", "Tầm nhìn chuyển động"],
    ["dimetrodon", "Dimetrodon", "Synapsid lưng buồm", "paleozoic", "Permi", "meat", "walk", "land", 180, 10, "#ef9d66", "Điều nhiệt lưng buồm"],
    ["coelophysis", "Coelophysis", "Khủng long săn mồi sớm", "mesozoic", "Trias", "meat", "run", "land", 22, 26, "#ffbe69", "Tăng tốc theo đàn"],
    ["stegosaurus", "Stegosaurus", "Khủng long phiến lưng", "mesozoic", "Jura", "plant", "walk", "land", 5000, 8, "#d9b66f", "Quét đuôi"],
    ["brachiosaurus", "Brachiosaurus", "Sauropod cổ cao", "mesozoic", "Jura", "plant", "walk", "land", 35000, 7, "#9ac37e", "Vươn tới tán cao"],
    ["archaeopteryx", "Archaeopteryx", "Chim nguyên thủy", "mesozoic", "Jura", "omnivore", "fly", "air", 1, 19, "#ff8aa6", "Lượn giữa tán rừng"],
    ["spinosaurus", "Spinosaurus", "Thợ săn bán thủy sinh", "mesozoic", "Phấn Trắng", "meat", "amphibious", "wetland", 7000, 13, "#f27a61", "Cảm nhận con mồi dưới nước"],
    ["tyrannosaurus", "Tyrannosaurus rex", "Bạo chúa thằn lằn", "mesozoic", "Phấn Trắng", "meat", "run", "land", 8200, 12, "#e96b57", "Khứu giác siêu nhạy"],
    ["triceratops", "Triceratops", "Ba sừng phòng thủ", "mesozoic", "Phấn Trắng", "plant", "run", "land", 7500, 11, "#e4ba65", "Xung phong bằng sừng"],
    ["velociraptor", "Velociraptor", "Thợ săn nhỏ có lông", "mesozoic", "Phấn Trắng", "meat", "run", "land", 15, 31, "#dd8b65", "Phối hợp bầy săn"],
    ["ankylosaurus", "Ankylosaurus", "Pháo đài sống", "mesozoic", "Phấn Trắng", "plant", "walk", "land", 6500, 7, "#8da477", "Chùy đuôi"],
    ["pteranodon", "Pteranodon", "Bò sát bay biển", "mesozoic", "Phấn Trắng", "meat", "fly", "air", 35, 42, "#6fcbe6", "Lượn theo luồng nhiệt"],
    ["mosasaurus", "Mosasaurus", "Bò sát biển khổng lồ", "mesozoic", "Phấn Trắng", "meat", "swim", "water", 14000, 28, "#397ea4", "Tăng tốc phục kích"],
    ["ichthyosaurus", "Ichthyosaurus", "Bò sát biển dáng cá", "mesozoic", "Jura", "meat", "swim", "water", 90, 24, "#559ec8", "Định hướng dưới nước"],
    ["titanoboa", "Titanoboa", "Trăn khổng lồ Paleocene", "cenozoic", "Paleogene", "meat", "crawl", "wetland", 1100, 8, "#8bb35f", "Cảm nhận nhiệt"],
    ["basilosaurus", "Basilosaurus", "Cá voi cổ dài", "cenozoic", "Eocene", "meat", "swim", "water", 6000, 19, "#6b91c6", "Định vị âm sơ khai"],
    ["paraceratherium", "Paraceratherium", "Tê giác không sừng khổng lồ", "cenozoic", "Oligocene", "plant", "walk", "land", 17000, 10, "#b5a47b", "Sải bước đường dài"],
    ["argentavis", "Argentavis", "Chim bay khổng lồ", "cenozoic", "Miocene", "meat", "fly", "air", 72, 38, "#c7a676", "Lượn tiết kiệm năng lượng"],
    ["phorusrhacos", "Phorusrhacos", "Chim khủng bố", "cenozoic", "Miocene", "meat", "run", "land", 130, 30, "#d49b67", "Mổ bổ nhào"],
    ["smilodon", "Smilodon", "Hổ răng kiếm", "cenozoic", "Pleistocene", "meat", "run", "land", 220, 24, "#f0a963", "Phục kích im lặng"],
    ["mammuthus", "Mammuthus primigenius", "Voi ma mút lông xoăn", "cenozoic", "Pleistocene", "plant", "walk", "land", 6000, 9, "#bda582", "Chống rét theo đàn"],
    ["megatherium", "Megatherium", "Lười đất khổng lồ", "cenozoic", "Pleistocene", "plant", "walk", "land", 4000, 6, "#a98c6b", "Đứng dựng phòng vệ"],
    ["doedicurus", "Doedicurus", "Thú giáp đuôi chùy", "cenozoic", "Pleistocene", "plant", "walk", "land", 1400, 7, "#a9a278", "Giáp xương"],
    ["thylacoleo", "Thylacoleo", "Sư tử túi", "cenozoic", "Pleistocene", "meat", "climb", "land", 120, 20, "#c78f64", "Leo cây phục kích"],
    ["elephant", "Loxodonta africana", "Voi châu Phi", "modern", "Hiện đại", "plant", "walk", "land", 6000, 10, "#aeb6bd", "Hạ âm liên lạc xa"],
    ["lion", "Panthera leo", "Sư tử", "modern", "Hiện đại", "meat", "run", "land", 190, 25, "#e9b759", "Săn theo bầy"],
    ["tiger", "Panthera tigris", "Hổ", "modern", "Hiện đại", "meat", "run", "land", 220, 27, "#f28a43", "Ngụy trang vằn"],
    ["wolf", "Canis lupus", "Sói xám", "modern", "Hiện đại", "meat", "run", "land", 45, 30, "#9ba9b7", "Theo dấu theo đàn"],
    ["polar-bear", "Ursus maritimus", "Gấu Bắc Cực", "modern", "Hiện đại", "meat", "amphibious", "tundra", 450, 18, "#dff7ff", "Đánh hơi trên băng"],
    ["giraffe", "Giraffa camelopardalis", "Hươu cao cổ", "modern", "Hiện đại", "plant", "run", "land", 1000, 20, "#e8b86e", "Quan sát tầng cao"],
    ["kangaroo", "Macropus giganteus", "Kangaroo xám", "modern", "Hiện đại", "plant", "run", "land", 66, 32, "#bf9b76", "Nhảy tiết kiệm năng lượng"],
    ["panda", "Ailuropoda melanoleuca", "Gấu trúc lớn", "modern", "Hiện đại", "plant", "walk", "land", 105, 8, "#e9eef0", "Tiêu hóa tre"],
    ["komodo", "Varanus komodoensis", "Rồng Komodo", "modern", "Hiện đại", "meat", "run", "land", 75, 18, "#81966a", "Lưỡi cảm nhận mùi"],
    ["crocodile", "Crocodylus porosus", "Cá sấu nước mặn", "modern", "Hiện đại", "meat", "amphibious", "wetland", 700, 16, "#63876c", "Cảm nhận rung động nước"],
    ["golden-eagle", "Aquila chrysaetos", "Đại bàng vàng", "modern", "Hiện đại", "meat", "fly", "air", 5.5, 52, "#c49b57", "Thị lực khoảng xa"],
    ["orca", "Orcinus orca", "Cá voi sát thủ", "modern", "Hiện đại", "meat", "swim", "water", 4500, 32, "#6eb5d1", "Định vị âm theo đàn"],
    ["blue-whale", "Balaenoptera musculus", "Cá voi xanh", "modern", "Hiện đại", "filter", "swim", "water", 120000, 20, "#579bc8", "Tiếng gọi xuyên đại dương"],
    ["giant-octopus", "Enteroctopus dofleini", "Bạch tuộc Thái Bình Dương", "modern", "Hiện đại", "meat", "swim", "water", 50, 9, "#ca7184", "Đổi màu và giải đố"],
    ["emperor-penguin", "Aptenodytes forsteri", "Chim cánh cụt hoàng đế", "modern", "Hiện đại", "meat", "amphibious", "tundra", 30, 11, "#88bcd6", "Giữ ấm theo cụm"],
    ["axolotl", "Ambystoma mexicanum", "Kỳ giông Mexico", "modern", "Hiện đại", "meat", "amphibious", "wetland", 0.2, 5, "#ff9fc0", "Tái tạo mô"],
    ["honeybee", "Apis mellifera", "Ong mật", "modern", "Hiện đại", "nectar", "fly", "air", 0.0001, 14, "#ffd353", "Điệu nhảy định hướng"],
    ["mantis-shrimp", "Odontodactylus scyllarus", "Tôm bọ ngựa", "modern", "Hiện đại", "meat", "swim", "water", 0.09, 7, "#58f2ca", "Thị giác phân cực"],
    ["electric-eel", "Electrophorus electricus", "Lươn điện", "modern", "Hiện đại", "meat", "swim", "water", 20, 8, "#76dce5", "Cảm nhận điện trường"]
  ]);
  const SPECIES = Object.freeze(SPECIES_ROWS.map(([id, name, vietnamese, era, period, diet, locomotion, habitat, mass, speed, color, ability]) => Object.freeze({ id, name, vietnamese, era, period, diet, locomotion, habitat, mass, speed, color, ability })));
  const SPECIES_BY_ID = new Map(SPECIES.map((species) => [species.id, species]));
  const EXPEDITIONS = Object.freeze([
    { id: "first-water", title: "Mạch nước đầu tiên", detail: "Tìm một hồ nước và uống trước khi khát xuống 35%.", reward: "Mở dấu chân nước", target: "water" },
    { id: "food-web", title: "Một mắt xích trong lưới sống", detail: "Tìm đúng thức ăn của loài đang chơi.", reward: "+12 tăng trưởng", target: "food" },
    { id: "migration", title: "Đường di cư", detail: "Đi tới vùng sáng trên bản đồ mà không kiệt sức.", reward: "Khám phá biome", target: "migration" },
    { id: "scent", title: "Đọc dấu vết", detail: "Dùng giác quan Q để phát hiện ba tín hiệu tự nhiên.", reward: "Codex giác quan", target: "scent" },
    { id: "nest", title: "Dòng gene tiếp nối", detail: "Trưởng thành rồi tạo tổ ở nơi trú ẩn bằng phím N.", reward: "Checkpoint dòng gene", target: "nest" }
  ]);
  const instances = new WeakMap();
  const activeHosts = new Set();

  const clamp = (value, min, max) => Math.min(max, Math.max(min, Number(value) || 0));
  const escapeHtml = (value) => String(value ?? "").replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[character]));
  const safeView = (value) => VIEW_IDS.includes(value) ? value : "world";
  const seededRandom = (seed = 1) => {
    let value = (Number(seed) || 1) >>> 0;
    return () => { value ^= value << 13; value ^= value >>> 17; value ^= value << 5; return (value >>> 0) / 4294967296; };
  };
  const hashSeed = (value) => [...String(value || "eonwild")].reduce((hash, character) => Math.imul(hash ^ character.charCodeAt(0), 16777619) >>> 0, 2166136261);
  const terrainAt = (x, y, seed = 1) => {
    const nx = clamp(x / WORLD_SIZE, 0, 1);
    const ny = clamp(y / WORLD_SIZE, 0, 1);
    const wave = Math.sin((nx * 7.2 + seed * .0001) * Math.PI) + Math.cos((ny * 6.1 - seed * .00013) * Math.PI) + Math.sin((nx + ny) * 11.5);
    if (nx < .12 || ny > .88 || (wave < -1.55 && nx > .42)) return "ocean";
    if (wave < -.9) return "reef";
    if (ny > .63 && wave < .25) return "wetland";
    if (ny < .16) return "tundra";
    if (nx > .78 && ny < .58) return "desert";
    if (nx > .56 && ny > .68) return "volcanic";
    return wave > .55 ? "forest" : "grassland";
  };

  function normalizeState(value = {}) {
    const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
    const player = source.player && typeof source.player === "object" ? source.player : {};
    const settings = source.settings && typeof source.settings === "object" ? source.settings : {};
    return {
      schemaVersion: SCHEMA_VERSION,
      speciesId: SPECIES_BY_ID.has(source.speciesId) ? source.speciesId : "triceratops",
      player: {
        x: clamp(player.x || WORLD_SIZE * .48, 80, WORLD_SIZE - 80),
        y: clamp(player.y || WORLD_SIZE * .48, 80, WORLD_SIZE - 80),
        health: clamp(player.health ?? 100, 0, 100), hunger: clamp(player.hunger ?? 82, 0, 100),
        thirst: clamp(player.thirst ?? 78, 0, 100), stamina: clamp(player.stamina ?? 100, 0, 100),
        growth: clamp(player.growth ?? 18, 0, 100), lineage: clamp(player.lineage || 0, 0, 9999)
      },
      settings: {
        difficulty: ["sanctuary", "balanced", "wild"].includes(settings.difficulty) ? settings.difficulty : "balanced",
        motion: ["static", "balanced", "cinematic"].includes(settings.motion) ? settings.motion : "balanced",
        density: ["low", "balanced", "high"].includes(settings.density) ? settings.density : "balanced",
        sound: settings.sound === true,
        convergence: settings.convergence !== false,
        seed: String(settings.seed || "EON-541").replace(/[^a-z0-9-]/gi, "").slice(0, 24) || "EON-541"
      },
      discoveries: Array.isArray(source.discoveries) ? [...new Set(source.discoveries.filter((id) => SPECIES_BY_ID.has(id)))].slice(0, 500) : [],
      completed: Array.isArray(source.completed) ? [...new Set(source.completed.filter((id) => EXPEDITIONS.some((mission) => mission.id === id)))].slice(0, 50) : [],
      activeExpedition: EXPEDITIONS.some((mission) => mission.id === source.activeExpedition) ? source.activeExpedition : "first-water",
      updatedAt: Date.now()
    };
  }

  function stepVitals(player, seconds, difficulty = "balanced", moving = false, sprinting = false) {
    const factor = difficulty === "wild" ? 1.45 : difficulty === "sanctuary" ? .55 : 1;
    const next = { ...player };
    next.hunger = clamp(next.hunger - seconds * .12 * factor, 0, 100);
    next.thirst = clamp(next.thirst - seconds * .17 * factor, 0, 100);
    next.stamina = clamp(next.stamina + seconds * (sprinting ? -8.5 : moving ? -1.4 : 7), 0, 100);
    next.growth = clamp(next.growth + seconds * .035 * (next.hunger > 35 && next.thirst > 35 ? 1 : .2), 0, 100);
    if (!next.hunger || !next.thirst) next.health = clamp(next.health - seconds * 2.2 * factor, 0, 100);
    else if (next.hunger > 70 && next.thirst > 70) next.health = clamp(next.health + seconds * .35, 0, 100);
    return next;
  }

  function createWorld(seedValue = "EON-541", density = "balanced") {
    const seed = hashSeed(seedValue);
    const random = seededRandom(seed);
    const resourceCount = density === "high" ? 96 : density === "low" ? 52 : 72;
    const resources = [];
    for (let index = 0; index < resourceCount; index += 1) {
      const x = 90 + random() * (WORLD_SIZE - 180);
      const y = 90 + random() * (WORLD_SIZE - 180);
      const terrain = terrainAt(x, y, seed);
      const type = ["ocean", "reef", "wetland"].includes(terrain) && index % 3 === 0 ? "water" : index % 9 === 0 ? "shelter" : index % 5 === 0 ? "carcass" : "plant";
      resources.push({ id: `resource-${index}`, x, y, type, amount: 100, terrain });
    }
    return {
      seed, resources,
      migration: { x: WORLD_SIZE * (.3 + random() * .4), y: WORLD_SIZE * (.25 + random() * .5), radius: 190 },
      weather: { type: random() > .7 ? "storm" : random() > .45 ? "mist" : "clear", phase: random() * Math.PI * 2 },
      day: random() * 24
    };
  }

  const readState = () => { try { return normalizeState(JSON.parse(global.localStorage?.getItem?.(STORAGE_KEY) || "{}")); } catch { return normalizeState(); } };
  const saveState = (instance) => { instance.state.updatedAt = Date.now(); try { global.localStorage?.setItem?.(STORAGE_KEY, JSON.stringify(instance.state)); return true; } catch { return false; } };
  const stageLabel = (growth) => growth < 25 ? "Con non" : growth < 60 ? "Thiếu niên" : growth < 92 ? "Trưởng thành" : "Cá thể đầu đàn";
  const formatMass = (mass) => mass >= 1000 ? `${Math.round(mass / 100) / 10} tấn` : mass >= 1 ? `${mass} kg` : `${Math.round(mass * 1000)} g`;
  const dietLabel = (diet) => ({ meat: "Ăn thịt", plant: "Ăn thực vật", omnivore: "Ăn tạp", filter: "Lọc thức ăn", nectar: "Ăn mật" }[diet] || diet);

  function navMarkup(view) {
    return `<nav class="hwe-nav" aria-label="Điều hướng HH EonWild">${[
      ["world", "Thế giới sống", "◉"], ["species", "Eon Codex", "DNA"], ["ecosystem", "Lưới sinh thái", "⌁"],
      ["timeline", "Eon Atlas", "◷"], ["expeditions", "Thám hiểm", "◇"], ["settings", "Cài đặt", "⚙"]
    ].map(([id, label, icon]) => `<button type="button" data-hwe-route="/game/${id}" aria-current="${view === id ? "page" : "false"}"><i>${icon}</i><span>${label}</span></button>`).join("")}</nav>`;
  }

  function speciesCardsMarkup(state, compact = false) {
    return SPECIES.map((species) => `<button type="button" class="hwe-species-card${state.speciesId === species.id ? " is-selected" : ""}" data-hwe-species="${species.id}" data-era="${species.era}" data-diet="${species.diet}" data-search="${escapeHtml(`${species.name} ${species.vietnamese} ${species.period}`.toLowerCase())}" style="--species:${species.color}">
      <i aria-hidden="true">${species.locomotion === "fly" ? "⌁" : species.locomotion === "swim" ? "≈" : species.locomotion === "crawl" ? "〰" : "◆"}</i><span><strong>${escapeHtml(species.vietnamese)}</strong>${compact ? "" : `<small>${escapeHtml(species.name)} · ${escapeHtml(species.period)}</small>`}</span></button>`).join("");
  }

  function worldMarkup(state) {
    const selected = SPECIES_BY_ID.get(state.speciesId);
    return `<div class="hwe-world-layout">
      <aside class="hwe-species-dock" aria-label="Chọn loài"><header><span><small>PLAYABLE REGISTRY</small><strong>${SPECIES.length} loài khởi đầu</strong></span><button type="button" data-hwe-open-codex>Mở Codex</button></header><label class="hwe-search"><span>⌕</span><input type="search" data-hwe-species-search placeholder="Tìm loài hoặc kỷ…" aria-label="Tìm loài"></label><div class="hwe-species-list">${speciesCardsMarkup(state, true)}</div></aside>
      <section class="hwe-viewport" data-hwe-viewport aria-label="Thế giới EonWild đang chơi">
        <canvas data-hwe-canvas tabindex="0" aria-label="Bản đồ sinh tồn. Dùng WASD hoặc phím mũi tên để di chuyển."></canvas>
        <div class="hwe-atmosphere" aria-hidden="true"><i></i><i></i><i></i><i></i></div>
        <div class="hwe-hud hwe-hud--top"><span><small>Biome</small><strong data-hwe-biome>Đang dựng thế giới</strong></span><span><small>Thời gian</small><strong data-hwe-time>--:--</strong></span><span><small>Thời tiết</small><strong data-hwe-weather>Ổn định</strong></span><button type="button" data-hwe-fullscreen aria-label="Toàn màn hình">⛶</button></div>
        <div class="hwe-minimap"><canvas data-hwe-minimap width="180" height="180" aria-label="Bản đồ thu nhỏ"></canvas><span>MIGRATION</span></div>
        <div class="hwe-sense" data-hwe-sense hidden><span>Q · ECO SENSE</span><strong>Đang đọc dấu vết tự nhiên…</strong></div>
        <div class="hwe-start-panel" data-hwe-start-panel><small>LOCAL VERTICAL SLICE · KHÔNG CÓ CON NGƯỜI</small><h2>Trở thành ${escapeHtml(selected.vietnamese)}</h2><p>Sinh tồn trong thế giới hợp lưu nhiều kỷ. Kiếm nước, ăn đúng khẩu phần, trưởng thành và đi theo nhịp hệ sinh thái.</p><div><button type="button" data-hwe-difficulty="sanctuary" class="${state.settings.difficulty === "sanctuary" ? "is-active" : ""}">Sanctuary</button><button type="button" data-hwe-difficulty="balanced" class="${state.settings.difficulty === "balanced" ? "is-active" : ""}">Cân bằng</button><button type="button" data-hwe-difficulty="wild" class="${state.settings.difficulty === "wild" ? "is-active" : ""}">Wild</button></div><button type="button" class="is-primary" data-hwe-start>▶ Bắt đầu vòng đời</button></div>
        <div class="hwe-death-panel" data-hwe-death hidden><small>VÒNG TUẦN HOÀN TIẾP DIỄN</small><h2>Dòng sống đã kết thúc</h2><p>Chất dinh dưỡng trở lại hệ sinh thái. Dữ liệu Codex và dòng gene vẫn được giữ.</p><button type="button" data-hwe-respawn>Nở lại</button></div>
        <div class="hwe-touch-controls" aria-label="Điều khiển cảm ứng"><button type="button" data-hwe-touch="ArrowUp">▲</button><button type="button" data-hwe-touch="ArrowLeft">◀</button><button type="button" data-hwe-touch="ArrowDown">▼</button><button type="button" data-hwe-touch="ArrowRight">▶</button><button type="button" data-hwe-action="interact">E</button><button type="button" data-hwe-action="sense">Q</button></div>
      </section>
      <aside class="hwe-telemetry"><header><span class="hwe-avatar" style="--species:${selected.color}">◆</span><span><small>${escapeHtml(selected.name)}</small><strong>${escapeHtml(selected.vietnamese)}</strong></span><button type="button" data-hwe-pause aria-pressed="false">Ⅱ</button></header>
        <section class="hwe-vitals"><label>Máu <progress data-hwe-vital="health" max="100" value="${state.player.health}"></progress><b data-hwe-value="health">${Math.round(state.player.health)}</b></label><label>Đói <progress data-hwe-vital="hunger" max="100" value="${state.player.hunger}"></progress><b data-hwe-value="hunger">${Math.round(state.player.hunger)}</b></label><label>Khát <progress data-hwe-vital="thirst" max="100" value="${state.player.thirst}"></progress><b data-hwe-value="thirst">${Math.round(state.player.thirst)}</b></label><label>Thể lực <progress data-hwe-vital="stamina" max="100" value="${state.player.stamina}"></progress><b data-hwe-value="stamina">${Math.round(state.player.stamina)}</b></label><label>Trưởng thành <progress data-hwe-vital="growth" max="100" value="${state.player.growth}"></progress><b data-hwe-value="growth">${Math.round(state.player.growth)}</b></label></section>
        <section class="hwe-species-facts"><small>ĐẶC TÍNH LOÀI</small><p><b>${escapeHtml(dietLabel(selected.diet))}</b><span>${escapeHtml(selected.period)} · ${escapeHtml(formatMass(selected.mass))}</span></p><p><b>Giác quan</b><span>${escapeHtml(selected.ability)}</span></p><p><b>Giai đoạn</b><span data-hwe-stage>${stageLabel(state.player.growth)}</span></p></section>
        <section class="hwe-mission"><small>NHIỆM VỤ SINH THÁI</small><strong data-hwe-mission-title>${escapeHtml(EXPEDITIONS.find((row) => row.id === state.activeExpedition)?.title || EXPEDITIONS[0].title)}</strong><p data-hwe-mission-copy>${escapeHtml(EXPEDITIONS.find((row) => row.id === state.activeExpedition)?.detail || EXPEDITIONS[0].detail)}</p><progress data-hwe-mission-progress max="100" value="0"></progress></section>
        <section class="hwe-log"><small>FIELD SIGNALS</small><div data-hwe-log aria-live="polite"><p>Thế giới đang chờ bạn bắt đầu.</p></div></section>
      </aside>
    </div>`;
  }

  function codexMarkup(state) {
    const selected = SPECIES_BY_ID.get(state.speciesId);
    return `<section class="hwe-library"><header class="hwe-view-hero"><div><small>EON CODEX · DATAPACK READY</small><h2>Bách khoa sự sống xuyên thời đại</h2><p>${SPECIES.length} loài đại diện đang hoạt động. Kiến trúc tách catalog, wildlife AI và playable flagship để mở rộng có kiểm chứng.</p></div><div class="hwe-stat-orbit"><b>${SPECIES.length}</b><span>loài khởi đầu</span></div></header><div class="hwe-filterbar"><label><span>⌕</span><input type="search" data-hwe-species-search placeholder="Tên Việt, Latin hoặc kỷ địa chất…"></label>${Object.entries(ERA_META).map(([id, meta]) => `<button type="button" data-hwe-era-filter="${id}" aria-pressed="false" style="--era:${meta.color}">${meta.label}</button>`).join("")}<button type="button" data-hwe-era-filter="all" aria-pressed="true">Tất cả</button></div><div class="hwe-codex-layout"><div class="hwe-codex-grid">${speciesCardsMarkup(state)}</div><aside class="hwe-codex-detail" data-hwe-codex-detail><span class="hwe-creature-sigil" style="--species:${selected.color}">◆</span><small>${escapeHtml(ERA_META[selected.era].label)} · ${escapeHtml(selected.period)}</small><h3>${escapeHtml(selected.vietnamese)}</h3><em>${escapeHtml(selected.name)}</em><dl><div><dt>Khối lượng</dt><dd>${escapeHtml(formatMass(selected.mass))}</dd></div><div><dt>Khẩu phần</dt><dd>${escapeHtml(dietLabel(selected.diet))}</dd></div><div><dt>Vận động</dt><dd>${escapeHtml(selected.locomotion)}</dd></div><div><dt>Khả năng</dt><dd>${escapeHtml(selected.ability)}</dd></div></dl><button type="button" data-hwe-play-species="${selected.id}">Chơi loài này →</button></aside></div></section>`;
  }

  function ecosystemMarkup(state) {
    const counts = Object.keys(ERA_META).map((era) => [era, SPECIES.filter((species) => species.era === era).length]);
    return `<section class="hwe-ecosystem"><header class="hwe-view-hero"><div><small>LIVING FOOD WEB · SEASON SIMULATOR</small><h2>Hệ sinh thái tự cân bằng</h2><p>Biomass Ledger giữ số lượng thú săn mồi tương ứng với con mồi, thực vật và nguồn nước; AI chỉ lấp niche còn thiếu.</p></div><button type="button" data-hwe-simulate-season>Chạy một mùa →</button></header><div class="hwe-eco-grid"><article class="hwe-food-web"><span class="is-source">Nắng · Nước</span><i></i><span class="is-plant">Thực vật</span><i></i><span class="is-prey">Ăn cỏ</span><i></i><span class="is-predator">Săn mồi</span><i></i><span class="is-cycle">Phân hủy</span></article><article class="hwe-population"><small>QUẦN THỂ THEO ĐẠI</small>${counts.map(([era, count]) => `<label><span>${ERA_META[era].label}</span><progress max="20" value="${count}"></progress><b>${count}</b></label>`).join("")}</article><article class="hwe-director"><small>ECOLOGY DIRECTOR</small><h3 data-hwe-season-title>Mùa nước dâng</h3><p data-hwe-season-copy>Đầm lầy mở rộng, đàn ăn cỏ dịch chuyển và thú săn mồi đi theo dấu mùi.</p><div><span>Hạn hán</span><span>Bão</span><span>Cháy tự nhiên</span><span>Mùa sinh sản</span><span>Tảo nở</span><span>Băng tan</span></div></article><article class="hwe-senses"><small>GIÁC QUAN KHÔNG PHẢI CON NGƯỜI</small>${["Mùi theo gió", "Rung động đất", "Định vị âm", "Nhiệt", "Điện trường", "Phân cực ánh sáng", "Từ trường", "Pheromone"].map((sense, index) => `<span style="--i:${index}">${sense}</span>`).join("")}</article></div></section>`;
  }

  function timelineMarkup() {
    return `<section class="hwe-atlas"><header class="hwe-view-hero"><div><small>EON ATLAS · 541 TRIỆU NĂM</small><h2>Trái Đất Muôn Thời</h2><p>Era Realm giữ hệ sinh thái đúng niên đại; Eon Convergence là sandbox giả tưởng riêng để các thời đại gặp nhau.</p></div></header><div class="hwe-timeline">${Object.entries(ERA_META).map(([id, meta], index) => `<article style="--era:${meta.color};--i:${index}"><i></i><small>${meta.range}</small><h3>${meta.label}</h3><p>${id === "paleozoic" ? "Biển Cambri, rừng Carbon và những bước đầu lên cạn." : id === "mesozoic" ? "Bò sát thống trị đất, biển và bầu trời." : id === "cenozoic" ? "Thú có vú, chim khổng lồ và kỷ băng hà." : "Đa dạng hiện đại, biến động khí hậu và bảo tồn."}</p><b>${SPECIES.filter((species) => species.era === id).length} loài trong vertical slice</b></article>`).join("")}</div><div class="hwe-realm-note"><strong>Hai luật thế giới</strong><span><b>Era Realm</b> Không trộn loài sai niên đại.</span><span><b>Eon Convergence</b> Sandbox hợp lưu, bật/tắt trong Cài đặt.</span></div></section>`;
  }

  function expeditionsMarkup(state) {
    return `<section class="hwe-expeditions"><header class="hwe-view-hero"><div><small>30-MINUTE EXPEDITIONS</small><h2>Nhiệm vụ do tự nhiên tạo ra</h2><p>Không NPC, không công trình và không nhiệm vụ kiểu con người. Mọi mục tiêu đều đến từ nhu cầu sinh tồn và biến động sinh thái.</p></div></header><div class="hwe-mission-grid">${EXPEDITIONS.map((mission, index) => `<article class="${state.completed.includes(mission.id) ? "is-complete" : state.activeExpedition === mission.id ? "is-active" : ""}" style="--i:${index}"><span>${state.completed.includes(mission.id) ? "✓" : String(index + 1).padStart(2, "0")}</span><small>${escapeHtml(mission.reward)}</small><h3>${escapeHtml(mission.title)}</h3><p>${escapeHtml(mission.detail)}</p><button type="button" data-hwe-expedition="${mission.id}">${state.activeExpedition === mission.id ? "Đang theo dõi" : "Theo dõi và chơi"}</button></article>`).join("")}</div></section>`;
  }

  function settingsMarkup(state) {
    return `<section class="hwe-settings"><header class="hwe-view-hero"><div><small>ACCESSIBILITY · PERFORMANCE · SAVE</small><h2>Cấu hình thế giới</h2><p>Mọi cài đặt và save của vertical slice chỉ nằm trên thiết bị. Multiplayer chưa được giả lập.</p></div><button type="button" data-hwe-reset>Khôi phục save mới…</button></header><div class="hwe-settings-grid"><article><small>ĐỘ KHÓ</small><h3>Nhịp sinh tồn</h3><label>Chế độ<select data-hwe-setting="difficulty"><option value="sanctuary" ${state.settings.difficulty === "sanctuary" ? "selected" : ""}>Sanctuary</option><option value="balanced" ${state.settings.difficulty === "balanced" ? "selected" : ""}>Cân bằng</option><option value="wild" ${state.settings.difficulty === "wild" ? "selected" : ""}>Wild Survival</option></select></label><label><input type="checkbox" data-hwe-setting="convergence" ${state.settings.convergence ? "checked" : ""}> Cho phép Eon Convergence</label></article><article><small>HIỆU ỨNG</small><h3>Motion budget</h3><label>Chuyển động<select data-hwe-setting="motion"><option value="static" ${state.settings.motion === "static" ? "selected" : ""}>Tĩnh</option><option value="balanced" ${state.settings.motion === "balanced" ? "selected" : ""}>Cân bằng</option><option value="cinematic" ${state.settings.motion === "cinematic" ? "selected" : ""}>Điện ảnh</option></select></label><label>Mật độ wildlife<select data-hwe-setting="density"><option value="low" ${state.settings.density === "low" ? "selected" : ""}>Thấp</option><option value="balanced" ${state.settings.density === "balanced" ? "selected" : ""}>Cân bằng</option><option value="high" ${state.settings.density === "high" ? "selected" : ""}>Cao</option></select></label></article><article><small>ÂM THANH & TRỢ NĂNG</small><h3>Tín hiệu rõ ràng</h3><label><input type="checkbox" data-hwe-setting="sound" ${state.settings.sound ? "checked" : ""}> Âm thanh tổng hợp sau tương tác</label><p>Hỗ trợ bàn phím, touch D-pad, gamepad, focus hiển thị, màu trạng thái kèm chữ và prefers-reduced-motion.</p></article><article><small>THẾ GIỚI</small><h3>Seed tái tạo được</h3><label>Seed<input type="text" maxlength="24" data-hwe-setting="seed" value="${escapeHtml(state.settings.seed)}"></label><p>World generation dùng seed cục bộ; không chứa ID tài khoản hoặc dữ liệu riêng tư.</p></article></div></section>`;
  }

  function viewMarkup(view, state) {
    if (view === "species") return codexMarkup(state);
    if (view === "ecosystem") return ecosystemMarkup(state);
    if (view === "timeline") return timelineMarkup();
    if (view === "expeditions") return expeditionsMarkup(state);
    if (view === "settings") return settingsMarkup(state);
    return worldMarkup(state);
  }

  function shellMarkup(instance) {
    const view = instance.view;
    return `<section class="hwe-root" data-hwe-root data-view="${view}" data-motion="${instance.state.settings.motion}" aria-label="HH EonWild"><header class="hwe-header"><div class="hwe-brand"><span aria-hidden="true"><i></i><b>EW</b></span><div><small>HH GAME · ORIGINAL ECO-SURVIVAL</small><h1>HH EonWild</h1><p>Trái Đất Muôn Thời · Không có con người</p></div></div><div class="hwe-header-status"><span><i></i> Local single-player</span><span>${SPECIES.length} loài đại diện</span><button type="button" data-hwe-quick-play>Chơi tiếp →</button></div></header>${navMarkup(view)}<main class="hwe-main" data-hwe-main>${viewMarkup(view, instance.state)}</main><footer class="hwe-controls"><span><kbd>WASD</kbd> Di chuyển</span><span><kbd>Shift</kbd> Chạy</span><span><kbd>E</kbd> Ăn/Uống</span><span><kbd>Q</kbd> Giác quan</span><span><kbd>F</kbd> Phòng vệ</span><span><kbd>N</kbd> Làm tổ</span><b data-hwe-fps>Engine nghỉ</b></footer><div class="hwe-toast" data-hwe-toast role="status" aria-live="polite"></div></section>`;
  }

  function setToast(instance, message) {
    const node = instance.root.querySelector("[data-hwe-toast]");
    if (!node) return;
    node.textContent = String(message || "").slice(0, 180);
    node.classList.add("is-visible");
    clearTimeout(instance.toastTimer);
    instance.toastTimer = setTimeout(() => node.classList.remove("is-visible"), 2600);
    playCue(instance, String(message || "").startsWith("✓") ? "complete" : "signal");
  }

  function playCue(instance, type = "signal") {
    if (!instance?.state?.settings?.sound) return false;
    const AudioEngine = global.AudioContext || global.webkitAudioContext;
    if (typeof AudioEngine !== "function") return false;
    try {
      const context = instance.audioContext || new AudioEngine();
      instance.audioContext = context;
      context.resume?.();
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const now = context.currentTime;
      oscillator.type = type === "complete" ? "sine" : "triangle";
      oscillator.frequency.setValueAtTime(type === "complete" ? 520 : 240, now);
      oscillator.frequency.exponentialRampToValueAtTime(type === "complete" ? 880 : 360, now + .16);
      gain.gain.setValueAtTime(.0001, now);
      gain.gain.exponentialRampToValueAtTime(.045, now + .02);
      gain.gain.exponentialRampToValueAtTime(.0001, now + .2);
      oscillator.connect(gain); gain.connect(context.destination); oscillator.start(now); oscillator.stop(now + .22);
      return true;
    } catch { return false; }
  }

  function updateCodexDetail(instance, species) {
    const panel = instance.root.querySelector("[data-hwe-codex-detail]");
    if (!panel || !species) return;
    panel.innerHTML = `<span class="hwe-creature-sigil" style="--species:${species.color}">◆</span><small>${escapeHtml(ERA_META[species.era].label)} · ${escapeHtml(species.period)}</small><h3>${escapeHtml(species.vietnamese)}</h3><em>${escapeHtml(species.name)}</em><dl><div><dt>Khối lượng</dt><dd>${escapeHtml(formatMass(species.mass))}</dd></div><div><dt>Khẩu phần</dt><dd>${escapeHtml(dietLabel(species.diet))}</dd></div><div><dt>Vận động</dt><dd>${escapeHtml(species.locomotion)}</dd></div><div><dt>Khả năng</dt><dd>${escapeHtml(species.ability)}</dd></div></dl><button type="button" data-hwe-play-species="${species.id}">Chơi loài này →</button>`;
  }

  function filterSpecies(instance) {
    const query = String(instance.root.querySelector("[data-hwe-species-search]")?.value || "").toLowerCase().trim();
    const activeEra = instance.eraFilter || "all";
    instance.root.querySelectorAll("[data-hwe-species]").forEach((card) => {
      card.hidden = Boolean((query && !card.dataset.search.includes(query)) || (activeEra !== "all" && card.dataset.era !== activeEra));
    });
  }

  function createPopulation(instance) {
    const random = seededRandom(instance.world.seed ^ 0x9e3779b9);
    const base = instance.state.settings.density === "high" ? 54 : instance.state.settings.density === "low" ? 24 : 38;
    const mobile = global.matchMedia?.("(max-width: 760px)")?.matches;
    const count = mobile ? Math.min(26, base) : base;
    return Array.from({ length: count }, (_, index) => {
      const species = SPECIES[Math.floor(random() * SPECIES.length)];
      return { id: `wild-${index}`, species, x: 100 + random() * (WORLD_SIZE - 200), y: 100 + random() * (WORLD_SIZE - 200), vx: (random() - .5) * 20, vy: (random() - .5) * 20, health: 100, phase: random() * Math.PI * 2, alive: true };
    });
  }

  function resizeCanvas(instance) {
    const canvas = instance.canvas;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(global.devicePixelRatio || 1, global.matchMedia?.("(max-width: 760px)")?.matches ? 1.2 : 1.6);
    const width = Math.max(320, Math.floor(rect.width * dpr));
    const height = Math.max(240, Math.floor(rect.height * dpr));
    if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height; }
    instance.dpr = dpr;
  }

  function habitatPenalty(species, terrain) {
    if (species.locomotion === "fly") return 1;
    const water = ["ocean", "reef"].includes(terrain);
    if (species.habitat === "water") return water ? 1 : .18;
    if (species.locomotion === "amphibious") return 1;
    return water ? .15 : 1;
  }

  function gamepadInput(instance) {
    const pad = global.navigator?.getGamepads?.()?.find(Boolean);
    if (!pad) return { x: 0, y: 0, sprint: false };
    return { x: Math.abs(pad.axes?.[0] || 0) > .18 ? pad.axes?.[0] : 0, y: Math.abs(pad.axes?.[1] || 0) > .18 ? pad.axes?.[1] : 0, sprint: Boolean(pad.buttons?.[0]?.pressed || pad.buttons?.[7]?.pressed) };
  }

  function updateWorld(instance, seconds) {
    if (!instance.running || instance.paused || instance.dead) return;
    const player = instance.state.player;
    const species = SPECIES_BY_ID.get(instance.state.speciesId);
    const pad = gamepadInput(instance);
    let dx = (instance.keys.has("ArrowRight") || instance.keys.has("KeyD") ? 1 : 0) - (instance.keys.has("ArrowLeft") || instance.keys.has("KeyA") ? 1 : 0) + pad.x;
    let dy = (instance.keys.has("ArrowDown") || instance.keys.has("KeyS") ? 1 : 0) - (instance.keys.has("ArrowUp") || instance.keys.has("KeyW") ? 1 : 0) + pad.y;
    const length = Math.hypot(dx, dy) || 1;
    dx /= length; dy /= length;
    const moving = Math.abs(dx) + Math.abs(dy) > .05;
    const sprinting = moving && (instance.keys.has("ShiftLeft") || instance.keys.has("ShiftRight") || pad.sprint) && player.stamina > 5;
    const terrain = terrainAt(player.x, player.y, instance.world.seed);
    const speed = (30 + Math.min(80, species.speed * 2.2)) * (sprinting ? 1.7 : 1) * habitatPenalty(species, terrain);
    player.x = clamp(player.x + dx * speed * seconds, 20, WORLD_SIZE - 20);
    player.y = clamp(player.y + dy * speed * seconds, 20, WORLD_SIZE - 20);
    Object.assign(player, stepVitals(player, seconds, instance.state.settings.difficulty, moving, sprinting));
    if (!player.health) { instance.dead = true; instance.running = false; instance.root.querySelector("[data-hwe-death]").hidden = false; instance.state.player.lineage += 1; saveState(instance); }
    instance.world.day = (instance.world.day + seconds * .08) % 24;
    instance.world.weather.phase += seconds * .1;
    instance.population.forEach((creature, index) => {
      if (!creature.alive) return;
      creature.phase += seconds * (.4 + (index % 5) * .05);
      const distance = Math.hypot(player.x - creature.x, player.y - creature.y);
      const predator = creature.species.diet === "meat";
      const playerPrey = species.diet !== "meat" || species.mass < creature.species.mass * .7;
      if (distance < 260 && predator && playerPrey) {
        creature.vx += (player.x - creature.x) / Math.max(1, distance) * seconds * 24;
        creature.vy += (player.y - creature.y) / Math.max(1, distance) * seconds * 24;
        if (distance < 30) player.health = clamp(player.health - seconds * 6, 0, 100);
      } else if (distance < 170 && !predator && species.diet === "meat") {
        creature.vx -= (player.x - creature.x) / Math.max(1, distance) * seconds * 30;
        creature.vy -= (player.y - creature.y) / Math.max(1, distance) * seconds * 30;
      } else {
        creature.vx += Math.cos(creature.phase) * seconds * 3;
        creature.vy += Math.sin(creature.phase * .83) * seconds * 3;
      }
      const maxSpeed = 18 + creature.species.speed;
      const velocity = Math.hypot(creature.vx, creature.vy) || 1;
      if (velocity > maxSpeed) { creature.vx = creature.vx / velocity * maxSpeed; creature.vy = creature.vy / velocity * maxSpeed; }
      creature.x = clamp(creature.x + creature.vx * seconds, 30, WORLD_SIZE - 30);
      creature.y = clamp(creature.y + creature.vy * seconds, 30, WORLD_SIZE - 30);
      creature.vx *= .985; creature.vy *= .985;
    });
    const migrationDistance = Math.hypot(player.x - instance.world.migration.x, player.y - instance.world.migration.y);
    if (migrationDistance < instance.world.migration.radius && instance.state.activeExpedition === "migration") completeExpedition(instance, "migration");
    instance.autosave += seconds;
    if (instance.autosave > 8) { instance.autosave = 0; saveState(instance); }
  }

  function drawWorld(instance) {
    const canvas = instance.canvas;
    const ctx = instance.ctx;
    if (!canvas || !ctx) return;
    const dpr = instance.dpr || 1;
    const width = canvas.width / dpr;
    const height = canvas.height / dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);
    const player = instance.state.player;
    const cameraX = player.x - width / 2;
    const cameraY = player.y - height / 2;
    const tile = 96;
    for (let sx = -tile; sx < width + tile; sx += tile) {
      for (let sy = -tile; sy < height + tile; sy += tile) {
        const wx = cameraX + sx;
        const wy = cameraY + sy;
        const terrain = terrainAt(wx, wy, instance.world.seed);
        ctx.fillStyle = BIOMES[terrain].color;
        ctx.fillRect(sx, sy, tile + 1, tile + 1);
        ctx.globalAlpha = .16;
        ctx.strokeStyle = BIOMES[terrain].accent;
        ctx.beginPath(); ctx.arc(sx + tile * .5, sy + tile * .5, 8 + ((wx + wy) % 23), 0, Math.PI * 2); ctx.stroke();
        ctx.globalAlpha = 1;
      }
    }
    const migration = instance.world.migration;
    ctx.strokeStyle = "rgba(255,211,103,.72)"; ctx.lineWidth = 3; ctx.setLineDash([8, 10]);
    ctx.beginPath(); ctx.arc(migration.x - cameraX, migration.y - cameraY, migration.radius, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
    instance.world.resources.forEach((resource) => {
      const x = resource.x - cameraX; const y = resource.y - cameraY;
      if (x < -30 || y < -30 || x > width + 30 || y > height + 30 || resource.amount <= 0) return;
      ctx.fillStyle = resource.type === "water" ? "#65dcff" : resource.type === "plant" ? "#a7ee78" : resource.type === "shelter" ? "#e9c47b" : "#d48275";
      ctx.globalAlpha = instance.senseUntil > performance.now() ? .95 : .62;
      ctx.beginPath(); ctx.arc(x, y, resource.type === "shelter" ? 9 : 5, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;
    });
    instance.population.forEach((creature) => {
      if (!creature.alive) return;
      const x = creature.x - cameraX; const y = creature.y - cameraY;
      if (x < -40 || y < -40 || x > width + 40 || y > height + 40) return;
      ctx.save(); ctx.translate(x, y); ctx.rotate(Math.atan2(creature.vy, creature.vx));
      ctx.fillStyle = creature.species.color; ctx.strokeStyle = "rgba(255,255,255,.48)";
      const size = clamp(5 + Math.log10(creature.species.mass + 1) * 2.2, 5, 16);
      ctx.beginPath(); ctx.ellipse(0, 0, size * 1.35, size * .72, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(size, 0); ctx.lineTo(size + 7, -4); ctx.lineTo(size + 7, 4); ctx.closePath(); ctx.fill(); ctx.restore();
    });
    const selected = SPECIES_BY_ID.get(instance.state.speciesId);
    ctx.save(); ctx.translate(width / 2, height / 2); ctx.rotate(instance.heading || 0);
    const playerSize = clamp(11 + Math.log10(selected.mass + 1) * 2.5, 11, 25);
    ctx.shadowColor = selected.color; ctx.shadowBlur = 18; ctx.fillStyle = selected.color; ctx.strokeStyle = "#ffffff"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(0, 0, playerSize * 1.35, playerSize * .72, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(playerSize, 0); ctx.lineTo(playerSize + 10, -6); ctx.lineTo(playerSize + 10, 6); ctx.closePath(); ctx.fill(); ctx.restore();
    if (instance.senseUntil > performance.now()) {
      const pulse = ((performance.now() / 900) % 1) * 170;
      ctx.strokeStyle = `rgba(96,239,205,${1 - pulse / 180})`; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(width / 2, height / 2, pulse, 0, Math.PI * 2); ctx.stroke();
    }
    drawMinimap(instance);
  }

  function drawMinimap(instance) {
    const canvas = instance.root.querySelector("[data-hwe-minimap]");
    const ctx = canvas?.getContext?.("2d");
    if (!ctx) return;
    const size = canvas.width;
    ctx.clearRect(0, 0, size, size); ctx.fillStyle = "#071522"; ctx.fillRect(0, 0, size, size);
    for (let x = 0; x < size; x += 12) for (let y = 0; y < size; y += 12) { const terrain = terrainAt(x / size * WORLD_SIZE, y / size * WORLD_SIZE, instance.world.seed); ctx.fillStyle = BIOMES[terrain].color; ctx.fillRect(x, y, 12, 12); }
    ctx.strokeStyle = "#ffd367"; ctx.beginPath(); ctx.arc(instance.world.migration.x / WORLD_SIZE * size, instance.world.migration.y / WORLD_SIZE * size, instance.world.migration.radius / WORLD_SIZE * size, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(instance.state.player.x / WORLD_SIZE * size, instance.state.player.y / WORLD_SIZE * size, 4, 0, Math.PI * 2); ctx.fill();
  }

  function updateHud(instance) {
    const player = instance.state.player;
    ["health", "hunger", "thirst", "stamina", "growth"].forEach((key) => {
      const progress = instance.root.querySelector(`[data-hwe-vital="${key}"]`);
      const value = instance.root.querySelector(`[data-hwe-value="${key}"]`);
      if (progress) progress.value = player[key];
      if (value) value.textContent = Math.round(player[key]);
    });
    const terrain = terrainAt(player.x, player.y, instance.world.seed);
    const biome = instance.root.querySelector("[data-hwe-biome]"); if (biome) biome.textContent = BIOMES[terrain].label;
    const time = instance.root.querySelector("[data-hwe-time]"); if (time) time.textContent = `${String(Math.floor(instance.world.day)).padStart(2, "0")}:${String(Math.floor(instance.world.day % 1 * 60)).padStart(2, "0")}`;
    const weather = instance.root.querySelector("[data-hwe-weather]"); if (weather) weather.textContent = ({ clear: "Trời quang", mist: "Sương sinh học", storm: "Bão di cư" }[instance.world.weather.type]);
    const stage = instance.root.querySelector("[data-hwe-stage]"); if (stage) stage.textContent = stageLabel(player.growth);
    const mission = EXPEDITIONS.find((row) => row.id === instance.state.activeExpedition);
    const missionProgress = instance.root.querySelector("[data-hwe-mission-progress]");
    if (missionProgress) missionProgress.value = mission?.target === "migration" ? clamp(100 - Math.hypot(player.x - instance.world.migration.x, player.y - instance.world.migration.y) / 20, 0, 100) : mission?.target === "nest" ? player.growth : mission?.target === "water" ? player.thirst : mission?.target === "food" ? player.hunger : instance.senseCount * 34;
  }

  function loop(instance, now) {
    if (instance.destroyed) return;
    const seconds = Math.min(.05, Math.max(0, (now - instance.lastFrame) / 1000 || 0));
    instance.lastFrame = now;
    if (!global.document?.hidden) { updateWorld(instance, seconds); drawWorld(instance); updateHud(instance); }
    instance.frameCount += 1;
    if (now - instance.fpsAt > 1000) { const node = instance.root.querySelector("[data-hwe-fps]"); if (node) node.textContent = `${instance.frameCount} FPS · ${instance.population.filter((row) => row.alive).length} wildlife`; instance.frameCount = 0; instance.fpsAt = now; }
    instance.raf = global.requestAnimationFrame?.((time) => loop(instance, time));
  }

  function logSignal(instance, message) {
    const log = instance.root.querySelector("[data-hwe-log]");
    if (!log) return;
    const row = global.document.createElement("p"); row.textContent = String(message).slice(0, 150); log.prepend(row);
    while (log.children.length > 5) log.lastElementChild.remove();
  }

  function completeExpedition(instance, target) {
    const mission = EXPEDITIONS.find((row) => row.id === instance.state.activeExpedition && row.target === target);
    if (!mission || instance.state.completed.includes(mission.id)) return false;
    instance.state.completed.push(mission.id); instance.state.player.growth = clamp(instance.state.player.growth + 12, 0, 100); saveState(instance);
    logSignal(instance, `Hoàn thành: ${mission.title}. ${mission.reward}.`); setToast(instance, `✓ ${mission.title}`); return true;
  }

  function interact(instance) {
    if (!instance.world || !instance.running) return;
    const player = instance.state.player; const species = SPECIES_BY_ID.get(instance.state.speciesId);
    const resource = instance.world.resources.filter((row) => row.amount > 0).sort((a, b) => Math.hypot(player.x - a.x, player.y - a.y) - Math.hypot(player.x - b.x, player.y - b.y))[0];
    if (!resource || Math.hypot(player.x - resource.x, player.y - resource.y) > 95) { logSignal(instance, "Không có tài nguyên phù hợp trong tầm tương tác."); return; }
    if (resource.type === "water") { player.thirst = clamp(player.thirst + 38, 0, 100); resource.amount -= 8; logSignal(instance, "Đã uống nước. Hãy quan sát dấu chân quanh bờ."); completeExpedition(instance, "water"); }
    else if (resource.type === "plant" && ["plant", "omnivore", "nectar", "filter"].includes(species.diet)) { player.hunger = clamp(player.hunger + 32, 0, 100); resource.amount -= 12; logSignal(instance, "Đã ăn đúng nguồn thực vật của khẩu phần."); completeExpedition(instance, "food"); }
    else if (resource.type === "carcass" && ["meat", "omnivore"].includes(species.diet)) { player.hunger = clamp(player.hunger + 35, 0, 100); resource.amount -= 14; logSignal(instance, "Đã hấp thụ dinh dưỡng từ xác tự nhiên."); completeExpedition(instance, "food"); }
    else if (resource.type === "shelter") logSignal(instance, player.growth > 60 ? "Nơi trú ẩn phù hợp. Nhấn N để tạo tổ." : "Bạn cần trưởng thành trên 60% để tạo tổ.");
    else logSignal(instance, "Nguồn này không phù hợp khẩu phần của loài đang chơi.");
  }

  function sense(instance) {
    if (!instance.world || !instance.running) return;
    instance.senseUntil = performance.now() + 4200; instance.senseCount += 1;
    const node = instance.root.querySelector("[data-hwe-sense]"); if (node) { node.hidden = false; setTimeout(() => { if (node.isConnected) node.hidden = true; }, 4200); }
    logSignal(instance, `${SPECIES_BY_ID.get(instance.state.speciesId).ability}: phát hiện tài nguyên, chuyển động và vùng di cư.`);
    if (instance.senseCount >= 3) completeExpedition(instance, "scent");
  }

  function defend(instance) {
    if (!instance.world || !instance.running || instance.state.player.stamina < 12) return;
    instance.state.player.stamina -= 12;
    const player = instance.state.player;
    const target = instance.population.filter((row) => row.alive).sort((a, b) => Math.hypot(player.x - a.x, player.y - a.y) - Math.hypot(player.x - b.x, player.y - b.y))[0];
    if (!target || Math.hypot(player.x - target.x, player.y - target.y) > 58) { logSignal(instance, "Đòn phòng vệ không chạm mục tiêu."); return; }
    target.health -= 38;
    if (target.health <= 0) { target.alive = false; instance.world.resources.push({ id: `carcass-${Date.now()}`, x: target.x, y: target.y, type: "carcass", amount: 100, terrain: terrainAt(target.x, target.y, instance.world.seed) }); logSignal(instance, "Một mắt xích đã trở thành dinh dưỡng cho lưới sống."); }
    else logSignal(instance, `${target.species.vietnamese} lùi khỏi vùng nguy hiểm.`);
  }

  function createNest(instance) {
    if (!instance.world || !instance.running) return;
    const player = instance.state.player;
    const shelter = instance.world.resources.filter((row) => row.type === "shelter").sort((a, b) => Math.hypot(player.x - a.x, player.y - a.y) - Math.hypot(player.x - b.x, player.y - b.y))[0];
    if (player.growth < 60) { logSignal(instance, "Chưa đủ trưởng thành để tạo tổ."); return; }
    if (!shelter || Math.hypot(player.x - shelter.x, player.y - shelter.y) > 110) { logSignal(instance, "Hãy tìm vòng sáng nơi trú ẩn trước khi tạo tổ."); return; }
    instance.state.player.lineage += 1; instance.state.discoveries = [...new Set([...instance.state.discoveries, instance.state.speciesId])]; saveState(instance); completeExpedition(instance, "nest"); logSignal(instance, "Tổ đã được tạo. Dòng gene mới được lưu cục bộ.");
  }

  function respawn(instance) {
    instance.state.player = normalizeState({ speciesId: instance.state.speciesId }).player;
    instance.dead = false; instance.running = true; instance.root.querySelector("[data-hwe-death]").hidden = true; saveState(instance); logSignal(instance, "Một vòng đời mới bắt đầu.");
  }

  function startGame(instance) {
    if (!instance.canvas) return;
    instance.running = true; instance.paused = false; instance.dead = false;
    instance.root.querySelector("[data-hwe-start-panel]").hidden = true;
    instance.root.querySelector("[data-hwe-pause]")?.setAttribute("aria-pressed", "false");
    instance.canvas.focus({ preventScroll: true }); logSignal(instance, "Vòng đời bắt đầu. Nước và thức ăn đang phát tín hiệu nhẹ.");
  }

  function initWorld(instance) {
    instance.canvas = instance.root.querySelector("[data-hwe-canvas]");
    if (!instance.canvas) return;
    instance.ctx = instance.canvas.getContext("2d", { alpha: false });
    instance.world = createWorld(instance.state.settings.seed, instance.state.settings.density);
    instance.population = createPopulation(instance); instance.keys = new Set(); instance.running = false; instance.paused = false; instance.dead = false; instance.senseUntil = 0; instance.senseCount = 0; instance.autosave = 0; instance.heading = 0; instance.lastFrame = performance.now(); instance.fpsAt = performance.now(); instance.frameCount = 0;
    resizeCanvas(instance);
    instance.resizeObserver = typeof ResizeObserver === "function" ? new ResizeObserver(() => resizeCanvas(instance)) : null;
    instance.resizeObserver?.observe(instance.canvas);
    instance.raf = global.requestAnimationFrame?.((time) => loop(instance, time));
  }

  function bind(instance) {
    const { root, controller } = instance;
    root.addEventListener("click", (event) => {
      const target = event.target.closest?.("button"); if (!target) return;
      if (target.dataset.hweRoute) { global.location.hash = `#${target.dataset.hweRoute}`; return; }
      if (target.matches("[data-hwe-quick-play]")) { if (instance.view === "world") { if (!instance.running) startGame(instance); else instance.canvas?.focus?.({ preventScroll: true }); } else global.location.hash = "#/game/world"; return; }
      if (target.matches("[data-hwe-open-codex]")) { global.location.hash = "#/game/species"; return; }
      if (target.dataset.hweSpecies) { const species = SPECIES_BY_ID.get(target.dataset.hweSpecies); if (!species) return; instance.state.speciesId = species.id; saveState(instance); if (instance.view === "world") { mount(instance.host, { view: "world" }); return; } root.querySelectorAll("[data-hwe-species]").forEach((card) => card.classList.toggle("is-selected", card === target)); updateCodexDetail(instance, species); setToast(instance, `Đã chọn ${species.vietnamese}`); return; }
      if (target.dataset.hwePlaySpecies) { instance.state.speciesId = target.dataset.hwePlaySpecies; saveState(instance); global.location.hash = "#/game/world"; return; }
      if (target.dataset.hweEraFilter) { instance.eraFilter = target.dataset.hweEraFilter; root.querySelectorAll("[data-hwe-era-filter]").forEach((button) => button.setAttribute("aria-pressed", String(button === target))); filterSpecies(instance); return; }
      if (target.dataset.hweDifficulty) { instance.state.settings.difficulty = target.dataset.hweDifficulty; root.querySelectorAll("[data-hwe-difficulty]").forEach((button) => button.classList.toggle("is-active", button === target)); saveState(instance); return; }
      if (target.matches("[data-hwe-start]")) { startGame(instance); return; }
      if (target.matches("[data-hwe-respawn]")) { respawn(instance); return; }
      if (target.matches("[data-hwe-pause]")) { instance.paused = !instance.paused; target.setAttribute("aria-pressed", String(instance.paused)); target.textContent = instance.paused ? "▶" : "Ⅱ"; setToast(instance, instance.paused ? "Đã tạm dừng" : "Tiếp tục vòng đời"); return; }
      if (target.matches("[data-hwe-fullscreen]")) { instance.root.requestFullscreen?.().catch?.(() => setToast(instance, "Trình duyệt chưa cho phép toàn màn hình.")); return; }
      if (target.dataset.hweAction === "interact") interact(instance);
      if (target.dataset.hweAction === "sense") sense(instance);
      if (target.dataset.hweExpedition) { instance.state.activeExpedition = target.dataset.hweExpedition; saveState(instance); global.location.hash = "#/game/world"; }
      if (target.matches("[data-hwe-simulate-season]")) { const titles = [["Mùa khô kéo dài", "Nguồn nước co lại; thú ăn cỏ gom đàn gần lưu vực."], ["Mùa sinh sản", "Nơi trú ẩn sáng lên và áp lực săn mồi giảm quanh tổ."], ["Bão đại dương", "Dòng hải lưu đổi hướng, sinh vật biển di cư vào rạn nông."], ["Băng tan theo mùa", "Biên tundra lùi về phía bắc, đường di cư mới xuất hiện."]]; const row = titles[Math.floor(Math.random() * titles.length)]; root.querySelector("[data-hwe-season-title]").textContent = row[0]; root.querySelector("[data-hwe-season-copy]").textContent = row[1]; setToast(instance, "Ecology Director đã tạo mùa mới"); }
      if (target.matches("[data-hwe-reset]")) { if (target.dataset.confirm === "true") { global.localStorage?.removeItem?.(STORAGE_KEY); instance.state = normalizeState(); global.location.hash = "#/game/world"; } else { target.dataset.confirm = "true"; target.textContent = "Xác nhận xóa save"; setTimeout(() => { if (target.isConnected) { delete target.dataset.confirm; target.textContent = "Khôi phục save mới…"; } }, 4000); } }
    }, { signal: controller.signal });
    root.addEventListener("input", (event) => { if (event.target.matches("[data-hwe-species-search]")) filterSpecies(instance); }, { signal: controller.signal });
    root.addEventListener("change", (event) => {
      const key = event.target.dataset.hweSetting; if (!key || !Object.hasOwn(instance.state.settings, key)) return;
      instance.state.settings[key] = event.target.type === "checkbox" ? event.target.checked : String(event.target.value).slice(0, 24);
      instance.state = normalizeState(instance.state); root.dataset.motion = instance.state.settings.motion; saveState(instance); setToast(instance, "Đã lưu cấu hình cục bộ");
    }, { signal: controller.signal });
    root.addEventListener("pointerdown", (event) => { const key = event.target.closest?.("[data-hwe-touch]")?.dataset.hweTouch; if (key) { instance.keys?.add(key); event.target.setPointerCapture?.(event.pointerId); } }, { signal: controller.signal });
    ["pointerup", "pointercancel", "pointerleave"].forEach((name) => root.addEventListener(name, (event) => { const key = event.target.closest?.("[data-hwe-touch]")?.dataset.hweTouch; if (key) instance.keys?.delete(key); }, { signal: controller.signal }));
    global.addEventListener?.("keydown", (event) => { if (!instance.canvas || !root.contains(global.document.activeElement)) return; instance.keys.add(event.code); if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(event.code)) event.preventDefault(); if (event.code === "KeyE") interact(instance); if (event.code === "KeyQ") sense(instance); if (event.code === "KeyF" || event.code === "Space") defend(instance); if (event.code === "KeyN") createNest(instance); }, { signal: controller.signal });
    global.addEventListener?.("keyup", (event) => instance.keys?.delete(event.code), { signal: controller.signal });
    global.document?.addEventListener?.("visibilitychange", () => { if (global.document.hidden) { instance.pausedByVisibility = !instance.paused; instance.paused = true; } else if (instance.pausedByVisibility) { instance.paused = false; instance.pausedByVisibility = false; instance.lastFrame = performance.now(); } }, { signal: controller.signal });
  }

  function mount(host, options = {}) {
    if (!host) return false;
    unmount(host);
    const instance = { host, root: null, view: safeView(options.view), state: readState(), controller: new AbortController(), destroyed: false, raf: 0, resizeObserver: null, toastTimer: 0, audioContext: null, eraFilter: "all" };
    host.innerHTML = shellMarkup(instance);
    instance.root = host.querySelector("[data-hwe-root]");
    instances.set(host, instance); activeHosts.add(host); bind(instance);
    if (instance.view === "world") initWorld(instance);
    return Object.freeze({ version: VERSION, state: () => JSON.parse(JSON.stringify(instance.state)), pause: () => { instance.paused = true; }, resume: () => { instance.paused = false; }, destroy: () => unmount(host) });
  }

  function unmount(host) {
    if (!host) {
      let removed = false;
      [...activeHosts].forEach((activeHost) => { removed = unmount(activeHost) || removed; });
      return removed;
    }
    const instance = instances.get(host);
    if (!instance) { activeHosts.delete(host); if (host) host.replaceChildren(); return false; }
    instance.destroyed = true; instance.controller.abort(); clearTimeout(instance.toastTimer); instance.resizeObserver?.disconnect?.(); global.cancelAnimationFrame?.(instance.raf); instance.audioContext?.close?.().catch?.(() => {}); saveState(instance); host.replaceChildren(); instances.delete(host); activeHosts.delete(host); return true;
  }

  return Object.freeze({ VERSION, version: VERSION, STORAGE_KEY, SCHEMA_VERSION, WORLD_SIZE, ERA_META, BIOMES, SPECIES, EXPEDITIONS, normalizeState, stepVitals, terrainAt, createWorld, mount, unmount });
});
