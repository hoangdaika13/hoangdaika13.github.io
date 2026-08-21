((factory) => {
  const scope = typeof window !== "undefined" ? window : globalThis;
  const api = factory(scope);
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (scope) scope.HHMediaToolExperience = api;
})((globalScope) => {
  "use strict";

  const SIGNATURES = Object.freeze({
    "media-core": { accent: "#5deaff", glow: "#5577ff", motion: "graph-flow", scene: "flow", label: "Project graph đang đồng bộ" },
    "production-workflow": { accent: "#66f4c3", glow: "#36a7ff", motion: "pipeline-pulse", scene: "flow", label: "Pipeline không phá hủy" },
    "universal-media": { accent: "#57e8ff", glow: "#8a6dff", motion: "media-orbit", scene: "orbit", label: "Media Bin dùng chung" },
    "asset-manager": { accent: "#61c5ff", glow: "#4e7cff", motion: "asset-constellation", scene: "tiles", label: "Asset đang được lập chỉ mục" },
    "review-studio": { accent: "#67f4e1", glow: "#ff70ca", motion: "review-beacon", scene: "scan", label: "Review neo theo vị trí" },
    "universal-canvas": { accent: "#ff67d2", glow: "#6d8cff", motion: "canvas-grid", scene: "grid", label: "Canvas vô hạn" },
    "photo-workspace": { accent: "#ff68ce", glow: "#9a6fff", motion: "histogram-dance", scene: "bars", label: "Photo pipeline nhiều lớp" },
    "ai-task-center": { accent: "#ff75d7", glow: "#ffb85c", motion: "ai-stardust", scene: "orbit", label: "Preview trước khi áp dụng" },
    "photo-editor": { accent: "#ff5fbd", glow: "#6d7cff", motion: "pixel-bloom", scene: "pixels", label: "Layer editor không phá hủy" },
    "video-workspace": { accent: "#a978ff", glow: "#536fff", motion: "timeline-playhead", scene: "timeline", label: "Timeline nhiều track" },
    "motion-compositor": { accent: "#a873ff", glow: "#ff65cf", motion: "node-current", scene: "nodes", label: "Node truyền xung năng lượng" },
    "audio-workspace": { accent: "#51edc8", glow: "#31a9ff", motion: "waveform-live", scene: "wave", label: "Waveform phản ứng thời gian thực" },
    "background-remover": { accent: "#ff65bd", glow: "#59e7ff", motion: "alpha-reveal", scene: "split", label: "Alpha matte preview" },
    "collage": { accent: "#ff8cd8", glow: "#ffc45f", motion: "collage-shuffle", scene: "tiles", label: "Khung ảnh tự sắp xếp" },
    "inspector": { accent: "#5ee8ff", glow: "#9e72ff", motion: "metadata-scan", scene: "scan", label: "Đọc metadata cục bộ" },
    "compress": { accent: "#58f0bf", glow: "#59a8ff", motion: "compression-rings", scene: "rings", label: "Tối ưu dung lượng thật" },
    "convert": { accent: "#63dfff", glow: "#bd6cff", motion: "format-transfer", scene: "flow", label: "Chuyển đổi định dạng" },
    "image": { accent: "#ff78c8", glow: "#66dfff", motion: "filter-spectrum", scene: "spectrum", label: "Biến đổi pixel trực tiếp" },
    "document-workspace": { accent: "#70ead2", glow: "#87a8ff", motion: "document-stack", scene: "pages", label: "Document inbox có kiểm chứng" },
    "pdf": { accent: "#69ebd5", glow: "#e7e9ff", motion: "pdf-page-turn", scene: "pages", label: "PDF engine sẵn sàng" },
    "qr": { accent: "#58f2c8", glow: "#63a8ff", motion: "qr-pixels", scene: "pixels", label: "QR tạo và quét thật" },
    "brand-workspace": { accent: "#ffc55e", glow: "#ff725f", motion: "token-fusion", scene: "orbit", label: "Design token đang liên kết" },
    "dev-handoff": { accent: "#ffd064", glow: "#58dfff", motion: "code-stream", scene: "flow", label: "Handoff có thể xuất mã" },
    "color": { accent: "#ff6fc9", glow: "#ffd35e", motion: "palette-orbit", scene: "orbit", label: "Color harmony trực tiếp" },
    "type": { accent: "#ffd36a", glow: "#ff75cc", motion: "glyph-float", scene: "glyphs", label: "Type scale trực tiếp" },
    "icon": { accent: "#66dfff", glow: "#8a72ff", motion: "icon-constellation", scene: "tiles", label: "Icon vector có thể xuất" },
    "svg": { accent: "#63edca", glow: "#b56dff", motion: "vector-trace", scene: "path", label: "SVG được lọc an toàn" },
    "gradient": { accent: "#ff67c9", glow: "#62e6ff", motion: "gradient-ribbon", scene: "spectrum", label: "Gradient nhiều điểm màu" },
    "picker": { accent: "#63e8ff", glow: "#ff72c8", motion: "pixel-target", scene: "target", label: "Lấy màu theo pixel" },
    "asset-workspace": { accent: "#5ea4ff", glow: "#51e7d3", motion: "galaxy-index", scene: "orbit", label: "Checksum và provenance" },
    "media-cloud": { accent: "#61a8ff", glow: "#6fe8d5", motion: "cloud-uplink", scene: "flow", label: "Private cloud có kiểm soát" },
    "social-post": { accent: "#ff73c8", glow: "#6d8cff", motion: "social-tiles", scene: "tiles", label: "Artboard mạng xã hội" },
    "brand-kit": { accent: "#ffc75f", glow: "#ff735f", motion: "brand-core", scene: "orbit", label: "Brand board trực tiếp" },
    "favicon": { accent: "#69e6ff", glow: "#9a74ff", motion: "icon-satellites", scene: "orbit", label: "Icon family đa kích thước" },
    "meme": { accent: "#ff76c9", glow: "#ffd45f", motion: "caption-burst", scene: "burst", label: "Caption canvas trực tiếp" },
    "export-workspace": { accent: "#ffe36b", glow: "#ff6ebd", motion: "delivery-lanes", scene: "flow", label: "Preflight và delivery queue" }
  });
  const observers = new WeakMap();

  const escapeHtml = (value) => String(value == null ? "" : value)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");

  function sceneMarkup(signature) {
    return `<div class="mte-atmosphere" data-mte-motion="${escapeHtml(signature.motion)}" data-mte-scene="${escapeHtml(signature.scene)}" aria-hidden="true"><i class="mte-core"></i><i class="mte-beam"></i><div class="mte-particles">${Array.from({ length: 9 }, (_, index) => `<span style="--i:${index}"></span>`).join("")}</div></div>`;
  }

  function decorate(work, tool) {
    if (!work || !tool?.id) return false;
    const signature = SIGNATURES[tool.id];
    if (!signature) return false;
    work.querySelector(":scope > .mte-atmosphere")?.remove();
    work.dataset.mediaToolId = tool.id;
    work.dataset.mediaMotion = signature.motion;
    work.style.setProperty("--mte-accent", signature.accent);
    work.style.setProperty("--mte-glow", signature.glow);
    work.insertAdjacentHTML("afterbegin", sceneMarkup(signature));
    const surface = [...work.children].find((node) => !node.classList.contains("mte-atmosphere"));
    if (surface) {
      surface.classList.add("mte-surface");
      surface.dataset.mteTool = tool.id;
    }
    const context = work.closest("[data-media-design-page]")?.querySelector("[data-mdp-context]");
    if (context) context.dataset.mteTool = tool.id;
    if (globalScope.MutationObserver && !observers.has(work)) {
      const observer = new globalScope.MutationObserver(() => {
        if (!work.isConnected || work.querySelector(":scope > .mte-atmosphere")) return;
        globalScope.requestAnimationFrame?.(() => { if (work.isConnected && !work.querySelector(":scope > .mte-atmosphere")) decorate(work, tool); });
      });
      observer.observe(work, { childList: true });
      observers.set(work, observer);
    }
    globalScope.requestAnimationFrame?.(() => work.classList.add("is-mte-live"));
    return true;
  }

  function clear(work) {
    if (!work) return;
    observers.get(work)?.disconnect();
    observers.delete(work);
    work.classList.remove("is-mte-live");
    work.querySelector(":scope > .mte-atmosphere")?.remove();
    delete work.dataset.mediaToolId;
    delete work.dataset.mediaMotion;
  }

  return { SIGNATURES, decorate, clear, sceneMarkup };
});
