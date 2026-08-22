(function () {
  "use strict";

  const STORAGE_KEY = "hh.home.capability-atlas.v1";
  const SECTION_COPY = Object.freeze({
    "ai-creative": "Tạo nội dung, hình ảnh, âm nhạc và sản phẩm số với AI cùng các studio chuyên sâu.",
    "web-community": "Tìm kiếm, xem video, kết nối cộng đồng và cộng tác từ xa trong các workspace riêng tư.",
    entertainment: "Đọc, xem, nghe và khám phá nội dung giải trí bằng các thư viện trực quan.",
    "work-tech": "Quản lý công việc, phát triển phần mềm, xử lý media, phân tích và bảo vệ quyền nội dung.",
    learning: "Học kiến thức phổ thông và ngoại ngữ theo lộ trình rõ ràng, có luyện tập và theo dõi tiến độ.",
    "system-admin": "Quản lý nền tảng, cài đặt vận hành và đồng hành cùng quá trình phát triển HH Platform."
  });
  const ITEM_COPY = Object.freeze({
    "chat-ai": ["Trợ lý AI để hỏi đáp, viết, phân tích và làm việc với tệp trong một cuộc trò chuyện.", "Hỏi đáp theo ngữ cảnh|Tiếp tục chủ đề mà không phải nhập lại thông tin", "Tệp và hình ảnh|Đính kèm nội dung để tóm tắt hoặc phân tích", "Không gian riêng tư|Quản lý lịch sử, dữ liệu và phiên trò chuyện"],
    create: ["Điều hành toàn bộ quy trình sáng tạo từ ý tưởng, kịch bản đến sản xuất và xuất bản.", "Creative Brief|Xác định mục tiêu, đối tượng và thông điệp", "Storyboard & Moodboard|Tổ chức hình ảnh, cảnh và phong cách", "Workflow & Review|Theo dõi phiên bản, phê duyệt và cộng tác"],
    draw: ["Studio vẽ ánh sáng với brush động, đối xứng, layer, animation và xuất project.", "Brush & Symmetry|Vẽ nét phát sáng với nhiều trục đối xứng", "Layer Studio|Ẩn, khóa, trộn và sắp xếp từng lớp", "Animation & Export|Phát lại quá trình vẽ và xuất ảnh hoặc project"],
    "music-ai": ["Xưởng làm nhạc từ ý tưởng đến phối khí, thu âm, mix, master và xuất bản.", "Sáng tác & MIDI|Tạo giai điệu, hợp âm và cấu trúc bài", "Thu âm & Hậu kỳ|Quản lý take, mix, master và kiểm âm", "Quyền & Phát hành|Chuẩn hóa metadata, nguồn và lịch xuất bản"],
    "comic-motion": ["Biến truyện tranh tĩnh thành cảnh chuyển động có camera, thoại, âm thanh và timeline.", "Panel & Camera|Tách khung và tạo chuyển động máy quay", "Thoại & Âm thanh|Đồng bộ bubble, voice và hiệu ứng", "Timeline & Export|Dựng cảnh, xem trước và xuất thành phẩm"],
    "media-design": ["Bộ công cụ sản xuất ảnh, video, audio, tài liệu, thương hiệu và tài sản số.", "Project Core|Quản lý asset, phiên bản, review và khôi phục", "Production Studios|Chỉnh ảnh, video, podcast và tài liệu", "Delivery Center|Kiểm tra quyền, render và bàn giao nhiều định dạng"],
    "graphic-design": ["Không gian thiết kế vector, typography, motion, 3D, prototype và hệ thống component.", "Vector & Typography|Tạo hình, chữ và màu không phá hủy", "Motion & 3D|Dựng chuyển động, scene và mockup", "Prototype & Handoff|Thiết kế tương tác, kiểm duyệt và bàn giao code"],
    google: ["Tìm web, hình ảnh, tin tức và tài liệu với bộ lọc rõ ràng ngay trong HH Platform.", "Tìm kiếm nâng cao|Lọc theo nguồn, thời gian, định dạng và website", "Lưu & Lịch sử|Giữ kết quả quan trọng và tìm lại nhanh", "Dịch vụ Google|Mở đúng dịch vụ mà không rời luồng làm việc"],
    "youtube-main": ["Tìm, xem và tổ chức video với player, hàng đợi, playlist và lịch sử riêng.", "Player linh hoạt|Tốc độ, phụ đề, PiP và chế độ rạp", "Hàng đợi & Playlist|Sắp xếp, lặp và tự phát video", "Khám phá có lọc|Lọc thời lượng, ngày đăng, ngôn ngữ và livestream"],
    discord: ["Kết nối tài khoản Discord bằng OAuth và làm việc với server đã cấp quyền cho bot HH.", "Server & Kênh|Xem không gian mà tài khoản và bot được phép truy cập", "Tin nhắn bot|Gửi thử, theo dõi trạng thái và xử lý lỗi", "Quyền riêng tư|Không công khai tài khoản hoặc token cho người dùng khác"],
    communication: ["Trung tâm nhắn tin, kênh, cuộc gọi, diễn đàn và cộng tác realtime của HH.", "Hộp thư hợp nhất|Theo dõi hội thoại và thông báo ở một nơi", "Room & Calls|Tạo phòng trực tiếp với quyền tham gia rõ ràng", "An toàn cộng đồng|Moderation, báo cáo và kiểm soát thành viên"],
    remote: ["Chia sẻ hoặc điều khiển màn hình theo phiên, có mã kết nối và quyền truy cập rõ ràng.", "Chia sẻ màn hình|Chọn màn hình và người được phép xem", "Điều khiển có đồng ý|Chỉ nhận thao tác sau khi chủ máy phê duyệt", "Bảo vệ phiên|Khóa quyền, ngắt ngay và theo dõi thiết bị"],
    "comic-reader": ["Thư viện đọc truyện với tìm kiếm, chế độ đọc, đánh dấu và tiếp tục từ vị trí cũ.", "Thư viện & Tìm kiếm|Lọc truyện và mở nguồn phù hợp", "Reader Mode|Đọc dọc hoặc theo trang với điều khiển gọn", "Theo dõi tiến độ|Lưu chương, vị trí và danh sách yêu thích"],
    cinema: ["Không gian xem phim có thư viện, player, danh sách lưu và thông tin nguồn nội dung.", "Khám phá phim|Tìm và lọc thư viện dễ đọc", "Player điện ảnh|Phụ đề, âm lượng, toàn màn hình và tiếp tục xem", "Danh sách cá nhân|Lưu phim và quản lý lịch sử"],
    "music-library": ["Thư viện nghe nhạc với playlist, hàng đợi, mini player và thông tin bản quyền.", "Player & Queue|Phát, lặp, trộn và đổi thứ tự", "Playlist cá nhân|Lưu và tổ chức bài hát", "Nguồn minh bạch|Hiển thị giấy phép và liên kết nguồn"],
    fortune: ["Bộ công cụ Tarot, Kinh Dịch, Thần số học, chiêm tinh và nhật ký chiêm nghiệm.", "Công cụ chuyên biệt|Mỗi phương pháp có luồng nhập, tính và luận riêng", "Kết quả & HH AI|Xem tổng quan, chi tiết và giải thích hỗ trợ", "Nhật ký & So sánh|Lưu, ghi chú, xuất và đối chiếu phiên"],
    work: ["Điều hành việc hôm nay, dự án, lộ trình, đội nhóm, tri thức và tự động hóa.", "Projects & Tasks|List, board, lịch, timeline và milestone", "Planning & Team|Roadmap, capacity, workload và rủi ro", "Automation & Portfolio|Chạy quy tắc và theo dõi sức khỏe dự án"],
    "davinci-resolve": ["Bộ công cụ xử lý video, ảnh chữ và xuất bản hàng loạt cho nhiều nền tảng.", "Video Studio|Dựng timeline, màu, audio và render trên web", "Batch Factory|Ghép dữ liệu và xử lý nhiều media cùng lúc", "Publisher Centers|Chuẩn bị, kiểm tra và đăng qua API được cấp quyền"],
    dev: ["Bàn làm việc cho lập trình viên: code, API, dữ liệu, Git, bảo mật và quan sát hệ thống.", "Code & API|Thử code, request, mock và realtime", "Data & Git|Xử lý JSON, database, diff và branch", "Security & Observability|Kiểm tra secret, dependency, log và hiệu suất"],
    insights: ["Tổng hợp chỉ số hoạt động, báo cáo và trạng thái kỹ thuật thành thông tin dễ hành động.", "Dashboard dữ liệu|Theo dõi số liệu và xu hướng quan trọng", "Tìm kiếm & API|Khám phá nguồn và kết nối dữ liệu", "Trạng thái & Cảnh báo|Quan sát dịch vụ, feature flag và sự cố"],
    copyright: ["Kiểm tra giấy phép, lưu nguồn, quản lý attribution và xử lý yêu cầu bản quyền.", "Hồ sơ nguồn|Ghi tác giả, giấy phép và bằng chứng", "Kiểm tra quyền|Đánh giá khả năng dùng trước khi xuất bản", "Yêu cầu & Khiếu nại|Tạo hồ sơ xử lý minh bạch"],
    learn: ["Hệ thống học tập phổ thông với bài hôm nay, môn học, luyện tập và tiến độ.", "Lộ trình cá nhân|Chọn cấp học, mục tiêu và lịch phù hợp", "Bài học & Luyện tập|Học nội dung rồi thực hành ngay", "Đánh giá & Tiến độ|Kiểm tra, xem kỹ năng và lỗi cần ôn"],
    english: ["Học tiếng Anh từ nền tảng đến nâng cao theo CEFR, nghề nghiệp và kỹ năng thực tế.", "Lộ trình A1–C2|Bài học theo cấp với mục tiêu rõ ràng", "Nghe Nói Đọc Viết|Luyện từng kỹ năng và nhận phản hồi", "Career English|Từ vựng và tình huống theo công việc"],
    japanese: ["Học tiếng Nhật với Kana, Kanji, ngữ pháp, hội thoại, đọc hiểu và luyện JLPT.", "Kana & Kanji|Nhận diện, thứ tự nét và SRS", "Ngữ pháp & Hội thoại|Học mẫu câu trong ngữ cảnh", "JLPT & Tiến độ|Ôn theo cấp và theo dõi lỗi"],
    chinese: ["Học tiếng Trung dành cho người Việt từ số 0 đến HSK 9 với kho tra cứu lớn.", "Pinyin & Tone|Luyện thanh điệu bằng nghe và giọng nói", "Hanzi & Từ vựng|Học chữ, bộ thủ, ví dụ và SRS", "Kỹ năng & HSK|Hội thoại, đọc, viết, dịch và mô phỏng thi"],
    admin: ["Khu điều hành dành riêng cho quản trị viên đã xác thực và có quyền phù hợp.", "Người dùng & Quyền|Quản lý vai trò và quyền truy cập", "Vận hành & Nhật ký|Theo dõi trạng thái và hành động quản trị", "Cấu hình nền tảng|Kiểm soát tính năng và chính sách"],
    system: ["Quản lý cài đặt, PWA, widget, dữ liệu thiết bị và trạng thái nền tảng.", "Cài đặt giao diện|Theme, bố cục, trợ năng và hiệu năng", "Dữ liệu & Đồng bộ|Xuất nhập, cache và trạng thái lưu trữ", "PWA & Hệ thống|Cài ứng dụng, widget và kiểm tra dịch vụ"],
    support: ["Ủng hộ minh bạch qua PayOS/VietQR và theo dõi tác động của từng mục tiêu phát triển.", "Chọn nhiệm vụ|Chọn mục tiêu và số tiền muốn tiếp sức", "Thanh toán & Xác minh|Tạo QR, kiểm tra giao dịch và nhận biên nhận", "Tác động & Cộng đồng|Xem tiến độ, minh bạch và lời nhắn tri ân"]
  });

  let host = null;
  let state = { section: "", query: "", expanded: new Set() };
  let searchRenderTimer = 0;

  const escapeHtml = (value) => String(value ?? "").replace(/[<>&"']/g, (char) => ({
    "<": "&lt;", ">": "&gt;", "&": "&amp;", "\"": "&quot;", "'": "&#39;"
  }[char]));
  const normalize = (value) => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
  const parseFeature = (value, route) => {
    const [title, description] = String(value || "").split("|");
    return { title: title.trim(), description: (description || "").trim(), category: "Chức năng chính", route };
  };
  const readStoredSection = () => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}").section || ""; } catch { return ""; }
  };
  const saveSection = () => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ section: state.section })); } catch {}
  };
  const sourceSections = () => {
    const sections = window.HHNavigationCatalog?.getSections?.();
    return Array.isArray(sections) ? sections : [];
  };
  const itemDescription = (item) => ITEM_COPY[item.id]?.[0] || `Mở ${item.label} để khám phá các công cụ và quy trình được thiết kế riêng.`;
  const itemFeatures = (item) => {
    const described = (ITEM_COPY[item.id] || []).slice(1).map((value) => parseFeature(value, item.route));
    const source = (item.features || []).map((feature) => ({
      ...feature,
      description: feature.description || `Mở ${feature.title} trong workspace ${item.label}.`
    }));
    const seen = new Set();
    return [...source, ...described].filter((feature) => {
      const key = normalize(feature.title);
      if (!feature.title || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  };
  const itemSearchText = (section, item) => normalize([
    section.label, SECTION_COPY[section.id], item.label, itemDescription(item), item.keywords,
    ...itemFeatures(item).flatMap((feature) => [feature.title, feature.description, feature.category])
  ].join(" "));

  function featureMarkup(feature, accent) {
    return `<button class="hca-feature" type="button" data-app-route="${escapeHtml(feature.route)}" style="--feature-accent:${escapeHtml(accent)}">
      <span aria-hidden="true">✦</span><div><small>${escapeHtml(feature.category || "Chức năng")}</small><strong>${escapeHtml(feature.title)}</strong><p>${escapeHtml(feature.description)}</p></div><i aria-hidden="true">↗</i>
    </button>`;
  }

  function cardMarkup(section, item) {
    const features = itemFeatures(item);
    const isExpanded = state.expanded.has(item.id);
    return `<article class="hca-tool-card ${isExpanded ? "is-expanded" : ""}" data-hca-card="${escapeHtml(item.id)}" style="--tool-accent:${escapeHtml(item.accent || section.accent)};--group-accent:${escapeHtml(section.accent)}">
      <div class="hca-tool-card__signal" aria-hidden="true"><i></i><i></i><i></i></div>
      <header><span class="hca-tool-orb" aria-hidden="true"><b>${escapeHtml(item.icon || "✦")}</b><i></i></span><div><small>WORKSPACE · ${features.length} CHỨC NĂNG</small><h3>${escapeHtml(item.label)}</h3></div></header>
      <p class="hca-tool-description">${escapeHtml(itemDescription(item))}</p>
      <div class="hca-tool-preview" aria-label="Chức năng nổi bật">${features.slice(0, 3).map((feature) => `<span>${escapeHtml(feature.title)}</span>`).join("")}</div>
      <div class="hca-tool-actions">
        <button type="button" class="hca-tool-details" data-hca-expand="${escapeHtml(item.id)}" aria-expanded="${isExpanded}"><span>${isExpanded ? "Thu gọn" : `Xem ${features.length} chức năng`}</span><i aria-hidden="true">⌄</i></button>
        <button type="button" class="hca-tool-open" data-app-route="${escapeHtml(item.route)}">Mở ${escapeHtml(item.label)} <span aria-hidden="true">→</span></button>
      </div>
      <section class="hca-tool-features" ${isExpanded ? "" : "hidden"} aria-label="Toàn bộ chức năng của ${escapeHtml(item.label)}">
        <header><div><small>BÊN TRONG ${escapeHtml(item.label.toLocaleUpperCase("vi"))}</small><strong>Chọn một chức năng để mở đúng không gian</strong></div><span>${features.length} mục</span></header>
        <div>${features.map((feature) => featureMarkup(feature, item.accent || section.accent)).join("")}</div>
      </section>
    </article>`;
  }

  function render(options = {}) {
    if (!host?.isConnected) return false;
    const sections = sourceSections();
    if (!sections.length) {
      host.innerHTML = '<section class="hca hca-empty"><strong>Đang đồng bộ bản đồ chức năng…</strong><p>Dữ liệu điều hướng sẽ xuất hiện ngay khi App Shell sẵn sàng.</p></section>';
      return false;
    }
    if (!sections.some((section) => section.id === state.section)) state.section = readStoredSection();
    if (!sections.some((section) => section.id === state.section)) state.section = sections[0].id;
    const query = normalize(state.query);
    const activeSection = sections.find((section) => section.id === state.section) || sections[0];
    const results = query
      ? sections.flatMap((section) => section.items.filter((item) => itemSearchText(section, item).includes(query)).map((item) => ({ section, item })))
      : activeSection.items.map((item) => ({ section: activeSection, item }));
    const workspaceCount = sections.reduce((total, section) => total + section.items.length, 0);
    const featureCount = sections.reduce((total, section) => total + section.items.reduce((count, item) => count + itemFeatures(item).length, 0), 0);
    const sectionDescription = query
      ? `Kết quả khớp với “${state.query.trim()}” trong toàn bộ HH Platform.`
      : SECTION_COPY[activeSection.id] || "Khám phá các workspace và chức năng trong nhóm này.";
    host.innerHTML = `<section class="hca" data-hca-root style="--hca-accent:${escapeHtml(activeSection.accent)};--hca-secondary:${escapeHtml(activeSection.accentSecondary)}">
      <div class="hca-space" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></div>
      <header class="hca-hero">
        <div class="hca-hero__copy"><span><i></i> BẢN ĐỒ CHỨC NĂNG HH</span><h2>Mọi công cụ, giải thích bằng ngôn ngữ dễ hiểu</h2><p>Chọn một nhóm để xem nó dùng làm gì, có những chức năng nào và mở đúng workspace chỉ với một lần bấm.</p></div>
        <div class="hca-hero__metrics"><span><strong>${sections.length}</strong><small>NHÓM LỚN</small></span><span><strong>${workspaceCount}</strong><small>WORKSPACE</small></span><span><strong>${featureCount}</strong><small>CHỨC NĂNG</small></span></div>
      </header>
      <div class="hca-controls">
        <label class="hca-search"><span aria-hidden="true">⌕</span><input type="search" data-hca-search value="${escapeHtml(state.query)}" placeholder="Tìm AI, vẽ, video, học tiếng Trung, remote…" autocomplete="off"><kbd>⌘ K</kbd>${state.query ? '<button type="button" data-hca-clear aria-label="Xóa tìm kiếm">×</button>' : ""}</label>
        <nav class="hca-tabs" aria-label="Nhóm chức năng">${sections.map((section) => `<button type="button" data-hca-section="${escapeHtml(section.id)}" style="--tab-accent:${escapeHtml(section.accent)}" ${section.id === activeSection.id && !query ? 'aria-current="true"' : ""}><span aria-hidden="true">${escapeHtml(section.icon)}</span><b>${escapeHtml(section.label)}</b><small>${section.items.length}</small></button>`).join("")}</nav>
      </div>
      <section class="hca-section-intro">
        <span class="hca-section-orb" aria-hidden="true">${query ? "⌕" : escapeHtml(activeSection.icon)}<i></i><b></b></span>
        <div><small>${query ? "TÌM TRÊN TOÀN NỀN TẢNG" : `KHÔNG GIAN ${escapeHtml(activeSection.label.toLocaleUpperCase("vi"))}`}</small><h3>${query ? `${results.length} workspace phù hợp` : escapeHtml(activeSection.label)}</h3><p>${escapeHtml(sectionDescription)}</p></div>
        <strong aria-live="polite">${results.length} kết quả</strong>
      </section>
      <div class="hca-grid">${results.length ? results.map(({ section, item }) => cardMarkup(section, item)).join("") : `<section class="hca-no-results"><span>✦</span><h3>Chưa tìm thấy chức năng phù hợp</h3><p>Thử từ khóa ngắn hơn như “ảnh”, “AI”, “học”, “video” hoặc chọn trực tiếp một nhóm.</p><button type="button" data-hca-clear>Xem toàn bộ chức năng</button></section>`}</div>
      <footer class="hca-footer"><span><i></i> Danh sách đồng bộ trực tiếp với sidebar và quyền tài khoản</span><button type="button" data-command-open>⌕ Mở tìm kiếm toàn hệ thống</button></footer>
    </section>`;
    if (options.focusSearch) {
      const input = host.querySelector("[data-hca-search]");
      input?.focus({ preventScroll: true });
      input?.setSelectionRange(input.value.length, input.value.length);
    }
    return true;
  }

  function bind() {
    if (host.dataset.hcaBound === "true") return;
    host.dataset.hcaBound = "true";
    host.addEventListener("input", (event) => {
      if (!event.target.matches("[data-hca-search]")) return;
      state.query = event.target.value;
      clearTimeout(searchRenderTimer);
      searchRenderTimer = setTimeout(() => render({ focusSearch: true }), 120);
    });
    host.addEventListener("click", (event) => {
      const sectionButton = event.target.closest("[data-hca-section]");
      if (sectionButton) {
        state.section = sectionButton.dataset.hcaSection;
        state.query = "";
        state.expanded.clear();
        saveSection();
        render();
        host.scrollIntoView({ block: "start", behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
        return;
      }
      if (event.target.closest("[data-hca-clear]")) {
        state.query = "";
        render({ focusSearch: true });
        return;
      }
      const expandButton = event.target.closest("[data-hca-expand]");
      if (!expandButton) return;
      const id = expandButton.dataset.hcaExpand;
      if (state.expanded.has(id)) state.expanded.delete(id);
      else state.expanded.add(id);
      render();
      host.querySelector(`[data-hca-card="${CSS.escape(id)}"]`)?.scrollIntoView({ block: "nearest", behavior: "auto" });
    });
  }

  function mount() {
    if (location.hash && !/^#\/home(?:$|[/?])/.test(location.hash)) return false;
    host = document.getElementById("homeCapabilityAtlasRoot");
    if (!host) return false;
    bind();
    return render();
  }

  const scheduleMount = () => requestAnimationFrame(() => requestAnimationFrame(mount));
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", scheduleMount);
  else scheduleMount();
  addEventListener("hh:workspace-open", scheduleMount);
  addEventListener("hh:auth-change", scheduleMount);
  addEventListener("hh:asset-group-ready", (event) => {
    if (event.detail?.group === "home-enhancements") scheduleMount();
  });
  addEventListener("hashchange", () => {
    if (/^#\/home(?:$|[/?])/.test(location.hash)) scheduleMount();
  });

  window.HHHomeCapabilityAtlas = Object.freeze({ version: 1, mount, refresh: render });
})();
