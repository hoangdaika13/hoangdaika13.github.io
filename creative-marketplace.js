(function (globalScope) {
  "use strict";

  const VERSION = 1;
  const FORMAT = "hh-creative-marketplace";
  const STORAGE_KEY = "hh.creative-marketplace.v1";
  const VIEW = "marketplace";
  const MAX_STATE_BYTES = 500000;
  const MAX_IMPORT_BYTES = 250000;
  const MAX_INSTALLED = 120;
  const TYPES = Object.freeze([
    "template", "prompt-pack", "workflow", "lut", "voice-preset", "character-pack", "brand-kit"
  ]);
  const TYPE_LABELS = Object.freeze({
    template: "Template",
    "prompt-pack": "Prompt pack",
    workflow: "Workflow",
    lut: "LUT",
    "voice-preset": "Voice preset",
    "character-pack": "Character pack",
    "brand-kit": "Brand Kit"
  });
  const ALLOWED_PERMISSIONS = Object.freeze([
    "read-project-metadata",
    "write-project-assets",
    "write-project-brand",
    "write-project-workflow",
    "write-project-prompts"
  ]);
  const PREVIEW_MESSAGE_TYPES = Object.freeze([
    "hh-marketplace.preview-ready",
    "hh-marketplace.preview-resize",
    "hh-marketplace.preview-select"
  ]);
  const mountedRoots = new WeakMap();

  function clone(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
  }

  function cleanText(value, limit = 300) {
    return String(value == null ? "" : value)
      .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "")
      .trim()
      .slice(0, limit);
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, (character) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;"
    })[character]);
  }

  function safeId(value, fallback = "pack") {
    const id = cleanText(value, 100).toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "");
    return id || `${fallback}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  }

  function safeColor(value, fallback) {
    const color = String(value || "").trim();
    return /^#[0-9a-f]{6}$/i.test(color) ? color.toUpperCase() : fallback;
  }

  function boundedNumber(value, min, max, fallback) {
    const number = Number(value);
    return Math.min(max, Math.max(min, Number.isFinite(number) ? number : fallback));
  }

  function uniqueStrings(values, limit, itemLimit) {
    const result = [];
    (Array.isArray(values) ? values : []).forEach((item) => {
      const text = cleanText(item, itemLimit);
      if (text && !result.includes(text) && result.length < limit) result.push(text);
    });
    return result;
  }

  function isoDate(value) {
    const date = value ? new Date(value) : new Date();
    return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
  }

  function bytes(value) {
    const text = typeof value === "string" ? value : JSON.stringify(value);
    if (typeof TextEncoder !== "undefined") return new TextEncoder().encode(text).length;
    return text.length;
  }

  function normalizePreview(value) {
    const input = value && typeof value === "object" ? value : {};
    return {
      headline: cleanText(input.headline, 100),
      body: cleanText(input.body, 360),
      accent: safeColor(input.accent, "#62D7E7"),
      secondary: safeColor(input.secondary, "#F05CAF"),
      layout: ["poster", "dashboard", "timeline", "character", "audio"].includes(input.layout) ? input.layout : "poster"
    };
  }

  function normalizeManifest(value, source = "imported") {
    const input = value && typeof value === "object" && !Array.isArray(value) ? value : {};
    const type = TYPES.includes(input.type) ? input.type : "template";
    const permissions = uniqueStrings(input.permissions, 8, 80).filter((permission) => ALLOWED_PERMISSIONS.includes(permission));
    const unknownPermissions = uniqueStrings(input.permissions, 20, 80).filter((permission) => !ALLOWED_PERMISSIONS.includes(permission));
    const manifest = {
      format: FORMAT,
      schemaVersion: VERSION,
      id: safeId(input.id || input.name, "pack"),
      name: cleanText(input.name || "Creative pack", 100),
      version: cleanText(input.version || "1.0.0", 24).replace(/[^0-9A-Za-z.+-]/g, "") || "1.0.0",
      type,
      summary: cleanText(input.summary, 320),
      description: cleanText(input.description || input.summary, 1500),
      author: cleanText(input.author || "Local creator", 80),
      license: cleanText(input.license || "Custom", 100),
      tags: uniqueStrings(input.tags, 16, 40),
      permissions,
      unknownPermissions,
      capabilities: uniqueStrings(input.capabilities, 20, 80),
      contents: uniqueStrings(input.contents, 30, 120),
      compatibility: cleanText(input.compatibility || "HH Creative OS v1", 120),
      preview: normalizePreview(input.preview),
      source: source === "built-in" ? "built-in" : "imported",
      createdAt: isoDate(input.createdAt)
    };
    return manifest;
  }

  function validateManifest(value) {
    const input = value && typeof value === "object" ? value : {};
    const manifest = normalizeManifest(input, "imported");
    const errors = [];
    const warnings = [];
    if (!cleanText(input.name, 100)) errors.push("Manifest cần có tên pack.");
    if (input.type && !TYPES.includes(input.type)) errors.push("Loại pack không được hỗ trợ.");
    if (input.format && input.format !== FORMAT) errors.push("Định dạng manifest không phải HH Creative Marketplace.");
    if (manifest.unknownPermissions.length) errors.push(`Quyền không được phép: ${manifest.unknownPermissions.join(", ")}.`);
    if (!manifest.permissions.length) warnings.push("Pack không yêu cầu quyền ghi vào dự án.");
    if (!manifest.license || manifest.license === "Custom") warnings.push("Hãy kiểm tra giấy phép trước khi chia sẻ lại.");
    if (!manifest.contents.length) warnings.push("Manifest chưa mô tả nội dung đóng gói.");
    return { valid: errors.length === 0, errors, warnings, manifest };
  }

  const RAW_CATALOG = [
    ["social-motion-kit", "Social Motion Kit", "template", "12 layout động cho Story, Reel và bài đăng.", "HH Studio", "CC BY 4.0", ["write-project-assets"], ["Story 9:16", "Post 1:1", "Reel cover"], "#F05CAF", "poster", ["social", "motion"]],
    ["launch-dashboard", "Launch Dashboard", "template", "Bộ màn hình chiến dịch và bảng tiến độ ra mắt.", "HH Studio", "MIT", ["write-project-assets"], ["Dashboard", "Launch checklist", "KPI cards"], "#62D7E7", "dashboard", ["campaign", "ui"]],
    ["cinematic-hooks", "Cinematic Hook Library", "prompt-pack", "Prompt hook, camera, ánh sáng và nhịp dựng video.", "Prompt Lab", "CC BY 4.0", ["write-project-prompts"], ["40 hook", "25 camera move", "20 lighting setup"], "#F4C95D", "timeline", ["prompt", "video"]],
    ["brand-voice-prompts", "Brand Voice Prompts", "prompt-pack", "Prompt giữ giọng thương hiệu nhất quán trên nhiều nền tảng.", "Prompt Lab", "MIT", ["read-project-metadata", "write-project-prompts"], ["Tone audit", "CTA rewrite", "Channel variants"], "#9D8CFF", "poster", ["brand", "copy"]],
    ["shorts-factory", "Shorts Factory", "workflow", "Brief đến script, subtitle, thumbnail và lịch đăng.", "Workflow Guild", "MIT", ["read-project-metadata", "write-project-workflow"], ["8 workflow nodes", "Retry map", "Review gate"], "#67DBA1", "timeline", ["workflow", "shorts"]],
    ["podcast-repurpose", "Podcast Repurpose", "workflow", "Chuyển podcast thành chapter, clip, quote và bài viết.", "Workflow Guild", "CC BY 4.0", ["read-project-metadata", "write-project-workflow"], ["Chapter flow", "Clip rules", "Blog outline"], "#FF8B6A", "timeline", ["podcast", "repurpose"]],
    ["neon-night-lut", "Neon Night LUT", "lut", "Look cyan-magenta có vùng da được bảo vệ.", "Color Room", "Free for commercial use", ["write-project-assets"], ["Cube LUT", "Preview chart", "Exposure note"], "#00D9FF", "poster", ["color", "night"]],
    ["warm-documentary-lut", "Warm Documentary LUT", "lut", "Look ấm, tương phản mềm cho phỏng vấn và tài liệu.", "Color Room", "Free for commercial use", ["write-project-assets"], ["Cube LUT", "Skin tone guide", "Camera notes"], "#F3A85B", "poster", ["color", "film"]],
    ["narrator-calm", "Calm Narrator", "voice-preset", "Preset nhịp đọc rõ, ấm và ít kịch tính.", "Voice Room", "Preset metadata only", ["write-project-assets"], ["Pacing map", "EQ note", "Pronunciation list"], "#78DCE8", "audio", ["voice", "narration"]],
    ["energetic-host", "Energetic Host", "voice-preset", "Preset dẫn chương trình nhanh, sáng và giàu năng lượng.", "Voice Room", "Preset metadata only", ["write-project-assets"], ["Pacing map", "Emphasis guide", "Breath markers"], "#D7FF73", "audio", ["voice", "host"]],
    ["anime-explorer", "Anime Explorer", "character-pack", "Nhân vật anime nhiều biểu cảm cho nội dung khám phá.", "Character Forge", "CC BY-NC 4.0", ["write-project-assets"], ["8 expressions", "6 poses", "Palette sheet"], "#F05CAF", "character", ["anime", "character"]],
    ["creator-mascot", "Creator Mascot", "character-pack", "Mascot modular dùng cho tutorial, loading và reaction.", "Character Forge", "CC BY 4.0", ["write-project-assets"], ["Body parts", "12 gestures", "Viseme chart"], "#62D7E7", "character", ["mascot", "rig"]],
    ["aurora-brand", "Aurora Brand Kit", "brand-kit", "Màu, type scale, logo spacing và token sáng/tối.", "Brand Foundry", "MIT", ["write-project-brand", "write-project-assets"], ["12 tokens", "Type scale", "Logo rules"], "#9D8CFF", "dashboard", ["brand", "aurora"]],
    ["editorial-brand", "Editorial Brand Kit", "brand-kit", "Hệ thống chữ và màu dành cho nội dung chuyên sâu.", "Brand Foundry", "MIT", ["write-project-brand", "write-project-assets"], ["Editorial grid", "Type styles", "Color tokens"], "#F4C95D", "poster", ["brand", "editorial"]]
  ];

  const BUILT_IN_CATALOG = Object.freeze(RAW_CATALOG.map((item) => normalizeManifest({
    id: item[0], name: item[1], type: item[2], summary: item[3], description: item[3], author: item[4],
    license: item[5], permissions: item[6], contents: item[7], preview: { accent: item[8], layout: item[9], headline: item[1], body: item[3] },
    tags: item[10], capabilities: item[7]
  }, "built-in")));

  function normalizeInstall(value) {
    const input = value && typeof value === "object" ? value : {};
    return {
      packId: safeId(input.packId, "pack"),
      projectId: safeId(input.projectId, "project"),
      version: cleanText(input.version || "1.0.0", 24),
      assetId: safeId(input.assetId, "marketplace-asset"),
      installedAt: isoDate(input.installedAt),
      installedBy: cleanText(input.installedBy, 100)
    };
  }

  function normalizeState(value) {
    const input = value && typeof value === "object" ? value : {};
    const favorites = uniqueStrings(input.favorites, 240, 100).map((id) => safeId(id, "pack"));
    const installed = (Array.isArray(input.installed) ? input.installed : []).slice(0, MAX_INSTALLED).map(normalizeInstall);
    const imported = (Array.isArray(input.imported) ? input.imported : []).slice(0, 60).map((item) => normalizeManifest(item, "imported"));
    return {
      version: VERSION,
      favorites,
      installed,
      imported,
      updatedAt: isoDate(input.updatedAt)
    };
  }

  function createMarketplaceStore(options = {}) {
    const storage = options.storage || (typeof localStorage !== "undefined" ? localStorage : null);
    const storageKey = cleanText(options.storageKey || STORAGE_KEY, 160);
    let state;
    try {
      const saved = storage?.getItem(storageKey);
      state = normalizeState(saved ? JSON.parse(saved) : options.initialState);
    } catch {
      state = normalizeState(options.initialState);
    }
    const listeners = new Set();
    function commit(next) {
      const normalized = normalizeState({ ...next, updatedAt: new Date().toISOString() });
      const serialized = JSON.stringify(normalized);
      if (bytes(serialized) > MAX_STATE_BYTES) throw new Error("Marketplace đã đạt giới hạn lưu trữ cục bộ.");
      storage?.setItem?.(storageKey, serialized);
      state = normalized;
      listeners.forEach((listener) => listener(clone(state)));
      return clone(state);
    }
    return Object.freeze({
      getState: () => clone(state),
      subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
      toggleFavorite(packId) {
        const id = safeId(packId, "pack");
        const favorites = state.favorites.includes(id) ? state.favorites.filter((item) => item !== id) : [id, ...state.favorites];
        return commit({ ...state, favorites });
      },
      addImported(manifest) {
        const check = validateManifest(manifest);
        if (!check.valid) throw new Error(check.errors.join(" "));
        const imported = [check.manifest, ...state.imported.filter((item) => item.id !== check.manifest.id)].slice(0, 60);
        commit({ ...state, imported });
        return clone(check.manifest);
      },
      markInstalled(receipt) {
        const install = normalizeInstall(receipt);
        const installed = [install, ...state.installed.filter((item) => !(item.packId === install.packId && item.projectId === install.projectId))].slice(0, MAX_INSTALLED);
        return commit({ ...state, installed });
      },
      removeInstalled(packId, projectId) {
        return commit({ ...state, installed: state.installed.filter((item) => !(item.packId === packId && item.projectId === projectId)) });
      }
    });
  }

  function getProject(store) {
    if (!store || typeof store.getState !== "function") return null;
    const state = store.getState();
    return state.projects?.find((project) => project.id === state.activeProjectId) || state.projects?.[0] || null;
  }

  function filterCatalog(catalog, query, type, favorites) {
    const needle = cleanText(query, 100).toLocaleLowerCase("vi");
    const favoriteSet = new Set(Array.isArray(favorites) ? favorites : []);
    return catalog.filter((pack) => {
      if (type === "favorites" && !favoriteSet.has(pack.id)) return false;
      if (type && type !== "all" && type !== "favorites" && pack.type !== type) return false;
      if (!needle) return true;
      return [pack.name, pack.summary, pack.author, pack.type, ...pack.tags].join(" ").toLocaleLowerCase("vi").includes(needle);
    });
  }

  function projectAssetFor(pack) {
    return {
      id: `marketplace-${pack.id}-${Date.now().toString(36)}`,
      name: `${pack.name} v${pack.version}`,
      type: `application/vnd.hh.marketplace.${pack.type}+json`,
      kind: "marketplace-pack",
      size: bytes(pack),
      source: "",
      license: pack.license,
      tags: ["marketplace", `pack:${pack.id}`, `type:${pack.type}`, `version:${pack.version}`]
    };
  }

  function installPack(packValue, options = {}) {
    const pack = normalizeManifest(packValue, packValue?.source === "built-in" ? "built-in" : "imported");
    const validation = validateManifest(pack);
    if (!validation.valid) throw new Error(validation.errors.join(" "));
    if (options.confirmed !== true) {
      const error = new Error("Cần xác nhận trước khi cài pack vào dự án.");
      error.code = "INSTALL_CONFIRMATION_REQUIRED";
      throw error;
    }
    const store = options.store;
    const project = options.project || getProject(store);
    if (!project?.id) throw new Error("Hãy tạo hoặc chọn một Universal Creative Project trước khi cài.");
    if (!store || typeof store.addAsset !== "function") throw new Error("Creative Project store chưa sẵn sàng để cài pack.");
    const existing = (project.assets || []).find((asset) => asset.tags?.includes(`pack:${pack.id}`));
    if (existing) throw new Error("Pack này đã có trong dự án hiện tại.");
    const assetPayload = projectAssetFor(pack);
    let asset = typeof options.onInstall === "function"
      ? options.onInstall(clone({ ...pack, asset: assetPayload }))
      : store.addAsset(project.id, assetPayload);
    if (!asset || typeof asset !== "object" || !cleanText(asset.id, 100)) {
      throw new Error("Trình cài pack không trả về asset hợp lệ.");
    }
    if (!asset.tags?.includes(`pack:${pack.id}`) && typeof store.updateProject === "function") {
      const current = getProject(store);
      const assets = (current?.assets || []).map((item) => item.id === asset.id ? {
        ...item,
        kind: "marketplace-pack",
        license: pack.license,
        tags: assetPayload.tags
      } : item);
      store.updateProject(project.id, { assets });
      asset = getProject(store)?.assets?.find((item) => item.id === asset.id) || asset;
    }
    const receipt = {
      packId: pack.id,
      projectId: project.id,
      version: pack.version,
      assetId: asset.id,
      installedAt: new Date().toISOString(),
      installedBy: cleanText(options.currentUser?.name || options.currentUser?.email || "local-user", 100)
    };
    return receipt;
  }

  function uninstallPack(packId, projectId, store) {
    if (!store || typeof store.getState !== "function" || typeof store.updateProject !== "function") {
      throw new Error("Creative Project store không hỗ trợ gỡ pack.");
    }
    const state = store.getState();
    const project = state.projects?.find((item) => item.id === projectId);
    if (!project) throw new Error("Không tìm thấy dự án để gỡ pack.");
    const tag = `pack:${safeId(packId, "pack")}`;
    const assets = (project.assets || []).filter((asset) => !asset.tags?.includes(tag));
    if (assets.length === (project.assets || []).length) throw new Error("Pack không còn trong dự án này.");
    store.updateProject(project.id, { assets });
    return { packId: safeId(packId, "pack"), projectId: project.id, removed: true };
  }

  function parseManifestJson(text) {
    if (bytes(text) > MAX_IMPORT_BYTES) throw new Error("Manifest vượt quá 250 KB.");
    let value;
    try { value = JSON.parse(String(text || "")); } catch { throw new Error("Manifest JSON không hợp lệ."); }
    const check = validateManifest(value);
    if (!check.valid) throw new Error(check.errors.join(" "));
    return check;
  }

  function exportManifest(packValue) {
    const pack = normalizeManifest(packValue, packValue?.source === "built-in" ? "built-in" : "imported");
    const output = clone(pack);
    delete output.unknownPermissions;
    delete output.source;
    return JSON.stringify(output, null, 2);
  }

  function isAllowedPreviewMessage(event, frameWindow) {
    if (!event || event.source !== frameWindow) return false;
    if (!event.data || typeof event.data !== "object") return false;
    return PREVIEW_MESSAGE_TYPES.includes(event.data.type);
  }

  function buildPreviewDocument(packValue) {
    const pack = normalizeManifest(packValue, "imported");
    const title = escapeHtml(pack.preview.headline || pack.name);
    const body = escapeHtml(pack.preview.body || pack.summary);
    const accent = pack.preview.accent;
    const secondary = pack.preview.secondary;
    const layout = escapeHtml(pack.preview.layout);
    return `<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><style>*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;padding:24px;background:#090d14;color:#eef5fb;font:15px/1.5 system-ui;overflow:hidden}.stage{position:relative;width:min(100%,680px);min-height:300px;padding:34px;border:1px solid ${accent};background:radial-gradient(circle at 85% 15%,${secondary}33,transparent 30%),linear-gradient(145deg,#141b27,#090d14);box-shadow:0 24px 80px #0008;overflow:hidden}.stage:before{content:"";position:absolute;inset:0;background-image:linear-gradient(#fff09 1px,transparent 1px),linear-gradient(90deg,#fff09 1px,transparent 1px);background-size:28px 28px}.copy{position:relative;z-index:1;max-width:470px}.eyebrow{color:${accent};font-size:11px;font-weight:800;text-transform:uppercase}.layout{position:absolute;right:24px;bottom:20px;color:#ffffff55;font-size:10px;text-transform:uppercase}h1{margin:14px 0;font-size:clamp(34px,7vw,70px);line-height:.95;background:linear-gradient(110deg,#fff,${accent},${secondary});-webkit-background-clip:text;color:transparent}p{color:#b9c4d2}.chips{display:flex;gap:8px;flex-wrap:wrap;margin-top:28px}.chips span{padding:7px 10px;border:1px solid #ffffff22;background:#ffffff0b}</style></head><body><section class="stage"><div class="copy"><div class="eyebrow">HH local preview</div><h1>${title}</h1><p>${body}</p><div class="chips"><span>${escapeHtml(TYPE_LABELS[pack.type])}</span><span>${escapeHtml(pack.version)}</span><span>${escapeHtml(pack.license)}</span></div></div><b class="layout">${layout}</b></section><script>"use strict";const allowed=["hh-marketplace.preview-theme","hh-marketplace.preview-focus"];addEventListener("message",event=>{if(event.source!==parent||!event.data||!allowed.includes(event.data.type))return;if(event.data.type==="hh-marketplace.preview-focus")document.querySelector(".stage").focus();});parent.postMessage({type:"hh-marketplace.preview-ready"},"*");</script></body></html>`;
  }

  function resolveRoot(target) {
    if (typeof target === "string" && typeof document !== "undefined") return document.querySelector(target);
    return target && typeof target === "object" ? target : null;
  }

  function downloadText(filename, text) {
    if (typeof document === "undefined" || !globalScope.URL?.createObjectURL) return false;
    const blob = new Blob([text], { type: "application/json;charset=utf-8" });
    const url = globalScope.URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    setTimeout(() => globalScope.URL.revokeObjectURL(url), 0);
    return true;
  }

  function packCard(pack, state, project) {
    const favorite = state.favorites.includes(pack.id);
    const installed = state.installed.some((item) => item.packId === pack.id && item.projectId === project?.id);
    return `<article class="cmp-card" data-pack-id="${escapeHtml(pack.id)}" style="--cmp-accent:${pack.preview.accent}">
      <header><span>${escapeHtml(TYPE_LABELS[pack.type])}</span><button type="button" data-action="favorite" aria-label="${favorite ? "Bỏ yêu thích" : "Thêm yêu thích"}" aria-pressed="${favorite}">${favorite ? "★" : "☆"}</button></header>
      <div class="cmp-card__art cmp-card__art--${escapeHtml(pack.preview.layout)}"><i></i><b>${escapeHtml(pack.name.slice(0, 2).toUpperCase())}</b></div>
      <div class="cmp-card__copy"><small>${escapeHtml(pack.author)} · v${escapeHtml(pack.version)}</small><h3>${escapeHtml(pack.name)}</h3><p>${escapeHtml(pack.summary)}</p></div>
      <div class="cmp-card__tags">${pack.tags.slice(0, 3).map((tag) => `<span>${escapeHtml(tag)}</span>`).join("")}</div>
      <footer><button type="button" data-action="preview">Xem trước</button><button type="button" data-action="install" class="is-primary" ${installed ? "disabled" : ""}>${installed ? "Đã cài" : "Cài vào dự án"}</button></footer>
    </article>`;
  }

  function mount(target, options = {}) {
    const root = resolveRoot(target);
    if (!root || typeof root.addEventListener !== "function") throw new Error("HHCreativeMarketplace cần một root element hợp lệ.");
    unmount(root);
    const store = options.store;
    const marketplace = createMarketplaceStore(options);
    const runtime = {
      view: options.view === VIEW ? VIEW : VIEW,
      query: "",
      type: "all",
      mode: "discover",
      selectedId: "",
      confirmId: "",
      notice: "",
      error: "",
      destroyed: false,
      frameWindow: null
    };

    function catalog() {
      const state = marketplace.getState();
      return [...BUILT_IN_CATALOG, ...state.imported].filter((pack, index, list) => list.findIndex((item) => item.id === pack.id) === index);
    }

    function findPack(id) { return catalog().find((pack) => pack.id === id) || null; }

    function render() {
      if (runtime.destroyed) return;
      const state = marketplace.getState();
      const project = getProject(store);
      const packs = filterCatalog(catalog(), runtime.query, runtime.type, state.favorites);
      const installedForProject = state.installed.filter((item) => item.projectId === project?.id);
      root.className = `${root.className.replace(/\s*cmp-marketplace\b/g, "")} cmp-marketplace`.trim();
      root.dataset.creativeMarketplace = "true";
      root.setAttribute("aria-label", "Creative Marketplace");
      root.innerHTML = `<section class="cmp-shell">
        <header class="cmp-hero">
          <div><span>CREATIVE MARKETPLACE · LOCAL-FIRST</span><h2>Pack sáng tạo, quyền minh bạch.</h2><p>Khám phá template, prompt, workflow, LUT, giọng, nhân vật và Brand Kit. Mọi pack chỉ được cài vào dự án sau khi bạn duyệt quyền.</p></div>
          <aside><small>Dự án đang chọn</small><strong>${escapeHtml(project?.name || "Chưa có dự án")}</strong><span>${installedForProject.length} pack đã cài · ${state.favorites.length} yêu thích</span><button type="button" data-action="navigate-project">Mở Universal Project</button></aside>
        </header>
        <div class="cmp-stats"><div><span>Thư viện</span><strong>${catalog().length}</strong><small>${state.imported.length} manifest nhập</small></div><div><span>Đã cài</span><strong>${installedForProject.length}</strong><small>Trong dự án hiện tại</small></div><div><span>Runtime</span><strong>Local</strong><small>Không chạy mã bên thứ ba</small></div><div><span>Tài khoản</span><strong>${escapeHtml(cleanText(options.currentUser?.name || "Khách cục bộ", 24))}</strong><small>Dữ liệu trên thiết bị này</small></div></div>
        <nav class="cmp-toolbar" aria-label="Chế độ Marketplace"><div><button type="button" data-mode="discover" class="${runtime.mode === "discover" ? "is-active" : ""}">Khám phá</button><button type="button" data-mode="installed" class="${runtime.mode === "installed" ? "is-active" : ""}">Đã cài</button></div><div><button type="button" data-action="import">Nhập manifest</button><input type="file" data-field="manifest-file" accept="application/json,.json" hidden><button type="button" data-action="export-selected" ${runtime.selectedId ? "" : "disabled"}>Xuất manifest</button></div></nav>
        ${runtime.notice ? `<div class="cmp-notice" role="status">${escapeHtml(runtime.notice)}</div>` : ""}${runtime.error ? `<div class="cmp-notice is-error" role="alert">${escapeHtml(runtime.error)}</div>` : ""}
        ${runtime.mode === "discover" ? `<div class="cmp-layout"><aside class="cmp-filter"><label>Tìm pack<input type="search" data-field="query" maxlength="100" value="${escapeHtml(runtime.query)}" placeholder="Tên, tag, tác giả..."></label><fieldset><legend>Loại nội dung</legend>${[["all", "Tất cả"], ["favorites", "Yêu thích"], ...TYPES.map((type) => [type, TYPE_LABELS[type]])].map(([value, label]) => `<button type="button" data-filter="${value}" class="${runtime.type === value ? "is-active" : ""}"><span>${escapeHtml(label)}</span><b>${value === "all" ? catalog().length : value === "favorites" ? state.favorites.length : catalog().filter((pack) => pack.type === value).length}</b></button>`).join("")}</fieldset><div class="cmp-filter__safety"><b>Safety gate</b><p>Manifest chỉ chứa dữ liệu. Preview chạy trong iframe sandbox, không fetch, không eval và không truy cập project.</p></div></aside><main class="cmp-results"><header><div><small>CURATED CREATIVE PACKS</small><h3>${packs.length} kết quả</h3></div><span>${project ? `Cài vào: ${escapeHtml(project.name)}` : "Tạo dự án để cài pack"}</span></header><div class="cmp-grid">${packs.length ? packs.map((pack) => packCard(pack, state, project)).join("") : `<div class="cmp-empty"><strong>Không tìm thấy pack phù hợp</strong><p>Thử từ khóa hoặc bộ lọc khác.</p></div>`}</div></main></div>` : renderInstalled(state, project, catalog())}
      </section>${runtime.selectedId ? renderPreview(findPack(runtime.selectedId)) : ""}${runtime.confirmId ? renderConfirm(findPack(runtime.confirmId), project) : ""}`;
      const frame = root.querySelector("iframe[data-preview-frame]");
      runtime.frameWindow = frame?.contentWindow || null;
    }

    function renderInstalled(state, project, packs) {
      const installs = state.installed.filter((item) => item.projectId === project?.id);
      return `<main class="cmp-installed"><header><div><small>PROJECT PACK MANAGER</small><h3>Pack trong ${escapeHtml(project?.name || "dự án")}</h3></div><p>Gỡ pack sẽ xóa asset Marketplace tương ứng khỏi dự án hiện tại.</p></header><div>${installs.length ? installs.map((install) => {
        const pack = packs.find((item) => item.id === install.packId);
        return `<article><i style="--cmp-accent:${pack?.preview.accent || "#62D7E7"}">${escapeHtml((pack?.name || install.packId).slice(0, 2).toUpperCase())}</i><div><small>${escapeHtml(TYPE_LABELS[pack?.type] || "Pack")} · v${escapeHtml(install.version)}</small><strong>${escapeHtml(pack?.name || install.packId)}</strong><span>Cài ${escapeHtml(new Date(install.installedAt).toLocaleString("vi-VN"))}</span></div><button type="button" data-action="preview-installed" data-pack-id="${escapeHtml(install.packId)}">Xem</button><button type="button" data-action="uninstall" data-pack-id="${escapeHtml(install.packId)}">Gỡ</button></article>`;
      }).join("") : `<div class="cmp-empty"><strong>Chưa có pack được cài</strong><p>Chuyển sang Khám phá và chọn một pack phù hợp.</p><button type="button" data-mode="discover">Khám phá pack</button></div>`}</div></main>`;
    }

    function renderPreview(pack) {
      if (!pack) return "";
      const validation = validateManifest(pack);
      return `<div class="cmp-modal" role="dialog" aria-modal="true" aria-labelledby="cmp-preview-title"><section class="cmp-preview"><header><div><small>${escapeHtml(TYPE_LABELS[pack.type])} · ${escapeHtml(pack.source)}</small><h3 id="cmp-preview-title">${escapeHtml(pack.name)}</h3></div><button type="button" data-action="close-preview" aria-label="Đóng xem trước">×</button></header><div class="cmp-preview__body"><iframe data-preview-frame title="Xem trước ${escapeHtml(pack.name)}" sandbox="allow-scripts" referrerpolicy="no-referrer" srcdoc="${escapeHtml(buildPreviewDocument(pack))}"></iframe><aside><p>${escapeHtml(pack.description)}</p><dl><div><dt>Tác giả</dt><dd>${escapeHtml(pack.author)}</dd></div><div><dt>Giấy phép</dt><dd>${escapeHtml(pack.license)}</dd></div><div><dt>Tương thích</dt><dd>${escapeHtml(pack.compatibility)}</dd></div></dl><section><h4>Nội dung</h4><ul>${pack.contents.map((item) => `<li>${escapeHtml(item)}</li>`).join("") || "<li>Chưa khai báo</li>"}</ul></section><section><h4>Quyền yêu cầu</h4>${pack.permissions.length ? pack.permissions.map((permission) => `<div class="cmp-permission"><i>✓</i><span><b>${escapeHtml(permission)}</b><small>${permissionDescription(permission)}</small></span></div>`).join("") : "<p>Pack không yêu cầu quyền ghi.</p>"}${validation.warnings.map((warning) => `<p class="cmp-warning">${escapeHtml(warning)}</p>`).join("")}</section><footer><button type="button" data-action="export-pack">Xuất JSON</button><button type="button" data-action="install-selected" class="is-primary">Duyệt quyền và cài</button></footer></aside></div></section></div>`;
    }

    function renderConfirm(pack, project) {
      if (!pack) return "";
      return `<div class="cmp-modal cmp-modal--confirm" role="dialog" aria-modal="true" aria-labelledby="cmp-confirm-title"><section class="cmp-confirm"><span>XÁC NHẬN CÀI LOCAL</span><h3 id="cmp-confirm-title">Cài ${escapeHtml(pack.name)}?</h3><p>Pack sẽ thêm một asset vào <b>${escapeHtml(project?.name || "dự án đang chọn")}</b>. Không có mã bên thứ ba được chạy và không có dữ liệu được gửi lên mạng.</p><div>${pack.permissions.map((permission) => `<label><input type="checkbox" data-permission="${escapeHtml(permission)}"> <span><b>${escapeHtml(permission)}</b><small>${permissionDescription(permission)}</small></span></label>`).join("") || "<p>Pack không yêu cầu quyền ghi bổ sung.</p>"}</div><footer><button type="button" data-action="cancel-install">Hủy</button><button type="button" data-action="confirm-install" class="is-primary">Tôi hiểu, cài pack</button></footer></section></div>`;
    }

    function permissionDescription(permission) {
      return ({
        "read-project-metadata": "Đọc tên và metadata dự án hiện tại.",
        "write-project-assets": "Thêm asset pack vào thư viện dự án.",
        "write-project-brand": "Thêm token và hướng dẫn Brand Kit.",
        "write-project-workflow": "Thêm cấu trúc workflow vào project.",
        "write-project-prompts": "Thêm prompt đã đóng gói vào project."
      })[permission] || "Quyền cục bộ được kiểm soát.";
    }

    function notify(message, isError) {
      runtime.notice = isError ? "" : cleanText(message, 260);
      runtime.error = isError ? cleanText(message, 260) : "";
      render();
    }

    function closeModals() { runtime.selectedId = ""; runtime.confirmId = ""; render(); }

    function onClick(event) {
      const button = event.target.closest("button");
      if (!button || !root.contains(button)) return;
      const card = button.closest("[data-pack-id]");
      const packId = button.dataset.packId || card?.dataset.packId;
      if (button.dataset.mode) { runtime.mode = button.dataset.mode; runtime.notice = ""; runtime.error = ""; render(); return; }
      if (button.dataset.filter) { runtime.type = button.dataset.filter; render(); return; }
      const action = button.dataset.action;
      if (action === "favorite" && packId) { marketplace.toggleFavorite(packId); return; }
      if ((action === "preview" || action === "preview-installed") && packId) { runtime.selectedId = packId; render(); return; }
      if (action === "close-preview" || action === "cancel-install") { closeModals(); return; }
      if (action === "install" && packId) { runtime.confirmId = packId; render(); return; }
      if (action === "install-selected" && runtime.selectedId) { runtime.confirmId = runtime.selectedId; render(); return; }
      if (action === "confirm-install" && runtime.confirmId) {
        const pack = findPack(runtime.confirmId);
        const required = pack?.permissions.length || 0;
        const checked = root.querySelectorAll("[data-permission]:checked").length;
        if (checked !== required) { notify("Hãy duyệt tất cả quyền được yêu cầu trước khi cài.", true); runtime.confirmId = pack?.id || ""; return; }
        try {
          const receipt = installPack(pack, { confirmed: true, store, currentUser: options.currentUser, onInstall: options.onInstall });
          marketplace.markInstalled(receipt);
          runtime.selectedId = ""; runtime.confirmId = "";
          notify(`Đã cài ${pack.name} vào dự án cục bộ.`, false);
        } catch (error) { notify(error.message, true); }
        return;
      }
      if (action === "uninstall" && packId) {
        try { uninstallPack(packId, getProject(store)?.id, store); marketplace.removeInstalled(packId, getProject(store)?.id); notify("Đã gỡ pack khỏi dự án.", false); }
        catch (error) { notify(error.message, true); }
        return;
      }
      if (action === "import") { root.querySelector("[data-field='manifest-file']")?.click(); return; }
      if (action === "export-pack" && runtime.selectedId) { const pack = findPack(runtime.selectedId); downloadText(`${pack.id}.hhpack.json`, exportManifest(pack)); return; }
      if (action === "export-selected" && runtime.selectedId) { const pack = findPack(runtime.selectedId); if (pack) downloadText(`${pack.id}.hhpack.json`, exportManifest(pack)); return; }
      if (action === "navigate-project") options.onNavigate?.("/create/project");
    }

    function onInput(event) {
      if (event.target.dataset.field === "query") { runtime.query = cleanText(event.target.value, 100); render(); }
    }

    async function onChange(event) {
      if (event.target.dataset.field !== "manifest-file") return;
      const file = event.target.files?.[0];
      if (!file) return;
      if (file.size > MAX_IMPORT_BYTES) { notify("Manifest vượt quá 250 KB.", true); return; }
      try {
        const check = parseManifestJson(await file.text());
        const manifest = marketplace.addImported(check.manifest);
        runtime.selectedId = manifest.id;
        runtime.mode = "discover";
        notify(`Đã nhập manifest ${manifest.name}. Hãy xem quyền trước khi cài.`, false);
      } catch (error) { notify(error.message, true); }
      event.target.value = "";
    }

    function onKeydown(event) {
      if (event.key === "Escape" && (runtime.selectedId || runtime.confirmId)) { event.preventDefault(); closeModals(); }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") { event.preventDefault(); root.querySelector("[data-field='query']")?.focus(); }
    }

    function onMessage(event) {
      if (!isAllowedPreviewMessage(event, runtime.frameWindow)) return;
      if (event.data.type === "hh-marketplace.preview-ready") runtime.frameWindow?.postMessage({ type: "hh-marketplace.preview-theme", theme: "dark" }, "*");
    }

    root.addEventListener("click", onClick);
    root.addEventListener("input", onInput);
    root.addEventListener("change", onChange);
    root.addEventListener("keydown", onKeydown);
    globalScope.addEventListener?.("message", onMessage);
    const unsubscribeMarketplace = marketplace.subscribe(render);
    const unsubscribeProject = typeof store?.subscribe === "function" ? store.subscribe(render) : () => {};
    render();

    const controller = Object.freeze({
      getState: marketplace.getState,
      getCatalog: () => clone(catalog()),
      setQuery(value) { runtime.query = cleanText(value, 100); render(); },
      setMode(value) { if (["discover", "installed"].includes(value)) { runtime.mode = value; render(); return true; } return false; },
      importManifest(value) { const manifest = marketplace.addImported(value); runtime.selectedId = manifest.id; render(); return manifest; },
      unmount: () => unmount(root)
    });
    mountedRoots.set(root, {
      controller,
      cleanup() {
        runtime.destroyed = true;
        unsubscribeMarketplace(); unsubscribeProject();
        root.removeEventListener("click", onClick); root.removeEventListener("input", onInput); root.removeEventListener("change", onChange); root.removeEventListener("keydown", onKeydown);
        globalScope.removeEventListener?.("message", onMessage);
      }
    });
    return controller;
  }

  function unmount(target) {
    const root = resolveRoot(target);
    const mounted = root && mountedRoots.get(root);
    if (!mounted) return false;
    mounted.cleanup();
    mountedRoots.delete(root);
    root.removeAttribute("data-creative-marketplace");
    root.removeAttribute("aria-label");
    root.classList?.remove("cmp-marketplace");
    root.replaceChildren();
    return true;
  }

  const api = Object.freeze({
    VERSION, FORMAT, STORAGE_KEY, VIEW, TYPES, TYPE_LABELS, ALLOWED_PERMISSIONS, PREVIEW_MESSAGE_TYPES,
    MAX_STATE_BYTES, MAX_IMPORT_BYTES, BUILT_IN_CATALOG,
    cleanText, escapeHtml, safeId, normalizePreview, normalizeManifest, validateManifest, normalizeState,
    createMarketplaceStore, filterCatalog, projectAssetFor, installPack, uninstallPack, parseManifestJson,
    exportManifest, buildPreviewDocument, isAllowedPreviewMessage, mount, unmount
  });

  if (typeof module !== "undefined" && module.exports) module.exports = api;
  globalScope.HHCreativeMarketplace = api;
}(typeof globalThis !== "undefined" ? globalThis : this));
