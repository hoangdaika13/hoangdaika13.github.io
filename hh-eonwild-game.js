(function (global, factory) {
  "use strict";
  const api = factory(global || {});
  if (typeof module === "object" && module.exports) module.exports = api;
  if (global) global.HHEonWild = api;
})(typeof window !== "undefined" ? window : globalThis, function createEonWild(global) {
  "use strict";

  const VERSION = "4.2.0";
  const STORAGE_KEY = "hh.game.eonwild.v4";
  const LEGACY_STORAGE_KEY = "hh.game.eonwild.v3";
  const V2_STORAGE_KEY = "hh.game.eonwild.v2";
  const OLDER_STORAGE_KEY = "hh.game.eonwild.v1";
  const ROLLBACK_STORAGE_KEY = "hh.game.eonwild.rollback.v4";
  const LEGACY_ROLLBACK_STORAGE_KEY = "hh.game.eonwild.rollback.v3";
  const SCHEMA_VERSION = 4;
  const WORLD_SIZE = 16384;
  const LEGACY_WORLD_SCALE = 4;
  const VIEW_IDS = Object.freeze(["world", "species", "ecosystem", "timeline", "expeditions", "lineage", "observer", "network", "settings"]);
  const CONTENT = global.HHEonWildContentV2 || (typeof require === "function" ? (() => { try { return require("./hh-eonwild-content-v2.js"); } catch { return null; } })() : null);
  const SIMULATION = global.HHEonWildSimulationV2 || (typeof require === "function" ? (() => { try { return require("./hh-eonwild-simulation-v2.js"); } catch { return null; } })() : null);
  const RENDERER_3D = global.HHEonWild3D || (typeof require === "function" ? (() => { try { return require("./hh-eonwild-3d-core.js"); } catch { return null; } })() : null);
  const RENDERER_ADAPTER = global.HHEonWildRenderer3D || (typeof require === "function" ? (() => { try { return require("./hh-eonwild-renderer-3d.js"); } catch { return null; } })() : null);
  const WORLD_ATLAS = global.HHEonWildWorldAtlas || (typeof require === "function" ? (() => { try { return require("./hh-eonwild-world-atlas.js"); } catch { return null; } })() : null);
  const SPECIES_REGISTRY = global.HHEonWildSpeciesRegistry || (typeof require === "function" ? (() => { try { return require("./hh-eonwild-species-registry.js"); } catch { return null; } })() : null);
  const INPUT_SYSTEM = global.HHEonWildInputSystem || (typeof require === "function" ? (() => { try { return require("./hh-eonwild-input-system.js"); } catch { return null; } })() : null);
  const DESKTOP = global.HHEonWildDesktopController || (typeof require === "function" ? (() => { try { return require("./hh-eonwild-desktop-controller.js"); } catch { return null; } })() : null);
  const PERSONAL_QUALITY_PROFILE = Object.freeze({ id: "personal", label: "Cinematic Personal", targetFps: 30 });
  const CINEMATIC_PACK_FALLBACK = Object.freeze([
    { id: "creature-ultra", label: "Creature Ultra Pack", description: "Model đúng loài, rig, animation, PBR và bốn LOD.", accent: "#ff9b70" },
    { id: "forest-vegetation", label: "Forest & Vegetation Pack", description: "Cây, cỏ, dương xỉ và vật liệu tán lá độ phân giải cao.", accent: "#65f0a5" },
    { id: "terrain-rock", label: "Terrain & Rock Pack", description: "Heightmap, splat material, đá quét và displacement.", accent: "#e7bb78" },
    { id: "ocean", label: "Ocean Pack", description: "Sóng, foam, caustics, bờ biển và môi trường dưới nước.", accent: "#55d9ff" },
    { id: "weather-atmosphere", label: "Weather & Atmosphere Pack", description: "Mây, mưa, sương, bão, tuyết, tro và LUT điện ảnh.", accent: "#9d8cff" },
    { id: "cinematic-audio", label: "Cinematic Audio Pack", description: "Ambience và âm thanh động vật có giấy phép rõ ràng.", accent: "#ff70c8" }
  ].map(Object.freeze));
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
  const LEGACY_SCIENTIFIC_NAMES = new Set(SPECIES.map((species) => species.name.trim().toLocaleLowerCase("en")));
  const IMPORTED_SPECIES = Object.freeze((Array.isArray(SPECIES_REGISTRY?.SPECIES) ? SPECIES_REGISTRY.SPECIES : [])
    .filter((species) => !LEGACY_SCIENTIFIC_NAMES.has(String(species.scientificName || "").trim().toLocaleLowerCase("en"))));
  const MERGED_SPECIES_COUNT = SPECIES.length + IMPORTED_SPECIES.length;
  const MERGED_DUPLICATE_COUNT = Math.max(0, (SPECIES_REGISTRY?.SPECIES?.length || 0) - IMPORTED_SPECIES.length);
  const FALLBACK_REALMS = Object.freeze({
    paleozoic: Object.freeze({ id: "paleozoic", label: "Cambri–Permi", subtitle: "541–252 triệu năm", color: "#58e6d2", era: "paleozoic", biomes: ["ocean", "reef", "wetland", "forest", "volcanic"] }),
    mesozoic: Object.freeze({ id: "mesozoic", label: "Đại Trung sinh", subtitle: "252–66 triệu năm", color: "#ffb65f", era: "mesozoic", biomes: ["ocean", "reef", "wetland", "forest", "grassland", "desert", "volcanic"] }),
    "ice-age": Object.freeze({ id: "ice-age", label: "Kỷ băng hà", subtitle: "2,58 triệu–11.700 năm", color: "#d8f7ff", era: "cenozoic", periods: ["Pleistocene"], biomes: ["tundra", "grassland", "forest", "wetland"] }),
    modern: Object.freeze({ id: "modern", label: "Trái Đất hiện đại", subtitle: "Hiện tại", color: "#72ef9d", era: "modern", biomes: ["ocean", "reef", "wetland", "forest", "grassland", "desert", "tundra"] })
  });
  const rawRealms = CONTENT?.REALMS || CONTENT?.ERA_REALMS || FALLBACK_REALMS;
  const REALMS = Object.freeze(Array.isArray(rawRealms)
    ? Object.fromEntries(rawRealms.filter((realm) => realm?.id).map((realm) => {
      const fallback = FALLBACK_REALMS[realm.id] || {};
      const range = Array.isArray(realm.rangeMya) ? `${realm.rangeMya[0]}–${realm.rangeMya[1]} triệu năm` : fallback.subtitle;
      return [realm.id, Object.freeze({ ...fallback, ...realm, label: fallback.label || realm.label, subtitle: fallback.subtitle || range, color: fallback.color || "#72ef9d" })];
    }))
    : Object.fromEntries(Object.entries(rawRealms).map(([id, realm]) => [id, Object.freeze({ ...(FALLBACK_REALMS[id] || {}), id, ...realm })])));
  const REALM_IDS = Object.freeze(Object.keys(REALMS));
  const FLAGSHIP_IDS = Object.freeze(["tyrannosaurus", "triceratops", "argentavis", "orca", "giant-octopus", "spinosaurus", "mammuthus", "wolf", "honeybee", "electric-eel", "ankylosaurus", "blue-whale", "pteranodon"]);
  const fallbackFlagships = Object.freeze(Object.fromEntries(FLAGSHIP_IDS.map((id) => [id, Object.freeze({
    id, tier: "flagship", active: "R", sense: SPECIES_BY_ID.get(id)?.ability || "Giác quan chuyên biệt", locomotion: SPECIES_BY_ID.get(id)?.locomotion || "walk",
    defense: id === "triceratops" ? "Vòng phòng thủ đàn" : id === "ankylosaurus" ? "Chùy đuôi phá giáp" : id === "giant-octopus" ? "Ngụy trang sắc tố" : "Khả năng sinh tồn riêng",
    reproduction: ["orca", "wolf", "blue-whale", "mammuthus"].includes(id) ? "Sinh con và chăm con" : "Tạo tổ và bảo vệ con non"
  })])));
  const FLAGSHIPS = Object.freeze(CONTENT?.FLAGSHIPS || CONTENT?.FLAGSHIP_SPECIES || fallbackFlagships);
  const rawCommunicationCalls = CONTENT?.COMMUNICATION_CALL_LIST || CONTENT?.COMMUNICATION_CALLS;
  const COMMUNICATION_CALLS = Object.freeze((Array.isArray(rawCommunicationCalls) ? rawCommunicationCalls : Object.values(rawCommunicationCalls || {})).length ? (Array.isArray(rawCommunicationCalls) ? rawCommunicationCalls : Object.values(rawCommunicationCalls || {})) : [
    { id: "contact", label: "Gọi liên lạc", icon: "◉", influence: "gather" },
    { id: "warning", label: "Cảnh báo", icon: "!", influence: "flee" },
    { id: "territory", label: "Đánh dấu lãnh thổ", icon: "◇", influence: "avoid" },
    { id: "courtship", label: "Tín hiệu kết đôi", icon: "♥", influence: "mate" },
    { id: "pheromone", label: "Để lại pheromone", icon: "⌁", influence: "trail" },
    { id: "quiet", label: "Im lặng", icon: "○", influence: "hide" }
  ]);
  const realmForSpecies = (species) => {
    if (!species) return "modern";
    if (species.era === "paleozoic") return "paleozoic";
    if (species.era === "mesozoic") return "mesozoic";
    if (species.era === "modern") return "modern";
    if (species.period === "Pleistocene") return "ice-age";
    return "convergence-only";
  };
  const speciesAllowedInRealm = (species, realmId, convergence = false) => {
    if (!species || !REALM_IDS.includes(realmId)) return false;
    if (typeof CONTENT?.isSpeciesAllowedInRealm === "function") {
      try { return CONTENT.isSpeciesAllowedInRealm(realmId, species.id, { convergence }); } catch {}
    }
    return Boolean(convergence || realmForSpecies(species) === realmId);
  };
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
  const terrainForRealm = (terrain, realmId, x = 0, y = 0) => {
    if (realmId === "paleozoic") return ({ tundra: "ocean", desert: "volcanic", grassland: (Math.floor((x + y) / 320) % 2 ? "wetland" : "forest") })[terrain] || terrain;
    if (realmId === "mesozoic") return terrain === "tundra" ? "forest" : terrain;
    if (realmId === "ice-age") return ({ ocean: "wetland", reef: "wetland", desert: "grassland", volcanic: "tundra" })[terrain] || terrain;
    return terrain;
  };

  const normalizeGenes = (value, seed = 1) => {
    const external = CONTENT?.normalizeGenes || CONTENT?.normalizeGeneProfile;
    if (typeof external === "function") {
      try {
        const source = value && typeof value === "object" ? value : {};
        const migrated = Object.hasOwn(source, "bodyScale") ? source : {
          bodyScale: .8 + clamp(source.size ?? 50, 0, 100) * .004,
          endurance: .7 + clamp(source.endurance ?? 50, 0, 100) * .006,
          thermalTolerance: 1,
          oxygenEfficiency: 1,
          sensoryAcuity: .75 + clamp(source.sense ?? 50, 0, 100) * .0055,
          diseaseResistance: .7 + clamp(source.immunity ?? 50, 0, 100) * .006,
          metabolism: 1,
          pigment: clamp(source.pigmentation ?? 50, 0, 100) / 100,
          sociability: .5,
          parentalCare: .5
        };
        return external(migrated, { seed });
      } catch {}
    }
    const genes = value && typeof value === "object" && !Array.isArray(value) ? value : {};
    return Object.freeze({
      pigmentation: clamp(genes.pigmentation ?? 50, 0, 100), size: clamp(genes.size ?? 50, 0, 100),
      endurance: clamp(genes.endurance ?? 50, 0, 100), sense: clamp(genes.sense ?? 50, 0, 100),
      immunity: clamp(genes.immunity ?? 50, 0, 100), agility: clamp(genes.agility ?? 50, 0, 100), seed: Math.abs(Number(genes.seed ?? seed) || 1) % 1000000
    });
  };
  const normalizeInjuries = (value = {}) => {
    const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
    return { bleeding: clamp(source.bleeding, 0, 100), fracture: clamp(source.fracture, 0, 100), infection: clamp(source.infection, 0, 100), disease: clamp(source.disease, 0, 100) };
  };

  function normalizeState(value = {}) {
    const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
    // A state without an explicit schema is treated as newly-created v4 data.
    // Persisted v1-v3 payloads always receive a schema in readState/importSave,
    // so their coordinates are scaled exactly once and the normalized result
    // is immediately stamped v4.
    const sourceSchema = Number.isInteger(Number(source.schemaVersion)) ? Number(source.schemaVersion) : SCHEMA_VERSION;
    const coordinateScale = sourceSchema >= 1 && sourceSchema < SCHEMA_VERSION ? LEGACY_WORLD_SCALE : 1;
    const scaledCoordinate = (coordinate, fallback) => coordinate == null ? fallback : Number(coordinate) * coordinateScale;
    const player = source.player && typeof source.player === "object" ? source.player : {};
    const settings = source.settings && typeof source.settings === "object" ? source.settings : {};
    const speciesId = SPECIES_BY_ID.has(source.speciesId) ? source.speciesId : "triceratops";
    const derivedRealm = realmForSpecies(SPECIES_BY_ID.get(speciesId));
    const realmId = REALM_IDS.includes(source.realmId) ? source.realmId : derivedRealm === "convergence-only" ? "ice-age" : derivedRealm;
    const seed = String(settings.seed || source.worldAddress?.seed || "EON-541").replace(/[^a-z0-9-]/gi, "").slice(0, 24) || "EON-541";
    const convergence = settings.convergence === true;
    const cartridgeAddress = RENDERER_3D?.SPECIES_CARTRIDGES?.[speciesId]
      ? RENDERER_3D.addressForSpecies?.(speciesId, seed)
      : RENDERER_3D?.createWorldAddress?.({ realmId, seed });
    const sourceAddress = source.worldAddress && typeof source.worldAddress === "object" ? source.worldAddress : null;
    const requestedAddress = sourceAddress && coordinateScale > 1
      ? { ...sourceAddress, chunkX: Number(sourceAddress.chunkX || 0) * coordinateScale, chunkZ: Number(sourceAddress.chunkZ || 0) * coordinateScale }
      : sourceAddress || cartridgeAddress;
    let worldAddress = RENDERER_3D?.createWorldAddress
      ? RENDERER_3D.createWorldAddress({ ...(requestedAddress || {}), realmId, seed })
      : { realmId, timeSliceId: "legacy-realm", regionId: "legacy-region", biomeId: "grassland", chunkX: 0, chunkZ: 0, seed };
    if (!convergence && cartridgeAddress && RENDERER_3D?.isSpeciesAllowedAtAddress &&
        !RENDERER_3D.isSpeciesAllowedAtAddress(speciesId, worldAddress, false)) {
      worldAddress = RENDERER_3D.createWorldAddress({ ...cartridgeAddress, realmId, seed });
    }
    const requestedAtlasMap = WORLD_ATLAS?.getMap?.(source.atlasMapId);
    const atlasMap = requestedAtlasMap && (requestedAtlasMap.realmId === realmId || (convergence && requestedAtlasMap.realmId === "convergence"))
      ? requestedAtlasMap
      : WORLD_ATLAS?.defaultMapForRealm?.(realmId);
    const planetAddress = WORLD_ATLAS?.normalizeAddress?.({
      ...(source.planetAddress && typeof source.planetAddress === "object" ? source.planetAddress : {}),
      mapId: atlasMap?.id,
      realmId: atlasMap?.realmId || realmId,
      regionId: atlasMap?.regions?.some?.((region) => region.id === source.atlasRegionId) ? source.atlasRegionId : atlasMap?.regions?.[0]?.id,
      localX: source.planetAddress?.localX ?? WORLD_ATLAS.SECTOR_SIZE_METERS / 2,
      localZ: source.planetAddress?.localZ ?? WORLD_ATLAS.SECTOR_SIZE_METERS / 2
    }) || null;
    return {
      schemaVersion: SCHEMA_VERSION,
      speciesId,
      realmId,
      worldAddress,
      atlasMapId: atlasMap?.id || "",
      atlasRegionId: planetAddress?.regionId || "",
      planetAddress,
      mode: RENDERER_3D?.GAME_MODES?.some?.((mode) => mode.id === source.mode && mode.available) ? source.mode : "one-life",
      player: {
        x: clamp(scaledCoordinate(player.x, WORLD_SIZE * .48), 80, WORLD_SIZE - 80),
        y: clamp(scaledCoordinate(player.y, WORLD_SIZE * .48), 80, WORLD_SIZE - 80),
        health: clamp(player.health ?? 100, 0, 100), hunger: clamp(player.hunger ?? 82, 0, 100),
        thirst: clamp(player.thirst ?? 78, 0, 100), stamina: clamp(player.stamina ?? 100, 0, 100),
        growth: clamp(player.growth ?? 18, 0, 100), lineage: clamp(player.lineage || 0, 0, 9999),
        temperature: clamp(player.temperature ?? 50, 0, 100), oxygen: clamp(player.oxygen ?? 100, 0, 100),
        nutrition: clamp(player.nutrition ?? 72, 0, 100), dietQuality: clamp(player.dietQuality ?? 64, 0, 100),
        immunity: clamp(player.immunity ?? 82, 0, 100), injuries: normalizeInjuries(player.injuries),
        genes: normalizeGenes(player.genes, hashSeed(speciesId)), generation: clamp(player.generation || 1, 1, 9999), spawnPending: player.spawnPending !== false
      },
      settings: {
        difficulty: ["sanctuary", "balanced", "wild"].includes(settings.difficulty) ? settings.difficulty : "balanced",
        motion: ["static", "balanced", "cinematic"].includes(settings.motion) ? settings.motion : "balanced",
        density: ["low", "balanced", "high"].includes(settings.density) ? settings.density : "balanced",
        renderer: ["auto", "3d", "lite"].includes(settings.renderer) ? settings.renderer : "auto",
        quality: ["static", "light", "balanced", "high", "cinematic", "personal"].includes(settings.quality) ? settings.quality : "balanced",
        sound: settings.sound === true,
        soundVolume: clamp(settings.soundVolume ?? 70, 0, 100),
        convergence,
        worker: settings.worker !== false,
        adaptiveQuality: settings.adaptiveQuality !== false,
        photoUi: settings.photoUi !== false,
        photoFov: clamp(settings.photoFov ?? 62, 35, 100),
        photoExposure: clamp(settings.photoExposure ?? 100, 50, 160),
        photoFocalLength: clamp(settings.photoFocalLength ?? 50, 18, 200),
        photoAperture: clamp(settings.photoAperture ?? 4, 1.4, 16),
        photoShutter: clamp(settings.photoShutter ?? 250, 15, 8000),
        photoIso: clamp(settings.photoIso ?? 100, 50, 6400),
        photoExposureComp: clamp(settings.photoExposureComp ?? 0, -5, 5),
        photoFocusDistance: clamp(settings.photoFocusDistance ?? 8, .3, 500),
        photoAutofocus: settings.photoAutofocus !== false,
        photoComposition: ["off", "thirds"].includes(settings.photoComposition) ? settings.photoComposition : "thirds",
        photoCrop: ["native", "2.39", "1.85", "1.0"].includes(settings.photoCrop) ? settings.photoCrop : "native",
        photoShake: clamp(settings.photoShake ?? 18, 0, 100),
        cameraSensitivityX: clamp(settings.cameraSensitivityX ?? 24, 1, 100),
        cameraSensitivityY: clamp(settings.cameraSensitivityY ?? 22, 1, 100),
        invertCameraY: settings.invertCameraY === true,
        cameraFov: clamp(settings.cameraFov ?? 68, 45, 105),
        cameraSmoothing: clamp(settings.cameraSmoothing ?? 72, 0, 100),
        cameraShake: clamp(settings.cameraShake ?? 12, 0, 100),
        headBob: clamp(settings.headBob ?? 8, 0, 100),
        autoCenterCamera: settings.autoCenterCamera === true,
        viewMode: ["third-person", "animal-eye"].includes(settings.viewMode) ? settings.viewMode : "third-person",
        seed
      },
      discoveries: Array.isArray(source.discoveries) ? [...new Set(source.discoveries.filter((id) => SPECIES_BY_ID.has(id)))].slice(0, 500) : [],
      completed: Array.isArray(source.completed) ? [...new Set(source.completed.filter((id) => EXPEDITIONS.some((mission) => mission.id === id)))].slice(0, 50) : [],
      activeExpedition: EXPEDITIONS.some((mission) => mission.id === source.activeExpedition) ? source.activeExpedition : "first-water",
      lineage: Array.isArray(source.lineage) ? source.lineage.filter((record) => record && typeof record === "object").slice(-24).map((record, index) => ({
        id: String(record.id || `generation-${index + 1}`).replace(/[^a-z0-9-]/gi, "").slice(0, 48), generation: clamp(record.generation || index + 1, 1, 9999),
        speciesId: SPECIES_BY_ID.has(record.speciesId) ? record.speciesId : "triceratops", genes: normalizeGenes(record.genes, index + 1),
        bornAt: clamp(record.bornAt || Date.now(), 0, Number.MAX_SAFE_INTEGER), survived: clamp(record.survived, 0, 100)
      })) : [],
      replay: Array.isArray(source.replay) ? source.replay.filter((sample) => sample && typeof sample === "object").slice(-240).map((sample) => ({
        x: clamp(Number(sample.x) * coordinateScale, 0, WORLD_SIZE), y: clamp(Number(sample.y) * coordinateScale, 0, WORLD_SIZE), t: clamp(sample.t, 0, Number.MAX_SAFE_INTEGER), health: clamp(sample.health, 0, 100), event: String(sample.event || "move").slice(0, 32)
      })) : [],
      heatmap: Array.isArray(source.heatmap) ? source.heatmap.filter((cell) => cell && typeof cell === "object").slice(0, 256).map((cell) => ({
        x: clamp(Number(cell.x) * coordinateScale, 0, WORLD_SIZE), y: clamp(Number(cell.y) * coordinateScale, 0, WORLD_SIZE), value: clamp(cell.value, 0, 1000000),
        types: Object.fromEntries(Object.entries(cell.types && typeof cell.types === "object" ? cell.types : {}).slice(0, 8).map(([key, value]) => [String(key).replace(/[^a-z0-9-]/gi, "").slice(0, 24), clamp(value, 0, 1000000)]).filter(([key]) => key))
      })) : [],
      // Heatmap x/y are cell indices, not metres. Scaling both the indices and
      // cell size would move legacy hotspots 16× instead of the intended 4×.
      heatmapCellSize: clamp(source.heatmapCellSize ?? 64, 16, 512),
      ecologySnapshot: source.ecologySnapshot && typeof source.ecologySnapshot === "object" ? {
        season: clamp(source.ecologySnapshot.season || 0, 0, 9999), updatedAt: clamp(source.ecologySnapshot.updatedAt || 0, 0, Number.MAX_SAFE_INTEGER),
        title: String(source.ecologySnapshot.title || "Chưa mô phỏng").slice(0, 80), copy: String(source.ecologySnapshot.copy || "Chạy một mùa để tạo dữ liệu local.").slice(0, 220),
        producer: clamp(source.ecologySnapshot.producer, 0, 100), prey: clamp(source.ecologySnapshot.prey, 0, 100), predator: clamp(source.ecologySnapshot.predator, 0, 100),
        apex: clamp(source.ecologySnapshot.apex, 0, 512), population: clamp(source.ecologySnapshot.population, 0, 512), chunks: clamp(source.ecologySnapshot.chunks, 0, 256),
        actions: Object.fromEntries(["hunt", "flee", "drink", "feed", "rest", "migrate", "mate", "guardNest"].map((key) => [key, clamp(source.ecologySnapshot.actions?.[key], 0, 512)]))
      } : null,
      eventJournal: Array.isArray(source.eventJournal) ? source.eventJournal.filter((row) => row && typeof row === "object").slice(-40).map((row) => ({ id: String(row.id || "event").slice(0, 32), label: String(row.label || "Biến động tự nhiên").slice(0, 80), at: clamp(row.at || Date.now(), 0, Number.MAX_SAFE_INTEGER) })) : [],
      updatedAt: Date.now()
    };
  }

  function stepVitals(player, seconds, difficulty = "balanced", moving = false, sprinting = false, environment = {}) {
    const factor = difficulty === "wild" ? 1.45 : difficulty === "sanctuary" ? .55 : 1;
    const next = { ...player };
    next.hunger = clamp(next.hunger - seconds * .12 * factor, 0, 100);
    next.thirst = clamp(next.thirst - seconds * .17 * factor, 0, 100);
    next.stamina = clamp(next.stamina + seconds * (sprinting ? -8.5 : moving ? -1.4 : 7), 0, 100);
    next.growth = clamp(next.growth + seconds * .035 * (next.hunger > 35 && next.thirst > 35 ? 1 : .2), 0, 100);
    next.temperature = clamp((next.temperature ?? 50) + ((environment.temperature ?? 50) - (next.temperature ?? 50)) * seconds * .025, 0, 100);
    next.oxygen = clamp((next.oxygen ?? 100) + seconds * (environment.oxygenDrain ? -environment.oxygenDrain : 7), 0, 100);
    next.nutrition = clamp((next.nutrition ?? 72) - seconds * .055 * factor, 0, 100);
    next.dietQuality = clamp((next.dietQuality ?? 64) - seconds * .018 * factor, 0, 100);
    next.immunity = clamp((next.immunity ?? 82) + seconds * ((next.dietQuality ?? 0) > 55 ? .025 : -.08), 0, 100);
    next.injuries = normalizeInjuries(next.injuries);
    next.injuries.bleeding = clamp(next.injuries.bleeding - seconds * .18, 0, 100);
    next.injuries.fracture = clamp(next.injuries.fracture - seconds * .025, 0, 100);
    next.injuries.infection = clamp(next.injuries.infection + seconds * (next.injuries.bleeding > 20 ? .035 : -.018), 0, 100);
    next.injuries.disease = clamp(next.injuries.disease + seconds * ((next.immunity ?? 0) < 35 ? .025 : -.02), 0, 100);
    const conditionDamage = (next.injuries.bleeding * .018 + next.injuries.infection * .009 + next.injuries.disease * .006) * seconds;
    if (!next.hunger || !next.thirst) next.health = clamp(next.health - seconds * 2.2 * factor, 0, 100);
    else if (next.hunger > 70 && next.thirst > 70) next.health = clamp(next.health + seconds * .35, 0, 100);
    if (!next.oxygen || next.temperature < 12 || next.temperature > 88) next.health = clamp(next.health - seconds * 2.8 * factor, 0, 100);
    next.health = clamp(next.health - conditionDamage, 0, 100);
    return next;
  }

  function createWorld(seedValue = "EON-541", density = "balanced", realmId = "mesozoic") {
    const seed = hashSeed(seedValue);
    const random = seededRandom(seed);
    const activeRealm = REALM_IDS.includes(realmId) ? realmId : "mesozoic";
    const resourceCount = density === "high" ? 96 : density === "low" ? 52 : 72;
    const resources = [];
    for (let index = 0; index < resourceCount; index += 1) {
      const x = 90 + random() * (WORLD_SIZE - 180);
      const y = 90 + random() * (WORLD_SIZE - 180);
      const terrain = terrainForRealm(terrainAt(x, y, seed), activeRealm, x, y);
      const type = ["ocean", "reef", "wetland"].includes(terrain) && index % 3 === 0 ? "water" : index % 9 === 0 ? "shelter" : index % 5 === 0 ? "carcass" : "plant";
      resources.push({ id: `resource-${index}`, x, y, type, amount: 100, terrain });
    }
    return {
      seed, realmId: activeRealm, resources,
      migration: { x: WORLD_SIZE * (.3 + random() * .4), y: WORLD_SIZE * (.25 + random() * .5), radius: 190 },
      weather: { type: random() > .7 ? "storm" : random() > .45 ? "mist" : "clear", phase: random() * Math.PI * 2 },
      day: random() * 24, tide: random(), event: { id: "calm", type: "calm", label: "Sinh quyển ổn định", intensity: 0, remaining: 0 }, eventSequence: 0, loadedChunks: []
    };
  }

  const readState = () => {
    try {
      const current = global.localStorage?.getItem?.(STORAGE_KEY);
      const legacy = global.localStorage?.getItem?.(LEGACY_STORAGE_KEY);
      const v2 = global.localStorage?.getItem?.(V2_STORAGE_KEY);
      const older = global.localStorage?.getItem?.(OLDER_STORAGE_KEY);
      const raw = JSON.parse(current || legacy || v2 || older || "{}");
      const inferredSchema = current ? SCHEMA_VERSION : legacy ? 3 : v2 ? 2 : older ? 1 : SCHEMA_VERSION;
      const state = normalizeState({ ...raw, schemaVersion: Number(raw?.schemaVersion) || inferredSchema });
      if (!current && (legacy || v2 || older)) global.localStorage?.setItem?.(STORAGE_KEY, JSON.stringify(state));
      return state;
    } catch { return normalizeState(); }
  };
  const saveState = (instance) => { instance.state.updatedAt = Date.now(); try { global.localStorage?.setItem?.(STORAGE_KEY, JSON.stringify(instance.state)); return true; } catch { return false; } };
  const stageLabel = (growth) => growth < 25 ? "Con non" : growth < 60 ? "Thiếu niên" : growth < 92 ? "Trưởng thành" : "Cá thể đầu đàn";
  const formatMass = (mass) => mass >= 1000 ? `${Math.round(mass / 100) / 10} tấn` : mass >= 1 ? `${mass} kg` : `${Math.round(mass * 1000)} g`;
  const dietLabel = (diet) => ({ meat: "Ăn thịt", plant: "Ăn thực vật", omnivore: "Ăn tạp", filter: "Lọc thức ăn", nectar: "Ăn mật" }[diet] || diet);
  const flagshipFor = (speciesId) => FLAGSHIPS?.[speciesId] || (Array.isArray(FLAGSHIPS) ? FLAGSHIPS.find((item) => item.id === speciesId) : null);
  const mechanicLabel = (value, fallback) => typeof value === "string" ? value : value?.label || value?.name || value?.title || value?.special?.label || value?.special || value?.mode || value?.care || fallback;
  const tierForSpecies = (species) => {
    if (!species) return "codex";
    if (typeof CONTENT?.getCatalogTier === "function") {
      try { return CONTENT.getCatalogTier(species.id) || "codex"; } catch {}
    }
    return flagshipFor(species.id) ? "flagship" : species.era === "modern" || species.period === "Pleistocene" ? "simulated" : "codex";
  };
  const tierLabel = (tier) => ({ flagship: "FLAGSHIP", simulated: "WILDLIFE AI", codex: "CODEX" }[tier] || "CODEX");
  const geneLabel = (key) => CONTENT?.GENE_SCHEMA?.[key]?.label || ({ pigmentation: "Sắc tố", size: "Kích thước", endurance: "Sức bền", sense: "Giác quan", immunity: "Miễn dịch", agility: "Nhanh nhẹn" })[key] || key;
  const genePercent = (key, value) => {
    const schema = CONTENT?.GENE_SCHEMA?.[key];
    if (!schema) return clamp(value, 0, 100);
    return clamp((Number(value) - schema.min) / Math.max(.0001, schema.max - schema.min) * 100, 0, 100);
  };
  const speciesAllowedAtAddress = (species, state, address = state?.worldAddress) => {
    if (!species || !state) return false;
    if (state.settings?.convergence) return tierForSpecies(species) !== "codex";
    if (typeof RENDERER_3D?.isSpeciesAllowedAtAddress === "function") {
      return RENDERER_3D.isSpeciesAllowedAtAddress(species.id, address, false);
    }
    return speciesAllowedInRealm(species, state.realmId, false);
  };
  const playableSpeciesAtAddress = (state, address = state?.worldAddress) => SPECIES.filter((species) =>
    tierForSpecies(species) === "flagship" && speciesAllowedAtAddress(species, state, address));
  const worldSeedForState = (state, mapId = state?.atlasMapId) => `${state?.settings?.seed || "EON-541"}-${mapId || state?.realmId || "atlas"}`
    .replace(/[^a-z0-9-]/gi, "-").replace(/-+/g, "-").slice(0, 64) || "EON-541-atlas";
  const rendererSeedForState = (state) => `${state?.settings?.seed || "EON-541"}:${state?.worldAddress?.timeSliceId || state?.realmId || "realm"}:${state?.worldAddress?.regionId || "region"}`;
  const addressForSlice = (state, slice) => RENDERER_3D?.createWorldAddress?.({
    realmId: state.realmId,
    timeSliceId: slice.id,
    regionId: slice.regionIds[0],
    seed: worldSeedForState(state)
  });
  const atlasAddressForMap = (state, map) => map?.gameplayStatus === "active-region" && RENDERER_3D?.createWorldAddress
    ? RENDERER_3D.createWorldAddress({
      realmId: map.realmId,
      timeSliceId: map.rendererTimeSliceId,
      regionId: map.rendererRegionId,
      seed: worldSeedForState(state, map.id)
    })
    : null;
  function realmSelectorMarkup(state) {
    const slices = RENDERER_3D?.listTimeSlices?.(state.realmId) || [];
    const selectedSlice = slices.find((slice) => slice.id === state.worldAddress?.timeSliceId) || slices[0];
    const selectedRegion = RENDERER_3D?.REGIONS?.find?.((region) => region.id === state.worldAddress?.regionId);
    return `<section class="hwe-realm-selector" aria-label="Chọn Era Realm"><span><small>ERA REALM</small><strong>${escapeHtml(REALMS[state.realmId]?.label || "Realm")}</strong></span><div>${Object.values(REALMS).map((realm) => `<button type="button" data-hwe-realm="${escapeHtml(realm.id)}" aria-pressed="${state.realmId === realm.id}" style="--realm:${escapeHtml(realm.color || "#72ef9d")}"><i></i><span>${escapeHtml(realm.label)}</span><small>${escapeHtml(realm.subtitle || realm.range || "")}</small></button>`).join("")}</div><label><input type="checkbox" data-hwe-setting="convergence" ${state.settings.convergence ? "checked" : ""}> Eon Convergence <small>${state.settings.convergence ? "Hư cấu · đang bật" : "Tắt · đúng niên đại"}</small></label>${slices.length ? `<label class="hwe-world-address"><span><small>TIME SLICE · REGION</small><strong>${escapeHtml(selectedRegion?.label || selectedSlice?.label || "World sector")}</strong></span><select data-hwe-time-slice aria-label="Chọn lát cắt địa chất">${slices.map((slice) => { const playable = state.settings.convergence || playableSpeciesAtAddress(state, addressForSlice(state, slice)).length > 0; return `<option value="${escapeHtml(slice.id)}" ${slice.id === selectedSlice?.id ? "selected" : ""} ${playable ? "" : "disabled"}>${escapeHtml(slice.label)} · ${escapeHtml(slice.range)}${playable ? "" : " · Observer only"}</option>`; }).join("")}</select></label>` : ""}</section>`;
  }

  function navMarkup(view) {
    return `<nav class="hwe-nav" aria-label="Điều hướng HH EonWild">${[
      ["world", "Thế giới sống", "◉"], ["species", "Eon Codex", "DNA"], ["ecosystem", "Lưới sinh thái", "⌁"],
      ["timeline", "Eon Atlas", "◷"], ["expeditions", "Thám hiểm", "◇"], ["lineage", "Dòng gene", "∞"],
      ["observer", "Observer", "◎"], ["network", "Multiplayer", "⌘"], ["settings", "Cài đặt", "⚙"]
    ].map(([id, label, icon]) => `<button type="button" data-hwe-route="/game/${id}" aria-current="${view === id ? "page" : "false"}"><i>${icon}</i><span>${label}</span></button>`).join("")}</nav>`;
  }

  function speciesCardsMarkup(state, compact = false) {
    return SPECIES.map((species) => {
      const tier = tierForSpecies(species);
      const realm = realmForSpecies(species);
      const unavailable = compact
        ? !speciesAllowedAtAddress(species, state)
        : !speciesAllowedInRealm(species, state.realmId, state.settings.convergence);
      if (compact && (unavailable || tier !== "flagship")) return "";
      return `<button type="button" class="hwe-species-card${state.speciesId === species.id ? " is-selected" : ""}${unavailable ? " is-other-realm" : ""}" data-hwe-species="${species.id}" data-era="${species.era}" data-realm="${realm}" data-tier="${tier}" data-diet="${species.diet}" data-search="${escapeHtml(`${species.name} ${species.vietnamese} ${species.period} ${tier}`.toLowerCase())}" style="--species:${species.color}">
      <i aria-hidden="true">${species.locomotion === "fly" ? "⌁" : species.locomotion === "swim" ? "≈" : species.locomotion === "crawl" ? "〰" : "◆"}</i><span><strong>${escapeHtml(species.vietnamese)}</strong>${compact ? `<small>${tierLabel(tier)}</small>` : `<small>${escapeHtml(species.name)} · ${escapeHtml(species.period)}</small><em>${tierLabel(tier)}${unavailable ? " · REALM KHÁC" : ""}</em>`}</span></button>`;
    }).join("");
  }

  function worldMarkup(state) {
    const selected = SPECIES_BY_ID.get(state.speciesId);
    const flagship = flagshipFor(selected.id);
    const activeAbility = mechanicLabel(flagship?.defense?.special || flagship?.locomotion?.special || flagship?.activeAbility || flagship?.active || flagship?.ability, selected.ability);
    return `${realmSelectorMarkup(state)}<div class="hwe-world-layout">
      <aside class="hwe-species-dock" aria-label="Chọn loài"><header><span><small>PLAYABLE REGISTRY</small><strong>${playableSpeciesAtAddress(state).length} Flagship trong Time Slice</strong></span><button type="button" data-hwe-open-codex>Mở Codex</button></header><label class="hwe-search"><span>⌕</span><input type="search" data-hwe-species-search placeholder="Tìm Flagship…" aria-label="Tìm loài Flagship"></label><div class="hwe-species-list">${speciesCardsMarkup(state, true)}</div></aside>
      <section class="hwe-viewport" data-hwe-viewport aria-label="Thế giới EonWild đang chơi">
        <canvas class="hwe-render-surface hwe-render-surface--lite" data-hwe-canvas tabindex="0" aria-label="Bản đồ sinh tồn Lite. Dùng WASD hoặc phím mũi tên để di chuyển."></canvas>
        <canvas class="hwe-render-surface hwe-render-surface--3d" data-hwe-canvas-3d tabindex="0" aria-label="Thế giới sinh tồn 3D. Click để khóa chuột, lia chuột để xoay camera, cuộn để zoom và dùng WASD để di chuyển." hidden></canvas>
        <div class="hwe-render-loading" data-hwe-render-loading hidden role="status" aria-live="polite"><span><i></i><b>EW</b></span><strong>Đang mở thế giới điện ảnh…</strong><small data-hwe-render-loading-copy>Đang kiểm tra GPU và giữ Canvas Lite ở phía sau</small><div class="hwe-render-stage" aria-hidden="true"><i class="is-complete"></i><i class="is-active"></i><i></i><i></i></div><p data-hwe-render-detail>Không có phần trăm giả · giao diện sẽ mở ngay khi frame 3D đầu tiên sẵn sàng</p><button type="button" data-hwe-render-cancel>Dùng Canvas Lite ngay</button></div>
        <aside class="hwe-render-fallback" data-hwe-render-fallback hidden role="status" aria-live="polite"><i aria-hidden="true">◇</i><div><small>SAFE FALLBACK · KHÔNG MÀN HÌNH ĐEN</small><strong data-hwe-render-fallback-title>Canvas Lite đang tiếp tục vòng đời</strong><p data-hwe-render-fallback-copy>Asset hoặc GPU 3D chưa sẵn sàng. Model thay thế nhẹ được dùng mà không làm mất save.</p></div><button type="button" data-hwe-render-retry>Thử lại 3D</button><button type="button" data-hwe-fallback-dismiss aria-label="Đóng thông báo fallback">×</button></aside>
        <div class="hwe-atmosphere" aria-hidden="true"><i></i><i></i><i></i><i></i></div>
        <div class="hwe-reticle" data-hwe-reticle aria-hidden="true"><i></i></div>
        <div class="hwe-target-prompt" data-hwe-target-prompt role="status" aria-live="polite"></div>
        <div class="hwe-hud hwe-hud--top"><span><small>Realm</small><strong data-hwe-realm-label>${escapeHtml(REALMS[state.realmId]?.label || state.realmId)}</strong></span><span><small>Biome</small><strong data-hwe-biome>Đang dựng thế giới</strong></span><span><small>Thời gian</small><strong data-hwe-time>--:--</strong></span><span><small>Sự kiện</small><strong data-hwe-weather>Ổn định</strong></span><button type="button" class="hwe-render-toggle" data-hwe-renderer="3d" aria-pressed="false"><i></i><span data-hwe-render-label>3D</span></button><button type="button" data-hwe-photo aria-label="Photo Mode">◉</button><button type="button" data-hwe-fullscreen aria-label="Toàn màn hình">⛶</button></div>
        <div class="hwe-immersive-vitals" aria-label="Trạng thái sinh tồn">${[["health","Máu"],["hunger","Đói"],["thirst","Khát"],["stamina","Thể lực"],["oxygen","Oxy"]].map(([key,label]) => `<label><span>${label}</span><progress data-hwe-vital="${key}" max="100" value="${state.player[key]}"></progress><b data-hwe-value="${key}">${Math.round(state.player[key])}</b></label>`).join("")}</div>
        <div class="hwe-minimap"><canvas data-hwe-minimap width="180" height="180" aria-label="Bản đồ thu nhỏ"></canvas><span>MIGRATION</span></div>
        <div class="hwe-event-banner" data-hwe-event-banner hidden><small>WORLD EVENT</small><strong data-hwe-event-title>Biến động tự nhiên</strong><progress data-hwe-event-progress max="100" value="0"></progress></div>
        <div class="hwe-sense" data-hwe-sense hidden><span>Q · ECO SENSE</span><strong>Đang đọc dấu vết tự nhiên…</strong></div>
        <div class="hwe-ability-bar"><button type="button" data-hwe-action="sense"><kbd>Q</kbd><span><small>Giác quan</small><strong>${escapeHtml(mechanicLabel(flagship?.sense, selected.ability))}</strong></span></button><button type="button" data-hwe-action="ability"><kbd>R</kbd><span><small>${flagship ? "FLAGSHIP ACTIVE" : "SPECIAL ACTION"}</small><strong>${escapeHtml(activeAbility)}</strong></span></button><button type="button" data-hwe-communication-open aria-expanded="false"><kbd>C</kbd><span><small>Giao tiếp động vật</small><strong>Tín hiệu không lời</strong></span></button></div>
        <div class="hwe-communication-wheel" data-hwe-communication-wheel hidden role="dialog" aria-modal="true" aria-label="Animal Communication Wheel"><header><span><small>ANIMAL COMMUNICATION</small><strong>Không chat toàn cục</strong></span><button type="button" data-hwe-communication-close aria-label="Đóng vòng giao tiếp">×</button></header><div>${COMMUNICATION_CALLS.map((call, index) => { const allowed = !flagship || typeof CONTENT?.isCommunicationCallAllowed !== "function" || CONTENT.isCommunicationCallAllowed(selected.id, call.id); return `<button type="button" data-hwe-call="${escapeHtml(call.id)}" style="--i:${index}" ${allowed ? "" : "disabled"} title="${escapeHtml(call.intent || call.label)}"><i>${escapeHtml(call.icon || (["alarm","distress"].includes(call.id) ? "!" : "◉"))}</i><span>${escapeHtml(call.label)}</span></button>`; }).join("")}</div></div>
        <div class="hwe-start-panel" data-hwe-start-panel><small>ERA REALM · 3D FOUNDATION · KHÔNG CÓ CON NGƯỜI</small><h2>Trở thành ${escapeHtml(selected.vietnamese)}</h2><p>${state.settings.convergence ? "Eon Convergence đang bật: đây là sandbox hư cấu có trộn thời đại." : `Realm ${escapeHtml(REALMS[state.realmId]?.label || state.realmId)} dùng Time Slice để không trộn niên đại ngoài ý muốn.`} Tìm nước, cân bằng khẩu phần, tránh thương tích và tiếp nối dòng gene.</p><div class="hwe-render-choice" role="group" aria-label="Chọn renderer"><button type="button" data-hwe-renderer="3d" class="${state.settings.renderer !== "lite" ? "is-active" : ""}" aria-pressed="${state.settings.renderer !== "lite"}"><b>3D</b><span>Babylon · WebGPU/WebGL</span></button><button type="button" data-hwe-renderer="lite" class="${state.settings.renderer === "lite" ? "is-active" : ""}" aria-pressed="${state.settings.renderer === "lite"}"><b>Lite</b><span>Canvas 2D tiết kiệm pin</span></button></div><p class="hwe-prototype-notice"><b>Vertical Slice:</b> T‑Rex và Triceratops dùng model CC0 có animation ở mức prototype; các loài chưa có asset phù hợp vẫn dùng hình khối procedural. Chưa model nào được mô tả là chất lượng điện ảnh.</p><div><button type="button" data-hwe-difficulty="sanctuary" class="${state.settings.difficulty === "sanctuary" ? "is-active" : ""}">Sanctuary</button><button type="button" data-hwe-difficulty="balanced" class="${state.settings.difficulty === "balanced" ? "is-active" : ""}">Cân bằng</button><button type="button" data-hwe-difficulty="wild" class="${state.settings.difficulty === "wild" ? "is-active" : ""}">Wild</button></div><button type="button" class="is-primary" data-hwe-start>▶ Bắt đầu vòng đời</button></div>
        <div class="hwe-death-panel" data-hwe-death hidden><small>VÒNG TUẦN HOÀN TIẾP DIỄN</small><h2>Dòng sống đã kết thúc</h2><p>Chất dinh dưỡng trở lại hệ sinh thái. Dữ liệu Codex và dòng gene vẫn được giữ.</p><button type="button" data-hwe-respawn>Nở lại</button></div>
        <div class="hwe-photo-composition" data-hwe-photo-composition aria-hidden="true" hidden><i></i><i></i><i></i><i></i></div>
        <div class="hwe-photo-crop" data-hwe-photo-crop aria-hidden="true" hidden><i></i><i></i></div>
        <div class="hwe-photo-overlay" data-hwe-photo-overlay hidden role="dialog" aria-modal="true" aria-label="Photo Mode vật lý"><header><span><small>PHYSICAL CAMERA · PAUSED</small><strong>${escapeHtml(selected.vietnamese)} · ${escapeHtml(REALMS[state.realmId]?.label || state.realmId)}</strong></span><button type="button" data-hwe-photo-close aria-label="Thoát Photo Mode">×</button></header><div class="hwe-photo-controls">
          <fieldset><legend>Ống kính & phơi sáng</legend><label>Tiêu cự <output>${Math.round(state.settings.photoFocalLength)} mm</output><input type="range" min="18" max="200" step="1" value="${state.settings.photoFocalLength}" data-hwe-photo-setting="photoFocalLength"></label><label>Khẩu độ <output>f/${Number(state.settings.photoAperture).toFixed(1)}</output><input type="range" min="1.4" max="16" step="0.1" value="${state.settings.photoAperture}" data-hwe-photo-setting="photoAperture"></label><label>Tốc độ màn trập<select data-hwe-photo-setting="photoShutter">${[15,30,60,125,250,500,1000,2000,4000,8000].map((value)=>`<option value="${value}" ${Math.round(state.settings.photoShutter)===value?"selected":""}>1/${value} giây</option>`).join("")}</select></label><label>ISO <output>${Math.round(state.settings.photoIso)}</output><input type="range" min="50" max="6400" step="50" value="${state.settings.photoIso}" data-hwe-photo-setting="photoIso"></label><label>Bù sáng <output>${state.settings.photoExposureComp > 0 ? "+" : ""}${Number(state.settings.photoExposureComp).toFixed(1)} EV</output><input type="range" min="-5" max="5" step="0.1" value="${state.settings.photoExposureComp}" data-hwe-photo-setting="photoExposureComp"></label></fieldset>
          <fieldset><legend>Focus & bố cục</legend><label class="hwe-photo-check"><input type="checkbox" data-hwe-photo-setting="photoAutofocus" ${state.settings.photoAutofocus?"checked":""}><span>Autofocus theo sinh vật</span></label><label>Khoảng focus <output>${Number(state.settings.photoFocusDistance).toFixed(1)} m</output><input type="range" min="0.3" max="500" step="0.1" value="${state.settings.photoFocusDistance}" data-hwe-photo-setting="photoFocusDistance"></label><label>Lưới bố cục<select data-hwe-photo-setting="photoComposition"><option value="thirds" ${state.settings.photoComposition==="thirds"?"selected":""}>Rule of thirds</option><option value="off" ${state.settings.photoComposition==="off"?"selected":""}>Tắt lưới</option></select></label><label>Tỷ lệ khung<select data-hwe-photo-setting="photoCrop"><option value="native" ${state.settings.photoCrop==="native"?"selected":""}>Theo viewport</option><option value="2.39" ${state.settings.photoCrop==="2.39"?"selected":""}>CinemaScope 2.39:1</option><option value="1.85" ${state.settings.photoCrop==="1.85"?"selected":""}>Cinema 1.85:1</option><option value="1.0" ${state.settings.photoCrop==="1.0"?"selected":""}>Vuông 1:1</option></select></label><label>Rung camera <output>${Math.round(state.settings.photoShake)}%</output><input type="range" min="0" max="100" step="1" value="${state.settings.photoShake}" data-hwe-photo-setting="photoShake"></label></fieldset>
          <input type="hidden" value="${Math.round(state.settings.photoFov)}" data-hwe-photo-setting="photoFov"><input type="hidden" value="${Math.round(state.settings.photoExposure)}" data-hwe-photo-setting="photoExposure">
        </div><footer><p><b>PNG thật từ renderer hiện tại.</b> Chế độ Lite vẫn chụp được canvas; DOF vật lý chỉ bật khi pipeline 3D hỗ trợ.</p><button type="button" class="is-primary" data-hwe-photo-capture>Chụp PNG</button><button type="button" data-hwe-photo-close>Thoát Photo Mode</button></footer></div>
        <div class="hwe-touch-controls" aria-label="Điều khiển cảm ứng"><div class="hwe-touch-stick" data-hwe-touch-stick role="application" tabindex="0" aria-label="Joystick cảm ứng linh hoạt"><i></i></div><div class="hwe-camera-pad" data-hwe-camera-pad role="application" tabindex="0" aria-label="Vuốt để lia camera"></div><button type="button" data-hwe-touch="ArrowUp" aria-label="Đi tới">▲</button><button type="button" data-hwe-touch="ArrowLeft" aria-label="Đi trái">◀</button><button type="button" data-hwe-touch="ArrowDown" aria-label="Đi lùi">▼</button><button type="button" data-hwe-touch="ArrowRight" aria-label="Đi phải">▶</button><button type="button" data-hwe-action="interact" aria-label="Tương tác, ăn hoặc uống">F</button><button type="button" data-hwe-action="sense" aria-label="Kích hoạt giác quan">Q</button><button type="button" data-hwe-action="ability" aria-label="Dùng năng lực loài">R</button><button type="button" data-hwe-action="lock-target" aria-label="Khóa hoặc bỏ khóa mục tiêu">Z</button><button type="button" data-hwe-communication-open aria-label="Mở vòng giao tiếp">C</button></div>
        <div class="hwe-pause-overlay" data-hwe-pause-overlay hidden role="dialog" aria-modal="true" aria-labelledby="hwe-pause-title"><section><small>IMMERSIVE GAMEPLAY · CON TRỎ ĐÃ GIẢI PHÓNG</small><h2 id="hwe-pause-title">Tạm dừng vòng đời</h2><p>Chỉ trạng thái Playing mới nhận WASD và chuột. Bấm Tiếp tục để khóa chuột lại bằng một thao tác hợp lệ.</p><div><button type="button" class="is-primary" data-hwe-resume>▶ Tiếp tục</button><button type="button" data-hwe-fullscreen>⛶ Toàn màn hình</button><button type="button" data-hwe-game-overlay-open="map">M · World Map</button><button type="button" data-hwe-game-overlay-open="codex">Tab · Animal Codex</button><button type="button" data-hwe-photo> P · Photo Mode</button><button type="button" data-hwe-game-overlay-open="settings">⚙ Camera & điều khiển</button><button type="button" data-hwe-exit-immersive>Thoát chế độ nhập vai</button></div></section></div>
        <div class="hwe-game-overlay" data-hwe-game-overlay hidden role="dialog" aria-modal="true" aria-labelledby="hwe-game-overlay-title"><section><header><div><small data-hwe-game-overlay-kicker>IN-GAME OVERLAY</small><h2 id="hwe-game-overlay-title" data-hwe-game-overlay-title>World Map</h2></div><button type="button" data-hwe-game-overlay-close aria-label="Đóng overlay">×</button></header><div data-hwe-game-overlay-body></div><footer><button type="button" data-hwe-game-overlay-close>Quay lại Pause</button></footer></section></div>
      </section>
      <aside class="hwe-telemetry"><header><span class="hwe-avatar" style="--species:${selected.color}">◆</span><span><small>${escapeHtml(selected.name)}</small><strong>${escapeHtml(selected.vietnamese)}</strong></span><button type="button" data-hwe-pause aria-pressed="false">Ⅱ</button></header>
        <section class="hwe-vitals">${[["health","Máu"],["hunger","Đói"],["thirst","Khát"],["stamina","Thể lực"],["growth","Trưởng thành"],["oxygen","Oxy"],["nutrition","Dinh dưỡng"],["dietQuality","Khẩu phần"]].map(([key,label]) => `<label>${label} <progress data-hwe-vital="${key}" max="100" value="${state.player[key]}"></progress><b data-hwe-value="${key}">${Math.round(state.player[key])}</b></label>`).join("")}</section>
        <section class="hwe-condition-panel"><small>INJURY & CONDITION</small><div>${[["temperature","Nhiệt"],["bleeding","Chảy máu"],["fracture","Gãy xương"],["infection","Nhiễm trùng"],["disease","Bệnh"]].map(([key,label]) => { const value = key === "temperature" ? state.player.temperature : state.player.injuries[key]; return `<span data-hwe-condition="${key}"><i style="--condition:${value}"></i><b>${label}</b><em data-hwe-condition-value="${key}">${Math.round(value)}</em></span>`; }).join("")}</div></section>
        <section class="hwe-species-facts"><small>ĐẶC TÍNH LOÀI</small><p><b>${escapeHtml(dietLabel(selected.diet))}</b><span>${escapeHtml(selected.period)} · ${escapeHtml(formatMass(selected.mass))}</span></p><p><b>Giác quan</b><span>${escapeHtml(selected.ability)}</span></p><p><b>Giai đoạn</b><span data-hwe-stage>${stageLabel(state.player.growth)}</span></p></section>
        <section class="hwe-mission"><small>NHIỆM VỤ SINH THÁI</small><strong data-hwe-mission-title>${escapeHtml(EXPEDITIONS.find((row) => row.id === state.activeExpedition)?.title || EXPEDITIONS[0].title)}</strong><p data-hwe-mission-copy>${escapeHtml(EXPEDITIONS.find((row) => row.id === state.activeExpedition)?.detail || EXPEDITIONS[0].detail)}</p><progress data-hwe-mission-progress max="100" value="0"></progress></section>
        <section class="hwe-engine-telemetry"><small>ECOLOGY · RENDER ENGINE</small><dl><div><dt>Renderer</dt><dd data-hwe-render-status>Canvas 2D Lite</dd></div><div><dt>AI utility</dt><dd data-hwe-ai-mode>Local fallback</dd></div><div><dt>Chunks</dt><dd data-hwe-chunk-count>0</dd></div><div><dt>Apex budget</dt><dd data-hwe-apex-budget>Đang tính</dd></div><div><dt>Trail signals</dt><dd data-hwe-trail-count>0</dd></div></dl></section>
        <section class="hwe-log"><small>FIELD SIGNALS</small><div data-hwe-log aria-live="polite"><p>Thế giới đang chờ bạn bắt đầu.</p></div></section>
      </aside>
    </div>`;
  }

  function codexDetailMarkup(species, state) {
    const tier = tierForSpecies(species);
    const flagship = flagshipFor(species.id);
    const realmId = realmForSpecies(species);
    const playableHere = speciesAllowedInRealm(species, state.realmId, state.settings.convergence);
    const action = tier === "flagship"
      ? `<button type="button" data-hwe-play-species="${species.id}">${playableHere ? "Chơi Flagship này →" : "Chuyển realm và chơi →"}</button>`
      : tier === "simulated"
        ? `<button type="button" data-hwe-route="/game/ecosystem">Quan sát trong hệ sinh thái →</button>`
        : `<button type="button" disabled>Chỉ tra cứu trong Eon Codex</button>`;
    return `<span class="hwe-creature-sigil" style="--species:${species.color}">◆</span><small>${escapeHtml(ERA_META[species.era].label)} · ${escapeHtml(species.period)}</small><span class="hwe-tier-badge" data-tier="${tier}">${tierLabel(tier)}</span><h3>${escapeHtml(species.vietnamese)}</h3><em>${escapeHtml(species.name)}</em><dl><div><dt>Realm</dt><dd>${realmId === "convergence-only" ? "Codex / Convergence" : escapeHtml(REALMS[realmId]?.label || realmId)}</dd></div><div><dt>Khối lượng</dt><dd>${escapeHtml(formatMass(species.mass))}</dd></div><div><dt>Khẩu phần</dt><dd>${escapeHtml(dietLabel(species.diet))}</dd></div><div><dt>Vận động</dt><dd>${escapeHtml(mechanicLabel(flagship?.locomotion, species.locomotion))}</dd></div><div><dt>Giác quan</dt><dd>${escapeHtml(mechanicLabel(flagship?.sense, species.ability))}</dd></div><div><dt>Phòng vệ</dt><dd>${escapeHtml(mechanicLabel(flagship?.defense, "Archetype dùng chung"))}</dd></div><div><dt>Sinh sản</dt><dd>${escapeHtml(mechanicLabel(flagship?.reproduction, "Vòng đời archetype"))}</dd></div></dl>${tier === "flagship" ? `<p class="hwe-flagship-note">Có profile Flagship riêng; mức hoàn thiện 3D phụ thuộc Species Cartridge v3.</p>` : `<p class="hwe-tier-note">${tier === "simulated" ? "Tham gia Utility AI và Biomass Ledger; được quan sát nhưng không giả là playable." : "Catalog tra cứu; không tự nhận là playable hoàn chỉnh."}</p>`}${action}`;
  }

  function planetSpeciesDetailMarkup(species) {
    if (!species) return `<div class="hwe-planet-empty"><strong>Chọn một loài để xem phân loại</strong><p>Registry mới không tự gán model hoặc hành vi chưa được duyệt.</p></div>`;
    const taxonomy = species.taxonomy || {};
    const missingVi = species.vernacularStatus !== "vi-preferred";
    const sourceUrl = `https://www.inaturalist.org/taxa/${Number(species.taxonId) || 0}`;
    return `<small>${escapeHtml(species.groupLabelVi)} · TAXON ${Number(species.taxonId) || "—"}</small><span class="hwe-tier-badge" data-tier="codex">CATALOG-ONLY</span><h3>${escapeHtml(species.vietnameseName)}</h3><em>${escapeHtml(species.scientificName)}</em>${missingVi ? `<p class="hwe-planet-review-note">Tên Việt chưa được nguồn cung cấp; đang hiển thị tên khoa học thay thế và không giả là bản dịch đã duyệt.</p>` : ""}<dl><div><dt>Giới</dt><dd>${escapeHtml(taxonomy.kingdom || "Chưa duyệt")}</dd></div><div><dt>Ngành</dt><dd>${escapeHtml(taxonomy.phylum || "Chưa duyệt")}</dd></div><div><dt>Lớp</dt><dd>${escapeHtml(taxonomy.class || "Chưa duyệt")}</dd></div><div><dt>Bộ</dt><dd>${escapeHtml(taxonomy.order || "Chưa duyệt")}</dd></div><div><dt>Họ</dt><dd>${escapeHtml(taxonomy.family || "Chưa duyệt")}</dd></div><div><dt>Chi</dt><dd>${escapeHtml(taxonomy.genus || "Chưa duyệt")}</dd></div><div><dt>Vận động</dt><dd>${escapeHtml((species.locomotion || []).join(" · "))}</dd></div><div><dt>Biome gợi ý</dt><dd>${escapeHtml((species.biomes || []).join(" · "))}</dd></div></dl><p class="hwe-tier-note"><b>Chưa được spawn:</b> hình thái, khẩu phần, quan hệ săn mồi và model vẫn cần kiểm duyệt theo loài. Registry không biến dữ liệu tra cứu thành NPC giả.</p><a class="hwe-planet-source" href="${sourceUrl}" target="_blank" rel="noopener noreferrer">Mở nguồn phân loại ↗</a>`;
  }

  function planetRegistryMarkup() {
    const registrySpecies = IMPORTED_SPECIES;
    if (!registrySpecies.length) return "";
    const selected = registrySpecies[0];
    const groups = (SPECIES_REGISTRY.groups || []).map((group) => ({ ...group, count: registrySpecies.filter((species) => species.groupId === group.id).length })).filter((group) => group.count);
    return `<section class="hwe-planet-registry" aria-labelledby="hwe-planet-registry-title"><header><div><small>PLANET SPECIES REGISTRY · TAXONOMY IMPORT</small><h3 id="hwe-planet-registry-title">${registrySpecies.length} loài bổ sung từ registry 300 taxon</h3><p>Dữ liệu phân loại có nguồn thật; ${MERGED_DUPLICATE_COUNT} tên khoa học trùng catalog cũ đã được hợp nhất. Mọi mục nhập mới vẫn khóa ở Catalog-only cho đến khi ecology, model, rig và giấy phép được duyệt.</p></div><span><b>${registrySpecies.length}</b><small>taxon bổ sung không trùng</small></span></header><div class="hwe-planet-toolbar"><label><span>⌕</span><input type="search" data-hwe-planet-search placeholder="Tên Việt, English, Latin, họ hoặc bộ…" aria-label="Tìm trong ${registrySpecies.length} loài động vật bổ sung"></label><div role="group" aria-label="Lọc nhóm động vật"><button type="button" data-hwe-planet-group="all" aria-pressed="true">Tất cả · ${registrySpecies.length}</button>${groups.map((group) => `<button type="button" data-hwe-planet-group="${escapeHtml(group.id)}" aria-pressed="false">${escapeHtml(group.labelVi)} · ${group.count}</button>`).join("")}</div></div><div class="hwe-planet-layout"><div class="hwe-planet-grid" data-hwe-planet-grid data-visible-count="${registrySpecies.length}">${registrySpecies.map((species) => `<button type="button" data-hwe-planet-species="${escapeHtml(species.id)}" data-hwe-planet-card data-group="${escapeHtml(species.groupId)}" data-search="${escapeHtml(`${species.vietnameseName} ${species.englishName} ${species.scientificName} ${species.taxonomy?.order || ""} ${species.taxonomy?.family || ""}`.toLocaleLowerCase("vi"))}"><i aria-hidden="true">◇</i><span><strong>${escapeHtml(species.vietnameseName)}</strong><small>${escapeHtml(species.englishName)} · ${escapeHtml(species.scientificName)}</small><em>${escapeHtml(species.groupLabelVi)} · Catalog-only</em></span></button>`).join("")}</div><aside class="hwe-planet-detail" data-hwe-planet-detail>${planetSpeciesDetailMarkup(selected)}</aside></div></section>`;
  }

  function codexMarkup(state) {
    const selected = SPECIES_BY_ID.get(state.speciesId);
    const expandedCount = MERGED_SPECIES_COUNT;
    return `<section class="hwe-library"><header class="hwe-view-hero"><div><small>EON CODEX · 3 TẦNG TAXONOMY · PLANET REGISTRY</small><h2>Bách khoa sự sống xuyên thời đại</h2><p>${expandedCount} loài không trùng được tách rõ Playable Flagship, Simulated Wildlife và Catalog-only. Có dữ liệu không đồng nghĩa đã chơi được hoặc có model hoàn chỉnh.</p></div><div class="hwe-stat-orbit"><b>${expandedCount}</b><span>loài không trùng</span></div></header><div class="hwe-catalog-tiers">${[["flagship",String(SPECIES.filter((species)=>tierForSpecies(species)==="flagship").length),"Playable Flagship","Cơ chế và ability riêng"],["simulated",String(SPECIES.filter((species)=>tierForSpecies(species)==="simulated").length),"Simulated Wildlife","Tham gia lưới sinh thái"],["codex",String(SPECIES.filter((species)=>tierForSpecies(species)==="codex").length + IMPORTED_SPECIES.length),"Eon Codex","Tra cứu, chưa tự nhận là playable"]].map(([id,count,title,copy]) => `<button type="button" data-hwe-tier-filter="${id}" aria-pressed="false"><b>${count}</b><span><strong>${title}</strong><small>${copy}</small></span></button>`).join("")}</div><div class="hwe-filterbar"><label><span>⌕</span><input type="search" data-hwe-species-search placeholder="Tên Việt, Latin hoặc kỷ địa chất…"></label>${Object.values(REALMS).map((realm) => `<button type="button" data-hwe-realm-filter="${realm.id}" aria-pressed="false" style="--era:${realm.color}">${escapeHtml(realm.label)}</button>`).join("")}<button type="button" data-hwe-realm-filter="all" aria-pressed="true">Tất cả</button></div><div class="hwe-codex-layout"><div class="hwe-codex-grid">${speciesCardsMarkup(state)}</div><aside class="hwe-codex-detail" data-hwe-codex-detail>${codexDetailMarkup(selected, state)}</aside></div>${planetRegistryMarkup()}</section>`;
  }

  function ecosystemMarkup(state) {
    const counts = Object.values(REALMS).map((realm) => [realm, SPECIES.filter((species) => speciesAllowedInRealm(species, realm.id, false)).length]);
    const snapshot = state.ecologySnapshot;
    const actions = snapshot?.actions || {};
    return `<section class="hwe-ecosystem"><header class="hwe-view-hero"><div><small>UTILITY AI · BIOMASS LEDGER · CHUNK STREAMING</small><h2>Ecology Director 2.0</h2><p>Mỗi lần chạy tạo một simulation local có seed, chunk, wildlife, hazard và Utility AI thật; kết quả được lưu giới hạn trên thiết bị.</p></div><button type="button" data-hwe-simulate-season>Chạy mùa ${Number(snapshot?.season || 0) + 1} →</button></header><div class="hwe-eco-grid"><article class="hwe-food-web"><span class="is-source">Nắng · Nước</span><i></i><span class="is-plant">Thực vật</span><i></i><span class="is-prey">Ăn cỏ</span><i></i><span class="is-predator">Săn mồi</span><i></i><span class="is-cycle">Phân hủy</span></article><article class="hwe-population"><small>CATALOG THEO REALM</small>${counts.map(([realm, count]) => `<label><span>${escapeHtml(realm.label)}</span><progress max="${SPECIES.length}" value="${count}"></progress><b>${count}</b></label>`).join("")}</article><article class="hwe-biomass-ledger"><small>BIOMASS LEDGER · ${snapshot ? `${snapshot.population} CÁ THỂ / ${snapshot.chunks} CHUNK` : "CHƯA CÓ SNAPSHOT"}</small><dl><div><dt>Producer budget</dt><dd data-hwe-ledger="producer">${snapshot ? Math.round(snapshot.producer) + "%" : "—"}</dd></div><div><dt>Prey biomass</dt><dd data-hwe-ledger="prey">${snapshot ? Math.round(snapshot.prey) + "%" : "—"}</dd></div><div><dt>Predator biomass</dt><dd data-hwe-ledger="predator">${snapshot ? Math.round(snapshot.predator) + "%" : "—"}</dd></div><div><dt>Apex active</dt><dd data-hwe-ledger="apex">${snapshot ? snapshot.apex : "—"}</dd></div></dl><p>Số liệu chỉ đến từ lần mô phỏng local gần nhất; không tạo population hay online status giả.</p></article><article class="hwe-director"><small>ECOLOGY DIRECTOR</small><h3 data-hwe-season-title>${escapeHtml(snapshot?.title || "Chưa có mùa đã mô phỏng")}</h3><p data-hwe-season-copy>${escapeHtml(snapshot?.copy || "Nhấn “Chạy một mùa” để sinh chunk, phân bổ wildlife theo cap và chạy fixed-step.")}</p><div><span>Thủy triều</span><span>Lũ</span><span>Cháy tự nhiên</span><span>Núi lửa</span><span>Mùa sinh sản</span><span>Băng tan</span></div></article><article class="hwe-utility-actions"><small>UTILITY ACTIONS · SNAPSHOT THẬT</small>${["hunt","flee","drink","feed","rest","migrate","mate","guardNest"].map((action,index)=>`<span style="--i:${index}"><i></i>${action}<b>${Math.round(actions[action] || 0)}</b></span>`).join("")}</article><article class="hwe-senses"><small>GIÁC QUAN KHÔNG PHẢI CON NGƯỜI</small>${["Mùi theo gió", "Vết chân phân rã", "Định vị âm", "Nhiệt", "Điện trường", "Phân cực ánh sáng", "Từ trường", "Pheromone"].map((sense, index) => `<span style="--i:${index}">${sense}</span>`).join("")}</article></div></section>`;
  }

  function timelineMarkup(state) {
    const atlasMaps = Array.isArray(WORLD_ATLAS?.MAPS) ? WORLD_ATLAS.MAPS : [];
    if (!atlasMaps.length) {
      return `<section class="hwe-atlas"><header class="hwe-view-hero"><div><small>FOUR ERA REALMS · NO SILENT MIXING</small><h2>Trái Đất Muôn Thời</h2><p>Mỗi realm có allowlist loài, biome và biến động riêng.</p></div></header><div class="hwe-timeline">${Object.values(REALMS).map((realm, index) => `<article data-realm-card="${realm.id}" style="--era:${realm.color};--i:${index}"><i></i><small>${escapeHtml(realm.subtitle || realm.range || "")}</small><h3>${escapeHtml(realm.label)}</h3><b>${SPECIES.filter((species) => speciesAllowedInRealm(species, realm.id, false)).length} loài được phép</b><button type="button" data-hwe-realm="${realm.id}">Chọn realm này →</button></article>`).join("")}</div></section>`;
    }
    const groups = Object.entries(WORLD_ATLAS.REALM_META || {}).map(([realmId, meta]) => ({ realmId, meta, maps: atlasMaps.filter((map) => map.realmId === realmId) })).filter((group) => group.maps.length);
    const confidenceLabel = (value) => ({ high: "Tin cậy cao", medium: "Tin cậy trung bình", hypothesis: "Giả thuyết", fictional: "Sandbox hư cấu" }[value] || value);
    return `<section class="hwe-atlas hwe-world-atlas"><header class="hwe-view-hero"><div><small>PLANET ATLAS · ${atlasMaps.length} KHUNG BẢN ĐỒ · STREAM THEO VÙNG</small><h2>Trái Đất Muôn Thời</h2><p>Chọn lát cắt địa chất hoặc khu vực hiện đại. Hành tinh dùng địa chỉ logic và floating origin; renderer chỉ dựng vùng 16 × 16 km đang hoạt động để giữ frame time ổn định. Atlas hiện là chỉ mục có nguồn, chưa nhập tile GIS tái dựng.</p></div><div class="hwe-atlas-summary"><b>${atlasMaps.length}</b><span>khung có nguồn và sandbox</span><small>${Math.round((WORLD_ATLAS.PLANET_CIRCUMFERENCE_METERS || 0) / 1000).toLocaleString("vi-VN")} km chu vi logic</small></div></header>
      <div class="hwe-atlas-groups">${groups.map((group, groupIndex) => `<section class="hwe-atlas-group" style="--era:${escapeHtml(group.meta.accent || "#72ef9d")};--i:${groupIndex}"><header><span><small>ERA REALM</small><h3>${escapeHtml(group.meta.label)}</h3></span><b>${group.maps.length} bản đồ</b></header><div>${group.maps.map((map, index) => `<article class="hwe-atlas-map${state.atlasMapId === map.id ? " is-selected" : ""}" data-confidence="${escapeHtml(map.confidence)}" style="--i:${index}"><span class="hwe-atlas-map-orb" aria-hidden="true"><i></i></span><small>${escapeHtml(map.range)} · ${escapeHtml(confidenceLabel(map.confidence))}</small><h4>${escapeHtml(map.label)}</h4><p>${map.regions.slice(0, 4).map((region) => escapeHtml(region.name)).join(" · ")}</p>${map.sourceIds?.length ? `<div class="hwe-atlas-citations" aria-label="Nguồn tham khảo">${map.sourceIds.map((sourceId) => WORLD_ATLAS.SOURCE_REGISTRY?.[sourceId]).filter(Boolean).map((source) => `<a href="${escapeHtml(source.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(source.publisher)} ↗</a>`).join("")}</div>` : ""}<footer><span>${map.reconstruction === "fictional-sandbox" ? "Không phải tái dựng khoa học" : "Nguồn tham khảo · terrain vẫn procedural"}</span><button type="button" data-hwe-atlas-map="${escapeHtml(map.id)}" aria-pressed="${state.atlasMapId === map.id}">${state.atlasMapId === map.id ? "Đang chọn" : "Chọn bản đồ →"}</button></footer></article>`).join("")}</div></section>`).join("")}</div>
      <div class="hwe-realm-note"><strong>Luật hiển thị trung thực</strong><span><b>Era Realm</b> Không trộn loài sai niên đại.</span><span><b>Confidence</b> Chỉ áp dụng cho khung niên đại/vùng tham khảo, không chứng nhận terrain procedural.</span><span><b>Eon Convergence</b> Sandbox hư cấu chỉ bật sau lựa chọn rõ ràng.</span></div></section>`;
  }

  function expeditionsMarkup(state) {
    return `<section class="hwe-expeditions"><header class="hwe-view-hero"><div><small>30-MINUTE EXPEDITIONS</small><h2>Nhiệm vụ do tự nhiên tạo ra</h2><p>Không NPC, không công trình và không nhiệm vụ kiểu con người. Mọi mục tiêu đều đến từ nhu cầu sinh tồn và biến động sinh thái.</p></div></header><div class="hwe-mission-grid">${EXPEDITIONS.map((mission, index) => `<article class="${state.completed.includes(mission.id) ? "is-complete" : state.activeExpedition === mission.id ? "is-active" : ""}" style="--i:${index}"><span>${state.completed.includes(mission.id) ? "✓" : String(index + 1).padStart(2, "0")}</span><small>${escapeHtml(mission.reward)}</small><h3>${escapeHtml(mission.title)}</h3><p>${escapeHtml(mission.detail)}</p><button type="button" data-hwe-expedition="${mission.id}">${state.activeExpedition === mission.id ? "Đang theo dõi" : "Theo dõi và chơi"}</button></article>`).join("")}</div></section>`;
  }

  function lineageMarkup(state) {
    const genes = state.player.genes;
    const records = state.lineage.length ? state.lineage : [{ id: "origin", generation: state.player.generation, speciesId: state.speciesId, genes, bornAt: state.updatedAt, survived: state.player.growth }];
    return `<section class="hwe-lineage"><header class="hwe-view-hero"><div><small>LINEAGE VAULT · LOCAL-ONLY</small><h2>Dòng gene nhiều thế hệ</h2><p>Cá thể có thể chết, nhưng Codex, khám phá và đặc tính di truyền đã ghi nhận vẫn còn. Không có pay-to-win hoặc hồi sinh trả phí.</p></div><button type="button" data-hwe-lineage-export>Xuất lineage JSON</button></header><div class="hwe-gene-dashboard"><article class="hwe-gene-orb"><span><b>${state.player.generation}</b><small>THẾ HỆ</small></span><h3>${escapeHtml(SPECIES_BY_ID.get(state.speciesId)?.vietnamese || state.speciesId)}</h3><p>${state.player.lineage} tổ/checkpoint đã tạo</p><button type="button" data-hwe-gene-preview>Mô phỏng thế hệ kế</button></article><article class="hwe-gene-bars"><small>GENE PROFILE</small>${Object.entries(genes).filter(([,value]) => Number.isFinite(value)).map(([key,value]) => `<label><span>${escapeHtml(geneLabel(key))}</span><progress max="100" value="${genePercent(key,value)}"></progress><b>${Math.round(genePercent(key,value))}%</b></label>`).join("")}</article><article class="hwe-gene-preview" data-hwe-gene-preview-panel><small>NEST FORECAST</small><h3>Chưa mô phỏng</h3><p>Biến thể chỉ được ghi vào lineage khi tạo tổ thật trong Thế giới sống.</p></article></div><div class="hwe-lineage-track">${records.map((record,index) => `<article style="--i:${index}"><span>${record.generation}</span><small>${new Date(record.bornAt).toLocaleDateString("vi-VN")}</small><h3>${escapeHtml(SPECIES_BY_ID.get(record.speciesId)?.vietnamese || record.speciesId)}</h3><p>Trưởng thành đạt ${Math.round(record.survived)}%</p><div>${Object.entries(record.genes).filter(([,value]) => Number.isFinite(value)).slice(0,4).map(([key,value])=>`<i title="${escapeHtml(geneLabel(key))}" style="--gene:${genePercent(key,value)}"></i>`).join("")}</div></article>`).join("")}</div></section>`;
  }

  function observerMarkup(state) {
    const events = state.eventJournal.slice().reverse();
    return `<section class="hwe-observer"><header class="hwe-view-hero"><div><small>OBSERVER · REPLAY · HEATMAP</small><h2>Quan sát mà không trở thành nhân vật</h2><p>Observer nằm ngoài lore. Heatmap và timeline chỉ đọc dữ liệu vòng chơi local thật, không hiển thị quần thể hoặc người chơi giả.</p></div><div><button type="button" data-hwe-replay-play>▶ Phát lại</button><button type="button" data-hwe-replay-clear>Xóa replay local</button></div></header><div class="hwe-observer-grid"><article class="hwe-replay-stage"><canvas width="900" height="520" data-hwe-observer-canvas aria-label="Heatmap và đường phát lại vòng đời"></canvas><div><span>0.25×</span><input type="range" min="0" max="${Math.max(1,state.replay.length - 1)}" value="0" data-hwe-replay-scrubber aria-label="Vị trí replay"><span data-hwe-replay-position>0/${state.replay.length}</span></div></article><aside class="hwe-observer-stats"><small>LOCAL TELEMETRY</small><dl><div><dt>Mẫu replay</dt><dd>${state.replay.length}/240</dd></div><div><dt>Heatmap cells</dt><dd>${state.heatmap.length}/256</dd></div><div><dt>World events</dt><dd>${state.eventJournal.length}/40</dd></div><div><dt>Realm</dt><dd>${escapeHtml(REALMS[state.realmId]?.label || state.realmId)}</dd></div><div><dt>Thế hệ</dt><dd>${state.player.generation}</dd></div></dl><h3>Nhật ký biến động</h3>${events.length ? events.map((row)=>`<p><b>${escapeHtml(row.label)}</b><small>${new Date(row.at).toLocaleTimeString("vi-VN")}</small></p>`).join("") : "<p>Chưa có biến động nào được ghi.</p>"}</aside></div></section>`;
  }

  function networkMarkup() {
    const checks = [
      ["auth","Đăng nhập và token phòng ngắn hạn",false],["authority","Server-authoritative simulation",false],["reconnect","Reconnect và resync snapshot",false],
      ["moderation","Kick, block, report và audit",false],["anticheat","Rate limit, anti-replay và chống client tampering",false],["privacy","Invite-only và không lộ danh sách phòng riêng",false]
    ];
    return `<section class="hwe-network"><header class="hwe-view-hero"><div><small>MULTIPLAYER · FAIL CLOSED</small><h2>Realtime chưa được bật</h2><p>Vertical slice hiện là local single-player. Không có room code, người online, leaderboard hoặc máy chủ giả.</p></div><span class="hwe-capability-lock">🔒 BACKEND REQUIRED</span></header><div class="hwe-network-grid"><article><small>READINESS GATES</small>${checks.map(([id,label,ready])=>`<p data-hwe-network-check="${id}" class="${ready?"is-ready":"is-locked"}"><i>${ready?"✓":"○"}</i><span>${label}</span><b>${ready?"Sẵn sàng":"Chưa cấu hình"}</b></p>`).join("")}<button type="button" data-hwe-network-audit>Chạy kiểm tra capability</button></article><article><small>KIẾN TRÚC MỤC TIÊU</small><h3>20–32 người mỗi shard trước</h3><ol><li>Realm server theo thời đại.</li><li>Interest management theo chunk.</li><li>Client prediction + server reconciliation.</li><li>Snapshot delta có sequence number.</li><li>Score và sinh khối chỉ do server quyết định.</li></ol><p>WebGPU và WebRTC không phải điều kiện để mở multiplayer. Backend authoritative mới là điều kiện bắt buộc.</p></article></div><div class="hwe-network-result" data-hwe-network-result role="status" aria-live="polite">Chưa chạy kiểm tra. Game tiếp tục hoạt động an toàn ở chế độ local.</div></section>`;
  }

  function qualityProfiles() {
    const profiles = Object.values(RENDERER_3D?.QUALITY_PROFILES || {}).filter((profile) => profile?.id && profile.id !== "personal");
    return [...profiles, PERSONAL_QUALITY_PROFILE];
  }

  function cinematicPackMarkup() {
    const packApi = global.HHEonWildCinematicPacks;
    const available = typeof packApi?.createManager === "function";
    const packs = Array.isArray(packApi?.PACK_CATALOG) ? packApi.PACK_CATALOG : CINEMATIC_PACK_FALLBACK;
    return `<section class="hwe-cinematic-packs" data-hwe-pack-console aria-labelledby="hwe-pack-title">
      <header><div><small>PERSONAL CINEMATIC ASSET PACKS · OPFS / CACHE STORAGE</small><h3 id="hwe-pack-title">Thư viện hình ảnh cục bộ đã xác minh</h3><p>Chỉ dùng asset sau khi đúng byte và SHA-256. Gói lỗi tự giữ model nhẹ; không lưu tệp lớn trong localStorage.</p></div><span data-hwe-pack-storage>${available ? "Đang đọc dung lượng thiết bị…" : "Module asset pack chưa được tải · game nhẹ vẫn hoạt động"}</span></header>
      <div class="hwe-pack-global-actions" role="group" aria-label="Tác vụ toàn bộ Cinematic Pack"><button type="button" data-hwe-pack-persist ${available ? "" : "disabled"}>Giữ dữ liệu bền vững</button><button type="button" data-hwe-pack-verify-all ${available ? "" : "disabled"}>Kiểm tra toàn bộ</button><button type="button" data-hwe-pack-remove-all ${available ? "" : "disabled"}>Xóa toàn bộ cache Ultra</button></div>
      <div class="hwe-pack-grid">${packs.map((pack) => `<article class="hwe-pack-card" data-hwe-pack="${escapeHtml(pack.id)}" data-status="not-installed" style="--pack-accent:${escapeHtml(pack.accent || "#55e6ff")}">
        <div class="hwe-pack-orb" aria-hidden="true"><i></i><b>◇</b></div><div class="hwe-pack-copy"><small data-hwe-pack-status>CHƯA CÀI</small><h4>${escapeHtml(pack.label)}</h4><p>${escapeHtml(pack.description)}</p><strong data-hwe-pack-file>Chưa nạp manifest bất biến</strong></div>
        <div class="hwe-pack-progress"><span><b data-hwe-pack-progress-label>0 B / chưa xác định</b><em data-hwe-pack-asset>Chờ manifest có provenance</em></span><progress max="1" value="0" data-hwe-pack-progress></progress></div>
        <div class="hwe-pack-actions"><button type="button" data-hwe-pack-manifest="${escapeHtml(pack.id)}" ${available ? "" : "disabled"}>Manifest…</button><button type="button" data-hwe-pack-local="${escapeHtml(pack.id)}" ${available ? "" : "disabled"}>Thư mục local…</button><button type="button" class="is-primary" data-hwe-pack-install="${escapeHtml(pack.id)}" disabled>Cài / tiếp tục</button><button type="button" data-hwe-pack-pause="${escapeHtml(pack.id)}" disabled>Tạm dừng</button><button type="button" data-hwe-pack-verify="${escapeHtml(pack.id)}" disabled>Kiểm tra SHA-256</button><button type="button" data-hwe-pack-remove="${escapeHtml(pack.id)}" disabled>Xóa gói</button></div>
      </article>`).join("")}</div>
      <p class="hwe-pack-truth"><b>Không phải asset production:</b> model low-poly hiện có vẫn được ghi rõ là prototype. Chọn Cinematic Personal chỉ bật pipeline nặng; chất lượng model chỉ tăng sau khi pack hợp pháp đã xác minh.</p>
      <input type="file" accept="application/json,.json" data-hwe-pack-manifest-file hidden>
      <input type="file" multiple webkitdirectory directory data-hwe-pack-local-files hidden>
    </section>`;
  }

  function inputBindingLabel(binding) {
    if (!binding) return "Chưa gán";
    if (binding.device === "keyboard") return String(binding.code || "Phím").replace(/^Key/, "").replace(/^Digit/, "");
    if (binding.device === "gamepad") return binding.control === "button" ? `Pad B${binding.index}` : `Pad A${binding.index}${binding.direction < 0 ? "−" : "+"}`;
    return `Touch · ${binding.id || binding.control || "action"}`;
  }

  function inputSettingsMarkup(inputSystem) {
    if (!inputSystem || !INPUT_SYSTEM) return `<article><small>ĐIỀU KHIỂN</small><h3>Legacy input fallback</h3><p>Input Action System chưa được tải; WASD và Canvas Lite vẫn hoạt động.</p></article>`;
    const mappings = inputSystem.getMappings();
    const presets = inputSystem.listPresets();
    const conflicts = inputSystem.getConflicts();
    return `<article class="hwe-input-settings"><small>INPUT ACTION SYSTEM · REMAP ĐA THIẾT BỊ</small><h3>Phím, gamepad và cảm ứng</h3><label>Preset<select data-hwe-input-preset>${presets.map((preset) => `<option value="${escapeHtml(preset.id)}" ${inputSystem.presetId === preset.id ? "selected" : ""}>${escapeHtml(preset.label)}${preset.builtin ? "" : " · cá nhân"}</option>`).join("")}</select></label><label>Gamepad deadzone <output>${Math.round(inputSystem.settings.gamepadDeadzone * 100)}%</output><input type="range" min="5" max="60" step="1" value="${Math.round(inputSystem.settings.gamepadDeadzone * 100)}" data-hwe-input-setting="gamepadDeadzone"></label><label>Touch deadzone <output>${Math.round(inputSystem.settings.touchDeadzone * 100)}%</output><input type="range" min="2" max="50" step="1" value="${Math.round(inputSystem.settings.touchDeadzone * 100)}" data-hwe-input-setting="touchDeadzone"></label><label><input type="checkbox" data-hwe-input-setting="gamepadVibration" ${inputSystem.settings.gamepadVibration ? "checked" : ""}> Rung gamepad khi thiết bị hỗ trợ</label><div class="hwe-input-bindings">${INPUT_SYSTEM.ACTION_IDS.map((actionId) => `<button type="button" data-hwe-remap-action="${escapeHtml(actionId)}"><span><strong>${escapeHtml(INPUT_SYSTEM.ACTION_METADATA[actionId].labelVi)}</strong><small>${escapeHtml(INPUT_SYSTEM.ACTION_METADATA[actionId].ariaLabel)}</small></span><kbd>${escapeHtml(inputBindingLabel(mappings[actionId]?.find((binding) => binding.device === "keyboard") || mappings[actionId]?.[0]))}</kbd></button>`).join("")}</div><p class="hwe-input-conflicts" data-hwe-input-conflicts>${conflicts.length ? `${conflicts.length} phím đang trùng; hãy remap trước khi chơi.` : "Không có phím trùng trong preset hiện tại."}</p><div class="hwe-data-actions"><button type="button" data-hwe-input-export>Xuất profile</button><button type="button" data-hwe-input-import>Nhập profile…</button><button type="button" data-hwe-input-reset>Khôi phục Standard</button></div><input type="file" accept="application/json,.json" data-hwe-input-file hidden></article>`;
  }

  function settingsMarkup(state, inputSystem) {
    const capabilities = RENDERER_3D?.detectCapabilities?.() || { recommendedBackend: "lite", webgpu: false, webgl2: false };
    const slices = RENDERER_3D?.listTimeSlices?.(state.realmId) || [];
    const modes = RENDERER_3D?.GAME_MODES || [];
    const atlasMaps = WORLD_ATLAS?.listMaps?.({ realmId: state.realmId }) || [];
    return `<section class="hwe-settings"><header class="hwe-view-hero"><div><small>3D ENGINE · PLANET ATLAS · ACCESSIBILITY · SAVE V4</small><h2>Cấu hình hành tinh và vùng dựng 16 × 16 km</h2><p>World Atlas giữ địa chỉ logic quy mô hành tinh; Babylon chỉ dựng region đang hoạt động. Save v1–v3 được migrate đúng một lần sang schema v4 và Canvas Lite luôn là fallback.</p></div><button type="button" data-hwe-reset>Khôi phục save mới…</button></header><div class="hwe-settings-grid">
      <article><small>REALM · WORLD MAP · TIME SLICE</small><h3>Luật niên đại</h3><label>Era Realm<select data-hwe-setting="realmId">${Object.values(REALMS).map((realm)=>`<option value="${realm.id}" ${state.realmId===realm.id?"selected":""}>${escapeHtml(realm.label)}</option>`).join("")}</select></label>${atlasMaps.length ? `<label>Bản đồ hành tinh<select data-hwe-atlas-map-select>${atlasMaps.map((map) => `<option value="${escapeHtml(map.id)}" ${state.atlasMapId === map.id ? "selected" : ""}>${escapeHtml(map.label)} · ${escapeHtml(map.range)}</option>`).join("")}</select></label>` : ""}${slices.length ? `<label>Lát cắt địa chất<select data-hwe-time-slice>${slices.map((slice)=>{ const playable = state.settings.convergence || playableSpeciesAtAddress(state, addressForSlice(state, slice)).length > 0; return `<option value="${escapeHtml(slice.id)}" ${slice.id===state.worldAddress?.timeSliceId?"selected":""} ${playable?"":"disabled"}>${escapeHtml(slice.label)} · ${escapeHtml(slice.range)}${playable?"":" · Observer only"}</option>`; }).join("")}</select></label>` : ""}<label><input type="checkbox" data-hwe-setting="convergence" ${state.settings.convergence ? "checked" : ""}> Cho phép Eon Convergence hư cấu</label></article>
      <article><small>GAMEPLAY</small><h3>Vòng đời và độ khó</h3><label>Chế độ<select data-hwe-mode>${modes.map((mode)=>`<option value="${escapeHtml(mode.id)}" ${state.mode===mode.id?"selected":""} ${mode.available?"":"disabled"}>${escapeHtml(mode.label)}${mode.available?"":" · lộ trình"}</option>`).join("")}</select></label><label>Độ khó<select data-hwe-setting="difficulty"><option value="sanctuary" ${state.settings.difficulty === "sanctuary" ? "selected" : ""}>Sanctuary</option><option value="balanced" ${state.settings.difficulty === "balanced" ? "selected" : ""}>Cân bằng</option><option value="wild" ${state.settings.difficulty === "wild" ? "selected" : ""}>Wild Survival</option></select></label></article>
      <article class="${state.settings.quality === "personal" ? "is-personal-quality" : ""}"><small>3D RENDERER</small><h3>${capabilities.recommendedBackend === "lite" ? "Lite Mode được khuyến nghị" : `${escapeHtml(capabilities.recommendedBackend.toUpperCase())} sẵn sàng`}</h3><label>Renderer<select data-hwe-setting="renderer"><option value="auto" ${state.settings.renderer === "auto" ? "selected":""}>Tự chọn 3D → Lite</option><option value="3d" ${state.settings.renderer === "3d" ? "selected":""}>Ưu tiên Babylon 3D</option><option value="lite" ${state.settings.renderer === "lite" ? "selected":""}>Canvas 2D Lite</option></select></label><label>Chất lượng<select data-hwe-setting="quality">${qualityProfiles().map((profile)=>`<option value="${profile.id}" ${state.settings.quality===profile.id?"selected":""}>${escapeHtml(profile.label)} · ${profile.id === "personal" ? "ưu tiên hình ảnh / không adaptive" : `${profile.targetFps} FPS mục tiêu`}</option>`).join("")}</select></label><p>WebGPU ${capabilities.webgpu?"✓":"—"} · WebGL2 ${capabilities.webgl2?"✓":"—"}. Personal là lựa chọn thủ công của chủ máy, không bao giờ được adaptive governor tự nâng lên.</p></article>
      <article><small>HIỆU NĂNG</small><h3>Motion và wildlife budget</h3><label>Chuyển động<select data-hwe-setting="motion"><option value="static" ${state.settings.motion === "static" ? "selected":""}>Tĩnh</option><option value="balanced" ${state.settings.motion === "balanced" ? "selected":""}>Cân bằng</option><option value="cinematic" ${state.settings.motion === "cinematic" ? "selected":""}>Điện ảnh</option></select></label><label>Mật độ wildlife<select data-hwe-setting="density"><option value="low" ${state.settings.density === "low" ? "selected":""}>Thấp</option><option value="balanced" ${state.settings.density === "balanced" ? "selected":""}>Cân bằng</option><option value="high" ${state.settings.density === "high" ? "selected":""}>Cao</option></select></label><label><input type="checkbox" data-hwe-setting="adaptiveQuality" ${state.settings.adaptiveQuality ? "checked":""}> Tự hạ LOD, DPR và proxy hiển thị khi frame time tăng</label></article>
      <article class="hwe-camera-settings"><small>DESKTOP CAMERA</small><h3>Camera sinh vật</h3><label>Góc nhìn<select data-hwe-setting="viewMode"><option value="third-person" ${state.settings.viewMode === "third-person" ? "selected":""}>Góc nhìn thứ ba</option><option value="animal-eye" ${state.settings.viewMode === "animal-eye" ? "selected":""}>Animal-eye</option></select></label><label>Độ nhạy ngang <output>${Math.round(state.settings.cameraSensitivityX)}%</output><input type="range" min="1" max="100" step="1" value="${state.settings.cameraSensitivityX}" data-hwe-camera-setting="cameraSensitivityX"></label><label>Độ nhạy dọc <output>${Math.round(state.settings.cameraSensitivityY)}%</output><input type="range" min="1" max="100" step="1" value="${state.settings.cameraSensitivityY}" data-hwe-camera-setting="cameraSensitivityY"></label><label>FOV <output>${Math.round(state.settings.cameraFov)}°</output><input type="range" min="45" max="105" step="1" value="${state.settings.cameraFov}" data-hwe-camera-setting="cameraFov"></label><label>Độ mượt <output>${Math.round(state.settings.cameraSmoothing)}%</output><input type="range" min="0" max="100" step="1" value="${state.settings.cameraSmoothing}" data-hwe-camera-setting="cameraSmoothing"></label><label>Rung camera <output>${Math.round(state.settings.cameraShake)}%</output><input type="range" min="0" max="100" step="1" value="${state.settings.cameraShake}" data-hwe-camera-setting="cameraShake"></label><label><input type="checkbox" data-hwe-setting="invertCameraY" ${state.settings.invertCameraY ? "checked":""}> Đảo trục Y</label><label><input type="checkbox" data-hwe-setting="autoCenterCamera" ${state.settings.autoCenterCamera ? "checked":""}> Tự căn camera khi di chuyển</label><p>Pointer Lock chỉ bật sau thao tác click hợp lệ; Escape làm mất khóa chuột và mở Pause.</p></article>
      <article><small>SIMULATION</small><h3>Worker có fallback</h3><label><input type="checkbox" data-hwe-setting="worker" ${state.settings.worker ? "checked":""}> Dùng worker cho tác vụ tương thích</label><p>AI fixed-step vẫn giữ toàn bộ quần thể khi renderer hạ LOD. Far ring chỉ đổi cách biểu diễn, không xóa ecology.</p></article>
      <article><small>ÂM THANH · TRỢ NĂNG</small><h3>Tín hiệu rõ ràng</h3><label><input type="checkbox" data-hwe-setting="sound" ${state.settings.sound ? "checked":""}> Âm thanh tương tác và ambience đã xác minh</label><label>Âm lượng tín hiệu <output>${Math.round(state.settings.soundVolume)}%</output><input type="range" min="0" max="100" step="1" data-hwe-setting="soundVolume" value="${Math.round(state.settings.soundVolume)}"></label><label><input type="checkbox" data-hwe-setting="photoUi" ${state.settings.photoUi ? "checked":""}> Hiện nhãn trong Photo Mode</label><p>Bàn phím, touch, gamepad, focus rõ và prefers-reduced-motion được giữ ở cả 3D lẫn Lite. Cinematic Audio Pack chỉ phát asset đã đúng SHA-256, dừng cùng renderer và không tự nhận là production.</p></article>
      ${inputSettingsMarkup(inputSystem)}
      <article><small>WORLD SEED · FLOATING ORIGIN</small><h3>Địa chỉ tái tạo được</h3><label>Seed<input type="text" maxlength="24" data-hwe-setting="seed" value="${escapeHtml(state.settings.seed)}"></label><p>${escapeHtml(state.atlasMapId || "atlas")} › ${escapeHtml(state.atlasRegionId || "region")} › sector ${state.planetAddress?.sectorX || 0}:${state.planetAddress?.sectorZ || 0}</p><p>${escapeHtml(state.worldAddress?.realmId || state.realmId)} › ${escapeHtml(state.worldAddress?.timeSliceId || "realm")} › active chunk ${state.worldAddress?.chunkX || 0}:${state.worldAddress?.chunkZ || 0}</p></article>
      <article><small>DỮ LIỆU CỤC BỘ</small><h3>Schema ${SCHEMA_VERSION}</h3><p>${state.replay.length}/240 replay · ${state.heatmap.length}/256 heatmap · ${state.lineage.length}/24 thế hệ · ${state.eventJournal.length}/40 sự kiện.</p><div class="hwe-data-actions"><button type="button" data-hwe-save-export>Xuất save JSON</button><button type="button" data-hwe-save-import>Nhập save…</button><button type="button" data-hwe-save-rollback>Khôi phục bản trước</button><button type="button" data-hwe-lineage-export>Xuất lineage</button></div><input type="file" accept="application/json,.json" data-hwe-save-file hidden></article>
    </div>${cinematicPackMarkup()}</section>`;
  }

  function viewMarkup(view, state, instance) {
    if (view === "species") return codexMarkup(state);
    if (view === "ecosystem") return ecosystemMarkup(state);
    if (view === "timeline") return timelineMarkup(state);
    if (view === "expeditions") return expeditionsMarkup(state);
    if (view === "lineage") return lineageMarkup(state);
    if (view === "observer") return observerMarkup(state);
    if (view === "network") return networkMarkup();
    if (view === "settings") return settingsMarkup(state, instance?.inputSystem);
    return worldMarkup(state);
  }

  function shellMarkup(instance) {
    const view = instance.view;
  const atlasMap = WORLD_ATLAS?.getMap?.(instance.state.atlasMapId);
  return `<section class="hwe-root" data-hwe-root data-view="${view}" data-realm="${instance.state.realmId}" data-motion="${instance.state.settings.motion}" data-quality="${instance.state.settings.quality}" data-renderer="lite" aria-label="HH EonWild"><header class="hwe-header"><div class="hwe-brand"><span aria-hidden="true"><i></i><b>EW</b></span><div><small>HH GAME · LIVING EARTH 4.2 · ORIGINAL</small><h1>HH EonWild</h1><p>${escapeHtml(atlasMap?.label || REALMS[instance.state.realmId]?.label || "Trái Đất Muôn Thời")} · Planet Atlas / vùng dựng 16 × 16 km · Không có con người</p></div></div><div class="hwe-header-status"><span><i></i> Local single-player</span><span>${CONTENT?.FLAGSHIP_IDS?.length || 13} Flagship · ${Object.keys(RENDERER_3D?.SPECIES_CARTRIDGES || {}).length} Species Cartridge · ${MERGED_SPECIES_COUNT} catalog không trùng</span><button type="button" data-hwe-quick-play>Chơi tiếp →</button></div></header>${navMarkup(view)}<main class="hwe-main" data-hwe-main>${viewMarkup(view, instance.state, instance)}</main><footer class="hwe-controls"><span><kbd>WASD</kbd> Di chuyển</span><span><kbd>Shift</kbd> Chạy</span><span><kbd>F</kbd> Ăn/Uống</span><span><kbd>Q</kbd> Giác quan</span><span><kbd>R</kbd> Ability</span><span><kbd>C</kbd> Giao tiếp</span><span><kbd>M</kbd> Atlas</span><span><kbd>P</kbd> Photo</span><b data-hwe-fps>Engine nghỉ</b></footer><div class="hwe-toast" data-hwe-toast role="status" aria-live="polite"></div></section>`;
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
    const volume = clamp(instance.state.settings.soundVolume, 0, 100) / 100;
    if (volume <= 0) return false;
    const AudioEngine = global.AudioContext || global.webkitAudioContext;
    if (typeof AudioEngine !== "function") return false;
    try {
      const context = instance.audioContext || new AudioEngine();
      instance.audioContext = context;
      context.resume?.();
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const now = context.currentTime;
      const speciesId = instance.state.speciesId;
      const base = ({ tyrannosaurus: 72, triceratops: 108, argentavis: 420, orca: 620, "giant-octopus": 190, spinosaurus: 92, mammuthus: 58, wolf: 260, honeybee: 780, "electric-eel": 330, ankylosaurus: 86, "blue-whale": 48, pteranodon: 460 })[speciesId] || 240;
      oscillator.type = ["honeybee", "electric-eel"].includes(speciesId) ? "sawtooth" : type === "complete" || ["orca", "blue-whale"].includes(speciesId) ? "sine" : "triangle";
      oscillator.frequency.setValueAtTime(type === "complete" ? Math.max(220, base) : base, now);
      oscillator.frequency.exponentialRampToValueAtTime(type === "complete" ? Math.max(440, base * 1.45) : Math.max(55, base * 1.35), now + .16);
      gain.gain.setValueAtTime(.0001, now);
      gain.gain.exponentialRampToValueAtTime(Math.max(.0001, .045 * volume), now + .02);
      gain.gain.exponentialRampToValueAtTime(.0001, now + .2);
      oscillator.connect(gain); gain.connect(context.destination); oscillator.start(now); oscillator.stop(now + .22);
      return true;
    } catch { return false; }
  }

  function updateCodexDetail(instance, species) {
    const panel = instance.root.querySelector("[data-hwe-codex-detail]");
    if (!panel || !species) return;
    panel.innerHTML = codexDetailMarkup(species, instance.state);
  }

  function filterSpecies(instance) {
    const query = String(instance.root.querySelector("[data-hwe-species-search]")?.value || "").toLowerCase().trim();
    const activeEra = instance.eraFilter || "all";
    const realmFilter = instance.realmFilter || "all";
    const tierFilter = instance.tierFilter || "all";
    instance.root.querySelectorAll("[data-hwe-species]").forEach((card) => {
      card.hidden = Boolean((query && !card.dataset.search.includes(query)) || (activeEra !== "all" && card.dataset.era !== activeEra) || (realmFilter !== "all" && card.dataset.realm !== realmFilter) || (tierFilter !== "all" && card.dataset.tier !== tierFilter));
    });
  }

  function updatePlanetSpeciesDetail(instance, species) {
    const panel = instance.root.querySelector("[data-hwe-planet-detail]");
    if (!panel || !species) return false;
    panel.innerHTML = planetSpeciesDetailMarkup(species);
    instance.root.querySelectorAll("[data-hwe-planet-species]").forEach((card) => card.setAttribute("aria-pressed", String(card.dataset.hwePlanetSpecies === species.id)));
    return true;
  }

  function filterPlanetRegistry(instance) {
    const query = String(instance.root.querySelector("[data-hwe-planet-search]")?.value || "").toLocaleLowerCase("vi").trim().slice(0, 120);
    const group = instance.planetGroupFilter || "all";
    let visible = 0;
    instance.root.querySelectorAll("[data-hwe-planet-card]").forEach((card) => {
      const hidden = Boolean((group !== "all" && card.dataset.group !== group) || (query && !String(card.dataset.search || "").includes(query)));
      card.hidden = hidden;
      if (!hidden) visible += 1;
    });
    const grid = instance.root.querySelector("[data-hwe-planet-grid]");
    if (grid) grid.dataset.visibleCount = String(visible);
    return visible;
  }

  function createPopulation(instance) {
    const random = seededRandom(instance.world.seed ^ 0x9e3779b9);
    const base = instance.state.settings.density === "high" ? 54 : instance.state.settings.density === "low" ? 24 : 38;
    const mobile = global.matchMedia?.("(max-width: 760px)")?.matches;
    const count = mobile ? Math.min(26, base) : base;
    const allowed = SPECIES.filter((species) => tierForSpecies(species) !== "codex" && speciesAllowedAtAddress(species, instance.state));
    const selected = SPECIES_BY_ID.get(instance.state.speciesId);
    const registry = allowed.length ? allowed : (selected && speciesAllowedAtAddress(selected, instance.state) ? [selected] : []);
    if (!registry.length) return [];
    return Array.from({ length: count }, (_, index) => {
      const species = registry[Math.floor(random() * registry.length)];
      let x = 100 + random() * (WORLD_SIZE - 200); let y = 100 + random() * (WORLD_SIZE - 200);
      if (Math.hypot(x - instance.state.player.x, y - instance.state.player.y) < 420) { x = clamp(x + 620, 80, WORLD_SIZE - 80); y = clamp(y + 410, 80, WORLD_SIZE - 80); }
      return { id: `wild-${index}`, species, x, y, vx: (random() - .5) * 20, vy: (random() - .5) * 20, health: 100, phase: random() * Math.PI * 2, action: "rest", alive: true };
    });
  }

  function initSimulationKernel(instance) {
    instance.engineMode = "Local bounded AI";
    instance.world.loadedChunks = [];
    if (typeof SIMULATION?.createSimulation !== "function") return false;
    try {
      instance.simulation = SIMULATION.createSimulation({
        seed: worldSeedForState(instance.state),
        realm: instance.state.settings.convergence ? "convergence" : instance.state.realmId,
        viewRadius: global.matchMedia?.("(max-width: 760px)")?.matches ? 1 : 2,
        maxChunks: 49,
        maxEntities: Math.min(96, instance.population.length + 12),
        apexCap: 3,
        trails: { maxFootprints: 420, maxScents: 420, footprintHalfLife: 26, scentHalfLife: 16 }
      });
      instance.workerAdapter = instance.simulation.createWorkerAdapter?.({ forceLocal: !instance.state.settings.worker }) || SIMULATION.createWorkerAdapter?.({ forceLocal: !instance.state.settings.worker });
      instance.engineMode = instance.workerAdapter?.mode === "worker" ? "Worker assist · fixed-step" : "Local fixed-step fallback";
      const accepted = [];
      instance.population.forEach((creature) => {
        const registered = instance.simulation.addEntity({
          id: creature.id,
          speciesId: creature.species.id,
          name: creature.species.name,
          diet: creature.species.diet,
          realm: instance.state.realmId,
          biomes: [creature.species.habitat, terrainForRealm(terrainAt(creature.x, creature.y, instance.world.seed), instance.state.realmId, creature.x, creature.y)].filter((value) => Object.hasOwn(BIOMES, value)),
          mass: creature.species.mass,
          speed: Math.max(.5, creature.species.speed),
          apex: ["tyrannosaurus", "spinosaurus", "orca"].includes(creature.species.id),
          x: creature.x,
          y: creature.y,
          health: creature.health,
          hunger: 55,
          thirst: 58,
          stamina: 80,
          sex: hashSeed(creature.id) % 2 ? "female" : "male",
          maturity: .78 + (hashSeed(`${creature.id}:maturity`) % 22) / 100,
          nest: hashSeed(`${creature.id}:nest`) % 5 === 0 ? { x: creature.x, y: creature.y } : null
        });
        if (registered) accepted.push(Object.assign(creature, registered));
      });
      instance.population = accepted;
      instance.world.loadedChunks = instance.simulation.streamChunks({ x: instance.state.player.x, y: instance.state.player.y, world: true });
      instance.workerAdapter?.run?.("ping", { realm: instance.state.realmId }).catch?.(() => { instance.engineMode = "Local fixed-step fallback"; });
      return true;
    } catch {
      instance.simulation?.dispose?.();
      instance.workerAdapter?.close?.();
      instance.simulation = null;
      instance.workerAdapter = null;
      instance.engineMode = "Local bounded AI";
      return false;
    }
  }

  function triggerWorldEvent(instance, requestedType) {
    if (!instance.simulation?.hazards) return null;
    const types = instance.state.realmId === "paleozoic" ? ["flood", "volcano"] : instance.state.realmId === "ice-age" ? ["flood"] : instance.state.realmId === "modern" ? ["flood", "wildfire"] : ["flood", "wildfire", "volcano"];
    const type = types.includes(requestedType) ? requestedType : types[instance.world.eventSequence % types.length];
    instance.world.eventSequence += 1;
    const labels = { flood: "Lũ theo mùa", wildfire: "Cháy rừng tự nhiên", volcano: "Tro núi lửa" };
    const event = instance.simulation.hazards.trigger(type, {
      x: clamp(instance.state.player.x + ((instance.world.eventSequence % 2 ? 1 : -1) * 180), 0, WORLD_SIZE),
      y: clamp(instance.state.player.y + ((instance.world.eventSequence % 3 - 1) * 140), 0, WORLD_SIZE),
      radius: type === "volcano" ? 330 : 240,
      intensity: .62 + (instance.world.eventSequence % 3) * .08,
      duration: 24
    });
    if (!event) return null;
    const label = labels[type] || "Biến động tự nhiên";
    instance.world.event = { id: event.id, type, label, intensity: event.intensity, remaining: event.remaining };
    instance.state.eventJournal = [...instance.state.eventJournal, { id: type, label, at: Date.now() }].slice(-40);
    saveState(instance);
    logSignal(instance, `${label}: dấu vết, đường di cư và Utility AI đã thay đổi.`);
    setToast(instance, `⚠ ${label}`);
    return event;
  }

  function syncSimulation(instance, seconds) {
    if (!instance.simulation) return false;
    const advance = instance.simulation.tick(seconds);
    instance.chunkClock += seconds;
    if (instance.chunkClock >= .5) {
      instance.chunkClock = 0;
      instance.world.loadedChunks = instance.simulation.streamChunks({ x: instance.state.player.x, y: instance.state.player.y, world: true });
      const renderedChunk = RENDERER_3D?.worldToChunk?.(instance.state.player.x, instance.state.player.y);
      if (renderedChunk && RENDERER_3D?.createWorldAddress &&
          (renderedChunk.x !== instance.state.worldAddress?.chunkX || renderedChunk.z !== instance.state.worldAddress?.chunkZ)) {
        instance.state.worldAddress = RENDERER_3D.createWorldAddress({
          ...instance.state.worldAddress,
          realmId: instance.state.realmId,
          seed: worldSeedForState(instance.state),
          chunkX: renderedChunk.x,
          chunkZ: renderedChunk.z
        });
      }
    }
    if (!advance.steps) return true;
    const entities = new Map(instance.simulation.getEntities().map((entity) => [entity.id, entity]));
    instance.population.forEach((creature) => {
      const entity = entities.get(creature.id);
      if (!entity) { creature.alive = false; return; }
      creature.vx = (entity.x - creature.x) / Math.max(seconds, .001);
      creature.vy = (entity.y - creature.y) / Math.max(seconds, .001);
      creature.x = entity.x;
      creature.y = entity.y;
      creature.health = entity.health;
      creature.action = entity.action;
      creature.alive = entity.alive !== false;
    });
    const knownPopulation = new Set(instance.population.map((creature) => creature.id));
    entities.forEach((entity) => {
      if (knownPopulation.has(entity.id) || instance.population.length >= 96) return;
      const species = SPECIES_BY_ID.get(entity.speciesId);
      if (!species || !speciesAllowedAtAddress(species, instance.state)) return;
      instance.population.push({ id: entity.id, species, x: entity.x, y: entity.y, vx: 0, vy: 0, health: entity.health, phase: 0, action: entity.action, alive: entity.alive !== false });
    });
    const active = instance.simulation.hazards.activeEvents();
    const current = active[0];
    if (current) instance.world.event = { id: current.id, type: current.type, label: ({ flood: "Lũ theo mùa", wildfire: "Cháy rừng tự nhiên", volcano: "Tro núi lửa" })[current.type] || current.type, intensity: current.intensity, remaining: current.remaining };
    else instance.world.event = { id: "calm", type: "calm", label: "Sinh quyển ổn định", intensity: 0, remaining: 0 };
    instance.world.tide = instance.simulation.hazards.getTide().level;
    return true;
  }

  function resizeCanvas(instance) {
    const canvas = instance.canvas;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const defaultCap = global.matchMedia?.("(max-width: 760px)")?.matches ? 1.2 : 1.6;
    const dpr = Math.min(global.devicePixelRatio || 1, instance.dprCap || defaultCap);
    const width = Math.max(320, Math.floor(rect.width * dpr));
    const height = Math.max(240, Math.floor(rect.height * dpr));
    if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height; }
    instance.dpr = dpr;
    if (instance.renderer3d && instance.canvas3d && !instance.canvas3d.hidden) {
      const viewportWidth = Math.max(1, Math.round(instance.canvas3d.clientWidth));
      const viewportHeight = Math.max(1, Math.round(instance.canvas3d.clientHeight));
      const previous = instance.rendererViewportSize;
      if (!previous || previous.width !== viewportWidth || previous.height !== viewportHeight) {
        instance.rendererViewportSize = { width: viewportWidth, height: viewportHeight };
        instance.renderer3d.resize?.();
      }
    }
  }

  function habitatPenalty(species, terrain) {
    if (species.locomotion === "fly") return 1;
    const water = ["ocean", "reef"].includes(terrain);
    if (species.habitat === "water") return water ? 1 : .18;
    if (species.locomotion === "amphibious") return 1;
    return water ? .15 : 1;
  }

  function findHabitatSpawn(species, worldSeed, realmId) {
    const fallback = { x: WORLD_SIZE * .48, y: WORLD_SIZE * .48 };
    if (!species || species.locomotion === "fly" || species.locomotion === "amphibious") return fallback;
    const random = seededRandom(hashSeed(`${worldSeed}:${realmId}:${species.id}:spawn`));
    for (let index = 0; index < 320; index += 1) {
      const x = 96 + random() * (WORLD_SIZE - 192); const y = 96 + random() * (WORLD_SIZE - 192);
      const terrain = terrainForRealm(terrainAt(x, y, worldSeed), realmId, x, y);
      if (habitatPenalty(species, terrain) >= .9) return { x, y };
    }
    return fallback;
  }

  function placePlayerAtHabitat(instance) {
    const species = SPECIES_BY_ID.get(instance.state.speciesId);
    if (!species || !instance.world) return false;
    const point = findHabitatSpawn(species, instance.world.seed, instance.state.realmId);
    instance.state.player.x = point.x; instance.state.player.y = point.y; instance.state.player.spawnPending = false;
    return true;
  }

  function gamepadInput(instance) {
    const pad = global.navigator?.getGamepads?.()?.find(Boolean);
    if (!pad) return { x: 0, y: 0, sprint: false };
    return { x: Math.abs(pad.axes?.[0] || 0) > .18 ? pad.axes?.[0] : 0, y: Math.abs(pad.axes?.[1] || 0) > .18 ? pad.axes?.[1] : 0, sprint: Boolean(pad.buttons?.[0]?.pressed || pad.buttons?.[7]?.pressed) };
  }

  function cameraProfileIdForSpecies(species) {
    if (!species) return "ground";
    if (species.locomotion === "fly") return "bird";
    if (species.locomotion === "swim") return "aquatic";
    if (species.locomotion === "climb") return "climbing";
    if (species.locomotion === "crawl" && species.mass < 5) return "burrow";
    if (species.mass >= 3000) return "heavy";
    if (species.mass < 8) return "small";
    return "ground";
  }

  function desktopCameraProfile(instance) {
    const species = SPECIES_BY_ID.get(instance.state.speciesId);
    const id = cameraProfileIdForSpecies(species);
    const base = DESKTOP?.getCameraProfile?.(id) || { id, distance: 6, minDistance: 1, maxDistance: 16, minPitch: -1.1, maxPitch: .7, fov: 68, height: 1.5, sensitivityX: .0024, sensitivityY: .0024, zoomSpeed: .0045, acceleration: 10, deceleration: 16, turnRate: 2.6, sprintMultiplier: 1.55 };
    const sensitivity = (value, fallback) => Number.isFinite(Number(value)) ? .00045 + clamp(value, 1, 100) / 100 * .0042 : fallback;
    return DESKTOP?.getCameraProfile?.({
      ...base,
      sensitivityX: sensitivity(instance.state.settings.cameraSensitivityX, base.sensitivityX),
      sensitivityY: sensitivity(instance.state.settings.cameraSensitivityY, base.sensitivityY),
      invertY: instance.state.settings.invertCameraY,
      fov: instance.state.settings.cameraFov
    }) || base;
  }

  function initializeDesktopGameplay(instance, reset = false) {
    if (!DESKTOP) return false;
    const player = instance.state.player;
    const profile = desktopCameraProfile(instance);
    if (!instance.camera || reset) {
      instance.camera = {
        profileId: profile.id,
        yaw: instance.heading || 0,
        pitch: -.18,
        targetYaw: instance.heading || 0,
        targetPitch: -.18,
        desiredDistance: instance.state.settings.viewMode === "animal-eye" ? profile.minDistance : profile.distance,
        distance: instance.state.settings.viewMode === "animal-eye" ? profile.minDistance : profile.distance,
        fov: instance.state.settings.cameraFov,
        firstPerson: instance.state.settings.viewMode === "animal-eye"
      };
    }
    if (!instance.desktopController || reset) {
      const species = SPECIES_BY_ID.get(instance.state.speciesId);
      const speed = Math.min(100, 30 + Math.min(80, (species?.speed || 10) * 2.2));
      instance.desktopController = new DESKTOP.FixedTimestepController({
        stepSeconds: 1 / 120,
        maxFrameSeconds: .2,
        maxSubSteps: 24,
        profile: profile.id,
        maxSpeed: speed,
        sprintMultiplier: 1.7,
        acceleration: profile.acceleration,
        deceleration: profile.deceleration,
        turnRate: profile.turnRate,
        initialState: { x: player.x, z: player.y, heading: instance.heading || 0 }
      });
    }
    return true;
  }

  function gameplayStateName(instance) {
    return String(instance.gameplayMachine?.status || (instance.running ? "PLAYING" : "READY")).toLowerCase().replace("_mode", "");
  }

  function transitionGameplay(instance, event) {
    if (!DESKTOP?.reduceGameplayState) return instance.gameplayMachine;
    instance.gameplayMachine = DESKTOP.reduceGameplayState(instance.gameplayMachine, event);
    if (instance.root) instance.root.dataset.gameplayState = gameplayStateName(instance);
    return instance.gameplayMachine;
  }

  function isGameplayActive(instance) {
    if (!instance.running || instance.dead || gameplayStateName(instance) !== "playing") return false;
    const surface = activeSurface(instance);
    const coarsePointer = typeof global.matchMedia === "function"
      ? Boolean(global.matchMedia("(pointer: coarse)").matches)
      : (global.navigator?.maxTouchPoints || 0) > 0;
    const pointerLockSupported = typeof surface?.requestPointerLock === "function";
    return Boolean(coarsePointer || !pointerLockSupported || global.document?.pointerLockElement === surface);
  }

  function isGameplayStatePlaying(instance) {
    return Boolean(instance?.running && !instance.dead && gameplayStateName(instance) === "playing");
  }

  function releasePointerLock(instance, deliberate = true) {
    const documentRef = global.document;
    if (!documentRef) return false;
    if (deliberate && DESKTOP?.reducePointerLock) instance.pointerLockState = DESKTOP.reducePointerLock(instance.pointerLockState, { type: "RELEASE" });
    if (documentRef.pointerLockElement && typeof documentRef.exitPointerLock === "function") {
      try { documentRef.exitPointerLock(); return true; } catch {}
    }
    return false;
  }

  function requestGameplayPointerLock(instance) {
    const surface = activeSurface(instance);
    if (!surface || !isGameplayStatePlaying(instance)) return Promise.resolve(false);
    focusSurface(instance);
    const coarsePointer = typeof global.matchMedia === "function"
      ? Boolean(global.matchMedia("(pointer: coarse)").matches)
      : (global.navigator?.maxTouchPoints || 0) > 0;
    if (coarsePointer || typeof surface.requestPointerLock !== "function") return Promise.resolve(true);
    if (global.document?.pointerLockElement === surface) return Promise.resolve(true);
    if (DESKTOP?.reducePointerLock) instance.pointerLockState = DESKTOP.reducePointerLock(instance.pointerLockState, { type: "REQUEST" });
    const rejected = (error) => {
      if (DESKTOP?.reducePointerLock) instance.pointerLockState = DESKTOP.reducePointerLock(instance.pointerLockState, { type: "ERROR", error: error?.message || "REQUEST_REJECTED" });
      pauseGame(instance, "pointer-error", false);
      setToast(instance, "Trình duyệt chưa cấp khóa chuột. Bấm Tiếp tục để thử lại.");
      return false;
    };
    try {
      const result = surface.requestPointerLock({ unadjustedMovement: true });
      return Promise.resolve(result).then(() => true).catch(() => {
        try { return Promise.resolve(surface.requestPointerLock()).then(() => true); }
        catch (error) { throw error; }
      }).catch(rejected);
    } catch {
      try { return Promise.resolve(surface.requestPointerLock()).then(() => true).catch(rejected); }
      catch (error) { return Promise.resolve(rejected(error)); }
    }
  }

  function pauseGame(instance, reason = "manual", releaseLock = true) {
    if (!instance?.running || instance.dead) return false;
    if (gameplayStateName(instance) === "playing") transitionGameplay(instance, { type: "PAUSE" });
    instance.paused = true;
    instance.root.classList.add("is-paused");
    instance.root.querySelector("[data-hwe-pause-overlay]")?.removeAttribute("hidden");
    instance.root.querySelector("[data-hwe-game-overlay]")?.setAttribute("hidden", "");
    instance.inputSystem?.pause?.("gameplay-state");
    instance.renderer3d?.setPaused?.(true);
    if (releaseLock) releasePointerLock(instance, true);
    instance.root.querySelector("[data-hwe-resume]")?.focus?.({ preventScroll: true });
    return true;
  }

  function resumeGame(instance) {
    if (!instance?.running || instance.dead) return false;
    if (gameplayStateName(instance) !== "paused") return false;
    transitionGameplay(instance, { type: "RESUME" });
    instance.paused = false;
    instance.root.classList.remove("is-paused");
    instance.root.querySelector("[data-hwe-pause-overlay]")?.setAttribute("hidden", "");
    instance.root.querySelector("[data-hwe-game-overlay]")?.setAttribute("hidden", "");
    instance.inputSystem?.resume?.("gameplay-state");
    instance.renderer3d?.setPaused?.(false);
    instance.lastFrame = global.performance?.now?.() || Date.now();
    requestGameplayPointerLock(instance);
    return true;
  }

  function setImmersiveShell(instance, active) {
    const body = global.document?.body;
    const mobileNavigation = global.document?.querySelector?.(".app-mobile-nav");
    if (active) {
      if (mobileNavigation && !instance.mobileNavigationDisplay) {
        instance.mobileNavigationDisplay = {
          value: mobileNavigation.style.getPropertyValue("display"),
          priority: mobileNavigation.style.getPropertyPriority("display")
        };
      }
      // App Shell pins this dock with an inline `!important` rule on phones.
      // Remove it while CSS owns the immersive viewport, then restore it on exit.
      mobileNavigation?.style?.removeProperty?.("display");
      body?.classList?.add("app-eonwild-immersive");
      return true;
    }
    body?.classList?.remove("app-eonwild-immersive");
    const previous = instance?.mobileNavigationDisplay;
    if (mobileNavigation && previous) {
      if (previous.value) mobileNavigation.style.setProperty("display", previous.value, previous.priority || "");
      else mobileNavigation.style.removeProperty("display");
    }
    if (instance) instance.mobileNavigationDisplay = null;
    return false;
  }

  function exitImmersive(instance) {
    if (!instance) return false;
    transitionGameplay(instance, { type: "EXIT" });
    releasePointerLock(instance, true);
    if (instance.ownsFullscreen && global.document?.fullscreenElement === instance.root) global.document.exitFullscreen?.().catch?.(() => {});
    instance.ownsFullscreen = false;
    instance.running = false;
    instance.paused = false;
    instance.inputSystem?.pause?.("gameplay-state");
    instance.renderer3d?.setPaused?.(true);
    instance.root.classList.remove("is-playing", "is-running", "is-paused");
    instance.root.dataset.gameplayState = "ready";
    setImmersiveShell(instance, false);
    instance.root.querySelector("[data-hwe-pause-overlay]")?.setAttribute("hidden", "");
    instance.root.querySelector("[data-hwe-game-overlay]")?.setAttribute("hidden", "");
    const startPanel = instance.root.querySelector("[data-hwe-start-panel]");
    if (startPanel) startPanel.hidden = false;
    const start = instance.root.querySelector("[data-hwe-start]");
    start?.focus?.({ preventScroll: true });
    return true;
  }

  function toggleGameplayFullscreen(instance) {
    const documentRef = global.document;
    if (!documentRef || !instance?.root) return Promise.resolve(false);
    if (documentRef.fullscreenElement === instance.root) {
      instance.ownsFullscreen = false;
      return Promise.resolve(documentRef.exitFullscreen?.()).then(() => true).catch(() => false);
    }
    if (typeof instance.root.requestFullscreen !== "function") {
      setToast(instance, "Thiết bị này chưa hỗ trợ Fullscreen API.");
      return Promise.resolve(false);
    }
    return Promise.resolve(instance.root.requestFullscreen()).then(() => {
      instance.ownsFullscreen = true;
      resizeCanvas(instance);
      return true;
    }).catch(() => {
      setToast(instance, "Trình duyệt chưa cho phép toàn màn hình.");
      return false;
    });
  }

  function applyLookDelta(instance, movementX, movementY) {
    if (!DESKTOP?.applyMouseLook || !instance.camera || !isGameplayActive(instance)) return false;
    const profile = desktopCameraProfile(instance);
    const next = DESKTOP.applyMouseLook({ yaw: instance.camera.targetYaw, pitch: instance.camera.targetPitch }, { movementX, movementY }, {
      profile,
      sensitivityX: profile.sensitivityX,
      sensitivityY: profile.sensitivityY,
      invertY: instance.state.settings.invertCameraY,
      minPitch: profile.minPitch,
      maxPitch: profile.maxPitch
    });
    instance.camera.targetYaw = next.yaw;
    instance.camera.targetPitch = next.pitch;
    return true;
  }

  function updateGameplayCamera(instance, seconds) {
    if (!instance.camera || !DESKTOP) return;
    const profile = desktopCameraProfile(instance);
    const pad = instance.inputSystem?.activeGamepad;
    if (isGameplayActive(instance) && pad?.axes) {
      const deadzone = instance.inputSystem.settings?.gamepadDeadzone || .18;
      const x = Math.abs(Number(pad.axes[2]) || 0) > deadzone ? Number(pad.axes[2]) || 0 : 0;
      const y = Math.abs(Number(pad.axes[3]) || 0) > deadzone ? Number(pad.axes[3]) || 0 : 0;
      if (x || y) applyLookDelta(instance, x * 720 * seconds, y * 720 * seconds);
    }
    const reduced = global.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches || instance.state.settings.motion === "static";
    const smoothing = reduced ? 1 : clamp(instance.state.settings.cameraSmoothing, 0, 100) / 100;
    const amount = smoothing <= .01 ? 1 : 1 - Math.exp(-seconds * (4 + (1 - smoothing) * 20));
    const yawDelta = DESKTOP.shortestAngleDelta(instance.camera.yaw, instance.camera.targetYaw);
    instance.camera.yaw = DESKTOP.wrapAngle(instance.camera.yaw + yawDelta * amount);
    instance.camera.pitch += (instance.camera.targetPitch - instance.camera.pitch) * amount;
    instance.camera.profileId = profile.id;
    instance.camera.fov = instance.state.settings.cameraFov;
    instance.camera.firstPerson = instance.state.settings.viewMode === "animal-eye";
    if (instance.camera.firstPerson) instance.camera.desiredDistance = profile.minDistance;
    const collision = instance.renderer3d?.resolveCameraCollision?.({
      target: { x: instance.state.player.x, z: instance.state.player.y },
      yaw: instance.camera.yaw,
      pitch: instance.camera.pitch,
      desiredDistance: instance.camera.desiredDistance,
      padding: profile.collisionPadding
    });
    const collidedDistance = Number(collision?.distance ?? collision);
    const targetDistance = Number.isFinite(collidedDistance)
      ? DESKTOP.resolveCameraCollisionDistance(instance.camera.desiredDistance, collidedDistance, { profile })
      : instance.camera.desiredDistance;
    const distanceRate = targetDistance < instance.camera.distance ? 24 : 6;
    instance.camera.distance += (targetDistance - instance.camera.distance) * (1 - Math.exp(-seconds * distanceRate));
    instance.renderer3d?.applyCameraInput?.({
      yaw: instance.camera.yaw,
      pitch: instance.camera.pitch,
      distance: instance.camera.distance,
      desiredDistance: instance.camera.desiredDistance,
      profileId: profile.id,
      fov: instance.camera.fov,
      firstPerson: instance.camera.firstPerson,
      // The route controller already performs FPS-independent smoothing; the
      // renderer consumes that authoritative result without a second lag layer.
      smoothing: 0,
      shake: instance.state.settings.cameraShake / 100
    });
  }

  function processInputActions(instance, now = performance.now()) {
    const input = instance.inputSystem;
    if (!input || input.disposed) return false;
    const discardGameplayBuffer = () => {
      ["interact", "sense", "ability", "jump", "toggleView", "lockTarget", "communicationWheel"].forEach((actionId) => {
        while (input.wasPressed?.(actionId, now)) { /* discard actions queued while gameplay is paused */ }
      });
    };
    // Pause is evaluated before every other action. Returning immediately also
    // prevents a key buffered in the same frame from mutating gameplay while
    // the pause state changes.
    if (input.wasPressed?.("pause", now)) {
      discardGameplayBuffer();
      if (instance.photoMode) setPhotoMode(instance, false);
      else if (instance.root.querySelector("[data-hwe-game-overlay]")?.hidden === false) closeGameOverlay(instance);
      else if (instance.root.querySelector("[data-hwe-communication-wheel]")?.hidden === false) setCommunicationWheel(instance, false);
      else pauseGame(instance, "keyboard");
      return true;
    }
    if (input.wasPressed?.("worldMap", now)) { if (instance.running) openGameOverlay(instance, "map"); else global.location.hash = "#/game/timeline"; return true; }
    if (input.wasPressed?.("codex", now)) { if (instance.running) openGameOverlay(instance, "codex"); else global.location.hash = "#/game/species"; return true; }
    if (input.wasPressed?.("photoMode", now)) setPhotoMode(instance, !instance.photoMode);
    if (instance.paused || !isGameplayActive(instance)) { discardGameplayBuffer(); return true; }
    if (input.wasPressed?.("communicationWheel", now)) setCommunicationWheel(instance, instance.root.querySelector("[data-hwe-communication-wheel]")?.hidden !== false);
    if (input.wasPressed?.("toggleView", now)) toggleViewMode(instance);
    if (input.wasPressed?.("lockTarget", now)) toggleTargetLock(instance);
    if (input.wasPressed?.("interact", now)) interact(instance);
    if (input.wasPressed?.("sense", now)) sense(instance);
    if (input.wasPressed?.("ability", now)) useFlagshipAbility(instance);
    if (input.wasPressed?.("jump", now)) defend(instance);
    return true;
  }

  function injurePlayer(instance, type, severity = .2) {
    const player = instance.state.player;
    const proxy = {
      health: player.health,
      condition: {
        bleeding: player.injuries.bleeding,
        fractures: player.injuries.fracture,
        infection: player.injuries.infection,
        disease: player.injuries.disease,
        oxygen: player.oxygen / 100,
        nutritionQuality: player.dietQuality / 100
      }
    };
    if (typeof SIMULATION?.applyInjury === "function") SIMULATION.applyInjury(proxy, { type, severity });
    else if (String(type).includes("fract")) proxy.condition.fractures = clamp(proxy.condition.fractures + severity * 100, 0, 100);
    else proxy.condition.bleeding = clamp(proxy.condition.bleeding + severity * 100, 0, 100);
    player.health = clamp(proxy.health, 0, 100);
    player.injuries = normalizeInjuries({
      bleeding: proxy.condition.bleeding,
      fracture: proxy.condition.fractures,
      infection: proxy.condition.infection,
      disease: proxy.condition.disease
    });
  }

  function updateWorld(instance, seconds) {
    if (!isGameplayActive(instance)) return;
    initializeDesktopGameplay(instance);
    const player = instance.state.player;
    const species = SPECIES_BY_ID.get(instance.state.speciesId);
    const pad = instance.inputSystem ? null : gamepadInput(instance);
    const movement = instance.inputSystem?.getMovementVector?.();
    let inputX = movement ? movement.x : (instance.keys.has("ArrowRight") || instance.keys.has("KeyD") ? 1 : 0) - (instance.keys.has("ArrowLeft") || instance.keys.has("KeyA") ? 1 : 0) + pad.x;
    let inputY = movement ? movement.y : (instance.keys.has("ArrowUp") || instance.keys.has("KeyW") ? 1 : 0) - (instance.keys.has("ArrowDown") || instance.keys.has("KeyS") ? 1 : 0) - pad.y;
    const crouching = Boolean(instance.inputSystem?.isActionDown?.("crouch"));
    const wantsSprint = !crouching && (instance.inputSystem?.isActionDown?.("sprint") || instance.keys.has("ShiftLeft") || instance.keys.has("ShiftRight") || pad?.sprint) && player.stamina > 5;
    const terrain = terrainForRealm(terrainAt(player.x, player.y, instance.world.seed), instance.state.realmId, player.x, player.y);
    const injurySpeed = 1 - player.injuries.fracture / 150;
    const geneEndurance = CONTENT?.GENE_SCHEMA?.endurance ? clamp(player.genes.endurance, .7, 1.3) : 1;
    const profile = desktopCameraProfile(instance);
    const baseSpeed = Math.min(100, 30 + Math.min(80, species.speed * 2.2)) * habitatPenalty(species, terrain) * injurySpeed * geneEndurance;
    const locomotionScale = crouching ? .46 : 1;
    inputX *= locomotionScale; inputY *= locomotionScale;
    if (instance.desktopController && DESKTOP?.resolveLocomotionConfig) instance.desktopController.options = DESKTOP.resolveLocomotionConfig({ profile, maxSpeed: baseSpeed, sprintMultiplier: 1.7, acceleration: profile.acceleration, deceleration: profile.deceleration, turnRate: profile.turnRate });
    const advanced = instance.desktopController?.advance?.(seconds, { x: inputX, y: inputY, cameraYaw: instance.camera?.yaw || 0, sprint: wantsSprint }) || null;
    const fixedSeconds = (advanced?.steps || 0) * (instance.desktopController?.stepSeconds || 1 / 120);
    if (!advanced || fixedSeconds <= 0) return;
    let physics = advanced.state;
    let render = advanced.renderState || physics;
    let nextX = clamp(physics.x, 20, WORLD_SIZE - 20);
    let nextY = clamp(physics.z, 20, WORLD_SIZE - 20);
    const groundHeight = RENDERER_ADAPTER?.sampleTerrainHeight || RENDERER_3D?.terrainHeight;
    const renderSeed = rendererSeedForState(instance.state);
    const previousGround = typeof groundHeight === "function" ? Number(groundHeight(player.x, player.y, renderSeed)) : NaN;
    const nextGround = typeof groundHeight === "function" ? Number(groundHeight(nextX, nextY, renderSeed)) : NaN;
    const horizontalTravel = Math.hypot(nextX - player.x, nextY - player.y);
    const slopeRadians = horizontalTravel > .001 && Number.isFinite(previousGround) && Number.isFinite(nextGround)
      ? Math.atan2(Math.abs(nextGround - previousGround), horizontalTravel)
      : 0;
    const slopeLimit = profile.id === "heavy" ? .43 : profile.id === "small" || profile.id === "climbing" ? .8 : .58;
    const groundBound = !["bird", "aquatic"].includes(profile.id);
    if (groundBound && slopeRadians > slopeLimit) { nextX = player.x; nextY = player.y; }
    if (nextX !== physics.x || nextY !== physics.z) {
      physics = instance.desktopController.reset({ ...physics, x: nextX, z: nextY, velocityX: 0, velocityZ: 0 });
      render = physics;
    }
    player.x = nextX;
    player.y = nextY;
    instance.heading = physics.heading;
    instance.renderPlayer = { ...player, x: clamp(render.x, 20, WORLD_SIZE - 20), y: clamp(render.z, 20, WORLD_SIZE - 20) };
    instance.renderHeading = render.heading;
    const velocityLength = Math.hypot(physics.velocityX, physics.velocityZ);
    const moving = velocityLength > .05;
    const sprinting = moving && wantsSprint;
    const dx = velocityLength > .001 ? physics.velocityX / velocityLength : 0;
    const dy = velocityLength > .001 ? physics.velocityZ / velocityLength : 0;
    seconds = fixedSeconds;
    syncPlanetRuntime(instance, seconds, dx, dy);
    if (moving && instance.simulation?.trails && instance.trailClock >= .18) {
      instance.trailClock = 0;
      instance.simulation.trails.leaveFootprint({ sourceId: "player", speciesId: species.id, x: player.x, y: player.y, intensity: sprinting ? 1 : .58, direction: instance.heading });
      instance.simulation.trails.addScent({ sourceId: "player", speciesId: species.id, x: player.x, y: player.y, intensity: .62, kind: "player" });
    }
    instance.trailClock += seconds;
    syncSimulation(instance, seconds);
    const effects = instance.simulation?.hazards?.effectsAt?.(player.x, player.y) || { danger: 0, flood: 0, wildfire: 0, volcano: 0 };
    const waterTerrain = ["ocean", "reef"].includes(terrain);
    const ambientTemperature = terrain === "tundra" ? 14 : terrain === "volcanic" ? 94 : terrain === "desert" ? 78 : terrain === "ocean" ? 38 : 52;
    const oxygenDrain = species.habitat === "water" ? (waterTerrain ? (species.id === "orca" || species.id === "blue-whale" ? 1.2 : 0) : 9) : (waterTerrain && species.locomotion !== "amphibious" ? 11 : 0);
    Object.assign(player, stepVitals(player, seconds, instance.state.settings.difficulty, moving, sprinting, { temperature: ambientTemperature + effects.wildfire * 35 + effects.volcano * 28, oxygenDrain }));
    player.health = clamp(player.health - seconds * (effects.wildfire * 5 + effects.volcano * 7 + effects.flood * .7), 0, 100);
    if ((effects.wildfire > .32 || effects.volcano > .32) && instance.injuryClock > 3) { instance.injuryClock = 0; injurePlayer(instance, "burn", .08 + effects.danger * .12); }
    instance.injuryClock += seconds;
    if (!player.health) {
      instance.dead = true; instance.running = false; instance.paused = true;
      transitionGameplay(instance, { type: "GAME_OVER" });
      releasePointerLock(instance, true);
      instance.root.classList.remove("is-running", "is-playing");
      setImmersiveShell(instance, false);
      instance.root.querySelector("[data-hwe-death]").hidden = false;
      instance.state.player.lineage += 1; saveState(instance);
    }
    instance.world.day = (instance.world.day + seconds * .08) % 24;
    instance.world.weather.phase += seconds * .1;
    if (!instance.simulation) instance.population.forEach((creature, index) => {
      if (!creature.alive) return;
      creature.phase += seconds * (.4 + (index % 5) * .05);
      creature.vx += Math.cos(creature.phase) * seconds * 3;
      creature.vy += Math.sin(creature.phase * .83) * seconds * 3;
      const maxSpeed = 18 + creature.species.speed;
      const velocity = Math.hypot(creature.vx, creature.vy) || 1;
      if (velocity > maxSpeed) { creature.vx = creature.vx / velocity * maxSpeed; creature.vy = creature.vy / velocity * maxSpeed; }
      creature.x = clamp(creature.x + creature.vx * seconds, 30, WORLD_SIZE - 30);
      creature.y = clamp(creature.y + creature.vy * seconds, 30, WORLD_SIZE - 30);
      creature.vx *= .985; creature.vy *= .985;
    });
    const nearestPredator = instance.population.filter((creature) => creature.alive && creature.species.diet === "meat" && creature.species.mass > species.mass * .7).sort((a, b) => Math.hypot(player.x - a.x, player.y - a.y) - Math.hypot(player.x - b.x, player.y - b.y))[0];
    if (nearestPredator && Math.hypot(player.x - nearestPredator.x, player.y - nearestPredator.y) < 30 && performance.now() > (instance.camouflageUntil || 0) && performance.now() > (instance.spawnGraceUntil || 0)) {
      player.health = clamp(player.health - seconds * 2.2, 0, 100);
      if (instance.injuryClock > 6) { instance.injuryClock = 0; injurePlayer(instance, (Math.floor(instance.world.day * 10) + instance.world.eventSequence) % 4 === 0 ? "fracture" : "bleeding", .08); }
    }
    const migrationDistance = Math.hypot(player.x - instance.world.migration.x, player.y - instance.world.migration.y);
    if (migrationDistance < instance.world.migration.radius && instance.state.activeExpedition === "migration") completeExpedition(instance, "migration");
    instance.eventClock += seconds;
    if (instance.eventClock > 32) { instance.eventClock = 0; triggerWorldEvent(instance); }
    instance.replayClock += seconds;
    if (instance.replayClock >= 1) {
      instance.replayClock = 0;
      instance.state.replay = [...instance.state.replay, { x: player.x, y: player.y, t: Date.now(), health: player.health, event: instance.world.event?.type || "move" }].slice(-240);
      instance.simulation?.heatmap?.add?.(player.x, player.y, 3, "player");
      const heatmap = instance.simulation?.getHeatmap?.();
      if (heatmap?.cells) {
        instance.state.heatmap = heatmap.cells.slice(0, 256);
        instance.state.heatmapCellSize = heatmap.cellSize || 64;
      }
    }
    instance.autosave += seconds;
    if (instance.autosave > 8) { instance.autosave = 0; saveState(instance); }
  }

  function drawSpeciesBody(ctx, species, size, highlighted = false, action = "rest") {
    ctx.fillStyle = species.color;
    ctx.strokeStyle = highlighted ? "#ffffff" : "rgba(255,255,255,.48)";
    ctx.lineWidth = highlighted ? 2 : 1;
    const longBody = ["orca", "blue-whale", "electric-eel"].includes(species.id) ? 1.75 : 1.35;
    ctx.beginPath(); ctx.ellipse(0, 0, size * longBody, size * .72, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = highlighted ? "#f5ffff" : species.color;
    if (["argentavis", "honeybee"].includes(species.id) || species.locomotion === "fly") {
      ctx.globalAlpha = .72; ctx.beginPath(); ctx.ellipse(-size * .2, -size * .72, size * 1.25, size * .35, -.35, 0, Math.PI * 2); ctx.ellipse(-size * .2, size * .72, size * 1.25, size * .35, .35, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;
    }
    if (species.id === "triceratops") { ctx.beginPath(); ctx.moveTo(size * 1.15, -size * .35); ctx.lineTo(size * 2.05, -size * .7); ctx.lineTo(size * 1.55, 0); ctx.lineTo(size * 2.05, size * .7); ctx.lineTo(size * 1.15, size * .35); ctx.fill(); }
    else if (species.id === "ankylosaurus") { for (let index = -2; index <= 2; index += 1) { ctx.beginPath(); ctx.arc(index * size * .42, -size * .62, size * .18, 0, Math.PI * 2); ctx.fill(); } ctx.beginPath(); ctx.arc(-size * 1.95, 0, size * .42, 0, Math.PI * 2); ctx.fill(); }
    else if (species.id === "spinosaurus") { ctx.beginPath(); ctx.moveTo(-size, -size * .5); ctx.quadraticCurveTo(0, -size * 1.75, size, -size * .5); ctx.closePath(); ctx.fill(); }
    else if (species.id === "mammuthus") { ctx.beginPath(); ctx.moveTo(size * 1.2, 0); ctx.quadraticCurveTo(size * 2.15, size * .4, size * 1.65, size * 1.05); ctx.stroke(); ctx.beginPath(); ctx.arc(size * .95, -size * .42, size * .24, 0, Math.PI * 2); ctx.fill(); }
    else if (species.id === "giant-octopus") { for (let index = -3; index <= 3; index += 1) { ctx.beginPath(); ctx.moveTo(-size * .65, index * size * .16); ctx.quadraticCurveTo(-size * 1.5, index * size * .28, -size * 2, index * size * .48); ctx.stroke(); } }
    else if (species.id === "electric-eel") { ctx.beginPath(); ctx.moveTo(-size * 1.5, 0); ctx.bezierCurveTo(-size * 2.1, -size, -size * 2.4, size, -size * 2.9, 0); ctx.stroke(); }
    else if (species.id === "honeybee") { ctx.strokeStyle = "#24190b"; for (let index = -1; index <= 1; index += 1) { ctx.beginPath(); ctx.moveTo(index * size * .42, -size * .62); ctx.lineTo(index * size * .42, size * .62); ctx.stroke(); } }
    else if (["orca", "blue-whale"].includes(species.id)) { ctx.beginPath(); ctx.moveTo(-size * 1.5, 0); ctx.lineTo(-size * 2.25, -size * .78); ctx.lineTo(-size * 2.05, 0); ctx.lineTo(-size * 2.25, size * .78); ctx.closePath(); ctx.fill(); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-size * .35, -size); ctx.lineTo(size * .35, 0); ctx.closePath(); ctx.fill(); }
    else if (species.id === "wolf") { ctx.beginPath(); ctx.moveTo(size * .65, -size * .55); ctx.lineTo(size * .9, -size * 1.1); ctx.lineTo(size * 1.1, -size * .4); ctx.fill(); ctx.beginPath(); ctx.moveTo(-size * 1.1, 0); ctx.lineTo(-size * 2, -size * .45); ctx.lineTo(-size * 1.5, size * .25); ctx.fill(); }
    else if (species.id === "tyrannosaurus") { ctx.beginPath(); ctx.moveTo(size * .9, -size * .45); ctx.lineTo(size * 2.05, -size * .28); ctx.lineTo(size * 2.1, size * .24); ctx.lineTo(size * .95, size * .38); ctx.closePath(); ctx.fill(); }
    else { ctx.beginPath(); ctx.moveTo(size, 0); ctx.lineTo(size + 7, -4); ctx.lineTo(size + 7, 4); ctx.closePath(); ctx.fill(); }
    if (action !== "rest") { ctx.globalAlpha = .7; ctx.strokeStyle = action === "flee" ? "#ff8a72" : action === "hunt" ? "#ffda75" : "#72efd2"; ctx.beginPath(); ctx.arc(0, 0, size * 1.95, 0, Math.PI * 2); ctx.stroke(); ctx.globalAlpha = 1; }
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
    const player = instance.renderPlayer || instance.state.player;
    const cameraX = player.x - width / 2;
    const cameraY = player.y - height / 2;
    const tile = 96;
    for (let sx = -tile; sx < width + tile; sx += tile) {
      for (let sy = -tile; sy < height + tile; sy += tile) {
        const wx = cameraX + sx;
        const wy = cameraY + sy;
        const terrain = terrainForRealm(terrainAt(wx, wy, instance.world.seed), instance.state.realmId, wx, wy);
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
    (instance.world.loadedChunks || []).forEach((chunk) => {
      const chunkSize = chunk.size || 256;
      const x = (chunk.cx * chunkSize) - cameraX;
      const y = (chunk.cy * chunkSize) - cameraY;
      if (x > width || y > height || x + chunkSize < 0 || y + chunkSize < 0) return;
      ctx.strokeStyle = "rgba(112,239,205,.09)";
      ctx.lineWidth = 1;
      ctx.strokeRect(x, y, chunkSize, chunkSize);
    });
    const trails = instance.simulation?.trails;
    (trails?.footprints || []).slice(-180).forEach((trail) => {
      const x = trail.x - cameraX; const y = trail.y - cameraY;
      if (x < -8 || y < -8 || x > width + 8 || y > height + 8) return;
      ctx.globalAlpha = .08 + trail.intensity * .3;
      ctx.fillStyle = "#ddf6d0";
      ctx.beginPath(); ctx.ellipse(x, y, 2.5, 5, trail.direction || 0, 0, Math.PI * 2); ctx.fill();
    });
    if (instance.senseUntil > performance.now()) (trails?.scents || []).slice(-160).forEach((trail) => {
      const x = trail.x - cameraX; const y = trail.y - cameraY;
      if (x < -16 || y < -16 || x > width + 16 || y > height + 16) return;
      ctx.globalAlpha = .08 + trail.intensity * .32;
      ctx.fillStyle = trail.kind === "pheromone" ? "#ff77ce" : "#78efd2";
      ctx.beginPath(); ctx.arc(x, y, 5 + trail.intensity * 10, 0, Math.PI * 2); ctx.fill();
    });
    ctx.globalAlpha = 1;
    instance.simulation?.hazards?.activeEvents?.().forEach((event) => {
      const x = event.x - cameraX; const y = event.y - cameraY;
      const color = event.type === "flood" ? "87,206,255" : event.type === "wildfire" ? "255,111,72" : "255,190,92";
      ctx.fillStyle = `rgba(${color},${.08 + event.intensity * .12})`;
      ctx.strokeStyle = `rgba(${color},${.42 + event.intensity * .3})`;
      ctx.lineWidth = 3; ctx.setLineDash([10, 8]);
      ctx.beginPath(); ctx.arc(x, y, event.radius, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); ctx.setLineDash([]);
    });
    instance.world.resources.forEach((resource) => {
      const x = resource.x - cameraX; const y = resource.y - cameraY;
      if (x < -30 || y < -30 || x > width + 30 || y > height + 30 || resource.amount <= 0) return;
      ctx.fillStyle = resource.type === "water" ? "#65dcff" : resource.type === "plant" ? "#a7ee78" : resource.type === "shelter" ? "#e9c47b" : "#d48275";
      ctx.globalAlpha = instance.senseUntil > performance.now() ? .95 : .62;
      ctx.beginPath(); ctx.arc(x, y, resource.type === "shelter" ? 9 : 5, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;
    });
    instance.population.forEach((creature, creatureIndex) => {
      if (!creature.alive) return;
      const renderStride = instance.renderBudget >= .99 ? 1 : instance.renderBudget >= .66 ? 2 : 3;
      if (creatureIndex % renderStride) return;
      const x = creature.x - cameraX; const y = creature.y - cameraY;
      if (x < -40 || y < -40 || x > width + 40 || y > height + 40) return;
      ctx.save(); ctx.translate(x, y); ctx.rotate(Math.atan2(creature.vy, creature.vx));
      const size = clamp(5 + Math.log10(creature.species.mass + 1) * 2.2, 5, 16);
      drawSpeciesBody(ctx, creature.species, size, instance.currentTarget?.id === creature.id, creature.action); ctx.restore();
    });
    const selected = SPECIES_BY_ID.get(instance.state.speciesId);
    ctx.save(); ctx.translate(width / 2, height / 2); ctx.rotate(Math.PI / 2 - (instance.renderHeading ?? instance.heading ?? 0));
    const playerSize = clamp(11 + Math.log10(selected.mass + 1) * 2.5, 11, 25);
    ctx.shadowColor = selected.color; ctx.shadowBlur = 18; drawSpeciesBody(ctx, selected, playerSize, true, instance.camouflageUntil > performance.now() ? "camouflage" : "rest"); ctx.restore();
    if (instance.senseUntil > performance.now()) {
      const pulse = ((performance.now() / 900) % 1) * 170;
      ctx.strokeStyle = `rgba(96,239,205,${1 - pulse / 180})`; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(width / 2, height / 2, pulse, 0, Math.PI * 2); ctx.stroke();
    }
    drawMinimap(instance);
  }

  function drawMinimap(instance) {
    const now = performance.now();
    if (now < (instance.minimapAt || 0)) return;
    instance.minimapAt = now + 180;
    const canvas = instance.root.querySelector("[data-hwe-minimap]");
    const ctx = canvas?.getContext?.("2d");
    if (!ctx) return;
    const size = canvas.width;
    ctx.clearRect(0, 0, size, size); ctx.fillStyle = "#071522"; ctx.fillRect(0, 0, size, size);
    for (let x = 0; x < size; x += 12) for (let y = 0; y < size; y += 12) { const wx = x / size * WORLD_SIZE; const wy = y / size * WORLD_SIZE; const terrain = terrainForRealm(terrainAt(wx, wy, instance.world.seed), instance.state.realmId, wx, wy); ctx.fillStyle = BIOMES[terrain].color; ctx.fillRect(x, y, 12, 12); }
    ctx.strokeStyle = "#ffd367"; ctx.beginPath(); ctx.arc(instance.world.migration.x / WORLD_SIZE * size, instance.world.migration.y / WORLD_SIZE * size, instance.world.migration.radius / WORLD_SIZE * size, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(instance.state.player.x / WORLD_SIZE * size, instance.state.player.y / WORLD_SIZE * size, 4, 0, Math.PI * 2); ctx.fill();
  }

  function updateHud(instance) {
    const player = instance.state.player;
    ["health", "hunger", "thirst", "stamina", "growth", "oxygen", "nutrition", "dietQuality"].forEach((key) => {
      instance.root.querySelectorAll(`[data-hwe-vital="${key}"]`).forEach((progress) => { progress.value = player[key]; });
      instance.root.querySelectorAll(`[data-hwe-value="${key}"]`).forEach((value) => { value.textContent = Math.round(player[key]); });
    });
    [["temperature", player.temperature], ["bleeding", player.injuries.bleeding], ["fracture", player.injuries.fracture], ["infection", player.injuries.infection], ["disease", player.injuries.disease]].forEach(([key, current]) => {
      const node = instance.root.querySelector(`[data-hwe-condition="${key}"]`);
      const value = instance.root.querySelector(`[data-hwe-condition-value="${key}"]`);
      node?.style?.setProperty?.("--condition", String(clamp(current, 0, 100)));
      if (value) value.textContent = Math.round(current);
    });
    const terrain = terrainForRealm(terrainAt(player.x, player.y, instance.world.seed), instance.state.realmId, player.x, player.y);
    const biome = instance.root.querySelector("[data-hwe-biome]"); if (biome) biome.textContent = BIOMES[terrain].label;
    const time = instance.root.querySelector("[data-hwe-time]"); if (time) time.textContent = `${String(Math.floor(instance.world.day)).padStart(2, "0")}:${String(Math.floor(instance.world.day % 1 * 60)).padStart(2, "0")}`;
    const weather = instance.root.querySelector("[data-hwe-weather]"); if (weather) weather.textContent = instance.world.event?.type !== "calm" ? instance.world.event.label : ({ clear: "Trời quang", mist: "Sương sinh học", storm: "Bão di cư" }[instance.world.weather.type]);
    const stage = instance.root.querySelector("[data-hwe-stage]"); if (stage) stage.textContent = stageLabel(player.growth);
    const mission = EXPEDITIONS.find((row) => row.id === instance.state.activeExpedition);
    const missionProgress = instance.root.querySelector("[data-hwe-mission-progress]");
    if (missionProgress) missionProgress.value = mission?.target === "migration" ? clamp(100 - Math.hypot(player.x - instance.world.migration.x, player.y - instance.world.migration.y) / 20, 0, 100) : mission?.target === "nest" ? player.growth : mission?.target === "water" ? player.thirst : mission?.target === "food" ? player.hunger : instance.senseCount * 34;
    const eventBanner = instance.root.querySelector("[data-hwe-event-banner]");
    if (eventBanner) {
      const active = instance.world.event?.type && instance.world.event.type !== "calm";
      eventBanner.hidden = !active;
      const title = eventBanner.querySelector("[data-hwe-event-title]"); if (title) title.textContent = instance.world.event?.label || "Biến động tự nhiên";
      const progress = eventBanner.querySelector("[data-hwe-event-progress]"); if (progress) progress.value = clamp((instance.world.event?.remaining || 0) / 24 * 100, 0, 100);
    }
    const aiMode = instance.root.querySelector("[data-hwe-ai-mode]"); if (aiMode) aiMode.textContent = instance.engineMode || "Local bounded AI";
    const renderInfo = instance.renderer3d?.getStatus?.();
    const renderStatus = instance.root.querySelector("[data-hwe-render-status]"); if (renderStatus) renderStatus.textContent = renderInfo ? `${renderInfo.backend.toUpperCase()} · ${RENDERER_3D?.QUALITY_PROFILES?.[renderInfo.quality]?.label || renderInfo.quality}` : "Canvas 2D Lite";
    const chunkCount = instance.root.querySelector("[data-hwe-chunk-count]"); if (chunkCount) {
      const atlasChunks = instance.atlasStreamPlan?.wanted?.length || 0;
      chunkCount.textContent = renderInfo ? `${instance.world.loadedChunks?.length || 0} sim · ${renderInfo.chunks} render · ${atlasChunks} atlas ưu tiên` : `${instance.world.loadedChunks?.length || 0} sim · ${atlasChunks} atlas ưu tiên`;
    }
    const ledger = instance.simulation?.ledger?.snapshot?.();
    const apexCount = Object.values(ledger?.apex || {}).reduce((sum, value) => sum + Number(value || 0), 0);
    const apexBudget = instance.root.querySelector("[data-hwe-apex-budget]"); if (apexBudget) apexBudget.textContent = `${apexCount} active · cap 3/chunk`;
    const trailCount = (instance.simulation?.trails?.footprints?.length || 0) + (instance.simulation?.trails?.scents?.length || 0);
    const trailNode = instance.root.querySelector("[data-hwe-trail-count]"); if (trailNode) trailNode.textContent = String(trailCount);
  }

  function loop(instance, now) {
    if (instance.destroyed) return;
    const seconds = Math.min(.2, Math.max(0, (now - instance.lastFrame) / 1000 || 0));
    instance.lastFrame = now;
    if (!global.document?.hidden) {
      instance.inputSystem?.updateGamepads?.(null, now);
      processInputActions(instance, now);
      updateGameplayCamera(instance, seconds);
      updateWorld(instance, seconds);
      updateTargeting(instance);
      if (instance.renderer3d) {
        const species = SPECIES_BY_ID.get(instance.state.speciesId);
        instance.renderer3d.sync({
          player: instance.renderPlayer || instance.state.player,
          population: instance.population,
          world: instance.world,
          speciesId: species.id,
          speciesColor: species.color,
          heading: instance.renderHeading ?? instance.heading,
          senseActive: instance.senseUntil > now,
          // Photo Mode freezes simulation but keeps the renderer alive so
          // lens, exposure and focus adjustments remain visible immediately.
          paused: instance.paused && !instance.photoMode,
          address: instance.state.worldAddress
        });
        drawMinimap(instance);
      } else drawWorld(instance);
      if (now >= (instance.hudAt || 0)) { instance.hudAt = now + 100; updateHud(instance); }
    }
    instance.frameCount += 1;
    if (now - instance.fpsAt > 1000) {
      const rendererStatus = instance.renderer3d?.getStatus?.();
      const fps = rendererStatus?.fps || instance.frameCount;
      const node = instance.root.querySelector("[data-hwe-fps]");
      if (node) {
        const cinematicTelemetry = rendererStatus?.drawCalls != null
          ? ` · ${rendererStatus.drawCalls} draw · ${Math.round((rendererStatus.triangles || 0) / 1000)}K tri · ~${rendererStatus.estimatedVramMiB || 0} MiB VRAM${rendererStatus.vramWarning ? " ⚠" : ""}`
          : "";
        const procedural = rendererStatus?.proceduralEnvironment;
        const vegetationCount = procedural?.vegetation?.activeInstances ?? procedural?.vegetation?.renderedInstances ?? procedural?.vegetation?.instances ?? procedural?.vegetation?.instanceCount;
        const environmentTelemetry = Number.isFinite(vegetationCount) ? ` · ${vegetationCount} vegetation` : "";
        node.textContent = `${fps} FPS · ${instance.population.filter((row) => row.alive).length} wildlife · ${rendererStatus?.backend?.toUpperCase?.() || "LITE"}${cinematicTelemetry}${environmentTelemetry}`;
      }
      if (!instance.renderer3d && instance.state.settings.adaptiveQuality && fps < 28) {
        instance.renderBudget = Math.max(.45, (instance.renderBudget || 1) - .18);
        if ((instance.dpr || 1) > 1) { instance.dprCap = Math.max(1, (instance.dpr || 1) - .2); resizeCanvas(instance); }
        logSignal(instance, "Adaptive quality đã giảm DPR và mật độ wildlife hiển thị; simulation vẫn giữ nguyên.");
      } else if (!instance.renderer3d && instance.state.settings.adaptiveQuality && fps > 48 && (instance.renderBudget || 1) < 1) instance.renderBudget = Math.min(1, instance.renderBudget + .08);
      instance.frameCount = 0; instance.fpsAt = now;
    }
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

  function targetCandidates(instance) {
    if (!instance.world) return [];
    const sampleHeight = RENDERER_ADAPTER?.sampleTerrainHeight || RENDERER_3D?.terrainHeight;
    const seed = typeof instance.renderer3d?.pickCenter === "function" ? rendererSeedForState(instance.state) : worldSeedForState(instance.state);
    const groundAt = (x, z) => {
      if (typeof sampleHeight !== "function") return 0;
      const height = Number(sampleHeight(x, z, seed));
      return Number.isFinite(height) ? height : 0;
    };
    const animals = (instance.population || []).filter((row) => row.alive !== false).map((row) => ({
      id: row.id,
      type: "animal",
      position: { x: row.x, y: groundAt(row.x, row.y) + Math.max(.25, Math.log10((row.species?.mass || 1) + 1)), z: row.y },
      entity: row,
      label: row.species?.vietnamese || row.species?.name || "Động vật",
      action: "Quan sát / tương tác",
      targetable: true
    }));
    const resources = (instance.world.resources || []).filter((row) => row.amount > 0).map((row) => ({
      id: row.id,
      type: row.type === "water" ? "water" : row.type === "shelter" ? "nest" : "food",
      position: { x: row.x, y: groundAt(row.x, row.y) + .35, z: row.y },
      entity: row,
      label: row.type === "water" ? "Nguồn nước" : row.type === "plant" ? "Thực vật ăn được" : row.type === "carcass" ? "Nguồn đạm" : "Nơi trú ẩn",
      action: row.type === "water" ? "Uống nước" : row.type === "shelter" ? "Kiểm tra nơi trú" : "Ăn",
      targetable: true
    }));
    return [...animals, ...resources];
  }

  function hasTerrainLineOfSight(instance, candidate, ray = {}) {
    const sampleHeight = RENDERER_ADAPTER?.sampleTerrainHeight || RENDERER_3D?.terrainHeight;
    if (typeof sampleHeight !== "function") return true;
    const player = instance.state.player;
    const seed = typeof instance.renderer3d?.pickCenter === "function" ? rendererSeedForState(instance.state) : worldSeedForState(instance.state);
    const originHeight = Number(sampleHeight(player.x, player.y, seed)) + (desktopCameraProfile(instance).height || 1.5);
    const targetHeight = Number(candidate.position?.y || .5);
    if (!Number.isFinite(originHeight) || !Number.isFinite(targetHeight)) return true;
    const steps = Math.max(4, Math.min(12, Math.ceil((ray.distance || 0) / 12)));
    for (let index = 1; index < steps; index += 1) {
      const t = index / steps;
      const x = player.x + (candidate.position.x - player.x) * t;
      const z = player.y + (candidate.position.z - player.y) * t;
      const sightHeight = originHeight + (targetHeight - originHeight) * t;
      const terrainHeight = Number(sampleHeight(x, z, seed));
      if (Number.isFinite(terrainHeight) && terrainHeight > sightHeight + .65) return false;
    }
    return true;
  }

  function clearCurrentTarget(instance) {
    instance.currentTarget = null;
    instance.lockedTargetId = "";
    instance.renderer3d?.setHighlightedTarget?.(null);
    const reticle = instance.root.querySelector("[data-hwe-reticle]");
    reticle?.classList?.remove("is-targeting");
    reticle?.removeAttribute?.("data-target-state");
    const prompt = instance.root.querySelector("[data-hwe-target-prompt]");
    if (prompt) prompt.replaceChildren();
  }

  function updateTargetPrompt(instance) {
    const target = instance.currentTarget;
    const prompt = instance.root.querySelector("[data-hwe-target-prompt]");
    const reticle = instance.root.querySelector("[data-hwe-reticle]");
    if (!prompt || !reticle) return;
    if (!target) { prompt.replaceChildren(); reticle.classList.remove("is-targeting"); reticle.removeAttribute("data-target-state"); return; }
    reticle.classList.add("is-targeting");
    reticle.dataset.targetState = "valid";
    const locked = instance.lockedTargetId === target.id;
    prompt.innerHTML = `<strong>${escapeHtml(target.label)}</strong><small data-hwe-target-distance>${target.distance.toFixed(1).replace(".", ",")} m${locked ? " · ĐÃ KHÓA" : ""}</small><span data-hwe-target-action><kbd>F</kbd> · ${escapeHtml(target.action)} &nbsp; <kbd>Z</kbd> · ${locked ? "Bỏ khóa" : "Khóa mục tiêu"}</span>`;
  }

  function updateTargeting(instance, force = false) {
    if (!isGameplayActive(instance) || !DESKTOP?.selectTarget) { if (!instance.paused) clearCurrentTarget(instance); return null; }
    const now = global.performance?.now?.() || Date.now();
    if (!force && now < (instance.targetAt || 0)) return instance.currentTarget || null;
    instance.targetAt = now + 80;
    const candidates = targetCandidates(instance);
    const player = instance.state.player;
    const rendererCanPick = typeof instance.renderer3d?.pickCenter === "function";
    let selected = null;
    if (instance.lockedTargetId) {
      const locked = candidates.find((row) => row.id === instance.lockedTargetId);
      if (locked) {
        const distance = Math.hypot(locked.position.x - player.x, locked.position.z - player.y);
        if (distance <= 120 && hasTerrainLineOfSight(instance, locked, { distance })) selected = { id: locked.id, type: locked.type, distance, source: locked };
      }
      if (!selected) instance.lockedTargetId = "";
    }
    if (!selected && rendererCanPick) {
      const rendererPick = instance.renderer3d?.pickCenter?.({ maxDistance: 120, allowedTypes: ["animal", "food", "water", "trail", "nest", "interactive"], excludePlayer: true });
      const picked = rendererPick && typeof rendererPick.then !== "function" ? rendererPick : null;
      if (picked?.id) {
        const source = candidates.find((row) => row.id === picked.id || row.entity?.species?.id === picked.speciesId);
        if (source) selected = { id: source.id, type: source.type, distance: Number(picked.distance) || Math.hypot(source.position.x - player.x, source.position.z - player.y), source };
      }
    }
    if (!selected && !rendererCanPick) {
      const yaw = instance.camera?.yaw || 0;
      const pitch = instance.camera?.pitch || 0;
      const horizontal = Math.cos(pitch);
      const result = DESKTOP.selectTarget(candidates, {
        origin: {
          x: player.x,
          y: Number((RENDERER_ADAPTER?.sampleTerrainHeight || RENDERER_3D?.terrainHeight)?.(player.x, player.y, worldSeedForState(instance.state)) || 0) + (desktopCameraProfile(instance).height || 1.5),
          z: player.y
        },
        forward: { x: Math.sin(yaw) * horizontal, y: Math.sin(pitch), z: Math.cos(yaw) * horizontal },
        maxDistance: 120,
        maxAngle: .15,
        allowedTypes: ["animal", "food", "water", "trail", "nest", "interactive"],
        hasLineOfSight: (candidate, ray) => hasTerrainLineOfSight(instance, candidate, ray)
      });
      if (result) selected = { ...result, source: candidates[result.sourceIndex] };
    }
    if (!selected?.source) { clearCurrentTarget(instance); return null; }
    instance.currentTarget = {
      id: selected.source.id,
      type: selected.source.type,
      distance: selected.distance,
      entity: selected.source.entity,
      label: selected.source.label,
      action: selected.source.action
    };
    instance.renderer3d?.setHighlightedTarget?.({ id: instance.currentTarget.id, type: instance.currentTarget.type, speciesId: instance.currentTarget.entity?.species?.id });
    updateTargetPrompt(instance);
    return instance.currentTarget;
  }

  function toggleTargetLock(instance) {
    updateTargeting(instance, true);
    if (!instance.currentTarget) { setToast(instance, "Không có mục tiêu hợp lệ gần tâm ngắm"); return false; }
    instance.lockedTargetId = instance.lockedTargetId === instance.currentTarget.id ? "" : instance.currentTarget.id;
    updateTargetPrompt(instance);
    return Boolean(instance.lockedTargetId);
  }

  function toggleViewMode(instance) {
    instance.state.settings.viewMode = instance.state.settings.viewMode === "animal-eye" ? "third-person" : "animal-eye";
    const profile = desktopCameraProfile(instance);
    if (instance.camera) {
      instance.camera.firstPerson = instance.state.settings.viewMode === "animal-eye";
      instance.camera.desiredDistance = instance.camera.firstPerson ? profile.minDistance : profile.distance;
    }
    saveState(instance);
    setToast(instance, instance.state.settings.viewMode === "animal-eye" ? "Animal-eye view" : "Camera góc nhìn thứ ba");
    return instance.state.settings.viewMode;
  }

  function applyMeal(instance, resourceType) {
    const player = instance.state.player;
    const species = SPECIES_BY_ID.get(instance.state.speciesId);
    const flagship = flagshipFor(species.id);
    const profileId = flagship?.diet?.profileId || ({ meat: "carnivore", plant: "herbivore", omnivore: "omnivore", filter: "filter-feeder", nectar: "nectar-pollen" })[species.diet] || "omnivore";
    const intake = resourceType === "plant"
      ? { protein: 42, fat: 28, carbohydrate: 88, minerals: 76, hydration: 68, fiber: 92, toxins: species.diet === "meat" ? 42 : 4, spoilage: 2 }
      : { protein: 92, fat: 78, carbohydrate: 16, minerals: 72, hydration: 58, fiber: 8, toxins: species.diet === "plant" ? 38 : 3, spoilage: resourceType === "carcass" ? 16 : 3 };
    let score = species.diet === "omnivore" ? 78 : 70;
    if (typeof CONTENT?.evaluateDietQuality === "function") {
      try { score = CONTENT.evaluateDietQuality(profileId, intake).score; } catch {}
    }
    player.dietQuality = clamp(player.dietQuality * .55 + score * .45, 0, 100);
    player.nutrition = clamp(player.nutrition + 18 + score * .13, 0, 100);
    player.immunity = clamp(player.immunity + (score - 55) * .04, 0, 100);
    return Math.round(score);
  }

  function interact(instance) {
    if (!instance.world || !instance.running) return;
    const player = instance.state.player; const species = SPECIES_BY_ID.get(instance.state.speciesId);
    updateTargeting(instance, true);
    const resource = ["food", "water", "nest", "interactive"].includes(instance.currentTarget?.type) ? instance.currentTarget.entity : null;
    if (!resource || Math.hypot(player.x - resource.x, player.y - resource.y) > 32) { logSignal(instance, "Hãy đưa tài nguyên vào tâm ngắm và tiến gần hơn để tương tác."); return; }
    if (resource.type === "water") { player.thirst = clamp(player.thirst + 38, 0, 100); resource.amount -= 8; logSignal(instance, "Đã uống nước. Hãy quan sát dấu chân quanh bờ."); completeExpedition(instance, "water"); }
    else if (resource.type === "plant" && ["plant", "omnivore", "nectar", "filter"].includes(species.diet)) { player.hunger = clamp(player.hunger + 32, 0, 100); resource.amount -= 12; const score = applyMeal(instance, "plant"); logSignal(instance, `Khẩu phần thực vật đạt chất lượng ${score}/100.`); completeExpedition(instance, "food"); }
    else if (resource.type === "carcass" && ["meat", "omnivore"].includes(species.diet)) { player.hunger = clamp(player.hunger + 35, 0, 100); resource.amount -= 14; const score = applyMeal(instance, "carcass"); logSignal(instance, `Nguồn đạm đạt chất lượng ${score}/100; xác cũ tăng rủi ro nhiễm trùng.`); completeExpedition(instance, "food"); }
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

  function defend(instance, power = 1) {
    if (!instance.world || !instance.running || instance.state.player.stamina < 12) return;
    instance.state.player.stamina = clamp(instance.state.player.stamina - 12 * Math.max(1, power * .72), 0, 100);
    const player = instance.state.player;
    updateTargeting(instance, true);
    const target = instance.currentTarget?.type === "animal" ? instance.currentTarget.entity : null;
    if (!target || Math.hypot(player.x - target.x, player.y - target.y) > 58) { logSignal(instance, "Đòn phòng vệ không chạm mục tiêu."); return; }
    target.health -= 38 * power;
    const simulationTarget = instance.simulation?.damageEntity?.(target.id, 38 * power, { type: power > 1.35 ? "fracture" : "bleeding", severity: clamp(.14 * power, .05, .45) });
    if (simulationTarget) target.health = simulationTarget.health;
    if (target.health <= 0) { target.alive = false; instance.world.resources.push({ id: `carcass-${Date.now()}`, x: target.x, y: target.y, type: "carcass", amount: 100, terrain: terrainForRealm(terrainAt(target.x, target.y, instance.world.seed), instance.state.realmId, target.x, target.y) }); logSignal(instance, "Một mắt xích đã trở thành dinh dưỡng cho lưới sống."); }
    else logSignal(instance, `${target.species.vietnamese} lùi khỏi vùng nguy hiểm.`);
  }

  function useFlagshipAbility(instance) {
    if (!instance.world || !instance.running) return false;
    const species = SPECIES_BY_ID.get(instance.state.speciesId);
    const flagship = flagshipFor(species.id);
    if (!flagship) { defend(instance); return true; }
    const now = performance.now();
    const cooldown = clamp(flagship.defense?.cooldownSeconds ?? flagship.locomotion?.special?.cooldownSeconds ?? 6, 1, 30) * 1000;
    if (now < (instance.abilityReadyAt || 0)) { setToast(instance, `Ability hồi sau ${Math.ceil((instance.abilityReadyAt - now) / 1000)} giây`); return false; }
    const cost = clamp(flagship.defense?.staminaCost ?? flagship.locomotion?.special?.cost ?? 12, 2, 45);
    if (instance.state.player.stamina < cost) { setToast(instance, "Không đủ thể lực cho Flagship ability"); return false; }
    instance.state.player.stamina -= cost;
    instance.abilityReadyAt = now + cooldown;
    const player = instance.state.player;
    const messages = {
      tyrannosaurus: "Luồng mùi theo gió được khuếch đại; dấu cũ sáng lâu hơn.",
      triceratops: "Tư thế phòng thủ đàn chuyển thành cú xung phong bằng sừng.",
      argentavis: "Cột khí nâng cơ thể, hoàn lại thể lực và chỉ hướng di cư.",
      orca: "Xung dội âm quét địa hình nước và mục tiêu gần.",
      "giant-octopus": "Sắc tố ngụy trang đổi màu và giảm khả năng bị phát hiện.",
      spinosaurus: "Cảm nhận áp suất nước khóa mục tiêu trong vùng đầm lầy.",
      mammuthus: "Đàn hình thành lá chắn nhiệt quanh cá thể non.",
      wolf: "Tín hiệu bầy săn chia sẻ vệt mùi và nhịp truy đuổi.",
      honeybee: "Điệu nhảy định hướng đánh dấu tuyến hoa hiệu quả nhất.",
      "electric-eel": "Xung điện làm choáng sinh vật gần mà không tạo vũ khí nhân tạo.",
      ankylosaurus: "Trụ thấp, xoay giáp và quét chùy đuôi theo vùng.",
      "blue-whale": "Lướt sâu tiết kiệm oxy rồi phát tiếng gọi đại dương."
    };
    if (["triceratops", "ankylosaurus", "spinosaurus"].includes(species.id)) defend(instance, species.id === "ankylosaurus" ? 1.75 : 1.45);
    if (["tyrannosaurus", "orca", "spinosaurus"].includes(species.id)) { instance.senseUntil = now + 6800; instance.senseCount += 1; }
    if (species.id === "argentavis") { player.stamina = clamp(player.stamina + 34, 0, 100); instance.world.migration.radius = clamp(instance.world.migration.radius + 35, 120, 320); }
    if (species.id === "giant-octopus") instance.camouflageUntil = now + 7200;
    if (species.id === "mammuthus") { player.temperature = clamp(player.temperature + (50 - player.temperature) * .75, 0, 100); player.health = clamp(player.health + 6, 0, 100); }
    if (species.id === "wolf") instance.population.filter((row) => row.species.id === "wolf").forEach((row) => { row.action = "hunt"; });
    if (species.id === "honeybee") { instance.world.migration.x = player.x; instance.world.migration.y = player.y; instance.world.resources.filter((row) => row.type === "plant").slice(0, 8).forEach((row) => { row.amount = clamp(row.amount + 12, 0, 100); }); }
    if (species.id === "electric-eel") defend(instance, 1.25);
    if (species.id === "blue-whale" || species.id === "orca") { player.oxygen = 100; player.stamina = clamp(player.stamina + 18, 0, 100); }
    logSignal(instance, messages[species.id] || mechanicLabel(flagship.defense?.special, species.ability));
    setToast(instance, `R · ${mechanicLabel(flagship.defense?.special, flagship.locomotion?.special?.label || species.ability)}`);
    return true;
  }

  function emitCommunication(instance, callId) {
    if (!instance.running) return false;
    const call = COMMUNICATION_CALLS.find((item) => item.id === callId);
    if (!call) return false;
    const speciesId = instance.state.speciesId;
    const flagship = flagshipFor(speciesId);
    const allowed = !flagship || typeof CONTENT?.isCommunicationCallAllowed !== "function" || CONTENT.isCommunicationCallAllowed(speciesId, call.id);
    if (!allowed) { setToast(instance, "Loài này không dùng tín hiệu đó"); return false; }
    const cost = clamp(call.energyCost ?? 5, 0, 30);
    if (instance.state.player.stamina < cost) { setToast(instance, "Không đủ thể lực để phát tín hiệu"); return false; }
    instance.state.player.stamina -= cost;
    if (["territorial", "alarm", "distress"].includes(call.id)) instance.population.filter((row) => Math.hypot(row.x - instance.state.player.x, row.y - instance.state.player.y) < 260).forEach((row) => { row.action = "flee"; });
    if (["navigation", "migration", "colony-task"].includes(call.id)) { instance.world.migration.x = instance.state.player.x; instance.world.migration.y = instance.state.player.y; }
    if (instance.simulation?.trails && ["territorial", "courtship", "colony-task"].includes(call.id)) instance.simulation.trails.addScent({ sourceId: "player", speciesId, x: instance.state.player.x, y: instance.state.player.y, intensity: .95, kind: "pheromone", halfLife: 28 });
    logSignal(instance, `${call.label}: ${call.intent || "tín hiệu sinh học đã lan trong phạm vi gần"}.`);
    setToast(instance, `${call.label} · ${Math.round(call.radiusMeters || 0)} m`);
    return true;
  }

  function createNest(instance) {
    if (!instance.world || !instance.running) return;
    const player = instance.state.player;
    const shelter = instance.world.resources.filter((row) => row.type === "shelter").sort((a, b) => Math.hypot(player.x - a.x, player.y - a.y) - Math.hypot(player.x - b.x, player.y - b.y))[0];
    if (player.growth < 60) { logSignal(instance, "Chưa đủ trưởng thành để tạo tổ."); return; }
    if (!shelter || Math.hypot(player.x - shelter.x, player.y - shelter.y) > 110) { logSignal(instance, "Hãy tìm vòng sáng nơi trú ẩn trước khi tạo tổ."); return; }
    const seed = `${instance.state.settings.seed}:${instance.state.speciesId}:${player.generation}:${instance.state.lineage.length}`;
    let offspringGenes = normalizeGenes(player.genes, hashSeed(seed));
    if (typeof CONTENT?.inheritGenes === "function") {
      try { offspringGenes = CONTENT.inheritGenes(player.genes, player.genes, { seed, mutationRate: .08, mutationStrength: .22 }); } catch {}
    }
    const record = {
      id: `generation-${player.generation + 1}-${Date.now()}`,
      generation: player.generation + 1,
      speciesId: instance.state.speciesId,
      genes: offspringGenes,
      bornAt: Date.now(),
      survived: player.growth
    };
    instance.state.player.lineage += 1;
    instance.state.lineage = [...instance.state.lineage, record].slice(-24);
    instance.state.discoveries = [...new Set([...instance.state.discoveries, instance.state.speciesId])];
    saveState(instance); completeExpedition(instance, "nest"); logSignal(instance, `Tổ đã được tạo. Gene thế hệ ${record.generation} được lưu cục bộ.`);
  }

  function respawn(instance) {
    const previousLineageCount = instance.state.player.lineage;
    const nextGeneration = instance.state.lineage.at(-1);
    instance.state.player = normalizeState({ speciesId: instance.state.speciesId, player: { genes: nextGeneration?.genes, generation: nextGeneration?.generation || instance.state.player.generation, lineage: previousLineageCount } }).player;
    placePlayerAtHabitat(instance);
    instance.dead = false; instance.running = false;
    instance.gameplayMachine = DESKTOP?.createGameplayState?.("READY") || { status: "READY", context: "NONE" };
    instance.root.dataset.gameplayState = "ready";
    instance.root.querySelector("[data-hwe-death]").hidden = true;
    startGame(instance);
    saveState(instance); logSignal(instance, "Một vòng đời mới bắt đầu.");
  }

  function initPlanetRuntime(instance) {
    if (!WORLD_ATLAS?.addressToWorld || !WORLD_ATLAS?.worldToAddress) return false;
    const logical = WORLD_ATLAS.addressToWorld(instance.state.planetAddress || { mapId: instance.state.atlasMapId, realmId: instance.state.realmId });
    instance.planetAnchor = { x: logical.x - instance.state.player.x, z: logical.z - instance.state.player.y };
    instance.floatingOrigin = typeof WORLD_ATLAS.FloatingOrigin === "function"
      ? new WORLD_ATLAS.FloatingOrigin({ originX: logical.x, originY: logical.y, originZ: logical.z })
      : null;
    instance.atlasStreamPlanner = typeof WORLD_ATLAS.ChunkStreamPlanner === "function"
      ? new WORLD_ATLAS.ChunkStreamPlanner({ maximum: 96, chunkSizeM: WORLD_ATLAS.CHUNK_SIZE_METERS })
      : null;
    // The Atlas currently supplies a bounded priority plan. Actual renderer
    // chunks are tracked separately so a planned key is never reported as
    // loaded before a terrain provider completes it.
    instance.atlasRenderedKeys = new Set();
    instance.atlasPlannedKeys = new Set();
    instance.atlasVisitedKeys = new Set();
    instance.atlasPlanClock = .5;
    instance.atlasCacheClock = 0;
    instance.atlasTileCache = typeof WORLD_ATLAS.AtlasTileCache === "function" ? new WORLD_ATLAS.AtlasTileCache() : null;
    const tile = { mapId: instance.state.atlasMapId, layer: "fog", zoom: 0, x: instance.state.planetAddress?.sectorX || 0, y: instance.state.planetAddress?.sectorZ || 0 };
    instance.atlasTileCache?.get?.(tile).then((record) => {
      if (instance.destroyed) return;
      const visited = Array.isArray(record?.payload?.visitedChunkKeys) ? record.payload.visitedChunkKeys.slice(-512) : [];
      visited.forEach((key) => instance.atlasVisitedKeys?.add?.(String(key).slice(0, 160)));
    }).catch(() => {});
    return true;
  }

  function syncPlanetRuntime(instance, seconds, directionX = 0, directionZ = 0) {
    if (!instance.planetAnchor || !WORLD_ATLAS?.worldToAddress) return false;
    const worldX = instance.planetAnchor.x + instance.state.player.x;
    const worldZ = instance.planetAnchor.z + instance.state.player.y;
    const worldPosition = { x: worldX, y: instance.state.planetAddress?.altitudeM || 0, z: worldZ };
    const rebase = instance.floatingOrigin?.update?.(worldPosition) || null;
    const origin = rebase?.origin || instance.floatingOrigin?.snapshot?.().origin || { x: 0, y: 0, z: 0 };
    instance.floatingOriginState = rebase;
    instance.localPlanetPosition = {
      x: worldPosition.x - origin.x,
      y: worldPosition.y - origin.y,
      z: worldPosition.z - origin.z
    };
    instance.state.planetAddress = WORLD_ATLAS.worldToAddress({
      ...instance.state.planetAddress,
      mapId: instance.state.atlasMapId,
      realmId: instance.state.realmId,
      regionId: instance.state.atlasRegionId,
      ...worldPosition
    });
    instance.atlasPlanClock += seconds;
    instance.atlasCacheClock += seconds;
    if (!instance.atlasStreamPlanner || instance.atlasPlanClock < .5) return true;
    instance.atlasPlanClock = 0;
    const plan = instance.atlasStreamPlanner.plan({
      mapId: instance.state.atlasMapId,
      worldX,
      worldZ,
      directionX,
      directionZ,
      radius: global.matchMedia?.("(max-width: 760px)")?.matches ? 2 : 4,
      loadedKeys: Array.from(instance.atlasRenderedKeys || [])
    });
    instance.atlasStreamPlan = plan;
    instance.atlasPlannedKeys = new Set(plan.wanted.map((row) => row.key));
    // Discovery fog records the chunk the animal physically occupies, not all
    // speculative chunks prioritized around the camera.
    const centerKey = `${instance.state.atlasMapId}:${plan.center.chunkX}:${plan.center.chunkZ}`;
    instance.atlasVisitedKeys.add(centerKey);
    while (instance.atlasVisitedKeys.size > 512) instance.atlasVisitedKeys.delete(instance.atlasVisitedKeys.values().next().value);
    if (instance.atlasCacheClock >= 2 && instance.atlasTileCache) {
      instance.atlasCacheClock = 0;
      const tile = { mapId: instance.state.atlasMapId, layer: "fog", zoom: 0, x: instance.state.planetAddress.sectorX, y: instance.state.planetAddress.sectorZ };
      instance.atlasTileCache.put(tile, { format: "hh-eonwild-discovery-fog-v1", visitedChunkKeys: Array.from(instance.atlasVisitedKeys), updatedAt: Date.now() }).catch(() => {});
    }
    return true;
  }

  function startGame(instance) {
    if (!instance.canvas) return;
    if (!instance.state.player.health) {
      const previous = instance.state.player;
      instance.state.player = normalizeState({ speciesId: instance.state.speciesId, player: { genes: previous.genes, generation: previous.generation, lineage: previous.lineage } }).player;
      placePlayerAtHabitat(instance);
    }
    initializeDesktopGameplay(instance, true);
    instance.running = true; instance.paused = false; instance.dead = false; instance.spawnGraceUntil = performance.now() + 15000;
    if (gameplayStateName(instance) === "ready") transitionGameplay(instance, { type: "START" });
    else {
      instance.gameplayMachine = DESKTOP?.createGameplayState?.("PLAYING") || instance.gameplayMachine;
      instance.root.dataset.gameplayState = "playing";
    }
    instance.root.querySelector("[data-hwe-start-panel]").hidden = true;
    instance.root.classList.add("is-running", "is-playing");
    instance.root.classList.remove("is-paused");
    setImmersiveShell(instance, true);
    instance.inputSystem?.resume?.("gameplay-state");
    instance.renderer3d?.setPaused?.(false);
    instance.root.querySelector("[data-hwe-pause-overlay]")?.setAttribute("hidden", "");
    instance.root.querySelector("[data-hwe-pause]")?.setAttribute("aria-pressed", "false");
    saveState(instance);
    if (instance.state.settings.renderer !== "lite" && !instance.renderer3d) enable3D(instance, instance.state.settings.renderer === "3d");
    focusSurface(instance);
    requestGameplayPointerLock(instance);
    logSignal(instance, "Vòng đời bắt đầu. Chuột điều khiển camera; tâm ngắm chọn mục tiêu trong thế giới.");
  }

  function initWorld(instance) {
    instance.canvas = instance.root.querySelector("[data-hwe-canvas]");
    instance.canvas3d = instance.root.querySelector("[data-hwe-canvas-3d]");
    if (!instance.canvas) return;
    instance.ctx = instance.canvas.getContext("2d", { alpha: false });
    instance.world = createWorld(worldSeedForState(instance.state), instance.state.settings.density, instance.state.realmId);
    if (instance.state.player.spawnPending) { placePlayerAtHabitat(instance); saveState(instance); }
    initPlanetRuntime(instance);
    instance.population = createPopulation(instance);
    instance.keys = new Set(); instance.running = false; instance.paused = false; instance.dead = false; instance.senseUntil = 0; instance.senseCount = 0; instance.autosave = 0; instance.heading = 0; instance.lastFrame = performance.now(); instance.fpsAt = performance.now(); instance.frameCount = 0;
    instance.gameplayMachine = DESKTOP?.createGameplayState?.("BOOT") || { status: "BOOT", context: "NONE" };
    instance.pointerLockState = DESKTOP?.createPointerLockState?.() || { status: "UNLOCKED", desired: false };
    transitionGameplay(instance, { type: "BOOT_COMPLETE" });
    initializeDesktopGameplay(instance, true);
    instance.inputSystem?.pause?.("gameplay-state");
    instance.chunkClock = 0; instance.trailClock = 0; instance.replayClock = 0; instance.eventClock = 0; instance.injuryClock = 0; instance.abilityReadyAt = 0; instance.camouflageUntil = 0; instance.hudAt = 0; instance.minimapAt = 0; instance.dprCap = 0; instance.renderBudget = 1;
    initSimulationKernel(instance);
    resizeCanvas(instance);
    instance.resizeObserver = typeof ResizeObserver === "function" ? new ResizeObserver(() => resizeCanvas(instance)) : null;
    instance.resizeObserver?.observe(instance.canvas);
    const viewport = instance.root.querySelector("[data-hwe-viewport]");
    if (viewport && viewport !== instance.canvas) instance.resizeObserver?.observe(viewport);
    instance.raf = global.requestAnimationFrame?.((time) => loop(instance, time));
    if (instance.state.settings.renderer === "3d") enable3D(instance, false);
  }

  function switchRealm(instance, realmId, navigateToWorld = false) {
    if (!REALM_IDS.includes(realmId)) return false;
    instance.state.realmId = realmId;
    const selected = SPECIES_BY_ID.get(instance.state.speciesId);
    let fallback = selected;
    if (!selected || tierForSpecies(selected) !== "flagship" || !speciesAllowedInRealm(selected, realmId, instance.state.settings.convergence)) {
      fallback = SPECIES.find((species) => tierForSpecies(species) === "flagship" && speciesAllowedInRealm(species, realmId, instance.state.settings.convergence));
      if (fallback) { instance.state.speciesId = fallback.id; instance.state.player = normalizeState({ speciesId: fallback.id, player: { lineage: instance.state.player.lineage } }).player; }
    }
    const currentAtlasMap = WORLD_ATLAS?.getMap?.(instance.state.atlasMapId);
    if (!currentAtlasMap || currentAtlasMap.realmId !== realmId) {
      const atlasMap = WORLD_ATLAS?.defaultMapForRealm?.(realmId);
      if (atlasMap) {
        instance.state.atlasMapId = atlasMap.id;
        instance.state.atlasRegionId = atlasMap.regions[0]?.id || "";
        instance.state.planetAddress = WORLD_ATLAS.normalizeAddress({ mapId: atlasMap.id, regionId: instance.state.atlasRegionId, localX: WORLD_ATLAS.SECTOR_SIZE_METERS / 2, localZ: WORLD_ATLAS.SECTOR_SIZE_METERS / 2 });
      }
    }
    const selectedAtlasMap = WORLD_ATLAS?.getMap?.(instance.state.atlasMapId);
    instance.state.worldAddress = atlasAddressForMap(instance.state, selectedAtlasMap) || RENDERER_3D?.createWorldAddress?.({ realmId, seed: worldSeedForState(instance.state) }) || instance.state.worldAddress;
    if (fallback) syncAddressForSpecies(instance, fallback.id);
    saveState(instance);
    if ((navigateToWorld || instance.view === "timeline") && !fallback) global.location.hash = "#/game/ecosystem";
    else if (navigateToWorld || instance.view === "timeline") global.location.hash = "#/game/world";
    else mount(instance.host, { view: instance.view });
    return true;
  }

  function selectAtlasMap(instance, mapId) {
    const map = WORLD_ATLAS?.getMap?.(mapId);
    if (!map) { setToast(instance, "Bản đồ không hợp lệ hoặc chưa được kiểm chứng"); return false; }
    if (map.realmId === "convergence") {
      instance.state.settings.convergence = true;
    } else {
      instance.state.settings.convergence = false;
      instance.state.realmId = map.realmId;
    }
    instance.state.atlasMapId = map.id;
    instance.state.atlasRegionId = map.regions[0]?.id || "";
    instance.state.planetAddress = WORLD_ATLAS.normalizeAddress({
      mapId: map.id,
      realmId: map.realmId,
      regionId: instance.state.atlasRegionId,
      localX: WORLD_ATLAS.SECTOR_SIZE_METERS / 2,
      localZ: WORLD_ATLAS.SECTOR_SIZE_METERS / 2
    });
    const mappedAddress = atlasAddressForMap(instance.state, map);
    if (mappedAddress) instance.state.worldAddress = mappedAddress;
    if (map.realmId !== "convergence" && mappedAddress) {
      const mapState = { ...instance.state, realmId: map.realmId, settings: { ...instance.state.settings, convergence: false } };
      const playable = playableSpeciesAtAddress(mapState, mappedAddress);
      const selected = SPECIES_BY_ID.get(instance.state.speciesId);
      const fallback = selected && playable.some((species) => species.id === selected.id) ? selected : playable[0];
      if (fallback) {
        const lineage = instance.state.player.lineage;
        instance.state.speciesId = fallback.id;
        instance.state.player = normalizeState({ speciesId: fallback.id, realmId: map.realmId, atlasMapId: map.id, atlasRegionId: instance.state.atlasRegionId, planetAddress: instance.state.planetAddress, worldAddress: mappedAddress, player: { lineage } }).player;
      }
    }
    saveState(instance);
    if (map.gameplayStatus === "atlas-reference-only") {
      global.location.hash = "#/game/timeline";
      if (instance.view === "timeline") {
        instance.root.querySelectorAll("[data-hwe-atlas-map]").forEach((button) => {
          const selected = button.dataset.hweAtlasMap === map.id;
          button.setAttribute("aria-pressed", String(selected));
          button.textContent = selected ? "Đang chọn" : "Chọn bản đồ →";
          button.closest(".hwe-atlas-map")?.classList?.toggle?.("is-selected", selected);
        });
        setToast(instance, `${map.label} · Atlas có nguồn, active region chưa được dựng nên không ghép sai thời đại`);
      }
      return true;
    }
    if (map.realmId !== "convergence" && mappedAddress) {
      const mapState = { ...instance.state, settings: { ...instance.state.settings, convergence: false } };
      if (!playableSpeciesAtAddress(mapState, mappedAddress).length) {
        if (instance.view === "timeline" && global.location?.hash === "#/game/timeline") {
          instance.root.querySelectorAll("[data-hwe-atlas-map]").forEach((button) => {
            const selected = button.dataset.hweAtlasMap === map.id;
            button.setAttribute("aria-pressed", String(selected));
            button.textContent = selected ? "Đang chọn" : "Chọn bản đồ →";
            button.closest(".hwe-atlas-map")?.classList?.toggle?.("is-selected", selected);
          });
          setToast(instance, `${map.label} · active region đã ánh xạ nhưng chưa có Flagship playable phù hợp`);
        } else global.location.hash = "#/game/timeline";
        return true;
      }
    }
    setToast(instance, `${map.label} · ${map.confidence === "fictional" ? "sandbox hư cấu" : "active region đã ánh xạ"}`);
    if (global.location.hash === "#/game/world") mount(instance.host, { view: "world" });
    else global.location.hash = "#/game/world";
    return true;
  }

  function selectPlayableSpecies(instance, species, navigate = false) {
    if (!species) return false;
    const tier = tierForSpecies(species);
    if (tier !== "flagship") { setToast(instance, tier === "simulated" ? "Loài này là Wildlife AI để quan sát, không giả là playable" : "Mục này chỉ thuộc Eon Codex"); return false; }
    const targetRealm = CONTENT?.getSpeciesCatalogEntry?.(species.id)?.realmIds?.[0] || realmForSpecies(species);
    if (!speciesAllowedInRealm(species, instance.state.realmId, instance.state.settings.convergence)) {
      if (tier !== "flagship" || !REALM_IDS.includes(targetRealm)) { setToast(instance, "Loài này không thể spawn trong Era Realm hiện tại"); return false; }
      instance.state.realmId = targetRealm;
    }
    const lineageCount = instance.state.player.lineage;
    instance.state.speciesId = species.id;
    instance.state.player = normalizeState({ speciesId: species.id, player: { lineage: lineageCount } }).player;
    syncAddressForSpecies(instance, species.id);
    saveState(instance);
    if (navigate || instance.view !== "world") global.location.hash = "#/game/world";
    else mount(instance.host, { view: "world" });
    return true;
  }

  function downloadLocalFile(instance, filename, payload, type = "application/json") {
    try {
      const blob = payload instanceof Blob ? payload : new Blob([String(payload)], { type });
      const url = global.URL.createObjectURL(blob);
      const anchor = global.document.createElement("a");
      anchor.href = url; anchor.download = filename; anchor.hidden = true;
      global.document.body.append(anchor); anchor.click(); anchor.remove();
      setTimeout(() => global.URL.revokeObjectURL(url), 0);
      return true;
    } catch { setToast(instance, "Trình duyệt chưa cho phép xuất tệp"); return false; }
  }

  function exportLineage(instance) {
    const payload = {
      format: "hh-eonwild-lineage-v4",
      version: VERSION,
      exportedAt: new Date().toISOString(),
      speciesId: instance.state.speciesId,
      realmId: instance.state.realmId,
      currentGenes: instance.state.player.genes,
      lineage: instance.state.lineage
    };
    if (downloadLocalFile(instance, `hh-eonwild-lineage-${Date.now()}.json`, JSON.stringify(payload, null, 2))) setToast(instance, "Đã xuất lineage JSON cục bộ");
  }

  function exportSave(instance) {
    const state = normalizeState(instance.state);
    const checksumState = { ...state, updatedAt: 0 };
    const payload = {
      format: "hh-eonwild-save-v4",
      schemaVersion: SCHEMA_VERSION,
      appVersion: VERSION,
      exportedAt: new Date().toISOString(),
      checksum: hashSeed(JSON.stringify(checksumState)).toString(16).padStart(8, "0"),
      state
    };
    if (downloadLocalFile(instance, `hh-eonwild-save-${Date.now()}.json`, JSON.stringify(payload, null, 2))) setToast(instance, "Đã xuất save v4 có checksum");
  }

  async function importSave(instance, file) {
    if (!file || file.size > 2 * 1024 * 1024) { setToast(instance, "Tệp save không hợp lệ hoặc lớn hơn 2 MB"); return false; }
    try {
      const payload = JSON.parse(await file.text());
      const formatMatch = /^hh-eonwild-save-v([1-4])$/.exec(String(payload?.format || ""));
      if (!formatMatch || !payload.state || typeof payload.state !== "object") throw new Error("Sai định dạng save");
      const importedSchema = clamp(payload.schemaVersion || payload.state.schemaVersion || Number(formatMatch[1]), 1, SCHEMA_VERSION);
      const checksumSource = importedSchema < SCHEMA_VERSION
        ? { ...payload.state, updatedAt: 0 }
        : { ...normalizeState({ ...payload.state, schemaVersion: importedSchema }), updatedAt: 0 };
      const checksum = hashSeed(JSON.stringify(checksumSource)).toString(16).padStart(8, "0");
      if (payload.checksum && payload.checksum !== checksum) throw new Error("Checksum không khớp");
      const normalizedImport = normalizeState({ ...payload.state, schemaVersion: importedSchema });
      global.localStorage?.setItem?.(ROLLBACK_STORAGE_KEY, JSON.stringify(normalizeState(instance.state)));
      instance.state = normalizedImport;
      saveState(instance);
      mount(instance.host, { view: "settings" });
      return true;
    } catch (error) { setToast(instance, `Không thể nhập save: ${String(error?.message || "dữ liệu lỗi").slice(0, 80)}`); return false; }
  }

  function restoreRollback(instance) {
    try {
      const currentRollback = global.localStorage?.getItem?.(ROLLBACK_STORAGE_KEY);
      const legacyRollback = global.localStorage?.getItem?.(LEGACY_ROLLBACK_STORAGE_KEY);
      const previous = currentRollback || legacyRollback;
      if (!previous) { setToast(instance, "Chưa có phiên bản trước để khôi phục"); return false; }
      const current = normalizeState(instance.state);
      const parsed = JSON.parse(previous);
      instance.state = normalizeState({ ...parsed, schemaVersion: Number(parsed?.schemaVersion) || (currentRollback ? SCHEMA_VERSION : 3) });
      global.localStorage?.setItem?.(ROLLBACK_STORAGE_KEY, JSON.stringify(current));
      saveState(instance); mount(instance.host, { view: "settings" }); return true;
    } catch { setToast(instance, "Phiên bản trước không thể đọc được"); return false; }
  }

  function activeSurface(instance) {
    const booting3D = Boolean(instance?.rendererBooting && instance?.canvas3d && !instance.canvas3d.hidden);
    return instance?.renderer3d || booting3D ? instance?.canvas3d : instance?.canvas;
  }

  const focusSurface = (instance) => activeSurface(instance)?.focus?.({ preventScroll: true });

  function reconcileGameplaySurface(instance) {
    const surface = activeSurface(instance);
    const lockedSurface = global.document?.pointerLockElement;
    if (instance?.running && lockedSurface && lockedSurface !== surface) {
      pauseGame(instance, "renderer-changed");
      return false;
    }
    focusSurface(instance);
    return Boolean(surface);
  }

  const qualityLabel = (quality) => quality === "personal"
    ? PERSONAL_QUALITY_PROFILE.label
    : RENDERER_3D?.QUALITY_PROFILES?.[quality]?.label || quality || "Cân bằng";
  const qualityForCore = (quality) => RENDERER_3D?.QUALITY_PROFILES?.[quality]
    ? quality
    : quality === "personal" ? "cinematic" : quality;
  const focalLengthToFov = (millimeters) => 2 * Math.atan(24 / (2 * clamp(millimeters, 18, 200))) * 180 / Math.PI;
  function photoRendererSettings(settings) {
    const focalLength = clamp(settings.photoFocalLength, 18, 200);
    const exposureCompensation = clamp(settings.photoExposureComp, -5, 5);
    return {
      focalLength,
      fovDegrees: focalLengthToFov(focalLength),
      aperture: clamp(settings.photoAperture, 1.4, 16),
      shutterSeconds: 1 / clamp(settings.photoShutter, 15, 8000),
      shutterSpeed: clamp(settings.photoShutter, 15, 8000),
      iso: clamp(settings.photoIso, 50, 6400),
      exposureCompensation,
      depthOfField: true,
      autofocus: settings.photoAutofocus,
      focusDistance: clamp(settings.photoFocusDistance, .3, 500),
      composition: settings.photoComposition,
      crop: settings.photoCrop,
      cameraShake: clamp(settings.photoShake, 0, 100) / 100
    };
  }

  function syncPhotoComposition(instance) {
    if (!instance?.root) return;
    const settings = instance.state.settings;
    instance.root.dataset.photoComposition = settings.photoComposition;
    instance.root.dataset.photoCrop = settings.photoCrop;
    const grid = instance.root.querySelector("[data-hwe-photo-composition]");
    const crop = instance.root.querySelector("[data-hwe-photo-crop]");
    if (grid) grid.hidden = !instance.photoMode || settings.photoComposition === "off";
    if (crop) crop.hidden = !instance.photoMode || settings.photoCrop === "native";
  }

  function showRendererFallback(instance, message) {
    const panel = instance.root?.querySelector?.("[data-hwe-render-fallback]");
    const copy = panel?.querySelector?.("[data-hwe-render-fallback-copy]");
    if (!panel) return false;
    if (copy && message) copy.textContent = String(message).slice(0, 180);
    panel.hidden = false;
    return true;
  }

  function setRendererStatus(instance, label, loadingCopy) {
    const status = instance.root?.querySelector?.("[data-hwe-render-status]");
    const toggleLabel = instance.root?.querySelector?.("[data-hwe-render-label]");
    const loading = instance.root?.querySelector?.("[data-hwe-render-loading]");
    const loadingText = instance.root?.querySelector?.("[data-hwe-render-loading-copy]");
    if (status) status.textContent = String(label || "Canvas 2D Lite").slice(0, 64);
    if (toggleLabel) toggleLabel.textContent = "3D";
    const quickToggle = instance.root?.querySelector?.(".hwe-render-toggle");
    if (quickToggle) {
      const loading3D = Boolean(loadingCopy);
      quickToggle.setAttribute("aria-label", loading3D ? "Hủy tải 3D" : "Chế độ 3D");
      quickToggle.setAttribute("aria-busy", String(loading3D));
      quickToggle.title = loading3D ? "Hủy tải 3D và giữ Canvas Lite" : instance.renderer3d ? "Tắt 3D và chuyển sang Canvas Lite" : "Bật Babylon 3D";
    }
    if (loadingText && loadingCopy) loadingText.textContent = String(loadingCopy).slice(0, 96);
    if (loading) loading.hidden = !loadingCopy;
    instance.root?.classList?.toggle?.("is-render-loading", Boolean(loadingCopy));
  }

  function syncAddressForSpecies(instance, speciesId = instance.state.speciesId) {
    if (!RENDERER_3D?.createWorldAddress) return instance.state.worldAddress;
    const current = RENDERER_3D.createWorldAddress({
      ...(instance.state.worldAddress || {}),
      realmId: instance.state.realmId,
      seed: worldSeedForState(instance.state)
    });
    if (instance.state.settings.convergence || RENDERER_3D.isSpeciesAllowedAtAddress?.(speciesId, current, false)) {
      instance.state.worldAddress = current;
      return current;
    }
    const cartridge = RENDERER_3D.SPECIES_CARTRIDGES?.[speciesId];
    const desired = cartridge
      ? RENDERER_3D.addressForSpecies(speciesId, worldSeedForState(instance.state))
      : RENDERER_3D.createWorldAddress({ realmId: instance.state.realmId, seed: worldSeedForState(instance.state) });
    instance.state.worldAddress = RENDERER_3D.createWorldAddress({
      ...desired,
      realmId: instance.state.realmId,
      seed: worldSeedForState(instance.state),
      chunkX: current.chunkX,
      chunkZ: current.chunkZ
    });
    return instance.state.worldAddress;
  }

  const reduced3DPreference = (instance) => {
    let operatingSystemPrefersReducedMotion = false;
    try { operatingSystemPrefersReducedMotion = Boolean(global.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches); } catch {}
    return instance.state.settings.motion === "static" || operatingSystemPrefersReducedMotion ||
      Boolean(global.document?.documentElement?.classList?.contains?.("app-reduce-motion") || global.document?.body?.classList?.contains?.("app-reduce-motion"));
  };

  function syncRendererControls(instance, mode) {
    const is3D = mode === "3d";
    instance.root?.querySelectorAll?.("[data-hwe-renderer]").forEach((button) => {
      const active = button.dataset.hweRenderer === (is3D ? "3d" : "lite");
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", String(active));
    });
  }

  function scheduleLiteFallback(instance, message, bootToken) {
    if (!instance || instance.destroyed || instance.liteFallbackPending || (bootToken != null && bootToken !== instance.rendererBootToken)) return;
    instance.liteFallbackPending = true;
    (global.setTimeout || setTimeout)(() => {
      instance.liteFallbackPending = false;
      if (instance.destroyed || (bootToken != null && bootToken !== instance.rendererBootToken)) return;
      disable3D(instance, true);
      showRendererFallback(instance, message || "Asset hoặc GPU 3D không sẵn sàng. Canvas Lite và model thay thế đang tiếp tục vòng đời.");
      setToast(instance, message || "Renderer 3D đã dừng an toàn; Canvas 2D Lite đang hoạt động");
    }, 0);
  }

  async function createRendererRuntime(instance, species, bootToken) {
    const qualityToAdapter = { static: "low", light: "low", balanced: "balanced", high: "high", cinematic: "ultra", personal: "cinematic" };
    const adaptiveQuality = instance.state.settings.quality !== "personal" && instance.state.settings.adaptiveQuality;
    const renderSeed = rendererSeedForState(instance.state);
    if (RENDERER_ADAPTER?.FLAGSHIP_IDS?.includes?.(species.id) && typeof RENDERER_ADAPTER.createRenderer === "function") {
      let lastEnvironment = "";
      let lastTelemetry = null;
      const cinematicRuntimeAssets = await prepareCinematicRuntimeAssets(instance);
      let cinematicUrlsReleased = false;
      const releaseCinematicUrls = () => {
        if (cinematicUrlsReleased) return;
        cinematicUrlsReleased = true;
        for (const url of cinematicRuntimeAssets.urls) instance.cinematicPackManager?.releaseAssetUrl?.(url);
      };
      const adapter = RENDERER_ADAPTER.createRenderer({
        canvas: instance.canvas3d,
        container: instance.root.querySelector("[data-hwe-viewport]"),
        speciesId: species.id,
        playerX: instance.state.player.x,
        playerZ: instance.state.player.y,
        seed: renderSeed,
        realmId: instance.state.realmId,
        timeSliceId: instance.state.worldAddress?.timeSliceId,
        regionId: instance.state.worldAddress?.regionId,
        worker: instance.state.settings.worker,
        // Prefer WebGPU, then let the guarded adapter rebuild a clean canvas
        // and fall back to WebGL2 before Canvas Lite if a driver rejects it.
        backend: "auto",
        qualityPreset: qualityToAdapter[instance.state.settings.quality] || "balanced",
        adaptiveQuality: adaptiveQuality,
        reducedMotion: reduced3DPreference(instance) ? true : "auto",
        cinematicCreatureAssets: cinematicRuntimeAssets.creatures,
        cinematicEnvironmentAssets: cinematicRuntimeAssets.environment,
        cinematicTerrainAssets: cinematicRuntimeAssets.terrain,
        cinematicOceanAssets: cinematicRuntimeAssets.ocean,
        cinematicWeatherAssets: cinematicRuntimeAssets.weather,
        cinematicAudioAssets: cinematicRuntimeAssets.audio,
        ambientAudioEnabled: instance.state.settings.sound,
        ambientAudioVolume: clamp(instance.state.settings.soundVolume, 0, 100) / 100,
        isCancelled: () => instance.destroyed || bootToken !== instance.rendererBootToken,
        allowRemoteBabylon: false,
        replaceCanvasOnFallback: true,
        localBabylonUrl: RENDERER_3D?.BABYLON_URL,
        onCanvasReplaced: (detail) => {
          if (!detail?.canvas || detail.previous !== instance.canvas3d) return;
          // A WebGPU timeout can replace the bound canvas after the user has
          // already cancelled startup. Keep the host reference connected so a
          // later 3D retry never reuses the detached, GPU-bound canvas.
          const replacedLockedSurface = global.document?.pointerLockElement === detail.previous;
          instance.canvas3d = detail.canvas;
          detail.canvas.tabIndex = 0;
          if (instance.destroyed || bootToken !== instance.rendererBootToken) detail.canvas.hidden = true;
          else if (replacedLockedSurface && instance.running) pauseGame(instance, "renderer-canvas-replaced");
        },
        onStatus: (detail) => {
          const canRetrySceneInWebGL = detail?.reason?.stage === "scene" && detail?.reason?.details?.failedBackend === "webgpu";
          if (detail?.status === "failed" && !canRetrySceneInWebGL) scheduleLiteFallback(instance, "Renderer 3D gặp lỗi; đã chuyển sang Lite Mode", bootToken);
        },
        onTelemetry: (telemetry) => { lastTelemetry = telemetry; }
      });
      instance.rendererStartingAdapter = adapter;
      let started;
      try { started = await adapter.start({ canvas: instance.canvas3d, allowRemoteBabylon: false, timeoutMs: 12000 }); }
      finally { if (instance.rendererStartingAdapter === adapter) instance.rendererStartingAdapter = null; }
      const webGPUSceneFailure = !started?.ok && started?.reason?.stage === "scene" &&
        started?.reason?.details?.failedBackend === "webgpu";
      if (webGPUSceneFailure && !instance.destroyed && bootToken === instance.rendererBootToken) {
        setRendererStatus(instance, "Đang thử lại bằng WebGL2…", "WebGPU dựng scene không ổn định; đang khôi phục bằng canvas sạch");
        instance.rendererStartingAdapter = adapter;
        try { started = await adapter.start({ canvas: instance.canvas3d, backend: "webgl", allowRemoteBabylon: false, timeoutMs: 12000 }); }
        finally { if (instance.rendererStartingAdapter === adapter) instance.rendererStartingAdapter = null; }
      }
      if (instance.destroyed || bootToken !== instance.rendererBootToken) {
        adapter.dispose();
        releaseCinematicUrls();
        throw Object.assign(new Error("Renderer startup was cancelled"), { code: "RENDERER_START_CANCELLED" });
      }
      if (!started?.ok) { adapter.dispose(); releaseCinematicUrls(); throw new Error(started?.reason?.message || "Babylon adapter could not start"); }
      if (adapter.canvas) instance.canvas3d = adapter.canvas;
      return Object.freeze({
        backend: started.backend,
        personalQualityAlias: true,
        sync(snapshot = {}) {
          adapter.setPlayerState({ speciesId: snapshot.speciesId, x: snapshot.player?.x, z: snapshot.player?.y, heading: -(snapshot.heading || 0), elevation: snapshot.speciesId === "pteranodon" ? 12 : 0 });
          const occupied = new Set([snapshot.speciesId]);
          (snapshot.population || []).forEach((creature) => {
            const id = creature.species?.id || creature.speciesId;
            if (!RENDERER_ADAPTER.FLAGSHIP_IDS.includes(id) || occupied.has(id)) return;
            occupied.add(id); adapter.updateFlagship(id, { x: creature.x, z: creature.y, heading: -Math.atan2(creature.vy || 0, creature.vx || 0), visible: creature.alive !== false });
          });
          RENDERER_ADAPTER.FLAGSHIP_IDS.forEach((id) => {
            if (!occupied.has(id)) adapter.updateFlagship(id, { visible: false });
          });
          const environmentKey = `${Math.floor(snapshot.world?.day || 0)}:${snapshot.world?.weather?.type || "clear"}`;
          if (environmentKey !== lastEnvironment) { lastEnvironment = environmentKey; adapter.setEnvironment({ hour: snapshot.world?.day || 12, weather: snapshot.world?.weather?.type || "clear", fog: true }); }
          if (snapshot.paused) adapter.pause("host"); else if (adapter.status === "paused") adapter.resume("host");
          return true;
        },
        resize() { adapter.engine?.resize?.(); },
        setPaused(value) { return value ? adapter.pause("host") : adapter.resume("host"); },
        applyCameraInput(value) { return adapter.setGameplayCamera?.({ ...value, cameraShake: value?.shake }); },
        getCameraState() { return adapter.getGameplayCamera?.(); },
        resolveCameraCollision(value) {
          const result = adapter.resolveGameplayCameraCollision?.({ ...value, deltaSeconds: 1 / 60 });
          return result ? { ...result, distance: result.hit ? result.hitDistance : null } : null;
        },
        setHighlightedTarget(value) { return value ? adapter.setHighlightedTarget?.(value) : adapter.clearHighlightedTarget?.(); },
        pickCenter(value) { return adapter.pickCenter?.(value) || null; },
        setQuality(value) { adapter.setQualityPreset(qualityToAdapter[value] || "balanced"); return value; },
        setMotion(value) { adapter.setReducedMotion(value === "static" || reduced3DPreference(instance) ? true : "auto"); return value; },
        setAudio(enabled, volume) { return adapter.setAmbientAudio?.(enabled, clamp(volume, 0, 1)); },
        getStatus() { const telemetry = lastTelemetry || adapter.getTelemetry(); const observedQuality = ({ low: "light", balanced: "balanced", high: "high", ultra: "cinematic", cinematic: "personal" })[telemetry.qualityPreset] || "balanced"; return { backend: adapter.backend, quality: instance.state.settings.quality === "personal" ? "personal" : observedQuality, fps: telemetry.fps, chunks: telemetry.activeChunks, wildlife: telemetry.proxySpecies?.length || 0, address: instance.state.worldAddress, drawCalls: telemetry.drawCalls, triangles: telemetry.triangles, estimatedVramMiB: telemetry.estimatedVramMiB, vramWarning: telemetry.estimatedVramMiB >= 6144, landscapeWorker: telemetry.landscapeWorker, proceduralEnvironment: telemetry.proceduralEnvironment }; },
        capture(options = {}) { return adapter.capture("image/png", options); },
        setPhotoSettings(value) { return adapter.setPhotoSettings?.(value); },
        dispose() { const result = adapter.dispose()?.ok !== false; releaseCinematicUrls(); return result; }
      });
    }
    return RENDERER_3D.createRuntime(instance.canvas3d, {
      backend: "webgl2",
      speciesId: species.id,
      speciesColor: species.color,
      seed: worldSeedForState(instance.state),
      quality: reduced3DPreference(instance) ? "static" : qualityForCore(instance.state.settings.quality),
      reducedMotion: reduced3DPreference(instance),
      adaptiveQuality: adaptiveQuality,
      isCancelled: () => instance.destroyed || bootToken !== instance.rendererBootToken,
      timeoutMs: 12000,
      address: instance.state.worldAddress,
      onTelemetry: (event) => { if (event?.type === "webgpu-init-failed") setRendererStatus(instance, "Đang chuyển sang WebGL2…", "WebGPU không khởi tạo được; đang dùng fallback WebGL"); },
      onQualityChange: (sample) => {
        if (sample.quality === "personal" && instance.state.settings.quality !== "personal") return;
        if (instance.state.settings.quality !== "personal") instance.state.settings.quality = sample.quality;
        setRendererStatus(instance, `${instance.renderer3d?.backend?.toUpperCase?.() || "3D"} · ${sample.profile.label}`);
      },
      onFailure: () => { scheduleLiteFallback(instance, "3D gặp lỗi render; đã tự chuyển sang Lite Mode", bootToken); }
    });
  }

  async function enable3D(instance, persist = true) {
    if (!instance?.canvas3d || instance.renderer3d || instance.rendererBooting) return Boolean(instance?.renderer3d);
    if (typeof RENDERER_3D?.createRuntime !== "function") { setToast(instance, "3D core chưa được tải; Lite Mode vẫn hoạt động"); return false; }
    const bootToken = (instance.rendererBootToken || 0) + 1;
    instance.rendererBootToken = bootToken;
    instance.rendererBooting = true;
    instance.canvas3d.hidden = false;
    setRendererStatus(instance, "Đang khởi tạo 3D…", "Đang tải Babylon.js cùng website và kiểm tra GPU");
    try {
      const species = SPECIES_BY_ID.get(instance.state.speciesId);
      syncAddressForSpecies(instance);
      const runtime = await createRendererRuntime(instance, species, bootToken);
      // rendererBootToken is the authoritative cancellation signal. The saved
      // preference may still be "lite" while an explicit user retry is booting;
      // treating that preference as cancellation made Lite -> 3D impossible.
      if (instance.destroyed || bootToken !== instance.rendererBootToken) { runtime.dispose(); return false; }
      instance.renderer3d = runtime;
      instance.root.dataset.renderer = runtime.backend;
      const fallbackPanel = instance.root.querySelector("[data-hwe-render-fallback]");
      if (fallbackPanel) fallbackPanel.hidden = true;
      instance.canvas.hidden = true;
      instance.canvas3d.hidden = false;
      instance.rendererViewportSize = { width: instance.canvas3d.clientWidth, height: instance.canvas3d.clientHeight };
      syncRendererControls(instance, "3d");
      if (persist) { instance.state.settings.renderer = "3d"; saveState(instance); }
      setRendererStatus(instance, `${runtime.backend.toUpperCase()} · ${qualityLabel(instance.state.settings.quality)}`);
      // The renderer already owns responsive sizing. A second resize here can
      // invalidate Chromium's first WebGPU swap-buffer while it is submitted.
      updateGameplayCamera(instance, 1 / 60);
      reconcileGameplaySurface(instance);
      setToast(instance, `EonWild 3D đã sẵn sàng bằng ${runtime.backend.toUpperCase()}`);
      return true;
    } catch (error) {
      if (instance.destroyed || bootToken !== instance.rendererBootToken) return false;
      instance.canvas3d.hidden = true;
      instance.canvas.hidden = false;
      instance.root.dataset.renderer = "lite";
      syncRendererControls(instance, "lite");
      instance.state.settings.renderer = "lite";
      saveState(instance);
      setRendererStatus(instance, "Canvas 2D Lite");
      showRendererFallback(instance, `Không thể dựng 3D (${String(error?.message || "GPU không tương thích").slice(0, 96)}). Canvas Lite đang dùng model thay thế và save vẫn an toàn.`);
      setToast(instance, `3D không khởi tạo: ${String(error?.message || "GPU không tương thích").slice(0, 92)}. Đã dùng Lite Mode.`);
      reconcileGameplaySurface(instance);
      return false;
    } finally {
      if (bootToken === instance.rendererBootToken) {
        instance.rendererBooting = false;
        setRendererStatus(instance, instance.renderer3d ? `${instance.renderer3d.backend.toUpperCase()} · ${qualityLabel(instance.state.settings.quality)}` : "Canvas 2D Lite");
      }
    }
  }

  function setRuntimeQuality(instance, quality) {
    if (!instance?.renderer3d?.setQuality) return false;
    const value = instance.renderer3d.personalQualityAlias ? quality : qualityForCore(quality);
    instance.renderer3d.setQuality(value);
    return true;
  }

  function disable3D(instance, persist = true) {
    const rendererWasLocked = global.document?.pointerLockElement === instance.canvas3d;
    instance.rendererBootToken = (instance.rendererBootToken || 0) + 1;
    instance.rendererBooting = false;
    instance.rendererStartingAdapter?.dispose?.();
    instance.rendererStartingAdapter = null;
    instance.renderer3d?.dispose?.();
    instance.renderer3d = null;
    if (instance.canvas3d) instance.canvas3d.hidden = true;
    if (instance.canvas) instance.canvas.hidden = false;
    instance.root.dataset.renderer = "lite";
    instance.rendererViewportSize = null;
    syncRendererControls(instance, "lite");
    if (persist) { instance.state.settings.renderer = "lite"; saveState(instance); }
    setRendererStatus(instance, "Canvas 2D Lite");
    resizeCanvas(instance);
    if (rendererWasLocked && instance.running) pauseGame(instance, "renderer-changed");
    else focusSurface(instance);
    return true;
  }

  function previewGenes(instance) {
    const panel = instance.root.querySelector("[data-hwe-gene-preview-panel]");
    if (!panel) return;
    const seed = `${instance.state.settings.seed}:preview:${instance.state.player.generation}:${instance.state.lineage.length}`;
    let genes = normalizeGenes(instance.state.player.genes, hashSeed(seed));
    if (typeof CONTENT?.inheritGenes === "function") {
      try { genes = CONTENT.inheritGenes(instance.state.player.genes, instance.state.player.genes, { seed, mutationRate: .08, mutationStrength: .22 }); } catch {}
    }
    panel.innerHTML = `<small>NEST FORECAST · KHÔNG GHI SAVE</small><h3>Thế hệ ${instance.state.player.generation + 1}</h3><p>Biến thể xác định theo seed; chỉ lưu khi tạo tổ thật.</p><div>${Object.entries(genes).slice(0, 6).map(([key, value]) => `<span><i style="--gene:${genePercent(key, value)}"></i><b>${escapeHtml(geneLabel(key))}</b><em>${Math.round(genePercent(key, value))}%</em></span>`).join("")}</div>`;
  }

  function setCommunicationWheel(instance, open) {
    const wheel = instance.root.querySelector("[data-hwe-communication-wheel]");
    if (!wheel) return false;
    if (open && !instance.running) return false;
    wheel.hidden = !open;
    instance.root.querySelectorAll("[data-hwe-communication-open]").forEach((button) => button.setAttribute("aria-expanded", String(open)));
    if (open) {
      pauseGame(instance, "communication");
      instance.root.querySelector("[data-hwe-pause-overlay]")?.setAttribute("hidden", "");
      wheel.querySelector("button:not([disabled])")?.focus?.({ preventScroll: true });
    }
    else {
      instance.root.querySelector("[data-hwe-pause-overlay]")?.removeAttribute("hidden");
      instance.root.querySelector("[data-hwe-resume]")?.focus?.({ preventScroll: true });
    }
    return true;
  }

  function gameOverlayMarkup(instance, mode) {
    const species = SPECIES_BY_ID.get(instance.state.speciesId);
    if (mode === "codex") {
      const flagship = flagshipFor(species.id);
      return `<article class="hwe-overlay-codex"><span class="hwe-creature-sigil" style="--species:${escapeHtml(species.color)}">◆</span><small>${escapeHtml(species.period)} · ${escapeHtml(REALMS[instance.state.realmId]?.label || instance.state.realmId)}</small><h3>${escapeHtml(species.vietnamese)}</h3><em>${escapeHtml(species.name)}</em><dl><div><dt>Khẩu phần</dt><dd>${escapeHtml(dietLabel(species.diet))}</dd></div><div><dt>Khối lượng</dt><dd>${escapeHtml(formatMass(species.mass))}</dd></div><div><dt>Vận động</dt><dd>${escapeHtml(species.locomotion)}</dd></div><div><dt>Giác quan</dt><dd>${escapeHtml(mechanicLabel(flagship?.sense, species.ability))}</dd></div><div><dt>Năng lực</dt><dd>${escapeHtml(mechanicLabel(flagship?.defense?.special || flagship?.activeAbility, species.ability))}</dd></div></dl><p>Codex in-game không đổi route và không thu nhỏ canvas. Tiếp tục game từ Pause khi đã đọc xong.</p></article>`;
    }
    if (mode === "settings") {
      return `<article class="hwe-overlay-settings"><h3>Camera & điều khiển</h3><label>Độ nhạy ngang <output>${Math.round(instance.state.settings.cameraSensitivityX)}%</output><input type="range" min="1" max="100" value="${instance.state.settings.cameraSensitivityX}" data-hwe-camera-setting="cameraSensitivityX"></label><label>Độ nhạy dọc <output>${Math.round(instance.state.settings.cameraSensitivityY)}%</output><input type="range" min="1" max="100" value="${instance.state.settings.cameraSensitivityY}" data-hwe-camera-setting="cameraSensitivityY"></label><label>FOV <output>${Math.round(instance.state.settings.cameraFov)}°</output><input type="range" min="45" max="105" value="${instance.state.settings.cameraFov}" data-hwe-camera-setting="cameraFov"></label><label>Độ mượt <output>${Math.round(instance.state.settings.cameraSmoothing)}%</output><input type="range" min="0" max="100" value="${instance.state.settings.cameraSmoothing}" data-hwe-camera-setting="cameraSmoothing"></label><label><input type="checkbox" data-hwe-setting="invertCameraY" ${instance.state.settings.invertCameraY ? "checked" : ""}> Đảo trục Y</label><label>Góc nhìn<select data-hwe-setting="viewMode"><option value="third-person" ${instance.state.settings.viewMode === "third-person" ? "selected" : ""}>Góc nhìn thứ ba</option><option value="animal-eye" ${instance.state.settings.viewMode === "animal-eye" ? "selected" : ""}>Animal-eye</option></select></label><p><kbd>WASD</kbd> di chuyển theo camera · <kbd>V</kbd> đổi góc nhìn · <kbd>Z</kbd> khóa mục tiêu · <kbd>Esc</kbd> Pause.</p></article>`;
    }
    const map = WORLD_ATLAS?.getMap?.(instance.state.atlasMapId);
    return `<article class="hwe-overlay-map"><div><small>WORLD ATLAS · KHÔNG RỜI GAMEPLAY</small><h3>${escapeHtml(map?.label || REALMS[instance.state.realmId]?.label || "Thế giới sống")}</h3><p>${escapeHtml(map?.range || instance.state.worldAddress?.timeSliceId || "Time Slice hiện tại")} · ${escapeHtml(instance.state.atlasRegionId || instance.state.worldAddress?.regionId || "active region")}</p><p>Vị trí logic ${Math.round(instance.state.player.x).toLocaleString("vi-VN")} : ${Math.round(instance.state.player.y).toLocaleString("vi-VN")} m. Sương khám phá không tự tiết lộ loài quý hiếm.</p></div><canvas width="420" height="420" data-hwe-overlay-map-canvas aria-label="Bản đồ khu vực đang chơi"></canvas></article>`;
  }

  function drawGameOverlayMap(instance) {
    const canvas = instance.root.querySelector("[data-hwe-overlay-map-canvas]");
    const ctx = canvas?.getContext?.("2d");
    if (!ctx || !instance.world) return false;
    const size = canvas.width;
    ctx.fillStyle = "#061310"; ctx.fillRect(0, 0, size, size);
    for (let x = 0; x < size; x += 20) for (let y = 0; y < size; y += 20) {
      const worldX = x / size * WORLD_SIZE; const worldY = y / size * WORLD_SIZE;
      const terrain = terrainForRealm(terrainAt(worldX, worldY, instance.world.seed), instance.state.realmId, worldX, worldY);
      ctx.fillStyle = BIOMES[terrain].color; ctx.fillRect(x, y, 21, 21);
    }
    ctx.strokeStyle = "#ffd367"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(instance.world.migration.x / WORLD_SIZE * size, instance.world.migration.y / WORLD_SIZE * size, Math.max(4, instance.world.migration.radius / WORLD_SIZE * size), 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(instance.state.player.x / WORLD_SIZE * size, instance.state.player.y / WORLD_SIZE * size, 6, 0, Math.PI * 2); ctx.fill();
    return true;
  }

  function openGameOverlay(instance, mode = "map") {
    if (!instance?.running) return false;
    const requested = ["map", "codex", "settings"].includes(mode) ? mode : "map";
    const activeElement = global.document?.activeElement;
    instance.gameOverlayReturnFocus = activeElement?.matches?.("[data-hwe-game-overlay-open]")
      ? activeElement
      : null;
    const status = gameplayStateName(instance);
    if (requested === "map" && ["playing", "paused"].includes(status)) transitionGameplay(instance, { type: "OPEN_MAP" });
    else if (requested === "codex" && ["playing", "paused"].includes(status)) transitionGameplay(instance, { type: "OPEN_CODEX" });
    else if (status === "playing") transitionGameplay(instance, { type: "PAUSE" });
    instance.paused = true;
    instance.inputSystem?.pause?.("gameplay-state");
    instance.renderer3d?.setPaused?.(true);
    releasePointerLock(instance, true);
    const overlay = instance.root.querySelector("[data-hwe-game-overlay]");
    const title = overlay?.querySelector?.("[data-hwe-game-overlay-title]");
    const kicker = overlay?.querySelector?.("[data-hwe-game-overlay-kicker]");
    const body = overlay?.querySelector?.("[data-hwe-game-overlay-body]");
    if (!overlay || !body) return false;
    instance.gameOverlayMode = requested;
    if (title) title.textContent = requested === "map" ? "World Map" : requested === "codex" ? "Animal Codex" : "Camera & điều khiển";
    if (kicker) kicker.textContent = requested === "map" ? "MAP CONTEXT" : requested === "codex" ? "CODEX CONTEXT" : "PAUSE CONTEXT";
    body.innerHTML = gameOverlayMarkup(instance, requested);
    instance.root.querySelector("[data-hwe-pause-overlay]")?.setAttribute("hidden", "");
    overlay.hidden = false;
    overlay.querySelector("[data-hwe-game-overlay-close]")?.focus?.({ preventScroll: true });
    if (requested === "map") drawGameOverlayMap(instance);
    return true;
  }

  function closeGameOverlay(instance) {
    const overlay = instance.root.querySelector("[data-hwe-game-overlay]");
    if (overlay) overlay.hidden = true;
    const status = gameplayStateName(instance);
    if (status === "map") transitionGameplay(instance, { type: "CLOSE_MAP" });
    else if (status === "codex") transitionGameplay(instance, { type: "CLOSE_CODEX" });
    if (gameplayStateName(instance) === "playing") transitionGameplay(instance, { type: "PAUSE" });
    instance.paused = true;
    instance.root.classList.add("is-paused");
    instance.root.querySelector("[data-hwe-pause-overlay]")?.removeAttribute("hidden");
    const returnFocus = instance.gameOverlayReturnFocus;
    instance.gameOverlayReturnFocus = null;
    if (returnFocus?.isConnected && instance.root.contains(returnFocus)) returnFocus.focus?.({ preventScroll: true });
    else instance.root.querySelector("[data-hwe-resume]")?.focus?.({ preventScroll: true });
    return true;
  }

  function setPhotoMode(instance, open) {
    const overlay = instance.root.querySelector("[data-hwe-photo-overlay]");
    if (!overlay) return false;
    if (open && !instance.running) { setToast(instance, "Hãy bắt đầu vòng đời trước khi mở Photo Mode."); return false; }
    overlay.hidden = !open;
    instance.root.classList.toggle("is-photo-mode", open);
    instance.photoMode = open;
    if (open) {
      if (["playing", "paused"].includes(gameplayStateName(instance))) transitionGameplay(instance, { type: "ENTER_PHOTO" });
      instance.paused = true;
      instance.inputSystem?.pause?.("gameplay-state");
      releasePointerLock(instance, true);
      instance.root.querySelector("[data-hwe-pause-overlay]")?.setAttribute("hidden", "");
      instance.root.querySelector("[data-hwe-game-overlay]")?.setAttribute("hidden", "");
      instance.root.querySelector("[data-hwe-communication-wheel]")?.setAttribute("hidden", "");
      instance.renderer3d?.setPaused?.(false);
      instance.renderer3d?.setPhotoSettings?.(photoRendererSettings(instance.state.settings));
      syncPhotoComposition(instance);
      overlay.querySelector("[data-hwe-photo-close]")?.focus?.({ preventScroll: true });
    }
    else {
      if (gameplayStateName(instance) === "photo") transitionGameplay(instance, { type: "EXIT_PHOTO" });
      if (gameplayStateName(instance) === "playing") transitionGameplay(instance, { type: "PAUSE" });
      instance.paused = true;
      syncPhotoComposition(instance);
      instance.renderer3d?.setPaused?.(true);
      instance.root.classList.add("is-paused");
      instance.root.querySelector("[data-hwe-pause-overlay]")?.removeAttribute("hidden");
      instance.root.querySelector("[data-hwe-resume]")?.focus?.({ preventScroll: true });
    }
    return true;
  }

  function capturePhoto(instance) {
    const surface = activeSurface(instance);
    if (!surface) return false;
    const filename = `hh-eonwild-${instance.state.speciesId}-${Date.now()}.png`;
    if (instance.renderer3d?.capture) {
      instance.renderer3d.capture({ width: 3840, height: 2160 }).then((blob) => {
        if (blob && downloadLocalFile(instance, filename, blob, "image/png")) setToast(instance, "Đã chụp PNG 4K từ renderer 3D thật");
      }).catch(() => setToast(instance, "Không thể chụp frame 3D trên thiết bị này"));
      return true;
    }
    if (typeof surface.toBlob === "function") {
      surface.toBlob((blob) => {
        if (blob && downloadLocalFile(instance, filename, blob, "image/png")) setToast(instance, "Đã chụp PNG từ vòng chơi thật");
      }, "image/png");
      return true;
    }
    try {
      const anchor = global.document.createElement("a"); anchor.download = filename; anchor.href = surface.toDataURL("image/png"); anchor.click(); setToast(instance, "Đã chụp PNG"); return true;
    } catch { setToast(instance, "Thiết bị không hỗ trợ chụp canvas"); return false; }
  }

  function drawObserver(instance, requestedIndex = 0) {
    const canvas = instance.root.querySelector("[data-hwe-observer-canvas]");
    const ctx = canvas?.getContext?.("2d");
    if (!ctx) return false;
    const replay = instance.state.replay;
    const index = clamp(requestedIndex, 0, Math.max(0, replay.length - 1));
    const width = canvas.width; const height = canvas.height;
    ctx.clearRect(0, 0, width, height);
    const gradient = ctx.createLinearGradient(0, 0, width, height); gradient.addColorStop(0, "#071828"); gradient.addColorStop(.52, "#102a35"); gradient.addColorStop(1, "#241733"); ctx.fillStyle = gradient; ctx.fillRect(0, 0, width, height);
    ctx.strokeStyle = "rgba(115,239,205,.12)"; ctx.lineWidth = 1;
    for (let x = 0; x <= width; x += 72) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke(); }
    for (let y = 0; y <= height; y += 65) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke(); }
    const heatmap = instance.state.heatmap || [];
    const heatMax = Math.max(1, ...heatmap.map((cell) => Number(cell.value) || 0));
    const heatCellSize = instance.state.heatmapCellSize || 64;
    heatmap.forEach((cell) => {
      const worldX = (Number(cell.x) + .5) * heatCellSize;
      const worldY = (Number(cell.y) + .5) * heatCellSize;
      const x = worldX / WORLD_SIZE * width; const y = worldY / WORLD_SIZE * height;
      const intensity = clamp(Number(cell.value) / heatMax, 0, 1);
      const radius = 10 + intensity * 34;
      const glow = ctx.createRadialGradient(x, y, 0, x, y, radius);
      glow.addColorStop(0, `rgba(255,93,188,${.18 + intensity * .42})`);
      glow.addColorStop(.58, `rgba(255,194,91,${.08 + intensity * .18})`);
      glow.addColorStop(1, "rgba(85,230,255,0)");
      ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(x, y, radius, 0, Math.PI * 2); ctx.fill();
    });
    if (replay.length) {
      const visible = replay.slice(0, index + 1);
      const points = visible.map((sample) => ({ x: sample.x / WORLD_SIZE * width, y: sample.y / WORLD_SIZE * height, health: sample.health }));
      points.forEach((point, pointIndex) => { ctx.fillStyle = `rgba(255,91,184,${.03 + pointIndex / Math.max(1, points.length) * .11})`; ctx.beginPath(); ctx.arc(point.x, point.y, 12 + pointIndex % 5 * 3, 0, Math.PI * 2); ctx.fill(); });
      ctx.strokeStyle = "#6cf0d2"; ctx.lineWidth = 3; ctx.beginPath(); points.forEach((point, pointIndex) => pointIndex ? ctx.lineTo(point.x, point.y) : ctx.moveTo(point.x, point.y)); ctx.stroke();
      const current = points.at(-1); ctx.fillStyle = "#ffe57d"; ctx.shadowColor = "#ffe57d"; ctx.shadowBlur = 18; ctx.beginPath(); ctx.arc(current.x, current.y, 7, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;
    } else { ctx.fillStyle = "#d9f5ef"; ctx.font = "600 20px system-ui"; ctx.textAlign = "center"; ctx.fillText(heatmap.length ? "Heatmap local đã có · chưa đủ điểm để phát replay" : "Hãy chơi một vòng đời để tạo replay và heatmap thật", width / 2, height / 2); }
    const position = instance.root.querySelector("[data-hwe-replay-position]"); if (position) position.textContent = replay.length ? `${Math.round(index) + 1}/${replay.length}` : "0/0";
    return true;
  }

  function initObserver(instance) {
    const scrubber = instance.root.querySelector("[data-hwe-replay-scrubber]");
    if (scrubber) scrubber.max = String(Math.max(0, instance.state.replay.length - 1));
    drawObserver(instance, Number(scrubber?.value || 0));
  }

  function toggleObserverPlayback(instance, button) {
    if (instance.state.replay.length < 2) { setToast(instance, "Chưa đủ dữ liệu replay"); return false; }
    if (instance.observerTimer) { clearInterval(instance.observerTimer); instance.observerTimer = 0; button.textContent = "▶ Phát lại"; return true; }
    const scrubber = instance.root.querySelector("[data-hwe-replay-scrubber]");
    button.textContent = "Ⅱ Tạm dừng";
    instance.observerTimer = setInterval(() => {
      let next = Number(scrubber.value || 0) + 1;
      if (next >= instance.state.replay.length) next = 0;
      scrubber.value = String(next); drawObserver(instance, next);
    }, 240);
    return true;
  }

  function ecologySummary(simulation, season, title, copy) {
    const state = simulation?.getState?.();
    const populations = state?.ledger?.populations || [];
    let preyBiomass = 0; let predatorBiomass = 0;
    populations.forEach((row) => {
      const speciesId = String(row.key || "").split("|").at(-1);
      const species = SPECIES_BY_ID.get(speciesId);
      if (species?.diet === "meat") predatorBiomass += Number(row.biomass || 0);
      else preyBiomass += Number(row.biomass || 0);
    });
    const producerBiomass = (state?.chunks || []).flatMap((chunk) => chunk.resources || []).filter((resource) => resource.type === "plant").reduce((sum, resource) => sum + Number(resource.amount || 0), 0);
    const totalBiomass = Math.max(1, producerBiomass + preyBiomass + predatorBiomass);
    const entities = state?.entities || [];
    const actions = Object.fromEntries(["hunt", "flee", "drink", "feed", "rest", "migrate", "mate", "guardNest"].map((action) => [action, entities.filter((entity) => entity.action === action).length]));
    return {
      season: clamp(season, 0, 9999), updatedAt: Date.now(), title: String(title || "Mùa local").slice(0, 80), copy: String(copy || "Simulation fixed-step hoàn tất.").slice(0, 220),
      producer: producerBiomass / totalBiomass * 100, prey: preyBiomass / totalBiomass * 100, predator: predatorBiomass / totalBiomass * 100,
      apex: Object.values(state?.ledger?.apex || {}).reduce((sum, value) => sum + Number(value || 0), 0), population: entities.length, chunks: state?.chunks?.length || 0, actions
    };
  }

  function simulateEcologySeason(instance, button) {
    if (typeof SIMULATION?.createSimulation !== "function" || button.disabled) { setToast(instance, "Simulation core chưa sẵn sàng"); return false; }
    button.disabled = true; button.textContent = "Đang chạy fixed-step…";
    const schedule = global.setTimeout || setTimeout;
    schedule(() => {
      if (instance.destroyed || instance.controller.signal.aborted) return;
      let simulation;
      try {
        const season = Number(instance.state.ecologySnapshot?.season || 0) + 1;
        const realm = instance.state.settings.convergence ? "convergence" : instance.state.realmId;
        simulation = SIMULATION.createSimulation({ seed: `${instance.state.settings.seed}:season:${season}`, realm, allowCrossRealm: instance.state.settings.convergence, maxChunks: 25, maxEntities: 36, apexCap: 3, viewRadius: 2 });
        const chunks = simulation.streamChunks({ x: WORLD_SIZE / 2, y: WORLD_SIZE / 2, world: true });
        const random = seededRandom(hashSeed(`${instance.state.settings.seed}:${realm}:${season}`));
        const registry = SPECIES.filter((species) => tierForSpecies(species) !== "codex" && speciesAllowedInRealm(species, instance.state.realmId, instance.state.settings.convergence));
        for (let index = 0; index < 32 && registry.length; index += 1) {
          const species = registry[Math.floor(random() * registry.length) % registry.length];
          simulation.addEntity({
            id: `season-${season}-${index}`, speciesId: species.id, name: species.name, diet: species.diet, realm: instance.state.realmId,
            biomes: Object.hasOwn(BIOMES, species.habitat) ? [species.habitat] : (REALMS[instance.state.realmId]?.biomes || ["grassland"]),
            mass: species.mass, speed: Math.max(.5, species.speed), apex: ["tyrannosaurus", "spinosaurus", "orca"].includes(species.id),
            x: 320 + random() * (WORLD_SIZE - 640), y: 320 + random() * (WORLD_SIZE - 640), sex: index % 2 ? "female" : "male",
            maturity: .82 + random() * .18, age: .55 + random() * .35, nest: index % 5 === 0 ? { x: 1700 + random() * 700, y: 1700 + random() * 700 } : null
          });
        }
        const hazardType = instance.state.realmId === "paleozoic" ? "volcano" : instance.state.realmId === "ice-age" ? "flood" : instance.state.realmId === "modern" ? "wildfire" : season % 2 ? "flood" : "volcano";
        simulation.hazards?.trigger?.(hazardType, { x: WORLD_SIZE / 2, y: WORLD_SIZE / 2, radius: 280, intensity: .56 + season % 3 * .08, duration: 18 });
        simulation.runSteps(360);
        const labels = { flood: "Mùa lũ theo chu kỳ", wildfire: "Mùa cháy tái sinh", volcano: "Mùa tro núi lửa" };
        const summary = ecologySummary(simulation, season, labels[hazardType], `${chunks.length} chunk đã stream đúng tọa độ thế giới; ${simulation.getEntities().length} cá thể qua 360 bước AI có Biomass Ledger và apex cap.`);
        instance.state.ecologySnapshot = summary;
        instance.state.eventJournal = [...instance.state.eventJournal, { id: `season-${season}`, label: summary.title, at: summary.updatedAt }].slice(-40);
        saveState(instance);
        simulation.dispose?.(); simulation = null;
        mount(instance.host, { view: "ecosystem" });
      } catch {
        simulation?.dispose?.();
        button.disabled = false; button.textContent = "Thử chạy lại →";
        setToast(instance, "Không thể hoàn tất mùa; save hiện tại không bị thay đổi");
      }
    }, 16);
    return true;
  }

  const packStatusLabel = (status) => ({
    "not-installed": "CHƯA CÀI", installing: "ĐANG CÀI", paused: "ĐÃ TẠM DỪNG", ready: "ĐÃ XÁC MINH", failed: "GÓI LỖI"
  }[status] || "CHƯA CÀI");

  function formatPackBytes(value) {
    const formatter = global.HHEonWildCinematicPacks?.formatBytes;
    if (typeof formatter === "function") return formatter(value);
    const bytes = Math.max(0, Number(value) || 0);
    if (bytes < 1024) return `${Math.round(bytes)} B`;
    if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KiB`;
    if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MiB`;
    return `${(bytes / 1024 ** 3).toFixed(2)} GiB`;
  }

  function updatePackCard(instance, pack = {}) {
    const id = String(pack.packId || pack.id || "");
    const card = instance.root?.querySelector?.(`[data-hwe-pack="${id}"]`);
    if (!card) return false;
    const previous = instance.packStates?.get(id) || {};
    const state = { ...previous, ...(pack.state && typeof pack.state === "object" ? pack.state : {}), ...pack, id };
    instance.packStates?.set(id, state);
    const status = String(state.status || (state.type === "progress" ? "installing" : "not-installed"));
    const loaded = Math.max(0, Number(state.loadedBytes || 0));
    const total = Math.max(0, Number(state.totalBytes || 0));
    const statusNode = card.querySelector("[data-hwe-pack-status]");
    const progress = card.querySelector("[data-hwe-pack-progress]");
    const progressLabel = card.querySelector("[data-hwe-pack-progress-label]");
    const asset = card.querySelector("[data-hwe-pack-asset]");
    const file = card.querySelector("[data-hwe-pack-file]");
    card.dataset.status = status;
    card.setAttribute("aria-busy", String(status === "installing"));
    if (statusNode) statusNode.textContent = packStatusLabel(status);
    if (progress) { progress.max = Math.max(1, total); progress.value = Math.min(loaded, Math.max(1, total)); }
    if (progressLabel) progressLabel.textContent = `${formatPackBytes(loaded)} / ${total ? formatPackBytes(total) : "chưa xác định"}`;
    if (asset) asset.textContent = String(state.label || state.error || (status === "ready" ? `SHA-256 đạt · ${state.storage || "local"}` : "Chờ thao tác")).slice(0, 120);
    if (file && instance.packManifests?.has(id)) {
      const manifest = instance.packManifests.get(id);
      file.textContent = `${manifest.build || "build"} · ${manifest.assets?.length || 0} asset · ${formatPackBytes(manifest.totalBytes)}`;
    }
    const active = status === "installing";
    const install = card.querySelector("[data-hwe-pack-install]");
    const pause = card.querySelector("[data-hwe-pack-pause]");
    const verify = card.querySelector("[data-hwe-pack-verify]");
    const remove = card.querySelector("[data-hwe-pack-remove]");
    if (install) install.disabled = active || !instance.packManifests?.has(id);
    if (pause) pause.disabled = !active;
    if (verify) verify.disabled = active || status !== "ready";
    if (remove) remove.disabled = active || status === "not-installed";
    return true;
  }

  async function refreshPackStorage(instance) {
    const node = instance.root?.querySelector?.("[data-hwe-pack-storage]");
    if (!node || !instance.cinematicPackManager) return;
    try {
      const estimate = await instance.cinematicPackManager.storageEstimate();
      if (instance.destroyed) return;
      node.textContent = `${estimate.opfs ? "OPFS" : "Cache fallback"} · ${formatPackBytes(estimate.usage)} / ${estimate.quota ? formatPackBytes(estimate.quota) : "quota chưa báo"}${estimate.persisted ? " · lưu bền vững ✓" : ""}`;
    } catch { node.textContent = "Không đọc được dung lượng · game nhẹ vẫn an toàn"; }
  }

  async function ensureCinematicPackManager(instance) {
    const packApi = global.HHEonWildCinematicPacks;
    if (typeof packApi?.createManager !== "function") return null;
    if (instance.cinematicPackManager) return instance.cinematicPackManager;
    instance.cinematicPackManager = packApi.createManager({ baseUrl: global.location?.href });
    instance.packUnsubscribe = instance.cinematicPackManager.subscribe((event) => {
      if (instance.destroyed) return;
      if (event.packId) updatePackCard(instance, event);
    });
    await instance.cinematicPackManager.initialize();
    return instance.cinematicPackManager;
  }

  async function initializeCinematicPacks(instance) {
    if (instance.view !== "settings") return false;
    try {
      const manager = await ensureCinematicPackManager(instance);
      if (!manager) return false;
      const packs = manager.list();
      if (instance.destroyed) return false;
      packs.forEach((pack) => updatePackCard(instance, pack));
      refreshPackStorage(instance);
      return true;
    } catch (error) {
      const node = instance.root?.querySelector?.("[data-hwe-pack-storage]");
      if (node) node.textContent = `Asset pack không khởi tạo: ${String(error?.message || error).slice(0, 90)}`;
      return false;
    }
  }

  const CINEMATIC_RUNTIME_RULES = Object.freeze({
    "creature-ultra": Object.freeze({ group: "creatures", role: /^creature:([a-z0-9-]+):lod([0-3])$/, content: /^model\/gltf-binary$/ }),
    "forest-vegetation": Object.freeze({ group: "environment", role: /^vegetation:(fern|rock|quiver)$/, content: /^model\/gltf-binary$/ }),
    "terrain-rock": Object.freeze({ group: "terrain", role: /^terrain:(albedo|normal|roughness|ao)$/, content: /^image\// }),
    ocean: Object.freeze({ group: "ocean", role: /^ocean:(normal|foam)$/, content: /^image\// }),
    "weather-atmosphere": Object.freeze({ group: "weather", role: /^weather:(hdri)$/, content: /^image\/vnd\.radiance$/ }),
    "cinematic-audio": Object.freeze({ group: "audio", role: /^audio:(ambience|forest|ocean|rain|wind)$/, content: /^audio\// })
  });

  async function prepareCinematicRuntimeAssets(instance) {
    const empty = () => ({ creatures: [], environment: [], terrain: [], ocean: [], weather: [], audio: [], urls: [] });
    if (instance.state.settings.quality !== "personal") return empty();
    const manager = await ensureCinematicPackManager(instance).catch(() => null);
    if (!manager || instance.destroyed) return empty();
    const result = empty();
    const rendererSpecies = new Set(Array.isArray(RENDERER_ADAPTER?.FLAGSHIP_IDS) ? RENDERER_ADAPTER.FLAGSHIP_IDS : []);
    const limits = Object.freeze({ creatures: Math.max(0, rendererSpecies.size * 4), environment: 3, terrain: 4, ocean: 2, weather: 1, audio: 1 });
    for (const [packId, rule] of Object.entries(CINEMATIC_RUNTIME_RULES)) {
      const manifest = await manager.getManifest?.(packId);
      if (!manifest || instance.destroyed) continue;
      for (const asset of manifest.assets || []) {
        const role = String(asset.role || "");
        const match = rule.role.exec(role);
        if (!match || !rule.content.test(String(asset.contentType || ""))) continue;
        if (packId === "creature-ultra" && (!SPECIES_BY_ID.has(match[1]) || !rendererSpecies.has(match[1]))) continue;
        if (result[rule.group].length >= limits[rule.group]) continue;
        const url = await manager.assetUrl(packId, asset.path);
        if (!url || instance.destroyed) {
          if (url) manager.releaseAssetUrl(url);
          continue;
        }
        result.urls.push(url);
        const common = {
          id: match[1], file: url, role, channel: match[1], contentType: asset.contentType,
          trustedObjectUrl: true, source: asset.sourceUrl || manifest.licenseReportUrl,
          packId, productionApproved: false
        };
        if (packId === "creature-ultra") result.creatures.push(Object.freeze({ ...common, id: match[1], lod: Number(match[2]), scale: 1, rotationY: 0 }));
        else if (packId === "forest-vegetation") result.environment.push(Object.freeze({ ...common, id: match[1], scale: 1, wind: match[1] === "rock" ? 0 : 0.025 }));
        else result[rule.group].push(Object.freeze(common));
        if (result.urls.length >= 48) break;
      }
      if (result.urls.length >= 48) break;
    }
    result.creatures.sort((left, right) => left.id.localeCompare(right.id) || left.lod - right.lod);
    return result;
  }

  async function readPackManifest(instance, file, expectedId) {
    if (!file || file.size > 2 * 1024 * 1024) throw new Error("Manifest phải là JSON nhỏ hơn 2 MiB");
    const manifest = JSON.parse(await file.text());
    if (String(manifest?.id || "") !== String(expectedId || "")) throw new Error("Manifest không khớp gói đã chọn");
    const validation = global.HHEonWildCinematicPacks?.validateManifest?.(manifest, { baseUrl: global.location?.href });
    if (!validation?.valid) throw new Error(validation?.errors?.[0] || "Manifest không hợp lệ");
    instance.packManifests.set(expectedId, validation.manifest);
    updatePackCard(instance, { id: expectedId, ...(instance.packStates.get(expectedId) || {}) });
    return validation.manifest;
  }

  async function installCinematicPack(instance, packId, files = null, licenseReportFile = null) {
    const manager = instance.cinematicPackManager;
    const manifest = instance.packManifests.get(packId);
    if (!manager || !manifest) { setToast(instance, "Hãy nạp manifest bất biến hợp lệ trước"); return false; }
    try {
      updatePackCard(instance, { id: packId, status: "installing", totalBytes: manifest.totalBytes, loadedBytes: 0, label: "Đang chuẩn bị vùng lưu an toàn" });
      const options = { licenseReportFile, onProgress: (progress) => updatePackCard(instance, { ...progress, status: "installing" }) };
      const state = files ? await manager.installFromFiles(manifest, files, options) : await manager.install(manifest, options);
      updatePackCard(instance, state);
      refreshPackStorage(instance);
      setToast(instance, state.status === "ready" ? "Gói đã cài và vượt kiểm tra SHA-256" : "Đã tạm dừng; byte đã tải được giữ để tiếp tục");
      return state.status === "ready";
    } catch (error) {
      updatePackCard(instance, { id: packId, status: "failed", totalBytes: manifest.totalBytes, error: String(error?.message || error).slice(0, 120) });
      setToast(instance, "Gói không hợp lệ; EonWild tiếp tục dùng asset nhẹ");
      return false;
    }
  }

  async function installCinematicPackFromFiles(instance, packId, selectedFiles) {
    const maximumFiles = Math.max(1, Number(global.HHEonWildCinematicPacks?.MAX_ASSETS || 256)) + 2;
    if (!selectedFiles || Number(selectedFiles.length || 0) > maximumFiles) throw new Error(`Bộ tệp local chỉ được tối đa ${maximumFiles} mục`);
    const files = [...(selectedFiles || [])];
    const manifestFile = files.find((file) => /(?:manifest|pack).*\.json$/i.test(file.name)) || files.find((file) => /\.json$/i.test(file.name));
    if (!manifestFile) throw new Error("Bộ tệp local phải có manifest JSON");
    const manifest = await readPackManifest(instance, manifestFile, packId);
    const licenseReportFile = files.find((file) => file !== manifestFile && /(?:license|licence|provenance)[-_ .]?(?:report|receipt)?/i.test(String(file.name || "")));
    if (!licenseReportFile) throw new Error("Bộ tệp local thiếu báo cáo giấy phép/provenance đã khai báo SHA-256");
    const assetFiles = new Map();
    for (const asset of manifest.assets) {
      const matches = files.filter((file) => {
        const relative = String(file.webkitRelativePath || file.name).replaceAll("\\", "/");
        return relative === asset.path || relative.endsWith(`/${asset.path}`) || (!asset.path.includes("/") && file.name === asset.path);
      });
      if (matches.length !== 1) throw new Error(`Thiếu hoặc trùng tệp local: ${asset.path}`);
      assetFiles.set(asset.path, matches[0]);
    }
    return installCinematicPack(instance, packId, assetFiles, licenseReportFile);
  }

  const TOUCH_MOVEMENT_ACTIONS = Object.freeze({ ArrowUp: "moveForward", ArrowDown: "moveBackward", ArrowLeft: "moveLeft", ArrowRight: "moveRight" });

  function updateTouchJoystick(instance, event) {
    const stick = instance.root.querySelector("[data-hwe-touch-stick]");
    if (!stick || !instance.inputSystem) return false;
    const rect = stick.getBoundingClientRect();
    const radius = Math.max(1, Math.min(rect.width, rect.height) / 2);
    const x = clamp((event.clientX - (rect.left + rect.width / 2)) / radius, -1, 1);
    const y = clamp((event.clientY - (rect.top + rect.height / 2)) / radius, -1, 1);
    const normalized = instance.inputSystem.setTouchJoystick(x, y);
    stick.style.setProperty("--stick-x", `${normalized.x * 22}px`);
    stick.style.setProperty("--stick-y", `${normalized.y * 22}px`);
    return true;
  }

  function bind(instance) {
    const { root, controller } = instance;
    // `overflow:hidden` elements can still be scrolled programmatically when a
    // focusable canvas is brought into view, especially on mobile Chromium.
    // Keep the shell pinned; only .hwe-main owns scrolling.
    root.addEventListener("scroll", () => {
      if (root.scrollTop) root.scrollTop = 0;
      if (root.scrollLeft) root.scrollLeft = 0;
    }, { signal: controller.signal, passive: true });
    if (typeof global.MutationObserver === "function") {
      instance.motionObserver = new global.MutationObserver(() => {
        if (!instance.renderer3d) return;
        instance.renderer3d.setMotion?.(instance.state.settings.motion);
        setRuntimeQuality(instance, reduced3DPreference(instance) ? "static" : instance.state.settings.quality);
      });
      if (global.document?.documentElement) instance.motionObserver.observe(global.document.documentElement, { attributes: true, attributeFilter: ["class"] });
      if (global.document?.body) instance.motionObserver.observe(global.document.body, { attributes: true, attributeFilter: ["class"] });
    }
    root.addEventListener("click", (event) => {
      const target = event.target.closest?.("button"); if (!target) return;
      if (target.dataset.hweRoute) { global.location.hash = `#${target.dataset.hweRoute}`; return; }
      if (target.matches("[data-hwe-quick-play]")) {
        if (instance.view === "world") {
          if (!instance.running) startGame(instance); else focusSurface(instance);
          return;
        }
        const selectedMap = WORLD_ATLAS?.getMap?.(instance.state.atlasMapId);
        if (selectedMap?.gameplayStatus === "atlas-reference-only") {
          if (global.location.hash !== "#/game/timeline") global.location.hash = "#/game/timeline";
          else setToast(instance, `${selectedMap.label} mới là Atlas tham khảo; hãy chọn bản đồ có active region để chơi`);
          return;
        }
        global.location.hash = "#/game/world";
        return;
      }
      if (target.matches("[data-hwe-render-cancel]")) { disable3D(instance); setToast(instance, "Đã hủy tải 3D và giữ Canvas Lite"); return; }
      if (target.matches("[data-hwe-render-retry]")) { const panel = target.closest("[data-hwe-render-fallback]"); if (panel) panel.hidden = true; enable3D(instance); return; }
      if (target.matches("[data-hwe-fallback-dismiss]")) { const panel = target.closest("[data-hwe-render-fallback]"); if (panel) panel.hidden = true; focusSurface(instance); return; }
      if (target.matches(".hwe-render-toggle")) { if (instance.renderer3d || instance.rendererBooting) disable3D(instance); else enable3D(instance); return; }
      if (target.dataset.hweRenderer) { if (target.dataset.hweRenderer === "lite") disable3D(instance); else enable3D(instance); return; }
      if (target.matches("[data-hwe-open-codex]")) { global.location.hash = "#/game/species"; return; }
      if (target.dataset.hweAtlasMap) { selectAtlasMap(instance, target.dataset.hweAtlasMap); return; }
      if (target.dataset.hweRealm) { switchRealm(instance, target.dataset.hweRealm, instance.view === "timeline"); return; }
      if (target.dataset.hwePlanetSpecies) { updatePlanetSpeciesDetail(instance, SPECIES_REGISTRY?.getById?.(target.dataset.hwePlanetSpecies)); return; }
      if (target.dataset.hwePlanetGroup) { instance.planetGroupFilter = target.dataset.hwePlanetGroup; root.querySelectorAll("[data-hwe-planet-group]").forEach((button) => button.setAttribute("aria-pressed", String(button === target))); filterPlanetRegistry(instance); return; }
      if (target.dataset.hweSpecies) { const species = SPECIES_BY_ID.get(target.dataset.hweSpecies); if (!species) return; if (instance.view === "world") { selectPlayableSpecies(instance, species); return; } root.querySelectorAll("[data-hwe-species]").forEach((card) => card.classList.toggle("is-selected", card === target)); updateCodexDetail(instance, species); setToast(instance, `${species.vietnamese} · ${tierLabel(tierForSpecies(species))}`); return; }
      if (target.dataset.hwePlaySpecies) { selectPlayableSpecies(instance, SPECIES_BY_ID.get(target.dataset.hwePlaySpecies), true); return; }
      if (target.dataset.hweEraFilter) { instance.eraFilter = target.dataset.hweEraFilter; root.querySelectorAll("[data-hwe-era-filter]").forEach((button) => button.setAttribute("aria-pressed", String(button === target))); filterSpecies(instance); return; }
      if (target.dataset.hweTierFilter) { instance.tierFilter = instance.tierFilter === target.dataset.hweTierFilter ? "all" : target.dataset.hweTierFilter; root.querySelectorAll("[data-hwe-tier-filter]").forEach((button) => button.setAttribute("aria-pressed", String(instance.tierFilter === button.dataset.hweTierFilter))); filterSpecies(instance); return; }
      if (target.dataset.hweRealmFilter) { instance.realmFilter = target.dataset.hweRealmFilter; root.querySelectorAll("[data-hwe-realm-filter]").forEach((button) => button.setAttribute("aria-pressed", String(button === target))); filterSpecies(instance); return; }
      if (target.dataset.hweDifficulty) { instance.state.settings.difficulty = target.dataset.hweDifficulty; root.querySelectorAll("[data-hwe-difficulty]").forEach((button) => button.classList.toggle("is-active", button === target)); saveState(instance); return; }
      if (target.matches("[data-hwe-start]")) { instance.startTrigger = target; startGame(instance); return; }
      if (target.matches("[data-hwe-respawn]")) { respawn(instance); return; }
      if (target.matches("[data-hwe-pause]")) { if (instance.paused) resumeGame(instance); else pauseGame(instance, "button"); return; }
      if (target.matches("[data-hwe-resume]")) { resumeGame(instance); return; }
      if (target.matches("[data-hwe-fullscreen]")) { toggleGameplayFullscreen(instance); return; }
      if (target.dataset.hweGameOverlayOpen) { openGameOverlay(instance, target.dataset.hweGameOverlayOpen); return; }
      if (target.matches("[data-hwe-game-overlay-close]")) { closeGameOverlay(instance); return; }
      if (target.matches("[data-hwe-exit-immersive]")) { exitImmersive(instance); return; }
      if (target.matches("[data-hwe-photo]")) { setPhotoMode(instance, true); return; }
      if (target.matches("[data-hwe-photo-close]")) { setPhotoMode(instance, false); return; }
      if (target.matches("[data-hwe-photo-capture]")) { capturePhoto(instance); return; }
      if (target.matches("[data-hwe-communication-open]")) { setCommunicationWheel(instance, instance.root.querySelector("[data-hwe-communication-wheel]")?.hidden !== false); return; }
      if (target.matches("[data-hwe-communication-close]")) { setCommunicationWheel(instance, false); return; }
      if (target.dataset.hweCall) { emitCommunication(instance, target.dataset.hweCall); setCommunicationWheel(instance, false); return; }
      if (target.dataset.hweAction === "interact") { if (!instance.paused) interact(instance); return; }
      if (target.dataset.hweAction === "sense") { if (!instance.paused) sense(instance); return; }
      if (target.dataset.hweAction === "ability") { if (!instance.paused) useFlagshipAbility(instance); return; }
      if (target.dataset.hweAction === "lock-target") { if (!instance.paused) toggleTargetLock(instance); return; }
      if (target.dataset.hweExpedition) { instance.state.activeExpedition = target.dataset.hweExpedition; saveState(instance); global.location.hash = "#/game/world"; return; }
      if (target.matches("[data-hwe-lineage-export]")) { exportLineage(instance); return; }
      if (target.matches("[data-hwe-save-export]")) { exportSave(instance); return; }
      if (target.matches("[data-hwe-save-import]")) { root.querySelector("[data-hwe-save-file]")?.click?.(); return; }
      if (target.matches("[data-hwe-save-rollback]")) { restoreRollback(instance); return; }
      if (target.dataset.hweRemapAction) { instance.remapAction = target.dataset.hweRemapAction; root.querySelectorAll("[data-hwe-remap-action]").forEach((button) => button.classList.toggle("is-listening", button === target)); const key = target.querySelector("kbd"); if (key) key.textContent = "Nhấn phím…"; setToast(instance, "Nhấn phím mới; Escape cũng có thể được gán cho Pause"); return; }
      if (target.matches("[data-hwe-input-export]")) { const exported = instance.inputSystem?.exportProfile?.(); if (exported?.ok && downloadLocalFile(instance, `hh-eonwild-input-${Date.now()}.json`, exported.json)) setToast(instance, "Đã xuất profile điều khiển không chứa secret"); else setToast(instance, "Không thể xuất profile điều khiển"); return; }
      if (target.matches("[data-hwe-input-import]")) { root.querySelector("[data-hwe-input-file]")?.click?.(); return; }
      if (target.matches("[data-hwe-input-reset]")) { instance.inputSystem?.clearPersistence?.(); instance.inputSystem?.applyPreset?.("standard"); instance.inputSystem?.save?.(); setToast(instance, "Đã khôi phục preset Standard"); mount(instance.host, { view: "settings" }); return; }
      if (target.matches("[data-hwe-gene-preview]")) { previewGenes(instance); return; }
      if (target.matches("[data-hwe-replay-play]")) { toggleObserverPlayback(instance, target); return; }
      if (target.matches("[data-hwe-replay-clear]")) { if (target.dataset.confirm === "true") { clearInterval(instance.observerTimer); instance.observerTimer = 0; instance.state.replay = []; saveState(instance); mount(instance.host, { view: "observer" }); } else { target.dataset.confirm = "true"; target.textContent = "Xác nhận xóa replay"; setTimeout(() => { if (target.isConnected) { delete target.dataset.confirm; target.textContent = "Xóa replay local"; } }, 4000); } return; }
      if (target.matches("[data-hwe-network-audit]")) { const result = root.querySelector("[data-hwe-network-result]"); if (result) result.textContent = `${global.isSecureContext ? "HTTPS ✓" : "HTTPS chưa đạt"} · Backend authoritative, token phòng, moderation và anti-cheat chưa cấu hình. Multiplayer tiếp tục bị khóa an toàn.`; target.textContent = "Đã kiểm tra · vẫn khóa"; setToast(instance, "Capability audit hoàn tất, không tạo phòng giả"); return; }
      if (target.matches("[data-hwe-simulate-season]")) { simulateEcologySeason(instance, target); return; }
      if (target.matches("[data-hwe-pack-persist]")) {
        target.disabled = true;
        instance.cinematicPackManager?.requestPersistence().then((granted) => { setToast(instance, granted ? "Trình duyệt đã cấp lưu trữ bền vững" : "Trình duyệt chưa cấp lưu trữ bền vững; dữ liệu vẫn nằm trong quota thường"); refreshPackStorage(instance); }).finally(() => { if (target.isConnected) target.disabled = false; });
        return;
      }
      if (target.matches("[data-hwe-pack-verify-all]")) {
        target.disabled = true; target.textContent = "Đang kiểm tra byte thật…";
        instance.cinematicPackManager?.verifyAll({ onProgress: (progress) => updatePackCard(instance, { ...progress, status: "installing" }) }).then((results) => {
          results.forEach((result) => updatePackCard(instance, result.ok ? result.state : { id: result.id, status: "failed", error: result.error }));
          const failed = results.filter((result) => !result.ok).length;
          setToast(instance, results.length ? failed ? `${failed}/${results.length} gói lỗi; asset nhẹ tiếp tục được dùng` : `${results.length} gói đều vượt kiểm tra SHA-256` : "Chưa có gói sẵn sàng để kiểm tra");
        }).catch(() => setToast(instance, "Không thể hoàn tất kiểm tra toàn bộ; asset nhẹ vẫn an toàn")).finally(() => { if (target.isConnected) { target.disabled = false; target.textContent = "Kiểm tra toàn bộ"; } });
        return;
      }
      if (target.matches("[data-hwe-pack-remove-all]")) {
        if (target.dataset.confirm !== "true") { target.dataset.confirm = "true"; target.textContent = "Xác nhận xóa mọi gói"; setTimeout(() => { if (target.isConnected) { delete target.dataset.confirm; target.textContent = "Xóa toàn bộ cache Ultra"; } }, 4000); return; }
        target.disabled = true;
        instance.cinematicPackManager?.removeAll().then(() => { instance.packStates.clear(); instance.root.querySelectorAll("[data-hwe-pack]").forEach((card) => updatePackCard(instance, { id: card.dataset.hwePack, status: "not-installed", loadedBytes: 0, totalBytes: instance.packManifests.get(card.dataset.hwePack)?.totalBytes || 0, label: "Đã xóa dữ liệu cục bộ" })); refreshPackStorage(instance); setToast(instance, "Đã xóa toàn bộ cache Ultra khỏi thiết bị"); }).catch(() => setToast(instance, "Không thể xóa hết cache; hãy thử lại")).finally(() => { if (target.isConnected) { target.disabled = false; delete target.dataset.confirm; target.textContent = "Xóa toàn bộ cache Ultra"; } });
        return;
      }
      if (target.dataset.hwePackManifest) { instance.pendingPackId = target.dataset.hwePackManifest; root.querySelector("[data-hwe-pack-manifest-file]")?.click?.(); return; }
      if (target.dataset.hwePackLocal) { instance.pendingLocalPackId = target.dataset.hwePackLocal; root.querySelector("[data-hwe-pack-local-files]")?.click?.(); return; }
      if (target.dataset.hwePackInstall) { installCinematicPack(instance, target.dataset.hwePackInstall); return; }
      if (target.dataset.hwePackPause) { if (instance.cinematicPackManager?.pause(target.dataset.hwePackPause)) setToast(instance, "Đang tạm dừng an toàn sau chunk hiện tại"); return; }
      if (target.dataset.hwePackVerify) {
        const packId = target.dataset.hwePackVerify;
        target.disabled = true;
        instance.cinematicPackManager?.verify(packId, { onProgress: (progress) => updatePackCard(instance, { ...progress, status: "installing" }) })
          .then((state) => { updatePackCard(instance, state); setToast(instance, "Toàn bộ byte và SHA-256 của gói đều hợp lệ"); })
          .catch((error) => { updatePackCard(instance, { id: packId, status: "failed", error: String(error?.message || error).slice(0, 120) }); setToast(instance, "Kiểm tra thất bại; renderer sẽ dùng asset nhẹ"); });
        return;
      }
      if (target.dataset.hwePackRemove) {
        const packId = target.dataset.hwePackRemove;
        if (target.dataset.confirm !== "true") { target.dataset.confirm = "true"; target.textContent = "Xác nhận xóa gói"; setTimeout(() => { if (target.isConnected) { delete target.dataset.confirm; target.textContent = "Xóa gói"; } }, 4000); return; }
        instance.cinematicPackManager?.remove(packId).then(() => { updatePackCard(instance, { id: packId, status: "not-installed", loadedBytes: 0, totalBytes: instance.packManifests.get(packId)?.totalBytes || 0, label: "Đã xóa dữ liệu cục bộ" }); refreshPackStorage(instance); setToast(instance, "Đã xóa gói Cinematic khỏi thiết bị"); });
        return;
      }
      if (target.matches("[data-hwe-reset]")) { if (target.dataset.confirm === "true") { global.localStorage?.removeItem?.(STORAGE_KEY); global.localStorage?.removeItem?.(LEGACY_STORAGE_KEY); global.localStorage?.removeItem?.(V2_STORAGE_KEY); global.localStorage?.removeItem?.(OLDER_STORAGE_KEY); global.localStorage?.removeItem?.(ROLLBACK_STORAGE_KEY); global.localStorage?.removeItem?.(LEGACY_ROLLBACK_STORAGE_KEY); instance.state = normalizeState(); mount(instance.host, { view: "world" }); } else { target.dataset.confirm = "true"; target.textContent = "Xác nhận xóa save v1 + v2 + v3 + v4"; setTimeout(() => { if (target.isConnected) { delete target.dataset.confirm; target.textContent = "Khôi phục save mới…"; } }, 4000); } }
    }, { signal: controller.signal });
    root.addEventListener("keydown", (event) => {
      const visibleDialog = [...root.querySelectorAll('[role="dialog"]:not([hidden])')].find((dialog) => dialog.offsetParent !== null || dialog.matches?.(".hwe-pause-overlay,.hwe-game-overlay,.hwe-photo-overlay,.hwe-communication-wheel"));
      if (!visibleDialog) return;
      if (event.code === "Escape") {
        event.preventDefault(); event.stopPropagation();
        if (visibleDialog.matches("[data-hwe-game-overlay]")) closeGameOverlay(instance);
        else if (visibleDialog.matches("[data-hwe-photo-overlay]")) setPhotoMode(instance, false);
        else if (visibleDialog.matches("[data-hwe-communication-wheel]")) setCommunicationWheel(instance, false);
        return;
      }
      if (event.code !== "Tab") return;
      const focusable = [...visibleDialog.querySelectorAll('button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])')].filter((node) => !node.hidden);
      if (!focusable.length) { event.preventDefault(); visibleDialog.focus?.(); return; }
      const first = focusable[0]; const last = focusable.at(-1);
      if (event.shiftKey && global.document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && global.document.activeElement === last) { event.preventDefault(); first.focus(); }
    }, { signal: controller.signal, capture: true });
    root.addEventListener("keydown", (event) => {
      if (!instance.remapAction || !instance.inputSystem) return;
      event.preventDefault(); event.stopPropagation();
      const actionId = instance.remapAction;
      const retainedBindings = (instance.inputSystem.getMappings?.()[actionId] || []).filter((binding) => binding.device !== "keyboard");
      const result = instance.inputSystem.remap(actionId, [{ device: "keyboard", code: event.code || event.key }, ...retainedBindings]);
      if (!result.ok) {
        const conflictNames = (result.conflicts || []).flatMap((conflict) => conflict.actions || []).filter((id) => id !== actionId).map((id) => INPUT_SYSTEM.ACTION_METADATA[id]?.labelVi || id);
        setToast(instance, conflictNames.length ? `Phím đang dùng cho: ${conflictNames.join(", ")}` : "Phím không hợp lệ");
        return;
      }
      instance.remapAction = "";
      instance.inputSystem.save();
      setToast(instance, `Đã gán ${INPUT_SYSTEM.ACTION_METADATA[actionId]?.labelVi || actionId} → ${inputBindingLabel({ device: "keyboard", code: event.code || event.key })}`);
      mount(instance.host, { view: "settings" });
    }, { signal: controller.signal, capture: true });
    root.addEventListener("input", (event) => {
      if (event.target.matches("[data-hwe-species-search]")) filterSpecies(instance);
      if (event.target.matches("[data-hwe-planet-search]")) filterPlanetRegistry(instance);
      if (event.target.matches("[data-hwe-replay-scrubber]")) drawObserver(instance, Number(event.target.value));
      if (event.target.matches('[data-hwe-setting="soundVolume"]')) {
        const output = event.target.closest("label")?.querySelector?.("output");
        if (output) output.textContent = `${Math.round(clamp(event.target.value, 0, 100))}%`;
      }
      if (event.target.dataset.hweInputSetting && event.target.type === "range") {
        const output = event.target.closest("label")?.querySelector?.("output");
        if (output) output.textContent = `${Math.round(clamp(event.target.value, 0, 100))}%`;
      }
      if (event.target.dataset.hweCameraSetting) {
        const key = event.target.dataset.hweCameraSetting;
        const ranges = { cameraSensitivityX: [1, 100], cameraSensitivityY: [1, 100], cameraFov: [45, 105], cameraSmoothing: [0, 100], cameraShake: [0, 100], headBob: [0, 100] };
        if (Object.hasOwn(ranges, key)) {
          const value = clamp(event.target.value, ranges[key][0], ranges[key][1]);
          instance.state.settings[key] = value;
          const output = event.target.closest("label")?.querySelector?.("output");
          if (output) output.textContent = key === "cameraFov" ? `${Math.round(value)}°` : `${Math.round(value)}%`;
          if (instance.camera && key === "cameraFov") instance.camera.fov = value;
          updateGameplayCamera(instance, 1 / 60);
        }
      }
      if (event.target.dataset.hwePhotoSetting) {
        const key = event.target.dataset.hwePhotoSetting;
        const ranges = {
          photoFov: [35, 100], photoExposure: [50, 160], photoFocalLength: [18, 200], photoAperture: [1.4, 16],
          photoShutter: [15, 8000], photoIso: [50, 6400], photoExposureComp: [-5, 5], photoFocusDistance: [.3, 500], photoShake: [0, 100]
        };
        const value = event.target.type === "checkbox" ? event.target.checked
          : Object.hasOwn(ranges, key) ? clamp(event.target.value, ranges[key][0], ranges[key][1])
          : String(event.target.value).slice(0, 16);
        instance.state.settings[key] = value;
        if (key === "photoFocalLength") instance.state.settings.photoFov = clamp(focalLengthToFov(value), 35, 100);
        const output = event.target.closest("label")?.querySelector?.("output");
        if (output) output.textContent = key === "photoFocalLength" ? `${Math.round(value)} mm`
          : key === "photoAperture" ? `f/${Number(value).toFixed(1)}`
          : key === "photoIso" ? `${Math.round(value)}`
          : key === "photoExposureComp" ? `${value > 0 ? "+" : ""}${Number(value).toFixed(1)} EV`
          : key === "photoFocusDistance" ? `${Number(value).toFixed(1)} m`
          : key === "photoFov" ? `${Math.round(value)}°`
          : `${Math.round(value)}%`;
        syncPhotoComposition(instance);
        instance.renderer3d?.setPhotoSettings?.(photoRendererSettings(instance.state.settings));
      }
    }, { signal: controller.signal });
    root.addEventListener("change", (event) => {
      if (event.target.dataset.hweCameraSetting) { instance.state = normalizeState(instance.state); saveState(instance); return; }
      if (event.target.matches("[data-hwe-input-file]")) {
        const file = event.target.files?.[0]; event.target.value = "";
        if (!file || file.size > (INPUT_SYSTEM?.LIMITS?.MAX_PROFILE_BYTES || 32768)) { setToast(instance, "Profile điều khiển không hợp lệ hoặc quá lớn"); return; }
        file.text().then((json) => {
          const result = instance.inputSystem?.importProfile?.(json);
          if (!result?.ok) throw new Error(result?.reason || "PROFILE_INVALID");
          instance.inputSystem.save(); mount(instance.host, { view: "settings" });
        }).catch(() => setToast(instance, "Profile bị từ chối; mapping hiện tại được giữ nguyên"));
        return;
      }
      if (event.target.matches("[data-hwe-input-preset]")) {
        const result = instance.inputSystem?.applyPreset?.(event.target.value);
        if (result?.ok) { instance.inputSystem.save(); mount(instance.host, { view: "settings" }); }
        else setToast(instance, "Preset điều khiển không hợp lệ");
        return;
      }
      if (event.target.dataset.hweInputSetting) {
        const key = event.target.dataset.hweInputSetting;
        const value = event.target.type === "checkbox" ? event.target.checked : clamp(event.target.value, 0, 100) / 100;
        instance.inputSystem?.updateSettings?.({ [key]: value }); instance.inputSystem?.save?.(); setToast(instance, "Đã lưu cấu hình input cục bộ");
        return;
      }
      if (event.target.dataset.hwePhotoSetting) { instance.state = normalizeState(instance.state); syncPhotoComposition(instance); saveState(instance); return; }
      if (event.target.matches("[data-hwe-pack-manifest-file]")) {
        const packId = instance.pendingPackId; const file = event.target.files?.[0]; event.target.value = ""; instance.pendingPackId = "";
        readPackManifest(instance, file, packId).then(() => setToast(instance, "Manifest hợp lệ; sẵn sàng cài hoặc tiếp tục")).catch((error) => setToast(instance, `Manifest bị từ chối: ${String(error?.message || error).slice(0, 86)}`)); return;
      }
      if (event.target.matches("[data-hwe-pack-local-files]")) {
        const packId = instance.pendingLocalPackId; const files = event.target.files; event.target.value = ""; instance.pendingLocalPackId = "";
        installCinematicPackFromFiles(instance, packId, files).catch((error) => { updatePackCard(instance, { id: packId, status: "failed", error: String(error?.message || error).slice(0, 120) }); setToast(instance, `Không thể cài tệp local: ${String(error?.message || error).slice(0, 80)}`); }); return;
      }
      if (event.target.matches("[data-hwe-save-file]")) { importSave(instance, event.target.files?.[0]); event.target.value = ""; return; }
      if (event.target.matches("[data-hwe-mode]")) { if (RENDERER_3D?.GAME_MODES?.some?.((mode) => mode.id === event.target.value && mode.available)) { instance.state.mode = event.target.value; saveState(instance); setToast(instance, "Đã lưu chế độ vòng đời"); } return; }
      if (event.target.matches("[data-hwe-atlas-map-select]")) { selectAtlasMap(instance, event.target.value); return; }
      if (event.target.matches("[data-hwe-time-slice]")) {
        const slice = RENDERER_3D?.TIME_SLICES?.find?.((row) => row.id === event.target.value && row.realmId === instance.state.realmId);
        if (!slice) return;
        const nextAddress = addressForSlice(instance.state, slice);
        const compatible = instance.state.settings.convergence
          ? SPECIES_BY_ID.get(instance.state.speciesId)
          : playableSpeciesAtAddress(instance.state, nextAddress)[0];
        if (!compatible) {
          event.target.value = instance.state.worldAddress?.timeSliceId || "";
          setToast(instance, "Time Slice này hiện chỉ dành cho Observer; chưa có Flagship chơi được");
          return;
        }
        instance.state.worldAddress = nextAddress;
        if (!instance.state.settings.convergence && compatible.id !== instance.state.speciesId) {
          const lineage = instance.state.player.lineage;
          instance.state.speciesId = compatible.id;
          instance.state.player = normalizeState({ speciesId: compatible.id, realmId: instance.state.realmId, worldAddress: nextAddress, player: { lineage } }).player;
        }
        saveState(instance); mount(instance.host, { view: instance.view }); return;
      }
      const key = event.target.dataset.hweSetting; if (!key) return;
      if (key === "realmId") { switchRealm(instance, String(event.target.value)); return; }
      if (!Object.hasOwn(instance.state.settings, key)) return;
      instance.state.settings[key] = event.target.type === "checkbox" ? event.target.checked : String(event.target.value).slice(0, 24);
      instance.state = normalizeState(instance.state); root.dataset.motion = instance.state.settings.motion; root.dataset.quality = instance.state.settings.quality; saveState(instance);
      if (["viewMode", "invertCameraY", "autoCenterCamera"].includes(key) && instance.camera) {
        const profile = desktopCameraProfile(instance);
        instance.camera.firstPerson = instance.state.settings.viewMode === "animal-eye";
        instance.camera.desiredDistance = instance.camera.firstPerson ? profile.minDistance : profile.distance;
        updateGameplayCamera(instance, 1 / 60);
      }
      if (key === "quality" && instance.renderer3d) setRuntimeQuality(instance, instance.state.settings.quality);
      if (key === "motion" && instance.renderer3d) {
        instance.renderer3d.setMotion?.(instance.state.settings.motion);
        setRuntimeQuality(instance, instance.state.settings.motion === "static" ? "static" : instance.state.settings.quality);
      }
      if ((key === "sound" || key === "soundVolume") && instance.renderer3d) {
        instance.renderer3d.setAudio?.(instance.state.settings.sound, clamp(instance.state.settings.soundVolume, 0, 100) / 100);
      }
      if (key === "convergence") mount(instance.host, { view: instance.view });
      else if (instance.view === "world" && ["density", "seed", "worker"].includes(key)) mount(instance.host, { view: "world" });
      else setToast(instance, "Đã lưu cấu hình cục bộ");
    }, { signal: controller.signal });
    root.addEventListener("pointerdown", (event) => {
      if ((event.target === instance.canvas || event.target === instance.canvas3d) && isGameplayStatePlaying(instance)) {
        requestGameplayPointerLock(instance);
        event.preventDefault();
        return;
      }
      const stick = event.target.closest?.("[data-hwe-touch-stick]");
      if (stick && instance.inputSystem) {
        instance.touchJoystickPointer = event.pointerId;
        stick.setPointerCapture?.(event.pointerId);
        updateTouchJoystick(instance, event);
        event.preventDefault();
        return;
      }
      const cameraPad = event.target.closest?.("[data-hwe-camera-pad]");
      if (cameraPad && isGameplayActive(instance)) {
        instance.touchCameraPointer = event.pointerId;
        instance.touchCameraPoint = { x: event.clientX, y: event.clientY };
        cameraPad.setPointerCapture?.(event.pointerId);
        event.preventDefault();
        return;
      }
      const key = event.target.closest?.("[data-hwe-touch]")?.dataset.hweTouch;
      if (!key) return;
      instance.touchPointers ||= new Map();
      instance.touchPointers.set(event.pointerId, key);
      const action = TOUCH_MOVEMENT_ACTIONS[key];
      if (instance.inputSystem && action) instance.inputSystem.setTouchAction(action, true);
      else instance.keys?.add(key);
      event.target.setPointerCapture?.(event.pointerId);
    }, { signal: controller.signal });
    root.addEventListener("pointermove", (event) => {
      if (event.pointerId === instance.touchJoystickPointer) updateTouchJoystick(instance, event);
      if (event.pointerId === instance.touchCameraPointer && instance.touchCameraPoint) {
        const previous = instance.touchCameraPoint;
        instance.touchCameraPoint = { x: event.clientX, y: event.clientY };
        applyLookDelta(instance, event.clientX - previous.x, event.clientY - previous.y);
        event.preventDefault();
      }
    }, { signal: controller.signal });
    ["pointerup", "pointercancel", "pointerleave"].forEach((name) => root.addEventListener(name, (event) => {
      if (event.pointerId === instance.touchJoystickPointer) {
        instance.touchJoystickPointer = null;
        instance.inputSystem?.setTouchJoystick?.(0, 0);
        const stick = instance.root.querySelector("[data-hwe-touch-stick]");
        stick?.style?.setProperty("--stick-x", "0px"); stick?.style?.setProperty("--stick-y", "0px");
      }
      if (event.pointerId === instance.touchCameraPointer) {
        instance.touchCameraPointer = null;
        instance.touchCameraPoint = null;
      }
      const key = instance.touchPointers?.get?.(event.pointerId) || event.target.closest?.("[data-hwe-touch]")?.dataset.hweTouch;
      if (key) {
        const action = TOUCH_MOVEMENT_ACTIONS[key];
        if (instance.inputSystem && action) instance.inputSystem.setTouchAction(action, false);
        else instance.keys?.delete(key);
        instance.touchPointers?.delete?.(event.pointerId);
      }
    }, { signal: controller.signal }));
    if (!instance.inputSystem) {
      global.addEventListener?.("keydown", (event) => {
        if (!activeSurface(instance) || !root.contains(global.document.activeElement) || INPUT_SYSTEM?.isTextEntryEvent?.(event)) return;
        if (event.code === "Escape") {
          if (instance.photoMode) setPhotoMode(instance, false);
          else if (instance.root.querySelector("[data-hwe-game-overlay]")?.hidden === false) closeGameOverlay(instance);
          else if (instance.root.querySelector("[data-hwe-communication-wheel]")?.hidden === false) setCommunicationWheel(instance, false);
          else if (isGameplayActive(instance)) pauseGame(instance, "keyboard");
          return;
        }
        if (event.code === "KeyP") { setPhotoMode(instance, !instance.photoMode); return; }
        if (event.code === "KeyM") { openGameOverlay(instance, "map"); return; }
        if (event.code === "Tab") { event.preventDefault(); openGameOverlay(instance, "codex"); return; }
        if (instance.paused) return;
        instance.keys.add(event.code);
        if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(event.code)) event.preventDefault();
        if (event.code === "KeyF" || event.code === "KeyE") interact(instance);
        if (event.code === "KeyQ") sense(instance);
        if (event.code === "KeyR") useFlagshipAbility(instance);
        if (event.code === "KeyC") setCommunicationWheel(instance, instance.root.querySelector("[data-hwe-communication-wheel]")?.hidden !== false);
        if (event.code === "KeyV") toggleViewMode(instance);
        if (event.code === "KeyZ") toggleTargetLock(instance);
        if (event.code === "Space") defend(instance);
        if (event.code === "KeyN") createNest(instance);
      }, { signal: controller.signal });
      global.addEventListener?.("keyup", (event) => instance.keys?.delete(event.code), { signal: controller.signal });
    }
    global.document?.addEventListener?.("mousemove", (event) => {
      if (!isGameplayActive(instance) || global.document?.pointerLockElement !== activeSurface(instance)) return;
      applyLookDelta(instance, event.movementX || 0, event.movementY || 0);
    }, { signal: controller.signal, passive: true });
    root.addEventListener("wheel", (event) => {
      if (!isGameplayActive(instance) || !instance.camera || !DESKTOP?.updateZoom || !event.target.closest?.("[data-hwe-viewport]")) return;
      const profile = desktopCameraProfile(instance);
      instance.camera.desiredDistance = DESKTOP.updateZoom(instance.camera.desiredDistance, event.deltaY, { profile });
      if (instance.camera.firstPerson && instance.camera.desiredDistance > profile.minDistance * 1.35) {
        instance.state.settings.viewMode = "third-person";
        instance.camera.firstPerson = false;
      }
      event.preventDefault();
    }, { signal: controller.signal, passive: false });
    global.document?.addEventListener?.("pointerlockchange", () => {
      const locked = global.document.pointerLockElement === activeSurface(instance);
      if (DESKTOP?.reducePointerLock) instance.pointerLockState = DESKTOP.reducePointerLock(instance.pointerLockState, { type: locked ? "LOCKED" : "UNLOCKED" });
      if (!locked && instance.pointerLockState?.shouldPause && isGameplayStatePlaying(instance)) pauseGame(instance, "pointer-lock-lost", false);
    }, { signal: controller.signal });
    global.document?.addEventListener?.("pointerlockerror", () => {
      if (DESKTOP?.reducePointerLock) instance.pointerLockState = DESKTOP.reducePointerLock(instance.pointerLockState, { type: "ERROR", error: "POINTER_LOCK_ERROR" });
      if (isGameplayStatePlaying(instance)) pauseGame(instance, "pointer-lock-error", false);
    }, { signal: controller.signal });
    global.document?.addEventListener?.("fullscreenchange", () => {
      if (global.document.fullscreenElement !== instance.root) instance.ownsFullscreen = false;
      resizeCanvas(instance);
      global.requestAnimationFrame?.(() => resizeCanvas(instance));
    }, { signal: controller.signal });
    global.document?.addEventListener?.("fullscreenerror", () => setToast(instance, "Không thể chuyển toàn màn hình trên thiết bị này."), { signal: controller.signal });
    global.addEventListener?.("blur", () => {
      instance.inputSystem?.releaseAll?.("window-blur");
      if (isGameplayStatePlaying(instance)) pauseGame(instance, "window-blur");
    }, { signal: controller.signal });
    global.addEventListener?.("pagehide", () => {
      if (isGameplayStatePlaying(instance)) pauseGame(instance, "pagehide");
      instance.renderer3d?.setPaused?.(true);
    }, { signal: controller.signal });
    global.addEventListener?.("pageshow", () => {
      if (instance.running && instance.paused) instance.root.querySelector("[data-hwe-resume]")?.focus?.({ preventScroll: true });
    }, { signal: controller.signal });
    global.document?.addEventListener?.("visibilitychange", () => {
      if (global.document.hidden && isGameplayStatePlaying(instance)) pauseGame(instance, "visibility");
      else if (!global.document.hidden && instance.running && instance.paused) instance.root.querySelector("[data-hwe-resume]")?.focus?.({ preventScroll: true });
    }, { signal: controller.signal });
  }

  function mount(host, options = {}) {
    if (!host) return false;
    unmount(host);
    const instance = { host, root: null, view: safeView(options.view), state: readState(), controller: new AbortController(), destroyed: false, raf: 0, resizeObserver: null, motionObserver: null, toastTimer: 0, audioContext: null, eraFilter: "all", realmFilter: "all", tierFilter: "all", planetGroupFilter: "all", observerTimer: 0, cinematicPackManager: null, packUnsubscribe: null, packManifests: new Map(), packStates: new Map(), pendingPackId: "", pendingLocalPackId: "", inputSystem: null, inputVelocity: { x: 0, y: 0 }, remapAction: "" };
    if (typeof INPUT_SYSTEM?.createInputActionSystem === "function") {
      try {
        instance.inputSystem = INPUT_SYSTEM.createInputActionSystem({ runtime: global, clock: () => global.performance?.now?.() ?? Date.now() });
        instance.inputSystem.load?.();
      } catch { instance.inputSystem = null; }
    }
    if (instance.view === "world") {
      const requestedHash = global.location?.hash;
      const selectedMap = WORLD_ATLAS?.getMap?.(instance.state.atlasMapId);
      const mappedAddress = atlasAddressForMap(instance.state, selectedMap);
      if (selectedMap?.gameplayStatus === "atlas-reference-only") {
        global.location.hash = "#/game/timeline";
        if (requestedHash && requestedHash !== "#/game/timeline") {
          instance.inputSystem?.dispose?.();
          instance.controller.abort();
          return false;
        }
        instance.view = "timeline";
      }
      else if (mappedAddress && !instance.state.settings.convergence) {
        instance.state.worldAddress = mappedAddress;
        const mapState = { ...instance.state, settings: { ...instance.state.settings, convergence: false } };
        const playable = playableSpeciesAtAddress(mapState, mappedAddress);
        const current = SPECIES_BY_ID.get(instance.state.speciesId);
        const fallback = current && playable.some((species) => species.id === current.id) ? current : playable[0];
        if (!fallback) {
          if (global.location?.hash && global.location.hash !== "#/game/timeline") {
            instance.inputSystem?.dispose?.();
            instance.controller.abort();
            global.location.hash = "#/game/timeline";
            return false;
          }
          instance.view = "timeline";
        }
        else if (fallback.id !== current?.id) {
          instance.state.speciesId = fallback.id;
          instance.state.player = normalizeState({ speciesId: fallback.id, realmId: instance.state.realmId, atlasMapId: selectedMap.id, worldAddress: mappedAddress, player: { lineage: instance.state.player.lineage } }).player;
          saveState(instance);
        }
      } else {
        const current = SPECIES_BY_ID.get(instance.state.speciesId);
        if (!current || tierForSpecies(current) !== "flagship" || !speciesAllowedInRealm(current, instance.state.realmId, instance.state.settings.convergence)) {
          const fallback = SPECIES.find((species) => tierForSpecies(species) === "flagship" && speciesAllowedInRealm(species, instance.state.realmId, instance.state.settings.convergence));
          if (fallback) {
            instance.state.speciesId = fallback.id;
            instance.state.player = normalizeState({ speciesId: fallback.id, realmId: instance.state.realmId, player: { lineage: instance.state.player.lineage } }).player;
            syncAddressForSpecies(instance, fallback.id);
            saveState(instance);
          }
          else instance.view = "ecosystem";
        }
      }
    }
    host.innerHTML = shellMarkup(instance);
    instance.root = host.querySelector("[data-hwe-root]");
    if (instance.view === "world") instance.inputSystem?.attach?.(instance.root);
    instances.set(host, instance); activeHosts.add(host); bind(instance);
    if (instance.view === "world") initWorld(instance);
    if (instance.view === "observer") initObserver(instance);
    if (instance.view === "settings") initializeCinematicPacks(instance);
    return Object.freeze({
      version: VERSION,
      state: () => JSON.parse(JSON.stringify(instance.state)),
      pause: () => instance.running ? pauseGame(instance, "api") : false,
      // Pointer Lock requires a trusted click. Programmatic callers can expose
      // the Resume control but cannot silently reacquire the mouse.
      resume: () => { instance.root.querySelector("[data-hwe-resume]")?.focus?.({ preventScroll: true }); return false; },
      destroy: () => unmount(host)
    });
  }

  function unmount(host) {
    if (!host) {
      let removed = false;
      [...activeHosts].forEach((activeHost) => { removed = unmount(activeHost) || removed; });
      return removed;
    }
    const instance = instances.get(host);
    if (!instance) { activeHosts.delete(host); if (host) host.replaceChildren(); return false; }
    instance.destroyed = true;
    if (global.document?.pointerLockElement === instance.canvas || global.document?.pointerLockElement === instance.canvas3d) releasePointerLock(instance, true);
    if (instance.ownsFullscreen && global.document?.fullscreenElement === instance.root) global.document.exitFullscreen?.().catch?.(() => {});
    instance.ownsFullscreen = false;
    setImmersiveShell(instance, false);
    instance.rendererBootToken = (instance.rendererBootToken || 0) + 1;
    instance.controller.abort();
    clearTimeout(instance.toastTimer);
    clearInterval(instance.observerTimer);
    instance.resizeObserver?.disconnect?.();
    instance.motionObserver?.disconnect?.();
    global.cancelAnimationFrame?.(instance.raf);
    instance.inputSystem?.dispose?.();
    instance.inputSystem = null;
    instance.atlasTileCache?.close?.();
    instance.atlasTileCache = null;
    instance.atlasRenderedKeys?.clear?.();
    instance.atlasPlannedKeys?.clear?.();
    instance.atlasVisitedKeys?.clear?.();
    instance.rendererStartingAdapter?.dispose?.();
    instance.rendererStartingAdapter = null;
    instance.renderer3d?.dispose?.();
    instance.renderer3d = null;
    instance.packUnsubscribe?.();
    instance.cinematicPackManager?.dispose?.();
    instance.workerAdapter?.close?.();
    instance.simulation?.dispose?.();
    instance.audioContext?.close?.().catch?.(() => {});
    saveState(instance);
    host.replaceChildren();
    instances.delete(host);
    activeHosts.delete(host);
    return true;
  }

  return Object.freeze({ VERSION, version: VERSION, STORAGE_KEY, LEGACY_STORAGE_KEY, V2_STORAGE_KEY, OLDER_STORAGE_KEY, SCHEMA_VERSION, WORLD_SIZE, ERA_META, REALMS, BIOMES, FLAGSHIP_IDS, SPECIES, IMPORTED_SPECIES, MERGED_SPECIES_COUNT, MERGED_DUPLICATE_COUNT, EXPEDITIONS, normalizeState, stepVitals, terrainAt, terrainForRealm, createWorld, findHabitatSpawn, mount, unmount });
});
