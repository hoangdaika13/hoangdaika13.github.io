(function initHHPhatPhap(global) {
  "use strict";

  const VERSION = "1.0.0";
  const STATE_PREFIX = "hh.phat-phap.study.v1";
  const JOURNAL_PREFIX = "hh.phat-phap.journal.v1";
  const JOURNAL_ITERATIONS = 180000;

  const SOURCES = Object.freeze([
    {
      id: "suttacentral",
      title: "SuttaCentral",
      organization: "SuttaCentral",
      url: "https://suttacentral.net/",
      licenseUrl: "https://suttacentral.net/licensing",
      note: "Kho kinh điển đa ngôn ngữ. Nguyên bản cổ thuộc phạm vi công cộng; giấy phép bản dịch phải kiểm tra theo từng tài liệu.",
      status: "Nguồn học thuật"
    },
    {
      id: "ghpgvn",
      title: "Giáo hội Phật giáo Việt Nam",
      organization: "GHPGVN",
      url: "https://ghpgvn.vn/",
      note: "Cổng thông tin chính thức để tra cứu hoạt động, thông báo và tổ chức Phật giáo tại Việt Nam.",
      status: "Nguồn chính thức"
    },
    {
      id: "phatsuonline",
      title: "Phật Sự Online",
      organization: "Phật Sự Online",
      url: "https://www.phatsuonline.vn/",
      liveUrl: "https://www.phatsuonline.vn/tin/truyen-hinh-truc-tiep",
      note: "Tin tức, pháp sự và chương trình trực tiếp. Người học được mở nguồn gốc thay vì xem nội dung nhúng không rõ quyền.",
      status: "Kênh Phật sự"
    }
  ]);

  const LESSONS = Object.freeze([
    { id: "duc-phat", order: 1, title: "Đức Phật và con đường tỉnh thức", duration: 8, tradition: "Căn bản", summary: "Tìm hiểu cuộc đời Đức Phật lịch sử và mục đích thực tiễn của việc học Phật: thấy rõ khổ, nguyên nhân của khổ và con đường chuyển hóa.", practice: "Dành ba phút quan sát hơi thở, chỉ nhận biết mà không phán xét.", sourceId: "suttacentral" },
    { id: "tam-bao", order: 2, title: "Tam Bảo: Phật · Pháp · Tăng", duration: 9, tradition: "Căn bản", summary: "Phật là bậc giác ngộ, Pháp là lời dạy và con đường thực hành, Tăng là cộng đồng tu học chân chính. Quy y là định hướng sống, không phải lời hứa đem lại phép màu.", practice: "Viết một câu về điều bạn muốn chuyển hóa trong đời sống.", sourceId: "ghpgvn" },
    { id: "tu-dieu-de", order: 3, title: "Tứ Diệu Đế", duration: 12, tradition: "Phật giáo sơ kỳ", summary: "Bốn sự thật cao quý trình bày khổ, nguyên nhân, khả năng chấm dứt và con đường thực hành. Đây là khung nhận diện và chuyển hóa, không phải cách nhìn bi quan.", practice: "Nhận diện một khó chịu hôm nay, điều kiện tạo ra nó và một phản ứng lành mạnh hơn.", sourceId: "suttacentral" },
    { id: "bat-chanh-dao", order: 4, title: "Bát Chánh Đạo", duration: 14, tradition: "Phật giáo sơ kỳ", summary: "Tám yếu tố về hiểu biết, ý hướng, lời nói, hành động, sinh kế, nỗ lực, chánh niệm và định được nuôi dưỡng đồng thời trong đời sống.", practice: "Chọn một lời nói chân thật, đúng lúc và có ích để thực hành hôm nay.", sourceId: "suttacentral" },
    { id: "ngu-gioi", order: 5, title: "Ngũ giới trong đời sống", duration: 12, tradition: "Phật giáo Việt Nam", summary: "Năm nguyên tắc tự nguyện giúp bảo hộ sự sống, tài sản, quan hệ, lời nói và sự tỉnh táo. Giới là nền tảng quan sát và chịu trách nhiệm, không phải công cụ phán xét người khác.", practice: "Quan sát một thói quen có thể làm mình hoặc người khác tổn thương và chọn một thay đổi nhỏ.", sourceId: "ghpgvn" },
    { id: "nhan-qua", order: 6, title: "Nghiệp và nhân quả đúng nghĩa", duration: 13, tradition: "Đối chiếu nhiều truyền thống", summary: "Nghiệp nhấn mạnh hành động có chủ ý và hệ quả của thói quen. Không dùng nhân quả để đổ lỗi cho nạn nhân, đoán định số phận hoặc thay thế hỗ trợ y tế, pháp lý và tâm lý.", practice: "Trước một hành động, dừng lại và hỏi: ý định này có đưa tới lợi mình, lợi người không?", sourceId: "suttacentral" },
    { id: "thien-hoi-tho", order: 7, title: "Thiền hơi thở cho người mới", duration: 10, tradition: "Thực hành căn bản", summary: "Ngồi vững, thả lỏng, biết hơi thở vào và ra. Khi tâm đi xa, nhận biết rồi nhẹ nhàng trở lại. Không ép hơi thở và không dùng thiền thay cho điều trị chuyên môn.", practice: "Thực hành năm phút với timer, chuông nhỏ ở đầu và cuối.", sourceId: "suttacentral" },
    { id: "niem-phat", order: 8, title: "Niệm Phật với sự tỉnh thức", duration: 10, tradition: "Tịnh độ", summary: "Niệm danh hiệu Phật có thể giúp thu nhiếp tâm và nuôi dưỡng nguyện lành. Số lần là dữ liệu cá nhân để duy trì thời khóa, không được quy đổi thành công đức hay xếp hạng.", practice: "Niệm chậm, nghe rõ từng âm và giữ thân tâm thư giãn trong ba phút.", sourceId: "ghpgvn" },
    { id: "di-chua", order: 9, title: "Cách đi chùa trang nghiêm", duration: 9, tradition: "Văn hóa Phật giáo Việt Nam", summary: "Trang phục lịch sự, nói nhỏ, tôn trọng nội quy, không chụp hoặc phát trực tiếp khi chưa được phép. Cúng dường tự nguyện và minh bạch; không mua bán niềm tin.", practice: "Chuẩn bị một câu hỏi học Pháp rõ ràng thay vì cầu xin kết quả siêu nhiên.", sourceId: "ghpgvn" },
    { id: "thoi-khoa", order: 10, title: "Xây thời khóa bền vững", duration: 11, tradition: "Ứng dụng", summary: "Một thời khóa vừa sức gồm học, thực hành, suy ngẫm và hành động thiện lành. Tính đều đặn quan trọng hơn số phút lớn hoặc chuỗi thành tích.", practice: "Chọn lịch 7, 21 hoặc 49 ngày và đặt khung giờ phù hợp thực tế.", sourceId: "ghpgvn" }
  ]);

  const TEACHINGS = Object.freeze([
    { id: "tu-dieu-de", title: "Tứ Diệu Đế", category: "Nền tảng", tradition: "Phật giáo sơ kỳ", intro: "Khung thực hành để nhận diện khổ và con đường chuyển hóa.", deep: "Quan sát trực tiếp trải nghiệm thay vì chỉ ghi nhớ khái niệm. Mỗi sự thật gắn với một việc cần làm: hiểu, buông, chứng nghiệm và tu tập.", application: "Dùng bốn câu hỏi: điều gì đang khó chịu, điều gì nuôi nó, trạng thái nào lành mạnh hơn, bước đúng đắn tiếp theo là gì?", sourceId: "suttacentral" },
    { id: "bat-chanh-dao", title: "Bát Chánh Đạo", category: "Nền tảng", tradition: "Phật giáo sơ kỳ", intro: "Tám phương diện của một đời sống có hiểu biết, đạo đức và định tĩnh.", deep: "Các yếu tố nâng đỡ nhau; không nên tách thiền khỏi lời nói, hành động và sinh kế.", application: "Mỗi tuần chọn một phương diện để quan sát nhưng vẫn giữ cái nhìn toàn thể.", sourceId: "suttacentral" },
    { id: "ngu-uan", title: "Ngũ uẩn", category: "Tuệ quán", tradition: "Phật giáo sơ kỳ", intro: "Sắc, thọ, tưởng, hành và thức là năm nhóm tiến trình tạo nên kinh nghiệm.", deep: "Thấy các tiến trình thay đổi giúp bớt đồng nhất cứng nhắc với cảm giác, ý nghĩ và vai trò.", application: "Khi cảm xúc mạnh xuất hiện, gọi tên cảm giác thân thể, cảm thọ, nhận diện, phản ứng và nhận biết.", sourceId: "suttacentral" },
    { id: "duyen-khoi", title: "Duyên khởi", category: "Tuệ quán", tradition: "Đối chiếu nhiều truyền thống", intro: "Mọi hiện tượng nương nhiều điều kiện mà hình thành và biến đổi.", deep: "Duyên khởi tránh cả hai cực đoan: cho rằng mọi thứ cố định hoặc hoàn toàn ngẫu nhiên.", application: "Tìm các điều kiện có thể thay đổi trong một vấn đề, thay vì quy kết vào một nguyên nhân duy nhất.", sourceId: "suttacentral" },
    { id: "tu-vo-luong-tam", title: "Tứ Vô Lượng Tâm", category: "Nuôi dưỡng tâm", tradition: "Đối chiếu nhiều truyền thống", intro: "Từ, bi, hỷ và xả là bốn phẩm chất rộng lớn có thể rèn luyện.", deep: "Từ không phải nuông chiều; bi không phải thương hại; hỷ không phải so sánh; xả không phải thờ ơ.", application: "Bắt đầu với lời nguyện lành thực tế cho bản thân rồi mở rộng dần tới người khác.", sourceId: "suttacentral" },
    { id: "chanh-niem", title: "Chánh niệm", category: "Thực hành", tradition: "Đối chiếu nhiều truyền thống", intro: "Khả năng nhớ biết rõ điều đang xảy ra trong thân và tâm.", deep: "Chánh niệm đi cùng tỉnh giác và định hướng đạo đức; không chỉ là kỹ thuật tăng năng suất.", application: "Đặt ba khoảng dừng một phút trong ngày: biết thân, biết cảm thọ, biết ý định tiếp theo.", sourceId: "suttacentral" },
    { id: "bo-tat-hanh", title: "Bồ-tát hạnh", category: "Đại thừa", tradition: "Phật giáo Đại thừa", intro: "Con đường nuôi dưỡng trí tuệ và lòng bi mẫn vì lợi ích của muôn loài.", deep: "Nhiều truyền thống trình bày hệ thống thực hành khác nhau; cần đọc trong bối cảnh và theo hướng dẫn đáng tin cậy.", application: "Chọn một việc giúp người cụ thể, kín đáo và trong khả năng, không biến nó thành phương tiện khoe thành tích.", sourceId: "ghpgvn" },
    { id: "tinh-do", title: "Tịnh độ và tín–nguyện–hạnh", category: "Tịnh độ", tradition: "Phật giáo Đại thừa", intro: "Pháp môn nhấn mạnh niềm tin có hiểu biết, nguyện hướng thiện và thực hành niệm Phật.", deep: "Cách giải thích khác nhau theo tông phái; nền tảng vẫn là chuyển hóa thân, khẩu và ý trong đời sống.", application: "Kết hợp thời niệm Phật ngắn với một việc thiện và một lần nhìn lại lời nói trong ngày.", sourceId: "ghpgvn" }
  ]);

  const SCRIPTURES = Object.freeze([
    { id: "dhammacakkappavattana", title: "Kinh Chuyển Pháp Luân", collection: "Tương Ưng Bộ", tradition: "Phật giáo sơ kỳ", sourceId: "suttacentral", sourceUrl: "https://suttacentral.net/sn56.11", verified: true, summary: "Bài kinh trình bày Trung đạo, Tứ Diệu Đế và cách mỗi sự thật gắn với nhận biết, nhiệm vụ cùng sự hoàn tất. Đây là tóm lược nguyên bản của HH, không phải bản dịch kinh văn.", keywords: "tứ diệu đế trung đạo khổ" },
    { id: "metta", title: "Kinh Từ Bi", collection: "Tiểu Bộ", tradition: "Phật giáo sơ kỳ", sourceId: "suttacentral", sourceUrl: "https://suttacentral.net/snp1.8", verified: true, summary: "Văn bản nuôi dưỡng tâm từ rộng lớn, đi cùng đời sống ngay thẳng, khiêm cung và biết đủ. Phần hiển thị là tóm lược học tập, không thay thế bản dịch được cấp phép.", keywords: "từ bi tâm từ metta" },
    { id: "mangala", title: "Kinh Điềm Lành", collection: "Tiểu Bộ", tradition: "Phật giáo sơ kỳ", sourceId: "suttacentral", sourceUrl: "https://suttacentral.net/snp2.4", verified: true, summary: "Điềm lành được trình bày qua lựa chọn bạn lành, học hỏi, hiếu kính, nghề nghiệp chân chính và tâm vững trước biến đổi, thay vì qua bói đoán.", keywords: "điềm lành đời sống đạo đức" },
    { id: "anapanasati", title: "Kinh Niệm Hơi Thở", collection: "Trung Bộ", tradition: "Phật giáo sơ kỳ", sourceId: "suttacentral", sourceUrl: "https://suttacentral.net/mn118", verified: true, summary: "Trình bày tiến trình niệm hơi thở gắn với thân, cảm thọ, tâm và pháp. Người mới nên bắt đầu nhẹ nhàng và tìm hướng dẫn đủ chuyên môn khi có phản ứng tâm lý bất thường.", keywords: "thiền hơi thở anapanasati" },
    { id: "heart", title: "Bát Nhã Tâm Kinh", collection: "Kinh Đại thừa", tradition: "Đại thừa", sourceId: "suttacentral", sourceUrl: "https://suttacentral.net/taisho251", verified: true, summary: "Bản kinh ngắn khai triển trí tuệ Bát Nhã và tính không của các pháp. Cần học cùng chú giải có bối cảnh để tránh hiểu tính không thành phủ nhận đạo đức hoặc đời sống.", keywords: "bát nhã tâm kinh tính không" },
    { id: "sigalovada", title: "Kinh Giáo Thọ Thi-ca-la-việt", collection: "Trường Bộ", tradition: "Phật giáo sơ kỳ", sourceId: "suttacentral", sourceUrl: "https://suttacentral.net/dn31", verified: true, summary: "Các mối quan hệ gia đình, bạn bè, thầy trò và công việc được nhìn qua trách nhiệm hai chiều. Đây là nguồn hữu ích để đưa giáo lý vào đời sống xã hội.", keywords: "gia đình quan hệ trách nhiệm xã hội" }
  ]);

  const TALKS = Object.freeze([
    { id: "phatsu-live", title: "Truyền hình trực tiếp Phật sự", provider: "Phật Sự Online", type: "Trực tiếp", url: "https://www.phatsuonline.vn/tin/truyen-hinh-truc-tiep", note: "Mở lịch phát và chương trình trực tiếp tại nguồn chính thức." },
    { id: "phatsu-youtube", title: "Phật Sự Online TV", provider: "Phật Sự Online", type: "Video", url: "https://www.youtube.com/PhatsuonlineTV", note: "Kênh YouTube của Phật Sự Online; nội dung và quyền phát thuộc đơn vị cung cấp." },
    { id: "ghpgvn-news", title: "Tin và hoạt động Giáo hội", provider: "GHPGVN", type: "Thông tin", url: "https://ghpgvn.vn/", note: "Tra cứu thông báo và hoạt động từ cổng Giáo hội Phật giáo Việt Nam." },
    { id: "suttacentral-guide", title: "Tra cứu kinh điển đa ngôn ngữ", provider: "SuttaCentral", type: "Thư viện", url: "https://suttacentral.net/", note: "Đọc metadata, nguyên bản và các bản dịch với giấy phép hiển thị trên từng trang." }
  ]);

  const NAV = Object.freeze([
    { id: "today", label: "Hôm nay", icon: "灯", group: "Bắt đầu" },
    { id: "beginner", label: "Lộ trình người mới", icon: "路", group: "Bắt đầu" },
    { id: "teachings", label: "Giáo lý", icon: "法", group: "Học Pháp" },
    { id: "scriptures", label: "Kinh điển", icon: "經", group: "Học Pháp" },
    { id: "qna", label: "Hỏi đáp có nguồn", icon: "問", group: "Học Pháp" },
    { id: "practice", label: "Thiền & niệm Phật", icon: "禪", group: "Thực hành" },
    { id: "temple", label: "Chùa online", icon: "寺", group: "Kết nối" },
    { id: "talks", label: "Pháp thoại", icon: "聽", group: "Kết nối" },
    { id: "request", label: "Thỉnh kinh", icon: "請", group: "Thư viện" },
    { id: "journal", label: "Nhật ký tu học", icon: "記", group: "Cá nhân" }
  ]);

  const DEFAULT_STATE = Object.freeze({
    completedLessons: [], bookmarks: [], lessonNotes: {}, practiceHistory: [], chantCount: 0,
    savedTalks: [], savedSources: [], studySchedule: { program: 7, minutes: 15, time: "20:00" },
    recentScripture: "", routineProgress: {}, printRequests: [], events: []
  });

  let root = null;
  let state = null;
  let accountKey = "guest";
  let activeView = "today";
  let selectedLesson = "";
  let selectedTeaching = "";
  let selectedScripture = "";
  let scriptureQuery = "";
  let scriptureTradition = "all";
  let timerId = 0;
  let timerRemaining = 300;
  let timerInitial = 300;
  let timerRunning = false;
  let journalKey = null;
  let journalEntries = null;
  let listeners = [];

  const safe = (value) => String(value ?? "").replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[char]));
  const normalize = (value) => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const sourceById = (id) => SOURCES.find((item) => item.id === id) || SOURCES[0];
  const unique = (items) => [...new Set(items)];
  const storageKey = () => `${STATE_PREFIX}:${accountKey}`;
  const journalStorageKey = () => `${JOURNAL_PREFIX}:${accountKey}`;
  const todayKey = () => new Date().toISOString().slice(0, 10);
  const formatDate = (iso) => new Intl.DateTimeFormat("vi-VN", { dateStyle: "medium", timeStyle: iso?.includes("T") ? "short" : undefined }).format(new Date(iso));

  function accountScope(user = {}) {
    return String(user.id || user._id || user.email || "guest").toLowerCase().replace(/[^a-z0-9@._-]/g, "-").slice(0, 96) || "guest";
  }

  function readState() {
    try {
      const stored = JSON.parse(localStorage.getItem(storageKey()) || "null");
      return { ...structuredClone(DEFAULT_STATE), ...(stored && typeof stored === "object" ? stored : {}) };
    } catch {
      return structuredClone(DEFAULT_STATE);
    }
  }

  function saveState() {
    try { localStorage.setItem(storageKey(), JSON.stringify(state)); } catch {}
    updateProgressPanel();
  }

  function setState(patch) {
    state = { ...state, ...patch };
    saveState();
  }

  function toast(message, tone = "success", undo = null) {
    if (!root) return;
    root.querySelector("[data-dharma-toast]")?.remove();
    const node = document.createElement("div");
    node.className = `dharma-toast is-${tone}`;
    node.dataset.dharmaToast = "";
    node.setAttribute("role", "status");
    node.innerHTML = `<span>${safe(message)}</span>${undo ? '<button type="button" data-toast-undo>Hoàn tác</button>' : ""}<button type="button" data-toast-close aria-label="Đóng">×</button>`;
    root.append(node);
    if (undo) node.querySelector("[data-toast-undo]")?.addEventListener("click", () => { undo(); node.remove(); });
    node.querySelector("[data-toast-close]")?.addEventListener("click", () => node.remove());
    global.setTimeout(() => node.remove(), 4800);
  }

  function navigate(view) {
    const next = NAV.some((item) => item.id === view) ? view : "today";
    if (location.hash.replace(/^#/, "") === `/phat-phap/${next}` || (next === "today" && location.hash.replace(/^#/, "") === "/phat-phap")) {
      activeView = next;
      renderView();
      return;
    }
    location.hash = `#/phat-phap/${next}`;
  }

  function navMarkup() {
    const groups = unique(NAV.map((item) => item.group));
    return groups.map((group) => `<section><small>${safe(group)}</small>${NAV.filter((item) => item.group === group).map((item) => `<button type="button" data-dharma-nav="${item.id}" class="${activeView === item.id ? "is-active" : ""}" aria-current="${activeView === item.id ? "page" : "false"}"><i>${item.icon}</i><span>${safe(item.label)}</span><b>›</b></button>`).join("")}</section>`).join("");
  }

  function progressStats() {
    return {
      lessons: state.completedLessons.length,
      bookmarks: state.bookmarks.length,
      practice: state.practiceHistory.reduce((sum, item) => sum + Number(item.minutes || 0), 0),
      today: Object.values(state.routineProgress[todayKey()] || {}).filter(Boolean).length
    };
  }

  function shellMarkup() {
    const current = NAV.find((item) => item.id === activeView) || NAV[0];
    return `<section class="dharma-hub" data-dharma-hub data-view="${activeView}">
      <div class="dharma-ornament" aria-hidden="true"><i></i><i></i><i></i><span class="dharma-incense"></span><span class="dharma-lamp"></span></div>
      <header class="dharma-topbar">
        <button class="dharma-brand" type="button" data-dharma-nav="today"><span class="dharma-wheel" aria-hidden="true">☸</span><span><small>TRUNG TÂM TU HỌC</small><strong>Phật Pháp</strong></span></button>
        <nav aria-label="Điều hướng nhanh"><button type="button" data-dharma-nav="today">Hôm nay</button><button type="button" data-dharma-nav="scriptures">Tra cứu</button><button type="button" data-dharma-schedule>Lịch tu học</button></nav>
        <label class="dharma-search"><span>⌕</span><input type="search" data-dharma-search placeholder="Tìm giáo lý, kinh điển…" autocomplete="off"><kbd>Ctrl K</kbd></label>
        <button class="dharma-topbar__progress" type="button" data-dharma-toggle-progress aria-expanded="true"><span>Hành trình</span><b data-dharma-progress-percent>0%</b></button>
      </header>
      <div class="dharma-layout">
        <aside class="dharma-sidebar" aria-label="Danh mục Phật Pháp">${navMarkup()}<footer><span>✦</span><p><strong>Học có nguồn</strong><small>Không bói nghiệp · Không thay thế chuyên gia</small></p></footer></aside>
        <main class="dharma-workspace" tabindex="-1"><header class="dharma-workspace__head"><div><small>${safe(current.group)}</small><h1>${safe(current.label)}</h1></div><button type="button" data-dharma-reader-toggle hidden>Chế độ đọc</button></header><div class="dharma-content" data-dharma-content></div></main>
        <aside class="dharma-progress" data-dharma-progress-panel><header><span><small>Hành trình riêng tư</small><strong>Tiến độ tu học</strong></span><button type="button" data-dharma-toggle-progress aria-label="Đóng bảng tiến độ">×</button></header><div data-dharma-progress-content></div></aside>
      </div>
      <footer class="dharma-actionbar"><ol aria-label="Luồng học"><li class="is-active"><i>1</i>Nghe</li><li><i>2</i>Đọc</li><li><i>3</i>Suy ngẫm</li><li><i>4</i>Thực hành</li><li><i>5</i>Ghi nhận</li></ol><button type="button" data-dharma-primary>${activeView === "practice" ? "Bắt đầu thực hành" : "Tiếp tục hành trình"} →</button></footer>
      <nav class="dharma-mobile-nav" aria-label="Điều hướng Phật Pháp trên điện thoại"><button data-dharma-nav="today"><i>灯</i>Hôm nay</button><button data-dharma-nav="teachings"><i>法</i>Giáo lý</button><button data-dharma-nav="scriptures"><i>經</i>Kinh</button><button data-dharma-nav="practice"><i>禪</i>Thực hành</button><button data-dharma-mobile-menu><i>☰</i>Thêm</button></nav>
      <div class="dharma-mobile-sheet" data-dharma-mobile-sheet hidden><button type="button" data-dharma-mobile-menu aria-label="Đóng"></button><div><i></i><header><strong>Toàn bộ chức năng</strong><button type="button" data-dharma-mobile-menu>×</button></header>${navMarkup()}</div></div>
    </section>`;
  }

  function updateProgressPanel() {
    if (!root) return;
    const stats = progressStats();
    const percent = Math.round((stats.lessons / LESSONS.length) * 100);
    root.querySelectorAll("[data-dharma-progress-percent]").forEach((node) => { node.textContent = `${percent}%`; });
    const panel = root.querySelector("[data-dharma-progress-content]");
    if (!panel) return;
    const nextLesson = LESSONS.find((item) => !state.completedLessons.includes(item.id));
    panel.innerHTML = `<section class="dharma-progress-ring" style="--progress:${percent * 3.6}deg"><div><strong>${percent}%</strong><small>${stats.lessons}/${LESSONS.length} bài nền tảng</small></div></section>
      <section class="dharma-stat-list"><p><i>讀</i><span><strong>${stats.bookmarks}</strong><small>Kinh/bài đã lưu</small></span></p><p><i>禪</i><span><strong>${stats.practice}</strong><small>Phút thực hành</small></span></p><p><i>念</i><span><strong>${state.chantCount}</strong><small>Lần niệm đã ghi nhận</small></span></p></section>
      <section class="dharma-next"><small>Gợi ý tiếp theo</small><strong>${safe(nextLesson?.title || "Duy trì thời khóa nhẹ nhàng")}</strong><p>${nextLesson ? `${nextLesson.duration} phút · ${nextLesson.tradition}` : "Bạn đã hoàn thành lộ trình nền tảng."}</p><button type="button" data-dharma-next-lesson="${nextLesson?.id || ""}">${nextLesson ? "Mở bài tiếp theo" : "Mở thực hành"} →</button></section>
      <section class="dharma-privacy-note"><span>⌾</span><p><strong>Dữ liệu thuộc về bạn</strong><small>Tiến độ lưu trên thiết bị. Nhật ký chỉ mở sau khi nhập PIN riêng.</small></p></section>`;
  }

  function sourceBadge(sourceId) {
    const source = sourceById(sourceId);
    return `<span class="dharma-source-badge" title="${safe(source.note)}"><i>✓</i>${safe(source.organization)}</span>`;
  }

  function todayMarkup() {
    const next = LESSONS.find((item) => !state.completedLessons.includes(item.id)) || LESSONS[0];
    const daily = state.routineProgress[todayKey()] || {};
    const routine = [
      { id: "listen", label: "Nghe một đoạn tóm lược", minutes: 3 },
      { id: "learn", label: `Học: ${next.title}`, minutes: next.duration },
      { id: "practice", label: "Ngồi yên và theo dõi hơi thở", minutes: 5 },
      { id: "kindness", label: "Một hành động thiện lành kín đáo", minutes: 2 }
    ];
    return `<section class="dharma-hero dharma-paper-card"><div><p class="dharma-kicker"><i></i>THỜI KHÓA HÔM NAY · ${safe(new Intl.DateTimeFormat("vi-VN", { weekday: "long", day: "2-digit", month: "2-digit" }).format(new Date()))}</p><h2>Mỗi ngày một bước tỉnh thức</h2><p>Học vừa đủ, thực hành thật và ghi nhận bằng sự thành thật. Không chạy theo thành tích hay so sánh với người khác.</p><div class="dharma-hero__meta"><span><b>${state.studySchedule.minutes}</b> phút dự kiến</span><span><b>${Object.values(daily).filter(Boolean).length}/4</b> việc đã làm</span><span><b>${state.studySchedule.time}</b> giờ nhắc</span></div><button class="dharma-primary" type="button" data-open-lesson="${next.id}">Bắt đầu bài hôm nay →</button></div><div class="dharma-lotus-mark" aria-hidden="true"><i></i><i></i><i></i><b>ॐ</b></div></section>
      <div class="dharma-section-title"><div><small>15 PHÚT TĨNH TÂM</small><h2>Thời khóa rõ ràng, không quá tải</h2></div><button type="button" data-dharma-schedule>Chỉnh thời khóa</button></div>
      <section class="dharma-routine">${routine.map((item, index) => `<button type="button" data-routine="${item.id}" class="${daily[item.id] ? "is-done" : ""}"><i>${daily[item.id] ? "✓" : index + 1}</i><span><strong>${safe(item.label)}</strong><small>${item.minutes} phút</small></span><b>${daily[item.id] ? "Đã ghi nhận" : "Bắt đầu"}</b></button>`).join("")}</section>
      <section class="dharma-split"><article class="dharma-paper-card dharma-daily-reading"><header><span>經</span><div><small>TÓM LƯỢC KINH ĐIỂN</small><h3>${SCRIPTURES[0].title}</h3></div>${sourceBadge(SCRIPTURES[0].sourceId)}</header><p>${SCRIPTURES[0].summary}</p><footer><button type="button" data-open-scripture="${SCRIPTURES[0].id}">Đọc trong thư viện</button><a href="${SCRIPTURES[0].sourceUrl}" target="_blank" rel="noopener noreferrer">Mở nguồn gốc ↗</a></footer></article>
      <article class="dharma-paper-card dharma-kindness"><span class="dharma-lamp-icon">灯</span><small>VIỆC THIỆN GỢI Ý</small><h3>Lắng nghe mà không vội phán xét</h3><p>Dành một cuộc trò chuyện hôm nay để nghe hết câu, hỏi lại điều chưa rõ và không biến việc tốt thành thành tích công khai.</p><button type="button" data-routine="kindness">${daily.kindness ? "✓ Đã ghi nhận" : "Ghi nhận sau khi thực hiện"}</button></article></section>`;
  }

  function beginnerMarkup() {
    const selected = LESSONS.find((item) => item.id === selectedLesson);
    if (selected) return lessonDetailMarkup(selected);
    const done = state.completedLessons.length;
    return `<section class="dharma-route-intro dharma-paper-card"><div><small>LỘ TRÌNH NGƯỜI MỚI</small><h2>Hiểu đúng trước, thực hành vừa sức</h2><p>Mười bài nền tảng bằng tiếng Việt, mỗi bài có nguồn, phần thực hành và ghi chú riêng. Bạn có thể học theo chương trình 7, 21 hoặc 49 ngày.</p></div><div class="dharma-program-picker" role="group" aria-label="Chọn chương trình">${[7,21,49].map((day) => `<button type="button" data-program="${day}" class="${state.studySchedule.program === day ? "is-active" : ""}"><b>${day}</b><span>ngày</span></button>`).join("")}</div></section>
      <section class="dharma-roadmap"><header><span>Tiến độ nền tảng</span><strong>${done}/${LESSONS.length} bài</strong><i><b style="width:${done / LESSONS.length * 100}%"></b></i></header><div>${LESSONS.map((lesson) => `<button type="button" data-open-lesson="${lesson.id}" class="${state.completedLessons.includes(lesson.id) ? "is-complete" : ""}"><i>${state.completedLessons.includes(lesson.id) ? "✓" : lesson.order}</i><span><small>${safe(lesson.tradition)} · ${lesson.duration} phút</small><strong>${safe(lesson.title)}</strong><p>${safe(lesson.summary)}</p></span><b>›</b></button>`).join("")}</div></section>`;
  }

  function lessonDetailMarkup(lesson) {
    const note = state.lessonNotes[lesson.id] || "";
    const source = sourceById(lesson.sourceId);
    const complete = state.completedLessons.includes(lesson.id);
    return `<button class="dharma-back" type="button" data-back-list="beginner">← Trở lại lộ trình</button><article class="dharma-lesson dharma-paper-card"><header><span>${String(lesson.order).padStart(2, "0")}</span><div><small>${safe(lesson.tradition)} · ${lesson.duration} PHÚT</small><h2>${safe(lesson.title)}</h2></div>${sourceBadge(lesson.sourceId)}</header><section><small>GIẢI THÍCH DỄ HIỂU</small><p>${safe(lesson.summary)}</p></section><section class="dharma-practice-callout"><i>禪</i><div><small>THỰC HÀNH NGAY</small><p>${safe(lesson.practice)}</p></div><button type="button" data-dharma-nav="practice">Mở timer</button></section><section><label class="dharma-note"><span>Suy ngẫm của riêng bạn</span><textarea data-lesson-note="${lesson.id}" maxlength="2000" placeholder="Viết điều bạn hiểu hoặc muốn áp dụng…">${safe(note)}</textarea><small>Ghi chú lưu trên thiết bị này.</small></label></section><footer><a href="${safe(source.url)}" target="_blank" rel="noopener noreferrer">Kiểm tra nguồn · ${safe(source.organization)} ↗</a><button class="dharma-primary" type="button" data-complete-lesson="${lesson.id}">${complete ? "✓ Đã hoàn thành" : "Hoàn thành bài học"}</button></footer></article>`;
  }

  function teachingsMarkup() {
    const selected = TEACHINGS.find((item) => item.id === selectedTeaching);
    if (selected) return teachingDetailMarkup(selected);
    const categories = unique(TEACHINGS.map((item) => item.category));
    return `<section class="dharma-route-intro dharma-paper-card"><div><small>GIÁO LÝ CÓ BỐI CẢNH</small><h2>Học theo chủ đề, biết rõ truyền thống</h2><p>Mỗi nội dung phân biệt phần giải thích, đào sâu, ứng dụng và nguồn tham khảo. Không trộn lẫn các truyền thống thành một kết luận duy nhất.</p></div><span class="dharma-seal">法</span></section>${categories.map((category) => `<section class="dharma-teaching-group"><header><h3>${safe(category)}</h3><span>${TEACHINGS.filter((item) => item.category === category).length} chủ đề</span></header><div>${TEACHINGS.filter((item) => item.category === category).map((item) => `<button type="button" data-open-teaching="${item.id}"><i>☸</i><span><small>${safe(item.tradition)}</small><strong>${safe(item.title)}</strong><p>${safe(item.intro)}</p></span><b>Đọc →</b></button>`).join("")}</div></section>`).join("")}`;
  }

  function teachingDetailMarkup(item) {
    const source = sourceById(item.sourceId);
    return `<button class="dharma-back" type="button" data-back-list="teachings">← Tất cả chủ đề</button><article class="dharma-teaching-detail dharma-paper-card"><header><div><small>${safe(item.category)} · ${safe(item.tradition)}</small><h2>${safe(item.title)}</h2></div>${sourceBadge(item.sourceId)}</header><nav role="tablist"><button type="button" data-teaching-tab="explain" aria-selected="true">Giải thích</button><button type="button" data-teaching-tab="deep">Đào sâu</button><button type="button" data-teaching-tab="apply">Ứng dụng</button><button type="button" data-teaching-tab="source">Nguồn</button><button type="button" data-teaching-tab="note">Ghi chú</button></nav><section data-teaching-panel="explain"><h3>Hiểu ngắn gọn</h3><p>${safe(item.intro)}</p></section><section data-teaching-panel="deep" hidden><h3>Đọc sâu hơn</h3><p>${safe(item.deep)}</p></section><section data-teaching-panel="apply" hidden><h3>Đưa vào đời sống</h3><p>${safe(item.application)}</p></section><section data-teaching-panel="source" hidden><h3>Nguồn tham khảo</h3><p>${safe(source.note)}</p><a href="${safe(source.url)}" target="_blank" rel="noopener noreferrer">Mở ${safe(source.organization)} ↗</a></section><section data-teaching-panel="note" hidden><label class="dharma-note"><span>Ghi chú cá nhân</span><textarea data-lesson-note="teaching:${item.id}" maxlength="2000" placeholder="Điều bạn muốn ghi nhớ…">${safe(state.lessonNotes[`teaching:${item.id}`] || "")}</textarea></label></section></article>`;
  }

  function scripturesMarkup() {
    const selected = SCRIPTURES.find((item) => item.id === selectedScripture);
    if (selected) return scriptureDetailMarkup(selected);
    const filtered = SCRIPTURES.filter((item) => (scriptureTradition === "all" || item.tradition === scriptureTradition) && normalize(`${item.title} ${item.collection} ${item.summary} ${item.keywords}`).includes(normalize(scriptureQuery)));
    const traditions = unique(SCRIPTURES.map((item) => item.tradition));
    return `<section class="dharma-library-head dharma-paper-card"><div><small>THƯ VIỆN KINH ĐIỂN</small><h2>Tra cứu tóm lược và mở đúng nguồn</h2><p>HH chỉ hiển thị tóm lược nguyên bản để học. Khi đọc kinh văn, bạn được đưa tới nguồn có metadata và giấy phép rõ ràng.</p></div><span>經</span></section><div class="dharma-library-toolbar"><label><span>⌕</span><input type="search" data-scripture-search value="${safe(scriptureQuery)}" placeholder="Tên kinh, chủ đề, bộ kinh…"></label><select data-scripture-tradition aria-label="Lọc truyền thống"><option value="all">Tất cả truyền thống</option>${traditions.map((item) => `<option value="${safe(item)}" ${scriptureTradition === item ? "selected" : ""}>${safe(item)}</option>`).join("")}</select></div><section class="dharma-scripture-grid">${filtered.map((item) => `<article><header><span>經</span><div><small>${safe(item.collection)}</small><h3>${safe(item.title)}</h3></div><button type="button" data-bookmark-scripture="${item.id}" aria-label="${state.bookmarks.includes(item.id) ? "Bỏ lưu" : "Lưu"}">${state.bookmarks.includes(item.id) ? "★" : "☆"}</button></header><p>${safe(item.summary)}</p><footer>${sourceBadge(item.sourceId)}<button type="button" data-open-scripture="${item.id}">Đọc tóm lược →</button></footer></article>`).join("") || '<div class="dharma-empty"><span>經</span><strong>Không tìm thấy nội dung</strong><p>Thử tên ngắn hơn hoặc chọn tất cả truyền thống.</p></div>'}</section>`;
  }

  function scriptureDetailMarkup(item) {
    const source = sourceById(item.sourceId);
    return `<button class="dharma-back" type="button" data-back-list="scriptures">← Trở lại thư viện</button><article class="dharma-scripture-reader dharma-paper-card"><header><div><small>${safe(item.collection)} · ${safe(item.tradition)}</small><h2>${safe(item.title)}</h2><p>${sourceBadge(item.sourceId)} <span class="dharma-original-label">TÓM LƯỢC NGUYÊN BẢN CỦA HH</span></p></div><div><button type="button" data-speak-scripture="${item.id}">▷ Nghe tóm lược</button><button type="button" data-reader-mode>Reader Mode</button></div></header><section><p>${safe(item.summary)}</p></section><aside><strong>Lưu ý về nội dung</strong><p>Đây không phải nguyên văn hay bản dịch kinh. Hãy mở nguồn gốc để xem ngôn ngữ, dịch giả và giấy phép của tài liệu cụ thể.</p></aside><footer><button type="button" data-bookmark-scripture="${item.id}">${state.bookmarks.includes(item.id) ? "★ Đã lưu" : "☆ Lưu vào thư viện"}</button><a class="dharma-primary" href="${safe(item.sourceUrl)}" target="_blank" rel="noopener noreferrer">Mở kinh tại ${safe(source.organization)} ↗</a></footer></article>`;
  }

  function practiceMarkup() {
    const recent = state.practiceHistory.slice(-5).reverse();
    return `<section class="dharma-practice-stage"><article class="dharma-meditation dharma-paper-card"><header><div><small>THIỀN HƠI THỞ</small><h2>Ngồi yên, biết rõ, không ép buộc</h2></div><span class="dharma-bell" aria-hidden="true">♩</span></header><div class="dharma-timer"><i></i><strong data-timer-display>${formatTimer(timerRemaining)}</strong><small>${timerRunning ? "Đang thực hành" : "Sẵn sàng"}</small></div><div class="dharma-presets">${[5,10,15,20].map((minutes) => `<button type="button" data-timer-preset="${minutes}" class="${timerInitial === minutes * 60 ? "is-active" : ""}">${minutes} phút</button>`).join("")}</div><div class="dharma-timer-actions"><button type="button" data-timer-reset>Đặt lại</button><button class="dharma-primary" type="button" data-timer-toggle>${timerRunning ? "Tạm dừng" : "Bắt đầu"}</button></div><p>Đưa sự chú ý về hơi thở tự nhiên. Nếu thấy hoảng sợ, khó thở hoặc bất ổn, hãy dừng lại và tìm hỗ trợ phù hợp.</p></article><article class="dharma-chant dharma-paper-card"><header><div><small>NIỆM PHẬT</small><h2>Bộ đếm riêng tư</h2></div><span>念</span></header><p>Đếm để duy trì thời khóa, không quy đổi thành công đức và không xếp hạng.</p><div><button type="button" data-chant-minus aria-label="Giảm một">−</button><strong data-chant-count>${state.chantCount}</strong><button type="button" data-chant-plus aria-label="Tăng một">+</button></div><footer><button type="button" data-chant-add="10">+10</button><button type="button" data-chant-add="108">+108</button><button type="button" data-chant-reset>Đặt lại</button></footer></article></section><section class="dharma-history dharma-paper-card"><header><div><small>LỊCH SỬ RIÊNG TƯ</small><h2>Các lần thực hành gần đây</h2></div><button type="button" data-clear-practice ${recent.length ? "" : "disabled"}>Xóa lịch sử</button></header><div>${recent.map((item) => `<p><i>禪</i><span><strong>${item.minutes} phút thiền</strong><small>${safe(formatDate(item.at))}</small></span><b>Đã hoàn thành</b></p>`).join("") || "<p class=\"dharma-empty-line\">Chưa có lần thực hành nào được lưu.</p>"}</div></section>`;
  }

  function templeMarkup() {
    return `<section class="dharma-route-intro dharma-paper-card"><div><small>CHÙA ONLINE</small><h2>Kết nối đúng nguồn, giữ sự trang nghiêm</h2><p>Xem lịch Phật sự và nội dung trực tiếp từ đơn vị chính thức. HH không tự gắn nhãn xác minh cho chùa hoặc người giảng chưa được kiểm chứng.</p></div><span class="dharma-temple-mark">寺</span></section><section class="dharma-official-links">${SOURCES.filter((item) => item.id !== "suttacentral").map((item) => `<article><span>${item.id === "ghpgvn" ? "☸" : "▷"}</span><div><small>${safe(item.status)}</small><h3>${safe(item.title)}</h3><p>${safe(item.note)}</p></div><a href="${safe(item.liveUrl || item.url)}" target="_blank" rel="noopener noreferrer">Mở nguồn chính thức ↗</a></article>`).join("")}</section><section class="dharma-event-planner dharma-paper-card"><header><div><small>LỊCH CÁ NHÂN</small><h2>Lưu một buổi lễ hoặc pháp thoại</h2></div><span>Không gửi dữ liệu ra ngoài</span></header><form data-event-form><label>Tên sự kiện<input name="title" required maxlength="120" placeholder="Ví dụ: Pháp thoại tối Chủ nhật"></label><label>Thời gian<input name="at" type="datetime-local" required></label><button class="dharma-primary" type="submit">Lưu vào lịch</button></form><div>${state.events.slice().sort((a,b) => a.at.localeCompare(b.at)).map((item) => `<p><i>灯</i><span><strong>${safe(item.title)}</strong><small>${safe(formatDate(item.at))}</small></span><button type="button" data-delete-event="${safe(item.id)}">Xóa</button></p>`).join("") || '<p class="dharma-empty-line">Chưa có lịch cá nhân.</p>'}</div></section>`;
  }

  function talksMarkup() {
    return `<section class="dharma-route-intro dharma-paper-card"><div><small>PHÁP THOẠI & NGUỒN HỌC</small><h2>Nghe từ kênh công khai, lưu lại để học sau</h2><p>Nội dung mở trong trang gốc để giữ đầy đủ thông tin người giảng, đơn vị đăng và quyền sử dụng.</p></div><span class="dharma-seal">聽</span></section><section class="dharma-talk-grid">${TALKS.map((talk) => `<article><header><span>${talk.type === "Video" ? "▷" : talk.type === "Trực tiếp" ? "●" : "☸"}</span><div><small>${safe(talk.type)} · ${safe(talk.provider)}</small><h3>${safe(talk.title)}</h3></div></header><p>${safe(talk.note)}</p><footer><button type="button" data-save-talk="${talk.id}">${state.savedTalks.includes(talk.id) ? "★ Đã lưu" : "☆ Lưu để xem sau"}</button><a href="${safe(talk.url)}" target="_blank" rel="noopener noreferrer">Mở nguồn ↗</a></footer></article>`).join("")}</section>`;
  }

  function requestMarkup() {
    const saved = state.savedSources;
    return `<section class="dharma-route-intro dharma-paper-card"><div><small>THỈNH KINH CÓ TRÁCH NHIỆM</small><h2>Ưu tiên bản số hợp pháp và nguồn rõ ràng</h2><p>HH không thu tiền, địa chỉ hay tạo đơn hàng giả. Bản in hiện chỉ lưu nguyện vọng trên thiết bị cho tới khi có nhà phát hành được xác minh.</p></div><span class="dharma-seal">請</span></section><div class="dharma-request-tabs" role="tablist"><button type="button" data-request-tab="digital" aria-selected="true">Bản số</button><button type="button" data-request-tab="print">Bản in</button></div><section data-request-panel="digital" class="dharma-digital-sources">${SOURCES.map((source) => `<article><span>${source.id === "suttacentral" ? "經" : "☸"}</span><div><small>${safe(source.status)}</small><h3>${safe(source.title)}</h3><p>${safe(source.note)}</p></div><footer><button type="button" data-save-source="${source.id}">${saved.includes(source.id) ? "★ Đã lưu" : "☆ Lưu nguồn"}</button><a href="${safe(source.url)}" target="_blank" rel="noopener noreferrer">Mở thư viện ↗</a></footer></article>`).join("")}</section><section data-request-panel="print" class="dharma-print-request dharma-paper-card" hidden><header><small>BẢN IN · CHƯA KẾT NỐI NHÀ PHÁT HÀNH</small><h2>Lưu nguyện vọng thỉnh kinh</h2><p>Biểu mẫu này không phải đơn hàng, không thu địa chỉ và không thực hiện thanh toán.</p></header><form data-print-request><label>Tên kinh hoặc chủ đề<input name="title" required maxlength="160" placeholder="Ví dụ: Kinh Từ Bi"></label><label>Mục đích sử dụng<select name="purpose"><option>Đọc và tu học cá nhân</option><option>Tặng người thân</option><option>Đạo tràng hoặc thư viện</option></select></label><button class="dharma-primary" type="submit">Lưu nguyện vọng trên thiết bị</button></form><div>${state.printRequests.map((item) => `<p><span><strong>${safe(item.title)}</strong><small>${safe(item.purpose)} · ${safe(formatDate(item.createdAt))}</small></span><button type="button" data-delete-print="${safe(item.id)}">Xóa</button></p>`).join("") || '<p class="dharma-empty-line">Chưa có nguyện vọng đã lưu.</p>'}</div></section>`;
  }

  function qnaMarkup() {
    return `<section class="dharma-qna dharma-paper-card"><header><span>問</span><div><small>HỎI ĐÁP CÓ NGUỒN</small><h2>Tra cứu trước, suy ngẫm sau</h2><p>Câu trả lời được ghép từ thư viện nội bộ đã biên soạn, không giả danh tăng ni và không tự suy đoán nghiệp, bệnh tật hoặc tương lai.</p></div></header><form data-qna-form><label><textarea name="question" required maxlength="500" placeholder="Ví dụ: Tứ Diệu Đế có phải là cách nhìn bi quan không?"></textarea><button class="dharma-primary" type="submit">Tìm trong giáo lý</button></label></form><div data-qna-answer><p class="dharma-empty-line">Nhập câu hỏi để tìm chủ đề phù hợp trong giáo lý và tóm lược kinh.</p></div></section><section class="dharma-safety-grid"><article><span>✓</span><h3>Luôn dẫn nguồn</h3><p>Cho biết đây là tóm lược HH và mở được tài liệu tham khảo.</p></article><article><span>!</span><h3>Biết giới hạn</h3><p>Không thay thế tăng ni đủ phẩm hạnh, bác sĩ, chuyên gia tâm lý hoặc tư vấn pháp lý.</p></article><article><span>⌾</span><h3>Không phán nghiệp</h3><p>Không dùng giáo lý để đổ lỗi, gieo sợ hãi hoặc hứa hẹn kết quả siêu nhiên.</p></article></section>`;
  }

  function journalMarkup() {
    const cryptoReady = Boolean(global.crypto?.subtle);
    if (!cryptoReady) return `<section class="dharma-journal-lock dharma-paper-card"><span>鎖</span><h2>Trình duyệt chưa hỗ trợ khóa an toàn</h2><p>HH không cho phép viết nhật ký ở chế độ không mã hóa. Hãy dùng trình duyệt hiện đại có Web Crypto.</p></section>`;
    const meta = readJournalMeta();
    if (!meta) return `<section class="dharma-journal-lock dharma-paper-card"><span>記</span><small>NHẬT KÝ TU HỌC RIÊNG TƯ</small><h2>Tạo PIN để bắt đầu</h2><p>Nội dung được mã hóa AES-GCM trên thiết bị. PIN không được lưu và không thể khôi phục nếu bạn quên.</p><form data-journal-setup><label>PIN mới<input name="pin" type="password" inputmode="numeric" minlength="6" maxlength="32" required autocomplete="new-password" placeholder="Tối thiểu 6 ký tự"></label><label>Nhập lại PIN<input name="confirm" type="password" inputmode="numeric" minlength="6" maxlength="32" required autocomplete="new-password"></label><button class="dharma-primary" type="submit">Tạo nhật ký mã hóa</button></form><aside>Không dùng ngày sinh, số điện thoại hoặc mật khẩu tài khoản làm PIN.</aside></section>`;
    if (!journalKey || !Array.isArray(journalEntries)) return `<section class="dharma-journal-lock dharma-paper-card"><span>鎖</span><small>AES-GCM · PBKDF2</small><h2>Nhật ký đang khóa</h2><p>Nhập PIN của nhật ký. Dữ liệu chỉ được giải mã trong phiên hiện tại và khóa lại khi rời mục Phật Pháp.</p><form data-journal-unlock><label>PIN nhật ký<input name="pin" type="password" minlength="6" maxlength="32" required autocomplete="current-password"></label><button class="dharma-primary" type="submit">Mở khóa</button></form><button class="dharma-danger-link" type="button" data-journal-reset>Xóa vĩnh viễn nhật ký đã mã hóa</button></section>`;
    return `<section class="dharma-journal-editor"><article class="dharma-paper-card"><header><div><small>KHÔNG GIAN SUY NGẪM</small><h2>Ghi điều đã học và đã thực hành</h2></div><button type="button" data-journal-lock>Khóa ngay</button></header><form data-journal-entry><label>Tiêu đề<input name="title" maxlength="120" required placeholder="Điều tôi nhận ra hôm nay"></label><label>Nội dung<textarea name="body" maxlength="8000" required placeholder="Viết thành thật, không cần hoàn hảo…"></textarea></label><label>Tâm trạng<select name="mood"><option>Bình an</option><option>Biết ơn</option><option>Đang quan sát</option><option>Còn nhiều băn khoăn</option><option>Cần nghỉ ngơi</option></select></label><button class="dharma-primary" type="submit">Mã hóa và lưu</button></form></article><section>${journalEntries.slice().reverse().map((entry) => `<article class="dharma-paper-card"><header><div><small>${safe(entry.mood)} · ${safe(formatDate(entry.createdAt))}</small><h3>${safe(entry.title)}</h3></div><button type="button" data-delete-journal="${safe(entry.id)}">Xóa</button></header><p>${safe(entry.body).replace(/\n/g, "<br>")}</p></article>`).join("") || '<div class="dharma-empty"><span>記</span><strong>Chưa có ghi chép</strong><p>Nhật ký đầu tiên sẽ được mã hóa ngay khi lưu.</p></div>'}</section></section>`;
  }

  function viewMarkup() {
    if (activeView === "beginner") return beginnerMarkup();
    if (activeView === "teachings") return teachingsMarkup();
    if (activeView === "scriptures") return scripturesMarkup();
    if (activeView === "practice") return practiceMarkup();
    if (activeView === "temple") return templeMarkup();
    if (activeView === "talks") return talksMarkup();
    if (activeView === "request") return requestMarkup();
    if (activeView === "qna") return qnaMarkup();
    if (activeView === "journal") return journalMarkup();
    return todayMarkup();
  }

  function renderView(options = {}) {
    if (!root) return;
    const hub = root.querySelector("[data-dharma-hub]");
    if (!hub) return;
    hub.dataset.view = activeView;
    const current = NAV.find((item) => item.id === activeView) || NAV[0];
    root.querySelectorAll("[data-dharma-nav]").forEach((button) => {
      const active = button.dataset.dharmaNav === activeView;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-current", active ? "page" : "false");
    });
    const head = root.querySelector(".dharma-workspace__head");
    if (head) head.querySelector("div").innerHTML = `<small>${safe(current.group)}</small><h1>${safe(current.label)}</h1>`;
    const content = root.querySelector("[data-dharma-content]");
    if (content) content.innerHTML = viewMarkup();
    updateProgressPanel();
    if (!options.preserveScroll) {
      const workspace = root.querySelector(".dharma-workspace");
      if (workspace) workspace.scrollTop = 0;
    }
  }

  function formatTimer(seconds) {
    const value = Math.max(0, Number(seconds) || 0);
    return `${String(Math.floor(value / 60)).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}`;
  }

  function updateTimerDisplay() {
    if (!root) return;
    const display = root.querySelector("[data-timer-display]");
    if (display) display.textContent = formatTimer(timerRemaining);
    const status = root.querySelector(".dharma-timer small");
    if (status) status.textContent = timerRunning ? "Đang thực hành" : (timerRemaining === 0 ? "Đã hoàn thành" : "Sẵn sàng");
    const button = root.querySelector("[data-timer-toggle]");
    if (button) button.textContent = timerRunning ? "Tạm dừng" : "Bắt đầu";
  }

  function playBell() {
    try {
      const AudioContextClass = global.AudioContext || global.webkitAudioContext;
      if (!AudioContextClass) return;
      const context = new AudioContextClass();
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(660, context.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(330, context.currentTime + 1.6);
      gain.gain.setValueAtTime(0.0001, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.12, context.currentTime + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 1.8);
      oscillator.connect(gain).connect(context.destination);
      oscillator.start();
      oscillator.stop(context.currentTime + 1.85);
      oscillator.addEventListener("ended", () => context.close());
    } catch {}
  }

  function stopTimer() {
    global.clearInterval(timerId);
    timerId = 0;
    timerRunning = false;
    updateTimerDisplay();
  }

  function toggleTimer() {
    if (timerRunning) return stopTimer();
    if (timerRemaining <= 0) timerRemaining = timerInitial;
    timerRunning = true;
    playBell();
    updateTimerDisplay();
    timerId = global.setInterval(() => {
      timerRemaining -= 1;
      updateTimerDisplay();
      if (timerRemaining > 0) return;
      stopTimer();
      playBell();
      const minutes = Math.max(1, Math.round(timerInitial / 60));
      state.practiceHistory = [...state.practiceHistory, { id: global.crypto?.randomUUID?.() || `${Date.now()}`, minutes, at: new Date().toISOString() }].slice(-100);
      saveState();
      toast(`Đã lưu ${minutes} phút thực hành.`, "success");
      renderView({ preserveScroll: true });
    }, 1000);
  }

  function searchAll(query) {
    const term = normalize(query);
    if (!term) return [];
    const lessonMatches = LESSONS.filter((item) => normalize(`${item.title} ${item.summary}`).includes(term)).map((item) => ({ type: "Bài học", title: item.title, detail: item.tradition, action: "lesson", id: item.id }));
    const teachingMatches = TEACHINGS.filter((item) => normalize(`${item.title} ${item.intro} ${item.application}`).includes(term)).map((item) => ({ type: "Giáo lý", title: item.title, detail: item.tradition, action: "teaching", id: item.id }));
    const scriptureMatches = SCRIPTURES.filter((item) => normalize(`${item.title} ${item.summary} ${item.keywords}`).includes(term)).map((item) => ({ type: "Kinh điển", title: item.title, detail: item.collection, action: "scripture", id: item.id }));
    return [...lessonMatches, ...teachingMatches, ...scriptureMatches].slice(0, 10);
  }

  function showSearchResults(input) {
    root.querySelector("[data-dharma-search-results]")?.remove();
    if (!input.value.trim()) return;
    const results = searchAll(input.value);
    const panel = document.createElement("div");
    panel.className = "dharma-search-results";
    panel.dataset.dharmaSearchResults = "";
    panel.innerHTML = results.length ? results.map((item) => `<button type="button" data-search-action="${item.action}" data-search-id="${item.id}"><small>${item.type}</small><strong>${safe(item.title)}</strong><span>${safe(item.detail)}</span></button>`).join("") : '<p>Không tìm thấy nội dung phù hợp.</p>';
    input.closest(".dharma-search")?.append(panel);
  }

  function scheduleDialog() {
    root.querySelector("[data-dharma-dialog]")?.remove();
    const dialog = document.createElement("div");
    dialog.className = "dharma-dialog";
    dialog.dataset.dharmaDialog = "";
    dialog.innerHTML = `<button type="button" data-dialog-close aria-label="Đóng"></button><form data-schedule-form><header><span>灯</span><div><small>THỜI KHÓA CÁ NHÂN</small><h2>Một lịch vừa sức</h2></div><button type="button" data-dialog-close>×</button></header><label>Thời lượng mỗi ngày<select name="minutes">${[10,15,20,30].map((item) => `<option value="${item}" ${state.studySchedule.minutes === item ? "selected" : ""}>${item} phút</option>`).join("")}</select></label><label>Khung giờ gợi nhớ<input type="time" name="time" value="${safe(state.studySchedule.time)}"></label><label>Chương trình<select name="program">${[7,21,49].map((item) => `<option value="${item}" ${state.studySchedule.program === item ? "selected" : ""}>${item} ngày</option>`).join("")}</select></label><p>HH chỉ lưu lịch trên thiết bị; chưa tự gửi thông báo nếu bạn chưa cấp quyền cho PWA.</p><button class="dharma-primary" type="submit">Lưu thời khóa</button></form>`;
    root.append(dialog);
  }

  function readerMode(item) {
    root.querySelector("[data-dharma-reader]")?.remove();
    const source = sourceById(item.sourceId);
    const reader = document.createElement("div");
    reader.className = "dharma-reader-mode";
    reader.dataset.dharmaReader = "";
    reader.innerHTML = `<header><button type="button" data-reader-close>← Thoát chế độ đọc</button><span>Tóm lược học tập · ${safe(source.organization)}</span><button type="button" data-speak-scripture="${item.id}">▷ Nghe</button></header><main><small>${safe(item.collection)} · ${safe(item.tradition)}</small><h1>${safe(item.title)}</h1><p>${safe(item.summary)}</p><aside>Phần này là tóm lược nguyên bản của HH, không phải bản dịch kinh văn.</aside><a href="${safe(item.sourceUrl)}" target="_blank" rel="noopener noreferrer">Mở tài liệu nguồn ↗</a></main>`;
    root.append(reader);
  }

  function speakScripture(id) {
    const item = SCRIPTURES.find((entry) => entry.id === id);
    if (!item || !("speechSynthesis" in global)) return toast("Trình duyệt chưa hỗ trợ đọc văn bản.", "warning");
    global.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(item.summary);
    utterance.lang = "vi-VN";
    utterance.rate = 0.88;
    global.speechSynthesis.speak(utterance);
    toast("Đang đọc tóm lược HH, không phải nguyên văn kinh.", "success");
  }

  function bytesToBase64(bytes) {
    let binary = "";
    bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
    return btoa(binary);
  }

  function base64ToBytes(value) {
    const binary = atob(value);
    return Uint8Array.from(binary, (char) => char.charCodeAt(0));
  }

  function readJournalMeta() {
    try { return JSON.parse(localStorage.getItem(journalStorageKey()) || "null"); } catch { return null; }
  }

  async function deriveJournalKey(pin, salt) {
    const material = await global.crypto.subtle.importKey("raw", new TextEncoder().encode(pin), "PBKDF2", false, ["deriveKey"]);
    return global.crypto.subtle.deriveKey({ name: "PBKDF2", salt, iterations: JOURNAL_ITERATIONS, hash: "SHA-256" }, material, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
  }

  async function encryptJournal(entries, key, salt) {
    const iv = global.crypto.getRandomValues(new Uint8Array(12));
    const plaintext = new TextEncoder().encode(JSON.stringify(entries));
    const cipher = new Uint8Array(await global.crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, plaintext));
    localStorage.setItem(journalStorageKey(), JSON.stringify({ version: 1, algorithm: "AES-GCM", kdf: "PBKDF2-SHA256", iterations: JOURNAL_ITERATIONS, salt: bytesToBase64(salt), iv: bytesToBase64(iv), cipher: bytesToBase64(cipher) }));
  }

  async function setupJournal(pin) {
    const salt = global.crypto.getRandomValues(new Uint8Array(16));
    journalKey = await deriveJournalKey(pin, salt);
    journalEntries = [];
    await encryptJournal(journalEntries, journalKey, salt);
  }

  async function unlockJournal(pin) {
    const meta = readJournalMeta();
    if (!meta) throw new Error("Không tìm thấy nhật ký.");
    const salt = base64ToBytes(meta.salt);
    const key = await deriveJournalKey(pin, salt);
    const plain = await global.crypto.subtle.decrypt({ name: "AES-GCM", iv: base64ToBytes(meta.iv) }, key, base64ToBytes(meta.cipher));
    const parsed = JSON.parse(new TextDecoder().decode(plain));
    if (!Array.isArray(parsed)) throw new Error("Dữ liệu nhật ký không hợp lệ.");
    journalKey = key;
    journalEntries = parsed;
  }

  async function persistJournal() {
    const meta = readJournalMeta();
    if (!meta || !journalKey || !journalEntries) throw new Error("Nhật ký đang khóa.");
    await encryptJournal(journalEntries, journalKey, base64ToBytes(meta.salt));
  }

  function lockJournal() {
    journalKey = null;
    journalEntries = null;
    if (activeView === "journal") renderView({ preserveScroll: true });
  }

  function handleClick(event) {
    const nav = event.target.closest("[data-dharma-nav]");
    if (nav) return navigate(nav.dataset.dharmaNav);
    if (event.target.closest("[data-dharma-toggle-progress]")) {
      const hub = root.querySelector("[data-dharma-hub]");
      hub.classList.toggle("is-progress-closed");
      root.querySelectorAll("[data-dharma-toggle-progress]").forEach((button) => button.setAttribute("aria-expanded", String(!hub.classList.contains("is-progress-closed"))));
      return;
    }
    if (event.target.closest("[data-dharma-mobile-menu]")) {
      const sheet = root.querySelector("[data-dharma-mobile-sheet]");
      sheet.hidden = !sheet.hidden;
      root.querySelector("[data-dharma-hub]").classList.toggle("is-menu-open", !sheet.hidden);
      return;
    }
    if (event.target.closest("[data-dharma-schedule]")) return scheduleDialog();
    if (event.target.closest("[data-dialog-close]")) return event.target.closest("[data-dharma-dialog]")?.remove();
    const lessonButton = event.target.closest("[data-open-lesson], [data-dharma-next-lesson]");
    if (lessonButton) {
      selectedLesson = lessonButton.dataset.openLesson || lessonButton.dataset.dharmaNextLesson;
      if (!selectedLesson) return navigate("practice");
      activeView = "beginner";
      renderView();
      return;
    }
    const teachingButton = event.target.closest("[data-open-teaching]");
    if (teachingButton) { selectedTeaching = teachingButton.dataset.openTeaching; activeView = "teachings"; renderView(); return; }
    const scriptureButton = event.target.closest("[data-open-scripture]");
    if (scriptureButton) { selectedScripture = scriptureButton.dataset.openScripture; state.recentScripture = selectedScripture; saveState(); activeView = "scriptures"; renderView(); return; }
    const back = event.target.closest("[data-back-list]");
    if (back) { selectedLesson = ""; selectedTeaching = ""; selectedScripture = ""; activeView = back.dataset.backList; renderView(); return; }
    const complete = event.target.closest("[data-complete-lesson]");
    if (complete) {
      const id = complete.dataset.completeLesson;
      const existed = state.completedLessons.includes(id);
      state.completedLessons = existed ? state.completedLessons.filter((item) => item !== id) : unique([...state.completedLessons, id]);
      saveState(); renderView({ preserveScroll: true }); toast(existed ? "Đã bỏ trạng thái hoàn thành." : "Đã hoàn thành bài học.", "success"); return;
    }
    const program = event.target.closest("[data-program]");
    if (program) { state.studySchedule = { ...state.studySchedule, program: Number(program.dataset.program) }; saveState(); renderView({ preserveScroll: true }); return; }
    const routine = event.target.closest("[data-routine]");
    if (routine) {
      const day = todayKey(); const previous = Boolean(state.routineProgress[day]?.[routine.dataset.routine]);
      state.routineProgress = { ...state.routineProgress, [day]: { ...(state.routineProgress[day] || {}), [routine.dataset.routine]: !previous } };
      saveState(); renderView({ preserveScroll: true }); toast(previous ? "Đã bỏ ghi nhận." : "Đã ghi nhận vào thời khóa hôm nay."); return;
    }
    const bookmark = event.target.closest("[data-bookmark-scripture]");
    if (bookmark) {
      const id = bookmark.dataset.bookmarkScripture; const existed = state.bookmarks.includes(id);
      state.bookmarks = existed ? state.bookmarks.filter((item) => item !== id) : unique([...state.bookmarks, id]);
      saveState(); renderView({ preserveScroll: true }); toast(existed ? "Đã bỏ khỏi thư viện." : "Đã lưu vào thư viện."); return;
    }
    const teachingTab = event.target.closest("[data-teaching-tab]");
    if (teachingTab) {
      const card = teachingTab.closest(".dharma-teaching-detail");
      card.querySelectorAll("[data-teaching-tab]").forEach((button) => button.setAttribute("aria-selected", String(button === teachingTab)));
      card.querySelectorAll("[data-teaching-panel]").forEach((panel) => { panel.hidden = panel.dataset.teachingPanel !== teachingTab.dataset.teachingTab; });
      return;
    }
    const requestTab = event.target.closest("[data-request-tab]");
    if (requestTab) {
      root.querySelectorAll("[data-request-tab]").forEach((button) => button.setAttribute("aria-selected", String(button === requestTab)));
      root.querySelectorAll("[data-request-panel]").forEach((panel) => { panel.hidden = panel.dataset.requestPanel !== requestTab.dataset.requestTab; });
      return;
    }
    const speak = event.target.closest("[data-speak-scripture]");
    if (speak) return speakScripture(speak.dataset.speakScripture);
    if (event.target.closest("[data-reader-mode]")) return readerMode(SCRIPTURES.find((item) => item.id === selectedScripture));
    if (event.target.closest("[data-reader-close]")) { global.speechSynthesis?.cancel?.(); event.target.closest("[data-dharma-reader]")?.remove(); return; }
    const timerPreset = event.target.closest("[data-timer-preset]");
    if (timerPreset) { stopTimer(); timerInitial = Number(timerPreset.dataset.timerPreset) * 60; timerRemaining = timerInitial; renderView({ preserveScroll: true }); return; }
    if (event.target.closest("[data-timer-toggle]")) return toggleTimer();
    if (event.target.closest("[data-timer-reset]")) { stopTimer(); timerRemaining = timerInitial; updateTimerDisplay(); return; }
    const chantAdd = event.target.closest("[data-chant-add]");
    if (chantAdd) { state.chantCount += Number(chantAdd.dataset.chantAdd); saveState(); root.querySelector("[data-chant-count]").textContent = state.chantCount; return; }
    if (event.target.closest("[data-chant-plus]")) { state.chantCount += 1; saveState(); root.querySelector("[data-chant-count]").textContent = state.chantCount; return; }
    if (event.target.closest("[data-chant-minus]")) { state.chantCount = Math.max(0, state.chantCount - 1); saveState(); root.querySelector("[data-chant-count]").textContent = state.chantCount; return; }
    if (event.target.closest("[data-chant-reset]")) { const old = state.chantCount; state.chantCount = 0; saveState(); renderView({ preserveScroll: true }); toast("Đã đặt bộ đếm về 0.", "success", () => { state.chantCount = old; saveState(); renderView({ preserveScroll: true }); }); return; }
    if (event.target.closest("[data-clear-practice]")) { const old = state.practiceHistory; state.practiceHistory = []; saveState(); renderView({ preserveScroll: true }); toast("Đã xóa lịch sử thực hành.", "success", () => { state.practiceHistory = old; saveState(); renderView({ preserveScroll: true }); }); return; }
    const saveTalk = event.target.closest("[data-save-talk]");
    if (saveTalk) { const id = saveTalk.dataset.saveTalk; state.savedTalks = state.savedTalks.includes(id) ? state.savedTalks.filter((item) => item !== id) : [...state.savedTalks, id]; saveState(); renderView({ preserveScroll: true }); return; }
    const saveSource = event.target.closest("[data-save-source]");
    if (saveSource) { const id = saveSource.dataset.saveSource; state.savedSources = state.savedSources.includes(id) ? state.savedSources.filter((item) => item !== id) : [...state.savedSources, id]; saveState(); renderView({ preserveScroll: true }); return; }
    const deleteEvent = event.target.closest("[data-delete-event]");
    if (deleteEvent) { state.events = state.events.filter((item) => item.id !== deleteEvent.dataset.deleteEvent); saveState(); renderView({ preserveScroll: true }); return; }
    const deletePrint = event.target.closest("[data-delete-print]");
    if (deletePrint) { state.printRequests = state.printRequests.filter((item) => item.id !== deletePrint.dataset.deletePrint); saveState(); renderView({ preserveScroll: true }); return; }
    if (event.target.closest("[data-journal-lock]")) return lockJournal();
    if (event.target.closest("[data-journal-reset]")) {
      if (!global.confirm("Xóa vĩnh viễn nhật ký đã mã hóa? Không thể hoàn tác.")) return;
      localStorage.removeItem(journalStorageKey()); lockJournal(); renderView(); toast("Đã xóa nhật ký mã hóa.", "warning"); return;
    }
    const deleteJournal = event.target.closest("[data-delete-journal]");
    if (deleteJournal && journalEntries) {
      journalEntries = journalEntries.filter((item) => item.id !== deleteJournal.dataset.deleteJournal);
      persistJournal().then(() => { renderView({ preserveScroll: true }); toast("Đã xóa ghi chép."); }).catch(() => toast("Không thể lưu thay đổi.", "warning")); return;
    }
    const searchResult = event.target.closest("[data-search-action]");
    if (searchResult) {
      if (searchResult.dataset.searchAction === "lesson") { selectedLesson = searchResult.dataset.searchId; activeView = "beginner"; }
      if (searchResult.dataset.searchAction === "teaching") { selectedTeaching = searchResult.dataset.searchId; activeView = "teachings"; }
      if (searchResult.dataset.searchAction === "scripture") { selectedScripture = searchResult.dataset.searchId; activeView = "scriptures"; }
      root.querySelector("[data-dharma-search-results]")?.remove(); renderView(); return;
    }
    if (event.target.closest("[data-dharma-primary]")) return activeView === "practice" ? toggleTimer() : navigate("beginner");
  }

  function handleInput(event) {
    if (event.target.matches("[data-dharma-search]")) return showSearchResults(event.target);
    if (event.target.matches("[data-scripture-search]")) { scriptureQuery = event.target.value; renderView({ preserveScroll: true }); root.querySelector("[data-scripture-search]")?.focus({ preventScroll: true }); }
  }

  function handleChange(event) {
    if (event.target.matches("[data-scripture-tradition]")) { scriptureTradition = event.target.value; renderView({ preserveScroll: true }); }
    const note = event.target.closest("[data-lesson-note]");
    if (note) { state.lessonNotes = { ...state.lessonNotes, [note.dataset.lessonNote]: note.value }; saveState(); toast("Đã lưu ghi chú trên thiết bị."); }
  }

  async function handleSubmit(event) {
    const form = event.target;
    if (!form.closest("[data-dharma-hub]")) return;
    event.preventDefault();
    if (form.matches("[data-schedule-form]")) {
      const data = new FormData(form); state.studySchedule = { minutes: Number(data.get("minutes")), time: String(data.get("time") || "20:00"), program: Number(data.get("program")) };
      saveState(); form.closest("[data-dharma-dialog]")?.remove(); renderView({ preserveScroll: true }); toast("Đã lưu thời khóa."); return;
    }
    if (form.matches("[data-event-form]")) {
      const data = new FormData(form); state.events = [...state.events, { id: global.crypto?.randomUUID?.() || `${Date.now()}`, title: String(data.get("title")).trim(), at: String(data.get("at")) }];
      saveState(); renderView({ preserveScroll: true }); toast("Đã lưu vào lịch cá nhân."); return;
    }
    if (form.matches("[data-print-request]")) {
      const data = new FormData(form); state.printRequests = [...state.printRequests, { id: global.crypto?.randomUUID?.() || `${Date.now()}`, title: String(data.get("title")).trim(), purpose: String(data.get("purpose")), createdAt: new Date().toISOString() }];
      saveState(); renderView({ preserveScroll: true }); root.querySelector('[data-request-tab="print"]')?.click(); toast("Đã lưu nguyện vọng; đây chưa phải đơn hàng."); return;
    }
    if (form.matches("[data-qna-form]")) {
      const question = String(new FormData(form).get("question") || ""); const terms = normalize(question).split(/\s+/).filter((term) => term.length > 2);
      const candidates = [...TEACHINGS.map((item) => ({ ...item, kind: "Giáo lý", text: `${item.title} ${item.intro} ${item.deep} ${item.application}` })), ...SCRIPTURES.map((item) => ({ ...item, kind: "Kinh điển", intro: item.summary, application: "Mở nguồn gốc để đọc đầy đủ trong bối cảnh.", text: `${item.title} ${item.summary} ${item.keywords}` }))];
      const ranked = candidates.map((item) => ({ item, score: terms.reduce((sum, term) => sum + (normalize(item.text).includes(term) ? 1 : 0), 0) })).filter((entry) => entry.score).sort((a,b) => b.score - a.score).slice(0, 3);
      const answer = root.querySelector("[data-qna-answer]");
      answer.innerHTML = ranked.length ? `<small>KẾT QUẢ TỪ THƯ VIỆN NỘI BỘ</small>${ranked.map(({ item }) => `<article><header><span>${safe(item.kind)}</span>${sourceBadge(item.sourceId)}</header><h3>${safe(item.title)}</h3><p>${safe(item.intro || item.summary)}</p><p><strong>Gợi ý thực hành:</strong> ${safe(item.application || "Đọc nguồn trong bối cảnh và ghi lại điều bạn hiểu.")}</p></article>`).join("")}` : '<p class="dharma-empty-line">Chưa tìm thấy chủ đề đủ gần. Hãy thử “Tứ Diệu Đế”, “hơi thở”, “từ bi” hoặc mở nguồn chính thức.</p>';
      answer.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "nearest" }); return;
    }
    if (form.matches("[data-journal-setup]")) {
      const data = new FormData(form); const pin = String(data.get("pin"));
      if (pin !== String(data.get("confirm"))) return toast("Hai lần nhập PIN chưa khớp.", "warning");
      try { await setupJournal(pin); renderView(); toast("Đã tạo nhật ký mã hóa."); } catch { toast("Không thể tạo khóa trên trình duyệt này.", "warning"); } return;
    }
    if (form.matches("[data-journal-unlock]")) {
      try { await unlockJournal(String(new FormData(form).get("pin"))); renderView(); toast("Đã mở khóa trong phiên hiện tại."); } catch { toast("PIN không đúng hoặc dữ liệu đã hỏng.", "warning"); } return;
    }
    if (form.matches("[data-journal-entry]")) {
      const data = new FormData(form); journalEntries.push({ id: global.crypto?.randomUUID?.() || `${Date.now()}`, title: String(data.get("title")).trim(), body: String(data.get("body")).trim(), mood: String(data.get("mood")), createdAt: new Date().toISOString() });
      try { await persistJournal(); renderView(); toast("Đã mã hóa và lưu ghi chép."); } catch { journalEntries.pop(); toast("Không thể mã hóa ghi chép.", "warning"); } return;
    }
  }

  function handleKeydown(event) {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") { event.preventDefault(); root?.querySelector("[data-dharma-search]")?.focus(); }
    if (event.key === "Escape") { root?.querySelector("[data-dharma-reader]")?.remove(); root?.querySelector("[data-dharma-dialog]")?.remove(); root?.querySelector("[data-dharma-search-results]")?.remove(); }
  }

  function listen(target, type, handler, options) {
    target.addEventListener(type, handler, options); listeners.push(() => target.removeEventListener(type, handler, options));
  }

  function mount(host, options = {}) {
    if (!host) return false;
    unmount();
    root = host;
    accountKey = accountScope(options.currentUser || {});
    state = readState();
    activeView = NAV.some((item) => item.id === options.view) ? options.view : "today";
    root.innerHTML = shellMarkup();
    if (global.matchMedia("(max-width: 1260px)").matches) root.querySelector("[data-dharma-hub]")?.classList.add("is-progress-closed");
    renderView();
    listen(root, "click", handleClick);
    listen(root, "input", handleInput);
    listen(root, "change", handleChange);
    listen(root, "submit", handleSubmit);
    listen(document, "keydown", handleKeydown);
    listen(document, "visibilitychange", () => { if (document.hidden && timerRunning) stopTimer(); });
    return true;
  }

  function unmount() {
    stopTimer();
    global.speechSynthesis?.cancel?.();
    listeners.splice(0).forEach((remove) => remove());
    lockJournal();
    if (root) root.replaceChildren();
    root = null;
  }

  global.HHPhatPhap = Object.freeze({ VERSION, mount, unmount, lessons: LESSONS, teachings: TEACHINGS, scriptures: SCRIPTURES, sources: SOURCES });
})(window);
