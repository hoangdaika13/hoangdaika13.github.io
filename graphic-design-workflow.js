(function (globalScope) {
  "use strict";

  const VERSION = 1;
  const INTEGRATION_VERSION = 6;
  const FORMAT = "hh-graphic-design-workflow";
  const STORAGE_KEY = "hh.graphic-design.workflow.v1";
  const MAX_HISTORY = 12;
  const STYLE_ID = "hh-graphic-design-workflow-style-v1";
  const STEPS = Object.freeze([
    { id: "design", label: "Design", description: "Vector canvas" },
    { id: "system", label: "System", description: "Component & variant" },
    { id: "qa", label: "QA", description: "Brand & contrast" },
    { id: "review", label: "Review", description: "Realtime collaboration" },
    { id: "deliver", label: "Deliver", description: "Handoff & export" }
  ]);
  const DEPENDENCIES = Object.freeze({
    vector: Object.freeze({ api: "HHGraphicVectorCore", source: "graphic-design-vector-core.js?v=2" }),
    components: Object.freeze({ api: "HHGraphicComponents", source: "graphic-design-components.js?v=2" }),
    collaboration: Object.freeze({ api: "HHGraphicCollaboration", source: "graphic-design-collaboration.js?v=2" })
  });
  const mounted = typeof WeakMap === "function" ? new WeakMap() : new Map();
  const dependencyLoads = new Map();

  function clone(value) {
    if (value === undefined) return undefined;
    if (typeof globalScope.structuredClone === "function") {
      try { return globalScope.structuredClone(value); } catch (_) { /* JSON fallback */ }
    }
    return JSON.parse(JSON.stringify(value));
  }

  function cleanText(value, maxLength) {
    return String(value == null ? "" : value)
      .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "")
      .trim()
      .slice(0, maxLength || 500);
  }

  function escapeHtml(value) {
    return cleanText(value, 10000)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function safeId(value, fallback) {
    const id = cleanText(value, 120).replace(/[^a-z0-9_-]+/gi, "-").replace(/^-+|-+$/g, "");
    return id || fallback || "item";
  }

  function safeColor(value, fallback) {
    const color = cleanText(value, 32);
    return /^#[0-9a-f]{6}$/i.test(color) ? color.toUpperCase() : fallback;
  }

  function safeFont(value, fallback) {
    const font = cleanText(value, 80).replace(/[;{}<>"'\\]/g, "");
    return font || fallback || "Inter";
  }

  function uid(prefix) {
    if (globalScope.crypto?.randomUUID) return `${prefix}-${globalScope.crypto.randomUUID()}`;
    return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  }

  function createDefaultBrand() {
    return {
      name: "HH Neon System",
      primary: "#FF5FC8",
      secondary: "#63E8FF",
      accent: "#C9F26F",
      background: "#071018",
      surface: "#101925",
      text: "#F3F8FC",
      heading: "Inter",
      body: "Inter"
    };
  }

  function normalizeBrand(input) {
    const fallback = createDefaultBrand();
    const source = input && typeof input === "object" ? input : {};
    return {
      name: cleanText(source.name, 80) || fallback.name,
      primary: safeColor(source.primary, fallback.primary),
      secondary: safeColor(source.secondary, fallback.secondary),
      accent: safeColor(source.accent, fallback.accent),
      background: safeColor(source.background, fallback.background),
      surface: safeColor(source.surface, fallback.surface),
      text: safeColor(source.text, fallback.text),
      heading: safeFont(source.heading, fallback.heading),
      body: safeFont(source.body, fallback.body)
    };
  }

  function createDefaultState() {
    return {
      format: FORMAT,
      version: VERSION,
      activeStep: "design",
      projectName: "HH Integrated Design",
      brand: createDefaultBrand(),
      history: [],
      updatedAt: new Date().toISOString()
    };
  }

  function normalizeSnapshot(input, index) {
    const source = input && typeof input === "object" ? input : {};
    return {
      id: safeId(source.id, `snapshot-${index + 1}`),
      label: cleanText(source.label, 100) || `Phiên bản ${index + 1}`,
      createdAt: /^\d{4}-\d{2}-\d{2}T/.test(String(source.createdAt || "")) ? String(source.createdAt) : new Date().toISOString(),
      brand: normalizeBrand(source.brand),
      vector: source.vector && typeof source.vector === "object" ? clone(source.vector) : null,
      components: source.components && typeof source.components === "object" ? clone(source.components) : null
    };
  }

  function normalizeState(input) {
    const fallback = createDefaultState();
    const source = input && typeof input === "object" ? input : {};
    return {
      format: FORMAT,
      version: VERSION,
      activeStep: STEPS.some((step) => step.id === source.activeStep) ? source.activeStep : fallback.activeStep,
      projectName: cleanText(source.projectName, 120) || fallback.projectName,
      brand: normalizeBrand(source.brand),
      history: (Array.isArray(source.history) ? source.history : []).slice(0, MAX_HISTORY).map(normalizeSnapshot),
      updatedAt: /^\d{4}-\d{2}-\d{2}T/.test(String(source.updatedAt || "")) ? String(source.updatedAt) : fallback.updatedAt
    };
  }

  function createStorageDriver(storage) {
    const valid = storage && typeof storage.getItem === "function" && typeof storage.setItem === "function";
    return {
      supported: Boolean(valid),
      load() {
        if (!valid) return { ok: false, reason: "unsupported", state: createDefaultState() };
        try {
          const parsed = JSON.parse(storage.getItem(STORAGE_KEY) || "null");
          if (!parsed) return { ok: true, reason: "empty", state: createDefaultState() };
          if (parsed.format !== FORMAT || parsed.version !== VERSION) return { ok: false, reason: "version", state: createDefaultState() };
          return { ok: true, reason: null, state: normalizeState(parsed) };
        } catch (_) {
          return { ok: false, reason: "invalid", state: createDefaultState() };
        }
      },
      save(state) {
        if (!valid) return { ok: false, reason: "unsupported" };
        try {
          storage.setItem(STORAGE_KEY, JSON.stringify(normalizeState(state)));
          return { ok: true, reason: null };
        } catch (_) {
          return { ok: false, reason: "quota" };
        }
      }
    };
  }

  function hexToRgb(value) {
    const hex = safeColor(value, "#000000").slice(1);
    return {
      r: Number.parseInt(hex.slice(0, 2), 16),
      g: Number.parseInt(hex.slice(2, 4), 16),
      b: Number.parseInt(hex.slice(4, 6), 16)
    };
  }

  function relativeLuminance(value) {
    const rgb = hexToRgb(value);
    const channels = [rgb.r, rgb.g, rgb.b].map((channel) => {
      const normalized = channel / 255;
      return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
    });
    return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
  }

  function contrastRatio(foreground, background) {
    const first = relativeLuminance(foreground);
    const second = relativeLuminance(background);
    return Number(((Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05)).toFixed(2));
  }

  function auditContrast(brandInput) {
    const brand = normalizeBrand(brandInput);
    return [
      ["Text / Background", brand.text, brand.background],
      ["Text / Surface", brand.text, brand.surface],
      ["Primary / Background", brand.primary, brand.background],
      ["Secondary / Background", brand.secondary, brand.background],
      ["Accent / Background", brand.accent, brand.background]
    ].map(([label, foreground, background]) => {
      const ratio = contrastRatio(foreground, background);
      return { label, foreground, background, ratio, aa: ratio >= 4.5, aaLarge: ratio >= 3, aaa: ratio >= 7 };
    });
  }

  function buildBrandCss(brandInput, componentCss) {
    const brand = normalizeBrand(brandInput);
    const css = [
      ":root {",
      `  --hh-brand-primary: ${brand.primary};`,
      `  --hh-brand-secondary: ${brand.secondary};`,
      `  --hh-brand-accent: ${brand.accent};`,
      `  --hh-brand-background: ${brand.background};`,
      `  --hh-brand-surface: ${brand.surface};`,
      `  --hh-brand-text: ${brand.text};`,
      `  --hh-font-heading: "${brand.heading}";`,
      `  --hh-font-body: "${brand.body}";`,
      "}"
    ].join("\n");
    return cleanText(componentCss, 100000) ? `${css}\n\n/* Component tokens */\n${String(componentCss)}` : css;
  }

  function applyCreativeHandoff(stateInput, handoffInput) {
    const parsed = typeof handoffInput === "string" ? JSON.parse(handoffInput) : handoffInput;
    if (!parsed || parsed.schema !== "hh.creative-production-handoff.v1" || Number(parsed.version) !== 1) {
      throw new Error("Creative handoff không đúng schema hh.creative-production-handoff.v1.");
    }
    const state = normalizeState(stateInput);
    const kit = parsed.brandKit && typeof parsed.brandKit === "object" ? parsed.brandKit : {};
    const colors = (Array.isArray(kit.colors) ? kit.colors : []).map((color) => safeColor(color, "")).filter(Boolean).slice(0, 6);
    const fonts = (Array.isArray(kit.fonts) ? kit.fonts : []).map((font) => safeFont(font, "")).filter(Boolean).slice(0, 2);
    const brandName = cleanText(parsed.project?.brief?.brand || parsed.project?.name, 80);
    state.projectName = cleanText(parsed.project?.name, 120) || state.projectName;
    state.activeStep = "qa";
    state.brand = normalizeBrand({
      ...state.brand,
      name: brandName || state.brand.name,
      primary: colors[0] || state.brand.primary,
      secondary: colors[1] || state.brand.secondary,
      accent: colors[2] || state.brand.accent,
      background: colors[3] || state.brand.background,
      surface: colors[4] || state.brand.surface,
      text: colors[5] || state.brand.text,
      heading: fonts[0] || state.brand.heading,
      body: fonts[1] || fonts[0] || state.brand.body
    });
    state.updatedAt = new Date().toISOString();
    const sourceAssets = Array.isArray(parsed.sourceAssets) ? parsed.sourceAssets : [];
    return {
      state,
      provenance: {
        schema: parsed.schema,
        fingerprint: cleanText(parsed.fingerprint, 100),
        readinessScore: Number(parsed.governance?.readiness?.score) || 0,
        sourceAssetCount: sourceAssets.length,
        requiresRelink: sourceAssets.some((asset) => asset?.availability === "metadata-only")
      },
      warnings: [
        ...(colors.length ? [] : ["Brand Kit chưa có màu hợp lệ; giữ token hiện tại."]),
        ...(fonts.length ? [] : ["Brand Kit chưa có font; giữ font hiện tại."]),
        ...(sourceAssets.some((asset) => asset?.availability === "metadata-only") ? ["Cần relink asset gốc trong Media Bin trước khi xuất media."] : [])
      ]
    };
  }

  function captureSnapshot(stateInput, controllers, label) {
    const state = normalizeState(stateInput);
    const snapshot = normalizeSnapshot({
      id: uid("snapshot"),
      label: cleanText(label, 100) || `Snapshot ${new Date().toLocaleTimeString("vi-VN")}`,
      createdAt: new Date().toISOString(),
      brand: state.brand,
      vector: controllers?.vector?.getProject?.() || null,
      components: controllers?.components?.getProject?.() || null
    }, 0);
    state.history = [snapshot, ...state.history.filter((item) => item.id !== snapshot.id)].slice(0, MAX_HISTORY);
    state.updatedAt = snapshot.createdAt;
    return { state, snapshot };
  }

  function restoreSnapshot(stateInput, snapshotId, controllers) {
    const state = normalizeState(stateInput);
    const snapshot = state.history.find((item) => item.id === snapshotId);
    if (!snapshot) return { ok: false, state, reason: "missing" };
    if (snapshot.vector && controllers?.vector?.setProject) controllers.vector.setProject(snapshot.vector);
    if (snapshot.components && controllers?.components?.setProject) controllers.components.setProject(snapshot.components);
    state.brand = normalizeBrand(snapshot.brand);
    state.updatedAt = new Date().toISOString();
    return { ok: true, state, snapshot: clone(snapshot) };
  }

  function buildHandoff(stateInput, controllers, apis) {
    const state = normalizeState(stateInput);
    const vector = controllers?.vector?.getProject?.() || null;
    const components = controllers?.components?.getProject?.() || null;
    let componentHandoff = null;
    if (components && apis?.components?.exportDevMode) {
      const componentId = components.library?.components?.[0]?.id;
      if (componentId) componentHandoff = apis.components.exportDevMode(components, componentId, { theme: "dark", size: "md", state: "default", language: "vi" });
    }
    return {
      format: "hh-design-dev-handoff",
      version: VERSION,
      generatedAt: new Date().toISOString(),
      project: { name: state.projectName, workflowFormat: FORMAT, workflowVersion: VERSION },
      brand: clone(state.brand),
      contrast: auditContrast(state.brand),
      vector: vector ? {
        format: vector.format,
        version: vector.version,
        stage: clone(vector.stage),
        layers: Array.isArray(vector.layers) ? vector.layers.map((layer) => ({ id: layer.id, name: layer.name, type: layer.type })) : []
      } : null,
      components: componentHandoff,
      outputs: {
        svg: Boolean(controllers?.vector?.exportAnimatedSvg),
        lottie: Boolean(controllers?.vector?.exportLottie),
        css: Boolean(components && apis?.components?.exportCssVariables)
      }
    };
  }

  function serializePackage(stateInput, controllers) {
    const state = normalizeState(stateInput);
    return JSON.stringify({
      format: FORMAT,
      version: VERSION,
      exportedAt: new Date().toISOString(),
      workflow: state,
      vector: controllers?.vector?.getProject?.() || null,
      components: controllers?.components?.getProject?.() || null
    }, null, 2);
  }

  function parsePackage(text) {
    const parsed = JSON.parse(String(text || "{}"));
    if (parsed.format !== FORMAT || parsed.version !== VERSION || !parsed.workflow) throw new Error("Tệp không đúng định dạng HH Graphic Design Workflow v1.");
    return {
      state: normalizeState(parsed.workflow),
      vector: parsed.vector && typeof parsed.vector === "object" ? clone(parsed.vector) : null,
      components: parsed.components && typeof parsed.components === "object" ? clone(parsed.components) : null
    };
  }

  function injectStyles(documentObject) {
    if (!documentObject || documentObject.getElementById(STYLE_ID)) return;
    const style = documentObject.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      .gdw{--gdw-bg:#070c13;--gdw-panel:#0e1722;--gdw-panel2:#111e2c;--gdw-line:#2a3b4d;--gdw-text:#edf7ff;--gdw-muted:#94a8b9;--gdw-cyan:#63e8ff;--gdw-pink:#ff5fc8;--gdw-lime:#c9f26f;min-width:0;color:var(--gdw-text);background:var(--gdw-bg);border:1px solid var(--gdw-line);border-radius:10px;overflow:hidden;font:500 12px/1.5 Inter,system-ui,sans-serif}
      .gdw *{box-sizing:border-box}.gdw button,.gdw input,.gdw select{font:inherit}.gdw button{min-height:34px;padding:7px 11px;border:1px solid var(--gdw-line);border-radius:7px;background:#132130;color:var(--gdw-text);cursor:pointer}.gdw button:hover{border-color:var(--gdw-cyan)}.gdw button:disabled{cursor:not-allowed;opacity:.45}.gdw button:focus-visible,.gdw input:focus-visible,.gdw select:focus-visible,.gdw [tabindex]:focus-visible{outline:2px solid var(--gdw-lime);outline-offset:2px}.gdw-primary{background:linear-gradient(135deg,var(--gdw-cyan),#91e8c0)!important;border-color:transparent!important;color:#061018!important;font-weight:850}.gdw-danger{border-color:#a94b6c!important;color:#ffc0d5!important}
      .gdw-header{display:flex;align-items:center;gap:12px;min-width:0;padding:12px 14px;border-bottom:1px solid var(--gdw-line);background:#0b131d}.gdw-logo{display:grid;place-items:center;width:40px;height:40px;flex:0 0 auto;border:1px solid var(--gdw-pink);border-radius:8px;color:var(--gdw-pink);font-weight:900}.gdw-title{min-width:0;margin-right:auto}.gdw-title strong,.gdw-title small{display:block}.gdw-title strong{font-size:16px}.gdw-title small{color:var(--gdw-muted)}.gdw-project-name{width:min(280px,28vw);min-height:36px;padding:7px 9px;border:1px solid var(--gdw-line);border-radius:7px;background:#080f17;color:var(--gdw-text)}.gdw-header-actions{display:flex;gap:6px;flex-wrap:wrap}
      .gdw-steps{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));border-bottom:1px solid var(--gdw-line);background:#09111a}.gdw-step{position:relative;display:grid;grid-template-columns:28px minmax(0,1fr);align-items:center;gap:8px;min-width:0;padding:10px 12px;border:0!important;border-right:1px solid var(--gdw-line)!important;border-radius:0!important;background:transparent!important;text-align:left}.gdw-step:last-child{border-right:0!important}.gdw-step b{display:grid;place-items:center;width:25px;height:25px;border:1px solid #40566b;border-radius:50%;color:var(--gdw-muted)}.gdw-step span,.gdw-step small{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.gdw-step small{color:var(--gdw-muted);font-size:9px}.gdw-step[aria-selected=true]{background:linear-gradient(180deg,rgba(99,232,255,.12),transparent)!important;color:#fff}.gdw-step[aria-selected=true] b{border-color:var(--gdw-cyan);background:var(--gdw-cyan);color:#071018}.gdw-step[aria-selected=true]::after{content:"";position:absolute;right:0;bottom:0;left:0;height:2px;background:linear-gradient(90deg,var(--gdw-cyan),var(--gdw-pink))}
      .gdw-progress{height:3px;background:#142333}.gdw-progress i{display:block;height:100%;background:linear-gradient(90deg,var(--gdw-cyan),var(--gdw-pink));transition:width .2s ease}.gdw-notice{display:flex;align-items:center;gap:8px;padding:8px 13px;border-bottom:1px solid var(--gdw-line);color:var(--gdw-muted);background:#0c151f}.gdw-notice i{width:8px;height:8px;border-radius:50%;background:var(--gdw-lime);box-shadow:0 0 12px var(--gdw-lime)}.gdw-notice.is-error i{background:#ff6b91;box-shadow:none}.gdw-notice span:last-child{margin-left:auto}
      .gdw-panel{display:none;min-width:0;padding:12px}.gdw-panel.is-active{display:block}.gdw-engine{min-width:0}.gdw-loading{display:grid;place-items:center;min-height:360px;padding:28px;border:1px dashed var(--gdw-line);border-radius:8px;color:var(--gdw-muted);text-align:center}.gdw-loading strong{display:block;color:var(--gdw-text);font-size:15px}.gdw-engine-error{padding:16px;border:1px solid #8b3c5b;border-radius:8px;background:#2b1420;color:#ffd8e5}
      .gdw-qa-layout,.gdw-deliver-layout{display:grid;grid-template-columns:minmax(260px,.8fr) minmax(0,1.2fr);gap:12px}.gdw-card{min-width:0;padding:13px;border:1px solid var(--gdw-line);border-radius:9px;background:var(--gdw-panel)}.gdw-card h2,.gdw-card h3{margin:0 0 4px}.gdw-card>p{margin:0 0 12px;color:var(--gdw-muted)}.gdw-card-head{display:flex;align-items:center;gap:8px;margin-bottom:10px}.gdw-card-head span{margin-left:auto;color:var(--gdw-muted)}.gdw-brand-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}.gdw-field{display:grid;gap:4px;color:#c0cfda}.gdw-field input,.gdw-field select{width:100%;min-height:36px;padding:7px 8px;border:1px solid var(--gdw-line);border-radius:6px;background:#080f17;color:var(--gdw-text)}.gdw-field input[type=color]{height:38px;padding:3px}.gdw-field--wide{grid-column:1/-1}.gdw-brand-preview{display:grid;place-items:center;min-height:150px;margin-top:10px;padding:18px;border:1px solid var(--gdw-line);border-radius:8px;background:var(--brand-bg);color:var(--brand-text);font-family:var(--brand-body)}.gdw-brand-preview div{padding:14px 18px;border:1px solid var(--brand-secondary);border-radius:10px;background:var(--brand-surface);text-align:center}.gdw-brand-preview strong{display:block;color:var(--brand-primary);font:800 22px/1.15 var(--brand-heading)}.gdw-brand-preview span{color:var(--brand-text)}.gdw-brand-preview em{display:inline-block;margin-top:9px;padding:6px 9px;border-radius:6px;background:var(--brand-accent);color:var(--brand-bg);font-style:normal;font-weight:800}
      .gdw-contrast-list{display:grid;gap:7px}.gdw-contrast{display:grid;grid-template-columns:38px minmax(0,1fr) auto;align-items:center;gap:9px;padding:8px;border:1px solid var(--gdw-line);border-radius:7px;background:#0b141e}.gdw-swatch{width:38px;height:30px;border:1px solid #526679;border-radius:5px}.gdw-contrast strong,.gdw-contrast small{display:block}.gdw-contrast small{color:var(--gdw-muted)}.gdw-ratio{padding:4px 7px;border:1px solid #8f4964;border-radius:999px;color:#ffb3cc;font-weight:800}.gdw-ratio.is-pass{border-color:#4d7657;color:#b9f5c5}.gdw-audit-note{margin-top:10px;padding:9px;border-left:3px solid var(--gdw-cyan);background:#0a131c;color:var(--gdw-muted)}
      .gdw-review-intro{display:flex;align-items:center;gap:10px;margin-bottom:10px;padding:11px;border:1px solid var(--gdw-line);border-radius:8px;background:var(--gdw-panel)}.gdw-review-intro div{margin-right:auto}.gdw-review-intro strong,.gdw-review-intro small{display:block}.gdw-review-intro small{color:var(--gdw-muted)}
      .gdw-export-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.gdw-export{display:grid;grid-template-columns:36px minmax(0,1fr);align-items:center;gap:9px;min-height:70px!important;text-align:left}.gdw-export b,.gdw-export small{display:block}.gdw-export b:first-child{display:grid;place-items:center;width:34px;height:34px;border-radius:7px;background:#203448;color:var(--gdw-cyan)}.gdw-export small{color:var(--gdw-muted)}.gdw-history{display:grid;gap:7px;max-height:440px;overflow:auto}.gdw-history-item{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:8px;padding:9px;border:1px solid var(--gdw-line);border-radius:7px;background:#0b141e}.gdw-history-item strong,.gdw-history-item small{display:block}.gdw-history-item small{color:var(--gdw-muted)}.gdw-empty{padding:26px 12px;border:1px dashed var(--gdw-line);border-radius:7px;color:var(--gdw-muted);text-align:center}.gdw-capabilities{display:flex;gap:6px;flex-wrap:wrap;margin-top:11px}.gdw-capabilities span{padding:4px 7px;border:1px solid var(--gdw-line);border-radius:999px;color:var(--gdw-muted)}.gdw-capabilities .is-ready{border-color:#4b7256;color:#baf1c4}.gdw-hidden{display:none!important}.gdw-sr{position:absolute!important;width:1px!important;height:1px!important;padding:0!important;margin:-1px!important;overflow:hidden!important;clip:rect(0,0,0,0)!important;white-space:nowrap!important;border:0!important}
      @media(max-width:980px){.gdw-header{align-items:flex-start;flex-wrap:wrap}.gdw-project-name{width:min(100%,320px)}.gdw-header-actions{margin-left:auto}.gdw-step{grid-template-columns:24px minmax(0,1fr);padding:9px 7px}.gdw-step small{display:none}.gdw-qa-layout,.gdw-deliver-layout{grid-template-columns:1fr}}
      @media(max-width:520px){.gdw{border-right:0;border-left:0;border-radius:0}.gdw-header{padding:10px}.gdw-logo{width:34px;height:34px}.gdw-title{width:calc(100% - 48px);margin:0}.gdw-title small{white-space:normal}.gdw-project-name{order:3;width:100%;max-width:none}.gdw-header-actions{order:4;width:100%;display:grid;grid-template-columns:1fr 1fr}.gdw-steps{grid-template-columns:repeat(5,1fr)}.gdw-step{display:grid;grid-template-columns:1fr;justify-items:center;padding:8px 2px;text-align:center}.gdw-step div{min-width:0;width:100%}.gdw-step span{font-size:9px}.gdw-panel{padding:7px}.gdw-notice{align-items:flex-start;flex-wrap:wrap;padding:7px 9px}.gdw-notice span:last-child{width:100%;margin:0}.gdw-brand-grid{grid-template-columns:1fr 1fr}.gdw-export-grid{grid-template-columns:1fr}.gdw-review-intro{align-items:flex-start;flex-direction:column}.gdw-review-intro button{width:100%}.gdw-contrast{grid-template-columns:32px minmax(0,1fr) auto}.gdw-swatch{width:32px}.gdw-card{padding:10px}.gdw-engine{max-width:100%;overflow-x:auto}}
      @media(prefers-reduced-motion:reduce){.gdw *,.gdw *::before,.gdw *::after{scroll-behavior:auto!important;animation-duration:.01ms!important;animation-iteration-count:1!important;transition-duration:.01ms!important}}
    `;
    documentObject.head.appendChild(style);
  }

  function loadDependency(config, documentObject) {
    if (globalScope[config.api]) return Promise.resolve(globalScope[config.api]);
    if (!documentObject?.head) return Promise.reject(new Error(`Không thể tải ${config.api} ngoài trình duyệt.`));
    if (dependencyLoads.has(config.source)) return dependencyLoads.get(config.source);
    const pending = new Promise((resolve, reject) => {
      const existing = [...documentObject.scripts].find((script) => script.src?.includes(config.source.split("?")[0]));
      const script = existing || documentObject.createElement("script");
      const finish = () => globalScope[config.api]
        ? resolve(globalScope[config.api])
        : reject(new Error(`${config.api} đã tải nhưng không cung cấp API.`));
      if (existing) {
        if (globalScope[config.api]) finish();
        else {
          existing.addEventListener("load", finish, { once: true });
          existing.addEventListener("error", () => reject(new Error(`Không tải được ${config.source}.`)), { once: true });
        }
        return;
      }
      script.src = config.source;
      script.async = true;
      script.dataset.gdwDependency = config.api;
      script.addEventListener("load", finish, { once: true });
      script.addEventListener("error", () => reject(new Error(`Không tải được ${config.source}.`)), { once: true });
      documentObject.head.appendChild(script);
    }).catch((error) => {
      dependencyLoads.delete(config.source);
      throw error;
    });
    dependencyLoads.set(config.source, pending);
    return pending;
  }

  function downloadBlob(blob, filename, documentObject) {
    if (!blob || !globalScope.URL?.createObjectURL || !documentObject?.createElement) return false;
    const url = globalScope.URL.createObjectURL(blob);
    const anchor = documentObject.createElement("a");
    anchor.href = url;
    anchor.download = safeId(String(filename || "download").replace(/\.[^.]+$/, ""), "download") + (String(filename || "").match(/\.[a-z0-9.]+$/i)?.[0] || "");
    anchor.click();
    globalScope.setTimeout(() => globalScope.URL.revokeObjectURL(url), 800);
    return true;
  }

  function downloadText(text, filename, type, documentObject) {
    if (typeof Blob !== "function") return false;
    return downloadBlob(new Blob([String(text)], { type: type || "text/plain;charset=utf-8" }), filename, documentObject);
  }

  function workflowMarkup(state, storageSupported) {
    return `
      <header class="gdw-header">
        <span class="gdw-logo" aria-hidden="true">WF</span>
        <div class="gdw-title"><strong>Integrated Design Workflow</strong><small>Vector → System → QA → Review → Deliver · local-first</small></div>
        <label class="gdw-sr" for="gdw-project-name">Tên dự án</label>
        <input id="gdw-project-name" class="gdw-project-name" data-gdw-project-name maxlength="120" value="${escapeHtml(state.projectName)}">
        <div class="gdw-header-actions">
          <button type="button" data-gdw-action="snapshot" title="Ctrl+S">Tạo phiên bản</button>
          <button type="button" class="gdw-primary" data-gdw-step="deliver">Bàn giao →</button>
        </div>
        <input class="gdw-hidden" type="file" accept="application/json,.json,.hhdesign" data-gdw-import aria-label="Nhập gói workflow">
      </header>
      <nav class="gdw-steps" role="tablist" aria-label="Quy trình thiết kế tích hợp">
        ${STEPS.map((step, index) => `<button type="button" class="gdw-step" role="tab" id="gdw-tab-${step.id}" aria-controls="gdw-panel-${step.id}" aria-selected="${step.id === state.activeStep}" tabindex="${step.id === state.activeStep ? "0" : "-1"}" data-gdw-step="${step.id}"><b>${index + 1}</b><div><span>${step.label}</span><small>${step.description}</small></div></button>`).join("")}
      </nav>
      <div class="gdw-progress" aria-hidden="true"><i data-gdw-progress></i></div>
      <div class="gdw-notice" role="status" aria-live="polite" data-gdw-status><i></i><span>${storageSupported ? "Tự lưu trên thiết bị đã sẵn sàng." : "LocalStorage không khả dụng; hãy xuất gói để giữ bản sao."}</span><span>Workflow v${VERSION} · integration ${INTEGRATION_VERSION}</span></div>
      <section class="gdw-panel" role="tabpanel" id="gdw-panel-design" aria-labelledby="gdw-tab-design" data-gdw-panel="design">
        <div class="gdw-engine" data-gdw-vector><div class="gdw-loading"><div><strong>Đang mở Vector Core…</strong><span>Bezier, layer, timeline và SVG thật.</span></div></div></div>
      </section>
      <section class="gdw-panel" role="tabpanel" id="gdw-panel-system" aria-labelledby="gdw-tab-system" data-gdw-panel="system">
        <div class="gdw-engine" data-gdw-components><div class="gdw-loading"><div><strong>Đang mở Component System…</strong><span>Master, instance, variant, token và auto-layout.</span></div></div></div>
      </section>
      <section class="gdw-panel" role="tabpanel" id="gdw-panel-qa" aria-labelledby="gdw-tab-qa" data-gdw-panel="qa">
        <div class="gdw-qa-layout">
          <section class="gdw-card"><div class="gdw-card-head"><div><h2>Brand Kit</h2><p>Một nguồn token cho canvas và component.</p></div><button type="button" class="gdw-primary" data-gdw-action="apply-brand">Áp dụng</button></div><div class="gdw-brand-grid" data-gdw-brand-fields></div><div class="gdw-brand-preview" data-gdw-brand-preview><div><strong data-gdw-brand-title></strong><span>Design once. Scale everywhere.</span><em>Primary action</em></div></div></section>
          <section class="gdw-card"><div class="gdw-card-head"><div><h2>Contrast audit</h2><p>WCAG 2.x cho text thường và text lớn.</p></div><span data-gdw-audit-total></span></div><div class="gdw-contrast-list" data-gdw-contrast></div><div class="gdw-audit-note">AA text thường cần 4.5:1; text lớn cần 3:1. Kiểm tra được tính hoàn toàn trên thiết bị.</div></section>
        </div>
      </section>
      <section class="gdw-panel" role="tabpanel" id="gdw-panel-review" aria-labelledby="gdw-tab-review" data-gdw-panel="review">
        <div class="gdw-review-intro"><div><strong>Cộng tác chỉ bật với Socket.IO thật</strong><small>Không tạo presence giả. Nếu WebSocket chưa được máy chủ xác nhận, cursor và realtime sẽ được báo là không khả dụng.</small></div><button type="button" class="gdw-primary" data-gdw-action="start-collaboration">Mở phòng realtime</button></div>
        <div class="gdw-engine" data-gdw-collaboration><div class="gdw-loading"><div><strong>Chưa kết nối cộng tác</strong><span>Nhấn “Mở phòng realtime” để tải client và chọn tạo/tham gia phòng.</span></div></div></div>
      </section>
      <section class="gdw-panel" role="tabpanel" id="gdw-panel-deliver" aria-labelledby="gdw-tab-deliver" data-gdw-panel="deliver">
        <div class="gdw-deliver-layout">
          <section class="gdw-card"><div class="gdw-card-head"><div><h2>Design → Dev</h2><p>Xuất trực tiếp từ controller đang chạy.</p></div></div><div class="gdw-export-grid">
            <button type="button" class="gdw-export" data-gdw-export="svg"><b>SVG</b><span><b>Animated SVG</b><small>Vector + SMIL, có reduced-motion</small></span></button>
            <button type="button" class="gdw-export" data-gdw-export="lottie"><b>LO</b><span><b>Lottie JSON</b><small>Subset tương thích có capability notes</small></span></button>
            <button type="button" class="gdw-export" data-gdw-export="css"><b>CSS</b><span><b>Design tokens</b><small>Brand + component variables</small></span></button>
            <button type="button" class="gdw-export" data-gdw-export="handoff"><b>DEV</b><span><b>Handoff JSON</b><small>Inspect, token, contrast và layer map</small></span></button>
            <button type="button" class="gdw-export" data-gdw-export="package"><b>HH</b><span><b>Workflow package</b><small>State + vector + component project</small></span></button>
            <button type="button" class="gdw-export" data-gdw-action="import"><b>↥</b><span><b>Nhập package</b><small>Khôi phục dữ liệu đã xuất local</small></span></button>
          </div><div class="gdw-capabilities" data-gdw-capabilities></div></section>
          <section class="gdw-card"><div class="gdw-card-head"><div><h2>Lịch sử phiên bản</h2><p>Snapshot bất biến, tối đa ${MAX_HISTORY} bản trên thiết bị.</p></div><button type="button" data-gdw-action="snapshot">＋ Snapshot</button></div><div class="gdw-history" data-gdw-history></div></section>
        </div>
      </section>`;
  }

  function brandFieldsMarkup(brand) {
    const colorFields = [
      ["primary", "Primary"], ["secondary", "Secondary"], ["accent", "Accent"],
      ["background", "Background"], ["surface", "Surface"], ["text", "Text"]
    ];
    return `<label class="gdw-field gdw-field--wide">Tên Brand Kit<input data-gdw-brand="name" maxlength="80" value="${escapeHtml(brand.name)}"></label>
      ${colorFields.map(([key, label]) => `<label class="gdw-field">${label}<input type="color" data-gdw-brand="${key}" value="${escapeHtml(brand[key])}"></label>`).join("")}
      <label class="gdw-field">Heading<input data-gdw-brand="heading" maxlength="80" value="${escapeHtml(brand.heading)}"></label>
      <label class="gdw-field">Body<input data-gdw-brand="body" maxlength="80" value="${escapeHtml(brand.body)}"></label>`;
  }

  function historyMarkup(history) {
    if (!history.length) return `<div class="gdw-empty">Chưa có snapshot. Nhấn Ctrl+S để lưu phiên bản đầu tiên.</div>`;
    return history.map((snapshot) => `<article class="gdw-history-item"><div><strong>${escapeHtml(snapshot.label)}</strong><small>${escapeHtml(new Date(snapshot.createdAt).toLocaleString("vi-VN"))} · ${snapshot.vector ? "Vector" : "No vector"} · ${snapshot.components ? "Components" : "No components"}</small></div><button type="button" data-gdw-restore="${escapeHtml(snapshot.id)}">Khôi phục</button></article>`).join("");
  }

  function renderBrand(root, state) {
    const fields = root.querySelector("[data-gdw-brand-fields]");
    if (fields && !fields.children.length) fields.innerHTML = brandFieldsMarkup(state.brand);
    const preview = root.querySelector("[data-gdw-brand-preview]");
    if (preview) {
      preview.style.setProperty("--brand-primary", state.brand.primary);
      preview.style.setProperty("--brand-secondary", state.brand.secondary);
      preview.style.setProperty("--brand-accent", state.brand.accent);
      preview.style.setProperty("--brand-bg", state.brand.background);
      preview.style.setProperty("--brand-surface", state.brand.surface);
      preview.style.setProperty("--brand-text", state.brand.text);
      preview.style.setProperty("--brand-heading", state.brand.heading);
      preview.style.setProperty("--brand-body", state.brand.body);
    }
    const title = root.querySelector("[data-gdw-brand-title]");
    if (title) title.textContent = state.brand.name;
    const reports = auditContrast(state.brand);
    const list = root.querySelector("[data-gdw-contrast]");
    if (list) list.innerHTML = reports.map((report) => `<article class="gdw-contrast"><span class="gdw-swatch" style="background:linear-gradient(135deg,${report.foreground} 0 50%,${report.background} 50%)" aria-label="${escapeHtml(report.foreground)} trên ${escapeHtml(report.background)}"></span><div><strong>${escapeHtml(report.label)}</strong><small>${escapeHtml(report.foreground)} / ${escapeHtml(report.background)} · ${report.aaa ? "AAA" : report.aa ? "AA" : report.aaLarge ? "AA Large" : "Không đạt"}</small></div><span class="gdw-ratio ${report.aa ? "is-pass" : ""}">${report.ratio}:1</span></article>`).join("");
    const total = root.querySelector("[data-gdw-audit-total]");
    if (total) total.textContent = `${reports.filter((report) => report.aa).length}/${reports.length} đạt AA`;
  }

  function renderHistory(root, state) {
    const target = root.querySelector("[data-gdw-history]");
    if (target) target.innerHTML = historyMarkup(state.history);
  }

  function mount(root, options) {
    if (!root || typeof root.querySelector !== "function") return null;
    if (mounted.has(root)) return mounted.get(root).controller;
    const runtimeOptions = options && typeof options === "object" ? options : {};
    const documentObject = root.ownerDocument || globalScope.document;
    injectStyles(documentObject);
    let storage = runtimeOptions.storage;
    if (storage === undefined) {
      try { storage = globalScope.localStorage || null; } catch (_) { storage = null; }
    }
    const storageDriver = createStorageDriver(storage);
    const loaded = storageDriver.load();
    let state = loaded.state;
    const controllers = { vector: null, components: null, collaboration: null };
    const apis = { vector: null, components: null, collaboration: null };
    let destroyed = false;
    let collaborationRequested = false;
    let statusTimer = 0;

    root.classList.add("gdw");
    root.setAttribute("data-graphic-design-workflow", "");
    root.setAttribute("aria-label", "Quy trình thiết kế đồ họa tích hợp");
    root.innerHTML = workflowMarkup(state, storageDriver.supported);

    function announce(message, error) {
      const status = root.querySelector("[data-gdw-status]");
      if (!status) return;
      const parts = status.querySelectorAll("span");
      if (parts[0]) parts[0].textContent = cleanText(message, 500);
      status.classList.toggle("is-error", Boolean(error));
      globalScope.clearTimeout(statusTimer);
      statusTimer = globalScope.setTimeout(() => status.classList.remove("is-error"), 4200);
    }

    function persist() {
      state.updatedAt = new Date().toISOString();
      const result = storageDriver.save(state);
      if (!result.ok && result.reason === "quota") announce("Bộ nhớ thiết bị đã đầy. Hãy xuất Workflow package để giữ bản sao.", true);
      return result;
    }

    function applyStep(stepId, focusTab) {
      const next = STEPS.some((step) => step.id === stepId) ? stepId : "design";
      state.activeStep = next;
      root.querySelectorAll("[data-gdw-step]").forEach((button) => {
        if (!button.matches('[role="tab"]')) return;
        const active = button.dataset.gdwStep === next;
        button.setAttribute("aria-selected", String(active));
        button.tabIndex = active ? 0 : -1;
        if (active && focusTab) button.focus();
      });
      root.querySelectorAll("[data-gdw-panel]").forEach((panel) => {
        const active = panel.dataset.gdwPanel === next;
        panel.classList.toggle("is-active", active);
        panel.hidden = !active;
      });
      const index = Math.max(0, STEPS.findIndex((step) => step.id === next));
      const progress = root.querySelector("[data-gdw-progress]");
      if (progress) progress.style.width = `${((index + 1) / STEPS.length) * 100}%`;
      persist();
      if (next === "review" && collaborationRequested) void ensureCollaboration();
      if (next === "deliver") { renderHistory(root, state); renderCapabilities(); }
    }

    function renderCapabilities() {
      const target = root.querySelector("[data-gdw-capabilities]");
      if (!target) return;
      const capabilities = [
        ["SVG", Boolean(controllers.vector?.exportAnimatedSvg)],
        ["Lottie", Boolean(controllers.vector?.exportLottie)],
        ["CSS", Boolean(controllers.components && apis.components?.exportCssVariables)],
        ["Handoff", Boolean(controllers.vector && controllers.components)],
        ["Realtime", Boolean(controllers.collaboration?.getState?.().serverConfirmed)]
      ];
      target.innerHTML = capabilities.map(([label, ready]) => `<span class="${ready ? "is-ready" : ""}">${escapeHtml(label)} · ${ready ? "sẵn sàng" : "chưa mở"}</span>`).join("");
    }

    function snapshot(label) {
      const captured = captureSnapshot(state, controllers, label);
      state = captured.state;
      const saved = persist();
      renderHistory(root, state);
      announce(saved.ok
        ? `Đã tạo ${captured.snapshot.label} trên thiết bị.`
        : `Đã tạo ${captured.snapshot.label} trong phiên, nhưng chưa thể lưu trên thiết bị. Hãy xuất package.`, !saved.ok);
      return captured.snapshot;
    }

    function applyBrandToProjects() {
      snapshot(`Trước khi áp dụng Brand Kit ${state.brand.name}`);
      let applied = 0;
      if (controllers.components && apis.components) {
        let project = controllers.components.getProject();
        const theme = project.activeTheme || "dark";
        const mappings = {
          "color.accent": state.brand.primary,
          "color.surface": state.brand.surface,
          "color.text": state.brand.text,
          "font.body": state.brand.body,
          "font.heading": state.brand.heading
        };
        Object.entries(mappings).forEach(([path, value]) => { project = apis.components.setToken(project, path, value, theme); });
        controllers.components.setProject(project);
        applied += 1;
      }
      if (controllers.vector) {
        const project = controllers.vector.getProject();
        project.stage.background = state.brand.background;
        (project.layers || []).forEach((layer) => {
          if (!layer.style) return;
          if (layer.type === "text") layer.style.fill = state.brand.text;
        });
        const accentLayer = (project.layers || []).find((layer) => layer.style && layer.type !== "text" && layer.type !== "group" && layer.type !== "composition");
        if (accentLayer) accentLayer.style.fill = state.brand.primary;
        controllers.vector.setProject(project);
        applied += 1;
      }
      persist();
      announce(applied
        ? `Đã áp dụng Brand Kit vào ${applied === 2 ? "token component và canvas vector" : controllers.vector ? "canvas vector" : "token component"}.`
        : "Brand Kit đã lưu, nhưng editor chưa sẵn sàng để áp dụng. Hãy thử lại sau khi engine tải xong.", applied === 0);
    }

    async function ensureCoreEngines() {
      const vectorHost = root.querySelector("[data-gdw-vector]");
      const componentHost = root.querySelector("[data-gdw-components]");
      const tasks = [
        loadDependency(DEPENDENCIES.vector, documentObject).then((api) => {
          if (destroyed || !vectorHost?.isConnected) return;
          apis.vector = api;
          controllers.vector = api.mount(vectorHost, runtimeOptions);
          renderCapabilities();
        }).catch((error) => {
          if (vectorHost?.isConnected) vectorHost.innerHTML = `<div class="gdw-engine-error" role="alert"><strong>Vector Core không khả dụng</strong><p>${escapeHtml(error.message)}</p></div>`;
          announce(error.message, true);
        }),
        loadDependency(DEPENDENCIES.components, documentObject).then((api) => {
          if (destroyed || !componentHost?.isConnected) return;
          apis.components = api;
          controllers.components = api.mount(componentHost, { storage: runtimeOptions.componentStorage });
          renderCapabilities();
        }).catch((error) => {
          if (componentHost?.isConnected) componentHost.innerHTML = `<div class="gdw-engine-error" role="alert"><strong>Component System không khả dụng</strong><p>${escapeHtml(error.message)}</p></div>`;
          announce(error.message, true);
        })
      ];
      await Promise.allSettled(tasks);
      if (controllers.vector && controllers.components) announce("Vector Core và Component System đã sẵn sàng; dữ liệu tự lưu cục bộ theo từng engine.");
    }

    async function ensureCollaboration() {
      if (destroyed || controllers.collaboration) return controllers.collaboration;
      collaborationRequested = true;
      const host = root.querySelector("[data-gdw-collaboration]");
      if (host) host.innerHTML = `<div class="gdw-loading"><div><strong>Đang tải kết nối realtime…</strong><span>Chỉ xác nhận cộng tác sau khi transport WebSocket kết nối thật.</span></div></div>`;
      try {
        const api = await loadDependency(DEPENDENCIES.collaboration, documentObject);
        if (destroyed || !host?.isConnected) return null;
        apis.collaboration = api;
        controllers.collaboration = api.mount(host, {
          ...runtimeOptions,
          socketUrl: runtimeOptions.socketUrl || runtimeOptions.apiBase,
          socket: runtimeOptions.socket
        });
        renderCapabilities();
        announce("Đã mở công cụ cộng tác. Hãy tạo hoặc nhập mã phòng; trạng thái WebSocket hiển thị trong phòng.");
        return controllers.collaboration;
      } catch (error) {
        if (host?.isConnected) host.innerHTML = `<div class="gdw-engine-error" role="alert"><strong>Không thể mở cộng tác realtime</strong><p>${escapeHtml(error.message)}</p><p>Thiết kế local vẫn an toàn; không có cộng tác giả được tạo.</p></div>`;
        announce(error.message, true);
        return null;
      }
    }

    function exportArtifact(kind) {
      const base = safeId(state.projectName, "hh-design");
      try {
        if (kind === "svg") {
          if (!controllers.vector?.exportAnimatedSvg) throw new Error("Vector Core chưa sẵn sàng; hãy mở bước Design và thử lại.");
          const svg = controllers.vector.exportAnimatedSvg();
          if (!/^<svg[\s>]/i.test(String(svg || ""))) throw new Error("Vector Core không trả về SVG hợp lệ.");
          downloadText(svg, `${base}.svg`, "image/svg+xml;charset=utf-8", documentObject);
        } else if (kind === "lottie") {
          if (!controllers.vector?.exportLottie) throw new Error("Lottie export chưa sẵn sàng.");
          const lottie = controllers.vector.exportLottie();
          JSON.parse(lottie);
          downloadText(lottie, `${base}.lottie.json`, "application/json", documentObject);
        } else if (kind === "css") {
          if (!controllers.components || !apis.components?.exportCssVariables) throw new Error("Component System chưa sẵn sàng.");
          const componentProject = controllers.components.getProject();
          const componentCss = apis.components.exportCssVariables(componentProject, componentProject.activeTheme || "dark");
          downloadText(buildBrandCss(state.brand, componentCss), `${base}.tokens.css`, "text/css;charset=utf-8", documentObject);
        } else if (kind === "handoff") {
          if (!controllers.vector || !controllers.components) throw new Error("Cần Vector Core và Component System trước khi bàn giao.");
          downloadText(JSON.stringify(buildHandoff(state, controllers, apis), null, 2), `${base}.handoff.json`, "application/json", documentObject);
        } else if (kind === "package") {
          downloadText(serializePackage(state, controllers), `${base}.hhdesign.json`, "application/json", documentObject);
        } else return;
        announce(`Đã xuất ${kind.toUpperCase()} từ dữ liệu đang mở.`);
      } catch (error) {
        announce(error.message || "Không thể xuất tệp.", true);
      }
    }

    async function importFile(file) {
      if (!file || typeof file.text !== "function") return announce("Trình duyệt không hỗ trợ đọc tệp đã chọn.", true);
      try {
        const imported = parsePackage(await file.text());
        snapshot("Trước khi nhập package");
        state = imported.state;
        if (imported.vector && controllers.vector?.setProject) controllers.vector.setProject(imported.vector);
        if (imported.components && controllers.components?.setProject) controllers.components.setProject(imported.components);
        persist();
        const nameInput = root.querySelector("[data-gdw-project-name]");
        if (nameInput) nameInput.value = state.projectName;
        const fields = root.querySelector("[data-gdw-brand-fields]");
        if (fields) fields.replaceChildren();
        renderBrand(root, state);
        renderHistory(root, state);
        applyStep(state.activeStep);
        announce("Đã nhập Workflow package và khôi phục project local.");
      } catch (error) {
        announce(error.message || "Không thể nhập package.", true);
      }
    }

    const onClick = (event) => {
      const stepButton = event.target.closest("[data-gdw-step]");
      if (stepButton) { applyStep(stepButton.dataset.gdwStep); return; }
      const restoreButton = event.target.closest("[data-gdw-restore]");
      if (restoreButton) {
        const targetSnapshot = state.history.find((item) => item.id === restoreButton.dataset.gdwRestore);
        if (!targetSnapshot) return announce("Snapshot không còn tồn tại.", true);
        snapshot("Trước khi khôi phục");
        if (!state.history.some((item) => item.id === targetSnapshot.id)) {
          state.history = [...state.history.slice(0, MAX_HISTORY - 1), targetSnapshot];
        }
        const restored = restoreSnapshot(state, restoreButton.dataset.gdwRestore, controllers);
        if (!restored.ok) return announce("Không thể khôi phục snapshot.", true);
        state = restored.state;
        persist();
        const fields = root.querySelector("[data-gdw-brand-fields]");
        if (fields) fields.replaceChildren();
        renderBrand(root, state); renderHistory(root, state);
        return announce(`Đã khôi phục ${restored.snapshot.label}.`);
      }
      const exportButton = event.target.closest("[data-gdw-export]");
      if (exportButton) { exportArtifact(exportButton.dataset.gdwExport); return; }
      const action = event.target.closest("[data-gdw-action]")?.dataset.gdwAction;
      if (action === "snapshot") snapshot();
      else if (action === "apply-brand") applyBrandToProjects();
      else if (action === "start-collaboration") void ensureCollaboration();
      else if (action === "import") root.querySelector("[data-gdw-import]")?.click();
    };

    const onInput = (event) => {
      const target = event.target;
      if (target.matches("[data-gdw-project-name]")) {
        state.projectName = cleanText(target.value, 120) || "HH Integrated Design";
        persist();
      }
      if (target.matches("[data-gdw-brand]")) {
        const key = target.dataset.gdwBrand;
        state.brand = normalizeBrand({ ...state.brand, [key]: target.value });
        target.value = state.brand[key];
        renderBrand(root, state);
        persist();
      }
    };

    const onChange = (event) => {
      if (event.target.matches("[data-gdw-import]") && event.target.files?.[0]) {
        void importFile(event.target.files[0]);
        event.target.value = "";
      }
    };

    const onKeydown = (event) => {
      const modifier = event.ctrlKey || event.metaKey;
      if (modifier && event.key.toLowerCase() === "s") { event.preventDefault(); snapshot(); return; }
      if (modifier && event.shiftKey && event.key.toLowerCase() === "e") { event.preventDefault(); applyStep("deliver", true); return; }
      const tab = event.target.closest?.('[role="tab"][data-gdw-step]');
      if (tab && ["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) {
        event.preventDefault();
        const current = STEPS.findIndex((step) => step.id === tab.dataset.gdwStep);
        const nextIndex = event.key === "Home" ? 0 : event.key === "End" ? STEPS.length - 1 : (current + (event.key === "ArrowRight" ? 1 : -1) + STEPS.length) % STEPS.length;
        applyStep(STEPS[nextIndex].id, true);
      }
      if (event.altKey && /^[1-5]$/.test(event.key)) { event.preventDefault(); applyStep(STEPS[Number(event.key) - 1].id, true); }
    };

    root.addEventListener("click", onClick);
    root.addEventListener("input", onInput);
    root.addEventListener("change", onChange);
    root.addEventListener("keydown", onKeydown);
    renderBrand(root, state);
    renderHistory(root, state);
    applyStep(state.activeStep);
    void ensureCoreEngines();
    if (!loaded.ok && loaded.reason === "version") announce("Đã bỏ qua state khác version; hãy nhập package v1 nếu cần khôi phục.", true);

    const controller = {
      VERSION,
      getState: () => normalizeState(state),
      getControllers: () => ({ ...controllers }),
      setStep: (stepId) => applyStep(stepId),
      setBrand(next) { state.brand = normalizeBrand({ ...state.brand, ...(next || {}) }); renderBrand(root, state); persist(); return clone(state.brand); },
      createSnapshot: snapshot,
      restoreSnapshot(snapshotId) { const result = restoreSnapshot(state, snapshotId, controllers); if (result.ok) { state = result.state; renderBrand(root, state); renderHistory(root, state); persist(); } return result; },
      buildHandoff: () => buildHandoff(state, controllers, apis),
      applyCreativeHandoff(handoff) { const result = applyCreativeHandoff(state, handoff); state = result.state; renderBrand(root, state); persist(); announce(result.warnings[0] || "Đã áp dụng Brand Kit từ Creative handoff."); return result; },
      serialize: () => serializePackage(state, controllers),
      openCollaboration: ensureCollaboration,
      export(kind) { exportArtifact(kind); },
      unmount() { return unmount(root); }
    };
    mounted.set(root, {
      controller,
      cleanup() {
        destroyed = true;
        globalScope.clearTimeout(statusTimer);
        persist();
        try { apis.vector?.unmount?.(root.querySelector("[data-gdw-vector]")); } catch (_) { /* isolated engine cleanup */ }
        try { apis.components?.unmount?.(root.querySelector("[data-gdw-components]")); } catch (_) { /* isolated engine cleanup */ }
        try { apis.collaboration?.unmount?.(root.querySelector("[data-gdw-collaboration]")); } catch (_) { /* isolated engine cleanup */ }
        root.removeEventListener("click", onClick);
        root.removeEventListener("input", onInput);
        root.removeEventListener("change", onChange);
        root.removeEventListener("keydown", onKeydown);
      }
    });
    return controller;
  }

  function unmount(root) {
    const instance = root && mounted.get(root);
    if (!instance) return false;
    instance.cleanup();
    mounted.delete(root);
    root.replaceChildren();
    root.classList.remove("gdw");
    root.removeAttribute("data-graphic-design-workflow");
    root.removeAttribute("aria-label");
    return true;
  }

  const api = Object.freeze({
    VERSION, INTEGRATION_VERSION, FORMAT, STORAGE_KEY, MAX_HISTORY, STEPS, DEPENDENCIES,
    cleanText, escapeHtml, safeColor, normalizeBrand, createDefaultState, normalizeState,
    createStorageDriver, hexToRgb, relativeLuminance, contrastRatio, auditContrast,
    buildBrandCss, applyCreativeHandoff, captureSnapshot, restoreSnapshot, buildHandoff, serializePackage, parsePackage,
    mount, unmount
  });

  if (typeof module !== "undefined" && module.exports) module.exports = api;
  globalScope.HHGraphicDesignWorkflow = api;
}(typeof globalThis !== "undefined" ? globalThis : this));
