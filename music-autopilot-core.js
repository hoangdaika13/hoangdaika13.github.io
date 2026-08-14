(function initHHMusicAutopilotCore(globalScope, factory) {
  "use strict";
  const api = factory(globalScope || {});
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (globalScope) globalScope.HHMusicAutopilotCore = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function musicAutopilotCoreFactory(globalScope) {
  "use strict";

  const VERSION = 1;
  const SCHEMA = "hh.music.autopilot.v1";
  const STATUS = Object.freeze(["waiting", "running", "review", "completed", "failed", "blocked", "paused", "skipped"]);
  const MODES = Object.freeze([
    ["song", "Bài hát có lời"], ["instrumental", "Instrumental"], ["relax", "Relax / thiền / ngủ"],
    ["game-loop", "Game loop"], ["jingle", "Jingle quảng cáo"], ["cinematic", "Cinematic / trailer"],
    ["karaoke", "Karaoke"], ["podcast", "Podcast bed"], ["livestream", "Livestream"],
    ["album", "Album Factory"], ["video-music", "Video-to-Music"], ["image-music", "Image-to-Music"],
    ["multilingual", "Multilingual Song"], ["adaptive", "Adaptive Music"]
  ].map(([id, label]) => Object.freeze({ id, label })));
  const STAGES = Object.freeze([
    ["concept", "Phân tích phong cách", "AI/Local", "Tạo creative brief có thể sản xuất."],
    ["lyrics", "Viết lời", "AI", "Lời nguyên bản theo ngôn ngữ và cấu trúc."],
    ["structure", "Lập cấu trúc", "AI/Local", "Section, thời lượng, BPM và đường cong năng lượng."],
    ["previews", "Tạo 3 bản thử", "Lyria/Eleven", "Ba file audio thật có seed/provider riêng."],
    ["selection", "Chọn bản tốt nhất", "Web Audio", "Chấm kỹ thuật và cho phép người dùng đổi lựa chọn."],
    ["render", "Render bài hoàn chỉnh", "Lyria Pro/Eleven", "Tạo master source từ phương án đã chọn."],
    ["qa", "Kiểm tra âm thanh", "Web Audio", "Peak, RMS, silence, clipping, dynamics và stereo."],
    ["repair", "Sửa vùng lỗi", "Eleven/Local", "Inpainting khi có song ID hoặc sửa gain cục bộ."],
    ["master", "Mix & Master", "Web Audio/Worker", "Tạo WAV hậu kỳ với preset đích."],
    ["artwork", "Tạo bìa", "Gemini Images", "Cover thật và prompt an toàn."],
    ["visualizer", "Tạo visualizer", "Canvas/Veo", "Preview phản ứng theo âm thanh và handoff render."],
    ["metadata", "Metadata & chapters", "AI/Local", "Title, mô tả, tag, chapter và disclosure AI."],
    ["rights", "Rights & Provenance", "Local", "Hash, model, prompt, khai báo quyền và bằng chứng."],
    ["package", "Xuất gói", "JSZip", "Audio, ảnh, metadata, credits, license và project JSON."],
    ["publishing", "Xuất bản", "YouTube OAuth", "Chỉ handoff sau xác nhận; theo dõi processing thật."]
  ].map(([id, label, engine, description], index) => Object.freeze({ id, label, engine, description, index })));
  const PROVIDERS = Object.freeze({
    auto: { id: "auto", label: "Tự chọn tốt nhất" },
    lyria: { id: "lyria", label: "Gemini Lyria 3" },
    eleven: { id: "eleven", label: "Eleven Music v2" }
  });
  const MASTER_PRESETS = Object.freeze({
    youtube: { id: "youtube", label: "YouTube", targetLufs: -14, ceilingDb: -1 },
    shorts: { id: "shorts", label: "TikTok / Reels", targetLufs: -12, ceilingDb: -1 },
    podcast: { id: "podcast", label: "Podcast", targetLufs: -16, ceilingDb: -1 },
    streaming: { id: "streaming", label: "Streaming", targetLufs: -14, ceilingDb: -1 },
    game: { id: "game", label: "Game", targetLufs: -16, ceilingDb: -1.5 },
    meditation: { id: "meditation", label: "Thiền / ngủ", targetLufs: -18, ceilingDb: -2 }
  });

  const clean = (value, limit = 1000) => String(value == null ? "" : value).replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, limit);
  const clamp = (value, min, max, fallback = min) => Math.min(max, Math.max(min, Number.isFinite(Number(value)) ? Number(value) : fallback));
  const clone = value => JSON.parse(JSON.stringify(value));
  const uid = prefix => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const iso = () => new Date().toISOString();
  const stageMap = () => Object.fromEntries(STAGES.map(stage => [stage.id, { id: stage.id, status: "waiting", progress: 0, detail: stage.description, attempts: 0, startedAt: "", completedAt: "", error: "", checkpointId: "" }]));
  const safeId = value => clean(value || "guest", 80).toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "") || "guest";
  const storageKey = (ownerId = "guest", profileId = "default") => `${SCHEMA}:${safeId(ownerId)}:${safeId(profileId)}`;

  function defaultProject(scope = {}) {
    return {
      schema: SCHEMA,
      version: VERSION,
      id: uid("music-project"),
      ownerId: safeId(scope.ownerId),
      learnerProfileId: safeId(scope.learnerProfileId || "default"),
      title: "HH Music Autopilot 01",
      idea: "Một bản nhạc nguyên bản giàu cảm xúc, dễ nghe và phù hợp video YouTube.",
      mode: "instrumental",
      workflow: "assisted",
      provider: "auto",
      language: "vi",
      genre: "lofi",
      mood: "ấm áp, tập trung, thư giãn",
      bpm: 74,
      musicalKey: "C major / A minor",
      durationSeconds: 60,
      trackCount: 3,
      albumCount: 10,
      aspectRatio: "16:9",
      masterPreset: "youtube",
      generateArtwork: true,
      generateVideo: false,
      autoRepair: true,
      autoPackage: true,
      autoPublish: false,
      publishPrivacy: "private",
      publishAt: "",
      rights: { ownsPrompt: false, ownsReferences: false, acceptsProviderTerms: false, noArtistImitation: true, commercialIntent: false, territory: "worldwide", useCase: "social-video" },
      plan: null,
      stages: stageMap(),
      variants: [],
      selectedVariantId: "",
      assets: {},
      qa: null,
      metadata: null,
      rightsManifest: null,
      queue: [],
      checkpoints: [],
      cost: { estimatedUsd: 0, actualUsd: 0, currency: "USD", items: [] },
      status: "draft",
      paused: false,
      stopRequested: false,
      activeStageId: "",
      createdAt: iso(),
      updatedAt: iso()
    };
  }

  function normalizePlan(input = {}) {
    if (!input || typeof input !== "object") return null;
    return {
      concept: clean(input.concept, 4000), genre: clean(input.genre, 120), mood: clean(input.mood, 300),
      bpm: Math.round(clamp(input.bpm, 35, 220, 74)), musicalKey: clean(input.musicalKey, 80), language: clean(input.language, 30),
      instrumental: input.instrumental === true, lyrics: String(input.lyrics || "").slice(0, 16000),
      structure: (Array.isArray(input.structure) ? input.structure : []).slice(0, 30).map((item, index) => ({ name: clean(item?.name || `Section ${index + 1}`, 100), durationSeconds: Math.round(clamp(item?.durationSeconds, 3, 120, 15)), direction: clean(item?.direction, 500), energy: Math.round(clamp(item?.energy, 0, 100, 50)) })),
      musicPrompt: clean(input.musicPrompt, 10000), negativePrompt: clean(input.negativePrompt, 2000), artworkPrompt: clean(input.artworkPrompt, 5000), motionPrompt: clean(input.motionPrompt, 5000),
      titles: (Array.isArray(input.titles) ? input.titles : []).slice(0, 8).map(value => clean(value, 100)).filter(Boolean),
      description: String(input.description || "").slice(0, 5000), tags: (Array.isArray(input.tags) ? input.tags : []).slice(0, 40).map(value => clean(value, 60)).filter(Boolean),
      chapters: (Array.isArray(input.chapters) ? input.chapters : []).slice(0, 50).map(value => clean(value, 140)).filter(Boolean),
      rightsWarnings: (Array.isArray(input.rightsWarnings) ? input.rightsWarnings : []).slice(0, 20).map(value => clean(value, 300)).filter(Boolean)
    };
  }

  function normalizeProject(input = {}, scope = {}) {
    const base = defaultProject(scope);
    const project = { ...base, ...(input && typeof input === "object" ? input : {}) };
    project.ownerId = safeId(scope.ownerId || project.ownerId);
    project.learnerProfileId = safeId(scope.learnerProfileId || project.learnerProfileId);
    project.title = clean(project.title, 120) || base.title;
    project.idea = clean(project.idea, 4000) || base.idea;
    project.lyricsOverride = String(project.lyricsOverride || "").slice(0, 16000);
    project.mode = MODES.some(item => item.id === project.mode) ? project.mode : base.mode;
    project.workflow = ["auto", "assisted", "pro"].includes(project.workflow) ? project.workflow : base.workflow;
    project.provider = Object.hasOwn(PROVIDERS, project.provider) ? project.provider : base.provider;
    project.durationSeconds = Math.round(clamp(project.durationSeconds, 5, 120, base.durationSeconds));
    project.trackCount = Math.round(clamp(project.trackCount, 3, 3, 3));
    project.albumCount = Math.round(clamp(project.albumCount, 2, 100, 10));
    project.bpm = Math.round(clamp(project.bpm, 35, 220, base.bpm));
    project.genre = clean(project.genre, 80) || base.genre;
    project.mood = clean(project.mood, 140) || base.mood;
    project.language = clean(project.language, 20) || base.language;
    project.musicalKey = clean(project.musicalKey, 80) || base.musicalKey;
    project.aspectRatio = ["16:9", "9:16", "1:1"].includes(project.aspectRatio) ? project.aspectRatio : base.aspectRatio;
    project.masterPreset = MASTER_PRESETS[project.masterPreset] ? project.masterPreset : base.masterPreset;
    project.publishPrivacy = ["private", "unlisted", "schedule"].includes(project.publishPrivacy) ? project.publishPrivacy : base.publishPrivacy;
    project.publishAt = clean(project.publishAt, 50);
    for (const key of ["generateArtwork", "generateVideo", "autoRepair", "autoPackage", "autoPublish"]) project[key] = project[key] === true;
    project.rights = { ...base.rights, ...(project.rights && typeof project.rights === "object" ? project.rights : {}) };
    for (const key of ["ownsPrompt", "ownsReferences", "acceptsProviderTerms", "noArtistImitation", "commercialIntent"]) project.rights[key] = project.rights[key] === true;
    project.rights.territory = clean(project.rights.territory, 80) || base.rights.territory;
    project.rights.useCase = clean(project.rights.useCase, 80) || base.rights.useCase;
    project.plan = normalizePlan(project.plan);
    const incomingStages = project.stages && typeof project.stages === "object" ? project.stages : {};
    project.stages = Object.fromEntries(STAGES.map(stage => {
      const value = incomingStages[stage.id] || {};
      return [stage.id, { ...stageMap()[stage.id], ...value, id: stage.id, status: STATUS.includes(value.status) ? value.status : "waiting", progress: clamp(value.progress, 0, 100, 0), attempts: Math.max(0, Number(value.attempts) || 0) }];
    }));
    project.variants = (Array.isArray(project.variants) ? project.variants : []).slice(0, 3).map((item, index) => ({ id: clean(item.id, 120) || `variant-${index + 1}`, label: clean(item.label || `Phương án ${String.fromCharCode(65 + index)}`, 100), provider: clean(item.provider, 40), model: clean(item.model, 100), seed: Number(item.seed || 0), score: clamp(item.score, 0, 100, 0), durationSeconds: clamp(item.durationSeconds, 0, 600, 0), assetKey: clean(item.assetKey, 180), createdAt: clean(item.createdAt, 50) }));
    project.queue = (Array.isArray(project.queue) ? project.queue : []).slice(-100);
    project.checkpoints = (Array.isArray(project.checkpoints) ? project.checkpoints : []).slice(-30);
    project.updatedAt = clean(project.updatedAt, 50) || iso();
    return project;
  }

  function validateProject(project) {
    const errors = [];
    if (!clean(project.idea, 4000)) errors.push("Hãy nhập ý tưởng hoặc brief.");
    if (!MODES.some(item => item.id === project.mode)) errors.push("Chế độ sản xuất không hợp lệ.");
    if (project.mode === "album" && (project.albumCount < 2 || project.albumCount > 100)) errors.push("Album cần từ 2 đến 100 bài.");
    if (["video-music", "image-music", "karaoke"].includes(project.mode) && !project.assets?.reference) errors.push("Chế độ này cần file tham chiếu hợp lệ.");
    if (!project.rights?.ownsPrompt) errors.push("Bạn cần xác nhận quyền đối với brief/lời đầu vào.");
    if (project.assets?.reference && !project.rights?.ownsReferences) errors.push("Bạn cần xác nhận quyền sử dụng file tham chiếu.");
    if (!project.rights?.acceptsProviderTerms) errors.push("Bạn cần xác nhận đã xem điều kiện provider.");
    return errors;
  }

  function stageIndex(stageId) { return STAGES.findIndex(stage => stage.id === stageId); }
  function setStage(project, stageId, status, detail = "", extra = {}) {
    if (!STATUS.includes(status) || !project.stages?.[stageId]) throw new Error("Stage hoặc trạng thái không hợp lệ.");
    const previous = project.stages[stageId];
    project.stages[stageId] = {
      ...previous, ...extra, status, detail: clean(detail || previous.detail, 700),
      progress: status === "completed" ? 100 : status === "waiting" ? 0 : clamp(extra.progress ?? previous.progress, 0, 99, previous.progress),
      attempts: status === "running" && previous.status !== "running" ? previous.attempts + 1 : previous.attempts,
      startedAt: status === "running" ? (previous.startedAt || iso()) : previous.startedAt,
      completedAt: status === "completed" ? iso() : status === "waiting" ? "" : previous.completedAt,
      error: status === "failed" ? clean(extra.error || detail, 700) : ""
    };
    project.activeStageId = ["running", "paused"].includes(status) ? stageId : (project.activeStageId === stageId ? "" : project.activeStageId);
    project.updatedAt = iso();
    return project.stages[stageId];
  }

  function checkpoint(project, stageId, note = "") {
    const row = { id: uid("checkpoint"), stageId, note: clean(note, 300), status: project.stages?.[stageId]?.status || "waiting", at: iso(), selectedVariantId: project.selectedVariantId, assetKeys: Object.keys(project.assets || {}) };
    project.checkpoints.push(row); project.checkpoints = project.checkpoints.slice(-30);
    if (project.stages?.[stageId]) project.stages[stageId].checkpointId = row.id;
    return row;
  }

  function estimateCost(project, providers = {}) {
    const useLyria = project.provider === "lyria" || (project.provider === "auto" && providers?.lyria?.configured);
    const preview = useLyria ? 3 * 0.04 : 0;
    const full = useLyria ? 0.08 : 0;
    const image = project.generateArtwork && providers?.image?.configured ? 0.04 : 0;
    const video = project.generateVideo && providers?.video?.configured ? 8 * 0.1 : 0;
    const albumScale = project.mode === "album" ? project.albumCount : 1;
    const items = [
      { id: "preview", label: "3 preview", amount: preview * albumScale, provider: useLyria ? "Lyria Clip" : "Eleven / theo gói" },
      { id: "full", label: "Full song", amount: full * albumScale, provider: useLyria ? "Lyria Pro" : "Eleven / theo gói" },
      { id: "image", label: "Artwork", amount: image * albumScale, provider: "Gemini Images" },
      { id: "video", label: "Veo 8 giây", amount: video * albumScale, provider: "Veo" }
    ];
    return { currency: "USD", estimatedUsd: Number(items.reduce((sum, item) => sum + item.amount, 0).toFixed(2)), actualUsd: Number(project.cost?.actualUsd || 0), items };
  }

  function buildLocalPlan(project) {
    const instrumental = ["instrumental", "relax", "game-loop", "podcast", "livestream", "adaptive", "karaoke"].includes(project.mode);
    const total = project.durationSeconds;
    let structureNames = project.mode === "jingle" ? ["Hook", "Brand resolve"] : instrumental ? ["Intro", "Theme A", "Theme B", "Outro"] : ["Intro", "Verse 1", "Chorus", "Verse 2", "Bridge", "Final Chorus", "Outro"];
    if (!instrumental && total < 30) structureNames = ["Hook", "Verse", "Chorus", "Outro"];
    structureNames = structureNames.slice(0, Math.max(1, Math.floor(total / 3)));
    const duration = Math.floor(total / structureNames.length); const remainder = total - duration * structureNames.length;
    const structure = structureNames.map((name, index) => ({ name, durationSeconds: duration + (index < remainder ? 1 : 0), direction: `${project.genre}, ${project.mood}; ${index === 0 ? "mở nhẹ" : index === structureNames.length - 1 ? "kết sạch" : "phát triển motif nguyên bản"}`, energy: Math.round(25 + (index / Math.max(1, structureNames.length - 1)) * 55) }));
    const prompt = `${project.genre}; ${project.mood}; ${project.bpm} BPM; ${project.musicalKey}; ${instrumental ? "instrumental only, no vocals" : `original ${project.language} vocals`}; structure ${structureNames.join(" -> ")}; clean mix; no recognizable melody; no artist imitation.`;
    return normalizePlan({ concept: `${project.idea} Hướng sản xuất: ${project.genre}, ${project.mood}.`, genre: project.genre, mood: project.mood, bpm: project.bpm, musicalKey: project.musicalKey, language: project.language, instrumental, lyrics: instrumental ? "" : "[Verse 1]\nLời đang chờ AI provider tạo bản nguyên bản.\n[Chorus]\nHãy chỉnh lời trước khi render.", structure, musicPrompt: prompt, negativePrompt: "copyrighted lyrics, recognizable melody, artist imitation, clipping, harsh highs, muddy bass", artworkPrompt: `${project.idea}. Original cinematic music cover, ${project.aspectRatio}, no text, no logo, no watermark.`, motionPrompt: `Seamless cinematic loop inspired by: ${project.idea}. Slow camera, subtle particles, no text, no watermark.`, titles: [project.title, `${project.genre} · ${project.mood}`, `${project.title} | Original AI-assisted Music`], description: `Tác phẩm âm nhạc nguyên bản được sản xuất trong HH Music Autopilot.\n\n${project.idea}`, tags: [project.genre, project.mood, "original music", "HH Music"], chapters: structure.reduce((rows, section, index) => { const seconds = structure.slice(0, index).reduce((sum, item) => sum + item.durationSeconds, 0); rows.push(`${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")} ${section.name}`); return rows; }, []), rightsWarnings: ["Kiểm tra quyền đối với mọi file tham chiếu.", "Không coi AI output là bảo đảm không có khiếu nại."] });
  }

  function providerChoice(project, providers = {}, purpose = "preview") {
    const lyria = providers?.lyria?.configured === true;
    const eleven = providers?.music?.configured === true;
    if (project.provider === "lyria") return lyria ? { id: "lyria", action: "music-lyria", model: purpose === "preview" ? "lyria-3-clip-preview" : "lyria-3-pro-preview" } : null;
    if (project.provider === "eleven") return eleven ? { id: "eleven", action: "music-track", model: "music_v2" } : null;
    if (purpose === "preview" && lyria) return { id: "lyria", action: "music-lyria", model: "lyria-3-clip-preview" };
    if (eleven) return { id: "eleven", action: "music-track", model: "music_v2" };
    if (lyria) return { id: "lyria", action: "music-lyria", model: purpose === "preview" ? "lyria-3-clip-preview" : "lyria-3-pro-preview" };
    return null;
  }

  function technicalScore(metrics = {}) {
    let score = 100;
    score -= clamp(metrics.clippingPercent, 0, 100, 0) * 3;
    score -= clamp(metrics.silencePercent - 3, 0, 100, 0) * 0.8;
    if (Number(metrics.peakDb) > -0.3) score -= 12;
    if (Number(metrics.peakDb) < -12) score -= 15;
    if (Number(metrics.rmsDb) < -35) score -= 12;
    if (Number(metrics.dynamicRangeDb) < 4) score -= 10;
    if (Number(metrics.stereoCorrelation) < -0.1) score -= 12;
    return Math.round(clamp(score, 0, 100, 50));
  }

  function completion(project) { const values = STAGES.map(stage => project.stages[stage.id]); return Math.round(values.reduce((sum, stage) => sum + (stage.status === "completed" ? 1 : stage.status === "skipped" ? 0.7 : stage.status === "review" ? 0.8 : stage.progress / 100), 0) / values.length * 100); }

  function createStore(storage, scope = {}) {
    const key = storageKey(scope.ownerId, scope.learnerProfileId);
    let state;
    try { state = normalizeProject(JSON.parse(storage?.getItem?.(key) || "null") || {}, scope); } catch { state = defaultProject(scope); }
    const persist = () => { state.updatedAt = iso(); try { storage?.setItem?.(key, JSON.stringify(state)); } catch {} return state; };
    return {
      key,
      get: () => state,
      replace: value => { state = normalizeProject(value, scope); return persist(); },
      update: patch => { state = normalizeProject({ ...state, ...(typeof patch === "function" ? patch(clone(state)) : patch) }, scope); return persist(); },
      setStage: (id, status, detail, extra) => { setStage(state, id, status, detail, extra); persist(); return state.stages[id]; },
      checkpoint: (id, note) => { const row = checkpoint(state, id, note); persist(); return row; },
      reset: () => { state = defaultProject(scope); persist(); return state; }
    };
  }

  return Object.freeze({ VERSION, SCHEMA, STATUS, MODES, STAGES, PROVIDERS, MASTER_PRESETS, storageKey, defaultProject, normalizePlan, normalizeProject, validateProject, setStage, checkpoint, stageIndex, estimateCost, buildLocalPlan, providerChoice, technicalScore, completion, createStore });
});
