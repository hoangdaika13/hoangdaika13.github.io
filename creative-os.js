(() => {
  "use strict";

  if (window.HHCreativeOS) return;

  const VIEWS = Object.freeze([
    { id: "overview", group: "Điều hành", icon: "CC", title: "Creative Command Center", description: "Dự án, deadline, chi phí, lịch và tiến độ" },
    { id: "project", group: "Điều hành", icon: "UP", title: "Universal Project", description: "Quản lý brief, tài sản và phiên bản; công cụ chuyên trách lưu riêng" },
    { id: "ai-center", group: "AI & Kịch bản", icon: "AI", title: "AI Center", description: "Chat, prompt, phân tích và workflow AI" },
    { id: "ai-script", group: "AI & Kịch bản", icon: "KS", title: "Kịch bản AI", description: "Viết, phân tích, dịch, batch và quản lý series" },
    { id: "brief", group: "Tiền kỳ", icon: "BR", title: "Creative Brief", description: "Mục tiêu, đối tượng và kế hoạch nội dung" },
    { id: "moodboard", group: "Tiền kỳ", icon: "MB", title: "Moodboard", description: "Concept board kéo thả đa phương tiện" },
    { id: "storyboard", group: "Tiền kỳ", icon: "SB", title: "Storyboard", description: "Cảnh, shot, thoại và animatic" },
    { id: "world-bible", group: "Tiền kỳ", icon: "WB", title: "World Bible", description: "Nhân vật, địa điểm và tính nhất quán" },
    { id: "creator-studio", group: "Sản xuất nội dung", icon: "CS", title: "Creator Studio", description: "Gói nội dung đa nền tảng và nghiên cứu xu hướng" },
    { id: "media-center", group: "Sản xuất nội dung", icon: "MC", title: "Media Center", description: "Thư viện, Google và YouTube discovery" },
    { id: "workflow", group: "AI & Workflow", icon: "WF", title: "Creative Workflow", description: "Pipeline node, cache và approval gate" },
    { id: "ai-director", group: "AI & Workflow", icon: "AD", title: "AI Director", description: "Đề xuất quy trình có bước duyệt" },
    { id: "prompt-studio", group: "AI & Workflow", icon: "MP", title: "Multimodal Prompt", description: "Reference, camera, seed và lineage" },
    { id: "ai-automation", group: "AI & Workflow", icon: "AU", title: "AI Automation", description: "Pipeline sản xuất, preset và lịch sử chạy" },
    { id: "repurpose", group: "Sản xuất chuyên sâu", icon: "RE", title: "Repurpose Engine", description: "Một nội dung thành nhiều định dạng" },
    { id: "brand", group: "Sản xuất chuyên sâu", icon: "BI", title: "Brand Intelligence", description: "Brand voice, quy tắc và kiểm tra" },
    { id: "audio-dubbing", group: "Sản xuất chuyên sâu", icon: "DB", title: "Audio & Dubbing", description: "Voice, nhạc, SFX và subtitle" },
    { id: "prototype", group: "Sản xuất chuyên sâu", icon: "PT", title: "Prototype from Prompt", description: "Flow tương tác chỉnh sửa được" },
    { id: "review", group: "Cộng tác", icon: "RV", title: "Creative Review", description: "Comment, diff và phê duyệt" },
    { id: "collaboration", group: "Cộng tác", icon: "RT", title: "Realtime Collaboration", description: "Presence, chat, lock và timeline diff" },
    { id: "publishing", group: "Xuất bản", icon: "PB", title: "Publishing Calendar", description: "Lịch đa nền tảng và hàng đợi" },
    { id: "analytics", group: "Xuất bản", icon: "AN", title: "Creative Analytics", description: "CTR, retention và A/B test" },
    { id: "rights", group: "Xuất bản", icon: "RC", title: "Rights & Provenance", description: "Nguồn, giấy phép và manifest" },
    { id: "providers", group: "Xuất bản", icon: "PR", title: "Provider Router", description: "Quota, chi phí, độ trễ và cooldown" },
    { id: "marketplace", group: "Mở rộng", icon: "MK", title: "Creative Marketplace", description: "Template, workflow và asset pack" },
    { id: "idea-lab", group: "Ý tưởng & Ngôn từ", icon: "IL", title: "Idea Lab", description: "Mở rộng một vấn đề thành các hướng ý tưởng có tiêu chí" },
    { id: "naming-studio", group: "Ý tưởng & Ngôn từ", icon: "NS", title: "Naming Studio", description: "Tạo, lọc và chấm tên theo quy tắc thương hiệu" },
    { id: "copy-studio", group: "Ý tưởng & Ngôn từ", icon: "CP", title: "Copy Studio", description: "Viết headline, CTA và biến thể nội dung theo kênh" },
    { id: "writing-room", group: "Ý tưởng & Ngôn từ", icon: "WR", title: "Writing Room", description: "Soạn bài dài, dàn ý, chương và kiểm tra cấu trúc" },
    { id: "campaign-planner", group: "Chiến dịch", icon: "CA", title: "Campaign Planner", description: "Lập mục tiêu, kênh, ngân sách và lịch chiến dịch" },
    { id: "photo-planner", group: "Hình ảnh & Chuyển động", icon: "PH", title: "Photo Planner", description: "Shot list, ánh sáng, ống kính và checklist buổi chụp" },
    { id: "motion-planner", group: "Hình ảnh & Chuyển động", icon: "MO", title: "Motion Planner", description: "Scene, cue, keyframe và thời lượng motion graphics" },
    { id: "podcast-studio", group: "Âm thanh & Không gian", icon: "PO", title: "Podcast Studio", description: "Run-of-show, segment, câu hỏi và chapter podcast" },
    { id: "three-d-planner", group: "Hình ảnh & Chuyển động", icon: "3D", title: "3D Scene Planner", description: "Scene graph, camera, ánh sáng và ngân sách asset 3D" },
    { id: "portfolio-builder", group: "Xuất bản", icon: "PF", title: "Portfolio Builder", description: "Biên tập case study và xuất portfolio HTML độc lập" }
  ]);

  const TOOL_CONTRACTS = Object.freeze({
    overview: ["Điều phối danh mục sáng tạo", "Trạng thái và deadline", "Quyết định ưu tiên"],
    project: ["Quản lý hồ sơ dự án", "Brief, asset và phiên bản", "Gói dự án có thể khôi phục"],
    "ai-center": ["Hội thoại hỗ trợ sáng tạo", "Câu hỏi và ngữ cảnh", "Câu trả lời có nguồn/trạng thái thật"],
    "ai-script": ["Viết và biên tập kịch bản", "Chủ đề, đối tượng và độ dài", "Kịch bản có cấu trúc"],
    brief: ["Chốt định hướng trước sản xuất", "Mục tiêu, đối tượng và thông điệp", "Creative brief ra quyết định"],
    moodboard: ["Tổ chức tham chiếu thị giác", "Ảnh, màu, font và ghi chú", "Concept board có nhóm"],
    storyboard: ["Thiết kế chuỗi cảnh", "Shot, thoại, camera và thời lượng", "Storyboard và animatic"],
    "world-bible": ["Giữ nhất quán thế giới", "Nhân vật, địa điểm và quy tắc", "World bible có kiểm tra"],
    "creator-studio": ["Sản xuất gói nội dung", "Chủ đề và nền tảng", "Bộ nội dung theo kênh"],
    "media-center": ["Quản lý thư viện media", "Tệp và metadata", "Bộ sưu tập có thể tìm kiếm"],
    workflow: ["Thiết kế pipeline node", "Bước, phụ thuộc và gate", "Workflow có lịch sử chạy"],
    "ai-director": ["Lập kế hoạch xử lý có duyệt", "Mục tiêu và ràng buộc", "Đề xuất từng bước"],
    "prompt-studio": ["Quản lý prompt đa phương thức", "Prompt, reference và seed", "Biến thể có lineage"],
    "ai-automation": ["Chạy chuỗi tác vụ lặp", "Preset, đầu vào và lịch", "Run log có trạng thái thật"],
    repurpose: ["Chuyển đổi một nội dung", "Transcript hoặc bài nguồn", "Bundle đa định dạng"],
    brand: ["Kiểm tra nhất quán thương hiệu", "Brand kit và nội dung", "Báo cáo cùng bản sửa không phá hủy"],
    "audio-dubbing": ["Dựng voice, nhạc và phụ đề", "Clip, transcript và consent", "Timeline, WAV, SRT và CSV"],
    prototype: ["Dựng luồng tương tác", "Mô tả màn hình", "Prototype JSON/HTML an toàn"],
    review: ["Phản biện một phiên bản", "Snapshot và nhận xét", "Quyết định duyệt có audit"],
    collaboration: ["Phối hợp thời gian thực", "Phòng riêng và thay đổi", "Timeline cộng tác xác thực"],
    publishing: ["Lập lịch phát hành", "Nội dung, kênh và thời điểm", "Hàng đợi có preflight"],
    analytics: ["Phân tích hiệu quả sáng tạo", "Số liệu đã nhập/kết nối", "Báo cáo và thử nghiệm A/B"],
    rights: ["Kiểm tra quyền và nguồn gốc", "Asset, tác giả và giấy phép", "Provenance manifest"],
    providers: ["Theo dõi nhà cung cấp", "Cấu hình backend và quota", "Trạng thái, chi phí và cooldown"],
    marketplace: ["Quản lý gói mở rộng", "Manifest có quyền rõ ràng", "Pack dữ liệu được kiểm duyệt"],
    "idea-lab": ["Khám phá hướng ý tưởng", "Vấn đề, đối tượng và ràng buộc", "Ma trận ý tưởng được chấm"],
    "naming-studio": ["Đặt tên có tiêu chí", "Từ khóa, giọng điệu và từ cấm", "Danh sách tên cùng điểm"],
    "copy-studio": ["Viết microcopy theo kênh", "Thông điệp, kênh và CTA", "Headline và biến thể copy"],
    "writing-room": ["Soạn nội dung dài", "Luận điểm, độc giả và cấu trúc", "Dàn ý và bản thảo Markdown"],
    "campaign-planner": ["Lập kế hoạch chiến dịch", "Mục tiêu, kênh, ngân sách", "Timeline và phân bổ nguồn lực"],
    "photo-planner": ["Chuẩn bị buổi chụp", "Bối cảnh, ánh sáng và mục đích", "Shot list và checklist"],
    "motion-planner": ["Thiết kế motion trước dựng", "Scene, cue và nhịp", "Timeline keyframe có thể xuất"],
    "podcast-studio": ["Biên tập cấu trúc podcast", "Chủ đề, khách mời và thời lượng", "Run-of-show và chapter"],
    "three-d-planner": ["Lập scene 3D", "Đối tượng, camera và ánh sáng", "Scene graph cùng budget"],
    "portfolio-builder": ["Đóng gói case study", "Vai trò, quy trình và kết quả", "Portfolio HTML/Markdown" ]
  });

  const ENGINES = Object.freeze({
    overview: { api: "HHCreativeCommandCenter", js: "creative-command-center.js?v=2", css: "creative-command-center.css?v=2" },
    project: { api: "HHCreativeCommandCenter", js: "creative-command-center.js?v=2", css: "creative-command-center.css?v=2" },
    "ai-center": { api: "HHCreativeLegacyTools" },
    "ai-script": { api: "HHCreativeLegacyTools" },
    brief: { api: "HHCreativePreproduction", js: "creative-preproduction.js?v=1", css: "creative-preproduction.css?v=1" },
    moodboard: { api: "HHCreativePreproduction", js: "creative-preproduction.js?v=1", css: "creative-preproduction.css?v=1" },
    storyboard: { api: "HHCreativePreproduction", js: "creative-preproduction.js?v=1", css: "creative-preproduction.css?v=1" },
    "world-bible": { api: "HHCreativePreproduction", js: "creative-preproduction.js?v=1", css: "creative-preproduction.css?v=1" },
    "creator-studio": { api: "HHCreativeLegacyTools" },
    "media-center": { api: "HHCreativeLegacyTools" },
    workflow: { api: "HHCreativeAIWorkflow", js: "creative-ai-workflow.js?v=3", css: "creative-ai-workflow.css?v=3" },
    "ai-director": { api: "HHCreativeAIWorkflow", js: "creative-ai-workflow.js?v=3", css: "creative-ai-workflow.css?v=3" },
    "prompt-studio": { api: "HHCreativeAIWorkflow", js: "creative-ai-workflow.js?v=3", css: "creative-ai-workflow.css?v=3" },
    "ai-automation": { api: "HHCreativeLegacyTools" },
    repurpose: { api: "HHCreativeProductionLab", js: "creative-production-lab.js?v=1", css: "creative-production-lab.css?v=1" },
    brand: { api: "HHCreativeProductionLab", js: "creative-production-lab.js?v=1", css: "creative-production-lab.css?v=1" },
    "audio-dubbing": { api: "HHCreativeProductionLab", js: "creative-production-lab.js?v=1", css: "creative-production-lab.css?v=1" },
    prototype: { api: "HHCreativeProductionLab", js: "creative-production-lab.js?v=1", css: "creative-production-lab.css?v=1" },
    review: { api: "HHCreativeCollaborationOS", js: "creative-collaboration-os.js?v=2", css: "creative-collaboration-os.css?v=1" },
    collaboration: { api: "HHCreativeCollaborationOS", js: "creative-collaboration-os.js?v=2", css: "creative-collaboration-os.css?v=1" },
    publishing: { api: "HHCreativePublishing", js: "creative-publishing.js?v=1", css: "creative-publishing.css?v=1" },
    analytics: { api: "HHCreativePublishing", js: "creative-publishing.js?v=1", css: "creative-publishing.css?v=1" },
    rights: { api: "HHCreativePublishing", js: "creative-publishing.js?v=1", css: "creative-publishing.css?v=1" },
    providers: { api: "HHCreativePublishing", js: "creative-publishing.js?v=1", css: "creative-publishing.css?v=1" },
    marketplace: { api: "HHCreativeMarketplace", js: "creative-marketplace.js?v=1", css: "creative-marketplace.css?v=1" },
    "idea-lab": { api: "HHCreativeSpecialistStudios", js: "creative-specialist-studios.js?v=2", css: "creative-specialist-studios.css?v=2" },
    "naming-studio": { api: "HHCreativeSpecialistStudios", js: "creative-specialist-studios.js?v=2", css: "creative-specialist-studios.css?v=2" },
    "copy-studio": { api: "HHCreativeSpecialistStudios", js: "creative-specialist-studios.js?v=2", css: "creative-specialist-studios.css?v=2" },
    "writing-room": { api: "HHCreativeSpecialistStudios", js: "creative-specialist-studios.js?v=2", css: "creative-specialist-studios.css?v=2" },
    "campaign-planner": { api: "HHCreativeSpecialistStudios", js: "creative-specialist-studios.js?v=2", css: "creative-specialist-studios.css?v=2" },
    "photo-planner": { api: "HHCreativeSpecialistStudios", js: "creative-specialist-studios.js?v=2", css: "creative-specialist-studios.css?v=2" },
    "motion-planner": { api: "HHCreativeSpecialistStudios", js: "creative-specialist-studios.js?v=2", css: "creative-specialist-studios.css?v=2" },
    "podcast-studio": { api: "HHCreativeSpecialistStudios", js: "creative-specialist-studios.js?v=2", css: "creative-specialist-studios.css?v=2" },
    "three-d-planner": { api: "HHCreativeSpecialistStudios", js: "creative-specialist-studios.js?v=2", css: "creative-specialist-studios.css?v=2" },
    "portfolio-builder": { api: "HHCreativeSpecialistStudios", js: "creative-specialist-studios.js?v=2", css: "creative-specialist-studios.css?v=2" }
  });
  const GROUP_ACCENTS = Object.freeze({
    "Điều hành": ["#65e8f4", "#6f8cff"],
    "AI & Kịch bản": ["#9a78ff", "#ff65c7"],
    "Tiền kỳ": ["#ff76b8", "#ffbd69"],
    "Sản xuất nội dung": ["#5be7c4", "#5f9dff"],
    "AI & Workflow": ["#7d76ff", "#65e8f4"],
    "Sản xuất chuyên sâu": ["#ff8b68", "#ffd969"],
    "Ý tưởng & Ngôn từ": ["#ff72c8", "#9f7cff"],
    "Chiến dịch": ["#ffd166", "#ff7b72"],
    "Hình ảnh & Chuyển động": ["#64e6ff", "#8c75ff"],
    "Âm thanh & Không gian": ["#70e5bd", "#5f9dff"],
    "Cộng tác": ["#55dfaf", "#67b8ff"],
    "Xuất bản": ["#ff69be", "#8c76ff"],
    "Mở rộng": ["#ffe06b", "#ff7e78"]
  });
  const GROUP_JOURNEYS = Object.freeze({
    "Điều hành": ["Chọn dự án", "Cập nhật", "Kiểm tra", "Lưu phiên bản"],
    "AI & Kịch bản": ["Nhập yêu cầu", "Tạo nội dung", "Tinh chỉnh", "Lưu kết quả"],
    "Tiền kỳ": ["Nhập chiến lược", "Tạo cấu trúc", "Duyệt nội dung", "Lưu dự án"],
    "Sản xuất nội dung": ["Chọn nguồn", "Sản xuất", "Xem trước", "Đưa vào dự án"],
    "AI & Workflow": ["Thiết lập", "Chạy pipeline", "Kiểm tra", "Phê duyệt"],
    "Sản xuất chuyên sâu": ["Chọn đầu vào", "Xử lý", "So sánh", "Xuất kết quả"],
    "Ý tưởng & Ngôn từ": ["Đặt ràng buộc", "Phát triển", "Đánh giá", "Xuất bản nháp"],
    "Chiến dịch": ["Đặt mục tiêu", "Phân bổ", "Lập lịch", "Xuất kế hoạch"],
    "Hình ảnh & Chuyển động": ["Khai báo cảnh", "Thiết kế", "Kiểm tra", "Xuất đặc tả"],
    "Âm thanh & Không gian": ["Đặt cấu trúc", "Biên tập", "Kiểm tra", "Xuất run-of-show"],
    "Cộng tác": ["Chọn nội dung", "Góp ý", "Duyệt thay đổi", "Chốt phiên bản"],
    "Xuất bản": ["Chuẩn bị", "Kiểm tra quyền", "Xếp lịch", "Theo dõi"],
    "Mở rộng": ["Chọn gói", "Xem quyền", "Cài đặt", "Quản lý"]
  });
  const GROUP_GLYPHS = Object.freeze({
    "Điều hành": ["⌁", "◇", "↗", "◎"],
    "AI & Kịch bản": ["AI", "✦", "⌘", "◈"],
    "Tiền kỳ": ["◒", "✎", "△", "✦"],
    "Sản xuất nội dung": ["▶", "◉", "♫", "✺"],
    "AI & Workflow": ["⌘", "∞", "⇄", "✓"],
    "Sản xuất chuyên sâu": ["◈", "✺", "⌁", "↯"],
    "Ý tưởng & Ngôn từ": ["✎", "◇", "Aa", "✦"],
    "Chiến dịch": ["◎", "↗", "%", "✓"],
    "Hình ảnh & Chuyển động": ["◫", "◉", "3D", "↯"],
    "Âm thanh & Không gian": ["♫", "◌", "≋", "●"],
    "Cộng tác": ["◌", "◎", "⇄", "✓"],
    "Xuất bản": ["↗", "◫", "✓", "◉"],
    "Mở rộng": ["✦", "◇", "+", "◎"]
  });

  const loads = new Map();
  // Keep one in-flight store creation per tool.  Route transitions can be
  // triggered by both the router and the workspace itself; without this
  // guard two concurrent calls could each create a different store before
  // either one is placed in `toolStores`, causing lost writes/subscriptions.
  const storeLoads = new Map();
  let activeRoot = null;
  let activeApi = null;
  let activeEngineRoot = null;
  let activeEngineHandle = null;
  let activeStore = null;
  const toolStores = new Map();
  let activeView = "overview";
  let activeOptions = {};
  let unsubscribe = null;
  let rootAbort = null;
  let mountToken = 0;
  let pageMain = null;
  let pageWorkspace = null;
  let noticeTimer = 0;
  let viewMotionTimer = 0;
  let guideTimer = 0;

  const escapeHTML = (value) => String(value ?? "").replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[char]));
  const normalizeView = (view) => VIEWS.some((item) => item.id === view) ? view : "overview";
  const viewMeta = (view) => VIEWS.find((item) => item.id === normalizeView(view)) || VIEWS[0];
  const viewContract = (view) => {
    const id = normalizeView(view);
    const values = TOOL_CONTRACTS[id] || [viewMeta(id).description, "Dữ liệu của công cụ", "Kết quả độc lập"];
    return { role: values[0], input: values[1], output: values[2], storageKey: toolStorageKey(id) };
  };

  function capabilityAudit() {
    return VIEWS.map((view) => {
      const engine = ENGINES[view.id];
      const loaded = Boolean(engine && window[engine.api]?.mount);
      const declared = Boolean(engine?.api && (engine.js || engine.api === "HHCreativeLegacyTools"));
      return { id: view.id, title: view.title, group: view.group, api: engine?.api || "", loaded, declared, state: loaded ? "ready" : declared ? "lazy" : "missing" };
    });
  }

  function loadScript(source) {
    if (loads.has(source)) return loads.get(source);
    const promise = new Promise((resolve, reject) => {
      const existing = [...document.scripts].find((node) => node.src.includes(source.split("?")[0]));
      if (existing) {
        if (existing.dataset.loaded === "true" || existing.dataset.hhRuntimeAsset === "script" || ["complete", "loaded"].includes(existing.readyState)) resolve();
        else {
          existing.addEventListener("load", resolve, { once: true });
          existing.addEventListener("error", () => reject(new Error(`Không tải được ${source}`)), { once: true });
        }
        return;
      }
      const script = document.createElement("script");
      script.src = source;
      script.async = true;
      script.addEventListener("load", () => { script.dataset.loaded = "true"; resolve(); }, { once: true });
      script.addEventListener("error", () => reject(new Error(`Không tải được ${source}`)), { once: true });
      document.head.append(script);
    }).catch((error) => { loads.delete(source); throw error; });
    loads.set(source, promise);
    return promise;
  }

  function loadStyle(source) {
    const key = `css:${source}`;
    if (loads.has(key)) return loads.get(key);
    const promise = new Promise((resolve, reject) => {
      if ([...document.styleSheets].some((sheet) => sheet.href?.includes(source.split("?")[0]))) { resolve(); return; }
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = source;
      link.addEventListener("load", resolve, { once: true });
      link.addEventListener("error", () => reject(new Error(`Không tải được ${source}`)), { once: true });
      document.head.append(link);
    }).catch((error) => { loads.delete(key); throw error; });
    loads.set(key, promise);
    return promise;
  }

  function toolStorageKey(view) {
    return `hh.creative.tool.${normalizeView(view)}.project.v1`;
  }

  function scopedStorage(view) {
    const prefix = `hh.creative.tool.${normalizeView(view)}.state`;
    const storage = window.localStorage;
    return {
      getItem(key) { return storage?.getItem?.(`${prefix}:${String(key || "default")}`) ?? null; },
      setItem(key, value) { storage?.setItem?.(`${prefix}:${String(key || "default")}`, String(value)); },
      removeItem(key) { storage?.removeItem?.(`${prefix}:${String(key || "default")}`); }
    };
  }

  async function ensureStore(view = activeView) {
    const id = normalizeView(view);
    if (toolStores.has(id)) return toolStores.get(id);
    if (storeLoads.has(id)) {
      return storeLoads.get(id);
    }
    const pending = (async () => {
      await loadScript("creative-os-core.js?v=4");
      if (!window.HHCreativeCore?.createStore) throw new Error("Creative project store chưa sẵn sàng.");
      const store = window.HHCreativeCore.createStore({ storageKey: toolStorageKey(id) });
      if (!store.getState?.().projects?.length) {
        const meta = viewMeta(id);
        store.createProject?.({ name: `${meta.title} · Workspace`, brief: { description: meta.description } });
      }
      toolStores.set(id, store);
      return store;
    })();
    storeLoads.set(id, pending);
    try {
      return await pending;
    } finally {
      storeLoads.delete(id);
    }
  }

  function routeView(routeOrView) {
    const value = String(routeOrView || "overview").replace(/^#/, "");
    if (!value.includes("/")) return normalizeView(value);
    const parts = value.split("/").filter(Boolean);
    return normalizeView(parts[0] === "create" ? (parts[1] || "overview") : value);
  }

  function isPrepared(routeOrView) {
    const engine = ENGINES[routeView(routeOrView)];
    return Boolean(engine && window[engine.api]?.mount);
  }

  async function prepareRoute(routeOrView, settings = {}) {
    const view = routeView(routeOrView);
    const engine = ENGINES[view];
    if (!engine) throw new Error("Không tìm thấy workspace sáng tạo.");
    if (engine.api === "HHCreativeLegacyTools" && !window.HHCreativeLegacyTools?.mount) {
      window.dispatchEvent?.(new CustomEvent("hh:workspace-open"));
    }
    // Hover/focus warm-up may load code and styles without creating or
    // persisting a blank project. A real mount still requests the store.
    const work = [settings.createStore === false ? Promise.resolve(null) : ensureStore(view)];
    if (engine.css) work.push(loadStyle(engine.css));
    if (!window[engine.api]?.mount && engine.js) work.push(loadScript(engine.js));
    const [store] = await Promise.all(work);
    if (!window[engine.api]?.mount) throw new Error(`${engine.api} chưa sẵn sàng.`);
    return { view, ready: true, store };
  }

  function stateMetrics(state) {
    const projects = Array.isArray(state?.projects) ? state.projects : [];
    const active = projects.find((item) => item.id === state?.activeProjectId) || projects[0];
    const runs = Array.isArray(state?.runs) ? state.runs : [];
    const assets = projects.reduce((total, project) => total + (Array.isArray(project.assets) ? project.assets.length : 0), 0);
    const queued = projects.reduce((total, project) => total + (Array.isArray(project.publishing) ? project.publishing.filter((item) => ["draft", "scheduled", "queued"].includes(item.status)).length : 0), 0);
    const progress = Number(active?.analytics?.progress) || 0;
    return { projectCount: projects.length, active, runs: runs.length, assets, queued, progress: Math.max(0, Math.min(100, progress)) };
  }

  function renderContext() {
    if (!activeRoot || !activeStore) return;
    const state = activeStore.getState();
    const metrics = stateMetrics(state);
    const audit = capabilityAudit();
    const values = {
      "[data-cos-active-project]": metrics.active?.name || "Chưa có dự án",
      "[data-cos-progress]": `${metrics.progress}%`,
      "[data-cos-project-count]": String(metrics.projectCount),
      "[data-cos-run-count]": String(metrics.runs),
      "[data-cos-asset-count]": String(metrics.assets),
      "[data-cos-queue-count]": String(metrics.queued),
      "[data-cos-engine-count]": `${audit.filter((item) => item.declared).length}/${VIEWS.length}`,
      "[data-cos-sync-time]": state.updatedAt ? `Đã lưu ${new Date(state.updatedAt).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}` : "Đã lưu local"
    };
    Object.entries(values).forEach(([selector, value]) => activeRoot.querySelectorAll(selector).forEach((node) => { node.textContent = value; }));
    const readiness = activeRoot.querySelector("[data-cos-readiness-list]");
    if (readiness) readiness.innerHTML = audit.map((item) => `<article data-state="${item.state}"><i>${escapeHTML(item.id === activeView ? "●" : item.loaded ? "✓" : "◇")}</i><span><strong>${escapeHTML(item.title)}</strong><small>${escapeHTML(item.api.replace(/^HHCreative/, ""))}</small></span><b>${item.id === activeView ? "Đang mở" : item.loaded ? "Sẵn sàng" : item.declared ? "Lazy" : "Thiếu"}</b></article>`).join("");
  }

  function showNotice(message, tone = "info") {
    const toast = activeRoot?.querySelector("[data-cos-toast]");
    if (!toast) return;
    window.clearTimeout(noticeTimer);
    toast.dataset.tone = tone;
    toast.textContent = String(message || "");
    toast.hidden = false;
    void toast.offsetWidth;
    toast.classList.add("is-visible");
    noticeTimer = window.setTimeout(() => {
      toast.classList.remove("is-visible");
      window.setTimeout(() => { if (toast.isConnected) toast.hidden = true; }, 220);
    }, 3200);
  }

  function currentProject() {
    const state = activeStore?.getState?.();
    return state?.projects?.find((item) => item.id === state.activeProjectId) || state?.projects?.[0] || null;
  }

  function journeyMarkup(group) {
    const steps = GROUP_JOURNEYS[group] || GROUP_JOURNEYS["Điều hành"];
    return steps.map((label, index) => `<button type="button" data-cos-guide-step="${index}" class="${index === 0 ? "is-active" : ""}"><i>${String(index + 1).padStart(2, "0")}</i><span>${escapeHTML(label)}</span></button>`).join("");
  }

  function glyphMarkup(group) {
    const glyphs = GROUP_GLYPHS[group] || GROUP_GLYPHS["Điều hành"];
    return glyphs.map((glyph) => `<i>${escapeHTML(glyph)}</i>`).join("");
  }

  function shellMarkup(view) {
    const current = viewMeta(view);
    const contract = viewContract(view);
    return `<section class="creative-os" data-creative-os data-view="${escapeHTML(current.id)}">
      <div class="creative-os__cosmos" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><span></span><span></span><span></span><b></b><em></em></div>
      <div class="creative-os__glyphs" data-cos-glyphs aria-hidden="true">${glyphMarkup(current.group)}</div>
      <header class="creative-os__topbar">
        <div class="creative-os__brand"><i><b>HH</b><span></span></i><span><small>CREATIVE SPECIALIST WORKSPACE</small><strong data-cos-active-project>Đang tải dữ liệu...</strong><em data-cos-sync-time>Đã lưu độc lập</em></span></div>
        <div class="creative-os__summary" aria-label="Dữ liệu độc lập của công cụ">
          <span><small>Hoàn thiện</small><b data-cos-progress>0%</b></span>
          <span><small>Hồ sơ</small><b data-cos-project-count>0</b></span>
          <span><small>Tệp</small><b data-cos-asset-count>0</b></span>
          <span><small>Lịch sử</small><b data-cos-run-count>0</b></span>
          <span><small>Đầu ra</small><b data-cos-queue-count>0</b></span>
        </div>
        <div class="creative-os__top-actions"><button type="button" data-cos-readiness title="Kiểm tra ${VIEWS.length} công cụ"><i data-cos-engine-count>${VIEWS.length}/${VIEWS.length}</i> Công cụ</button><button type="button" data-cos-import-project title="Nhập dữ liệu riêng của công cụ (Ctrl+O)">Nhập</button><button type="button" data-cos-snapshot title="Lưu phiên bản hiện tại (Ctrl+S)">Phiên bản</button><button type="button" data-cos-new-project title="Tạo hồ sơ mới cho công cụ (Ctrl+N)">+ Hồ sơ</button><button type="button" class="creative-os__action-toggle" data-cos-action-menu aria-expanded="false">✦ Tác vụ</button><button type="button" data-cos-command title="Tìm lệnh toàn hệ thống">Ctrl K</button><input type="file" hidden accept="application/json,.json,.hhcreative.json" data-cos-import-input></div>
        <aside class="creative-os__action-panel" data-cos-action-panel hidden><header><strong>Thao tác nhanh</strong><button type="button" data-cos-close-actions aria-label="Đóng">×</button></header><button type="button" data-cos-menu-readiness><i>${VIEWS.length}</i><span><b>Trạng thái công cụ</b><small>Kiểm tra toàn bộ workspace</small></span></button><button type="button" data-cos-menu-import><i>⇧</i><span><b>Nhập dữ liệu</b><small>Chỉ nhập vào công cụ đang mở</small></span></button><button type="button" data-cos-menu-snapshot><i>◇</i><span><b>Tạo phiên bản</b><small>Lưu trạng thái có thể khôi phục</small></span></button><button type="button" data-cos-menu-export><i>⇩</i><span><b>Xuất dữ liệu</b><small>Tải dữ liệu riêng của công cụ</small></span></button></aside>
        <aside class="creative-os__readiness" data-cos-readiness-panel hidden><header><div><small>TOOL CONTRACT</small><strong>${VIEWS.length} công cụ có nhiệm vụ riêng</strong></div><button type="button" data-cos-close-readiness aria-label="Đóng">×</button></header><p>Mỗi công cụ chỉ tải khi được mở, có vùng lưu và lịch sử riêng. “Lazy” nghĩa là đã khai báo và sẵn sàng tải, không phải chức năng giả.</p><div data-cos-readiness-list></div></aside>
      </header>
      <div class="creative-os__body">
        <section class="creative-os__stage">
          <header class="creative-os__stage-head"><div><small data-cos-group-label>${escapeHTML(current.group)}</small><h2 data-cos-title>${escapeHTML(current.title)}</h2><p data-cos-description>${escapeHTML(current.description)}</p></div><div><span data-cos-engine-status><i></i>Công cụ độc lập</span><button type="button" data-cos-export-project>Xuất dữ liệu</button></div></header>
          <section class="creative-os__role-strip" data-cos-tool-contract>
            <div><small>VAI TRÒ DUY NHẤT</small><strong data-cos-role>${escapeHTML(contract.role)}</strong><p>Màn hình này không tự chuyển hoặc ghi dữ liệu sang công cụ khác.</p></div>
            <dl><div><dt>Đầu vào</dt><dd data-cos-input>${escapeHTML(contract.input)}</dd></div><div><dt>Đầu ra</dt><dd data-cos-output>${escapeHTML(contract.output)}</dd></div><div><dt>Vùng lưu</dt><dd data-cos-storage>${escapeHTML(contract.storageKey)}</dd></div></dl>
          </section>
          <nav class="creative-os__journey" data-cos-journey aria-label="Luồng thao tác nhanh">${journeyMarkup(current.group)}<em><i></i>Chạm từng bước để tìm đúng thao tác</em></nav>
          <main class="creative-os__workspace" data-cos-workspace aria-live="polite"><section class="creative-os__loader" role="status"><i></i><strong>Đang mở ${escapeHTML(current.title)}...</strong><span>Chỉ tải engine đang sử dụng để giữ giao diện mượt.</span></section></main>
        </section>
      </div>
      <div class="creative-os__toast" data-cos-toast hidden role="status" aria-live="polite"></div>
    </section>`;
  }

  function teardownEngine() {
    try { activeEngineHandle?.unmount?.(); } catch {}
    try { activeApi?.unmount?.(activeEngineRoot); } catch {}
    activeApi = null;
    activeEngineRoot = null;
    activeEngineHandle = null;
  }

  function notifyWorkspace(view, eventName = "hh:creative-workspace-ready", extra = {}) {
    if (typeof window.dispatchEvent !== "function" || typeof window.CustomEvent !== "function") return;
    window.dispatchEvent(new window.CustomEvent(eventName, { detail: { view, route: view === "overview" ? "/create" : `/create/${view}`, ...extra } }));
  }

  async function mountEngine(view, options, token) {
    const host = activeRoot?.querySelector("[data-cos-workspace]");
    const engine = ENGINES[view];
    if (!host || !engine) return;
    host.classList?.remove?.("is-ready");
    host.innerHTML = `<section class="creative-os__loader" role="status"><i></i><strong>Đang mở ${escapeHTML(viewMeta(view).title)}...</strong><span>Đang chuẩn bị đúng công cụ bạn chọn.</span></section>`;
    try {
      // prepareRoute owns the store-loading promise.  Awaiting it first
      // prevents a second store from being created during a fast route swap.
      const preparation = await prepareRoute(view);
      const store = preparation.store || await ensureStore(view);
      if (token !== mountToken || !activeRoot) return;
      const api = window[engine.api];
      if (!api?.mount) throw new Error(`${engine.api} chưa cung cấp mount().`);
      const storeState = store.getState?.() || {};
      const projectId = storeState.activeProjectId || storeState.projects?.[0]?.id || "";
      teardownEngine();
      host.replaceChildren();
      activeApi = api;
      activeEngineRoot = host;
      const handle = await Promise.resolve(api.mount(host, {
        view,
        store,
        projectId: projectId,
        activeProjectId: projectId,
        standalone: true,
        storage: scopedStorage(view),
        storageKey: viewContract(view).storageKey,
        toolContract: viewContract(view),
        apiBase: options.apiBase || "",
        socketUrl: options.socketUrl || "",
        currentUser: options.currentUser || null,
        providerAdapters: options.providerAdapters || {},
        runAI: options.runAI,
        onNavigate: (target, payload) => {
          const targetView = routeView(target);
          if (VIEWS.some((item) => item.id === targetView) && targetView !== view) {
            showNotice(`“${viewMeta(targetView).title}” là công cụ độc lập. Hãy mở từ thanh Sáng tạo để tránh ghi nhầm dữ liệu.`, "info");
            return false;
          }
          if (typeof options.onNavigate === "function") options.onNavigate(target.startsWith("/") ? target : `/${target}`, payload);
          return true;
        },
        onInstall: (pack) => {
          const state = store.getState?.();
          const selectedProjectId = state?.activeProjectId || state?.projects?.[0]?.id;
          if (!selectedProjectId) throw new Error("Hãy tạo một hồ sơ trong công cụ này trước khi cài creative pack.");
          const asset = pack?.asset || { type: "marketplace", name: pack?.name || "Creative pack", metadata: pack };
          return store.addAsset?.(selectedProjectId, asset);
        }
      }));
      if (token !== mountToken || !activeRoot) { try { handle?.unmount?.(); } catch {} return; }
      activeEngineHandle = handle || null;
      host.classList?.add?.("is-ready");
      syncActiveView(view);
      notifyWorkspace(view);
    } catch (error) {
      if (token !== mountToken || !host) return;
      host.innerHTML = `<section class="creative-os__error"><strong>Không thể mở workspace</strong><p>${escapeHTML(error.message || error)}</p><button type="button" data-cos-retry>Thử lại</button></section>`;
      notifyWorkspace(view, "hh:creative-workspace-error", { message: error.message || String(error) });
    }
  }

  function syncActiveView(view) {
    const current = viewMeta(view);
    const contract = viewContract(view);
    if (!activeRoot) return;
    const shell = activeRoot.querySelector("[data-creative-os]") || activeRoot;
    const colors = GROUP_ACCENTS[current.group] || GROUP_ACCENTS["Điều hành"];
    shell.dataset.view = current.id;
    shell.style?.setProperty?.("--cos-view", colors[0]);
    shell.style?.setProperty?.("--cos-view-2", colors[1]);
    const text = {
      "[data-cos-group-label]": current.group,
      "[data-cos-title]": current.title,
      "[data-cos-description]": current.description,
      "[data-cos-role]": contract.role,
      "[data-cos-input]": contract.input,
      "[data-cos-output]": contract.output,
      "[data-cos-storage]": contract.storageKey
    };
    Object.entries(text).forEach(([selector, value]) => { const node = activeRoot.querySelector(selector); if (node) node.textContent = value; });
    const journey = activeRoot.querySelector("[data-cos-journey]");
    if (journey) journey.innerHTML = `${journeyMarkup(current.group)}<em><i></i>Chạm từng bước để tìm đúng thao tác</em>`;
    const glyphs = activeRoot.querySelector("[data-cos-glyphs]");
    if (glyphs) glyphs.innerHTML = glyphMarkup(current.group);
    const status = activeRoot.querySelector("[data-cos-engine-status]");
    if (status) status.innerHTML = `<i></i>${window[ENGINES[current.id]?.api]?.mount ? "Engine đang hoạt động" : "Engine sẵn sàng tải"}`;
    renderContext();
  }

  function activateView(nextView, options = activeOptions, userInitiated = false) {
    const view = normalizeView(nextView);
    activeView = view;
    activeStore = toolStores.get(view) || null;
    syncActiveView(view);
    const shell = activeRoot?.querySelector("[data-creative-os]") || activeRoot;
    window.clearTimeout(viewMotionTimer);
    shell?.classList?.remove?.("is-view-entering");
    if (shell) void shell.offsetWidth;
    shell?.classList?.add?.("is-view-entering");
    viewMotionTimer = window.setTimeout(() => shell?.classList?.remove?.("is-view-entering"), 820);
    if (userInitiated) options.onViewChange?.(view);
    const token = ++mountToken;
    return mountEngine(view, options, token);
  }

  function exportProject() {
    const project = currentProject();
    if (!project) { showNotice("Hãy tạo dự án trước khi xuất.", "warning"); return; }
    const payload = activeStore.exportProject?.(project.id) || JSON.stringify(project, null, 2);
    const url = URL.createObjectURL(new Blob([payload], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `${String(project.name || "creative-project").replace(/[^a-z0-9_-]+/gi, "-")}.hhcreative.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    showNotice("Đã xuất project kèm toàn bộ dữ liệu và phiên bản.", "success");
  }

  async function importProject(file, options) {
    if (!file) return;
    if (file.size > 1_500_000) throw new Error("Tệp dự án vượt quá 1,5 MB.");
    const text = await file.text();
    const project = activeStore?.importProject?.(text);
    if (!project) throw new Error("Không thể nhập dự án này.");
    renderContext();
    await activateView(activeView, options, false);
    showNotice(`Đã nhập “${project.name || "Hồ sơ sáng tạo"}” vào ${viewMeta(activeView).title}.`, "success");
  }

  function snapshotProject() {
    const project = currentProject();
    if (!project) { showNotice("Hãy tạo dự án trước khi chụp phiên bản.", "warning"); return; }
    const version = activeStore?.snapshotProject?.(
      project.id,
      `Snapshot ${new Date().toLocaleString("vi-VN")}`,
      `Tạo từ workspace ${viewMeta(activeView).title}`
    );
    if (!version) throw new Error("Không thể tạo snapshot.");
    showNotice("Đã lưu snapshot để có thể khôi phục sau này.", "success");
  }

  function guideWorkspace(step) {
    const index = Math.max(0, Math.min(3, Number(step) || 0));
    const workspace = activeRoot?.querySelector("[data-cos-workspace]");
    if (!workspace) return;
    activeRoot.querySelectorAll("[data-cos-guide-step]").forEach((node) => node.classList.toggle("is-active", Number(node.dataset.cosGuideStep) === index));
    activeRoot.querySelectorAll(".is-guide-focus").forEach((node) => node.classList.remove("is-guide-focus"));
    const selectors = [
      "input:not([type='hidden']):not([disabled]), textarea:not([disabled]), select:not([disabled])",
      "[data-action*='generate'], [data-action*='create'], [data-action*='run'], [data-action*='start'], button[type='submit'], .primary",
      "[data-output], [data-result], [data-preview], [data-report], .result, .preview, .report, [aria-live='polite']",
      ""
    ];
    let target = null;
    if (index === 3) {
      const candidates = [...activeRoot.querySelectorAll("[data-cos-snapshot], [data-cos-menu-snapshot]")];
      target = candidates.find((node) => node.offsetParent !== null) || candidates.find((node) => node.matches?.("[data-cos-menu-snapshot]")) || candidates[0] || null;
      if (target?.matches?.("[data-cos-menu-snapshot]")) {
        const panel = activeRoot.querySelector("[data-cos-action-panel]");
        if (panel) panel.hidden = false;
        activeRoot.querySelector("[data-cos-action-menu]")?.setAttribute?.("aria-expanded", "true");
      }
    } else {
      target = [...workspace.querySelectorAll(selectors[index])].find((node) => node.offsetParent !== null) || null;
    }
    if (!target) {
      const messages = ["Workspace này chưa cần dữ liệu đầu vào.", "Hãy chọn hành động chính trong workspace.", "Kết quả sẽ xuất hiện sau khi bạn chạy chức năng.", "Hãy tạo dự án trước khi lưu phiên bản."];
      showNotice(messages[index], "info");
      return;
    }
    target.classList.add("is-guide-focus");
    target.scrollIntoView?.({ behavior: "smooth", block: "center", inline: "nearest" });
    target.focus?.({ preventScroll: true });
    window.clearTimeout(guideTimer);
    guideTimer = window.setTimeout(() => target?.classList?.remove?.("is-guide-focus"), 2600);
    showNotice(["Đã đưa bạn tới phần nhập dữ liệu.", "Đây là hành động chính của công cụ.", "Đây là vùng xem trước hoặc kết quả.", "Snapshot lưu trạng thái hiện tại để khôi phục sau."][index], "success");
  }

  function bind(root, options) {
    rootAbort?.abort();
    rootAbort = new AbortController();
    const signal = rootAbort.signal;
    root.addEventListener("click", (event) => {
      const shell = root.querySelector("[data-creative-os]");
      const readiness = root.querySelector("[data-cos-readiness-panel]");
      const actionPanel = root.querySelector("[data-cos-action-panel]");
      const actionToggle = root.querySelector("[data-cos-action-menu]");
      if (event.target.closest("[data-cos-command]")) { document.dispatchEvent(new CustomEvent("hh:command-open")); document.querySelector("[data-command-open]")?.click(); return; }
      if (event.target.closest("[data-cos-action-menu]")) {
        if (actionPanel) actionPanel.hidden = !actionPanel.hidden;
        actionToggle?.setAttribute?.("aria-expanded", String(Boolean(actionPanel && !actionPanel.hidden)));
        return;
      }
      if (event.target.closest("[data-cos-close-actions]")) { if (actionPanel) actionPanel.hidden = true; actionToggle?.setAttribute?.("aria-expanded", "false"); return; }
      if (event.target.closest("[data-cos-readiness]")) {
        if (readiness) readiness.hidden = !readiness.hidden;
        return;
      }
      if (event.target.closest("[data-cos-menu-readiness]")) { if (readiness) readiness.hidden = false; if (actionPanel) actionPanel.hidden = true; return; }
      if (event.target.closest("[data-cos-close-readiness]")) { if (readiness) readiness.hidden = true; return; }
      if (event.target.closest("[data-cos-import-project]")) { root.querySelector("[data-cos-import-input]")?.click(); return; }
      if (event.target.closest("[data-cos-menu-import]")) { if (actionPanel) actionPanel.hidden = true; root.querySelector("[data-cos-import-input]")?.click(); return; }
      if (event.target.closest("[data-cos-snapshot]")) {
        try { snapshotProject(); } catch (error) { showNotice(error.message || error, "error"); }
        return;
      }
      if (event.target.closest("[data-cos-menu-snapshot]")) { if (actionPanel) actionPanel.hidden = true; try { snapshotProject(); } catch (error) { showNotice(error.message || error, "error"); } return; }
      if (event.target.closest("[data-cos-new-project]")) {
        try {
          const project = activeStore?.createProject?.({ name: `${viewMeta(activeView).title} · ${new Date().toLocaleDateString("vi-VN")}` });
          if (project) { showNotice(`Đã tạo hồ sơ mới cho ${viewMeta(activeView).title}.`, "success"); activateView(activeView, options, false); }
        } catch (error) { showNotice(error.message || error, "error"); }
        return;
      }
      if (event.target.closest("[data-cos-export-project]")) { exportProject(); return; }
      if (event.target.closest("[data-cos-menu-export]")) { if (actionPanel) actionPanel.hidden = true; exportProject(); return; }
      const guide = event.target.closest("[data-cos-guide-step]");
      if (guide) { guideWorkspace(guide.dataset.cosGuideStep); return; }
      if (event.target.closest("[data-cos-retry]")) activateView(activeView, options, false);
      if (readiness && !readiness.hidden && !event.target.closest("[data-cos-readiness-panel]")) readiness.hidden = true;
      if (actionPanel && !actionPanel.hidden && !event.target.closest("[data-cos-action-panel]")) { actionPanel.hidden = true; actionToggle?.setAttribute?.("aria-expanded", "false"); }
      if (shell) shell.classList.remove("is-nav-open");
    }, { signal });
    root.addEventListener("keydown", (event) => {
      if (!(event.ctrlKey || event.metaKey) || event.altKey) return;
      const key = String(event.key || "").toLowerCase();
      if (!['s', 'o', 'n'].includes(key)) return;
      event.preventDefault();
      if (key === 's') { try { snapshotProject(); } catch (error) { showNotice(error.message || error, "error"); } }
      if (key === 'o') root.querySelector("[data-cos-import-input]")?.click();
      if (key === 'n') root.querySelector("[data-cos-new-project]")?.click();
    }, { signal });
    root.querySelector("[data-cos-import-input]")?.addEventListener("change", async (event) => {
      const input = event.currentTarget;
      try { await importProject(input.files?.[0], options); }
      catch (error) { showNotice(error.message || error, "error"); }
      finally { input.value = ""; }
    }, { signal });
  }

  function unmount() {
    mountToken += 1;
    teardownEngine();
    try { unsubscribe?.(); } catch {}
    try { rootAbort?.abort(); } catch {}
    window.clearTimeout(noticeTimer);
    window.clearTimeout(viewMotionTimer);
    window.clearTimeout(guideTimer);
    pageMain?.classList.remove("app-main--creative-fixed");
    pageWorkspace?.classList.remove("app-workspace--creative-fixed");
    unsubscribe = null;
    rootAbort = null;
    pageMain = null;
    pageWorkspace = null;
    if (activeRoot) activeRoot.replaceChildren();
    activeRoot = null;
    activeStore = null;
  }

  async function mount(root, options = {}) {
    if (!root) return;
    const view = normalizeView(options.view);
    if (activeRoot && activeRoot !== root) unmount();
    else {
      teardownEngine();
      try { unsubscribe?.(); } catch {}
      try { rootAbort?.abort(); } catch {}
      unsubscribe = null;
      rootAbort = null;
    }
    activeRoot = root;
    activeView = view;
    activeOptions = options;
    pageMain = root.closest?.(".app-main") || null;
    pageWorkspace = root.parentElement || null;
    pageMain?.classList.add("app-main--creative-fixed");
    pageWorkspace?.classList.add("app-workspace--creative-fixed");
    root.innerHTML = shellMarkup(view);
    bind(root, options);
    const store = await ensureStore(view);
    if (!activeRoot || root !== activeRoot) return;
    // Route preloading also calls ensureStore(). Only an actual mount may
    // select the mutable store used by shell actions and status rendering.
    activeStore = store;
    unsubscribe = store.subscribe?.((_state, action) => {
      renderContext();
      const sync = activeRoot?.querySelector("[data-cos-sync-time]");
      if (sync) {
        sync.dataset.action = action?.type || "update";
        sync.classList.remove("is-saved");
        void sync.offsetWidth;
        sync.classList.add("is-saved");
      }
    }) || null;
    renderContext();
    await activateView(view, options, false);
  }

  window.HHCreativeOS = {
    mount,
    unmount,
    prepareRoute,
    isPrepared,
    views: VIEWS.map((item) => ({ ...item })),
    normalizeView,
    viewContract,
    toolStorageKey,
    stateMetrics,
    capabilityAudit,
    version: 5
  };
})();
