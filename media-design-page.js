(() => {
  "use strict";

  const STORAGE_KEY = "hh.media-design.page.v1";
  const TOOLS = [
    { id: "production-workflow", icon: "PW", name: "Production Workflow", group: "Dự án & tài nguyên", code: "PROD", description: "Media Bin dùng chung, timeline không phá hủy, phụ đề, review và render queue trung thực.", caps: ["Shared Media Bin", "Proxy adapter", "Subtitle", "Server render"] },
    { id: "universal-media", icon: "UM", name: "Universal Media Project", group: "Dự án & tài nguyên", code: "PROJECT", description: "Dự án media dùng chung cho ảnh, video, âm thanh, font, LUT và SVG.", caps: ["Media Bin", "Autosave", "Version history", ".hhmedia"] },
    { id: "asset-manager", icon: "AM", name: "Asset Manager", group: "Dự án & tài nguyên", code: "ASSET", description: "Quản lý metadata, thumbnail, file trùng, media offline, Smart Collection và proxy.", caps: ["Metadata", "Duplicate scan", "Smart Collection", "Proxy plan"] },
    { id: "photo-editor", icon: "✎", name: "Photo Editor", group: "Biên tập nâng cao", code: "PHOTO", description: "Chỉnh sửa ảnh nhiều lớp như một Photoshop thu gọn ngay trong trình duyệt.", caps: ["Layers", "Blend & filters", "Undo · Redo", "High-res export"] },
    { id: "video-editor", icon: "▶", name: "Video Editor", group: "Biên tập nâng cao", code: "RESOLVE", description: "Studio hậu kỳ tiếng Việt với Media, Cut, Edit, Fusion, Color, Fairlight và Deliver.", caps: ["Timeline nhiều rãnh", "Color & scopes", "Fusion nodes", "Fairlight mixer"] },
    { id: "background-remover", icon: "✂", name: "Background Remover", group: "Biên tập nâng cao", code: "CUT", description: "Xóa nền theo màu, lấy mẫu pixel và làm mềm đường biên.", caps: ["Color key", "Edge feather", "PNG alpha"] },
    { id: "collage", icon: "▦", name: "Collage Maker", group: "Biên tập nâng cao", code: "COL", description: "Ghép nhiều ảnh theo lưới, ảnh nổi bật hoặc dải ngang.", caps: ["12 images", "Smart cover", "High-res"] },
    { id: "inspector", icon: "⌕", name: "Image Inspector", group: "Biên tập nâng cao", code: "META", description: "Đọc EXIF, SHA-256, màu đại diện và xóa metadata.", caps: ["EXIF", "SHA-256", "Strip metadata"] },
    { id: "compress", icon: "⇣", name: "Image Compressor", group: "Hình ảnh", code: "IMG", description: "Nén nhiều ảnh, đặt dung lượng đích và tối ưu WebP/JPEG.", caps: ["Batch 20 ảnh", "Target size", "So sánh trước/sau"] },
    { id: "convert", icon: "⇄", name: "Image Converter", group: "Hình ảnh", code: "IMG", description: "Đổi định dạng hàng loạt, đổi kích thước và giữ chất lượng.", caps: ["PNG · JPEG · WebP", "Resize", "Tải hàng loạt"] },
    { id: "image", icon: "◫", name: "Image Toolkit", group: "Hình ảnh", code: "IMG", description: "Cắt, xoay, lật, cân chỉnh và áp dụng bộ lọc trực tiếp.", caps: ["Transform", "Filter presets", "Canvas preview"] },
    { id: "pdf", icon: "▤", name: "PDF Toolkit", group: "Tài liệu", code: "DOC", description: "Gộp, tách, xoay, watermark và chỉnh metadata PDF.", caps: ["Merge · Split", "Watermark", "Metadata"] },
    { id: "qr", icon: "⌗", name: "QR Toolkit", group: "Tài liệu", code: "QR", description: "Tạo QR tùy chỉnh hoặc quét QR từ ảnh trên thiết bị.", caps: ["Live QR", "Scan image", "PNG export"] },
    { id: "color", icon: "◉", name: "Color Studio", group: "Thương hiệu", code: "CLR", description: "Tạo bảng màu, trích màu từ ảnh và kiểm tra WCAG.", caps: ["Palette", "WCAG", "Image extraction"] },
    { id: "type", icon: "T", name: "Typography Studio", group: "Thương hiệu", code: "TYP", description: "Thiết kế type scale, xem trực tiếp và xuất CSS sẵn dùng.", caps: ["Type scale", "Live preview", "CSS export"] },
    { id: "icon", icon: "◇", name: "Icon Browser", group: "Tài nguyên", code: "ICO", description: "Tìm biểu tượng Lucide và xuất SVG hoặc PNG theo kích thước.", caps: ["Lucide", "Search", "SVG · PNG"] },
    { id: "svg", icon: "⌁", name: "SVG Editor", group: "Tài nguyên", code: "SVG", description: "Chỉnh mã vector, xem trước tức thì và xuất tệp an toàn.", caps: ["Live editor", "Sanitize", "Export"] },
    { id: "gradient", icon: "◒", name: "Gradient Generator", group: "Thương hiệu", code: "GRD", description: "Tạo gradient nhiều điểm màu cho CSS và ảnh PNG.", caps: ["4 color stops", "3 modes", "CSS · PNG"] },
    { id: "picker", icon: "⌾", name: "Color Picker", group: "Hình ảnh", code: "PCK", description: "Lấy màu pixel, chuyển HEX/RGB/HSL và đo độ tương phản.", caps: ["EyeDropper", "Pixel sample", "Contrast"] },
    { id: "social-post", icon: "▣", name: "Social Post Maker", group: "Xuất bản", code: "SOC", description: "Tạo post, story, cover và thumbnail theo kích thước chuẩn mạng xã hội.", caps: ["9 presets", "Live canvas", "Brand overlay", "PNG · JPG · WebP"] },
    { id: "brand-kit", icon: "◆", name: "Brand Kit", group: "Xuất bản", code: "BRD", description: "Tạo brand board, bảng màu, hệ chữ và token CSS/JSON.", caps: ["Brand board", "Color tokens", "Typography", "PNG · JSON · CSS"] },
    { id: "favicon", icon: "◈", name: "Favicon Studio", group: "Xuất bản", code: "FAV", description: "Sinh favicon, Apple Touch Icon, app icon và Web Manifest.", caps: ["9 sizes", "Safe padding", "App shapes", "Manifest"] },
    { id: "meme", icon: "▰", name: "Meme Maker", group: "Xuất bản", code: "MEM", description: "Tạo meme, caption card và ảnh phản ứng với chữ viền sắc nét.", caps: ["Top · Bottom", "Text stroke", "Watermark", "High-res"] }
  ];
  const GROUPS = ["Dự án & tài nguyên", "Biên tập nâng cao", "Hình ảnh", "Tài liệu", "Thương hiệu", "Tài nguyên", "Xuất bản"];
  const PRODUCTION_FLOW = [
    { code: "PW", label: "Production Workflow", tool: "production-workflow", description: "Proxy, subtitle, review và render thật" },
    { code: "UP", label: "Universal Project", tool: "universal-media", description: "Dự án và Media Bin dùng chung" },
    { code: "PE", label: "Photo Editor Pro", tool: "photo-editor", description: "Layer và chỉnh sửa không phá hủy" },
    { code: "VE", label: "Video Editor Pro", tool: "video-editor", description: "Dựng, màu, âm thanh và deliver" },
    { code: "MV", label: "Motion & Vector", route: "/graphic-design/vector", description: "Bezier, keyframe và state" },
    { code: "DS", label: "Design System", route: "/graphic-design/components", description: "Component, variant và token" },
    { code: "AD", label: "Adaptive Content", route: "/graphic-design/adaptive", description: "Đa kích thước và bulk create" },
    { code: "RV", label: "Review", route: "/graphic-design/review", description: "Comment, version và duyệt" },
    { code: "EX", label: "Export Center", route: "/graphic-design/export", description: "Queue, preflight và preset" },
    { code: "AI", label: "Controlled AI", route: "/graphic-design/dev-ai", description: "AI tạo bản nháp có kiểm soát" }
  ];
  const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
  const normalize = (value) => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const loadState = () => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
      return { active: saved.active || "Universal Media Project", favorites: Array.isArray(saved.favorites) ? saved.favorites : [], recent: Array.isArray(saved.recent) ? saved.recent : [], usage: saved.usage || {} };
    } catch {
      return { active: "Universal Media Project", favorites: [], recent: [], usage: {} };
    }
  };
  let pageState = loadState();
  let activeRoot = null;
  let activeFilter = "all";

  const saveState = () => localStorage.setItem(STORAGE_KEY, JSON.stringify(pageState));
  const toolByName = (name) => TOOLS.find((tool) => tool.name === name) || TOOLS.find((tool) => tool.id === "universal-media") || TOOLS[0];
  const toolById = (id) => TOOLS.find((tool) => tool.id === id);
  const visibleTools = (query = "") => {
    const term = normalize(query);
    return TOOLS.filter((tool) => {
      const matchesFilter = activeFilter === "favorites" ? pageState.favorites.includes(tool.name) : activeFilter === "recent" ? pageState.recent.includes(tool.name) : true;
      return matchesFilter && (!term || normalize(`${tool.name} ${tool.group} ${tool.description} ${tool.caps.join(" ")}`).includes(term));
    });
  };
  const toolItem = (tool) => `<div class="mdp-tool-row ${pageState.active === tool.name ? "is-active" : ""}" data-mdp-tool-row="${escapeHtml(tool.name)}">
    <button type="button" class="mdp-tool" data-mdp-tool="${escapeHtml(tool.name)}" ${pageState.active === tool.name ? 'aria-current="page"' : ""}>
      <span class="mdp-tool__icon" aria-hidden="true">${tool.icon}</span><span class="mdp-tool__copy"><strong>${escapeHtml(tool.name)}</strong><small>${escapeHtml(tool.description)}</small></span><i>${tool.code}</i>
    </button>
    <button type="button" class="mdp-tool__favorite ${pageState.favorites.includes(tool.name) ? "is-active" : ""}" data-mdp-favorite="${escapeHtml(tool.name)}" aria-label="${pageState.favorites.includes(tool.name) ? "Bỏ ghim" : "Ghim"} ${escapeHtml(tool.name)}" title="Ghim công cụ">☆</button>
  </div>`;
  const catalogMarkup = (query = "") => {
    const visible = visibleTools(query);
    if (!visible.length) return '<div class="mdp-empty"><strong>Không tìm thấy công cụ</strong><p>Thử từ khóa khác hoặc chuyển về Tất cả.</p></div>';
    return GROUPS.map((group) => {
      const items = visible.filter((tool) => tool.group === group);
      return items.length ? `<section class="mdp-tool-group"><header><span>${group}</span><b>${items.length}</b></header>${items.map(toolItem).join("")}</section>` : "";
    }).join("");
  };
  const contextMarkup = (tool) => `<div class="mdp-context__identity"><span aria-hidden="true">${tool.icon}</span><div><small>${tool.group} · ${tool.code} LOCAL</small><h2>${escapeHtml(tool.name)}</h2><p>${escapeHtml(tool.description)}</p></div></div><div class="mdp-context__caps">${tool.caps.map((cap) => `<span>${escapeHtml(cap)}</span>`).join("")}</div><button type="button" class="mdp-context__favorite ${pageState.favorites.includes(tool.name) ? "is-active" : ""}" data-mdp-favorite="${escapeHtml(tool.name)}" title="Ghim công cụ" aria-label="Ghim ${escapeHtml(tool.name)}">☆</button>`;

  const renderCatalog = (root) => {
    const search = root.querySelector("[data-mdp-search]");
    const catalog = root.querySelector("[data-mdp-catalog]");
    if (catalog) catalog.innerHTML = catalogMarkup(search?.value || "");
    root.querySelectorAll("[data-mdp-filter]").forEach((button) => button.classList.toggle("is-active", button.dataset.mdpFilter === activeFilter));
    const favoriteCount = root.querySelector("[data-mdp-favorite-count]");
    if (favoriteCount) favoriteCount.textContent = pageState.favorites.length;
    const recentCount = root.querySelector("[data-mdp-recent-count]");
    if (recentCount) recentCount.textContent = pageState.recent.length;
  };
  const renderContext = (root, tool) => {
    root.querySelector("[data-mdp-context]").innerHTML = contextMarkup(tool);
    const usage = root.querySelector("[data-mdp-usage]");
    if (usage) usage.textContent = `${pageState.usage[tool.name] || 1} phiên`;
  };
  const selectTool = (root, name, focus = false) => {
    const tool = toolByName(name);
    window.HHMediaDesign?.cleanup?.();
    window.HHUniversalMediaProject?.unmount?.();
    window.HHMediaProductionWorkflow?.unmount?.();
    pageState.active = tool.name;
    pageState.recent = [tool.name, ...pageState.recent.filter((item) => item !== tool.name)].slice(0, 12);
    pageState.usage[tool.name] = (pageState.usage[tool.name] || 0) + 1;
    saveState();
    renderCatalog(root);
    renderContext(root, tool);
    const work = root.querySelector("[data-mdp-work]");
    if (tool.name === "Production Workflow" && window.HHMediaProductionWorkflow?.mount) {
      window.HHMediaProductionWorkflow.mount(work).catch?.(() => showNotice(root, "Không khởi động được Production Workflow.", "error"));
    } else if (["Universal Media Project", "Asset Manager"].includes(tool.name) && window.HHUniversalMediaProject?.mount) {
      window.HHUniversalMediaProject.mount(work, { view: tool.name === "Asset Manager" ? "assets" : "project" });
    } else if (window.HHMediaDesign?.supports?.(tool.name)) window.HHMediaDesign.render(work, tool.name);
    else work.innerHTML = '<div class="mdp-engine-error"><strong>Engine chưa sẵn sàng</strong><p>Hãy tải lại trang để khởi động Media Engine.</p><button type="button" data-mdp-retry>Thử lại</button></div>';
    root.querySelector("[data-mdp-current]").textContent = tool.name;
    root.querySelector("[data-mdp-last-used]").textContent = new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
    if (focus) root.querySelector(`[data-mdp-tool="${CSS.escape(tool.name)}"]`)?.focus();
  };
  const downloadPreferences = () => {
    const blob = new Blob([JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), ...pageState }, null, 2)], { type: "application/json" });
    const anchor = document.createElement("a");
    anchor.href = URL.createObjectURL(blob);
    anchor.download = "hh-media-design-preferences.json";
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(anchor.href), 1000);
    showNotice(activeRoot, "Đã xuất cấu hình Media & Design.", "success");
  };
  const showNotice = (root, message, state = "success") => {
    const notice = root?.querySelector("[data-mdp-notice]");
    if (!notice) return;
    notice.textContent = message;
    notice.dataset.state = state;
    notice.hidden = false;
    clearTimeout(showNotice.timer);
    showNotice.timer = setTimeout(() => { notice.hidden = true; }, 3200);
  };
  const importPreferences = async (file, root) => {
    const value = JSON.parse(await file.text());
    pageState = {
      active: toolByName(value.active).name,
      favorites: Array.isArray(value.favorites) ? value.favorites.filter((name) => TOOLS.some((tool) => tool.name === name)) : [],
      recent: Array.isArray(value.recent) ? value.recent.filter((name) => TOOLS.some((tool) => tool.name === name)).slice(0, 12) : [],
      usage: value.usage && typeof value.usage === "object" ? value.usage : {}
    };
    saveState();
    selectTool(root, pageState.active);
    showNotice(root, "Đã nhập cấu hình và khôi phục workspace.", "success");
  };

  const mount = (host, options = {}) => {
    if (!host) return;
    window.HHMediaDesign?.cleanup?.();
    window.HHUniversalMediaProject?.unmount?.();
    window.HHMediaProductionWorkflow?.unmount?.();
    const requestedTool = toolById(options.toolId || host.dataset.mediaDesignTool);
    if (requestedTool) pageState.active = requestedTool.name;
    host.innerHTML = `<section class="media-design-page ${requestedTool ? "is-tool-view" : ""}" data-media-design-page>
      <header class="mdp-overview">
        <div class="mdp-overview__copy"><span class="mdp-eyebrow"><i></i> HH CREATIVE STUDIO</span><h2>Một workspace. Mọi công cụ sáng tạo.</h2><p>Xử lý tệp trực tiếp trên trình duyệt, không tải nội dung cá nhân lên máy chủ.</p></div>
        <div class="mdp-overview__status"><span><i class="is-online"></i> Engine sẵn sàng</span><strong>${TOOLS.length}</strong><small>creative engines</small></div>
      </header>
      <nav class="mdp-production-flow" aria-label="Quy trình Media & Design chuyên nghiệp">${PRODUCTION_FLOW.map((item, index) => `<button type="button" ${item.tool ? `data-mdp-flow-tool="${item.tool}"` : `data-mdp-flow-route="${item.route}"`} style="--flow-index:${index}"><i>${item.code}</i><span><strong>${item.label}</strong><small>${item.description}</small></span><b aria-hidden="true">↗</b></button>`).join("")}</nav>
      <nav class="mdp-suite-ribbon" aria-label="Nhóm công cụ Media & Design">${GROUPS.map((group, index) => `<button type="button" data-mdp-jump-group="${escapeHtml(group)}" style="--suite-index:${index}"><span>${escapeHtml(group)}</span><b>${TOOLS.filter((tool) => tool.group === group).length}</b><i></i></button>`).join("")}</nav>
      <div class="mdp-metrics" aria-label="Tổng quan Media & Design">
        <div><span>Engine</span><strong>${TOOLS.length} / ${TOOLS.length}</strong><i style="--value:100%"></i></div>
        <div><span>Yêu thích</span><strong data-mdp-favorite-count>${pageState.favorites.length}</strong><i style="--value:${Math.min(pageState.favorites.length / TOOLS.length * 100, 100)}%"></i></div>
        <div><span>Gần đây</span><strong data-mdp-recent-count>${pageState.recent.length}</strong><i style="--value:${Math.min(pageState.recent.length / 12 * 100, 100)}%"></i></div>
        <div><span>Phiên hiện tại</span><strong data-mdp-usage>1 phiên</strong><i style="--value:64%"></i></div>
      </div>
      <div class="mdp-shell">
        <main class="mdp-main">
          <header class="mdp-context" data-mdp-context>${contextMarkup(toolByName(pageState.active))}</header>
          <div class="mdp-session"><span><i></i> Xử lý trên thiết bị</span><span>Đang mở: <b data-mdp-current>${escapeHtml(pageState.active)}</b></span><span>Cập nhật <b data-mdp-last-used>${new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}</b></span><label class="mdp-mobile-switcher">Công cụ<select data-mdp-mobile-select>${TOOLS.map((tool) => `<option value="${tool.id}" ${tool.name === pageState.active ? "selected" : ""}>${escapeHtml(tool.name)}</option>`).join("")}</select></label><span class="mdp-session__shortcut"><kbd>Alt</kbd><kbd>↑ ↓</kbd> đổi tool</span><div class="mdp-session__config"><button type="button" data-mdp-export>Xuất cấu hình</button><label>Nhập<input type="file" accept="application/json" data-mdp-import></label></div></div>
          <div class="feature-lab__work media-design-page__work" data-mdp-work></div>
        </main>
      </div>
      <div class="mdp-notice" data-mdp-notice role="status" aria-live="polite" hidden></div>
    </section>`;
    const root = host.querySelector("[data-media-design-page]");
    activeRoot = root;
    selectTool(root, pageState.active);

    root.addEventListener("click", (event) => {
      const favorite = event.target.closest("[data-mdp-favorite]");
      if (favorite) {
        const name = favorite.dataset.mdpFavorite;
        pageState.favorites = pageState.favorites.includes(name) ? pageState.favorites.filter((item) => item !== name) : [name, ...pageState.favorites];
        saveState();
        renderCatalog(root);
        renderContext(root, toolByName(pageState.active));
        return;
      }
      const tool = event.target.closest("[data-mdp-tool]");
      if (tool) return selectTool(root, tool.dataset.mdpTool);
      const flowTool = event.target.closest("[data-mdp-flow-tool]");
      if (flowTool) { location.hash = `#/media-design/${flowTool.dataset.mdpFlowTool}`; return; }
      const flowRoute = event.target.closest("[data-mdp-flow-route]");
      if (flowRoute) { location.hash = `#${flowRoute.dataset.mdpFlowRoute}`; return; }
      const filter = event.target.closest("[data-mdp-filter]");
      if (filter) { activeFilter = filter.dataset.mdpFilter; renderCatalog(root); return; }
      const groupJump = event.target.closest("[data-mdp-jump-group]");
      if (groupJump) { const target = TOOLS.find((item) => item.group === groupJump.dataset.mdpJumpGroup); if (target) location.hash = `#/media-design/${target.id}`; return; }
      if (event.target.closest("[data-mdp-export]")) return downloadPreferences();
      if (event.target.closest("[data-mdp-retry]")) return selectTool(root, pageState.active);
      window.HHMediaDesign?.handleClick?.(event, root.querySelector("[data-mdp-work]"), pageState.active);
    });
    root.addEventListener("input", (event) => {
      if (event.target.matches("[data-mdp-search]")) return renderCatalog(root);
      window.HHMediaDesign?.handleInput?.(event, root.querySelector("[data-mdp-work]"), pageState.active);
    });
    root.addEventListener("change", (event) => {
      if (event.target.matches("[data-mdp-mobile-select]")) { location.hash = `#/media-design/${event.target.value}`; return; }
      if (event.target.matches("[data-mdp-import]")) {
        const file = event.target.files?.[0];
        if (file) importPreferences(file, root).catch(() => showNotice(root, "Tệp cấu hình không hợp lệ.", "error"));
        return;
      }
      window.HHMediaDesign?.handleChange?.(event, root.querySelector("[data-mdp-work]"), pageState.active);
    });
  };

  addEventListener("keydown", (event) => {
    if (!activeRoot?.isConnected || !location.hash.includes("/media-design")) return;
    if (event.key === "/" && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName || "")) {
      event.preventDefault();
      activeRoot.querySelector("[data-mdp-search]")?.focus();
    }
    if (event.ctrlKey && /^[1-9]$/.test(event.key)) {
      event.preventDefault();
      selectTool(activeRoot, TOOLS[Number(event.key) - 1].name, true);
    }
    if (event.altKey && ["ArrowUp", "ArrowDown"].includes(event.key)) {
      event.preventDefault();
      const index = TOOLS.findIndex((tool) => tool.name === pageState.active);
      const next = event.key === "ArrowDown" ? (index + 1) % TOOLS.length : (index - 1 + TOOLS.length) % TOOLS.length;
      selectTool(activeRoot, TOOLS[next].name, true);
    }
  });
  addEventListener("hashchange", () => {
    if (!location.hash.includes("/media-design")) {
      window.HHMediaDesign?.cleanup?.();
      window.HHUniversalMediaProject?.unmount?.();
      window.HHMediaProductionWorkflow?.unmount?.();
    }
  });

  window.HHMediaDesignPage = { mount, tools: TOOLS };
  const pendingHost = document.querySelector("[data-media-design-page-host]");
  if (pendingHost) mount(pendingHost, { toolId: pendingHost.dataset.mediaDesignTool || "" });
})();
