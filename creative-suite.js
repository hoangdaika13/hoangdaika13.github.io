(() => {
  "use strict";
  if (window.HHCreativeSuite) return;

  const STORAGE = "hh-creative-suite-v1";
  const meta = {
    "ai-center": { kind: "ai", icon: "AI", name: "AI Center", note: "Prompt & Chat", color: "#62e9f2", route: "/create/ai-center" },
    "creator-studio": { kind: "creator", icon: "CS", name: "Creator Studio", note: "Content Lab", color: "#ff5dc8", route: "/create/creator-studio" },
    "media-center": { kind: "media", icon: "MC", name: "Media Center", note: "Library", color: "#c9f56a", route: "/create/media-center" },
    "ai-automation": { kind: "automation", icon: "AU", name: "AI Automation", note: "Workflow", color: "#9a86ff", route: "/create/ai-automation" }
  };

  const readState = () => {
    try { return JSON.parse(localStorage.getItem(STORAGE) || "{}"); } catch { return {}; }
  };
  const writeState = (next) => localStorage.setItem(STORAGE, JSON.stringify(next));
  const patchState = (key, value) => { const state = readState(); state[key] = value; writeState(state); return state; };
  const escapeHtml = (value) => String(value ?? "").replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char]);
  const download = (name, content, type = "application/json;charset=utf-8") => {
    const anchor = document.createElement("a");
    anchor.href = URL.createObjectURL(new Blob([content], { type }));
    anchor.download = name;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(anchor.href), 1000);
  };
  const toast = (message) => {
    document.querySelector(".creative-toast")?.remove();
    const node = document.createElement("div");
    node.className = "creative-toast";
    node.innerHTML = `<i></i><span>${escapeHtml(message)}</span>`;
    document.body.append(node);
    setTimeout(() => node.remove(), 2600);
  };

  const switcher = (active) => `<nav class="creative-suite-switcher" aria-label="Creative Suite">
    <strong>Creative Suite</strong>
    ${Object.entries(meta).map(([id, item]) => `<button type="button" class="${id === active ? "is-active" : ""}" style="--item-accent:${item.color}" data-app-route="${item.route}"><i>${item.icon}</i><span>${item.name}<small>${item.note}</small></span></button>`).join("")}
    <span class="creative-suite-health"><i></i> Local workspace</span>
  </nav>`;

  const decorateNavigation = () => {
    const group = [...document.querySelectorAll(".app-sidebar__group")].find((item) => item.querySelector('[data-app-route="/create"]'));
    if (!group) return;
    group.classList.add("is-creative-group");
    const arrow = group.querySelector(":scope > .app-sidebar__item > i");
    if (arrow && !arrow.classList.contains("creative-group-count")) { arrow.className = "creative-group-count"; arrow.textContent = "›"; }
    group.querySelectorAll(".app-sidebar__subitem").forEach((button) => {
      const id = Object.keys(meta).find((key) => button.dataset.appRoute?.endsWith(`/${key}`));
      if (!id) return;
      button.dataset.creativeIcon = meta[id].icon;
      button.style.setProperty("--creative-item", meta[id].color);
      if (!button.querySelector("small")) button.insertAdjacentHTML("beforeend", `<small>${meta[id].note}</small>`);
    });
  };

  const installCommon = (panel, id) => {
    if (!panel || panel.dataset.creativeEnhanced) return false;
    panel.dataset.creativeEnhanced = "true";
    panel.dataset.creativeKind = meta[id].kind;
    panel.classList.add("creative-suite-panel");
    panel.insertAdjacentHTML("afterbegin", switcher(id));
    return true;
  };

  const enhanceAI = (panel) => {
    if (!installCommon(panel, "ai-center")) return;
    const toolbar = panel.querySelector(".ai-center-toolbar");
    toolbar?.insertAdjacentHTML("afterend", `<div class="creative-utility-bar">
      <strong><span>AI Workspace</span> · dữ liệu và phiên làm việc</strong>
      <label>Nhập tài liệu<input type="file" data-creative-ai-import accept=".txt,.md,.csv,.json,.html,text/*"></label>
      <button type="button" data-creative-ai-snapshot>Lưu bản nháp</button>
      <button type="button" data-creative-ai-export>Xuất workspace</button>
      <button type="button" data-creative-ai-reset>Đặt lại</button>
      <span class="creative-status-pill" data-creative-ai-words>0 từ</span>
    </div>`);
    panel.querySelector(".ai-sidebar")?.insertAdjacentHTML("beforeend", `<section class="creative-library">
      <header><strong>Thư viện chuyên sâu</strong><small>6 mẫu</small></header>
      ${[
        ["YT", "Kịch bản giữ chân", "Hook, cao trào, CTA"], ["SEO", "Content SEO", "Outline và từ khóa"], ["DEV", "Code reviewer", "Phân tích lỗi và test"],
        ["PLAN", "Kế hoạch 30 ngày", "Mục tiêu và KPI"], ["SALE", "Landing page", "Offer và chuyển đổi"], ["DATA", "Phân tích dữ liệu", "Insight và hành động"]
      ].map((item) => `<button type="button" class="creative-template" data-creative-ai-template="${item[0]}"><i>${item[0]}</i><span>${item[1]}<small>${item[2]}</small></span></button>`).join("")}
    </section>`);
    const saved = readState().aiDraft;
    if (saved) {
      const input = panel.querySelector("[data-ai-chat-input]");
      if (input && !input.value) input.value = saved.input || "";
    }
    updateAIWords(panel);
  };

  const updateAIWords = (panel) => {
    const inputs = [...panel.querySelectorAll("textarea")].map((item) => item.value).join(" ").trim();
    const words = inputs ? inputs.split(/\s+/).length : 0;
    const badge = panel.querySelector("[data-creative-ai-words]");
    if (badge) badge.textContent = `${words} từ · ~${Math.max(1, Math.ceil(words * 1.35))} token`;
  };

  const creatorTabs = [
    ["description", "Mô tả"], ["outline", "Outline"], ["chapters", "Chapters"], ["shorts", "Shorts"], ["calendar", "Lịch 7 ngày"]
  ];
  const enhanceCreator = (panel) => {
    if (!installCommon(panel, "creator-studio")) return;
    panel.querySelector(".suite-hero")?.insertAdjacentHTML("afterend", `<div class="creator-project-bar creative-utility-bar">
      <input data-creative-project-name value="Dự án nội dung mới" aria-label="Tên dự án">
      <button type="button" data-creative-project-save>Lưu dự án</button>
      <button type="button" data-creative-project-load>Mở gần nhất</button>
      <button type="button" data-creative-project-package>Xuất gói JSON</button>
    </div>`);
    panel.querySelector(".creator-fields")?.insertAdjacentHTML("afterend", `<div class="creator-advanced-fields">
      <label>Từ khóa chính<input data-creative-keyword placeholder="Từ khóa cần xếp hạng"></label>
      <label>CTA<input data-creative-cta value="Theo dõi để xem phần tiếp theo"></label>
      <label>Định dạng<select data-creative-format><option>Video dài</option><option>Short / Reel</option><option>Podcast</option><option>Bài viết</option><option>Carousel</option></select></label>
    </div><div class="creative-utility-bar"><strong><span>Production Engine</span></strong><button type="button" data-creative-generate-pack>Tạo gói hoàn chỉnh</button><button type="button" data-creative-research>Phân tích góc nội dung</button><button type="button" data-creative-copy-pack>Sao chép tất cả</button></div>`);
    const tabs = panel.querySelector(".creator-output-tabs");
    creatorTabs.forEach(([id, label]) => tabs?.insertAdjacentHTML("beforeend", `<button class="interactive" type="button" data-creator-output-tab="${id}">${label}</button>`));
    panel.querySelector(".creator-inspector")?.insertAdjacentHTML("beforeend", `<div class="creator-inspector-stack">
      <section><header><strong>Quality gate</strong><span data-creative-quality>0%</span></header><div class="creator-check-list" data-creative-quality-list></div></section>
      <section><header><strong>Dự án đã lưu</strong><span data-creative-project-count>0</span></header><select data-creative-project-list><option value="">Chọn dự án...</option></select></section>
    </div>`);
    const transfer = localStorage.getItem("hh-creative-transfer");
    if (transfer) {
      const topic = panel.querySelector("[data-creator-topic]");
      if (topic && !topic.value) topic.value = transfer.split(/\r?\n/).find((line) => line.trim())?.slice(0, 140) || "Nội dung từ AI Automation";
      const output = panel.querySelector("[data-creator-output]");
      if (output) output.textContent = transfer;
      localStorage.removeItem("hh-creative-transfer");
    }
    refreshCreatorProjects(panel);
  };

  const readCreatorFields = (panel) => ({
    name: panel.querySelector("[data-creative-project-name]")?.value.trim() || "Dự án nội dung",
    topic: panel.querySelector("[data-creator-topic]")?.value.trim() || "",
    platform: panel.querySelector("[data-creator-platform]")?.value || "YouTube",
    length: panel.querySelector("[data-creator-length]")?.value || "8-12 phút",
    audience: panel.querySelector("[data-creator-audience]")?.value.trim() || "Người xem phổ thông",
    tone: panel.querySelector("[data-creator-tone]")?.value || "Cảm xúc",
    keyword: panel.querySelector("[data-creative-keyword]")?.value.trim() || "",
    cta: panel.querySelector("[data-creative-cta]")?.value.trim() || "Theo dõi để xem thêm",
    format: panel.querySelector("[data-creative-format]")?.value || "Video dài"
  });

  const buildCreatorPack = (data) => {
    const keyword = data.keyword || data.topic;
    const title = [`${data.topic}: Sự Thật Ít Người Biết`, `Tôi Đã Thử ${data.topic} Và Đây Là Kết Quả`, `7 Điều Quan Trọng Về ${data.topic}`].join("\n");
    const outline = ["1. Hook tạo khoảng trống tò mò", "2. Bối cảnh và vấn đề thật", "3. Ba luận điểm có ví dụ", "4. Bước ngoặt hoặc insight chính", `5. Kết luận và CTA: ${data.cta}`].join("\n");
    const script = `HOOK\nNếu điều bạn vẫn tin về ${data.topic.toLowerCase()} chưa hoàn toàn đúng thì sao?\n\nMỞ ĐẦU\nĐặt bối cảnh phù hợp với ${data.audience}.\n\nNỘI DUNG\n${outline}\n\nKẾT\nTóm lại giá trị cốt lõi và mời người xem hành động tự nhiên.`;
    const hashtags = [...new Set(["HHCreator", data.platform.replace(/\W/g, ""), ...keyword.split(/\s+/).filter((word) => word.length > 3)])].slice(0, 10).map((tag) => `#${tag}`).join(" ");
    const calendar = Array.from({ length: 7 }, (_, index) => `Ngày ${index + 1}: ${["Video chính", "Short trích đoạn", "Bài hỏi đáp", "Carousel insight", "Hậu trường", "Case study", "Tổng kết tuần"][index]} · ${data.topic}`).join("\n");
    return {
      title,
      script,
      seo: `Từ khóa chính: ${keyword}\nTừ khóa phụ: ${data.topic}, ${data.platform}, ${data.format}\nMật độ đề xuất: 1-2%\nĐặt từ khóa trong title, 120 ký tự đầu mô tả và chapter đầu tiên.\nHashtag: ${hashtags}`,
      thumbnail: `Bố cục 16:9, một chủ thể rõ, biểu cảm mạnh, tương phản cyan - magenta - vàng, chữ 3-5 từ “${data.topic.slice(0, 28).toUpperCase()}”, không watermark.`,
      description: `${data.topic} được trình bày theo phong cách ${data.tone.toLowerCase()} dành cho ${data.audience}.\n\nNội dung gồm ví dụ thực tế, insight chính và các bước áp dụng.\n\n${data.cta}\n\n${hashtags}`,
      outline,
      chapters: ["00:00 Mở đầu", "00:30 Vấn đề chính", "02:15 Bối cảnh", "04:00 Ba điểm quan trọng", "07:20 Bước ngoặt", "09:30 Kết luận"].join("\n"),
      shorts: `HOOK 0-3s: “Bạn có đang hiểu sai về ${data.topic}?”\nVALUE 3-45s: Nêu một insight, một ví dụ và một bước hành động.\nCTA 45-60s: ${data.cta}`,
      calendar
    };
  };

  const updateCreatorQuality = (panel, data, pack) => {
    const checks = [
      ["Chủ đề đủ rõ", data.topic.length >= 12], ["Có từ khóa chính", Boolean(data.keyword)], ["Tiêu đề dưới 70 ký tự", pack.title.split("\n")[0].length <= 70],
      ["Có CTA", data.cta.length > 8], ["Có nội dung đa định dạng", Boolean(pack.shorts && pack.calendar)]
    ];
    const score = Math.round(checks.filter((item) => item[1]).length / checks.length * 100);
    const scoreNode = panel.querySelector("[data-creator-score]");
    if (scoreNode) scoreNode.textContent = score;
    const quality = panel.querySelector("[data-creative-quality]");
    if (quality) quality.textContent = `${score}%`;
    const list = panel.querySelector("[data-creative-quality-list]");
    if (list) list.innerHTML = checks.map(([label, ok]) => `<span class="${ok ? "ok" : ""}"><i></i>${label}<b>${ok ? "Đạt" : "Thiếu"}</b></span>`).join("");
  };

  const refreshCreatorProjects = (panel) => {
    const projects = readState().creatorProjects || [];
    const list = panel.querySelector("[data-creative-project-list]");
    if (list) list.innerHTML = `<option value="">Chọn dự án...</option>${projects.map((item) => `<option value="${item.id}">${escapeHtml(item.data.name)} · ${new Date(item.updated).toLocaleDateString("vi-VN")}</option>`).join("")}`;
    const count = panel.querySelector("[data-creative-project-count]");
    if (count) count.textContent = `${projects.length} dự án`;
  };

  const enhanceMediaItems = (panel) => {
    panel.querySelectorAll(".media-card").forEach((card) => {
      if (card.querySelector(".media-select-box")) return;
      card.insertAdjacentHTML("afterbegin", `<label class="media-select-box"><input type="checkbox" data-creative-media-select="${escapeHtml(card.dataset.mediaId)}" aria-label="Chọn media"></label>`);
    });
  };
  const enhanceMedia = (panel) => {
    if (!panel) return;
    if (!installCommon(panel, "media-center")) { enhanceMediaItems(panel); return; }
    panel.querySelector(".media-command-bar")?.insertAdjacentHTML("afterend", `<div class="creative-utility-bar">
      <strong><span>Media Operations</span> · quản lý thư viện</strong>
      <button type="button" data-creative-media-batch>Chọn hàng loạt</button>
      <button type="button" data-creative-media-analyze>Phân tích thư viện</button>
      <button type="button" data-creative-media-export>Xuất manifest</button>
      <label>Nhập manifest<input type="file" data-creative-media-import accept="application/json,.json"></label>
    </div><div class="media-batch-bar" data-creative-media-batch-bar><strong><span data-creative-media-count>0</span> mục đã chọn</strong><button type="button" class="creative-mini-button" data-creative-media-favorite>Yêu thích</button><button type="button" class="creative-mini-button" data-creative-media-download>Tải tệp khả dụng</button><button type="button" class="creative-mini-button" data-creative-media-cancel>Hủy</button></div>`);
    panel.querySelector(".media-sidebar")?.insertAdjacentHTML("beforeend", `<section class="media-inspector"><header><strong>Library Intelligence</strong><span data-creative-media-health>Sẵn sàng</span></header><dl data-creative-media-stats><dt>Ảnh</dt><dd>0</dd><dt>Video</dt><dd>0</dd><dt>Âm thanh</dt><dd>0</dd><dt>Liên kết</dt><dd>0</dd></dl></section>`);
    enhanceMediaItems(panel);
    analyzeMedia(panel, false);
  };

  const mediaCards = (panel) => [...panel.querySelectorAll(".media-card")];
  const selectedMedia = (panel) => [...panel.querySelectorAll("[data-creative-media-select]:checked")].map((input) => input.value);
  const updateMediaSelection = (panel) => {
    const count = selectedMedia(panel).length;
    const node = panel.querySelector("[data-creative-media-count]"); if (node) node.textContent = count;
  };
  const analyzeMedia = (panel, notify = true) => {
    const counts = { image: 0, video: 0, audio: 0, link: 0 };
    mediaCards(panel).forEach((card) => {
      const text = card.dataset.mediaSearchText || "";
      const type = Object.keys(counts).find((key) => text.includes(key)) || "link";
      counts[type] += 1;
    });
    const stats = panel.querySelector("[data-creative-media-stats]");
    if (stats) stats.innerHTML = `<dt>Ảnh</dt><dd>${counts.image}</dd><dt>Video</dt><dd>${counts.video}</dd><dt>Âm thanh</dt><dd>${counts.audio}</dd><dt>Liên kết</dt><dd>${counts.link}</dd>`;
    const health = panel.querySelector("[data-creative-media-health]"); if (health) health.textContent = `${mediaCards(panel).length} mục · IndexedDB`;
    if (notify) toast("Đã phân tích và cập nhật thống kê thư viện.");
  };

  const automationPresets = {
    youtube: ["title", "description", "tags", "summary", "voice", "thumbnail"],
    shorts: ["title", "description", "tags", "voice", "thumbnail"],
    article: ["title", "description", "tags", "translation", "summary"],
    translate: ["translation", "summary", "voice"]
  };
  const enhanceAutomation = (panel) => {
    if (!installCommon(panel, "ai-automation")) return;
    panel.querySelector(".suite-hero")?.insertAdjacentHTML("afterend", `<div class="automation-preset-bar creative-utility-bar">
      <select data-creative-auto-preset><option value="youtube">YouTube Production</option><option value="shorts">Shorts Factory</option><option value="article">Article Publisher</option><option value="translate">Translate & Voice</option></select>
      <button type="button" data-creative-auto-apply>Áp dụng preset</button>
      <button type="button" data-creative-auto-save>Lưu workflow</button>
      <button type="button" data-creative-auto-import>Nhập workflow</button>
      <button type="button" data-creative-auto-export>Xuất JSON</button>
      <input type="file" data-creative-auto-file accept="application/json,.json" hidden>
    </div>`);
    panel.querySelectorAll(".automation-steps label").forEach(addAutomationControls);
    panel.querySelector(".automation-workspace")?.insertAdjacentHTML("beforeend", `<section class="automation-history"><header><strong>Lịch sử pipeline</strong><button type="button" data-creative-auto-clear-history>Dọn</button></header><div class="automation-history-list" data-creative-auto-history></div></section>`);
    panel.querySelector(".automation-results")?.insertAdjacentHTML("beforeend", `<div class="creative-utility-bar"><strong><span>Run control</span></strong><button type="button" data-creative-auto-copy-markdown>Copy Markdown</button><button type="button" data-creative-auto-send-creator>Gửi sang Creator</button></div>`);
    refreshAutomationHistory(panel);
  };
  const addAutomationControls = (label) => {
    if (label.querySelector(".automation-step-actions")) return;
    label.insertAdjacentHTML("beforeend", `<span class="automation-step-actions"><button type="button" data-creative-step-up title="Đưa lên">↑</button><button type="button" data-creative-step-down title="Đưa xuống">↓</button></span>`);
  };
  const captureAutomation = (panel) => ({
    input: panel.querySelector("[data-auto-input]")?.value || "",
    platform: panel.querySelector("[data-auto-platform]")?.value || "YouTube",
    language: panel.querySelector("[data-auto-language]")?.value || "Tiếng Việt",
    style: panel.querySelector("[data-auto-style]")?.value || "Cảm xúc",
    steps: [...panel.querySelectorAll("[data-auto-step]")].map((item) => ({ id: item.dataset.autoStep, enabled: item.checked }))
  });
  const refreshAutomationHistory = (panel) => {
    const history = readState().automationHistory || [];
    const list = panel.querySelector("[data-creative-auto-history]");
    if (list) list.innerHTML = history.length ? history.slice(0, 8).map((item, index) => `<button type="button" data-creative-auto-history-item="${index}"><span>${escapeHtml(item.title)}</span><small>${escapeHtml(item.time)}</small></button>`).join("") : "<small>Chưa có lần chạy nào.</small>";
  };

  const enhanceAll = () => {
    decorateNavigation();
    enhanceAI(document.querySelector("[data-ai-center]"));
    enhanceCreator(document.querySelector("[data-creator]"));
    enhanceMedia(document.querySelector("[data-media-center]"));
    enhanceAutomation(document.querySelector("[data-automation]"));
  };

  document.addEventListener("input", (event) => {
    const ai = event.target.closest("[data-ai-center]");
    if (ai) updateAIWords(ai);
    if (event.target.matches("[data-creative-media-select]")) updateMediaSelection(event.target.closest("[data-media-center]"));
  });

  document.addEventListener("change", async (event) => {
    const panel = event.target.closest("[data-ai-center]");
    if (event.target.matches("[data-creative-ai-import]") && panel) {
      const file = event.target.files?.[0]; if (!file) return;
      if (file.size > 4 * 1024 * 1024) return toast("Tài liệu cần nhỏ hơn 4 MB.");
      const text = await file.text();
      const input = panel.querySelector("[data-ai-chat-input]"); if (input) input.value = text;
      updateAIWords(panel); toast(`Đã nhập ${file.name}.`); return;
    }
    const media = event.target.closest("[data-media-center]");
    if (event.target.matches("[data-creative-media-import]") && media) {
      const file = event.target.files?.[0]; if (!file) return;
      try {
        const manifest = JSON.parse(await file.text());
        const current = JSON.parse(localStorage.getItem("hh-media-center") || "{}");
        const safeItems = (manifest.items || []).filter((item) => typeof item.url === "string" && !item.url.startsWith("blob:")).map((item) => ({ ...item, id: item.id || `import-${Date.now()}-${Math.random()}` }));
        current.items = [...(current.items || []), ...safeItems];
        localStorage.setItem("hh-media-center", JSON.stringify(current));
        toast(`Đã nhập ${safeItems.length} media. Mở lại module để đồng bộ.`);
      } catch { toast("Manifest JSON không hợp lệ."); }
    }
    if (event.target.matches("[data-creative-project-list]")) loadCreatorProject(event.target.closest("[data-creator]"), event.target.value);
    if (event.target.matches("[data-creative-auto-file]")) {
      const auto = event.target.closest("[data-automation]"); const file = event.target.files?.[0]; if (!auto || !file) return;
      try { applyAutomation(auto, JSON.parse(await file.text())); toast("Đã nhập workflow."); } catch { toast("Workflow JSON không hợp lệ."); }
    }
  });

  const saveCreatorProject = (panel, pack = null) => {
    const data = readCreatorFields(panel); if (!data.topic) { panel.querySelector("[data-creator-topic]")?.focus(); toast("Hãy nhập chủ đề trước khi lưu."); return; }
    const state = readState(); const projects = state.creatorProjects || [];
    const id = panel.dataset.creativeProjectId || `creator-${Date.now()}`;
    const entry = { id, updated: new Date().toISOString(), data, pack: pack || (() => { try { return JSON.parse(panel.dataset.outputs || "{}"); } catch { return {}; } })() };
    state.creatorProjects = [entry, ...projects.filter((item) => item.id !== id)].slice(0, 30); writeState(state);
    panel.dataset.creativeProjectId = id; refreshCreatorProjects(panel); toast("Đã lưu dự án nội dung trên thiết bị.");
  };
  const loadCreatorProject = (panel, id) => {
    if (!panel || !id) return;
    const item = (readState().creatorProjects || []).find((entry) => entry.id === id); if (!item) return;
    const selectors = { name: "[data-creative-project-name]", topic: "[data-creator-topic]", platform: "[data-creator-platform]", length: "[data-creator-length]", audience: "[data-creator-audience]", tone: "[data-creator-tone]", keyword: "[data-creative-keyword]", cta: "[data-creative-cta]", format: "[data-creative-format]" };
    Object.entries(selectors).forEach(([key, selector]) => { const field = panel.querySelector(selector); if (field) field.value = item.data[key] || ""; });
    panel.dataset.outputs = JSON.stringify(item.pack || {}); panel.dataset.creativeProjectId = item.id;
    const output = panel.querySelector("[data-creator-output]"); if (output) output.textContent = item.pack?.title || "Dự án đã được tải.";
    updateCreatorQuality(panel, item.data, item.pack || {}); toast(`Đã mở ${item.data.name}.`);
  };
  const applyAutomation = (panel, config) => {
    if (!panel || !config) return;
    [["[data-auto-input]", config.input], ["[data-auto-platform]", config.platform], ["[data-auto-language]", config.language], ["[data-auto-style]", config.style]].forEach(([selector, value]) => { const field = panel.querySelector(selector); if (field && value != null) field.value = value; });
    const enabled = new Map((config.steps || []).map((item) => [item.id, item.enabled]));
    panel.querySelectorAll("[data-auto-step]").forEach((item) => { if (enabled.has(item.dataset.autoStep)) item.checked = enabled.get(item.dataset.autoStep); });
  };

  document.addEventListener("click", (event) => {
    const ai = event.target.closest("[data-ai-center]");
    if (ai) {
      const template = event.target.closest("[data-creative-ai-template]");
      if (template) {
        const prompts = {
          YT: "Viết kịch bản YouTube giữ chân người xem: hook 10 giây, bối cảnh, 3 điểm phát triển, cao trào, kết và CTA tự nhiên. Chủ đề: ",
          SEO: "Xây dựng content SEO gồm search intent, semantic keywords, outline H2/H3, FAQ và meta description cho: ",
          DEV: "Review đoạn code sau. Tìm bug, rủi ro bảo mật, vấn đề hiệu năng, accessibility và đề xuất test: ",
          PLAN: "Lập kế hoạch 30 ngày có milestone, KPI, rủi ro và checklist hằng tuần cho mục tiêu: ",
          SALE: "Viết landing page gồm headline, vấn đề, lợi ích, bằng chứng, offer, FAQ và CTA cho sản phẩm: ",
          DATA: "Phân tích dữ liệu sau, nêu xu hướng, bất thường, giả thuyết và 5 hành động ưu tiên: "
        };
        const input = ai.querySelector("[data-ai-chat-input]"); if (input) { input.value = prompts[template.dataset.creativeAiTemplate] || ""; input.focus(); }
        ai.querySelector('[data-ai-tab="chat"]')?.click(); updateAIWords(ai); return;
      }
      if (event.target.closest("[data-creative-ai-snapshot]")) { patchState("aiDraft", { input: ai.querySelector("[data-ai-chat-input]")?.value || "", savedAt: new Date().toISOString() }); toast("Đã lưu bản nháp AI."); return; }
      if (event.target.closest("[data-creative-ai-export]")) { download("hh-ai-workspace.json", JSON.stringify({ savedAt: new Date().toISOString(), ai: JSON.parse(localStorage.getItem("hh-ai-center") || "{}"), draft: readState().aiDraft || {}, result: ai.querySelector("[data-ai-result]")?.textContent || "" }, null, 2)); return; }
      if (event.target.closest("[data-creative-ai-reset]")) { ai.querySelectorAll("textarea,input[type=text],input[type=search]").forEach((field) => field.value = ""); localStorage.removeItem("hh-ai-center"); patchState("aiDraft", null); updateAIWords(ai); toast("Đã đặt lại workspace AI."); return; }
    }

    const creator = event.target.closest("[data-creator]");
    if (creator) {
      if (event.target.closest("[data-creative-generate-pack]")) {
        const data = readCreatorFields(creator); if (!data.topic) { creator.querySelector("[data-creator-topic]")?.focus(); return toast("Hãy nhập chủ đề chính."); }
        const pack = buildCreatorPack(data); creator.dataset.outputs = JSON.stringify(pack);
        const output = creator.querySelector("[data-creator-output]"); if (output) output.textContent = pack.title;
        const preview = creator.querySelector("[data-thumbnail-preview] small"); if (preview) preview.textContent = data.topic.slice(0, 42);
        const tags = creator.querySelector("[data-creator-tags]"); if (tags) tags.innerHTML = pack.seo.match(/#[^\s]+/g)?.map((tag) => `<span>${escapeHtml(tag)}</span>`).join("") || `<span>#HHCreator</span>`;
        updateCreatorQuality(creator, data, pack); saveCreatorProject(creator, pack); toast("Đã tạo gói nội dung đa định dạng."); return;
      }
      if (event.target.closest("[data-creative-research]")) {
        const data = readCreatorFields(creator); if (!data.topic) return toast("Hãy nhập chủ đề cần nghiên cứu.");
        const research = `GÓC NỘI DUNG\n1. Sai lầm phổ biến về ${data.topic}\n2. Trải nghiệm trước và sau khi áp dụng\n3. Case study có số liệu\n4. Góc nhìn trái chiều\n5. Checklist dành cho ${data.audience}\n\nCÂU HỎI NGƯỜI XEM\n- Vì sao chủ đề này quan trọng?\n- Bắt đầu từ đâu?\n- Cần tránh điều gì?\n- Bao lâu có kết quả?`;
        const current = (() => { try { return JSON.parse(creator.dataset.outputs || "{}"); } catch { return {}; } })(); current.outline = research; creator.dataset.outputs = JSON.stringify(current);
        creator.querySelector('[data-creator-output-tab="outline"]')?.click(); return;
      }
      if (event.target.closest("[data-creative-copy-pack]")) { navigator.clipboard.writeText(Object.entries(JSON.parse(creator.dataset.outputs || "{}")).map(([key, value]) => `${key.toUpperCase()}\n${value}`).join("\n\n---\n\n")); toast("Đã sao chép toàn bộ gói nội dung."); return; }
      if (event.target.closest("[data-creative-project-save]")) { saveCreatorProject(creator); return; }
      if (event.target.closest("[data-creative-project-load]")) { const latest = readState().creatorProjects?.[0]; latest ? loadCreatorProject(creator, latest.id) : toast("Chưa có dự án đã lưu."); return; }
      if (event.target.closest("[data-creative-project-package]")) { const data = readCreatorFields(creator); download("hh-creator-project.json", JSON.stringify({ data, pack: JSON.parse(creator.dataset.outputs || "{}"), exportedAt: new Date().toISOString() }, null, 2)); return; }
    }

    const media = event.target.closest("[data-media-center]");
    if (media) {
      if (event.target.closest("[data-creative-media-batch]")) { media.classList.toggle("is-batch-mode"); media.querySelector("[data-creative-media-batch-bar]")?.classList.toggle("is-active", media.classList.contains("is-batch-mode")); return; }
      if (event.target.closest("[data-creative-media-cancel]")) { media.classList.remove("is-batch-mode"); media.querySelector("[data-creative-media-batch-bar]")?.classList.remove("is-active"); media.querySelectorAll("[data-creative-media-select]").forEach((item) => item.checked = false); updateMediaSelection(media); return; }
      if (event.target.closest("[data-creative-media-analyze]")) { analyzeMedia(media); return; }
      if (event.target.closest("[data-creative-media-export]")) { const raw = JSON.parse(localStorage.getItem("hh-media-center") || "{}"); const items = mediaCards(media).map((card) => ({ id: card.dataset.mediaId, title: card.querySelector(".media-card-info strong")?.textContent || "Media", category: card.dataset.mediaCategory, search: card.dataset.mediaSearchText })); download("hh-media-manifest.json", JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), items: raw.items || items, playlists: raw.playlists || [] }, null, 2)); return; }
      if (event.target.closest("[data-creative-media-favorite]")) { const ids = selectedMedia(media); ids.forEach((id) => media.querySelector(`[data-media-favorite="${CSS.escape(id)}"]`)?.click()); toast(`Đã cập nhật ${ids.length} mục yêu thích.`); return; }
      if (event.target.closest("[data-creative-media-download]")) { const ids = selectedMedia(media); let count = 0; ids.forEach((id) => { const card = media.querySelector(`[data-media-id="${CSS.escape(id)}"]`); const source = card?.querySelector("img")?.src; if (source) { const a = document.createElement("a"); a.href = source; a.download = card.querySelector("strong")?.textContent || "media"; a.click(); count += 1; } }); toast(`Đã bắt đầu tải ${count} tệp ảnh khả dụng.`); return; }
    }

    const auto = event.target.closest("[data-automation]");
    if (auto) {
      if (event.target.closest("[data-creative-auto-apply]")) { const preset = auto.querySelector("[data-creative-auto-preset]")?.value; const enabled = new Set(automationPresets[preset] || []); auto.querySelectorAll("[data-auto-step]").forEach((item) => item.checked = enabled.has(item.dataset.autoStep)); toast("Đã áp dụng preset pipeline."); return; }
      if (event.target.closest("[data-creative-step-up]")) { const label = event.target.closest("label"); label?.previousElementSibling?.before(label); return; }
      if (event.target.closest("[data-creative-step-down]")) { const label = event.target.closest("label"); const next = label?.nextElementSibling; if (next) next.after(label); return; }
      if (event.target.closest("[data-creative-auto-save]")) { const state = readState(); const workflows = state.workflows || []; state.workflows = [{ id: Date.now(), name: auto.querySelector("[data-creative-auto-preset]")?.selectedOptions[0]?.textContent || "Workflow", config: captureAutomation(auto), savedAt: new Date().toISOString() }, ...workflows].slice(0, 20); writeState(state); toast("Đã lưu workflow trên thiết bị."); return; }
      if (event.target.closest("[data-creative-auto-import]")) { auto.querySelector("[data-creative-auto-file]")?.click(); return; }
      if (event.target.closest("[data-creative-auto-export]")) { download("hh-ai-workflow.json", JSON.stringify(captureAutomation(auto), null, 2)); return; }
      if (event.target.closest("[data-creative-auto-clear-history]")) { patchState("automationHistory", []); refreshAutomationHistory(auto); return; }
      const historyItem = event.target.closest("[data-creative-auto-history-item]");
      if (historyItem) { const item = readState().automationHistory?.[Number(historyItem.dataset.creativeAutoHistoryItem)]; if (item) { applyAutomation(auto, item.config); auto.querySelector("[data-auto-output]").textContent = item.output; } return; }
      if (event.target.closest("[data-creative-auto-copy-markdown]")) { navigator.clipboard.writeText(auto.querySelector("[data-auto-output]")?.textContent || ""); toast("Đã sao chép kết quả Markdown."); return; }
      if (event.target.closest("[data-creative-auto-send-creator]")) { const output = auto.querySelector("[data-auto-output]")?.textContent || ""; patchState("creatorInbox", { content: output, time: new Date().toISOString() }); localStorage.setItem("hh-creative-transfer", output); location.hash = "#/create/creator-studio"; toast("Đã chuyển kết quả sang Creator Studio."); return; }
      if (event.target.closest("[data-auto-run]")) {
        setTimeout(() => {
          const state = readState(); const history = state.automationHistory || []; const config = captureAutomation(auto); const output = auto.querySelector("[data-auto-output]")?.textContent || "";
          state.automationHistory = [{ title: `${config.platform} · ${config.steps.filter((item) => item.enabled).length} bước`, time: new Date().toLocaleString("vi-VN"), config, output }, ...history].slice(0, 20); writeState(state); refreshAutomationHistory(auto);
        });
      }
    }
  });

  const observer = new MutationObserver(() => requestAnimationFrame(enhanceAll));
  observer.observe(document.documentElement, { childList: true, subtree: true });
  addEventListener("hashchange", () => setTimeout(enhanceAll));
  addEventListener("hh:workspace-open", () => setTimeout(enhanceAll));
  addEventListener("hh:modules-ready", () => setTimeout(enhanceAll));
  addEventListener("DOMContentLoaded", enhanceAll);
  setTimeout(enhanceAll, 300);
  window.HHCreativeSuite = { enhance: enhanceAll, readState };
})();
