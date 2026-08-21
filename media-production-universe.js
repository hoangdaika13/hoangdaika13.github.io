((factory) => {
  const scope = typeof window !== "undefined" ? window : globalThis;
  const api = factory(scope);
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (scope) scope.HHMediaProductionUniverse = api;
})((scope) => {
  "use strict";

  const VERSION = 1;
  const WORKSPACE_IDS = Object.freeze(["video-workspace", "document-workspace", "brand-workspace", "asset-workspace", "export-workspace"]);
  const WORKSPACE_BY_ID = Object.freeze(Object.fromEntries(WORKSPACE_IDS.map((id) => [id, true])));
  const activeInstances = new Map();
  const DELIVERY_PROFILES = Object.freeze([
    { id: "youtube", label: "YouTube Master", kind: "video", width: 1920, height: 1080, fps: 30, bitrate: 12_000_000, mime: "video/webm;codecs=vp9,opus" },
    { id: "vertical", label: "Shorts · Reels", kind: "video", width: 1080, height: 1920, fps: 30, bitrate: 8_000_000, mime: "video/webm;codecs=vp9,opus" },
    { id: "social", label: "Social Square", kind: "video", width: 1080, height: 1080, fps: 30, bitrate: 7_000_000, mime: "video/webm;codecs=vp9,opus" },
    { id: "podcast", label: "Podcast WAV", kind: "audio", sampleRate: 48000, bitrate: 1_536_000, mime: "audio/wav" },
    { id: "image", label: "Image WebP", kind: "image", width: 2560, height: 1440, quality: .9, mime: "image/webp" }
  ]);

  const now = () => new Date().toISOString();
  const uid = (prefix) => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
  const clamp = (value, min, max) => Math.max(min, Math.min(max, Number(value) || 0));
  const text = (value, max = 240, fallback = "") => String(value == null ? "" : value).trim().slice(0, max) || fallback;
  const clone = (value) => {
    if (value == null) return value;
    if (typeof structuredClone === "function") return structuredClone(value);
    return JSON.parse(JSON.stringify(value));
  };
  const escapeHtml = (value) => String(value == null ? "" : value)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  const formatTime = (seconds) => {
    const safe = Math.max(0, Number(seconds) || 0);
    const hours = Math.floor(safe / 3600);
    const minutes = Math.floor(safe % 3600 / 60);
    const secs = Math.floor(safe % 60);
    const frames = Math.floor((safe % 1) * 30);
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}:${String(frames).padStart(2, "0")}`;
  };
  const formatBytes = (bytes) => {
    const value = Math.max(0, Number(bytes) || 0);
    if (value < 1024) return `${value} B`;
    if (value < 1048576) return `${(value / 1024).toFixed(1)} KB`;
    if (value < 1073741824) return `${(value / 1048576).toFixed(1)} MB`;
    return `${(value / 1073741824).toFixed(2)} GB`;
  };
  const downloadBlob = (blob, name) => {
    if (!scope.document || !(blob instanceof Blob)) return false;
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = text(name, 180, "hh-media-output");
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
    return true;
  };
  const downloadText = (value, name, type = "application/json") => downloadBlob(new Blob([String(value)], { type }), name);
  const safeFileName = (value, fallback = "hh-media") => text(value, 140, fallback).replace(/[\\/:*?"<>|]+/g, "-").replace(/\s+/g, "-");
  const fileKind = (type, name = "") => {
    const mime = String(type || "").toLowerCase();
    const ext = String(name).toLowerCase();
    if (mime.startsWith("video/") || /\.(mp4|webm|mov|mkv|m4v)$/.test(ext)) return "video";
    if (mime.startsWith("audio/") || /\.(wav|mp3|m4a|ogg|flac|aac)$/.test(ext)) return "audio";
    if (mime.startsWith("image/") || /\.(png|jpe?g|webp|gif|avif|svg)$/.test(ext)) return "image";
    if (mime === "application/pdf" || /\.pdf$/.test(ext)) return "pdf";
    if (mime.startsWith("text/") || /\.(txt|md|csv|json|srt|vtt)$/.test(ext)) return "text";
    return "file";
  };

  function ensureProductionState(input, professionalApi) {
    const state = professionalApi?.normalizeState ? professionalApi.normalizeState(input) : clone(input || {});
    state.project ||= { id: uid("project"), name: "Universal Media Project", checkpoints: [], branches: [], graph: { nodes: [], edges: [] } };
    state.review ||= { audit: [], comments: [] };
    state.rights ||= { splits: [{ id: uid("split"), owner: "Chủ sở hữu", percent: 100 }], consents: [], licenses: [] };
    state.video = {
      library: [], timeline: [], activeAssetId: "", marks: { in: 0, out: 0 }, captions: [],
      color: { exposure: 0, contrast: 100, saturation: 100, temperature: 0 },
      transform: { x: 0, y: 0, scale: 100, rotation: 0, opacity: 100 }, keyframes: [],
      ...(state.video || {})
    };
    state.video.library = Array.isArray(state.video.library) ? state.video.library.slice(-200) : [];
    state.video.timeline = Array.isArray(state.video.timeline) ? state.video.timeline.slice(-400) : [];
    state.video.captions = Array.isArray(state.video.captions) ? state.video.captions.slice(-500) : [];
    state.video.keyframes = Array.isArray(state.video.keyframes) ? state.video.keyframes.slice(-500) : [];
    state.documents = { jobs: [], activeId: "", page: 1, watermark: "", ...(state.documents || {}) };
    state.documents.jobs = Array.isArray(state.documents.jobs) ? state.documents.jobs.slice(-300) : [];
    state.brand ||= { activeKitId: "kit-default", kits: [] };
    state.brand.activeMode ||= "Default";
    state.brand.kits = Array.isArray(state.brand.kits) && state.brand.kits.length ? state.brand.kits : [{
      id: "kit-default", name: "HH Brand", modes: ["Default"], tokens: [
        { id: "surface", name: "color.surface.canvas", value: "#071225", type: "color" },
        { id: "primary", name: "color.brand.primary", value: "#56ecff", type: "color" },
        { id: "accent", name: "color.brand.accent", value: "#ff63d8", type: "color" },
        { id: "text", name: "color.text.primary", value: "#f3f8ff", type: "color" },
        { id: "radius", name: "radius.card", value: "20px", type: "dimension" }
      ], components: [], templateLocks: []
    }];
    state.assets = { items: [], collections: [], cloud: { status: "needs-adapter" }, ...(state.assets || {}) };
    state.assets.collections = Array.isArray(state.assets.collections) ? state.assets.collections.slice(-100) : [];
    state.export = { jobs: [], lastPreflight: null, selectedProfile: "youtube", worker: { status: "needs-adapter" }, ...(state.export || {}) };
    state.export.jobs = Array.isArray(state.export.jobs) ? state.export.jobs.slice(-300) : [];
    return state;
  }

  function hexToRgb(value) {
    const match = String(value || "").trim().match(/^#([\da-f]{3}|[\da-f]{6})$/i);
    if (!match) return null;
    const hex = match[1].length === 3 ? match[1].split("").map((char) => char + char).join("") : match[1];
    return [0, 2, 4].map((index) => parseInt(hex.slice(index, index + 2), 16));
  }
  function contrastRatio(first, second) {
    const luminance = (color) => {
      const rgb = hexToRgb(color);
      if (!rgb) return null;
      const channels = rgb.map((value) => {
        const channel = value / 255;
        return channel <= .04045 ? channel / 12.92 : Math.pow((channel + .055) / 1.055, 2.4);
      });
      return channels[0] * .2126 + channels[1] * .7152 + channels[2] * .0722;
    };
    const a = luminance(first), b = luminance(second);
    if (a == null || b == null) return null;
    return (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
  }

  function lintBrandKit(kit) {
    const issues = [], names = new Set();
    const tokens = Array.isArray(kit?.tokens) ? kit.tokens : [];
    tokens.forEach((token) => {
      if (!/^[a-z][a-z0-9.-]+$/i.test(token.name || "")) issues.push({ code: "name", message: `Tên token chưa chuẩn: ${token.name || "trống"}` });
      if (names.has(token.name)) issues.push({ code: "duplicate", message: `Token bị trùng: ${token.name}` });
      names.add(token.name);
      if (token.type === "color" && !hexToRgb(token.value)) issues.push({ code: "color", message: `Màu không hợp lệ: ${token.name}` });
    });
    const surface = tokens.find((token) => /surface|background/.test(token.name))?.value;
    const foreground = tokens.find((token) => /text.*primary|foreground/.test(token.name))?.value;
    const ratio = contrastRatio(surface, foreground);
    if (ratio != null && ratio < 4.5) issues.push({ code: "contrast", message: `Tương phản chữ chỉ ${ratio.toFixed(2)}:1, nên đạt tối thiểu 4.5:1.` });
    return { issues, ratio, status: issues.length ? "attention" : "pass" };
  }

  function buildDtcgTokens(kit) {
    const output = { $description: `HH Brand Universe · ${text(kit?.name, 120, "Brand Kit")}` };
    (kit?.tokens || []).forEach((token) => {
      const parts = String(token.name || "token").split(".").filter(Boolean);
      let cursor = output;
      parts.slice(0, -1).forEach((part) => { cursor[part] ||= {}; cursor = cursor[part]; });
      cursor[parts.at(-1) || "token"] = { $type: token.type === "dimension" ? "dimension" : token.type || "string", $value: token.value, $description: token.description || "" };
    });
    return { $schema: "https://www.designtokens.org/tr/2025.10/format/", ...output };
  }
  function buildCssTokens(kit) {
    return `:root {\n${(kit?.tokens || []).map((token) => `  --${String(token.name).replace(/[^a-z0-9_-]+/gi, "-")}: ${token.value};`).join("\n")}\n}\n`;
  }

  function buildOtioTimeline(video, projectName = "HH Timeline") {
    const clips = Array.isArray(video?.timeline) ? video.timeline : [];
    const children = clips.map((clip) => ({
      OTIO_SCHEMA: "Clip.2", name: text(clip.name, 180, "Clip"),
      source_range: { OTIO_SCHEMA: "TimeRange.1", start_time: { OTIO_SCHEMA: "RationalTime.1", value: Number(clip.in || 0) * 30, rate: 30 }, duration: { OTIO_SCHEMA: "RationalTime.1", value: Math.max(0, Number(clip.out || clip.duration || 0) - Number(clip.in || 0)) * 30, rate: 30 } },
      media_references: { DEFAULT_MEDIA: { OTIO_SCHEMA: "ExternalReference.1", target_url: `hhasset://${clip.assetId}`, available_range: null, metadata: { checksum: clip.checksum || "" } } },
      active_media_reference_key: "DEFAULT_MEDIA", metadata: { hhClipId: clip.id, kind: clip.kind || "video" }
    }));
    return {
      OTIO_SCHEMA: "Timeline.1", name: text(projectName, 180, "HH Timeline"), global_start_time: null,
      tracks: { OTIO_SCHEMA: "Stack.1", name: "tracks", children: [{ OTIO_SCHEMA: "Track.1", name: "V1", kind: "Video", children }] },
      metadata: { generator: "HH Media Production Universe", generatedAt: now(), captions: clone(video?.captions || []), keyframes: clone(video?.keyframes || []) }
    };
  }
  function buildWebVtt(captions) {
    const clock = (seconds) => {
      const safe = Math.max(0, Number(seconds) || 0), hours = Math.floor(safe / 3600), minutes = Math.floor(safe % 3600 / 60), secs = Math.floor(safe % 60), ms = Math.floor((safe % 1) * 1000);
      return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}.${String(ms).padStart(3, "0")}`;
    };
    return `WEBVTT\n\n${(captions || []).map((item, index) => `${index + 1}\n${clock(item.start)} --> ${clock(item.end)}\n${String(item.text || "").replace(/[\r\n]+/g, " ")}\n`).join("\n")}`;
  }

  function preflightDelivery(state, assets = []) {
    const splitTotal = (state.rights?.splits || []).reduce((sum, item) => sum + Number(item.percent || 0), 0);
    const checks = [
      { id: "project", label: "Tên và ID dự án", status: state.project?.name && state.project?.id ? "pass" : "block", detail: state.project?.name || "Thiếu tên dự án" },
      { id: "assets", label: "Asset khả dụng", status: assets.some((asset) => asset.availability === "offline") ? "block" : "pass", detail: `${assets.length} asset · ${assets.filter((asset) => asset.availability === "offline").length} offline` },
      { id: "checksum", label: "Checksum", status: assets.some((asset) => !asset.checksum) ? "warn" : "pass", detail: `${assets.filter((asset) => asset.checksum).length}/${assets.length} đã xác minh` },
      { id: "rights", label: "Tác quyền bằng 100%", status: Math.abs(splitTotal - 100) < .001 ? "pass" : "block", detail: `${splitTotal}%` },
      { id: "license", label: "License và consent", status: assets.some((asset) => !asset.license) ? "warn" : "pass", detail: `${assets.filter((asset) => asset.license).length}/${assets.length} có license` },
      { id: "review", label: "Review đã xử lý", status: (state.review?.comments || []).some((item) => item.status !== "resolved") ? "warn" : "pass", detail: `${(state.review?.comments || []).filter((item) => item.status !== "resolved").length} comment mở` }
    ];
    return { checks, blockers: checks.filter((item) => item.status === "block").length, warnings: checks.filter((item) => item.status === "warn").length, status: checks.some((item) => item.status === "block") ? "blocked" : checks.some((item) => item.status === "warn") ? "attention" : "ready", createdAt: now() };
  }

  function flattenDtcgTokens(value, path = [], result = []) {
    if (!value || typeof value !== "object") return result;
    if (Object.prototype.hasOwnProperty.call(value, "$value")) {
      result.push({ id: uid("token"), name: path.join("."), value: typeof value.$value === "string" ? value.$value : JSON.stringify(value.$value), type: value.$type || "string", description: value.$description || "" });
      return result;
    }
    Object.entries(value).forEach(([key, child]) => { if (!key.startsWith("$")) flattenDtcgTokens(child, [...path, key], result); });
    return result;
  }

  const workspaceMeta = (id) => ({
    "video-workspace": { code: "VM", eyebrow: "VIDEO & MOTION", title: "Timeline Nebula", summary: "Source monitor, timeline, motion, color, caption và WebM trên thiết bị.", accent: "#a877ff" },
    "document-workspace": { code: "DU", eyebrow: "DOCUMENTS", title: "Document Observatory", summary: "Xem, sắp trang, trích text, watermark, gộp và xuất PDF thật.", accent: "#55efd2" },
    "brand-workspace": { code: "BU", eyebrow: "BRAND UNIVERSE", title: "Design System Forge", summary: "Multi-brand, DTCG token, live preview, lint và handoff.", accent: "#ffbd59" },
    "asset-workspace": { code: "AG", eyebrow: "ASSET GALAXY", title: "Verified Media Library", summary: "IndexedDB, SHA-256, metadata, collection, duplicate và provenance.", accent: "#5ca7ff" },
    "export-workspace": { code: "DC", eyebrow: "DELIVERY CENTER", title: "Release Mission Control", summary: "Preflight, codec capability, job spec, manifest và gói dự án.", accent: "#ffe36d" }
  })[id];

  function shellMarkup(session, body) {
    const meta = workspaceMeta(session.workspace);
    return `<section class="mpu" data-mpu data-workspace="${session.workspace}" style="--mpu-accent:${meta.accent}">
      <div class="mpu-cosmos" aria-hidden="true"><i></i><i></i><i></i><b></b></div>
      <header class="mpu-topbar"><div class="mpu-brand"><span>${meta.code}</span><div><small>${meta.eyebrow} · UNIVERSAL MEDIA PROJECT</small><h2>${meta.title}</h2><p>${meta.summary}</p></div></div><div class="mpu-top-actions"><span class="mpu-autosave"><i></i> Tự lưu cục bộ</span><button type="button" data-mpu-checkpoint>◇ Checkpoint</button><button type="button" data-mpu-route="/media-design/media-core">Project Core</button></div></header>
      ${body}<div class="mpu-toast" data-mpu-toast role="status" aria-live="polite" hidden></div>
    </section>`;
  }

  function videoMarkup(session) {
    const video = session.state.video;
    const active = video.library.find((item) => item.assetId === video.activeAssetId) || video.library.at(-1);
    const duration = Number(active?.duration || 0), out = Number(video.marks?.out || duration || 0);
    return shellMarkup(session, `<div class="mpu-video-layout">
      <aside class="mpu-panel mpu-bin"><header><div><small>SOURCE BIN</small><strong>${video.library.length} nguồn</strong></div><label>＋ Import<input type="file" accept="video/*,audio/*,image/*" multiple data-mpu-video-import></label></header><div class="mpu-bin-list">${video.library.map((item) => `<button type="button" class="${item.assetId === active?.assetId ? "is-active" : ""}" data-mpu-video-source="${item.assetId}"><i>${item.kind === "video" ? "▶" : item.kind === "audio" ? "♫" : "▧"}</i><span><strong>${escapeHtml(item.name)}</strong><small>${formatTime(item.duration)} · ${formatBytes(item.size)}</small></span></button>`).join("") || `<div class="mpu-empty"><i>✦</i><strong>Chưa có footage</strong><p>Thả video vào để tạo source monitor và timeline thật.</p></div>`}</div><footer><button type="button" data-mpu-video-otio ${video.timeline.length ? "" : "disabled"}>Xuất OTIO JSON</button><button type="button" data-mpu-video-vtt ${video.captions.length ? "" : "disabled"}>WebVTT</button></footer></aside>
      <main class="mpu-video-main"><section class="mpu-monitor"><header><div><span>SOURCE / PROGRAM</span><b data-mpu-video-time>${formatTime(0)} / ${formatTime(duration)}</b></div><div><button type="button" data-mpu-video-frame ${active ? "" : "disabled"}>Ảnh khung hình</button><button type="button" class="is-primary" data-mpu-video-render ${active ? "" : "disabled"}>Render vùng chọn</button></div></header><div class="mpu-monitor-stage"><canvas data-mpu-video-canvas width="1280" height="720"></canvas><video data-mpu-video-player playsinline preload="metadata" hidden></video><div class="mpu-monitor-placeholder" ${active ? "hidden" : ""}><span>VM</span><strong>Import footage để bắt đầu</strong><small>File được lưu trong Global Media Bin trên thiết bị.</small></div></div><div class="mpu-transport"><button type="button" data-mpu-video-play ${active ? "" : "disabled"}>▶</button><button type="button" data-mpu-video-mark="in" ${active ? "" : "disabled"}>I · Mark In</button><input type="range" min="0" max="${duration || 1}" step=".01" value="0" data-mpu-video-scrub ${active ? "" : "disabled"}><button type="button" data-mpu-video-mark="out" ${active ? "" : "disabled"}>O · Mark Out</button><button type="button" data-mpu-video-insert ${active ? "" : "disabled"}>＋ Timeline</button></div></section>
        <section class="mpu-timeline"><header><div><strong>Editorial Timeline</strong><small>${video.timeline.length} clip · In ${formatTime(video.marks?.in || 0)} · Out ${formatTime(out)}</small></div><div><button type="button" data-mpu-video-keyframe ${active ? "" : "disabled"}>◆ Keyframe</button><button type="button" data-mpu-video-caption ${active ? "" : "disabled"}>CC Caption</button></div></header><div class="mpu-ruler">${[0, .25, .5, .75, 1].map((ratio) => `<span style="left:${ratio * 100}%">${formatTime(duration * ratio)}</span>`).join("")}<i data-mpu-playhead></i></div><div class="mpu-track"><b>V1</b><div>${video.timeline.map((clip) => `<article style="--clip:${Math.max(12, ((clip.out - clip.in) / Math.max(1, video.timeline.reduce((sum, item) => sum + Math.max(.1, item.out - item.in), 0))) * 100)}%" data-mpu-timeline-clip="${clip.id}"><span>${escapeHtml(clip.name)}</span><small>${formatTime(clip.in)} → ${formatTime(clip.out)}</small><button type="button" data-mpu-remove-clip="${clip.id}">×</button></article>`).join("") || "<p>Kéo nguồn vào timeline bằng nút ＋ Timeline.</p>"}</div></div><div class="mpu-track is-motion"><b>FX</b><div>${video.keyframes.map((keyframe) => `<i style="left:${duration ? keyframe.time / duration * 100 : 0}%" title="${formatTime(keyframe.time)}"></i>`).join("")}</div></div><div class="mpu-track is-caption"><b>CC</b><div>${video.captions.map((caption) => `<article style="left:${duration ? caption.start / duration * 100 : 0}%;width:${duration ? Math.max(4, (caption.end - caption.start) / duration * 100) : 10}%"><span>${escapeHtml(caption.text)}</span></article>`).join("")}</div></div></section>
      </main>
      <aside class="mpu-panel mpu-video-inspector"><nav><button class="is-active" type="button">Motion</button><button type="button">Color</button><button type="button">Caption</button></nav><section><small>MOTION TRANSFORM</small>${[["x","X","px",-400,400],["y","Y","px",-300,300],["scale","Scale","%",20,300],["rotation","Rotate","°",-180,180],["opacity","Opacity","%",0,100]].map(([key,label,unit,min,max]) => `<label><span>${label}<b data-mpu-value="${key}">${video.transform[key]}${unit}</b></span><input type="range" min="${min}" max="${max}" step="1" value="${video.transform[key]}" data-mpu-video-transform="${key}"></label>`).join("")}</section><section><small>COLOR RECIPE</small>${[["exposure","Exposure"," EV",-2,2,.05],["contrast","Contrast","%",50,180,1],["saturation","Saturation","%",0,200,1],["temperature","Temperature","",-100,100,1]].map(([key,label,unit,min,max,step]) => `<label><span>${label}<b data-mpu-value="${key}">${video.color[key]}${unit}</b></span><input type="range" min="${min}" max="${max}" step="${step}" value="${video.color[key]}" data-mpu-video-color="${key}"></label>`).join("")}</section><section class="mpu-capability"><small>BROWSER ENGINE</small><p><i class="${typeof scope.MediaRecorder === "function" ? "is-ready" : ""}"></i> MediaRecorder ${typeof scope.MediaRecorder === "function" ? "sẵn sàng" : "không khả dụng"}</p><p><i class="${typeof scope.VideoEncoder === "function" ? "is-ready" : ""}"></i> WebCodecs ${typeof scope.VideoEncoder === "function" ? "sẵn sàng" : "fallback canvas"}</p></section></aside>
    </div>`);
  }

  function documentsMarkup(session) {
    const docs = session.state.documents;
    const active = docs.jobs.find((item) => item.id === docs.activeId) || docs.jobs.at(-1);
    const pages = Math.max(1, Number(active?.pages || 1)), page = clamp(docs.page || 1, 1, pages);
    return shellMarkup(session, `<div class="mpu-document-layout"><aside class="mpu-panel mpu-document-inbox"><header><div><small>DOCUMENT INBOX</small><strong>${docs.jobs.length} tài liệu</strong></div><label>＋ Mở file<input type="file" accept=".pdf,.txt,.md,.csv,.json,image/*" multiple data-mpu-document-import></label></header><div>${docs.jobs.map((item) => `<button type="button" class="${item.id === active?.id ? "is-active" : ""}" data-mpu-document-open="${item.id}"><i>${item.kind === "pdf" ? "PDF" : item.kind === "image" ? "IMG" : "TXT"}</i><span><strong>${escapeHtml(item.name)}</strong><small>${item.pages || 1} trang · ${formatBytes(item.size)}</small></span><b>${item.status === "ready" ? "✓" : "…"}</b></button>`).join("") || `<div class="mpu-empty"><i>DU</i><strong>Hộp tài liệu trống</strong><p>PDF.js dùng để render và trích text; pdf-lib xử lý trang ngay trên thiết bị.</p></div>`}</div><footer><button type="button" data-mpu-document-merge ${docs.jobs.length ? "" : "disabled"}>Gộp tất cả PDF</button><button type="button" data-mpu-document-text ${active?.kind === "pdf" ? "" : "disabled"}>Trích text</button></footer></aside><main class="mpu-document-stage"><header><div><small>DOCUMENT VIEWER</small><strong>${escapeHtml(active?.name || "Chưa chọn tài liệu")}</strong></div><div><button type="button" data-mpu-document-page="prev" ${page <= 1 ? "disabled" : ""}>←</button><span>Trang ${page} / ${pages}</span><button type="button" data-mpu-document-page="next" ${page >= pages ? "disabled" : ""}>→</button><button type="button" data-mpu-document-zoom="out">−</button><b data-mpu-document-zoom-label>${session.documentZoom}%</b><button type="button" data-mpu-document-zoom="in">＋</button></div></header><div class="mpu-document-canvas" data-mpu-document-canvas><div class="mpu-monitor-placeholder" ${active ? "hidden" : ""}><span>PDF</span><strong>Mở PDF, ảnh hoặc văn bản</strong><small>Không tải nội dung tài liệu lên máy chủ.</small></div></div><footer><span data-mpu-document-status>${active ? "Đang chuẩn bị bản xem trước…" : "Sẵn sàng"}</span><button type="button" class="is-primary" data-mpu-document-export ${active ? "" : "disabled"}>Xuất bản xử lý →</button></footer></main><aside class="mpu-panel mpu-document-tools"><header><small>PAGE OPERATIONS</small><strong>Không phá hủy</strong></header><div class="mpu-tool-grid"><button type="button" data-mpu-document-op="rotate-left" ${active?.kind === "pdf" ? "" : "disabled"}>↶<span>Xoay trái</span></button><button type="button" data-mpu-document-op="rotate-right" ${active?.kind === "pdf" ? "" : "disabled"}>↷<span>Xoay phải</span></button><button type="button" data-mpu-document-op="delete" ${active?.kind === "pdf" ? "" : "disabled"}>⌫<span>Bỏ trang</span></button><button type="button" data-mpu-document-op="restore" ${active?.kind === "pdf" ? "" : "disabled"}>◇<span>Khôi phục</span></button></div><section><small>WATERMARK</small><label>Nội dung<input value="${escapeHtml(docs.watermark || "")}" maxlength="80" placeholder="HH Studio" data-mpu-document-watermark></label><label>Độ mờ<input type="range" min="5" max="70" value="${docs.watermarkOpacity || 20}" data-mpu-document-opacity></label></section><section class="mpu-document-queue"><small>OPERATION RECIPE</small>${active ? `<p><i></i>${Object.keys(active.rotations || {}).length} trang xoay</p><p><i></i>${(active.deletedPages || []).length} trang loại khỏi bản xuất</p><p><i></i>${docs.watermark ? "Có watermark" : "Không watermark"}</p>` : "<p>Chưa có recipe.</p>"}</section><section class="mpu-capability"><small>ENGINE</small><p><i class="is-ready"></i> PDF.js viewer</p><p><i class="${scope.PDFLib ? "is-ready" : ""}"></i> pdf-lib editor</p></section></aside></div>`);
  }

  function brandMarkup(session) {
    const brand = session.state.brand;
    const kit = brand.kits.find((item) => item.id === brand.activeKitId) || brand.kits[0];
    const lint = lintBrandKit(kit);
    const colors = (kit.tokens || []).filter((token) => token.type === "color");
    const surface = colors.find((token) => /surface|background/.test(token.name))?.value || "#071225";
    const primary = colors.find((token) => /brand.primary|primary/.test(token.name))?.value || "#56ecff";
    const accent = colors.find((token) => /accent/.test(token.name))?.value || "#ff63d8";
    const foreground = colors.find((token) => /text.primary|foreground/.test(token.name))?.value || "#f3f8ff";
    return shellMarkup(session, `<div class="mpu-brand-layout"><aside class="mpu-panel mpu-brand-kits"><header><div><small>BRAND SYSTEMS</small><strong>${brand.kits.length} kit</strong></div><button type="button" data-mpu-brand-new>＋</button></header><div>${brand.kits.map((item) => `<button type="button" class="${item.id === kit.id ? "is-active" : ""}" data-mpu-brand-kit="${item.id}"><i style="--kit:${item.tokens?.find((token) => token.type === "color")?.value || "#56ecff"}"></i><span><strong>${escapeHtml(item.name)}</strong><small>${item.tokens?.length || 0} token · ${item.modes?.length || 1} mode</small></span></button>`).join("")}</div><section><small>MODES</small><div class="mpu-brand-modes">${(kit.modes || ["Default"]).map((mode) => `<button type="button" class="${mode === brand.activeMode ? "is-active" : ""}" data-mpu-brand-mode="${escapeHtml(mode)}">${escapeHtml(mode)}</button>`).join("")}<button type="button" data-mpu-brand-add-mode>＋ Mode</button></div></section><footer><button type="button" data-mpu-brand-import>Nhập DTCG</button><input type="file" accept="application/json,.json" data-mpu-brand-import-file hidden><button type="button" data-mpu-route="/media-design/brand-kit">Logo Board</button></footer></aside><main class="mpu-brand-main"><header><div><small>DESIGN TOKEN REGISTRY</small><input value="${escapeHtml(kit.name)}" maxlength="100" data-mpu-brand-name aria-label="Tên brand kit"></div><div><button type="button" data-mpu-brand-export="json">DTCG JSON</button><button type="button" class="is-primary" data-mpu-brand-export="css">CSS Variables</button></div></header><form class="mpu-token-form" data-mpu-token-form><input name="name" required placeholder="color.brand.secondary"><input name="value" required placeholder="#8b74ff"><select name="type"><option value="color">Color</option><option value="dimension">Dimension</option><option value="fontFamily">Font family</option><option value="number">Number</option><option value="string">String</option></select><button type="submit">＋ Token</button></form><div class="mpu-token-table"><header><span>Token</span><span>Value</span><span>Type</span><span></span></header>${(kit.tokens || []).map((token) => `<article data-token-id="${token.id}"><label><i style="--token:${token.type === "color" ? token.value : primary}"></i><input value="${escapeHtml(token.name)}" data-mpu-token-field="name" aria-label="Tên token"></label><input value="${escapeHtml(token.value)}" data-mpu-token-field="value" aria-label="Giá trị token"><select data-mpu-token-field="type"><option value="color" ${token.type === "color" ? "selected" : ""}>Color</option><option value="dimension" ${token.type === "dimension" ? "selected" : ""}>Dimension</option><option value="fontFamily" ${token.type === "fontFamily" ? "selected" : ""}>Font</option><option value="number" ${token.type === "number" ? "selected" : ""}>Number</option><option value="string" ${token.type === "string" ? "selected" : ""}>String</option></select><button type="button" data-mpu-token-remove="${token.id}" aria-label="Xóa token">×</button></article>`).join("")}</div></main><aside class="mpu-brand-preview"><header><small>LIVE BRAND PREVIEW</small><div><button type="button" data-mpu-preview-device="desktop" class="is-active">Desktop</button><button type="button" data-mpu-preview-device="mobile">Mobile</button></div></header><div class="mpu-preview-frame" style="--preview-surface:${surface};--preview-primary:${primary};--preview-accent:${accent};--preview-text:${foreground}"><nav><b>HH</b><span>Universe</span><button>Khám phá</button></nav><main><small>CREATIVE SYSTEM</small><h3>Biến ý tưởng thành một vũ trụ nhất quán.</h3><p>Live preview dùng trực tiếp token đang chỉnh.</p><button>Bắt đầu sáng tạo</button><i></i></main></div><section class="mpu-lint" data-status="${lint.status}"><header><div><small>BRAND LINT</small><strong>${lint.issues.length ? `${lint.issues.length} vấn đề` : "Đạt kiểm tra"}</strong></div><b>${lint.ratio ? `${lint.ratio.toFixed(2)}:1` : "N/A"}</b></header>${lint.issues.map((issue) => `<p><i></i>${escapeHtml(issue.message)}</p>`).join("") || "<p><i></i>Tên token, màu và tương phản cơ bản đều hợp lệ.</p>"}</section></aside></div>`);
  }

  function assetPreview(asset, url) {
    if (!asset) return `<div class="mpu-asset-hero"><span>AG</span><strong>Chọn một asset để kiểm tra</strong><p>Checksum, metadata và file gốc chỉ lưu trong IndexedDB của trình duyệt.</p></div>`;
    const kind = fileKind(asset.type, asset.name);
    if (kind === "image" && url) return `<img src="${url}" alt="${escapeHtml(asset.name)}">`;
    if (kind === "video" && url) return `<video src="${url}" controls playsinline></video>`;
    if (kind === "audio" && url) return `<div class="mpu-audio-preview"><span>♫</span><strong>${escapeHtml(asset.name)}</strong><audio src="${url}" controls></audio></div>`;
    return `<div class="mpu-asset-hero"><span>${kind.toUpperCase()}</span><strong>${escapeHtml(asset.name)}</strong><p>${escapeHtml(asset.type || "application/octet-stream")}</p></div>`;
  }
  function assetsMarkup(session) {
    const query = session.assetQuery.toLowerCase();
    const items = session.assets.filter((asset) => (!query || `${asset.name} ${(asset.tags || []).join(" ")} ${asset.license || ""}`.toLowerCase().includes(query)) && (session.assetKind === "all" || fileKind(asset.type, asset.name) === session.assetKind));
    const selected = session.assets.find((item) => item.id === session.selectedAssetId) || items[0];
    if (selected) session.selectedAssetId = selected.id;
    const selectedUrl = selected ? session.objectUrls.get(selected.id) : "";
    return shellMarkup(session, `<div class="mpu-asset-layout"><aside class="mpu-panel mpu-collections"><header><small>GALAXY INDEX</small><strong>${session.assets.length} asset</strong></header><button type="button" class="${session.assetKind === "all" ? "is-active" : ""}" data-mpu-asset-kind="all"><i>✦</i>Tất cả <b>${session.assets.length}</b></button>${["image","video","audio","pdf","text"].map((kind) => `<button type="button" class="${session.assetKind === kind ? "is-active" : ""}" data-mpu-asset-kind="${kind}"><i>${{image:"▧",video:"▶",audio:"♫",pdf:"P",text:"T"}[kind]}</i>${{image:"Hình ảnh",video:"Video",audio:"Audio",pdf:"PDF",text:"Văn bản"}[kind]} <b>${session.assets.filter((asset) => fileKind(asset.type, asset.name) === kind).length}</b></button>`).join("")}<section><small>SMART COLLECTIONS</small>${(session.state.assets.collections || []).map((collection) => `<button type="button" data-mpu-collection="${collection.id}"><i>◇</i>${escapeHtml(collection.name)}<b>${escapeHtml(collection.query || "")}</b></button>`).join("")}<button type="button" data-mpu-collection-new>＋ Lưu bộ lọc hiện tại</button></section><footer><button type="button" data-mpu-route="/media-design/media-cloud">Private Cloud</button></footer></aside><main class="mpu-asset-main"><header><div class="mpu-asset-search"><span>⌕</span><input type="search" value="${escapeHtml(session.assetQuery)}" placeholder="Tìm tên, tag, license…" data-mpu-asset-search></div><select data-mpu-asset-sort><option value="recent">Mới nhất</option><option value="name">Tên A–Z</option><option value="size">Dung lượng</option></select><label class="is-primary">＋ Ingest<input type="file" multiple data-mpu-asset-import></label></header><div class="mpu-asset-grid">${items.map((asset) => { const kind = fileKind(asset.type, asset.name), url = session.objectUrls.get(asset.id); return `<button type="button" class="${asset.id === selected?.id ? "is-active" : ""}" data-mpu-asset-select="${asset.id}"><div>${kind === "image" && url ? `<img src="${url}" alt="">` : `<span>${kind === "video" ? "▶" : kind === "audio" ? "♫" : kind === "pdf" ? "PDF" : kind.toUpperCase()}</span>`}<i data-status="${asset.duplicateOf ? "duplicate" : asset.availability || "ready"}"></i></div><strong>${escapeHtml(asset.name)}</strong><small>${formatBytes(asset.size)} · ${(asset.tags || []).slice(0,2).join(" · ") || "chưa có tag"}</small></button>`; }).join("") || `<div class="mpu-empty"><i>AG</i><strong>Không tìm thấy asset</strong><p>Thay bộ lọc hoặc ingest file mới.</p></div>`}</div></main><aside class="mpu-asset-inspector"><div class="mpu-asset-preview">${assetPreview(selected, selectedUrl)}</div>${selected ? `<header><div><small>ENTITY REFERENCE</small><strong>${escapeHtml(selected.name)}</strong></div><span data-status="${selected.duplicateOf ? "duplicate" : "ready"}">${selected.duplicateOf ? "Trùng" : "Verified"}</span></header><section class="mpu-asset-meta"><label>Tags<input value="${escapeHtml((selected.tags || []).join(", "))}" data-mpu-asset-field="tags"></label><label>License<input value="${escapeHtml(selected.license || "")}" placeholder="Owned / CC BY…" data-mpu-asset-field="license"></label><label>Rating<input type="range" min="0" max="5" value="${selected.rating || 0}" data-mpu-asset-field="rating"></label><p><span>SHA-256</span><code>${escapeHtml(selected.checksum || "đang tính")}</code></p><p><span>MIME</span><b>${escapeHtml(selected.type || "unknown")}</b></p><p><span>Kích thước</span><b>${formatBytes(selected.size)}</b></p><p><span>Entity ID</span><code>${escapeHtml(selected.id)}</code></p></section><footer><button type="button" data-mpu-asset-download>Tải file</button><label>Thay thế<input type="file" data-mpu-asset-replace></label><button type="button" data-mpu-asset-manifest>Manifest</button><button type="button" class="is-danger" data-mpu-asset-delete>Xóa</button></footer>` : ""}</aside></div>`);
  }

  function deliveryMarkup(session) {
    const delivery = preflightDelivery(session.state, session.assets);
    const profile = DELIVERY_PROFILES.find((item) => item.id === session.state.export.selectedProfile) || DELIVERY_PROFILES[0];
    session.delivery = delivery;
    return shellMarkup(session, `<div class="mpu-delivery-layout"><aside class="mpu-panel mpu-delivery-targets"><header><small>DELIVERY TARGETS</small><strong>${DELIVERY_PROFILES.length} recipe</strong></header>${DELIVERY_PROFILES.map((item) => `<button type="button" class="${item.id === profile.id ? "is-active" : ""}" data-mpu-delivery-profile="${item.id}"><i>${item.kind === "video" ? "▶" : item.kind === "audio" ? "♫" : "▧"}</i><span><strong>${item.label}</strong><small>${item.width ? `${item.width}×${item.height} · ` : `${item.sampleRate || ""} Hz · `}${escapeHtml(item.mime)}</small></span></button>`).join("")}<section><small>PACKAGE</small><button type="button" data-mpu-delivery-package>◇ Xuất .hhmedia</button><button type="button" data-mpu-delivery-manifest>▤ Release manifest</button></section></aside><main class="mpu-delivery-main"><header><div><small>RELEASE PREFLIGHT</small><h3>${delivery.status === "ready" ? "Sẵn sàng phát hành" : delivery.status === "blocked" ? "Đang bị khóa" : "Cần kiểm tra"}</h3><p>${delivery.blockers} blocker · ${delivery.warnings} cảnh báo · ${session.assets.length} asset</p></div><div class="mpu-readiness" style="--ready:${Math.max(0, 100 - delivery.blockers * 25 - delivery.warnings * 8)}"><strong>${Math.max(0, 100 - delivery.blockers * 25 - delivery.warnings * 8)}</strong><span>/100</span></div></header><section class="mpu-preflight-grid">${delivery.checks.map((check) => `<article data-status="${check.status}"><span>${check.status === "pass" ? "✓" : check.status === "block" ? "!" : "◇"}</span><div><strong>${check.label}</strong><small>${escapeHtml(check.detail)}</small></div><b>${check.status}</b></article>`).join("")}</section><section class="mpu-codec-card"><header><div><small>DEVICE CAPABILITY</small><strong>${profile.label}</strong></div><button type="button" data-mpu-delivery-check>Kiểm tra codec</button></header><div data-mpu-capability-result><p>Chạy kiểm tra để hỏi MediaCapabilities về support, smoothness và power efficiency thật trên thiết bị này.</p></div></section><section class="mpu-job-queue"><header><div><small>DELIVERY QUEUE</small><strong>${session.state.export.jobs.length} job spec</strong></div><button type="button" class="is-primary" data-mpu-delivery-job ${delivery.blockers ? "disabled" : ""}>＋ Tạo job từ recipe</button></header>${session.state.export.jobs.slice().reverse().map((job) => `<article data-status="${job.status}"><span>${job.kind === "audio" ? "♫" : job.kind === "image" ? "▧" : "▶"}</span><div><strong>${escapeHtml(job.name)}</strong><small>${escapeHtml(job.profile)} · ${escapeHtml(job.idempotencyKey || "")}</small></div><b>${escapeHtml(job.status)}</b><div><button type="button" data-mpu-job="spec" data-job-id="${job.id}">Spec</button>${["planned","paused"].includes(job.status) ? `<button type="button" data-mpu-job="${job.status === "paused" ? "resume" : "pause"}" data-job-id="${job.id}">${job.status === "paused" ? "Resume" : "Pause"}</button><button type="button" data-mpu-job="cancel" data-job-id="${job.id}">Cancel</button>` : ""}</div></article>`).join("") || `<div class="mpu-empty"><i>DC</i><strong>Queue đang trống</strong><p>Preflight xong rồi tạo job spec; encode dài hạn vẫn cần external worker.</p></div>`}</section></main><aside class="mpu-delivery-summary"><header><small>RELEASE SUMMARY</small><strong>${profile.label}</strong></header><section><p><span>Container</span><b>${profile.mime.split(";")[0]}</b></p><p><span>Khung hình</span><b>${profile.width ? `${profile.width}×${profile.height}` : "Audio only"}</b></p><p><span>Bitrate</span><b>${profile.bitrate ? `${(profile.bitrate / 1e6).toFixed(1)} Mbps` : "Theo nguồn"}</b></p><p><span>Worker</span><b>${session.state.export.worker?.status === "ready" ? "Connected" : "Chưa kết nối"}</b></p></section><section class="mpu-release-orbit"><i></i><i></i><i></i><b>DC</b><span>Preflight</span><span>Package</span><span>Publish</span></section><section class="mpu-capability"><small>TRUST & PROVENANCE</small><p><i class="is-ready"></i> SHA-256 manifest</p><p><i></i> C2PA cần signer backend</p><p><i class="is-ready"></i> Audit cục bộ</p></section><footer><button type="button" data-mpu-route="/media-design/production-workflow">External Worker</button><button type="button" data-mpu-route="/media-design/review-studio">Review Center</button></footer></aside></div>`);
  }

  function render(session) {
    if (session.workspace === "video-workspace") session.host.innerHTML = videoMarkup(session);
    else if (session.workspace === "document-workspace") session.host.innerHTML = documentsMarkup(session);
    else if (session.workspace === "brand-workspace") session.host.innerHTML = brandMarkup(session);
    else if (session.workspace === "asset-workspace") session.host.innerHTML = assetsMarkup(session);
    else session.host.innerHTML = deliveryMarkup(session);
    afterRender(session);
  }

  function notify(session, message, tone = "success") {
    const node = session.host.querySelector("[data-mpu-toast]");
    if (!node) return;
    node.textContent = message;
    node.dataset.tone = tone;
    node.hidden = false;
    clearTimeout(session.toastTimer);
    session.toastTimer = setTimeout(() => { if (node.isConnected) node.hidden = true; }, 3600);
  }
  function save(session, action, detail = "") {
    if (action) session.professionalApi?.appendAudit?.(session.state, action, detail);
    session.state.updatedAt = now();
    session.state = session.store.save(session.state);
  }
  async function ensureMediaStore(session) {
    if (session.mediaStore) return session.mediaStore;
    if (!session.mediaApi?.createStore) return null;
    session.mediaStore = session.mediaApi.createStore();
    await session.mediaStore.ready();
    const projects = await session.mediaStore.listProjects();
    session.mediaProject = projects[0] || await session.mediaStore.saveProject({ name: session.state.project?.name || "Universal Media Project" });
    session.assets = await session.mediaStore.listAssets(session.mediaProject.id);
    session.assets.forEach((asset) => {
      if (asset.blob instanceof Blob && !session.objectUrls.has(asset.id)) session.objectUrls.set(asset.id, URL.createObjectURL(asset.blob));
    });
    return session.mediaStore;
  }
  async function refreshAssets(session, shouldRender = true) {
    const store = await ensureMediaStore(session);
    if (!store) return [];
    session.assets = await store.listAssets(session.mediaProject.id);
    session.assets.forEach((asset) => { if (asset.blob instanceof Blob && !session.objectUrls.has(asset.id)) session.objectUrls.set(asset.id, URL.createObjectURL(asset.blob)); });
    if (shouldRender) render(session);
    return session.assets;
  }
  async function ingestFiles(session, files, source) {
    const store = await ensureMediaStore(session);
    if (!store) throw new Error("Global Media Bin chưa khả dụng.");
    const records = [];
    for (const file of [...files]) {
      const metadata = await session.mediaApi.extractMetadata(file, scope).catch(() => ({ kind: fileKind(file.type, file.name) }));
      const asset = await store.saveAsset({ projectId: session.mediaProject.id, name: file.name, type: file.type, size: file.size, lastModified: file.lastModified, metadata: { ...metadata, source }, blob: file });
      session.assets.push(asset);
      session.objectUrls.set(asset.id, URL.createObjectURL(file));
      const result = session.professionalApi?.addAssetRecord?.(session.state, { name: file.name, type: file.type, size: file.size, lastModified: file.lastModified, checksum: asset.checksum, source });
      if (result?.state) session.state = result.state;
      records.push({ asset, file });
    }
    save(session, "assets.ingested", `${records.length} file · ${source}`);
    return records;
  }

  function activeVideoClip(session) {
    return session.state.video.library.find((item) => item.assetId === session.state.video.activeAssetId) || session.state.video.library.at(-1);
  }
  function interpolateTransform(videoState, timeValue) {
    const frames = (videoState.keyframes || []).slice().sort((a, b) => a.time - b.time);
    if (!frames.length) return videoState.transform;
    const before = frames.filter((frame) => frame.time <= timeValue).at(-1) || frames[0];
    const after = frames.find((frame) => frame.time >= timeValue) || frames.at(-1);
    if (before === after || after.time === before.time) return before.transform;
    const ratio = (timeValue - before.time) / (after.time - before.time), output = {};
    Object.keys(videoState.transform).forEach((key) => { output[key] = Number(before.transform[key] ?? videoState.transform[key]) + (Number(after.transform[key] ?? videoState.transform[key]) - Number(before.transform[key] ?? videoState.transform[key])) * ratio; });
    return output;
  }
  function drawVideoFrame(session) {
    const canvas = session.host.querySelector("[data-mpu-video-canvas]"), player = session.videoPlayer;
    if (!canvas || !player || player.readyState < 2) return;
    const context = canvas.getContext("2d", { alpha: false }), sourceWidth = player.videoWidth || 1280, sourceHeight = player.videoHeight || 720;
    const ratio = Math.min(1, 1280 / sourceWidth, 720 / sourceHeight);
    canvas.width = Math.max(2, Math.round(sourceWidth * ratio)); canvas.height = Math.max(2, Math.round(sourceHeight * ratio));
    context.save(); context.fillStyle = "#030713"; context.fillRect(0, 0, canvas.width, canvas.height);
    const color = session.state.video.color, transform = interpolateTransform(session.state.video, player.currentTime), brightness = Math.pow(2, Number(color.exposure || 0)) * 100;
    context.filter = `brightness(${brightness}%) contrast(${color.contrast || 100}%) saturate(${color.saturation || 100}%)`;
    context.globalAlpha = clamp(transform.opacity, 0, 100) / 100;
    context.translate(canvas.width / 2 + Number(transform.x || 0) * ratio, canvas.height / 2 + Number(transform.y || 0) * ratio);
    context.rotate(Number(transform.rotation || 0) * Math.PI / 180); context.scale(Number(transform.scale || 100) / 100, Number(transform.scale || 100) / 100);
    context.drawImage(player, -canvas.width / 2, -canvas.height / 2, canvas.width, canvas.height); context.restore();
    if (Number(color.temperature || 0)) { context.fillStyle = Number(color.temperature) > 0 ? `rgba(255,132,48,${Math.abs(color.temperature) / 700})` : `rgba(55,145,255,${Math.abs(color.temperature) / 700})`; context.fillRect(0, 0, canvas.width, canvas.height); }
    const caption = session.state.video.captions.find((item) => player.currentTime >= item.start && player.currentTime <= item.end);
    if (caption) {
      context.font = `700 ${Math.max(22, canvas.width / 34)}px system-ui`; context.textAlign = "center"; context.textBaseline = "bottom"; context.lineWidth = 7; context.strokeStyle = "rgba(0,0,0,.78)"; context.fillStyle = "#fff";
      context.strokeText(caption.text, canvas.width / 2, canvas.height - 34, canvas.width * .88); context.fillText(caption.text, canvas.width / 2, canvas.height - 34, canvas.width * .88);
    }
    const timeNode = session.host.querySelector("[data-mpu-video-time]"), scrub = session.host.querySelector("[data-mpu-video-scrub]"), playhead = session.host.querySelector("[data-mpu-playhead]");
    if (timeNode) timeNode.textContent = `${formatTime(player.currentTime)} / ${formatTime(player.duration)}`;
    if (scrub && !session.scrubbing) scrub.value = String(player.currentTime);
    if (playhead) playhead.style.left = `${player.duration ? player.currentTime / player.duration * 100 : 0}%`;
  }
  function startVideoLoop(session) {
    cancelAnimationFrame(session.videoRaf);
    const tick = () => { if (!scope.document?.hidden) drawVideoFrame(session); session.videoRaf = requestAnimationFrame(tick); };
    session.videoRaf = requestAnimationFrame(tick);
  }
  function bindVideo(session) {
    const clip = activeVideoClip(session), player = session.host.querySelector("[data-mpu-video-player]");
    session.videoPlayer = player;
    if (!clip || !player) return;
    const url = session.objectUrls.get(clip.assetId);
    if (!url) return;
    player.src = url;
    player.addEventListener("loadedmetadata", () => {
      clip.duration = Number(player.duration || clip.duration || 0);
      if (!session.state.video.marks.out || session.state.video.marks.out > clip.duration) session.state.video.marks.out = clip.duration;
      const scrub = session.host.querySelector("[data-mpu-video-scrub]"); if (scrub) scrub.max = String(clip.duration || 1);
      drawVideoFrame(session); save(session);
    }, { once: true });
    player.addEventListener("ended", () => { session.host.querySelector("[data-mpu-video-play]").textContent = "▶"; });
    startVideoLoop(session);
  }
  async function renderVideoRange(session) {
    const player = session.videoPlayer, canvas = session.host.querySelector("[data-mpu-video-canvas]");
    if (!player || !canvas || typeof canvas.captureStream !== "function" || typeof scope.MediaRecorder !== "function") throw new Error("Trình duyệt chưa hỗ trợ Canvas capture + MediaRecorder.");
    const start = clamp(session.state.video.marks.in, 0, player.duration), end = clamp(session.state.video.marks.out || player.duration, start + .05, player.duration);
    player.currentTime = start;
    await new Promise((resolve) => player.addEventListener("seeked", resolve, { once: true }));
    const canvasStream = canvas.captureStream(30), sourceStream = player.captureStream?.() || player.mozCaptureStream?.();
    sourceStream?.getAudioTracks?.().forEach((track) => canvasStream.addTrack(track));
    const mime = ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"].find((item) => scope.MediaRecorder.isTypeSupported?.(item)) || "";
    const recorder = new scope.MediaRecorder(canvasStream, mime ? { mimeType: mime, videoBitsPerSecond: 8_000_000 } : undefined), chunks = [];
    recorder.ondataavailable = (event) => { if (event.data?.size) chunks.push(event.data); };
    const completed = new Promise((resolve, reject) => { recorder.onerror = (event) => reject(event.error || new Error("MediaRecorder thất bại.")); recorder.onstop = resolve; });
    recorder.start(250); await player.play();
    await new Promise((resolve) => { const timer = setInterval(() => { if (player.currentTime >= end || player.ended) { clearInterval(timer); resolve(); } }, 40); });
    player.pause(); recorder.stop(); await completed; canvasStream.getTracks().forEach((track) => track.stop());
    const clip = activeVideoClip(session), blob = new Blob(chunks, { type: mime || "video/webm" });
    downloadBlob(blob, `${safeFileName(clip?.name, "hh-video")}-selection.webm`);
    return blob;
  }

  async function loadPdfJs(session) {
    if (session.pdfjs) return session.pdfjs;
    session.pdfjs = await import("./vendor/pdf.min.mjs?v=4.10.38");
    if (session.pdfjs.GlobalWorkerOptions) session.pdfjs.GlobalWorkerOptions.workerSrc = "./vendor/pdf.worker.min.mjs?v=4.10.38";
    return session.pdfjs;
  }
  async function getDocumentRecord(session, item) {
    if (!item) return null;
    if (session.documents.has(item.id)) return session.documents.get(item.id);
    const asset = session.assets.find((value) => value.id === item.assetId);
    if (!asset?.blob) return null;
    const record = { blob: asset.blob, bytes: new Uint8Array(await asset.blob.arrayBuffer()), kind: item.kind };
    if (item.kind === "pdf") {
      const pdfjs = await loadPdfJs(session); record.pdf = await pdfjs.getDocument({ data: record.bytes.slice() }).promise; item.pages = record.pdf.numPages;
    }
    session.documents.set(item.id, record); return record;
  }
  async function renderDocumentPreview(session) {
    const docs = session.state.documents, item = docs.jobs.find((value) => value.id === docs.activeId) || docs.jobs.at(-1), stage = session.host.querySelector("[data-mpu-document-canvas]"), status = session.host.querySelector("[data-mpu-document-status]");
    if (!item || !stage) return;
    try {
      const record = await getDocumentRecord(session, item); if (!record) throw new Error("File gốc không còn trong Media Bin.");
      stage.innerHTML = "";
      if (item.kind === "pdf") {
        const pageNumber = clamp(docs.page || 1, 1, record.pdf.numPages), page = await record.pdf.getPage(pageNumber), viewport = page.getViewport({ scale: session.documentZoom / 100 * 1.25, rotation: Number(item.rotations?.[pageNumber] || 0) });
        const canvas = document.createElement("canvas"), context = canvas.getContext("2d"); canvas.width = viewport.width; canvas.height = viewport.height; canvas.setAttribute("aria-label", `Trang ${pageNumber} của ${item.name}`); stage.append(canvas); await page.render({ canvasContext: context, viewport }).promise;
        item.pages = record.pdf.numPages; status.textContent = `PDF.js · ${record.pdf.numPages} trang · trang ${pageNumber}${(item.deletedPages || []).includes(pageNumber) ? " · sẽ bỏ khỏi bản xuất" : ""}`;
      } else if (item.kind === "image") {
        const asset = session.assets.find((value) => value.id === item.assetId), image = document.createElement("img"); image.src = session.objectUrls.get(asset.id); image.alt = item.name; stage.append(image); status.textContent = "Ảnh nguồn · có thể xuất thành PDF";
      } else {
        const pre = document.createElement("pre"); pre.textContent = await record.blob.text(); stage.append(pre); status.textContent = "Văn bản local · UTF-8";
      }
      save(session);
    } catch (error) { if (status) status.textContent = error.message; notify(session, error.message, "error"); }
  }
  async function exportProcessedDocuments(session, all = false) {
    if (!scope.PDFLib?.PDFDocument) throw new Error("pdf-lib chưa được tải.");
    const output = await scope.PDFLib.PDFDocument.create(), items = all ? session.state.documents.jobs.filter((item) => item.kind === "pdf") : [session.state.documents.jobs.find((item) => item.id === session.state.documents.activeId)].filter(Boolean);
    if (!items.length) throw new Error("Không có PDF để xuất.");
    for (const item of items) {
      const record = await getDocumentRecord(session, item); if (!record) continue;
      const sourcePdf = await scope.PDFLib.PDFDocument.load(record.bytes.slice()), kept = sourcePdf.getPageIndices().filter((index) => !(item.deletedPages || []).includes(index + 1)), copied = await output.copyPages(sourcePdf, kept);
      copied.forEach((page, index) => {
        const originalPage = kept[index] + 1, rotation = Number(item.rotations?.[originalPage] || 0); if (rotation) page.setRotation(scope.PDFLib.degrees(rotation)); output.addPage(page);
      });
    }
    if (!output.getPageCount()) throw new Error("Recipe đã loại toàn bộ trang.");
    const watermark = text(session.state.documents.watermark, 80), opacity = clamp(session.state.documents.watermarkOpacity || 20, 5, 70) / 100;
    if (watermark) output.getPages().forEach((page) => { const size = page.getSize(); page.drawText(watermark, { x: size.width * .15, y: size.height * .48, size: Math.max(22, size.width / 18), rotate: scope.PDFLib.degrees(32), opacity, color: scope.PDFLib.rgb(.22, .58, .92) }); });
    output.setProducer("HH Document Observatory"); output.setModificationDate(new Date());
    const bytes = await output.save(); downloadBlob(new Blob([bytes], { type: "application/pdf" }), `${safeFileName(session.state.project.name)}-${all ? "merged" : "processed"}.pdf`); return bytes;
  }
  async function extractPdfText(session) {
    const item = session.state.documents.jobs.find((value) => value.id === session.state.documents.activeId), record = await getDocumentRecord(session, item); if (!record?.pdf) throw new Error("Tài liệu hiện tại không phải PDF.");
    const pages = [];
    for (let index = 1; index <= record.pdf.numPages; index += 1) { const page = await record.pdf.getPage(index), content = await page.getTextContent(); pages.push(`--- Trang ${index} ---\n${content.items.map((entry) => entry.str).join(" ")}`); }
    const value = pages.join("\n\n"); downloadText(value, `${safeFileName(item.name)}.txt`, "text/plain;charset=utf-8"); return value;
  }

  function afterRender(session) {
    if (session.workspace === "video-workspace") bindVideo(session);
    if (session.workspace === "document-workspace") renderDocumentPreview(session);
  }

  async function checkMediaCapability(profile) {
    if (!scope.navigator?.mediaCapabilities) return { supported: false, smooth: false, powerEfficient: false, reason: "MediaCapabilities không khả dụng." };
    try {
      if (profile.kind === "video") {
        const config = { video: { contentType: profile.mime.split(",opus").join("").replace(/,?opus/, ""), width: profile.width, height: profile.height, bitrate: profile.bitrate, framerate: profile.fps }, audio: { contentType: "audio/webm;codecs=opus", channels: 2, bitrate: 128000, samplerate: 48000 } };
        for (const type of ["record", "transmission", "webrtc"]) {
          try { return { ...await scope.navigator.mediaCapabilities.encodingInfo({ type, ...config }), method: `MediaCapabilities · ${type}` }; } catch (_) { /* Browser enum support differs; try the next standards-compatible type. */ }
        }
        const supported = Boolean(scope.MediaRecorder?.isTypeSupported?.(profile.mime));
        return { supported, smooth: false, powerEfficient: false, method: "MediaRecorder fallback", reason: supported ? "Codec được MediaRecorder xác nhận; thiết bị chưa cung cấp số liệu smooth/power." : "Codec không được MediaRecorder hỗ trợ." };
      }
      if (profile.kind === "audio") return { supported: typeof scope.AudioContext === "function" || typeof scope.webkitAudioContext === "function", smooth: true, powerEfficient: true };
      const canvas = document.createElement("canvas"); return { supported: canvas.toDataURL(profile.mime).startsWith(`data:${profile.mime}`), smooth: true, powerEfficient: true };
    } catch (error) { return { supported: false, smooth: false, powerEfficient: false, reason: error.message }; }
  }

  function bindEvents(session) {
    const signal = session.controller.signal;
    session.host.addEventListener("click", async (event) => {
      const route = event.target.closest("[data-mpu-route]"); if (route) { session.options.onNavigate?.(route.dataset.mpuRoute); return; }
      if (event.target.closest("[data-mpu-checkpoint]")) { session.state = session.professionalApi.createCheckpoint(session.state, `${workspaceMeta(session.workspace).title} · ${new Date().toLocaleTimeString("vi-VN")}`); save(session); render(session); notify(session, "Đã tạo checkpoint và recovery point."); return; }

      const sourceButton = event.target.closest("[data-mpu-video-source]"); if (sourceButton) { session.state.video.activeAssetId = sourceButton.dataset.mpuVideoSource; const clip = activeVideoClip(session); session.state.video.marks = { in: 0, out: clip?.duration || 0 }; save(session); render(session); return; }
      if (event.target.closest("[data-mpu-video-play]")) { const player = session.videoPlayer; if (!player) return; if (player.paused) { if (player.currentTime < session.state.video.marks.in || player.currentTime >= session.state.video.marks.out) player.currentTime = session.state.video.marks.in || 0; await player.play(); event.target.closest("button").textContent = "Ⅱ"; } else { player.pause(); event.target.closest("button").textContent = "▶"; } return; }
      const mark = event.target.closest("[data-mpu-video-mark]"); if (mark && session.videoPlayer) { const key = mark.dataset.mpuVideoMark; session.state.video.marks[key] = session.videoPlayer.currentTime; if (session.state.video.marks.out <= session.state.video.marks.in) session.state.video.marks.out = Math.min(session.videoPlayer.duration, session.state.video.marks.in + 1); save(session); render(session); notify(session, `Đã đặt Mark ${key.toUpperCase()}.`); return; }
      if (event.target.closest("[data-mpu-video-insert]")) { const clip = activeVideoClip(session); if (!clip) return; session.state.video.timeline.push({ id: uid("clip"), assetId: clip.assetId, name: clip.name, kind: clip.kind, checksum: clip.checksum, in: session.state.video.marks.in || 0, out: session.state.video.marks.out || clip.duration, duration: clip.duration, createdAt: now() }); save(session, "video.clip.inserted", clip.name); render(session); notify(session, "Đã insert vùng chọn vào V1."); return; }
      const removeClip = event.target.closest("[data-mpu-remove-clip]"); if (removeClip) { session.state.video.timeline = session.state.video.timeline.filter((item) => item.id !== removeClip.dataset.mpuRemoveClip); save(session, "video.clip.removed", removeClip.dataset.mpuRemoveClip); render(session); return; }
      if (event.target.closest("[data-mpu-video-keyframe]") && session.videoPlayer) { session.state.video.keyframes.push({ id: uid("keyframe"), time: session.videoPlayer.currentTime, transform: clone(session.state.video.transform), createdAt: now() }); save(session, "video.keyframe.created", formatTime(session.videoPlayer.currentTime)); render(session); notify(session, "Đã thêm motion keyframe."); return; }
      if (event.target.closest("[data-mpu-video-caption]") && session.videoPlayer) { const value = prompt("Nội dung caption:", ""); if (!value) return; const start = session.videoPlayer.currentTime; session.state.video.captions.push({ id: uid("caption"), start, end: Math.min(session.videoPlayer.duration, start + 3), text: text(value, 300) }); save(session, "video.caption.created", value); render(session); return; }
      if (event.target.closest("[data-mpu-video-frame]")) { drawVideoFrame(session); const canvas = session.host.querySelector("[data-mpu-video-canvas]"); canvas.toBlob((blob) => { if (blob) downloadBlob(blob, `${safeFileName(activeVideoClip(session)?.name)}-${formatTime(session.videoPlayer?.currentTime).replace(/:/g, "-")}.png`); }, "image/png"); return; }
      if (event.target.closest("[data-mpu-video-render]")) { try { notify(session, "Đang render vùng chọn theo thời gian thực…", "info"); const blob = await renderVideoRange(session); save(session, "video.selection.rendered", `${blob.size} bytes`); notify(session, `Đã xuất WebM ${formatBytes(blob.size)}.`); } catch (error) { notify(session, error.message, "error"); } return; }
      if (event.target.closest("[data-mpu-video-otio]")) { downloadText(JSON.stringify(buildOtioTimeline(session.state.video, session.state.project.name), null, 2), `${safeFileName(session.state.project.name)}.otio.json`); notify(session, "Đã xuất timeline interchange JSON."); return; }
      if (event.target.closest("[data-mpu-video-vtt]")) { downloadText(buildWebVtt(session.state.video.captions), `${safeFileName(session.state.project.name)}.vtt`, "text/vtt"); return; }

      const openDoc = event.target.closest("[data-mpu-document-open]"); if (openDoc) { session.state.documents.activeId = openDoc.dataset.mpuDocumentOpen; session.state.documents.page = 1; save(session); render(session); return; }
      const pageButton = event.target.closest("[data-mpu-document-page]"); if (pageButton) { const item = session.state.documents.jobs.find((value) => value.id === session.state.documents.activeId), max = item?.pages || 1; session.state.documents.page = clamp(Number(session.state.documents.page || 1) + (pageButton.dataset.mpuDocumentPage === "next" ? 1 : -1), 1, max); save(session); render(session); return; }
      const zoom = event.target.closest("[data-mpu-document-zoom]"); if (zoom) { session.documentZoom = clamp(session.documentZoom + (zoom.dataset.mpuDocumentZoom === "in" ? 10 : -10), 50, 200); render(session); return; }
      const docOp = event.target.closest("[data-mpu-document-op]"); if (docOp) { const item = session.state.documents.jobs.find((value) => value.id === session.state.documents.activeId), page = Number(session.state.documents.page || 1); if (!item) return; item.rotations ||= {}; item.deletedPages ||= []; if (docOp.dataset.mpuDocumentOp === "rotate-left") item.rotations[page] = ((Number(item.rotations[page] || 0) - 90) % 360 + 360) % 360; if (docOp.dataset.mpuDocumentOp === "rotate-right") item.rotations[page] = (Number(item.rotations[page] || 0) + 90) % 360; if (docOp.dataset.mpuDocumentOp === "delete" && !item.deletedPages.includes(page)) item.deletedPages.push(page); if (docOp.dataset.mpuDocumentOp === "restore") { delete item.rotations[page]; item.deletedPages = item.deletedPages.filter((value) => value !== page); } save(session, `document.page.${docOp.dataset.mpuDocumentOp}`, `${item.name} · ${page}`); render(session); return; }
      if (event.target.closest("[data-mpu-document-export]")) { try { await exportProcessedDocuments(session, false); save(session, "document.exported", session.state.documents.activeId); notify(session, "Đã xuất PDF xử lý thật."); } catch (error) { notify(session, error.message, "error"); } return; }
      if (event.target.closest("[data-mpu-document-merge]")) { try { await exportProcessedDocuments(session, true); save(session, "documents.merged", "all"); notify(session, "Đã gộp PDF theo thứ tự Inbox."); } catch (error) { notify(session, error.message, "error"); } return; }
      if (event.target.closest("[data-mpu-document-text]")) { try { await extractPdfText(session); notify(session, "Đã trích text layer của toàn bộ PDF."); } catch (error) { notify(session, error.message, "error"); } return; }

      const kitButton = event.target.closest("[data-mpu-brand-kit]"); if (kitButton) { session.state.brand.activeKitId = kitButton.dataset.mpuBrandKit; save(session); render(session); return; }
      const modeButton = event.target.closest("[data-mpu-brand-mode]"); if (modeButton) { session.state.brand.activeMode = modeButton.dataset.mpuBrandMode; save(session); render(session); return; }
      if (event.target.closest("[data-mpu-brand-new]")) { const name = prompt("Tên brand kit mới:", `Brand ${session.state.brand.kits.length + 1}`); if (!name) return; const base = session.state.brand.kits.find((item) => item.id === session.state.brand.activeKitId) || session.state.brand.kits[0], kit = { id: uid("kit"), name: text(name, 100), modes: ["Default"], tokens: clone(base.tokens || []), components: [], templateLocks: [] }; kit.tokens.forEach((token) => { token.id = uid("token"); }); session.state.brand.kits.push(kit); session.state.brand.activeKitId = kit.id; session.state.brand.activeMode = "Default"; save(session, "brand.kit.created", kit.name); render(session); return; }
      if (event.target.closest("[data-mpu-brand-add-mode]")) { const kit = session.state.brand.kits.find((item) => item.id === session.state.brand.activeKitId), name = prompt("Tên mode:", `Mode ${kit.modes.length + 1}`); if (!name || kit.modes.includes(name)) return; kit.modes.push(text(name, 60)); session.state.brand.activeMode = text(name, 60); save(session, "brand.mode.created", name); render(session); return; }
      const removeToken = event.target.closest("[data-mpu-token-remove]"); if (removeToken) { const kit = session.state.brand.kits.find((item) => item.id === session.state.brand.activeKitId); kit.tokens = kit.tokens.filter((token) => token.id !== removeToken.dataset.mpuTokenRemove); save(session, "brand.token.removed", removeToken.dataset.mpuTokenRemove); render(session); return; }
      const brandExport = event.target.closest("[data-mpu-brand-export]"); if (brandExport) { const kit = session.state.brand.kits.find((item) => item.id === session.state.brand.activeKitId); if (brandExport.dataset.mpuBrandExport === "json") downloadText(JSON.stringify(buildDtcgTokens(kit), null, 2), `${safeFileName(kit.name)}.tokens.json`); else downloadText(buildCssTokens(kit), `${safeFileName(kit.name)}.tokens.css`, "text/css"); save(session, "brand.tokens.exported", brandExport.dataset.mpuBrandExport); notify(session, "Đã xuất design tokens từ dữ liệu thật."); return; }
      if (event.target.closest("[data-mpu-brand-import]")) { session.host.querySelector("[data-mpu-brand-import-file]")?.click(); return; }
      const device = event.target.closest("[data-mpu-preview-device]"); if (device) { session.host.querySelector(".mpu-preview-frame")?.classList.toggle("is-mobile", device.dataset.mpuPreviewDevice === "mobile"); session.host.querySelectorAll("[data-mpu-preview-device]").forEach((button) => button.classList.toggle("is-active", button === device)); return; }

      const kind = event.target.closest("[data-mpu-asset-kind]"); if (kind) { session.assetKind = kind.dataset.mpuAssetKind; render(session); return; }
      const assetButton = event.target.closest("[data-mpu-asset-select]"); if (assetButton) { session.selectedAssetId = assetButton.dataset.mpuAssetSelect; render(session); return; }
      const collection = event.target.closest("[data-mpu-collection]"); if (collection) { const value = session.state.assets.collections.find((item) => item.id === collection.dataset.mpuCollection); session.assetQuery = value?.query || ""; session.assetKind = value?.kind || "all"; render(session); return; }
      if (event.target.closest("[data-mpu-collection-new]")) { const name = prompt("Tên Smart Collection:", "Bộ sưu tập mới"); if (!name) return; session.state.assets.collections.push({ id: uid("collection"), name: text(name, 100), query: session.assetQuery, kind: session.assetKind, createdAt: now() }); save(session, "asset.collection.created", name); render(session); return; }
      if (event.target.closest("[data-mpu-asset-download]")) { const asset = session.assets.find((item) => item.id === session.selectedAssetId); if (asset?.blob) downloadBlob(asset.blob, asset.name); else notify(session, "File gốc đang offline.", "error"); return; }
      if (event.target.closest("[data-mpu-asset-manifest]")) { const asset = session.assets.find((item) => item.id === session.selectedAssetId); if (asset) downloadText(JSON.stringify({ schema: "hh.asset.manifest.v1", entityReference: `hhasset://${asset.id}`, exportedAt: now(), asset: { ...asset, blob: undefined, thumbnailBlob: undefined } }, null, 2), `${safeFileName(asset.name)}.manifest.json`); return; }
      if (event.target.closest("[data-mpu-asset-delete]")) { const asset = session.assets.find((item) => item.id === session.selectedAssetId); if (!asset || !confirm(`Xóa “${asset.name}” khỏi Global Media Bin?`)) return; await session.mediaStore.removeAsset(asset.id); const url = session.objectUrls.get(asset.id); if (url) URL.revokeObjectURL(url); session.objectUrls.delete(asset.id); session.selectedAssetId = ""; save(session, "asset.removed", asset.name); await refreshAssets(session); notify(session, "Đã xóa asset khỏi kho cục bộ."); return; }

      const profileButton = event.target.closest("[data-mpu-delivery-profile]"); if (profileButton) { session.state.export.selectedProfile = profileButton.dataset.mpuDeliveryProfile; save(session); render(session); return; }
      if (event.target.closest("[data-mpu-delivery-check]")) { const profile = DELIVERY_PROFILES.find((item) => item.id === session.state.export.selectedProfile) || DELIVERY_PROFILES[0], resultNode = session.host.querySelector("[data-mpu-capability-result]"); resultNode.innerHTML = "<p>Đang kiểm tra phần cứng và trình duyệt…</p>"; const result = await checkMediaCapability(profile); resultNode.innerHTML = `<div class="mpu-capability-result" data-status="${result.supported ? "pass" : "block"}"><span>${result.supported ? "✓" : "!"}</span><p><strong>${result.supported ? "Codec được hỗ trợ" : "Codec chưa được hỗ trợ"}</strong><small>Smooth: ${result.smooth ? "Có" : "Chưa xác nhận"} · Power efficient: ${result.powerEfficient ? "Có" : "Chưa xác nhận"}${result.reason ? ` · ${escapeHtml(result.reason)}` : ""}</small></p></div>`; return; }
      if (event.target.closest("[data-mpu-delivery-job]")) { const profile = DELIVERY_PROFILES.find((item) => item.id === session.state.export.selectedProfile) || DELIVERY_PROFILES[0], id = uid("delivery"), spec = { id, name: `${session.state.project.name} · ${profile.label}`, profile: profile.id, kind: profile.kind, status: "planned", progress: 0, idempotencyKey: session.professionalApi.stableHash?.(`${session.state.project.id}:${profile.id}:${now()}`) || id, recipe: clone(profile), createdAt: now() }; session.state.export.jobs.push(spec); save(session, "delivery.job.created", spec.name); render(session); notify(session, "Đã tạo job spec; chưa phát sinh encode hoặc chi phí."); return; }
      const jobButton = event.target.closest("[data-mpu-job]"); if (jobButton) { const job = session.state.export.jobs.find((item) => item.id === jobButton.dataset.jobId), action = jobButton.dataset.mpuJob; if (!job) return; if (action === "spec") { downloadText(JSON.stringify({ schema: "hh.delivery.job.v1", projectId: session.state.project.id, ...job }, null, 2), `${safeFileName(job.name)}.job.json`); return; } if (action === "pause" && job.status === "planned") job.status = "paused"; if (action === "resume" && job.status === "paused") job.status = "planned"; if (action === "cancel") job.status = "canceled"; save(session, `delivery.job.${action}`, job.id); render(session); return; }
      if (event.target.closest("[data-mpu-delivery-package]")) { try { const payload = await session.mediaStore.exportPackage(session.mediaProject.id); downloadText(payload, `${safeFileName(session.state.project.name)}.hhmedia`, "application/vnd.hh.media+json"); save(session, "delivery.package.exported", session.mediaProject.id); notify(session, "Đã đóng gói project và asset nhỏ vào .hhmedia."); } catch (error) { notify(session, error.message, "error"); } return; }
      if (event.target.closest("[data-mpu-delivery-manifest]")) { const manifest = { schema: "hh.release.manifest.v1", project: { id: session.state.project.id, name: session.state.project.name }, generatedAt: now(), preflight: session.delivery, profile: DELIVERY_PROFILES.find((item) => item.id === session.state.export.selectedProfile), assets: session.assets.map((asset) => ({ entityReference: `hhasset://${asset.id}`, name: asset.name, type: asset.type, size: asset.size, checksum: asset.checksum, license: asset.license || "unverified" })), jobs: session.state.export.jobs }; downloadText(JSON.stringify(manifest, null, 2), `${safeFileName(session.state.project.name)}.release.json`); save(session, "delivery.manifest.exported", manifest.assets.length); notify(session, "Đã xuất release manifest với checksum thật."); }
    }, { signal });

    session.host.addEventListener("submit", (event) => {
      if (event.target.matches("[data-mpu-token-form]")) { event.preventDefault(); const data = new FormData(event.target), kit = session.state.brand.kits.find((item) => item.id === session.state.brand.activeKitId); kit.tokens.push({ id: uid("token"), name: text(data.get("name"), 120), value: text(data.get("value"), 180), type: text(data.get("type"), 40, "string") }); save(session, "brand.token.created", data.get("name")); render(session); notify(session, "Đã thêm token và cập nhật live preview."); }
    }, { signal });

    session.host.addEventListener("input", (event) => {
      if (event.target.matches("[data-mpu-video-scrub]") && session.videoPlayer) { session.scrubbing = true; session.videoPlayer.currentTime = Number(event.target.value); drawVideoFrame(session); return; }
      const transform = event.target.dataset.mpuVideoTransform; if (transform) { session.state.video.transform[transform] = Number(event.target.value); const label = session.host.querySelector(`[data-mpu-value="${transform}"]`); if (label) label.textContent = `${event.target.value}${["x","y"].includes(transform) ? "px" : transform === "rotation" ? "°" : "%"}`; drawVideoFrame(session); save(session); return; }
      const color = event.target.dataset.mpuVideoColor; if (color) { session.state.video.color[color] = Number(event.target.value); const label = session.host.querySelector(`[data-mpu-value="${color}"]`); if (label) label.textContent = `${event.target.value}${color === "exposure" ? " EV" : ["contrast","saturation"].includes(color) ? "%" : ""}`; drawVideoFrame(session); save(session); return; }
      if (event.target.matches("[data-mpu-document-watermark]")) { session.state.documents.watermark = text(event.target.value, 80); save(session); return; }
      if (event.target.matches("[data-mpu-document-opacity]")) { session.state.documents.watermarkOpacity = Number(event.target.value); save(session); return; }
      if (event.target.matches("[data-mpu-asset-search]")) { session.assetQuery = event.target.value; clearTimeout(session.searchTimer); session.searchTimer = setTimeout(() => render(session), 120); }
    }, { signal });
    session.host.addEventListener("pointerup", () => { session.scrubbing = false; }, { signal });

    session.host.addEventListener("change", async (event) => {
      if (event.target.matches("[data-mpu-video-import]")) { try { const records = await ingestFiles(session, event.target.files, "video-workspace"); for (const { asset, file } of records) { const kind = fileKind(file.type, file.name); if (!["video","audio","image"].includes(kind)) continue; const clip = { id: uid("source"), assetId: asset.id, name: file.name, kind, size: file.size, checksum: asset.checksum, duration: 0, createdAt: now() }; if (kind === "video" || kind === "audio") { const media = document.createElement(kind === "video" ? "video" : "audio"); media.preload = "metadata"; media.src = session.objectUrls.get(asset.id); await new Promise((resolve) => { media.onloadedmetadata = resolve; media.onerror = resolve; }); clip.duration = Number(media.duration || 0); } session.state.video.library.push(clip); session.state.video.activeAssetId = asset.id; session.state.video.marks = { in: 0, out: clip.duration }; } save(session, "video.sources.imported", records.length); render(session); notify(session, `Đã import ${records.length} nguồn vào Media Bin.`); } catch (error) { notify(session, error.message, "error"); } event.target.value = ""; return; }
      if (event.target.matches("[data-mpu-document-import]")) { try { const records = await ingestFiles(session, event.target.files, "document-workspace"); for (const { asset, file } of records) { const kind = fileKind(file.type, file.name); if (!["pdf","image","text"].includes(kind)) continue; const job = { id: uid("document"), assetId: asset.id, name: file.name, kind, type: file.type, size: file.size, pages: 1, status: "ready", rotations: {}, deletedPages: [], createdAt: now() }; session.state.documents.jobs.push(job); session.state.documents.activeId = job.id; if (kind === "pdf") { const record = await getDocumentRecord(session, job); if (record?.pdf) job.pages = record.pdf.numPages; } } save(session, "documents.imported", records.length); render(session); notify(session, `Đã đăng ký ${records.length} tài liệu.`); } catch (error) { notify(session, error.message, "error"); } event.target.value = ""; return; }
      if (event.target.matches("[data-mpu-brand-name]")) { const kit = session.state.brand.kits.find((item) => item.id === session.state.brand.activeKitId); kit.name = text(event.target.value, 100, "Brand Kit"); save(session, "brand.kit.renamed", kit.name); render(session); return; }
      const tokenField = event.target.dataset.mpuTokenField; if (tokenField) { const row = event.target.closest("[data-token-id]"), kit = session.state.brand.kits.find((item) => item.id === session.state.brand.activeKitId), token = kit.tokens.find((item) => item.id === row?.dataset.tokenId); if (token) { token[tokenField] = text(event.target.value, 180); save(session, "brand.token.updated", token.name); render(session); } return; }
      if (event.target.matches("[data-mpu-brand-import-file]")) { try { const value = JSON.parse(await event.target.files?.[0]?.text()), tokens = flattenDtcgTokens(value); if (!tokens.length) throw new Error("Không tìm thấy token DTCG ($value)."); const kit = session.state.brand.kits.find((item) => item.id === session.state.brand.activeKitId); kit.tokens = tokens; save(session, "brand.tokens.imported", tokens.length); render(session); notify(session, `Đã nhập ${tokens.length} token DTCG.`); } catch (error) { notify(session, error.message, "error"); } event.target.value = ""; return; }
      if (event.target.matches("[data-mpu-asset-import]")) { try { const records = await ingestFiles(session, event.target.files, "asset-galaxy"); await refreshAssets(session); notify(session, `Đã ingest ${records.length} asset với SHA-256.`); } catch (error) { notify(session, error.message, "error"); } event.target.value = ""; return; }
      if (event.target.matches("[data-mpu-asset-replace]")) { const file = event.target.files?.[0], asset = session.assets.find((item) => item.id === session.selectedAssetId); if (!file || !asset) return; try { const metadata = await session.mediaApi.extractMetadata(file, scope); await session.mediaStore.replaceAsset(asset.id, { name: file.name, type: file.type, blob: file, lastModified: file.lastModified, metadata }); const oldUrl = session.objectUrls.get(asset.id); if (oldUrl) URL.revokeObjectURL(oldUrl); session.objectUrls.set(asset.id, URL.createObjectURL(file)); save(session, "asset.replaced", asset.id); await refreshAssets(session); notify(session, "Đã thay file nhưng giữ nguyên Entity ID."); } catch (error) { notify(session, error.message, "error"); } event.target.value = ""; return; }
      const assetField = event.target.dataset.mpuAssetField; if (assetField) { const asset = session.assets.find((item) => item.id === session.selectedAssetId); if (!asset) return; const patch = assetField === "tags" ? { tags: event.target.value.split(",").map((item) => text(item, 40)).filter(Boolean).slice(0, 30) } : { [assetField]: assetField === "rating" ? Number(event.target.value) : text(event.target.value, 160) }; try { await session.mediaStore.updateAsset(asset.id, patch); save(session, "asset.metadata.updated", `${asset.id}:${assetField}`); await refreshAssets(session); notify(session, "Đã cập nhật metadata asset."); } catch (error) { notify(session, error.message, "error"); } }
    }, { signal });

    session.host.addEventListener("dragover", (event) => { if (session.workspace === "video-workspace" || session.workspace === "asset-workspace" || session.workspace === "document-workspace") event.preventDefault(); }, { signal });
    session.host.addEventListener("drop", async (event) => {
      const files = [...(event.dataTransfer?.files || [])]; if (!files.length) return; event.preventDefault();
      const input = session.host.querySelector(session.workspace === "video-workspace" ? "[data-mpu-video-import]" : session.workspace === "document-workspace" ? "[data-mpu-document-import]" : "[data-mpu-asset-import]");
      if (!input) return;
      const transfer = new DataTransfer(); files.forEach((file) => transfer.items.add(file)); input.files = transfer.files; input.dispatchEvent(new Event("change", { bubbles: true }));
    }, { signal });
  }

  function mount(host, options = {}) {
    if (!host) return null;
    unmount(host);
    const workspace = WORKSPACE_BY_ID[options.workspace || options.toolId] ? (options.workspace || options.toolId) : "video-workspace";
    const professionalApi = options.professionalApi || scope.HHMediaProfessionalSuite;
    const store = professionalApi?.createStateStore?.(options.storage) || { load: () => ({}), save: (value) => value };
    const session = {
      host, options, workspace, professionalApi, mediaApi: options.mediaApi || scope.HHUniversalMediaProject, store,
      state: ensureProductionState(store.load(), professionalApi), controller: new AbortController(), mediaStore: null, mediaProject: null,
      assets: [], objectUrls: new Map(), documents: new Map(), selectedAssetId: "", assetQuery: "", assetKind: "all", documentZoom: 90,
      videoPlayer: null, videoRaf: 0, scrubbing: false, toastTimer: 0, searchTimer: 0
    };
    session.state.lastWorkspace = workspace; session.state = store.save(session.state);
    activeInstances.set(host, session); bindEvents(session); render(session);
    ensureMediaStore(session).then(() => {
      if (!activeInstances.has(host)) return;
      if (["asset-workspace", "export-workspace", "video-workspace", "document-workspace"].includes(workspace)) render(session);
    }).catch((error) => notify(session, `Media Bin: ${error.message}`, "error"));
    return Object.freeze({ getState: () => clone(session.state), getAssets: () => clone(session.assets.map((asset) => ({ ...asset, blob: undefined, thumbnailBlob: undefined }))), refresh: () => refreshAssets(session), unmount: () => unmount(host) });
  }

  function unmount(host) {
    const entries = host ? [[host, activeInstances.get(host)]] : [...activeInstances.entries()];
    entries.forEach(([node, session]) => {
      if (!session) return;
      session.controller.abort(); cancelAnimationFrame(session.videoRaf); clearTimeout(session.toastTimer); clearTimeout(session.searchTimer);
      try { session.videoPlayer?.pause?.(); } catch (_) {}
      session.objectUrls.forEach((url) => { try { URL.revokeObjectURL(url); } catch (_) {} });
      session.mediaStore?.close?.().catch?.(() => {}); node.innerHTML = ""; activeInstances.delete(node);
    });
  }

  return Object.freeze({
    VERSION, WORKSPACE_IDS, WORKSPACE_BY_ID, DELIVERY_PROFILES,
    escapeHtml, formatTime, formatBytes, fileKind, contrastRatio, lintBrandKit,
    buildDtcgTokens, buildCssTokens, buildOtioTimeline, buildWebVtt, preflightDelivery,
    flattenDtcgTokens, ensureProductionState, checkMediaCapability, mount, unmount
  });
});
