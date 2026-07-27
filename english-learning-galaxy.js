(() => {
  "use strict";

  const root = typeof window !== "undefined" ? window : globalThis;
  const VERSION = "1.0.0";
  const instances = new WeakMap();
  const GALAXY_PREF_KEY = "hh.home.galaxy.preferences.v2";
  const VIEWS = new Set(["dashboard", "listening", "reading", "listen-read"]);
  const themeTones = {
    neon: ["#61efff", "#ff64d8"], purple: ["#a887ff", "#ff68d4"], solar: ["#ffbe58", "#ff5c85"],
    deep: ["#5b82ff", "#72e9ff"], aurora: ["#58f3ff", "#69ffb7"], magenta: ["#ff55cf", "#a970ff"],
    emerald: ["#58f5a8", "#c0ff68"], quantum: ["#57a8ff", "#58f4ff"], golden: ["#ffd75e", "#ff874a"],
    crimson: ["#ff654d", "#ff4c9f"], ice: ["#d8fbff", "#78b7ff"], blackhole: ["#8c78ff", "#45528d"],
    time: ["#5eefff", "#ffb653"]
  };

  const listeningLibrary = Object.freeze([
    {
      id: "listen-a0-school", level: "A0", topic: "Đời sống", title: "The English Club",
      description: "Nghe thông báo rất ngắn về thời gian và địa điểm.",
      sentences: [
        ["The English club meets in the library.", "Câu lạc bộ tiếng Anh gặp nhau tại thư viện."],
        ["The meeting starts at four o'clock.", "Buổi gặp bắt đầu lúc bốn giờ."],
        ["Please bring a notebook and a pen.", "Hãy mang theo một quyển vở và một cây bút."]
      ],
      questions: [
        ["main", "What is the announcement about?", ["An English club meeting", "A sports match", "A music lesson"], 0, "Thông báo nói về buổi gặp của câu lạc bộ tiếng Anh."],
        ["detail", "Where does the club meet?", ["In the library", "In the cafeteria", "In the gym"], 0, "Câu đầu tiên nêu rõ địa điểm là library."],
        ["inference", "What should a learner prepare?", ["Something to write with", "A train ticket", "Sports clothes"], 0, "Notebook và pen cho thấy người học cần chuẩn bị đồ để viết."]
      ]
    },
    {
      id: "listen-a1-travel", level: "A1", topic: "Du lịch", title: "At the Train Station",
      description: "Nghe thông tin sân ga và thời gian khởi hành.",
      sentences: [
        ["The city train leaves from platform six.", "Tàu vào trung tâm khởi hành từ sân ga số sáu."],
        ["It departs at ten fifteen.", "Tàu rời ga lúc mười giờ mười lăm."],
        ["Passengers should arrive five minutes early.", "Hành khách nên đến sớm năm phút."]
      ],
      questions: [
        ["main", "What information is being given?", ["Train departure details", "Hotel directions", "A weather report"], 0, "Nội dung cung cấp chi tiết khởi hành của chuyến tàu."],
        ["detail", "Which platform should passengers use?", ["Platform six", "Platform five", "Platform ten"], 0, "Người nói nhắc platform six."],
        ["inference", "When is a safe time to be on the platform?", ["Around ten ten", "After ten twenty", "At eleven"], 0, "Tàu chạy 10:15 và hành khách nên đến trước 5 phút."]
      ]
    },
    {
      id: "listen-a2-work", level: "A2", topic: "Công việc", title: "A Small Schedule Change",
      description: "Nghe đồng nghiệp thông báo thay đổi lịch họp.",
      sentences: [
        ["Our team meeting has moved to Tuesday morning.", "Cuộc họp nhóm đã chuyển sang sáng thứ Ba."],
        ["We will meet online instead of in the office.", "Chúng ta sẽ họp trực tuyến thay vì tại văn phòng."],
        ["Please read the project update before the call.", "Hãy đọc bản cập nhật dự án trước cuộc gọi."]
      ],
      questions: [
        ["main", "What changed?", ["The team meeting", "The project owner", "The office address"], 0, "Câu đầu cho biết lịch họp nhóm đã thay đổi."],
        ["detail", "How will the team meet?", ["Online", "In a café", "In the office"], 0, "Người nói dùng cụm meet online."],
        ["inference", "What will help the meeting run faster?", ["Reading the update first", "Arriving at the office", "Calling a customer"], 0, "Đọc bản cập nhật trước giúp mọi người có cùng bối cảnh."]
      ]
    },
    {
      id: "listen-b1-tech", level: "B1", topic: "Công nghệ", title: "A Safer Software Update",
      description: "Theo dõi giải thích về cách triển khai phần mềm an toàn.",
      sentences: [
        ["We will release the update to a small group first.", "Chúng tôi sẽ phát hành bản cập nhật cho một nhóm nhỏ trước."],
        ["The team will monitor errors and loading time for two hours.", "Nhóm sẽ theo dõi lỗi và thời gian tải trong hai giờ."],
        ["If the results remain stable, everyone will receive the new version.", "Nếu kết quả ổn định, mọi người sẽ nhận phiên bản mới."]
      ],
      questions: [
        ["main", "What is the team planning?", ["A gradual software release", "A complete shutdown", "A new hiring round"], 0, "Nhóm đang lên kế hoạch phát hành phần mềm theo từng bước."],
        ["detail", "How long will the first monitoring period last?", ["Two hours", "Two days", "Twenty minutes"], 0, "Câu thứ hai nêu rõ two hours."],
        ["inference", "Why start with a small group?", ["To limit risk", "To increase advertising", "To avoid collecting results"], 0, "Nhóm nhỏ giúp phát hiện vấn đề trước khi phát hành rộng."]
      ]
    },
    {
      id: "listen-b2-customer", level: "B2", topic: "Công việc", title: "Handling a Difficult Customer",
      description: "Nghe cách một nhân viên xử lý phản hồi của khách hàng.",
      sentences: [
        ["The customer was frustrated because the delivery had been delayed twice.", "Khách hàng thất vọng vì đơn hàng đã bị trễ hai lần."],
        ["Rather than making another promise, I checked the warehouse and confirmed a realistic date.", "Thay vì hứa thêm, tôi kiểm tra kho và xác nhận một ngày thực tế."],
        ["The customer accepted the solution because the explanation was specific and honest.", "Khách hàng chấp nhận giải pháp vì lời giải thích cụ thể và trung thực."]
      ],
      questions: [
        ["main", "How was the problem resolved?", ["With verified information", "With a discount only", "By cancelling the order"], 0, "Nhân viên kiểm tra thông tin và đưa ra thời hạn thực tế."],
        ["detail", "Why was the customer frustrated?", ["Two delivery delays", "A damaged website", "A missing invoice"], 0, "Đơn hàng đã bị delayed twice."],
        ["inference", "What communication quality mattered most?", ["Credibility", "Humour", "Speed of speech"], 0, "Giải thích cụ thể và trung thực tạo được niềm tin."]
      ]
    },
    {
      id: "listen-c1-research", level: "C1", topic: "Học tập", title: "Interpreting Early Research",
      description: "Nghe lập luận thận trọng về kết quả nghiên cứu ban đầu.",
      sentences: [
        ["The early findings are encouraging, but the sample remains too narrow for a firm conclusion.", "Kết quả ban đầu đáng khích lệ, nhưng mẫu vẫn quá hẹp để kết luận chắc chắn."],
        ["A larger trial may reveal whether the pattern holds across different age groups.", "Một thử nghiệm lớn hơn có thể cho biết mô hình có đúng ở các nhóm tuổi khác nhau hay không."],
        ["For now, the evidence supports further investigation rather than a policy change.", "Hiện tại, bằng chứng ủng hộ nghiên cứu thêm hơn là thay đổi chính sách."]
      ],
      questions: [
        ["main", "What is the speaker's position?", ["Cautiously positive", "Completely certain", "Entirely dismissive"], 0, "Người nói đánh giá tích cực nhưng vẫn thận trọng."],
        ["detail", "What limitation is identified?", ["A narrow sample", "Missing equipment", "No research question"], 0, "Hạn chế được nêu là sample remains too narrow."],
        ["inference", "What should happen next?", ["A broader study", "An immediate policy change", "No further work"], 0, "Bằng chứng hiện tại phù hợp với further investigation."]
      ]
    },
    {
      id: "listen-c2-debate", level: "C2", topic: "Phân tích", title: "Two Apparently Conflicting Findings",
      description: "Nghe và phân biệt phạm vi của hai kết quả nghiên cứu.",
      sentences: [
        ["The findings appear contradictory only if we assume that both studies measure the same phenomenon.", "Các kết quả chỉ có vẻ mâu thuẫn nếu ta cho rằng hai nghiên cứu đo cùng một hiện tượng."],
        ["One examines short-term behavioural change, whereas the other tracks long-term institutional effects.", "Một nghiên cứu xem xét thay đổi hành vi ngắn hạn, nghiên cứu kia theo dõi tác động thể chế dài hạn."],
        ["Read together, they offer a layered explanation rather than a simple disagreement.", "Khi đọc cùng nhau, chúng đưa ra lời giải thích nhiều tầng thay vì một bất đồng đơn giản."]
      ],
      questions: [
        ["main", "How should the findings be understood?", ["As complementary layers", "As identical results", "As unusable evidence"], 0, "Hai kết quả bổ sung các tầng giải thích khác nhau."],
        ["detail", "What does the second study track?", ["Long-term institutional effects", "Short-term pronunciation", "Individual travel choices"], 0, "Câu thứ hai nói rõ long-term institutional effects."],
        ["inference", "What caused the apparent contradiction?", ["An incorrect shared assumption", "A calculation error", "A missing author"], 0, "Mâu thuẫn xuất hiện khi giả định sai rằng hai nghiên cứu đo cùng một thứ."]
      ]
    }
  ]);

  const readingLibrary = Object.freeze([
    {
      id: "read-a0-morning", level: "A0", topic: "Đời sống", title: "Mai's Morning",
      description: "Một lịch buổi sáng với câu ngắn và từ quen thuộc.",
      paragraphs: [
        "Mai gets up at seven o'clock. She drinks water and opens the window.",
        "At eight o'clock, she takes a bus to school. Her English class starts at nine.",
        "Mai studies with Lan. They read a short story and learn five new words."
      ],
      questions: [
        ["How does Mai go to school?", ["By bus", "By train", "By bike"], 0, "Đoạn hai ghi rõ she takes a bus."],
        ["Who studies with Mai?", ["Lan", "Her mother", "A driver"], 0, "Đoạn ba nhắc Mai studies with Lan."],
        ["What do the learners read?", ["A short story", "A newspaper", "A map"], 0, "Họ đọc a short story."]
      ]
    },
    {
      id: "read-a1-travel", level: "A1", topic: "Du lịch", title: "A Weekend in Huế",
      description: "Đọc lịch trình du lịch và tìm thông tin thực tế.",
      paragraphs: [
        "Ben arrives in Huế on Saturday morning. He leaves his bag at a small hotel near the river.",
        "In the afternoon, he visits the Imperial City and takes many photos. The weather is warm but not too hot.",
        "On Sunday, Ben eats local food at the market before taking the train home."
      ],
      questions: [
        ["Where is Ben's hotel?", ["Near the river", "Inside the market", "Next to the station"], 0, "Đoạn đầu nói khách sạn ở near the river."],
        ["What does Ben do on Saturday afternoon?", ["Visits the Imperial City", "Takes the train home", "Works at the hotel"], 0, "Hoạt động chiều thứ Bảy là thăm Imperial City."],
        ["Why can Ben walk comfortably?", ["It is not too hot", "It is snowing", "The city is empty"], 0, "Thời tiết ấm nhưng không quá nóng."]
      ]
    },
    {
      id: "read-a2-work", level: "A2", topic: "Công việc", title: "The First Week at Work",
      description: "Đọc trải nghiệm tuần đầu tại một công ty mới.",
      paragraphs: [
        "Linh started a new job at a design company this week. On Monday, her manager introduced her to the team.",
        "She spent two days learning the project system and asking questions. A colleague showed her where to find shared files.",
        "By Friday, Linh completed her first small task. She still has a lot to learn, but she feels more confident."
      ],
      questions: [
        ["What did Linh learn first?", ["The project system", "A foreign language", "How to drive"], 0, "Đoạn hai nêu project system."],
        ["Who helped with shared files?", ["A colleague", "A customer", "A teacher"], 0, "A colleague showed her."],
        ["How does Linh feel by Friday?", ["More confident", "Angry", "Completely bored"], 0, "Câu cuối nói she feels more confident."]
      ]
    },
    {
      id: "read-b1-technology", level: "B1", topic: "Công nghệ", title: "Why Small Releases Reduce Risk",
      description: "Đọc về triển khai phần mềm theo từng nhóm người dùng.",
      paragraphs: [
        "Software teams often avoid releasing a major update to every user at the same time. Instead, they begin with a small percentage of accounts.",
        "This approach gives the team real performance data while limiting the number of people affected by a possible error. Engineers can pause the release, fix the problem, and try again.",
        "A gradual release is not risk-free, but it makes problems easier to observe and control. Clear monitoring and a reliable rollback plan are still essential."
      ],
      questions: [
        ["Why do teams begin with a small group?", ["To limit the impact of errors", "To hide the update forever", "To remove monitoring"], 0, "Nhóm nhỏ giới hạn số người bị ảnh hưởng khi có lỗi."],
        ["What can engineers do after finding a problem?", ["Pause and fix the release", "Ignore all data", "Delete every account"], 0, "Đoạn hai nêu pause, fix và try again."],
        ["What remains essential?", ["Monitoring and rollback", "A larger logo", "More meetings"], 0, "Câu cuối nhấn mạnh monitoring và rollback plan."]
      ]
    },
    {
      id: "read-b2-work", level: "B2", topic: "Công việc", title: "When a Meeting Should Become a Document",
      description: "Phân tích khi nào nên họp và khi nào nên viết tài liệu.",
      paragraphs: [
        "Meetings are useful when a group must debate options, resolve ambiguity, or make a decision together. They are less effective when the goal is simply to share information.",
        "A concise document lets people read at their own pace, check evidence, and leave considered comments. It also creates a record that new team members can revisit.",
        "The best choice depends on the work. A written proposal followed by a short decision meeting often combines the strengths of both formats."
      ],
      questions: [
        ["When are meetings most useful?", ["When a group must decide together", "Whenever information exists", "Only for new employees"], 0, "Đoạn đầu nêu tranh luận, làm rõ và ra quyết định."],
        ["What advantage does a document provide?", ["A lasting record", "Instant agreement", "No need for evidence"], 0, "Tài liệu tạo ra record có thể xem lại."],
        ["What hybrid approach is suggested?", ["Proposal then decision meeting", "Meeting without preparation", "Document without comments"], 0, "Đoạn cuối đề xuất written proposal rồi short decision meeting."]
      ]
    },
    {
      id: "read-c1-research", level: "C1", topic: "Học tập", title: "Evidence, Confidence and Public Decisions",
      description: "Đọc lập luận về mức độ chắc chắn của bằng chứng.",
      paragraphs: [
        "Public decisions rarely wait for perfect evidence. Leaders must often act while important questions remain unresolved, yet uncertainty does not justify treating every claim as equally plausible.",
        "A responsible analysis distinguishes between what is known, what is strongly suggested, and what remains speculative. It also explains how new evidence could change the recommendation.",
        "Transparency about uncertainty is therefore not a sign of weak reasoning. It enables people to understand the trade-offs and judge whether the proposed action is proportionate."
      ],
      questions: [
        ["What does responsible analysis distinguish?", ["Different levels of confidence", "Only certain facts", "Personal preferences"], 0, "Đoạn hai phân biệt known, suggested và speculative."],
        ["Why explain possible new evidence?", ["To show how recommendations may change", "To avoid all decisions", "To make the text longer"], 0, "Bằng chứng mới có thể làm thay đổi khuyến nghị."],
        ["How is transparency presented?", ["As support for sound judgement", "As proof of failure", "As unnecessary detail"], 0, "Minh bạch giúp người đọc hiểu đánh đổi và đánh giá hành động."]
      ]
    },
    {
      id: "read-c2-analysis", level: "C2", topic: "Phân tích", title: "The Seduction of a Single Metric",
      description: "Đọc phản biện về việc tối ưu hóa một chỉ số duy nhất.",
      paragraphs: [
        "A single metric is attractive because it compresses a complicated system into a value that appears easy to compare. The clarity is useful, but it can also conceal assumptions about whose outcomes matter and over what period.",
        "Once a metric becomes a target, people adapt their behaviour to improve the number. The reported result may rise even as the underlying purpose deteriorates, particularly when quality is difficult to measure directly.",
        "Good governance does not abandon measurement. It combines several indicators with qualitative evidence, examines unintended consequences, and revises the framework when the metric no longer represents the goal."
      ],
      questions: [
        ["Why is a single metric attractive?", ["It simplifies comparison", "It removes every assumption", "It measures all quality directly"], 0, "Một chỉ số nén hệ thống phức tạp thành giá trị dễ so sánh."],
        ["What can happen when a metric becomes a target?", ["Behaviour changes to improve the number", "The purpose always improves", "Measurement stops completely"], 0, "Mọi người điều chỉnh hành vi để cải thiện con số."],
        ["What does good governance require?", ["Multiple indicators and revision", "One permanent target", "No qualitative evidence"], 0, "Đoạn cuối đề xuất nhiều chỉ báo, bằng chứng định tính và điều chỉnh."]
      ]
    }
  ]);

  const clamp = (value, min, max) => Math.min(max, Math.max(min, Number(value) || 0));
  const clean = (value, limit = 400) => String(value ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, limit);
  const esc = (value) => String(value ?? "").replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;"
  }[character]));
  const clone = (value) => JSON.parse(JSON.stringify(value));
  const timeText = (seconds = 0) => {
    const safe = Math.max(0, Math.round(Number(seconds) || 0));
    return `${String(Math.floor(safe / 60)).padStart(2, "0")}:${String(safe % 60).padStart(2, "0")}`;
  };
  const readJson = (key, fallback) => {
    try { return JSON.parse(root.localStorage?.getItem?.(key) || "null") ?? fallback; }
    catch { return fallback; }
  };
  const themePrefs = () => readJson(GALAXY_PREF_KEY, { theme: "neon", motion: "balanced", glow: 70, stars: 68 });
  const sentenceDuration = (text, rate = 1) => Math.max(2.4, clean(text, 1000).split(/\s+/).filter(Boolean).length / (2.25 * Math.max(.5, rate)));
  const timedSentences = (item, rate = 1) => {
    let cursor = 0;
    return item.sentences.map(([en, vi], index) => {
      const duration = sentenceDuration(en, rate);
      const row = { index, en, vi, start: cursor, end: cursor + duration, duration };
      cursor += duration;
      return row;
    });
  };
  const listeningById = (id) => listeningLibrary.find((item) => item.id === id) || listeningLibrary[0];
  const readingById = (id) => readingLibrary.find((item) => item.id === id) || readingLibrary[0];
  const levelListening = (level) => listeningLibrary.find((item) => item.level === level) || listeningLibrary[0];
  const levelReading = (level) => readingLibrary.find((item) => item.level === level) || readingLibrary[0];
  const emptyGalaxyState = () => ({
    selectedListeningId: listeningLibrary[0].id,
    selectedReadingId: readingLibrary[0].id,
    listeningProgress: {},
    readingProgress: {},
    offlineListening: [],
    activity: [],
    missedWords: [],
    selectedWord: null,
    subtitleMode: "bi",
    loopMode: "off",
    maskRatio: 0,
    readingSettings: { fontScale: 1, lineHeight: 1.8, columnWidth: 760, focus: false, contrast: false, easyFont: false },
    focus: { running: false, remaining: 0, plannedMinutes: 0, startedAt: "" },
    coachMessage: "H English Coach sẵn sàng mở đúng khu học và tiếp tục dữ liệu gần nhất.",
    lastSavedAt: ""
  });

  const defaultState = () => ({ galaxy: emptyGalaxyState() });
  const mergeState = (merged, stored) => {
    const fallback = emptyGalaxyState();
    const source = stored?.galaxy || {};
    merged.galaxy = {
      ...fallback,
      ...source,
      listeningProgress: { ...(source.listeningProgress || {}) },
      readingProgress: { ...(source.readingProgress || {}) },
      readingSettings: { ...fallback.readingSettings, ...(source.readingSettings || {}) },
      focus: { ...fallback.focus, ...(source.focus || {}) },
      activity: Array.isArray(source.activity) ? source.activity.slice(0, 80) : [],
      missedWords: Array.isArray(source.missedWords) ? source.missedWords.slice(0, 120) : [],
      offlineListening: Array.isArray(source.offlineListening) ? source.offlineListening : []
    };
    if (!listeningLibrary.some((item) => item.id === merged.galaxy.selectedListeningId)) merged.galaxy.selectedListeningId = listeningLibrary[0].id;
    if (!readingLibrary.some((item) => item.id === merged.galaxy.selectedReadingId)) merged.galaxy.selectedReadingId = readingLibrary[0].id;
    return merged;
  };

  const progressForListening = (state, id) => ({
    position: 0, plays: 0, attempts: [], dictations: [], completedAt: "", lastPlayedAt: "",
    ...(state.galaxy?.listeningProgress?.[id] || {})
  });
  const progressForReading = (state, id) => ({
    percent: 0, activeSeconds: 0, attempts: [], notes: "", bookmarks: [], completedAt: "", openedAt: "",
    ...(state.galaxy?.readingProgress?.[id] || {})
  });
  const addActivity = (state, type, title, view) => {
    state.galaxy.activity = [{ id: `${Date.now()}-${Math.random().toString(16).slice(2)}`, type, title: clean(title, 140), view, createdAt: new Date().toISOString() }, ...(state.galaxy.activity || [])].slice(0, 80);
  };
  const formatSaved = (value) => {
    const date = new Date(value || 0);
    if (!Number.isFinite(date.getTime()) || date.getTime() <= 0) return "Chưa lưu";
    return date.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  };

  const orbitMarkup = (state, context) => {
    const adapter = context.speechAdapterStatus();
    const level = context.selectedLevelId(state);
    const listening = listeningById(state.galaxy.selectedListeningId || levelListening(level).id);
    const reading = readingById(state.galaxy.selectedReadingId || levelReading(level).id);
    const listenProgress = progressForListening(state, listening.id);
    const readProgress = progressForReading(state, reading.id);
    const due = Object.values(state.savedWords || {}).filter((item) => !state.reviewQueue?.[item.word]?.dueAt || new Date(state.reviewQueue[item.word].dueAt) <= new Date()).length;
    const minutes = Number(state.minutesByDay?.[context.todayKey()] || 0);
    const online = root.navigator?.onLine !== false;
    const focus = state.galaxy.focus?.running ? `${timeText(state.galaxy.focus.remaining)} focus` : `${state.streak?.current || 0} ngày`;
    const items = [
      ["listening", "◖", "Bài nghe", listenProgress.position > 0 ? `${listening.title} · ${timeText(listenProgress.position)}` : "Chưa có hoạt động", "cyan"],
      ["reading", "Aa", "Bài đọc", readProgress.percent > 0 ? `${reading.title} · ${Math.round(readProgress.percent)}%` : "Chưa có hoạt động", "magenta"],
      ["vocabulary", "◇", "Từ cần ôn", due ? `${due} từ đến hạn` : "Chưa có từ đến hạn", "green"],
      ["plan", "◷", "Hôm nay", minutes ? `${minutes} phút đã học` : "Chưa ghi nhận phút học", "gold"],
      ["speaking", "●", "Giọng & micro", `${adapter.speechOutput.supported ? "Giọng đọc sẵn sàng" : "Không hỗ trợ giọng"} · ${adapter.microphone.supported ? "Có micro" : "Không có micro"}`, "coral"],
      ["progress", online ? "↗" : "×", "Kết nối", `${online ? "Đang online" : "Đang offline"} · ${focus}`, online ? "blue" : "coral"],
      ["dashboard", "✓", "Tự lưu", formatSaved(state.galaxy.lastSavedAt), "purple"]
    ];
    return `<section class="hheg-orbit" aria-label="LIVE LEARNING ORBIT">
      <header><div><i></i><span>LIVE LEARNING ORBIT</span></div><small>Dữ liệu trên thiết bị · cập nhật khi có thao tác thật</small></header>
      <div>${items.map(([view, icon, label, value, tone]) => `<button type="button" data-hhe-view="${view}" data-tone="${tone}"><i>${icon}</i><span><small>${label}</small><strong>${esc(value)}</strong></span></button>`).join("")}</div>
    </section>`;
  };

  const planetMarkup = (state, context, config) => {
    const { id, view, code, title, detail, tone } = config;
    let signal = "";
    if (id === "listening") {
      const item = listeningById(state.galaxy.selectedListeningId);
      const progress = progressForListening(state, item.id);
      signal = progress.position ? `${timeText(progress.position)} đang dở` : "Chưa có hoạt động";
    } else if (id === "reading") {
      const item = readingById(state.galaxy.selectedReadingId);
      const progress = progressForReading(state, item.id);
      signal = progress.percent ? `${Math.round(progress.percent)}% đã đọc` : "Chưa có hoạt động";
    } else if (id === "speaking") {
      signal = state.speakingAttempts?.length ? `${state.speakingAttempts.length} lượt nói` : "Chưa có hoạt động";
    } else if (id === "vocabulary") {
      signal = Object.keys(state.savedWords || {}).length ? `${Object.keys(state.savedWords).length} từ đã lưu` : "Chưa có hoạt động";
    } else if (id === "writing") {
      signal = state.writingHistory?.length ? `${state.writingHistory.length} bài đã lưu` : "Chưa có hoạt động";
    } else if (id === "career") {
      signal = state.careerSurvey ? context.careerTracks.find((item) => item.id === state.selectedCareer)?.viName || "Đã chọn lộ trình" : "Chưa có hoạt động";
    } else if (id === "roadmap") {
      signal = `${context.completedCount(state, context.selectedLevelId(state))} bài đã hoàn thành`;
    } else if (id === "progress") {
      signal = state.xp ? `${state.xp} XP thật` : "Chưa có hoạt động";
    }
    const active = !signal.startsWith("Chưa");
    return `<button type="button" class="hheg-planet ${active ? "has-signal" : ""}" data-hhe-view="${view}" data-planet="${id}" data-tone="${tone}">
      <span class="hheg-planet-core"><b>${code}</b><i></i></span>
      <strong>${title}</strong><small>${detail}</small><em>${esc(signal)}</em>
    </button>`;
  };

  const coachMarkup = (state) => `<section class="hheg-coach">
    <div class="hheg-coach-sun"><b>H</b><i></i><i></i></div>
    <div><small>H ENGLISH COACH</small><h3>Điều hướng bằng mục tiêu học</h3><p data-hheg-coach-output>${esc(state.galaxy.coachMessage)}</p>
      <form data-hheg-coach><label><span>⌕</span><input name="command" autocomplete="off" placeholder="Ví dụ: Mở bài đọc B1 về công nghệ"></label><button type="submit">Thực hiện →</button></form>
      <div>${["Tiếp tục bài nghe gần nhất", "Mở bài đọc B1 về công nghệ", "Ôn các từ tôi vừa nghe sai", "Tạo phiên học 15 phút"].map((command) => `<button type="button" data-hheg-command="${esc(command)}">${esc(command)}</button>`).join("")}</div>
    </div>
  </section>`;

  const dashboardView = (state, context) => {
    const prefs = themePrefs();
    const tones = themeTones[prefs.theme] || themeTones.neon;
    const planets = [
      { id: "listening", view: "listening", code: "LI", title: "Listening Galaxy", detail: "Nghe, dictation, shadowing", tone: "cyan" },
      { id: "reading", view: "reading", code: "RE", title: "Reading Galaxy", detail: "Đọc hiểu và sổ từ", tone: "magenta" },
      { id: "speaking", view: "speaking", code: "SP", title: "Speaking Galaxy", detail: "Phát âm và hội thoại", tone: "coral" },
      { id: "vocabulary", view: "vocabulary", code: "VO", title: "Vocabulary Planet", detail: "Ôn cách quãng", tone: "green" },
      { id: "writing", view: "writing", code: "WR", title: "Writing Station", detail: "Viết và lưu phiên bản", tone: "purple" },
      { id: "career", view: "career", code: "CE", title: "Career English", detail: "Tiếng Anh chuyên ngành", tone: "gold" },
      { id: "roadmap", view: "learn", code: "A2", title: "CEFR Roadmap", detail: "Lộ trình A0 đến C2", tone: "blue" },
      { id: "progress", view: "progress", code: "PX", title: "Progress Observatory", detail: "Tiến độ thật", tone: "ice" }
    ];
    const activity = (state.galaxy.activity || []).slice(0, 5);
    return `<section class="hheg-shell" data-hheg-theme="${esc(prefs.theme || "neon")}" style="--hheg-theme-a:${tones[0]};--hheg-theme-b:${tones[1]};--hheg-glow:${clamp(prefs.glow || 70, 20, 100) / 100}">
      ${orbitMarkup(state, context)}
      <section class="hheg-hero">
        <div class="hheg-nebula" aria-hidden="true"></div>
        <header><div><small>HH ENGLISH · ENGLISH LEARNING GALAXY</small><h2>Học tiếng Anh như khám phá một vũ trụ sống.</h2><p>Tám hành tinh dùng chung dữ liệu học thật. Không có hoạt động sẽ không tạo số liệu mẫu.</p></div><button type="button" data-hhe-view="listen-read">Mở Listen & Read Together →</button></header>
        <div class="hheg-system">
          <div class="hheg-sun"><span>H</span><strong>ENGLISH</strong><small>${context.selectedLevelId(state)} · ${state.xp || 0} XP</small><i></i><i></i><i></i></div>
          ${planets.map((planet) => planetMarkup(state, context, planet)).join("")}
          <span class="hheg-orbit-line one"></span><span class="hheg-orbit-line two"></span><span class="hheg-orbit-line three"></span>
        </div>
      </section>
      <section class="hheg-command-grid">${coachMarkup(state)}
        <section class="hheg-activity"><header><div><small>GALAXY ACTIVITY</small><h3>Hoạt động gần đây</h3></div><button type="button" data-hhe-view="progress">Mở quan sát →</button></header>
          ${activity.length ? activity.map((item) => `<button type="button" data-hhe-view="${esc(item.view || "dashboard")}"><i data-type="${esc(item.type)}"></i><span><strong>${esc(item.title)}</strong><small>${new Date(item.createdAt).toLocaleString("vi-VN")}</small></span><b>→</b></button>`).join("") : '<div class="hheg-empty"><span>✦</span><strong>Chưa có hoạt động</strong><p>Phát một bài nghe, mở bài đọc hoặc lưu từ để dòng hoạt động bắt đầu.</p></div>'}
        </section>
      </section>
    </section>`;
  };

  const libraryCards = (items, selectedId, kind) => `<div class="hheg-library">${items.map((item) => `<button type="button" class="${item.id === selectedId ? "active" : ""}" data-hheg-select-${kind}="${item.id}">
    <i>${item.level}</i><span><strong>${esc(item.title)}</strong><small>${esc(item.topic)} · ${esc(item.description)}</small></span><b>${item.id === selectedId ? "Đang mở" : "Mở →"}</b>
  </button>`).join("")}</div>`;

  const questionMarkup = (question, index, group) => {
    const listeningShape = Array.isArray(question[2]);
    const prompt = listeningShape ? question[1] : question[0];
    const options = listeningShape ? question[2] : question[1];
    return `<fieldset><legend><span>${String(index + 1).padStart(2, "0")}</span>${esc(prompt)}</legend>
      ${options.map((option, optionIndex) => `<label><input type="radio" name="${group}-${index}" value="${optionIndex}"><span>${esc(option)}</span></label>`).join("")}
    </fieldset>`;
  };

  const listeningPlayerMarkup = (state, context, together = false) => {
    const item = listeningById(state.galaxy.selectedListeningId);
    const progress = progressForListening(state, item.id);
    const rate = clamp(state.settings.voiceRate || .85, .5, 1.25);
    const rows = timedSentences(item, rate);
    const duration = rows.at(-1)?.end || 0;
    const position = clamp(progress.position, 0, duration);
    const activeIndex = rows.find((row) => position >= row.start && position < row.end)?.index || 0;
    const voices = context.englishVoices();
    const adapter = context.speechAdapterStatus();
    const subtitle = state.galaxy.subtitleMode || "bi";
    const loop = state.galaxy.loopMode || "off";
    const maskRatio = clamp(state.galaxy.maskRatio || 0, 0, 70);
    const maskWords = (text, sentenceIndex) => text.split(/(\s+)/).map((token, wordIndex) => {
      if (!token.trim() || maskRatio <= 0) return esc(token);
      const shouldMask = ((wordIndex * 17 + sentenceIndex * 11) % 100) < maskRatio;
      return shouldMask ? `<span class="hheg-mask" title="Từ đang ẩn">${"•".repeat(Math.max(2, token.replace(/[^A-Za-z]/g, "").length))}</span>` : esc(token);
    }).join("");
    return `<section class="hheg-listen-player ${together ? "is-together" : ""}" data-hheg-listening-id="${item.id}">
      <header><div><small>${item.level} · ${esc(item.topic)} · ${together ? "LISTEN & READ TOGETHER" : "LISTENING GALAXY"}</small><h2>${esc(item.title)}</h2><p>${esc(item.description)}</p></div><div class="hheg-source"><i></i><span><strong>${item.audioUrl ? "Audio bài học" : "Giọng thiết bị"}</strong><small>${item.audioUrl ? "MP3/Opus" : voices.length ? `${voices.length} giọng tiếng Anh khả dụng` : "Thiết bị không có giọng tiếng Anh riêng"}</small></span></div></header>
      <div class="hheg-wave" data-hheg-wave aria-hidden="true">${Array.from({ length: 44 }, (_, index) => `<i style="--i:${index};--h:${24 + (index * 37 % 72)}%"></i>`).join("")}</div>
      <div class="hheg-progress"><input type="range" min="0" max="${duration.toFixed(2)}" step=".1" value="${position.toFixed(2)}" data-hheg-seek aria-label="Vị trí bài nghe"><span data-hheg-time>${timeText(position)} / ${timeText(duration)}</span></div>
      <div class="hheg-player-controls">
        <button type="button" data-hheg-action="back">−5s</button>
        <button type="button" class="primary" data-hheg-action="play">${progress.position > 0 ? "▶ Tiếp tục" : "▶ Phát"}</button>
        <button type="button" data-hheg-action="pause">Ⅱ Tạm dừng</button>
        <button type="button" data-hheg-action="restart">↺ Phát lại</button>
        <button type="button" data-hheg-action="forward">+5s</button>
        <button type="button" data-hheg-action="ab-a">A</button><button type="button" data-hheg-action="ab-b">B</button>
      </div>
      <div class="hheg-player-settings">
        <label><span>Tốc độ</span><select data-hheg-rate>${[.5,.65,.75,.85,1,1.1,1.25].map((value) => `<option value="${value}" ${Math.abs(rate - value) < .01 ? "selected" : ""}>${value}×</option>`).join("")}</select></label>
        <label><span>Phụ đề</span><select data-hheg-subtitle><option value="none" ${subtitle === "none" ? "selected" : ""}>Không phụ đề</option><option value="en" ${subtitle === "en" ? "selected" : ""}>English</option><option value="bi" ${subtitle === "bi" ? "selected" : ""}>Song ngữ</option></select></label>
        <label><span>Lặp</span><select data-hheg-loop><option value="off" ${loop === "off" ? "selected" : ""}>Tắt</option><option value="all" ${loop === "all" ? "selected" : ""}>Toàn bài</option><option value="sentence" ${loop === "sentence" ? "selected" : ""}>Câu hiện tại</option><option value="ab" ${loop === "ab" ? "selected" : ""}>Đoạn A–B</option></select></label>
        <label><span>Vùng giọng</span><select data-hheg-profile>${context.voiceProfiles.filter((profile) => ["en-US","en-GB","en-AU","en-CA"].includes(profile.lang)).map((profile) => `<option value="${profile.id}" ${state.settings.voiceProfile === profile.id ? "selected" : ""}>${esc(profile.label)}</option>`).join("")}</select></label>
      </div>
      <div class="hheg-capability ${adapter.speechOutput.supported ? "ok" : "error"}"><label><input type="checkbox" data-hhe-audio-consent ${state.settings.audioPlaybackConsent ? "checked" : ""}> Cho phép phát âm thanh khi tôi bấm nút nghe</label><span data-hheg-player-status>${adapter.speechOutput.supported ? (voices.length ? "Sẵn sàng phát bằng giọng tiếng Anh của thiết bị." : "Thiết bị không có giọng tiếng Anh riêng; sẽ thử giọng mặc định.") : "Trình duyệt không hỗ trợ giọng đọc. Hãy thử thiết bị khác."}</span></div>
      <div class="hheg-transcript" data-subtitle="${subtitle}">
        ${rows.map((row) => `<button type="button" class="${row.index === activeIndex ? "active" : ""}" data-hheg-sentence="${row.index}" data-start="${row.start.toFixed(2)}"><i>${String(row.index + 1).padStart(2, "0")}</i><span><strong>${together ? maskWords(row.en, row.index) : esc(row.en)}</strong><small>${esc(row.vi)}</small></span><em>▶</em></button>`).join("")}
      </div>
      ${together ? `<label class="hheg-mask-control"><span>Ẩn từ để luyện nghe <b>${maskRatio}%</b></span><input type="range" min="0" max="70" step="10" value="${maskRatio}" data-hheg-mask></label>` : ""}
      <footer><div><span>${progress.plays || 0} lượt phát</span><span>${progress.attempts?.length || 0} bài kiểm tra</span><span>${state.galaxy.offlineListening.includes(item.id) ? "Đã lưu ngoại tuyến" : "Chưa lưu ngoại tuyến"}</span></div><button type="button" data-hheg-action="offline">${state.galaxy.offlineListening.includes(item.id) ? "✓ Đã lưu offline" : "↓ Lưu để học offline"}</button><button type="button" data-hheg-action="retry">Thử lại giọng đọc</button></footer>
    </section>`;
  };

  const listeningView = (state, context) => {
    const item = listeningById(state.galaxy.selectedListeningId);
    const rows = timedSentences(item, state.settings.voiceRate);
    const currentPosition = progressForListening(state, item.id).position;
    const current = rows.find((row) => currentPosition >= row.start && currentPosition < row.end) || rows[0];
    return `<section class="hheg-workspace" data-hheg-view="listening">${orbitMarkup(state, context)}
      <header class="hheg-workspace-head"><div><small>LISTENING GALAXY · A0–C2</small><h2>Nghe thật, kiểm tra thật, lưu đúng vị trí.</h2><p>Audio có sẵn sẽ được ưu tiên; thư viện hiện dùng giọng tiếng Anh trên thiết bị và công khai trạng thái thay vì giả lập file âm thanh.</p></div><button type="button" data-hhe-view="listen-read">Mở chế độ kết hợp →</button></header>
      <div class="hheg-workspace-layout"><aside><label><span>Lọc theo cấp</span><select data-hheg-listening-level><option value="all">Tất cả A0–C2</option>${context.levelOrder.map((level) => `<option value="${level}">${level}</option>`).join("")}</select></label>${libraryCards(listeningLibrary, item.id, "listening")}</aside><main>
        ${listeningPlayerMarkup(state, context)}
        <section class="hheg-lab-grid">
          <form class="hheg-dictation" data-hheg-dictation data-answer="${esc(current.en)}"><header><div><small>DICTATION · CÂU ${current.index + 1}</small><h3>Nghe mà không nhìn đáp án</h3></div><button type="button" data-hheg-sentence="${current.index}">▶ Phát câu</button></header><textarea name="dictation" autocomplete="off" spellcheck="false" placeholder="Type what you hear..."></textarea><button class="primary" type="submit">Kiểm tra từng từ</button><output data-hheg-dictation-output>Những từ chưa nghe đúng sẽ được đưa vào hàng đợi ôn.</output></form>
          <section class="hheg-shadow"><header><small>SHADOWING</small><h3>Nghe → ghi âm → nghe lại</h3></header><blockquote>${esc(current.en)}</blockquote><label><input type="checkbox" data-hhe-mic-consent ${state.settings.microphoneConsent ? "checked" : ""}> Cho phép xin quyền microphone khi bấm ghi</label><div><button type="button" data-hheg-action="shadow">Mở Speaking Galaxy</button><button type="button" data-hhe-record>● Bắt đầu ghi</button><button type="button" data-hhe-stop disabled>■ Dừng</button><button type="button" data-hhe-delete-record disabled>Xóa</button></div><audio data-hhe-audio controls hidden></audio><small data-hhe-record-status>Bản ghi chỉ ở trên thiết bị, trừ khi bạn chủ động lưu.</small></section>
        </section>
        <form class="hheg-quiz" data-hheg-listening-quiz="${item.id}"><header><small>COMPREHENSION</small><h3>Ý chính · chi tiết · suy luận</h3></header>${item.questions.map((question, index) => questionMarkup(question, index, `listen-${item.id}`)).join("")}<button class="primary" type="submit">Chấm bài nghe</button><output data-hheg-quiz-output></output></form>
      </main></div>
    </section>`;
  };

  const wordMarkup = (text, paragraphIndex) => text.split(/(\s+)/).map((token, index) => {
    if (!token.trim()) return token;
    const word = token.replace(/^[^A-Za-z']+|[^A-Za-z']+$/g, "");
    if (!word) return esc(token);
    const before = token.slice(0, token.indexOf(word));
    const after = token.slice(token.indexOf(word) + word.length);
    return `${esc(before)}<button type="button" data-hheg-word="${esc(word.toLowerCase())}" data-paragraph="${paragraphIndex}">${esc(word)}</button>${esc(after)}`;
  }).join("");

  const readingView = (state, context) => {
    const article = readingById(state.galaxy.selectedReadingId);
    const progress = progressForReading(state, article.id);
    const settings = state.galaxy.readingSettings;
    const wordCount = article.paragraphs.join(" ").split(/\s+/).length;
    const wpm = progress.activeSeconds >= 10 ? Math.round(wordCount / (progress.activeSeconds / 60)) : 0;
    const selectedWord = state.galaxy.selectedWord;
    return `<section class="hheg-workspace" data-hheg-view="reading">${orbitMarkup(state, context)}
      <header class="hheg-workspace-head"><div><small>READING GALAXY · A0–C2</small><h2>Đọc rõ, hiểu sâu và lưu đúng nơi đang học.</h2><p>Tiến độ chỉ hoàn thành khi bạn đọc đủ nội dung hoặc nộp bài đọc hiểu.</p></div><button type="button" data-hhe-view="listen-read">Nghe và đọc cùng lúc →</button></header>
      <div class="hheg-workspace-layout reading"><aside><label><span>Lọc theo cấp</span><select data-hheg-reading-level><option value="all">Tất cả A0–C2</option>${context.levelOrder.map((level) => `<option value="${level}">${level}</option>`).join("")}</select></label>${libraryCards(readingLibrary, article.id, "reading")}</aside><main>
        <section class="hheg-reader ${settings.focus ? "focus" : ""} ${settings.contrast ? "contrast" : ""} ${settings.easyFont ? "easy-font" : ""}" style="--reader-font:${settings.fontScale}rem;--reader-line:${settings.lineHeight};--reader-width:${settings.columnWidth}px">
          <header><div><small>${article.level} · ${esc(article.topic)} · ${wordCount} từ</small><h2>${esc(article.title)}</h2><p>${esc(article.description)}</p></div><div><strong data-hheg-reading-percent>${Math.round(progress.percent)}%</strong><small>${timeText(progress.activeSeconds)} · ${wpm ? `${wpm} WPM` : "Đang đo WPM"}</small></div></header>
          <nav><button type="button" data-hheg-action="read-all">▶ Đọc toàn bài</button><button type="button" data-hheg-action="read-stop">■ Dừng đọc</button><button type="button" data-hheg-reading-toggle="focus" aria-pressed="${settings.focus}">Focus</button><button type="button" data-hheg-reading-toggle="contrast" aria-pressed="${settings.contrast}">Tương phản</button><button type="button" data-hheg-reading-toggle="easyFont" aria-pressed="${settings.easyFont}">Font dễ đọc</button></nav>
          <div class="hheg-reader-settings"><label>Cỡ chữ<input type="range" min=".85" max="1.45" step=".05" value="${settings.fontScale}" data-hheg-reading-setting="fontScale"></label><label>Chiều cao dòng<input type="range" min="1.4" max="2.2" step=".1" value="${settings.lineHeight}" data-hheg-reading-setting="lineHeight"></label><label>Độ rộng cột<input type="range" min="520" max="940" step="20" value="${settings.columnWidth}" data-hheg-reading-setting="columnWidth"></label></div>
          <div class="hheg-reader-scroll" data-hheg-reading-scroll data-reading-id="${article.id}">
            ${article.paragraphs.map((paragraph, index) => `<article data-hheg-paragraph="${index}" class="${progress.bookmarks.includes(index) ? "bookmarked" : ""}"><header><span>${String(index + 1).padStart(2, "0")}</span><div><button type="button" data-hheg-read-paragraph="${index}">▶ Đọc đoạn</button><button type="button" data-hheg-bookmark="${index}">${progress.bookmarks.includes(index) ? "★ Đã đánh dấu" : "☆ Đánh dấu"}</button></div></header><p>${wordMarkup(paragraph, index)}</p></article>`).join("")}
          </div>
          <footer><span>Vị trí được tự lưu trên thiết bị.</span><button type="button" data-hheg-reading-complete>Đánh dấu đã đọc xong</button></footer>
        </section>
        <section class="hheg-reading-tools">
          <article class="hheg-word-card"><small>WORD ORBIT</small>${selectedWord ? `<h3>${esc(selectedWord.word)}</h3><p>${esc(selectedWord.ipa || "Chưa có phiên âm trong từ điển bài học")}</p><strong>${esc(selectedWord.meaning || "Chưa có nghĩa trong từ điển cục bộ")}</strong><div><button type="button" data-hheg-speak-word="${esc(selectedWord.word)}">♪ Nghe từ</button><button type="button" data-hheg-save-selected-word>${state.savedWords?.[selectedWord.word] ? "★ Đã lưu" : "☆ Lưu vào Vocabulary"}</button></div>` : '<h3>Chạm vào một từ</h3><p>Nghĩa, phiên âm và nút nghe sẽ xuất hiện tại đây.</p>'}</article>
          <label class="hheg-notes"><span>Ghi chú cho bài này</span><textarea data-hheg-reading-notes placeholder="Ý chính, từ mới hoặc câu cần xem lại...">${esc(progress.notes)}</textarea><small>Tự lưu cục bộ</small></label>
        </section>
        <form class="hheg-quiz" data-hheg-reading-quiz="${article.id}"><header><small>READING CHECK</small><h3>Kiểm tra bằng chứng trong bài</h3></header>${article.questions.map((question, index) => questionMarkup(question, index, `read-${article.id}`)).join("")}<button class="primary" type="submit">Nộp bài đọc hiểu</button><output data-hheg-quiz-output>${progress.attempts[0] ? `Lần gần nhất: ${progress.attempts[0].score}%` : ""}</output></form>
      </main></div>
    </section>`;
  };

  const togetherView = (state, context) => {
    const item = listeningById(state.galaxy.selectedListeningId);
    const progress = progressForListening(state, item.id);
    const current = timedSentences(item, state.settings.voiceRate).find((row) => progress.position >= row.start && progress.position < row.end) || timedSentences(item, state.settings.voiceRate)[0];
    return `<section class="hheg-workspace together" data-hheg-view="listen-read">${orbitMarkup(state, context)}
      <header class="hheg-workspace-head"><div><small>LISTEN & READ TOGETHER</small><h2>Một nội dung, bốn bước: nghe · đọc · chép · nói.</h2><p>Bấm vào câu để phát đúng vị trí, ẩn từ để luyện nghe và đưa từ chưa nghe đúng vào hàng đợi ôn.</p></div><div><button type="button" data-hhe-view="listening">Listening</button><button type="button" data-hhe-view="reading">Reading</button><button type="button" data-hheg-action="shadow">Shadowing</button></div></header>
      ${listeningPlayerMarkup(state, context, true)}
      <section class="hheg-together-grid">
        <form class="hheg-dictation" data-hheg-dictation data-answer="${esc(current.en)}"><header><div><small>TRANSCRIPT CHECK</small><h3>So sánh câu bạn nghe được</h3></div></header><textarea name="dictation" autocomplete="off" spellcheck="false" placeholder="Type the sentence you hear..."></textarea><button class="primary" type="submit">So sánh transcript</button><output data-hheg-dictation-output></output></form>
        <section class="hheg-next-step"><small>VÒNG HỌC LIÊN KẾT</small><h3>Từ nghe sai sẽ đi đâu?</h3><ol><li><b>1</b><span>So sánh transcript trên thiết bị</span></li><li><b>2</b><span>Lưu từ chưa khớp vào Vocabulary Planet</span></li><li><b>3</b><span>Đặt lịch ôn ngay hôm nay</span></li><li><b>4</b><span>Mở Speaking Galaxy để shadowing</span></li></ol><button type="button" data-hhe-view="vocabulary">Mở hàng đợi ôn →</button></section>
      </section>
    </section>`;
  };

  const renderView = (state, context) => {
    if (!VIEWS.has(state.activeView)) return null;
    if (state.activeView === "listening") return listeningView(state, context);
    if (state.activeView === "reading") return readingView(state, context);
    if (state.activeView === "listen-read") return togetherView(state, context);
    return dashboardView(state, context);
  };

  const stateWrite = (instance, state, options = {}) => {
    state.galaxy.lastSavedAt = new Date().toISOString();
    instance.runtime.writeState(state);
    root.dispatchEvent?.(new CustomEvent("hh:english-state-changed", { detail: { version: VERSION, activeView: state.activeView, savedAt: state.galaxy.lastSavedAt } }));
    if (options.render) {
      const nextHash = state.activeView === "dashboard" ? "#/english" : `#/english/${state.activeView}`;
      if (options.route && root.location && root.location.hash !== nextHash) root.location.hash = nextHash;
      else instance.runtime.render(options.focus ? { focusView: true } : undefined);
    }
  };
  const activeListening = (instance, state = instance.runtime.readState()) => listeningById(state.galaxy.selectedListeningId);
  const stopPlayer = (instance, options = {}) => {
    instance.player.token += 1;
    root.speechSynthesis?.cancel?.();
    clearInterval(instance.player.tick);
    instance.player.tick = 0;
    instance.player.playing = false;
    instance.player.paused = false;
    if (!options.silent) updatePlayerDom(instance, "Đã dừng.");
  };
  const updatePlayerDom = (instance, status = "") => {
    const state = instance.runtime.readState();
    const item = activeListening(instance, state);
    const rate = clamp(state.settings.voiceRate || .85, .5, 1.25);
    const rows = timedSentences(item, rate);
    const duration = rows.at(-1)?.end || 0;
    const position = clamp(instance.player.position ?? progressForListening(state, item.id).position, 0, duration);
    const seek = instance.host.querySelector("[data-hheg-seek]");
    if (seek) seek.value = position;
    const time = instance.host.querySelector("[data-hheg-time]");
    if (time) time.textContent = `${timeText(position)} / ${timeText(duration)}`;
    instance.host.querySelectorAll("[data-hheg-sentence]").forEach((node) => node.classList.toggle("active", Number(node.dataset.hhegSentence) === instance.player.sentenceIndex));
    const statusNode = instance.host.querySelector("[data-hheg-player-status]");
    if (statusNode && status) statusNode.textContent = status;
    const wave = instance.host.querySelector("[data-hheg-wave]");
    wave?.classList.toggle("playing", instance.player.playing && !instance.player.paused);
  };
  const persistListeningPosition = (instance, completed = false) => {
    const state = instance.runtime.readState();
    const item = activeListening(instance, state);
    const progress = progressForListening(state, item.id);
    progress.position = Math.max(0, Number(instance.player.position) || 0);
    progress.lastPlayedAt = new Date().toISOString();
    if (completed) progress.completedAt = progress.completedAt || new Date().toISOString();
    state.galaxy.listeningProgress[item.id] = progress;
    stateWrite(instance, state);
  };
  const sentenceIndexAt = (rows, position) => rows.find((row) => position >= row.start && position < row.end)?.index ?? Math.max(0, rows.length - 1);
  const playSentence = (instance, index) => {
    const state = instance.runtime.readState();
    const item = activeListening(instance, state);
    const rate = clamp(state.settings.voiceRate || .85, .5, 1.25);
    const rows = timedSentences(item, rate);
    const row = rows[clamp(index, 0, rows.length - 1)];
    if (!row) return;
    if (!state.settings.audioPlaybackConsent) {
      updatePlayerDom(instance, "Hãy bật quyền phát âm thanh trong Voice Studio hoặc Cài đặt trước.");
      instance.runtime.toast("Hãy bật quyền phát âm thanh trước khi nghe.", "error");
      return;
    }
    if (!root.speechSynthesis || typeof root.SpeechSynthesisUtterance !== "function") {
      updatePlayerDom(instance, "Trình duyệt không hỗ trợ giọng đọc. Hãy thử thiết bị khác.");
      return;
    }
    const token = ++instance.player.token;
    root.speechSynthesis.cancel();
    const utterance = new root.SpeechSynthesisUtterance(row.en);
    utterance.lang = instance.runtime.voiceProfileById(state.settings.voiceProfile).lang;
    utterance.rate = rate;
    utterance.pitch = Number(state.settings.voicePitch) || 1;
    const voice = instance.runtime.selectVoice(instance.runtime.englishVoices(), state.settings);
    if (voice) utterance.voice = voice;
    instance.player.position = row.start;
    instance.player.sentenceIndex = row.index;
    instance.player.playing = true;
    instance.player.paused = false;
    instance.player.startedAt = performance.now();
    instance.player.rowStart = row.start;
    instance.player.rowEnd = row.end;
    const progress = progressForListening(state, item.id);
    progress.plays = (progress.plays || 0) + (row.index === 0 || !progress.lastPlayedAt ? 1 : 0);
    progress.lastPlayedAt = new Date().toISOString();
    state.galaxy.listeningProgress[item.id] = progress;
    stateWrite(instance, state);
    updatePlayerDom(instance, voice ? `Đang phát bằng ${voice.name}.` : "Đang dùng giọng mặc định của thiết bị.");
    clearInterval(instance.player.tick);
    instance.player.tick = root.setInterval(() => {
      if (!instance.player.playing || instance.player.paused || token !== instance.player.token) return;
      const elapsed = (performance.now() - instance.player.startedAt) / 1000;
      instance.player.position = Math.min(row.end, row.start + elapsed);
      updatePlayerDom(instance);
    }, 200);
    utterance.onend = () => {
      if (token !== instance.player.token) return;
      clearInterval(instance.player.tick);
      instance.player.position = row.end;
      const latest = instance.runtime.readState();
      const mode = latest.galaxy.loopMode || "off";
      let nextIndex = row.index + 1;
      if (mode === "sentence") nextIndex = row.index;
      if (mode === "ab") {
        const a = Number(latest.galaxy.abStart) || 0;
        const b = Number(latest.galaxy.abEnd) || rows.at(-1).end;
        if (row.end >= b || rows[nextIndex]?.start >= b) nextIndex = sentenceIndexAt(rows, a);
      }
      if (nextIndex < rows.length) playSentence(instance, nextIndex);
      else if (mode === "all") playSentence(instance, 0);
      else {
        instance.player.playing = false;
        persistListeningPosition(instance, true);
        updatePlayerDom(instance, "Đã nghe hết bài.");
        const completeState = instance.runtime.readState();
        addActivity(completeState, "listening", `Đã nghe hết ${item.title}`, "listening");
        stateWrite(instance, completeState);
      }
    };
    utterance.onerror = (event) => {
      if (token !== instance.player.token || event.error === "canceled" || event.error === "interrupted") return;
      stopPlayer(instance, { silent: true });
      updatePlayerDom(instance, `Không thể phát giọng đọc: ${event.error || "lỗi không xác định"}.`);
    };
    root.speechSynthesis.speak(utterance);
  };
  const seekTo = (instance, value, autoplay = true) => {
    const state = instance.runtime.readState();
    const rows = timedSentences(activeListening(instance, state), state.settings.voiceRate);
    const duration = rows.at(-1)?.end || 0;
    const position = clamp(value, 0, duration);
    instance.player.position = position;
    instance.player.sentenceIndex = sentenceIndexAt(rows, position);
    persistListeningPosition(instance);
    if (autoplay) playSentence(instance, instance.player.sentenceIndex);
    else updatePlayerDom(instance);
  };

  const lookupWord = (instance, word) => {
    const normalized = clean(word, 80).toLowerCase();
    const entry = instance.vocabulary.get(normalized);
    return entry ? { word: normalized, ipa: entry[1], meaning: entry[2], example: entry[3] } : { word: normalized, ipa: "", meaning: "", example: "" };
  };
  const saveMissedWords = (instance, state, words, sourceText) => {
    const now = new Date().toISOString();
    words.forEach((word) => {
      const cleanWord = clean(word, 60).toLowerCase();
      if (!cleanWord) return;
      const dictionary = lookupWord(instance, cleanWord);
      if (!state.savedWords[cleanWord]) state.savedWords[cleanWord] = { ...dictionary, meaning: dictionary.meaning || "Từ chưa nghe đúng", example: dictionary.example || sourceText, level: instance.runtime.selectedLevelId(state), savedAt: now, source: "listening-dictation" };
      state.reviewQueue[cleanWord] = { ...(state.reviewQueue[cleanWord] || {}), dueAt: now, lastRating: "again" };
      if (!state.galaxy.missedWords.includes(cleanWord)) state.galaxy.missedWords.unshift(cleanWord);
    });
    state.galaxy.missedWords = state.galaxy.missedWords.slice(0, 120);
  };
  const readingTick = (instance) => {
    const state = instance.runtime.readState();
    let dirty = false;
    let checkpoint = false;
    if (root.document?.visibilityState === "visible" && state.activeView === "reading") {
      const article = readingById(state.galaxy.selectedReadingId);
      const progress = progressForReading(state, article.id);
      progress.activeSeconds += 1;
      state.galaxy.readingProgress[article.id] = progress;
      instance.readingDirty += 1;
      dirty = true;
      const display = instance.host.querySelector(".hheg-reader>header>div:last-child small");
      if (display) {
        const words = article.paragraphs.join(" ").split(/\s+/).length;
        const wpm = progress.activeSeconds >= 10 ? Math.round(words / (progress.activeSeconds / 60)) : 0;
        display.textContent = `${timeText(progress.activeSeconds)} · ${wpm ? `${wpm} WPM` : "Đang đo WPM"}`;
      }
      if (instance.readingDirty >= 15) { instance.readingDirty = 0; checkpoint = true; }
    }
    if (root.document?.visibilityState === "visible" && state.galaxy.focus?.running && state.galaxy.focus.remaining > 0) {
      state.galaxy.focus.remaining -= 1;
      dirty = true;
      const focusNode = instance.host.querySelector("[data-hheg-focus-time]");
      if (focusNode) focusNode.textContent = timeText(state.galaxy.focus.remaining);
      instance.focusDirty += 1;
      if (state.galaxy.focus.remaining <= 0) {
        state.galaxy.focus.running = false;
        state.galaxy.focus.completedAt = new Date().toISOString();
        const minutes = state.galaxy.focus.plannedMinutes || 15;
        state.minutesByDay[instance.runtime.todayKey()] = (state.minutesByDay[instance.runtime.todayKey()] || 0) + minutes;
        instance.runtime.updateStreak(state);
        state.xp += minutes * 2;
        addActivity(state, "focus", `Hoàn thành phiên học ${minutes} phút`, "dashboard");
        state.galaxy.coachMessage = `Đã hoàn thành phiên học ${minutes} phút và lưu ${minutes * 2} XP.`;
        stateWrite(instance, state, { render: true });
        instance.runtime.toast(`Hoàn thành phiên học ${minutes} phút.`, "success");
      } else if (instance.focusDirty >= 15) { instance.focusDirty = 0; checkpoint = true; }
    }
    if (dirty) {
      if (checkpoint) stateWrite(instance, state);
      else instance.runtime.writeState(state);
    }
  };

  const parseCoach = (instance, command) => {
    const text = clean(command, 240);
    const folded = text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    const state = instance.runtime.readState();
    if (/tiep tuc.*bai nghe|bai nghe.*gan nhat/.test(folded)) {
      state.activeView = "listening";
      state.galaxy.coachMessage = `Đã mở lại ${activeListening(instance, state).title} tại vị trí đã lưu.`;
    } else if (/doc.*cham hon/.test(folded)) {
      const article = readingById(state.galaxy.selectedReadingId);
      state.activeView = "reading";
      state.settings.voiceRate = .65;
      state.galaxy.coachMessage = `Đã mở ${article.title} và chuyển tốc độ đọc xuống 0.65×.`;
      root.setTimeout?.(() => instance.runtime.speak(article.paragraphs.join(" "), instance.runtime.readState().settings, { rate: .65 }), 350);
    } else if (/on.*tu.*nghe sai|tu.*nghe sai/.test(folded)) {
      state.activeView = "vocabulary";
      state.galaxy.coachMessage = state.galaxy.missedWords.length ? `Đã mở ${state.galaxy.missedWords.length} từ nghe chưa đúng trong Vocabulary Planet.` : "Chưa có từ nghe sai. Hãy hoàn thành một bài dictation trước.";
    } else if (/bai doc/.test(folded)) {
      const level = (folded.match(/\b(a0|a1|a2|b1|b2|c1|c2)\b/)?.[1] || instance.runtime.selectedLevelId(state)).toUpperCase();
      const topic = /cong nghe|technology/.test(folded) ? "Công nghệ" : /du lich/.test(folded) ? "Du lịch" : /cong viec/.test(folded) ? "Công việc" : "";
      const article = readingLibrary.find((item) => item.level === level && (!topic || item.topic === topic)) || levelReading(level);
      state.selectedLevel = level;
      state.galaxy.selectedReadingId = article.id;
      state.activeView = "reading";
      state.galaxy.coachMessage = `Đã mở bài đọc ${level}: ${article.title}.`;
    } else if (/luyen phat am/.test(folded)) {
      const phrase = text.split(/[:：]/).slice(1).join(":").trim() || timedSentences(activeListening(instance, state), state.settings.voiceRate)[0].en;
      state.galaxy.shadowingTarget = phrase;
      state.activeView = "speaking";
      state.galaxy.coachMessage = `Đã chuyển câu “${phrase}” sang Speaking Galaxy.`;
    } else if (/hom nay.*lam gi|can hoc gi|ke hoach/.test(folded)) {
      state.activeView = "plan";
      state.galaxy.coachMessage = "Đã mở kế hoạch hôm nay dựa trên trình độ, từ đến hạn và tiến độ thật.";
    } else if (/focus|phien hoc|15 phut|25 phut/.test(folded)) {
      const minutes = clamp(Number(folded.match(/(\d+)\s*phut/)?.[1]) || 15, 5, 60);
      state.galaxy.focus = { running: true, remaining: minutes * 60, plannedMinutes: minutes, startedAt: new Date().toISOString() };
      state.galaxy.coachMessage = `Phiên học ${minutes} phút đã bắt đầu. Đồng hồ chỉ chạy khi tab đang hiển thị.`;
    } else {
      state.galaxy.coachMessage = "Tôi chưa nhận ra lệnh này. Hãy thử mở bài nghe, bài đọc, ôn từ nghe sai, luyện phát âm hoặc tạo phiên học 15 phút.";
    }
    addActivity(state, "coach", state.galaxy.coachMessage, state.activeView);
    stateWrite(instance, state, { render: true, focus: true, route: true });
  };

  const handleClick = (instance, event) => {
    const button = event.target.closest("[data-hheg-action], [data-hheg-select-listening], [data-hheg-select-reading], [data-hheg-sentence], [data-hheg-word], [data-hheg-read-paragraph], [data-hheg-bookmark], [data-hheg-reading-toggle], [data-hheg-reading-complete], [data-hheg-speak-word], [data-hheg-save-selected-word], [data-hheg-command]");
    if (!button || !instance.host.contains(button)) return;
    if (button.dataset.hhegCommand) { parseCoach(instance, button.dataset.hhegCommand); return; }
    if (button.dataset.hhegSelectListening) {
      stopPlayer(instance, { silent: true });
      const state = instance.runtime.readState();
      state.galaxy.selectedListeningId = button.dataset.hhegSelectListening;
      state.selectedLevel = listeningById(state.galaxy.selectedListeningId).level;
      addActivity(state, "listening", `Đã mở ${listeningById(state.galaxy.selectedListeningId).title}`, "listening");
      stateWrite(instance, state, { render: true });
      return;
    }
    if (button.dataset.hhegSelectReading) {
      const state = instance.runtime.readState();
      state.galaxy.selectedReadingId = button.dataset.hhegSelectReading;
      state.selectedLevel = readingById(state.galaxy.selectedReadingId).level;
      const progress = progressForReading(state, state.galaxy.selectedReadingId);
      progress.openedAt = progress.openedAt || new Date().toISOString();
      state.galaxy.readingProgress[state.galaxy.selectedReadingId] = progress;
      addActivity(state, "reading", `Đã mở ${readingById(state.galaxy.selectedReadingId).title}`, "reading");
      stateWrite(instance, state, { render: true });
      return;
    }
    if (button.dataset.hhegSentence != null) { seekTo(instance, Number(button.dataset.start) || timedSentences(activeListening(instance), instance.runtime.readState().settings.voiceRate)[Number(button.dataset.hhegSentence)]?.start || 0); return; }
    if (button.dataset.hhegWord) {
      const state = instance.runtime.readState();
      state.galaxy.selectedWord = lookupWord(instance, button.dataset.hhegWord);
      stateWrite(instance, state, { render: true });
      return;
    }
    if (button.dataset.hhegReadParagraph != null) {
      const state = instance.runtime.readState();
      const article = readingById(state.galaxy.selectedReadingId);
      instance.runtime.speak(article.paragraphs[Number(button.dataset.hhegReadParagraph)] || "", state.settings);
      return;
    }
    if (button.dataset.hhegBookmark != null) {
      const state = instance.runtime.readState();
      const article = readingById(state.galaxy.selectedReadingId);
      const progress = progressForReading(state, article.id);
      const index = Number(button.dataset.hhegBookmark);
      progress.bookmarks = progress.bookmarks.includes(index) ? progress.bookmarks.filter((item) => item !== index) : [...progress.bookmarks, index];
      state.galaxy.readingProgress[article.id] = progress;
      stateWrite(instance, state, { render: true });
      return;
    }
    if (button.dataset.hhegReadingToggle) {
      const state = instance.runtime.readState();
      const key = button.dataset.hhegReadingToggle;
      state.galaxy.readingSettings[key] = !state.galaxy.readingSettings[key];
      stateWrite(instance, state, { render: true });
      return;
    }
    if (button.hasAttribute("data-hheg-reading-complete")) {
      const state = instance.runtime.readState();
      const article = readingById(state.galaxy.selectedReadingId);
      const progress = progressForReading(state, article.id);
      if (progress.percent < 80 && !progress.attempts.length) { instance.runtime.toast("Hãy đọc ít nhất 80% hoặc nộp bài đọc hiểu trước.", "error"); return; }
      progress.completedAt = progress.completedAt || new Date().toISOString();
      state.galaxy.readingProgress[article.id] = progress;
      addActivity(state, "reading", `Đã hoàn thành ${article.title}`, "reading");
      stateWrite(instance, state, { render: true });
      return;
    }
    if (button.dataset.hhegSpeakWord) {
      const state = instance.runtime.readState();
      instance.runtime.speak(button.dataset.hhegSpeakWord, state.settings, { rate: .75 });
      return;
    }
    if (button.hasAttribute("data-hheg-save-selected-word")) {
      const state = instance.runtime.readState();
      const item = state.galaxy.selectedWord;
      if (!item?.word) return;
      if (state.savedWords[item.word]) delete state.savedWords[item.word];
      else state.savedWords[item.word] = { ...item, level: instance.runtime.selectedLevelId(state), savedAt: new Date().toISOString(), source: "reading-galaxy" };
      stateWrite(instance, state, { render: true });
      instance.runtime.toast(state.savedWords[item.word] ? "Đã lưu vào Vocabulary Planet." : "Đã bỏ từ khỏi sổ.");
      return;
    }
    const action = button.dataset.hhegAction;
    if (!action) return;
    const state = instance.runtime.readState();
    const item = activeListening(instance, state);
    const rows = timedSentences(item, state.settings.voiceRate);
    const duration = rows.at(-1)?.end || 0;
    if (action === "play") playSentence(instance, sentenceIndexAt(rows, progressForListening(state, item.id).position));
    else if (action === "pause") {
      if (root.speechSynthesis?.paused) { root.speechSynthesis.resume(); instance.player.paused = false; updatePlayerDom(instance, "Đang tiếp tục."); }
      else { root.speechSynthesis?.pause?.(); instance.player.paused = true; updatePlayerDom(instance, "Đã tạm dừng."); persistListeningPosition(instance); }
    } else if (action === "restart") seekTo(instance, 0);
    else if (action === "back") seekTo(instance, (instance.player.position ?? progressForListening(state, item.id).position) - 5);
    else if (action === "forward") seekTo(instance, (instance.player.position ?? progressForListening(state, item.id).position) + 5);
    else if (action === "ab-a" || action === "ab-b") {
      const key = action === "ab-a" ? "abStart" : "abEnd";
      state.galaxy[key] = clamp(instance.player.position ?? progressForListening(state, item.id).position, 0, duration);
      if (action === "ab-b" && state.galaxy.abEnd <= (state.galaxy.abStart || 0)) { instance.runtime.toast("Điểm B phải nằm sau điểm A.", "error"); return; }
      state.galaxy.loopMode = "ab";
      stateWrite(instance, state, { render: true });
      instance.runtime.toast(`Đã đặt ${action === "ab-a" ? "A" : "B"} tại ${timeText(state.galaxy[key])}.`);
    } else if (action === "retry") { stopPlayer(instance, { silent: true }); playSentence(instance, sentenceIndexAt(rows, progressForListening(state, item.id).position)); }
    else if (action === "offline") {
      const exists = state.galaxy.offlineListening.includes(item.id);
      state.galaxy.offlineListening = exists ? state.galaxy.offlineListening.filter((id) => id !== item.id) : [...state.galaxy.offlineListening, item.id];
      stateWrite(instance, state, { render: true });
      if (!exists && root.caches) root.caches.open("hh-english-offline-v1").then((cache) => cache.addAll(["./english-learning-galaxy.js?v=1", "./english-learning-galaxy.css?v=1"])).catch(() => {});
      instance.runtime.toast(exists ? "Đã bỏ đánh dấu ngoại tuyến." : "Đã lưu nội dung. Âm thanh sẽ dùng giọng cục bộ của thiết bị.");
    } else if (action === "shadow") {
      state.galaxy.shadowingTarget = rows[instance.player.sentenceIndex || 0]?.en || rows[0].en;
      state.activeView = "speaking";
      stateWrite(instance, state, { render: true, focus: true, route: true });
    } else if (action === "read-all") {
      const article = readingById(state.galaxy.selectedReadingId);
      instance.runtime.speak(article.paragraphs.join(" "), state.settings);
    } else if (action === "read-stop") root.speechSynthesis?.cancel?.();
  };

  const handleChange = (instance, event) => {
    const target = event.target;
    const state = instance.runtime.readState();
    if (target.matches("[data-hheg-rate]")) {
      state.settings.voiceRate = clamp(target.value, .5, 1.25);
      stateWrite(instance, state, { render: true });
    } else if (target.matches("[data-hheg-subtitle]")) {
      state.galaxy.subtitleMode = target.value;
      stateWrite(instance, state, { render: true });
    } else if (target.matches("[data-hheg-loop]")) {
      state.galaxy.loopMode = target.value;
      stateWrite(instance, state);
    } else if (target.matches("[data-hheg-profile]")) {
      state.settings.voiceProfile = target.value;
      state.settings.voiceURI = "";
      stateWrite(instance, state, { render: true });
    } else if (target.matches("[data-hheg-seek]")) seekTo(instance, Number(target.value), false);
    else if (target.matches("[data-hheg-listening-level]")) {
      instance.host.querySelectorAll("[data-hheg-select-listening]").forEach((node) => { node.hidden = target.value !== "all" && listeningById(node.dataset.hhegSelectListening).level !== target.value; });
    } else if (target.matches("[data-hheg-reading-level]")) {
      instance.host.querySelectorAll("[data-hheg-select-reading]").forEach((node) => { node.hidden = target.value !== "all" && readingById(node.dataset.hhegSelectReading).level !== target.value; });
    }
  };

  const handleInput = (instance, event) => {
    const target = event.target;
    if (target.matches("[data-hheg-mask]")) {
      const state = instance.runtime.readState();
      state.galaxy.maskRatio = clamp(target.value, 0, 70);
      stateWrite(instance, state, { render: true });
    } else if (target.matches("[data-hheg-reading-setting]")) {
      const state = instance.runtime.readState();
      const key = target.dataset.hhegReadingSetting;
      state.galaxy.readingSettings[key] = Number(target.value);
      stateWrite(instance, state, { render: true });
    } else if (target.matches("[data-hheg-reading-notes]")) {
      clearTimeout(instance.noteTimer);
      instance.noteTimer = root.setTimeout?.(() => {
        const state = instance.runtime.readState();
        const article = readingById(state.galaxy.selectedReadingId);
        const progress = progressForReading(state, article.id);
        progress.notes = target.value.slice(0, 4000);
        state.galaxy.readingProgress[article.id] = progress;
        stateWrite(instance, state);
      }, 350);
    }
  };

  const handleSubmit = (instance, event) => {
    const form = event.target;
    if (!form.matches("[data-hheg-dictation], [data-hheg-listening-quiz], [data-hheg-reading-quiz], [data-hheg-coach]")) return;
    event.preventDefault();
    if (form.matches("[data-hheg-coach]")) { parseCoach(instance, new FormData(form).get("command")); return; }
    const state = instance.runtime.readState();
    if (form.matches("[data-hheg-dictation]")) {
      const answer = form.dataset.answer || "";
      const typed = clean(new FormData(form).get("dictation"), 1000);
      if (!typed) { instance.runtime.toast("Hãy nhập câu bạn nghe được.", "error"); return; }
      const result = instance.runtime.compareTranscript(typed, answer);
      const output = form.querySelector("[data-hheg-dictation-output]");
      output.innerHTML = `<b>${result.score}%</b> ${result.missed.length ? `Từ chưa khớp: ${esc(result.missed.join(" · "))}` : "Bạn đã nghe đúng toàn bộ từ."}`;
      const item = activeListening(instance, state);
      const progress = progressForListening(state, item.id);
      progress.dictations.unshift({ attemptId: `dict-${Date.now()}`, target: answer, transcript: typed, score: result.score, missed: result.missed, createdAt: new Date().toISOString() });
      progress.dictations = progress.dictations.slice(0, 40);
      state.galaxy.listeningProgress[item.id] = progress;
      saveMissedWords(instance, state, result.missed, answer);
      addActivity(state, "dictation", `Dictation ${item.title}: ${result.score}%`, "listen-read");
      stateWrite(instance, state);
      return;
    }
    const isListening = form.matches("[data-hheg-listening-quiz]");
    const item = isListening ? listeningById(form.dataset.hhegListeningQuiz) : readingById(form.dataset.hhegReadingQuiz);
    const questions = item.questions;
    const prefix = `${isListening ? "listen" : "read"}-${item.id}`;
    const answers = questions.map((_, index) => Number(new FormData(form).get(`${prefix}-${index}`)));
    if (answers.some((value) => !Number.isInteger(value))) { instance.runtime.toast("Hãy trả lời đủ các câu trước khi nộp.", "error"); return; }
    const correct = questions.reduce((total, question, index) => total + (answers[index] === Number(question[isListening ? 3 : 2]) ? 1 : 0), 0);
    const score = Math.round(correct / questions.length * 100);
    const details = questions.map((question, index) => answers[index] === Number(question[isListening ? 3 : 2]) ? "" : `Câu ${index + 1}: ${question[isListening ? 4 : 3]}`).filter(Boolean);
    form.querySelector("[data-hheg-quiz-output]").innerHTML = `<b>${score}% · ${correct}/${questions.length}</b>${details.length ? `<span>${esc(details.join(" "))}</span>` : "<span>Tất cả câu trả lời đều đúng.</span>"}`;
    if (isListening) {
      const progress = progressForListening(state, item.id);
      progress.attempts.unshift({ attemptId: `listen-${Date.now()}`, answers, score, createdAt: new Date().toISOString() });
      progress.attempts = progress.attempts.slice(0, 30);
      state.galaxy.listeningProgress[item.id] = progress;
      addActivity(state, "listening", `Bài nghe ${item.title}: ${score}%`, "listening");
    } else {
      const progress = progressForReading(state, item.id);
      progress.attempts.unshift({ attemptId: `read-${Date.now()}`, answers, score, createdAt: new Date().toISOString() });
      progress.attempts = progress.attempts.slice(0, 30);
      progress.completedAt = progress.completedAt || new Date().toISOString();
      state.galaxy.readingProgress[item.id] = progress;
      addActivity(state, "reading", `Bài đọc ${item.title}: ${score}%`, "reading");
    }
    stateWrite(instance, state);
  };

  const handleScroll = (instance, event) => {
    const node = event.target.closest?.("[data-hheg-reading-scroll]");
    if (!node || !instance.host.contains(node)) return;
    const max = Math.max(1, node.scrollHeight - node.clientHeight);
    const percent = clamp(node.scrollTop / max * 100, 0, 100);
    const state = instance.runtime.readState();
    const id = node.dataset.readingId;
    const progress = progressForReading(state, id);
    progress.percent = Math.max(progress.percent || 0, percent);
    state.galaxy.readingProgress[id] = progress;
    const display = instance.host.querySelector("[data-hheg-reading-percent]");
    if (display) display.textContent = `${Math.round(progress.percent)}%`;
    clearTimeout(instance.scrollTimer);
    instance.scrollTimer = root.setTimeout?.(() => stateWrite(instance, state), 350);
  };

  const bind = (runtime) => {
    if (!runtime?.host) return;
    let instance = instances.get(runtime.host);
    if (!instance) {
      instance = {
        host: runtime.host, runtime, player: { token: 0, position: 0, sentenceIndex: 0, playing: false, paused: false, tick: 0 },
        vocabulary: new Map(), readingDirty: 0, focusDirty: 0, scrollTimer: 0, noteTimer: 0
      };
      instances.set(runtime.host, instance);
      runtime.host.addEventListener("click", (event) => handleClick(instance, event));
      runtime.host.addEventListener("change", (event) => handleChange(instance, event));
      runtime.host.addEventListener("input", (event) => handleInput(instance, event));
      runtime.host.addEventListener("submit", (event) => handleSubmit(instance, event));
      runtime.host.addEventListener("scroll", (event) => handleScroll(instance, event), true);
      instance.timer = root.setInterval?.(() => readingTick(instance), 1000);
      root.addEventListener?.("online", () => runtime.render());
      root.addEventListener?.("offline", () => runtime.render());
      root.addEventListener?.("hh:home-galaxy-preferences-applied", () => runtime.render());
    }
    instance.runtime = runtime;
    instance.vocabulary.clear();
    const sourceLessons = root.HHEnglish?.courses?.flatMap?.((unit) => unit.lessons || []) || [];
    sourceLessons.forEach((lesson) => (lesson.vocabulary || []).forEach((entry) => instance.vocabulary.set(String(entry[0]).toLowerCase(), entry)));
    const selectedState = runtime.readState();
    if (selectedState.activeView === "listening" || selectedState.activeView === "listen-read") {
      const item = activeListening(instance, selectedState);
      const progress = progressForListening(selectedState, item.id);
      instance.player.position = progress.position || 0;
      instance.player.sentenceIndex = sentenceIndexAt(timedSentences(item, selectedState.settings.voiceRate), instance.player.position);
      updatePlayerDom(instance);
    }
    if (selectedState.activeView === "reading") {
      const reader = runtime.host.querySelector("[data-hheg-reading-scroll]");
      const progress = progressForReading(selectedState, selectedState.galaxy.selectedReadingId);
      root.requestAnimationFrame?.(() => {
        if (!reader) return;
        const max = Math.max(0, reader.scrollHeight - reader.clientHeight);
        reader.scrollTop = max * clamp(progress.percent, 0, 100) / 100;
      });
    }
  };

  const unmount = (host) => {
    const instance = instances.get(host);
    if (!instance) return;
    stopPlayer(instance, { silent: true });
    clearInterval(instance.timer);
    clearTimeout(instance.scrollTimer);
    clearTimeout(instance.noteTimer);
    instances.delete(host);
  };

  root.HHEnglishGalaxy = Object.freeze({
    VERSION, VIEWS: [...VIEWS], listeningLibrary, readingLibrary,
    defaultState, mergeState, renderView, bind, unmount, timedSentences,
    progressForListening, progressForReading
  });
  if (typeof module !== "undefined" && module.exports) module.exports = root.HHEnglishGalaxy;
})();
