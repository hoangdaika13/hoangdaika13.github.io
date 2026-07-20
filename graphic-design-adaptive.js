(function (globalScope) {
  "use strict";

  const VERSION = 1;
  const FORMAT = "hh-adaptive-design";
  const STORAGE_KEY = "hh.graphic-adaptive.project.v1";
  const STYLE_ID = "hh-graphic-adaptive-style-v1";
  const MAX_HISTORY = 50;
  const instances = new WeakMap();

  const PRESETS = Object.freeze({
    instagram: { id: "instagram", label: "Instagram Post", short: "IG", width: 1080, height: 1080, safe: { top: 64, right: 64, bottom: 64, left: 64 } },
    story: { id: "story", label: "Instagram Story", short: "ST", width: 1080, height: 1920, safe: { top: 250, right: 72, bottom: 310, left: 72 } },
    youtube: { id: "youtube", label: "YouTube Thumbnail", short: "YT", width: 1280, height: 720, safe: { top: 48, right: 80, bottom: 76, left: 80 } },
    banner: { id: "banner", label: "Web Banner", short: "WB", width: 1500, height: 500, safe: { top: 44, right: 96, bottom: 44, left: 96 } },
    ads: { id: "ads", label: "Display Ads", short: "AD", width: 1200, height: 628, safe: { top: 48, right: 64, bottom: 48, left: 64 } }
  });

  const BRAND_FONTS = Object.freeze(["Inter", "Arial", "Georgia", "Trebuchet MS", "Verdana"]);

  function uid(prefix) {
    return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  }

  function clamp(value, min, max, fallback) {
    const number = Number(value);
    return Math.min(max, Math.max(min, Number.isFinite(number) ? number : fallback));
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  function safeColor(value, fallback) {
    return /^#[0-9a-f]{6}$/i.test(String(value || "")) ? String(value).toUpperCase() : fallback;
  }

  function createDefaultProject() {
    return {
      format: FORMAT,
      version: VERSION,
      id: uid("adaptive"),
      name: "Chiến dịch sáng tạo mới",
      updatedAt: new Date().toISOString(),
      master: {
        title: "Một thiết kế, mọi định dạng",
        subtitle: "Thay đổi một lần và đồng bộ toàn bộ chiến dịch.",
        callToAction: "Khám phá ngay",
        image: null,
        focalPoint: { x: 0.5, y: 0.45 },
        overlay: 0.38,
        titleScale: 1,
        align: "left"
      },
      brand: {
        name: "HH Creative",
        logo: "HH",
        primary: "#F25CB4",
        secondary: "#62D9E6",
        accent: "#C8EF73",
        background: "#101528",
        text: "#FFFFFF",
        fontHeading: "Inter",
        fontBody: "Inter"
      },
      variants: Object.keys(PRESETS).map((presetId) => ({ presetId, enabled: true, overrides: {} }))
    };
  }

  function normalizeProject(raw) {
    const fallback = createDefaultProject();
    const source = raw && typeof raw === "object" ? raw : {};
    const master = source.master && typeof source.master === "object" ? source.master : {};
    const brand = source.brand && typeof source.brand === "object" ? source.brand : {};
    const variants = Array.isArray(source.variants) ? source.variants : fallback.variants;
    return {
      format: FORMAT,
      version: VERSION,
      id: String(source.id || fallback.id).slice(0, 120),
      name: String(source.name || fallback.name).slice(0, 160),
      updatedAt: new Date().toISOString(),
      master: {
        title: String(master.title || fallback.master.title).slice(0, 180),
        subtitle: String(master.subtitle || fallback.master.subtitle).slice(0, 320),
        callToAction: String(master.callToAction || fallback.master.callToAction).slice(0, 80),
        image: master.image && /^data:image\/(png|jpeg|webp);base64,/i.test(master.image.dataUrl || "") ? {
          name: String(master.image.name || "Ảnh chiến dịch").slice(0, 160),
          type: String(master.image.type || "image/png").slice(0, 80),
          width: Math.round(clamp(master.image.width, 1, 16384, 1)),
          height: Math.round(clamp(master.image.height, 1, 16384, 1)),
          dataUrl: master.image.dataUrl
        } : null,
        focalPoint: { x: clamp(master.focalPoint?.x, 0, 1, 0.5), y: clamp(master.focalPoint?.y, 0, 1, 0.45) },
        overlay: clamp(master.overlay, 0, 0.9, fallback.master.overlay),
        titleScale: clamp(master.titleScale, 0.6, 1.8, 1),
        align: ["left", "center", "right"].includes(master.align) ? master.align : "left"
      },
      brand: {
        name: String(brand.name || fallback.brand.name).slice(0, 100),
        logo: String(brand.logo || fallback.brand.logo).slice(0, 16),
        primary: safeColor(brand.primary, fallback.brand.primary),
        secondary: safeColor(brand.secondary, fallback.brand.secondary),
        accent: safeColor(brand.accent, fallback.brand.accent),
        background: safeColor(brand.background, fallback.brand.background),
        text: safeColor(brand.text, fallback.brand.text),
        fontHeading: BRAND_FONTS.includes(brand.fontHeading) ? brand.fontHeading : fallback.brand.fontHeading,
        fontBody: BRAND_FONTS.includes(brand.fontBody) ? brand.fontBody : fallback.brand.fontBody
      },
      variants: Object.keys(PRESETS).map((presetId) => {
        const variant = variants.find((item) => item?.presetId === presetId) || {};
        return { presetId, enabled: variant.enabled !== false, overrides: variant.overrides && typeof variant.overrides === "object" ? clone(variant.overrides) : {} };
      })
    };
  }

  function calculateCoverCrop(imageWidth, imageHeight, outputWidth, outputHeight, focalPoint) {
    const iw = Math.max(1, Number(imageWidth) || 1);
    const ih = Math.max(1, Number(imageHeight) || 1);
    const ow = Math.max(1, Number(outputWidth) || 1);
    const oh = Math.max(1, Number(outputHeight) || 1);
    const scale = Math.max(ow / iw, oh / ih);
    const sourceWidth = ow / scale;
    const sourceHeight = oh / scale;
    const focalX = clamp(focalPoint?.x, 0, 1, 0.5) * iw;
    const focalY = clamp(focalPoint?.y, 0, 1, 0.5) * ih;
    return {
      sx: clamp(focalX - sourceWidth / 2, 0, iw - sourceWidth, 0),
      sy: clamp(focalY - sourceHeight / 2, 0, ih - sourceHeight, 0),
      sw: sourceWidth,
      sh: sourceHeight,
      dx: 0,
      dy: 0,
      dw: ow,
      dh: oh,
      scale
    };
  }

  function safeZone(presetId) {
    const preset = PRESETS[presetId] || PRESETS.instagram;
    return clone(preset.safe);
  }

  function reflowLayout(projectInput, presetId) {
    const project = normalizeProject(projectInput);
    const preset = PRESETS[presetId] || PRESETS.instagram;
    const safe = preset.safe;
    const portrait = preset.height / preset.width > 1.3;
    const wide = preset.width / preset.height > 2;
    const contentWidth = preset.width - safe.left - safe.right;
    const align = project.master.align;
    const x = align === "left" ? safe.left : align === "right" ? preset.width - safe.right : preset.width / 2;
    const anchor = align === "left" ? "left" : align === "right" ? "right" : "center";
    const titleSize = Math.round(Math.min(preset.width * (wide ? 0.054 : portrait ? 0.086 : 0.072), preset.height * 0.16) * project.master.titleScale);
    const subtitleSize = Math.round(titleSize * 0.38);
    const top = portrait ? preset.height * 0.57 : wide ? preset.height * 0.27 : preset.height * 0.47;
    return {
      presetId,
      width: preset.width,
      height: preset.height,
      safe,
      content: { x, y: clamp(top, safe.top, preset.height - safe.bottom - titleSize * 3, safe.top), width: contentWidth, anchor },
      logo: { x: align === "right" ? preset.width - safe.right : safe.left, y: safe.top, size: Math.round(Math.min(preset.width, preset.height) * 0.075) },
      title: { size: Math.max(28, titleSize), lineHeight: 1.02, maxLines: wide ? 2 : 3 },
      subtitle: { size: Math.max(16, subtitleSize), lineHeight: 1.35, maxLines: portrait ? 3 : 2 },
      cta: { height: Math.max(44, Math.round(titleSize * 0.72)), padding: Math.max(18, Math.round(titleSize * 0.35)) }
    };
  }

  function createVariants(projectInput) {
    const project = normalizeProject(projectInput);
    return project.variants.filter((variant) => variant.enabled).map((variant) => ({
      ...variant,
      preset: clone(PRESETS[variant.presetId]),
      layout: reflowLayout(project, variant.presetId),
      content: { ...clone(project.master), ...clone(variant.overrides.content || {}) },
      brand: { ...clone(project.brand), ...clone(variant.overrides.brand || {}) }
    }));
  }

  function wrapText(context, text, maxWidth, maxLines) {
    const words = String(text || "").trim().split(/\s+/).filter(Boolean);
    const lines = [];
    let line = "";
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (line && context.measureText(candidate).width > maxWidth) { lines.push(line); line = word; }
      else line = candidate;
      if (lines.length >= maxLines) break;
    }
    if (line && lines.length < maxLines) lines.push(line);
    if (words.length && lines.length === maxLines) {
      const joined = lines.join(" ");
      if (joined.length < String(text).length) lines[lines.length - 1] = `${lines[lines.length - 1].replace(/[.…]+$/, "")}…`;
    }
    return lines;
  }

  function roundedRect(context, x, y, width, height, radius) {
    const r = Math.min(radius, width / 2, height / 2);
    context.beginPath(); context.moveTo(x + r, y); context.lineTo(x + width - r, y); context.quadraticCurveTo(x + width, y, x + width, y + r); context.lineTo(x + width, y + height - r); context.quadraticCurveTo(x + width, y + height, x + width - r, y + height); context.lineTo(x + r, y + height); context.quadraticCurveTo(x, y + height, x, y + height - r); context.lineTo(x, y + r); context.quadraticCurveTo(x, y, x + r, y); context.closePath();
  }

  function drawSafeZone(context, layout) {
    const safe = layout.safe;
    context.save(); context.strokeStyle = "rgba(200,239,115,.72)"; context.lineWidth = Math.max(2, layout.width / 600); context.setLineDash([12, 9]);
    context.strokeRect(safe.left, safe.top, layout.width - safe.left - safe.right, layout.height - safe.top - safe.bottom);
    context.restore();
  }

  function renderArtboard(canvas, projectInput, presetId, options) {
    if (!canvas || typeof canvas.getContext !== "function") return false;
    const project = normalizeProject(projectInput);
    const layout = reflowLayout(project, presetId);
    const context = canvas.getContext("2d");
    if (!context) return false;
    const ratio = options?.pixelRatio || 1;
    canvas.width = Math.max(1, Math.round(layout.width * ratio));
    canvas.height = Math.max(1, Math.round(layout.height * ratio));
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    const gradient = context.createLinearGradient(0, 0, layout.width, layout.height);
    gradient.addColorStop(0, project.brand.background); gradient.addColorStop(0.55, project.brand.primary); gradient.addColorStop(1, project.brand.secondary);
    context.fillStyle = gradient; context.fillRect(0, 0, layout.width, layout.height);
    const image = options?.image;
    if (image && image.naturalWidth && image.naturalHeight) {
      const crop = calculateCoverCrop(image.naturalWidth, image.naturalHeight, layout.width, layout.height, project.master.focalPoint);
      context.drawImage(image, crop.sx, crop.sy, crop.sw, crop.sh, 0, 0, layout.width, layout.height);
    }
    context.fillStyle = `rgba(4,8,18,${project.master.overlay})`; context.fillRect(0, 0, layout.width, layout.height);
    const align = layout.content.anchor;
    context.textAlign = align;
    context.textBaseline = "top";
    context.fillStyle = project.brand.text;
    context.font = `900 ${layout.title.size}px ${project.brand.fontHeading},sans-serif`;
    const titleLines = wrapText(context, project.master.title, layout.content.width, layout.title.maxLines);
    let y = layout.content.y;
    titleLines.forEach((line) => { context.fillText(line, layout.content.x, y, layout.content.width); y += layout.title.size * layout.title.lineHeight; });
    y += layout.title.size * 0.24;
    context.font = `500 ${layout.subtitle.size}px ${project.brand.fontBody},sans-serif`; context.globalAlpha = 0.9;
    wrapText(context, project.master.subtitle, layout.content.width, layout.subtitle.maxLines).forEach((line) => { context.fillText(line, layout.content.x, y, layout.content.width); y += layout.subtitle.size * layout.subtitle.lineHeight; });
    context.globalAlpha = 1;
    y += layout.subtitle.size * 0.65;
    context.font = `800 ${Math.round(layout.cta.height * 0.36)}px ${project.brand.fontBody},sans-serif`;
    const ctaWidth = Math.min(layout.content.width, context.measureText(project.master.callToAction).width + layout.cta.padding * 2);
    const ctaX = align === "left" ? layout.content.x : align === "right" ? layout.content.x - ctaWidth : layout.content.x - ctaWidth / 2;
    roundedRect(context, ctaX, y, ctaWidth, layout.cta.height, layout.cta.height / 2); context.fillStyle = project.brand.accent; context.fill();
    context.fillStyle = project.brand.background; context.textAlign = "center"; context.textBaseline = "middle"; context.fillText(project.master.callToAction, ctaX + ctaWidth / 2, y + layout.cta.height / 2);
    context.textAlign = "left"; context.textBaseline = "top"; context.fillStyle = project.brand.text; context.font = `900 ${Math.round(layout.logo.size * 0.44)}px ${project.brand.fontHeading},sans-serif`;
    roundedRect(context, layout.logo.x, layout.logo.y, layout.logo.size, layout.logo.size, layout.logo.size * 0.22); context.fillStyle = project.brand.primary; context.fill();
    context.fillStyle = project.brand.text; context.textAlign = "center"; context.textBaseline = "middle"; context.fillText(project.brand.logo, layout.logo.x + layout.logo.size / 2, layout.logo.y + layout.logo.size / 2);
    if (options?.showSafeZone) drawSafeZone(context, layout);
    return true;
  }

  function serializeProject(projectInput) {
    return JSON.stringify(normalizeProject(projectInput), null, 2);
  }

  function brandTokens(projectInput) {
    const brand = normalizeProject(projectInput).brand;
    return `:root {\n  --brand-primary: ${brand.primary};\n  --brand-secondary: ${brand.secondary};\n  --brand-accent: ${brand.accent};\n  --brand-background: ${brand.background};\n  --brand-text: ${brand.text};\n  --brand-font-heading: "${brand.fontHeading}";\n  --brand-font-body: "${brand.fontBody}";\n}`;
  }

  function addStyles() {
    if (typeof document === "undefined" || document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style"); style.id = STYLE_ID;
    style.textContent = `
      .gad{--cyan:#61dce8;--pink:#f25cb4;--lime:#c8ef73;--bg:#080d16;--panel:#111a26;--line:#2b3a4c;--muted:#91a2b5;color:#edf7ff;background:var(--bg);border:1px solid var(--line);border-radius:12px;overflow:hidden;font:500 13px/1.45 Inter,system-ui,sans-serif}.gad *{box-sizing:border-box}.gad button,.gad input,.gad select,.gad textarea{font:inherit}.gad button{min-height:34px;padding:7px 11px;border:1px solid #3b5063;border-radius:7px;background:#142130;color:#eaf8ff;cursor:pointer}.gad button:hover,.gad button:focus-visible{outline:0;border-color:var(--cyan);box-shadow:0 0 0 2px rgba(97,220,232,.16)}.gad-primary{border:0!important;background:linear-gradient(135deg,var(--cyan),#9ce8ac)!important;color:#071018!important;font-weight:800}.gad-head{display:flex;align-items:center;gap:12px;padding:16px 18px;border-bottom:1px solid var(--line);background:linear-gradient(110deg,rgba(97,220,232,.1),transparent 48%,rgba(242,92,180,.12))}.gad-logo{display:grid;place-items:center;width:42px;height:42px;border-radius:11px;background:linear-gradient(135deg,var(--pink),var(--cyan));color:#08101a;font-weight:900}.gad-head h2{margin:0;font-size:18px}.gad-head p{margin:2px 0 0;color:var(--muted);font-size:11px}.gad-head-actions{display:flex;gap:7px;margin-left:auto}.gad-main{display:grid;grid-template-columns:280px minmax(400px,1fr);min-height:680px}.gad-inspector{padding:14px;border-right:1px solid var(--line);background:#0b121c;overflow:auto}.gad-panel{padding:12px;border:1px solid var(--line);border-radius:9px;background:var(--panel);margin-bottom:10px}.gad-panel h3{margin:0 0 10px;color:var(--cyan);font-size:11px;text-transform:uppercase}.gad-stack{display:grid;gap:8px}.gad-row{display:flex;align-items:center;gap:7px}.gad input,.gad select,.gad textarea{width:100%;min-height:35px;padding:7px 9px;border:1px solid var(--line);border-radius:7px;background:#090f18;color:#edf7ff}.gad textarea{min-height:66px;resize:vertical}.gad-color-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:6px}.gad-color-grid input{height:38px;padding:3px}.gad-workspace{display:grid;grid-template-rows:auto 1fr auto;min-width:0;background:#080d15}.gad-toolbar{display:flex;align-items:center;gap:7px;padding:10px 12px;border-bottom:1px solid var(--line);overflow:auto}.gad-toolbar .gad-status{margin-left:auto}.gad-artboards{display:grid;grid-template-columns:repeat(2,minmax(240px,1fr));align-content:start;gap:14px;padding:16px;overflow:auto}.gad-artboard{position:relative;padding:10px;border:1px solid var(--line);border-radius:10px;background:#101925}.gad-artboard.is-active{border-color:var(--pink);box-shadow:0 0 0 2px rgba(242,92,180,.12)}.gad-artboard-head{display:flex;align-items:center;gap:7px;margin-bottom:8px}.gad-artboard-head span{color:var(--muted);font-size:10px}.gad-artboard-head button{margin-left:auto;min-height:27px;padding:4px 7px;font-size:10px}.gad-canvas-wrap{display:grid;place-items:center;min-height:220px;padding:9px;overflow:hidden;border-radius:7px;background:linear-gradient(45deg,#0a111a 25%,#101925 25%,#101925 75%,#0a111a 75%);background-size:20px 20px}.gad canvas{display:block;max-width:100%;max-height:330px;border:1px solid #3d5367;box-shadow:0 14px 34px rgba(0,0,0,.38)}.gad-footer{display:flex;align-items:center;gap:10px;padding:9px 12px;border-top:1px solid var(--line);color:var(--muted);font-size:11px}.gad-badge{padding:3px 7px;border:1px solid #3a5367;border-radius:999px;color:var(--cyan)}.gad-drop{display:grid;place-items:center;min-height:82px;border:1px dashed #49647a;border-radius:8px;text-align:center;color:var(--muted)}.gad-drop.is-over{border-color:var(--cyan);background:rgba(97,220,232,.08)}.gad-focal{position:relative;min-height:92px;overflow:hidden;border-radius:8px;background:linear-gradient(135deg,var(--pink),#20294f,var(--cyan));cursor:crosshair}.gad-focal::after{content:"";position:absolute;left:calc(var(--fx)*100%);top:calc(var(--fy)*100%);width:14px;height:14px;border:2px solid #fff;border-radius:50%;transform:translate(-50%,-50%);box-shadow:0 0 0 4px rgba(0,0,0,.35)}.gad-focal img{width:100%;height:110px;object-fit:cover}.gad-status{color:var(--muted);font-size:11px}.gad-sr{position:absolute!important;width:1px!important;height:1px!important;overflow:hidden!important;clip:rect(0,0,0,0)!important}
      @media(max-width:920px){.gad-main{grid-template-columns:240px 1fr}.gad-artboards{grid-template-columns:1fr}}@media(max-width:680px){.gad-head{align-items:flex-start;flex-wrap:wrap}.gad-head-actions{width:100%;margin-left:0;overflow:auto}.gad-main{display:block}.gad-inspector{border-right:0;border-bottom:1px solid var(--line)}.gad-artboards{padding:10px}.gad-toolbar{position:sticky;top:0;z-index:3;background:#0b121c}.gad canvas{max-height:430px}}@media(prefers-reduced-motion:reduce){.gad *{animation-duration:.001ms!important;transition-duration:.001ms!important;scroll-behavior:auto!important}}
    `;
    document.head.appendChild(style);
  }

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob); const anchor = document.createElement("a"); anchor.href = url; anchor.download = filename; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  function mount(root, options) {
    if (!root || typeof root.querySelector !== "function") return null;
    if (instances.has(root)) return instances.get(root);
    addStyles();
    let project;
    try { project = normalizeProject(options?.project || JSON.parse(localStorage.getItem(STORAGE_KEY) || "null")); } catch (_) { project = createDefaultProject(); }
    let history = [clone(project)]; let historyIndex = 0; let showSafeZone = true; let activePreset = "instagram"; let image = null;
    root.classList.add("gad");
    root.innerHTML = `<header class="gad-head"><div class="gad-logo" aria-hidden="true">AD</div><div><h2>Adaptive Design Studio</h2><p>Edit once · synced artboards · smart crop · Brand Kit · safe zones</p></div><div class="gad-head-actions"><button type="button" data-gad-action="undo" aria-label="Hoàn tác" title="Ctrl Z">Hoàn tác</button><button type="button" data-gad-action="redo" aria-label="Làm lại" title="Ctrl Y">Làm lại</button><button type="button" data-gad-action="import">Nhập JSON</button><button type="button" class="gad-primary" data-gad-action="export-all">Xuất tất cả</button></div></header><div class="gad-main"><aside class="gad-inspector"><section class="gad-panel"><h3>Nội dung master</h3><div class="gad-stack"><label>Tiêu đề<textarea data-gad-field="title" maxlength="180"></textarea></label><label>Mô tả<textarea data-gad-field="subtitle" maxlength="320"></textarea></label><label>Nút hành động<input data-gad-field="callToAction" maxlength="80"></label><div class="gad-row"><label>Căn<select data-gad-field="align"><option value="left">Trái</option><option value="center">Giữa</option><option value="right">Phải</option></select></label><label>Cỡ tiêu đề<input type="range" min="0.6" max="1.8" step="0.05" data-gad-field="titleScale"></label></div></div></section><section class="gad-panel"><h3>Ảnh & Smart Crop</h3><button type="button" class="gad-drop" data-gad-drop><span>Thả hoặc chọn ảnh<br><small>PNG, JPG, WebP · xử lý trên thiết bị</small></span></button><div class="gad-focal" data-gad-focal tabindex="0" role="slider" aria-label="Điểm tập trung của ảnh" aria-valuemin="0" aria-valuemax="100"><span class="gad-sr">Bấm vào ảnh để đặt focal point</span></div><label>Lớp phủ<input type="range" min="0" max="0.9" step="0.02" data-gad-field="overlay"></label></section><section class="gad-panel"><h3>Brand Kit</h3><div class="gad-stack"><label>Tên thương hiệu<input data-gad-brand="name"></label><label>Logo chữ<input data-gad-brand="logo" maxlength="16"></label><div class="gad-color-grid"><label>Chính<input type="color" data-gad-brand="primary"></label><label>Phụ<input type="color" data-gad-brand="secondary"></label><label>Nhấn<input type="color" data-gad-brand="accent"></label></div><label>Font tiêu đề<select data-gad-brand="fontHeading">${BRAND_FONTS.map((font) => `<option>${font}</option>`).join("")}</select></label><button type="button" data-gad-action="copy-tokens">Sao chép design token</button></div></section></aside><section class="gad-workspace"><div class="gad-toolbar"><button type="button" data-gad-action="toggle-safe">Safe zone: Bật</button><span class="gad-badge">5 định dạng đồng bộ</span><span class="gad-status" role="status" aria-live="polite" data-gad-status>Sẵn sàng.</span></div><div class="gad-artboards" data-gad-artboards></div><footer class="gad-footer"><span>Smart crop theo focal point</span><span>Reflow theo constraint</span><span data-gad-save>Tự lưu cục bộ</span></footer></section></div><input hidden type="file" accept="image/png,image/jpeg,image/webp" data-gad-image-file><input hidden type="file" accept="application/json,.json" data-gad-import-file>`;
    const qs = (selector) => root.querySelector(selector);
    const status = (message) => { qs("[data-gad-status]").textContent = message; };

    function persist() {
      try { localStorage.setItem(STORAGE_KEY, serializeProject(project)); qs("[data-gad-save]").textContent = `Đã lưu ${new Date().toLocaleTimeString("vi-VN")}`; } catch (_) { qs("[data-gad-save]").textContent = "Không thể lưu cục bộ"; }
    }
    function remember() { history.splice(historyIndex + 1); history.push(clone(project)); if (history.length > MAX_HISTORY) history.shift(); historyIndex = history.length - 1; persist(); }
    function loadImage() {
      image = null;
      if (!project.master.image?.dataUrl || typeof Image === "undefined") return renderCanvases();
      image = new Image(); image.onload = renderCanvases; image.src = project.master.image.dataUrl;
    }
    function renderInspector() {
      ["title", "subtitle", "callToAction", "align", "titleScale", "overlay"].forEach((key) => { const node = qs(`[data-gad-field="${key}"]`); if (node) node.value = project.master[key]; });
      Object.keys(project.brand).forEach((key) => { const node = qs(`[data-gad-brand="${key}"]`); if (node) node.value = project.brand[key]; });
      const focal = qs("[data-gad-focal]"); focal.style.setProperty("--fx", project.master.focalPoint.x); focal.style.setProperty("--fy", project.master.focalPoint.y);
      focal.innerHTML = project.master.image ? `<img alt="Ảnh gốc để chọn focal point" src="${project.master.image.dataUrl}">` : `<span>Chưa có ảnh · dùng nền Brand Kit</span>`;
    }
    function renderArtboards() {
      qs("[data-gad-artboards]").innerHTML = createVariants(project).map((variant) => `<article class="gad-artboard ${variant.presetId === activePreset ? "is-active" : ""}" data-gad-card="${variant.presetId}"><div class="gad-artboard-head"><strong>${escapeHtml(variant.preset.label)}</strong><span>${variant.preset.width} × ${variant.preset.height}</span><button type="button" data-gad-export="${variant.presetId}">PNG</button></div><div class="gad-canvas-wrap"><canvas data-gad-canvas="${variant.presetId}" aria-label="Xem trước ${escapeHtml(variant.preset.label)}"></canvas></div></article>`).join("");
    }
    function renderCanvases() {
      root.querySelectorAll("[data-gad-canvas]").forEach((canvas) => renderArtboard(canvas, project, canvas.dataset.gadCanvas, { image, showSafeZone, pixelRatio: 0.38 }));
    }
    function render() { renderInspector(); renderArtboards(); renderCanvases(); }
    function change(mutator, final) { mutator(project); project = normalizeProject(project); render(); if (final) remember(); else persist(); }
    function undo() { if (historyIndex <= 0) return status("Không còn bước để hoàn tác."); historyIndex -= 1; project = normalizeProject(history[historyIndex]); loadImage(); render(); persist(); }
    function redo() { if (historyIndex >= history.length - 1) return status("Không còn bước để làm lại."); historyIndex += 1; project = normalizeProject(history[historyIndex]); loadImage(); render(); persist(); }
    async function exportPng(presetId) {
      const canvas = document.createElement("canvas"); renderArtboard(canvas, project, presetId, { image, showSafeZone: false, pixelRatio: 1 });
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
      if (!blob) return status("Trình duyệt không thể tạo PNG.");
      downloadBlob(blob, `${project.name.replace(/[^a-z0-9]+/gi, "-") || "adaptive"}-${presetId}.png`); status(`Đã xuất ${PRESETS[presetId].label}.`);
    }
    function importImage(file) {
      if (!/^image\/(png|jpeg|webp)$/i.test(file.type)) return status("Chỉ nhận PNG, JPG hoặc WebP.");
      const reader = new FileReader(); reader.onload = () => { const nextImage = new Image(); nextImage.onload = () => { change((draft) => { draft.master.image = { name: file.name, type: file.type, width: nextImage.naturalWidth, height: nextImage.naturalHeight, dataUrl: reader.result }; }, true); image = nextImage; render(); status("Đã đồng bộ ảnh sang 5 artboard."); }; nextImage.src = reader.result; }; reader.readAsDataURL(file);
    }
    function setFocal(clientX, clientY) {
      const focal = qs("[data-gad-focal]"); const rect = focal.getBoundingClientRect();
      change((draft) => { draft.master.focalPoint = { x: clamp((clientX - rect.left) / rect.width, 0, 1, 0.5), y: clamp((clientY - rect.top) / rect.height, 0, 1, 0.5) }; }, true);
      status("Đã cập nhật Smart Crop theo focal point.");
    }
    const onClick = async (event) => {
      const target = event.target.closest("button,[data-gad-focal],[data-gad-card]"); if (!target || !root.contains(target)) return;
      if (target.dataset.gadCard && !event.target.closest("button")) { activePreset = target.dataset.gadCard; return renderArtboards(), renderCanvases(); }
      if (target.matches("[data-gad-focal]")) return setFocal(event.clientX, event.clientY);
      if (target.dataset.gadExport) return exportPng(target.dataset.gadExport);
      const action = target.dataset.gadAction;
      if (action === "undo") return undo(); if (action === "redo") return redo();
      if (action === "import") return qs("[data-gad-import-file]").click();
      if (action === "export-all") { downloadBlob(new Blob([serializeProject(project)], { type: "application/json" }), `${project.name.replace(/[^a-z0-9]+/gi, "-") || "adaptive"}.json`); return status("Đã xuất project JSON. Có thể xuất PNG riêng trên từng artboard."); }
      if (action === "toggle-safe") { showSafeZone = !showSafeZone; target.textContent = `Safe zone: ${showSafeZone ? "Bật" : "Tắt"}`; return renderCanvases(); }
      if (action === "copy-tokens") { await navigator.clipboard?.writeText(brandTokens(project)); return status("Đã sao chép design token CSS."); }
      if (target.matches("[data-gad-drop]")) return qs("[data-gad-image-file]").click();
    };
    const onInput = (event) => {
      if (event.target.dataset.gadField) return change((draft) => { draft.master[event.target.dataset.gadField] = event.target.type === "range" ? Number(event.target.value) : event.target.value; }, false);
      if (event.target.dataset.gadBrand) return change((draft) => { draft.brand[event.target.dataset.gadBrand] = event.target.value; }, false);
    };
    const onChange = (event) => {
      if (event.target.matches("[data-gad-field],[data-gad-brand]")) { remember(); status("Đã đồng bộ thay đổi sang mọi artboard."); }
      if (event.target.matches("[data-gad-image-file]") && event.target.files[0]) importImage(event.target.files[0]);
      if (event.target.matches("[data-gad-import-file]") && event.target.files[0]) { const reader = new FileReader(); reader.onload = () => { try { const parsed = JSON.parse(reader.result); if (parsed.format !== FORMAT) throw new Error(); project = normalizeProject(parsed); history = [clone(project)]; historyIndex = 0; loadImage(); render(); persist(); status("Đã nhập project Adaptive Design."); } catch (_) { status("Project JSON không hợp lệ."); } }; reader.readAsText(event.target.files[0]); }
    };
    const drop = qs("[data-gad-drop]");
    const onDragOver = (event) => { event.preventDefault(); drop.classList.add("is-over"); };
    const onDragLeave = () => drop.classList.remove("is-over");
    const onDrop = (event) => { event.preventDefault(); drop.classList.remove("is-over"); if (event.dataTransfer.files[0]) importImage(event.dataTransfer.files[0]); };
    const onKeydown = (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") { event.preventDefault(); return event.shiftKey ? redo() : undo(); }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "y") { event.preventDefault(); return redo(); }
      if (event.target.matches("[data-gad-focal]") && ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) { event.preventDefault(); const point = project.master.focalPoint; const x = point.x + (event.key === "ArrowRight" ? 0.02 : event.key === "ArrowLeft" ? -0.02 : 0); const y = point.y + (event.key === "ArrowDown" ? 0.02 : event.key === "ArrowUp" ? -0.02 : 0); change((draft) => { draft.master.focalPoint = { x: clamp(x, 0, 1, 0.5), y: clamp(y, 0, 1, 0.5) }; }, true); }
    };
    root.addEventListener("click", onClick); root.addEventListener("input", onInput); root.addEventListener("change", onChange); root.addEventListener("keydown", onKeydown);
    drop.addEventListener("dragover", onDragOver); drop.addEventListener("dragleave", onDragLeave); drop.addEventListener("drop", onDrop);
    loadImage(); render();
    const controller = { getProject: () => clone(project), setProject(next) { project = normalizeProject(next); history = [clone(project)]; historyIndex = 0; loadImage(); render(); persist(); }, exportPng, undo, redo, unmount() { root.removeEventListener("click", onClick); root.removeEventListener("input", onInput); root.removeEventListener("change", onChange); root.removeEventListener("keydown", onKeydown); drop.removeEventListener("dragover", onDragOver); drop.removeEventListener("dragleave", onDragLeave); drop.removeEventListener("drop", onDrop); root.replaceChildren(); root.classList.remove("gad"); instances.delete(root); } };
    instances.set(root, controller);
    return controller;
  }

  function unmount(root) {
    const controller = instances.get(root); if (!controller) return false; controller.unmount(); return true;
  }

  const api = Object.freeze({ VERSION, FORMAT, STORAGE_KEY, PRESETS, BRAND_FONTS, createDefaultProject, normalizeProject, calculateCoverCrop, safeZone, reflowLayout, createVariants, wrapText, renderArtboard, serializeProject, brandTokens, mount, unmount });
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  globalScope.HHGraphicAdaptive = api;
}(typeof globalThis !== "undefined" ? globalThis : this));
