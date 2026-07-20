(function (global, factory) {
  "use strict";
  const api = factory(global);
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (global) global.HHGraphicMockup = api;
})(typeof globalThis !== "undefined" ? globalThis : (typeof window !== "undefined" ? window : {}), function (runtime) {
  "use strict";

  const VERSION = 1;
  const STORAGE_KEY = "hh.graphic-mockup.project.v1";
  const STYLE_ID = "hh-graphic-mockup-styles-v1";
  const MAX_HISTORY = 40;
  const MAX_KEYFRAMES = 120;
  const DEVICE_PRESETS = {
    "phone-modern": { label: "Điện thoại hiện đại", category: "Điện thoại", width: 390, height: 844, radius: 48, bezel: 18, camera: "island" },
    "phone-classic": { label: "Điện thoại cổ điển", category: "Điện thoại", width: 375, height: 667, radius: 34, bezel: 26, camera: "speaker" },
    tablet: { label: "Máy tính bảng", category: "Máy tính bảng", width: 820, height: 1180, radius: 42, bezel: 26, camera: "dot" },
    laptop: { label: "Laptop sáng tạo", category: "Máy tính", width: 1440, height: 900, radius: 24, bezel: 34, camera: "dot", base: true },
    browser: { label: "Cửa sổ trình duyệt", category: "Website", width: 1440, height: 900, radius: 24, bezel: 52, camera: "browser" }
  };
  const SCENE_PRESETS = {
    aurora: { label: "Aurora", background: "gradient", color: "#17102d", secondary: "#16d9d2", accent: "#ff5ebc", shadow: 0.62, reflection: 0.2 },
    studio: { label: "Studio sáng", background: "gradient", color: "#eef6ff", secondary: "#c6d7ff", accent: "#7657ff", shadow: 0.34, reflection: 0.12 },
    midnight: { label: "Midnight", background: "solid", color: "#05070d", secondary: "#111827", accent: "#61e7ff", shadow: 0.78, reflection: 0.24 },
    sunset: { label: "Hoàng hôn", background: "gradient", color: "#30133f", secondary: "#ff8c5a", accent: "#ffd45c", shadow: 0.5, reflection: 0.18 },
    transparent: { label: "Trong suốt", background: "transparent", color: "#000000", secondary: "#000000", accent: "#62e5dd", shadow: 0.35, reflection: 0 }
  };
  const EASINGS = ["linear", "ease-in", "ease-out", "ease-in-out"];
  const mounted = new Map();

  function uid(prefix) {
    return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  }

  function clamp(value, min, max, fallback) {
    const numeric = Number(value);
    return Math.min(max, Math.max(min, Number.isFinite(numeric) ? numeric : fallback));
  }

  function esc(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function createKeyframe(time, transform, easing) {
    return {
      id: uid("orbit"),
      time: clamp(time, 0, 60, 0),
      easing: EASINGS.includes(easing) ? easing : "ease-in-out",
      transform: normalizeTransform(transform)
    };
  }

  function normalizeTransform(raw) {
    const value = raw && typeof raw === "object" ? raw : {};
    return {
      rotateX: clamp(value.rotateX, -75, 75, -8),
      rotateY: clamp(value.rotateY, -180, 180, -24),
      rotateZ: clamp(value.rotateZ, -180, 180, 0),
      scale: clamp(value.scale, 0.35, 2.2, 1),
      cameraDistance: clamp(value.cameraDistance, 400, 2400, 1100)
    };
  }

  function createDefaultProject() {
    const initial = normalizeTransform({ rotateX: -8, rotateY: -24, rotateZ: -2, scale: 1, cameraDistance: 1100 });
    return {
      version: VERSION,
      meta: { name: "Mockup sản phẩm mới", updatedAt: new Date().toISOString() },
      device: { preset: "phone-modern", orientation: "portrait", frameColor: "#111827", screen: null },
      transform: initial,
      scene: { preset: "aurora", ...SCENE_PRESETS.aurora, grid: true, shadowBlur: 34 },
      timeline: {
        duration: 6,
        currentTime: 0,
        fps: 30,
        playing: false,
        loop: true,
        keyframes: [
          createKeyframe(0, initial, "ease-in-out"),
          createKeyframe(3, { ...initial, rotateY: 24, rotateZ: 2 }, "ease-in-out"),
          createKeyframe(6, initial, "ease-in-out")
        ]
      },
      export: { width: 1600, height: 1200, transparent: false, format: "png", quality: 1 }
    };
  }

  function normalizeProject(raw) {
    const source = raw && typeof raw === "object" ? raw : {};
    const fallback = createDefaultProject();
    const deviceSource = source.device && typeof source.device === "object" ? source.device : {};
    const sceneSource = source.scene && typeof source.scene === "object" ? source.scene : {};
    const timelineSource = source.timeline && typeof source.timeline === "object" ? source.timeline : {};
    const exportSource = source.export && typeof source.export === "object" ? source.export : {};
    const preset = Object.prototype.hasOwnProperty.call(DEVICE_PRESETS, deviceSource.preset) ? deviceSource.preset : fallback.device.preset;
    const scenePreset = Object.prototype.hasOwnProperty.call(SCENE_PRESETS, sceneSource.preset) ? sceneSource.preset : fallback.scene.preset;
    const screen = deviceSource.screen && typeof deviceSource.screen === "object" ? {
      name: String(deviceSource.screen.name || "Ảnh màn hình").slice(0, 160),
      type: String(deviceSource.screen.type || "image/png").slice(0, 80),
      dataUrl: /^data:image\/(png|jpeg|webp|gif);base64,/i.test(deviceSource.screen.dataUrl || "") ? deviceSource.screen.dataUrl : ""
    } : null;
    const duration = clamp(timelineSource.duration, 1, 60, fallback.timeline.duration);
    const frames = (Array.isArray(timelineSource.keyframes) ? timelineSource.keyframes : fallback.timeline.keyframes)
      .slice(0, MAX_KEYFRAMES)
      .map((frame) => createKeyframe(clamp(frame && frame.time, 0, duration, 0), frame && frame.transform, frame && frame.easing))
      .sort((a, b) => a.time - b.time);
    return {
      version: VERSION,
      meta: {
        name: String(source.meta && source.meta.name || fallback.meta.name).trim().slice(0, 120) || fallback.meta.name,
        updatedAt: new Date().toISOString()
      },
      device: {
        preset,
        orientation: deviceSource.orientation === "landscape" ? "landscape" : "portrait",
        frameColor: /^#[0-9a-f]{6}$/i.test(deviceSource.frameColor || "") ? deviceSource.frameColor : fallback.device.frameColor,
        screen
      },
      transform: normalizeTransform(source.transform),
      scene: {
        preset: scenePreset,
        label: SCENE_PRESETS[scenePreset].label,
        background: ["solid", "gradient", "transparent"].includes(sceneSource.background) ? sceneSource.background : SCENE_PRESETS[scenePreset].background,
        color: /^#[0-9a-f]{6}$/i.test(sceneSource.color || "") ? sceneSource.color : SCENE_PRESETS[scenePreset].color,
        secondary: /^#[0-9a-f]{6}$/i.test(sceneSource.secondary || "") ? sceneSource.secondary : SCENE_PRESETS[scenePreset].secondary,
        accent: /^#[0-9a-f]{6}$/i.test(sceneSource.accent || "") ? sceneSource.accent : SCENE_PRESETS[scenePreset].accent,
        shadow: clamp(sceneSource.shadow, 0, 1, SCENE_PRESETS[scenePreset].shadow),
        reflection: clamp(sceneSource.reflection, 0, 0.7, SCENE_PRESETS[scenePreset].reflection),
        shadowBlur: clamp(sceneSource.shadowBlur, 0, 100, 34),
        grid: sceneSource.grid !== false
      },
      timeline: {
        duration,
        currentTime: clamp(timelineSource.currentTime, 0, duration, 0),
        fps: [24, 25, 30, 50, 60].includes(Number(timelineSource.fps)) ? Number(timelineSource.fps) : 30,
        playing: false,
        loop: timelineSource.loop !== false,
        keyframes: frames.length ? frames : fallback.timeline.keyframes
      },
      export: {
        width: clamp(exportSource.width, 320, 4096, 1600),
        height: clamp(exportSource.height, 320, 4096, 1200),
        transparent: exportSource.transparent === true,
        format: "png",
        quality: clamp(exportSource.quality, 0.5, 1, 1)
      }
    };
  }

  function ease(ratio, type) {
    const t = clamp(ratio, 0, 1, 0);
    if (type === "ease-in") return t * t;
    if (type === "ease-out") return 1 - Math.pow(1 - t, 2);
    if (type === "ease-in-out") return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    return t;
  }

  function interpolateTransform(a, b, ratio, easing) {
    const left = normalizeTransform(a);
    const right = normalizeTransform(b);
    const t = ease(ratio, easing);
    const mix = (key) => left[key] + (right[key] - left[key]) * t;
    return { rotateX: mix("rotateX"), rotateY: mix("rotateY"), rotateZ: mix("rotateZ"), scale: mix("scale"), cameraDistance: mix("cameraDistance") };
  }

  function transformAt(project, time) {
    const frames = project.timeline.keyframes.slice().sort((a, b) => a.time - b.time);
    if (!frames.length) return normalizeTransform(project.transform);
    if (time <= frames[0].time) return normalizeTransform(frames[0].transform);
    if (time >= frames[frames.length - 1].time) return normalizeTransform(frames[frames.length - 1].transform);
    const index = frames.findIndex((frame) => frame.time >= time);
    const previous = frames[index - 1];
    const next = frames[index];
    return interpolateTransform(previous.transform, next.transform, (time - previous.time) / Math.max(0.001, next.time - previous.time), next.easing);
  }

  function roundedRect(ctx, x, y, width, height, radius) {
    const r = Math.max(0, Math.min(radius, width / 2, height / 2));
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + width, y, x + width, y + height, r);
    ctx.arcTo(x + width, y + height, x, y + height, r);
    ctx.arcTo(x, y + height, x, y, r);
    ctx.arcTo(x, y, x + width, y, r);
    ctx.closePath();
  }

  function dimensionsFor(project) {
    const preset = DEVICE_PRESETS[project.device.preset] || DEVICE_PRESETS["phone-modern"];
    const landscape = project.device.orientation === "landscape";
    return { ...preset, width: landscape ? preset.height : preset.width, height: landscape ? preset.width : preset.height };
  }

  function paintBackground(ctx, width, height, project, transparent, exporting) {
    if (transparent || project.scene.background === "transparent") {
      if (exporting) return;
      const size = Math.max(14, Math.round(Math.min(width, height) / 35));
      for (let y = 0; y < height; y += size) for (let x = 0; x < width; x += size) {
        ctx.fillStyle = ((x / size + y / size) % 2) ? "#202735" : "#111722";
        ctx.fillRect(x, y, size, size);
      }
      return;
    }
    if (project.scene.background === "gradient") {
      const gradient = ctx.createLinearGradient(0, 0, width, height);
      gradient.addColorStop(0, project.scene.color);
      gradient.addColorStop(0.58, project.scene.secondary);
      gradient.addColorStop(1, project.scene.accent);
      ctx.fillStyle = gradient;
    } else ctx.fillStyle = project.scene.color;
    ctx.fillRect(0, 0, width, height);
    if (project.scene.grid) {
      ctx.save();
      ctx.globalAlpha = 0.1;
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 1;
      const gap = Math.max(36, Math.round(Math.min(width, height) / 12));
      for (let x = gap; x < width; x += gap) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke(); }
      for (let y = gap; y < height; y += gap) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke(); }
      ctx.restore();
    }
  }

  function drawDevice(ctx, width, height, project, activeTransform, image) {
    const preset = dimensionsFor(project);
    const safe = normalizeTransform(activeTransform || project.transform);
    const ratio = preset.width / preset.height;
    const maxHeight = height * 0.64 * safe.scale;
    const maxWidth = width * 0.48 * safe.scale;
    let deviceHeight = Math.min(maxHeight, maxWidth / ratio);
    let deviceWidth = deviceHeight * ratio;
    if (preset.base) { deviceWidth = Math.min(width * 0.62 * safe.scale, maxWidth * 1.35); deviceHeight = deviceWidth / ratio; }
    const rx = safe.rotateX * Math.PI / 180;
    const ry = safe.rotateY * Math.PI / 180;
    const rz = safe.rotateZ * Math.PI / 180;
    const perspective = 900 / safe.cameraDistance;
    const scaleX = Math.max(0.2, Math.cos(ry)) * perspective;
    const scaleY = Math.max(0.35, Math.cos(rx)) * perspective;
    const skewX = Math.sin(ry) * 0.24;
    const skewY = -Math.sin(rx) * 0.14;
    const centerX = width / 2;
    const centerY = height / 2 - (preset.base ? height * 0.02 : 0);

    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate(rz);
    ctx.transform(scaleX, skewY, skewX, scaleY, 0, 0);
    const x = -deviceWidth / 2;
    const y = -deviceHeight / 2;
    const radius = Math.max(12, deviceWidth * (preset.radius / preset.width));
    const bezel = Math.max(8, deviceWidth * (preset.bezel / preset.width));

    ctx.save();
    ctx.shadowColor = `rgba(0,0,0,${project.scene.shadow})`;
    ctx.shadowBlur = project.scene.shadowBlur;
    ctx.shadowOffsetY = project.scene.shadowBlur * 0.45;
    roundedRect(ctx, x, y, deviceWidth, deviceHeight, radius);
    ctx.fillStyle = project.device.frameColor;
    ctx.fill();
    ctx.restore();

    const screenX = x + bezel;
    const screenY = y + bezel;
    const screenW = deviceWidth - bezel * 2;
    const screenH = deviceHeight - bezel * (preset.camera === "browser" ? 1.45 : 2);
    const screenRadius = Math.max(6, radius - bezel * 0.55);
    roundedRect(ctx, screenX, screenY + (preset.camera === "browser" ? bezel * 0.45 : 0), screenW, screenH, screenRadius);
    ctx.save();
    ctx.clip();
    if (image && image.complete && image.naturalWidth) {
      const imageRatio = image.naturalWidth / image.naturalHeight;
      const boxRatio = screenW / screenH;
      let drawW = screenW;
      let drawH = screenH;
      let drawX = screenX;
      let drawY = screenY + (preset.camera === "browser" ? bezel * 0.45 : 0);
      if (imageRatio > boxRatio) { drawW = screenH * imageRatio; drawX -= (drawW - screenW) / 2; }
      else { drawH = screenW / imageRatio; drawY -= (drawH - screenH) / 2; }
      ctx.drawImage(image, drawX, drawY, drawW, drawH);
    } else {
      const gradient = ctx.createLinearGradient(screenX, screenY, screenX + screenW, screenY + screenH);
      gradient.addColorStop(0, project.scene.accent);
      gradient.addColorStop(1, project.scene.secondary);
      ctx.fillStyle = gradient;
      ctx.fillRect(screenX, screenY, screenW, screenH + bezel);
      ctx.fillStyle = "rgba(255,255,255,.92)";
      ctx.textAlign = "center";
      ctx.font = `700 ${Math.max(10, deviceWidth * 0.045)}px system-ui`;
      ctx.fillText("Thả ảnh màn hình vào đây", 0, 0);
    }
    ctx.restore();

    ctx.fillStyle = "rgba(255,255,255,.2)";
    if (preset.camera === "island") roundedRect(ctx, -deviceWidth * 0.11, y + bezel * 0.48, deviceWidth * 0.22, bezel * 0.52, bezel);
    else if (preset.camera === "dot") { ctx.beginPath(); ctx.arc(0, y + bezel * 0.55, Math.max(2, bezel * 0.1), 0, Math.PI * 2); }
    else if (preset.camera === "speaker") roundedRect(ctx, -deviceWidth * 0.09, y + bezel * 0.46, deviceWidth * 0.18, Math.max(2, bezel * 0.08), 4);
    else if (preset.camera === "browser") {
      [0, 1, 2].forEach((dot) => { ctx.beginPath(); ctx.arc(x + bezel * (0.65 + dot * 0.38), y + bezel * 0.65, Math.max(2, bezel * 0.09), 0, Math.PI * 2); ctx.fill(); });
    }
    ctx.fill();

    if (preset.base) {
      ctx.beginPath();
      ctx.moveTo(x - deviceWidth * 0.07, y + deviceHeight);
      ctx.lineTo(x + deviceWidth * 1.07, y + deviceHeight);
      ctx.lineTo(x + deviceWidth * 0.92, y + deviceHeight + deviceHeight * 0.08);
      ctx.lineTo(x + deviceWidth * 0.08, y + deviceHeight + deviceHeight * 0.08);
      ctx.closePath();
      ctx.fillStyle = "#64748b";
      ctx.fill();
    }
    ctx.restore();

    if (project.scene.reflection > 0) {
      const gradient = ctx.createLinearGradient(0, centerY + deviceHeight * 0.34, 0, height);
      gradient.addColorStop(0, `rgba(255,255,255,${project.scene.reflection})`);
      gradient.addColorStop(1, "rgba(255,255,255,0)");
      ctx.save();
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.ellipse(centerX, centerY + deviceHeight * 0.43, deviceWidth * 0.3, Math.max(8, deviceHeight * 0.06), 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  function renderCanvas(canvas, project, options) {
    if (!canvas || !canvas.getContext) return false;
    const opts = options || {};
    const cssWidth = Math.max(320, opts.width || canvas.clientWidth || 960);
    const cssHeight = Math.max(260, opts.height || canvas.clientHeight || 640);
    const dpr = opts.pixelRatio || Math.min(2, runtime.devicePixelRatio || 1);
    canvas.width = Math.round(cssWidth * dpr);
    canvas.height = Math.round(cssHeight * dpr);
    if (!opts.exporting) { canvas.style.width = `${cssWidth}px`; canvas.style.height = `${cssHeight}px`; }
    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssWidth, cssHeight);
    paintBackground(ctx, cssWidth, cssHeight, project, opts.transparent === true, opts.exporting === true);
    drawDevice(ctx, cssWidth, cssHeight, project, opts.transform || transformAt(project, project.timeline.currentTime), opts.image || null);
    return true;
  }

  function serializeProject(project, includeImage) {
    const payload = clone(project);
    payload.timeline.playing = false;
    payload.meta.updatedAt = new Date().toISOString();
    if (includeImage === false && payload.device.screen) payload.device.screen.dataUrl = "";
    return payload;
  }

  function injectStyles(doc) {
    if (!doc || doc.getElementById(STYLE_ID)) return;
    const style = doc.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      .hh-mockup{--hm-cyan:#6ce7ed;--hm-pink:#ff64c8;--hm-gold:#ffd166;--hm-bg:#080d16;--hm-panel:#101824;color:#e9f4ff;font-family:Inter,system-ui,sans-serif;display:grid;grid-template-rows:auto minmax(0,1fr) auto;min-height:720px;background:radial-gradient(circle at 12% 8%,rgba(255,100,200,.12),transparent 28%),radial-gradient(circle at 90% 15%,rgba(108,231,237,.11),transparent 26%),var(--hm-bg);border:1px solid #26364a;border-radius:8px;overflow:hidden}
      .hh-mockup *{box-sizing:border-box;letter-spacing:0}.hm-toolbar,.hm-statusbar{display:flex;align-items:center;gap:7px;padding:9px 12px;background:rgba(10,16,26,.92);border-bottom:1px solid #26364a;min-height:48px}.hm-brand{display:flex;align-items:center;gap:9px;margin-right:8px}.hm-brand-mark{display:grid;place-items:center;width:32px;height:32px;border-radius:7px;color:#081018;font-weight:900;background:linear-gradient(135deg,var(--hm-pink),var(--hm-cyan),var(--hm-gold))}.hm-brand strong{display:block;font-size:13px}.hm-brand small,.hm-muted{color:#8291a4;font-size:10px}.hm-toolbar button,.hm-toolbar select,.hm-btn,.hm-inspector input,.hm-inspector select,.hm-inspector button,.hm-library button{min-height:32px;border:1px solid #304156;border-radius:6px;background:#111b28;color:#dbeafe;padding:0 10px;font:600 11px inherit;cursor:pointer}.hm-toolbar button:hover,.hm-btn:hover,.hm-inspector button:hover,.hm-library button:hover{border-color:var(--hm-cyan);color:white;box-shadow:0 0 0 2px rgba(108,231,237,.12)}.hm-toolbar button:focus-visible,.hm-inspector input:focus-visible,.hm-inspector select:focus-visible,.hm-library button:focus-visible{outline:2px solid var(--hm-pink);outline-offset:2px}.hm-toolbar-spacer{flex:1}.hm-btn-primary{background:linear-gradient(135deg,#d946a8,#34c8d7)!important;color:#071018!important;border:0!important;font-weight:900!important}.hm-workspace{display:grid;grid-template-columns:218px minmax(360px,1fr) 262px;min-height:0}.hm-panel{background:rgba(12,19,30,.88);border-right:1px solid #26364a;overflow:auto}.hm-inspector{border-right:0;border-left:1px solid #26364a}.hm-section{padding:13px;border-bottom:1px solid #223044}.hm-section-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:10px}.hm-section h3{margin:0;font-size:10px;color:#79e7e8;text-transform:uppercase}.hm-badge{padding:3px 6px;border:1px solid #315263;border-radius:99px;color:#8df4d0;font-size:8px}.hm-device-grid,.hm-scene-grid{display:grid;grid-template-columns:1fr 1fr;gap:7px}.hm-preset{position:relative;text-align:left;padding:9px!important;min-height:64px!important}.hm-preset strong{display:block;font-size:10px}.hm-preset small{display:block;margin-top:4px;color:#718196;font-size:8px}.hm-preset.is-active{border-color:var(--hm-pink);background:linear-gradient(145deg,rgba(255,100,200,.15),rgba(108,231,237,.08))}.hm-preset.is-active:after{content:'';position:absolute;left:6px;right:6px;bottom:4px;height:2px;background:linear-gradient(90deg,var(--hm-pink),var(--hm-cyan))}.hm-upload{display:grid;place-items:center;min-height:118px;text-align:center;border:1px dashed #42617a;border-radius:7px;background:#0b131f;cursor:pointer;padding:15px}.hm-upload.is-dragging{border-color:var(--hm-pink);background:rgba(255,100,200,.1)}.hm-upload strong{font-size:11px}.hm-upload span{color:#7f90a6;font-size:9px;margin-top:5px}.hm-stage-wrap{position:relative;display:grid;place-items:center;min-height:0;overflow:hidden;background:#070b12}.hm-stage-wrap.is-dragging{outline:2px solid var(--hm-pink);outline-offset:-8px;background:rgba(255,100,200,.08)}.hm-stage{display:block;width:100%;height:100%;min-height:520px;touch-action:none;cursor:grab}.hm-stage:active{cursor:grabbing}.hm-stage-hud{position:absolute;top:12px;left:12px;display:flex;gap:6px;pointer-events:none}.hm-stage-hud span{padding:5px 8px;border:1px solid rgba(255,255,255,.18);border-radius:5px;background:rgba(3,8,15,.7);font-size:9px;backdrop-filter:blur(9px)}.hm-empty-help{position:absolute;bottom:14px;color:#8291a4;font-size:9px;pointer-events:none}.hm-field{display:grid;gap:5px;margin:8px 0}.hm-field-row{display:grid;grid-template-columns:1fr 1fr;gap:7px}.hm-field label{display:flex;justify-content:space-between;color:#a7b6c8;font-size:9px}.hm-field input[type=range]{width:100%;accent-color:var(--hm-pink)}.hm-field input[type=color]{width:100%;height:34px;padding:3px}.hm-field input[type=number],.hm-field select,.hm-field input[type=text]{width:100%;min-width:0}.hm-toggle{display:flex;align-items:center;justify-content:space-between;margin:8px 0;color:#a7b6c8;font-size:9px}.hm-timeline{display:grid;grid-template-columns:200px minmax(0,1fr) 250px;gap:12px;align-items:center;padding:10px 12px;background:#0a111c;border-top:1px solid #26364a;min-height:92px}.hm-transport{display:flex;align-items:center;gap:6px}.hm-transport button{width:32px;height:32px;border:1px solid #314258;border-radius:6px;background:#121d2b;color:white;cursor:pointer}.hm-time{font:700 10px ui-monospace,monospace;color:var(--hm-cyan)}.hm-track{position:relative;height:40px;padding-top:17px}.hm-track input{width:100%;accent-color:var(--hm-pink)}.hm-key{position:absolute;top:2px;width:8px;height:8px;transform:translateX(-50%) rotate(45deg);border:1px solid #ffe68b;background:#f3b63d}.hm-timeline-actions{display:flex;justify-content:flex-end;gap:6px}.hm-statusbar{border-top:1px solid #26364a;border-bottom:0;min-height:30px;padding:5px 12px;font-size:9px;color:#7e91a7}.hm-statusbar [role=status]{color:#8fe7ce;margin-left:auto}.hm-status-dot{width:7px;height:7px;border-radius:50%;background:#67dba1;box-shadow:0 0 10px #67dba1}.hm-note{font-size:9px;line-height:1.55;color:#8798ad;border:1px solid #2d3b4e;background:#0a121d;padding:9px;border-radius:6px}.hm-hidden{display:none!important}
      @media(max-width:1050px){.hm-workspace{grid-template-columns:190px minmax(320px,1fr)}.hm-inspector{grid-column:1/-1;border-left:0;border-top:1px solid #26364a;display:grid;grid-template-columns:repeat(3,1fr)}.hm-inspector .hm-section{border-right:1px solid #26364a}.hm-timeline{grid-template-columns:170px minmax(0,1fr)}}
      @media(max-width:720px){.hh-mockup{min-height:900px}.hm-toolbar{overflow-x:auto}.hm-brand small,.hm-toolbar [data-hm-desktop]{display:none}.hm-workspace{display:flex;flex-direction:column}.hm-panel{border-right:0;border-bottom:1px solid #26364a;max-height:none}.hm-library{display:grid;grid-template-columns:1fr 1fr}.hm-library .hm-section:last-child{grid-column:1/-1}.hm-stage{min-height:420px}.hm-inspector{display:grid;grid-template-columns:1fr}.hm-timeline{grid-template-columns:1fr;gap:7px}.hm-timeline-actions{justify-content:flex-start}.hm-device-grid,.hm-scene-grid{grid-template-columns:repeat(2,1fr)}}
      @media(prefers-reduced-motion:reduce){.hh-mockup *{scroll-behavior:auto!important;transition:none!important;animation:none!important}}
    `;
    doc.head.appendChild(style);
  }

  function downloadBlob(doc, blob, fileName) {
    const url = runtime.URL && runtime.URL.createObjectURL ? runtime.URL.createObjectURL(blob) : "";
    if (!url) return false;
    const link = doc.createElement("a");
    link.href = url;
    link.download = fileName;
    link.click();
    runtime.setTimeout(() => runtime.URL.revokeObjectURL(url), 1000);
    return true;
  }

  function template(project) {
    const deviceButtons = Object.entries(DEVICE_PRESETS).map(([id, item]) => `<button class="hm-preset${project.device.preset === id ? " is-active" : ""}" data-hm-device="${id}" type="button"><strong>${esc(item.label)}</strong><small>${esc(item.category)} · ${item.width}×${item.height}</small></button>`).join("");
    const sceneButtons = Object.entries(SCENE_PRESETS).map(([id, item]) => `<button class="hm-preset${project.scene.preset === id ? " is-active" : ""}" data-hm-scene="${id}" type="button"><strong>${esc(item.label)}</strong><small>${esc(item.background)}</small></button>`).join("");
    return `<section class="hh-mockup" data-graphic-mockup role="application" aria-label="Studio tạo mockup thiết bị 3D">
      <header class="hm-toolbar">
        <div class="hm-brand"><span class="hm-brand-mark">3D</span><span><strong>HH Device Mockup</strong><small>Rotato-inspired · Canvas local</small></span></div>
        <button type="button" data-hm-action="new" title="Tạo dự án mới">Mới</button>
        <button type="button" data-hm-action="undo" title="Hoàn tác (Ctrl+Z)">↶</button>
        <button type="button" data-hm-action="redo" title="Làm lại (Ctrl+Y)">↷</button>
        <button type="button" data-hm-action="save" data-hm-desktop>Lưu</button>
        <button type="button" data-hm-action="import" data-hm-desktop>Nhập JSON</button>
        <button type="button" data-hm-action="export-json" data-hm-desktop>Xuất JSON</button>
        <span class="hm-toolbar-spacer"></span>
        <select data-hm-orientation aria-label="Hướng thiết bị"><option value="portrait"${project.device.orientation === "portrait" ? " selected" : ""}>Dọc</option><option value="landscape"${project.device.orientation === "landscape" ? " selected" : ""}>Ngang</option></select>
        <button class="hm-btn-primary" type="button" data-hm-action="export-png">Xuất PNG</button>
        <input class="hm-hidden" type="file" accept="application/json" data-hm-json-file>
        <input class="hm-hidden" type="file" accept="image/png,image/jpeg,image/webp,image/gif" data-hm-screen-file>
      </header>
      <div class="hm-workspace">
        <aside class="hm-panel hm-library" aria-label="Thư viện preset">
          <div class="hm-section"><div class="hm-section-head"><h3>Thiết bị</h3><span class="hm-badge">${Object.keys(DEVICE_PRESETS).length} preset</span></div><div class="hm-device-grid">${deviceButtons}</div></div>
          <div class="hm-section"><div class="hm-section-head"><h3>Cảnh</h3><span class="hm-badge">Local</span></div><div class="hm-scene-grid">${sceneButtons}</div></div>
          <div class="hm-section"><div class="hm-section-head"><h3>Màn hình</h3><span class="hm-badge">Kéo thả</span></div><button class="hm-upload" type="button" data-hm-upload><strong>${project.device.screen ? esc(project.device.screen.name) : "+ Chọn ảnh giao diện"}</strong><span>PNG, JPG, WebP hoặc GIF từ thiết bị</span></button></div>
        </aside>
        <main class="hm-stage-wrap" data-hm-dropzone>
          <canvas class="hm-stage" data-hm-canvas aria-label="Bản xem trước mockup thiết bị"></canvas>
          <div class="hm-stage-hud"><span data-hm-hud-device>${esc(DEVICE_PRESETS[project.device.preset].label)}</span><span data-hm-hud-transform>X ${Math.round(project.transform.rotateX)}° · Y ${Math.round(project.transform.rotateY)}°</span></div>
          <span class="hm-empty-help">Kéo để xoay · cuộn để phóng · thả ảnh để thay màn hình</span>
        </main>
        <aside class="hm-panel hm-inspector" aria-label="Thuộc tính mockup">
          <div class="hm-section"><div class="hm-section-head"><h3>Biến đổi 3D</h3><span class="hm-badge">Perspective</span></div>
            ${rangeField("Xoay X", "rotateX", -75, 75, 1, project.transform.rotateX, "°")}
            ${rangeField("Xoay Y", "rotateY", -180, 180, 1, project.transform.rotateY, "°")}
            ${rangeField("Xoay Z", "rotateZ", -180, 180, 1, project.transform.rotateZ, "°")}
            ${rangeField("Tỉ lệ", "scale", 0.35, 2.2, 0.01, project.transform.scale, "×")}
            ${rangeField("Camera", "cameraDistance", 400, 2400, 10, project.transform.cameraDistance, "px")}
          </div>
          <div class="hm-section"><div class="hm-section-head"><h3>Vật liệu & ánh sáng</h3><span class="hm-badge">Scene</span></div>
            <div class="hm-field-row"><div class="hm-field"><label>Khung</label><input type="color" data-hm-color="frameColor" value="${project.device.frameColor}"></div><div class="hm-field"><label>Nền</label><input type="color" data-hm-color="color" value="${project.scene.color}"></div></div>
            <div class="hm-field-row"><div class="hm-field"><label>Màu 2</label><input type="color" data-hm-color="secondary" value="${project.scene.secondary}"></div><div class="hm-field"><label>Điểm nhấn</label><input type="color" data-hm-color="accent" value="${project.scene.accent}"></div></div>
            ${rangeField("Bóng", "shadow", 0, 1, 0.01, project.scene.shadow, "")}
            ${rangeField("Độ mờ bóng", "shadowBlur", 0, 100, 1, project.scene.shadowBlur, "px")}
            ${rangeField("Phản chiếu", "reflection", 0, 0.7, 0.01, project.scene.reflection, "")}
            <label class="hm-toggle"><span>Lưới phối cảnh</span><input type="checkbox" data-hm-grid${project.scene.grid ? " checked" : ""}></label>
          </div>
          <div class="hm-section"><div class="hm-section-head"><h3>Xuất ảnh</h3><span class="hm-badge">PNG thật</span></div>
            <div class="hm-field-row"><div class="hm-field"><label>Rộng</label><input type="number" min="320" max="4096" data-hm-export="width" value="${project.export.width}"></div><div class="hm-field"><label>Cao</label><input type="number" min="320" max="4096" data-hm-export="height" value="${project.export.height}"></div></div>
            <label class="hm-toggle"><span>Nền trong suốt</span><input type="checkbox" data-hm-transparent${project.export.transparent ? " checked" : ""}></label>
            <p class="hm-note">PNG và JSON chạy trực tiếp trên thiết bị. Render video, ray tracing và mô hình WebGL cần engine/encoder chuyên dụng nên chưa được giả lập.</p>
          </div>
        </aside>
      </div>
      <div class="hm-timeline" aria-label="Orbit timeline">
        <div class="hm-transport"><button type="button" data-hm-action="stop" aria-label="Dừng">■</button><button type="button" data-hm-action="play" aria-label="Phát hoặc tạm dừng">▶</button><span class="hm-time" data-hm-time>00:00.00</span></div>
        <div class="hm-track"><div data-hm-keyframes>${keyframeMarkers(project)}</div><input type="range" min="0" max="${project.timeline.duration}" step="0.01" value="${project.timeline.currentTime}" data-hm-playhead aria-label="Vị trí timeline"></div>
        <div class="hm-timeline-actions"><button class="hm-btn" type="button" data-hm-action="add-keyframe">+ Keyframe</button><button class="hm-btn" type="button" data-hm-action="orbit-preset">Orbit 360°</button><button class="hm-btn" type="button" data-hm-action="delete-keyframe">Xóa điểm</button></div>
      </div>
      <footer class="hm-statusbar"><span class="hm-status-dot"></span><span>Canvas 2D · dữ liệu cục bộ · không tải ảnh lên máy chủ</span><span role="status" aria-live="polite" data-hm-status>Sẵn sàng.</span></footer>
    </section>`;
  }

  function rangeField(label, key, min, max, step, value, suffix) {
    return `<div class="hm-field"><label><span>${esc(label)}</span><output data-hm-output="${key}">${Number(value).toFixed(step < 1 ? 2 : 0)}${suffix}</output></label><input type="range" min="${min}" max="${max}" step="${step}" value="${value}" data-hm-range="${key}" data-hm-suffix="${suffix}"></div>`;
  }

  function keyframeMarkers(project) {
    return project.timeline.keyframes.map((frame) => `<button type="button" class="hm-key" data-hm-key="${esc(frame.id)}" title="Keyframe ${frame.time.toFixed(2)} giây" style="left:${(frame.time / project.timeline.duration) * 100}%"></button>`).join("");
  }

  function createController(root, options) {
    const doc = root.ownerDocument || runtime.document;
    let storage = options && options.storage;
    if (!storage) {
      try { storage = runtime.localStorage; }
      catch (_) { storage = null; }
    }
    const abortController = typeof runtime.AbortController === "function" ? new runtime.AbortController() : null;
    const signalOptions = abortController ? { signal: abortController.signal } : undefined;
    let project = createDefaultProject();
    let history = [];
    let future = [];
    let image = null;
    let imageUrl = "";
    let raf = 0;
    let lastFrame = 0;
    let dragging = null;
    let saveTimer = 0;

    try {
      const saved = storage && storage.getItem(STORAGE_KEY);
      if (saved) project = normalizeProject(JSON.parse(saved));
    } catch (_) { /* local storage is optional */ }

    function setStatus(message) {
      const node = root.querySelector("[data-hm-status]");
      if (node) node.textContent = message;
    }

    function ensureImage(callback) {
      const dataUrl = project.device.screen && project.device.screen.dataUrl;
      if (!dataUrl) { image = null; imageUrl = ""; if (callback) callback(); return; }
      if (image && imageUrl === dataUrl) { if (callback) callback(); return; }
      image = new runtime.Image();
      imageUrl = dataUrl;
      image.onload = () => { draw(); if (callback) callback(); };
      image.onerror = () => { image = null; setStatus("Không đọc được ảnh màn hình."); if (callback) callback(); };
      image.src = dataUrl;
    }

    function draw(activeTransform) {
      const canvas = root.querySelector("[data-hm-canvas]");
      if (!canvas) return;
      renderCanvas(canvas, project, { transform: activeTransform || transformAt(project, project.timeline.currentTime), image });
      const hud = root.querySelector("[data-hm-hud-transform]");
      const active = activeTransform || transformAt(project, project.timeline.currentTime);
      if (hud) hud.textContent = `X ${Math.round(active.rotateX)}° · Y ${Math.round(active.rotateY)}° · ${active.scale.toFixed(2)}×`;
    }

    function persist() {
      runtime.clearTimeout(saveTimer);
      saveTimer = runtime.setTimeout(() => {
        try {
          if (storage) storage.setItem(STORAGE_KEY, JSON.stringify(serializeProject(project, true)));
          setStatus("Đã tự động lưu trên thiết bị.");
        } catch (_) {
          try {
            if (storage) storage.setItem(STORAGE_KEY, JSON.stringify(serializeProject(project, false)));
            setStatus("Đã lưu dự án; ảnh quá lớn nên không lưu kèm.");
          } catch (_) { setStatus("Bộ nhớ trình duyệt đầy; hãy xuất JSON."); }
        }
      }, 280);
    }

    function snapshot() {
      history.push(clone(project));
      if (history.length > MAX_HISTORY) history.shift();
      future = [];
    }

    function refresh(rebuild) {
      if (rebuild) {
        root.innerHTML = template(project);
        ensureImage();
      } else draw();
      persist();
    }

    function mutate(callback, rebuild) {
      snapshot();
      callback(project);
      project = normalizeProject(project);
      refresh(rebuild === true);
    }

    function undo() {
      if (!history.length) return setStatus("Không còn thao tác để hoàn tác.");
      future.push(clone(project));
      project = normalizeProject(history.pop());
      refresh(true);
      setStatus("Đã hoàn tác.");
    }

    function redo() {
      if (!future.length) return setStatus("Không còn thao tác để làm lại.");
      history.push(clone(project));
      project = normalizeProject(future.pop());
      refresh(true);
      setStatus("Đã làm lại.");
    }

    function acceptImage(file) {
      if (!file || !/^image\/(png|jpeg|webp|gif)$/i.test(file.type || "")) return setStatus("Hãy chọn ảnh PNG, JPG, WebP hoặc GIF.");
      if (file.size > 16 * 1024 * 1024) return setStatus("Ảnh lớn hơn 16 MB. Hãy tối ưu ảnh trước khi dùng.");
      const reader = new runtime.FileReader();
      reader.onload = () => mutate((draft) => { draft.device.screen = { name: file.name, type: file.type, dataUrl: String(reader.result || "") }; }, true);
      reader.onerror = () => setStatus("Không thể đọc tệp ảnh.");
      reader.readAsDataURL(file);
    }

    function exportJson() {
      const blob = new runtime.Blob([JSON.stringify(serializeProject(project, true), null, 2)], { type: "application/json" });
      downloadBlob(doc, blob, `${project.meta.name.replace(/[^a-z0-9-_]+/gi, "-").toLowerCase() || "hh-mockup"}.json`);
      setStatus("Đã xuất dự án JSON.");
    }

    function exportPng() {
      const canvas = doc.createElement("canvas");
      const transparent = project.export.transparent || project.scene.background === "transparent";
      const paint = () => {
        renderCanvas(canvas, project, { width: project.export.width, height: project.export.height, pixelRatio: 1, transparent, image, exporting: true });
        if (!canvas.toBlob) return setStatus("Trình duyệt chưa hỗ trợ xuất PNG từ Canvas.");
        canvas.toBlob((blob) => {
          if (!blob) return setStatus("Không thể tạo PNG. Hãy kiểm tra ảnh nguồn.");
          downloadBlob(doc, blob, `${project.meta.name.replace(/[^a-z0-9-_]+/gi, "-").toLowerCase() || "hh-mockup"}.png`);
          setStatus(`Đã xuất PNG ${project.export.width}×${project.export.height}.`);
        }, "image/png", project.export.quality);
      };
      ensureImage(paint);
    }

    function importJson(file) {
      if (!file) return;
      const reader = new runtime.FileReader();
      reader.onload = () => {
        try { snapshot(); project = normalizeProject(JSON.parse(String(reader.result || "{}"))); refresh(true); setStatus("Đã nhập dự án JSON."); }
        catch (_) { setStatus("JSON không hợp lệ."); }
      };
      reader.onerror = () => setStatus("Không thể đọc dự án.");
      reader.readAsText(file);
    }

    function stopPlayback(reset) {
      project.timeline.playing = false;
      if (raf) runtime.cancelAnimationFrame(raf);
      raf = 0;
      lastFrame = 0;
      if (reset) project.timeline.currentTime = 0;
      const playButton = root.querySelector('[data-hm-action="play"]');
      if (playButton) playButton.textContent = "▶";
      updateTimeline();
      draw();
    }

    function playbackFrame(timestamp) {
      if (!project.timeline.playing) return;
      if (!lastFrame) lastFrame = timestamp;
      const delta = Math.min(0.1, (timestamp - lastFrame) / 1000);
      lastFrame = timestamp;
      project.timeline.currentTime += delta;
      if (project.timeline.currentTime >= project.timeline.duration) {
        if (project.timeline.loop) project.timeline.currentTime = 0;
        else return stopPlayback(false);
      }
      updateTimeline();
      draw(transformAt(project, project.timeline.currentTime));
      raf = runtime.requestAnimationFrame(playbackFrame);
    }

    function togglePlayback() {
      if (runtime.matchMedia && runtime.matchMedia("(prefers-reduced-motion: reduce)").matches) return setStatus("Đã tôn trọng chế độ giảm chuyển động; hãy kéo timeline để xem.");
      project.timeline.playing = !project.timeline.playing;
      const button = root.querySelector('[data-hm-action="play"]');
      if (button) button.textContent = project.timeline.playing ? "Ⅱ" : "▶";
      if (project.timeline.playing) { lastFrame = 0; raf = runtime.requestAnimationFrame(playbackFrame); setStatus("Đang phát orbit timeline."); }
      else stopPlayback(false);
    }

    function updateTimeline() {
      const playhead = root.querySelector("[data-hm-playhead]");
      const time = root.querySelector("[data-hm-time]");
      if (playhead) playhead.value = String(project.timeline.currentTime);
      if (time) {
        const minutes = Math.floor(project.timeline.currentTime / 60).toString().padStart(2, "0");
        const seconds = (project.timeline.currentTime % 60).toFixed(2).padStart(5, "0");
        time.textContent = `${minutes}:${seconds}`;
      }
    }

    function handleAction(action) {
      if (action === "new") { snapshot(); project = createDefaultProject(); refresh(true); setStatus("Đã tạo dự án mới."); }
      else if (action === "undo") undo();
      else if (action === "redo") redo();
      else if (action === "save") { persist(); setStatus("Đang lưu dự án cục bộ."); }
      else if (action === "import") root.querySelector("[data-hm-json-file]").click();
      else if (action === "export-json") exportJson();
      else if (action === "export-png") exportPng();
      else if (action === "play") togglePlayback();
      else if (action === "stop") stopPlayback(true);
      else if (action === "add-keyframe") mutate((draft) => { draft.timeline.keyframes.push(createKeyframe(draft.timeline.currentTime, draft.transform, "ease-in-out")); }, true);
      else if (action === "delete-keyframe") mutate((draft) => {
        if (draft.timeline.keyframes.length <= 1) return;
        let nearest = 0;
        draft.timeline.keyframes.forEach((frame, index) => { if (Math.abs(frame.time - draft.timeline.currentTime) < Math.abs(draft.timeline.keyframes[nearest].time - draft.timeline.currentTime)) nearest = index; });
        draft.timeline.keyframes.splice(nearest, 1);
      }, true);
      else if (action === "orbit-preset") mutate((draft) => {
        const base = normalizeTransform(draft.transform);
        draft.timeline.duration = 8;
        draft.timeline.currentTime = 0;
        draft.timeline.keyframes = [0, 2, 4, 6, 8].map((time, index) => createKeyframe(time, { ...base, rotateY: [-160, -80, 0, 80, 160][index], rotateX: index % 2 ? -4 : -12 }, "ease-in-out"));
      }, true);
    }

    function onClick(event) {
      const actionNode = event.target.closest("[data-hm-action]");
      if (actionNode && root.contains(actionNode)) return handleAction(actionNode.dataset.hmAction);
      const deviceNode = event.target.closest("[data-hm-device]");
      if (deviceNode) return mutate((draft) => { draft.device.preset = deviceNode.dataset.hmDevice; }, true);
      const sceneNode = event.target.closest("[data-hm-scene]");
      if (sceneNode) return mutate((draft) => { const id = sceneNode.dataset.hmScene; draft.scene = { ...draft.scene, preset: id, ...SCENE_PRESETS[id] }; draft.export.transparent = id === "transparent"; }, true);
      const keyNode = event.target.closest("[data-hm-key]");
      if (keyNode) {
        const frame = project.timeline.keyframes.find((item) => item.id === keyNode.dataset.hmKey);
        if (frame) { project.timeline.currentTime = frame.time; project.transform = normalizeTransform(frame.transform); updateTimeline(); draw(); }
        return;
      }
      if (event.target.closest("[data-hm-upload]")) root.querySelector("[data-hm-screen-file]").click();
    }

    function onInput(event) {
      const rangeKey = event.target.dataset.hmRange;
      if (rangeKey) {
        project.transform[rangeKey] = Number(event.target.value);
        const output = root.querySelector(`[data-hm-output="${rangeKey}"]`);
        if (output) output.textContent = `${Number(event.target.value).toFixed(Number(event.target.step) < 1 ? 2 : 0)}${event.target.dataset.hmSuffix || ""}`;
        draw();
        return;
      }
      if (event.target.matches("[data-hm-playhead]")) { project.timeline.currentTime = Number(event.target.value); updateTimeline(); draw(); return; }
      const colorKey = event.target.dataset.hmColor;
      if (colorKey) {
        if (colorKey === "frameColor") project.device.frameColor = event.target.value;
        else project.scene[colorKey] = event.target.value;
        draw(); persist(); return;
      }
      const exportKey = event.target.dataset.hmExport;
      if (exportKey) { project.export[exportKey] = Number(event.target.value); persist(); return; }
      if (event.target.matches("[data-hm-orientation]")) return mutate((draft) => { draft.device.orientation = event.target.value; }, true);
      if (event.target.matches("[data-hm-grid]")) { project.scene.grid = event.target.checked; draw(); persist(); return; }
      if (event.target.matches("[data-hm-transparent]")) { project.export.transparent = event.target.checked; persist(); }
    }

    function onChange(event) {
      if (event.target.matches("[data-hm-screen-file]")) acceptImage(event.target.files && event.target.files[0]);
      if (event.target.matches("[data-hm-json-file]")) importJson(event.target.files && event.target.files[0]);
      if (event.target.matches("[data-hm-range]")) persist();
    }

    function pointerStart(event) {
      if (!event.target.matches("[data-hm-canvas]")) return;
      snapshot();
      dragging = { x: event.clientX, y: event.clientY, rotateX: project.transform.rotateX, rotateY: project.transform.rotateY };
      if (event.target.setPointerCapture) event.target.setPointerCapture(event.pointerId);
    }

    function pointerMove(event) {
      if (!dragging) return;
      project.transform.rotateY = clamp(dragging.rotateY + (event.clientX - dragging.x) * 0.45, -180, 180, 0);
      project.transform.rotateX = clamp(dragging.rotateX - (event.clientY - dragging.y) * 0.35, -75, 75, 0);
      draw();
    }

    function pointerEnd() {
      if (!dragging) return;
      dragging = null;
      future = [];
      refresh(true);
    }

    function onWheel(event) {
      if (!event.target.matches("[data-hm-canvas]")) return;
      event.preventDefault();
      project.transform.scale = clamp(project.transform.scale + (event.deltaY > 0 ? -0.06 : 0.06), 0.35, 2.2, 1);
      draw();
      persist();
    }

    function onDrag(event) {
      const zone = event.target.closest("[data-hm-dropzone]");
      if (!zone) return;
      event.preventDefault();
      if (event.type === "dragover") zone.classList.add("is-dragging");
      if (event.type === "dragleave" || event.type === "drop") zone.classList.remove("is-dragging");
      if (event.type === "drop") acceptImage(event.dataTransfer && event.dataTransfer.files && event.dataTransfer.files[0]);
    }

    function onKeydown(event) {
      if (!(event.ctrlKey || event.metaKey)) return;
      if (String(event.key).toLowerCase() === "z") { event.preventDefault(); event.shiftKey ? redo() : undo(); }
      if (String(event.key).toLowerCase() === "y") { event.preventDefault(); redo(); }
      if (String(event.key).toLowerCase() === "s") { event.preventDefault(); persist(); setStatus("Đã lưu bằng phím tắt."); }
    }

    injectStyles(doc);
    root.innerHTML = template(project);
    root.addEventListener("click", onClick, signalOptions);
    root.addEventListener("input", onInput, signalOptions);
    root.addEventListener("change", onChange, signalOptions);
    root.addEventListener("pointerdown", pointerStart, signalOptions);
    root.addEventListener("pointermove", pointerMove, signalOptions);
    root.addEventListener("pointerup", pointerEnd, signalOptions);
    root.addEventListener("pointercancel", pointerEnd, signalOptions);
    root.addEventListener("wheel", onWheel, abortController ? { signal: abortController.signal, passive: false } : { passive: false });
    ["dragover", "dragleave", "drop"].forEach((type) => root.addEventListener(type, onDrag, signalOptions));
    doc.addEventListener("keydown", onKeydown, signalOptions);
    ensureImage();
    draw();

    return {
      getProject: () => clone(project),
      render: draw,
      destroy() {
        stopPlayback(false);
        runtime.clearTimeout(saveTimer);
        if (abortController) abortController.abort();
        root.innerHTML = "";
      }
    };
  }

  function mount(root, options) {
    if (!root || typeof root.querySelector !== "function") return null;
    if (mounted.has(root)) return mounted.get(root);
    const controller = createController(root, options || {});
    mounted.set(root, controller);
    root.__hhGraphicMockupController = controller;
    return controller;
  }

  function unmount(root) {
    const controller = mounted.get(root) || root && root.__hhGraphicMockupController;
    if (!controller) return false;
    controller.destroy();
    mounted.delete(root);
    if (root) delete root.__hhGraphicMockupController;
    return true;
  }

  return {
    mount,
    unmount,
    createDefaultProject,
    normalizeProject,
    normalizeTransform,
    createKeyframe,
    interpolateTransform,
    transformAt,
    renderCanvas,
    serializeProject,
    STORAGE_KEY,
    DEVICE_PRESETS,
    SCENE_PRESETS,
    EASINGS
  };
});
