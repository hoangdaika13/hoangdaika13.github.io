(function (globalScope) {
  "use strict";

  const VERSION = 1;
  const FORMAT = "hh-quick-motion-project";
  const STORAGE_KEY = "hh.graphic-quick-motion.project.v1";
  const STYLE_ID = "hh-graphic-quick-motion-styles-v1";
  const MAX_HISTORY = 50;
  const mounted = new WeakMap();

  const TEMPLATES = [
    { id: "logo", name: "Logo động", note: "Logo reveal, intro thương hiệu", icon: "LG", accent: "#ff63c7" },
    { id: "loader", name: "Loading", note: "Loader cho web và ứng dụng", icon: "LO", accent: "#65e7ff" },
    { id: "social", name: "Bài đăng", note: "Story, post và quảng cáo", icon: "SO", accent: "#c8f36d" }
  ];
  const SIZE_PRESETS = [
    { id: "square", label: "Bài đăng 1:1", width: 1080, height: 1080 },
    { id: "story", label: "Story 9:16", width: 1080, height: 1920 },
    { id: "landscape", label: "Video 16:9", width: 1920, height: 1080 },
    { id: "banner", label: "Banner 3:1", width: 1500, height: 500 },
    { id: "app", label: "Ứng dụng", width: 390, height: 844 }
  ];
  const ANIMATION_PRESETS = [
    { id: "fade-up", label: "Mờ và trượt", note: "Rõ ràng, hiện đại" },
    { id: "spring", label: "Bật nảy", note: "Năng động, thu hút" },
    { id: "spin", label: "Xoay reveal", note: "Hợp logo và loader" },
    { id: "pulse", label: "Nhịp sáng", note: "Lặp nhẹ liên tục" },
    { id: "wipe", label: "Quét màu", note: "Giới thiệu thương hiệu" },
    { id: "orbit", label: "Quỹ đạo", note: "Loader và biểu tượng" }
  ];
  const EASINGS = {
    linear: (t) => t,
    ease: (t) => 1 - Math.pow(1 - t, 3),
    "ease-in": (t) => t * t * t,
    "ease-in-out": (t) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2,
    spring: (t) => 1 - Math.cos(t * Math.PI * 4) * Math.exp(-t * 6)
  };

  function uid(prefix) {
    return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  }

  function clamp(value, min, max) {
    const number = Number(value);
    return Math.min(max, Math.max(min, Number.isFinite(number) ? number : min));
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function safeColor(value, fallback) {
    return /^#[0-9a-f]{6}$/i.test(String(value || "")) ? String(value) : fallback;
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function createDefaultProject(templateId) {
    const template = TEMPLATES.some((item) => item.id === templateId) ? templateId : "logo";
    const project = {
      format: FORMAT,
      version: VERSION,
      meta: { name: "Dự án chuyển động mới", updatedAt: new Date().toISOString() },
      template,
      canvas: {
        preset: template === "social" ? "square" : "landscape",
        width: template === "social" ? 1080 : 1920,
        height: 1080,
        background: template === "loader" ? "#09111f" : "#101426",
        palette: ["#ff63c7", "#65e7ff", "#c8f36d", "#ffffff"]
      },
      content: {
        logo: "HH",
        title: template === "social" ? "Ý tưởng tạo nên chuyển động" : template === "loader" ? "Đang chuẩn bị trải nghiệm" : "HH Creative",
        subtitle: template === "social" ? "Thiết kế nhanh, xuất đúng định dạng" : "Motion Maker",
        shape: template === "loader" ? "ring" : "rounded"
      },
      motion: { preset: template === "loader" ? "orbit" : "fade-up", duration: 2.4, easing: "ease", loop: true },
      timeline: [
        { id: uid("key"), time: 0, label: "Bắt đầu" },
        { id: uid("key"), time: 0.45, label: "Reveal" },
        { id: uid("key"), time: 1, label: "Hoàn tất" }
      ]
    };
    return normalizeProject(project);
  }

  function normalizeProject(raw) {
    const fallback = raw && typeof raw === "object" ? raw : {};
    const template = TEMPLATES.some((item) => item.id === fallback.template) ? fallback.template : "logo";
    const defaultSize = template === "social" ? SIZE_PRESETS[0] : SIZE_PRESETS[2];
    const palette = Array.isArray(fallback.canvas?.palette) ? fallback.canvas.palette.slice(0, 6) : [];
    const timeline = Array.isArray(fallback.timeline) ? fallback.timeline.slice(0, 24) : [];
    return {
      format: FORMAT,
      version: VERSION,
      meta: {
        name: String(fallback.meta?.name || "Dự án chuyển động mới").slice(0, 100),
        updatedAt: new Date().toISOString()
      },
      template,
      canvas: {
        preset: SIZE_PRESETS.some((item) => item.id === fallback.canvas?.preset) ? fallback.canvas.preset : "custom",
        width: Math.round(clamp(fallback.canvas?.width || defaultSize.width, 160, 4096)),
        height: Math.round(clamp(fallback.canvas?.height || defaultSize.height, 160, 4096)),
        background: safeColor(fallback.canvas?.background, "#101426"),
        palette: [0, 1, 2, 3].map((index) => safeColor(palette[index], ["#ff63c7", "#65e7ff", "#c8f36d", "#ffffff"][index]))
      },
      content: {
        logo: String(fallback.content?.logo || "HH").slice(0, 12),
        title: String(fallback.content?.title || "HH Creative").slice(0, 90),
        subtitle: String(fallback.content?.subtitle || "Motion Maker").slice(0, 140),
        shape: ["rounded", "circle", "diamond", "ring"].includes(fallback.content?.shape) ? fallback.content.shape : "rounded"
      },
      motion: {
        preset: ANIMATION_PRESETS.some((item) => item.id === fallback.motion?.preset) ? fallback.motion.preset : "fade-up",
        duration: clamp(fallback.motion?.duration || 2.4, 0.4, 20),
        easing: Object.prototype.hasOwnProperty.call(EASINGS, fallback.motion?.easing) ? fallback.motion.easing : "ease",
        loop: fallback.motion?.loop !== false
      },
      timeline: (timeline.length ? timeline : [
        { time: 0, label: "Bắt đầu" },
        { time: 0.5, label: "Reveal" },
        { time: 1, label: "Hoàn tất" }
      ]).map((key) => ({
        id: String(key.id || uid("key")),
        time: clamp(key.time, 0, 1),
        label: String(key.label || "Keyframe").slice(0, 32)
      })).sort((a, b) => a.time - b.time)
    };
  }

  function easeValue(name, progress) {
    const easing = EASINGS[name] || EASINGS.linear;
    return clamp(easing(clamp(progress, 0, 1)), 0, 1.15);
  }

  function motionTransform(project, progress) {
    const t = easeValue(project.motion.easing, progress);
    const preset = project.motion.preset;
    if (preset === "fade-up") return { x: 0, y: (1 - t) * 70, scale: 0.94 + t * 0.06, rotate: 0, opacity: t };
    if (preset === "spring") return { x: 0, y: 0, scale: 0.2 + easeValue("spring", progress) * 0.8, rotate: (1 - t) * -8, opacity: Math.min(1, t * 2) };
    if (preset === "spin") return { x: 0, y: 0, scale: 0.4 + t * 0.6, rotate: (1 - t) * -210, opacity: t };
    if (preset === "pulse") return { x: 0, y: 0, scale: 1 + Math.sin(progress * Math.PI * 2) * 0.08, rotate: 0, opacity: 1 };
    if (preset === "wipe") return { x: (1 - t) * -120, y: 0, scale: 1, rotate: 0, opacity: t };
    return { x: Math.cos(progress * Math.PI * 2) * 46, y: Math.sin(progress * Math.PI * 2) * 46, scale: 1, rotate: progress * 360, opacity: 1 };
  }

  function renderSvg(project, progress) {
    const p = normalizeProject(project);
    const motion = motionTransform(p, progress);
    const [pink, cyan, lime, white] = p.canvas.palette;
    const width = p.canvas.width;
    const height = p.canvas.height;
    const cx = width / 2;
    const cy = height / 2;
    const compact = Math.min(width, height);
    const titleSize = Math.max(28, compact * 0.075);
    const logoSize = Math.max(44, compact * 0.14);
    const radius = Math.max(24, compact * 0.06);
    const transform = `translate(${motion.x.toFixed(2)} ${motion.y.toFixed(2)}) translate(${cx} ${cy}) rotate(${motion.rotate.toFixed(2)}) scale(${motion.scale.toFixed(3)}) translate(${-cx} ${-cy})`;
    const common = `transform="${transform}" opacity="${motion.opacity.toFixed(3)}"`;
    const defs = `<defs><linearGradient id="hhqm-gradient" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${pink}"/><stop offset=".52" stop-color="${cyan}"/><stop offset="1" stop-color="${lime}"/></linearGradient><filter id="hhqm-glow"><feGaussianBlur stdDeviation="${Math.max(4, compact * 0.012)}" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>`;
    let content = "";
    if (p.template === "loader") {
      content = `<g ${common}><circle cx="${cx}" cy="${cy}" r="${radius}" fill="none" stroke="rgba(255,255,255,.14)" stroke-width="${Math.max(8, radius * 0.18)}"/><path d="M ${cx} ${cy - radius} A ${radius} ${radius} 0 0 1 ${cx + radius} ${cy}" fill="none" stroke="url(#hhqm-gradient)" stroke-linecap="round" stroke-width="${Math.max(8, radius * 0.18)}" filter="url(#hhqm-glow)"/><circle cx="${cx + radius * .72}" cy="${cy - radius * .72}" r="${Math.max(5, radius * .12)}" fill="${white}"/></g><text x="${cx}" y="${cy + radius + titleSize}" text-anchor="middle" fill="${white}" font-family="system-ui,sans-serif" font-size="${titleSize * .42}" font-weight="700">${escapeHtml(p.content.title)}</text>`;
    } else if (p.template === "social") {
      content = `<g ${common}><rect x="${width * .07}" y="${height * .07}" width="${width * .86}" height="${height * .86}" rx="${compact * .045}" fill="rgba(255,255,255,.055)" stroke="rgba(255,255,255,.14)"/><circle cx="${width * .18}" cy="${height * .18}" r="${compact * .07}" fill="url(#hhqm-gradient)"/><text x="${width * .18}" y="${height * .195}" text-anchor="middle" fill="#071018" font-family="system-ui,sans-serif" font-size="${logoSize * .46}" font-weight="900">${escapeHtml(p.content.logo)}</text><text x="${width * .12}" y="${height * .47}" fill="${white}" font-family="system-ui,sans-serif" font-size="${titleSize}" font-weight="850">${escapeHtml(p.content.title)}</text><text x="${width * .12}" y="${height * .55}" fill="${cyan}" font-family="system-ui,sans-serif" font-size="${titleSize * .38}" font-weight="650">${escapeHtml(p.content.subtitle)}</text><rect x="${width * .12}" y="${height * .65}" width="${width * .31}" height="${height * .075}" rx="${height * .038}" fill="url(#hhqm-gradient)"/></g>`;
    } else {
      const x = cx - compact * .13;
      const y = cy - compact * .19;
      const size = compact * .26;
      const shape = p.content.shape === "circle"
        ? `<circle cx="${cx}" cy="${cy - compact * .06}" r="${size / 2}" fill="url(#hhqm-gradient)"/>`
        : p.content.shape === "diamond"
          ? `<rect x="${x}" y="${y}" width="${size}" height="${size}" rx="${size * .08}" fill="url(#hhqm-gradient)" transform="rotate(45 ${cx} ${cy - compact * .06})"/>`
          : `<rect x="${x}" y="${y}" width="${size}" height="${size}" rx="${p.content.shape === "ring" ? size / 2 : size * .22}" fill="${p.content.shape === "ring" ? "none" : "url(#hhqm-gradient)"}" stroke="url(#hhqm-gradient)" stroke-width="${p.content.shape === "ring" ? size * .1 : 0}"/>`;
      content = `<g ${common} filter="url(#hhqm-glow)">${shape}<text x="${cx}" y="${cy - compact * .025}" text-anchor="middle" fill="#071018" font-family="system-ui,sans-serif" font-size="${logoSize}" font-weight="950">${escapeHtml(p.content.logo)}</text><text x="${cx}" y="${cy + compact * .23}" text-anchor="middle" fill="${white}" font-family="system-ui,sans-serif" font-size="${titleSize}" font-weight="850">${escapeHtml(p.content.title)}</text><text x="${cx}" y="${cy + compact * .3}" text-anchor="middle" fill="${cyan}" font-family="system-ui,sans-serif" font-size="${titleSize * .36}" font-weight="700">${escapeHtml(p.content.subtitle)}</text></g>`;
    }
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="Xem trước hoạt ảnh ${escapeHtml(p.meta.name)}">${defs}<rect width="100%" height="100%" fill="${p.canvas.background}"/><circle cx="${width * .16}" cy="${height * .14}" r="${compact * .19}" fill="${pink}" opacity=".08"/><circle cx="${width * .86}" cy="${height * .82}" r="${compact * .24}" fill="${cyan}" opacity=".07"/>${content}</svg>`;
  }

  function exportProject(project) {
    return JSON.stringify({ ...normalizeProject(project), format: FORMAT }, null, 2);
  }

  function exportAnimatedSvg(project) {
    const p = normalizeProject(project);
    const duration = p.motion.duration;
    const repeat = p.motion.loop ? "indefinite" : "1";
    const svg = renderSvg(p, 1).replace("</svg>", `<style>:root{color-scheme:dark}svg{overflow:visible}svg>g{transform-box:fill-box;transform-origin:center;animation:hhqm-motion ${duration}s ${p.motion.easing === "spring" ? "cubic-bezier(.18,.89,.32,1.28)" : p.motion.easing} ${repeat === "indefinite" ? "infinite" : "1"} both}@keyframes hhqm-motion{0%{opacity:0;transform:translateY(8%) scale(.88)}55%{opacity:1}100%{opacity:1;transform:translateY(0) scale(1)}}</style></svg>`);
    return svg;
  }

  function exportCss(project) {
    const p = normalizeProject(project);
    return `.hh-motion-element {\n  animation: hh-${p.motion.preset} ${p.motion.duration}s ${p.motion.easing} ${p.motion.loop ? "infinite" : "1"} both;\n  transform-origin: center;\n}\n\n@keyframes hh-${p.motion.preset} {\n  0% { opacity: 0; transform: translateY(32px) scale(.92); }\n  60% { opacity: 1; }\n  100% { opacity: 1; transform: translateY(0) scale(1); }\n}\n\n@media (prefers-reduced-motion: reduce) {\n  .hh-motion-element { animation: none; }\n}`;
  }

  function downloadText(filename, text, mime) {
    if (typeof document === "undefined") return false;
    const url = URL.createObjectURL(new Blob([text], { type: mime || "text/plain" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return true;
  }

  function ensureStyles() {
    if (typeof document === "undefined" || document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      .hhqm{--qm-pink:#ff63c7;--qm-cyan:#65e7ff;--qm-lime:#c8f36d;--qm-bg:#080d15;--qm-panel:#0e1621;--qm-line:#243645;--qm-text:#eef7fb;--qm-muted:#8da1b2;color:var(--qm-text);font:500 13px/1.45 system-ui,sans-serif;background:linear-gradient(145deg,#0b111b,#080c14);border:1px solid var(--qm-line);border-radius:12px;overflow:hidden;min-width:0}.hhqm *{box-sizing:border-box}.hhqm button,.hhqm input,.hhqm select{font:inherit}.hhqm button{cursor:pointer}.hhqm :focus-visible{outline:2px solid var(--qm-cyan);outline-offset:2px}.hhqm-topbar{min-height:56px;display:flex;align-items:center;gap:10px;padding:9px 12px;border-bottom:1px solid var(--qm-line);background:rgba(7,13,21,.92)}.hhqm-brand{display:flex;align-items:center;gap:9px;margin-right:auto}.hhqm-mark{display:grid;place-items:center;width:36px;height:36px;border-radius:9px;background:linear-gradient(135deg,var(--qm-pink),var(--qm-cyan));color:#061018;font-weight:950}.hhqm-brand strong{display:block;font-size:14px}.hhqm-brand span,.hhqm-muted{color:var(--qm-muted);font-size:11px}.hhqm-btn{min-height:34px;padding:7px 10px;border:1px solid var(--qm-line);border-radius:7px;background:#111c28;color:var(--qm-text)}.hhqm-btn:hover{border-color:var(--qm-cyan);background:#142534}.hhqm-btn-primary{border-color:transparent;background:linear-gradient(110deg,var(--qm-pink),#a780ff 48%,var(--qm-cyan));color:#071018;font-weight:850}.hhqm-main{display:grid;grid-template-columns:220px minmax(320px,1fr) 268px;min-height:590px}.hhqm-library,.hhqm-inspector{background:rgba(8,14,22,.94);padding:12px;min-width:0}.hhqm-library{border-right:1px solid var(--qm-line)}.hhqm-inspector{border-left:1px solid var(--qm-line);overflow:auto}.hhqm-eyebrow{display:block;margin:8px 0;color:var(--qm-cyan);font-size:10px;font-weight:900;text-transform:uppercase}.hhqm-template{display:grid;grid-template-columns:38px 1fr;gap:9px;width:100%;margin-bottom:7px;padding:10px;border:1px solid var(--qm-line);border-radius:8px;background:#0d1620;color:var(--qm-text);text-align:left}.hhqm-template[aria-pressed=true]{border-color:var(--qm-pink);background:linear-gradient(110deg,rgba(255,99,199,.13),rgba(101,231,255,.08));box-shadow:inset 3px 0 var(--qm-pink)}.hhqm-template-icon{display:grid;place-items:center;width:34px;height:34px;border:1px solid color-mix(in srgb,var(--qm-accent) 65%,transparent);border-radius:8px;color:var(--qm-accent);font-weight:900}.hhqm-template small{display:block;color:var(--qm-muted);font-size:10px;margin-top:2px}.hhqm-preset{width:100%;padding:8px 9px;margin-bottom:6px;border:1px solid transparent;border-radius:7px;background:transparent;color:#bac8d3;text-align:left}.hhqm-preset:hover,.hhqm-preset[aria-pressed=true]{background:#13212d;border-color:var(--qm-line);color:#fff}.hhqm-preset[aria-pressed=true]::before{content:'•';color:var(--qm-lime);margin-right:7px}.hhqm-workspace{display:grid;grid-template-rows:auto minmax(360px,1fr) auto;min-width:0;background:radial-gradient(circle at 50% 30%,rgba(101,231,255,.06),transparent 40%),#070c13}.hhqm-canvasbar{display:flex;align-items:center;gap:8px;padding:8px 12px;border-bottom:1px solid var(--qm-line)}.hhqm-canvasbar strong{margin-right:auto}.hhqm-stage-wrap{display:grid;place-items:center;min-height:360px;padding:24px;overflow:hidden;background-image:linear-gradient(45deg,#0e1620 25%,transparent 25%),linear-gradient(-45deg,#0e1620 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#0e1620 75%),linear-gradient(-45deg,transparent 75%,#0e1620 75%);background-size:24px 24px;background-position:0 0,0 12px,12px -12px,-12px 0}.hhqm-stage{position:relative;width:min(100%,780px);aspect-ratio:var(--qm-ratio,16/9);max-height:510px;border:1px solid rgba(101,231,255,.28);border-radius:8px;background:#101426;box-shadow:0 24px 70px #000a;overflow:hidden}.hhqm-stage svg{display:block;width:100%;height:100%}.hhqm-stage-badge{position:absolute;top:9px;left:9px;padding:4px 7px;border-radius:5px;background:#071018c9;color:var(--qm-cyan);font-size:9px;font-weight:900}.hhqm-timeline{border-top:1px solid var(--qm-line);background:#0a111a;padding:10px 13px}.hhqm-transport{display:flex;align-items:center;gap:7px;margin-bottom:10px}.hhqm-time{font-variant-numeric:tabular-nums;color:var(--qm-cyan);margin-left:auto}.hhqm-track{position:relative;height:38px;margin-left:72px;border-radius:6px;background:repeating-linear-gradient(90deg,#162431 0 1px,transparent 1px 10%);border:1px solid var(--qm-line)}.hhqm-track::before{content:'Motion';position:absolute;right:calc(100% + 10px);top:10px;color:var(--qm-muted);font-size:10px}.hhqm-playhead{position:absolute;top:-4px;bottom:-4px;width:2px;background:var(--qm-pink);left:calc(var(--qm-progress,0)*100%);pointer-events:none}.hhqm-key{position:absolute;top:11px;width:14px;height:14px;padding:0;border:2px solid #071018;background:var(--qm-cyan);transform:translateX(-50%) rotate(45deg);border-radius:3px}.hhqm-key:hover{background:var(--qm-lime)}.hhqm-key span{position:absolute;left:17px;top:-8px;transform:rotate(-45deg);color:var(--qm-muted);font-size:9px;white-space:nowrap}.hhqm-group{padding:10px 0;border-bottom:1px solid var(--qm-line)}.hhqm-group h4{margin:0 0 9px;font-size:12px}.hhqm-field{display:grid;gap:5px;margin-bottom:8px}.hhqm-field span{color:#a7b7c4;font-size:10px;font-weight:750}.hhqm-field input,.hhqm-field select{width:100%;min-height:34px;padding:7px 8px;border:1px solid var(--qm-line);border-radius:6px;background:#09111a;color:var(--qm-text)}.hhqm-inline{display:grid;grid-template-columns:1fr 1fr;gap:7px}.hhqm-colors{display:flex;gap:6px}.hhqm-color{width:37px!important;height:33px!important;padding:2px!important}.hhqm-switch{display:flex;align-items:center;gap:8px;color:#b6c4cf}.hhqm-switch input{accent-color:var(--qm-pink)}.hhqm-help{padding:9px;border:1px solid rgba(200,243,109,.23);border-radius:7px;background:rgba(200,243,109,.05);color:#b9c8d1;font-size:10px}.hhqm-status{min-height:24px;padding:5px 12px;border-top:1px solid var(--qm-line);color:var(--qm-muted);background:#081019}.hhqm-import{display:none}.hhqm-empty-note{margin-top:10px;color:var(--qm-muted);font-size:10px}.hhqm-visually-hidden{position:absolute!important;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}@media(max-width:1050px){.hhqm-main{grid-template-columns:190px minmax(300px,1fr)}.hhqm-inspector{grid-column:1/-1;border-left:0;border-top:1px solid var(--qm-line);display:grid;grid-template-columns:repeat(3,1fr);gap:12px}.hhqm-group{border:1px solid var(--qm-line);border-radius:8px;padding:10px}}@media(max-width:720px){.hhqm-topbar{flex-wrap:wrap}.hhqm-brand{width:100%}.hhqm-main{display:block}.hhqm-library{border-right:0;border-bottom:1px solid var(--qm-line)}.hhqm-library nav{display:grid;grid-template-columns:repeat(3,1fr);gap:6px}.hhqm-template{margin:0}.hhqm-template small{display:none}.hhqm-presets{display:flex;gap:5px;overflow:auto}.hhqm-preset{width:auto;white-space:nowrap}.hhqm-stage-wrap{min-height:280px;padding:12px}.hhqm-inspector{display:block}.hhqm-track{margin-left:60px}.hhqm-key span{display:none}}@media(max-width:440px){.hhqm-library nav{grid-template-columns:1fr}.hhqm-inline{grid-template-columns:1fr}.hhqm-topbar .hhqm-btn{flex:1}.hhqm-stage-wrap{min-height:230px}.hhqm-canvasbar .hhqm-muted{display:none}}@media(prefers-reduced-motion:reduce){.hhqm *{scroll-behavior:auto!important;transition:none!important;animation:none!important}}
    `;
    document.head.appendChild(style);
  }

  function mount(root) {
    if (!root || typeof root.querySelector !== "function") return null;
    if (mounted.has(root)) return mounted.get(root).api;
    ensureStyles();

    const storage = (() => {
      try { return globalScope.localStorage || null; } catch (_) { return null; }
    })();
    let project = createDefaultProject("logo");
    try {
      const saved = storage?.getItem(STORAGE_KEY);
      if (saved) project = normalizeProject(JSON.parse(saved));
    } catch (_) { /* Keep a safe default project. */ }
    let history = [];
    let future = [];
    let progress = 0;
    let playing = false;
    let raf = 0;
    let lastFrame = 0;
    let statusTimer = 0;
    const listeners = [];
    const reducedMotion = typeof globalScope.matchMedia === "function" && globalScope.matchMedia("(prefers-reduced-motion: reduce)").matches;

    root.classList.add("hhqm");
    root.setAttribute("data-graphic-quick-motion", "");
    root.innerHTML = `<header class="hhqm-topbar"><div class="hhqm-brand"><span class="hhqm-mark">QM</span><div><strong>Quick Motion Maker</strong><span>Logo · Loading · Social post</span></div></div><button class="hhqm-btn" type="button" data-qm-undo aria-label="Hoàn tác">↶ Hoàn tác</button><button class="hhqm-btn" type="button" data-qm-redo aria-label="Làm lại">↷ Làm lại</button><button class="hhqm-btn" type="button" data-qm-import>Nhập dự án</button><button class="hhqm-btn hhqm-btn-primary" type="button" data-qm-export-menu>Xuất thiết kế</button><input class="hhqm-import" type="file" accept="application/json,.json" data-qm-file aria-label="Chọn tệp dự án JSON"></header><div class="hhqm-main"><aside class="hhqm-library" aria-label="Thư viện mẫu"><span class="hhqm-eyebrow">Bắt đầu nhanh</span><nav data-qm-templates></nav><span class="hhqm-eyebrow">Hiệu ứng</span><div class="hhqm-presets" data-qm-presets></div><p class="hhqm-empty-note">Mẫu giúp đặt sẵn bố cục. Bạn vẫn có thể đổi toàn bộ nội dung, màu sắc và chuyển động.</p></aside><main class="hhqm-workspace"><div class="hhqm-canvasbar"><strong>Canvas</strong><span class="hhqm-muted" data-qm-size-label></span><button class="hhqm-btn" type="button" data-qm-restart>Phát lại</button></div><div class="hhqm-stage-wrap"><div class="hhqm-stage" data-qm-stage tabindex="0" aria-label="Canvas xem trước hoạt ảnh"><span class="hhqm-stage-badge">SVG PREVIEW</span><div data-qm-svg></div></div></div><section class="hhqm-timeline" aria-label="Timeline và keyframe"><div class="hhqm-transport"><button class="hhqm-btn" type="button" data-qm-stop aria-label="Dừng">■</button><button class="hhqm-btn hhqm-btn-primary" type="button" data-qm-play aria-label="Phát hoặc tạm dừng">▶ Phát</button><button class="hhqm-btn" type="button" data-qm-add-key>+ Keyframe</button><span class="hhqm-time" data-qm-time>00:00.00</span></div><div class="hhqm-track" data-qm-track><i class="hhqm-playhead"></i><div data-qm-keys></div></div></section></main><aside class="hhqm-inspector" aria-label="Thuộc tính thiết kế"><section class="hhqm-group"><h4>Nội dung</h4><label class="hhqm-field"><span>Logo / ký hiệu</span><input data-qm-content="logo" maxlength="12"></label><label class="hhqm-field"><span>Tiêu đề</span><input data-qm-content="title" maxlength="90"></label><label class="hhqm-field"><span>Dòng phụ</span><input data-qm-content="subtitle" maxlength="140"></label><label class="hhqm-field"><span>Hình khối</span><select data-qm-content="shape"><option value="rounded">Bo góc</option><option value="circle">Tròn</option><option value="diamond">Kim cương</option><option value="ring">Vòng tròn rỗng</option></select></label></section><section class="hhqm-group"><h4>Khung thiết kế</h4><label class="hhqm-field"><span>Kích thước mẫu</span><select data-qm-size-preset></select></label><div class="hhqm-inline"><label class="hhqm-field"><span>Rộng</span><input type="number" min="160" max="4096" data-qm-dimension="width"></label><label class="hhqm-field"><span>Cao</span><input type="number" min="160" max="4096" data-qm-dimension="height"></label></div><label class="hhqm-field"><span>Màu nền</span><input class="hhqm-color" type="color" data-qm-background></label><div class="hhqm-colors" data-qm-colors></div></section><section class="hhqm-group"><h4>Chuyển động</h4><label class="hhqm-field"><span>Thời lượng <b data-qm-duration-label></b></span><input type="range" min="0.4" max="20" step="0.1" data-qm-duration></label><label class="hhqm-field"><span>Easing</span><select data-qm-easing><option value="linear">Linear</option><option value="ease">Ease out</option><option value="ease-in">Ease in</option><option value="ease-in-out">Ease in-out</option><option value="spring">Spring</option></select></label><label class="hhqm-switch"><input type="checkbox" data-qm-loop> Lặp chuyển động</label><p class="hhqm-help">Xuất SVG động và CSS là đầu ra chạy thật. GIF/MP4 cần encoder chuyên dụng nên không được giả lập trong trình duyệt.</p></section><section class="hhqm-group"><h4>Xuất tệp</h4><div class="hhqm-inline"><button class="hhqm-btn" type="button" data-qm-export="json">Project JSON</button><button class="hhqm-btn" type="button" data-qm-export="svg">Animated SVG</button><button class="hhqm-btn" type="button" data-qm-export="css">CSS</button></div></section></aside></div><footer class="hhqm-status" role="status" aria-live="polite" data-qm-status>Sẵn sàng. Dự án tự lưu trên thiết bị.</footer>`;

    function on(node, event, handler) {
      node?.addEventListener(event, handler);
      if (node) listeners.push(() => node.removeEventListener(event, handler));
    }

    function announce(message) {
      const status = root.querySelector("[data-qm-status]");
      if (status) status.textContent = message;
      clearTimeout(statusTimer);
      statusTimer = setTimeout(() => { if (status) status.textContent = "Đã tự lưu trên thiết bị."; }, 2600);
    }

    function persist() {
      project.meta.updatedAt = new Date().toISOString();
      try { storage?.setItem(STORAGE_KEY, JSON.stringify(project)); } catch (_) { announce("Không thể lưu local trên trình duyệt này."); }
    }

    function snapshot() {
      history.push(clone(project));
      if (history.length > MAX_HISTORY) history.shift();
      future = [];
    }

    function change(mutator, message) {
      snapshot();
      mutator(project);
      project = normalizeProject(project);
      persist();
      render();
      if (message) announce(message);
    }

    function liveChange(mutator) {
      snapshot();
      mutator(project);
      project = normalizeProject(project);
      persist();
      const durationLabel = root.querySelector("[data-qm-duration-label]");
      const sizeLabel = root.querySelector("[data-qm-size-label]");
      const stage = root.querySelector("[data-qm-stage]");
      if (durationLabel) durationLabel.textContent = `${project.motion.duration.toFixed(1)} giây`;
      if (sizeLabel) sizeLabel.textContent = `${project.canvas.width} × ${project.canvas.height}`;
      if (stage) stage.style.setProperty("--qm-ratio", `${project.canvas.width}/${project.canvas.height}`);
      renderPreview();
    }

    function renderTemplates() {
      root.querySelector("[data-qm-templates]").innerHTML = TEMPLATES.map((item) => `<button class="hhqm-template" type="button" data-qm-template="${item.id}" aria-pressed="${item.id === project.template}" style="--qm-accent:${item.accent}"><span class="hhqm-template-icon">${item.icon}</span><span><strong>${item.name}</strong><small>${item.note}</small></span></button>`).join("");
      root.querySelector("[data-qm-presets]").innerHTML = ANIMATION_PRESETS.map((item) => `<button class="hhqm-preset" type="button" data-qm-preset="${item.id}" aria-pressed="${item.id === project.motion.preset}" title="${item.note}">${item.label}</button>`).join("");
    }

    function renderControls() {
      root.querySelectorAll("[data-qm-content]").forEach((input) => { input.value = project.content[input.dataset.qmContent]; });
      root.querySelector("[data-qm-size-preset]").innerHTML = `<option value="custom">Tùy chỉnh</option>${SIZE_PRESETS.map((item) => `<option value="${item.id}">${item.label} · ${item.width}×${item.height}</option>`).join("")}`;
      root.querySelector("[data-qm-size-preset]").value = project.canvas.preset;
      root.querySelectorAll("[data-qm-dimension]").forEach((input) => { input.value = project.canvas[input.dataset.qmDimension]; });
      root.querySelector("[data-qm-background]").value = project.canvas.background;
      root.querySelector("[data-qm-colors]").innerHTML = project.canvas.palette.map((color, index) => `<input class="hhqm-color" type="color" value="${color}" data-qm-color="${index}" aria-label="Màu bảng phối ${index + 1}">`).join("");
      root.querySelector("[data-qm-duration]").value = project.motion.duration;
      root.querySelector("[data-qm-duration-label]").textContent = `${project.motion.duration.toFixed(1)} giây`;
      root.querySelector("[data-qm-easing]").value = project.motion.easing;
      root.querySelector("[data-qm-loop]").checked = project.motion.loop;
      root.querySelector("[data-qm-size-label]").textContent = `${project.canvas.width} × ${project.canvas.height}`;
      root.querySelector("[data-qm-stage]").style.setProperty("--qm-ratio", `${project.canvas.width}/${project.canvas.height}`);
    }

    function renderTimeline() {
      root.querySelector("[data-qm-track]").style.setProperty("--qm-progress", progress);
      root.querySelector("[data-qm-time]").textContent = `00:${(progress * project.motion.duration).toFixed(2).padStart(5, "0")}`;
      root.querySelector("[data-qm-keys]").innerHTML = project.timeline.map((key) => `<button class="hhqm-key" type="button" style="left:${key.time * 100}%" data-qm-key="${escapeHtml(key.id)}" title="${escapeHtml(key.label)} · ${(key.time * project.motion.duration).toFixed(2)} giây"><span>${escapeHtml(key.label)}</span></button>`).join("");
      const play = root.querySelector("[data-qm-play]");
      play.textContent = playing ? "Ⅱ Tạm dừng" : "▶ Phát";
      play.setAttribute("aria-pressed", String(playing));
    }

    function renderPreview() {
      root.querySelector("[data-qm-svg]").innerHTML = renderSvg(project, reducedMotion ? 1 : progress);
      renderTimeline();
    }

    function render() {
      renderTemplates();
      renderControls();
      renderPreview();
      root.querySelector("[data-qm-undo]").disabled = history.length === 0;
      root.querySelector("[data-qm-redo]").disabled = future.length === 0;
    }

    function frame(now) {
      if (!playing) return;
      if (!lastFrame) lastFrame = now;
      const elapsed = (now - lastFrame) / 1000;
      lastFrame = now;
      progress += elapsed / project.motion.duration;
      if (progress >= 1) {
        if (project.motion.loop) progress %= 1;
        else { progress = 1; playing = false; }
      }
      renderPreview();
      if (playing) raf = globalScope.requestAnimationFrame(frame);
    }

    function playPause() {
      if (reducedMotion) { progress = 1; renderPreview(); announce("Hệ thống đang ưu tiên giảm chuyển động."); return; }
      playing = !playing;
      lastFrame = 0;
      if (playing) raf = globalScope.requestAnimationFrame(frame);
      else globalScope.cancelAnimationFrame(raf);
      renderTimeline();
    }

    function stop() {
      playing = false;
      progress = 0;
      lastFrame = 0;
      globalScope.cancelAnimationFrame(raf);
      renderPreview();
    }

    function undo() {
      if (!history.length) return;
      future.push(clone(project));
      project = history.pop();
      persist(); render(); announce("Đã hoàn tác.");
    }

    function redo() {
      if (!future.length) return;
      history.push(clone(project));
      project = future.pop();
      persist(); render(); announce("Đã làm lại.");
    }

    on(root, "click", (event) => {
      const button = event.target.closest("button");
      if (!button || !root.contains(button)) return;
      if (button.dataset.qmTemplate) change((draft) => { const next = createDefaultProject(button.dataset.qmTemplate); Object.assign(draft, next); }, `Đã chọn mẫu ${button.textContent.trim()}.`);
      if (button.dataset.qmPreset) change((draft) => { draft.motion.preset = button.dataset.qmPreset; }, "Đã áp dụng hiệu ứng.");
      if (button.hasAttribute("data-qm-play") || button.hasAttribute("data-qm-restart")) { if (button.hasAttribute("data-qm-restart")) { stop(); playing = true; lastFrame = 0; raf = globalScope.requestAnimationFrame(frame); } else playPause(); }
      if (button.hasAttribute("data-qm-stop")) stop();
      if (button.hasAttribute("data-qm-undo")) undo();
      if (button.hasAttribute("data-qm-redo")) redo();
      if (button.hasAttribute("data-qm-import")) root.querySelector("[data-qm-file]").click();
      if (button.hasAttribute("data-qm-add-key")) change((draft) => { draft.timeline.push({ id: uid("key"), time: progress, label: `Mốc ${draft.timeline.length + 1}` }); }, "Đã thêm keyframe tại playhead.");
      if (button.dataset.qmKey) { const key = project.timeline.find((item) => item.id === button.dataset.qmKey); if (key) { progress = key.time; renderPreview(); announce(`${key.label}: ${(key.time * project.motion.duration).toFixed(2)} giây.`); } }
      if (button.dataset.qmExport === "json") { downloadText("hh-motion-project.json", exportProject(project), "application/json"); announce("Đã xuất project JSON."); }
      if (button.dataset.qmExport === "svg") { downloadText("hh-motion-animated.svg", exportAnimatedSvg(project), "image/svg+xml"); announce("Đã xuất SVG động."); }
      if (button.dataset.qmExport === "css") { downloadText("hh-motion-animation.css", exportCss(project), "text/css"); announce("Đã xuất CSS animation."); }
      if (button.hasAttribute("data-qm-export-menu")) root.querySelector("[data-qm-export=svg]").focus();
    });

    on(root, "input", (event) => {
      const target = event.target;
      if (target.dataset.qmContent) liveChange((draft) => { draft.content[target.dataset.qmContent] = target.value; });
      if (target.dataset.qmDimension) liveChange((draft) => { draft.canvas[target.dataset.qmDimension] = Number(target.value); draft.canvas.preset = "custom"; });
      if (target.hasAttribute("data-qm-background")) liveChange((draft) => { draft.canvas.background = target.value; });
      if (target.dataset.qmColor != null) liveChange((draft) => { draft.canvas.palette[Number(target.dataset.qmColor)] = target.value; });
      if (target.hasAttribute("data-qm-duration")) liveChange((draft) => { draft.motion.duration = Number(target.value); });
    });

    on(root, "change", (event) => {
      const target = event.target;
      if (target.hasAttribute("data-qm-size-preset") && target.value !== "custom") {
        const preset = SIZE_PRESETS.find((item) => item.id === target.value);
        if (preset) change((draft) => { draft.canvas.preset = preset.id; draft.canvas.width = preset.width; draft.canvas.height = preset.height; }, `Đã đặt khung ${preset.label}.`);
      }
      if (target.hasAttribute("data-qm-easing")) change((draft) => { draft.motion.easing = target.value; });
      if (target.hasAttribute("data-qm-loop")) change((draft) => { draft.motion.loop = target.checked; });
    });

    on(root.querySelector("[data-qm-track]"), "pointerdown", (event) => {
      if (event.target.closest("[data-qm-key]")) return;
      const box = event.currentTarget.getBoundingClientRect();
      progress = clamp((event.clientX - box.left) / box.width, 0, 1);
      renderPreview();
    });

    on(root.querySelector("[data-qm-file]"), "change", (event) => {
      const file = event.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const imported = JSON.parse(String(reader.result || ""));
          if (imported.format && imported.format !== FORMAT) throw new Error("Sai định dạng");
          snapshot(); project = normalizeProject(imported); persist(); render(); announce("Đã nhập dự án thành công.");
        } catch (_) { announce("Tệp không phải dự án Quick Motion hợp lệ."); }
      };
      reader.readAsText(file);
      event.target.value = "";
    });

    on(root, "keydown", (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") { event.preventDefault(); event.shiftKey ? redo() : undo(); }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "y") { event.preventDefault(); redo(); }
      if (event.code === "Space" && !/INPUT|SELECT|TEXTAREA/.test(event.target.tagName)) { event.preventDefault(); playPause(); }
    });

    render();
    if (!reducedMotion) { playing = true; raf = globalScope.requestAnimationFrame(frame); }

    const api = {
      getProject: () => clone(project),
      setProject: (next) => { snapshot(); project = normalizeProject(next); persist(); render(); },
      play: () => { if (!playing) playPause(); },
      pause: () => { if (playing) playPause(); },
      exportProject: () => exportProject(project)
    };
    mounted.set(root, { api, listeners, cleanup: () => { playing = false; globalScope.cancelAnimationFrame(raf); clearTimeout(statusTimer); listeners.splice(0).forEach((off) => off()); } });
    return api;
  }

  function unmount(root) {
    const state = mounted.get(root);
    if (!state) return false;
    state.cleanup();
    mounted.delete(root);
    root.classList.remove("hhqm");
    root.removeAttribute("data-graphic-quick-motion");
    root.innerHTML = "";
    return true;
  }

  const api = {
    VERSION,
    FORMAT,
    STORAGE_KEY,
    TEMPLATES,
    SIZE_PRESETS,
    ANIMATION_PRESETS,
    createDefaultProject,
    normalizeProject,
    easeValue,
    motionTransform,
    renderSvg,
    exportProject,
    exportAnimatedSvg,
    exportCss,
    mount,
    unmount
  };

  globalScope.HHGraphicQuickMotion = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
