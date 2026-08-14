(function initHHComicLibraryBridge(global) {
  "use strict";

  const SCHEMA_VERSION = 1;
  const API_PATH = "/api/modules/comic-motion/actions";
  const MIGRATION_KEY = "hh.comic.motion.bridge.migration.v1";

  const text = (value, max = 500) => String(value ?? "").trim().replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").slice(0, max);
  const safeUrl = (value) => { try { const url = new URL(String(value || ""), global.location?.origin); return url.protocol === "https:" ? url.href : ""; } catch { return ""; } };
  const authHeaders = () => {
    const headers = { "Content-Type": "application/json", Accept: "application/json" };
    const token = global.HHAuthSession?.token?.() || "";
    if (token) headers.Authorization = `Bearer ${token}`;
    return headers;
  };

  async function api(action, payload = {}, signal) {
    const base = String(global.HH_CONFIG?.API_BASE || global.HH_API_ORIGIN || "").replace(/\/$/, "");
    const response = await fetch(`${base}${API_PATH}`, {
      method: "POST", credentials: "include", headers: authHeaders(), signal,
      body: JSON.stringify({ action, ...payload })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.ok !== true) {
      const error = new Error(data.error || `Comic Motion API HTTP ${response.status}`);
      error.code = data.code || "COMIC_MOTION_API_ERROR";
      error.status = response.status;
      throw error;
    }
    return data;
  }

  function localRights(series = {}, chapter = null) {
    const sourceType = text(series.sourceType || "imported", 80).toLowerCase();
    const provider = text(series.provider || sourceType, 80).toLowerCase();
    const licenseCode = text(series.licenseCode || series.license || "UNKNOWN", 80).toUpperCase().replace(/\s+/g, "-");
    const attributionText = text(chapter?.attributionText || chapter?.attribution || series.attributionText || series.attribution, 2000);
    const base = {
      status: "manual-review", licenseCode, licenseUrl: safeUrl(series.licenseUrl),
      sourceUrl: safeUrl(chapter?.sourceUrl || series.sourceUrl), author: text(series.author, 240),
      artist: text(series.artist, 240), translator: text(chapter?.translator, 240),
      scanlationGroup: text(chapter?.group || chapter?.scanlationGroup, 240),
      attributionText, derivativesAllowed: false, commercialUseAllowed: false,
      redistributionAllowed: false, evidenceId: text(series.evidenceId, 160),
      evidenceHash: text(series.evidenceHash, 80), reviewStatus: text(series.reviewStatus || "unreviewed", 40)
    };
    if (["otruyen", "mangadex"].includes(provider)) return base;
    if (/^CC-?0(?:-|$)/.test(licenseCode)) return { ...base, status: "allowed", licenseCode: "CC0-1.0", derivativesAllowed: true, commercialUseAllowed: true, redistributionAllowed: true };
    if (/^CC-?BY-?SA/.test(licenseCode) && attributionText) return { ...base, status: "allowed", licenseCode: licenseCode.replace(/^CCBY/, "CC-BY"), derivativesAllowed: true, commercialUseAllowed: true, redistributionAllowed: true };
    if (/^CC-?BY(?:-|$)/.test(licenseCode) && !/-NC|-ND/.test(licenseCode) && attributionText) return { ...base, status: "allowed", licenseCode: licenseCode.replace(/^CCBY/, "CC-BY"), derivativesAllowed: true, commercialUseAllowed: true, redistributionAllowed: true };
    if (/-ND/.test(licenseCode)) return { ...base, status: "denied" };
    if (/ALL-?RIGHTS/.test(licenseCode)) return { ...base, status: "denied" };
    if (["owned-upload", "local-cbz", "local-zip"].includes(sourceType) && series.ownershipAttestedAt && series.ownershipEvidenceId) {
      return { ...base, status: "allowed", licenseCode: "OWNED-CONTENT", derivativesAllowed: true, commercialUseAllowed: true, redistributionAllowed: true, ownershipAttestedAt: series.ownershipAttestedAt, ownershipEvidenceId: series.ownershipEvidenceId };
    }
    return base;
  }

  function seriesDescriptor(series = {}) {
    return {
      id: text(series.id, 180), title: text(series.title, 240),
      alternativeTitles: (series.alternativeTitles || series.altTitles || []).map((item) => text(item, 240)).filter(Boolean).slice(0, 20),
      author: text(series.author, 240), artist: text(series.artist, 240), cover: safeUrl(series.cover),
      description: text(series.description, 3000), genres: (series.genres || []).map((item) => text(item, 80)).filter(Boolean).slice(0, 40),
      status: text(series.status, 80), provider: text(series.provider || series.sourceType || "imported", 80).toLowerCase(),
      sourceType: text(series.sourceType || "imported", 80).toLowerCase(), sourceUrl: safeUrl(series.sourceUrl),
      updatedAt: series.updatedAt ? new Date(series.updatedAt).toISOString() : null
    };
  }

  function chapterDescriptor(series, chapter = {}, options = {}) {
    const pageCount = Math.min(500, Math.max(0, Number(chapter.pageCount || chapter.pages?.length) || 0));
    const start = Math.max(1, Math.min(pageCount || 1, Number(options.pageStart) || 1));
    const end = Math.max(start, Math.min(pageCount || 500, Number(options.pageEnd) || pageCount || 1));
    return {
      id: text(chapter.id, 180), number: text(chapter.number, 60), title: text(chapter.title, 240),
      sourceUrl: safeUrl(chapter.sourceUrl || chapter.apiUrl),
      providerChapterId: text(chapter.providerChapterId || chapter.remoteChapterId || chapter.id, 180),
      pageCount, estimatedPanelCount: Math.min(2000, Math.max(pageCount, Number(chapter.estimatedPanelCount) || pageCount)),
      updatedAt: chapter.updatedAt ? new Date(chapter.updatedAt).toISOString() : null,
      scanlationGroup: text(chapter.scanlationGroup || chapter.group, 240),
      provider: text(chapter.provider || series.provider || series.sourceType || "imported", 80).toLowerCase(),
      pageRange: options.pageStart || options.pageEnd ? { start, end } : null,
      cleanReaderBlockedPages: (options.cleanReaderBlockedPages || []).map(Number).filter(Number.isInteger).slice(0, 500)
    };
  }

  function descriptor(series, chapters, options = {}) {
    const selected = (Array.isArray(chapters) ? chapters : [chapters]).filter(Boolean);
    if (!series?.id || !selected.length) throw new Error("Hãy chọn truyện và ít nhất một chương.");
    return {
      schemaVersion: SCHEMA_VERSION,
      series: seriesDescriptor(series),
      chapters: selected.map((chapter) => chapterDescriptor(series, chapter, options.pageRanges?.[chapter.id] || options)),
      rights: options.rights || localRights(series, selected.length === 1 ? selected[0] : null),
      learnerProfileId: text(options.learnerProfileId, 180), workspaceId: text(options.workspaceId, 180),
      commercialMode: options.commercialMode !== false,
      preset: { id: text(options.presetId || "youtube-16x9", 120), mode: text(options.mode || "quick-review", 40), format: text(options.format || "16:9", 20) }
    };
  }

  function estimate(input) {
    const chapters = input?.chapters || [];
    const pages = chapters.reduce((sum, chapter) => sum + Number(chapter.pageRange ? chapter.pageRange.end - chapter.pageRange.start + 1 : chapter.pageCount || 0), 0);
    const scenes = chapters.reduce((sum, chapter) => sum + Math.max(Number(chapter.estimatedPanelCount) || 0, Number(chapter.pageCount) || 0), 0);
    return { chapters: chapters.length, pages, scenes, parts: Math.max(chapters.length, chapters.reduce((sum, chapter) => sum + Math.ceil(Math.max(1, Number(chapter.estimatedPanelCount || chapter.pageCount) || 1) / 120), 0)), durationSeconds: scenes * 4, estimatedBytes: scenes * 1_500_000, apiCostUsd: null };
  }

  async function createMotionHandoff(input, signal) {
    const payload = input?.series && input?.chapters ? input : descriptor(input.series, input.chapters, input.options || {});
    const data = await api("library-handoff-create", { descriptor: payload }, signal);
    return data.handoff;
  }

  async function openHandoff(handoffId, { consume = true, signal } = {}) {
    const data = await api(consume ? "library-handoff-consume" : "library-handoff-get", { handoffId: text(handoffId, 180) }, signal);
    return data.handoff;
  }

  function handoffFromLocation() {
    try { return text(new URL(global.location.href).searchParams.get("handoff"), 180); } catch { return ""; }
  }

  function navigateToMotion(handoffId) {
    const url = new URL(global.location.href);
    url.searchParams.set("handoff", text(handoffId, 180));
    url.hash = "/comic-motion-studio";
    global.location.assign(url.href);
  }

  function clearHandoffFromLocation() {
    try {
      const url = new URL(global.location.href);
      if (!url.searchParams.has("handoff")) return;
      url.searchParams.delete("handoff");
      global.history?.replaceState?.(global.history.state, "", `${url.pathname}${url.search}${url.hash}`);
    } catch {}
  }

  async function downloadLicensePack(jobId) {
    if (!global.JSZip) throw new Error("JSZip chưa được tải; không thể tạo License Pack.");
    const data = await api("batch-job-artifacts", { jobId });
    const zip = new global.JSZip();
    Object.entries(data.licensePack?.files || {}).forEach(([name, content]) => zip.file(name, String(content ?? "")));
    const blob = await zip.generateAsync({ type: "blob", compression: "DEFLATE", compressionOptions: { level: 6 } });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `${text(data.job?.series?.title || "comic", 100).replace(/[^a-z0-9_-]+/gi, "-")}-chapter-${text(data.job?.chapter?.number || "", 40)}-license-pack.zip`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 5000);
    return data;
  }

  function migrateLegacyState() {
    const storage = global.localStorage;
    if (!storage) return { version: 1, status: "storage-unavailable", legacyDetected: [] };
    try {
      const existing = JSON.parse(storage.getItem(MIGRATION_KEY) || "null");
      if (existing?.version === 1) return existing;
      const legacyKeys = ["hh-comic-reader-state-v1", "hh.comic-motion-studio.v1", "hh.comic-motion-series-library.v1", "hh.comic-motion-task-center.v1"];
      const legacyDetected = legacyKeys.filter((key) => storage.getItem(key) !== null);
      const record = { version: 1, status: "compatible", legacyDetected, migratedAt: new Date().toISOString(), rollback: "Legacy keys are retained unchanged." };
      storage.setItem(MIGRATION_KEY, JSON.stringify(record));
      return record;
    } catch (error) {
      return { version: 1, status: "retry-required", legacyDetected: [], error: text(error?.message || "Migration failed", 160) };
    }
  }

  const migration = migrateLegacyState();

  global.HHComicLibraryBridge = Object.freeze({
    version: "1.0.0", schemaVersion: SCHEMA_VERSION, api, localRights, seriesDescriptor,
    chapterDescriptor, descriptor, estimate, createMotionHandoff, openHandoff,
    handoffFromLocation, navigateToMotion, clearHandoffFromLocation, downloadLicensePack,
    migrateLegacyState, migration
  });
  global.dispatchEvent?.(new CustomEvent("hh:comic-library-bridge-ready"));
})(window);
