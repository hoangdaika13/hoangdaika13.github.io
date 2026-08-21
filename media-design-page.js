(() => {
  "use strict";

  const STORAGE_KEY = "hh.media-design.page.v1";
  const TOOLS = [
    { id: "media-core", icon: "UP", name: "Universal Project Pro", group: "Dự án & tài nguyên", code: "CORE", description: "Media Graph, branch, recovery, review, quyền và audit cho toàn bộ dự án.", caps: ["Media Graph", "Branch · Recovery", "Review · Rights", "Health score"] },
    { id: "production-workflow", icon: "PW", name: "Production Workflow", group: "Dự án & tài nguyên", code: "PROD", description: "Media Bin dùng chung, timeline không phá hủy, phụ đề, review và render queue trung thực.", caps: ["Shared Media Bin", "Proxy adapter", "Subtitle", "Server render"] },
    { id: "universal-media", icon: "UM", name: "Universal Media Project", group: "Dự án & tài nguyên", code: "PROJECT", description: "Dự án media dùng chung cho ảnh, video, âm thanh, font, LUT và SVG.", caps: ["Media Bin", "Autosave", "Version history", ".hhmedia"] },
    { id: "asset-manager", icon: "AM", name: "Asset Manager", group: "Dự án & tài nguyên", code: "ASSET", description: "Quản lý metadata, thumbnail, file trùng, media offline, Smart Collection và proxy.", caps: ["Metadata", "Duplicate scan", "Smart Collection", "Proxy plan"] },
    { id: "review-studio", icon: "RV", name: "Review Studio", group: "Dự án & tài nguyên", code: "REVIEW", description: "Review theo pixel, frame và time range với annotation, version compare và approval.", caps: ["Pixel · Frame · Range", "Version compare", "Approval", "Protected links"] },
    { id: "universal-canvas", icon: "UC", name: "Universal Canvas", group: "Dự án & tài nguyên", code: "CANVAS", description: "Canvas vô hạn kết hợp artboard, asset, sequence, component và comment trong một không gian.", caps: ["Infinite canvas", "Artboard · Sequence", "Auto layout", "Minimap"] },
    { id: "photo-workspace", icon: "PI", name: "Photo & Image Pro", group: "Biên tập nâng cao", code: "PHOTO+", description: "Điều hành layer, snapshot, action, selection, scope và AI có kiểm soát.", caps: ["Layer system", "Snapshot · Action", "PSD workflow", "Controlled AI"] },
    { id: "ai-task-center", icon: "AI", name: "AI Task Center", group: "Biên tập nâng cao", code: "AI+", description: "Hàng đợi AI có provider, model, seed, chi phí, quyền sử dụng, lock và provenance.", caps: ["Provider · Model", "Seed · Variation", "Rights gate", "Undo-safe output"] },
    { id: "photo-editor", icon: "✎", name: "Photo Editor", group: "Biên tập nâng cao", code: "PHOTO", description: "Chỉnh sửa ảnh nhiều lớp như một Photoshop thu gọn ngay trong trình duyệt.", caps: ["Layers", "Blend & filters", "Undo · Redo", "High-res export"] },
    { id: "video-workspace", icon: "VM", name: "Video & Motion Pro", group: "Biên tập nâng cao", code: "VIDEO+", description: "Source/Program, three-point edit, transcript proposal, color và audio bus.", caps: ["Source · Program", "Timeline trim", "Color management", "Audio bus"] },
    { id: "motion-compositor", icon: "FX", name: "Motion & Compositing", group: "Biên tập nâng cao", code: "MOTION", description: "Node graph, keyframe, camera 2.5D, particle theo audio, tracking và cache manifest.", caps: ["Node graph", "Keyframe · Camera", "Audio reactive", "Cache manifest"] },
    { id: "audio-workspace", icon: "AU", name: "Audio & Podcast Studio", group: "Audio & Podcast", code: "AUDIO", description: "Waveform editor local-first với trim, fade, normalize, gain, thu microphone và xuất WAV thật.", caps: ["Waveform · Trim", "Fade · Normalize", "Microphone", "WAV export"] },
    { id: "background-remover", icon: "✂", name: "Background Remover", group: "Biên tập nâng cao", code: "CUT", description: "Xóa nền theo màu, lấy mẫu pixel và làm mềm đường biên.", caps: ["Color key", "Edge feather", "PNG alpha"] },
    { id: "collage", icon: "▦", name: "Collage Maker", group: "Biên tập nâng cao", code: "COL", description: "Ghép nhiều ảnh theo lưới, ảnh nổi bật hoặc dải ngang.", caps: ["12 images", "Smart cover", "High-res"] },
    { id: "inspector", icon: "⌕", name: "Image Inspector", group: "Biên tập nâng cao", code: "META", description: "Đọc EXIF, SHA-256, màu đại diện và xóa metadata.", caps: ["EXIF", "SHA-256", "Strip metadata"] },
    { id: "compress", icon: "⇣", name: "Image Compressor", group: "Hình ảnh", code: "IMG", description: "Nén nhiều ảnh, đặt dung lượng đích và tối ưu WebP/JPEG.", caps: ["Batch 20 ảnh", "Target size", "So sánh trước/sau"] },
    { id: "convert", icon: "⇄", name: "Image Converter", group: "Hình ảnh", code: "IMG", description: "Đổi định dạng hàng loạt, đổi kích thước và giữ chất lượng.", caps: ["PNG · JPEG · WebP", "Resize", "Tải hàng loạt"] },
    { id: "image", icon: "◫", name: "Image Toolkit", group: "Hình ảnh", code: "IMG", description: "Cắt, xoay, lật, cân chỉnh và áp dụng bộ lọc trực tiếp.", caps: ["Transform", "Filter presets", "Canvas preview"] },
    { id: "document-workspace", icon: "DU", name: "Documents & Utility Pro", group: "Tài liệu", code: "DOC+", description: "Document inbox, OCR/redaction adapter, forms, PDF/A, compare và Dynamic QR.", caps: ["Document queue", "OCR · Redaction", "Forms · Sign", "PDF/A · Compare"] },
    { id: "pdf", icon: "▤", name: "PDF Toolkit", group: "Tài liệu", code: "DOC", description: "Gộp, tách, xoay, watermark và chỉnh metadata PDF.", caps: ["Merge · Split", "Watermark", "Metadata"] },
    { id: "qr", icon: "⌗", name: "QR Toolkit", group: "Tài liệu", code: "QR", description: "Tạo QR tùy chỉnh hoặc quét QR từ ảnh trên thiết bị.", caps: ["Live QR", "Scan image", "PNG export"] },
    { id: "brand-workspace", icon: "BU", name: "Brand Universe Pro", group: "Thương hiệu", code: "BRAND+", description: "Multi Brand Kit, design token, mode, component lock, lint và localization.", caps: ["Multi Brand", "Token · Mode", "Brand lint", "CSS · JSON"] },
    { id: "dev-handoff", icon: "DV", name: "Dev Mode & Handoff", group: "Thương hiệu", code: "DEV", description: "Inspect layout, token alias, code snippet, ready-for-dev và screenshot compare.", caps: ["Inspect", "CSS · React · SVG", "Ready for dev", "Storybook"] },
    { id: "color", icon: "◉", name: "Color Studio", group: "Thương hiệu", code: "CLR", description: "Tạo bảng màu, trích màu từ ảnh và kiểm tra WCAG.", caps: ["Palette", "WCAG", "Image extraction"] },
    { id: "type", icon: "T", name: "Typography Studio", group: "Thương hiệu", code: "TYP", description: "Thiết kế type scale, xem trực tiếp và xuất CSS sẵn dùng.", caps: ["Type scale", "Live preview", "CSS export"] },
    { id: "icon", icon: "◇", name: "Icon Browser", group: "Tài nguyên", code: "ICO", description: "Tìm biểu tượng Lucide và xuất SVG hoặc PNG theo kích thước.", caps: ["Lucide", "Search", "SVG · PNG"] },
    { id: "svg", icon: "⌁", name: "SVG Editor", group: "Tài nguyên", code: "SVG", description: "Chỉnh mã vector, xem trước tức thì và xuất tệp an toàn.", caps: ["Live editor", "Sanitize", "Export"] },
    { id: "gradient", icon: "◒", name: "Gradient Generator", group: "Thương hiệu", code: "GRD", description: "Tạo gradient nhiều điểm màu cho CSS và ảnh PNG.", caps: ["4 color stops", "3 modes", "CSS · PNG"] },
    { id: "picker", icon: "⌾", name: "Color Picker", group: "Hình ảnh", code: "PCK", description: "Lấy màu pixel, chuyển HEX/RGB/HSL và đo độ tương phản.", caps: ["EyeDropper", "Pixel sample", "Contrast"] },
    { id: "asset-workspace", icon: "AG", name: "Asset Galaxy Pro", group: "Tài nguyên", code: "ASSET+", description: "Verified ingest, SHA-256, provenance, license, font/LUT và private cloud adapter.", caps: ["Verified ingest", "Provenance", "License · Consent", "Private Blob"] },
    { id: "media-cloud", icon: "MC", name: "Media Cloud", group: "Tài nguyên", code: "CLOUD", description: "Private Blob, multipart upload, signed download, quota, vai trò, checksum và thùng rác 30 ngày.", caps: ["Private Blob", "Multipart upload", "Signed URL", "Role · Quota"] },
    { id: "social-post", icon: "▣", name: "Social Post Maker", group: "Xuất bản", code: "SOC", description: "Tạo post, story, cover và thumbnail theo kích thước chuẩn mạng xã hội.", caps: ["9 presets", "Live canvas", "Brand overlay", "PNG · JPG · WebP"] },
    { id: "brand-kit", icon: "◆", name: "Brand Kit", group: "Xuất bản", code: "BRD", description: "Tạo brand board, bảng màu, hệ chữ và token CSS/JSON.", caps: ["Brand board", "Color tokens", "Typography", "PNG · JSON · CSS"] },
    { id: "favicon", icon: "◈", name: "Favicon Studio", group: "Xuất bản", code: "FAV", description: "Sinh favicon, Apple Touch Icon, app icon và Web Manifest.", caps: ["9 sizes", "Safe padding", "App shapes", "Manifest"] },
    { id: "meme", icon: "▰", name: "Meme Maker", group: "Xuất bản", code: "MEM", description: "Tạo meme, caption card và ảnh phản ứng với chữ viền sắc nét.", caps: ["Top · Bottom", "Text stroke", "Watermark", "High-res"] },
    { id: "export-workspace", icon: "EP", name: "Export & Publishing Pro", group: "Xuất bản", code: "EXPORT+", description: "Preflight, codec recipe, adaptive job, rights gate, manifest và external worker.", caps: ["Preflight", "Idempotent queue", "Adaptive export", "Manifest · C2PA"] }
  ];
  const PLANET_GROUPS = Object.freeze([
    { id: "universal", label: "Universal Project", tools: ["media-core", "universal-media", "asset-manager", "review-studio", "universal-canvas"] },
    { id: "photo", label: "Photo & Image", tools: ["photo-workspace", "ai-task-center", "photo-editor", "background-remover", "collage", "inspector", "compress", "convert", "image", "picker"] },
    { id: "video", label: "Video & Motion", tools: ["video-workspace", "motion-compositor"] },
    { id: "audio", label: "Audio & Podcast", tools: ["audio-workspace"] },
    { id: "documents", label: "Documents & Utility", tools: ["document-workspace", "pdf", "qr"] },
    { id: "brand", label: "Brand Universe", tools: ["brand-workspace", "dev-handoff", "color", "type", "gradient", "brand-kit"] },
    { id: "assets", label: "Asset Galaxy", tools: ["asset-workspace", "media-cloud", "icon", "svg"] },
    { id: "export", label: "Export & Publishing", tools: ["export-workspace", "production-workflow", "social-post", "favicon", "meme"] }
  ]);
  TOOLS.forEach((tool) => {
    const planet = PLANET_GROUPS.find((item) => item.tools.includes(tool.id));
    if (planet) {
      tool.group = planet.label;
      tool.planet = planet.id;
    }
  });
  const GROUPS = PLANET_GROUPS.map((planet) => planet.label);
  const STUDIO_SPACES = Object.freeze([
    { id: "project", icon: "UP", label: "Project Core", color: "#5deaff", route: "/media-design/media-core", tools: ["media-core", "universal-media", "asset-manager", "review-studio", "universal-canvas"] },
    { id: "photo", icon: "PI", label: "Photo & Image", color: "#ff65d6", route: "/media-design/photo-workspace", tools: ["photo-workspace", "ai-task-center", "photo-editor", "background-remover", "collage", "inspector", "compress", "convert", "image", "picker"] },
    { id: "video", icon: "VM", label: "Video & Motion", color: "#9b73ff", route: "/media-design/video-workspace", tools: ["video-workspace", "motion-compositor"] },
    { id: "audio", icon: "AU", label: "Audio & Podcast", color: "#55efd2", route: "/media-design/audio-workspace", tools: ["audio-workspace"] },
    { id: "documents", icon: "DU", label: "Documents", color: "#7cebd9", route: "/media-design/document-workspace", tools: ["document-workspace", "pdf", "qr"] },
    { id: "brand", icon: "BU", label: "Brand Universe", color: "#ffbd59", route: "/media-design/brand-workspace", tools: ["brand-workspace", "dev-handoff", "color", "type", "gradient", "brand-kit"] },
    { id: "assets", icon: "AG", label: "Asset Galaxy", color: "#5c9dff", route: "/media-design/asset-workspace", tools: ["asset-workspace", "media-cloud", "icon", "svg"] },
    { id: "delivery", icon: "EP", label: "Delivery Center", color: "#ffe36d", route: "/media-design/export-workspace", tools: ["export-workspace", "production-workflow", "social-post", "favicon", "meme"] }
  ]);
  const PRODUCTION_FLOW = [
    { code: "MC", label: "Media Core Pro", tool: "media-core", description: "Graph, branch, review và rights" },
    { code: "PW", label: "Production Workflow", tool: "production-workflow", description: "Proxy, subtitle, review và render thật" },
    { code: "UP", label: "Universal Project", tool: "universal-media", description: "Dự án và Media Bin dùng chung" },
    { code: "RV", label: "Review Studio", tool: "review-studio", description: "Frame review, version compare và approval" },
    { code: "UC", label: "Universal Canvas", tool: "universal-canvas", description: "Artboard, sequence, component và comment" },
    { code: "PE", label: "Photo Editor Pro", tool: "photo-editor", description: "Layer và chỉnh sửa không phá hủy" },
    { code: "MV", label: "Motion & Vector", route: "/graphic-design/vector", description: "Bezier, keyframe và state" },
    { code: "DS", label: "Design System", route: "/graphic-design/components", description: "Component, variant và token" },
    { code: "AD", label: "Adaptive Content", route: "/graphic-design/adaptive", description: "Đa kích thước và bulk create" },
    { code: "AI", label: "AI Task Center", tool: "ai-task-center", description: "Provider, cost, rights và provenance" },
    { code: "EX", label: "Export Center", route: "/graphic-design/export", description: "Queue, preflight và preset" },
    { code: "DV", label: "Dev Handoff", tool: "dev-handoff", description: "Inspect, token và code handoff" }
  ];
  const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
  const normalize = (value) => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const loadState = () => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
      const availableNames = new Set(TOOLS.map((tool) => tool.name));
      return {
        active: availableNames.has(saved.active) ? saved.active : "Universal Media Project",
        favorites: Array.isArray(saved.favorites) ? saved.favorites.filter((name) => availableNames.has(name)) : [],
        recent: Array.isArray(saved.recent) ? saved.recent.filter((name) => availableNames.has(name)).slice(0, 12) : [],
        usage: Object.fromEntries(Object.entries(saved.usage || {}).filter(([name]) => availableNames.has(name))),
        inspectorOpen: saved.inspectorOpen === true,
        inspectorTab: ["properties", "metadata", "rights", "history"].includes(saved.inspectorTab) ? saved.inspectorTab : "properties",
        navHistory: Array.isArray(saved.navHistory) ? saved.navHistory.filter((name) => availableNames.has(name)).slice(-30) : [],
        navIndex: Number.isInteger(saved.navIndex) ? saved.navIndex : -1,
        aiDraft: saved.aiDraft && typeof saved.aiDraft === "object" ? saved.aiDraft : { task: "remove-background", prompt: "", seed: "" }
      };
    } catch {
      return { active: "Universal Media Project", favorites: [], recent: [], usage: {}, inspectorOpen: false, inspectorTab: "properties", navHistory: [], navIndex: -1, aiDraft: { task: "remove-background", prompt: "", seed: "" } };
    }
  };
  let pageState = loadState();
  let activeRoot = null;
  let activeFilter = "all";
  let commandOpen = false;
  let commandQuery = "";
  let workflowOpen = false;
  let aiDrawerOpen = false;
  let dragDepth = 0;

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
  const contextMarkup = (tool) => `<div class="mdp-context__identity"><span aria-hidden="true">${tool.icon}</span><div><small>${tool.group} · ${tool.code} · LOCAL + PRIVATE CLOUD</small><h2>${escapeHtml(tool.name)}</h2><p>${escapeHtml(tool.description)}</p></div></div><div class="mdp-context__caps">${tool.caps.map((cap) => `<span>${escapeHtml(cap)}</span>`).join("")}</div><button type="button" class="mdp-context__favorite ${pageState.favorites.includes(tool.name) ? "is-active" : ""}" data-mdp-favorite="${escapeHtml(tool.name)}" title="Ghim công cụ" aria-label="Ghim ${escapeHtml(tool.name)}">☆</button>`;
  const spaceForTool = (tool) => STUDIO_SPACES.find((space) => space.tools.includes(tool.id)) || STUDIO_SPACES[0];
  const spaceNavigationMarkup = (tool) => {
    const active = spaceForTool(tool);
    return `<aside class="mdp-cockpit-sidebar"><header><button type="button" data-mdp-route="/media-design/cosmos" aria-label="Mở Media Cosmos"><i>◈</i><span><strong>Media Cosmos</strong><small>Bản đồ tổng quan</small></span></button></header><nav aria-label="Không gian Media & Design">${STUDIO_SPACES.map((space) => `<button type="button" class="${space.id === active.id ? "is-active" : ""}" data-mdp-route="${space.route}" style="--space:${space.color}"><i>${space.icon}</i><span><strong>${space.label}</strong><small>${space.tools.length} công cụ</small></span><b>›</b></button>`).join("")}</nav><footer><button type="button" data-mdp-command-open><kbd>Ctrl K</kbd><span>Tất cả ${TOOLS.length} công cụ</span></button></footer></aside>`;
  };
  const inspectorMarkup = (tool) => {
    const tabs = [["properties", "Thuộc tính"], ["metadata", "Metadata"], ["rights", "Quyền"], ["history", "Lịch sử"]];
    const panels = {
      properties: `<section><small>WORKSPACE</small><h3>${escapeHtml(tool.name)}</h3><p>${escapeHtml(tool.description)}</p><div class="mdp-inspector-caps">${tool.caps.map((cap) => `<span>✓ ${escapeHtml(cap)}</span>`).join("")}</div></section>`,
      metadata: `<section><small>PHIÊN CỤC BỘ</small><dl><div><dt>Mã công cụ</dt><dd>${escapeHtml(tool.code)}</dd></div><div><dt>Nhóm</dt><dd>${escapeHtml(tool.group)}</dd></div><div><dt>Số lần mở</dt><dd>${pageState.usage[tool.name] || 1}</dd></div><div><dt>Cập nhật</dt><dd>${new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}</dd></div></dl></section>`,
      rights: `<section><small>RIGHTS GATE</small><div class="mdp-inspector-unknown"><i>?</i><strong>Chưa kiểm tra asset</strong><p>Chọn một asset trong Media Bin để kiểm tra license, consent và provenance. Không tự suy đoán quyền sử dụng.</p></div><button type="button" data-mdp-route="/media-design/asset-workspace">Mở Asset Galaxy</button></section>`,
      history: `<section><small>RECENT WORKSPACES</small><div class="mdp-inspector-history">${pageState.recent.length ? pageState.recent.slice(0, 10).map((name, index) => `<button type="button" data-mdp-tool="${escapeHtml(name)}"><i>${index + 1}</i><span>${escapeHtml(name)}</span></button>`).join("") : "<p>Chưa có lịch sử công cụ trên thiết bị.</p>"}</div></section>`
    };
    return `<aside class="mdp-cockpit-inspector"><header><div><small>INSPECTOR</small><strong>Ngữ cảnh đang chọn</strong></div><button type="button" data-mdp-inspector-toggle aria-label="Đóng Inspector">×</button></header><nav>${tabs.map(([id, label]) => `<button type="button" class="${pageState.inspectorTab === id ? "is-active" : ""}" data-mdp-inspector-tab="${id}">${label}</button>`).join("")}</nav><div>${panels[pageState.inspectorTab]}</div></aside>`;
  };
  const commandPaletteMarkup = () => {
    if (!commandOpen) return "";
    const term = normalize(commandQuery);
    const rows = TOOLS.filter((tool) => !term || normalize(`${tool.name} ${tool.group} ${tool.description} ${tool.caps.join(" ")}`).includes(term)).slice(0, 14);
    return `<div class="mdp-overlay" data-mdp-overlay-close><section class="mdp-command" role="dialog" aria-modal="true" aria-label="Command Palette Media & Design"><header><span>⌕</span><input type="search" data-mdp-command-search value="${escapeHtml(commandQuery)}" placeholder="Tìm 36 công cụ, workspace hoặc hành động…" autocomplete="off"><kbd>ESC</kbd></header><div class="mdp-command-actions"><button type="button" data-mdp-quick-action="import">＋ Import</button><button type="button" data-mdp-route="/media-design/review-studio">◎ Review</button><button type="button" data-mdp-ai-toggle>✦ AI Task</button><button type="button" data-mdp-route="/media-design/export-workspace">⇧ Export</button></div><section><small>CÔNG CỤ VÀ WORKSPACE</small>${rows.length ? rows.map((tool) => `<button type="button" data-mdp-command-tool="${tool.id}"><i>${tool.icon}</i><span><strong>${escapeHtml(tool.name)}</strong><small>${escapeHtml(tool.group)} · ${escapeHtml(tool.description)}</small></span><b>${tool.code}</b></button>`).join("") : "<p>Không tìm thấy công cụ phù hợp.</p>"}</section><footer>Ctrl K để mở · Esc để đóng · tìm kiếm chạy hoàn toàn trên thiết bị</footer></section></div>`;
  };
  const workflowDrawerMarkup = () => workflowOpen ? `<div class="mdp-overlay mdp-drawer-overlay" data-mdp-overlay-close><aside class="mdp-drawer"><header><div><small>PRODUCTION FLOW</small><h2>Sáu giai đoạn thống nhất</h2></div><button type="button" data-mdp-workflow-toggle>×</button></header><div class="mdp-flow-steps">${PRODUCTION_FLOW.map((item, index) => `<button type="button" ${item.tool ? `data-mdp-flow-tool="${item.tool}"` : `data-mdp-flow-route="${item.route}"`}><i>${String(index + 1).padStart(2, "0")}</i><span><strong>${item.label}</strong><small>${item.description}</small></span><b>→</b></button>`).join("")}</div></aside></div>` : "";
  const aiDrawerMarkup = () => {
    if (!aiDrawerOpen) return "";
    const tasks = [["remove-background", "Xóa nền"], ["generative-fill", "Generative Fill"], ["upscale", "Upscale"], ["caption", "Tạo caption"], ["transcript", "Chuyển giọng nói thành chữ"], ["classify", "Phân loại asset"], ["thumbnail", "Tạo thumbnail"], ["brand-compliance", "Kiểm tra Brand"]];
    return `<div class="mdp-overlay mdp-drawer-overlay" data-mdp-overlay-close><aside class="mdp-drawer mdp-ai-drawer"><header><div><small>CONTROLLED AI</small><h2>Chuẩn bị tác vụ không phá hủy</h2></div><button type="button" data-mdp-ai-toggle>×</button></header><form data-mdp-ai-form><label>Tác vụ<select data-mdp-ai-task>${tasks.map(([id, label]) => `<option value="${id}" ${pageState.aiDraft.task === id ? "selected" : ""}>${label}</option>`).join("")}</select></label><label>Yêu cầu<textarea rows="6" data-mdp-ai-prompt placeholder="Mô tả kết quả mong muốn…">${escapeHtml(pageState.aiDraft.prompt || "")}</textarea></label><label>Seed tùy chọn<input data-mdp-ai-seed value="${escapeHtml(pageState.aiDraft.seed || "")}" placeholder="Để trống nếu chưa cần tái tạo"></label><div class="mdp-ai-safety"><span>✓ Tạo checkpoint trước khi áp dụng</span><span>✓ Xem preview và diff</span><span>✓ Ghi provider, chi phí và provenance khi backend trả về</span></div><p>Drawer này chuẩn bị tác vụ. Provider chỉ được gọi sau khi bạn chọn asset nguồn trong AI Task Center.</p><footer><button type="button" data-mdp-ai-toggle>Hủy</button><button type="submit">Tiếp tục tới AI Task Center →</button></footer></form></aside></div>`;
  };

  const ingestFiles = async (files, root) => {
    const list = [...(files || [])].filter((file) => file && file.size > 0).slice(0, 100);
    if (!list.length) return;
    if (!window.HHUniversalMediaProject?.createStore) { showNotice(root, "Media Bin chưa sẵn sàng.", "error"); return; }
    const store = window.HHUniversalMediaProject.createStore();
    try {
      await store.ready();
      const project = (await store.listProjects())[0] || await store.saveProject({ name: "Universal Media Project" });
      for (const file of list) {
        const metadata = window.HHUniversalMediaProject.extractMetadata ? await window.HHUniversalMediaProject.extractMetadata(file, window).catch(() => ({})) : {};
        await store.saveAsset({ projectId: project.id, name: file.name, type: file.type, size: file.size, lastModified: file.lastModified, metadata, blob: file });
      }
      showNotice(root, `Đã nhập ${list.length} tệp vào Global Media Bin.`, "success");
    } catch (error) { showNotice(root, `Không thể nhập Media Bin: ${error.message}`, "error"); }
    finally { await store.close?.().catch?.(() => {}); }
  };

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
  const selectTool = (root, name, focus = false, recordHistory = true) => {
    const tool = toolByName(name);
    window.HHMediaCosmos?.recordTool?.(tool.id, tool.name);
    window.HHMediaDesign?.cleanup?.();
    window.HHUniversalMediaProject?.unmount?.();
    window.HHMediaProductionWorkflow?.unmount?.();
    window.HHMediaProfessionalSuite?.unmount?.();
    window.HHMediaNextSuite?.unmount?.();
    window.HHMediaAudioStudio?.unmount?.();
    pageState.active = tool.name;
    pageState.recent = [tool.name, ...pageState.recent.filter((item) => item !== tool.name)].slice(0, 12);
    pageState.usage[tool.name] = (pageState.usage[tool.name] || 0) + 1;
    if (recordHistory) {
      const base = pageState.navHistory.slice(0, pageState.navIndex + 1);
      if (base.at(-1) !== tool.name) base.push(tool.name);
      pageState.navHistory = base.slice(-30);
      pageState.navIndex = pageState.navHistory.length - 1;
    }
    saveState();
    renderCatalog(root);
    renderContext(root, tool);
    const work = root.querySelector("[data-mdp-work]");
    root.dataset.space = spaceForTool(tool).id;
    if (tool.id === "audio-workspace" && window.HHMediaAudioStudio?.mount) {
      window.HHMediaAudioStudio.mount(work, { mediaApi: window.HHUniversalMediaProject });
    } else if (window.HHMediaNextSuite?.WORKSPACE_BY_ID?.[tool.id] && window.HHMediaNextSuite?.mount) {
      window.HHMediaNextSuite.mount(work, { workspace: tool.id, onNavigate: (route) => { location.hash = `#${route}`; } });
    } else if (window.HHMediaProfessionalSuite?.WORKSPACE_BY_ID?.[tool.id] && window.HHMediaProfessionalSuite?.mount) {
      window.HHMediaProfessionalSuite.mount(work, { workspace: tool.id, onNavigate: (route) => { location.hash = `#${route}`; } });
    } else if (tool.name === "Production Workflow" && window.HHMediaProductionWorkflow?.mount) {
      window.HHMediaProductionWorkflow.mount(work).catch?.(() => showNotice(root, "Không khởi động được Production Workflow.", "error"));
    } else if (["Universal Media Project", "Asset Manager"].includes(tool.name) && window.HHUniversalMediaProject?.mount) {
      window.HHUniversalMediaProject.mount(work, { view: tool.name === "Asset Manager" ? "assets" : "project" });
    } else if (window.HHMediaDesign?.supports?.(tool.name)) window.HHMediaDesign.render(work, tool.name);
    else work.innerHTML = '<div class="mdp-engine-error"><strong>Engine chưa sẵn sàng</strong><p>Hãy tải lại trang để khởi động Media Engine.</p><button type="button" data-mdp-retry>Thử lại</button></div>';
    root.querySelector("[data-mdp-current]").textContent = tool.name;
    root.querySelector("[data-mdp-last-used]").textContent = new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
    root.querySelector("[data-mdp-undo]")?.toggleAttribute("disabled", pageState.navIndex <= 0);
    root.querySelector("[data-mdp-redo]")?.toggleAttribute("disabled", pageState.navIndex >= pageState.navHistory.length - 1);
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
      usage: value.usage && typeof value.usage === "object" ? value.usage : {},
      inspectorOpen: value.inspectorOpen === true,
      inspectorTab: ["properties", "metadata", "rights", "history"].includes(value.inspectorTab) ? value.inspectorTab : "properties",
      navHistory: Array.isArray(value.navHistory) ? value.navHistory.filter((name) => TOOLS.some((tool) => tool.name === name)).slice(-30) : [],
      navIndex: Number.isInteger(value.navIndex) ? value.navIndex : -1,
      aiDraft: value.aiDraft && typeof value.aiDraft === "object" ? value.aiDraft : { task: "remove-background", prompt: "", seed: "" }
    };
    saveState();
    selectTool(root, pageState.active);
    showNotice(root, "Đã nhập cấu hình và khôi phục workspace.", "success");
  };
  const renderOverlays = (root) => {
    const host = root?.querySelector("[data-mdp-overlays]");
    if (host) host.innerHTML = commandPaletteMarkup() + workflowDrawerMarkup() + aiDrawerMarkup();
  };
  const renderInspector = (root) => {
    const current = root?.querySelector(".mdp-cockpit-inspector");
    if (current) current.outerHTML = inspectorMarkup(toolByName(pageState.active));
    root?.classList.toggle("is-inspector-open", pageState.inspectorOpen);
  };

  const mount = (host, options = {}) => {
    if (!host) return;
    window.HHMediaCosmos?.unmount?.();
    window.HHMediaDesign?.cleanup?.();
    window.HHUniversalMediaProject?.unmount?.();
    window.HHMediaProductionWorkflow?.unmount?.();
    window.HHMediaProfessionalSuite?.unmount?.();
    window.HHMediaNextSuite?.unmount?.();
    window.HHMediaAudioStudio?.unmount?.();
    const requestedId = options.toolId || host.dataset.mediaDesignTool || "", cosmosRequested = requestedId === "cosmos";
    const requestedTool = cosmosRequested ? null : toolById(requestedId || "media-core");
    if (requestedTool) pageState.active = requestedTool.name;
    const initialTool = toolByName(pageState.active);
    host.innerHTML = `<section class="media-design-page mdp-cockpit ${requestedTool ? "is-tool-view" : ""} ${pageState.inspectorOpen ? "is-inspector-open" : ""}" data-media-design-page data-space="${spaceForTool(initialTool).id}">
      <header class="mdp-cockpit-topbar"><button type="button" class="mdp-spaces-button" data-mdp-spaces-toggle aria-label="Mở không gian Media">☰</button><button type="button" class="mdp-cockpit-brand" data-mdp-route="/media-design"><i>◈</i><span><strong>HH Media Studio</strong><small>Universal Media Project</small></span></button><button type="button" class="mdp-project-switcher" data-mdp-route="/media-design/media-core"><span><i></i> Dự án hiện tại</span><strong>Universal Media Project</strong></button><button type="button" class="mdp-command-trigger" data-mdp-command-open><span>⌕ Tìm công cụ hoặc hành động</span><kbd>Ctrl K</kbd></button><div class="mdp-history-controls"><button type="button" data-mdp-undo title="Quay lại workspace trước" ${pageState.navIndex <= 0 ? "disabled" : ""}>↶</button><button type="button" data-mdp-redo title="Tiến tới workspace sau" ${pageState.navIndex >= pageState.navHistory.length - 1 ? "disabled" : ""}>↷</button></div><button type="button" data-mdp-workflow-toggle>Quy trình</button><button type="button" class="is-primary" data-mdp-route="/media-design/export-workspace">Xuất bản</button><button type="button" class="mdp-inspector-button" data-mdp-inspector-toggle>ⓘ</button></header>
      <div class="mdp-cockpit-grid">${spaceNavigationMarkup(initialTool)}<main class="mdp-main"><header class="mdp-context" data-mdp-context>${contextMarkup(initialTool)}</header><div class="mdp-session"><span><i></i> Local-first</span><span>Đang mở: <b data-mdp-current>${escapeHtml(pageState.active)}</b></span><span>Cập nhật <b data-mdp-last-used>${new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}</b></span><label class="mdp-mobile-switcher">Công cụ<select data-mdp-mobile-select>${TOOLS.map((tool) => `<option value="${tool.id}" ${tool.name === pageState.active ? "selected" : ""}>${escapeHtml(tool.name)}</option>`).join("")}</select></label><span class="mdp-session__shortcut"><kbd>Alt</kbd><kbd>↑ ↓</kbd> đổi tool</span><div class="mdp-session__config"><button type="button" data-mdp-export>Xuất cấu hình</button><label>Nhập<input type="file" accept="application/json" data-mdp-import></label></div></div><div class="feature-lab__work media-design-page__work" data-mdp-work></div><footer class="mdp-actionbar"><label>＋ Import<input type="file" multiple data-mdp-global-import accept="image/*,video/*,audio/*,.pdf,.svg,.json,.hhmedia"></label><button type="button" data-mdp-route="/media-design/review-studio">◎ Review</button><button type="button" data-mdp-route="/media-design/universal-media">◇ Version</button><button type="button" data-mdp-ai-toggle>✦ AI Task</button><button type="button" data-mdp-route="/media-design/production-workflow">◉ Render</button><button type="button" class="is-primary" data-mdp-route="/media-design/export-workspace">⇧ Publish</button></footer></main>${inspectorMarkup(initialTool)}</div>
      <div class="mdp-drop-overlay" data-mdp-drop-overlay><i>＋</i><strong>Thả tệp vào Global Media Bin</strong><span>Ảnh · video · audio · PDF · SVG</span></div><div data-mdp-overlays></div><div class="mdp-notice" data-mdp-notice role="status" aria-live="polite" hidden></div>
    </section>`;
    const root = host.querySelector("[data-media-design-page]");
    activeRoot = root;
    const cosmosState = window.HHMediaCosmos?.getState?.();
    if (cosmosState?.theme) root.dataset.mediaTheme = cosmosState.theme;
    if (cosmosRequested && window.HHMediaCosmos?.mount) {
      root.classList.add("is-cosmos-view");
      root.innerHTML = '<div data-media-cosmos-host></div><div class="mdp-notice" data-mdp-notice role="status" aria-live="polite" hidden></div>';
      window.HHMediaCosmos.mount(root.querySelector("[data-media-cosmos-host]"), {
        tools: TOOLS,
        mediaApi: window.HHUniversalMediaProject,
        productionApi: window.HHMediaProductionWorkflow,
        professionalApi: window.HHMediaProfessionalSuite,
        onNavigate: (route) => { location.hash = `#${route}`; }
      }).catch?.(() => showNotice(root, "Không khởi động được Media Cosmos.", "error"));
      return;
    }
    selectTool(root, pageState.active);

    root.addEventListener("click", (event) => {
      if (event.target.matches("[data-mdp-overlay-close]")) { commandOpen = false; workflowOpen = false; aiDrawerOpen = false; renderOverlays(root); return; }
      const routeLink = event.target.closest("[data-mdp-route]");
      if (routeLink) { location.hash = `#${routeLink.dataset.mdpRoute}`; return; }
      if (event.target.closest("[data-mdp-spaces-toggle]")) { root.classList.toggle("is-spaces-open"); return; }
      if (event.target.closest("[data-mdp-command-open]")) { commandOpen = true; commandQuery = ""; workflowOpen = false; aiDrawerOpen = false; renderOverlays(root); requestAnimationFrame(() => root.querySelector("[data-mdp-command-search]")?.focus()); return; }
      const commandTool = event.target.closest("[data-mdp-command-tool]");
      if (commandTool) { commandOpen = false; location.hash = `#/media-design/${commandTool.dataset.mdpCommandTool}`; return; }
      if (event.target.closest("[data-mdp-workflow-toggle]")) { workflowOpen = !workflowOpen; commandOpen = false; aiDrawerOpen = false; renderOverlays(root); return; }
      if (event.target.closest("[data-mdp-ai-toggle]")) { aiDrawerOpen = !aiDrawerOpen; commandOpen = false; workflowOpen = false; renderOverlays(root); return; }
      if (event.target.closest("[data-mdp-inspector-toggle]")) { pageState.inspectorOpen = !pageState.inspectorOpen; saveState(); root.classList.toggle("is-inspector-open", pageState.inspectorOpen); return; }
      const inspectorTab = event.target.closest("[data-mdp-inspector-tab]");
      if (inspectorTab) { pageState.inspectorTab = inspectorTab.dataset.mdpInspectorTab; saveState(); renderInspector(root); return; }
      if (event.target.closest("[data-mdp-undo]") && pageState.navIndex > 0) { pageState.navIndex -= 1; saveState(); selectTool(root, pageState.navHistory[pageState.navIndex], false, false); return; }
      if (event.target.closest("[data-mdp-redo]") && pageState.navIndex < pageState.navHistory.length - 1) { pageState.navIndex += 1; saveState(); selectTool(root, pageState.navHistory[pageState.navIndex], false, false); return; }
      if (event.target.closest('[data-mdp-quick-action="import"]')) { commandOpen = false; renderOverlays(root); root.querySelector("[data-mdp-global-import]")?.click(); return; }
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
      if (event.target.matches("[data-mdp-command-search]")) { commandQuery = event.target.value; renderOverlays(root); requestAnimationFrame(() => { const input = root.querySelector("[data-mdp-command-search]"); input?.focus(); input?.setSelectionRange?.(input.value.length, input.value.length); }); return; }
      if (event.target.matches("[data-mdp-ai-prompt]")) { pageState.aiDraft.prompt = event.target.value.slice(0, 4000); saveState(); return; }
      if (event.target.matches("[data-mdp-ai-seed]")) { pageState.aiDraft.seed = event.target.value.slice(0, 80); saveState(); return; }
      if (event.target.matches("[data-mdp-search]")) return renderCatalog(root);
      window.HHMediaDesign?.handleInput?.(event, root.querySelector("[data-mdp-work]"), pageState.active);
    });
    root.addEventListener("change", (event) => {
      if (event.target.matches("[data-mdp-global-import]")) { ingestFiles(event.target.files, root); event.target.value = ""; return; }
      if (event.target.matches("[data-mdp-ai-task]")) { pageState.aiDraft.task = event.target.value; saveState(); return; }
      if (event.target.matches("[data-mdp-mobile-select]")) { location.hash = `#/media-design/${event.target.value}`; return; }
      if (event.target.matches("[data-mdp-import]")) {
        const file = event.target.files?.[0];
        if (file) importPreferences(file, root).catch(() => showNotice(root, "Tệp cấu hình không hợp lệ.", "error"));
        return;
      }
      window.HHMediaDesign?.handleChange?.(event, root.querySelector("[data-mdp-work]"), pageState.active);
    });
    root.addEventListener("submit", (event) => {
      if (!event.target.matches("[data-mdp-ai-form]")) return;
      event.preventDefault(); aiDrawerOpen = false; saveState(); location.hash = "#/media-design/ai-task-center";
    });
    root.addEventListener("dragenter", (event) => { if (!event.dataTransfer?.types?.includes("Files")) return; event.preventDefault(); dragDepth += 1; root.classList.add("is-dragging-files"); });
    root.addEventListener("dragover", (event) => { if (event.dataTransfer?.types?.includes("Files")) event.preventDefault(); });
    root.addEventListener("dragleave", () => { dragDepth = Math.max(0, dragDepth - 1); if (!dragDepth) root.classList.remove("is-dragging-files"); });
    root.addEventListener("drop", (event) => { if (!event.dataTransfer?.files?.length) return; event.preventDefault(); dragDepth = 0; root.classList.remove("is-dragging-files"); ingestFiles(event.dataTransfer.files, root); });
  };

  addEventListener("keydown", (event) => {
    if (!activeRoot?.isConnected || !location.hash.includes("/media-design")) return;
    if (activeRoot.classList.contains("is-cosmos-view")) return;
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") { event.preventDefault(); commandOpen = !commandOpen; commandQuery = ""; renderOverlays(activeRoot); requestAnimationFrame(() => activeRoot.querySelector("[data-mdp-command-search]")?.focus()); return; }
    if (event.key === "Escape" && (commandOpen || workflowOpen || aiDrawerOpen)) { commandOpen = false; workflowOpen = false; aiDrawerOpen = false; renderOverlays(activeRoot); return; }
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
      window.HHMediaCosmos?.unmount?.();
      window.HHMediaDesign?.cleanup?.();
      window.HHUniversalMediaProject?.unmount?.();
      window.HHMediaProductionWorkflow?.unmount?.();
      window.HHMediaProfessionalSuite?.unmount?.();
      window.HHMediaNextSuite?.unmount?.();
      window.HHMediaAudioStudio?.unmount?.();
    }
  });
  document.addEventListener("visibilitychange", () => activeRoot?.classList.toggle("is-tab-hidden", document.visibilityState === "hidden"));

  window.HHMediaDesignPage = { mount, tools: TOOLS, spaces: STUDIO_SPACES };
  const pendingHost = document.querySelector("[data-media-design-page-host]");
  if (pendingHost) mount(pendingHost, { toolId: pendingHost.dataset.mediaDesignTool || "" });
})();
