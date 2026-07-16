(() => {
  "use strict";

  const root = typeof window !== "undefined" ? window : globalThis;
  const STORAGE_KEY = "hh.english.state.v1";
  const APP_VERSION = 1;
  const todayKey = () => new Date().toISOString().slice(0, 10);
  const escapeHtml = (value = "") => String(value).replace(/[&<>"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[char]);
  const normalize = (value = "") => String(value).trim().toLowerCase().replace(/[.!?,;:]/g, "").replace(/\s+/g, " ");

  const unitVocabulary = {
    sounds: [
      ["letter", "/ˈletər/", "chữ cái", "This letter is A."], ["alphabet", "/ˈælfəbet/", "bảng chữ cái", "The English alphabet has 26 letters."],
      ["sound", "/saʊnd/", "âm", "Listen to the sound."], ["spell", "/spel/", "đánh vần", "Please spell your name."],
      ["vowel", "/ˈvaʊəl/", "nguyên âm", "A is a vowel."], ["consonant", "/ˈkɑːnsənənt/", "phụ âm", "B is a consonant."],
      ["name", "/neɪm/", "tên", "My name is Lan."], ["word", "/wɜːrd/", "từ", "Read the word slowly."],
      ["listen", "/ˈlɪsən/", "lắng nghe", "Listen and repeat."], ["repeat", "/rɪˈpiːt/", "lặp lại", "Repeat after me."],
      ["capital", "/ˈkæpɪtl/", "chữ hoa", "Write a capital H."], ["small", "/smɔːl/", "chữ thường; nhỏ", "Write a small h."]
    ],
    greetings: [
      ["hello", "/həˈloʊ/", "xin chào", "Hello, I am Minh."], ["hi", "/haɪ/", "chào", "Hi, nice to meet you."],
      ["goodbye", "/ˌɡʊdˈbaɪ/", "tạm biệt", "Goodbye. See you tomorrow."], ["please", "/pliːz/", "làm ơn", "Please sit down."],
      ["thank you", "/ˈθæŋk juː/", "cảm ơn", "Thank you for your help."], ["sorry", "/ˈsɑːri/", "xin lỗi", "Sorry, I am late."],
      ["meet", "/miːt/", "gặp", "Nice to meet you."], ["friend", "/frend/", "bạn", "Mai is my friend."],
      ["morning", "/ˈmɔːrnɪŋ/", "buổi sáng", "Good morning, teacher."], ["evening", "/ˈiːvnɪŋ/", "buổi tối", "Good evening, everyone."],
      ["fine", "/faɪn/", "khỏe; ổn", "I am fine, thanks."], ["welcome", "/ˈwelkəm/", "chào mừng", "Welcome to our class."]
    ],
    numbers: [
      ["zero", "/ˈzɪroʊ/", "số không", "The first number is zero."], ["one", "/wʌn/", "số một", "I have one book."],
      ["two", "/tuː/", "số hai", "She has two pens."], ["three", "/θriː/", "số ba", "We need three chairs."],
      ["ten", "/ten/", "số mười", "There are ten students."], ["twenty", "/ˈtwenti/", "hai mươi", "He is twenty years old."],
      ["age", "/eɪdʒ/", "tuổi", "What is your age?"], ["old", "/oʊld/", "tuổi; cũ", "I am eighteen years old."],
      ["phone", "/foʊn/", "điện thoại", "This is my phone."], ["number", "/ˈnʌmbər/", "số", "What is your phone number?"],
      ["address", "/əˈdres/", "địa chỉ", "My address is 15 Lake Street."], ["how many", "/haʊ ˈmeni/", "bao nhiêu", "How many books do you have?"]
    ],
    family: [
      ["family", "/ˈfæməli/", "gia đình", "My family is small."], ["mother", "/ˈmʌðər/", "mẹ", "My mother is a nurse."],
      ["father", "/ˈfɑːðər/", "bố", "My father likes music."], ["parent", "/ˈperənt/", "cha hoặc mẹ", "Each parent is here."],
      ["sister", "/ˈsɪstər/", "chị/em gái", "My sister is a student."], ["brother", "/ˈbrʌðər/", "anh/em trai", "Her brother is tall."],
      ["grandmother", "/ˈɡrænmʌðər/", "bà", "My grandmother tells stories."], ["grandfather", "/ˈɡrænfɑːðər/", "ông", "His grandfather is kind."],
      ["person", "/ˈpɜːrsn/", "người", "She is a friendly person."], ["young", "/jʌŋ/", "trẻ", "The child is young."],
      ["kind", "/kaɪnd/", "tốt bụng", "Our teacher is kind."], ["live", "/lɪv/", "sống", "We live in Hà Nội."]
    ],
    objects: [
      ["book", "/bʊk/", "quyển sách", "This book is new."], ["pen", "/pen/", "bút mực", "The pen is blue."],
      ["pencil", "/ˈpensl/", "bút chì", "I write with a pencil."], ["bag", "/bæɡ/", "cái túi", "My bag is under the chair."],
      ["table", "/ˈteɪbl/", "cái bàn", "The keys are on the table."], ["chair", "/tʃer/", "cái ghế", "Please take a chair."],
      ["door", "/dɔːr/", "cánh cửa", "Close the door, please."], ["window", "/ˈwɪndoʊ/", "cửa sổ", "Open the window."],
      ["key", "/kiː/", "chìa khóa", "This is my house key."], ["cup", "/kʌp/", "cái cốc", "The cup is on the desk."],
      ["this", "/ðɪs/", "cái này", "This is a notebook."], ["that", "/ðæt/", "cái kia", "That is your bag."]
    ]
  };

  const unitSpecs = [
    { id: "sounds", title: "Alphabet & sounds", vi: "Bảng chữ cái và âm", color: "#63e8ff", lessons: [
      ["The English alphabet", "Nhận diện và đọc bảng chữ cái tiếng Anh.", "A, E, I, O and U are vowels. The other letters are consonants.", "Teacher: Listen: A, B, C.\nLearner: A, B, C.\nTeacher: Great. Now say your name."],
      ["Spell your name", "Hỏi tên và đánh vần tên ngắn.", "Use “How do you spell it?” to ask for spelling.", "Mai: What is your name?\nNam: My name is Nam.\nMai: How do you spell it?\nNam: N-A-M."],
      ["Hear and repeat", "Phân biệt âm chữ cái phổ biến khi nghe.", "Use “Listen and repeat” for pronunciation practice.", "Teacher: Listen and repeat: H, Huy.\nHuy: H, Huy.\nTeacher: Good. Say the word slowly."]
    ]},
    { id: "greetings", title: "Greetings & introductions", vi: "Chào hỏi và giới thiệu", color: "#ff6ccf", lessons: [
      ["Hello and goodbye", "Chào và tạm biệt phù hợp thời điểm.", "Use “Good morning” before noon and “Good evening” later in the day.", "Lan: Good morning, Minh.\nMinh: Good morning, Lan.\nLan: Goodbye. See you tomorrow."],
      ["Introduce yourself", "Giới thiệu tên và quê quán bằng câu đơn giản.", "Use “I am…” or “My name is…” to introduce yourself.", "An: Hi, I am An. I am from Việt Nam.\nBen: Hello, An. My name is Ben. Nice to meet you."],
      ["How are you?", "Hỏi và trả lời về tình trạng hiện tại.", "“How are you?” can be answered with “I am fine, thank you.”", "Mai: Hello, Linh. How are you?\nLinh: I am fine, thank you. And you?\nMai: I am good."]
    ]},
    { id: "numbers", title: "Numbers & personal details", vi: "Số và thông tin cá nhân", color: "#ffe66d", lessons: [
      ["Numbers 0–20", "Đọc, nghe và dùng số từ 0 đến 20.", "Numbers after thirteen usually end in -teen: fourteen, fifteen, sixteen.", "Teacher: How many pens?\nHoa: Three pens.\nTeacher: Correct. And how many books?\nHoa: Ten books."],
      ["Age and birthdays", "Hỏi và nói tuổi một cách lịch sự.", "Ask “How old are you?” and answer “I am … years old.”", "Nam: How old are you?\nLucy: I am twenty years old.\nNam: I am nineteen."],
      ["Phone numbers", "Đọc số điện thoại theo từng chữ số.", "Say phone numbers digit by digit. Zero can also be said as “oh”.", "Clerk: What is your phone number?\nMinh: It is zero nine one, two three four, five six seven.\nClerk: Thank you."]
    ]},
    { id: "family", title: "Family & people", vi: "Gia đình và con người", color: "#80f4b4", lessons: [
      ["My family", "Gọi tên các thành viên gần gũi trong gia đình.", "Use “This is my…” when introducing one person.", "Lan: This is my family.\nBen: Who is this?\nLan: This is my mother, and this is my father."],
      ["Describe people", "Mô tả người bằng tính từ cơ bản.", "Put the adjective after “be”: She is kind. He is young.", "Mai: Who is she?\nNam: She is my sister.\nMai: She is very friendly.\nNam: Yes, she is kind too."],
      ["Where we live", "Nói nơi bản thân và gia đình sinh sống.", "Use “live in” before a city or country: We live in Huế.", "Alex: Where does your family live?\nHoa: We live in Đà Nẵng.\nAlex: Do your grandparents live there too?\nHoa: Yes, they do."],
    ]},
    { id: "objects", title: "Everyday objects", vi: "Đồ vật hằng ngày", color: "#a98cff", lessons: [
      ["Things around me", "Gọi tên đồ vật học tập và trong phòng.", "Use “a” before one consonant sound: a book, a pen.", "Teacher: What is this?\nMinh: It is a book.\nTeacher: And that?\nMinh: That is a pencil."],
      ["This or that", "Dùng this và that theo khoảng cách.", "Use “this” for something near and “that” for something farther away.", "Lan: Is this your pen?\nNam: No. That blue pen is mine.\nLan: Here you are."],
      ["Where is it?", "Nói vị trí với on, in và under.", "Use “on” for a surface, “in” for inside, and “under” for below.", "Mai: Where is my key?\nBen: It is on the table.\nMai: And my bag?\nBen: It is under the chair."]
    ]}
  ];

  const lessonIds = [];
  const courses = unitSpecs.map((unit, unitIndex) => ({
    ...unit,
    lessons: unit.lessons.map((lesson, lessonIndex) => {
      const id = `a0-${unitIndex + 1}-${lessonIndex + 1}`;
      lessonIds.push(id);
      const vocabulary = unitVocabulary[unit.id].slice(lessonIndex * 2, lessonIndex * 2 + 8);
      const pool = unitVocabulary[unit.id];
      const exercises = vocabulary.slice(0, 5).map((entry, index) => {
        const options = [entry[2], pool[(index + 4) % pool.length][2], pool[(index + 7) % pool.length][2]];
        options.push(...options.splice(0, index % options.length));
        return {
          id: `${id}-q${index + 1}`,
          type: index === 4 ? "fill-in-the-blank" : "multiple-choice",
          prompt: index === 4 ? `Điền từ tiếng Anh: “${entry[2]}”` : `“${entry[0]}” có nghĩa là gì?`,
          answer: index === 4 ? entry[0] : entry[2],
          options: index === 4 ? [] : options,
          explanation: `${entry[0]} ${entry[1]} nghĩa là “${entry[2]}”. Ví dụ: ${entry[3]}`,
          points: 20
        };
      });
      return { id, title: lesson[0], canDo: lesson[1], grammar: lesson[2].trim(), dialogue: lesson[3], vocabulary, exercises, minutes: 10 + lessonIndex * 2, xp: 50 };
    })
  }));

  const placementQuestions = [
    ["Vocabulary", "Chọn nghĩa của “hello”.", ["xin chào", "tạm biệt", "cảm ơn"], 0],
    ["Vocabulary", "Chọn từ tiếng Anh cho “quyển sách”.", ["book", "bag", "door"], 0],
    ["Vocabulary", "“mother” là ai?", ["mẹ", "chị gái", "bà"], 0],
    ["Vocabulary", "Chọn nghĩa của “address”.", ["địa chỉ", "số tuổi", "điện thoại"], 0],
    ["Vocabulary", "“kind” gần nghĩa nhất với từ nào?", ["tốt bụng", "nhỏ", "cũ"], 0],
    ["Grammar", "Chọn câu đúng.", ["I am Minh.", "I is Minh.", "I are Minh."], 0],
    ["Grammar", "___ is my bag here.", ["This", "Those", "These"], 0],
    ["Grammar", "She ___ my sister.", ["is", "am", "are"], 0],
    ["Grammar", "We live ___ Hà Nội.", ["in", "on", "atop"], 0],
    ["Grammar", "How old ___ you?", ["are", "is", "am"], 0],
    ["Reading", "Lan says: “I have two brothers.” How many brothers does Lan have?", ["Two", "One", "Three"], 0],
    ["Reading", "“The key is under the chair.” Where is the key?", ["Under the chair", "On the table", "In the bag"], 0],
    ["Reading", "“Mai is young and kind.” Which statement is true?", ["Mai is kind.", "Mai is old.", "Mai is a teacher."], 0],
    ["Listening", "Nghe câu mẫu rồi chọn nội dung đúng.", ["My name is Nam.", "My bag is new.", "My phone is here."], 0, "My name is Nam."],
    ["Listening", "Nghe câu mẫu rồi chọn số đúng.", ["Thirteen", "Thirty", "Three"], 0, "I am thirteen years old."],
    ["Listening", "Nghe câu mẫu rồi chọn vị trí đúng.", ["On the table", "Under the chair", "In the bag"], 0, "The book is on the table."]
  ];

  const defaultState = () => ({
    version: APP_VERSION, activeView: "dashboard", activeLesson: lessonIds[0], completed: {}, attempts: {}, savedWords: {}, reviewQueue: {}, xp: 0,
    streak: { current: 0, longest: 0, lastDate: "" }, dailyGoal: 15, studyDays: [1, 2, 3, 4, 5], minutesByDay: {}, placement: null, writingDraft: "", writingHistory: [], practice: { listening: 0, reading: 0, grammar: 0 },
    settings: { voiceRate: 0.85, interfaceLanguage: "vi", reducedMotion: false, theme: "night", learnerType: "student", goal: "Giao tiếp hằng ngày" }
  });
  const readState = () => {
    try { const fallback = defaultState(); const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}"); return { ...fallback, ...stored, streak: { ...fallback.streak, ...(stored.streak || {}) }, practice: { ...fallback.practice, ...(stored.practice || {}) }, settings: { ...fallback.settings, ...(stored.settings || {}) } }; } catch { return defaultState(); }
  };
  const writeState = (state) => localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...state, version: APP_VERSION }));
  const getLesson = (id) => courses.flatMap((unit) => unit.lessons).find((lesson) => lesson.id === id) || courses[0].lessons[0];
  const completedCount = (state) => Object.values(state.completed || {}).filter(Boolean).length;
  const levelFromScore = (score) => score < 35 ? "A0" : score < 70 ? "A1" : "A2";
  const updateStreak = (state) => {
    const today = todayKey();
    if (state.streak.lastDate === today) return;
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    state.streak.current = state.streak.lastDate === yesterday ? state.streak.current + 1 : 1;
    state.streak.longest = Math.max(state.streak.longest, state.streak.current);
    state.streak.lastDate = today;
  };
  const scheduleReview = (record = {}, rating = "good", now = Date.now()) => {
    const current = { interval: 0, easeFactor: 2.5, repetitions: 0, lapses: 0, ...record };
    const quality = { again: 1, hard: 3, good: 4, easy: 5 }[rating] || 4;
    if (quality < 3) { current.repetitions = 0; current.interval = 1; current.lapses += 1; }
    else {
      current.interval = current.repetitions === 0 ? 1 : current.repetitions === 1 ? 3 : Math.max(1, Math.round(current.interval * current.easeFactor * (rating === "easy" ? 1.3 : rating === "hard" ? 0.75 : 1)));
      current.repetitions += 1;
    }
    current.easeFactor = Math.max(1.3, current.easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)));
    current.lastReviewedAt = new Date(now).toISOString();
    current.dueAt = new Date(now + current.interval * 86400000).toISOString();
    return current;
  };
  const scoreAnswers = (questions, answers) => questions.reduce((score, question, index) => score + (Number(answers[index]) === question[3] ? 1 : 0), 0);

  let host = null;
  let mediaRecorder = null;
  let recordedChunks = [];
  let recordingUrl = "";
  let focusSeconds = 15 * 60;
  let focusTimer = null;

  const speak = (text, rate) => {
    if (!("speechSynthesis" in window)) return false;
    speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "en-US"; utterance.rate = Number(rate) || 0.85;
    const voice = speechSynthesis.getVoices().find((item) => /^en-(US|GB)/.test(item.lang));
    if (voice) utterance.voice = voice;
    speechSynthesis.speak(utterance);
    return true;
  };

  const navItems = [
    ["dashboard", "⌂", "Tổng quan"], ["learn", "▶", "Bài học"], ["practice", "✦", "Luyện tập"], ["placement", "◎", "Xếp lớp"], ["vocabulary", "◇", "Sổ từ"],
    ["speaking", "◉", "Phát âm"], ["writing", "✎", "Viết"], ["progress", "↗", "Tiến độ"], ["settings", "⚙", "Cài đặt"]
  ];
  const weekdayLabels = [[1, "T2"], [2, "T3"], [3, "T4"], [4, "T5"], [5, "T6"], [6, "T7"], [0, "CN"]];
  const formatFocusTime = (seconds) => `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
  const shell = (state, content) => `<section class="hhe-app" data-hhe-app data-view="${state.activeView}" data-theme="${state.settings.theme}">
    <header class="hhe-topbar"><div class="hhe-brand"><span>HH</span><div><small>FREE ENGLISH LAB</small><strong>HH English</strong></div></div><div class="hhe-top-stats"><span><i>⚡</i><b data-hhe-xp>${state.xp}</b> XP</span><span><i>◆</i><b>${state.streak.current}</b> ngày</span><span><i>◷</i><b>${state.dailyGoal}</b> phút</span></div><button type="button" data-hhe-theme aria-label="Đổi màu giao diện">${state.settings.theme === "day" ? "☀ Sáng" : "◐ Tối"}</button><button type="button" data-hhe-export>Xuất dữ liệu</button></header>
    <div class="hhe-layout"><aside class="hhe-nav" aria-label="Điều hướng HH English">${navItems.map(([id, icon, label]) => `<button type="button" class="${state.activeView === id ? "active" : ""}" data-hhe-view="${id}"><i>${icon}</i><span>${label}</span></button>`).join("")}<section><small>Trình độ hiện tại</small><strong>${state.placement?.level || "A0"}</strong><span>${completedCount(state)}/15 bài A0</span></section></aside><main class="hhe-main">${content}</main></div>
    <div class="hhe-toast" data-hhe-toast role="status" aria-live="polite"></div>
  </section>`;

  const dashboardView = (state) => {
    const done = completedCount(state); const percent = Math.round(done / lessonIds.length * 100); const minutes = state.minutesByDay[todayKey()] || 0;
    const next = getLesson(lessonIds.find((id) => !state.completed[id]) || lessonIds[0]);
    const hour = new Date().getHours(); const greeting = hour < 11 ? "Chào buổi sáng" : hour < 18 ? "Chào buổi chiều" : "Chào buổi tối";
    return `<section class="hhe-dashboard"><div class="hhe-hero"><div><p>${greeting.toUpperCase()}, LEARNER</p><h2>Biến tiếng Anh thành<br><em>kỹ năng mỗi ngày.</em></h2><span>Lộ trình nguyên bản cho người Việt từ mất gốc, học ngắn gọn và luôn biết vì sao mình sai.</span><div><button class="primary" type="button" data-hhe-open-lesson="${next.id}">Tiếp tục bài học <b>→</b></button><button type="button" data-hhe-view="placement">Kiểm tra trình độ</button></div></div><div class="hhe-orbit" aria-hidden="true"><b>${percent}%</b><span>A0 ROADMAP</span><i></i><i></i><i></i></div></div>
      <div class="hhe-metrics"><article><span>Mục tiêu hôm nay</span><strong>${minutes}/${state.dailyGoal} phút</strong><i style="--p:${Math.min(100, minutes / state.dailyGoal * 100)}%"></i></article><article><span>Chuỗi học</span><strong>${state.streak.current} ngày</strong><small>Kỷ lục ${state.streak.longest} ngày</small></article><article><span>Từ đã lưu</span><strong>${Object.keys(state.savedWords).length} từ</strong><small>${Object.values(state.reviewQueue).filter((item) => new Date(item.dueAt || 0) <= new Date()).length} cần ôn</small></article><article><span>Năng lượng học</span><strong>${state.xp} XP</strong><small>Cấp ${Math.floor(state.xp / 300) + 1}</small></article></div>
      <div class="hhe-dashboard-grid"><section class="hhe-next-card"><header><div><small>BÀI TIẾP THEO · ${next.minutes} PHÚT</small><h3>${escapeHtml(next.title)}</h3><p>${escapeHtml(next.canDo)}</p></div><span>+${next.xp} XP</span></header><div class="hhe-skill-pills"><b>Nghe</b><b>Nói</b><b>Từ vựng</b></div><button class="primary" type="button" data-hhe-open-lesson="${next.id}">Bắt đầu học</button></section>
      <section class="hhe-roadmap-mini"><header><div><small>LỘ TRÌNH CEFR</small><h3>Từ A0 đến C2</h3></div><button type="button" data-hhe-view="learn">Xem lộ trình</button></header>${["A0", "A1", "A2", "B1", "B2", "C1", "C2"].map((level, index) => `<div class="${index === 0 ? "active" : ""}"><b>${level}</b><span>${["Mất gốc", "Cơ bản", "Sơ trung cấp", "Trung cấp", "Trên trung cấp", "Nâng cao", "Thành thạo"][index]}</span><small>${index === 0 ? `${percent}%` : index === 1 ? "Bản xem trước" : "Sắp mở"}</small></div>`).join("")}</section></div>
      <section class="hhe-student-tools"><article class="hhe-study-plan"><header><div><small>LỊCH HỌC CỦA TÔI</small><h3>Nhịp học trong tuần</h3></div><span>${state.studyDays.length} ngày</span></header><div>${weekdayLabels.map(([day, label]) => `<button type="button" class="${state.studyDays.includes(day) ? "active" : ""}" data-hhe-day="${day}" aria-pressed="${state.studyDays.includes(day)}"><b>${label}</b><small>${state.studyDays.includes(day) ? "Học" : "Nghỉ"}</small></button>`).join("")}</div><p>Chọn những ngày bạn có thể duy trì. Lịch được lưu ngay trên thiết bị.</p></article><article class="hhe-focus-card"><small>FOCUS SESSION</small><h3>Học tập trung 15 phút</h3><strong data-hhe-focus-clock>${formatFocusTime(focusSeconds)}</strong><div><button class="primary" type="button" data-hhe-focus-start>${focusTimer ? "Tạm dừng" : "Bắt đầu"}</button><button type="button" data-hhe-focus-reset>Đặt lại</button></div><p>Hoàn thành một phiên để nhận 30 XP và cộng thời gian học.</p></article><article class="hhe-goal-card"><small>MỤC TIÊU CÁ NHÂN</small><h3>${escapeHtml(state.settings.goal)}</h3><p>${state.settings.learnerType === "student" ? "Lịch học linh hoạt cho học sinh, sinh viên." : "Lộ trình ngắn gọn cho người đi làm."}</p><div><span>Hôm nay</span><b>${Math.min(100, Math.round(minutes / state.dailyGoal * 100))}%</b></div><i style="--p:${Math.min(100, minutes / state.dailyGoal * 100)}%"></i><button type="button" data-hhe-view="settings">Điều chỉnh mục tiêu</button></article></section>
      <section class="hhe-skills"><header><div><small>4 KỸ NĂNG CỐT LÕI</small><h3>Học để sử dụng, không chỉ ghi nhớ</h3></div><button type="button" data-hhe-view="practice">Mở phòng luyện tập</button></header><div>${[["Listening", "Nghe chậm, nghe lại và đọc transcript", "#62e9f2"], ["Speaking", "Nghe mẫu, thu âm và tự đối chiếu", "#ff6ecf"], ["Reading", "Đọc ngắn với từ vựng đúng trình độ", "#ffe66d"], ["Writing", "Viết có gợi ý, đếm từ và lưu bản nháp", "#80f4b4"]].map(([title, text, color]) => `<article style="--skill:${color}"><i></i><strong>${title}</strong><p>${text}</p></article>`).join("")}</div></section></section>`;
  };

  const learnView = (state) => `<section class="hhe-learning"><header class="hhe-section-head"><div><small>A0 · ENGLISH FROM ZERO</small><h2>Lộ trình học từng bước</h2><p>5 unit · 15 bài nguyên bản · ước tính 3 giờ học tập trung</p></div><span>${Math.round(completedCount(state) / 15 * 100)}% hoàn thành</span></header><label class="hhe-course-search"><span>Tìm bài học</span><input type="search" data-hhe-search placeholder="Ví dụ: chào hỏi, số, gia đình..." autocomplete="off"><kbd>/</kbd></label><p class="hhe-search-empty" data-hhe-search-empty hidden>Không tìm thấy bài phù hợp. Hãy thử từ khóa khác.</p><div class="hhe-unit-list">${courses.map((unit, index) => `<section style="--unit:${unit.color}" data-hhe-unit data-search="${escapeHtml(`${unit.title} ${unit.vi}`)}"><header><span>${String(index + 1).padStart(2, "0")}</span><div><small>UNIT ${index + 1}</small><h3>${unit.title}</h3><p>${unit.vi}</p></div><b>${unit.lessons.filter((item) => state.completed[item.id]).length}/3</b></header><div>${unit.lessons.map((lesson, lessonIndex) => `<button type="button" class="${state.completed[lesson.id] ? "done" : ""}" data-hhe-open-lesson="${lesson.id}" data-search="${escapeHtml(`${lesson.title} ${lesson.canDo}`)}"><span>${state.completed[lesson.id] ? "✓" : lessonIndex + 1}</span><div><strong>${lesson.title}</strong><small>${lesson.canDo}</small></div><b>${lesson.minutes}m</b></button>`).join("")}</div></section>`).join("")}</div><section class="hhe-a1-preview"><div><small>A1 PREVIEW</small><h3>Bước tiếp theo của bạn</h3><p>Daily routines · Food & ordering · Places in town</p></div><span>Đang biên soạn</span></section></section>`;

  const practiceView = (state) => `<section class="hhe-practice"><header class="hhe-section-head"><div><small>DAILY SKILL LAB</small><h2>Phòng luyện tập tổng hợp</h2><p>Bài ngắn có chấm điểm, đáp án và giải thích để ôn giữa giờ học hoặc trước kỳ kiểm tra.</p></div><span>${Object.values(state.practice).filter((score) => score >= 100).length}/3 hoàn thành</span></header><div class="hhe-practice-summary">${[["listening", "Nghe", "Âm thanh + hiểu ý"], ["reading", "Đọc", "Đọc nhanh + chi tiết"], ["grammar", "Ngữ pháp", "Mẫu câu nền tảng"]].map(([id, label, text]) => `<article><span>${state.practice[id] >= 100 ? "✓" : "○"}</span><div><strong>${label}</strong><small>${text}</small></div><b>${state.practice[id] || 0}%</b></article>`).join("")}</div><div class="hhe-practice-grid"><form data-hhe-practice="listening" data-answer="library"><header><span>01</span><div><small>LISTENING</small><h3>Nghe thông báo ở trường</h3></div></header><p>Nghe câu ngắn rồi chọn địa điểm được nhắc tới.</p><button type="button" data-hhe-speak="The English club meets in the library at four o'clock.">▶ Phát câu nghe</button><fieldset><legend>The English club meets in the…</legend>${["classroom", "library", "cafeteria"].map((answer) => `<label><input type="radio" name="answer" value="${answer}"><span>${answer}</span></label>`).join("")}</fieldset><button class="primary" type="submit">Kiểm tra bài nghe</button><output data-hhe-practice-feedback></output></form><form data-hhe-practice="reading" data-answer="bus"><header><span>02</span><div><small>READING</small><h3>Đọc lịch học ngắn</h3></div></header><blockquote>“Mai has an English class at 8 a.m. She goes to school by bus and studies with Lan.”</blockquote><fieldset><legend>How does Mai go to school?</legend>${["bike", "bus", "train"].map((answer) => `<label><input type="radio" name="answer" value="${answer}"><span>${answer}</span></label>`).join("")}</fieldset><button class="primary" type="submit">Kiểm tra đọc hiểu</button><output data-hhe-practice-feedback></output></form><form data-hhe-practice="grammar" data-answer="am"><header><span>03</span><div><small>GRAMMAR</small><h3>Chọn động từ “be”</h3></div></header><p>Dùng chủ ngữ để chọn đúng am, is hoặc are.</p><fieldset><legend>I ___ a first-year student.</legend>${["is", "am", "are"].map((answer) => `<label><input type="radio" name="answer" value="${answer}"><span>${answer}</span></label>`).join("")}</fieldset><button class="primary" type="submit">Kiểm tra ngữ pháp</button><output data-hhe-practice-feedback></output></form></div><section class="hhe-practice-more"><div><small>LUYỆN KỸ NĂNG MỞ RỘNG</small><h3>Từ nhận biết đến sử dụng</h3></div><button type="button" data-hhe-view="speaking">Luyện phát âm</button><button type="button" data-hhe-view="writing">Luyện viết</button><button type="button" data-hhe-view="vocabulary">Ôn flashcard</button></section></section>`;

  const lessonView = (state, lesson) => {
    const answers = state.attempts[lesson.id] || {};
    return `<section class="hhe-lesson" data-hhe-lesson="${lesson.id}"><header><button type="button" data-hhe-view="learn">← Lộ trình</button><div><small>A0 · ${lesson.minutes} PHÚT · +${lesson.xp} XP</small><h2>${escapeHtml(lesson.title)}</h2><p>${escapeHtml(lesson.canDo)}</p></div><span class="${state.completed[lesson.id] ? "done" : ""}">${state.completed[lesson.id] ? "Đã hoàn thành" : "Đang học"}</span></header>
      <div class="hhe-lesson-grid"><main><section class="hhe-objective"><small>CAN DO</small><strong>Sau bài này, bạn có thể:</strong><p>${escapeHtml(lesson.canDo)}</p></section>
      <section class="hhe-lesson-block"><header><span>01</span><div><small>TỪ VỰNG</small><h3>Nghe, đọc và lưu từ</h3></div><button type="button" data-hhe-speak="${escapeHtml(lesson.vocabulary.map((item) => item[0]).join(", "))}">▶ Nghe tất cả</button></header><div class="hhe-vocab-grid">${lesson.vocabulary.map((item) => `<article><div><strong>${escapeHtml(item[0])}</strong><span>${escapeHtml(item[1])}</span></div><p>${escapeHtml(item[2])}</p><small>${escapeHtml(item[3])}</small><footer><button type="button" title="Nghe phát âm" data-hhe-speak="${escapeHtml(item[0])}">♪</button><button type="button" class="${state.savedWords[item[0]] ? "saved" : ""}" data-hhe-save-word="${escapeHtml(item[0])}" data-hhe-word-json="${encodeURIComponent(JSON.stringify(item))}">${state.savedWords[item[0]] ? "★ Đã lưu" : "☆ Lưu từ"}</button></footer></article>`).join("")}</div></section>
      <section class="hhe-lesson-block"><header><span>02</span><div><small>NGỮ PHÁP</small><h3>Mẫu câu trọng tâm</h3></div></header><div class="hhe-grammar"><p>${escapeHtml(lesson.grammar)}</p><button type="button" data-hhe-speak="${escapeHtml(lesson.dialogue.replace(/\n/g, " "))}">▶ Nghe hội thoại</button></div><pre class="hhe-dialogue">${escapeHtml(lesson.dialogue)}</pre></section>
      <section class="hhe-lesson-block"><header><span>03</span><div><small>LUYỆN TẬP</small><h3>Hiểu câu trả lời của bạn</h3></div></header><form class="hhe-exercises" data-hhe-exercises>${lesson.exercises.map((question, index) => `<fieldset data-question="${question.id}"><legend><span>${index + 1}</span>${escapeHtml(question.prompt)}</legend>${question.type === "fill-in-the-blank" ? `<input type="text" name="${question.id}" value="${escapeHtml(answers[question.id] || "")}" autocomplete="off" placeholder="Nhập câu trả lời...">` : `<div>${question.options.map((option) => `<label><input type="radio" name="${question.id}" value="${escapeHtml(option)}" ${answers[question.id] === option ? "checked" : ""}><span>${escapeHtml(option)}</span></label>`).join("")}</div>`}<p data-feedback hidden></p></fieldset>`).join("")}<button class="primary" type="submit">Chấm bài và giải thích</button></form></section></main>
      <aside><section><small>TIẾN ĐỘ BÀI</small><strong data-hhe-lesson-progress>${state.completed[lesson.id] ? "100%" : "0%"}</strong><i data-hhe-lesson-progress-bar style="--p:${state.completed[lesson.id] ? 100 : 0}%"></i></section><section><small>HỌC HIỆU QUẢ</small><p>Nghe mẫu ít nhất hai lần, đọc thành tiếng, rồi mới làm bài tập.</p></section><section><small>QUYỀN RIÊNG TƯ</small><p>Tiến độ bài học được lưu trên thiết bị này.</p></section></aside></div></section>`;
  };

  const placementView = (state) => `<section class="hhe-placement"><header class="hhe-section-head"><div><small>16 CÂU · 10 PHÚT</small><h2>Kiểm tra trình độ miễn phí</h2><p>Kết quả A0–A2 sơ bộ, dùng để gợi ý điểm bắt đầu và không phải chứng chỉ được kiểm định.</p></div>${state.placement ? `<span>Kết quả gần nhất: ${state.placement.level}</span>` : ""}</header><form data-hhe-placement>${placementQuestions.map((question, index) => `<fieldset><legend><span>${String(index + 1).padStart(2, "0")}</span><div><small>${question[0]}</small>${escapeHtml(question[1])}</div>${question[4] ? `<button type="button" data-hhe-speak="${escapeHtml(question[4])}" aria-label="Nghe câu ${index + 1}">▶ Nghe</button>` : ""}</legend><div>${question[2].map((option, optionIndex) => `<label><input type="radio" name="placement-${index}" value="${optionIndex}"><span>${escapeHtml(option)}</span></label>`).join("")}</div></fieldset>`).join("")}<button class="primary" type="submit">Xem kết quả và lộ trình</button></form>${state.placement ? `<section class="hhe-result"><div><small>TRÌNH ĐỘ GỢI Ý</small><strong>${state.placement.level}</strong><span>${state.placement.score}/16 câu đúng</span></div><div><h3>${state.placement.level === "A0" ? "Hãy bắt đầu từ nền tảng" : state.placement.level === "A1" ? "Bạn đã có nền tảng cơ bản" : "Bạn sẵn sàng cho sơ trung cấp"}</h3><p>Điểm mạnh: ${state.placement.strength}. Cần cải thiện: ${state.placement.improve}.</p><button class="primary" type="button" data-hhe-view="learn">Mở lộ trình đề xuất</button></div></section>` : ""}</section>`;

  const vocabularyView = (state) => {
    const words = Object.values(state.savedWords); const due = words.filter((item) => !state.reviewQueue[item.word]?.dueAt || new Date(state.reviewQueue[item.word].dueAt) <= new Date());
    return `<section class="hhe-vocabulary"><header class="hhe-section-head"><div><small>PERSONAL WORD BANK</small><h2>Sổ từ và ôn thông minh</h2><p>Lưu từ từ bài học, đánh dấu mức nhớ và nhận lịch ôn tiếp theo.</p></div><span>${due.length} từ cần ôn</span></header>${words.length ? `<div class="hhe-review-card" data-hhe-review><div><small>ÔN TIẾP THEO</small><strong>${escapeHtml((due[0] || words[0]).word)}</strong><span>${escapeHtml((due[0] || words[0]).ipa)}</span><p data-hhe-review-answer hidden>${escapeHtml((due[0] || words[0]).meaning)}<br><small>${escapeHtml((due[0] || words[0]).example)}</small></p></div><button type="button" data-hhe-reveal>Hiện nghĩa</button><footer hidden>${[["again", "Quên"], ["hard", "Khó"], ["good", "Nhớ"], ["easy", "Rất dễ"]].map(([id, label]) => `<button type="button" data-hhe-rate="${id}" data-word="${escapeHtml((due[0] || words[0]).word)}">${label}</button>`).join("")}</footer></div><div class="hhe-word-list">${words.map((item) => `<article><button type="button" data-hhe-speak="${escapeHtml(item.word)}">♪</button><div><strong>${escapeHtml(item.word)}</strong><span>${escapeHtml(item.ipa)} · ${escapeHtml(item.meaning)}</span><small>${escapeHtml(item.example)}</small></div><button type="button" data-hhe-remove-word="${escapeHtml(item.word)}">Xóa</button></article>`).join("")}</div>` : `<div class="hhe-empty"><span>◇</span><h3>Sổ từ đang trống</h3><p>Mở một bài học và bấm “Lưu từ” để tạo bộ flashcard của riêng bạn.</p><button class="primary" type="button" data-hhe-view="learn">Khám phá bài học</button></div>`}</section>`;
  };

  const speakingView = (state) => `<section class="hhe-speaking"><header class="hhe-section-head"><div><small>PRONUNCIATION LAB</small><h2>Nghe mẫu, nói lại, tự đối chiếu</h2><p>Không tuyên bố chấm phát âm chính xác. Công cụ giúp bạn nghe, thu âm và xem transcript nếu trình duyệt hỗ trợ.</p></div></header><div class="hhe-speaking-grid"><section><small>CÂU LUYỆN HÔM NAY</small><h3 data-hhe-speaking-phrase>Hello, my name is Minh. Nice to meet you.</h3><p>/həˈloʊ, maɪ neɪm ɪz mɪn. naɪs tə miːt juː/</p><div><button class="primary" type="button" data-hhe-speak="Hello, my name is Minh. Nice to meet you.">▶ Nghe mẫu</button><button type="button" data-hhe-recognize>◉ Nhận dạng giọng nói</button></div><output data-hhe-transcript>Transcript sẽ xuất hiện tại đây.</output></section><section class="hhe-recorder"><div class="hhe-mic"><i></i><span>MIC</span></div><h3>Ghi âm riêng tư trên thiết bị</h3><p>Trình duyệt chỉ xin quyền micro khi bạn bấm ghi. Bản ghi không được tải lên máy chủ.</p><div><button class="primary" type="button" data-hhe-record>● Bắt đầu ghi</button><button type="button" data-hhe-stop disabled>■ Dừng</button><button type="button" data-hhe-delete-record disabled>Xóa</button></div><audio data-hhe-audio controls hidden></audio><small data-hhe-record-status>Sẵn sàng.</small></section></div></section>`;

  const writingView = (state) => `<section class="hhe-writing"><header class="hhe-section-head"><div><small>WRITING DESK</small><h2>Viết từng câu rõ ràng</h2><p>Bản nháp tự lưu trên thiết bị. Phản hồi hiện tại là checklist tự kiểm tra, không phải đánh giá của giáo viên.</p></div></header><div class="hhe-writing-grid"><aside><small>ĐỀ BÀI A0</small><h3>Introduce yourself</h3><p>Viết 4–6 câu giới thiệu tên, tuổi, nơi sống và một người trong gia đình.</p><ul><li>My name is…</li><li>I am … years old.</li><li>I live in…</li><li>This is my…</li></ul></aside><main><textarea data-hhe-writing placeholder="My name is...">${escapeHtml(state.writingDraft)}</textarea><footer><span><b data-hhe-word-count>${state.writingDraft.trim() ? state.writingDraft.trim().split(/\s+/).length : 0}</b> từ · Tự động lưu</span><div><button type="button" data-hhe-clear-writing>Xóa</button><button class="primary" type="button" data-hhe-submit-writing>Lưu bài viết</button></div></footer><section class="hhe-writing-check"><strong>Checklist trước khi lưu</strong><label><input type="checkbox"> Tôi viết hoa chữ đầu câu.</label><label><input type="checkbox"> Tôi dùng dấu chấm cuối câu.</label><label><input type="checkbox"> Tôi đã đọc lại thành tiếng.</label></section></main></div>${state.writingHistory.length ? `<section class="hhe-writing-history"><h3>Lịch sử bài viết</h3>${state.writingHistory.slice(0, 5).map((item) => `<article><span>${new Date(item.createdAt).toLocaleString("vi-VN")}</span><p>${escapeHtml(item.body)}</p><b>${item.words} từ · ${item.status}</b></article>`).join("")}</section>` : ""}</section>`;

  const progressView = (state) => {
    const done = completedCount(state); const activity = Array.from({ length: 7 }, (_, offset) => { const date = new Date(Date.now() - (6 - offset) * 86400000).toISOString().slice(0, 10); return [date, state.minutesByDay[date] || 0]; });
    const achievements = [
      ["first-step", "Bước đầu tiên", "Hoàn thành một bài học", done >= 1, `${Math.min(done, 1)}/1`],
      ["word-collector", "Nhà sưu tầm từ", "Lưu 5 từ vào sổ", Object.keys(state.savedWords).length >= 5, `${Math.min(Object.keys(state.savedWords).length, 5)}/5`],
      ["focused", "Học tập trung", "Đạt 100 XP", state.xp >= 100, `${Math.min(state.xp, 100)}/100 XP`],
      ["explorer", "Hiểu bản thân", "Hoàn thành bài xếp lớp", Boolean(state.placement), state.placement ? "Đã mở" : "Chưa mở"],
      ["writer", "Tác giả trẻ", "Lưu bài viết đầu tiên", state.writingHistory.length >= 1, `${Math.min(state.writingHistory.length, 1)}/1`],
      ["all-rounder", "Học toàn diện", "Hoàn thành 3 bài luyện kỹ năng", Object.values(state.practice).every((score) => score >= 100), `${Object.values(state.practice).filter((score) => score >= 100).length}/3`]
    ];
    const skillValues = [["Nghe", Math.max(done * 7, state.practice.listening)], ["Nói", done * 5], ["Đọc", Math.max(done * 7, state.practice.reading)], ["Viết", state.writingHistory.length * 18], ["Ngữ pháp", Math.max(done * 6, state.practice.grammar)]];
    return `<section class="hhe-progress"><header class="hhe-section-head"><div><small>LEARNER ANALYTICS</small><h2>Tiến bộ của bạn</h2><p>Số liệu được tính từ hoạt động đã lưu trên thiết bị này.</p></div><span>Cấp ${Math.floor(state.xp / 300) + 1}</span></header><div class="hhe-progress-cards"><article><span>Bài hoàn thành</span><strong>${done}/15</strong></article><article><span>XP tích lũy</span><strong>${state.xp}</strong></article><article><span>Chuỗi dài nhất</span><strong>${state.streak.longest} ngày</strong></article><article><span>Điểm xếp lớp</span><strong>${state.placement ? `${state.placement.score}/16` : "--"}</strong></article></div><section class="hhe-week"><header><h3>Hoạt động 7 ngày</h3><span>Mục tiêu ${state.dailyGoal} phút/ngày</span></header><div>${activity.map(([date, minutes]) => `<i style="--h:${Math.max(5, Math.min(100, minutes / state.dailyGoal * 100))}%"><b>${minutes}</b><span>${new Date(date).toLocaleDateString("vi-VN", { weekday: "short" })}</span></i>`).join("")}</div></section><section class="hhe-skill-progress">${skillValues.map(([label, value]) => `<div><span>${label}</span><i style="--p:${Math.min(100, value)}%"></i><b>${Math.min(100, value)}%</b></div>`).join("")}</section><section class="hhe-achievements"><header><div><small>THÀNH TÍCH</small><h3>Các cột mốc học tập</h3></div><span>${achievements.filter((item) => item[3]).length}/${achievements.length} đã mở</span></header><div>${achievements.map(([id, title, description, unlocked, progress]) => `<article class="${unlocked ? "unlocked" : "locked"}" data-achievement="${id}"><span>${unlocked ? "◆" : "◇"}</span><div><strong>${title}</strong><p>${description}</p></div><small>${progress}</small></article>`).join("")}</div></section></section>`;
  };

  const settingsView = (state) => `<section class="hhe-settings"><header class="hhe-section-head"><div><small>LEARNING PREFERENCES</small><h2>Cài đặt HH English</h2><p>Tùy chỉnh mục tiêu, tốc độ giọng đọc và dữ liệu học tập.</p></div></header><form data-hhe-settings><label><span>Bạn đang là<small>Giúp nội dung gợi ý phù hợp nhịp sống</small></span><select name="learnerType"><option value="student" ${state.settings.learnerType === "student" ? "selected" : ""}>Học sinh / sinh viên</option><option value="worker" ${state.settings.learnerType === "worker" ? "selected" : ""}>Người đi làm</option></select></label><label><span>Mục tiêu học<small>Hiển thị trong kế hoạch cá nhân</small></span><select name="goal">${["Giao tiếp hằng ngày", "Học tập và thi cử", "Du lịch", "Công việc", "Xây nền từ mất gốc"].map((goal) => `<option ${state.settings.goal === goal ? "selected" : ""}>${goal}</option>`).join("")}</select></label><label><span>Mục tiêu mỗi ngày<small>5–60 phút</small></span><input type="number" name="dailyGoal" min="5" max="60" step="5" value="${state.dailyGoal}"></label><label><span>Tốc độ giọng đọc<small>Chậm 0.6× · Bình thường 1×</small></span><input type="range" name="voiceRate" min="0.6" max="1.2" step="0.05" value="${state.settings.voiceRate}"><output>${state.settings.voiceRate}×</output></label><label><span>Giảm chuyển động<small>Tôn trọng khả năng tập trung</small></span><input type="checkbox" name="reducedMotion" ${state.settings.reducedMotion ? "checked" : ""}></label><button class="primary" type="submit">Lưu cài đặt</button></form><section class="hhe-data-tools"><div><h3>Dữ liệu cá nhân</h3><p>Xuất bản sao JSON hoặc nhập lại trên thiết bị khác.</p></div><button type="button" data-hhe-export>Xuất JSON</button><label>Nhập JSON<input type="file" accept="application/json" data-hhe-import></label><button class="danger" type="button" data-hhe-reset>Xóa toàn bộ dữ liệu học</button></section><section class="hhe-sources"><h3>Nguồn học miễn phí được tuyển chọn</h3><a href="https://learnenglish.britishcouncil.org/" target="_blank" rel="noopener">British Council · LearnEnglish</a><a href="https://learningenglish.voanews.com/" target="_blank" rel="noopener">VOA · Learning English</a><a href="https://www.coe.int/en/web/common-european-framework-reference-languages" target="_blank" rel="noopener">Council of Europe · CEFR</a><a href="https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API" target="_blank" rel="noopener">MDN · Web Speech API</a><a href="https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder" target="_blank" rel="noopener">MDN · MediaRecorder</a></section></section>`;

  const render = () => {
    if (!host) return;
    const state = readState(); let content = "";
    if (state.activeView === "learn") content = learnView(state);
    else if (state.activeView === "practice") content = practiceView(state);
    else if (state.activeView === "lesson") content = lessonView(state, getLesson(state.activeLesson));
    else if (state.activeView === "placement") content = placementView(state);
    else if (state.activeView === "vocabulary") content = vocabularyView(state);
    else if (state.activeView === "speaking") content = speakingView(state);
    else if (state.activeView === "writing") content = writingView(state);
    else if (state.activeView === "progress") content = progressView(state);
    else if (state.activeView === "settings") content = settingsView(state);
    else content = dashboardView(state);
    host.innerHTML = shell(state, content);
    host.querySelector("[data-hhe-app]")?.setAttribute("data-reduced-motion", String(Boolean(state.settings.reducedMotion)));
    host.querySelector("[data-hhe-writing]")?.addEventListener("input", onWritingInput);
    host.querySelector("[data-hhe-search]")?.addEventListener("input", onLessonSearch);
    host.querySelector('[name="voiceRate"]')?.addEventListener("input", (event) => { event.target.nextElementSibling.textContent = `${event.target.value}×`; });
    updateFocusClock();
  };

  const toast = (message, type = "success") => {
    const node = host?.querySelector("[data-hhe-toast]"); if (!node) return;
    node.textContent = message; node.dataset.type = type; node.classList.add("show"); clearTimeout(toast.timer); toast.timer = setTimeout(() => node.classList.remove("show"), 2800);
  };
  const downloadJson = (data) => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }); const link = document.createElement("a");
    link.href = URL.createObjectURL(blob); link.download = `hh-english-${todayKey()}.json`; link.click(); URL.revokeObjectURL(link.href);
  };
  const onWritingInput = (event) => {
    const state = readState(); state.writingDraft = event.target.value; writeState(state);
    const count = event.target.value.trim() ? event.target.value.trim().split(/\s+/).length : 0; host.querySelector("[data-hhe-word-count]").textContent = count;
  };
  const foldSearch = (value = "") => String(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
  const onLessonSearch = (event) => {
    const query = foldSearch(event.target.value); let visibleCount = 0;
    host.querySelectorAll("[data-hhe-unit]").forEach((unit) => {
      const unitMatches = foldSearch(unit.dataset.search).includes(query); let visibleLessons = 0;
      unit.querySelectorAll("[data-hhe-open-lesson]").forEach((lesson) => { const visible = !query || unitMatches || foldSearch(lesson.dataset.search).includes(query); lesson.hidden = !visible; visibleLessons += visible ? 1 : 0; });
      unit.hidden = visibleLessons === 0; visibleCount += visibleLessons;
    });
    const empty = host.querySelector("[data-hhe-search-empty]"); if (empty) empty.hidden = visibleCount > 0;
  };
  const handleKeydown = (event) => {
    if (event.key !== "/" || event.ctrlKey || event.metaKey || event.altKey) return;
    const target = event.target;
    if (target?.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target?.tagName || "")) return;
    const search = host?.querySelector("[data-hhe-search]");
    if (!search) return;
    event.preventDefault(); search.focus();
  };
  const updateFocusClock = () => {
    const clock = host?.querySelector("[data-hhe-focus-clock]"); if (clock) clock.textContent = formatFocusTime(focusSeconds);
    const button = host?.querySelector("[data-hhe-focus-start]"); if (button) button.textContent = focusTimer ? "Tạm dừng" : "Bắt đầu";
  };
  const toggleFocusTimer = () => {
    if (focusTimer) { clearInterval(focusTimer); focusTimer = null; updateFocusClock(); return; }
    focusTimer = setInterval(() => {
      focusSeconds -= 1; updateFocusClock();
      if (focusSeconds > 0) return;
      clearInterval(focusTimer); focusTimer = null; focusSeconds = 15 * 60;
      const state = readState(); state.xp += 30; state.minutesByDay[todayKey()] = (state.minutesByDay[todayKey()] || 0) + 15; updateStreak(state); writeState(state); render(); toast("Hoàn thành phiên tập trung · +30 XP");
    }, 1000);
    updateFocusClock();
  };
  const resetFocusTimer = () => { if (focusTimer) clearInterval(focusTimer); focusTimer = null; focusSeconds = 15 * 60; updateFocusClock(); };

  const handleClick = async (event) => {
    event.stopPropagation();
    const viewButton = event.target.closest("[data-hhe-view]");
    if (viewButton) { const state = readState(); state.activeView = viewButton.dataset.hheView; writeState(state); render(); return; }
    const lessonButton = event.target.closest("[data-hhe-open-lesson]");
    if (lessonButton) { const state = readState(); state.activeView = "lesson"; state.activeLesson = lessonButton.dataset.hheOpenLesson; writeState(state); render(); return; }
    const speakButton = event.target.closest("[data-hhe-speak]");
    if (speakButton) { if (!speak(speakButton.dataset.hheSpeak, readState().settings.voiceRate)) toast("Thiết bị này chưa hỗ trợ giọng đọc.", "error"); return; }
    const saveWord = event.target.closest("[data-hhe-save-word]");
    if (saveWord) { const state = readState(); const raw = JSON.parse(decodeURIComponent(saveWord.dataset.hheWordJson)); const word = raw[0]; if (state.savedWords[word]) delete state.savedWords[word]; else state.savedWords[word] = { word, ipa: raw[1], meaning: raw[2], example: raw[3], savedAt: new Date().toISOString() }; writeState(state); render(); toast(state.savedWords[word] ? "Đã lưu vào sổ từ." : "Đã bỏ từ khỏi sổ."); return; }
    const removeWord = event.target.closest("[data-hhe-remove-word]");
    if (removeWord) { const state = readState(); delete state.savedWords[removeWord.dataset.hheRemoveWord]; delete state.reviewQueue[removeWord.dataset.hheRemoveWord]; writeState(state); render(); return; }
    if (event.target.closest("[data-hhe-reveal]")) { host.querySelector("[data-hhe-review-answer]").hidden = false; host.querySelector("[data-hhe-review] footer").hidden = false; event.target.hidden = true; return; }
    const rating = event.target.closest("[data-hhe-rate]");
    if (rating) { const state = readState(); state.reviewQueue[rating.dataset.word] = scheduleReview(state.reviewQueue[rating.dataset.word], rating.dataset.hheRate); state.xp += 2; writeState(state); render(); toast("Đã lên lịch ôn tiếp theo."); return; }
    if (event.target.closest("[data-hhe-theme]")) { const state = readState(); state.settings.theme = state.settings.theme === "day" ? "night" : "day"; writeState(state); render(); return; }
    const studyDay = event.target.closest("[data-hhe-day]");
    if (studyDay) { const state = readState(); const day = Number(studyDay.dataset.hheDay); state.studyDays = state.studyDays.includes(day) ? state.studyDays.filter((item) => item !== day) : [...state.studyDays, day]; writeState(state); render(); toast(state.studyDays.includes(day) ? "Đã thêm ngày học." : "Đã chuyển thành ngày nghỉ."); return; }
    if (event.target.closest("[data-hhe-focus-start]")) { toggleFocusTimer(); return; }
    if (event.target.closest("[data-hhe-focus-reset]")) { resetFocusTimer(); return; }
    if (event.target.closest("[data-hhe-export]")) { downloadJson(readState()); return; }
    if (event.target.closest("[data-hhe-submit-writing]")) { const state = readState(); const body = state.writingDraft.trim(); if (!body) return toast("Hãy viết ít nhất một câu.", "error"); const words = body.split(/\s+/).length; state.writingHistory.unshift({ id: Date.now(), body, words, status: "pending", createdAt: new Date().toISOString() }); state.xp += Math.min(30, words); updateStreak(state); state.minutesByDay[todayKey()] = (state.minutesByDay[todayKey()] || 0) + 5; writeState(state); render(); toast("Đã lưu bài viết trên thiết bị."); return; }
    if (event.target.closest("[data-hhe-clear-writing]")) { const state = readState(); state.writingDraft = ""; writeState(state); render(); return; }
    if (event.target.closest("[data-hhe-reset]")) { if (!confirm("Xóa toàn bộ tiến độ HH English trên thiết bị này?")) return; localStorage.removeItem(STORAGE_KEY); render(); return; }
    if (event.target.closest("[data-hhe-recognize]")) { startRecognition(); return; }
    if (event.target.closest("[data-hhe-record]")) { await startRecording(); return; }
    if (event.target.closest("[data-hhe-stop]")) { mediaRecorder?.stop(); return; }
    if (event.target.closest("[data-hhe-delete-record]")) { if (recordingUrl) URL.revokeObjectURL(recordingUrl); recordingUrl = ""; const audio = host.querySelector("[data-hhe-audio]"); audio.hidden = true; audio.removeAttribute("src"); event.target.disabled = true; toast("Đã xóa bản ghi."); }
  };

  const handleSubmit = (event) => {
    event.stopPropagation();
    const exerciseForm = event.target.closest("[data-hhe-exercises]");
    if (exerciseForm) { event.preventDefault(); const state = readState(); const lesson = getLesson(exerciseForm.closest("[data-hhe-lesson]").dataset.hheLesson); let correct = 0; state.attempts[lesson.id] = state.attempts[lesson.id] || {};
      lesson.exercises.forEach((question) => { const field = exerciseForm.querySelector(`[data-question="${question.id}"]`); const input = exerciseForm.elements[question.id]; const value = input instanceof RadioNodeList ? input.value : input?.value || ""; state.attempts[lesson.id][question.id] = value; const ok = normalize(value) === normalize(question.answer); correct += ok ? 1 : 0; field.classList.toggle("correct", ok); field.classList.toggle("wrong", !ok); const feedback = field.querySelector("[data-feedback]"); feedback.hidden = false; feedback.innerHTML = `<strong>${ok ? "Chính xác" : `Đáp án: ${escapeHtml(question.answer)}`}</strong><span>${escapeHtml(question.explanation)}</span>`; });
      if (correct >= 4 && !state.completed[lesson.id]) { state.completed[lesson.id] = true; state.xp += lesson.xp; updateStreak(state); state.minutesByDay[todayKey()] = (state.minutesByDay[todayKey()] || 0) + lesson.minutes; const status = host.querySelector(".hhe-lesson>header>span"); if (status) { status.textContent = "Đã hoàn thành"; status.classList.add("done"); } const progress = host.querySelector("[data-hhe-lesson-progress]"); if (progress) progress.textContent = "100%"; host.querySelector("[data-hhe-lesson-progress-bar]")?.style.setProperty("--p", "100%"); const xp = host.querySelector("[data-hhe-xp]"); if (xp) xp.textContent = state.xp; toast(`Hoàn thành ${correct}/5 · +${lesson.xp} XP`); }
      else toast(correct >= 4 ? `Bạn đã hoàn thành trước đó · ${correct}/5` : `${correct}/5 đúng. Đọc giải thích rồi thử lại.`, correct >= 4 ? "success" : "error"); writeState(state); return; }
    const practiceForm = event.target.closest("[data-hhe-practice]");
    if (practiceForm) { event.preventDefault(); const skill = practiceForm.dataset.hhePractice; const answer = new FormData(practiceForm).get("answer") || ""; const correct = normalize(answer) === normalize(practiceForm.dataset.answer); const feedback = practiceForm.querySelector("[data-hhe-practice-feedback]"); const explanations = { listening: "Câu nghe nói câu lạc bộ gặp tại library lúc 4 giờ.", reading: "Đoạn văn ghi rõ Mai goes to school by bus.", grammar: "Chủ ngữ I luôn đi với am ở thì hiện tại của động từ be." }; feedback.className = correct ? "correct" : "wrong"; feedback.innerHTML = `<strong>${correct ? "Chính xác" : `Đáp án đúng: ${escapeHtml(practiceForm.dataset.answer)}`}</strong><span>${explanations[skill]}</span>`; const state = readState(); if (correct && state.practice[skill] < 100) { state.practice[skill] = 100; state.xp += 10; state.minutesByDay[todayKey()] = (state.minutesByDay[todayKey()] || 0) + 3; updateStreak(state); writeState(state); const xp = host.querySelector("[data-hhe-xp]"); if (xp) xp.textContent = state.xp; toast("Hoàn thành bài luyện · +10 XP"); } else toast(correct ? "Bạn đã hoàn thành bài luyện này." : "Chưa đúng. Hãy đọc giải thích rồi thử lại.", correct ? "success" : "error"); return; }
    const placementForm = event.target.closest("[data-hhe-placement]");
    if (placementForm) { event.preventDefault(); const answers = placementQuestions.map((_, index) => placementForm.elements[`placement-${index}`]?.value); if (answers.filter((value) => value !== "").length < placementQuestions.length) return toast("Hãy trả lời đủ 16 câu.", "error"); const score = scoreAnswers(placementQuestions, answers); const skillScores = [0, 5, 10, 13, 16].slice(0, -1).map((start, index) => ({ label: ["từ vựng", "ngữ pháp", "đọc hiểu", "nghe hiểu"][index], score: answers.slice(start, [5, 10, 13, 16][index]).reduce((sum, value, offset) => sum + (Number(value) === placementQuestions[start + offset][3] ? 1 : 0), 0), total: [5, 5, 3, 3][index] })); const strongest = [...skillScores].sort((a, b) => b.score / b.total - a.score / a.total)[0]; const weakest = [...skillScores].sort((a, b) => a.score / a.total - b.score / b.total)[0]; const state = readState(); state.placement = { score, level: levelFromScore(score / 16 * 100), strength: strongest.label, improve: weakest.label, takenAt: new Date().toISOString() }; state.xp += 25; writeState(state); render(); toast("Đã hoàn tất bài kiểm tra."); return; }
    const settingsForm = event.target.closest("[data-hhe-settings]");
    if (settingsForm) { event.preventDefault(); const state = readState(); state.dailyGoal = Math.max(5, Math.min(60, Number(settingsForm.dailyGoal.value) || 15)); state.settings.learnerType = settingsForm.learnerType.value; state.settings.goal = settingsForm.goal.value; state.settings.voiceRate = Number(settingsForm.voiceRate.value); state.settings.reducedMotion = settingsForm.reducedMotion.checked; writeState(state); render(); toast("Đã lưu cài đặt."); }
  };

  const startRecognition = () => {
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const output = host.querySelector("[data-hhe-transcript]");
    if (!Recognition) { output.textContent = "Trình duyệt chưa hỗ trợ nhận dạng giọng nói. Bạn vẫn có thể dùng phần ghi âm bên cạnh."; return; }
    const recognition = new Recognition(); recognition.lang = "en-US"; recognition.interimResults = true; recognition.continuous = false;
    output.textContent = "Đang nghe… Âm thanh có thể được trình duyệt gửi tới dịch vụ nhận dạng của nhà cung cấp.";
    recognition.onresult = (event) => { output.textContent = Array.from(event.results).map((result) => result[0].transcript).join(" "); };
    recognition.onerror = (event) => { output.textContent = `Không thể nhận dạng: ${event.error}. Hãy kiểm tra quyền micro.`; };
    recognition.start();
  };
  const startRecording = async () => {
    const status = host.querySelector("[data-hhe-record-status]");
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) { status.textContent = "Thiết bị chưa hỗ trợ ghi âm trong trình duyệt."; return; }
    try { const stream = await navigator.mediaDevices.getUserMedia({ audio: true }); recordedChunks = []; mediaRecorder = new MediaRecorder(stream); mediaRecorder.ondataavailable = (event) => { if (event.data.size) recordedChunks.push(event.data); }; mediaRecorder.onstop = () => { stream.getTracks().forEach((track) => track.stop()); const blob = new Blob(recordedChunks, { type: mediaRecorder.mimeType || "audio/webm" }); if (recordingUrl) URL.revokeObjectURL(recordingUrl); recordingUrl = URL.createObjectURL(blob); const audio = host.querySelector("[data-hhe-audio]"); audio.src = recordingUrl; audio.hidden = false; host.querySelector("[data-hhe-delete-record]").disabled = false; host.querySelector("[data-hhe-record]").disabled = false; host.querySelector("[data-hhe-stop]").disabled = true; status.textContent = "Đã ghi xong. Hãy nghe lại trước khi xóa hoặc thu lại."; }; mediaRecorder.start(); host.querySelector("[data-hhe-record]").disabled = true; host.querySelector("[data-hhe-stop]").disabled = false; status.textContent = "Đang ghi…"; }
    catch (error) { status.textContent = error.name === "NotAllowedError" ? "Bạn chưa cho phép dùng micro." : `Không thể ghi âm: ${error.message}`; }
  };

  const handleChange = async (event) => {
    event.stopPropagation();
    if (!event.target.matches("[data-hhe-import]")) return;
    const file = event.target.files?.[0]; if (!file || file.size > 2 * 1024 * 1024) return toast("Tệp JSON không hợp lệ hoặc lớn hơn 2 MB.", "error");
    try { const data = JSON.parse(await file.text()); if (typeof data !== "object" || data.version !== APP_VERSION) throw new Error("Sai phiên bản dữ liệu"); writeState({ ...defaultState(), ...data }); render(); toast("Đã nhập dữ liệu HH English."); } catch (error) { toast(`Không thể nhập: ${error.message}`, "error"); }
  };

  const mount = (target, options = {}) => {
    const validViews = new Set(navItems.map(([id]) => id));
    if (validViews.has(options.view)) {
      const state = readState(); state.activeView = options.view; writeState(state);
    }
    host = target; host.removeEventListener("click", handleClick); host.removeEventListener("submit", handleSubmit); host.removeEventListener("change", handleChange);
    root.document?.removeEventListener("keydown", handleKeydown);
    host.addEventListener("click", handleClick); host.addEventListener("submit", handleSubmit); host.addEventListener("change", handleChange); root.document?.addEventListener("keydown", handleKeydown); render();
  };
  const unmount = () => { root.document?.removeEventListener("keydown", handleKeydown); root.speechSynthesis?.cancel?.(); if (focusTimer) clearInterval(focusTimer); focusTimer = null; if (mediaRecorder?.state === "recording") mediaRecorder.stop(); host = null; };

  root.HHEnglish = { mount, unmount, courses, scheduleReview, scoreAnswers, levelFromScore };
  if (typeof module !== "undefined" && module.exports) module.exports = { courses, scheduleReview, scoreAnswers, levelFromScore, normalize };
})();
