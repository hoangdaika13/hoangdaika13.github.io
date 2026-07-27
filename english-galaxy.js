(() => {
  "use strict";

  const root = typeof window !== "undefined" ? window : globalThis;
  const levels = ["A0", "A1", "A2", "B1", "B2", "C1", "C2"];
  const levelColors = {
    A0: "#8ff7d1", A1: "#63e8ff", A2: "#80f4b4", B1: "#9a86ff",
    B2: "#ff72c9", C1: "#ffe27a", C2: "#f4f7ff"
  };
  const targets = Object.freeze({
    general: 5000, collocations: 3000, idioms: 1500, career: 4000,
    confusables: 500, sentences: 5000
  });
  const learningModes = Object.freeze([
    { id: "flashcards", icon: "◈", title: "Flashcard hai chiều", detail: "Anh ↔ Việt, lật thẻ và tự đánh giá" },
    { id: "typed-recall", icon: "⌨", title: "Tự gõ từ", detail: "Nhìn nghĩa, gõ đúng từ tiếng Anh" },
    { id: "audio-guess", icon: "◉", title: "Nghe và đoán", detail: "Nghe giọng đã chọn rồi nhận diện từ" },
    { id: "cloze", icon: "□", title: "Điền chỗ trống", detail: "Đặt từ đúng vào câu thực tế" },
    { id: "matching", icon: "⇄", title: "Ghép nghĩa", detail: "Ghép nhanh từ với nghĩa gần nhất" },
    { id: "sentence-order", icon: "≡", title: "Xếp câu", detail: "Sắp xếp từ thành câu hoàn chỉnh" },
    { id: "collocation", icon: "∞", title: "Collocation", detail: "Chọn cụm từ tự nhiên với từ khóa" },
    { id: "confusables", icon: "◇", title: "Từ dễ nhầm", detail: "Phân biệt sắc thái và ngữ cảnh" },
    { id: "dictation", icon: "▤", title: "Dictation cụm", detail: "Nghe rồi gõ lại theo từng cụm" },
    { id: "shadowing", icon: "◌", title: "Shadowing", detail: "Nhại câu giao tiếp theo nhịp" },
    { id: "mini-story", icon: "✦", title: "Mini Story", detail: "Đọc truyện ngắn dùng lại từ vừa học" },
    { id: "role-play", icon: "◎", title: "Role-play", detail: "Phỏng vấn, du lịch và công việc" },
    { id: "speed-review", icon: "⚡", title: "Speed Review 60s", detail: "Ôn nhanh các từ sắp đến hạn" },
    { id: "mistakes", icon: "⚠", title: "Mistake Notebook", detail: "Chỉ ôn những lỗi gần đây" },
    { id: "word-family", icon: "✣", title: "Word Family", detail: "Mở rộng noun, verb, adjective, adverb" },
    { id: "picture-vocabulary", icon: "✧", title: "Picture Vocabulary", detail: "Học bằng hình dung và tình huống" }
  ]);
  const topicSystems = Object.freeze([
    { id: "daily", icon: "☼", title: "Everyday Orbit", vi: "Đời sống hằng ngày", color: "#8ff7d1", tags: ["daily", "life", "family"] },
    { id: "travel", icon: "✈", title: "Travel Nebula", vi: "Du lịch & di chuyển", color: "#63e8ff", tags: ["travel", "transport", "hospitality"] },
    { id: "technology", icon: "⌘", title: "Tech Star System", vi: "Công nghệ & dữ liệu", color: "#9a86ff", tags: ["digital", "technology", "software"] },
    { id: "work", icon: "▦", title: "Work Galaxy", vi: "Công việc & giao tiếp", color: "#ffe27a", tags: ["business", "work", "communication"] },
    { id: "creative", icon: "✹", title: "Creative Nebula", vi: "Sáng tạo & truyền thông", color: "#ff72c9", tags: ["creative", "media", "design"] },
    { id: "science", icon: "⚛", title: "Science Constellation", vi: "Khoa học & nghiên cứu", color: "#72b7ff", tags: ["science", "research", "health"] },
    { id: "society", icon: "◎", title: "Society Orbit", vi: "Xã hội, luật & dịch vụ", color: "#80f4b4", tags: ["society", "legal", "service"] }
  ]);
  const phraseSeeds = Object.freeze([
    ["make a decision", "đưa ra quyết định", "work"], ["take responsibility", "chịu trách nhiệm", "work"],
    ["meet a deadline", "kịp hạn chót", "work"], ["raise a concern", "nêu mối lo ngại", "work"],
    ["keep in touch", "giữ liên lạc", "daily"], ["make progress", "tiến bộ", "daily"],
    ["pay attention", "chú ý", "daily"], ["take a break", "nghỉ giải lao", "daily"],
    ["book a room", "đặt phòng", "travel"], ["catch a flight", "kịp chuyến bay", "travel"],
    ["ask for directions", "hỏi đường", "travel"], ["check in online", "làm thủ tục trực tuyến", "travel"],
    ["run a test", "chạy kiểm thử", "technology"], ["fix a bug", "sửa lỗi", "technology"],
    ["deploy a service", "triển khai dịch vụ", "technology"], ["protect user data", "bảo vệ dữ liệu người dùng", "technology"],
    ["tell a story", "kể một câu chuyện", "creative"], ["build a portfolio", "xây dựng hồ sơ năng lực", "creative"],
    ["collect evidence", "thu thập bằng chứng", "science"], ["conduct research", "tiến hành nghiên cứu", "science"],
    ["provide support", "cung cấp hỗ trợ", "society"], ["follow the rules", "tuân thủ quy tắc", "society"]
  ]);
  const foundationSeeds = Object.freeze([
    ["hello", "/həˈloʊ/", "xin chào", "Hello, I am Minh."], ["name", "/neɪm/", "tên", "My name is Lan."],
    ["family", "/ˈfæməli/", "gia đình", "My family is small."], ["friend", "/frend/", "bạn", "She is my friend."],
    ["book", "/bʊk/", "sách", "This book is new."], ["pen", "/pen/", "bút", "The pen is blue."],
    ["house", "/haʊs/", "ngôi nhà", "This is my house."], ["water", "/ˈwɔːtər/", "nước", "Please drink some water."],
    ["food", "/fuːd/", "thức ăn", "The food is ready."], ["school", "/skuːl/", "trường học", "I walk to school."],
    ["teacher", "/ˈtiːtʃər/", "giáo viên", "Our teacher is kind."], ["student", "/ˈstuːdənt/", "học sinh", "The student is ready."],
    ["go", "/ɡoʊ/", "đi", "We go home at five."], ["come", "/kʌm/", "đến", "Come here, please."],
    ["open", "/ˈoʊpən/", "mở", "Open the window."], ["close", "/kloʊz/", "đóng", "Close the door."],
    ["good", "/ɡʊd/", "tốt", "Have a good day."], ["big", "/bɪɡ/", "to; lớn", "It is a big room."],
    ["small", "/smɔːl/", "nhỏ", "The bag is small."], ["today", "/təˈdeɪ/", "hôm nay", "Today is Monday."]
  ]);
  const confusablePairs = Object.freeze([
    ["advice", "advise", "advice là danh từ; advise là động từ"],
    ["affect", "effect", "affect thường là tác động; effect thường là kết quả"],
    ["borrow", "lend", "borrow là mượn; lend là cho mượn"],
    ["complement", "compliment", "complement là bổ sung; compliment là lời khen"],
    ["economic", "economical", "economic thuộc kinh tế; economical là tiết kiệm"],
    ["historic", "historical", "historic quan trọng trong lịch sử; historical thuộc lịch sử"],
    ["principal", "principle", "principal là chính/hiệu trưởng; principle là nguyên tắc"],
    ["stationary", "stationery", "stationary là đứng yên; stationery là văn phòng phẩm"]
  ]);
  const fallbackCurriculum = () => {
    try { return root.HHEnglishCurriculum || require("./english-curriculum.js"); } catch { return { levels: [] }; }
  };
  const fallbackCareer = () => {
    try { return root.HHEnglishCareerCurriculum || require("./english-career-curriculum.js"); } catch { return { tracks: [] }; }
  };
  const fold = (value = "") => String(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
  const topicFor = (value = "") => {
    const haystack = fold(value);
    if (/travel|flight|hotel|tour|train|airport|journey|direction|transport/.test(haystack)) return "travel";
    if (/software|data|cloud|code|api|digital|network|database|security|technology|bug|deploy/.test(haystack)) return "technology";
    if (/design|music|video|media|creative|brand|story|visual/.test(haystack)) return "creative";
    if (/science|research|health|nurse|medical|clinic|evidence|study/.test(haystack)) return "science";
    if (/law|legal|public|society|service|customer|retail/.test(haystack)) return "society";
    if (/work|business|meeting|manager|office|market|sales|finance|career/.test(haystack)) return "work";
    return "daily";
  };
  const asEntry = (entry, level, source, topicHint = "") => {
    if (Array.isArray(entry)) {
      const term = String(entry[0] || "").trim();
      if (!term) return null;
      const metadata = entry[4] || {};
      return {
        id: `${source}-${fold(term).replace(/[^a-z0-9]+/g, "-")}-${level.toLowerCase()}`,
        term, ipa: String(entry[1] || ""), ipaUS: String(entry[1] || ""), ipaUK: String(entry[1] || ""), meaning: String(entry[2] || "Xem ngữ cảnh"),
        senses: [String(entry[2] || "Xem ngữ cảnh")], vnExample: String(entry[3] || ""),
        example: String(entry[3] || ""), level, source,
        topic: topicHint || metadata.topic || topicFor(`${term} ${entry[2]}`),
        pos: metadata.pos || (/ing$/.test(term) ? "verb" : "word"),
        frequency: metadata.frequency || "core", popularity: metadata.popularity || "core",
        audio: { provider: "browser-speech", available: true },
        tags: Array.isArray(metadata.tags) ? metadata.tags : [],
        family: Array.isArray(metadata.family) ? metadata.family : [],
        collocations: Array.isArray(metadata.collocations) ? metadata.collocations : []
      };
    }
    if (!entry || typeof entry !== "object") return null;
    return asEntry([entry.word || entry.term, entry.ipa || "", entry.meaning || entry.vi || "", entry.example || "", entry.metadata || {}], level, source, topicHint);
  };
  const buildCatalog = () => {
    const curriculum = fallbackCurriculum();
    const career = fallbackCareer();
    const rows = [];
    (curriculum.levels || []).forEach((level) => (level.units || []).forEach((unit) => (unit.vocabulary || []).forEach((entry) => rows.push(asEntry(entry, level.id, "cefr", topicFor(`${unit.title} ${unit.vi}`))))));
    (career.tracks || []).forEach((track) => (track.vocabulary || []).forEach((entry) => rows.push(asEntry(entry, String(track.level || "B1").split("-")[0], "career", topicFor(`${track.name || ""} ${track.viName || ""} ${entry[0]}`)))));
    foundationSeeds.forEach((entry) => rows.push(asEntry(entry, "A0", "foundation", "daily")));
    phraseSeeds.forEach(([term, meaning, topic]) => rows.push(asEntry([term, "", meaning, `We use “${term}” in a natural sentence.`, { topic, pos: "phrase", tags: ["collocation"] }], "B1", "phrase", topic)));
    const deduped = [];
    const seen = new Set();
    rows.filter(Boolean).forEach((row) => {
      const key = fold(row.term);
      if (seen.has(key)) return;
      seen.add(key); deduped.push(row);
    });
    return deduped;
  };
  const catalog = buildCatalog();
  const packs = levels.map((level) => {
    const items = catalog.filter((item) => item.level === level);
    return { id: level.toLowerCase(), level, title: level === "A0" ? "Launch Pad" : `${level} Planet`, color: levelColors[level], count: items.length, target: level === "A0" ? 300 : Math.round(targets.general / 6), items };
  });
  const seedWords = (topic = "all", level = "all", limit = 12) => catalog.filter((item) => (topic === "all" || item.topic === topic) && (level === "all" || item.level === level)).slice(0, limit);
  const wordFamily = (term) => {
    const base = String(term || "").split(/\s+/)[0].toLowerCase().replace(/(ing|ed|s)$/, "");
    return [base, `${base}ing`, `${base}ed`, `${base}s`].filter((value, index, list) => value && list.indexOf(value) === index);
  };
  const buildChallenge = (mode = "flashcards", words = catalog, cursor = 0) => {
    const pool = words.length ? words : catalog;
    const word = pool[Math.abs(Number(cursor) || 0) % pool.length] || catalog[0];
    const distractors = pool.filter((item) => item.id !== word.id).slice(0, 3);
    const options = [word.meaning, ...distractors.map((item) => item.meaning)].filter(Boolean);
    const sentence = word.example || `Use “${word.term}” in a sentence.`;
    const modeConfig = learningModes.find((item) => item.id === mode) || learningModes[0];
    if (mode === "flashcards") return { mode, modeTitle: modeConfig.title, word, type: "flashcard", prompt: "Hãy tự nhớ nghĩa trước khi lật thẻ.", answer: word.meaning, sentence };
    if (mode === "typed-recall" || mode === "audio-guess" || mode === "dictation" || mode === "shadowing") {
      return { mode, modeTitle: modeConfig.title, word, type: "text", prompt: mode === "audio-guess" ? "Bấm phát âm thanh, sau đó gõ từ bạn nghe được." : mode === "dictation" ? "Nghe cụm từ và gõ lại chính xác." : mode === "shadowing" ? "Nghe câu mẫu, nói theo rồi ghi lại câu mục tiêu." : `Nghĩa: ${word.meaning}`, answer: word.term, sentence };
    }
    if (mode === "cloze") return { mode, modeTitle: modeConfig.title, word, type: "text", prompt: sentence.replace(new RegExp(word.term.split(/\s+/)[0], "i"), "_____"), answer: word.term, sentence };
    if (mode === "sentence-order") return { mode, modeTitle: modeConfig.title, word, type: "text", prompt: sentence.split(/\s+/).sort(() => 0.5 - ((Number(cursor) || 0) % 3) / 4).join(" / "), answer: sentence, sentence };
    if (mode === "role-play") return { mode, modeTitle: modeConfig.title, word, type: "textarea", prompt: `Bạn đang ở tình huống công việc. Hãy trả lời bằng tiếng Anh và dùng “${word.term}”.`, answer: word.term, sentence };
    if (mode === "mini-story") return { mode, modeTitle: modeConfig.title, word, type: "story", prompt: `Đọc mini story và tìm từ khóa “${word.term}”.`, answer: word.term, sentence: `Today I wanted to make progress. ${sentence} This small step helped me continue.` };
    if (mode === "word-family") return { mode, modeTitle: modeConfig.title, word, type: "text", prompt: `Viết một từ cùng họ với “${word.term}”.`, answer: wordFamily(word.term)[1] || word.term, sentence, family: wordFamily(word.term) };
    if (mode === "picture-vocabulary") return { mode, modeTitle: modeConfig.title, word, type: "text", prompt: `Hãy hình dung cảnh: ${word.example || word.meaning}. Từ tiếng Anh là gì?`, answer: word.term, sentence };
    if (mode === "speed-review" || mode === "mistakes") return { mode, modeTitle: modeConfig.title, word, type: "choice", prompt: `Chọn nghĩa đúng của “${word.term}”.`, answer: word.meaning, options, sentence };
    if (mode === "collocation") return { mode, modeTitle: modeConfig.title, word, type: "choice", prompt: `Cụm nào dùng tự nhiên với “${word.term}”?`, answer: phraseSeeds.find((item) => item[0].includes(word.term))?.[0] || `${word.term} in context`, options: [phraseSeeds.find((item) => item[0].includes(word.term))?.[0] || `${word.term} in context`, "blue context", "quick planet"], sentence };
    if (mode === "confusables") {
      const pair = confusablePairs.find((item) => item.includes(word.term)) || confusablePairs[(Number(cursor) || 0) % confusablePairs.length];
      return { mode, modeTitle: modeConfig.title, word, type: "choice", prompt: `Cặp “${pair[0]} / ${pair[1]}” khác nhau thế nào?`, answer: pair[2], options: [pair[2], "Hai từ luôn đồng nghĩa", "Chỉ khác cách viết"], sentence };
    }
    if (mode === "matching") return { mode, modeTitle: modeConfig.title, word, type: "choice", prompt: `“${word.term}” có nghĩa gần nhất là gì?`, answer: word.meaning, options, sentence };
    return { mode, modeTitle: modeConfig.title, word, type: "choice", prompt: `“${word.term}” có nghĩa gần nhất là gì?`, answer: word.meaning, options, sentence };
  };
  const stats = () => ({
    catalog: catalog.length,
    unique: catalog.length,
    targets,
    packs: packs.map(({ id, level, title, color, count, target }) => ({ id, level, title, color, count, target })),
    phrases: phraseSeeds.length,
    confusables: confusablePairs.length
  });
  const api = { levels, levelColors, targets, learningModes, topicSystems, phraseSeeds, confusablePairs, catalog, packs, seedWords, buildChallenge, stats, wordFamily, fold };
  root.HHEnglishGalaxy = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})();
