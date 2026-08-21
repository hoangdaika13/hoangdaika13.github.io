(function initHHChinese(root) {
  "use strict";

  const VERSION = 1;
  const STORAGE_KEY = "hh.chinese.state.v1";
  const VIEWS = [
    ["dashboard", "星图总览", "Tổng quan"],
    ["pinyin", "拼音实验室", "Pinyin Lab"],
    ["vocabulary", "词汇星库", "Từ vựng & SRS"],
    ["hanzi", "汉字工坊", "Hanzi Studio"],
    ["reading", "阅读舱", "Đọc hiểu"],
    ["grammar", "语法轨道", "Ngữ pháp"],
    ["speaking", "声音舱", "Nghe & nói"],
    ["exam", "HSK模拟", "Mô phỏng HSK"],
    ["dictionary", "星际词典", "Từ điển"]
  ];
  const LEVELS = ["1", "2", "3", "4", "5", "6", "7-9"];
  const TONE_NAMES = { 1: "Thanh 1 · cao ngang", 2: "Thanh 2 · lên", 3: "Thanh 3 · hạ lên", 4: "Thanh 4 · rơi", 5: "Thanh nhẹ" };
  const WORDS = [
    ["cn-001", "你好", "你好", "nǐ hǎo", "xin chào", "1", "cụm từ", "你好！我叫安。", "Xin chào! Tôi tên An.", 9],
    ["cn-002", "谢谢", "謝謝", "xièxie", "cảm ơn", "1", "động từ", "谢谢你的帮助。", "Cảm ơn sự giúp đỡ của bạn.", 24],
    ["cn-003", "再见", "再見", "zàijiàn", "tạm biệt", "1", "cụm từ", "明天再见！", "Hẹn gặp lại ngày mai!", 13],
    ["cn-004", "我", "我", "wǒ", "tôi, mình", "1", "đại từ", "我是学生。", "Tôi là học sinh.", 7],
    ["cn-005", "你", "你", "nǐ", "bạn", "1", "đại từ", "你好吗？", "Bạn khỏe không?", 7],
    ["cn-006", "他", "他", "tā", "anh ấy", "1", "đại từ", "他是老师。", "Anh ấy là giáo viên.", 5],
    ["cn-007", "她", "她", "tā", "cô ấy", "1", "đại từ", "她喜欢音乐。", "Cô ấy thích âm nhạc.", 6],
    ["cn-008", "是", "是", "shì", "là, đúng", "1", "động từ", "这是我的书。", "Đây là sách của tôi.", 9],
    ["cn-009", "不", "不", "bù", "không", "1", "phó từ", "我不是老师。", "Tôi không phải giáo viên.", 4],
    ["cn-010", "中国", "中國", "Zhōngguó", "Trung Quốc", "1", "danh từ", "我学习中文。", "Tôi học tiếng Trung.", 13],
    ["cn-011", "中文", "中文", "Zhōngwén", "tiếng Trung", "1", "danh từ", "中文很有意思。", "Tiếng Trung rất thú vị.", 8],
    ["cn-012", "学习", "學習", "xuéxí", "học tập", "1", "động từ", "我每天学习中文。", "Mỗi ngày tôi học tiếng Trung.", 16],
    ["cn-013", "学生", "學生", "xuésheng", "học sinh, sinh viên", "1", "danh từ", "她是我的学生。", "Cô ấy là học sinh của tôi.", 11],
    ["cn-014", "老师", "老師", "lǎoshī", "giáo viên", "1", "danh từ", "老师，请再说一次。", "Thưa cô/thầy, hãy nói lại.", 14],
    ["cn-015", "朋友", "朋友", "péngyou", "bạn bè", "1", "danh từ", "他是我的好朋友。", "Anh ấy là bạn tốt của tôi.", 16],
    ["cn-016", "喜欢", "喜歡", "xǐhuan", "thích", "1", "động từ", "我喜欢看书。", "Tôi thích đọc sách.", 21],
    ["cn-017", "家", "家", "jiā", "nhà, gia đình", "1", "danh từ", "我家在河内。", "Nhà tôi ở Hà Nội.", 10],
    ["cn-018", "工作", "工作", "gōngzuò", "công việc; làm việc", "1", "danh/động từ", "你在哪里工作？", "Bạn làm việc ở đâu?", 11],
    ["cn-019", "吃", "吃", "chī", "ăn", "1", "động từ", "你吃饭了吗？", "Bạn ăn cơm chưa?", 6],
    ["cn-020", "喝水", "喝水", "hē shuǐ", "uống nước", "1", "cụm động từ", "请多喝水。", "Hãy uống nhiều nước.", 14],
    ["cn-021", "今天", "今天", "jīntiān", "hôm nay", "1", "danh từ", "今天星期几？", "Hôm nay là thứ mấy?", 8],
    ["cn-022", "明天", "明天", "míngtiān", "ngày mai", "1", "danh từ", "明天见。", "Hẹn gặp ngày mai.", 8],
    ["cn-023", "现在", "現在", "xiànzài", "bây giờ", "1", "phó từ", "我现在很忙。", "Bây giờ tôi rất bận.", 12],
    ["cn-024", "什么", "什麼", "shénme", "cái gì", "1", "đại từ nghi vấn", "你想吃什么？", "Bạn muốn ăn gì?", 10],
    ["cn-025", "多少", "多少", "duōshao", "bao nhiêu", "1", "đại từ nghi vấn", "这个多少钱？", "Cái này bao nhiêu tiền?", 8],
    ["cn-026", "哪里", "哪裡", "nǎlǐ", "ở đâu", "1", "đại từ nghi vấn", "你住在哪里？", "Bạn sống ở đâu?", 17],
    ["cn-027", "看", "看", "kàn", "nhìn; đọc; xem", "1", "động từ", "我喜欢看电影。", "Tôi thích xem phim.", 9],
    ["cn-028", "听", "聽", "tīng", "nghe", "1", "động từ", "请听录音。", "Hãy nghe bản ghi âm.", 7],
    ["cn-029", "说", "說", "shuō", "nói", "1", "động từ", "请说慢一点。", "Hãy nói chậm một chút.", 9],
    ["cn-030", "请", "請", "qǐng", "mời; xin vui lòng", "1", "động từ", "请坐。", "Mời ngồi.", 10],
    ["cn-031", "因为", "因為", "yīnwèi", "bởi vì", "2", "liên từ", "因为下雨，所以我没去。", "Vì mưa nên tôi không đi.", 14],
    ["cn-032", "所以", "所以", "suǒyǐ", "cho nên", "2", "liên từ", "我很累，所以想休息。", "Tôi mệt nên muốn nghỉ.", 15],
    ["cn-033", "觉得", "覺得", "juéde", "cảm thấy; cho rằng", "2", "động từ", "我觉得中文很有趣。", "Tôi thấy tiếng Trung thú vị.", 20],
    ["cn-034", "已经", "已經", "yǐjīng", "đã, rồi", "2", "phó từ", "我已经吃饭了。", "Tôi đã ăn cơm rồi.", 13],
    ["cn-035", "应该", "應該", "yīnggāi", "nên, cần phải", "2", "động từ năng nguyện", "你应该早点睡。", "Bạn nên ngủ sớm hơn.", 22],
    ["cn-036", "如果", "如果", "rúguǒ", "nếu", "3", "liên từ", "如果有时间，我们一起学习。", "Nếu có thời gian, chúng ta cùng học.", 16],
    ["cn-037", "虽然", "雖然", "suīrán", "mặc dù", "3", "liên từ", "虽然很难，但是我不放弃。", "Mặc dù khó nhưng tôi không bỏ cuộc.", 22],
    ["cn-038", "环境", "環境", "huánjìng", "môi trường", "4", "danh từ", "我们要保护环境。", "Chúng ta cần bảo vệ môi trường.", 22],
    ["cn-039", "经验", "經驗", "jīngyàn", "kinh nghiệm", "4", "danh từ", "他有丰富的经验。", "Anh ấy có nhiều kinh nghiệm.", 23],
    ["cn-040", "发展", "發展", "fāzhǎn", "phát triển", "5", "động từ/danh từ", "科技发展很快。", "Công nghệ phát triển rất nhanh.", 18]
  ].map(function (row) { return { id: row[0], hanzi: row[1], traditional: row[2], pinyin: row[3], meaning: row[4], level: row[5], pos: row[6], example: row[7], exampleVi: row[8], strokes: row[9], tones: (row[3].match(/[1-5]/g) || []).map(Number) }; });
  const WORD_MAP = new Map(WORDS.map(function (word) { return [word.id, word]; }));
  const GRAMMAR = [
    ["g1", "是 · A 是 B", "1", "Chủ ngữ + 是 + danh từ", "我是学生。", "Tôi là học sinh.", "Không dùng 是 trước tính từ thông thường."],
    ["g2", "有 · Có / tồn tại", "1", "Chủ ngữ + 有 + tân ngữ", "我有一个朋友。", "Tôi có một người bạn.", "Phủ định thường dùng 没有, không dùng 不有."],
    ["g3", "在 · Địa điểm", "1", "Chủ ngữ + 在 + địa điểm + động từ", "我在家学习。", "Tôi học ở nhà.", "Địa điểm thường đứng trước động từ."],
    ["g4", "了 · Hoàn thành / thay đổi", "2", "Động từ + 了 / câu + 了", "我吃饭了。", "Tôi ăn cơm rồi.", "Phân biệt tình thái câu và hoàn thành theo ngữ cảnh."],
    ["g5", "因为…所以…", "2", "因为 + nguyên nhân， 所以 + kết quả", "因为下雨，所以我没去。", "Vì mưa nên tôi không đi.", "Dùng để nối nguyên nhân và kết quả."],
    ["g6", "把 · Xử lý đối tượng", "4", "Chủ ngữ + 把 + đối tượng + động từ + kết quả", "请把门关上。", "Hãy đóng cửa lại.", "Cần có đối tượng rõ và kết quả/tác động rõ."]
  ].map(function (row) { return { id: row[0], title: row[1], level: row[2], formula: row[3], example: row[4], translation: row[5], note: row[6] }; });
  const READINGS = [
    { id: "r1", title: "第一次见面", level: "1", hanzi: "你好！我叫安。我是越南人。你呢？", pinyin: "Nǐ hǎo! Wǒ jiào Ān. Wǒ shì Yuènán rén. Nǐ ne?", vi: "Xin chào! Tôi tên An. Tôi là người Việt Nam. Còn bạn?" },
    { id: "r2", title: "我的一天", level: "2", hanzi: "我每天早上七点起床，喝水，然后学习中文。晚上我喜欢看书。", pinyin: "Wǒ měitiān zǎoshang qī diǎn qǐchuáng, hē shuǐ, ránhòu xuéxí Zhōngwén.", vi: "Mỗi sáng tôi thức dậy lúc bảy giờ, uống nước rồi học tiếng Trung. Buổi tối tôi thích đọc sách." },
    { id: "r3", title: "一起学习", level: "3", hanzi: "虽然学习汉字需要时间，但是每天练习一点，就会越来越好。", pinyin: "Suīrán xuéxí Hànzì xūyào shíjiān, dànshì měitiān liànxí yìdiǎn.", vi: "Mặc dù học chữ Hán cần thời gian, nhưng mỗi ngày luyện một chút sẽ ngày càng tốt hơn." }
  ];
  const EXAM_ITEMS = [
    { id: "e1", level: "1", skill: "Từ vựng", prompt: "Chọn nghĩa phù hợp với 你好", options: ["Xin chào", "Tạm biệt", "Cảm ơn", "Xin lỗi"], answer: 0, explanation: "你好 (nǐ hǎo) là lời chào cơ bản." },
    { id: "e2", level: "1", skill: "Pinyin", prompt: "Pinyin đúng của 我 là gì?", options: ["wǒ", "wò", "wō", "wó"], answer: 0, explanation: "我 đọc wǒ, thanh 3." },
    { id: "e3", level: "2", skill: "Ngữ pháp", prompt: "Câu nào nghĩa là Vì trời mưa nên tôi không đi?", options: ["因为下雨，所以我没去。", "我因为去，所以下雨。", "所以下雨，因为我没去。", "我没去因为下雨。"], answer: 0, explanation: "因为…所以… nối nguyên nhân và kết quả." },
    { id: "e4", level: "3", skill: "Đọc hiểu", prompt: "虽然很难，但是我不放弃。 Người nói làm gì?", options: ["Bỏ cuộc", "Không bỏ cuộc", "Đang ngủ", "Đang ăn"], answer: 1, explanation: "不放弃 nghĩa là không bỏ cuộc." }
  ];
  const PINYIN_INITIALS = ["b", "p", "m", "f", "d", "t", "n", "l", "g", "k", "h", "j", "q", "x", "zh", "ch", "sh", "r", "z", "c", "s", "y", "w"];
  const PINYIN_FINALS = ["a", "o", "e", "i", "u", "ü", "ai", "ei", "ao", "ou", "an", "en", "ang", "eng", "ong", "ia", "ie", "iao", "iu", "ian", "in", "iang", "ing", "iong", "ua", "uo", "uai", "ui", "uan", "un", "uang", "üe", "er"];
  let activeAbort = null;
  let recognition = null;
  let activeHost = null;
  const esc = function (value) { return String(value == null ? "" : value).replace(/[&<>\"']/g, function (char) { return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" })[char]; }); };
  const text = function (value, max) { return String(value == null ? "" : value).replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, max || 500); };
  const ownerKey = function (options) { return text((options && options.currentUser && (options.currentUser.id || options.currentUser._id)) || "guest", 80).replace(/[^a-z0-9_-]/gi, "_") || "guest"; };
  const storageKey = function (options) { return STORAGE_KEY + ":" + ownerKey(options); };
  const levelLabel = function (level) { return level === "7-9" ? "HSK 7–9" : "HSK " + level; };
  const wordForScript = function (word, script) { return script === "traditional" ? word.traditional : word.hanzi; };
  const toneName = function (tone) { return TONE_NAMES[tone] || TONE_NAMES[5]; };
  const speechStatus = function () { return { synthesis: Boolean(root.speechSynthesis && root.SpeechSynthesisUtterance), recognition: Boolean(root.SpeechRecognition || root.webkitSpeechRecognition) }; };
  const normalizePinyin = function (value) { return text(value, 160).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/ü/g, "v").replace(/[^a-z0-9v ]/g, ""); };
  function defaultState() { return { version: VERSION, view: "dashboard", level: "1", script: "simplified", pinyinVisible: true, tone: 1, wordIndex: 0, revealed: false, selectedReading: "r1", readingMode: "both", grammarLevel: "1", examIndex: 0, examSelection: null, examSubmitted: false, examScore: 0, writingScore: null, writingAttempts: 0, dictionaryQuery: "", due: WORDS.slice(0, 12).map(function (word) { return { id: word.id, dueAt: 0, interval: 0, reps: 0, lapses: 0 }; }), favorites: [], listened: 0, speakingStatus: "", streak: 0, updatedAt: new Date().toISOString() }; }
  function normalizeState(input) { const base = defaultState(), raw = input && typeof input === "object" ? input : {}; const due = Array.isArray(raw.due) ? raw.due : base.due; return Object.assign({}, base, { view: VIEWS.some(function (item) { return item[0] === raw.view; }) ? raw.view : base.view, level: LEVELS.indexOf(String(raw.level)) >= 0 ? String(raw.level) : base.level, script: raw.script === "traditional" ? "traditional" : "simplified", pinyinVisible: raw.pinyinVisible !== false, tone: [1, 2, 3, 4, 5].indexOf(Number(raw.tone)) >= 0 ? Number(raw.tone) : 1, wordIndex: Math.max(0, Math.min(WORDS.length - 1, Number(raw.wordIndex) || 0)), revealed: raw.revealed === true, selectedReading: READINGS.some(function (item) { return item.id === raw.selectedReading; }) ? raw.selectedReading : "r1", readingMode: ["hanzi", "pinyin", "vi", "both"].indexOf(raw.readingMode) >= 0 ? raw.readingMode : "both", grammarLevel: LEVELS.indexOf(String(raw.grammarLevel)) >= 0 ? String(raw.grammarLevel) : "1", examIndex: Math.max(0, Math.min(EXAM_ITEMS.length - 1, Number(raw.examIndex) || 0)), examSelection: Number.isInteger(raw.examSelection) ? raw.examSelection : null, examSubmitted: raw.examSubmitted === true, examScore: Math.max(0, Math.min(EXAM_ITEMS.length, Number(raw.examScore) || 0)), writingScore: Number.isFinite(Number(raw.writingScore)) ? Math.max(0, Math.min(100, Number(raw.writingScore))) : null, writingAttempts: Math.max(0, Number(raw.writingAttempts) || 0), dictionaryQuery: text(raw.dictionaryQuery, 100), due: due.map(function (item) { return { id: WORD_MAP.has(item && item.id) ? item.id : WORDS[0].id, dueAt: Math.max(0, Number(item && item.dueAt) || 0), interval: Math.max(0, Number(item && item.interval) || 0), reps: Math.max(0, Number(item && item.reps) || 0), lapses: Math.max(0, Number(item && item.lapses) || 0) }; }).slice(0, 120), favorites: Array.isArray(raw.favorites) ? raw.favorites.filter(function (id) { return WORD_MAP.has(id); }).slice(0, 100) : [], listened: Math.max(0, Number(raw.listened) || 0), speakingStatus: text(raw.speakingStatus, 180), streak: Math.max(0, Number(raw.streak) || 0), updatedAt: text(raw.updatedAt, 40) || base.updatedAt }); }
  function loadState(options) { try { return normalizeState(JSON.parse(root.localStorage.getItem(storageKey(options)) || "null")); } catch (error) { return defaultState(); } }
  function saveState(state, options) { const next = normalizeState(Object.assign({}, state, { updatedAt: new Date().toISOString() })); try { root.localStorage.setItem(storageKey(options), JSON.stringify(next)); } catch (error) {} return next; }
  function currentWord(state) { const due = state.due.filter(function (item) { return item.dueAt <= Date.now(); }).sort(function (a, b) { return a.dueAt - b.dueAt; }); const item = due[0] || state.due[state.wordIndex % Math.max(1, state.due.length)] || { id: WORDS[state.wordIndex % WORDS.length].id }; return WORD_MAP.get(item.id) || WORDS[0]; }
  function cardState(state, word) { return state.due.find(function (item) { return item.id === word.id; }) || { id: word.id, dueAt: 0, interval: 0, reps: 0, lapses: 0 }; }
  function scheduleReview(card, grade, timestamp) { const intervals = { again: 0.007, hard: 1, good: Math.max(2, (card.interval || 1) * 2), easy: Math.max(4, (card.interval || 2) * 3) }; const interval = intervals[grade] || intervals.good; return Object.assign({}, card, { dueAt: (timestamp || Date.now()) + interval * 86400000, interval: interval < 1 ? 0 : Math.round(interval), reps: card.reps + 1, lapses: grade === "again" ? card.lapses + 1 : card.lapses }); }
  function speak(value) { if (!root.speechSynthesis || typeof root.SpeechSynthesisUtterance !== "function") return false; root.speechSynthesis.cancel(); const utterance = new root.SpeechSynthesisUtterance(value); utterance.lang = "zh-CN"; utterance.rate = .82; root.speechSynthesis.speak(utterance); return true; }
  function dueCount(state) { return state.due.filter(function (item) { return item.dueAt <= Date.now(); }).length; }
  function toneClass(tone) { return "tone-" + (Number(tone) || 5); }

  function headerMarkup(state) {
    let levels = LEVELS.map(function (level) { return "<option value=\"" + level + "\"" + (state.level === level ? " selected" : "") + ">" + levelLabel(level) + "</option>"; }).join("");
    return "<header class=\"hhc-topbar\"><button class=\"hhc-brand\" type=\"button\" data-hhc-view=\"dashboard\"><i>中</i><span><b>HH Chinese</b><small>Mandarin Learning Galaxy · v" + VERSION + "</small></span></button><div class=\"hhc-context\"><label><span>Cấp</span><select data-hhc-level aria-label=\"Cấp HSK\">" + levels + "</select></label><label><span>Chữ</span><select data-hhc-script aria-label=\"Giản thể hoặc phồn thể\"><option value=\"simplified\"" + (state.script === "simplified" ? " selected" : "") + ">简体</option><option value=\"traditional\"" + (state.script === "traditional" ? " selected" : "") + ">繁體</option></select></label><span class=\"hhc-status\"><i></i>Local-first</span></div></header>";
  }
  function navMarkup(state) {
    const icons = { dashboard: "⌂", pinyin: "拼", vocabulary: "词", hanzi: "字", reading: "读", grammar: "语", speaking: "声", exam: "试", dictionary: "典" };
    return "<nav class=\"hhc-nav\" aria-label=\"HH Chinese\"><small>ORBITAL MODULES</small>" + VIEWS.map(function (item) { return "<button type=\"button\" class=\"" + (state.view === item[0] ? "is-active" : "") + "\" data-hhc-view=\"" + item[0] + "\" aria-current=\"" + (state.view === item[0] ? "page" : "false") + "\"><i>" + icons[item[0]] + "</i><span><b>" + item[1] + "</b><small>" + item[2] + "</small></span></button>"; }).join("") + "<div class=\"hhc-nav-note\"><strong>HSK 3.0</strong><span>3 giai đoạn · 9 cấp</span><small>Task · topic · vocabulary · grammar · characters</small></div></nav>";
  }
  function dashboardMarkup(state) {
    const progress = Math.round(state.due.filter(function (item) { return item.reps > 0; }).length / Math.max(1, state.due.length) * 100);
    const speech = speechStatus();
    return "<main class=\"hhc-main hhc-dashboard\"><section class=\"hhc-hero\"><div><span class=\"hhc-kicker\">HH CHINESE · MANDARIN GALAXY</span><h1>Chinh phục tiếng Trung theo quỹ đạo của bạn.</h1><p>Học phát âm trước, ghi nhớ từ trong ngữ cảnh, luyện chữ Hán, nghe–nói và kiểm tra theo nhiệm vụ nhỏ mỗi ngày.</p><div class=\"hhc-hero-actions\"><button class=\"is-primary\" type=\"button\" data-hhc-view=\"vocabulary\">Ôn " + dueCount(state) + " thẻ đến hạn →</button><button type=\"button\" data-hhc-view=\"pinyin\">Mở Pinyin Lab</button><button type=\"button\" data-hhc-view=\"reading\">Đọc một truyện ngắn</button></div></div><div class=\"hhc-orbit-scene\" aria-hidden=\"true\"><div class=\"hhc-orbit hhc-orbit-a\"></div><div class=\"hhc-orbit hhc-orbit-b\"></div><div class=\"hhc-core\"><span>中</span><small>HH</small></div><i class=\"hhc-orbit-dot dot-a\"></i><i class=\"hhc-orbit-dot dot-b\"></i><i class=\"hhc-orbit-dot dot-c\"></i></div></section><section class=\"hhc-mission-grid\"><article class=\"hhc-card hhc-progress-card\"><header><div><small>DAILY MISSION</small><h2>Nhịp học hôm nay</h2></div><b>" + progress + "%</b></header><div class=\"hhc-progress\"><i style=\"--progress:" + progress + "%\"></i></div><p>" + (dueCount(state) ? "Bạn còn " + dueCount(state) + " thẻ cần ôn." : "Không còn thẻ đến hạn — hãy mở một nhiệm vụ mới.") + "</p><footer><span>" + state.streak + " ngày liên tiếp</span><span>" + state.due.filter(function (item) { return item.reps > 0; }).length + "/" + state.due.length + " đã gặp</span></footer></article><article class=\"hhc-card\"><header><div><small>SKILL CONSTELLATION</small><h2>5 kỹ năng</h2></div><span class=\"hhc-badge\">HSK 3.0</span></header><div class=\"hhc-skill-rings\"><span style=\"--value:" + Math.min(100, progress + 12) + "%\"><b>声</b><small>Nghe</small></span><span style=\"--value:" + Math.min(100, progress + 5) + "%\"><b>说</b><small>Nói</small></span><span style=\"--value:" + progress + "%\"><b>读</b><small>Đọc</small></span><span style=\"--value:" + Math.max(8, progress - 9) + "%\"><b>写</b><small>Viết</small></span></div><p class=\"hhc-muted\">Speech synthesis " + (speech.synthesis ? "sẵn sàng" : "chưa hỗ trợ") + " · recognition " + (speech.recognition ? "sẵn sàng" : "chưa có") + ".</p></article><article class=\"hhc-card hhc-source-card\"><header><div><small>DATA PROVENANCE</small><h2>Dữ liệu minh bạch</h2></div><span class=\"hhc-source-seal\">LOCAL</span></header><p>Seed bài học do HH biên soạn. Bộ dữ liệu mở rộng phải kèm license, nguồn và phiên bản riêng.</p><div><span>✓ Không gửi nội dung riêng tư mặc định</span><span>✓ Đáp án chỉ mở sau khi tự trả lời</span><span>✓ Giản thể / phồn thể cùng hồ sơ</span></div></article></section><section class=\"hhc-module-grid\"><button type=\"button\" data-hhc-view=\"hanzi\"><span>汉</span><strong>Hanzi Studio</strong><small>Canvas viết + guide nét</small><b>→</b></button><button type=\"button\" data-hhc-view=\"grammar\"><span>语</span><strong>Grammar Orbit</strong><small>Mẫu câu theo ngữ cảnh</small><b>→</b></button><button type=\"button\" data-hhc-view=\"speaking\"><span>声</span><strong>Voice Dock</strong><small>Nghe, nói, shadowing</small><b>→</b></button><button type=\"button\" data-hhc-view=\"exam\"><span>试</span><strong>HSK Simulator</strong><small>Chấm sau khi nộp</small><b>→</b></button></section></main>";
  }
  function pinyinMarkup(state) {
    const tones = [1, 2, 3, 4, 5].map(function (tone) { return "<button type=\"button\" class=\"hhc-tone-card " + (state.tone === tone ? "is-active " : "") + toneClass(tone) + "\" data-hhc-tone=\"" + tone + "\"><span class=\"hhc-tone-number\">" + (tone === 5 ? "·" : tone) + "</span><strong>" + toneName(tone) + "</strong><div class=\"hhc-tone-curve tone-curve-" + tone + "\"></div><small>" + ["mā", "má", "mǎ", "mà", "ma"][tone - 1] + "</small></button>"; }).join("");
    return "<main class=\"hhc-main hhc-pinyin\"><section class=\"hhc-section-head\"><div><span class=\"hhc-kicker\">PRONUNCIATION CONSTELLATION</span><h1>Pinyin Lab · 4 thanh + thanh nhẹ</h1><p>Chạm vào thanh để nghe giọng hệ thống. Đồ thị là mô hình cao độ tham khảo.</p></div><button type=\"button\" class=\"hhc-speak-button\" data-hhc-speak=\"你好\">▶ Nghe nǐ hǎo</button></section><section class=\"hhc-tone-grid\">" + tones + "</section><section class=\"hhc-pinyin-board hhc-card\"><header><div><small>INITIALS</small><h2>Thanh mẫu</h2></div><span>23 âm đầu</span></header><div class=\"hhc-syllable-grid\">" + PINYIN_INITIALS.map(function (item) { return "<button type=\"button\" data-hhc-speak=\"" + item + "\">" + item + "</button>"; }).join("") + "</div><header><div><small>FINALS</small><h2>Vận mẫu</h2></div><span>33 nhóm âm</span></header><div class=\"hhc-syllable-grid hhc-final-grid\">" + PINYIN_FINALS.map(function (item) { return "<button type=\"button\" data-hhc-speak=\"" + item + "\">" + item + "</button>"; }).join("") + "</div></section><div class=\"hhc-method-note\"><b>Gợi ý luyện:</b> nghe → nói lại → ghi âm → so sánh. Không tự gán điểm phát âm khi trình duyệt không cung cấp dữ liệu.</div></main>";
  }
  function vocabularyMarkup(state) {
    const word = currentWord(state), card = cardState(state, word), display = wordForScript(word, state.script);
    const answer = state.revealed ? "<div class=\"hhc-vocab-answer\"><b>" + esc(word.meaning) + "</b><small>" + esc(word.example) + "</small><p>" + esc(word.exampleVi) + "</p></div>" : "<div class=\"hhc-locked-answer\"><i>✦</i><strong>Đáp án đang ở sau màn sương</strong><span>Tự nói pinyin và nghĩa trước khi lật thẻ.</span></div>";
    const actions = state.revealed ? "<button data-hhc-grade=\"again\">Quên</button><button data-hhc-grade=\"hard\">Khó</button><button class=\"is-primary\" data-hhc-grade=\"good\">Nhớ</button><button data-hhc-grade=\"easy\">Rất dễ</button>" : "<button class=\"is-primary\" data-hhc-reveal>Hiện pinyin & nghĩa</button>";
    const deck = state.due.slice(0, 8).map(function (item) { const row = WORD_MAP.get(item.id); return "<button type=\"button\" class=\"" + (row.id === word.id ? "is-active" : "") + "\" data-hhc-jump-word=\"" + row.id + "\"><span>" + esc(wordForScript(row, state.script)) + "</span><small>" + (item.reps ? item.reps + " lần" : "mới") + "</small><i></i></button>"; }).join("");
    return "<main class=\"hhc-main hhc-vocabulary\"><section class=\"hhc-section-head\"><div><span class=\"hhc-kicker\">SPACED REPETITION ORBIT</span><h1>词汇星库 · Từ vựng có lịch ôn</h1><p>Thẻ mới không hiển thị đáp án trước khi bạn tự nhớ.</p></div><div class=\"hhc-review-count\"><strong>" + dueCount(state) + "</strong><span>thẻ đến hạn</span></div></section><section class=\"hhc-vocab-layout\"><article class=\"hhc-card hhc-vocab-card\"><header><span>" + levelLabel(word.level) + " · " + esc(word.pos) + "</span><button data-hhc-favorite=\"" + word.id + "\" aria-label=\"Lưu từ\">" + (state.favorites.indexOf(word.id) >= 0 ? "★" : "☆") + "</button></header><div class=\"hhc-vocab-front\"><small>" + (state.revealed ? "TỪ ĐANG HỌC" : "HÃY NHỚ TỪ NÀY") + "</small><strong>" + esc(display) + "</strong><span>" + (state.revealed ? esc(word.pinyin) : "Pinyin đang khóa") + "</span></div>" + answer + "<div class=\"hhc-vocab-actions\">" + actions + "</div><footer><span>Ôn lại: " + (card.interval ? card.interval + " ngày" : "thẻ mới") + "</span><span>" + card.reps + " lần gặp</span></footer></article><aside class=\"hhc-card hhc-deck-card\"><header><div><small>DECK LOCAL</small><h2>Hành tinh từ vựng</h2></div><span>" + state.due.length + " thẻ</span></header><div class=\"hhc-deck-list\">" + deck + "</div><p class=\"hhc-muted\">Lịch SRS được lưu theo hồ sơ trên thiết bị.</p></aside></section></main>";
  }
  function hanziMarkup(state) {
    const word = WORDS[state.wordIndex % WORDS.length];
    return "<main class=\"hhc-main hhc-hanzi\"><section class=\"hhc-section-head\"><div><span class=\"hhc-kicker\">CHARACTER CONSTELLATION</span><h1>汉字工坊 · Viết chữ Hán</h1><p>Canvas nhận chuột, cảm ứng hoặc bút. Điểm hiện tại là heuristic về nét và vùng phủ.</p></div><button data-hhc-speak=\"" + esc(word.hanzi) + "\">▶ Nghe " + esc(word.hanzi) + "</button></section><section class=\"hhc-hanzi-layout\"><article class=\"hhc-card hhc-hanzi-guide\"><header><span>" + levelLabel(word.level) + " · " + word.strokes + " nét</span><button data-hhc-next-character>Đổi chữ ↗</button></header><div class=\"hhc-character-orb\"><span>" + esc(wordForScript(word, state.script)) + "</span><i></i></div><h2>" + esc(word.pinyin) + "</h2><p>" + esc(word.meaning) + "</p><div class=\"hhc-stroke-track\"><span>1 · 先横后竖</span><span>2 · 从左到右</span><span>3 · 从上到下</span></div><small class=\"hhc-muted\">Guide nét local minh họa; dữ liệu stroke order đầy đủ sẽ kèm license.</small></article><article class=\"hhc-card hhc-writing-panel\"><header><div><small>WRITING CANVAS</small><h2>Vẽ lại " + esc(wordForScript(word, state.script)) + "</h2></div><span data-hhc-writing-status>" + (state.writingScore === null ? "Chưa chấm" : "Heuristic " + state.writingScore + "/100") + "</span></header><div class=\"hhc-writing-canvas-wrap\"><canvas width=\"520\" height=\"360\" data-hhc-writing-canvas aria-label=\"Canvas luyện viết chữ Hán\"></canvas><span class=\"hhc-canvas-guide\">" + esc(wordForScript(word, state.script)) + "</span></div><div class=\"hhc-writing-actions\"><button data-hhc-check-writing>Chấm nét heuristic</button><button data-hhc-clear-writing>Xóa nét</button><button data-hhc-show-strokes>Xem thứ tự nét</button></div><p class=\"hhc-muted\">Giữ hướng viết từ trên xuống, trái sang phải; nhớ cấu trúc trước tốc độ.</p></article></section></main>";
  }
  function readingMarkup(state) {
    const story = READINGS.find(function (item) { return item.id === state.selectedReading; }) || READINGS[0];
    const modes = [["hanzi", "汉字"], ["pinyin", "Pinyin"], ["vi", "Tiếng Việt"], ["both", "Song song"]].map(function (item) { return "<button class=\"" + (state.readingMode === item[0] ? "is-active" : "") + "\" data-hhc-reading-mode=\"" + item[0] + "\">" + item[1] + "</button>"; }).join("");
    return "<main class=\"hhc-main hhc-reading\"><section class=\"hhc-section-head\"><div><span class=\"hhc-kicker\">GRADUATED READER ORBIT</span><h1>阅读舱 · Đọc hiểu theo cấp</h1><p>Đọc đoạn ngắn, bật/tắt pinyin và bản dịch, chạm câu để nghe.</p></div><div class=\"hhc-reading-modes\">" + modes + "</div></section><section class=\"hhc-reading-layout\"><aside class=\"hhc-card hhc-story-list\">" + READINGS.map(function (item) { return "<button class=\"" + (item.id === story.id ? "is-active" : "") + "\" data-hhc-reading=\"" + item.id + "\"><span>" + levelLabel(item.level) + "</span><strong>" + esc(item.title) + "</strong><small>" + esc(item.hanzi.slice(0, 24)) + "…</small></button>"; }).join("") + "</aside><article class=\"hhc-card hhc-story-card\"><header><span>" + levelLabel(story.level) + "</span><button data-hhc-speak=\"" + esc(story.hanzi) + "\">▶ Nghe đoạn</button></header><h2>" + esc(story.title) + "</h2><div class=\"hhc-story-text mode-" + state.readingMode + "\"><p data-hhc-story-hanzi>" + esc(story.hanzi) + "</p><p data-hhc-story-pinyin>" + esc(story.pinyin) + "</p><p data-hhc-story-vi>" + esc(story.vi) + "</p></div><footer><span>Hãy đọc to một lượt trước khi nghe</span></footer></article></section></main>";
  }
  function grammarMarkup(state) {
    const rows = GRAMMAR.filter(function (item) { return Number(item.level) <= Number(String(state.grammarLevel).split("-")[0]); });
    return "<main class=\"hhc-main hhc-grammar\"><section class=\"hhc-section-head\"><div><span class=\"hhc-kicker\">GRAMMAR ORBIT</span><h1>语法轨道 · Mẫu câu dùng được</h1><p>Mỗi mẫu có công thức, ví dụ và ghi chú lỗi thường gặp.</p></div><label class=\"hhc-level-filter\">Hiển thị tới <select data-hhc-grammar-level>" + LEVELS.map(function (level) { return "<option value=\"" + level + "\"" + (state.grammarLevel === level ? " selected" : "") + ">" + levelLabel(level) + "</option>"; }).join("") + "</select></label></section><section class=\"hhc-grammar-grid\">" + (rows.length ? rows.map(function (item, index) { return "<article class=\"hhc-card hhc-grammar-card\" style=\"--delay:" + index * 45 + "ms\"><header><span>" + levelLabel(item.level) + "</span><b>0" + (index + 1) + "</b></header><h2>" + esc(item.title) + "</h2><code>" + esc(item.formula) + "</code><p class=\"hhc-grammar-example\">" + esc(item.example) + "</p><p>" + esc(item.translation) + "</p><small>" + esc(item.note) + "</small><button data-hhc-speak=\"" + esc(item.example) + "\">▶ Nghe ví dụ</button></article>"; }).join("") : "<div class=\"hhc-empty\">Chưa có seed ngữ pháp cho cấp này.</div>") + "</section></main>";
  }
  function speakingMarkup(state) {
    const status = speechStatus(), word = currentWord(state);
    return "<main class=\"hhc-main hhc-speaking\"><section class=\"hhc-section-head\"><div><span class=\"hhc-kicker\">VOICE DOCK</span><h1>声音舱 · Nghe và nói</h1><p>Phát âm mẫu bằng giọng hệ thống. Nhận diện giọng nói cần quyền microphone và không phải điểm thi chính thức.</p></div><span class=\"hhc-capability-pill\">Synthesis " + (status.synthesis ? "✓" : "—") + " · Recognition " + (status.recognition ? "✓" : "—") + "</span></section><section class=\"hhc-speaking-grid\"><article class=\"hhc-card hhc-voice-card\"><small>TỪ MỤC TIÊU</small><strong>" + esc(wordForScript(word, state.script)) + "</strong><span>" + esc(word.pinyin) + "</span><p>" + esc(word.meaning) + "</p><button class=\"is-primary\" data-hhc-speak=\"" + esc(word.hanzi) + "\">▶ Phát âm mẫu</button><button data-hhc-record=\"" + esc(word.hanzi) + "\">● Nói lại bằng mic</button><small class=\"hhc-voice-status\" data-hhc-speaking-status>" + esc(state.speakingStatus || "Chưa có lượt ghi âm") + "</small></article><article class=\"hhc-card\"><header><div><small>SHADOWING</small><h2>Lặp theo câu mẫu</h2></div><span>3 vòng</span></header>" + [word.example, word.pinyin, word.exampleVi].map(function (line, index) { return "<button class=\"hhc-shadow-line\" data-hhc-speak=\"" + esc(line) + "\"><i>" + (index + 1) + "</i><span>" + esc(line) + "</span><b>▶</b></button>"; }).join("") + "<p class=\"hhc-muted\">Không tự chấm giọng chuẩn nếu không có bộ chấm được kiểm định.</p></article></section></main>";
  }
  function examMarkup(state) {
    const item = EXAM_ITEMS[state.examIndex % EXAM_ITEMS.length], selected = state.examSelection, submitted = state.examSubmitted;
    return "<main class=\"hhc-main hhc-exam\"><section class=\"hhc-section-head\"><div><span class=\"hhc-kicker\">HSK SIMULATOR</span><h1>HSK模拟 · Bài kiểm tra ngắn</h1><p>Ngân hàng seed local do HH biên soạn, không phải đề HSK chính thức.</p></div><span class=\"hhc-exam-progress\">" + (state.examIndex + 1) + "/" + EXAM_ITEMS.length + "</span></section><article class=\"hhc-card hhc-exam-card\"><header><span>" + levelLabel(item.level) + " · " + item.skill + "</span><small>" + (submitted ? (selected === item.answer ? "Đúng" : "Cần xem lại") : "Chưa nộp") + "</small></header><h2>" + esc(item.prompt) + "</h2><div class=\"hhc-options\">" + item.options.map(function (option, index) { return "<button class=\"" + (submitted && index === item.answer ? "is-correct" : submitted && index === selected ? "is-wrong" : selected === index ? "is-selected" : "") + "\" data-hhc-exam-option=\"" + index + "\" " + (submitted ? "disabled" : "") + "><i>" + String.fromCharCode(65 + index) + "</i><span>" + esc(option) + "</span></button>"; }).join("") + "</div>" + (submitted ? "<div class=\"hhc-exam-feedback\"><strong>" + (selected === item.answer ? "✓ Chính xác" : "✦ Hãy xem lại") + "</strong><p>" + esc(item.explanation) + "</p></div>" : "") + "<footer>" + (submitted ? "<button class=\"is-primary\" data-hhc-next-exam>" + (state.examIndex + 1 >= EXAM_ITEMS.length ? "Làm lại từ đầu" : "Câu tiếp theo →") + "</button>" : "<button class=\"is-primary\" data-hhc-submit-exam " + (selected === null ? "disabled" : "") + ">Nộp câu trả lời</button>") + "</footer></article></main>";
  }
  function dictionaryMarkup(state) {
    const query = state.dictionaryQuery.toLocaleLowerCase("vi"), rows = (query ? WORDS.filter(function (word) { return (word.hanzi + " " + word.traditional + " " + word.pinyin + " " + word.meaning).toLocaleLowerCase("vi").indexOf(query) >= 0 || normalizePinyin(word.pinyin).indexOf(normalizePinyin(query)) >= 0; }) : WORDS).slice(0, 12);
    return "<main class=\"hhc-main hhc-dictionary\"><section class=\"hhc-section-head\"><div><span class=\"hhc-kicker\">LOCAL STAR DICTIONARY</span><h1>星际词典 · Tra cứu tiếng Trung</h1><p>Tìm bằng giản thể, phồn thể, pinyin có/không dấu hoặc nghĩa tiếng Việt trong seed local.</p></div><span class=\"hhc-source-seal\">" + WORDS.length + " seed</span></section><label class=\"hhc-search\"><span>⌕</span><input type=\"search\" data-hhc-dictionary-input value=\"" + esc(state.dictionaryQuery) + "\" placeholder=\"Ví dụ: 学习 · xuexi · học…\"><kbd>/</kbd></label><section class=\"hhc-dictionary-grid\">" + (rows.length ? rows.map(function (word) { return "<article class=\"hhc-card\"><header><strong>" + esc(wordForScript(word, state.script)) + "</strong><span>" + esc(word.pinyin) + "</span></header><b>" + esc(word.meaning) + "</b><small>" + levelLabel(word.level) + " · " + esc(word.pos) + "</small><p>" + esc(word.example) + "</p><footer><button data-hhc-speak=\"" + esc(word.hanzi) + "\">▶ Nghe</button><button data-hhc-favorite=\"" + word.id + "\">" + (state.favorites.indexOf(word.id) >= 0 ? "★ Đã lưu" : "☆ Lưu") + "</button></footer></article>"; }).join("") : "<div class=\"hhc-empty\">Không tìm thấy trong seed local. Connector online sẽ hiển thị provenance khi được cấu hình.</div>") + "</section></main>";
  }
  function contentMarkup(state) {
    if (state.view === "pinyin") return pinyinMarkup(state);
    if (state.view === "vocabulary") return vocabularyMarkup(state);
    if (state.view === "hanzi") return hanziMarkup(state);
    if (state.view === "reading") return readingMarkup(state);
    if (state.view === "grammar") return grammarMarkup(state);
    if (state.view === "speaking") return speakingMarkup(state);
    if (state.view === "exam") return examMarkup(state);
    if (state.view === "dictionary") return dictionaryMarkup(state);
    return dashboardMarkup(state);
  }
  function shellMarkup(state) { return "<section class=\"hh-chinese\" data-hh-chinese data-view=\"" + state.view + "\"><div class=\"hhc-stars\" aria-hidden=\"true\"><i></i><i></i><i></i><i></i><i></i><i></i></div>" + headerMarkup(state) + "<div class=\"hhc-layout\">" + navMarkup(state) + contentMarkup(state) + "</div><footer class=\"hhc-footer\"><span>HH Chinese local-first · " + new Date(state.updatedAt).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }) + "</span><span>HSK 3.0 framework · HH seed data · <button data-hhc-reset>Đặt lại tiến độ</button></span></footer></section>"; }

  function render(session) { session.host.innerHTML = shellMarkup(session.state); bindCanvas(session); }
  function update(session, patch, message) { session.state = saveState(Object.assign({}, session.state, patch, { lastAction: message || session.state.lastAction }), session.options); render(session); }
  function bindCanvas(session) {
    const canvas = session.host.querySelector("[data-hhc-writing-canvas]"); if (!canvas || !canvas.getContext) return;
    const ctx = canvas.getContext("2d"); ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.lineWidth = 7; ctx.strokeStyle = "#74edff";
    let drawing = false, points = 0;
    function point(event) { const rect = canvas.getBoundingClientRect(); return { x: (event.clientX - rect.left) * canvas.width / rect.width, y: (event.clientY - rect.top) * canvas.height / rect.height }; }
    function start(event) { event.preventDefault(); drawing = true; points++; canvas.setPointerCapture?.(event.pointerId); const item = point(event); ctx.beginPath(); ctx.moveTo(item.x, item.y); }
    function move(event) { if (!drawing) return; event.preventDefault(); const item = point(event); points++; ctx.lineTo(item.x, item.y); ctx.stroke(); }
    function end() { drawing = false; }
    canvas.addEventListener("pointerdown", start, { signal: session.signal }); canvas.addEventListener("pointermove", move, { signal: session.signal }); canvas.addEventListener("pointerup", end, { signal: session.signal }); canvas.addEventListener("pointercancel", end, { signal: session.signal }); canvas.dataset.hhcPoints = String(points);
  }
  function clearCanvas(session) { const canvas = session.host.querySelector("[data-hhc-writing-canvas]"); const ctx = canvas?.getContext?.("2d"); if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height); }
  function scoreCanvas(session) { const canvas = session.host.querySelector("[data-hhc-writing-canvas]"); const points = Number(canvas?.dataset.hhcPoints || 0); const score = Math.max(0, Math.min(100, Math.round(Math.min(1, points / 90) * 70 + (points > 12 ? 20 : 0) + (points > 180 ? 10 : 0)))); update(session, { writingScore: score, writingAttempts: session.state.writingAttempts + 1 }, "Chấm nét heuristic " + score); }
  function startRecognition(session, expected) {
    const Recognition = root.SpeechRecognition || root.webkitSpeechRecognition;
    if (!Recognition) { update(session, { speakingStatus: "Trình duyệt chưa hỗ trợ SpeechRecognition." }, "Không có microphone adapter"); return; }
    recognition?.abort?.(); recognition = new Recognition(); recognition.lang = "zh-CN"; recognition.interimResults = false; recognition.maxAlternatives = 2;
    update(session, { speakingStatus: "Đang nghe… hãy nói câu mẫu." }, "Bắt đầu nhận diện");
    recognition.onresult = function (event) { const transcript = text(event.results?.[0]?.[0]?.transcript, 180); update(session, { speakingStatus: "Nghe được: " + transcript + " · Hãy tự so sánh với " + expected + "." }, "Hoàn tất nhận diện"); };
    recognition.onerror = function (event) { update(session, { speakingStatus: "Microphone: " + text(event.error || "không xác định", 80) }, "Lỗi nhận diện"); };
    recognition.onend = function () { recognition = null; };
    try { recognition.start(); } catch (error) { update(session, { speakingStatus: "Không thể mở microphone; kiểm tra quyền trình duyệt." }, "Không mở được microphone"); }
  }
  function nextExam(session) { const restart = session.state.examIndex + 1 >= EXAM_ITEMS.length; update(session, { examIndex: restart ? 0 : session.state.examIndex + 1, examSelection: null, examSubmitted: false, examScore: restart ? 0 : session.state.examScore }, "Mở câu HSK tiếp theo"); }
  function handleClick(session, event) {
    const target = event.target.closest("button"); if (!target) return;
    if (target.dataset.hhcView) { update(session, { view: target.dataset.hhcView, revealed: false }, "Mở " + target.dataset.hhcView); return; }
    if (target.dataset.hhcSpeak) { const ok = speak(target.dataset.hhcSpeak); update(session, { listened: session.state.listened + (ok ? 1 : 0), speakingStatus: ok ? "Đang phát: " + target.dataset.hhcSpeak : "SpeechSynthesis chưa hỗ trợ." }, "Phát âm mẫu"); return; }
    if (target.dataset.hhcTone) { update(session, { tone: Number(target.dataset.hhcTone) }, "Chọn thanh " + target.dataset.hhcTone); return; }
    if (target.matches("[data-hhc-reveal]")) { update(session, { revealed: true }, "Lật thẻ từ vựng"); return; }
    if (target.dataset.hhcGrade) { const word = currentWord(session.state), card = cardState(session.state, word), next = scheduleReview(card, target.dataset.hhcGrade), due = session.state.due.filter(function (item) { return item.id !== word.id; }); due.push(next); update(session, { due: due, revealed: false, wordIndex: (session.state.wordIndex + 1) % WORDS.length, streak: target.dataset.hhcGrade === "again" ? session.state.streak : session.state.streak + 1 }, "SRS · " + target.dataset.hhcGrade); return; }
    if (target.dataset.hhcFavorite) { const id = target.dataset.hhcFavorite, favorites = session.state.favorites.indexOf(id) >= 0 ? session.state.favorites.filter(function (item) { return item !== id; }) : session.state.favorites.concat(id).slice(0, 100); update(session, { favorites: favorites }, favorites.indexOf(id) >= 0 ? "Lưu từ yêu thích" : "Bỏ từ yêu thích"); return; }
    if (target.dataset.hhcJumpWord) { update(session, { wordIndex: Math.max(0, WORDS.findIndex(function (word) { return word.id === target.dataset.hhcJumpWord; })), revealed: false }, "Chọn thẻ từ vựng"); return; }
    if (target.dataset.hhcReading) { update(session, { selectedReading: target.dataset.hhcReading }, "Chọn bài đọc"); return; }
    if (target.dataset.hhcReadingMode) { update(session, { readingMode: target.dataset.hhcReadingMode }, "Đổi chế độ đọc"); return; }
    if (target.dataset.hhcNextCharacter !== undefined) { update(session, { wordIndex: (session.state.wordIndex + 1) % WORDS.length, writingScore: null }, "Đổi chữ Hán"); return; }
    if (target.matches("[data-hhc-clear-writing]")) { clearCanvas(session); update(session, { writingScore: null }, "Xóa canvas viết"); return; }
    if (target.matches("[data-hhc-check-writing]")) { scoreCanvas(session); return; }
    if (target.matches("[data-hhc-show-strokes]")) { session.host.querySelector(".hhc-stroke-track")?.classList.toggle("is-expanded"); return; }
    if (target.dataset.hhcRecord) { startRecognition(session, target.dataset.hhcRecord); return; }
    if (target.dataset.hhcExamOption !== undefined) { update(session, { examSelection: Number(target.dataset.hhcExamOption) }, "Chọn đáp án HSK"); return; }
    if (target.matches("[data-hhc-submit-exam]")) { const item = EXAM_ITEMS[session.state.examIndex], correct = session.state.examSelection === item.answer; update(session, { examSubmitted: true, examScore: session.state.examScore + (correct ? 1 : 0) }, correct ? "Nộp đáp án đúng" : "Nộp đáp án cần xem lại"); return; }
    if (target.matches("[data-hhc-next-exam]")) { nextExam(session); return; }
    if (target.matches("[data-hhc-reset]")) { if (root.confirm?.("Đặt lại tiến độ HH Chinese trên thiết bị này?")) { session.state = defaultState(); saveState(session.state, session.options); render(session); } return; }
  }
  function handleInput(session, event) { if (event.target.matches("[data-hhc-dictionary-input]")) { clearTimeout(session.searchTimer); session.searchTimer = setTimeout(function () { update(session, { dictionaryQuery: text(event.target.value, 100) }, "Tìm từ điển"); }, 120); } }
  function handleChange(session, event) { if (event.target.matches("[data-hhc-level]")) update(session, { level: event.target.value }, "Đổi cấp HSK"); else if (event.target.matches("[data-hhc-script]")) update(session, { script: event.target.value }, "Đổi giản thể/phồn thể"); else if (event.target.matches("[data-hhc-grammar-level]")) update(session, { grammarLevel: event.target.value }, "Đổi cấp ngữ pháp"); }
  function mount(host, options) {
    if (!host || typeof host.querySelector !== "function") throw new Error("HHChinese.mount cần host DOM hợp lệ.");
    unmount(); const controller = new AbortController(); const opts = options || {}; const loaded = loadState(opts); const session = { host: host, options: opts, signal: controller.signal, controller: controller, state: Object.assign(loaded, { view: supports(opts.view) ? opts.view : loaded.view }), searchTimer: 0 }; activeHost = host; activeAbort = controller; render(session);
    host.addEventListener("click", function (event) { handleClick(session, event); }, { signal: controller.signal });
    host.addEventListener("input", function (event) { handleInput(session, event); }, { signal: controller.signal });
    host.addEventListener("change", function (event) { handleChange(session, event); }, { signal: controller.signal });
    host.addEventListener("keydown", function (event) { if (event.key === "/" && event.target.tagName !== "INPUT" && event.target.tagName !== "TEXTAREA") { event.preventDefault(); host.querySelector("[data-hhc-dictionary-input]")?.focus(); } }, { signal: controller.signal });
    document.addEventListener("visibilitychange", function () { host.querySelector("[data-hh-chinese]")?.classList.toggle("is-tab-hidden", document.visibilityState === "hidden"); }, { signal: controller.signal });
    return { state: function () { return Object.assign({}, session.state); }, unmount: unmount };
  }
  function unmount() { recognition?.abort?.(); recognition = null; activeAbort?.abort?.(); activeAbort = null; activeHost = null; }
  const supports = function (view) { return view === "dashboard" || VIEWS.some(function (item) { return item[0] === view; }); };
  root.HHChinese = Object.freeze({ VERSION: VERSION, STORAGE_KEY: STORAGE_KEY, WORDS: WORDS, GRAMMAR: GRAMMAR, READINGS: READINGS, EXAM_ITEMS: EXAM_ITEMS, VIEWS: VIEWS, TONE_NAMES: TONE_NAMES, normalizeState: normalizeState, scheduleReview: scheduleReview, browserSpeechStatus: speechStatus, supports: supports, mount: mount, unmount: unmount });
  if (typeof module !== "undefined" && module.exports) module.exports = root.HHChinese;
})(typeof window !== "undefined" ? window : globalThis);
