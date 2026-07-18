(() => {
  "use strict";

  const root = typeof window !== "undefined" ? window : globalThis;
  const STORAGE_KEY = "hh.english.state.v1";
  const APP_VERSION = 1;
  const todayKey = (now = Date.now()) => new Date(now).toISOString().slice(0, 10);
  const escapeHtml = (value = "") => String(value).replace(/[&<>"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[char]);
  const normalize = (value = "") => String(value).trim().toLowerCase().replace(/[.!?,;:]/g, "").replace(/\s+/g, " ");

  const voiceProfiles = [
    { id: "us-female", lang: "en-US", gender: "female", flag: "US", label: "Nữ · Anh-Mỹ", detail: "Rõ, sáng, phù hợp hội thoại" },
    { id: "us-male", lang: "en-US", gender: "male", flag: "US", label: "Nam · Anh-Mỹ", detail: "Trầm, rõ, phù hợp thuyết trình" },
    { id: "gb-female", lang: "en-GB", gender: "female", flag: "UK", label: "Nữ · Anh-Anh", detail: "Nhịp chuẩn Anh, âm cuối rõ" },
    { id: "gb-male", lang: "en-GB", gender: "male", flag: "UK", label: "Nam · Anh-Anh", detail: "Giọng Anh tự nhiên, cân bằng" },
    { id: "au-female", lang: "en-AU", gender: "female", flag: "AU", label: "Nữ · Anh-Úc", detail: "Luyện nghe biến thể quốc tế" },
    { id: "au-male", lang: "en-AU", gender: "male", flag: "AU", label: "Nam · Anh-Úc", detail: "Mở rộng khả năng nghe thực tế" },
    { id: "in-female", lang: "en-IN", gender: "female", flag: "IN", label: "Nữ · Anh-Ấn", detail: "Hữu ích cho môi trường toàn cầu" },
    { id: "in-male", lang: "en-IN", gender: "male", flag: "IN", label: "Nam · Anh-Ấn", detail: "Làm quen nhiều chất giọng" }
  ];
  const femaleVoiceHints = ["aria", "ava", "emma", "hazel", "jenny", "joanna", "karen", "kendra", "kimberly", "linda", "moira", "natasha", "olivia", "salli", "samantha", "serena", "sonia", "susan", "tessa", "victoria", "zira", "female", "woman"];
  const maleVoiceHints = ["alex", "arthur", "brian", "daniel", "david", "fred", "george", "guy", "james", "joey", "justin", "liam", "mark", "matthew", "oliver", "ryan", "thomas", "male", "man"];
  const inferVoiceGender = (voice = {}) => {
    const haystack = `${voice.name || ""} ${voice.voiceURI || ""}`.toLowerCase();
    if (femaleVoiceHints.some((hint) => haystack.includes(hint))) return "female";
    if (maleVoiceHints.some((hint) => haystack.includes(hint))) return "male";
    return "unknown";
  };
  const voiceProfileById = (id) => voiceProfiles.find((profile) => profile.id === id) || voiceProfiles[0];
  const englishVoices = () => {
    try { return Array.from(root.speechSynthesis?.getVoices?.() || []).filter((voice) => /^en(?:-|_)/i.test(voice.lang || "")); }
    catch { return []; }
  };
  const rankVoice = (voice, settings = {}) => {
    const profile = voiceProfileById(settings.voiceProfile);
    const voiceLang = String(voice.lang || "").replace("_", "-").toLowerCase();
    const targetLang = profile.lang.toLowerCase();
    let score = 0;
    if (settings.voiceURI && voice.voiceURI === settings.voiceURI) score += 1000;
    if (voiceLang === targetLang) score += 120;
    else if (voiceLang.startsWith(targetLang.slice(0, 2))) score += 35;
    if (inferVoiceGender(voice) === profile.gender) score += 45;
    if (voice.localService) score += 6;
    if (voice.default) score += 3;
    return score;
  };
  const selectVoice = (voices = [], settings = {}) => [...voices].sort((a, b) => rankVoice(b, settings) - rankVoice(a, settings))[0] || null;
  const compareTranscript = (spoken = "", target = "") => {
    const expected = normalize(target).split(" ").filter(Boolean);
    const actual = normalize(spoken).split(" ").filter(Boolean);
    if (!expected.length) return { score: 0, matched: [], missed: [] };
    const pool = [...actual]; const matched = []; const missed = [];
    expected.forEach((word) => { const index = pool.indexOf(word); if (index >= 0) { matched.push(word); pool.splice(index, 1); } else missed.push(word); });
    return { score: Math.round(matched.length / expected.length * 100), matched, missed };
  };

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
  const a0Courses = unitSpecs.map((unit, unitIndex) => ({
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
      return { id, level: "A0", unitId: unit.id, primarySkill: unitIndex === 0 ? "pronunciation" : unitIndex === 1 ? "speaking" : unitIndex === 2 ? "listening" : unitIndex === 3 ? "reading" : "vocabulary", title: lesson[0], canDo: lesson[1], grammar: lesson[2].trim(), dialogue: lesson[3], vocabulary, exercises, minutes: 10 + lessonIndex * 2, xp: 50 };
    })
  }));

  const extendedCurriculum = (() => {
    if (root.HHEnglishCurriculum) return root.HHEnglishCurriculum;
    if (typeof require === "function") {
      try { return require("./english-curriculum.js"); } catch { return { levels: [] }; }
    }
    return { levels: [] };
  })();
  const careerCurriculum = (() => {
    if (root.HHEnglishCareerCurriculum) return root.HHEnglishCareerCurriculum;
    if (typeof require === "function") {
      try { return require("./english-career-curriculum.js"); } catch { return { categories: [], tracks: [] }; }
    }
    return { categories: [], tracks: [] };
  })();
  const a0Level = {
    id: "A0", name: "Mất gốc", band: "Foundation", color: "#63e8ff",
    description: "Xây lại bảng chữ cái, âm, câu chào hỏi và vốn từ thiết yếu từ con số 0.",
    canDo: "Nhận diện âm và từ nền tảng, giới thiệu bản thân và xử lý những trao đổi đầu tiên.",
    writing: { title: "Introduce yourself", description: "Viết 4–6 câu giới thiệu tên, tuổi, nơi sống và một người trong gia đình.", hints: ["My name is…", "I am … years old.", "I live in…", "This is my…"] },
    speaking: { phrase: "Hello, my name is Minh. Nice to meet you.", ipa: "/həˈloʊ, maɪ neɪm ɪz mɪn. naɪs tə miːt juː/" },
    units: a0Courses
  };
  const courseLevels = [a0Level, ...(extendedCurriculum.levels || [])];
  courseLevels.slice(1).forEach((level) => level.units.forEach((unit) => unit.lessons.forEach((lesson) => lessonIds.push(lesson.id))));
  const courses = courseLevels.flatMap((level) => level.units);
  const careerCategories = careerCurriculum.categories || [];
  const careerTracks = careerCurriculum.tracks || [];
  const careerLessons = careerTracks.flatMap((item) => item.lessons);
  careerLessons.forEach((lesson) => lessonIds.push(lesson.id));
  const allLessons = [...courses.flatMap((unit) => unit.lessons), ...careerLessons];
  const levelOrder = courseLevels.map((level) => level.id);
  const levelById = (id = "A0") => courseLevels.find((level) => level.id === id) || a0Level;
  const careerTrackById = (id) => careerTracks.find((item) => item.id === id) || careerTracks[0];

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
    ["Listening", "Nghe câu mẫu rồi chọn vị trí đúng.", ["On the table", "Under the chair", "In the bag"], 0, "The book is on the table."],
    ["Vocabulary", "A reliable source is one that is…", ["trustworthy", "colourful", "temporary"], 0],
    ["Grammar", "If I ___ more time, I would join the course.", ["had", "have", "will have"], 0],
    ["Reading", "“The café was busy, yet the staff remained calm and attentive.” What impressed the writer?", ["The staff's behaviour", "The size of the café", "The low prices"], 0],
    ["Listening", "Nghe và chọn ý kiến của người nói.", ["The schedule should be more flexible.", "The course should be cancelled.", "The current schedule is perfect."], 0, "The course is useful, but I wish the schedule were more flexible."],
    ["Grammar", "Hardly ___ the presentation begun when the power failed.", ["had", "has", "did"], 0],
    ["Vocabulary", "A biased report is most likely to be…", ["unfairly influenced", "carefully balanced", "fully confidential"], 0],
    ["Reading", "“Although the figures look promising, the sample is too narrow to justify a national policy.” What is the writer's position?", ["Cautiously unconvinced", "Completely supportive", "Entirely uninterested"], 0],
    ["Listening", "Nghe và xác định thái độ của người nói.", ["Cautious optimism", "Open hostility", "Complete certainty"], 0, "The early results are encouraging, although we should avoid drawing firm conclusions just yet."],
    ["Grammar", "Not only ___ the evidence incomplete, but the method was also poorly documented.", ["was", "the evidence was", "did"], 0],
    ["Use of English", "The committee failed to take the long-term costs ___ account.", ["into", "under", "across"], 0],
    ["Reading", "“His praise was so lavish that it sounded less like admiration than a carefully disguised warning.” What is implied?", ["The praise may be ironic.", "The praise is unquestionably sincere.", "No warning is present."], 0],
    ["Listening", "Nghe và chọn cách diễn giải chính xác nhất.", ["The two findings differ because they address different questions.", "One finding proves the other is false.", "Neither finding contains useful evidence."], 0, "The findings appear contradictory only if we assume they measure the same thing; in fact, each addresses a distinct question."]
  ];

  const defaultState = () => ({
    version: APP_VERSION, activeView: "dashboard", activeLesson: lessonIds[0], completed: {}, attempts: {}, savedWords: {}, reviewQueue: {}, xp: 0,
    streak: { current: 0, longest: 0, lastDate: "" }, dailyGoal: 15, studyDays: [1, 2, 3, 4, 5], minutesByDay: {}, placement: null, placementRewarded: false, selectedLevel: "A0", selectedCareer: careerTracks[0]?.id || "", careerSurvey: null, careerSurveyRewarded: false, favoriteCareers: [], writingDraft: "", writingDrafts: {}, writingHistory: [], practice: { listening: 0, reading: 0, grammar: 0 }, practiceByLevel: {},
    onboarding: { completed: false, dismissed: false, rewarded: false, completedAt: "" },
    learnerProfile: { confidence: "", focusSkill: "speaking", needsPlacement: false },
    careerProfile: { roleStage: "student", skillFocus: "speaking", intensity: "foundation" },
    settings: { voiceRate: 0.85, voicePitch: 1, voiceProfile: "us-female", voiceURI: "", interfaceLanguage: "vi", reducedMotion: false, beginnerMode: true, theme: "night", learnerType: "student", goal: "Giao tiếp hằng ngày" },
    speakingScenario: "workplace", speakingAttempts: []
  });
  const mergeState = (stored = {}) => {
    const fallback = defaultState();
    return {
      ...fallback,
      ...stored,
      streak: { ...fallback.streak, ...(stored.streak || {}) },
      practice: { ...fallback.practice, ...(stored.practice || {}) },
      practiceByLevel: { ...(stored.practiceByLevel || {}) },
      writingDrafts: { ...(stored.writingDrafts || {}) },
      onboarding: { ...fallback.onboarding, ...(stored.onboarding || {}) },
      learnerProfile: { ...fallback.learnerProfile, ...(stored.learnerProfile || {}) },
      careerProfile: { ...fallback.careerProfile, ...(stored.careerProfile || {}) },
      settings: { ...fallback.settings, ...(stored.settings || {}) }
    };
  };
  const readState = () => {
    try {
      const fallback = defaultState(); const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
      const state = mergeState(stored);
      if (!levelOrder.includes(state.selectedLevel)) state.selectedLevel = levelOrder.includes(state.placement?.level) ? state.placement.level : "A0";
      if (!careerTracks.some((item) => item.id === state.selectedCareer)) state.selectedCareer = careerTracks[0]?.id || "";
      if (!Array.isArray(state.favoriteCareers)) state.favoriteCareers = [];
      if (!state.practiceByLevel.A0) state.practiceByLevel.A0 = { ...fallback.practice, ...state.practice };
      if (!state.writingDrafts.A0 && state.writingDraft) state.writingDrafts.A0 = state.writingDraft;
      return state;
    } catch { return defaultState(); }
  };
  const writeState = (state) => localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...state, version: APP_VERSION }));
  const getLesson = (id) => allLessons.find((lesson) => lesson.id === id) || courses[0].lessons[0];
  const selectedLevelId = (state) => levelOrder.includes(state.selectedLevel) ? state.selectedLevel : "A0";
  const levelLessonIds = (levelId) => levelById(levelId).units.flatMap((unit) => unit.lessons.map((lesson) => lesson.id));
  const completedCount = (state, levelId = null) => (levelId ? levelLessonIds(levelId) : lessonIds).filter((id) => state.completed?.[id]).length;
  const levelFromScore = (score) => score < 18 ? "A0" : score < 32 ? "A1" : score < 48 ? "A2" : score < 64 ? "B1" : score < 78 ? "B2" : score < 90 ? "C1" : "C2";
  const levelProgress = (state, levelId) => {
    const ids = levelLessonIds(levelId); return ids.length ? Math.round(completedCount(state, levelId) / ids.length * 100) : 0;
  };
  const levelPractice = (state, levelId = selectedLevelId(state)) => ({ listening: 0, reading: 0, grammar: 0, ...(state.practiceByLevel?.[levelId] || (levelId === "A0" ? state.practice : {})) });
  const writingDraftFor = (state, levelId = selectedLevelId(state)) => state.writingDrafts?.[levelId] || (levelId === "A0" ? state.writingDraft : "") || "";
  const selectedCareerId = (state) => careerTrackById(state.selectedCareer)?.id || careerTracks[0]?.id || "";
  const careerCompletedCount = (state, trackId) => careerTrackById(trackId)?.lessons.filter((lesson) => state.completed?.[lesson.id]).length || 0;
  const careerProgress = (state, trackId) => {
    const item = careerTrackById(trackId); return item?.lessons.length ? Math.round(careerCompletedCount(state, trackId) / item.lessons.length * 100) : 0;
  };
  const nextCareerLesson = (state, trackId = selectedCareerId(state)) => {
    const item = careerTrackById(trackId); if (!item) return getLesson();
    return item.lessons.find((lesson) => !state.completed?.[lesson.id]) || item.lessons[0];
  };
  const skillLabels = { listening: "Nghe", speaking: "Nói", reading: "Đọc", writing: "Viết", grammar: "Ngữ pháp", vocabulary: "Từ vựng" };
  const careerStageLabels = { student: "Đang học / khám phá nghề", starter: "Mới vào nghề", specialist: "Đang làm chuyên môn", manager: "Quản lý / dẫn dắt" };
  const careerIntensityLabels = { foundation: "Nền tảng dễ dùng", balanced: "Cân bằng thực hành", advanced: "Chuyên sâu nghề nghiệp" };
  const rotateOptions = (items, offset = 0) => {
    if (!items.length) return [];
    const safeOffset = ((offset % items.length) + items.length) % items.length;
    return [...items.slice(safeOffset), ...items.slice(0, safeOffset)];
  };
  const selectCareerVocabulary = (input = {}, trackId, day = 1, count = 8) => {
    const state = mergeState(input);
    const trackItem = careerTrackById(trackId || selectedCareerId(state));
    if (!trackItem) return [];
    const profile = state.careerProfile || {};
    const preferredTiers = {
      student: ["foundation", "specialist"],
      starter: ["foundation", "specialist"],
      specialist: ["specialist", "leadership"],
      manager: ["leadership", "specialist"]
    }[profile.roleStage] || ["foundation", "specialist"];
    if (profile.intensity === "advanced") preferredTiers.unshift("leadership");
    if (profile.intensity === "foundation") preferredTiers.unshift("foundation");
    const dueWords = new Set(dueVocabulary(state).map((item) => String(item.word || "").toLowerCase()));
    return trackItem.vocabulary.map((entry, index) => {
      const metadata = entry[4] || {};
      const tierIndex = preferredTiers.indexOf(metadata.tier);
      const stageMatch = metadata.stages?.includes(profile.roleStage);
      const skillMatch = metadata.skills?.includes(profile.skillFocus);
      const reviewBoost = dueWords.has(String(entry[0]).toLowerCase());
      const dayDistance = Math.abs((index % 7) - ((Math.max(1, Number(day)) - 1) % 7));
      const score = (tierIndex === 0 ? 34 : tierIndex === 1 ? 18 : 0)
        + (stageMatch ? 24 : 0)
        + (skillMatch ? 28 : 0)
        + (reviewBoost ? 40 : 0)
        + Math.max(0, 8 - dayDistance)
        + (metadata.source === "field" ? 5 : 10);
      return { entry, index, score };
    }).sort((a, b) => b.score - a.score || a.index - b.index)
      .slice(0, Math.max(1, Math.min(Number(count) || 8, trackItem.vocabulary.length)))
      .map(({ entry }) => entry);
  };
  const buildAdaptiveCareerExercises = (lesson, trackItem, vocabulary, state) => {
    const meaningPool = Array.from(new Set(trackItem.vocabulary.map((entry) => entry[2])));
    const questions = vocabulary.slice(0, 4).map((entry, index) => {
      const distractors = meaningPool.filter((meaning) => meaning !== entry[2]).slice(index * 2, index * 2 + 2);
      return {
        id: `${lesson.id}-adaptive-${index + 1}`,
        type: "multiple-choice",
        prompt: `Trong ${trackItem.viName}, “${entry[0]}” có nghĩa gần nhất là gì?`,
        answer: entry[2],
        options: rotateOptions([entry[2], ...distractors], index),
        explanation: `“${entry[0]}” là ${entry[2]}. Từ này được chọn vì phù hợp với ${careerStageLabels[state.careerProfile.roleStage].toLowerCase()} và trọng tâm ${skillLabels[state.careerProfile.skillFocus].toLowerCase()}.`,
        points: 20
      };
    });
    const actionAnswer = state.careerProfile.roleStage === "manager"
      ? "Tóm tắt quyết định, phân công trách nhiệm và xác nhận bước tiếp theo."
      : state.careerProfile.roleStage === "specialist"
        ? "Giải thích bằng chứng, rủi ro và đề xuất chuyên môn rõ ràng."
        : "Nêu bối cảnh, hỏi lại khi chưa rõ và xác nhận việc cần làm.";
    questions.push({
      id: `${lesson.id}-adaptive-action`,
      type: "multiple-choice",
      prompt: "Cách giao tiếp nào phù hợp nhất với vai trò hiện tại của bạn?",
      answer: actionAnswer,
      options: rotateOptions([
        actionAnswer,
        "Dùng thật nhiều thuật ngữ nhưng không kiểm tra người nghe đã hiểu.",
        "Bỏ qua bối cảnh và chỉ đưa ra kết luận ngắn."
      ], Number(lesson.day || 1) % 3),
      explanation: "Bài học thích ứng ưu tiên hành động giao tiếp phù hợp vai trò, có bối cảnh và bước tiếp theo rõ ràng.",
      points: 20
    });
    return questions;
  };
  const personalizeCareerLesson = (input = {}, sourceLesson) => {
    const state = mergeState(input);
    if (!sourceLesson?.isCareer) return sourceLesson;
    const trackItem = careerTrackById(sourceLesson.trackId);
    if (!trackItem) return sourceLesson;
    const vocabulary = selectCareerVocabulary(state, trackItem.id, sourceLesson.day, 8);
    const terms = vocabulary.slice(0, 3).map((entry) => entry[0]);
    const role = careerStageLabels[state.careerProfile.roleStage] || careerStageLabels.student;
    const focus = skillLabels[state.careerProfile.skillFocus] || skillLabels.speaking;
    const dialogue = state.careerProfile.roleStage === "manager"
      ? `Team lead: We need to ${trackItem.task}.\nManager: I will review the ${terms[0]}, assign ownership for the ${terms[1]} and confirm the ${terms[2]}.\nTeam lead: Please summarise the decision, risk and next checkpoint.`
      : `Colleague: We need to ${trackItem.task} today.\nLearner: I will check the ${terms[0]} and ask about the ${terms[1]} before I handle the ${terms[2]}.\nColleague: Good. Please confirm what you understood and the next action.`;
    return {
      ...sourceLesson,
      title: `${sourceLesson.title.split(":")[0]}: ${trackItem.name} · ${focus}`,
      canDo: `${sourceLesson.canDo} Nội dung được điều chỉnh cho ${role.toLowerCase()}, ưu tiên kỹ năng ${focus.toLowerCase()}.`,
      grammar: `${sourceLesson.grammar} Adaptive focus: use clear language for ${role.toLowerCase()} and ${focus.toLowerCase()}.`,
      dialogue,
      vocabulary,
      exercises: buildAdaptiveCareerExercises(sourceLesson, trackItem, vocabulary, state),
      adaptive: true,
      adaptiveRationale: `${role} · ${focus} · ${careerIntensityLabels[state.careerProfile.intensity] || careerIntensityLabels.foundation}`
    };
  };
  const lessonForState = (state, id) => personalizeCareerLesson(state, getLesson(id));
  const dueVocabulary = (state, now = Date.now()) => Object.values(state.savedWords || {}).filter((item) => {
    const record = state.reviewQueue?.[item.word];
    return !record?.dueAt || new Date(record.dueAt).getTime() <= now;
  });
  const weakSkillFor = (state) => {
    const wrongBySkill = {};
    allLessons.forEach((lesson) => {
      const answers = state.attempts?.[lesson.id];
      if (!answers) return;
      lesson.exercises.forEach((question) => {
        if (!(question.id in answers) || normalize(answers[question.id]) === normalize(question.answer)) return;
        const skill = lesson.primarySkill || "grammar";
        wrongBySkill[skill] = (wrongBySkill[skill] || 0) + 1;
      });
    });
    const fromErrors = Object.entries(wrongBySkill).sort((a, b) => b[1] - a[1])[0]?.[0];
    if (fromErrors) return fromErrors;
    const preferred = state.learnerProfile?.focusSkill;
    if (skillLabels[preferred]) return preferred;
    const practice = levelPractice(state);
    return Object.entries(practice).sort((a, b) => a[1] - b[1])[0]?.[0] || "speaking";
  };
  const beginnerChecklist = (input = {}, now = Date.now()) => {
    const state = mergeState(input);
    const anyPractice = Object.values(levelPractice(state)).some((score) => score >= 100);
    return [
      { id: "profile", title: "Chọn mục tiêu học", detail: "Để HH English biết bạn cần gì.", done: Boolean(state.onboarding.completed), action: "onboarding" },
      { id: "level", title: "Xác định điểm bắt đầu", detail: state.placement ? `Đã gợi ý cấp ${state.placement.level}.` : "Tự chọn cấp hoặc làm bài xếp lớp.", done: Boolean(state.placement) || completedCount(state) > 0, view: "placement" },
      { id: "lesson", title: "Hoàn thành bài đầu tiên", detail: "Học từ, nghe hội thoại và làm 5 câu.", done: completedCount(state) > 0, lessonId: nextLessonFor(state).id },
      { id: "word", title: "Lưu từ đầu tiên", detail: "Tạo sổ từ và lịch ôn cá nhân.", done: Object.keys(state.savedWords || {}).length > 0, view: "vocabulary" },
      { id: "practice", title: "Thử phòng luyện tập", detail: `Ưu tiên kỹ năng ${skillLabels[weakSkillFor(state)] || "giao tiếp"}.`, done: anyPractice, view: "practice" }
    ];
  };
  const buildSmartPlan = (input = {}, now = Date.now()) => {
    const state = mergeState(input);
    const levelId = selectedLevelId(state);
    const levelIds = levelLessonIds(levelId);
    const incompleteLessonId = levelIds.find((id) => !state.completed?.[id]);
    const career = careerTrackById(selectedCareerId(state));
    const careerSourceLesson = career?.lessons.find((lesson) => !state.completed?.[lesson.id]) || career?.lessons[0];
    const careerLesson = personalizeCareerLesson(state, careerSourceLesson);
    const careerPriority = Boolean(careerLesson && (state.careerSurvey || /Công việc|chuyên ngành/i.test(state.settings.goal)));
    const dueWords = dueVocabulary(state, now);
    const weakSkill = weakSkillFor(state);
    const minutes = Number(state.minutesByDay?.[todayKey(now)] || 0);
    const remainingMinutes = Math.max(0, Number(state.dailyGoal || 15) - minutes);
    const tasks = [];
    if (!state.onboarding.completed) tasks.push({ id: "setup", type: "setup", title: "Thiết lập lộ trình cá nhân", detail: "Trả lời 3 câu ngắn để nhận kế hoạch phù hợp.", minutes: 2, action: "onboarding" });
    if (state.learnerProfile.needsPlacement && !state.placement) tasks.push({ id: "placement", type: "placement", title: "Kiểm tra điểm bắt đầu", detail: "Nhận gợi ý A0-C2 trước khi học sâu hơn.", minutes: 18, view: "placement" });
    if (dueWords.length) tasks.push({ id: "review", type: "review", title: `Ôn ${dueWords.length} từ đến hạn`, detail: "Ôn cách quãng để nhớ lâu hơn.", minutes: Math.min(10, Math.max(3, dueWords.length)), view: "vocabulary" });
    if (careerPriority) tasks.push({ id: "career", type: "career", title: careerLesson.title, detail: `${career.viName} · ${careerLesson.adaptiveRationale}`, minutes: careerLesson.minutes, lessonId: careerLesson.id });
    if (incompleteLessonId) {
      const lesson = getLesson(incompleteLessonId);
      tasks.push({ id: "lesson", type: "lesson", title: lesson.title, detail: lesson.canDo, minutes: lesson.minutes, lessonId: lesson.id });
    }
    const focusView = ["listening", "reading", "grammar"].includes(weakSkill) ? "practice" : weakSkill === "writing" ? "writing" : weakSkill === "vocabulary" ? "vocabulary" : "speaking";
    tasks.push({ id: `skill-${weakSkill}`, type: "skill", title: `Củng cố kỹ năng ${skillLabels[weakSkill] || "giao tiếp"}`, detail: "Gợi ý dựa trên mục tiêu và các câu bạn từng làm sai.", minutes: 8, view: focusView });
    if (!state.placement && !state.learnerProfile.needsPlacement) tasks.push({ id: "placement-optional", type: "placement", title: "Kiểm tra trình độ khi sẵn sàng", detail: "Không bắt buộc; mọi cấp độ luôn được mở.", minutes: 18, view: "placement" });
    const uniqueTasks = tasks.filter((task, index, list) => list.findIndex((item) => item.id === task.id) === index).slice(0, 3);
    const checklist = beginnerChecklist(state, now);
    const readiness = Math.round(checklist.filter((item) => item.done).length / checklist.length * 100);
    return {
      date: todayKey(now), levelId, minutes, dailyGoal: state.dailyGoal, remainingMinutes, dueWords: dueWords.length,
      weakSkill, weakSkillLabel: skillLabels[weakSkill] || "Giao tiếp", careerName: career?.viName || "", readiness, tasks: uniqueTasks,
      headline: remainingMinutes === 0 ? "Bạn đã đạt mục tiêu hôm nay" : `Còn ${remainingMinutes} phút để hoàn thành mục tiêu`,
      reason: dueWords.length ? `${dueWords.length} từ đang đến hạn ôn; HH ưu tiên chúng trước.` : `Bước tiếp theo phù hợp với cấp ${levelId} và trọng tâm ${skillLabels[weakSkill] || "giao tiếp"}.`
    };
  };
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
  let activeCareerCategory = "all";
  let guideOpen = false;
  let navigatorOpen = false;
  let activeUtterance = null;
  let focusAfterRender = false;

  const updateSpeechNow = (status, text = "", voice = null) => {
    const node = host?.querySelector("[data-hhe-speaking-now]");
    if (!node) return;
    node.dataset.status = status;
    const profile = voiceProfileById(readState().settings.voiceProfile);
    node.innerHTML = status === "speaking"
      ? `<span><i></i> ĐANG PHÁT</span><strong>${escapeHtml(text)}</strong><small>${escapeHtml(voice?.name || profile.label)} · ${escapeHtml(voice?.lang || profile.lang)}</small>`
      : `<span><i></i> SẴN SÀNG</span><strong>Chọn từ hoặc câu để nghe</strong><small>${escapeHtml(profile.label)} · tốc độ ${readState().settings.voiceRate}×</small>`;
  };
  const speak = (text, settings = {}, options = {}) => {
    if (!root.speechSynthesis || typeof root.SpeechSynthesisUtterance !== "function") return false;
    root.speechSynthesis.cancel();
    const effectiveSettings = { ...settings, ...(options.profile ? { voiceProfile: options.profile, voiceURI: "" } : {}) };
    const profile = voiceProfileById(effectiveSettings.voiceProfile);
    const utterance = new root.SpeechSynthesisUtterance(String(text || ""));
    const voice = selectVoice(englishVoices(), effectiveSettings);
    utterance.lang = voice?.lang || profile.lang;
    utterance.rate = Number(options.rate || effectiveSettings.voiceRate) || 0.85;
    utterance.pitch = Number(effectiveSettings.voicePitch) || 1;
    if (voice) utterance.voice = voice;
    utterance.onstart = () => updateSpeechNow("speaking", text, voice);
    utterance.onend = () => { if (activeUtterance === utterance) { activeUtterance = null; updateSpeechNow("ready"); } };
    utterance.onerror = () => { if (activeUtterance === utterance) { activeUtterance = null; updateSpeechNow("ready"); } };
    activeUtterance = utterance;
    root.speechSynthesis.speak(utterance);
    return true;
  };

  const navItems = [
    ["dashboard", "⌂", "Hôm nay"], ["plan", "✓", "Kế hoạch"], ["learn", "▶", "Bài học"], ["career", "▦", "Chuyên ngành"], ["practice", "✦", "Luyện tập"], ["placement", "◎", "Xếp lớp"], ["survey", "◈", "Khảo sát nghề"], ["vocabulary", "◇", "Sổ từ"],
    ["speaking", "◉", "Luyện nói"], ["writing", "✎", "Luyện viết"], ["progress", "↗", "Tiến độ"], ["settings", "⚙", "Cài đặt"]
  ];
  const beginnerNavIds = new Set(["dashboard", "learn", "vocabulary", "speaking", "progress"]);
  const navigatorGroups = [
    { id: "start", icon: "01", title: "Bắt đầu đúng chỗ", detail: "Kế hoạch, lộ trình và kiểm tra trình độ", views: ["plan", "learn", "placement"] },
    { id: "skills", icon: "Aa", title: "Luyện từng kỹ năng", detail: "Bài ngắn, có phản hồi và bước tiếp theo", views: ["practice", "vocabulary", "speaking", "writing"] },
    { id: "career", icon: "▦", title: "Tiếng Anh công việc", detail: "Khảo sát nghề và bài học theo chuyên ngành", views: ["survey", "career"] },
    { id: "personal", icon: "◎", title: "Cá nhân của bạn", detail: "Theo dõi kết quả và điều chỉnh trải nghiệm", views: ["progress", "settings"] }
  ];
  const routeForView = (view) => view === "dashboard" ? "#/english" : `#/english/${view}`;
  const syncViewRoute = (view) => {
    if (!root.location) return false;
    const nextHash = routeForView(view);
    if (root.location.hash === nextHash) return false;
    root.location.hash = nextHash;
    return true;
  };
  const weekdayLabels = [[1, "T2"], [2, "T3"], [3, "T4"], [4, "T5"], [5, "T6"], [6, "T7"], [0, "CN"]];
  const formatFocusTime = (seconds) => `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
  const nextLessonFor = (state, levelId = selectedLevelId(state)) => {
    const ids = levelLessonIds(levelId); return getLesson(ids.find((id) => !state.completed[id]) || ids[0]);
  };
  const shouldShowOnboarding = () => guideOpen;
  const taskActionMarkup = (task, label = "Bắt đầu") => {
    if (task.lessonId) return `<button class="primary" type="button" data-hhe-open-lesson="${escapeHtml(task.lessonId)}">${escapeHtml(label)}</button>`;
    if (task.action === "onboarding") return `<button class="primary" type="button" data-hhe-onboarding-open>${escapeHtml(label)}</button>`;
    return `<button class="primary" type="button" data-hhe-view="${escapeHtml(task.view || "dashboard")}">${escapeHtml(label)}</button>`;
  };
  const navigatorMarkup = (state) => {
    if (!navigatorOpen) return "";
    const navById = (id) => navItems.find(([view]) => view === id) || [id, "→", id];
    return `<div class="hhe-navigator-backdrop" data-hhe-navigator-backdrop>
      <section class="hhe-navigator" role="dialog" aria-modal="true" aria-labelledby="hheNavigatorTitle">
        <header><div><small>HH LEARNING MAP</small><h2 id="hheNavigatorTitle">Bạn muốn học gì tiếp theo?</h2><p>Chọn mục tiêu, HH sẽ mở đúng một màn hình và hướng dẫn bước tiếp theo.</p></div><button type="button" data-hhe-navigator-close aria-label="Đóng khu khám phá">×</button></header>
        <label class="hhe-navigator-search"><span>⌕</span><input type="search" data-hhe-navigator-search placeholder="Tìm bài học, nói, viết, nghề nghiệp..." autocomplete="off"></label>
        <div class="hhe-navigator-groups">${navigatorGroups.map((group) => `<section data-hhe-navigator-group><header><span>${group.icon}</span><div><strong>${group.title}</strong><small>${group.detail}</small></div></header><div>${group.views.map((view) => { const [, icon, label] = navById(view); return `<button type="button" class="${state.activeView === view ? "active" : ""}" data-hhe-view="${view}" data-hhe-navigator-item="${foldSearch(`${label} ${group.title} ${group.detail}`)}"><span>${icon}</span><strong>${label}</strong><i>→</i></button>`; }).join("")}</div></section>`).join("")}</div>
        <footer><span><i></i> Tiến độ được lưu tự động trên thiết bị</span><button type="button" data-hhe-onboarding-open>Thiết lập lộ trình cho người mới</button></footer>
      </section>
    </div>`;
  };
  const onboardingMarkup = (state) => {
    const confidence = state.learnerProfile?.confidence || "";
    const focus = state.learnerProfile?.focusSkill || "speaking";
    return `<div class="hhe-onboarding-backdrop" data-hhe-onboarding-backdrop>
      <section class="hhe-onboarding" role="dialog" aria-modal="true" aria-labelledby="hheOnboardingTitle">
        <form data-hhe-onboarding>
          <header><div><small>HH SMART START · 3 BƯỚC</small><h2 id="hheOnboardingTitle">Bắt đầu đúng chỗ, không bị ngợp</h2><p>HH English dùng câu trả lời để sắp xếp bài học ngay trên thiết bị này.</p></div><button type="button" data-hhe-onboarding-close aria-label="Đóng hướng dẫn" title="Đóng">×</button></header>
          <div class="hhe-onboarding-progress" aria-label="Tiến độ thiết lập"><i class="active" data-hhe-onboarding-dot="1">1</i><span></span><i data-hhe-onboarding-dot="2">2</i><span></span><i data-hhe-onboarding-dot="3">3</i></div>
          <section data-hhe-onboarding-panel="1"><small>BƯỚC 1/3</small><h3>Tiếng Anh hiện tại của bạn thế nào?</h3><p>Không cần chọn thật chính xác; bạn có thể đổi cấp độ bất cứ lúc nào.</p><div class="hhe-onboarding-options">${[
            ["new", "Mất gốc", "Bắt đầu từ âm, từ và câu rất cơ bản."],
            ["basic", "Biết một chút", "Hiểu câu quen thuộc nhưng phản xạ còn chậm."],
            ["rusty", "Đã học nhưng quên", "Có nền tảng và muốn lấy lại phản xạ."],
            ["confident", "Đã giao tiếp cơ bản", "Muốn học độc lập và dùng trong thực tế."],
            ["unsure", "Tôi chưa chắc", "HH sẽ đề xuất làm bài kiểm tra xếp lớp."]
          ].map(([value, title, detail]) => `<label><input type="radio" name="confidence" value="${value}" ${confidence === value ? "checked" : ""}><span><b>${title}</b><small>${detail}</small></span></label>`).join("")}</div><footer><span data-hhe-onboarding-status></span><button class="primary" type="button" data-hhe-onboarding-next="2">Tiếp tục →</button></footer></section>
          <section data-hhe-onboarding-panel="2" hidden><small>BƯỚC 2/3</small><h3>Bạn muốn dùng tiếng Anh vào việc gì?</h3><p>Mục tiêu sẽ quyết định loại bài HH ưu tiên mỗi ngày.</p><div class="hhe-onboarding-options goals">${[
            ["Giao tiếp hằng ngày", "Giao tiếp", "Nghe, nói và phản xạ trong đời sống."],
            ["Học tập và thi cử", "Học tập", "Từ vựng, đọc hiểu và ngữ pháp."],
            ["Công việc", "Công việc", "Email, họp, báo cáo và khách hàng."],
            ["Tiếng Anh chuyên ngành", "Chuyên ngành", "Thuật ngữ và tình huống theo nghề."]
          ].map(([value, title, detail]) => `<label><input type="radio" name="goal" value="${value}" ${state.settings.goal === value ? "checked" : ""}><span><b>${title}</b><small>${detail}</small></span></label>`).join("")}</div><footer><button type="button" data-hhe-onboarding-back="1">← Quay lại</button><span data-hhe-onboarding-status></span><button class="primary" type="button" data-hhe-onboarding-next="3">Tiếp tục →</button></footer></section>
          <section data-hhe-onboarding-panel="3" hidden><small>BƯỚC 3/3</small><h3>Chọn nhịp học dễ duy trì</h3><p>Bài học ngắn và đều đặn hiệu quả hơn một buổi quá dài.</p><div class="hhe-onboarding-final"><fieldset><legend>Kỹ năng muốn cải thiện trước</legend>${[["speaking", "Nói"], ["listening", "Nghe"], ["vocabulary", "Từ vựng"], ["grammar", "Ngữ pháp"], ["writing", "Viết"]].map(([value, label]) => `<label><input type="radio" name="focusSkill" value="${value}" ${focus === value ? "checked" : ""}><span>${label}</span></label>`).join("")}</fieldset><label><span>Thời gian mỗi ngày</span><select name="minutes"><option value="10">10 phút · Rất nhẹ</option><option value="15" ${state.dailyGoal === 15 ? "selected" : ""}>15 phút · Dễ duy trì</option><option value="20" ${state.dailyGoal === 20 ? "selected" : ""}>20 phút · Cân bằng</option><option value="30" ${state.dailyGoal === 30 ? "selected" : ""}>30 phút · Tăng tốc</option></select></label></div><footer><button type="button" data-hhe-onboarding-back="2">← Quay lại</button><span data-hhe-onboarding-status></span><button class="primary" type="submit">Tạo kế hoạch của tôi</button></footer></section>
        </form>
      </section>
    </div>`;
  };
  const speakingScenarios = [
    { id: "workplace", icon: "▦", title: "Nơi làm việc", context: "Xin làm rõ nhiệm vụ trong cuộc họp", phrase: "Could you clarify the next step, please?" },
    { id: "interview", icon: "◎", title: "Phỏng vấn", context: "Giới thiệu điểm mạnh một cách tự nhiên", phrase: "One of my strengths is solving problems calmly." },
    { id: "presentation", icon: "↗", title: "Thuyết trình", context: "Dẫn người nghe qua ý chính", phrase: "Let me walk you through the main idea." },
    { id: "customer", icon: "◇", title: "Khách hàng", context: "Xác nhận nhu cầu trước khi trả lời", phrase: "Let me make sure I understand what you need." },
    { id: "travel", icon: "✦", title: "Du lịch", context: "Hỏi đường và kiểm tra thông tin", phrase: "Is this the right platform for the city centre?" },
    { id: "social", icon: "◉", title: "Giao tiếp", context: "Duy trì một cuộc trò chuyện", phrase: "That sounds interesting. How did you get started?" }
  ];
  const voiceStudioMarkup = (state, phrase, compact = false) => {
    const voices = englishVoices();
    const selected = selectVoice(voices, state.settings);
    const profile = voiceProfileById(state.settings.voiceProfile);
    return `<section class="hhe-voice-studio ${compact ? "compact" : ""}">
      <header><div><small>HH VOICE STUDIO</small><h3>${compact ? "Chọn giọng trước khi nghe" : "Một câu, nhiều chất giọng thật trên thiết bị"}</h3><p>${voices.length ? `${voices.length} giọng tiếng Anh đang khả dụng. HH sẽ ưu tiên đúng vùng và kiểu giọng bạn chọn.` : "Đang nạp danh sách giọng của trình duyệt. Nếu thiết bị chỉ có một giọng, HH vẫn giữ đúng vùng phát âm gần nhất."}</p></div><span>${escapeHtml(profile.flag)} · ${escapeHtml(profile.gender === "female" ? "NỮ" : "NAM")}</span></header>
      <div class="hhe-voice-presets">${voiceProfiles.map((item) => `<button type="button" class="${item.id === profile.id ? "active" : ""}" data-hhe-voice-profile="${item.id}"><b>${item.flag}</b><span><strong>${escapeHtml(item.label)}</strong><small>${escapeHtml(item.detail)}</small></span>${item.id === profile.id ? "<i>✓</i>" : ""}</button>`).join("")}</div>
      <div class="hhe-voice-controls"><label><span>Giọng cài trên thiết bị</span><select data-hhe-voice-uri>${voices.length ? voices.map((voice) => `<option value="${escapeHtml(voice.voiceURI)}" ${voice.voiceURI === (state.settings.voiceURI || selected?.voiceURI) ? "selected" : ""}>${escapeHtml(voice.name)} · ${escapeHtml(voice.lang)}${inferVoiceGender(voice) === "unknown" ? "" : ` · ${inferVoiceGender(voice) === "female" ? "nữ" : "nam"}`}</option>`).join("") : `<option value="">Giọng mặc định của trình duyệt</option>`}</select></label><label><span>Tốc độ</span><select data-hhe-voice-rate>${[[0.65,"0.65× · Chậm"],[0.85,"0.85× · Học"],[1,"1× · Tự nhiên"],[1.1,"1.1× · Thử thách"]].map(([value,label]) => `<option value="${value}" ${Number(state.settings.voiceRate) === value ? "selected" : ""}>${label}</option>`).join("")}</select></label><div><button type="button" data-hhe-speak="${escapeHtml(phrase)}" data-hhe-speak-rate="0.65">◁ Nghe chậm</button><button class="primary" type="button" data-hhe-speak="${escapeHtml(phrase)}">▶ Nghe giọng đã chọn</button></div></div>
      <div class="hhe-speaking-now" data-hhe-speaking-now data-status="ready"><span><i></i> SẴN SÀNG</span><strong>Chọn từ hoặc câu để nghe</strong><small>${escapeHtml(profile.label)} · tốc độ ${state.settings.voiceRate}×</small></div>
    </section>`;
  };
  const shell = (state, content) => {
    const levelId = selectedLevelId(state); const level = levelById(levelId); const done = completedCount(state, levelId); const total = levelLessonIds(levelId).length;
    const next = nextLessonFor(state, levelId);
    const navButton = ([id, icon, label]) => `<button type="button" class="${state.activeView === id ? "active" : ""}" data-hhe-view="${id}" aria-label="${escapeHtml(label)}" title="${escapeHtml(label)}"><i>${icon}</i><span>${label}</span></button>`;
    const focusedNav = [navItems[0], navItems[1], navItems[4], navItems[10]];
    const currentLabel = state.activeView === "lesson" ? "Bài học đang mở" : (navItems.find(([id]) => id === state.activeView)?.[2] || "Hôm nay");
    return `<section class="hhe-app" data-hhe-app data-view="${state.activeView}" data-theme="${state.settings.theme}">
    <header class="hhe-topbar"><div class="hhe-brand"><span>HH</span><div><small>HỌC TIẾNG ANH MIỄN PHÍ</small><strong>HH English</strong></div></div><div class="hhe-top-stats"><span><i>◆</i><b>${state.streak.current}</b> ngày học</span><span><i>◷</i><b>${state.dailyGoal}</b> phút/ngày</span></div><button type="button" class="hhe-top-voice" data-hhe-view="speaking" aria-label="Mở phòng giọng đọc"><b>${escapeHtml(voiceProfileById(state.settings.voiceProfile).flag)}</b> ${escapeHtml(voiceProfileById(state.settings.voiceProfile).gender === "female" ? "Nữ" : "Nam")}</button><button type="button" class="hhe-top-explore" data-hhe-navigator-open aria-label="Mở bản đồ học tập">⌕ Khám phá</button><button type="button" data-hhe-onboarding-open aria-label="Mở hướng dẫn bắt đầu" title="Hướng dẫn cho người mới">?</button><button type="button" data-hhe-theme aria-label="Đổi màu giao diện">${state.settings.theme === "day" ? "☀ Sáng" : "◐ Tối"}</button></header>
    <div class="hhe-layout"><aside class="hhe-nav hhe-nav--focused" aria-label="Điều hướng HH English"><p class="hhe-nav-label">HỌC TỪNG BƯỚC</p>${focusedNav.slice(0,2).map(navButton).join("")}<button type="button" class="hhe-nav-continue ${state.activeView === "lesson" ? "active" : ""}" data-hhe-open-lesson="${next.id}" aria-label="Học tiếp ${escapeHtml(next.title)}"><i>▶</i><span><b>Học tiếp</b><small>${escapeHtml(next.title)}</small></span></button>${focusedNav.slice(2).map(navButton).join("")}<button type="button" class="hhe-nav-discover" data-hhe-navigator-open><i>＋</i><span>Khám phá khu học</span><b>${navItems.length - 4}</b></button><section><small>Bạn đang học</small><strong>${levelId}</strong><span>${done}/${total} bài · ${escapeHtml(level.name)}</span><button type="button" data-hhe-view="learn">Đổi trình độ</button></section></aside><main class="hhe-main"><div class="hhe-view-stage">${content}</div><nav class="hhe-route-dock" aria-label="Bước học tiếp theo"><button type="button" data-hhe-view="dashboard">← Hôm nay</button><div><small>MÀN HÌNH HIỆN TẠI</small><strong>${escapeHtml(currentLabel)}</strong></div><span><i></i> Đã tự lưu</span><button class="primary" type="button" data-hhe-open-lesson="${next.id}">${state.activeView === "lesson" ? "Tiếp tục bài" : "Học bài tiếp theo"} →</button></nav></main></div>
    <div class="hhe-toast" data-hhe-toast role="status" aria-live="polite"></div>
    ${navigatorMarkup(state)}
    ${shouldShowOnboarding(state) ? onboardingMarkup(state) : ""}
  </section>`;
  };

  const smartTaskIcon = (type) => ({ setup: "01", placement: "A?", review: "Aa", lesson: "▶", skill: "✦", career: "▦" }[type] || "→");
  const smartCoachMarkup = (state, compact = false) => {
    const plan = buildSmartPlan(state);
    const tasks = compact ? plan.tasks.slice(0, 2) : plan.tasks;
    return `<section class="hhe-smart-coach ${compact ? "compact" : ""}">
      <header><div><small>HH SMART COACH · ${plan.levelId}</small><h3>${escapeHtml(plan.headline)}</h3><p>${escapeHtml(plan.reason)}</p></div><div class="hhe-smart-ring" style="--p:${Math.min(100, Math.round(plan.minutes / Math.max(1, plan.dailyGoal) * 100))}%"><strong>${plan.minutes}</strong><span>/${plan.dailyGoal} phút</span></div></header>
      <div class="hhe-smart-tasks">${tasks.map((task, index) => `<article style="--task-index:${index}"><span>${smartTaskIcon(task.type)}</span><div><small>${task.minutes} PHÚT · ${task.type === "review" ? "ÔN TẬP" : task.type === "lesson" ? "BÀI HỌC" : task.type === "placement" ? "XẾP LỚP" : task.type === "career" ? "CHUYÊN NGÀNH" : task.type === "setup" ? "THIẾT LẬP" : "KỸ NĂNG"}</small><strong>${escapeHtml(task.title)}</strong><p>${escapeHtml(task.detail)}</p></div>${taskActionMarkup(task, index === 0 ? "Làm ngay" : "Mở")}</article>`).join("")}</div>
      <footer><span><i></i> Gợi ý được tính trên thiết bị, không gửi bài học tới dịch vụ AI.</span>${compact ? `<button type="button" data-hhe-view="plan">Xem toàn bộ kế hoạch →</button>` : `<button type="button" data-hhe-onboarding-open>Điều chỉnh mục tiêu</button>`}</footer>
    </section>`;
  };
  const beginnerChecklistMarkup = (state, force = false) => {
    const items = beginnerChecklist(state);
    const done = items.filter((item) => item.done).length;
    if (!force && (!state.settings.beginnerMode || done === items.length)) return "";
    return `<section class="hhe-beginner-checklist"><header><div><small>NEW LEARNER PATH</small><h3>5 bước làm quen HH English</h3><p>Mỗi bước mở một công cụ quan trọng, không cần hoàn thành theo thứ tự.</p></div><strong>${done}/5</strong></header><i style="--p:${done / items.length * 100}%"></i><div>${items.map((item, index) => `<article class="${item.done ? "done" : ""}"><span>${item.done ? "✓" : index + 1}</span><div><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(item.detail)}</small></div>${item.done ? `<b>Hoàn tất</b>` : taskActionMarkup(item, "Thử ngay")}</article>`).join("")}</div></section>`;
  };
  const smartPlanView = (state) => {
    const plan = buildSmartPlan(state);
    const checklist = beginnerChecklist(state);
    const level = levelById(plan.levelId);
    return `<section class="hhe-smart-plan"><header class="hhe-plan-hero"><div><small>DAILY LEARNING OS · ${new Date().toLocaleDateString("vi-VN", { weekday: "long", day: "2-digit", month: "2-digit" }).toUpperCase()}</small><h2>Kế hoạch hôm nay</h2><p>HH sắp xếp một lộ trình ngắn, rõ việc cần làm và tự thay đổi khi bạn học xong, làm sai hoặc có từ đến hạn ôn.</p><div><button class="primary" type="button" data-hhe-onboarding-open>Chỉnh kế hoạch</button><button type="button" data-hhe-view="progress">Xem tiến độ</button></div></div><aside><span>MỨC SẴN SÀNG</span><strong>${plan.readiness}%</strong><i style="--p:${plan.readiness}%"></i><small>${plan.readiness < 60 ? "Hoàn thành vài bước nhập môn để nhận gợi ý chính xác hơn." : "Hồ sơ học đã đủ để cá nhân hóa kế hoạch hằng ngày."}</small></aside></header>
      ${smartCoachMarkup(state)}
      <div class="hhe-plan-grid"><section class="hhe-plan-insights"><header><div><small>WHY THIS PLAN?</small><h3>HH đang ưu tiên điều gì</h3></div><span>Local intelligence</span></header><div><article><span>◎</span><div><small>ĐIỂM BẮT ĐẦU</small><strong>${plan.levelId} · ${escapeHtml(level.name)}</strong><p>${escapeHtml(level.canDo)}</p></div></article><article><span>✦</span><div><small>KỸ NĂNG TRỌNG TÂM</small><strong>${escapeHtml(plan.weakSkillLabel)}</strong><p>Dựa trên lựa chọn cá nhân, phòng luyện tập và những câu từng trả lời sai.</p></div></article><article><span>Aa</span><div><small>ÔN CÁCH QUÃNG</small><strong>${plan.dueWords} từ đến hạn</strong><p>${plan.dueWords ? "Từ cần ôn được đẩy lên trước bài mới để giảm quên." : "Chưa có từ đến hạn; hãy lưu từ trong bài để HH tạo lịch ôn."}</p></div></article><article><span>▦</span><div><small>CHUYÊN NGÀNH</small><strong>${escapeHtml(plan.careerName || "Chưa chọn")}</strong><p>${state.careerSurvey ? "Đã dùng kết quả khảo sát nghề nghiệp." : "Làm khảo sát 3 phút để nhận lộ trình nghề phù hợp hơn."}</p></div></article></div></section>
      ${beginnerChecklistMarkup(state, true)}</div>
      <section class="hhe-plan-choices"><header><div><small>BẠN LUÔN KIỂM SOÁT</small><h3>Chọn cách bắt đầu khác</h3></div><span>Không khóa bài · Không giới hạn lượt học</span></header><div><button type="button" data-hhe-view="learn"><span>CEFR</span><strong>Tự chọn A0–C2</strong><small>Mở toàn bộ 69 bài nền tảng.</small></button><button type="button" data-hhe-view="placement"><span>A?</span><strong>Kiểm tra xếp lớp</strong><small>28 câu để nhận điểm bắt đầu gợi ý.</small></button><button type="button" data-hhe-view="survey"><span>▦</span><strong>Khảo sát nghề nghiệp</strong><small>Ghép mục tiêu với ${careerTracks.length} lộ trình chuyên ngành.</small></button><button type="button" data-hhe-view="practice"><span>✦</span><strong>Luyện nhanh</strong><small>Nghe, đọc và ngữ pháp theo cấp hiện tại.</small></button></div></section>
    </section>`;
  };

  const beginnerDashboardView = (state) => {
    const levelId = selectedLevelId(state);
    const level = levelById(levelId);
    const next = nextLessonFor(state, levelId);
    const minutes = state.minutesByDay[todayKey()] || 0;
    const progress = levelProgress(state, levelId);
    const dueWords = Object.values(state.reviewQueue).filter((item) => new Date(item.dueAt || 0) <= new Date()).length;
    const savedWords = Object.keys(state.savedWords).length;
    const hour = new Date().getHours();
    const greeting = hour < 11 ? "Chào buổi sáng" : hour < 18 ? "Chào buổi chiều" : "Chào buổi tối";
    return `<section class="hhe-beginner-home">
      <section class="hhe-beginner-hero">
        <div>
          <small>HH ENGLISH · HỌC TỪNG BƯỚC</small>
          <h2>${greeting}.<br><em>Hôm nay chỉ cần học một bài.</em></h2>
          <p>HH đã chọn bài phù hợp với trình độ ${levelId} của bạn. Bài này mất khoảng ${next.minutes} phút và có hướng dẫn bằng tiếng Việt.</p>
          <div>
            <button class="primary" type="button" data-hhe-open-lesson="${next.id}">Bắt đầu bài hôm nay <b>→</b></button>
            <button type="button" data-hhe-onboarding-open>Thiết lập lộ trình 1 phút</button>
          </div>
          <span>Không cần học theo thứ tự phức tạp · Có thể học lại bất cứ lúc nào</span>
        </div>
        <aside aria-label="Tiến độ cấp độ hiện tại">
          <div style="--p:${progress}%"><strong>${progress}%</strong><span>đã học</span></div>
          <small>TRÌNH ĐỘ HIỆN TẠI</small>
          <b>${levelId} · ${escapeHtml(level.name)}</b>
          <button type="button" data-hhe-view="learn">Đổi trình độ</button>
        </aside>
      </section>

      <section class="hhe-simple-next">
        <header><span>1</span><div><small>VIỆC NÊN LÀM TIẾP THEO</small><h3>${escapeHtml(next.title)}</h3><p>${escapeHtml(next.canDo)}</p></div><b>${next.minutes} phút</b></header>
        <div><span>Nghe mẫu</span><i></i><span>Học từ mới</span><i></i><span>Làm 5 câu</span></div>
        <button class="primary" type="button" data-hhe-open-lesson="${next.id}">Học ngay</button>
      </section>

      <section class="hhe-start-question">
        <header><small>BẠN MUỐN BẮT ĐẦU THẾ NÀO?</small><h3>Chọn một ô gần đúng nhất</h3><p>Không có lựa chọn sai. Bạn có thể đổi lại sau.</p></header>
        <div>
          <button type="button" data-hhe-quick-start="foundation"><span>Aa</span><strong>Tôi mất gốc</strong><small>Học từ bảng chữ cái, âm và câu cơ bản.</small><b>Bắt đầu A0 →</b></button>
          <button type="button" data-hhe-view="placement"><span>?</span><strong>Tôi chưa biết trình độ</strong><small>Làm bài kiểm tra để HH chọn điểm bắt đầu.</small><b>Kiểm tra miễn phí →</b></button>
          <button type="button" data-hhe-quick-start="conversation"><span>◉</span><strong>Tôi muốn giao tiếp</strong><small>Ưu tiên nghe, nói và phản xạ hằng ngày.</small><b>Luyện giao tiếp →</b></button>
          <button type="button" data-hhe-view="survey"><span>▦</span><strong>Tôi học để đi làm</strong><small>Chọn ngành nghề và học đúng từ chuyên môn.</small><b>Chọn chuyên ngành →</b></button>
        </div>
      </section>

      <section class="hhe-simple-progress">
        <article><span>Hôm nay</span><strong>${minutes}/${state.dailyGoal} phút</strong><i style="--p:${Math.min(100, minutes / state.dailyGoal * 100)}%"></i><small>${minutes >= state.dailyGoal ? "Đã đạt mục tiêu. Rất tốt!" : `Còn ${Math.max(0, state.dailyGoal - minutes)} phút để đạt mục tiêu.`}</small></article>
        <article><span>Từ vựng của bạn</span><strong>${savedWords} từ đã lưu</strong><p>${dueWords ? `${dueWords} từ đang chờ ôn lại.` : "Lưu từ trong bài để ôn lại sau."}</p><button type="button" data-hhe-view="vocabulary">${dueWords ? "Ôn từ ngay" : "Mở sổ từ"}</button></article>
        <article><span>Cần trợ giúp?</span><strong>HH hướng dẫn từng bước</strong><p>Mở hướng dẫn nhanh hoặc chuyển sang giao diện đầy đủ khi đã quen.</p><button type="button" data-hhe-onboarding-open>Mở hướng dẫn</button></article>
      </section>

      <details class="hhe-explore-more">
        <summary><span>Khám phá thêm công cụ học</span><small>Luyện nói, viết, chuyên ngành và kế hoạch thông minh</small><b>＋</b></summary>
        <div>
          <button type="button" data-hhe-view="speaking"><span>◉</span><strong>Luyện phát âm</strong><small>Nghe mẫu và thu giọng của bạn.</small></button>
          <button type="button" data-hhe-view="practice"><span>✦</span><strong>Luyện nhanh</strong><small>Nghe, đọc và ngữ pháp.</small></button>
          <button type="button" data-hhe-view="career"><span>▦</span><strong>Tiếng Anh chuyên ngành</strong><small>${careerTracks.length} lộ trình nghề nghiệp.</small></button>
          <button type="button" data-hhe-view="plan"><span>✓</span><strong>Kế hoạch cá nhân</strong><small>HH sắp việc học mỗi ngày.</small></button>
        </div>
      </details>
    </section>`;
  };

  const dashboardView = (state) => {
    if (state.settings.beginnerMode) return beginnerDashboardView(state);
    const levelId = selectedLevelId(state); const level = levelById(levelId); const done = completedCount(state, levelId); const percent = levelProgress(state, levelId); const minutes = state.minutesByDay[todayKey()] || 0;
    const next = nextLessonFor(state, levelId);
    const career = careerTrackById(selectedCareerId(state)); const careerNext = personalizeCareerLesson(state, nextCareerLesson(state, career?.id)); const careerDone = careerCompletedCount(state, career?.id);
    const hour = new Date().getHours(); const greeting = hour < 11 ? "Chào buổi sáng" : hour < 18 ? "Chào buổi chiều" : "Chào buổi tối";
    return `<section class="hhe-dashboard"><div class="hhe-hero"><div><p>${greeting.toUpperCase()}, ${levelId} LEARNER</p><h2>Biến tiếng Anh thành<br><em>kỹ năng mỗi ngày.</em></h2><span>${escapeHtml(level.description)} Bạn có thể tự do đổi cấp độ bất cứ lúc nào.</span><div><button class="primary" type="button" data-hhe-open-lesson="${next.id}">Tiếp tục bài học <b>→</b></button><button type="button" data-hhe-view="placement">Kiểm tra trình độ</button></div></div><div class="hhe-orbit" aria-hidden="true"><b>${percent}%</b><span>${levelId} ROADMAP</span><i></i><i></i><i></i></div></div>
      ${smartCoachMarkup(state, true)}
      ${beginnerChecklistMarkup(state)}
      <div class="hhe-metrics"><article><span>Mục tiêu hôm nay</span><strong>${minutes}/${state.dailyGoal} phút</strong><i style="--p:${Math.min(100, minutes / state.dailyGoal * 100)}%"></i></article><article><span>Chuỗi học</span><strong>${state.streak.current} ngày</strong><small>Kỷ lục ${state.streak.longest} ngày</small></article><article><span>Từ đã lưu</span><strong>${Object.keys(state.savedWords).length} từ</strong><small>${Object.values(state.reviewQueue).filter((item) => new Date(item.dueAt || 0) <= new Date()).length} cần ôn</small></article><article><span>Năng lượng học</span><strong>${state.xp} XP</strong><small>Cấp ${Math.floor(state.xp / 300) + 1}</small></article></div>
      <div class="hhe-dashboard-grid"><section class="hhe-next-card"><header><div><small>BÀI TIẾP THEO · ${levelId} · ${next.minutes} PHÚT</small><h3>${escapeHtml(next.title)}</h3><p>${escapeHtml(next.canDo)}</p></div><span>+${next.xp} XP</span></header><div class="hhe-skill-pills"><b>${escapeHtml(next.primarySkill || "English")}</b><b>Ngữ pháp</b><b>Từ vựng</b></div><button class="primary" type="button" data-hhe-open-lesson="${next.id}">Bắt đầu học</button></section>
      <section class="hhe-roadmap-mini"><header><div><small>LỘ TRÌNH CEFR</small><h3>69 bài từ A0 đến C2</h3></div><button type="button" data-hhe-view="learn">Xem chi tiết</button></header>${courseLevels.map((item) => `<button type="button" class="${item.id === levelId ? "active" : ""}" data-hhe-level="${item.id}" aria-pressed="${item.id === levelId}"><b>${item.id}</b><span>${escapeHtml(item.name)}</span><small>${levelProgress(state, item.id)}%</small></button>`).join("")}</section></div>
      ${career && careerNext ? `<section class="hhe-career-daily" style="--career:${career.color}"><div><small>CAREER ENGLISH · BÀI HÔM NAY</small><h3>${escapeHtml(career.viName)}</h3><p>${escapeHtml(careerNext.canDo)}</p><div><span>Ngày ${careerNext.day}/7</span><span>${careerDone}/7 hoàn thành</span><span>${career.vocabulary.length} thuật ngữ</span></div></div><aside><b>${career.code}</b><strong>${careerProgress(state, career.id)}%</strong><button class="primary" type="button" data-hhe-open-lesson="${careerNext.id}">Học bài hôm nay</button><button type="button" data-hhe-view="career">Đổi chuyên ngành</button></aside></section>` : ""}
      <section class="hhe-student-tools"><article class="hhe-study-plan"><header><div><small>LỊCH HỌC CỦA TÔI</small><h3>Nhịp học trong tuần</h3></div><span>${state.studyDays.length} ngày</span></header><div>${weekdayLabels.map(([day, label]) => `<button type="button" class="${state.studyDays.includes(day) ? "active" : ""}" data-hhe-day="${day}" aria-pressed="${state.studyDays.includes(day)}"><b>${label}</b><small>${state.studyDays.includes(day) ? "Học" : "Nghỉ"}</small></button>`).join("")}</div><p>Chọn những ngày bạn có thể duy trì. Lịch được lưu ngay trên thiết bị.</p></article><article class="hhe-focus-card"><small>FOCUS SESSION</small><h3>Học tập trung 15 phút</h3><strong data-hhe-focus-clock>${formatFocusTime(focusSeconds)}</strong><div><button class="primary" type="button" data-hhe-focus-start>${focusTimer ? "Tạm dừng" : "Bắt đầu"}</button><button type="button" data-hhe-focus-reset>Đặt lại</button></div><p>Hoàn thành một phiên để nhận 30 XP và cộng thời gian học.</p></article><article class="hhe-goal-card"><small>MỤC TIÊU CÁ NHÂN</small><h3>${escapeHtml(state.settings.goal)}</h3><p>${state.settings.learnerType === "student" ? "Lịch học linh hoạt cho học sinh, sinh viên." : "Lộ trình ngắn gọn cho người đi làm."}</p><div><span>Hôm nay</span><b>${Math.min(100, Math.round(minutes / state.dailyGoal * 100))}%</b></div><i style="--p:${Math.min(100, minutes / state.dailyGoal * 100)}%"></i><button type="button" data-hhe-view="settings">Điều chỉnh mục tiêu</button></article></section>
      <section class="hhe-skills"><header><div><small>4 KỸ NĂNG CỐT LÕI</small><h3>Học để sử dụng, không chỉ ghi nhớ</h3></div><button type="button" data-hhe-view="practice">Mở phòng luyện tập</button></header><div>${[["Listening", "Nghe chậm, nghe lại và đọc transcript", "#62e9f2"], ["Speaking", "Nghe mẫu, thu âm và tự đối chiếu", "#ff6ecf"], ["Reading", "Đọc ngắn với từ vựng đúng trình độ", "#ffe66d"], ["Writing", "Viết có gợi ý, đếm từ và lưu bản nháp", "#80f4b4"]].map(([title, text, color]) => `<article style="--skill:${color}"><i></i><strong>${title}</strong><p>${text}</p></article>`).join("")}</div></section></section>`;
  };

  const learnView = (state) => {
    const levelId = selectedLevelId(state); const level = levelById(levelId); const ids = levelLessonIds(levelId); const done = completedCount(state, levelId);
    const totalMinutes = level.units.flatMap((item) => item.lessons).reduce((sum, item) => sum + item.minutes, 0);
    return `<section class="hhe-learning"><header class="hhe-section-head"><div><small>${levelId} · ${escapeHtml(level.band.toUpperCase())}</small><h2>Lộ trình học từ A0 đến C2</h2><p>${level.units.length} unit · ${ids.length} bài cấp ${levelId} · khoảng ${Math.max(1, Math.round(totalMinutes / 60))} giờ học tập trung</p></div><span>${levelProgress(state, levelId)}% hoàn thành</span></header>
      <section class="hhe-level-picker" aria-label="Chọn trình độ CEFR"><header><div><small>CHỌN ĐIỂM BẮT ĐẦU</small><h3>Mọi cấp độ đều mở</h3><p>Làm bài xếp lớp để nhận gợi ý hoặc tự chọn cấp phù hợp. Bạn luôn có thể quay lại bài dễ hơn.</p></div>${state.placement ? `<span>Gợi ý: ${state.placement.level}</span>` : `<button type="button" data-hhe-view="placement">Xếp lớp miễn phí</button>`}</header><div>${courseLevels.map((item) => `<button type="button" class="${item.id === levelId ? "active" : ""}" style="--level:${item.color}" data-hhe-level="${item.id}" aria-pressed="${item.id === levelId}"><b>${item.id}</b><span>${escapeHtml(item.name)}</span><small>${completedCount(state, item.id)}/${levelLessonIds(item.id).length} bài</small>${state.placement?.level === item.id ? "<i>Đề xuất</i>" : ""}</button>`).join("")}</div></section>
      <section class="hhe-level-intro" style="--level:${level.color}"><div><small>${levelId} CAN DO</small><h3>${escapeHtml(level.description)}</h3><p>${escapeHtml(level.canDo)}</p></div><div><strong>${done}/${ids.length}</strong><span>bài hoàn thành</span></div></section>
      <label class="hhe-course-search"><span>Tìm bài học ${levelId}</span><input type="search" data-hhe-search placeholder="Tìm theo chủ đề hoặc mục tiêu bài học..." autocomplete="off"><kbd>/</kbd></label><p class="hhe-search-empty" data-hhe-search-empty hidden>Không tìm thấy bài phù hợp trong cấp ${levelId}. Hãy thử từ khóa khác.</p>
      <div class="hhe-unit-list">${level.units.map((item, index) => `<section style="--unit:${item.color}" data-hhe-unit data-search="${escapeHtml(`${item.title} ${item.vi} ${item.primarySkill}`)}"><header><span>${String(index + 1).padStart(2, "0")}</span><div><small>${levelId} · UNIT ${index + 1} · ${escapeHtml(item.primarySkill.toUpperCase())}</small><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.vi)}</p></div><b>${item.lessons.filter((lessonItem) => state.completed[lessonItem.id]).length}/${item.lessons.length}</b></header><div>${item.lessons.map((lessonItem, lessonIndex) => `<button type="button" class="${state.completed[lessonItem.id] ? "done" : ""}" data-hhe-open-lesson="${lessonItem.id}" data-search="${escapeHtml(`${lessonItem.title} ${lessonItem.canDo} ${lessonItem.grammar}`)}"><span>${state.completed[lessonItem.id] ? "✓" : lessonIndex + 1}</span><div><strong>${escapeHtml(lessonItem.title)}</strong><small>${escapeHtml(lessonItem.canDo)}</small></div><b>${lessonItem.minutes}m</b></button>`).join("")}</div></section>`).join("")}</div>
      <section class="hhe-open-path"><span>✓</span><div><strong>Không khóa tiến độ</strong><p>Nếu một bài quá khó, bạn có thể đổi cấp hoặc học lại bài trước mà không mất dữ liệu.</p></div><button type="button" data-hhe-view="progress">Xem toàn bộ tiến độ</button></section></section>`;
  };

  const careerView = (state) => {
    const selectedId = selectedCareerId(state); const selected = careerTrackById(selectedId);
    const next = personalizeCareerLesson(state, nextCareerLesson(state, selectedId));
    const completed = careerCompletedCount(state, selectedId); const nextWords = next?.vocabulary || [];
    const profile = state.careerProfile;
    const roleOptions = Object.entries(careerStageLabels);
    const intensityOptions = Object.entries(careerIntensityLabels);
    return `<section class="hhe-careers"><header class="hhe-section-head"><div><small>CAREER ENGLISH · ADAPTIVE ESP</small><h2>Tiếng Anh thông minh theo ${careerTracks.length} chuyên ngành</h2><p>Mỗi ngành có từ vựng, hội thoại và nhiệm vụ riêng. HH tiếp tục điều chỉnh bài theo vai trò, kỹ năng cần dùng và độ chuyên sâu của từng người học.</p></div><span>${careerCurriculum.lessonCount || careerLessons.length} bài · ${careerCurriculum.vocabularyCount || 0} lượt từ</span></header>
      <section class="hhe-career-overview"><article><b>${careerTracks.length}</b><span>lộ trình nghề nghiệp</span></article><article><b>${careerLessons.length}</b><span>bài học theo ngày</span></article><article><b>${careerCurriculum.uniqueVocabularyCount || new Set(careerTracks.flatMap((item) => item.vocabulary.map((word) => word[0].toLowerCase()))).size}</b><span>từ và cụm từ riêng</span></article><article><b>${careerCategories.length}</b><span>nhóm lĩnh vực</span></article></section>
      ${selected ? `<section class="hhe-career-profile" style="--career:${selected.color}"><header><div><small>ADAPTIVE CAREER PROFILE</small><h3>Chọn cách học phù hợp với bạn</h3><p>Thay đổi một lựa chọn để HH xếp lại bộ từ, hội thoại và câu luyện của ${escapeHtml(selected.viName)}.</p></div><span>Chạy riêng trên thiết bị</span></header><div class="hhe-career-profile-grid"><form data-hhe-career-profile><label><span>Giai đoạn nghề nghiệp</span><select name="roleStage">${roleOptions.map(([value, label]) => `<option value="${value}" ${profile.roleStage === value ? "selected" : ""}>${escapeHtml(label)}</option>`).join("")}</select></label><label><span>Kỹ năng cần ưu tiên</span><select name="skillFocus">${["speaking", "listening", "reading", "writing", "vocabulary"].map((value) => `<option value="${value}" ${profile.skillFocus === value ? "selected" : ""}>${escapeHtml(skillLabels[value])}</option>`).join("")}</select></label><label><span>Độ chuyên sâu</span><select name="intensity">${intensityOptions.map(([value, label]) => `<option value="${value}" ${profile.intensity === value ? "selected" : ""}>${escapeHtml(label)}</option>`).join("")}</select></label><button class="primary" type="submit">Cá nhân hóa lại bài học</button></form><aside><small>HH ĐANG CHỌN THEO</small><strong>${escapeHtml(next?.adaptiveRationale || "")}</strong><p>${selected.roles?.length ? `Các vai trò tham chiếu: ${escapeHtml(selected.roles.join(" · "))}.` : "Từ nền tảng được trộn với thuật ngữ riêng của chuyên ngành."}</p><div><span><b>${nextWords.length}</b> từ hôm nay</span><span><b>${escapeHtml(skillLabels[profile.skillFocus])}</b> trọng tâm</span><span><b>${escapeHtml(careerIntensityLabels[profile.intensity])}</b> độ khó</span></div></aside></div></section>` : ""}
      ${selected ? `<section class="hhe-career-feature" style="--career:${selected.color}"><div class="hhe-career-feature-copy"><small>${escapeHtml(selected.code)} · ${escapeHtml(selected.level)} · NGÀY ${next?.day || 1}/7</small><h3>${escapeHtml(selected.viName)}</h3><p>${escapeHtml(selected.description)}</p><div><span>${completed}/7 bài hoàn thành</span><span>${careerProgress(state, selected.id)}% tiến độ</span><span>${selected.vocabulary.length} thuật ngữ khả dụng</span></div><button class="primary" type="button" data-hhe-open-lesson="${next?.id || selected.lessons[0].id}">Học bài đã cá nhân hóa</button><button type="button" data-hhe-career-favorite="${selected.id}">${state.favoriteCareers.includes(selected.id) ? "★ Đã ghim" : "☆ Ghim lộ trình"}</button></div><aside><b>${escapeHtml(selected.code)}</b><small>DỰ ÁN CUỐI TUẦN</small><p>${escapeHtml(selected.project)}</p><i style="--p:${careerProgress(state, selected.id)}%"></i></aside></section>` : ""}
      ${nextWords.length ? `<section class="hhe-career-words"><header><div><small>ADAPTIVE WORD KIT</small><h3>8 từ phù hợp nhất hôm nay</h3><p>${escapeHtml(next.adaptiveRationale)}</p></div><div><button type="button" data-hhe-save-career-pack>Lưu cả bộ</button><button type="button" data-hhe-speak="${escapeHtml(nextWords.map((item) => item[0]).join(", "))}">▶ Nghe tất cả</button></div></header><div>${nextWords.map((item) => `<article><button type="button" data-hhe-speak="${escapeHtml(item[0])}" aria-label="Nghe ${escapeHtml(item[0])}">♪</button><div><strong>${escapeHtml(item[0])}</strong><span>${escapeHtml(item[2])}</span><small>${escapeHtml(item[4]?.tier || "specialist")} · ${escapeHtml((item[4]?.skills || []).map((skill) => skillLabels[skill] || skill).join(", "))}</small></div><button type="button" class="${state.savedWords[item[0]] ? "saved" : ""}" data-hhe-save-word="${escapeHtml(item[0])}" data-hhe-word-json="${encodeURIComponent(JSON.stringify(item))}">${state.savedWords[item[0]] ? "★" : "☆"}</button></article>`).join("")}</div></section>` : ""}
      ${selected ? `<section class="hhe-career-week"><header><div><small>7-DAY ACTION PATH</small><h3>Lộ trình thực hành ${escapeHtml(selected.name)}</h3></div><button type="button" data-hhe-view="survey">Làm khảo sát chọn nghề</button></header><div>${selected.lessons.map((lesson, index) => { const adaptiveLesson = personalizeCareerLesson(state, lesson); return `<button type="button" class="${state.completed[lesson.id] ? "done" : lesson.id === next?.id ? "active" : ""}" data-hhe-open-lesson="${lesson.id}"><span>${state.completed[lesson.id] ? "✓" : index + 1}</span><div><strong>Ngày ${index + 1} · ${escapeHtml(lesson.title.split(":")[0])}</strong><small>${escapeHtml(adaptiveLesson.canDo)}</small></div><b>${lesson.minutes}m</b></button>`; }).join("")}</div></section>` : ""}
      <section class="hhe-career-library"><header><div><small>CAREER LIBRARY</small><h3>Khám phá toàn bộ ngành nghề</h3></div><label><span>⌕</span><input type="search" data-hhe-career-search placeholder="Tìm ngành, kỹ năng hoặc từ vựng..." autocomplete="off"></label></header><div class="hhe-career-filters"><button type="button" class="active" data-hhe-career-category="all">Tất cả</button>${careerCategories.map((item) => `<button type="button" data-hhe-career-category="${item.id}" style="--category:${item.color}">${escapeHtml(item.name)}</button>`).join("")}</div><p class="hhe-search-empty" data-hhe-career-empty hidden>Không tìm thấy ngành phù hợp. Hãy thử từ khóa hoặc nhóm khác.</p><div class="hhe-career-grid">${careerTracks.map((item) => `<article class="${item.id === selectedId ? "active" : ""}" style="--career:${item.color}" data-hhe-career-card data-category="${item.category}" data-search="${escapeHtml(`${item.name} ${item.viName} ${item.description} ${item.vocabulary.map((word) => `${word[0]} ${word[2]}`).join(" ")}`)}"><header><b>${escapeHtml(item.code)}</b><button type="button" data-hhe-career-favorite="${item.id}" aria-label="Ghim ${escapeHtml(item.viName)}">${state.favoriteCareers.includes(item.id) ? "★" : "☆"}</button></header><small>${escapeHtml(careerCategories.find((category) => category.id === item.category)?.name || "")}</small><h4>${escapeHtml(item.viName)}</h4><p>${escapeHtml(item.description)}</p><footer><span>${item.level}</span><span>${careerProgress(state, item.id)}%</span><button type="button" data-hhe-career="${item.id}">Mở lộ trình</button></footer></article>`).join("")}</div></section></section>`;
  };

  const careerSurveyView = (state) => {
    const resultIds = state.careerSurvey?.recommendations || [];
    if (resultIds.length) {
      const primary = careerTrackById(resultIds[0]);
      const firstLesson = nextCareerLesson(state, primary?.id);
      return `<section class="hhe-career-survey hhe-survey-complete"><header class="hhe-section-head"><div><small>HH CAREER MATCH · HOÀN TẤT</small><h2>Lộ trình của bạn đã sẵn sàng</h2><p>Không còn đứng ở màn hình lựa chọn: bạn có thể bắt đầu bài đầu tiên ngay hoặc xem toàn bộ kế hoạch 7 ngày.</p></div><span>+15 XP</span></header>
        <section class="hhe-survey-launch" style="--career:${primary?.color || "#60e9f2"}"><div><small>GỢI Ý PHÙ HỢP NHẤT</small><h3>${escapeHtml(primary?.viName || state.careerSurvey.goal)}</h3><p>${escapeHtml(state.careerSurvey.summary)}</p><div><span>${escapeHtml(primary?.level || state.careerSurvey.level)}</span><span>${state.careerSurvey.minutes} phút/ngày</span><span>Ưu tiên ${escapeHtml(skillLabels[state.careerSurvey.skill] || state.careerSurvey.skill)}</span></div><button class="primary" type="button" data-hhe-start-career="${escapeHtml(firstLesson?.id || primary?.lessons?.[0]?.id || "")}">▶ Bắt đầu bài học đầu tiên</button><button type="button" data-hhe-career="${escapeHtml(primary?.id || "")}">Xem kế hoạch 7 ngày</button></div><aside><b>01</b><small>BÀI TIẾP THEO</small><strong>${escapeHtml(firstLesson?.title || "Bài học cá nhân hóa")}</strong><p>${escapeHtml(firstLesson?.canDo || primary?.description || "")}</p><i></i><span>Nghe → Nhại → Ghi nhớ → Ứng dụng</span></aside></section>
        <section class="hhe-survey-result"><div><small>3 LỰA CHỌN GẦN NHẤT</small><h3>Bạn luôn có thể đổi lộ trình</h3><p>Chọn một ngành để xem kế hoạch. Nút bắt đầu phía trên sẽ mở thẳng bài học, không cần cuộn tìm bước tiếp theo.</p><button type="button" data-hhe-survey-reset>← Làm lại khảo sát</button></div><div>${resultIds.map((id, index) => { const item = careerTrackById(id); return item ? `<button type="button" data-hhe-career="${item.id}" style="--career:${item.color}"><b>${index + 1}</b><span><strong>${escapeHtml(item.viName)}</strong><small>${escapeHtml(item.level)} · ${item.lessons.length} ngày · ${item.vocabulary.length} thuật ngữ</small></span><i>→</i></button>` : ""; }).join("")}</div></section></section>`;
    }
    return `<section class="hhe-career-survey"><header class="hhe-section-head"><div><small>LEARNER & CAREER SURVEY</small><h2>Khảo sát lộ trình phù hợp</h2><p>Mỗi lựa chọn được đánh dấu ngay. Nút tạo lộ trình luôn nằm ở cuối màn hình để bạn không phải tìm bước tiếp theo.</p></div><span>Khoảng 3 phút</span></header>
      <form data-hhe-career-survey><div class="hhe-survey-progress"><span class="active"><b>1</b>Giai đoạn</span><i></i><span><b>2</b>Lĩnh vực</span><i></i><span><b>3</b>Mục tiêu</span><i></i><span><b>4</b>Bắt đầu học</span></div>
      <fieldset data-hhe-survey-step="1"><legend><span>01</span><div><strong>Bạn đang ở giai đoạn nào?</strong><small>Chọn mô tả gần nhất; HH sẽ đưa bạn tới bước kế tiếp.</small></div></legend><div class="hhe-survey-options">${[["student", "Học sinh / sinh viên"], ["starter", "Mới đi làm"], ["switcher", "Muốn chuyển ngành"], ["professional", "Đang làm chuyên môn"]].map(([value, label]) => `<label><input type="radio" name="situation" value="${value}" required><span>${label}</span></label>`).join("")}</div></fieldset>
      <fieldset data-hhe-survey-step="2"><legend><span>02</span><div><strong>Lĩnh vực bạn quan tâm</strong><small>Có thể chọn nhiều nhóm; kết quả sẽ ưu tiên đúng nhóm đã chọn.</small></div></legend><div class="hhe-survey-options categories">${careerCategories.map((item) => `<label style="--category:${item.color}"><input type="checkbox" name="categories" value="${item.id}"><span>${escapeHtml(item.name)}</span></label>`).join("")}</div></fieldset>
      <fieldset data-hhe-survey-step="3"><legend><span>03</span><div><strong>Mục tiêu sử dụng tiếng Anh</strong><small>Lộ trình sẽ ưu tiên dạng nhiệm vụ phù hợp.</small></div></legend><select name="goal" required>${["Xin việc và phỏng vấn", "Giao tiếp tại nơi làm việc", "Đọc tài liệu chuyên môn", "Họp và thuyết trình", "Làm việc với khách hàng quốc tế", "Du học hoặc nghiên cứu"].map((item) => `<option>${item}</option>`).join("")}</select></fieldset>
      <div class="hhe-survey-row"><label><span>Kỹ năng ưu tiên</span><select name="skill"><option value="speaking">Nói & tương tác</option><option value="listening">Nghe</option><option value="reading">Đọc chuyên môn</option><option value="writing">Viết email / báo cáo</option><option value="vocabulary">Từ vựng</option></select></label><label><span>Thời gian mỗi ngày</span><select name="minutes"><option value="10">10 phút</option><option value="15" selected>15 phút</option><option value="20">20 phút</option><option value="30">30 phút</option><option value="45">45 phút</option></select></label><label><span>Trình độ tự đánh giá</span><select name="level">${levelOrder.map((level) => `<option value="${level}" ${selectedLevelId(state) === level ? "selected" : ""}>${level}</option>`).join("")}</select></label></div>
      <footer class="hhe-survey-action"><div><small>BƯỚC TIẾP THEO</small><strong data-hhe-survey-status>Chọn giai đoạn và ít nhất một lĩnh vực</strong></div><button class="primary" type="submit">Tạo lộ trình và chuyển sang học →</button></footer></form>
      <section class="hhe-survey-method"><article><b>01</b><div><strong>Học qua hành động</strong><p>Mỗi tuần kết thúc bằng một nhiệm vụ nghề nghiệp thực tế.</p></div></article><article><b>02</b><div><strong>Bài ngắn mỗi ngày</strong><p>7 ngày, mỗi bài 16–22 phút và có thể học lại.</p></div></article><article><b>03</b><div><strong>Ôn cách quãng</strong><p>Từ đã lưu quay lại theo mức Quên, Khó, Nhớ hoặc Rất dễ.</p></div></article><article><b>04</b><div><strong>Không khóa ngành</strong><p>Bạn có thể thử nhiều lộ trình và giữ nguyên toàn bộ tiến độ.</p></div></article></section></section>`;
  };

  const practiceTasksFor = (state) => {
    const levelId = selectedLevelId(state);
    if (levelId === "A0") return [
      { id: "listening", label: "LISTENING", title: "Nghe thông báo ở trường", intro: "Nghe câu ngắn rồi chọn địa điểm được nhắc tới.", media: "The English club meets in the library at four o'clock.", prompt: "The English club meets in the…", options: ["classroom", "library", "cafeteria"], answer: "library", explanation: "Câu nghe nói câu lạc bộ gặp tại library lúc 4 giờ." },
      { id: "reading", label: "READING", title: "Đọc lịch học ngắn", intro: "Mai has an English class at 8 a.m. She goes to school by bus and studies with Lan.", prompt: "How does Mai go to school?", options: ["bike", "bus", "train"], answer: "bus", explanation: "Đoạn văn ghi rõ Mai goes to school by bus." },
      { id: "grammar", label: "GRAMMAR", title: "Chọn động từ be", intro: "Dùng chủ ngữ để chọn đúng am, is hoặc are.", prompt: "I ___ a first-year student.", options: ["is", "am", "are"], answer: "am", explanation: "Chủ ngữ I luôn đi với am ở thì hiện tại của động từ be." }
    ];
    const level = levelById(levelId);
    return level.units.slice(0, 3).map((unitItem, index) => {
      const sourceLesson = unitItem.lessons[0]; const question = sourceLesson.exercises[sourceLesson.exercises.length - 1];
      return {
        id: ["listening", "reading", "grammar"][index], label: ["LISTENING", "READING", "GRAMMAR"][index],
        title: sourceLesson.title, intro: index === 2 ? `${sourceLesson.grammar} ${sourceLesson.dialogue}` : sourceLesson.dialogue,
        media: index === 0 ? sourceLesson.dialogue.replace(/\n/g, " ") : "", prompt: question.prompt,
        options: question.options, answer: question.answer, explanation: question.explanation
      };
    });
  };
  const practiceView = (state) => {
    const levelId = selectedLevelId(state); const practice = levelPractice(state, levelId); const tasks = practiceTasksFor(state);
    return `<section class="hhe-practice"><header class="hhe-section-head"><div><small>${levelId} · DAILY SKILL LAB</small><h2>Phòng luyện tập theo trình độ</h2><p>Bài luyện thay đổi theo cấp ${levelId}, có đáp án và giải thích để bạn biết chính xác vì sao đúng hoặc sai.</p></div><span>${Object.values(practice).filter((score) => score >= 100).length}/3 hoàn thành</span></header><div class="hhe-practice-summary">${[["listening", "Nghe", "Âm thanh + hiểu ý"], ["reading", "Đọc", "Chi tiết + suy luận"], ["grammar", "Ngữ pháp", "Cấu trúc + cách dùng"]].map(([id, label, text]) => `<article><span>${practice[id] >= 100 ? "✓" : "○"}</span><div><strong>${label}</strong><small>${text}</small></div><b>${practice[id] || 0}%</b></article>`).join("")}</div><div class="hhe-practice-grid">${tasks.map((task, index) => `<form data-hhe-practice="${task.id}" data-answer="${escapeHtml(task.answer)}" data-explanation="${escapeHtml(task.explanation)}"><header><span>${String(index + 1).padStart(2, "0")}</span><div><small>${task.label} · ${levelId}</small><h3>${escapeHtml(task.title)}</h3></div></header>${task.id === "reading" ? `<blockquote>${escapeHtml(task.intro)}</blockquote>` : `<p>${escapeHtml(task.intro)}</p>`}${task.media ? `<button type="button" data-hhe-speak="${escapeHtml(task.media)}">▶ Phát nội dung nghe</button>` : ""}<fieldset><legend>${escapeHtml(task.prompt)}</legend>${task.options.map((answer) => `<label><input type="radio" name="answer" value="${escapeHtml(answer)}"><span>${escapeHtml(answer)}</span></label>`).join("")}</fieldset><button class="primary" type="submit">Kiểm tra ${task.id === "listening" ? "bài nghe" : task.id === "reading" ? "đọc hiểu" : "ngữ pháp"}</button><output data-hhe-practice-feedback></output></form>`).join("")}</div><section class="hhe-practice-more"><div><small>LUYỆN KỸ NĂNG MỞ RỘNG · ${levelId}</small><h3>Từ nhận biết đến sử dụng độc lập</h3></div><button type="button" data-hhe-view="speaking">Luyện phát âm</button><button type="button" data-hhe-view="writing">Luyện viết</button><button type="button" data-hhe-view="vocabulary">Ôn flashcard</button></section></section>`;
  };

  const lessonView = (state, lesson) => {
    const answers = state.attempts[lesson.id] || {};
    return `<section class="hhe-lesson" data-hhe-lesson="${lesson.id}"><header><button type="button" data-hhe-view="${lesson.isCareer ? "career" : "learn"}">← ${lesson.isCareer ? `Chuyên ngành ${escapeHtml(lesson.trackName)}` : `Lộ trình ${lesson.level}`}</button><div><small>${lesson.isCareer ? `${escapeHtml(lesson.levelRange)} · NGÀY ${lesson.day}/7` : lesson.level} · ${escapeHtml(lesson.primarySkill || "ENGLISH").toUpperCase()} · ${lesson.minutes} PHÚT · +${lesson.xp} XP</small><h2>${escapeHtml(lesson.title)}</h2><p>${escapeHtml(lesson.canDo)}</p></div><span class="${state.completed[lesson.id] ? "done" : ""}">${state.completed[lesson.id] ? "Đã hoàn thành" : "Đang học"}</span></header>
      <div class="hhe-lesson-grid"><main><section class="hhe-objective"><small>CAN DO</small><strong>Sau bài này, bạn có thể:</strong><p>${escapeHtml(lesson.canDo)}</p></section>
      ${lesson.adaptive ? `<section class="hhe-adaptive-note"><span>✦</span><div><small>ADAPTIVE LESSON</small><strong>Bài này được tạo lại theo hồ sơ học hiện tại</strong><p>${escapeHtml(lesson.adaptiveRationale)}. Bạn có thể đổi hồ sơ tại trang Chuyên ngành để nhận bộ từ và tình huống khác.</p></div><button type="button" data-hhe-view="career">Điều chỉnh</button></section>` : ""}
      <section class="hhe-lesson-block"><header><span>01</span><div><small>TỪ VỰNG</small><h3>Nghe, đọc và lưu từ</h3></div><button type="button" data-hhe-speak="${escapeHtml(lesson.vocabulary.map((item) => item[0]).join(", "))}">▶ Nghe tất cả</button></header><div class="hhe-vocab-grid">${lesson.vocabulary.map((item) => `<article><div><strong>${escapeHtml(item[0])}</strong><span>${escapeHtml(item[1])}</span></div><p>${escapeHtml(item[2])}</p><small>${escapeHtml(item[3])}</small><footer><button type="button" title="Nghe phát âm" data-hhe-speak="${escapeHtml(item[0])}">♪</button><button type="button" class="${state.savedWords[item[0]] ? "saved" : ""}" data-hhe-save-word="${escapeHtml(item[0])}" data-hhe-word-json="${encodeURIComponent(JSON.stringify(item))}">${state.savedWords[item[0]] ? "★ Đã lưu" : "☆ Lưu từ"}</button></footer></article>`).join("")}</div></section>
      <section class="hhe-lesson-block"><header><span>02</span><div><small>NGỮ PHÁP</small><h3>Mẫu câu trọng tâm</h3></div></header><div class="hhe-grammar"><p>${escapeHtml(lesson.grammar)}</p><button type="button" data-hhe-speak="${escapeHtml(lesson.dialogue.replace(/\n/g, " "))}">▶ Nghe hội thoại</button></div><pre class="hhe-dialogue">${escapeHtml(lesson.dialogue)}</pre></section>
      ${lesson.project ? `<section class="hhe-career-project"><small>CAPSTONE TASK</small><h3>Dự án cuối tuần</h3><p>${escapeHtml(lesson.project)}</p><ol><li>Nêu bối cảnh và người nghe.</li><li>Dùng ít nhất 8 thuật ngữ trong lộ trình.</li><li>Trình bày rủi ro, lựa chọn và bước tiếp theo.</li></ol></section>` : ""}
      <section class="hhe-lesson-block"><header><span>03</span><div><small>LUYỆN TẬP</small><h3>Hiểu câu trả lời của bạn</h3></div></header><form class="hhe-exercises" data-hhe-exercises>${lesson.exercises.map((question, index) => `<fieldset data-question="${question.id}"><legend><span>${index + 1}</span>${escapeHtml(question.prompt)}</legend>${question.type === "fill-in-the-blank" ? `<input type="text" name="${question.id}" value="${escapeHtml(answers[question.id] || "")}" autocomplete="off" placeholder="Nhập câu trả lời...">` : `<div>${question.options.map((option) => `<label><input type="radio" name="${question.id}" value="${escapeHtml(option)}" ${answers[question.id] === option ? "checked" : ""}><span>${escapeHtml(option)}</span></label>`).join("")}</div>`}<p data-feedback hidden></p></fieldset>`).join("")}<button class="primary" type="submit">Chấm bài và giải thích</button></form></section></main>
      <aside><section><small>TIẾN ĐỘ BÀI</small><strong data-hhe-lesson-progress>${state.completed[lesson.id] ? "100%" : "0%"}</strong><i data-hhe-lesson-progress-bar style="--p:${state.completed[lesson.id] ? 100 : 0}%"></i></section><section><small>HỌC HIỆU QUẢ</small><p>Nghe mẫu ít nhất hai lần, đọc thành tiếng, rồi mới làm bài tập.</p></section><section><small>QUYỀN RIÊNG TƯ</small><p>Tiến độ bài học được lưu trên thiết bị này.</p></section></aside></div></section>`;
  };

  const placementAdvice = {
    A0: "Bắt đầu từ âm, từ và câu nền tảng để xây móng chắc.", A1: "Bạn có thể học các tình huống giao tiếp cơ bản hằng ngày.",
    A2: "Bạn sẵn sàng kể trải nghiệm, nói kế hoạch và xử lý tình huống quen thuộc.", B1: "Bạn có thể phát triển giao tiếp độc lập trong học tập và công việc.",
    B2: "Bạn sẵn sàng luyện tranh luận, văn bản phức tạp và giao tiếp chuyên nghiệp.", C1: "Bạn có thể tập trung vào lập luận học thuật, sắc thái và độ linh hoạt.",
    C2: "Bạn đã ở vùng thành thạo; hãy luyện tổng hợp phản biện và độ chính xác tinh tế."
  };
  const placementView = (state) => `<section class="hhe-placement"><header class="hhe-section-head"><div><small>${placementQuestions.length} CÂU · 18 PHÚT</small><h2>Kiểm tra xếp lớp A0–C2</h2><p>Bài chẩn đoán tăng dần độ khó, dùng để gợi ý điểm bắt đầu. Đây không phải chứng chỉ CEFR được kiểm định.</p></div>${state.placement ? `<span>Kết quả gần nhất: ${state.placement.level}</span>` : ""}</header><section class="hhe-placement-note"><strong>Không cần đoán hết</strong><p>Nếu phần cuối quá khó, bạn có thể chọn đáp án tốt nhất. Sau khi nhận gợi ý, mọi cấp vẫn mở để tự học.</p></section><form data-hhe-placement>${placementQuestions.map((question, index) => `<fieldset><legend><span>${String(index + 1).padStart(2, "0")}</span><div><small>${question[0]}</small>${escapeHtml(question[1])}</div>${question[4] ? `<button type="button" data-hhe-speak="${escapeHtml(question[4])}" aria-label="Nghe câu ${index + 1}">▶ Nghe</button>` : ""}</legend><div>${question[2].map((option, optionIndex) => `<label><input type="radio" name="placement-${index}" value="${optionIndex}"><span>${escapeHtml(option)}</span></label>`).join("")}</div></fieldset>`).join("")}<button class="primary" type="submit">Xem kết quả và lộ trình</button></form>${state.placement ? `<section class="hhe-result"><div><small>TRÌNH ĐỘ GỢI Ý</small><strong>${state.placement.level}</strong><span>${state.placement.score}/${state.placement.total || 16} câu đúng</span></div><div><h3>${escapeHtml(placementAdvice[state.placement.level] || placementAdvice.A0)}</h3><p>Điểm mạnh: ${escapeHtml(state.placement.strength)}. Cần cải thiện: ${escapeHtml(state.placement.improve)}.</p><button class="primary" type="button" data-hhe-level="${state.placement.level}">Mở lộ trình ${state.placement.level}</button></div></section>` : ""}</section>`;

  const vocabularyView = (state) => {
    const words = Object.values(state.savedWords); const due = words.filter((item) => !state.reviewQueue[item.word]?.dueAt || new Date(state.reviewQueue[item.word].dueAt) <= new Date());
    const career = careerTrackById(selectedCareerId(state));
    const sourceLesson = nextCareerLesson(state, career?.id);
    const recommended = selectCareerVocabulary(state, career?.id, sourceLesson?.day || 1, 12);
    return `<section class="hhe-vocabulary"><header class="hhe-section-head"><div><small>PERSONAL WORD BANK</small><h2>Sổ từ và ôn thông minh</h2><p>Lưu từ từ bài học, đánh dấu mức nhớ và nhận lịch ôn tiếp theo.</p></div><span>${due.length} từ cần ôn</span></header>
      ${voiceStudioMarkup(state, recommended[0]?.[3] || recommended[0]?.[0] || "Welcome to HH English.", true)}
      ${career && recommended.length ? `<section class="hhe-career-vocab-pack" style="--career:${career.color}"><header><div><small>GỢI Ý CHO ${escapeHtml(career.code)}</small><h3>Bộ 12 từ dành riêng cho bạn</h3><p>${escapeHtml(career.viName)} · ${escapeHtml(careerStageLabels[state.careerProfile.roleStage])} · trọng tâm ${escapeHtml(skillLabels[state.careerProfile.skillFocus]).toLowerCase()}</p></div><button type="button" data-hhe-save-career-pack="12">Lưu cả bộ vào sổ</button></header><div>${recommended.map((entry) => `<article class="${state.savedWords[entry[0]] ? "saved" : ""}"><button type="button" data-hhe-speak="${escapeHtml(entry[0])}">♪</button><div><strong>${escapeHtml(entry[0])}</strong><span>${escapeHtml(entry[2])}</span><small>${escapeHtml(entry[4]?.tier || "specialist")} · ${escapeHtml((entry[4]?.skills || []).map((skill) => skillLabels[skill] || skill).join(", "))}</small></div><button type="button" data-hhe-save-word="${escapeHtml(entry[0])}" data-hhe-word-json="${encodeURIComponent(JSON.stringify(entry))}">${state.savedWords[entry[0]] ? "★" : "☆"}</button></article>`).join("")}</div></section>` : ""}
      ${words.length ? `<div class="hhe-review-card" data-hhe-review><div><small>ÔN TIẾP THEO</small><strong>${escapeHtml((due[0] || words[0]).word)}</strong><span>${escapeHtml((due[0] || words[0]).ipa)}</span><p data-hhe-review-answer hidden>${escapeHtml((due[0] || words[0]).meaning)}<br><small>${escapeHtml((due[0] || words[0]).example)}</small></p></div><button type="button" data-hhe-reveal>Hiện nghĩa</button><footer hidden>${[["again", "Quên"], ["hard", "Khó"], ["good", "Nhớ"], ["easy", "Rất dễ"]].map(([id, label]) => `<button type="button" data-hhe-rate="${id}" data-word="${escapeHtml((due[0] || words[0]).word)}">${label}</button>`).join("")}</footer></div><div class="hhe-word-list">${words.map((item) => `<article><button type="button" data-hhe-speak="${escapeHtml(item.word)}">♪</button><div><strong>${escapeHtml(item.word)}</strong><span>${escapeHtml(item.ipa)} · ${escapeHtml(item.meaning)}</span><small>${escapeHtml(item.example)}</small></div><button type="button" data-hhe-remove-word="${escapeHtml(item.word)}">Xóa</button></article>`).join("")}</div>` : `<div class="hhe-empty"><span>◇</span><h3>Sổ từ đang trống</h3><p>HH đã chuẩn bị bộ từ chuyên ngành ở phía trên. Bạn có thể lưu cả bộ hoặc từng từ để bắt đầu ôn.</p><button class="primary" type="button" data-hhe-view="career">Mở chuyên ngành</button></div>`}</section>`;
  };

  const speakingView = (state) => {
    const levelId = selectedLevelId(state); const prompt = levelById(levelId).speaking;
    const scenario = speakingScenarios.find((item) => item.id === state.speakingScenario) || speakingScenarios[0];
    const phrase = scenario.phrase;
    const attempts = Array.isArray(state.speakingAttempts) ? state.speakingAttempts.filter((item) => item.level === levelId).slice(0, 4) : [];
    return `<section class="hhe-speaking"><header class="hhe-section-head"><div><small>${levelId} · LISTEN & SPEAK COACH</small><h2>Nghe nhiều giọng, nhại theo và dùng ngay</h2><p>Một phiên học hoàn chỉnh gồm nghe đối chiếu vùng giọng, shadowing, nhận dạng từ đã nói và chép chính tả. Phản hồi là gợi ý luyện tập, không phải điểm phát âm chuyên gia.</p></div><span>${attempts.length} lượt gần đây</span></header>
      <section class="hhe-speaking-flow"><article class="active"><b>01</b><span><strong>Nghe</strong><small>Anh-Mỹ / Anh-Anh</small></span></article><i></i><article><b>02</b><span><strong>Nhại</strong><small>Shadowing theo cụm</small></span></article><i></i><article><b>03</b><span><strong>Đối chiếu</strong><small>Từ nhận dạng được</small></span></article><i></i><article><b>04</b><span><strong>Ứng dụng</strong><small>Chép và nói tự do</small></span></article></section>
      ${voiceStudioMarkup(state, phrase)}
      <section class="hhe-scenario-picker"><header><div><small>REAL-WORLD ROLE PLAY</small><h3>Chọn tình huống muốn luyện</h3><p>Mỗi lựa chọn cập nhật ngay câu luyện và mở đầy đủ công cụ phía dưới.</p></div><span>${escapeHtml(levelId)} · 6 tình huống</span></header><div>${speakingScenarios.map((item) => `<button type="button" class="${item.id === scenario.id ? "active" : ""}" data-hhe-speaking-scenario="${item.id}"><b>${item.icon}</b><span><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(item.context)}</small></span><i>${item.id === scenario.id ? "Đang học" : "Mở →"}</i></button>`).join("")}</div></section>
      <div class="hhe-speaking-lab-grid"><section class="hhe-shadowing-card"><header><span>02</span><div><small>SHADOWING COACH</small><h3>Nghe theo cụm, rồi nói liền mạch</h3></div></header><div class="hhe-phrase-card"><small>${escapeHtml(scenario.title.toUpperCase())}</small><strong data-hhe-speaking-phrase>${escapeHtml(phrase)}</strong><span>${escapeHtml(prompt.ipa || "Nghe nhịp và trọng âm của cả cụm, không đọc từng từ rời.")}</span></div><ol><li><b>1</b><span>Nghe chậm một lượt</span><button type="button" data-hhe-speak="${escapeHtml(phrase)}" data-hhe-speak-rate="0.65">Phát chậm</button></li><li><b>2</b><span>Nghe tốc độ tự nhiên</span><button type="button" data-hhe-speak="${escapeHtml(phrase)}">Phát chuẩn</button></li><li><b>3</b><span>Nói lại và nhận transcript</span><button class="primary" type="button" data-hhe-recognize data-hhe-target="${escapeHtml(phrase)}">Bắt đầu nói</button></li></ol><output data-hhe-transcript>Transcript và mức khớp từ sẽ xuất hiện tại đây.</output><div class="hhe-pron-score" data-hhe-pron-score hidden></div></section>
      <section class="hhe-dictation-card"><header><span>03</span><div><small>LISTENING DICTATION</small><h3>Nghe mà không nhìn đáp án</h3></div></header><p>Phát câu bằng giọng đã chọn, nhập những gì bạn nghe được rồi xem từng từ còn thiếu.</p><button type="button" data-hhe-speak="${escapeHtml(phrase)}">▶ Phát câu bí mật</button><form data-hhe-dictation data-answer="${escapeHtml(phrase)}"><label><span>Nhập câu nghe được</span><textarea name="dictation" autocomplete="off" spellcheck="false" placeholder="Type what you hear..."></textarea></label><button class="primary" type="submit">Kiểm tra từng từ</button><output data-hhe-dictation-feedback></output></form><aside><small>CÂU THEO CẤP ${levelId}</small><strong>${escapeHtml(prompt.phrase)}</strong><button type="button" data-hhe-speak="${escapeHtml(prompt.phrase)}">Nghe câu CEFR hôm nay</button></aside></section></div>
      <section class="hhe-speaking-grid hhe-recording-zone"><section class="hhe-recorder"><div class="hhe-mic"><i></i><span>MIC</span></div><h3>Nghe lại chính giọng của bạn</h3><p>Trình duyệt chỉ xin quyền micro khi bạn bấm ghi. Bản ghi không được tải lên máy chủ.</p><div><button class="primary" type="button" data-hhe-record>● Bắt đầu ghi</button><button type="button" data-hhe-stop disabled>■ Dừng</button><button type="button" data-hhe-delete-record disabled>Xóa</button></div><audio data-hhe-audio controls hidden></audio><small data-hhe-record-status>Sẵn sàng.</small></section><section class="hhe-attempt-history"><small>PHẢN HỒI GẦN ĐÂY</small><h3>Tiến bộ qua từng lần nói</h3>${attempts.length ? `<div>${attempts.map((item) => `<article><b>${item.score}%</b><span><strong>${escapeHtml(item.scenario)}</strong><small>${escapeHtml(item.transcript)}</small></span><time>${new Date(item.createdAt).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}</time></article>`).join("")}</div>` : `<p>Chưa có lượt nhận dạng nào. Bấm “Bắt đầu nói” ở Shadowing Coach để lưu lần luyện đầu tiên.</p>`}</section></section>
    </section>`;
  };

  const writingView = (state) => {
    const levelId = selectedLevelId(state); const level = levelById(levelId); const prompt = level.writing; const draft = writingDraftFor(state, levelId);
    const history = state.writingHistory.filter((item) => (item.level || "A0") === levelId);
    return `<section class="hhe-writing"><header class="hhe-section-head"><div><small>${levelId} · WRITING DESK</small><h2>Viết đúng mục đích và trình độ</h2><p>Bản nháp riêng cho từng cấp độ được tự lưu trên thiết bị. Checklist là công cụ tự kiểm tra, không phải đánh giá của giáo viên.</p></div></header><div class="hhe-writing-grid"><aside><small>ĐỀ BÀI ${levelId}</small><h3>${escapeHtml(prompt.title)}</h3><p>${escapeHtml(prompt.description)}</p><ul>${prompt.hints.map((hint) => `<li>${escapeHtml(hint)}</li>`).join("")}</ul></aside><main><textarea data-hhe-writing data-level="${levelId}" placeholder="Bắt đầu bài viết ${levelId} tại đây...">${escapeHtml(draft)}</textarea><footer><span><b data-hhe-word-count>${draft.trim() ? draft.trim().split(/\s+/).length : 0}</b> từ · Tự động lưu</span><div><button type="button" data-hhe-clear-writing>Xóa</button><button class="primary" type="button" data-hhe-submit-writing>Lưu bài viết</button></div></footer><section class="hhe-writing-check"><strong>Checklist trước khi lưu</strong><label><input type="checkbox"> Tôi trả lời đúng trọng tâm đề bài.</label><label><input type="checkbox"> Tôi dùng từ nối và đoạn văn phù hợp cấp ${levelId}.</label><label><input type="checkbox"> Tôi đã đọc lại để sửa lỗi và sắc thái.</label></section></main></div>${history.length ? `<section class="hhe-writing-history"><h3>Lịch sử bài viết ${levelId}</h3>${history.slice(0, 5).map((item) => `<article><span>${new Date(item.createdAt).toLocaleString("vi-VN")}</span><p>${escapeHtml(item.body)}</p><b>${item.words} từ · ${item.status}</b></article>`).join("")}</section>` : ""}</section>`;
  };

  const progressView = (state) => {
    const levelId = selectedLevelId(state); const selectedDone = completedCount(state, levelId); const selectedTotal = levelLessonIds(levelId).length; const done = completedCount(state); const practice = levelPractice(state, levelId);
    const activity = Array.from({ length: 7 }, (_, offset) => { const date = new Date(Date.now() - (6 - offset) * 86400000).toISOString().slice(0, 10); return [date, state.minutesByDay[date] || 0]; });
    const achievements = [
      ["first-step", "Bước đầu tiên", "Hoàn thành một bài học", done >= 1, `${Math.min(done, 1)}/1`],
      ["word-collector", "Nhà sưu tầm từ", "Lưu 5 từ vào sổ", Object.keys(state.savedWords).length >= 5, `${Math.min(Object.keys(state.savedWords).length, 5)}/5`],
      ["focused", "Học tập trung", "Đạt 100 XP", state.xp >= 100, `${Math.min(state.xp, 100)}/100 XP`],
      ["explorer", "Hiểu bản thân", "Hoàn thành bài xếp lớp", Boolean(state.placement), state.placement ? "Đã mở" : "Chưa mở"],
      ["writer", "Tác giả trẻ", "Lưu bài viết đầu tiên", state.writingHistory.length >= 1, `${Math.min(state.writingHistory.length, 1)}/1`],
      ["all-rounder", `Toàn diện ${levelId}`, "Hoàn thành 3 bài luyện kỹ năng của cấp đang học", Object.values(practice).every((score) => score >= 100), `${Object.values(practice).filter((score) => score >= 100).length}/3`],
      ["level-complete", `Chinh phục ${levelId}`, `Hoàn thành toàn bộ cấp ${levelId}`, selectedDone === selectedTotal, `${selectedDone}/${selectedTotal}`]
    ];
    const lessonPercent = selectedTotal ? selectedDone / selectedTotal * 100 : 0; const levelWritingCount = state.writingHistory.filter((item) => (item.level || "A0") === levelId).length;
    const skillValues = [["Nghe", Math.max(lessonPercent, practice.listening)], ["Nói", Math.min(100, lessonPercent * 0.8)], ["Đọc", Math.max(lessonPercent, practice.reading)], ["Viết", Math.min(100, levelWritingCount * 20 + lessonPercent * 0.4)], ["Ngữ pháp", Math.max(lessonPercent, practice.grammar)]];
    return `<section class="hhe-progress"><header class="hhe-section-head"><div><small>${levelId} · LEARNER ANALYTICS</small><h2>Tiến bộ từ A0 đến C2</h2><p>Số liệu được lưu trên thiết bị và tách riêng theo từng cấp độ.</p></div><span>Cấp XP ${Math.floor(state.xp / 300) + 1}</span></header><div class="hhe-progress-cards"><article><span>Bài ${levelId}</span><strong>${selectedDone}/${selectedTotal}</strong></article><article><span>Toàn lộ trình</span><strong>${done}/${lessonIds.length}</strong></article><article><span>XP tích lũy</span><strong>${state.xp}</strong></article><article><span>Điểm xếp lớp</span><strong>${state.placement ? `${state.placement.score}/${state.placement.total || 16}` : "--"}</strong></article></div><section class="hhe-level-progress-list"><header><div><small>CEFR ROADMAP</small><h3>Tiến độ từng cấp</h3></div><span>Chọn cấp để xem chi tiết</span></header><div>${courseLevels.map((item) => `<button type="button" class="${item.id === levelId ? "active" : ""}" data-hhe-level="${item.id}" style="--level:${item.color}"><b>${item.id}</b><span><strong>${escapeHtml(item.name)}</strong><i style="--p:${levelProgress(state, item.id)}%"></i></span><small>${levelProgress(state, item.id)}%</small></button>`).join("")}</div></section><section class="hhe-week"><header><h3>Hoạt động 7 ngày</h3><span>Mục tiêu ${state.dailyGoal} phút/ngày</span></header><div>${activity.map(([date, minutes]) => `<i style="--h:${Math.max(5, Math.min(100, minutes / state.dailyGoal * 100))}%"><b>${minutes}</b><span>${new Date(date).toLocaleDateString("vi-VN", { weekday: "short" })}</span></i>`).join("")}</div></section><section class="hhe-skill-progress">${skillValues.map(([label, value]) => `<div><span>${label}</span><i style="--p:${Math.min(100, Math.round(value))}%"></i><b>${Math.min(100, Math.round(value))}%</b></div>`).join("")}</section><section class="hhe-achievements"><header><div><small>THÀNH TÍCH</small><h3>Các cột mốc học tập</h3></div><span>${achievements.filter((item) => item[3]).length}/${achievements.length} đã mở</span></header><div>${achievements.map(([id, title, description, unlocked, progress]) => `<article class="${unlocked ? "unlocked" : "locked"}" data-achievement="${id}"><span>${unlocked ? "◆" : "◇"}</span><div><strong>${title}</strong><p>${description}</p></div><small>${progress}</small></article>`).join("")}</div></section></section>`;
  };

  const settingsView = (state) => `<section class="hhe-settings"><header class="hhe-section-head"><div><small>LEARNING PREFERENCES</small><h2>Cài đặt HH English</h2><p>Tùy chỉnh cấp độ, chuyên ngành, mục tiêu, hướng dẫn người mới, tốc độ giọng đọc và dữ liệu học tập.</p></div><button type="button" data-hhe-onboarding-open>Mở Smart Start</button></header><form data-hhe-settings><label><span>Cấp độ đang học<small>Mọi cấp từ A0 đến C2 đều có thể chọn</small></span><select name="selectedLevel">${courseLevels.map((level) => `<option value="${level.id}" ${selectedLevelId(state) === level.id ? "selected" : ""}>${level.id} · ${escapeHtml(level.name)}</option>`).join("")}</select></label><label><span>Chuyên ngành đang học<small>${careerTracks.length} lộ trình nghề nghiệp đều mở miễn phí</small></span><select name="selectedCareer">${careerTracks.map((item) => `<option value="${item.id}" ${selectedCareerId(state) === item.id ? "selected" : ""}>${escapeHtml(item.code)} · ${escapeHtml(item.viName)}</option>`).join("")}</select></label><label><span>Bạn đang là<small>Giúp nội dung gợi ý phù hợp nhịp sống</small></span><select name="learnerType"><option value="student" ${state.settings.learnerType === "student" ? "selected" : ""}>Học sinh / sinh viên</option><option value="worker" ${state.settings.learnerType === "worker" ? "selected" : ""}>Người đi làm</option><option value="independent" ${state.settings.learnerType === "independent" ? "selected" : ""}>Người tự học linh hoạt</option></select></label><label><span>Mục tiêu học<small>Hiển thị trong kế hoạch cá nhân</small></span><select name="goal">${["Giao tiếp hằng ngày", "Học tập và thi cử", "Du lịch", "Công việc", "Xây nền từ mất gốc", "Học thuật C1-C2", "Tiếng Anh chuyên ngành"].map((goal) => `<option ${state.settings.goal === goal ? "selected" : ""}>${goal}</option>`).join("")}</select></label><label><span>Mục tiêu mỗi ngày<small>5–60 phút; có thể học lại không giới hạn</small></span><input type="number" name="dailyGoal" min="5" max="60" step="5" value="${state.dailyGoal}"></label><label><span>Tốc độ giọng đọc<small>Chậm 0.6× · Bình thường 1×</small></span><input type="range" name="voiceRate" min="0.6" max="1.2" step="0.05" value="${state.settings.voiceRate}"><output>${state.settings.voiceRate}×</output></label><label><span>Chế độ người mới<small>Hiện checklist và lời giải thích ngắn trên trang tổng quan</small></span><input type="checkbox" name="beginnerMode" ${state.settings.beginnerMode ? "checked" : ""}></label><label><span>Giảm chuyển động<small>Tôn trọng khả năng tập trung và prefers-reduced-motion</small></span><input type="checkbox" name="reducedMotion" ${state.settings.reducedMotion ? "checked" : ""}></label><button class="primary" type="submit">Lưu cài đặt</button></form><section class="hhe-data-tools"><div><h3>Dữ liệu cá nhân</h3><p>Xuất bản sao JSON hoặc nhập lại trên thiết bị khác.</p></div><button type="button" data-hhe-export>Xuất JSON</button><label>Nhập JSON<input type="file" accept="application/json" data-hhe-import></label><button class="danger" type="button" data-hhe-reset>Xóa toàn bộ dữ liệu học</button></section><section class="hhe-sources"><h3>Nguồn học miễn phí được tuyển chọn</h3><a href="https://learnenglish.britishcouncil.org/" target="_blank" rel="noopener">British Council · LearnEnglish</a><a href="https://www.cambridgeenglish.org/learning-english/" target="_blank" rel="noopener">Cambridge English · Free activities</a><a href="https://learningenglish.voanews.com/" target="_blank" rel="noopener">VOA · Learning English</a><a href="https://www.coe.int/en/web/common-european-framework-reference-languages" target="_blank" rel="noopener">Council of Europe · CEFR</a><a href="https://www.onetonline.org/find/career?c=0" target="_blank" rel="noopener">O*NET · Career Clusters</a><a href="https://esco.ec.europa.eu/en/classification" target="_blank" rel="noopener">ESCO · Skills & occupations</a><a href="https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API" target="_blank" rel="noopener">MDN · Web Speech API</a></section></section>`;

  const focusCurrentView = () => root.requestAnimationFrame?.(() => {
    const heading = host?.querySelector(".hhe-main h2, .hhe-main h3");
    heading?.scrollIntoView?.({ behavior: "auto", block: "start" });
    heading?.setAttribute?.("tabindex", "-1");
    heading?.focus?.({ preventScroll: true });
  });
  const render = (options = {}) => {
    if (!host) return;
    const shouldFocus = options === true || Boolean(options.focusView) || focusAfterRender;
    focusAfterRender = false;
    const state = readState(); let content = "";
    if (state.activeView === "plan") content = smartPlanView(state);
    else if (state.activeView === "learn") content = learnView(state);
    else if (state.activeView === "career") content = careerView(state);
    else if (state.activeView === "survey") content = careerSurveyView(state);
    else if (state.activeView === "practice") content = practiceView(state);
    else if (state.activeView === "lesson") content = lessonView(state, lessonForState(state, state.activeLesson));
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
    host.querySelector("[data-hhe-career-search]")?.addEventListener("input", filterCareerTracks);
    host.querySelector("[data-hhe-navigator-search]")?.addEventListener("input", filterNavigator);
    host.querySelector('[name="voiceRate"]')?.addEventListener("input", (event) => { event.target.nextElementSibling.textContent = `${event.target.value}×`; });
    updateFocusClock();
    if (shouldFocus) focusCurrentView();
  };

  const updateSurveyProgress = (form) => {
    if (!form) return;
    const hasSituation = Boolean(new FormData(form).get("situation"));
    const hasCategory = new FormData(form).getAll("categories").length > 0;
    const steps = form.querySelectorAll(".hhe-survey-progress span");
    steps.forEach((step, index) => {
      const done = index === 0 ? hasSituation : index === 1 ? hasCategory : index === 2 ? hasSituation && hasCategory : false;
      step.classList.toggle("done", done);
      step.classList.toggle("active", index === (hasSituation ? hasCategory ? 2 : 1 : 0));
    });
    const status = form.querySelector("[data-hhe-survey-status]");
    if (status) status.textContent = !hasSituation ? "Chọn giai đoạn để tiếp tục" : !hasCategory ? "Chọn ít nhất một lĩnh vực" : "Đã đủ thông tin · sẵn sàng tạo bài học";
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
    const state = readState(); const levelId = event.target.dataset.level || selectedLevelId(state); state.writingDrafts[levelId] = event.target.value; if (levelId === "A0") state.writingDraft = event.target.value; writeState(state);
    const count = event.target.value.trim() ? event.target.value.trim().split(/\s+/).length : 0; const counter = host.querySelector("[data-hhe-word-count]"); if (counter) counter.textContent = count;
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
  const filterCareerTracks = () => {
    const query = foldSearch(host?.querySelector("[data-hhe-career-search]")?.value || ""); let visibleCount = 0;
    host?.querySelectorAll("[data-hhe-career-card]").forEach((card) => {
      const categoryMatches = activeCareerCategory === "all" || card.dataset.category === activeCareerCategory;
      const queryMatches = !query || foldSearch(card.dataset.search).includes(query);
      card.hidden = !(categoryMatches && queryMatches); visibleCount += card.hidden ? 0 : 1;
    });
    const empty = host?.querySelector("[data-hhe-career-empty]"); if (empty) empty.hidden = visibleCount > 0;
  };
  const filterNavigator = (event) => {
    const query = foldSearch(event?.target?.value || "");
    host?.querySelectorAll("[data-hhe-navigator-item]").forEach((item) => { item.hidden = Boolean(query) && !item.dataset.hheNavigatorItem.includes(query); });
    host?.querySelectorAll("[data-hhe-navigator-group]").forEach((group) => { group.hidden = !group.querySelector("[data-hhe-navigator-item]:not([hidden])"); });
  };
  const handleKeydown = (event) => {
    if (event.key === "Escape" && navigatorOpen) { event.preventDefault(); navigatorOpen = false; render(); return; }
    if (event.key === "Escape" && host?.querySelector("[data-hhe-onboarding]")) { event.preventDefault(); closeOnboarding(); return; }
    if (event.key !== "/" || event.ctrlKey || event.metaKey || event.altKey) return;
    const target = event.target;
    if (target?.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target?.tagName || "")) return;
    const search = host?.querySelector("[data-hhe-search], [data-hhe-career-search]");
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
  const showOnboardingStep = (form, step) => {
    const targetStep = Math.max(1, Math.min(3, Number(step) || 1));
    form.querySelectorAll("[data-hhe-onboarding-panel]").forEach((panel) => { panel.hidden = Number(panel.dataset.hheOnboardingPanel) !== targetStep; });
    form.querySelectorAll("[data-hhe-onboarding-dot]").forEach((dot) => {
      const dotStep = Number(dot.dataset.hheOnboardingDot);
      dot.classList.toggle("active", dotStep === targetStep);
      dot.classList.toggle("done", dotStep < targetStep);
    });
    form.querySelectorAll("[data-hhe-onboarding-status]").forEach((node) => { node.textContent = ""; });
    form.querySelector(`[data-hhe-onboarding-panel="${targetStep}"] h3`)?.focus?.();
  };
  const closeOnboarding = () => {
    const state = readState();
    if (!state.onboarding.completed) state.onboarding.dismissed = true;
    guideOpen = false;
    writeState(state);
    render();
  };

  const handleClick = async (event) => {
    event.stopPropagation();
    if (event.target.matches("[data-hhe-navigator-backdrop]")) { navigatorOpen = false; render(); return; }
    if (event.target.closest("[data-hhe-navigator-open]")) { navigatorOpen = true; render(); root.requestAnimationFrame?.(() => host?.querySelector("[data-hhe-navigator-search]")?.focus()); return; }
    if (event.target.closest("[data-hhe-navigator-close]")) { navigatorOpen = false; render(); return; }
    if (event.target.matches("[data-hhe-onboarding-backdrop]")) { closeOnboarding(); return; }
    if (event.target.closest("[data-hhe-onboarding-open]")) { navigatorOpen = false; guideOpen = true; render(); return; }
    if (event.target.closest("[data-hhe-onboarding-close]")) { closeOnboarding(); return; }
    const onboardingNext = event.target.closest("[data-hhe-onboarding-next]");
    if (onboardingNext) {
      const form = onboardingNext.closest("[data-hhe-onboarding]");
      const currentStep = Number(onboardingNext.closest("[data-hhe-onboarding-panel]")?.dataset.hheOnboardingPanel || 1);
      const requiredName = currentStep === 1 ? "confidence" : "goal";
      const status = onboardingNext.closest("[data-hhe-onboarding-panel]")?.querySelector("[data-hhe-onboarding-status]");
      if (!new FormData(form).get(requiredName)) {
        if (status) status.textContent = currentStep === 1 ? "Hãy chọn mô tả gần đúng nhất." : "Hãy chọn một mục tiêu chính.";
        form.elements[requiredName]?.[0]?.focus?.();
        return;
      }
      showOnboardingStep(form, onboardingNext.dataset.hheOnboardingNext);
      return;
    }
    const onboardingBack = event.target.closest("[data-hhe-onboarding-back]");
    if (onboardingBack) { showOnboardingStep(onboardingBack.closest("[data-hhe-onboarding]"), onboardingBack.dataset.hheOnboardingBack); return; }
    const voiceProfileButton = event.target.closest("[data-hhe-voice-profile]");
    if (voiceProfileButton) {
      const state = readState();
      state.settings.voiceProfile = voiceProfileById(voiceProfileButton.dataset.hheVoiceProfile).id;
      state.settings.voiceURI = "";
      writeState(state); render();
      speak("Welcome to HH English. Listen and repeat.", state.settings);
      toast(`Đã chuyển sang ${voiceProfileById(state.settings.voiceProfile).label}.`);
      return;
    }
    const speakingScenarioButton = event.target.closest("[data-hhe-speaking-scenario]");
    if (speakingScenarioButton) {
      const state = readState();
      if (!speakingScenarios.some((item) => item.id === speakingScenarioButton.dataset.hheSpeakingScenario)) return;
      state.speakingScenario = speakingScenarioButton.dataset.hheSpeakingScenario;
      writeState(state); render({ focusView: true });
      toast(`Đã mở tình huống ${speakingScenarios.find((item) => item.id === state.speakingScenario).title}.`);
      return;
    }
    const startCareerButton = event.target.closest("[data-hhe-start-career]");
    if (startCareerButton) {
      const state = readState(); const lesson = getLesson(startCareerButton.dataset.hheStartCareer);
      state.activeView = "lesson"; state.activeLesson = lesson.id;
      if (lesson.trackId) state.selectedCareer = lesson.trackId;
      writeState(state); focusAfterRender = true; if (!syncViewRoute("lesson")) render({ focusView: true });
      toast("Đã bắt đầu bài học đầu tiên trong lộ trình của bạn.");
      return;
    }
    if (event.target.closest("[data-hhe-survey-reset]")) {
      const state = readState(); state.careerSurvey = null; state.activeView = "survey"; writeState(state); render({ focusView: true }); return;
    }
    if (event.target.closest("[data-hhe-beginner-toggle]")) {
      const state = readState();
      state.settings.beginnerMode = !state.settings.beginnerMode;
      writeState(state);
      render();
      toast(state.settings.beginnerMode ? "Đã bật chế độ dễ dùng." : "Đã mở giao diện đầy đủ.");
      return;
    }
    const quickStart = event.target.closest("[data-hhe-quick-start]");
    if (quickStart) {
      const state = readState();
      if (quickStart.dataset.hheQuickStart === "foundation") {
        state.selectedLevel = "A0";
        const lesson = nextLessonFor(state, "A0");
        state.activeLesson = lesson.id;
        state.activeView = "lesson";
        state.settings.goal = "Xây nền từ mất gốc";
        state.learnerProfile = { ...state.learnerProfile, confidence: "new", focusSkill: "vocabulary" };
        writeState(state);
        render();
        toast("Đã mở bài A0 đầu tiên dành cho người mất gốc.");
        return;
      }
      state.settings.goal = "Giao tiếp hằng ngày";
      state.learnerProfile = { ...state.learnerProfile, focusSkill: "speaking" };
      state.activeView = "speaking";
      writeState(state);
      if (!syncViewRoute("speaking")) render();
      return;
    }
    const viewButton = event.target.closest("[data-hhe-view]");
    if (viewButton) { navigatorOpen = false; const state = readState(); state.activeView = viewButton.dataset.hheView; writeState(state); focusAfterRender = true; if (!syncViewRoute(state.activeView)) render({ focusView: true }); return; }
    const levelButton = event.target.closest("[data-hhe-level]");
    if (levelButton) { const state = readState(); if (!levelOrder.includes(levelButton.dataset.hheLevel)) return; state.selectedLevel = levelButton.dataset.hheLevel; state.activeView = levelButton.closest(".hhe-level-progress-list") ? "progress" : "learn"; writeState(state); if (!syncViewRoute(state.activeView)) { render(); toast(`Đã mở lộ trình ${state.selectedLevel}.`); } return; }
    const careerCategoryButton = event.target.closest("[data-hhe-career-category]");
    if (careerCategoryButton) { activeCareerCategory = careerCategoryButton.dataset.hheCareerCategory; host.querySelectorAll("[data-hhe-career-category]").forEach((button) => button.classList.toggle("active", button === careerCategoryButton)); filterCareerTracks(); return; }
    const favoriteCareerButton = event.target.closest("[data-hhe-career-favorite]");
    if (favoriteCareerButton) { const state = readState(); const id = favoriteCareerButton.dataset.hheCareerFavorite; state.favoriteCareers = state.favoriteCareers.includes(id) ? state.favoriteCareers.filter((item) => item !== id) : [...state.favoriteCareers, id]; writeState(state); render(); toast(state.favoriteCareers.includes(id) ? "Đã ghim lộ trình nghề nghiệp." : "Đã bỏ ghim lộ trình."); return; }
    const careerButton = event.target.closest("[data-hhe-career]");
    if (careerButton) { const state = readState(); if (!careerTracks.some((item) => item.id === careerButton.dataset.hheCareer)) return; state.selectedCareer = careerButton.dataset.hheCareer; state.activeView = "career"; activeCareerCategory = "all"; writeState(state); focusAfterRender = true; if (!syncViewRoute("career")) { render({ focusView: true }); toast(`Đã mở ${careerTrackById(state.selectedCareer).viName}.`); } return; }
    const lessonButton = event.target.closest("[data-hhe-open-lesson]");
    if (lessonButton) { navigatorOpen = false; const state = readState(); const lesson = getLesson(lessonButton.dataset.hheOpenLesson); state.activeView = "lesson"; state.activeLesson = lesson.id; state.selectedLevel = lesson.level || "A0"; if (lesson.trackId) state.selectedCareer = lesson.trackId; writeState(state); focusAfterRender = true; if (!syncViewRoute("lesson")) render({ focusView: true }); return; }
    const speakButton = event.target.closest("[data-hhe-speak]");
    if (speakButton) { const state = readState(); if (!speak(speakButton.dataset.hheSpeak, state.settings, { rate: Number(speakButton.dataset.hheSpeakRate) || undefined })) toast("Thiết bị này chưa hỗ trợ giọng đọc.", "error"); return; }
    const saveWord = event.target.closest("[data-hhe-save-word]");
    if (saveWord) { const state = readState(); const raw = JSON.parse(decodeURIComponent(saveWord.dataset.hheWordJson)); const word = raw[0]; const lesson = saveWord.closest("[data-hhe-lesson]") ? lessonForState(state, saveWord.closest("[data-hhe-lesson]").dataset.hheLesson) : null; if (state.savedWords[word]) delete state.savedWords[word]; else state.savedWords[word] = { word, ipa: raw[1], meaning: raw[2], example: raw[3], metadata: raw[4] || {}, level: lesson?.level || selectedLevelId(state), trackId: lesson?.trackId || selectedCareerId(state), savedAt: new Date().toISOString() }; writeState(state); render(); toast(state.savedWords[word] ? "Đã lưu vào sổ từ." : "Đã bỏ từ khỏi sổ."); return; }
    if (event.target.closest("[data-hhe-save-career-pack]")) {
      const button = event.target.closest("[data-hhe-save-career-pack]");
      const state = readState(); const lesson = personalizeCareerLesson(state, nextCareerLesson(state));
      const vocabulary = selectCareerVocabulary(state, lesson.trackId, lesson.day, Number(button.dataset.hheSaveCareerPack) || 8);
      let added = 0;
      vocabulary.forEach((entry) => {
        if (state.savedWords[entry[0]]) return;
        state.savedWords[entry[0]] = { word: entry[0], ipa: entry[1], meaning: entry[2], example: entry[3], metadata: entry[4] || {}, level: lesson.level, trackId: lesson.trackId, savedAt: new Date().toISOString() };
        added += 1;
      });
      writeState(state); render(); toast(added ? `Đã lưu ${added} từ vào sổ ôn.` : "Bộ từ này đã có trong sổ."); return;
    }
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
    if (event.target.closest("[data-hhe-submit-writing]")) { const state = readState(); const levelId = selectedLevelId(state); const body = writingDraftFor(state, levelId).trim(); if (!body) return toast("Hãy viết ít nhất một câu.", "error"); const words = body.split(/\s+/).length; state.writingHistory.unshift({ id: Date.now(), level: levelId, prompt: levelById(levelId).writing.title, body, words, status: "pending", createdAt: new Date().toISOString() }); state.xp += Math.min(30, words); updateStreak(state); state.minutesByDay[todayKey()] = (state.minutesByDay[todayKey()] || 0) + 5; writeState(state); render(); toast(`Đã lưu bài viết ${levelId} trên thiết bị.`); return; }
    if (event.target.closest("[data-hhe-clear-writing]")) { const state = readState(); const levelId = selectedLevelId(state); state.writingDrafts[levelId] = ""; if (levelId === "A0") state.writingDraft = ""; writeState(state); render(); return; }
    if (event.target.closest("[data-hhe-reset]")) { if (!confirm("Xóa toàn bộ tiến độ HH English trên thiết bị này?")) return; localStorage.removeItem(STORAGE_KEY); render(); return; }
    if (event.target.closest("[data-hhe-recognize]")) { const button = event.target.closest("[data-hhe-recognize]"); startRecognition(button.dataset.hheTarget || host.querySelector("[data-hhe-speaking-phrase]")?.textContent || ""); return; }
    if (event.target.closest("[data-hhe-record]")) { await startRecording(); return; }
    if (event.target.closest("[data-hhe-stop]")) { mediaRecorder?.stop(); return; }
    if (event.target.closest("[data-hhe-delete-record]")) { if (recordingUrl) URL.revokeObjectURL(recordingUrl); recordingUrl = ""; const audio = host.querySelector("[data-hhe-audio]"); audio.hidden = true; audio.removeAttribute("src"); event.target.disabled = true; toast("Đã xóa bản ghi."); }
  };

  const handleSubmit = (event) => {
    event.stopPropagation();
    const dictationForm = event.target.closest("[data-hhe-dictation]");
    if (dictationForm) {
      event.preventDefault();
      const answer = String(new FormData(dictationForm).get("dictation") || "");
      const target = dictationForm.dataset.answer || "";
      const result = compareTranscript(answer, target);
      const output = dictationForm.querySelector("[data-hhe-dictation-feedback]");
      output.className = result.score >= 80 ? "correct" : "wrong";
      output.innerHTML = `<strong>${result.score}% từ khớp</strong><span>${result.missed.length ? `Cần nghe lại: ${escapeHtml(result.missed.join(" · "))}` : "Bạn đã nghe đúng toàn bộ câu."}</span><small>Đáp án: ${escapeHtml(target)}</small>`;
      toast(result.score >= 80 ? "Bài chép chính tả rất tốt." : "Hãy nghe chậm rồi thử lại từng cụm.", result.score >= 80 ? "success" : "error");
      return;
    }
    const onboardingForm = event.target.closest("[data-hhe-onboarding]");
    if (onboardingForm) {
      event.preventDefault();
      const data = new FormData(onboardingForm);
      const confidence = String(data.get("confidence") || "");
      const goal = String(data.get("goal") || "");
      const focusSkill = String(data.get("focusSkill") || "speaking");
      const status = onboardingForm.querySelector('[data-hhe-onboarding-panel="3"] [data-hhe-onboarding-status]');
      if (!confidence || !goal || !skillLabels[focusSkill]) {
        if (status) status.textContent = "Hãy hoàn thành đủ 3 bước trước khi tạo kế hoạch.";
        showOnboardingStep(onboardingForm, !confidence ? 1 : !goal ? 2 : 3);
        return;
      }
      const confidenceLevels = { new: "A0", basic: "A1", rusty: "A2", confident: "B1", unsure: "A0" };
      const state = readState();
      state.selectedLevel = confidenceLevels[confidence] || state.selectedLevel;
      state.dailyGoal = Math.max(10, Math.min(30, Number(data.get("minutes")) || 15));
      state.settings.goal = goal;
      state.settings.learnerType = /Công việc|chuyên ngành/i.test(goal) ? "worker" : "student";
      state.settings.beginnerMode = true;
      state.learnerProfile = { confidence, focusSkill, needsPlacement: confidence === "unsure" };
      state.careerProfile = {
        ...state.careerProfile,
        roleStage: state.settings.learnerType === "worker" ? "starter" : "student",
        skillFocus: focusSkill,
        intensity: confidence === "confident" ? "balanced" : "foundation"
      };
      state.onboarding.completed = true;
      state.onboarding.dismissed = false;
      state.onboarding.completedAt = new Date().toISOString();
      if (!state.onboarding.rewarded) { state.xp += 10; state.onboarding.rewarded = true; }
      state.activeView = "plan";
      guideOpen = false;
      writeState(state);
      if (!syncViewRoute("plan")) { render(); toast("Kế hoạch cá nhân đã sẵn sàng · +10 XP"); }
      return;
    }
    const careerProfileForm = event.target.closest("[data-hhe-career-profile]");
    if (careerProfileForm) {
      event.preventDefault();
      const data = new FormData(careerProfileForm);
      const roleStage = String(data.get("roleStage") || "student");
      const skillFocus = String(data.get("skillFocus") || "speaking");
      const intensity = String(data.get("intensity") || "foundation");
      const state = readState();
      state.careerProfile = {
        roleStage: careerStageLabels[roleStage] ? roleStage : "student",
        skillFocus: skillLabels[skillFocus] ? skillFocus : "speaking",
        intensity: careerIntensityLabels[intensity] ? intensity : "foundation"
      };
      state.learnerProfile.focusSkill = state.careerProfile.skillFocus;
      writeState(state); render(); toast("Đã tạo lại bài và bộ từ theo hồ sơ của bạn."); return;
    }
    const exerciseForm = event.target.closest("[data-hhe-exercises]");
    if (exerciseForm) { event.preventDefault(); const state = readState(); const lesson = lessonForState(state, exerciseForm.closest("[data-hhe-lesson]").dataset.hheLesson); let correct = 0; state.attempts[lesson.id] = state.attempts[lesson.id] || {};
      lesson.exercises.forEach((question) => { const field = exerciseForm.querySelector(`[data-question="${question.id}"]`); const input = exerciseForm.elements[question.id]; const value = input instanceof RadioNodeList ? input.value : input?.value || ""; state.attempts[lesson.id][question.id] = value; const ok = normalize(value) === normalize(question.answer); correct += ok ? 1 : 0; field.classList.toggle("correct", ok); field.classList.toggle("wrong", !ok); const feedback = field.querySelector("[data-feedback]"); feedback.hidden = false; feedback.innerHTML = `<strong>${ok ? "Chính xác" : `Đáp án: ${escapeHtml(question.answer)}`}</strong><span>${escapeHtml(question.explanation)}</span>`; });
      if (correct >= 4 && !state.completed[lesson.id]) { state.completed[lesson.id] = true; state.xp += lesson.xp; updateStreak(state); state.minutesByDay[todayKey()] = (state.minutesByDay[todayKey()] || 0) + lesson.minutes; const status = host.querySelector(".hhe-lesson>header>span"); if (status) { status.textContent = "Đã hoàn thành"; status.classList.add("done"); } const progress = host.querySelector("[data-hhe-lesson-progress]"); if (progress) progress.textContent = "100%"; host.querySelector("[data-hhe-lesson-progress-bar]")?.style.setProperty("--p", "100%"); const xp = host.querySelector("[data-hhe-xp]"); if (xp) xp.textContent = state.xp; toast(`Hoàn thành ${correct}/5 · +${lesson.xp} XP`); }
      else toast(correct >= 4 ? `Bạn đã hoàn thành trước đó · ${correct}/5` : `${correct}/5 đúng. Đọc giải thích rồi thử lại.`, correct >= 4 ? "success" : "error"); writeState(state); return; }
    const practiceForm = event.target.closest("[data-hhe-practice]");
    if (practiceForm) { event.preventDefault(); const skill = practiceForm.dataset.hhePractice; const answer = new FormData(practiceForm).get("answer") || ""; const correct = normalize(answer) === normalize(practiceForm.dataset.answer); const feedback = practiceForm.querySelector("[data-hhe-practice-feedback]"); feedback.className = correct ? "correct" : "wrong"; feedback.innerHTML = `<strong>${correct ? "Chính xác" : `Đáp án đúng: ${escapeHtml(practiceForm.dataset.answer)}`}</strong><span>${escapeHtml(practiceForm.dataset.explanation || "Hãy đối chiếu lại nội dung và thử thêm một lần.")}</span>`; const state = readState(); const levelId = selectedLevelId(state); const current = levelPractice(state, levelId); if (correct && current[skill] < 100) { current[skill] = 100; state.practiceByLevel[levelId] = current; if (levelId === "A0") state.practice = { ...current }; state.xp += 10; state.minutesByDay[todayKey()] = (state.minutesByDay[todayKey()] || 0) + 3; updateStreak(state); writeState(state); const xp = host.querySelector("[data-hhe-xp]"); if (xp) xp.textContent = state.xp; toast(`Hoàn thành bài luyện ${levelId} · +10 XP`); } else toast(correct ? "Bạn đã hoàn thành bài luyện này." : "Chưa đúng. Hãy đọc giải thích rồi thử lại.", correct ? "success" : "error"); return; }
    const careerSurveyForm = event.target.closest("[data-hhe-career-survey]");
    if (careerSurveyForm) {
      event.preventDefault(); const data = new FormData(careerSurveyForm); const categories = data.getAll("categories");
      if (!categories.length) return toast("Hãy chọn ít nhất một lĩnh vực bạn quan tâm.", "error");
      const goal = String(data.get("goal") || "Giao tiếp tại nơi làm việc"); const situation = String(data.get("situation") || "student"); const skill = String(data.get("skill") || "speaking");
      const level = levelOrder.includes(String(data.get("level"))) ? String(data.get("level")) : "A0"; const minutes = Math.max(10, Math.min(45, Number(data.get("minutes")) || 15));
      const goalBoosts = {
        "Xin việc và phỏng vấn": ["human-resources", "business-management", "customer-service-retail"],
        "Giao tiếp tại nơi làm việc": ["business-management", "customer-service-retail", "it-support", "tourism-hospitality"],
        "Đọc tài liệu chuyên môn": ["science-research", "software-development", "data-ai", "law-public-service"],
        "Họp và thuyết trình": ["business-management", "marketing-sales", "engineering-manufacturing", "human-resources"],
        "Làm việc với khách hàng quốc tế": ["customer-service-retail", "marketing-sales", "tourism-hospitality", "real-estate"],
        "Du học hoặc nghiên cứu": ["science-research", "teaching-education", "data-ai", "nursing-healthcare"]
      };
      const levelIndex = levelOrder.indexOf(level);
      const ranked = careerTracks.filter((item) => categories.includes(item.category)).map((item, index) => {
        const minLevel = item.level.split("-")[0]; const distance = Math.abs(levelOrder.indexOf(minLevel) - levelIndex);
        const goalScore = Math.max(0, 8 - (goalBoosts[goal] || []).indexOf(item.id) * 2);
        return { item, score: (goalBoosts[goal] || []).includes(item.id) ? goalScore : 0, distance, index };
      }).sort((a, b) => b.score - a.score || a.distance - b.distance || a.index - b.index);
      const recommendations = ranked.slice(0, 3).map(({ item }) => item.id);
      const state = readState(); state.selectedLevel = level; state.selectedCareer = recommendations[0] || careerTracks[0]?.id || ""; state.dailyGoal = minutes;
      const roleStage = { student: "student", starter: "starter", switcher: "starter", professional: "specialist" }[situation] || "student";
      state.careerProfile = {
        roleStage,
        skillFocus: skillLabels[skill] ? skill : "speaking",
        intensity: ["B2", "C1", "C2"].includes(level) || roleStage === "specialist" ? "advanced" : roleStage === "starter" ? "balanced" : "foundation"
      };
      state.learnerProfile.focusSkill = state.careerProfile.skillFocus;
      state.careerSurvey = { situation, categories, goal, skill, minutes, level, recommendations, summary: `Ưu tiên ${goal.toLowerCase()}, kỹ năng ${skill} và nhịp học ${minutes} phút mỗi ngày ở cấp ${level}.`, takenAt: new Date().toISOString() };
      if (!state.careerSurveyRewarded) { state.xp += 15; state.careerSurveyRewarded = true; }
      writeState(state); render({ focusView: true }); toast("Đã tạo lộ trình. Bài học đầu tiên đã sẵn sàng ở đầu trang · +15 XP"); return;
    }
    const placementForm = event.target.closest("[data-hhe-placement]");
    if (placementForm) { event.preventDefault(); const answers = placementQuestions.map((_, index) => placementForm.elements[`placement-${index}`]?.value); const answered = answers.filter((value) => value !== "").length; if (answered < 12) return toast("Hãy trả lời ít nhất 12 câu để nhận gợi ý đáng tin cậy hơn.", "error"); const score = scoreAnswers(placementQuestions, answers); const groups = {}; placementQuestions.forEach((question, index) => { const key = question[0]; groups[key] = groups[key] || { label: { Vocabulary: "từ vựng", Grammar: "ngữ pháp", Reading: "đọc hiểu", Listening: "nghe hiểu", "Use of English": "cách dùng ngôn ngữ" }[key] || key, score: 0, total: 0 }; groups[key].score += Number(answers[index]) === question[3] ? 1 : 0; groups[key].total += 1; }); const skillScores = Object.values(groups); const strongest = [...skillScores].sort((a, b) => b.score / b.total - a.score / a.total)[0]; const weakest = [...skillScores].sort((a, b) => a.score / a.total - b.score / b.total)[0]; const state = readState(); const suggestedLevel = levelFromScore(score / placementQuestions.length * 100); state.placement = { score, answered, total: placementQuestions.length, level: suggestedLevel, strength: strongest.label, improve: weakest.label, takenAt: new Date().toISOString() }; state.selectedLevel = suggestedLevel; if (!state.placementRewarded) { state.xp += 25; state.placementRewarded = true; } writeState(state); render(); toast(`Đã hoàn tất bài kiểm tra · gợi ý ${suggestedLevel}.`); return; }
    const settingsForm = event.target.closest("[data-hhe-settings]");
    if (settingsForm) { event.preventDefault(); const state = readState(); state.selectedLevel = levelOrder.includes(settingsForm.selectedLevel.value) ? settingsForm.selectedLevel.value : "A0"; state.selectedCareer = careerTracks.some((item) => item.id === settingsForm.selectedCareer.value) ? settingsForm.selectedCareer.value : selectedCareerId(state); state.dailyGoal = Math.max(5, Math.min(60, Number(settingsForm.dailyGoal.value) || 15)); state.settings.learnerType = settingsForm.learnerType.value; state.settings.goal = settingsForm.goal.value; state.settings.voiceRate = Number(settingsForm.voiceRate.value); state.settings.beginnerMode = settingsForm.beginnerMode.checked; state.settings.reducedMotion = settingsForm.reducedMotion.checked; writeState(state); render(); toast("Đã lưu cài đặt."); }
  };

  const startRecognition = (target = "") => {
    const Recognition = root.SpeechRecognition || root.webkitSpeechRecognition;
    const output = host.querySelector("[data-hhe-transcript]");
    if (!Recognition) { output.textContent = "Trình duyệt chưa hỗ trợ nhận dạng giọng nói. Bạn vẫn có thể dùng phần ghi âm bên cạnh."; return; }
    const stateAtStart = readState();
    const recognition = new Recognition(); recognition.lang = voiceProfileById(stateAtStart.settings.voiceProfile).lang; recognition.interimResults = true; recognition.continuous = false;
    output.textContent = "Đang nghe… Âm thanh có thể được trình duyệt gửi tới dịch vụ nhận dạng của nhà cung cấp.";
    recognition.onresult = (event) => {
      const transcript = Array.from(event.results).map((result) => result[0].transcript).join(" ");
      output.textContent = transcript;
      const finalResult = Array.from(event.results).every((result) => result.isFinal);
      if (!finalResult || !target) return;
      const comparison = compareTranscript(transcript, target);
      const scoreNode = host.querySelector("[data-hhe-pron-score]");
      if (scoreNode) {
        scoreNode.hidden = false;
        scoreNode.className = `hhe-pron-score ${comparison.score >= 80 ? "good" : comparison.score >= 55 ? "fair" : "retry"}`;
        scoreNode.innerHTML = `<b>${comparison.score}%</b><span><strong>${comparison.score >= 80 ? "Khớp từ rất tốt" : comparison.score >= 55 ? "Đã đúng phần lớn cụm từ" : "Hãy nghe chậm và nói theo từng cụm"}</strong><small>${comparison.missed.length ? `Từ chưa nhận ra: ${escapeHtml(comparison.missed.join(" · "))}` : "Trình duyệt nhận ra đầy đủ từ trong câu."}</small></span>`;
      }
      const state = readState();
      state.speakingAttempts = Array.isArray(state.speakingAttempts) ? state.speakingAttempts : [];
      state.speakingAttempts.unshift({ level: selectedLevelId(state), scenario: speakingScenarios.find((item) => item.id === state.speakingScenario)?.title || "Luyện nói", target, transcript, score: comparison.score, createdAt: new Date().toISOString() });
      state.speakingAttempts = state.speakingAttempts.slice(0, 30);
      writeState(state);
    };
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
    if (event.target.matches("[data-hhe-voice-uri]")) {
      const state = readState(); state.settings.voiceURI = event.target.value; writeState(state);
      speak("This is your selected English voice.", state.settings); toast("Đã lưu giọng đọc trên thiết bị."); return;
    }
    if (event.target.matches("[data-hhe-voice-rate]")) {
      const state = readState(); state.settings.voiceRate = Number(event.target.value) || 0.85; writeState(state);
      speak("Listen at this speed and repeat after me.", state.settings); toast(`Tốc độ giọng đọc ${state.settings.voiceRate}×.`); return;
    }
    const surveyForm = event.target.closest("[data-hhe-career-survey]");
    if (surveyForm) {
      updateSurveyProgress(surveyForm);
      if (event.target.name === "situation") root.setTimeout?.(() => surveyForm.querySelector('[data-hhe-survey-step="2"]')?.scrollIntoView?.({ behavior: "auto", block: "center" }), 120);
      return;
    }
    if (!event.target.matches("[data-hhe-import]")) return;
    const file = event.target.files?.[0]; if (!file || file.size > 2 * 1024 * 1024) return toast("Tệp JSON không hợp lệ hoặc lớn hơn 2 MB.", "error");
    try { const data = JSON.parse(await file.text()); if (typeof data !== "object" || data.version !== APP_VERSION) throw new Error("Sai phiên bản dữ liệu"); writeState({ ...defaultState(), ...data }); render(); toast("Đã nhập dữ liệu HH English."); } catch (error) { toast(`Không thể nhập: ${error.message}`, "error"); }
  };

  const mount = (target, options = {}) => {
    const validViews = new Set([...navItems.map(([id]) => id), "lesson"]);
    if (validViews.has(options.view)) {
      const state = readState(); state.activeView = options.view; writeState(state);
    }
    host = target; host.removeEventListener("click", handleClick); host.removeEventListener("submit", handleSubmit); host.removeEventListener("change", handleChange);
    root.document?.removeEventListener("keydown", handleKeydown);
    host.addEventListener("click", handleClick); host.addEventListener("submit", handleSubmit); host.addEventListener("change", handleChange); root.document?.addEventListener("keydown", handleKeydown);
    root.speechSynthesis?.addEventListener?.("voiceschanged", handleVoicesChanged);
    render();
  };
  const handleVoicesChanged = () => { if (host?.querySelector(".hhe-voice-studio")) render(); };
  const unmount = () => { root.document?.removeEventListener("keydown", handleKeydown); root.speechSynthesis?.removeEventListener?.("voiceschanged", handleVoicesChanged); root.speechSynthesis?.cancel?.(); if (focusTimer) clearInterval(focusTimer); focusTimer = null; navigatorOpen = false; if (mediaRecorder?.state === "recording") mediaRecorder.stop(); host = null; };

  root.HHEnglish = { mount, unmount, courses, courseLevels, careerCategories, careerTracks, voiceProfiles, inferVoiceGender, selectVoice, compareTranscript, scheduleReview, scoreAnswers, levelFromScore, buildSmartPlan, beginnerChecklist, selectCareerVocabulary, personalizeCareerLesson };
  if (typeof module !== "undefined" && module.exports) module.exports = { courses, courseLevels, careerCategories, careerTracks, placementQuestions, voiceProfiles, inferVoiceGender, selectVoice, compareTranscript, scheduleReview, scoreAnswers, levelFromScore, normalize, buildSmartPlan, beginnerChecklist, selectCareerVocabulary, personalizeCareerLesson };
})();
