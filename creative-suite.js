(() => {
  "use strict";
  if (window.HHCreativeSuite) return;

  const STORAGE = "hh.creative-suite.v3";
  const LEGACY_STORAGE = "hh-creative-suite-v1";
  const meta = {
    "ai-center": {
      kind: "ai",
      icon: "AI",
      name: "AI Center",
      note: "Chat, prompt và phân tích",
      description: "Tạo prompt, xử lý tài liệu, lưu phiên và chạy chuỗi AI.",
      color: "#63e6ff",
      route: "/create/ai-center"
    },
    "ai-script": {
      kind: "script",
      icon: "KS",
      name: "Kịch bản AI",
      note: "Biên kịch, batch và URL research",
      description: "Viết kịch bản dài, phân tích retention, training profile, dịch, batch và quản lý series.",
      color: "#ff9d66",
      route: "/create/ai-script"
    },
    "creator-studio": {
      kind: "creator",
      icon: "CS",
      name: "Creator Studio",
      note: "Xưởng nội dung đa nền tảng",
      description: "Tạo trọn bộ tiêu đề, kịch bản, SEO, short và lịch đăng.",
      color: "#ff62c8",
      route: "/create/creator-studio"
    },
    "media-center": {
      kind: "media",
      icon: "MC",
      name: "Media Center",
      note: "Thư viện và khám phá media",
      description: "Quản lý file, URL, playlist và tìm nội dung Google/YouTube.",
      color: "#c7f36b",
      route: "/create/media-center"
    },
    "ai-automation": {
      kind: "automation",
      icon: "AU",
      name: "AI Automation",
      note: "Workflow sản xuất tự động",
      description: "Ghép các tác vụ thành pipeline, lưu preset và chuyển kết quả.",
      color: "#9f8cff",
      route: "/create/ai-automation"
    }
  };

  const promptTemplates = {
    youtube: {
      icon: "YT",
      title: "Kịch bản YouTube",
      note: "Hook, nhịp giữ chân, CTA",
      prompt: "Viết kịch bản YouTube có hook 10 giây, bối cảnh, ba luận điểm, cao trào, kết luận và CTA tự nhiên. Chủ đề: "
    },
    seo: {
      icon: "SEO",
      title: "Bài viết SEO",
      note: "Search intent và outline",
      prompt: "Xây dựng nội dung SEO gồm search intent, semantic keywords, outline H2/H3, FAQ và meta description cho: "
    },
    social: {
      icon: "SOC",
      title: "Chiến dịch social",
      note: "Facebook, TikTok, Threads",
      prompt: "Tạo chiến dịch social 7 ngày gồm ý tưởng, caption, hook, CTA và chỉ số cần theo dõi cho: "
    },
    code: {
      icon: "DEV",
      title: "Đánh giá mã nguồn",
      note: "Bug, bảo mật và test",
      prompt: "Đánh giá đoạn mã sau. Tìm lỗi, rủi ro bảo mật, hiệu năng, accessibility và đề xuất test cụ thể:\n"
    },
    plan: {
      icon: "30D",
      title: "Kế hoạch 30 ngày",
      note: "Milestone, KPI và rủi ro",
      prompt: "Lập kế hoạch 30 ngày có milestone, KPI, rủi ro và checklist hằng tuần cho mục tiêu: "
    },
    landing: {
      icon: "LP",
      title: "Landing page",
      note: "Offer và chuyển đổi",
      prompt: "Viết landing page gồm headline, vấn đề, lợi ích, bằng chứng, offer, FAQ và CTA cho sản phẩm: "
    },
    data: {
      icon: "DATA",
      title: "Phân tích dữ liệu",
      note: "Insight và hành động",
      prompt: "Phân tích dữ liệu sau, nêu xu hướng, bất thường, giả thuyết và năm hành động ưu tiên:\n"
    },
    email: {
      icon: "MAIL",
      title: "Chuỗi email",
      note: "5 email nuôi dưỡng",
      prompt: "Tạo chuỗi 5 email nuôi dưỡng gồm subject, preview text, nội dung, CTA và thời điểm gửi cho: "
    }
  };

  const automationPresets = {
    youtube: ["title", "description", "tags", "summary", "voice", "thumbnail"],
    shorts: ["title", "description", "tags", "voice", "thumbnail"],
    article: ["title", "description", "tags", "translation", "summary"],
    translate: ["translation", "summary", "voice"],
    campaign: ["title", "description", "tags", "translation", "summary", "thumbnail"]
  };

  const escapeHtml = (value) => String(value ?? "").replace(/[&<>'"]/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    '"': "&quot;"
  })[char]);

  const readJson = (key, fallback = {}) => {
    try {
      const value = JSON.parse(localStorage.getItem(key) || "null");
      return value && typeof value === "object" ? value : fallback;
    } catch {
      return fallback;
    }
  };

  const readState = () => {
    const current = readJson(STORAGE, null);
    if (current) return current;
    const legacy = readJson(LEGACY_STORAGE, {});
    if (Object.keys(legacy).length) localStorage.setItem(STORAGE, JSON.stringify(legacy));
    return legacy;
  };

  const writeState = (next) => localStorage.setItem(STORAGE, JSON.stringify(next));
  const updateState = (patch) => {
    const next = { ...readState(), ...patch, updatedAt: new Date().toISOString() };
    writeState(next);
    return next;
  };

  const download = (name, content, type = "application/json;charset=utf-8") => {
    const url = URL.createObjectURL(new Blob([content], { type }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = name;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const copyText = async (text) => {
    if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(text);
    const area = document.createElement("textarea");
    area.value = text;
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.append(area);
    area.select();
    document.execCommand("copy");
    area.remove();
  };

  const toast = (message, tone = "success") => {
    document.querySelector(".creative-toast")?.remove();
    const node = document.createElement("div");
    node.className = `creative-toast is-${tone}`;
    node.setAttribute("role", "status");
    node.innerHTML = `<i></i><span>${escapeHtml(message)}</span>`;
    document.body.append(node);
    setTimeout(() => node.remove(), 3200);
  };

  const routeNow = () => {
    const route = location.hash.replace(/^#/, "") || "/home";
    return route.startsWith("/") ? route : `/${route}`;
  };

  const switcherMarkup = (active) => `
    <nav class="creative-suite-switcher" aria-label="Chuyển công cụ Sáng tạo">
      <button class="creative-suite-brand" type="button" data-app-route="/create" aria-label="Mở tổng quan Sáng tạo">
        <i>✦</i><span>Creative OS<small>Production workspace</small></span>
      </button>
      ${Object.entries(meta).map(([id, item]) => `
        <button type="button" class="${id === active ? "is-active" : ""}" style="--item-accent:${item.color}" data-app-route="${item.route}">
          <i>${item.icon}</i><span>${item.name}<small>${item.note}</small></span>
        </button>`).join("")}
      <span class="creative-suite-health"><i></i>Dữ liệu đã bật tự lưu</span>
    </nav>`;

  const workspaceStats = () => {
    const state = readState();
    const media = readJson("hh-media-center", {});
    const ai = readJson("hh-ai-center", {});
    return {
      projects: (state.creatorProjects || []).length,
      media: (media.items || []).length,
      workflows: (state.workflows || []).length,
      runs: (state.automationHistory || []).length,
      sessions: (ai.sessions || []).length
    };
  };

  const metricsMarkup = () => {
    const stats = workspaceStats();
    return `<div class="creative-metrics" aria-label="Thống kê Creative OS">
      <span><i>PR</i><b>${stats.projects}</b><small>Dự án</small></span>
      <span><i>MD</i><b>${stats.media}</b><small>Media</small></span>
      <span><i>WF</i><b>${stats.workflows}</b><small>Workflow</small></span>
      <span><i>RUN</i><b>${stats.runs}</b><small>Lần chạy</small></span>
      <span><i>AI</i><b>${stats.sessions}</b><small>Phiên AI</small></span>
    </div>`;
  };

  const decorateNavigation = () => {
    const group = [...document.querySelectorAll(".app-sidebar__group")].find((item) => item.querySelector('[data-app-route="/create"]'));
    if (!group) return;
    group.classList.remove("is-creative-group");
    group.style.removeProperty("--creative-group-count");
    group.querySelectorAll(".app-sidebar__subitem, .app-sidebar__studio-item").forEach((button) => {
      const id = Object.keys(meta).find((key) => button.dataset.appRoute?.endsWith(`/${key}`));
      if (!id) return;
      const item = meta[id];
      button.dataset.creativeIcon = item.icon;
      button.style.setProperty("--creative-item", item.color);
      button.title = `${item.name} · ${item.note}`;
      if (button.classList.contains("app-sidebar__subitem") && !button.querySelector("small")) {
        button.insertAdjacentHTML("beforeend", `<small>${escapeHtml(item.note)}</small>`);
      }
    });
  };

  const hubMarkup = () => {
    const stats = workspaceStats();
    const state = readState();
    const latest = (state.creatorProjects || []).slice(0, 3);
    return `<section class="creative-hub" data-creative-hub>
      <header class="creative-hub-hero">
        <div class="creative-hub-copy">
          <p><i></i>HH CREATIVE OPERATING SYSTEM</p>
          <h2>Biến ý tưởng thành <span>nội dung hoàn chỉnh</span></h2>
          <p class="creative-hub-lead">Một không gian để nghiên cứu, viết, quản lý media và tự động hóa quy trình xuất bản. Dữ liệu được lưu trên thiết bị của bạn.</p>
          <div class="creative-hub-actions">
            <button class="creative-primary" type="button" data-app-route="/create/creator-studio">Tạo dự án mới <span>→</span></button>
            <button type="button" data-app-route="/create/ai-center">Mở AI Center</button>
          </div>
        </div>
        <div class="creative-orbit" aria-hidden="true">
          <span class="orbit-core">HH<small>CREATIVE</small></span>
          ${Object.values(meta).map((item, index) => `<i style="--i:${index};--orbit-color:${item.color}">${item.icon}</i>`).join("")}
        </div>
      </header>
      ${metricsMarkup()}
      <section class="creative-launch-grid">
        ${Object.entries(meta).map(([id, item], index) => `
          <button type="button" class="creative-launch-card" style="--card-accent:${item.color};--delay:${index}" data-app-route="${item.route}">
            <span class="creative-launch-icon">${item.icon}</span>
            <span class="creative-launch-number">0${index + 1}</span>
            <strong>${item.name}</strong>
            <p>${item.description}</p>
            <span class="creative-launch-link">Mở workspace <b>↗</b></span>
          </button>`).join("")}
      </section>
      <section class="creative-command-deck">
        <div>
          <p class="creative-eyebrow">BẮT ĐẦU NHANH</p>
          <h3>Bạn muốn tạo nội dung gì hôm nay?</h3>
          <p>Nhập chủ đề, chọn quy trình rồi Creative OS sẽ chuyển dữ liệu đến đúng công cụ.</p>
        </div>
        <form data-creative-quick-form>
          <input data-creative-quick-input required placeholder="Ví dụ: Kênh YouTube về công nghệ AI cho người mới">
          <select data-creative-quick-target aria-label="Chọn quy trình">
            <option value="creator-studio">Tạo gói nội dung</option>
            <option value="ai-script">Viết kịch bản dài</option>
            <option value="ai-center">Phân tích với AI</option>
            <option value="ai-automation">Chạy workflow</option>
            <option value="media-center">Tìm media tham khảo</option>
          </select>
          <button class="creative-primary" type="submit">Bắt đầu</button>
        </form>
      </section>
      <section class="creative-hub-bottom">
        <article>
          <header><div><p class="creative-eyebrow">DỰ ÁN GẦN ĐÂY</p><h3>Tiếp tục công việc</h3></div><span>${stats.projects} dự án</span></header>
          <div class="creative-recent-list">
            ${latest.length ? latest.map((project) => `<button type="button" data-creative-open-project="${escapeHtml(project.id)}"><i>CS</i><span><strong>${escapeHtml(project.data?.name || "Dự án nội dung")}</strong><small>${escapeHtml(project.data?.topic || "Chưa có chủ đề")}</small></span><time>${new Date(project.updated).toLocaleDateString("vi-VN")}</time></button>`).join("") : `<div class="creative-empty"><i>＋</i><span><strong>Chưa có dự án</strong><small>Mở Creator Studio để tạo dự án đầu tiên.</small></span></div>`}
          </div>
        </article>
        <article class="creative-system-card">
          <p class="creative-eyebrow">TRẠNG THÁI HỆ THỐNG</p>
          <h3>Sẵn sàng sản xuất</h3>
          <ul>
            <li><i></i><span>Tự lưu dự án</span><b>Đang bật</b></li>
            <li><i></i><span>Thư viện media</span><b>${stats.media} mục</b></li>
            <li><i></i><span>Pipeline đã lưu</span><b>${stats.workflows}</b></li>
            <li><i></i><span>Google / YouTube API</span><b>Qua máy chủ</b></li>
          </ul>
        </article>
      </section>
    </section>`;
  };

  const mountHub = () => {
    if (routeNow() !== "/create") return;
    const workspace = document.getElementById("appWorkspace");
    if (!workspace) return;
    if (window.HHCreativeOS?.mount) {
      workspace.querySelector("[data-creative-hub]")?.remove();
      return;
    }
    if (workspace.querySelector("[data-creative-hub]")) return;
    workspace.innerHTML = hubMarkup();
  };

  const mountScriptStudio = async (host = document.querySelector("[data-ai-script-host]")) => {
    if (!host || host.dataset.aiScriptMounted === "loading" || host.dataset.aiScriptMounted === "ready") return;
    host.dataset.aiScriptMounted = "loading";
    host.classList.add("creative-ai-script-host", "tool-neon-page");
    host.innerHTML = `${switcherMarkup("ai-script")}<section class="creative-ai-script-stage"><div class="creative-ai-script-loading"><i></i><strong>Đang tải toàn bộ workspace Kịch bản AI...</strong><span>Biên tập · Gemini Writer · Chat · Batch · URL · Dịch · Training · Dự án</span></div></section>`;
    const stage = host.querySelector(".creative-ai-script-stage");
    try {
      const response = await fetch("projects/kich-ban-ai/index.html", { cache: "no-store" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const documentSource = new DOMParser().parseFromString(await response.text(), "text/html");
      const app = documentSource.querySelector(".neon-app");
      if (!app) throw new Error("Không tìm thấy giao diện Kịch bản AI.");
      const title = app.querySelector(".neon-title");
      if (title) {
        title.href = "#/create";
        title.textContent = "Kịch bản AI · Creative OS";
      }
      stage.replaceChildren(app);
      host.dataset.aiScriptMounted = "ready";
      window.dispatchEvent(new CustomEvent("hh:ai-script-mounted"));
      const pending = readState().pending;
      if (pending?.target === "ai-script") {
        const source = host.querySelector("#sourceText");
        const titleField = host.querySelector("#storyTitle");
        if (source) source.value = pending.content || "";
        if (titleField && pending.content) titleField.value = pending.content.slice(0, 100);
        source?.dispatchEvent(new Event("input", { bubbles: true }));
        updateState({ pending: null });
      }
    } catch (error) {
      host.dataset.aiScriptMounted = "error";
      stage.innerHTML = `<div class="creative-error"><strong>Không thể mở Kịch bản AI</strong><p>${escapeHtml(error.message)}</p><button type="button" data-creative-script-retry>Thử lại</button><a href="projects/kich-ban-ai/" target="_blank" rel="noopener">Mở bản độc lập</a></div>`;
    }
  };

  const installCommon = (panel, id) => {
    if (!panel || panel.dataset.creativeEnhanced === "v4") return false;
    panel.dataset.creativeEnhanced = "v4";
    panel.dataset.creativeKind = meta[id].kind;
    panel.classList.add("creative-suite-panel");
    panel.insertAdjacentHTML("afterbegin", `${switcherMarkup(id)}${metricsMarkup()}`);
    return true;
  };

  const updateAIWords = (panel) => {
    const value = [...panel.querySelectorAll("textarea")].map((item) => item.value).join(" ").trim();
    const words = value ? value.split(/\s+/).length : 0;
    const badge = panel.querySelector("[data-creative-ai-words]");
    if (badge) badge.textContent = `${words} từ · khoảng ${Math.max(1, Math.ceil(words * 1.35))} token`;
  };

  const enhanceAI = (panel) => {
    if (!installCommon(panel, "ai-center")) return;
    panel.querySelector(".ai-center-toolbar")?.insertAdjacentHTML("afterend", `
      <div class="creative-utility-bar">
        <strong><span>AI Workspace</span><small>Tài liệu và phiên làm việc</small></strong>
        <label>Nhập tài liệu<input type="file" data-creative-ai-import accept=".txt,.md,.csv,.json,.html,text/*"></label>
        <button type="button" data-creative-ai-snapshot>Lưu bản nháp</button>
        <button type="button" data-creative-ai-restore>Khôi phục</button>
        <button type="button" data-creative-ai-export>Xuất workspace</button>
        <button type="button" data-creative-ai-reset>Đặt lại</button>
        <span class="creative-status-pill" data-creative-ai-words>0 từ</span>
      </div>`);
    panel.querySelector(".ai-sidebar")?.insertAdjacentHTML("beforeend", `
      <section class="creative-library">
        <header><div><strong>Thư viện prompt</strong><small>Dùng ngay và tùy chỉnh</small></div><span>${Object.keys(promptTemplates).length} mẫu</span></header>
        <div>${Object.entries(promptTemplates).map(([id, item]) => `
          <button type="button" class="creative-template" data-creative-ai-template="${id}">
            <i>${item.icon}</i><span><strong>${item.title}</strong><small>${item.note}</small></span>
          </button>`).join("")}</div>
      </section>`);
    const draft = readState().aiDraft;
    const input = panel.querySelector("[data-ai-chat-input]");
    if (input && !input.value && draft?.input) input.value = draft.input;
    updateAIWords(panel);
  };

  const readCreatorFields = (panel) => ({
    name: panel.querySelector("[data-creative-project-name]")?.value.trim() || "Dự án nội dung",
    topic: panel.querySelector("[data-creator-topic]")?.value.trim() || "",
    platform: panel.querySelector("[data-creator-platform]")?.value || "YouTube",
    length: panel.querySelector("[data-creator-length]")?.value || "8-12 phút",
    audience: panel.querySelector("[data-creator-audience]")?.value.trim() || "Người xem phổ thông",
    tone: panel.querySelector("[data-creator-tone]")?.value || "Cảm xúc",
    keyword: panel.querySelector("[data-creative-keyword]")?.value.trim() || "",
    cta: panel.querySelector("[data-creative-cta]")?.value.trim() || "Theo dõi để xem phần tiếp theo",
    format: panel.querySelector("[data-creative-format]")?.value || "Video dài",
    language: panel.querySelector("[data-creative-language]")?.value || "Tiếng Việt"
  });

  const buildCreatorPack = (data) => {
    const keyword = data.keyword || data.topic;
    const hashtags = [...new Set(["HHCreator", data.platform.replace(/\W/g, ""), ...keyword.split(/\s+/).filter((word) => word.length > 3)])]
      .slice(0, 10).map((tag) => `#${tag.replace(/[^\p{L}\p{N}_]/gu, "")}`).join(" ");
    const outline = [
      "1. Hook tạo khoảng trống tò mò",
      "2. Bối cảnh và vấn đề thực tế",
      "3. Ba luận điểm có ví dụ cụ thể",
      "4. Bước ngoặt hoặc insight chính",
      `5. Kết luận và CTA: ${data.cta}`
    ].join("\n");
    return {
      title: [`${data.topic}: Sự Thật Ít Người Biết`, `Tôi Đã Thử ${data.topic} Và Đây Là Kết Quả`, `7 Điều Quan Trọng Về ${data.topic}`].join("\n"),
      script: `HOOK\nNếu điều bạn vẫn tin về ${data.topic.toLowerCase()} chưa hoàn toàn đúng thì sao?\n\nMỞ ĐẦU\nĐặt bối cảnh phù hợp với ${data.audience}.\n\nNỘI DUNG\n${outline}\n\nKẾT\nTóm lại giá trị cốt lõi. ${data.cta}.`,
      seo: `Từ khóa chính: ${keyword}\nTừ khóa phụ: ${data.topic}, ${data.platform}, ${data.format}\nĐề xuất: đặt từ khóa trong tiêu đề, 120 ký tự đầu mô tả và chapter đầu tiên.\nHashtag: ${hashtags}`,
      thumbnail: `Bố cục 16:9, một chủ thể rõ, biểu cảm mạnh, tương phản cyan - magenta - vàng, chữ 3-5 từ “${data.topic.slice(0, 28).toUpperCase()}”, không watermark.`,
      description: `${data.topic} được trình bày theo phong cách ${data.tone.toLowerCase()} dành cho ${data.audience}.\n\nNội dung gồm ví dụ thực tế, insight chính và các bước áp dụng.\n\n${data.cta}\n\n${hashtags}`,
      outline,
      chapters: ["00:00 Mở đầu", "00:30 Vấn đề chính", "02:15 Bối cảnh", "04:00 Ba điểm quan trọng", "07:20 Bước ngoặt", "09:30 Kết luận"].join("\n"),
      shorts: `HOOK 0-3s: “Bạn có đang hiểu sai về ${data.topic}?”\nVALUE 3-45s: Nêu một insight, một ví dụ và một bước hành động.\nCTA 45-60s: ${data.cta}`,
      calendar: Array.from({ length: 7 }, (_, index) => `Ngày ${index + 1}: ${["Video chính", "Short trích đoạn", "Bài hỏi đáp", "Carousel insight", "Hậu trường", "Case study", "Tổng kết tuần"][index]} · ${data.topic}`).join("\n")
    };
  };

  const applyCreatorPack = (panel, data, pack, message) => {
    panel.dataset.outputs = JSON.stringify(pack);
    const output = panel.querySelector("[data-creator-output]");
    if (output) output.textContent = pack.title || pack.script || "Gói nội dung đã sẵn sàng.";
    const preview = panel.querySelector("[data-thumbnail-preview] small");
    if (preview) preview.textContent = data.topic.slice(0, 42);
    const tags = panel.querySelector("[data-creator-tags]");
    if (tags) {
      tags.innerHTML = (String(pack.seo || "").match(/#[^\s]+/g) || ["#HHCreator"])
        .slice(0, 10)
        .map((tag) => `<span>${escapeHtml(tag)}</span>`)
        .join("");
    }
    updateCreatorQuality(panel, data, pack);
    saveCreatorProject(panel, pack);
    refreshMetrics();
    toast(message);
  };

  const creatorChecks = (data, pack) => {
    const checks = [
      ["Chủ đề đủ rõ", data.topic.length >= 12],
      ["Có từ khóa chính", Boolean(data.keyword)],
      ["Tiêu đề dễ đọc", (pack.title || "").split("\n")[0]?.length <= 70],
      ["Có CTA", data.cta.length > 8],
      ["Có nội dung đa định dạng", Boolean(pack.shorts && pack.calendar)]
    ];
    return { checks, score: Math.round(checks.filter((item) => item[1]).length / checks.length * 100) };
  };

  const updateCreatorQuality = (panel, data, pack) => {
    const { checks, score } = creatorChecks(data, pack);
    const scoreNode = panel.querySelector("[data-creator-score]");
    if (scoreNode) scoreNode.textContent = score;
    const quality = panel.querySelector("[data-creative-quality]");
    if (quality) quality.textContent = `${score}%`;
    const list = panel.querySelector("[data-creative-quality-list]");
    if (list) list.innerHTML = checks.map(([label, ok]) => `<span class="${ok ? "ok" : ""}"><i></i>${escapeHtml(label)}<b>${ok ? "Đạt" : "Thiếu"}</b></span>`).join("");
  };

  const refreshCreatorProjects = (panel) => {
    const projects = readState().creatorProjects || [];
    const list = panel.querySelector("[data-creative-project-list]");
    if (list) list.innerHTML = `<option value="">Chọn dự án đã lưu...</option>${projects.map((item) => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.data?.name || "Dự án")} · ${new Date(item.updated).toLocaleDateString("vi-VN")}</option>`).join("")}`;
    const count = panel.querySelector("[data-creative-project-count]");
    if (count) count.textContent = `${projects.length} dự án`;
  };

  const saveCreatorProject = (panel, pack = null) => {
    const data = readCreatorFields(panel);
    if (!data.topic) {
      panel.querySelector("[data-creator-topic]")?.focus();
      toast("Hãy nhập chủ đề trước khi lưu.", "warning");
      return null;
    }
    const state = readState();
    const projects = state.creatorProjects || [];
    const id = panel.dataset.creativeProjectId || `creator-${Date.now()}`;
    const savedPack = pack || (() => {
      try { return JSON.parse(panel.dataset.outputs || "{}"); } catch { return {}; }
    })();
    const entry = { id, updated: new Date().toISOString(), data, pack: savedPack };
    state.creatorProjects = [entry, ...projects.filter((item) => item.id !== id)].slice(0, 40);
    writeState(state);
    panel.dataset.creativeProjectId = id;
    refreshCreatorProjects(panel);
    return entry;
  };

  const loadCreatorProject = (panel, id) => {
    if (!panel || !id) return;
    const item = (readState().creatorProjects || []).find((entry) => entry.id === id);
    if (!item) return;
    const selectors = {
      name: "[data-creative-project-name]",
      topic: "[data-creator-topic]",
      platform: "[data-creator-platform]",
      length: "[data-creator-length]",
      audience: "[data-creator-audience]",
      tone: "[data-creator-tone]",
      keyword: "[data-creative-keyword]",
      cta: "[data-creative-cta]",
      format: "[data-creative-format]",
      language: "[data-creative-language]"
    };
    Object.entries(selectors).forEach(([key, selector]) => {
      const field = panel.querySelector(selector);
      if (field && item.data?.[key] != null) field.value = item.data[key];
    });
    panel.dataset.outputs = JSON.stringify(item.pack || {});
    panel.dataset.creativeProjectId = item.id;
    const output = panel.querySelector("[data-creator-output]");
    if (output) output.textContent = item.pack?.title || "Dự án đã được tải.";
    updateCreatorQuality(panel, item.data || {}, item.pack || {});
    toast(`Đã mở ${item.data?.name || "dự án"}.`);
  };

  const enhanceCreator = (panel) => {
    if (!installCommon(panel, "creator-studio")) return;
    panel.querySelector(".suite-hero")?.insertAdjacentHTML("afterend", `
      <div class="creator-project-bar creative-utility-bar">
        <input data-creative-project-name value="Dự án nội dung mới" aria-label="Tên dự án">
        <select data-creative-project-list aria-label="Dự án đã lưu"><option value="">Chọn dự án đã lưu...</option></select>
        <button type="button" data-creative-project-save>Lưu dự án</button>
        <button type="button" data-creative-project-package>Xuất JSON</button>
      </div>`);
    panel.querySelector(".creator-fields")?.insertAdjacentHTML("afterend", `
      <div class="creator-advanced-fields">
        <label>Từ khóa chính<input data-creative-keyword placeholder="Từ khóa cần xếp hạng"></label>
        <label>CTA<input data-creative-cta value="Theo dõi để xem phần tiếp theo"></label>
        <label>Định dạng<select data-creative-format><option>Video dài</option><option>Short / Reel</option><option>Podcast</option><option>Bài viết</option><option>Carousel</option></select></label>
        <label>Ngôn ngữ<select data-creative-language><option>Tiếng Việt</option><option>English</option><option>Song ngữ Việt - Anh</option></select></label>
      </div>
      <div class="creative-utility-bar creator-production-bar">
        <strong><span>Production Engine</span><small>Tạo và nghiên cứu nội dung</small></strong>
        <select data-creative-research-provider aria-label="Nguồn nghiên cứu"><option value="youtube">YouTube</option><option value="google">Google</option></select>
        <select data-creative-research-order aria-label="Xếp hạng YouTube"><option value="relevance">Liên quan</option><option value="viewCount">Nhiều lượt xem</option><option value="date">Mới nhất</option><option value="rating">Đánh giá cao</option></select>
        <select data-creative-research-duration aria-label="Thời lượng video"><option value="any">Mọi thời lượng</option><option value="short">Dưới 4 phút</option><option value="medium">4-20 phút</option><option value="long">Trên 20 phút</option></select>
        <button type="button" data-creative-research>Tìm nội dung thật</button>
        <button type="button" data-creative-generate-pack>Tạo nhanh local</button>
        <button class="is-primary" type="button" data-creative-generate-ai>Tạo bằng Gemini 3.5</button>
        <button type="button" data-creative-copy-pack>Sao chép tất cả</button>
      </div>
      <section class="creative-research-results" data-creative-research-results hidden></section>`);
    const tabs = panel.querySelector(".creator-output-tabs");
    [["description", "Mô tả"], ["outline", "Outline"], ["chapters", "Chapters"], ["shorts", "Shorts"], ["calendar", "Lịch 7 ngày"]].forEach(([id, label]) => {
      if (!tabs?.querySelector(`[data-creator-output-tab="${id}"]`)) tabs?.insertAdjacentHTML("beforeend", `<button class="interactive" type="button" data-creator-output-tab="${id}">${label}</button>`);
    });
    panel.querySelector(".creator-inspector")?.insertAdjacentHTML("beforeend", `
      <div class="creator-inspector-stack">
        <section><header><strong>Quality gate</strong><span data-creative-quality>0%</span></header><div class="creator-check-list" data-creative-quality-list></div></section>
        <section><header><strong>Kho dự án</strong><span data-creative-project-count>0 dự án</span></header><p>Tự lưu tối đa 40 dự án trên thiết bị.</p></section>
      </div>`);
    const transfer = localStorage.getItem("hh-creative-transfer");
    if (transfer) {
      const topic = panel.querySelector("[data-creator-topic]");
      if (topic && !topic.value) topic.value = transfer.split(/\r?\n/).find((line) => line.trim())?.slice(0, 140) || "Nội dung được chuyển tới";
      const output = panel.querySelector("[data-creator-output]");
      if (output) output.textContent = transfer;
      localStorage.removeItem("hh-creative-transfer");
    }
    const pending = readState().pending;
    if (pending?.target === "creator-studio") {
      const topic = panel.querySelector("[data-creator-topic]");
      if (topic && !topic.value) topic.value = pending.content || "";
      updateState({ pending: null });
    }
    refreshCreatorProjects(panel);
    const projectToOpen = readState().projectToOpen;
    if (projectToOpen) {
      loadCreatorProject(panel, projectToOpen);
      updateState({ projectToOpen: null });
    }
  };

  const mediaCards = (panel) => [...panel.querySelectorAll(".media-card")];
  const selectedMedia = (panel) => [...panel.querySelectorAll("[data-creative-media-select]:checked")].map((input) => input.value);

  const enhanceMediaItems = (panel) => {
    panel.querySelectorAll(".media-card").forEach((card) => {
      if (!card.querySelector(".media-select-box")) {
        card.insertAdjacentHTML("afterbegin", `<label class="media-select-box"><input type="checkbox" data-creative-media-select="${escapeHtml(card.dataset.mediaId)}" aria-label="Chọn media"></label>`);
      }
    });
  };

  const updateMediaSelection = (panel) => {
    const node = panel?.querySelector("[data-creative-media-count]");
    if (node) node.textContent = selectedMedia(panel).length;
  };

  const analyzeMedia = (panel, notify = true) => {
    const counts = { image: 0, video: 0, audio: 0, link: 0 };
    mediaCards(panel).forEach((card) => {
      const text = `${card.dataset.mediaCategory || ""} ${card.dataset.mediaSearchText || ""}`;
      const type = text.includes("image") || text.includes("ảnh") ? "image" : text.includes("video") || text.includes("short") ? "video" : text.includes("audio") || text.includes("music") || text.includes("podcast") ? "audio" : "link";
      counts[type] += 1;
    });
    const stats = panel.querySelector("[data-creative-media-stats]");
    if (stats) stats.innerHTML = `<dt>Ảnh</dt><dd>${counts.image}</dd><dt>Video</dt><dd>${counts.video}</dd><dt>Âm thanh</dt><dd>${counts.audio}</dd><dt>Liên kết</dt><dd>${counts.link}</dd>`;
    const health = panel.querySelector("[data-creative-media-health]");
    if (health) health.textContent = `${mediaCards(panel).length} mục · Đã đồng bộ`;
    if (notify) toast("Đã phân tích và cập nhật thống kê thư viện.");
  };

  const enhanceMedia = (panel) => {
    if (!panel) return;
    if (!installCommon(panel, "media-center")) {
      enhanceMediaItems(panel);
      return;
    }
    panel.querySelector(".media-command-bar")?.insertAdjacentHTML("afterend", `
      <div class="creative-utility-bar">
        <strong><span>Media Operations</span><small>Quản lý và khai thác thư viện</small></strong>
        <button type="button" data-creative-media-batch>Chọn hàng loạt</button>
        <button type="button" data-creative-media-analyze>Phân tích thư viện</button>
        <button type="button" data-creative-media-export>Xuất manifest</button>
        <label>Nhập manifest<input type="file" data-creative-media-import accept="application/json,.json"></label>
      </div>
      <div class="media-batch-bar" data-creative-media-batch-bar>
        <strong><span data-creative-media-count>0</span> mục đã chọn</strong>
        <button type="button" data-creative-media-favorite>Thêm yêu thích</button>
        <button type="button" data-creative-media-download>Tải ảnh khả dụng</button>
        <button type="button" data-creative-media-cancel>Hủy</button>
      </div>
      <section class="creative-media-discovery">
        <header><div><p class="creative-eyebrow">DISCOVERY</p><h3>Tìm media tham khảo</h3></div><span>Tìm qua API máy chủ, không lộ khóa trên trình duyệt</span></header>
        <form data-creative-media-search-form>
          <input data-creative-media-query required placeholder="Tìm video YouTube hoặc hình ảnh Google...">
          <select data-creative-media-provider aria-label="Nguồn tìm kiếm"><option value="youtube">YouTube</option><option value="google">Google Images</option></select>
          <select data-creative-media-order aria-label="Xếp hạng"><option value="relevance">Liên quan</option><option value="viewCount">Nhiều lượt xem</option><option value="date">Mới nhất</option><option value="rating">Đánh giá cao</option></select>
          <select data-creative-media-duration aria-label="Thời lượng"><option value="any">Mọi thời lượng</option><option value="short">Dưới 4 phút</option><option value="medium">4-20 phút</option><option value="long">Trên 20 phút</option></select>
          <button class="is-primary" type="submit">Tìm media</button>
        </form>
        <div class="creative-search-results" data-creative-media-results hidden></div>
      </section>`);
    panel.querySelector(".media-sidebar")?.insertAdjacentHTML("beforeend", `
      <section class="media-inspector">
        <header><strong>Library Intelligence</strong><span data-creative-media-health>Sẵn sàng</span></header>
        <dl data-creative-media-stats><dt>Ảnh</dt><dd>0</dd><dt>Video</dt><dd>0</dd><dt>Âm thanh</dt><dd>0</dd><dt>Liên kết</dt><dd>0</dd></dl>
      </section>`);
    const pending = readState().pending;
    if (pending?.target === "media-center") {
      const query = panel.querySelector("[data-creative-media-query]");
      if (query) query.value = pending.content || "";
      updateState({ pending: null });
    }
    enhanceMediaItems(panel);
    analyzeMedia(panel, false);
  };

  const captureAutomation = (panel) => ({
    input: panel.querySelector("[data-auto-input]")?.value || "",
    platform: panel.querySelector("[data-auto-platform]")?.value || "YouTube",
    language: panel.querySelector("[data-auto-language]")?.value || "Tiếng Việt",
    style: panel.querySelector("[data-auto-style]")?.value || "Cảm xúc",
    steps: [...panel.querySelectorAll("[data-auto-step]")].map((item) => ({ id: item.dataset.autoStep, enabled: item.checked }))
  });

  const applyAutomation = (panel, config) => {
    if (!panel || !config) return;
    [
      ["[data-auto-input]", config.input],
      ["[data-auto-platform]", config.platform],
      ["[data-auto-language]", config.language],
      ["[data-auto-style]", config.style]
    ].forEach(([selector, value]) => {
      const field = panel.querySelector(selector);
      if (field && value != null) field.value = value;
    });
    const enabled = new Map((config.steps || []).map((item) => [item.id, item.enabled]));
    panel.querySelectorAll("[data-auto-step]").forEach((item) => {
      if (enabled.has(item.dataset.autoStep)) item.checked = enabled.get(item.dataset.autoStep);
    });
  };

  const refreshAutomationHistory = (panel) => {
    const history = readState().automationHistory || [];
    const list = panel.querySelector("[data-creative-auto-history]");
    if (list) list.innerHTML = history.length
      ? history.slice(0, 10).map((item, index) => `<button type="button" data-creative-auto-history-item="${index}"><span><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(item.summary || "")}</small></span><time>${escapeHtml(item.time)}</time></button>`).join("")
      : `<div class="creative-empty"><i>⌁</i><span><strong>Chưa có lần chạy</strong><small>Kết quả pipeline sẽ xuất hiện tại đây.</small></span></div>`;
  };

  const enhanceAutomation = (panel) => {
    if (!installCommon(panel, "ai-automation")) return;
    panel.querySelector(".suite-hero")?.insertAdjacentHTML("afterend", `
      <div class="automation-preset-bar creative-utility-bar">
        <strong><span>Workflow Control</span><small>Preset và dữ liệu pipeline</small></strong>
        <select data-creative-auto-preset>
          <option value="youtube">YouTube Production</option>
          <option value="shorts">Shorts Factory</option>
          <option value="article">Article Publisher</option>
          <option value="translate">Translate & Voice</option>
          <option value="campaign">Full Campaign</option>
        </select>
        <select data-creative-auto-model aria-label="Model AI"><option value="gemini-3.5-flash">Gemini 3.5 Flash</option><option value="gemini-3.1-flash-lite">Gemini 3.1 Flash Lite</option><option value="local">HH Local</option></select>
        <button type="button" data-creative-auto-apply>Áp dụng preset</button>
        <button class="is-primary" type="button" data-creative-auto-run-ai>Chạy pipeline AI</button>
        <button type="button" data-creative-auto-save>Lưu workflow</button>
        <button type="button" data-creative-auto-load>Tải workflow gần nhất</button>
        <button type="button" data-creative-auto-import>Nhập</button>
        <button type="button" data-creative-auto-export>Xuất JSON</button>
        <input type="file" data-creative-auto-file accept="application/json,.json" hidden>
      </div>`);
    panel.querySelectorAll(".automation-steps label").forEach((label) => {
      if (!label.querySelector(".automation-step-actions")) label.insertAdjacentHTML("beforeend", `<span class="automation-step-actions"><button type="button" data-creative-step-up title="Đưa lên">↑</button><button type="button" data-creative-step-down title="Đưa xuống">↓</button></span>`);
    });
    panel.querySelector(".automation-workspace")?.insertAdjacentHTML("beforeend", `
      <section class="automation-history">
        <header><div><strong>Lịch sử pipeline</strong><small>Tối đa 20 lần chạy</small></div><button type="button" data-creative-auto-clear-history>Dọn lịch sử</button></header>
        <div class="automation-history-list" data-creative-auto-history></div>
      </section>`);
    panel.querySelector(".automation-results")?.insertAdjacentHTML("beforeend", `
      <div class="creative-utility-bar automation-output-actions">
        <strong><span>Output</span></strong>
        <button type="button" data-creative-auto-copy-markdown>Copy Markdown</button>
        <button class="is-primary" type="button" data-creative-auto-send-creator>Gửi sang Creator</button>
      </div>`);
    const pending = readState().pending;
    if (pending?.target === "ai-automation") {
      const input = panel.querySelector("[data-auto-input]");
      if (input) input.value = pending.content || "";
      updateState({ pending: null });
    }
    refreshAutomationHistory(panel);
  };

  const searchApi = async (provider, query, options = {}) => {
    const params = new URLSearchParams({ q: query });
    if (provider === "google" && options.images) params.set("kind", "images");
    Object.entries(options).forEach(([key, value]) => {
      if (key === "images" || value == null || value === "" || value === "any") return;
      params.set(key, String(value));
    });
    const base = String(window.HH_REALTIME_URL || location.origin).replace(/\/$/, "");
    const response = await fetch(`${base}/api/search/${provider}?${params}`);
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "Dịch vụ tìm kiếm chưa sẵn sàng.");
    return data;
  };

  const creativeRequest = async (moduleId, input, actionType, meta = {}) => {
    const base = String(window.HH_REALTIME_URL || location.origin).replace(/\/$/, "");
    const token = window.HHAuthSession?.token?.() || "";
    let anonymousId = localStorage.getItem("hh-anonymous-id");
    if (!anonymousId) {
      anonymousId = crypto.randomUUID?.() || `guest-${Date.now()}-${Math.random().toString(16).slice(2)}`;
      localStorage.setItem("hh-anonymous-id", anonymousId);
    }
    const response = await fetch(`${base}/api/modules/${encodeURIComponent(moduleId)}/actions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      body: JSON.stringify({ input, actionType, meta, anonymousId })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "Creative AI chưa phản hồi.");
    return data.action || {};
  };

  const renderResearchResults = (container, provider, items) => {
    container.hidden = false;
    container.innerHTML = `<header><strong>Kết quả nghiên cứu ${provider === "youtube" ? "YouTube" : "Google"}</strong><span>${items.length} kết quả</span></header>
      <div>${items.slice(0, 6).map((item) => {
        const title = item.title || "Không có tiêu đề";
        const href = provider === "youtube" ? `https://www.youtube.com/watch?v=${item.id}` : item.url;
        const note = provider === "youtube" ? `${item.channel || "YouTube"} · ${Number(item.views || 0).toLocaleString("vi-VN")} lượt xem` : item.displayUrl || item.snippet || "";
        return `<a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer"><span><strong>${escapeHtml(title)}</strong><small>${escapeHtml(note)}</small></span><b>↗</b></a>`;
      }).join("")}</div>`;
  };

  const renderMediaResults = (container, provider, items) => {
    container.hidden = false;
    container.innerHTML = items.length ? items.slice(0, 9).map((item, index) => {
      const title = item.title || "Media tham khảo";
      const url = provider === "youtube" ? `https://www.youtube.com/watch?v=${item.id}` : item.originalImage || item.image || item.url;
      const thumb = provider === "youtube" ? item.thumbnail : item.image || item.originalImage;
      const category = provider === "youtube" ? "videos" : "images";
      return `<article>
        <div class="creative-result-cover">${thumb ? `<img src="${escapeHtml(thumb)}" alt="">` : `<span>${provider === "youtube" ? "▶" : "IMG"}</span>`}</div>
        <div><strong>${escapeHtml(title)}</strong><small>${escapeHtml(provider === "youtube" ? item.channel || "YouTube" : item.displayUrl || "Google Images")}</small></div>
        <button type="button" data-creative-add-media="${index}" data-media-title="${escapeHtml(title)}" data-media-url="${escapeHtml(url)}" data-media-category="${category}">+ Thêm thư viện</button>
      </article>`;
    }).join("") : `<div class="creative-empty"><i>?</i><span><strong>Không tìm thấy kết quả</strong><small>Hãy thử từ khóa khác.</small></span></div>`;
  };

  const refreshMetrics = () => {
    document.querySelectorAll(".creative-metrics").forEach((node) => {
      const next = document.createRange().createContextualFragment(metricsMarkup()).firstElementChild;
      node.replaceWith(next);
    });
  };

  const enhanceAll = () => {
    decorateNavigation();
    mountHub();
    mountScriptStudio();
    enhanceAI(document.querySelector("[data-ai-center]"));
    enhanceCreator(document.querySelector("[data-creator]"));
    enhanceMedia(document.querySelector("[data-media-center]"));
    enhanceAutomation(document.querySelector("[data-automation]"));
  };

  document.addEventListener("input", (event) => {
    const ai = event.target.closest("[data-ai-center]");
    if (ai) {
      updateAIWords(ai);
      if (event.target.matches("[data-ai-chat-input]")) {
        clearTimeout(window.__hhCreativeDraftTimer);
        window.__hhCreativeDraftTimer = setTimeout(() => updateState({ aiDraft: { input: event.target.value, savedAt: new Date().toISOString() } }), 450);
      }
    }
    if (event.target.matches("[data-creative-media-select]")) updateMediaSelection(event.target.closest("[data-media-center]"));
  });

  document.addEventListener("change", async (event) => {
    if (event.target.matches("[data-creative-project-list]")) {
      loadCreatorProject(event.target.closest("[data-creator]"), event.target.value);
      return;
    }
    if (event.target.matches("[data-creative-ai-import]")) {
      const panel = event.target.closest("[data-ai-center]");
      const file = event.target.files?.[0];
      if (!panel || !file) return;
      if (file.size > 4 * 1024 * 1024) return toast("Tài liệu cần nhỏ hơn 4 MB.", "warning");
      const input = panel.querySelector("[data-ai-chat-input]");
      if (input) input.value = await file.text();
      updateAIWords(panel);
      toast(`Đã nhập ${file.name}.`);
      return;
    }
    if (event.target.matches("[data-creative-media-import]")) {
      const panel = event.target.closest("[data-media-center]");
      const file = event.target.files?.[0];
      if (!panel || !file) return;
      try {
        const manifest = JSON.parse(await file.text());
        const current = readJson("hh-media-center", {});
        const safeItems = (manifest.items || []).filter((item) => typeof item.url === "string" && !item.url.startsWith("blob:")).map((item, index) => ({
          ...item,
          id: item.id || `import-${Date.now()}-${index}`
        }));
        current.items = [...(current.items || []), ...safeItems];
        localStorage.setItem("hh-media-center", JSON.stringify(current));
        toast(`Đã nhập ${safeItems.length} media. Đang làm mới thư viện.`);
        setTimeout(() => {
          location.hash = "#/create";
          setTimeout(() => { location.hash = "#/create/media-center"; }, 30);
        }, 250);
      } catch {
        toast("Manifest JSON không hợp lệ.", "error");
      }
      return;
    }
    if (event.target.matches("[data-creative-auto-file]")) {
      const panel = event.target.closest("[data-automation]");
      const file = event.target.files?.[0];
      if (!panel || !file) return;
      try {
        applyAutomation(panel, JSON.parse(await file.text()));
        toast("Đã nhập workflow.");
      } catch {
        toast("Workflow JSON không hợp lệ.", "error");
      }
    }
  });

  document.addEventListener("submit", async (event) => {
    if (event.target.matches("[data-creative-quick-form]")) {
      event.preventDefault();
      const content = event.target.querySelector("[data-creative-quick-input]")?.value.trim();
      const target = event.target.querySelector("[data-creative-quick-target]")?.value;
      if (!content || !meta[target]) return;
      updateState({ pending: { target, content, createdAt: new Date().toISOString() } });
      location.hash = `#${meta[target].route}`;
      return;
    }
    if (event.target.matches("[data-creative-media-search-form]")) {
      event.preventDefault();
      const panel = event.target.closest("[data-media-center]");
      const query = event.target.querySelector("[data-creative-media-query]")?.value.trim();
      const provider = event.target.querySelector("[data-creative-media-provider]")?.value || "youtube";
      const results = panel?.querySelector("[data-creative-media-results]");
      if (!panel || !query || !results) return;
      results.hidden = false;
      results.innerHTML = `<div class="creative-loading"><i></i><span>Đang tìm media phù hợp...</span></div>`;
      try {
        const data = await searchApi(provider, query, {
          images: provider === "google",
          order: event.target.querySelector("[data-creative-media-order]")?.value || "relevance",
          duration: event.target.querySelector("[data-creative-media-duration]")?.value || "any"
        });
        renderMediaResults(results, provider, data.items || []);
      } catch (error) {
        results.innerHTML = `<div class="creative-error"><strong>Chưa thể tìm media</strong><p>${escapeHtml(error.message)}</p><small>Hãy cấu hình API Google/YouTube trên Vercel hoặc thử lại sau.</small></div>`;
      }
    }
  });

  document.addEventListener("click", async (event) => {
    if (event.target.closest("[data-creative-script-retry]")) {
      const host = event.target.closest("[data-ai-script-host]");
      if (host) {
        delete host.dataset.aiScriptMounted;
        mountScriptStudio(host);
      }
      return;
    }
    const openProject = event.target.closest("[data-creative-open-project]");
    if (openProject) {
      updateState({ projectToOpen: openProject.dataset.creativeOpenProject });
      location.hash = "#/create/creator-studio";
      return;
    }

    const ai = event.target.closest("[data-ai-center]");
    if (ai) {
      const template = event.target.closest("[data-creative-ai-template]");
      if (template) {
        const item = promptTemplates[template.dataset.creativeAiTemplate];
        const input = ai.querySelector("[data-ai-chat-input]");
        if (item && input) {
          input.value = item.prompt;
          input.focus();
          ai.querySelector('[data-ai-tab="chat"]')?.click();
          updateAIWords(ai);
        }
        return;
      }
      if (event.target.closest("[data-creative-ai-snapshot]")) {
        updateState({ aiDraft: { input: ai.querySelector("[data-ai-chat-input]")?.value || "", savedAt: new Date().toISOString() } });
        toast("Đã lưu bản nháp AI.");
        return;
      }
      if (event.target.closest("[data-creative-ai-restore]")) {
        const draft = readState().aiDraft;
        const input = ai.querySelector("[data-ai-chat-input]");
        if (!draft?.input) return toast("Chưa có bản nháp để khôi phục.", "warning");
        if (input) input.value = draft.input;
        updateAIWords(ai);
        toast("Đã khôi phục bản nháp.");
        return;
      }
      if (event.target.closest("[data-creative-ai-export]")) {
        download("hh-ai-workspace.json", JSON.stringify({
          version: 3,
          exportedAt: new Date().toISOString(),
          model: ai.querySelector("[data-ai-model]")?.value || "",
          draft: readState().aiDraft || {},
          result: ai.querySelector("[data-ai-result]")?.textContent || "",
          ai: readJson("hh-ai-center", {})
        }, null, 2));
        return;
      }
      if (event.target.closest("[data-creative-ai-reset]")) {
        ai.querySelectorAll("textarea,input[type=text],input[type=search]").forEach((field) => { field.value = ""; });
        updateState({ aiDraft: null });
        updateAIWords(ai);
        toast("Đã đặt lại vùng nhập AI.");
        return;
      }
    }

    const creator = event.target.closest("[data-creator]");
    if (creator) {
      const pendingProject = readState().projectToOpen;
      if (pendingProject && !creator.dataset.creativePendingLoaded) {
        creator.dataset.creativePendingLoaded = "true";
        loadCreatorProject(creator, pendingProject);
        updateState({ projectToOpen: null });
      }
      if (event.target.closest("[data-creative-generate-pack]")) {
        const data = readCreatorFields(creator);
        if (!data.topic) {
          creator.querySelector("[data-creator-topic]")?.focus();
          return toast("Hãy nhập chủ đề chính.", "warning");
        }
        const pack = buildCreatorPack(data);
        applyCreatorPack(creator, data, pack, "Đã tạo và tự lưu gói nội dung local.");
        return;
      }
      const generateAI = event.target.closest("[data-creative-generate-ai]");
      if (generateAI) {
        const data = readCreatorFields(creator);
        if (!data.topic) {
          creator.querySelector("[data-creator-topic]")?.focus();
          return toast("Hãy nhập chủ đề chính.", "warning");
        }
        generateAI.disabled = true;
        const original = generateAI.textContent;
        generateAI.textContent = "Gemini đang sản xuất...";
        try {
          const action = await creativeRequest("creator-studio", JSON.stringify(data), "content-pack", {
            model: "gemini-3.5-flash",
            platform: data.platform,
            config: data
          });
          let pack = action.structured;
          if (!pack && action.output) {
            try { pack = JSON.parse(action.output); } catch { pack = null; }
          }
          if (!pack || typeof pack !== "object") throw new Error("AI chưa trả về gói nội dung có cấu trúc.");
          applyCreatorPack(creator, data, pack, `Đã tạo bằng ${action.provider === "gemini" ? "Gemini 3.5" : "HH Local fallback"}.`);
        } catch (error) {
          applyCreatorPack(creator, data, buildCreatorPack(data), "Máy chủ AI chưa sẵn sàng; đã tạo gói local để bạn tiếp tục.");
          toast(error.message, "warning");
        } finally {
          generateAI.disabled = false;
          generateAI.textContent = original;
        }
        return;
      }
      if (event.target.closest("[data-creative-project-save]")) {
        saveCreatorProject(creator);
        refreshMetrics();
        toast("Đã lưu dự án trên thiết bị.");
        return;
      }
      if (event.target.closest("[data-creative-project-package]")) {
        download("hh-creator-project.json", JSON.stringify({
          version: 3,
          data: readCreatorFields(creator),
          pack: (() => { try { return JSON.parse(creator.dataset.outputs || "{}"); } catch { return {}; } })(),
          exportedAt: new Date().toISOString()
        }, null, 2));
        return;
      }
      if (event.target.closest("[data-creative-copy-pack]")) {
        const pack = (() => { try { return JSON.parse(creator.dataset.outputs || "{}"); } catch { return {}; } })();
        if (!Object.keys(pack).length) return toast("Hãy tạo gói nội dung trước.", "warning");
        await copyText(Object.entries(pack).map(([key, value]) => `${key.toUpperCase()}\n${value}`).join("\n\n---\n\n"));
        toast("Đã sao chép toàn bộ gói nội dung.");
        return;
      }
      if (event.target.closest("[data-creative-research]")) {
        const data = readCreatorFields(creator);
        if (!data.topic) return toast("Hãy nhập chủ đề cần nghiên cứu.", "warning");
        const provider = creator.querySelector("[data-creative-research-provider]")?.value || "youtube";
        const results = creator.querySelector("[data-creative-research-results]");
        results.hidden = false;
        results.innerHTML = `<div class="creative-loading"><i></i><span>Đang nghiên cứu ${escapeHtml(data.topic)}...</span></div>`;
        try {
          const response = await searchApi(provider, data.topic, {
            order: creator.querySelector("[data-creative-research-order]")?.value || "relevance",
            duration: creator.querySelector("[data-creative-research-duration]")?.value || "any"
          });
          renderResearchResults(results, provider, response.items || []);
        } catch (error) {
          results.innerHTML = `<div class="creative-error"><strong>Chưa thể nghiên cứu trực tuyến</strong><p>${escapeHtml(error.message)}</p><small>Công cụ tạo nội dung cục bộ vẫn sử dụng bình thường.</small></div>`;
        }
        return;
      }
    }

    const media = event.target.closest("[data-media-center]");
    if (media) {
      if (event.target.closest("[data-creative-media-batch]")) {
        media.classList.toggle("is-batch-mode");
        media.querySelector("[data-creative-media-batch-bar]")?.classList.toggle("is-active", media.classList.contains("is-batch-mode"));
        return;
      }
      if (event.target.closest("[data-creative-media-cancel]")) {
        media.classList.remove("is-batch-mode");
        media.querySelector("[data-creative-media-batch-bar]")?.classList.remove("is-active");
        media.querySelectorAll("[data-creative-media-select]").forEach((item) => { item.checked = false; });
        updateMediaSelection(media);
        return;
      }
      if (event.target.closest("[data-creative-media-analyze]")) {
        analyzeMedia(media);
        return;
      }
      if (event.target.closest("[data-creative-media-export]")) {
        const raw = readJson("hh-media-center", {});
        download("hh-media-manifest.json", JSON.stringify({ version: 3, exportedAt: new Date().toISOString(), items: raw.items || [], playlists: raw.playlists || [] }, null, 2));
        return;
      }
      if (event.target.closest("[data-creative-media-favorite]")) {
        const ids = selectedMedia(media);
        ids.forEach((id) => media.querySelector(`[data-media-favorite="${CSS.escape(id)}"]`)?.click());
        toast(`Đã cập nhật ${ids.length} mục yêu thích.`);
        return;
      }
      if (event.target.closest("[data-creative-media-download]")) {
        let count = 0;
        selectedMedia(media).forEach((id) => {
          const card = media.querySelector(`[data-media-id="${CSS.escape(id)}"]`);
          const source = card?.querySelector("img")?.src;
          if (source) {
            const anchor = document.createElement("a");
            anchor.href = source;
            anchor.download = card.querySelector("strong")?.textContent || "media";
            anchor.click();
            count += 1;
          }
        });
        toast(`Đã bắt đầu tải ${count} ảnh khả dụng.`);
        return;
      }
      const addMedia = event.target.closest("[data-creative-add-media]");
      if (addMedia) {
        const url = addMedia.dataset.mediaUrl;
        if (!url) return toast("Kết quả này không có URL khả dụng.", "warning");
        const dialog = media.querySelector("[data-media-dialog]");
        const title = media.querySelector("[data-media-url-title]");
        const input = media.querySelector("[data-media-url-input]");
        const category = media.querySelector("[data-media-url-category]");
        if (title) title.value = addMedia.dataset.mediaTitle || "Media tham khảo";
        if (input) input.value = url;
        if (category) category.value = addMedia.dataset.mediaCategory || "gallery";
        dialog?.showModal?.();
        toast("Đã điền thông tin. Kiểm tra rồi nhấn “Lưu media”.");
        return;
      }
    }

    const automation = event.target.closest("[data-automation]");
    if (automation) {
      if (event.target.closest("[data-creative-auto-apply]")) {
        const preset = automation.querySelector("[data-creative-auto-preset]")?.value;
        const enabled = new Set(automationPresets[preset] || []);
        automation.querySelectorAll("[data-auto-step]").forEach((item) => { item.checked = enabled.has(item.dataset.autoStep); });
        toast("Đã áp dụng preset pipeline.");
        return;
      }
      if (event.target.closest("[data-creative-step-up]")) {
        const label = event.target.closest("label");
        label?.previousElementSibling?.before(label);
        return;
      }
      if (event.target.closest("[data-creative-step-down]")) {
        const label = event.target.closest("label");
        const next = label?.nextElementSibling;
        if (next) next.after(label);
        return;
      }
      if (event.target.closest("[data-creative-auto-save]")) {
        const state = readState();
        const workflows = state.workflows || [];
        state.workflows = [{
          id: `workflow-${Date.now()}`,
          name: automation.querySelector("[data-creative-auto-preset]")?.selectedOptions[0]?.textContent || "Workflow",
          config: captureAutomation(automation),
          savedAt: new Date().toISOString()
        }, ...workflows].slice(0, 20);
        writeState(state);
        refreshMetrics();
        toast("Đã lưu workflow trên thiết bị.");
        return;
      }
      if (event.target.closest("[data-creative-auto-load]")) {
        const latest = readState().workflows?.[0];
        if (!latest) return toast("Chưa có workflow đã lưu.", "warning");
        applyAutomation(automation, latest.config);
        toast(`Đã tải ${latest.name}.`);
        return;
      }
      if (event.target.closest("[data-creative-auto-import]")) {
        automation.querySelector("[data-creative-auto-file]")?.click();
        return;
      }
      if (event.target.closest("[data-creative-auto-export]")) {
        download("hh-ai-workflow.json", JSON.stringify(captureAutomation(automation), null, 2));
        return;
      }
      if (event.target.closest("[data-creative-auto-clear-history]")) {
        updateState({ automationHistory: [] });
        refreshAutomationHistory(automation);
        refreshMetrics();
        return;
      }
      const historyItem = event.target.closest("[data-creative-auto-history-item]");
      if (historyItem) {
        const item = readState().automationHistory?.[Number(historyItem.dataset.creativeAutoHistoryItem)];
        if (item) {
          applyAutomation(automation, item.config);
          const output = automation.querySelector("[data-auto-output]");
          if (output) output.textContent = item.output;
        }
        return;
      }
      if (event.target.closest("[data-creative-auto-copy-markdown]")) {
        await copyText(automation.querySelector("[data-auto-output]")?.textContent || "");
        toast("Đã sao chép kết quả Markdown.");
        return;
      }
      if (event.target.closest("[data-creative-auto-send-creator]")) {
        const output = automation.querySelector("[data-auto-output]")?.textContent || "";
        if (!output.trim()) return toast("Chưa có kết quả để chuyển.", "warning");
        localStorage.setItem("hh-creative-transfer", output);
        location.hash = "#/create/creator-studio";
        return;
      }
      const runAI = event.target.closest("[data-creative-auto-run-ai]");
      if (runAI) {
        const config = captureAutomation(automation);
        if (!config.input.trim()) {
          automation.querySelector("[data-auto-input]")?.focus();
          return toast("Hãy nhập chủ đề hoặc nội dung cho pipeline.", "warning");
        }
        runAI.disabled = true;
        const original = runAI.textContent;
        runAI.textContent = "AI đang chạy pipeline...";
        const status = automation.querySelector("[data-auto-status]");
        const progress = automation.querySelector("[data-auto-progress]");
        if (status) status.textContent = "Đang gửi một tác vụ gộp để tiết kiệm quota...";
        if (progress) progress.style.width = "45%";
        try {
          const action = await creativeRequest("ai-automation", JSON.stringify(config), "workflow", {
            model: automation.querySelector("[data-creative-auto-model]")?.value || "gemini-3.5-flash",
            config
          });
          const output = automation.querySelector("[data-auto-output]");
          if (output) output.textContent = action.output || "Pipeline không trả về nội dung.";
          if (progress) progress.style.width = "100%";
          if (status) status.textContent = `Hoàn tất bằng ${action.provider === "gemini" ? action.model : "HH Local fallback"}`;
          const state = readState();
          state.automationHistory = [{
            title: `${config.platform} · AI · ${config.steps.filter((item) => item.enabled).length} bước`,
            summary: config.input.slice(0, 90),
            time: new Date().toLocaleString("vi-VN"),
            config,
            output: action.output || ""
          }, ...(state.automationHistory || [])].slice(0, 20);
          writeState(state);
          refreshAutomationHistory(automation);
          refreshMetrics();
          toast("Pipeline AI đã hoàn tất và được lưu vào lịch sử.");
        } catch (error) {
          if (status) status.textContent = error.message;
          if (progress) progress.style.width = "0%";
          toast(error.message, "warning");
        } finally {
          runAI.disabled = false;
          runAI.textContent = original;
        }
        return;
      }
      if (event.target.closest("[data-auto-run]")) {
        setTimeout(() => {
          const state = readState();
          const config = captureAutomation(automation);
          const output = automation.querySelector("[data-auto-output]")?.textContent || "";
          const history = state.automationHistory || [];
          state.automationHistory = [{
            title: `${config.platform} · ${config.steps.filter((item) => item.enabled).length} bước`,
            summary: config.input.slice(0, 90),
            time: new Date().toLocaleString("vi-VN"),
            config,
            output
          }, ...history].slice(0, 20);
          writeState(state);
          refreshAutomationHistory(automation);
          refreshMetrics();
        }, 30);
      }
    }
  });

  const observer = new MutationObserver(() => requestAnimationFrame(enhanceAll));
  observer.observe(document.documentElement, { childList: true, subtree: true });
  addEventListener("hashchange", () => setTimeout(enhanceAll));
  addEventListener("hh:workspace-open", () => setTimeout(enhanceAll));
  addEventListener("hh:modules-ready", () => setTimeout(enhanceAll));
  addEventListener("hh:assets-ready", () => {
    if (window.HHCreativeOS?.mount) document.querySelector("[data-creative-hub]")?.remove();
  });
  addEventListener("DOMContentLoaded", enhanceAll);
  setTimeout(enhanceAll, 300);

  window.HHCreativeSuite = {
    enhance: enhanceAll,
    mountHub,
    mountScriptStudio,
    readState,
    version: 5
  };
})();
