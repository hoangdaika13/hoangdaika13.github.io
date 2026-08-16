(() => {
  "use strict";

  const root = typeof window !== "undefined" ? window : globalThis;
  const VERSION = "1.0.0";
  const MANIFEST_URL = "assets/english-vocabulary/manifest.json";
  const WORKER_URL = "english-vocabulary-worker.js?v=1";
  const DB_NAME = "hhEnglishVocabularyV1";
  const STORE_NAME = "resources";
  const instances = new WeakMap();
  const lessonSteps = Object.freeze([
    ["learn", "Học nghĩa"], ["recognize", "Nhận diện"], ["context", "Ngữ cảnh"],
    ["typing", "Gõ từ"], ["collocation", "Cụm từ"], ["pronunciation", "Phát âm"], ["check", "Kiểm tra"]
  ]);
  const labModes = Object.freeze([
    ["word-family", "✣", "Word Family Map", "Mở rộng noun, verb, adjective và adverb."],
    ["confusables", "◇", "Confusing Words Lab", "Phân biệt affect/effect, borrow/lend và các cặp dễ nhầm."],
    ["collocation", "∞", "Collocation Trainer", "Luyện cụm từ tự nhiên thay vì học từ đơn."],
    ["phrasal-verbs", "↗", "Phrasal Verb Builder", "Nhớ cụm động từ bằng ngữ cảnh đã kiểm duyệt."],
    ["picture-vocabulary", "✧", "Picture Vocabulary", "Học bằng tình huống và hình dung trực quan."],
    ["idioms", "❝", "Idiom Studio", "Hiểu thành ngữ và sắc thái trong câu thật."],
    ["minimal-pairs", "◉", "Minimal Pairs", "Nghe, nhận diện và kiểm tra lại từ dễ lẫn âm."],
    ["mistakes", "⚠", "Mistake Notebook", "Ôn lại đúng những từ đã trả lời sai."],
    ["cloze", "□", "Cloze Story", "Điền từ vào câu chuyện ngắn có ngữ cảnh."]
  ]);

  const esc = (value = "") => String(value).replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;"
  }[character]));
  const normalizeTerm = (value = "") => String(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9'-]+/g, " ").trim();
  const boundedString = (value, limit = 500) => String(value ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, limit);
  const uniqueBy = (items, keyFor) => {
    const seen = new Set();
    return items.filter((item) => { const key = keyFor(item); if (!key || seen.has(key)) return false; seen.add(key); return true; });
  };
  const searchTerms = (terms = [], query = "", limit = 120) => {
    const needle = normalizeTerm(query);
    if (!needle) return terms.slice(0, limit).map((term, index) => ({ term, index }));
    const prefix = []; const contains = [];
    for (let index = 0; index < terms.length && prefix.length + contains.length < limit * 4; index += 1) {
      const term = String(terms[index] || "");
      if (term.startsWith(needle)) prefix.push({ term, index });
      else if (term.includes(needle)) contains.push({ term, index });
      if (prefix.length >= limit) break;
    }
    return [...prefix, ...contains].slice(0, limit);
  };
  const reviewedEntry = (item = {}) => ({
    term: boundedString(item.term || item.word, 80), ipaUS: boundedString(item.ipaUS || item.ipa, 100), ipaUK: boundedString(item.ipaUK || item.ipa, 100),
    meaning: boundedString(item.meaning, 500), senses: Array.isArray(item.senses) ? item.senses.map((value) => boundedString(value, 300)).filter(Boolean).slice(0, 8) : [],
    example: boundedString(item.example, 600), vnExample: boundedString(item.vnExample, 600), level: boundedString(item.level, 4), topic: boundedString(item.topic, 40),
    pos: boundedString(item.pos, 30) || "word", source: boundedString(item.source, 40) || "reviewed", frequency: boundedString(item.frequency, 30),
    family: Array.isArray(item.family) ? item.family.map((value) => boundedString(value, 80)).filter(Boolean).slice(0, 12) : [],
    collocations: Array.isArray(item.collocations) ? item.collocations.map((value) => boundedString(value, 120)).filter(Boolean).slice(0, 12) : [],
    synonyms: Array.isArray(item.synonyms) ? item.synonyms.map((value) => boundedString(value, 80)).filter(Boolean).slice(0, 12) : [],
    antonyms: Array.isArray(item.antonyms) ? item.antonyms.map((value) => boundedString(value, 80)).filter(Boolean).slice(0, 12) : [],
    ageBands: Array.isArray(item.ageBands) ? item.ageBands.map((value) => boundedString(value, 20)).filter(Boolean).slice(0, 6) : [],
    contentRating: boundedString(item.contentRating, 20) || "everyone", reviewStatus: boundedString(item.reviewStatus, 20) || (item.meaning ? "reviewed" : "unreviewed"),
    reviewed: Boolean(item.meaning), verification: item.meaning ? "reviewed" : "term-index"
  });
  const normalizeStudio = (state = {}) => {
    const source = state.vocabularyStudio || {};
    state.vocabularyStudio = {
      activeTab: ["explorer", "lesson", "labs", "personal"].includes(source.activeTab) ? source.activeTab : "explorer",
      selectedTerm: boundedString(source.selectedTerm, 80),
      filters: { level: "all", topic: "all", pos: "all", source: "all", mastery: "all", dialect: "us", query: "", ...(source.filters || {}) },
      lesson: source.lesson && typeof source.lesson === "object" ? source.lesson : null,
      notes: Object.fromEntries(Object.entries(source.notes || {}).slice(0, 500).map(([key, value]) => [boundedString(key, 80), boundedString(value, 2000)])),
      personalDictionary: Array.isArray(source.personalDictionary) ? source.personalDictionary.slice(0, 1000).map(reviewedEntry).filter((item) => item.term) : [],
      lastCoverage: source.lastCoverage && typeof source.lastCoverage === "object" ? source.lastCoverage : null
    };
    return state.vocabularyStudio;
  };
  const masteryFor = (state, term) => Number(state.wordMastery?.[term]?.score || state.wordMastery?.[normalizeTerm(term)]?.score || 0);
  const isDue = (state, term, now = Date.now()) => {
    const row = state.reviewQueue?.[term] || state.reviewQueue?.[normalizeTerm(term)];
    return Boolean(row && new Date(row.dueAt || 0).getTime() <= now);
  };
  const mistakeRate = (state) => {
    const attempts = Math.max(1, Number(state.galaxySession?.attempts) || 0);
    const mistakes = Math.min(attempts, Array.isArray(state.mistakeNotebook) ? state.mistakeNotebook.length : 0);
    return mistakes / attempts;
  };
  const buildLesson = (words = [], state = {}, requested = 15) => {
    const adaptiveCount = Number(root.HHEnglishForEveryone?.lessonPolicy?.(state)?.wordCount);
    const count = adaptiveCount > 0 ? Math.min(requested, adaptiveCount) : mistakeRate(state) > .45 ? Math.min(10, requested) : Math.min(15, requested);
    const dueTerms = new Set(Object.values(state.savedWords || {}).filter((item) => isDue(state, item.word || item.term)).map((item) => normalizeTerm(item.word || item.term)));
    const mistakes = new Set((state.mistakeNotebook || []).map((item) => normalizeTerm(item.word || item.term)).filter(Boolean));
    const pool = uniqueBy(words.map(reviewedEntry).filter((item) => item.term && item.meaning), (item) => normalizeTerm(item.term));
    pool.sort((a, b) => Number(dueTerms.has(normalizeTerm(b.term))) - Number(dueTerms.has(normalizeTerm(a.term))) || Number(mistakes.has(normalizeTerm(b.term))) - Number(mistakes.has(normalizeTerm(a.term))) || masteryFor(state, a.term) - masteryFor(state, b.term));
    const selected = pool.slice(0, count);
    return {
      id: `vocab-${Date.now()}`, createdAt: new Date().toISOString(), completedAt: "", current: 0, step: 0, errors: 0,
      words: selected.map((item) => ({ term: item.term, meaning: item.meaning, ipaUS: item.ipaUS, ipaUK: item.ipaUK, example: item.example, vnExample: item.vnExample, level: item.level, pos: item.pos, collocations: item.collocations }))
    };
  };
  const coverageReport = (text = "", knownTerms = []) => {
    const tokens = normalizeTerm(text).split(/\s+/).filter(Boolean);
    const known = new Set(knownTerms.map(normalizeTerm).filter(Boolean));
    const unique = [...new Set(tokens)];
    const understood = unique.filter((term) => known.has(term));
    const unknown = unique.filter((term) => !known.has(term));
    return { tokens: tokens.length, unique: unique.length, known: understood.length, percent: unique.length ? Math.round(understood.length / unique.length * 100) : 0, unknown: unknown.slice(0, 80) };
  };
  const parseDelimitedLine = (line, delimiter) => {
    if (delimiter === "\t") return line.split("\t");
    const values = []; let value = ""; let quoted = false;
    for (let index = 0; index < line.length; index += 1) {
      const character = line[index];
      if (character === '"' && quoted && line[index + 1] === '"') { value += '"'; index += 1; }
      else if (character === '"') quoted = !quoted;
      else if (character === delimiter && !quoted) { values.push(value); value = ""; }
      else value += character;
    }
    values.push(value); return values;
  };
  const parseImport = (text = "", format = "csv") => {
    const clean = String(text || "").replace(/^\uFEFF/, "").slice(0, 2_000_000);
    if (format === "json") {
      let rows = [];
      try { const parsed = JSON.parse(clean); rows = Array.isArray(parsed) ? parsed : Array.isArray(parsed.words) ? parsed.words : []; } catch { return []; }
      return rows.slice(0, 1000).map(reviewedEntry).filter((item) => item.term);
    }
    const delimiter = format === "anki" ? "\t" : ",";
    return clean.split(/\r?\n/).slice(0, 1000).map((line) => {
      const [term, meaning, example = "", note = ""] = parseDelimitedLine(line, delimiter).map((value) => boundedString(value, 600));
      return reviewedEntry({ term, meaning, example, senses: meaning ? [meaning] : [], source: "personal", verification: "user-provided", note });
    }).filter((item) => item.term);
  };
  const exportRows = (words = [], format = "json") => {
    const rows = words.map(reviewedEntry).filter((item) => item.term);
    if (format === "json") return JSON.stringify({ schemaVersion: 1, exportedAt: new Date().toISOString(), words: rows }, null, 2);
    const delimiter = format === "anki" ? "\t" : ",";
    const quote = (value) => format === "anki" ? String(value || "").replace(/[\t\r\n]+/g, " ") : `"${String(value || "").replace(/"/g, '""')}"`;
    return rows.map((item) => [item.term, item.meaning, item.example, item.level].map(quote).join(delimiter)).join("\n");
  };

  let databasePromise = null;
  const openDatabase = () => {
    if (databasePromise) return databasePromise;
    databasePromise = new Promise((resolve) => {
      if (!root.indexedDB) { resolve(null); return; }
      const request = root.indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => { if (!request.result.objectStoreNames.contains(STORE_NAME)) request.result.createObjectStore(STORE_NAME); };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
    });
    return databasePromise;
  };
  const cacheGet = async (key) => {
    const db = await openDatabase();
    if (!db) return null;
    return new Promise((resolve) => { const request = db.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).get(key); request.onsuccess = () => resolve(request.result || null); request.onerror = () => resolve(null); });
  };
  const cachePut = async (key, value) => {
    const db = await openDatabase();
    if (!db) return false;
    return new Promise((resolve) => { const transaction = db.transaction(STORE_NAME, "readwrite"); transaction.objectStore(STORE_NAME).put(value, key); transaction.oncomplete = () => resolve(true); transaction.onerror = () => resolve(false); });
  };
  const sha256Hex = async (text) => {
    if (!root.crypto?.subtle || typeof TextEncoder === "undefined") return "";
    const digest = await root.crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
    return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, "0")).join("");
  };
  const loadJson = async (url, checksum = "") => {
    const key = `${url}:${checksum}`;
    const cached = await cacheGet(key);
    if (cached) return cached;
    const response = await root.fetch(url, { credentials: "same-origin" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const text = await response.text();
    if (checksum) {
      const actual = await sha256Hex(text);
      if (actual && actual !== checksum) throw new Error("Vocabulary checksum mismatch");
    }
    const value = JSON.parse(text);
    cachePut(key, value).catch(() => {});
    return value;
  };

  const reviewedCatalog = () => uniqueBy([
    ...(root.HHEnglishGalaxy?.catalog || []),
    ...((root.HHEnglishVocabularyRuntimeState?.personalDictionary) || [])
  ].map(reviewedEntry).filter((item) => item.term), (item) => normalizeTerm(item.term));
  const reviewedMap = () => new Map(reviewedCatalog().map((item) => [normalizeTerm(item.term), item]));
  const renderShell = (state = {}) => {
    const studio = normalizeStudio(state);
    const reviewed = reviewedCatalog().filter((item) => item.reviewed).length;
    const saved = Object.keys(state.savedWords || {}).length;
    const lessonSize = Number(root.HHEnglishForEveryone?.lessonPolicy?.(state)?.wordCount) || 15;
    return `<section class="hhev-studio" data-hhev-studio>
      <header class="hhev-head"><div><small>HH ENGLISH · VOCABULARY OS</small><h2>Vocabulary Explorer</h2><p>30.000 mục từ thật · nghĩa Việt và CEFR chỉ hiện khi đã được kiểm duyệt.</p></div><div><span><b>30K</b> term index</span><span><b>${reviewed}</b> đã kiểm duyệt</span><span><b>${saved}</b> đã lưu</span></div><button class="primary" type="button" data-hhev-start-lesson>Học ${lessonSize} từ →</button></header>
      <nav class="hhev-tabs" aria-label="Khu từ vựng">${[["explorer", "⌕", "Tra cứu"], ["lesson", "▶", `Bài ${lessonSize} từ`], ["labs", "✦", "Luyện sâu"], ["personal", "◇", "Từ của tôi"]].map(([id, icon, label]) => `<button type="button" class="${studio.activeTab === id ? "active" : ""}" data-hhev-tab="${id}"><i>${icon}</i>${label}</button>`).join("")}</nav>
      <div class="hhev-body" data-hhev-body><div class="hhev-loading"><i></i><strong>Đang chuẩn bị kho từ...</strong><span>Chỉ nạp pack khi bạn cần.</span></div></div>
    </section>`;
  };

  const options = (rows, selected) => rows.map(([value, label]) => `<option value="${esc(value)}" ${selected === value ? "selected" : ""}>${esc(label)}</option>`).join("");
  const filterReviewed = (instance, state, filters) => {
    const query = normalizeTerm(filters.query);
    const ageMode = state.universalProfile?.ageMode || "adult";
    const catalog = root.HHEnglishForEveryone?.contentForAge?.(reviewedCatalog(), ageMode) || reviewedCatalog();
    return catalog.filter((item) => {
      const haystack = normalizeTerm(`${item.term} ${item.meaning} ${item.example} ${item.collocations.join(" ")}`);
      if (query && !haystack.includes(query)) return false;
      if (filters.level !== "all" && item.level !== filters.level) return false;
      if (filters.topic !== "all" && item.topic !== filters.topic) return false;
      if (filters.pos !== "all" && item.pos !== filters.pos) return false;
      if (filters.source === "career" && item.source !== "career") return false;
      if (filters.mastery === "saved" && !state.savedWords?.[item.term]) return false;
      if (filters.mastery === "due" && !isDue(state, item.term)) return false;
      if (filters.mastery === "hard" && masteryFor(state, item.term) >= 60) return false;
      if (filters.mastery === "mastered" && masteryFor(state, item.term) < 90) return false;
      return true;
    }).slice(0, 120).map((item) => ({ ...item, index: -1 }));
  };
  const renderExplorer = (instance, state) => {
    const studio = normalizeStudio(state); const filters = studio.filters;
    return `<section class="hhev-explorer">
      <aside class="hhev-filters"><header><small>BỘ LỌC</small><strong>Tìm đúng từ cần học</strong></header><label><span>Tìm tức thì</span><input type="search" data-hhev-search value="${esc(filters.query || "")}" placeholder="Từ, nghĩa Việt, ví dụ..."></label>
        <div><label><span>CEFR</span><select data-hhev-filter="level">${options([["all", "Tất cả"], ...["A0", "A1", "A2", "B1", "B2", "C1", "C2"].map((value) => [value, value])], filters.level)}</select></label><label><span>Loại từ</span><select data-hhev-filter="pos">${options([["all", "Tất cả"], ["noun", "Danh từ"], ["verb", "Động từ"], ["adjective", "Tính từ"], ["adverb", "Trạng từ"], ["phrase", "Cụm từ"]], filters.pos)}</select></label></div>
        <label><span>Nguồn dữ liệu</span><select data-hhev-filter="source">${options([["all", "Tất cả"], ["reviewed", "Đã kiểm duyệt"], ["career", "Chuyên ngành"], ["term-index", "Term index 30K"]], filters.source)}</select></label>
        <label><span>Trạng thái học</span><select data-hhev-filter="mastery">${options([["all", "Tất cả"], ["saved", "Đã lưu"], ["due", "Đến hạn"], ["hard", "Khó nhớ"], ["mastered", "Đã thuộc"]], filters.mastery)}</select></label>
        <label><span>Chủ đề</span><select data-hhev-filter="topic">${options([["all", "Tất cả"], ["daily", "Đời sống"], ["travel", "Du lịch"], ["technology", "Công nghệ"], ["work", "Công việc"], ["creative", "Sáng tạo"], ["science", "Khoa học"], ["society", "Xã hội"]], filters.topic)}</select></label>
        <label><span>Phát âm</span><select data-hhev-filter="dialect">${options([["us", "Anh–Mỹ"], ["uk", "Anh–Anh"]], filters.dialect)}</select></label>
        <section class="hhev-pack-status"><small>PACK STATUS</small><strong data-hhev-pack-count>${instance.manifest ? `${instance.manifest.packs.length} pack khả dụng` : "Đang tải manifest"}</strong><span>IndexedDB · checksum · lazy-load</span></section>
      </aside>
      <main class="hhev-results"><header><div><small>KẾT QUẢ</small><strong data-hhev-result-count>Đang lập chỉ mục...</strong></div><span>Chỉ hiển thị tối đa 120 kết quả</span></header><div data-hhev-result-list><div class="hhev-loading"><i></i><strong>Đang tìm...</strong></div></div></main>
      <aside class="hhev-detail" data-hhev-detail><div class="hhev-empty"><span>Aa</span><strong>Chọn một từ</strong><p>Chi tiết, nguồn, trạng thái kiểm duyệt và thao tác học sẽ hiện tại đây.</p></div></aside>
    </section>`;
  };
  const lessonChoices = (word, lesson) => uniqueBy([word.meaning, ...lesson.words.filter((item) => item.term !== word.term).map((item) => item.meaning)], normalizeTerm).slice(0, 4);
  const renderLesson = (instance, state) => {
    const studio = normalizeStudio(state); const lesson = studio.lesson;
    const lessonSize = Number(root.HHEnglishForEveryone?.lessonPolicy?.(state)?.wordCount) || 15;
    if (!lesson?.words?.length) return `<section class="hhev-lesson-empty"><span>${lessonSize}</span><h3>Bài từ vựng ngắn, học tuần tự</h3><p>HH ưu tiên từ đến hạn, từ đã sai và điều chỉnh số lượng theo chế độ tuổi cùng tỷ lệ quên thật.</p><button class="primary" type="button" data-hhev-start-lesson>Bắt đầu bài mới</button></section>`;
    if (lesson.completedAt) return `<section class="hhev-lesson-complete"><span>✓</span><h3>Đã hoàn thành ${lesson.words.length} từ</h3><p>${lesson.errors} lỗi đã được đưa vào dữ liệu ôn tập. Bạn có thể học lại hoặc mở Mistake Notebook.</p><div><button type="button" data-hhev-open-mode="mistakes">Ôn từ sai</button><button class="primary" type="button" data-hhev-start-lesson>Bài mới →</button></div></section>`;
    const current = Math.min(lesson.words.length - 1, Number(lesson.current) || 0); const step = Math.min(lessonSteps.length - 1, Number(lesson.step) || 0); const word = lesson.words[current]; const stepId = lessonSteps[step][0];
    let task = "";
    if (stepId === "learn") task = `<article class="hhev-word-learn"><small>${esc(word.level || "Chưa phân loại")} · ${esc(word.pos || "word")}</small><h3>${esc(word.term)}</h3><p>${esc(word.ipaUS || word.ipaUK || "Chưa có IPA kiểm duyệt")}</p><strong>${esc(word.meaning)}</strong><blockquote>${esc(word.example || "Chưa có câu ví dụ kiểm duyệt.")}</blockquote><button class="primary" type="button" data-hhev-lesson-next>Đã hiểu · tiếp tục →</button></article>`;
    else if (stepId === "recognize") task = `<article class="hhev-word-question"><small>CHỌN NGHĨA ĐÚNG</small><h3>${esc(word.term)}</h3><div>${lessonChoices(word, lesson).map((choice) => `<button type="button" data-hhev-choice="${esc(choice)}">${esc(choice)}</button>`).join("")}</div><output data-hhev-feedback></output></article>`;
    else if (stepId === "context") task = `<article class="hhev-word-learn"><small>NGỮ CẢNH</small><h3>${esc(word.term)}</h3><blockquote>${esc(word.example || "Từ này chưa có câu ví dụ kiểm duyệt; HH không tạo câu giả.")}</blockquote>${word.vnExample ? `<p>${esc(word.vnExample)}</p>` : ""}<button class="primary" type="button" data-hhev-lesson-next>Đã đọc ngữ cảnh →</button></article>`;
    else if (stepId === "typing") task = `<form class="hhev-word-type" data-hhev-type-check><small>TỰ GÕ TỪ</small><h3>${esc(word.meaning)}</h3><input name="answer" autocomplete="off" spellcheck="false" placeholder="Nhập từ tiếng Anh..." required><button class="primary" type="submit">Kiểm tra →</button><output data-hhev-feedback></output></form>`;
    else if (stepId === "collocation") task = `<article class="hhev-word-learn"><small>COLLOCATION</small><h3>${esc(word.term)}</h3>${word.collocations?.length ? `<div class="hhev-chips">${word.collocations.map((value) => `<span>${esc(value)}</span>`).join("")}</div>` : '<p class="hhev-honest">Chưa có collocation đã kiểm duyệt cho từ này. HH sẽ không tự ghép cụm thiếu nguồn.</p>'}<button class="primary" type="button" data-hhev-lesson-next>${word.collocations?.length ? "Đã học cụm từ" : "Bỏ qua có lý do"} →</button></article>`;
    else if (stepId === "pronunciation") task = `<article class="hhev-word-learn"><small>PHÁT ÂM</small><h3>${esc(word.term)}</h3><p>${esc(studio.filters.dialect === "uk" ? word.ipaUK || word.ipaUS : word.ipaUS || word.ipaUK)}</p><button type="button" data-hhev-speak="${esc(word.term)}">▶ Nghe mẫu</button><button class="primary" type="button" data-hhev-lesson-next>Đã nói theo →</button></article>`;
    else task = `<article class="hhev-word-learn"><small>KIỂM TRA CUỐI TỪ</small><h3>${esc(word.term)}</h3><strong>${esc(word.meaning)}</strong><p>Hoàn thành 6 bước. Từ này sẽ được cập nhật vào tiến độ nhận biết.</p><button class="primary" type="button" data-hhev-lesson-next>${current + 1 === lesson.words.length ? "Hoàn thành bài" : "Từ tiếp theo"} →</button></article>`;
    return `<section class="hhev-lesson"><header><div><small>LESSON PLAYER</small><h3>Từ ${current + 1}/${lesson.words.length}</h3></div><strong>${Math.round((current * lessonSteps.length + step) / (lesson.words.length * lessonSteps.length) * 100)}%</strong><button type="button" data-hhev-start-lesson>Đổi bài</button></header><nav>${lessonSteps.map(([id, label], index) => `<span class="${index === step ? "active" : index < step ? "done" : "locked"}"><b>${index < step ? "✓" : index + 1}</b>${esc(label)}</span>`).join("")}</nav><main>${task}</main><footer><span>${lesson.errors} lỗi trong bài</span><i style="--p:${Math.round((current * lessonSteps.length + step) / (lesson.words.length * lessonSteps.length) * 100)}%"></i><small>Tự lưu sau mỗi bước</small></footer></section>`;
  };
  const renderLabs = (state) => `<section class="hhev-labs"><header><div><small>DEEP PRACTICE</small><h3>Học sâu bằng dữ liệu thật</h3><p>Mỗi phòng luyện dùng cùng SRS, sổ lỗi và từ đã lưu của bạn.</p></div><span>${(state.mistakeNotebook || []).length} lỗi đang chờ</span></header><div>${labModes.map(([mode, icon, title, detail]) => `<button type="button" data-hhev-open-mode="${mode}"><i>${icon}</i><span><strong>${esc(title)}</strong><small>${esc(detail)}</small></span><b>→</b></button>`).join("")}</div></section>`;
  const renderPersonal = (instance, state) => {
    const studio = normalizeStudio(state); const saved = Object.values(state.savedWords || {}).map((item) => reviewedEntry({ ...item, term: item.term || item.word })); const personal = studio.personalDictionary;
    const coverage = studio.lastCoverage;
    return `<section class="hhev-personal"><main><section><header><div><small>PERSONAL DICTIONARY</small><h3>${saved.length + personal.length} từ của bạn</h3></div><div><button type="button" data-hhev-export="json">JSON</button><button type="button" data-hhev-export="csv">CSV</button><button type="button" data-hhev-export="anki">Anki</button></div></header><div class="hhev-personal-list">${[...saved, ...personal].slice(0, 120).map((item) => `<button type="button" data-hhev-personal-term="${esc(item.term)}"><strong>${esc(item.term)}</strong><span>${esc(item.meaning || "Chưa có nghĩa kiểm duyệt")}</span></button>`).join("") || '<p>Chưa có từ cá nhân. Hãy lưu từ trong Explorer hoặc nhập dữ liệu.</p>'}</div><footer><label>Nhập CSV, JSON hoặc Anki TSV<input type="file" accept=".csv,.json,.txt,.tsv" data-hhev-import></label><span>Dữ liệu người dùng được lưu cục bộ và giới hạn 1.000 mục.</span></footer></section></main><aside><section><small>READING COVERAGE</small><h3>Bạn hiểu bao nhiêu phần trăm?</h3><textarea data-hhev-coverage-text placeholder="Dán đoạn tiếng Anh cần kiểm tra..."></textarea><button class="primary" type="button" data-hhev-coverage>Phân tích cục bộ</button>${coverage ? `<div class="hhev-coverage"><strong>${coverage.percent}%</strong><span>${coverage.known}/${coverage.unique} từ độc nhất đã biết</span><p>${coverage.percent >= 90 ? "Phù hợp để đọc độc lập." : "Nên xem trước các từ chưa biết."}</p><small>${esc((coverage.unknown || []).slice(0, 12).join(" · "))}</small></div>` : ""}</section><section><small>DỮ LIỆU & QUYỀN RIÊNG</small><p>Token tìm kiếm chạy trong Web Worker. Pack được kiểm checksum và lưu IndexedDB. Audio chỉ phát khi bạn bấm nghe.</p></section></aside></section>`;
  };

  const renderActive = (instance) => {
    const state = instance.runtime.readState(); const studio = normalizeStudio(state); root.HHEnglishVocabularyRuntimeState = studio;
    const body = instance.host.querySelector("[data-hhev-body]"); if (!body) return;
    instance.host.querySelectorAll("[data-hhev-tab]").forEach((button) => button.classList.toggle("active", button.dataset.hhevTab === studio.activeTab));
    body.innerHTML = studio.activeTab === "lesson" ? renderLesson(instance, state) : studio.activeTab === "labs" ? renderLabs(state) : studio.activeTab === "personal" ? renderPersonal(instance, state) : renderExplorer(instance, state);
    if (studio.activeTab === "explorer") searchAndPaint(instance).catch(() => paintError(instance, "Không thể đọc pack từ vựng."));
  };
  const paintError = (instance, message) => { const list = instance.host.querySelector("[data-hhev-result-list]"); if (list) list.innerHTML = `<div class="hhev-empty"><span>!</span><strong>${esc(message)}</strong><p>Hãy kiểm tra kết nối rồi thử lại.</p></div>`; };
  const ensureData = async (instance) => {
    if (instance.readyPromise) return instance.readyPromise;
    instance.readyPromise = (async () => {
      instance.manifest = await loadJson(MANIFEST_URL);
      instance.index = await loadJson(instance.manifest.index.file, instance.manifest.index.sha256);
      if (root.Worker) {
        try {
          instance.worker = new root.Worker(WORKER_URL);
          instance.worker.onmessage = (event) => {
            const pending = instance.pending.get(event.data?.requestId);
            if (!pending) return;
            instance.pending.delete(event.data.requestId); pending.resolve(event.data.results || []);
          };
          instance.worker.postMessage({ type: "init", terms: instance.index.terms });
        } catch { instance.worker = null; }
      }
      return instance;
    })();
    return instance.readyPromise;
  };
  const workerSearch = (instance, query, limit = 160) => {
    if (!instance.worker) return Promise.resolve(searchTerms(instance.index?.terms || [], query, limit));
    const requestId = ++instance.requestId;
    return new Promise((resolve) => { instance.pending.set(requestId, { resolve }); instance.worker.postMessage({ type: "search", requestId, query, limit }); });
  };
  const readFilters = (instance, state) => {
    const studio = normalizeStudio(state);
    const search = instance.host.querySelector("[data-hhev-search]");
    const filters = { ...studio.filters, query: boundedString(search?.value || studio.filters.query || "", 100) };
    instance.host.querySelectorAll("[data-hhev-filter]").forEach((node) => { filters[node.dataset.hhevFilter] = node.value; });
    studio.filters = filters; return filters;
  };
  const searchAndPaint = async (instance) => {
    await ensureData(instance);
    const packCount = instance.host.querySelector("[data-hhev-pack-count]");
    if (packCount) packCount.textContent = `${instance.manifest.packs.length} pack khả dụng`;
    const state = instance.runtime.readState(); const filters = readFilters(instance, state); const reviewed = filterReviewed(instance, state, filters);
    let extended = [];
    const restrictReviewed = filters.source === "reviewed" || filters.source === "career" || filters.level !== "all" || filters.topic !== "all" || filters.pos !== "all" || filters.mastery !== "all";
    if (!restrictReviewed && (filters.query || filters.source === "term-index")) extended = (await workerSearch(instance, filters.query, 180)).map((item) => ({ term: item.term, index: item.index, source: "esdb", reviewed: false, verification: "term-index" }));
    const rows = uniqueBy(filters.source === "term-index" ? extended : [...reviewed, ...extended], (item) => normalizeTerm(item.term)).slice(0, 120);
    instance.results = rows;
    const list = instance.host.querySelector("[data-hhev-result-list]"); const count = instance.host.querySelector("[data-hhev-result-count]");
    if (count) count.textContent = `${rows.length} kết quả · ${instance.index.count.toLocaleString("vi-VN")} mục trong chỉ mục`;
    if (list) list.innerHTML = rows.length ? rows.map((item) => `<button type="button" class="${normalizeTerm(item.term) === normalizeTerm(state.vocabularyStudio.selectedTerm) ? "active" : ""}" data-hhev-result="${esc(item.term)}" data-index="${Number(item.index ?? -1)}"><span><strong>${esc(item.term)}</strong><small>${item.reviewed ? `${esc(item.level || "—")} · ${esc(item.meaning)}` : "ESDB · chưa có nghĩa/CEFR kiểm duyệt"}</small></span><em class="${item.reviewed ? "reviewed" : "term"}">${item.reviewed ? "Đã duyệt" : "Term"}</em></button>`).join("") : '<div class="hhev-empty"><span>⌕</span><strong>Không có kết quả phù hợp</strong><p>Thử bỏ bớt bộ lọc hoặc tìm theo chính tả tiếng Anh.</p></div>';
    const selected = rows.find((item) => normalizeTerm(item.term) === normalizeTerm(state.vocabularyStudio.selectedTerm)) || rows[0];
    if (selected) await paintDetail(instance, selected);
  };
  const loadTermIndexEntry = async (instance, index, term) => {
    const packIndex = Math.max(0, Math.min(instance.manifest.packs.length - 1, Math.floor(Math.max(0, index) / instance.index.packSize)));
    const packMeta = instance.manifest.packs[packIndex];
    if (!instance.packs.has(packMeta.id)) instance.packs.set(packMeta.id, await loadJson(packMeta.file, packMeta.sha256));
    const row = instance.packs.get(packMeta.id).items.find((item) => item[0] === term) || [term, "word"];
    return reviewedEntry({ term: row[0], pos: row[1], source: "esdb", verification: "term-index" });
  };
  const paintDetail = async (instance, result) => {
    const state = instance.runtime.readState(); const studio = normalizeStudio(state); const map = reviewedMap();
    const rawItem = map.get(normalizeTerm(result.term)) || await loadTermIndexEntry(instance, result.index, result.term);
    const item = root.HHEnglishForEveryone?.metadataForEntry?.(rawItem) || rawItem;
    studio.selectedTerm = item.term; instance.runtime.writeState(state);
    const detail = instance.host.querySelector("[data-hhev-detail]"); if (!detail) return;
    const saved = Boolean(state.savedWords?.[item.term]); const note = studio.notes[item.term] || "";
    detail.innerHTML = `<header><div><small>${item.reviewed ? "REVIEWED ENTRY" : "TERM INDEX"}</small><h3>${esc(item.term)}</h3><p>${esc(item.pos)} · ${esc(item.level || "CEFR chưa phân loại")}</p></div><span class="${item.reviewed ? "reviewed" : "term"}">${item.reviewed ? "Đã kiểm duyệt" : "Chưa kiểm duyệt"}</span></header>
      <div class="hhev-pronounce"><button type="button" data-hhev-speak="${esc(item.term)}">▶</button><span><b>US ${esc(item.ipaUS || "—")}</b><b>UK ${esc(item.ipaUK || "—")}</b></span></div>
      <section><small>NGHĨA VIỆT</small>${item.meaning ? `<strong>${esc(item.meaning)}</strong>${item.senses.slice(1).map((sense) => `<p>${esc(sense)}</p>`).join("")}` : '<p class="hhev-honest">Chưa có nghĩa Việt được kiểm duyệt. HH không tự gán nghĩa cho mục này.</p>'}</section>
      <section><small>VÍ DỤ</small>${item.example ? `<blockquote>${esc(item.example)}</blockquote>${item.vnExample ? `<p>${esc(item.vnExample)}</p>` : ""}` : '<p class="hhev-honest">Chưa có câu ví dụ được kiểm duyệt.</p>'}</section>
      <section><small>COLLOCATION</small>${item.collocations.length ? `<div class="hhev-chips">${item.collocations.map((value) => `<span>${esc(value)}</span>`).join("")}</div>` : '<p class="hhev-honest">Chưa có cụm từ đã kiểm duyệt.</p>'}</section>
      <section><small>WORD FAMILY · SYNONYM · ANTONYM</small>${item.family.length || item.synonyms.length || item.antonyms.length ? `<div class="hhev-chips">${[...item.family, ...item.synonyms, ...item.antonyms].map((value) => `<span>${esc(value)}</span>`).join("")}</div>` : '<p class="hhev-honest">Chưa có dữ liệu đã kiểm duyệt.</p>'}</section>
      <label class="hhev-note"><span>Ghi chú cá nhân</span><textarea data-hhev-note="${esc(item.term)}" placeholder="Cách nhớ hoặc ví dụ của bạn...">${esc(note)}</textarea></label>
      <footer><button type="button" data-hhev-speak="${esc(item.term)}">♪ Nghe</button><button class="primary" type="button" data-hhev-save="${esc(item.term)}" data-index="${Number(result.index ?? -1)}">${saved ? "★ Đã lưu" : "☆ Lưu vào SRS"}</button></footer><p class="hhev-source">Nguồn: ${item.reviewed ? esc(item.source) : "ESDB/SCOWL · spelling index"}${item.ageBands?.length ? ` · Phù hợp: ${esc(item.ageBands.join(", "))}` : ""}</p>`;
  };

  const writeAndRefresh = (instance, state) => { instance.runtime.writeState(state); renderActive(instance); };
  const advanceLesson = (instance, state, error = false) => {
    const lesson = normalizeStudio(state).lesson; if (!lesson) return;
    if (error) { lesson.errors = (Number(lesson.errors) || 0) + 1; return; }
    if (lesson.step < lessonSteps.length - 1) lesson.step += 1;
    else if (lesson.current < lesson.words.length - 1) { lesson.current += 1; lesson.step = 0; }
    else {
      lesson.completedAt = new Date().toISOString();
      lesson.words.forEach((word) => { state.wordMastery[word.term] = { ...(state.wordMastery[word.term] || {}), score: Math.max(70, masteryFor(state, word.term)), lastSeenAt: lesson.completedAt }; });
    }
  };
  const download = (filename, text, type) => {
    const url = URL.createObjectURL(new Blob([text], { type })); const link = root.document.createElement("a"); link.href = url; link.download = filename; link.click(); root.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const handleClick = async (instance, event) => {
    const tab = event.target.closest("[data-hhev-tab]");
    if (tab) { const state = instance.runtime.readState(); normalizeStudio(state).activeTab = tab.dataset.hhevTab; writeAndRefresh(instance, state); return; }
    if (event.target.closest("[data-hhev-start-lesson]")) { const state = instance.runtime.readState(); const studio = normalizeStudio(state); studio.lesson = buildLesson(reviewedCatalog(), state, 15); studio.activeTab = "lesson"; writeAndRefresh(instance, state); instance.runtime.toast(studio.lesson.words.length ? `Đã tạo bài ${studio.lesson.words.length} từ.` : "Chưa đủ từ đã kiểm duyệt để tạo bài."); return; }
    const resultButton = event.target.closest("[data-hhev-result]");
    if (resultButton) { const state = instance.runtime.readState(); normalizeStudio(state).selectedTerm = resultButton.dataset.hhevResult; instance.runtime.writeState(state); instance.host.querySelectorAll("[data-hhev-result]").forEach((node) => node.classList.toggle("active", node === resultButton)); await paintDetail(instance, { term: resultButton.dataset.hhevResult, index: Number(resultButton.dataset.index) }); return; }
    const speak = event.target.closest("[data-hhev-speak]"); if (speak) { const state = instance.runtime.readState(); instance.runtime.speak(speak.dataset.hhevSpeak, state.settings); return; }
    const save = event.target.closest("[data-hhev-save]");
    if (save) {
      const state = instance.runtime.readState(); const term = save.dataset.hhevSave; const map = reviewedMap(); const item = map.get(normalizeTerm(term)) || await loadTermIndexEntry(instance, Number(save.dataset.index), term);
      if (state.savedWords[term]) { delete state.savedWords[term]; delete state.reviewQueue[term]; }
      else { state.savedWords[term] = { word: term, ipa: item.ipaUS || item.ipaUK, meaning: item.meaning, example: item.example, level: item.level, verification: item.verification, savedAt: new Date().toISOString(), source: item.source }; state.reviewQueue[term] = { dueAt: new Date().toISOString(), repetitions: 0, interval: 1, ease: 2.5 }; }
      instance.runtime.writeState(state); await paintDetail(instance, { term, index: Number(save.dataset.index) }); instance.runtime.toast(state.savedWords[term] ? "Đã lưu vào SRS." : "Đã bỏ khỏi SRS."); return;
    }
    const next = event.target.closest("[data-hhev-lesson-next]"); if (next) { const state = instance.runtime.readState(); advanceLesson(instance, state); writeAndRefresh(instance, state); return; }
    const choice = event.target.closest("[data-hhev-choice]");
    if (choice) { const state = instance.runtime.readState(); const lesson = normalizeStudio(state).lesson; const word = lesson?.words?.[Math.min((lesson.words?.length || 1) - 1, Number(lesson.current) || 0)]; const correct = normalizeTerm(choice.dataset.hhevChoice) === normalizeTerm(word?.meaning || ""); if (!correct) { advanceLesson(instance, state, true); instance.runtime.writeState(state); const output = instance.host.querySelector("[data-hhev-feedback]"); if (output) output.textContent = "Chưa đúng. Hãy thử lại."; } else { advanceLesson(instance, state); writeAndRefresh(instance, state); } return; }
    const mode = event.target.closest("[data-hhev-open-mode]");
    if (mode) { const state = instance.runtime.readState(); state.galaxyMode = mode.dataset.hhevOpenMode; state.activeView = "lab"; instance.runtime.writeState(state); instance.runtime.render({ focusView: true }); return; }
    const analyze = event.target.closest("[data-hhev-coverage]");
    if (analyze) { const state = instance.runtime.readState(); const known = Object.entries(state.wordMastery || {}).filter(([, item]) => Number(item.score) >= 70).map(([term]) => term); known.push(...Object.keys(state.savedWords || {})); normalizeStudio(state).lastCoverage = coverageReport(instance.host.querySelector("[data-hhev-coverage-text]")?.value || "", known); writeAndRefresh(instance, state); return; }
    const exportButton = event.target.closest("[data-hhev-export]");
    if (exportButton) { const state = instance.runtime.readState(); const format = exportButton.dataset.hhevExport; const rows = [...Object.values(state.savedWords || {}).map((item) => ({ ...item, term: item.word || item.term })), ...normalizeStudio(state).personalDictionary]; download(`hh-english-vocabulary.${format === "anki" ? "tsv" : format}`, exportRows(rows, format), format === "json" ? "application/json" : "text/plain"); return; }
  };
  const handleSubmit = (instance, event) => {
    const form = event.target.closest("[data-hhev-type-check]"); if (!form) return;
    event.preventDefault(); const input = form.elements.answer; const state = instance.runtime.readState(); const lesson = normalizeStudio(state).lesson; const word = lesson?.words?.[Math.min((lesson.words?.length || 1) - 1, Number(lesson.current) || 0)]; const correct = normalizeTerm(input.value) === normalizeTerm(word?.term || "");
    if (!correct) { advanceLesson(instance, state, true); instance.runtime.writeState(state); const output = form.querySelector("[data-hhev-feedback]"); if (output) output.textContent = "Chưa đúng. Hãy kiểm tra chính tả và thử lại."; return; }
    advanceLesson(instance, state); writeAndRefresh(instance, state);
  };
  const handleInput = (instance, event) => {
    if (event.target.matches("[data-hhev-search], [data-hhev-filter]")) {
      clearTimeout(instance.searchTimer); instance.searchTimer = root.setTimeout(() => { const state = instance.runtime.readState(); normalizeStudio(state).filters = readFilters(instance, state); instance.runtime.writeState(state); searchAndPaint(instance).catch(() => paintError(instance, "Không thể tìm trong kho từ.")); }, 120);
    }
    if (event.target.matches("[data-hhev-note]")) {
      clearTimeout(instance.noteTimer); const term = event.target.dataset.hhevNote; const value = event.target.value; instance.noteTimer = root.setTimeout(() => { const state = instance.runtime.readState(); normalizeStudio(state).notes[term] = boundedString(value, 2000); instance.runtime.writeState(state); }, 300);
    }
  };
  const handleChange = async (instance, event) => {
    if (event.target.matches("[data-hhev-filter]")) { const state = instance.runtime.readState(); normalizeStudio(state).filters = readFilters(instance, state); instance.runtime.writeState(state); await searchAndPaint(instance); return; }
    if (!event.target.matches("[data-hhev-import]") || !event.target.files?.[0]) return;
    const file = event.target.files[0]; const format = /json$/i.test(file.name) ? "json" : /(?:tsv|txt)$/i.test(file.name) ? "anki" : "csv"; const rows = parseImport(await file.text(), format); const state = instance.runtime.readState(); const studio = normalizeStudio(state); studio.personalDictionary = uniqueBy([...studio.personalDictionary, ...rows], (item) => normalizeTerm(item.term)).slice(0, 1000); writeAndRefresh(instance, state); instance.runtime.toast(`Đã nhập ${rows.length} mục từ cục bộ.`);
  };
  const mount = (runtime) => {
    if (!runtime?.host) return;
    let instance = instances.get(runtime.host);
    if (!instance) {
      instance = { host: runtime.host, runtime, manifest: null, index: null, packs: new Map(), worker: null, pending: new Map(), requestId: 0, readyPromise: null, searchTimer: 0, noteTimer: 0, results: [] };
      instances.set(runtime.host, instance);
      runtime.host.addEventListener("click", (event) => handleClick(instance, event));
      runtime.host.addEventListener("submit", (event) => handleSubmit(instance, event));
      runtime.host.addEventListener("input", (event) => handleInput(instance, event));
      runtime.host.addEventListener("change", (event) => handleChange(instance, event));
    }
    instance.runtime = runtime;
    if (runtime.readState().activeView === "galaxy") { ensureData(instance).catch(() => {}); renderActive(instance); }
  };
  const unmount = (host) => {
    const instance = instances.get(host); if (!instance) return;
    clearTimeout(instance.searchTimer); clearTimeout(instance.noteTimer); instance.worker?.terminate?.(); instance.pending.clear(); instances.delete(host);
  };

  const api = { VERSION, MANIFEST_URL, lessonSteps, labModes, normalizeTerm, normalizeStudio, searchTerms, reviewedEntry, buildLesson, coverageReport, parseImport, exportRows, renderShell, mount, unmount };
  root.HHEnglishVocabulary = Object.freeze(api);
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})();
