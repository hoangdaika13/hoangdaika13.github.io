(function musicProductionSuite(globalScope) {
  "use strict";

  const PRIMARY_VIEWS = [
    { id: "composer", label: "AI Composer Pro", icon: "AI", engine: "HHMusicComposerLyrics" },
    { id: "lyrics", label: "Lyrics Sync", icon: "LY", engine: "HHMusicComposerLyrics" },
    { id: "arrange", label: "Arrangement Canvas", icon: "AR", engine: "HHMusicDAWWorkspace" },
    { id: "record", label: "Thu âm", icon: "RE", engine: "HHMusicDAWWorkspace" },
    { id: "mix", label: "Mix", icon: "MX", engine: "HHMusicMixMaster" },
    { id: "master", label: "Master Targets", icon: "MA", engine: "HHMusicMixMaster" },
    { id: "video", label: "Visual Universe", icon: "VI", engine: "HHMusicVisualStudio" },
    { id: "publish", label: "Release Control", icon: "UP", engine: "HHMusicPublishingRights" }
  ];

  const LAB_VIEWS = [
    { id: "musical-brain", label: "Song DNA", description: "BPM, tone, hợp âm, cấu trúc và hồ sơ âm nhạc dùng lại.", icon: "DNA", engine: "HHMusicIntelligenceEngine" },
    { id: "audio-midi", label: "Chord & Melody Lab", description: "Nhận diện note, quantize, piano roll và xuất MIDI.", icon: "M2", engine: "HHMusicIntelligenceEngine" },
    { id: "session-band", label: "AI Session Band", description: "Drums, bass, piano, guitar, synth và strings theo Chord Track.", icon: "SB", engine: "HHMusicGenerativeArrangement" },
    { id: "region-editor", label: "Variation Galaxy", description: "Tạo 3–6 phương án A/B và thay riêng từng vùng không phá hủy.", icon: "VG", engine: "HHMusicGenerativeArrangement" },
    { id: "adaptive-soundtrack", label: "Adaptive Soundtrack", description: "Cue sheet theo cảnh, cảm xúc và thời lượng video.", icon: "AS", engine: "HHMusicAdaptiveLibrary" },
    { id: "sample-browser", label: "Semantic Samples", description: "Tìm sample theo mô tả, BPM, tone và giấy phép.", icon: "SS", engine: "HHMusicAdaptiveLibrary" },
    { id: "mix-doctor", label: "AI Mix Doctor", description: "Chẩn đoán muddy, harsh, clipping, stereo và loudness.", icon: "MD", engine: "HHMusicMixPerformance" },
    { id: "live-performance", label: "Live Performance", description: "Clip scene, MIDI Learn, macro và automation trực tiếp.", icon: "LP", engine: "HHMusicMixPerformance" },
    { id: "project-branches", label: "Project Branches", description: "Nhánh phối, comment timestamp, review và khóa track.", icon: "PB", engine: "HHMusicProjectGovernance" },
    { id: "release-manager", label: "Release Manager", description: "Metadata, split, consent, preflight và provenance manifest.", icon: "RM", engine: "HHMusicProjectGovernance" },
    { id: "stems", label: "Stem Workspace", description: "Vocal, drums, bass, harmony, FX và export manifest.", icon: "SM", engine: "HHMusicAudioLabs" },
    { id: "vocal", label: "Vocal Studio", description: "Nhiều take, comping, harmony, timing, pitch và consent.", icon: "VO", engine: "HHMusicAudioLabs" },
    { id: "sound-design", label: "Sound Design", description: "Tạo ambience, Foley, impact, riser và loop.", icon: "FX", engine: "HHMusicAudioLabs" },
    { id: "image-music", label: "Image-to-Music", description: "Biến màu sắc và bối cảnh ảnh thành music brief.", icon: "IM", engine: "HHMusicVisualStudio" },
    { id: "realtime-jam", label: "Realtime Jam", description: "Biểu diễn mood, groove, density và tension.", icon: "JM", engine: "HHMusicVisualStudio" },
    { id: "visualizer", label: "Visualizer", description: "Waveform, spectrum, particle và lyric animation.", icon: "VZ", engine: "HHMusicVisualStudio" },
    { id: "rights", label: "Rights & Provenance", description: "Nguồn asset, consent, giấy phép và manifest.", icon: "RC", engine: "HHMusicPublishingRights" }
  ];

  const PLANETS = [
    { id: "ideas-lyrics", label: "Ý tưởng & Lyrics", icon: "IL", color: "#ff70c8", accent: "#a971ff", identity: "constellation", views: ["composer", "lyrics"], provider: "concept" },
    { id: "compose-midi", label: "Sáng tác & MIDI", icon: "CM", color: "#9b7cff", accent: "#665cff", identity: "electric-midi", views: ["musical-brain", "audio-midi", "session-band", "region-editor"], provider: "music" },
    { id: "arrange-record", label: "Phối khí & Thu âm", icon: "AR", color: "#61e9ef", accent: "#33bdda", identity: "track-rings", views: ["arrange", "record", "stems", "vocal", "sound-design", "sample-browser", "adaptive-soundtrack"], provider: "local" },
    { id: "mix-master-hub", label: "Mix & Master", icon: "MM", color: "#b9f36a", accent: "#34e99a", identity: "reactor", views: ["mix", "master", "mix-doctor", "live-performance"], provider: "local" },
    { id: "visual-universe", label: "Visual Universe", icon: "VU", color: "#ff9b5c", accent: "#ff5fa8", identity: "nebula", views: ["video", "image-music", "visualizer", "realtime-jam"], provider: "image" },
    { id: "release-control", label: "Xuất bản & Bản quyền", icon: "RC", color: "#ffd76a", accent: "#ff9f43", identity: "satellites", views: ["publish", "rights", "release-manager", "project-branches"], provider: "youtube" }
  ];
  const THEMES = [
    { id: "cyberpunk", label: "Cyberpunk", a: "#43f3ff", b: "#ff4fc8", c: "#775cff" },
    { id: "dreamy", label: "Dreamy", a: "#93f4ff", b: "#d6a7ff", c: "#ffb6dc" },
    { id: "deep-space", label: "Deep Space", a: "#61e9ef", b: "#665cff", c: "#ff70c8" },
    { id: "aurora", label: "Aurora", a: "#65f4b3", b: "#61d8ff", c: "#b17cff" },
    { id: "retro-wave", label: "Retro Wave", a: "#39dfff", b: "#ff4fc3", c: "#ff9c4a" },
    { id: "golden-cinema", label: "Golden Cinema", a: "#ffd76a", b: "#ff8f5e", c: "#9b63ff" }
  ];

  const LEGACY_ROUTES = new Set([
    "project", "app-center", "concept-lab", "image-lab", "music-lab", "veo-lab", "render-lab",
    "prompt-studio", "loop-builder", "audio-qa", "chapters", "youtube-pack", "youtube-publisher", "publish-checklist"
  ]);
  const ALL_VIEWS = new Map([...PRIMARY_VIEWS, ...LAB_VIEWS].map((item) => [item.id, item]));
  const HUBS = new Set(PLANETS.map((item) => item.id));
  const ROUTABLE = new Set(["studio", ...HUBS, ...ALL_VIEWS.keys(), ...LEGACY_ROUTES]);
  const STORAGE_KEY = "hh.music.galaxy.v3";
  const LEGACY_STORAGE_KEY = "hh.music.galaxy.v2";
  const STUDIO_KEY = "hh.music-ai-studio.v1";
  const APPS_KEY = "hh.music-ai.apps.v1";
  const DEFAULT_ARRANGEMENT = [
    { id: "intro", label: "Intro", bars: 8, energy: 24, color: "#9b7cff", locked: false, frozen: false, loop: false, seed: 1308, automation: { volume: 72, pan: 50, filter: 64, reverb: 38 } },
    { id: "verse", label: "Verse", bars: 16, energy: 46, color: "#61e9ef", locked: false, frozen: false, loop: false, seed: 2908, automation: { volume: 78, pan: 50, filter: 72, reverb: 26 } },
    { id: "chorus", label: "Chorus", bars: 16, energy: 78, color: "#ff70c8", locked: false, frozen: false, loop: false, seed: 5077, automation: { volume: 88, pan: 50, filter: 90, reverb: 32 } },
    { id: "bridge", label: "Bridge", bars: 8, energy: 58, color: "#ffd76a", locked: false, frozen: false, loop: false, seed: 803, automation: { volume: 75, pan: 50, filter: 58, reverb: 52 } },
    { id: "outro", label: "Outro", bars: 8, energy: 20, color: "#ff9b5c", locked: false, frozen: false, loop: false, seed: 1313, automation: { volume: 64, pan: 50, filter: 42, reverb: 60 } }
  ];

  let activeHost = null;
  let activeEngine = null;
  let activeOptions = {};
  let activeView = "studio";
  let controller = null;
  let clockTimer = 0;
  let autosaveTimer = 0;
  let creativeStore = null;
  let unsubscribeCreative = null;
  let suppressCreativeEvent = false;
  let providerStatus = { providers: {}, canRunMedia: false };
  let conflict = null;
  let dragSectionId = "";
  let routeTimer = 0;
  let queueTimer = 0;
  let quickBriefBusy = false;
  let arrangementUndo = [];
  let arrangementRedo = [];
  const jobControllers = new Map();

  function escapeText(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#039;");
  }

  function clamp(value, min, max, fallback = min) {
    const number = Number(value);
    return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback;
  }

  function safeJson(key, fallback = {}) {
    try {
      const value = JSON.parse(localStorage.getItem(key) || "null");
      return value && typeof value === "object" ? value : fallback;
    } catch {
      return fallback;
    }
  }

  function defaultState() {
    const reduced = globalScope.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
    const limited = Number(navigator.deviceMemory || 8) <= 4 || Number(navigator.hardwareConcurrency || 8) <= 4;
    return {
      project: "HH Music Project",
      genre: "cinematic",
      purpose: "Sáng tạo nội dung",
      audience: "Khán giả của HH Platform",
      platform: "YouTube",
      bpm: 96,
      key: "C minor",
      timeSignature: "4/4",
      mood: "cosmic, emotional, modern",
      instruments: "synth, piano, bass, cinematic drums",
      structure: "Intro, Verse, Chorus, Bridge, Outro",
      scene: "A luminous music galaxy with a central creative star",
      palette: "cyan, violet, pink",
      promptMusic: "",
      promptImage: "",
      promptMotion: "",
      promptLyrics: "",
      negativePrompt: "no imitation of named artists, no copyrighted melody, no clipping",
      chords: "Cm - Ab - Eb - Bb",
      melodyNotes: "",
      bassline: "",
      energy: 56,
      groove: "balanced",
      lyrics: "",
      arrangement: DEFAULT_ARRANGEMENT,
      variations: [],
      selectedVariationId: "",
      mixTarget: "youtube",
      loudness: -14,
      truePeak: -1,
      visualMode: "particle",
      aspectRatio: "16:9",
      releaseTitle: "",
      releasePlatforms: ["YouTube"],
      rightsVerified: false,
      metadataReady: false,
      consentReady: false,
      playing: false,
      loop: false,
      ab: "A",
      markers: [],
      theme: "deep-space",
      promptPreset: "custom",
      creativity: 72,
      similarity: 35,
      complexity: 60,
      variationStrength: 65,
      composerLocks: { melody: false, chord: false, vocal: false, tempo: false, drums: false },
      referenceAnalysis: null,
      generationJobs: [],
      queuePaused: false,
      dailyBudget: 0,
      experienceMode: "basic",
      quickIdea: "",
      quickBrief: "",
      quickBriefProvider: "",
      quickDuration: 60,
      quickInstrumental: true,
      sfxPreset: "ambience",
      sfxPrompt: "soft cosmic ambience, spacious, seamless and unobtrusive",
      sfxDuration: 8,
      sfxInfluence: 0.45,
      sfxLoop: true,
      lastWorkspace: "studio",
      arrangementSlot: "A",
      arrangementVersions: { A: [], B: [], C: [] },
      hybridSections: {},
      midiQuantize: "1/16",
      scaleHighlight: true,
      humanizeTiming: 8,
      humanizeVelocity: 12,
      mixAnalysis: null,
      mixPreviewEnabled: false,
      releaseAuthor: "",
      releaseProducer: "",
      releaseIsrc: "",
      releaseSplits: [{ id: "split-owner", name: "Chủ dự án", role: "Tác giả", percent: 100 }],
      releaseScheduledAt: "",
      visualLayers: ["planet", "spectrum", "particles", "lyrics"],
      stemMappings: { bass: "planet-scale", vocal: "aurora", drums: "solar-flare" },
      consentNote: "",
      motion: reduced ? "static" : limited ? "balanced" : "cinematic",
      syncStatus: "Đã lưu",
      dirty: false,
      lastCreativeUpdatedAt: "",
      lastSyncAt: "",
      updatedAt: new Date().toISOString()
    };
  }

  function readState() {
    const base = defaultState();
    const saved = safeJson(STORAGE_KEY, null) || safeJson(LEGACY_STORAGE_KEY);
    const normalizeSection = (item, index) => ({
      ...DEFAULT_ARRANGEMENT[index % DEFAULT_ARRANGEMENT.length],
      ...item,
      automation: {
        volume: 75, pan: 50, filter: 70, reverb: 30,
        ...(item?.automation || {})
      }
    });
    return {
      ...base,
      ...saved,
      arrangement: Array.isArray(saved.arrangement) && saved.arrangement.length ? saved.arrangement.slice(0, 24).map(normalizeSection) : base.arrangement,
      variations: Array.isArray(saved.variations) ? saved.variations.slice(0, 6) : [],
      markers: Array.isArray(saved.markers) ? saved.markers.slice(0, 80) : [],
      releasePlatforms: Array.isArray(saved.releasePlatforms) ? saved.releasePlatforms.slice(0, 8) : base.releasePlatforms,
      composerLocks: { ...base.composerLocks, ...(saved.composerLocks || {}) },
      generationJobs: Array.isArray(saved.generationJobs) ? saved.generationJobs.slice(0, 80).map((job) => job.status === "running" && !jobControllers.has(job.id) ? { ...job, status: "failed", error: "Phiên tạo trước đã kết thúc." } : job) : [],
      arrangementVersions: { ...base.arrangementVersions, ...(saved.arrangementVersions || {}) },
      releaseSplits: Array.isArray(saved.releaseSplits) && saved.releaseSplits.length ? saved.releaseSplits.slice(0, 20) : base.releaseSplits,
      visualLayers: Array.isArray(saved.visualLayers) ? saved.visualLayers.slice(0, 12) : base.visualLayers,
      stemMappings: { ...base.stemMappings, ...(saved.stemMappings || {}) }
    };
  }

  let state = readState();

  function storageState() {
    return {
      ...state,
      generationJobs: state.generationJobs.map((job) => ({ ...job, outputUrl: "" }))
    };
  }

  function writeState(patch = {}) {
    state = { ...state, ...patch, updatedAt: new Date().toISOString() };
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(storageState())); } catch {}
    updateChrome();
  }

  function supports(id) {
    return id === "studio" || HUBS.has(id) || ALL_VIEWS.has(id);
  }

  function planetFor(view) {
    return PLANETS.find((planet) => planet.id === view || planet.views.includes(view)) || null;
  }

  function activeCreativeProject() {
    const creativeState = creativeStore?.getState?.();
    if (!creativeState) return null;
    return creativeState.projects?.find((item) => item.id === creativeState.activeProjectId) || creativeState.projects?.[0] || null;
  }

  function ensureCreativeStore() {
    if (creativeStore) return creativeStore;
    if (!globalScope.HHCreativeCore?.createStore) return null;
    creativeStore = globalScope.__HH_CREATIVE_STORE__ || globalScope.HHCreativeCore.createStore();
    globalScope.__HH_CREATIVE_STORE__ = creativeStore;
    let project = activeCreativeProject();
    if (!project) {
      project = creativeStore.createProject({
        name: state.project,
        brief: { description: state.promptMusic || state.mood, audience: state.audience, goal: state.purpose, tone: state.mood, platform: state.platform }
      });
    }
    unsubscribeCreative = creativeStore.subscribe((_next, action) => {
      if (suppressCreativeEvent || !["UPDATE_PROJECT", "SET_ACTIVE_PROJECT"].includes(action?.type)) {
        updateChrome();
        updateProjectSelect();
        return;
      }
      if (action?.payload?.projectId !== activeCreativeProject()?.id) return;
      if (state.dirty) {
        writeState({ syncStatus: "Có xung đột" });
        conflict = buildConflict(activeCreativeProject());
        renderConflict();
      } else {
        loadFromCreative(true, false);
      }
      updateProjectSelect();
    });
    return creativeStore;
  }

  function promptOf(project, type) {
    return project?.prompts?.find((item) => item.type === type || String(item.title || "").toLowerCase().includes(type))?.content || "";
  }

  function creativeValues(project) {
    const music = project?.music || {};
    const musicProject = music.project || {};
    const dna = music.songDNA || {};
    const prompts = music.promptComposer || {};
    return {
      project: project?.name || musicProject.name || state.project,
      genre: musicProject.genre || state.genre,
      purpose: project?.brief?.goal || musicProject.purpose || state.purpose,
      audience: project?.brief?.audience || musicProject.audience || state.audience,
      platform: project?.brief?.platform || musicProject.platform || state.platform,
      bpm: musicProject.bpm ?? state.bpm,
      key: musicProject.key || state.key,
      timeSignature: musicProject.timeSignature || state.timeSignature,
      mood: project?.brief?.tone || musicProject.mood || state.mood,
      instruments: musicProject.instruments || state.instruments,
      structure: musicProject.structure || state.structure,
      scene: musicProject.scene || state.scene,
      palette: musicProject.palette || music.visual?.palette || project?.world?.palettes?.[0] || state.palette,
      promptMusic: prompts.music || promptOf(project, "music") || state.promptMusic,
      promptImage: prompts.image || promptOf(project, "image") || state.promptImage,
      promptMotion: prompts.motion || promptOf(project, "motion") || state.promptMotion,
      promptLyrics: prompts.lyrics || promptOf(project, "lyrics") || state.promptLyrics,
      negativePrompt: prompts.negative || state.negativePrompt,
      chords: dna.chords || state.chords,
      melodyNotes: dna.melodyNotes || state.melodyNotes,
      bassline: dna.bassline || state.bassline,
      energy: dna.energy ?? state.energy,
      groove: dna.groove || state.groove,
      lyrics: music.lyrics?.content || state.lyrics,
      arrangement: Array.isArray(music.arrangement) && music.arrangement.length ? music.arrangement : state.arrangement,
      arrangementVersions: { ...state.arrangementVersions, ...(music.arrangementVersions || {}) },
      variations: Array.isArray(music.variations) ? music.variations : state.variations,
      theme: music.visual?.theme || state.theme,
      visualLayers: Array.isArray(music.visual?.layers) ? music.visual.layers : state.visualLayers,
      stemMappings: { ...state.stemMappings, ...(music.visual?.stemMappings || {}) },
      promptPreset: music.composer?.preset || state.promptPreset,
      creativity: music.composer?.creativity ?? state.creativity,
      similarity: music.composer?.similarity ?? state.similarity,
      complexity: music.composer?.complexity ?? state.complexity,
      variationStrength: music.composer?.variationStrength ?? state.variationStrength,
      composerLocks: { ...state.composerLocks, ...(music.composer?.locks || {}) },
      referenceAnalysis: music.composer?.referenceAnalysis || state.referenceAnalysis,
      generationJobs: Array.isArray(music.generation?.jobs) ? music.generation.jobs : state.generationJobs,
      queuePaused: Boolean(music.generation?.paused),
      dailyBudget: music.generation?.dailyBudget ?? state.dailyBudget,
      lastWorkspace: music.generation?.lastWorkspace || state.lastWorkspace,
      midiQuantize: music.midi?.quantize || state.midiQuantize,
      scaleHighlight: music.midi?.scaleHighlight ?? state.scaleHighlight,
      humanizeTiming: music.midi?.humanizeTiming ?? state.humanizeTiming,
      humanizeVelocity: music.midi?.humanizeVelocity ?? state.humanizeVelocity,
      consentNote: music.consent?.note || state.consentNote,
      mixTarget: music.mix?.target || state.mixTarget,
      loudness: music.mix?.loudness ?? state.loudness,
      truePeak: music.mix?.truePeak ?? state.truePeak,
      mixAnalysis: music.mix?.analysis || state.mixAnalysis,
      mixPreviewEnabled: Boolean(music.mix?.previewEnabled),
      visualMode: music.visual?.mode || state.visualMode,
      aspectRatio: music.visual?.aspectRatio || state.aspectRatio,
      releaseTitle: music.release?.title || state.releaseTitle,
      releasePlatforms: Array.isArray(music.release?.platforms) ? music.release.platforms : state.releasePlatforms,
      releaseAuthor: music.release?.author || state.releaseAuthor,
      releaseProducer: music.release?.producer || state.releaseProducer,
      releaseIsrc: music.release?.isrc || state.releaseIsrc,
      releaseSplits: Array.isArray(music.release?.splits) && music.release.splits.length ? music.release.splits : state.releaseSplits,
      releaseScheduledAt: music.release?.scheduledAt || state.releaseScheduledAt,
      rightsVerified: Boolean(project?.rights?.verified),
      metadataReady: Boolean(music.release?.checklist?.metadata),
      consentReady: Boolean(music.release?.checklist?.consent || music.consent?.ready)
    };
  }

  function syncLegacyDrafts() {
    const studio = safeJson(STUDIO_KEY);
    studio.project = {
      ...(studio.project || {}),
      name: state.project, genre: state.genre, bpm: state.bpm, mood: state.mood,
      instruments: state.instruments, scene: state.scene, palette: state.palette
    };
    studio.automation = { ...(studio.automation || {}), idea: state.promptMusic || state.mood };
    studio.updatedAt = new Date().toISOString();
    try { localStorage.setItem(STUDIO_KEY, JSON.stringify(studio)); } catch {}

    const apps = safeJson(APPS_KEY);
    apps.concept = { ...(apps.concept || {}), idea: state.promptMusic || state.mood, genre: state.genre, audience: state.audience };
    apps.music = { ...(apps.music || {}), prompt: state.promptMusic };
    apps.image = { ...(apps.image || {}), prompt: state.promptImage };
    apps.video = { ...(apps.video || {}), prompt: state.promptMotion };
    try { localStorage.setItem(APPS_KEY, JSON.stringify(apps)); } catch {}
  }

  function loadFromCreative(force = false, rerender = true) {
    ensureCreativeStore();
    const project = activeCreativeProject();
    if (!project) return false;
    if (state.dirty && !force) {
      conflict = buildConflict(project);
      writeState({ syncStatus: "Có xung đột" });
      renderConflict();
      return false;
    }
    state = {
      ...state,
      ...creativeValues(project),
      dirty: false,
      syncStatus: "Đã lưu",
      lastCreativeUpdatedAt: project.updatedAt,
      lastSyncAt: new Date().toISOString()
    };
    syncLegacyDrafts();
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(storageState())); } catch {}
    if (rerender && activeHost) {
      renderView(activeView);
      updateChrome();
    }
    return true;
  }

  function buildMusicPayload(project) {
    const oldMusic = project?.music || {};
    return {
      ...oldMusic,
      schemaVersion: 3,
      project: {
        ...(oldMusic.project || {}),
        name: state.project, genre: state.genre, purpose: state.purpose, audience: state.audience,
        platform: state.platform, bpm: state.bpm, key: state.key, timeSignature: state.timeSignature,
        mood: state.mood, instruments: state.instruments, structure: state.structure,
        scene: state.scene, palette: state.palette
      },
      songDNA: {
        ...(oldMusic.songDNA || {}),
        chords: state.chords, energy: state.energy, groove: state.groove,
        melodyNotes: state.melodyNotes, bassline: state.bassline
      },
      promptComposer: {
        ...(oldMusic.promptComposer || {}),
        music: state.promptMusic, image: state.promptImage, motion: state.promptMotion,
        lyrics: state.promptLyrics, negative: state.negativePrompt
      },
      variations: state.variations,
      arrangement: state.arrangement,
      arrangementVersions: { ...state.arrangementVersions, [state.arrangementSlot]: state.arrangement },
      generation: {
        ...(oldMusic.generation || {}), jobs: state.generationJobs, paused: state.queuePaused,
        dailyBudget: state.dailyBudget, lastWorkspace: state.lastWorkspace
      },
      composer: {
        ...(oldMusic.composer || {}), preset: state.promptPreset, creativity: state.creativity,
        similarity: state.similarity, complexity: state.complexity, variationStrength: state.variationStrength,
        locks: state.composerLocks, referenceAnalysis: state.referenceAnalysis
      },
      midi: {
        ...(oldMusic.midi || {}), quantize: state.midiQuantize, scaleHighlight: state.scaleHighlight,
        humanizeTiming: state.humanizeTiming, humanizeVelocity: state.humanizeVelocity
      },
      consent: { ...(oldMusic.consent || {}), note: state.consentNote, ready: state.consentReady },
      lyrics: { ...(oldMusic.lyrics || {}), content: state.lyrics, difficultLines: difficultLyrics(state.lyrics) },
      mix: {
        ...(oldMusic.mix || {}), target: state.mixTarget, loudness: state.loudness, truePeak: state.truePeak,
        analysis: state.mixAnalysis, previewEnabled: state.mixPreviewEnabled
      },
      visual: {
        ...(oldMusic.visual || {}), mode: state.visualMode, aspectRatio: state.aspectRatio, palette: state.palette,
        theme: state.theme, layers: state.visualLayers, stemMappings: state.stemMappings
      },
      release: {
        ...(oldMusic.release || {}), title: state.releaseTitle, platforms: state.releasePlatforms,
        author: state.releaseAuthor, producer: state.releaseProducer, isrc: state.releaseIsrc,
        splits: state.releaseSplits, scheduledAt: state.releaseScheduledAt,
        checklist: { ...(oldMusic.release?.checklist || {}), metadata: state.metadataReady, consent: state.consentReady }
      },
      sync: {
        ...(oldMusic.sync || {}), source: "music-galaxy", lastMusicWriteAt: new Date().toISOString(),
        lastCreativeReadAt: state.lastCreativeUpdatedAt
      }
    };
  }

  function upsertPrompts(project) {
    const definitions = [
      ["music", "Music AI · Track", state.promptMusic],
      ["image", "Music AI · Cover", state.promptImage],
      ["motion", "Music AI · Motion", state.promptMotion],
      ["lyrics", "Music AI · Lyrics", state.promptLyrics]
    ];
    const prompts = [...(project?.prompts || [])];
    definitions.forEach(([type, title, content]) => {
      if (!content) return;
      const index = prompts.findIndex((item) => item.type === type && String(item.title || "").startsWith("Music AI"));
      const next = { ...(index >= 0 ? prompts[index] : {}), type, title, content, negative: type === "music" ? state.negativePrompt : "", createdAt: prompts[index]?.createdAt || new Date().toISOString() };
      if (index >= 0) prompts[index] = next;
      else prompts.unshift(next);
    });
    return prompts;
  }

  function buildConflict(project) {
    const remote = creativeValues(project);
    const fields = [
      ["Tên dự án", "project"], ["Ý tưởng âm nhạc", "promptMusic"], ["Người nghe", "audience"],
      ["Mục đích", "purpose"], ["Mood", "mood"], ["BPM", "bpm"], ["Tone", "key"],
      ["Nhạc cụ", "instruments"], ["Bảng màu", "palette"]
    ].filter(([, key]) => String(remote[key] ?? "") !== String(state[key] ?? ""));
    return { projectId: project?.id, remote, fields };
  }

  function syncToCreative(force = false, snapshot = false) {
    const store = ensureCreativeStore();
    const project = activeCreativeProject();
    if (!store || !project) return false;
    const remoteChanged = state.lastCreativeUpdatedAt && new Date(project.updatedAt).getTime() > new Date(state.lastCreativeUpdatedAt).getTime();
    if (state.dirty && remoteChanged && !force) {
      conflict = buildConflict(project);
      writeState({ syncStatus: "Có xung đột" });
      renderConflict();
      return false;
    }
    const music = buildMusicPayload(project);
    const patch = {
      name: state.project,
      brief: {
        ...(project.brief || {}), description: state.promptMusic || project.brief?.description || "",
        audience: state.audience, goal: state.purpose, tone: state.mood, platform: state.platform
      },
      prompts: upsertPrompts(project),
      world: {
        ...(project.world || {}),
        palettes: [state.palette, ...(project.world?.palettes || []).filter((item) => String(item) !== state.palette)].filter(Boolean).slice(0, 20)
      },
      music,
      rights: { ...(project.rights || {}), verified: state.rightsVerified }
    };
    suppressCreativeEvent = true;
    try {
      store.updateProject(project.id, patch);
      if (snapshot) store.snapshotProject(project.id, `Music Galaxy · ${state.ab}`, "Đồng bộ thủ công từ Music AI");
      const updated = activeCreativeProject();
      state = {
        ...state, dirty: false, syncStatus: "Đã lưu",
        lastCreativeUpdatedAt: updated?.updatedAt || new Date().toISOString(),
        lastSyncAt: new Date().toISOString()
      };
      syncLegacyDrafts();
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(storageState())); } catch {}
      conflict = null;
      updateChrome();
      renderConflict();
      return true;
    } finally {
      suppressCreativeEvent = false;
    }
  }

  function scheduleSync() {
    globalScope.clearTimeout(autosaveTimer);
    writeState({ dirty: true, syncStatus: "Đang đồng bộ" });
    autosaveTimer = globalScope.setTimeout(() => syncToCreative(false, false), 850);
  }

  function setField(path, value) {
    if (!Object.hasOwn(state, path)) return;
    state[path] = value;
    scheduleSync();
  }

  function providerReady(id) {
    if (id === "local") return true;
    if (id === "youtube") return true;
    const provider = providerStatus.providers?.[id];
    return Boolean(provider?.configured && (providerStatus.canRunMedia || id === "concept"));
  }

  async function refreshProviders() {
    try {
      const token = globalScope.HHAuthSession?.token?.() || "";
      const response = await fetch(`${location.origin}/api/modules/music-ai/actions`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        cache: "no-store"
      });
      providerStatus = response.ok ? await response.json() : { providers: {}, canRunMedia: false };
    } catch {
      providerStatus = { providers: {}, canRunMedia: false };
    }
    updateChrome();
    if (activeHost && (activeView === "studio" || HUBS.has(activeView))) renderView(activeView);
    processGenerationQueue();
  }

  function planetTasks(id) {
    const checks = {
      "ideas-lyrics": [state.promptMusic, state.mood, state.audience, state.lyrics || state.promptLyrics],
      "compose-midi": [state.bpm, state.key, state.chords, state.variations.length],
      "arrange-record": [state.arrangement.length >= 3, activeCreativeProject()?.assets?.some((item) => /audio|midi/i.test(`${item.type} ${item.kind}`)), state.instruments],
      "mix-master-hub": [state.mixTarget, state.loudness, state.truePeak, state.metadataReady],
      "visual-universe": [state.palette, state.scene, state.promptImage, activeCreativeProject()?.assets?.some((item) => /image|video/i.test(`${item.type} ${item.kind}`))],
      "release-control": [state.releaseTitle, state.releasePlatforms.length, state.rightsVerified, state.metadataReady, state.consentReady]
    }[id] || [];
    const done = checks.filter(Boolean).length;
    return { done, total: checks.length, progress: checks.length ? Math.round(done / checks.length * 100) : 0, remaining: Math.max(0, checks.length - done) };
  }

  function overallProgress() {
    const totals = PLANETS.map((item) => planetTasks(item.id));
    return Math.round(totals.reduce((sum, item) => sum + item.progress, 0) / totals.length);
  }

  function projectOptions() {
    const creativeState = creativeStore?.getState?.();
    const projects = creativeState?.projects || [];
    return projects.map((project) => `<option value="${escapeText(project.id)}" ${project.id === creativeState.activeProjectId ? "selected" : ""}>${escapeText(project.name)}</option>`).join("");
  }

  function activeTheme() {
    return THEMES.find((item) => item.id === state.theme) || THEMES[2];
  }

  function themeOptions() {
    return THEMES.map((item) => `<option value="${item.id}" ${state.theme === item.id ? "selected" : ""}>${item.label}</option>`).join("");
  }

  function moodHue() {
    const mood = String(state.mood || "").toLowerCase();
    if (/happy|bright|vui|energetic|năng lượng/.test(mood)) return 42;
    if (/sad|buồn|melanch|deep|trầm/.test(mood)) return 218;
    if (/angry|hard|rage|mạnh/.test(mood)) return 356;
    if (/dream|mơ|ambient|calm|êm/.test(mood)) return 184;
    return 282;
  }

  function planetNav(view) {
    const current = planetFor(view);
    return PLANETS.map((planet, index) => {
      const task = planetTasks(planet.id);
      const online = providerReady(planet.provider);
      return `<button type="button" class="${current?.id === planet.id || view === planet.id ? "is-active" : ""}" data-mg-route="${planet.id}" style="--planet:${planet.color};--progress:${task.progress * 3.6}deg" aria-label="${escapeText(planet.label)}, ${task.progress}% hoàn thành">
        <i><b>${planet.icon}</b></i><span><strong>${escapeText(planet.label)}</strong><small><em class="${online ? "is-online" : ""}"></em>${online ? "Sẵn sàng" : "Cần API"} · ${task.remaining} việc</small></span><kbd>Alt ${index + 1}</kbd>
      </button>`;
    }).join("");
  }

  function shellMarkup(view) {
    ensureCreativeStore();
    const theme = activeTheme();
    const planet = planetFor(view);
    return `<section class="mps-shell mg-shell ${state.experienceMode === "basic" && view === "studio" ? "is-basic" : "is-advanced"} ${state.playing ? "is-playing" : ""} ${state.mixAnalysis?.clipping ? "is-clipping" : ""}" data-motion="${escapeText(state.motion)}" data-theme="${escapeText(theme.id)}" data-planet="${escapeText(planet?.identity || "galaxy")}" data-mps-view="${escapeText(view)}" style="--theme-a:${theme.a};--theme-b:${theme.b};--theme-c:${theme.c};--project-energy:${clamp(state.energy, 0, 100)};--mood-hue:${moodHue()}">
      <header class="mg-topbar">
        <button type="button" class="mg-brand" data-mg-route="studio"><span>HH</span><div><strong>Music Galaxy</strong><small>Universal AI Production System</small></div></button>
        <div class="mg-project-switcher">
          <label><span>Dự án Sáng tạo</span><select data-mg-project-select>${projectOptions()}</select></label>
          <span class="mg-sync-state" data-sync-state="${state.syncStatus === "Có xung đột" ? "conflict" : state.syncStatus === "Đang đồng bộ" ? "syncing" : "saved"}"><i></i>${escapeText(state.syncStatus)}</span>
          <button type="button" data-mg-action="load-creative">Nạp từ Sáng tạo</button>
          <button type="button" data-mg-action="sync-creative">Đồng bộ ngược</button>
        </div>
        <div class="mg-visual-controls">
          <label><span>Theme</span><select data-mg-theme>${themeOptions()}</select></label>
          <label class="mg-motion"><span>Hiệu ứng</span><select data-mg-motion><option value="static" ${state.motion === "static" ? "selected" : ""}>Tĩnh</option><option value="balanced" ${state.motion === "balanced" ? "selected" : ""}>Cân bằng</option><option value="cinematic" ${state.motion === "cinematic" ? "selected" : ""}>Điện ảnh</option></select></label>
        </div>
      </header>
      <nav class="mg-planet-nav" aria-label="Sáu hành tinh sản xuất">${planetNav(view)}</nav>
      <main class="mps-stage mg-stage" data-mps-stage></main>
      ${transportMarkup()}
      <div class="mg-cosmic-fx" aria-hidden="true"><i></i><i></i><i></i><b></b><b></b></div>
      <div class="mg-wormhole" data-mg-wormhole aria-hidden="true"></div>
      <div class="mg-conflict-host" data-mg-conflict-host></div>
      <div class="mg-toast" data-mg-toast role="status" aria-live="polite"></div>
    </section>`;
  }

  function transportMarkup() {
    return `<footer class="mg-transport" aria-label="Thanh điều khiển Music Galaxy">
      <button type="button" class="mg-play" data-mg-action="toggle-play" aria-pressed="${state.playing}"><span>${state.playing ? "Ⅱ" : "▶"}</span><small>${state.playing ? "Pause" : "Play"}</small></button>
      <label><span>BPM</span><input type="number" min="40" max="240" data-mg-field="bpm" value="${escapeText(state.bpm)}"></label>
      <label><span>Tone</span><input data-mg-field="key" value="${escapeText(state.key)}" maxlength="20"></label>
      <div class="mg-transport-wave" aria-hidden="true">${Array.from({ length: 32 }, (_, index) => `<i style="--i:${index};--h:${24 + ((index * 43) % 70)}%"></i>`).join("")}</div>
      <button type="button" data-mg-action="add-marker"><b>＋</b><small>Marker ${state.markers.length}</small></button>
      <button type="button" data-mg-action="toggle-loop" aria-pressed="${state.loop}" class="${state.loop ? "is-active" : ""}"><b>↻</b><small>Loop</small></button>
      <button type="button" data-mg-action="toggle-ab"><b>${state.ab}</b><small>Phiên bản A/B</small></button>
      <span class="mg-transport-project"><strong>${escapeText(state.project)}</strong><small>${overallProgress()}% hoàn thành</small></span>
    </footer>`;
  }

  function waveMarkup(count = 54) {
    return `<div class="mg-galaxy-wave" aria-hidden="true">${Array.from({ length: count }, (_, index) => `<i style="--i:${index};--h:${18 + ((index * 47) % 78)}%"></i>`).join("")}</div>`;
  }

  function realRuns() {
    return activeCreativeProject()?.analytics?.runs || [];
  }

  function todayCost() {
    const today = new Date().toISOString().slice(0, 10);
    return realRuns().filter((item) => String(item.createdAt || "").slice(0, 10) === today)
      .reduce((sum, item) => sum + Number(item.estimatedCost || 0), 0);
  }

  function projectWarnings() {
    const warnings = [];
    if (state.mixAnalysis?.clipping) warnings.push({ label: "Clipping", route: "mix-master-hub" });
    if (!state.rightsVerified) warnings.push({ label: "Quyền asset", route: "release-control" });
    if (!state.metadataReady) warnings.push({ label: "Metadata", route: "release-control" });
    if (!state.consentReady && /vocal|voice|giọng/i.test(`${state.instruments} ${state.promptMusic}`)) warnings.push({ label: "Consent giọng", route: "release-control" });
    const splitTotal = state.releaseSplits.reduce((sum, item) => sum + Number(item.percent || 0), 0);
    if (Math.round(splitTotal * 100) / 100 !== 100) warnings.push({ label: `Split ${splitTotal}%`, route: "release-control" });
    return warnings;
  }

  function missionItems() {
    const items = [];
    if (!state.promptMusic) items.push({ label: "Hoàn thiện Prompt Composer", route: "ideas-lyrics", priority: "Bắt đầu" });
    if (!state.variations.length) items.push({ label: "Tạo 3–6 biến thể để so sánh", route: "compose-midi", priority: "Tiếp theo" });
    if (state.arrangement.length < 3) items.push({ label: "Xây cấu trúc arrangement", route: "arrange-record", priority: "Quan trọng" });
    if (!state.mixAnalysis) items.push({ label: "Phân tích file mix thật", route: "mix-master-hub", priority: "Kiểm tra" });
    if (!state.promptImage) items.push({ label: "Tạo Visual DNA từ dự án", route: "visual-universe", priority: "Visual" });
    if (projectWarnings().length) items.push({ label: "Hoàn tất cổng phát hành", route: "release-control", priority: "Cảnh báo" });
    if (!items.length) items.push({ label: "Dự án đã qua preflight — tạo snapshot", route: "release-control", priority: "Sẵn sàng" });
    return items.slice(0, 5);
  }

  function providerReadiness(id) {
    if (id === "local") {
      const supported = Boolean(globalScope.AudioContext || globalScope.webkitAudioContext);
      return { ready: supported, label: supported ? "Sẵn sàng trên trình duyệt" : "Trình duyệt không hỗ trợ", detail: "Web Audio · file không rời thiết bị" };
    }
    if (id === "youtube") {
      return { ready: false, label: "Kiểm tra khi kết nối kênh", detail: "OAuth được thực hiện trong Xuất bản" };
    }
    const provider = providerStatus.providers?.[id];
    if (!provider) return { ready: false, label: "Đang kiểm tra máy chủ", detail: "Chưa nhận trạng thái" };
    if (!provider.configured) return { ready: false, label: "Thiếu cấu hình máy chủ", detail: "Quản trị viên cần thêm khóa API trên Vercel" };
    if (id !== "concept" && !providerStatus.canRunMedia) return { ready: false, label: "Cần đăng nhập tài khoản chủ", detail: "API media tính phí đã được bảo vệ" };
    return { ready: true, label: "Sẵn sàng", detail: (provider.capabilities || []).slice(0, 3).join(" · ") || provider.model || "Đã kết nối" };
  }

  function quickSteps() {
    const successful = (type) => state.generationJobs.some((item) => item.type === type && item.status === "success");
    const visualReady = Boolean(state.promptImage || successful("music-image") || activeCreativeProject()?.assets?.some((item) => /image|video/i.test(`${item.type} ${item.kind}`)));
    return [
      { id: "idea", label: "Ý tưởng", route: "ideas-lyrics", done: Boolean(state.quickIdea || state.promptMusic) },
      { id: "generate", label: "Tạo nhạc", route: "ideas-lyrics", done: successful("music-track") },
      { id: "arrange", label: "Cấu trúc", route: "arrange-record", done: state.arrangement.length >= 3 },
      { id: "mix", label: "Mix/Master", route: "mix-master-hub", done: Boolean(state.mixAnalysis) },
      { id: "visual", label: "Visualizer", route: "visual-universe", done: visualReady },
      { id: "release", label: "Xuất bản", route: "release-control", done: releaseReady() }
    ];
  }

  function quickNextStep() {
    return quickSteps().find((item) => !item.done) || quickSteps().at(-1);
  }

  function newestSuccessfulJob(type) {
    return state.generationJobs.find((item) => item.type === type && item.status === "success");
  }

  function quickStudioMarkup() {
    const steps = quickSteps();
    const next = quickNextStep();
    const track = newestSuccessfulJob("music-track");
    const music = providerReadiness("music");
    const concept = providerReadiness("concept");
    const sound = providerReadiness("sound");
    const presets = {
      ambience: "soft cosmic ambience, spacious, seamless and unobtrusive",
      foley: "cinematic footsteps on a futuristic metal floor, clean isolated foley",
      transition: "smooth cinematic whoosh transition, short, polished and modern",
      impact: "deep cinematic impact hit with a controlled sub bass tail"
    };
    return `<section class="mg-quick-studio">
      <header class="mg-quick-head"><div><small>QUICK STUDIO · ENGINE THẬT</small><h1>Từ ý tưởng đến bản nhạc trong một màn hình</h1><p>Luồng gọn cho người mới; mọi workspace chuyên sâu vẫn giữ nguyên trong chế độ Advanced.</p></div><div class="mg-mode-switch" role="group" aria-label="Chế độ giao diện"><button type="button" data-mg-mode="basic" class="${state.experienceMode === "basic" ? "is-active" : ""}">Basic</button><button type="button" data-mg-mode="advanced" class="${state.experienceMode === "advanced" ? "is-active" : ""}">Advanced</button></div></header>
      <nav class="mg-quick-steps" aria-label="Quy trình làm nhạc">${steps.map((item, index) => `<button type="button" data-mg-route="${item.route}" class="${item.done ? "is-done" : item.id === next.id ? "is-current" : ""}"><i>${item.done ? "✓" : index + 1}</i><span>${item.label}</span></button>`).join("")}</nav>
      <div class="mg-quick-grid">
        <section class="mg-quick-create"><div class="mg-quick-title"><span>01</span><div><strong>Mô tả bản nhạc bạn muốn</strong><small>Viết bằng tiếng Việt; Gemini có thể chuyển thành production brief.</small></div></div>
          <label class="mg-field mg-field--wide"><span>Ý tưởng</span><textarea rows="4" data-mg-field="quickIdea" placeholder="Ví dụ: nhạc cinematic bí ẩn cho video khám phá vũ trụ, mở đầu nhẹ rồi cao trào ở cuối">${escapeText(state.quickIdea)}</textarea></label>
          <div class="mg-quick-controls">${field("Thể loại", "genre", state.genre)}${field("Mood", "mood", state.mood)}<label class="mg-field"><span>Thời lượng</span><select data-mg-field="quickDuration">${[30, 60, 90, 120].map((value) => `<option value="${value}" ${Number(state.quickDuration) === value ? "selected" : ""}>${value} giây</option>`).join("")}</select></label><label class="mg-check"><input type="checkbox" data-mg-field="quickInstrumental" ${state.quickInstrumental ? "checked" : ""}><span>Không lời</span></label></div>
          <div class="mg-quick-actions"><button type="button" data-mg-action="quick-brief" ${concept.ready && !quickBriefBusy ? "" : "disabled"}>${quickBriefBusy ? "Đang lập brief…" : "✦ Gemini lập brief"}</button><button type="button" class="is-primary" data-mg-action="quick-generate" ${music.ready ? "" : "disabled"}>▶ Tạo nhạc thật</button></div>
          <p class="mg-truth-note ${music.ready ? "is-ready" : "is-blocked"}"><i></i><span><strong>${escapeText(music.label)}</strong><small>${escapeText(music.detail)}</small></span></p>
          ${state.quickBrief ? `<details class="mg-brief-result" open><summary>Production brief · ${escapeText(state.quickBriefProvider || "Gemini")}</summary><pre>${escapeText(state.quickBrief)}</pre></details>` : ""}
        </section>
        <aside class="mg-quick-preview"><div class="mg-quick-title"><span>02</span><div><strong>Preview & bước tiếp theo</strong><small>Kết quả chỉ hiện khi provider trả file âm thanh thật.</small></div></div>
          ${track?.outputUrl ? `<div class="mg-audio-result"><i>♪</i><strong>${escapeText(track.name)}</strong><small>${escapeText(track.provider)} · ${escapeText(track.model)} · ${Math.round((track.latencyMs || 0) / 100) / 10}s</small><audio src="${escapeText(track.outputUrl)}" controls preload="metadata"></audio><button type="button" data-mg-job-action="download" data-job-id="${escapeText(track.id)}">Tải MP3</button></div>` : `<div class="mg-preview-empty"><i>♫</i><strong>Chưa có track</strong><span>Tạo track đầu tiên hoặc tiếp tục công cụ còn thiếu.</span></div>`}
          <button type="button" class="mg-next-action" data-mg-route="${next.route}"><span><small>TIẾP TỤC</small><strong>${escapeText(next.label)}</strong></span><b>→</b></button>
        </aside>
      </div>
      <div class="mg-quick-bottom">
        <section class="mg-sfx-quick"><header><div><small>SFX STUDIO</small><h2>Hiệu ứng âm thanh theo cảnh</h2></div><span class="${sound.ready ? "is-ready" : ""}">${escapeText(sound.label)}</span></header><div class="mg-sfx-presets">${Object.entries(presets).map(([id, prompt]) => `<button type="button" data-mg-sfx-preset="${id}" data-prompt="${escapeText(prompt)}" class="${state.sfxPreset === id ? "is-active" : ""}">${({ ambience: "Ambience", foley: "Foley", transition: "Transition", impact: "Impact" })[id]}</button>`).join("")}</div><label class="mg-field mg-field--wide"><span>Mô tả hiệu ứng</span><input data-mg-field="sfxPrompt" value="${escapeText(state.sfxPrompt)}"></label><div class="mg-sfx-controls"><label><span>Thời lượng ${escapeText(state.sfxDuration)}s</span><input type="range" min="0.5" max="30" step="0.5" data-mg-field="sfxDuration" value="${escapeText(state.sfxDuration)}"></label><label><span>Bám prompt ${Math.round(Number(state.sfxInfluence) * 100)}%</span><input type="range" min="0" max="1" step="0.05" data-mg-field="sfxInfluence" value="${escapeText(state.sfxInfluence)}"></label><label class="mg-check"><input type="checkbox" data-mg-field="sfxLoop" ${state.sfxLoop ? "checked" : ""}><span>Loop</span></label><button type="button" data-mg-action="queue-sfx" ${sound.ready ? "" : "disabled"}>Tạo SFX</button></div></section>
        <section class="mg-readiness"><header><small>API READINESS</small><h2>Kết nối đang dùng</h2></header>${[["concept", "Gemini Brief"], ["music", "Eleven Music"], ["sound", "Eleven SFX"], ["local", "Web Audio"], ["youtube", "YouTube OAuth"]].map(([id, label]) => { const item = providerReadiness(id); return `<article class="${item.ready ? "is-ready" : ""}"><i></i><span><strong>${label}</strong><small>${escapeText(item.detail)}</small></span><b>${escapeText(item.label)}</b></article>`; }).join("")}<button type="button" data-mg-action="refresh-providers">Kiểm tra lại kết nối</button></section>
      </div>
      <section class="mg-quick-queue"><header><div><small>TASK CENTER</small><h2>Hàng đợi tạo nội dung</h2></div><button type="button" data-mg-action="toggle-queue">${state.queuePaused ? "Tiếp tục" : "Tạm dừng"}</button></header><div>${generationQueueMarkup()}</div></section>
    </section>`;
  }

  function providerCards() {
    const providers = Object.entries(providerStatus.providers || {});
    if (!providers.length) return `<p class="mg-empty">Đang đọc trạng thái API từ máy chủ…</p>`;
    return providers.map(([id, provider]) => {
      const ready = providerReady(id);
      return `<article class="${ready ? "is-online" : ""}"><i></i><span><strong>${escapeText(provider.provider || id)}</strong><small>${escapeText(provider.model || "Chưa có model")}</small></span><b>${ready ? "Online" : "Chưa sẵn sàng"}</b></article>`;
    }).join("");
  }

  function generationQueueMarkup() {
    const jobs = state.generationJobs.slice(0, 8);
    if (!jobs.length) return `<div class="mg-empty">Chưa có generation. Mỗi job sẽ lưu model, seed, trạng thái và quyền sử dụng.</div>`;
    return jobs.map((job) => `<article class="mg-job is-${escapeText(job.status)}" data-job-id="${escapeText(job.id)}">
      <i>${job.type === "music-track" ? "♪" : job.type === "music-image" ? "▣" : "✦"}</i>
      <span><strong>${escapeText(job.name || "AI generation")}</strong><small>${escapeText(job.error || `${job.provider || "Provider tự chọn"} · ${job.model || "đang xác định"} · Seed ${job.seed || "—"}`)}</small></span>
      <em>${escapeText({ queued: "Đang chờ", running: "Đang chạy", success: "Hoàn tất", failed: "Thất bại", cancelled: "Đã hủy" }[job.status] || job.status)}</em>
      <div>${job.status === "running" ? `<button type="button" data-mg-job-action="cancel" data-job-id="${job.id}">Hủy</button>` : ""}${job.status === "queued" ? `<button type="button" data-mg-job-action="cancel" data-job-id="${job.id}">Bỏ</button>` : ""}${["failed", "cancelled"].includes(job.status) ? `<button type="button" data-mg-job-action="retry" data-job-id="${job.id}">Retry</button>` : ""}${job.status === "success" && job.outputUrl ? `<button type="button" data-mg-job-action="download" data-job-id="${job.id}">Tải</button>` : ""}<button type="button" data-mg-job-action="duplicate" data-job-id="${job.id}">Nhân bản</button></div>
    </article>`).join("");
  }

  function commandCenterMarkup() {
    const project = activeCreativeProject();
    const assets = (project?.assets || []).slice(0, 5);
    const runs = realRuns();
    const running = state.generationJobs.filter((item) => item.status === "running").length;
    const queued = state.generationJobs.filter((item) => item.status === "queued").length;
    const failed = state.generationJobs.filter((item) => item.status === "failed").length;
    const warnings = projectWarnings();
    return `<section class="mg-command-center">
      <header><div><small>GALAXY COMMAND CENTER</small><h2>Dữ liệu thật của dự án</h2></div><button type="button" data-mg-route="${escapeText(state.lastWorkspace || "studio")}">Tiếp tục công việc gần nhất →</button></header>
      <div class="mg-command-stats">
        <article><small>Generation</small><strong>${running}<i> chạy</i></strong><span>${queued} chờ · ${failed} lỗi</span></article>
        <article><small>Chi phí AI hôm nay</small><strong>${todayCost() ? `${todayCost().toFixed(3)} USD` : "Chưa ghi nhận"}</strong><span>${runs.length} lần chạy toàn dự án</span></article>
        <article><small>Asset Universal Project</small><strong>${project?.assets?.length || 0}</strong><span>${assets[0] ? `Mới nhất: ${escapeText(assets[0].name)}` : "Chưa có asset"}</span></article>
        <article class="${warnings.length ? "is-warn" : "is-good"}"><small>Cảnh báo phát hành</small><strong>${warnings.length}</strong><span>${warnings.length ? warnings.map((item) => escapeText(item.label)).join(" · ") : "Không có cảnh báo cấu hình"}</span></article>
      </div>
      <div class="mg-command-grid">
        <section><h3>AI Mission Control</h3>${missionItems().map((item) => `<button type="button" data-mg-route="${item.route}"><i></i><span><strong>${escapeText(item.label)}</strong><small>${escapeText(item.priority)}</small></span><b>→</b></button>`).join("")}</section>
        <section><h3>API & engine</h3><div class="mg-provider-list">${providerCards()}</div></section>
        <section class="mg-queue"><h3>Generation queue</h3><div>${generationQueueMarkup()}</div><footer><button type="button" data-mg-action="toggle-queue">${state.queuePaused ? "Tiếp tục hàng đợi" : "Tạm dừng hàng đợi"}</button><button type="button" data-mg-route="ideas-lyrics">Tạo mới</button></footer></section>
      </div>
    </section>`;
  }

  function overviewMarkup() {
    const project = activeCreativeProject();
    const assets = project?.assets || [];
    const runs = project?.analytics?.runs || [];
    return `<div class="mg-overview">
      ${quickStudioMarkup()}
      ${state.experienceMode === "advanced" ? `<div class="mg-advanced-zone"><section class="mg-hero">
        <div class="mg-nebula" aria-hidden="true"><i></i><i></i><i></i>${waveMarkup(70)}</div>
        <div class="mg-hero-copy"><p><i></i> HH MUSIC COSMOS · ${providerStatus.canRunMedia ? "AI ONLINE" : "LOCAL-FIRST"}</p><h1>Music Galaxy</h1><h2>Một dự án. Sáu hành tinh. Toàn bộ hành trình âm nhạc.</h2><span>Song DNA, MIDI, lyrics, arrangement, stem, vocal, mix, visual và phát hành cùng dùng một Universal Project.</span><div><button type="button" data-mg-route="ideas-lyrics">Bắt đầu sáng tạo</button><button type="button" data-mg-action="generate-variations">Tạo Variation Galaxy</button></div></div>
        <div class="mg-orbit-system" aria-label="Dự án hiện tại nằm ở trung tâm Music Galaxy">
          <div class="mg-project-star">${waveMarkup(34)}<span>HH</span><strong>${escapeText(state.project)}</strong><small>${overallProgress()}%</small><em>${state.mixAnalysis?.clipping ? "CLIP" : ""}</em></div>
          ${PLANETS.map((planet, index) => `<button type="button" data-mg-route="${planet.id}" data-identity="${planet.identity}" style="--orbit:${index};--planet:${planet.color};--planet-accent:${planet.accent}" title="${escapeText(planet.label)}"><i>${planet.icon}</i><span>${escapeText(planet.label)}</span></button>`).join("")}
        </div>
      </section>
      ${commandCenterMarkup()}
      <section class="mg-project-form">
        <header><div><small>UNIVERSAL PROJECT</small><h2>Form âm nhạc đồng bộ với Sáng tạo</h2></div><span>${assets.length} assets · ${runs.length} AI runs · ${project?.versions?.length || 0} phiên bản</span></header>
        <div class="mg-form-grid">
          ${field("Tên album/track", "project", state.project)}
          ${field("Thể loại", "genre", state.genre)}
          ${field("Người nghe mục tiêu", "audience", state.audience)}
          ${field("Mục đích", "purpose", state.purpose)}
          ${field("Nền tảng", "platform", state.platform)}
          ${field("Mood/cảm xúc", "mood", state.mood)}
          ${field("BPM", "bpm", state.bpm, 'type="number" min="40" max="240"')}
          ${field("Tone", "key", state.key)}
          ${field("Bảng màu", "palette", state.palette)}
          ${field("Nhạc cụ & texture", "instruments", state.instruments)}
        </div>
      </section>
      <section class="mg-planet-grid">${PLANETS.map((planet) => planetCard(planet)).join("")}</section>
      <section class="mg-capability-grid">
        ${toolCard("Song DNA", "BPM · Tone · Chord · Energy", "musical-brain", "DNA")}
        ${toolCard("Prompt Composer", "Prompt có cấu trúc + negative prompt", "ideas-lyrics", "PC")}
        ${toolCard("Variation Galaxy", "3–6 phương án có seed và A/B", "compose-midi", "VG")}
        ${toolCard("Arrangement Canvas", "Intro · Verse · Chorus · Bridge · Outro", "arrange-record", "AC")}
        ${toolCard("Chord & Melody Lab", "Piano roll, bassline và MIDI export", "audio-midi", "CM")}
        ${toolCard("Lyrics Sync", "Âm tiết, beat, phát âm và dòng khó hát", "lyrics", "LS")}
        ${toolCard("Stem Workspace", "Vocal · Drums · Bass · Harmony · FX", "stems", "SW")}
        ${toolCard("Vocal Studio", "Take · Comp · Harmony · Timing · Consent", "vocal", "VS")}
        ${toolCard("AI Mix Doctor", "Muddy · Harsh · Clipping · Stereo", "mix-doctor", "MD")}
        ${toolCard("Master Targets", "YouTube · Spotify · TikTok · Podcast", "mix-master-hub", "MT")}
        ${toolCard("Visual Universe", "Cover · Lyric video · Particle visualizer", "visual-universe", "VU")}
        ${toolCard("Release Control", "Metadata · Split · Rights · Schedule", "release-control", "RC")}
      </section></div>` : ""}
    </div>`;
  }

  function field(label, key, value, attrs = "") {
    return `<label class="mg-field"><span>${escapeText(label)}</span><input data-mg-field="${escapeText(key)}" value="${escapeText(value)}" ${attrs}></label>`;
  }

  function textarea(label, key, value, rows = 4) {
    return `<label class="mg-field mg-field--wide"><span>${escapeText(label)}</span><textarea data-mg-field="${escapeText(key)}" rows="${rows}">${escapeText(value)}</textarea></label>`;
  }

  function rangeControl(label, key, value, min = 0, max = 100) {
    return `<label><span>${escapeText(label)} <b>${escapeText(value)}</b></span><input type="range" min="${min}" max="${max}" data-mg-field="${escapeText(key)}" value="${escapeText(value)}"></label>`;
  }

  function referenceAnalysisMarkup() {
    const item = state.referenceAnalysis;
    if (!item) return `<div class="mg-empty">Chưa có phân tích tham chiếu.</div>`;
    return `<div class="mg-analysis-cards">
      <article><small>Tempo ước tính</small><strong>${escapeText(item.bpm || "—")} BPM</strong></article>
      <article><small>Tone ước tính</small><strong>${escapeText(item.key || "—")}</strong></article>
      <article><small>Energy RMS</small><strong>${escapeText(item.energy || 0)}%</strong></article>
      <article><small>Thời lượng</small><strong>${escapeText(item.duration || 0)}s</strong></article>
      <article><small>Đặc tính</small><strong>${escapeText(item.profile || "Chưa xác định")}</strong></article>
      <article><small>Nguồn</small><strong>Phân tích cục bộ</strong></article>
    </div>`;
  }

  function planetCard(planet) {
    const tasks = planetTasks(planet.id);
    return `<button type="button" data-mg-route="${planet.id}" style="--planet:${planet.color};--progress:${tasks.progress * 3.6}deg"><i><span>${planet.icon}</span></i><div><small>HÀNH TINH ${String(PLANETS.indexOf(planet) + 1).padStart(2, "0")}</small><strong>${escapeText(planet.label)}</strong><p>${tasks.done}/${tasks.total} tín hiệu hoàn tất · ${providerReady(planet.provider) ? "Engine sẵn sàng" : "Cần cấu hình API"}</p></div><b>${tasks.progress}%</b></button>`;
  }

  function toolCard(title, copy, route, icon) {
    return `<button type="button" data-mg-route="${route}"><i>${icon}</i><span><strong>${escapeText(title)}</strong><small>${escapeText(copy)}</small></span><b>↗</b></button>`;
  }

  function hubHeader(planet, title, copy) {
    const tasks = planetTasks(planet.id);
    return `<header class="mg-hub-hero" data-identity="${planet.identity}" style="--planet:${planet.color};--planet-accent:${planet.accent}"><div class="mg-planet-signature" aria-hidden="true"><i></i><i></i><i></i></div><div><p>HÀNH TINH ${escapeText(planet.icon)} · ${tasks.progress}%</p><h1>${escapeText(title)}</h1><span>${escapeText(copy)}</span></div><aside><strong>${tasks.remaining}</strong><small>tác vụ còn lại</small><button type="button" data-mg-route="studio">Về Music Galaxy</button></aside></header>`;
  }

  function toolsMarkup(ids) {
    return `<section class="mg-hub-tools">${ids.map((id) => {
      const item = ALL_VIEWS.get(id);
      return item ? toolCard(item.label, item.description || "Mở workspace sản xuất chuyên sâu", id, item.icon) : "";
    }).join("")}</section>`;
  }

  function ideasHub() {
    const planet = PLANETS[0];
    const hard = difficultLyrics(state.lyrics);
    const provider = providerStatus.providers?.music || {};
    return `<div class="mg-hub">${hubHeader(planet, "Ý tưởng & Lyrics", "Từ Creative Brief đến prompt có cấu trúc và lời hát khớp nhịp.")}
      <div class="mg-two-panel">
        <section class="mg-panel"><header><small>PROMPT COMPOSER</small><h2>Điều khiển có cấu trúc</h2></header>
          <label class="mg-field"><span>Preset</span><select data-mg-field="promptPreset">${[["custom", "Tùy chỉnh"], ["cinematic", "Cinematic"], ["pop", "Modern Pop"], ["lofi", "Lo-fi Focus"], ["ambient", "Ambient Space"], ["edm", "Electronic"]].map(([id, label]) => `<option value="${id}" ${state.promptPreset === id ? "selected" : ""}>${label}</option>`).join("")}</select></label>
          <div class="mg-form-grid">${field("Thể loại", "genre", state.genre)}${field("Mood", "mood", state.mood)}${field("Nhạc cụ", "instruments", state.instruments)}${field("Cấu trúc", "structure", state.structure)}</div>
          <div class="mg-parameter-grid">
            ${rangeControl("Sáng tạo", "creativity", state.creativity, 0, 100)}
            ${rangeControl("Tương đồng tham chiếu", "similarity", state.similarity, 0, 100)}
            ${rangeControl("Độ phức tạp", "complexity", state.complexity, 0, 100)}
            ${rangeControl("Mức biến đổi", "variationStrength", state.variationStrength, 0, 100)}
          </div>
          <div class="mg-locks"><small>Khóa thuộc tính khi regenerate</small>${Object.entries({ melody: "Melody", chord: "Chord", vocal: "Vocal", tempo: "Tempo", drums: "Drums" }).map(([key, label]) => `<label><input type="checkbox" data-mg-lock="${key}" ${state.composerLocks[key] ? "checked" : ""}><span>${label}</span></label>`).join("")}</div>
          <div class="mg-form-grid">${textarea("Prompt tạo nhạc", "promptMusic", state.promptMusic, 6)}${textarea("Negative prompt", "negativePrompt", state.negativePrompt, 3)}</div>
          <footer><button type="button" data-mg-action="compose-prompt">Ghép prompt thông minh</button><button type="button" data-mg-action="queue-track" ${providerReady("music") ? "" : "disabled"}>Đưa vào hàng đợi AI</button><button type="button" data-mg-route="composer">Mở AI Composer</button></footer>
          <p class="mg-provider-note ${providerReady("music") ? "is-ready" : ""}"><i></i>${providerReady("music") ? `${escapeText(provider.provider)} · ${escapeText(provider.model)} đã sẵn sàng. Chi phí sẽ ghi theo phản hồi provider nếu có.` : "Music provider chưa sẵn sàng hoặc tài khoản hiện tại không có quyền media tính phí."}</p>
        </section>
        <section class="mg-panel"><header><small>LYRICS SYNC</small><h2>Nhịp âm tiết & phát âm</h2></header>${textarea("Lời bài hát", "lyrics", state.lyrics, 12)}<div class="mg-lyrics-health"><span><strong>${syllableCount(state.lyrics)}</strong><small>âm tiết ước tính</small></span><span><strong>${String(state.lyrics || "").split(/\n/).filter(Boolean).length}</strong><small>dòng lời</small></span><span class="${hard.length ? "is-warn" : ""}"><strong>${hard.length}</strong><small>dòng khó hát</small></span></div><footer><button type="button" data-mg-action="lyrics-template">Tạo khung Lyrics</button><button type="button" data-mg-route="lyrics">Mở Lyrics Studio</button></footer></section>
      </div>
      <section class="mg-panel mg-reference-analyzer"><header><small>REFERENCE TRACK ANALYZER</small><h2>Đọc đặc tính, không sao chép melody</h2></header><div class="mg-reference-body"><label class="mg-file-drop"><input type="file" accept="audio/*" data-mg-reference-file><i>◎</i><span><strong>Chọn audio tham chiếu</strong><small>Phân tích cục bộ BPM, tone ước tính, energy, thời lượng và thiên hướng nhạc cụ. File không được tải lên máy chủ.</small></span></label>${referenceAnalysisMarkup()}</div></section>
      ${toolsMarkup(planet.views)}</div>`;
  }

  function composeHub() {
    const planet = PLANETS[1];
    return `<div class="mg-hub">${hubHeader(planet, "Sáng tác & MIDI", "Song DNA, Variation Galaxy, chord, melody và bassline trong cùng một hệ.")}
      <div class="mg-two-panel">
        <section class="mg-panel"><header><small>SONG DNA</small><h2>Hồ sơ âm nhạc tái sử dụng</h2></header><div class="mg-form-grid">${field("BPM", "bpm", state.bpm, 'type="number" min="40" max="240"')}${field("Tone", "key", state.key)}${field("Nhịp", "timeSignature", state.timeSignature)}${field("Groove", "groove", state.groove)}${field("Hợp âm", "chords", state.chords)}${field("Energy 0–100", "energy", state.energy, 'type="range" min="0" max="100"')}</div><div class="mg-dna-orbit"><i style="--energy:${clamp(state.energy, 0, 100)}%"><span>DNA</span></i><p><strong>${escapeText(state.key)}</strong><small>${state.bpm} BPM · ${escapeText(state.timeSignature)}</small><em>${escapeText(state.chords)}</em></p></div></section>
        <section class="mg-panel mg-variation-panel"><header><small>VARIATION GALAXY</small><h2>So sánh A/B/C không dừng transport</h2></header><div class="mg-variation-grid">${variationMarkup()}</div><div class="mg-hybrid-builder"><small>HYBRID VERSION</small>${["Verse", "Chorus", "Bridge", "Outro"].map((section) => `<label><span>${section}</span><select data-mg-hybrid="${section.toLowerCase()}"><option value="">Chọn vệ tinh</option>${state.variations.map((item, index) => `<option value="${item.id}" ${state.hybridSections[section.toLowerCase()] === item.id ? "selected" : ""}>${String.fromCharCode(65 + index)} · ${escapeText(item.name)}</option>`).join("")}</select></label>`).join("")}</div><footer><label>Số biến thể <select data-mg-variation-count><option>3</option><option>4</option><option>5</option><option>6</option></select></label><button type="button" data-mg-action="generate-variations">Tạo biến thể</button><button type="button" data-mg-action="build-hybrid">Tạo Hybrid Version</button><button type="button" data-mg-route="region-editor">Biên tập từng vùng</button></footer></section>
      </div>
      <section class="mg-panel mg-chord-lab"><header><small>CHORD, MELODY & MIDI LAB</small><h2>Piano roll, velocity, scale và MIDI chuẩn</h2></header><div class="mg-form-grid">${field("Chord Track toàn dự án", "chords", state.chords)}${field("Melody notes", "melodyNotes", state.melodyNotes)}${field("Bassline", "bassline", state.bassline)}<label class="mg-field"><span>Quantize</span><select data-mg-field="midiQuantize">${["1/4", "1/8", "1/16", "1/32"].map((item) => `<option ${state.midiQuantize === item ? "selected" : ""}>${item}</option>`).join("")}</select></label></div>
        <div class="mg-midi-controls">${rangeControl("Humanize timing", "humanizeTiming", state.humanizeTiming, 0, 30)}${rangeControl("Humanize velocity", "humanizeVelocity", state.humanizeVelocity, 0, 30)}<label><input type="checkbox" data-mg-field="scaleHighlight" ${state.scaleHighlight ? "checked" : ""}><span>Scale highlighting</span></label></div>
        <div class="mg-piano-roll ${state.scaleHighlight ? "is-scale" : ""}" aria-label="Xem trước piano roll">${Array.from({ length: 64 }, (_, index) => `<i class="${index % 7 === 0 || index % 11 === 0 ? "is-note" : ""}" style="--velocity:${45 + ((index * 17) % 50)}%"></i>`).join("")}</div>
        <footer><button type="button" data-mg-action="suggest-notes">Gợi ý chord · melody · bass</button><button type="button" data-mg-action="export-midi">Xuất MIDI dự án</button><button type="button" draggable="true" data-mg-midi-drag>Kéo MIDI sang DAW</button><button type="button" data-mg-route="audio-midi">Mở Piano Roll đầy đủ</button></footer></section>
      ${toolsMarkup(planet.views)}</div>`;
  }

  function variationMarkup() {
    if (!state.variations.length) return `<div class="mg-empty">Chưa có biến thể. Chọn 3–6 phương án để tạo Variation Galaxy.</div>`;
    return state.variations.map((item, index) => {
      const scores = item.scores || variationScores(item, index);
      return `<article class="${state.selectedVariationId === item.id ? "is-selected" : ""}" style="--satellite:${index}">
        <button type="button" data-mg-variation="${escapeText(item.id)}"><i>${String.fromCharCode(65 + index)}</i><span><strong>${escapeText(item.name)}</strong><small>${item.bpm} BPM · ${escapeText(item.key)} · Seed ${item.seed}</small></span><b>${item.energy}%</b></button>
        <div>${Object.entries(scores).map(([key, value]) => `<span title="${escapeText(key)}"><small>${escapeText(key)}</small><i style="--score:${value}%"></i><b>${value}</b></span>`).join("")}</div>
        <p>${escapeText(item.reason || variationReason(item, scores))}</p>
      </article>`;
    }).join("");
  }

  function variationScores(item, index = 0) {
    const seed = Number(item.seed || stableSeed(item.id || index));
    return {
      Melody: 58 + seed % 38,
      Groove: 55 + (seed >>> 3) % 42,
      Energy: clamp(item.energy, 0, 100),
      Vocal: 54 + (seed >>> 6) % 43,
      Platform: 60 + (seed >>> 9) % 36
    };
  }

  function variationReason(item, scores) {
    const entries = Object.entries(scores).sort((a, b) => b[1] - a[1]);
    return `Đề xuất để nghe thử vì ${entries[0][0].toLowerCase()} ${entries[0][1]}/100; đây là tiêu chí hỗ trợ, không phải tuyên bố “tốt nhất”.`;
  }

  function arrangeHub() {
    const planet = PLANETS[2];
    const versions = ["A", "B", "C"];
    return `<div class="mg-hub">${hubHeader(planet, "Phối khí & Thu âm", "Arrangement Canvas kéo thả, take lane, stem và vocal consent.")}
      <section class="mg-panel mg-arrangement-panel"><header><div><small>ARRANGEMENT GALAXY</small><h2>Timeline chòm sao · không phá hủy</h2></div><div class="mg-version-tabs">${versions.map((slot) => `<button type="button" class="${state.arrangementSlot === slot ? "is-selected" : ""}" data-mg-arrangement-slot="${slot}">${slot}</button>`).join("")}<button type="button" data-mg-action="undo-arrangement" ${arrangementUndo.length ? "" : "disabled"}>↶ Undo</button><button type="button" data-mg-action="redo-arrangement" ${arrangementRedo.length ? "" : "disabled"}>↷ Redo</button></div></header>
        <div class="mg-arrangement-ruler">${Array.from({ length: 17 }, (_, index) => `<i><span>${index * 4 + 1}</span></i>`).join("")}</div>
        <div class="mg-arrangement" data-mg-arrangement>${state.arrangement.map((section, index) => arrangementSectionMarkup(section, index)).join("")}</div>
        <div class="mg-automation-lanes">${["volume", "pan", "filter", "reverb", "energy"].map((lane) => `<article><strong>${lane}</strong><div>${state.arrangement.map((section) => `<label style="--section:${section.color || "#61e9ef"}"><span>${escapeText(section.label)}</span><input type="range" min="0" max="100" value="${lane === "energy" ? section.energy : section.automation?.[lane] ?? 50}" data-mg-automation="${escapeText(section.id)}" data-lane="${lane}"></label>`).join("")}</div></article>`).join("")}</div>
        <footer><button type="button" data-mg-action="add-section">+ Section</button><button type="button" data-mg-action="save-arrangement-version">Lưu bản ${state.arrangementSlot}</button><button type="button" data-mg-route="arrange">Mở DAW Timeline</button><button type="button" data-mg-route="record">Thu microphone</button></footer>
      </section>
      <section class="mg-marker-panel"><header><strong>Markers & vòng lặp</strong><span>${state.markers.length} marker</span></header><div>${state.markers.length ? state.markers.map((marker, index) => `<article><i style="--marker:${["#61e9ef", "#ff70c8", "#ffd76a", "#9b7cff"][index % 4]}"></i><input data-mg-marker-label="${marker.id}" value="${escapeText(marker.label)}"><small>${Number(marker.at || 0).toFixed(2)}s</small><label><input type="checkbox" data-mg-marker-loop="${marker.id}" ${marker.loop ? "checked" : ""}> Loop</label><button type="button" data-mg-remove-marker="${marker.id}">×</button></article>`).join("") : `<p>Thêm marker từ thanh transport để ghi chú hoặc tạo vòng lặp riêng.</p>`}</div></section>
      <section class="mg-stem-strip">${["Vocal", "Drums", "Bass", "Instruments", "FX"].map((name, index) => `<article><i style="--level:${35 + ((index * 19) % 55)}%"></i><strong>${name}</strong><span><button type="button" data-mg-stem-control="solo" aria-pressed="false">S</button><button type="button" data-mg-stem-control="mute" aria-pressed="false">M</button></span><small>${index ? "-3.0" : "0.0"} dB</small></article>`).join("")}</section>
      <section class="mg-panel mg-consent-card"><header><small>VOCAL CONSENT</small><h2>Quyền sử dụng giọng</h2></header>${textarea("Ghi chú consent, chủ thể và phạm vi sử dụng", "consentNote", state.consentNote, 4)}<label class="mg-check"><input type="checkbox" data-mg-field="consentReady" ${state.consentReady ? "checked" : ""}><span>Đã lưu giấy đồng ý hoặc quyền sử dụng hợp lệ</span></label><footer><button type="button" data-mg-route="vocal">Mở Vocal Studio</button><button type="button" data-mg-route="stems">Stem separation & export</button></footer></section>
      ${toolsMarkup(planet.views)}</div>`;
  }

  function arrangementSectionMarkup(section, index) {
    return `<article draggable="${!section.locked}" class="${section.locked ? "is-locked" : ""} ${section.frozen ? "is-frozen" : ""}" data-section-id="${escapeText(section.id)}" style="--energy:${clamp(section.energy, 0, 100)}%;--bars:${clamp(section.bars, 2, 64)};--section:${section.color || "#61e9ef"}">
      <i>${String(index + 1).padStart(2, "0")}</i><label><input data-section-label="${escapeText(section.id)}" value="${escapeText(section.label)}"><small>${section.bars} bars · Energy ${section.energy}% · Seed ${escapeText(section.seed || "—")}</small></label>
      <div class="mg-section-wave">${Array.from({ length: Math.min(24, Math.max(4, Number(section.bars) || 8)) }, (_, wave) => `<b style="--h:${20 + ((wave * 37 + index * 11) % 75)}%"></b>`).join("")}</div>
      <div class="mg-section-actions">
        <button type="button" data-mg-section-action="split" data-section-id="${section.id}" title="Chia section">⫶</button>
        <button type="button" data-mg-section-action="duplicate" data-section-id="${section.id}" title="Nhân đôi">⧉</button>
        <button type="button" data-mg-section-action="stretch" data-section-id="${section.id}" title="Kéo dài">↔</button>
        <button type="button" data-mg-section-action="regenerate" data-section-id="${section.id}" title="Tạo lại riêng 2–8 bars">✦</button>
        <button type="button" data-mg-section-action="freeze" data-section-id="${section.id}" title="Freeze/Unfreeze">${section.frozen ? "☀" : "❄"}</button>
        <button type="button" data-mg-section-action="lock" data-section-id="${section.id}" title="Khóa/Mở khóa">${section.locked ? "▣" : "□"}</button>
        <button type="button" data-mg-remove-section="${section.id}" title="Xóa">×</button>
      </div>
    </article>`;
  }

  function mixHub() {
    const planet = PLANETS[3];
    const warnings = mixWarnings();
    return `<div class="mg-hub">${hubHeader(planet, "Mix & Master", "Chẩn đoán minh bạch và target riêng cho từng nền tảng.")}
      <div class="mg-two-panel">
        <section class="mg-panel mg-mix-doctor"><header><small>AI MIX DOCTOR</small><h2>Phân tích audio thật trên thiết bị</h2></header>
          <label class="mg-file-drop"><input type="file" accept="audio/*" data-mg-mix-file><i>◒</i><span><strong>Chọn bản mix để phân tích</strong><small>Đo peak, RMS, clipping, cân bằng phổ và tương quan stereo cục bộ; file không rời thiết bị.</small></span></label>
          ${mixAnalysisMarkup()}
          <div class="mg-doctor-score"><strong>${Math.max(0, 100 - warnings.length * 15)}</strong><span>Mix health theo các phép đo hiện có</span></div>
          <div class="mg-warning-list">${warnings.length ? warnings.map((item) => `<article><i>!</i><span><strong>${escapeText(item.title)}</strong><small>${escapeText(item.copy)}</small></span><button type="button" data-mg-route="mix-doctor">Tới Mix Doctor</button></article>`).join("") : `<article class="is-good"><i>✓</i><span><strong>Chưa có vấn đề trong dữ liệu hiện có</strong><small>Hãy chọn audio để thực hiện phép đo.</small></span></article>`}</div>
          <footer><button type="button" data-mg-route="mix">Mở Mixer</button><button type="button" data-mg-route="mix-doctor">Spectrum & Stereo Field</button><button type="button" data-mg-action="toggle-mix-preview" aria-pressed="${state.mixPreviewEnabled}">${state.mixPreviewEnabled ? "Tắt Preview" : "Preview trước/sau"}</button></footer>
        </section>
        <section class="mg-panel"><header><small>MASTER TARGETS</small><h2>Chuẩn đầu ra và codec preview</h2></header><div class="mg-targets">${masterTargets().map((item) => `<button type="button" class="${state.mixTarget === item.id ? "is-selected" : ""}" data-mg-target="${item.id}"><i>${item.icon}</i><span><strong>${item.label}</strong><small>${item.lufs} LUFS · ${item.peak} dBTP</small></span></button>`).join("")}</div><div class="mg-form-grid">${field("Target LUFS", "loudness", state.loudness, 'type="number" min="-24" max="-5" step=".1"')}${field("True Peak dBTP", "truePeak", state.truePeak, 'type="number" min="-6" max="0" step=".1"')}</div><div class="mg-codec-note"><i>AAC</i><span><strong>Codec preview không giả lập trên form</strong><small>Mở Master Room để render/nghe file AAC hoặc MP3 thật và có thể Undo.</small></span></div><footer><button type="button" data-mg-route="master">Mở Master Room</button><button type="button" data-mg-action="snapshot">Lưu bản master</button></footer></section>
      </div>${toolsMarkup(planet.views)}</div>`;
  }

  function mixAnalysisMarkup() {
    const item = state.mixAnalysis;
    if (!item) return `<div class="mg-empty">Chưa đo audio. Các cảnh báo hiện tại chỉ dựa trên target và Song DNA.</div>`;
    const bands = item.bands || {};
    return `<div class="mg-real-meter">
      <div class="mg-spectrum-mini">${Object.entries(bands).map(([name, value]) => `<span><i style="--level:${clamp(value, 0, 100)}%"></i><small>${escapeText(name)}</small></span>`).join("")}</div>
      <div class="mg-analysis-cards"><article><small>Peak</small><strong>${item.peakDb} dBFS</strong></article><article><small>RMS ước tính</small><strong>${item.rmsDb} dBFS</strong></article><article><small>Stereo correlation</small><strong>${item.correlation}</strong></article><article><small>Clipping samples</small><strong>${item.clippingSamples}</strong></article></div>
      ${item.hotspots?.length ? `<div class="mg-hotspots"><small>VỊ TRÍ CLIPPING</small>${item.hotspots.map((at) => `<button type="button" data-mg-hotspot="${at}">${Number(at).toFixed(2)}s</button>`).join("")}</div>` : ""}
    </div>`;
  }

  function visualHub() {
    const planet = PLANETS[4];
    return `<div class="mg-hub">${hubHeader(planet, "Visual Universe", "Cover, lyric video và particle visualizer dùng thẳng palette của dự án Sáng tạo.")}
      <div class="mg-two-panel">
        <section class="mg-panel"><header><small>SCENE COMPOSER</small><h2>Visual DNA liên kết Universal Project</h2></header><div class="mg-form-grid">${field("Bảng màu", "palette", state.palette)}${field("Bối cảnh", "scene", state.scene)}<label class="mg-field"><span>Tỷ lệ</span><select data-mg-field="aspectRatio">${["16:9", "9:16", "1:1", "9:16 Canvas"].map((item) => `<option ${state.aspectRatio === item ? "selected" : ""}>${item}</option>`).join("")}</select></label>${field("Chế độ", "visualMode", state.visualMode)}${textarea("Prompt cover", "promptImage", state.promptImage, 5)}${textarea("Prompt chuyển động", "promptMotion", state.promptMotion, 5)}</div>
          <div class="mg-visual-layers"><small>LAYER</small>${["planet", "spectrum", "particles", "lyrics", "logo", "typography", "aurora"].map((layer) => `<label><input type="checkbox" data-mg-visual-layer="${layer}" ${state.visualLayers.includes(layer) ? "checked" : ""}><span>${layer}</span></label>`).join("")}</div>
          <div class="mg-stem-mapping"><article><i>B</i><span><strong>Bass</strong><small>Điều khiển kích thước hành tinh</small></span></article><article><i>V</i><span><strong>Vocal</strong><small>Điều khiển cực quang</small></span></article><article><i>D</i><span><strong>Drums</strong><small>Tạo solar flare</small></span></article></div>
          <footer><button type="button" data-mg-action="visual-prompts">Tạo prompt từ Music DNA</button><button type="button" data-mg-action="queue-cover" ${providerReady("image") ? "" : "disabled"}>Tạo cover qua API</button><button type="button" data-mg-action="open-video-editor">Sang Video Editor</button><button type="button" data-mg-route="image-music">Image-to-Music</button></footer></section>
        <section class="mg-visual-preview" data-aspect="${escapeText(state.aspectRatio)}" style="--visual-a:${paletteColor(0)};--visual-b:${paletteColor(1)};--visual-c:${paletteColor(2)}"><div class="mg-safe-zone"><span>SAFE ZONE</span></div><div class="mg-preview-aurora"></div><div class="mg-preview-star"><span>HH</span></div>${waveMarkup(44)}<div class="mg-karaoke-preview"><span class="is-active">Across</span> <span>the</span> <span>music</span> <span>galaxy</span></div><strong>${escapeText(state.project)}</strong><small>${escapeText(state.visualMode)} · ${escapeText(state.aspectRatio)}</small></section>
      </div>${toolsMarkup(planet.views)}</div>`;
  }

  function releaseHub() {
    const planet = PLANETS[5];
    const splitTotal = state.releaseSplits.reduce((sum, item) => sum + Number(item.percent || 0), 0);
    const ready = releaseReady();
    const assets = activeCreativeProject()?.assets || [];
    const checklist = [
      ["rightsVerified", "Nguồn asset và giấy phép đã xác minh", state.rightsVerified],
      ["consentReady", "Consent giọng hát/giọng nói đã lưu", state.consentReady],
      ["metadataReady", "Title, mô tả, tag và thumbnail đã sẵn sàng", state.metadataReady],
      ["split", "Split tác quyền bắt buộc bằng 100%", Math.round(splitTotal * 100) / 100 === 100]
    ];
    return `<div class="mg-hub">${hubHeader(planet, "Xuất bản & Bản quyền", "Metadata, split, provenance, checklist và lịch phát hành trong một control room.")}
      <div class="mg-two-panel">
        <section class="mg-panel"><header><small>MASTER & RELEASE CONTROL</small><h2>Metadata và lịch đa nền tảng</h2></header><div class="mg-form-grid">${field("Tên bản phát hành", "releaseTitle", state.releaseTitle || state.project)}${field("Tác giả", "releaseAuthor", state.releaseAuthor)}${field("Producer", "releaseProducer", state.releaseProducer)}${field("ISRC", "releaseIsrc", state.releaseIsrc)}${field("Nền tảng chính", "platform", state.platform)}${field("Lịch phát hành", "releaseScheduledAt", state.releaseScheduledAt, 'type="datetime-local"')}</div><div class="mg-platforms">${["YouTube", "Spotify", "TikTok", "Apple Music", "Podcast"].map((name) => `<label><input type="checkbox" data-mg-platform="${name}" ${state.releasePlatforms.includes(name) ? "checked" : ""}><span>${name}</span></label>`).join("")}</div><footer><button type="button" data-mg-route="publish" ${ready ? "" : "disabled"}>${ready ? "Mở Publishing" : "Đang khóa phát hành"}</button><button type="button" data-mg-route="release-manager">Metadata nâng cao</button></footer></section>
        <section class="mg-panel"><header><small>SPLIT & PREFLIGHT</small><h2>Khóa an toàn trước phát hành</h2></header>
          <div class="mg-splits">${state.releaseSplits.map((item) => `<article><input data-mg-split-name="${item.id}" value="${escapeText(item.name)}" aria-label="Tên người nhận"><input data-mg-split-role="${item.id}" value="${escapeText(item.role)}" aria-label="Vai trò"><label><input type="number" min="0" max="100" step=".01" data-mg-split-percent="${item.id}" value="${escapeText(item.percent)}"><span>%</span></label><button type="button" data-mg-remove-split="${item.id}" aria-label="Xóa split">×</button></article>`).join("")}<button type="button" data-mg-action="add-split">+ Người nhận</button><strong class="${Math.round(splitTotal * 100) / 100 === 100 ? "is-valid" : "is-invalid"}">Tổng ${splitTotal}% / 100%</strong></div>
          <div class="mg-release-checks">${checklist.map(([key, label, checked]) => key === "split" ? `<label><input type="checkbox" ${checked ? "checked" : ""} disabled><i></i><span>${escapeText(label)}</span></label>` : `<label><input type="checkbox" data-mg-field="${key}" ${checked ? "checked" : ""}><i></i><span>${escapeText(label)}</span></label>`).join("")}</div><div class="mg-release-score ${ready ? "is-ready" : ""}"><strong>${checklist.filter((item) => item[2]).length}/${checklist.length}</strong><span>${ready ? "Cổng phát hành đã mở" : "Thiếu điều kiện — không thể phát hành"}</span></div><footer><button type="button" data-mg-route="rights">Rights Center</button><button type="button" data-mg-action="snapshot">Tạo phiên bản duyệt</button></footer></section>
      </div>
      <section class="mg-panel mg-provenance"><header><small>PROVENANCE GRAPH</small><h2>Nguồn của từng asset</h2></header><div class="mg-provenance-graph"><div class="mg-provenance-root"><i>UP</i><strong>${escapeText(state.project)}</strong></div>${assets.length ? assets.slice(0, 12).map((asset, index) => `<article style="--node:${index}"><i>${/audio/i.test(asset.type || "") ? "♪" : /image/i.test(asset.type || "") ? "▣" : /video/i.test(asset.type || "") ? "▶" : "◇"}</i><span><strong>${escapeText(asset.name)}</strong><small>${escapeText(asset.license || asset.kind || "Chưa ghi giấy phép")}</small></span></article>`).join("") : `<p class="mg-empty">Asset tạo xong sẽ tự xuất hiện tại đây cùng nguồn, provider và giấy phép đã ghi nhận.</p>`}</div></section>
      ${toolsMarkup(planet.views)}</div>`;
  }

  function releaseReady() {
    const splitTotal = state.releaseSplits.reduce((sum, item) => sum + Number(item.percent || 0), 0);
    return Boolean(state.releaseTitle && state.releaseAuthor && state.rightsVerified && state.consentReady && state.metadataReady && Math.round(splitTotal * 100) / 100 === 100);
  }

  function renderHub(view) {
    if (view === "ideas-lyrics") return ideasHub();
    if (view === "compose-midi") return composeHub();
    if (view === "arrange-record") return arrangeHub();
    if (view === "mix-master-hub") return mixHub();
    if (view === "visual-universe") return visualHub();
    return releaseHub();
  }

  function syllableCount(value) {
    return (String(value || "").toLocaleLowerCase("vi").match(/[aăâeêioôơuưyáàảãạấầẩẫậắằẳẵặéèẻẽẹếềểễệíìỉĩịóòỏõọốồổỗộớờởỡợúùủũụứừửữựýỳỷỹỵ]+/g) || []).length;
  }

  function difficultLyrics(value) {
    return String(value || "").split(/\n/).map((line) => line.trim()).filter((line) => line && (syllableCount(line) > 14 || line.length > 72)).slice(0, 20);
  }

  function stableSeed(value) {
    let hash = 2166136261;
    for (const char of String(value || "music")) {
      hash ^= char.charCodeAt(0);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  }

  function generateVariations() {
    const count = clamp(activeHost?.querySelector("[data-mg-variation-count]")?.value || 4, 3, 6, 4);
    const names = ["Nebula", "Lunar", "Aurora", "Nova", "Orbit", "Eclipse"];
    const offsets = [-4, 2, 0, 5, -2, 7];
    state.variations = Array.from({ length: count }, (_, index) => ({
      id: `variation-${stableSeed(`${state.project}-${index}`).toString(36)}`,
      name: `${names[index]} ${state.genre}`,
      bpm: clamp(Number(state.bpm) + offsets[index], 40, 240),
      key: state.key,
      energy: clamp(Number(state.energy) + (index - 2) * 9, 0, 100),
      seed: stableSeed(`${state.project}-${state.chords}-${index}`),
      scores: null
    })).map((item, index) => {
      const scores = variationScores(item, index);
      return { ...item, scores, reason: variationReason(item, scores), model: providerStatus.providers?.music?.model || "", provider: providerStatus.providers?.music?.provider || "" };
    });
    state.selectedVariationId = state.variations[0]?.id || "";
    scheduleSync();
    renderView(activeView);
    toast(`Đã tạo ${count} biến thể có seed.`);
  }

  function masterTargets() {
    return [
      { id: "youtube", label: "YouTube", icon: "YT", lufs: -14, peak: -1 },
      { id: "spotify", label: "Spotify", icon: "SP", lufs: -14, peak: -1 },
      { id: "tiktok", label: "TikTok", icon: "TT", lufs: -12, peak: -1 },
      { id: "apple", label: "Apple Music", icon: "AM", lufs: -16, peak: -1 },
      { id: "podcast", label: "Podcast", icon: "PO", lufs: -16, peak: -1.5 }
    ];
  }

  function mixWarnings() {
    const warnings = [];
    if (Number(state.loudness) > -9) warnings.push({ title: "Loudness quá cao", copy: "Có nguy cơ bị nền tảng giảm âm lượng và mất dynamics." });
    if (Number(state.truePeak) > -1) warnings.push({ title: "True Peak sát 0 dBTP", copy: "Hạ limiter ceiling để tránh clipping sau mã hóa." });
    if (Number(state.energy) > 84) warnings.push({ title: "Energy liên tục cao", copy: "Nên tạo tương phản động giữa verse và chorus." });
    if (!state.instruments) warnings.push({ title: "Thiếu danh sách nhạc cụ", copy: "Mix Doctor cần biết vai trò từng nguồn âm." });
    if (state.mixAnalysis?.clipping) warnings.push({ title: "Clipping đo được trong audio", copy: `${state.mixAnalysis.clippingSamples} sample vượt ngưỡng; hãy nhảy tới Mix Doctor và nghe Preview trước khi sửa.` });
    if (Number(state.mixAnalysis?.correlation) < -0.1) warnings.push({ title: "Nguy cơ phase stereo", copy: "Tương quan stereo âm; kiểm tra mono compatibility trước khi master." });
    if (Number(state.mixAnalysis?.bands?.Low) > 72) warnings.push({ title: "Bass có thể mất cân bằng", copy: "Năng lượng dải thấp chiếm ưu thế; so sánh reference và kiểm tra trên loa nhỏ." });
    if (Number(state.mixAnalysis?.bands?.High) > 78) warnings.push({ title: "Dải cao có thể harsh", copy: "Nghe Preview tại các vị trí peak trước khi áp dụng EQ." });
    return warnings;
  }

  function paletteColor(index) {
    const fallbacks = ["#61e9ef", "#9c7cff", "#ff70c8"];
    const token = String(state.palette || "").split(",")[index]?.trim();
    if (/^#[0-9a-f]{3,8}$/i.test(token || "")) return token;
    const known = { cyan: "#61e9ef", violet: "#9c7cff", purple: "#9c7cff", pink: "#ff70c8", amber: "#ffb65c", blue: "#579cff", teal: "#45d7c7", gold: "#ffd76a", green: "#9de06c", red: "#ff6e78" };
    return known[String(token || "").toLowerCase()] || fallbacks[index] || fallbacks[0];
  }

  function toast(message, type = "success") {
    const node = activeHost?.querySelector("[data-mg-toast]");
    if (!node) return;
    node.textContent = message;
    node.dataset.type = type;
    node.classList.add("is-visible");
    globalScope.clearTimeout(toast.timer);
    toast.timer = globalScope.setTimeout(() => node.classList.remove("is-visible"), 3200);
  }

  function renderConflict() {
    const host = activeHost?.querySelector("[data-mg-conflict-host]");
    if (!host) return;
    if (!conflict) {
      host.replaceChildren();
      return;
    }
    host.innerHTML = `<section class="mg-conflict" role="dialog" aria-modal="true" aria-labelledby="mgConflictTitle"><div><small>UNIVERSAL PROJECT</small><h2 id="mgConflictTitle">Phát hiện thay đổi ở cả hai nơi</h2><p>Music AI sẽ không tự ghi đè. Hãy chọn phiên bản cần giữ.</p><ul>${conflict.fields.map(([label, key]) => `<li><strong>${escapeText(label)}</strong><span>Music: ${escapeText(state[key])}</span><span>Sáng tạo: ${escapeText(conflict.remote[key])}</span></li>`).join("") || "<li>Metadata dự án đã thay đổi.</li>"}</ul><footer><button type="button" data-mg-action="resolve-creative">Nạp bản Sáng tạo</button><button type="button" data-mg-action="resolve-music">Giữ bản Music AI</button><button type="button" data-mg-action="close-conflict">Để sau</button></footer></div></section>`;
  }

  function updateProjectSelect() {
    const select = activeHost?.querySelector("[data-mg-project-select]");
    if (select) select.innerHTML = projectOptions();
  }

  function updateChrome() {
    if (!activeHost) return;
    const shell = activeHost.querySelector(".mg-shell");
    if (!shell) return;
    shell.dataset.motion = state.motion;
    const theme = activeTheme();
    shell.dataset.theme = theme.id;
    shell.dataset.planet = planetFor(activeView)?.identity || "galaxy";
    shell.classList.toggle("is-playing", Boolean(state.playing));
    shell.classList.toggle("is-clipping", Boolean(state.mixAnalysis?.clipping));
    shell.style.setProperty("--theme-a", theme.a);
    shell.style.setProperty("--theme-b", theme.b);
    shell.style.setProperty("--theme-c", theme.c);
    shell.style.setProperty("--project-energy", clamp(state.energy, 0, 100));
    shell.style.setProperty("--mood-hue", moodHue());
    shell.style.setProperty("--beat-ms", `${Math.round(60000 / clamp(state.bpm, 40, 240, 96))}ms`);
    const status = shell.querySelector(".mg-sync-state");
    if (status) {
      status.dataset.syncState = state.syncStatus === "Có xung đột" ? "conflict" : state.syncStatus === "Đang đồng bộ" ? "syncing" : "saved";
      status.lastChild.textContent = state.syncStatus;
    }
    const project = shell.querySelector(".mg-transport-project strong");
    const progress = shell.querySelector(".mg-transport-project small");
    if (project) project.textContent = state.project;
    if (progress) progress.textContent = `${overallProgress()}% hoàn thành`;
  }

  function startClock() {
    stopClock();
    const shell = activeHost?.querySelector(".mg-shell");
    shell?.style.setProperty("--beat-ms", `${Math.round(60000 / clamp(state.bpm, 40, 240, 96))}ms`);
    clockTimer = globalScope.setInterval(() => {
      if (state.playing && activeHost?.querySelector(".mg-shell")?.dataset.motion !== "static") {
        const host = activeHost.querySelector(".mg-shell");
        host?.style.setProperty("--galaxy-time", String(Date.now() % 100000));
        host?.style.setProperty("--beat-ms", `${Math.round(60000 / clamp(state.bpm, 40, 240, 96))}ms`);
        host?.style.setProperty("--energy-alpha", String(0.18 + clamp(state.energy, 0, 100) / 180));
      }
    }, 250);
  }

  function stopClock() {
    if (clockTimer) globalScope.clearInterval(clockTimer);
    clockTimer = 0;
  }

  function authHeaders(extra = {}) {
    const token = globalScope.HHAuthSession?.token?.() || "";
    return { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}), ...extra };
  }

  function quickMusicPrompt() {
    const idea = String(state.quickIdea || state.promptMusic || "").trim();
    return [
      idea,
      `Genre: ${state.genre}`,
      `Mood: ${state.mood}`,
      `${state.bpm} BPM, key ${state.key}, ${state.timeSignature}`,
      `Instruments: ${state.instruments}`,
      `Structure: ${state.structure}`,
      state.quickInstrumental ? "Instrumental, no vocals" : "Vocals allowed only when described",
      "Original composition; do not imitate a named artist or copyrighted melody"
    ].filter(Boolean).join(". ").slice(0, 4000);
  }

  async function generateQuickBrief() {
    if (quickBriefBusy) return;
    const idea = String(state.quickIdea || "").trim();
    if (!idea) return toast("Hãy mô tả ý tưởng bản nhạc trước.", "error");
    if (!providerReadiness("concept").ready) return toast("Gemini chưa sẵn sàng trên máy chủ.", "error");
    quickBriefBusy = true;
    renderView(activeView);
    try {
      const response = await fetch(`${location.origin}/api/modules/music-ai/actions`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          actionType: "music-plan",
          input: JSON.stringify({ idea, genre: state.genre, mood: state.mood, bpm: state.bpm, key: state.key, instruments: state.instruments, durationSeconds: state.quickDuration, instrumental: state.quickInstrumental }),
          meta: { provider: "gemini", requireProvider: true, creativity: state.creativity }
        })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || `Gemini HTTP ${response.status}`);
      const output = String(data.action?.output || "").trim();
      if (!output) throw new Error("Gemini không trả production brief.");
      state.quickBrief = output.slice(0, 12000);
      state.quickBriefProvider = `${data.action?.provider || "gemini"}${data.action?.model ? ` · ${data.action.model}` : ""}`;
      state.promptMusic = quickMusicPrompt();
      scheduleSync();
      toast("Gemini đã lập production brief và chuẩn hóa prompt nhạc.");
    } catch (error) {
      toast(`Không thể lập brief: ${error.message || error}`, "error");
    } finally {
      quickBriefBusy = false;
      renderView(activeView);
    }
  }

  function enqueueGeneration(type, options = {}) {
    const providerId = type === "music-image" ? "image" : type === "music-sfx" ? "sound" : "music";
    const provider = providerStatus.providers?.[providerId] || {};
    const job = {
      id: `job-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      type,
      name: options.name || (type === "music-image" ? "Cover artwork" : type === "music-sfx" ? "Sound effect" : "Music track"),
      prompt: options.prompt || (type === "music-image" ? state.promptImage : state.promptMusic),
      negativePrompt: state.negativePrompt,
      seed: options.seed || stableSeed(`${state.project}-${Date.now()}`),
      provider: provider.provider || providerId,
      model: provider.model || "",
      status: "queued",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      meta: {
        durationSeconds: type === "music-sfx"
          ? clamp(options.durationSeconds ?? state.sfxDuration, 0.5, 30, 8)
          : clamp(options.durationSeconds || state.quickDuration || 60, 3, 120, 60),
        aspectRatio: state.aspectRatio === "9:16 Canvas" ? "9:16" : state.aspectRatio,
        instrumental: !/vocal|voice|giọng|lyrics/i.test(`${state.instruments} ${state.promptMusic}`),
        ...(options.meta || {})
      },
      commercialRights: "Cần kiểm tra điều khoản thương mại của provider trước khi phát hành",
      estimatedCost: null
    };
    state.generationJobs = [job, ...state.generationJobs].slice(0, 80);
    writeState({ generationJobs: state.generationJobs });
    scheduleSync();
    renderView(activeView);
    processGenerationQueue();
    toast("Đã thêm generation vào hàng đợi.");
    return job;
  }

  function processGenerationQueue() {
    globalScope.clearTimeout(queueTimer);
    if (state.queuePaused || state.generationJobs.some((item) => item.status === "running")) return;
    const next = state.generationJobs.find((item) => item.status === "queued");
    if (!next) return;
    queueTimer = globalScope.setTimeout(() => runGenerationJob(next.id), 60);
  }

  async function runGenerationJob(id) {
    const job = state.generationJobs.find((item) => item.id === id);
    if (!job || job.status !== "queued" || state.queuePaused) return;
    const aborter = new AbortController();
    jobControllers.set(id, aborter);
    updateJob(id, { status: "running", startedAt: new Date().toISOString(), error: "" }, true);
    const started = performance.now();
    try {
      const response = await fetch(`${location.origin}/api/modules/music-ai/actions`, {
        method: "POST",
        headers: authHeaders(),
        signal: aborter.signal,
        body: JSON.stringify({ actionType: job.type, input: job.prompt, meta: { ...job.meta, seed: job.seed } })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || `Provider HTTP ${response.status}`);
      const media = data.media || {};
      let outputUrl = "";
      let size = 0;
      if (media.data) {
        const binary = atob(media.data);
        const bytes = new Uint8Array(binary.length);
        for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
        size = bytes.length;
        outputUrl = URL.createObjectURL(new Blob([bytes], { type: media.mimeType || "application/octet-stream" }));
      }
      const latencyMs = Math.round(performance.now() - started);
      const asset = recordAsset({
        name: `${job.name}-${new Date().toISOString().slice(0, 10)}`,
        kind: media.kind || job.type,
        type: media.mimeType || (job.type === "music-image" ? "image/jpeg" : "audio/mpeg"),
        size,
        provider: job.provider,
        model: media.model || job.model,
        license: job.commercialRights
      });
      recordRun({
        provider: job.provider, model: media.model || job.model, action: job.type,
        prompt: job.prompt, seed: job.seed, usageRights: job.commercialRights,
        version: state.ab, latencyMs, status: "success"
      });
      updateJob(id, {
        status: "success", finishedAt: new Date().toISOString(), latencyMs,
        model: media.model || job.model, outputUrl, assetId: asset?.id || "", mimeType: media.mimeType || "",
        songId: media.songId || "", c2paRequested: Boolean(media.c2paRequested)
      }, true);
      toast(`${job.name} đã hoàn tất.`);
    } catch (error) {
      const cancelled = error?.name === "AbortError";
      updateJob(id, { status: cancelled ? "cancelled" : "failed", error: cancelled ? "Đã hủy theo yêu cầu." : String(error.message || error), finishedAt: new Date().toISOString() }, true);
      toast(cancelled ? "Đã hủy generation." : `Generation thất bại: ${error.message || error}`, cancelled ? "success" : "error");
    } finally {
      jobControllers.delete(id);
      processGenerationQueue();
    }
  }

  function updateJob(id, patch, rerender = false) {
    state.generationJobs = state.generationJobs.map((item) => item.id === id ? { ...item, ...patch, updatedAt: new Date().toISOString() } : item);
    writeState({ generationJobs: state.generationJobs });
    if (rerender && HUBS.has(activeView) || rerender && activeView === "studio") renderView(activeView);
  }

  function jobAction(id, action) {
    const job = state.generationJobs.find((item) => item.id === id);
    if (!job) return;
    if (action === "download" && job.outputUrl) {
      const link = document.createElement("a");
      link.href = job.outputUrl;
      link.download = `${String(job.name || "hh-generation").replace(/[^\p{L}\p{N}-]+/gu, "-").toLowerCase()}.${/image/.test(job.mimeType || "") ? "jpg" : "mp3"}`;
      link.click();
      return;
    }
    if (action === "cancel") {
      jobControllers.get(id)?.abort();
      if (job.status === "queued") updateJob(id, { status: "cancelled", error: "Đã bỏ khỏi hàng đợi." }, true);
      processGenerationQueue();
      return;
    }
    if (action === "retry") {
      updateJob(id, { status: "queued", error: "", startedAt: "", finishedAt: "" }, true);
      processGenerationQueue();
      return;
    }
    if (action === "duplicate") {
      const copy = { ...job, id: `job-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, status: "queued", error: "", outputUrl: "", assetId: "", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
      state.generationJobs = [copy, ...state.generationJobs].slice(0, 80);
      writeState({ generationJobs: state.generationJobs });
      renderView(activeView);
      processGenerationQueue();
    }
  }

  function snapshotArrangement() {
    arrangementUndo.push(JSON.stringify(state.arrangement));
    if (arrangementUndo.length > 80) arrangementUndo.shift();
    arrangementRedo = [];
  }

  function restoreArrangement(stackFrom, stackTo) {
    const value = stackFrom.pop();
    if (!value) return;
    stackTo.push(JSON.stringify(state.arrangement));
    state.arrangement = JSON.parse(value);
    scheduleSync();
    renderView(activeView);
  }

  function sectionAction(id, action) {
    const index = state.arrangement.findIndex((item) => item.id === id);
    const section = state.arrangement[index];
    if (!section) return;
    if (section.locked && action !== "lock") return toast("Section đang khóa.", "error");
    snapshotArrangement();
    const next = state.arrangement.map((item) => ({ ...item, automation: { ...(item.automation || {}) } }));
    if (action === "split") {
      if (section.bars < 4) return toast("Cần ít nhất 4 bars để chia.", "error");
      const firstBars = Math.max(2, Math.floor(section.bars / 2));
      const secondBars = section.bars - firstBars;
      next[index] = { ...section, bars: firstBars };
      next.splice(index + 1, 0, { ...section, id: `${section.id}-${Date.now()}`, label: `${section.label} B`, bars: secondBars, seed: stableSeed(`${section.seed}-split`) });
    }
    if (action === "duplicate") next.splice(index + 1, 0, { ...section, id: `${section.id}-${Date.now()}`, label: `${section.label} Copy`, seed: stableSeed(`${section.seed}-copy`) });
    if (action === "stretch") next[index] = { ...section, bars: clamp(Number(section.bars) + 4, 2, 64) };
    if (action === "freeze") next[index] = { ...section, frozen: !section.frozen };
    if (action === "lock") next[index] = { ...section, locked: !section.locked };
    if (action === "regenerate") {
      const bars = clamp(section.bars, 2, 8, 8);
      enqueueGeneration("music-track", {
        name: `Regenerate ${section.label} · ${bars} bars`,
        seed: stableSeed(`${section.seed}-${Date.now()}`),
        durationSeconds: Math.max(3, Math.round((60 / state.bpm) * 4 * bars)),
        meta: { compositionPlan: { chunks: [{ text: `${state.promptMusic}. Regenerate only ${section.label}; preserve locked musical attributes: ${Object.entries(state.composerLocks).filter(([, value]) => value).map(([key]) => key).join(", ") || "none"}.`, duration_ms: Math.max(3000, Math.round((60 / state.bpm) * 4 * bars * 1000)), positive_styles: [state.genre, state.mood], negative_styles: [state.negativePrompt], context_adherence: "high" }] } }
      });
      arrangementUndo.pop();
      return;
    }
    state.arrangement = next.slice(0, 24);
    scheduleSync();
    renderView(activeView);
  }

  function variableLength(value) {
    let buffer = value & 0x7f;
    const out = [];
    while ((value >>= 7)) {
      buffer <<= 8;
      buffer |= ((value & 0x7f) | 0x80);
    }
    for (;;) {
      out.push(buffer & 0xff);
      if (buffer & 0x80) buffer >>= 8;
      else break;
    }
    return out;
  }

  function midiNote(token) {
    const match = String(token || "").match(/^([A-Ga-g])([#b]?)(-?\d)$/);
    if (!match) return null;
    const pitch = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[match[1].toUpperCase()] + (match[2] === "#" ? 1 : match[2] === "b" ? -1 : 0);
    return clamp((Number(match[3]) + 1) * 12 + pitch, 0, 127, 60);
  }

  function buildMidiFile() {
    const parsed = String(state.melodyNotes || "").match(/[A-Ga-g][#b]?-?\d/g)?.map(midiNote).filter(Number.isFinite) || [];
    const notes = parsed.length ? parsed : [60, 63, 67, 70];
    const division = 480;
    const tempo = Math.round(60000000 / clamp(state.bpm, 40, 240, 96));
    const track = [0, 0xff, 0x51, 3, (tempo >> 16) & 255, (tempo >> 8) & 255, tempo & 255];
    notes.forEach((note, index) => {
      track.push(...variableLength(index ? 0 : 0), 0x90, note, clamp(92 - state.humanizeVelocity + (index * 7 % 20), 1, 127, 90));
      track.push(...variableLength(division), 0x80, note, 0);
    });
    track.push(0, 0xff, 0x2f, 0);
    const bytes = new Uint8Array([
      0x4d, 0x54, 0x68, 0x64, 0, 0, 0, 6, 0, 0, 0, 1, (division >> 8) & 255, division & 255,
      0x4d, 0x54, 0x72, 0x6b, (track.length >> 24) & 255, (track.length >> 16) & 255, (track.length >> 8) & 255, track.length & 255,
      ...track
    ]);
    return {
      bytes,
      blob: new Blob([bytes], { type: "audio/midi" }),
      name: `${String(state.project || "hh-music").replace(/[^\p{L}\p{N}-]+/gu, "-").toLowerCase()}-${state.arrangementSlot}.mid`
    };
  }

  function exportMidi() {
    const file = buildMidiFile();
    const link = document.createElement("a");
    link.href = URL.createObjectURL(file.blob);
    link.download = file.name;
    link.click();
    globalScope.setTimeout(() => URL.revokeObjectURL(link.href), 1000);
    recordAsset({ name: link.download, type: "audio/midi", kind: "midi-export", size: file.bytes.length, provider: "local", license: "User project composition" });
    toast("Đã xuất MIDI chuẩn SMF.");
  }

  async function decodeAudioFile(file) {
    if (!file || file.size > 150 * 1024 * 1024) throw new Error("File audio phải nhỏ hơn 150 MB.");
    const context = new (globalScope.AudioContext || globalScope.webkitAudioContext)();
    try {
      return await context.decodeAudioData(await file.arrayBuffer());
    } finally {
      context.close().catch(() => {});
    }
  }

  function analyzeSamples(buffer) {
    const left = buffer.getChannelData(0);
    const right = buffer.numberOfChannels > 1 ? buffer.getChannelData(1) : left;
    const step = Math.max(1, Math.floor(left.length / 600000));
    let peak = 0, sum = 0, clippingSamples = 0, cross = 0, leftSq = 0, rightSq = 0;
    let low = 0, lowEnergy = 0, highEnergy = 0, totalEnergy = 0;
    let previous = 0;
    const hotspots = [];
    for (let index = 0; index < left.length; index += step) {
      const l = left[index] || 0;
      const r = right[index] || 0;
      const mono = (l + r) * 0.5;
      const abs = Math.max(Math.abs(l), Math.abs(r));
      peak = Math.max(peak, abs);
      sum += mono * mono;
      totalEnergy += mono * mono;
      low += 0.035 * (mono - low);
      lowEnergy += low * low;
      const high = mono - previous;
      highEnergy += high * high;
      previous = mono;
      cross += l * r;
      leftSq += l * l;
      rightSq += r * r;
      if (abs >= 0.999) {
        clippingSamples += 1;
        if (hotspots.length < 12) hotspots.push(Number((index / buffer.sampleRate).toFixed(2)));
      }
    }
    const count = Math.ceil(left.length / step);
    const rms = Math.sqrt(sum / Math.max(1, count));
    const correlation = cross / Math.sqrt(Math.max(1e-12, leftSq * rightSq));
    const lowRatio = lowEnergy / Math.max(1e-12, totalEnergy);
    const highRatio = highEnergy / Math.max(1e-12, totalEnergy * 2);
    return {
      duration: Number(buffer.duration.toFixed(2)),
      peakDb: Number((20 * Math.log10(Math.max(peak, 1e-9))).toFixed(2)),
      rmsDb: Number((20 * Math.log10(Math.max(rms, 1e-9))).toFixed(2)),
      energy: clamp(Math.round(rms * 260), 0, 100),
      clipping: clippingSamples > 0,
      clippingSamples,
      hotspots,
      correlation: Number(correlation.toFixed(3)),
      bands: { Low: clamp(Math.round(lowRatio * 160), 0, 100), Mid: clamp(Math.round((1 - Math.min(1, lowRatio + highRatio)) * 100), 0, 100), High: clamp(Math.round(highRatio * 180), 0, 100) }
    };
  }

  function estimateTempo(buffer) {
    const data = buffer.getChannelData(0);
    const windowSize = Math.max(256, Math.round(buffer.sampleRate * 0.02));
    const energies = [];
    const maxSamples = Math.min(data.length, buffer.sampleRate * 120);
    for (let start = 0; start < maxSamples; start += windowSize) {
      let sum = 0;
      for (let index = start; index < Math.min(start + windowSize, maxSamples); index += 4) sum += data[index] * data[index];
      energies.push(Math.sqrt(sum / Math.max(1, windowSize / 4)));
    }
    const novelty = energies.map((value, index) => Math.max(0, value - (energies[index - 1] || value)));
    let bestBpm = 0, bestScore = -1;
    for (let bpm = 60; bpm <= 180; bpm += 1) {
      const lag = Math.max(1, Math.round((60 / bpm) / (windowSize / buffer.sampleRate)));
      let score = 0;
      for (let index = lag; index < novelty.length; index += 1) score += novelty[index] * novelty[index - lag];
      if (score > bestScore) { bestScore = score; bestBpm = bpm; }
    }
    return bestBpm;
  }

  function estimateKey(buffer) {
    const data = buffer.getChannelData(0);
    const start = Math.min(data.length - 1, Math.floor(buffer.sampleRate * Math.min(10, buffer.duration * 0.2)));
    const length = Math.min(buffer.sampleRate * 8, data.length - start);
    let crossings = 0;
    for (let index = start + 1; index < start + length; index += 1) {
      if ((data[index - 1] < 0 && data[index] >= 0) || (data[index - 1] >= 0 && data[index] < 0)) crossings += 1;
    }
    const frequency = crossings * buffer.sampleRate / Math.max(1, length * 2);
    if (!Number.isFinite(frequency) || frequency < 20) return "Không xác định";
    const midi = Math.round(69 + 12 * Math.log2(frequency / 440));
    return `${["C", "C♯", "D", "E♭", "E", "F", "F♯", "G", "A♭", "A", "B♭", "B"][(midi % 12 + 12) % 12]} (ước tính)`;
  }

  async function analyzeReference(file) {
    toast("Đang phân tích audio tham chiếu trên thiết bị…");
    const buffer = await decodeAudioFile(file);
    const base = analyzeSamples(buffer);
    const analysis = {
      fileName: file.name,
      duration: base.duration,
      bpm: estimateTempo(buffer),
      key: estimateKey(buffer),
      energy: base.energy,
      profile: base.bands.Low > 55 ? "Bass-forward" : base.bands.High > 55 ? "Bright / percussive" : "Balanced / tonal",
      analyzedAt: new Date().toISOString(),
      localOnly: true
    };
    state.referenceAnalysis = analysis;
    scheduleSync();
    renderView(activeView);
    toast("Đã phân tích tham chiếu. Melody không được trích xuất hoặc sao chép.");
  }

  async function analyzeMix(file) {
    toast("Đang đo peak, phổ và stereo field trên thiết bị…");
    const buffer = await decodeAudioFile(file);
    state.mixAnalysis = { ...analyzeSamples(buffer), fileName: file.name, analyzedAt: new Date().toISOString(), localOnly: true };
    scheduleSync();
    renderView(activeView);
    toast("Đã hoàn tất phép đo audio cục bộ.");
  }

  function teardownEngine() {
    if (activeEngine?.unmount) {
      try { activeEngine.unmount(); } catch {}
    }
    activeEngine = null;
  }

  function routeTo(view) {
    if (!ROUTABLE.has(view)) return;
    const navigate = () => {
      state.lastWorkspace = view;
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...storageState(), updatedAt: new Date().toISOString() })); } catch {}
      if (typeof activeOptions.onNavigate === "function") activeOptions.onNavigate(view);
      else if (activeHost && supports(view)) mount(activeHost, { ...activeOptions, view });
    };
    globalScope.clearTimeout(routeTimer);
    const shell = activeHost?.querySelector(".mg-shell");
    const reduced = globalScope.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches || state.motion === "static";
    if (!shell || reduced) return navigate();
    shell.classList.add("is-wormhole");
    routeTimer = globalScope.setTimeout(navigate, state.motion === "cinematic" ? 360 : 280);
  }

  function renderView(view) {
    const stage = activeHost?.querySelector("[data-mps-stage]");
    if (!stage) return;
    teardownEngine();
    activeView = supports(view) ? view : "studio";
    if (activeView === "studio") {
      stage.innerHTML = overviewMarkup();
      return;
    }
    if (HUBS.has(activeView)) {
      stage.innerHTML = renderHub(activeView);
      return;
    }
    const definition = ALL_VIEWS.get(activeView);
    const engine = definition ? globalScope[definition.engine] : null;
    if (!engine?.supports?.(activeView) || typeof engine.mount !== "function") {
      stage.innerHTML = `<section class="mps-engine-error"><strong>Workspace chưa sẵn sàng</strong><p>Không tìm thấy engine ${escapeText(definition?.label || activeView)}.</p><button type="button" data-mg-route="studio">Về Music Galaxy</button></section>`;
      return;
    }
    activeEngine = engine;
    engine.mount(stage, {
      view: activeView,
      project: activeCreativeProject(),
      creativeStore,
      musicGalaxy: globalScope.HHMusicGalaxy,
      onNavigate: routeTo
    });
  }

  function togglePlay() {
    const audio = activeHost?.querySelector("audio");
    if (audio) {
      if (audio.paused) audio.play().catch(() => {});
      else audio.pause();
      state.playing = !audio.paused;
    } else {
      state.playing = !state.playing;
    }
    writeState({ playing: state.playing });
    const button = activeHost?.querySelector("[data-mg-action=toggle-play]");
    if (button) {
      button.setAttribute("aria-pressed", String(state.playing));
      button.querySelector("span").textContent = state.playing ? "Ⅱ" : "▶";
      button.querySelector("small").textContent = state.playing ? "Pause" : "Play";
    }
  }

  function moveSection(id, direction) {
    const index = state.arrangement.findIndex((item) => item.id === id);
    const target = index + Number(direction);
    if (index < 0 || target < 0 || target >= state.arrangement.length) return;
    if (state.arrangement[index]?.locked) return toast("Section đang khóa.", "error");
    snapshotArrangement();
    const next = [...state.arrangement];
    [next[index], next[target]] = [next[target], next[index]];
    state.arrangement = next;
    scheduleSync();
    renderView(activeView);
  }

  function handleClick(event) {
    const route = event.target.closest("[data-mg-route]")?.dataset.mgRoute;
    if (route) return routeTo(route);
    const jobButton = event.target.closest("[data-mg-job-action]");
    if (jobButton) return jobAction(jobButton.dataset.jobId, jobButton.dataset.mgJobAction);
    const mode = event.target.closest("[data-mg-mode]")?.dataset.mgMode;
    if (mode) {
      state.experienceMode = mode === "advanced" ? "advanced" : "basic";
      writeState({ experienceMode: state.experienceMode });
      const shell = activeHost?.querySelector(".mg-shell");
      shell?.classList.toggle("is-basic", state.experienceMode === "basic" && activeView === "studio");
      shell?.classList.toggle("is-advanced", state.experienceMode === "advanced" || activeView !== "studio");
      renderView(activeView);
      return;
    }
    const sfxPreset = event.target.closest("[data-mg-sfx-preset]");
    if (sfxPreset) {
      state.sfxPreset = sfxPreset.dataset.mgSfxPreset;
      state.sfxPrompt = sfxPreset.dataset.prompt || state.sfxPrompt;
      scheduleSync();
      renderView(activeView);
      return;
    }
    const arrangementSlot = event.target.closest("[data-mg-arrangement-slot]")?.dataset.mgArrangementSlot;
    if (arrangementSlot) {
      state.arrangementVersions = { ...state.arrangementVersions, [state.arrangementSlot]: state.arrangement };
      state.arrangementSlot = arrangementSlot;
      const saved = state.arrangementVersions[arrangementSlot];
      state.arrangement = Array.isArray(saved) && saved.length ? saved.map((item) => ({ ...item, automation: { ...(item.automation || {}) } })) : state.arrangement.map((item) => ({ ...item, id: `${item.id}-${arrangementSlot.toLowerCase()}`, automation: { ...(item.automation || {}) } }));
      arrangementUndo = [];
      arrangementRedo = [];
      scheduleSync();
      renderView(activeView);
      return;
    }
    const sectionButton = event.target.closest("[data-mg-section-action]");
    if (sectionButton) return sectionAction(sectionButton.dataset.sectionId, sectionButton.dataset.mgSectionAction);
    const removeMarker = event.target.closest("[data-mg-remove-marker]")?.dataset.mgRemoveMarker;
    if (removeMarker) {
      state.markers = state.markers.filter((item) => item.id !== removeMarker);
      scheduleSync();
      renderView(activeView);
      return;
    }
    const removeSplit = event.target.closest("[data-mg-remove-split]")?.dataset.mgRemoveSplit;
    if (removeSplit && state.releaseSplits.length > 1) {
      state.releaseSplits = state.releaseSplits.filter((item) => item.id !== removeSplit);
      scheduleSync();
      renderView(activeView);
      return;
    }
    const stemControl = event.target.closest("[data-mg-stem-control]");
    if (stemControl) {
      const active = stemControl.getAttribute("aria-pressed") !== "true";
      stemControl.setAttribute("aria-pressed", String(active));
      stemControl.classList.toggle("is-active", active);
      return;
    }
    const hotspot = event.target.closest("[data-mg-hotspot]")?.dataset.mgHotspot;
    if (hotspot != null) {
      const at = Number(hotspot);
      state.markers = [...state.markers, { id: `mix-${Date.now()}`, at, label: "Mix Doctor · clipping", color: "#ff526e" }].slice(0, 80);
      writeState({ markers: state.markers });
      toast(`Đã đánh dấu vấn đề tại ${at.toFixed(2)} giây.`);
      return routeTo("mix-doctor");
    }
    const variation = event.target.closest("[data-mg-variation]")?.dataset.mgVariation;
    if (variation) {
      const selected = state.variations.find((item) => item.id === variation);
      if (selected) {
        state.selectedVariationId = selected.id;
        state.bpm = selected.bpm;
        state.energy = selected.energy;
        scheduleSync();
        renderView(activeView);
      }
      return;
    }
    const target = event.target.closest("[data-mg-target]")?.dataset.mgTarget;
    if (target) {
      const selected = masterTargets().find((item) => item.id === target);
      if (selected) {
        state.mixTarget = selected.id;
        state.loudness = selected.lufs;
        state.truePeak = selected.peak;
        scheduleSync();
        renderView(activeView);
      }
      return;
    }
    const move = event.target.closest("[data-mg-move]");
    if (move) return moveSection(move.dataset.mgMove, move.dataset.direction);
    const remove = event.target.closest("[data-mg-remove-section]")?.dataset.mgRemoveSection;
    if (remove) {
      if (state.arrangement.find((item) => item.id === remove)?.locked) return toast("Section đang khóa.", "error");
      snapshotArrangement();
      state.arrangement = state.arrangement.filter((item) => item.id !== remove);
      scheduleSync();
      renderView(activeView);
      return;
    }
    const action = event.target.closest("[data-mg-action]")?.dataset.mgAction;
    if (!action) return;
    if (action === "toggle-play") togglePlay();
    if (action === "toggle-loop") {
      state.loop = !state.loop;
      writeState({ loop: state.loop });
      event.target.closest("button")?.classList.toggle("is-active", state.loop);
    }
    if (action === "toggle-ab") {
      state.ab = state.ab === "A" ? "B" : state.ab === "B" ? "C" : "A";
      writeState({ ab: state.ab });
      event.target.closest("button")?.querySelector("b")?.replaceChildren(state.ab);
    }
    if (action === "add-marker") {
      const audio = activeHost.querySelector("audio");
      const at = audio ? Number(audio.currentTime.toFixed(2)) : state.markers.length * 8;
      state.markers = [...state.markers, { id: `marker-${Date.now()}`, at, label: `Marker ${state.markers.length + 1}` }].slice(0, 80);
      writeState({ markers: state.markers });
      event.target.closest("button")?.querySelector("small")?.replaceChildren(`Marker ${state.markers.length}`);
      toast(`Đã thêm marker tại ${at.toFixed(1)} giây.`);
    }
    if (action === "load-creative" || action === "resolve-creative") {
      conflict = null;
      loadFromCreative(true, true);
      toast("Đã nạp dữ liệu từ phần Sáng tạo.");
    }
    if (action === "sync-creative" || action === "resolve-music") {
      if (syncToCreative(action === "resolve-music", true)) {
        renderView(activeView);
        toast("Đã đồng bộ Music AI vào Universal Project.");
      }
    }
    if (action === "close-conflict") {
      conflict = null;
      renderConflict();
    }
    if (action === "generate-variations") generateVariations();
    if (action === "refresh-providers") {
      refreshProviders();
      toast("Đang kiểm tra lại kết nối máy chủ.");
    }
    if (action === "quick-brief") generateQuickBrief();
    if (action === "quick-generate") {
      if (!String(state.quickIdea || state.promptMusic || "").trim()) return toast("Hãy nhập ý tưởng bản nhạc trước.", "error");
      if (!providerReadiness("music").ready) return toast(providerReadiness("music").label, "error");
      state.promptMusic = quickMusicPrompt();
      scheduleSync();
      enqueueGeneration("music-track", { name: state.project || "AI music track", prompt: state.promptMusic, durationSeconds: Number(state.quickDuration), meta: { instrumental: Boolean(state.quickInstrumental) } });
    }
    if (action === "queue-sfx") {
      if (!String(state.sfxPrompt || "").trim()) return toast("Hãy mô tả hiệu ứng âm thanh.", "error");
      if (!providerReadiness("sound").ready) return toast(providerReadiness("sound").label, "error");
      enqueueGeneration("music-sfx", { name: `SFX · ${state.sfxPreset}`, prompt: state.sfxPrompt, durationSeconds: Number(state.sfxDuration), meta: { promptInfluence: Number(state.sfxInfluence), loop: Boolean(state.sfxLoop) } });
    }
    if (action === "toggle-queue") {
      state.queuePaused = !state.queuePaused;
      writeState({ queuePaused: state.queuePaused });
      scheduleSync();
      renderView(activeView);
      if (!state.queuePaused) processGenerationQueue();
    }
    if (action === "queue-track") enqueueGeneration("music-track");
    if (action === "queue-cover") enqueueGeneration("music-image");
    if (action === "build-hybrid") {
      const selected = Object.entries(state.hybridSections).filter(([, value]) => value);
      if (!selected.length) return toast("Hãy chọn ít nhất một section từ các vệ tinh.", "error");
      const seed = stableSeed(JSON.stringify(selected));
      const hybrid = {
        id: `hybrid-${seed.toString(36)}`, name: "Hybrid Version", bpm: state.bpm, key: state.key,
        energy: Math.round(selected.reduce((sum, [, id]) => sum + Number(state.variations.find((item) => item.id === id)?.energy || state.energy), 0) / selected.length),
        seed, hybridSections: { ...state.hybridSections }, scores: { Melody: 75, Groove: 74, Energy: state.energy, Vocal: 72, Platform: 78 },
        reason: "Được ghép từ các section bạn chọn; mọi nguồn A/B/C được lưu để truy vết."
      };
      state.variations = [hybrid, ...state.variations.filter((item) => !String(item.id).startsWith("hybrid-"))].slice(0, 6);
      state.selectedVariationId = hybrid.id;
      scheduleSync();
      renderView(activeView);
      toast("Đã tạo Hybrid Version và lưu nguồn từng section.");
    }
    if (action === "compose-prompt") {
      state.promptMusic = `${state.genre}; ${state.mood}; ${state.bpm} BPM; key ${state.key}; ${state.timeSignature}; instruments: ${state.instruments}; structure: ${state.structure}; chord progression: ${state.chords}; energy ${state.energy}/100; original composition.`;
      scheduleSync();
      renderView(activeView);
      toast("Đã ghép prompt từ Song DNA.");
    }
    if (action === "lyrics-template") {
      state.lyrics = `[Intro]\n\n[Verse 1]\n\n[Pre-Chorus]\n\n[Chorus]\n\n[Verse 2]\n\n[Bridge]\n\n[Final Chorus]\n\n[Outro]`;
      scheduleSync();
      renderView(activeView);
    }
    if (action === "suggest-notes") {
      state.melodyNotes = `${state.key}: G4 Ab4 C5 Bb4 · G4 Eb4 F4 G4`;
      state.bassline = `${state.chords} · root notes, syncopated quarter/eighth pattern`;
      scheduleSync();
      renderView(activeView);
    }
    if (action === "export-midi") exportMidi();
    if (action === "undo-arrangement") restoreArrangement(arrangementUndo, arrangementRedo);
    if (action === "redo-arrangement") restoreArrangement(arrangementRedo, arrangementUndo);
    if (action === "save-arrangement-version") {
      state.arrangementVersions = { ...state.arrangementVersions, [state.arrangementSlot]: state.arrangement.map((item) => ({ ...item, automation: { ...(item.automation || {}) } })) };
      scheduleSync();
      toast(`Đã lưu Arrangement ${state.arrangementSlot}.`);
    }
    if (action === "add-section") {
      snapshotArrangement();
      state.arrangement = [...state.arrangement, { id: `section-${Date.now()}`, label: "Section mới", bars: 8, energy: 50, color: "#61e9ef", locked: false, frozen: false, loop: false, seed: stableSeed(Date.now()), automation: { volume: 75, pan: 50, filter: 70, reverb: 30 } }].slice(0, 24);
      scheduleSync();
      renderView(activeView);
    }
    if (action === "add-split") {
      state.releaseSplits = [...state.releaseSplits, { id: `split-${Date.now()}`, name: "Người nhận mới", role: "Contributor", percent: 0 }].slice(0, 20);
      scheduleSync();
      renderView(activeView);
    }
    if (action === "toggle-mix-preview") {
      state.mixPreviewEnabled = !state.mixPreviewEnabled;
      scheduleSync();
      renderView(activeView);
      toast(state.mixPreviewEnabled ? "Preview bật. Mọi thay đổi vẫn cần xác nhận trong Mix Doctor." : "Đã tắt Preview.");
    }
    if (action === "visual-prompts") {
      state.promptImage = `${state.scene}. Palette: ${state.palette}. Premium cinematic album cover, ${state.aspectRatio}, no text, no logo, no watermark.`;
      state.promptMotion = `${state.scene}. Slow parallax, subtle particles reacting to ${state.bpm} BPM, seamless loop, stable camera, palette ${state.palette}.`;
      scheduleSync();
      renderView(activeView);
    }
    if (action === "snapshot") {
      if (syncToCreative(true, true)) toast("Đã tạo snapshot Universal Project.");
    }
    if (action === "open-video-editor") {
      const project = activeCreativeProject();
      const ratio = state.aspectRatio === "9:16" || state.aspectRatio === "9:16 Canvas" ? [1080, 1920] : state.aspectRatio === "1:1" ? [1080, 1080] : [1920, 1080];
      const editor = safeJson("hh.video-editor.project.v1");
      const linked = {
        ...editor,
        name: editor.name || `${state.project} · Visual`,
        width: ratio[0],
        height: ratio[1],
        universalProjectId: project?.id || "",
        universalProjectName: state.project,
        musicGalaxyLink: { projectId: project?.id || "", palette: state.palette, mood: state.mood, bpm: state.bpm, source: "music-galaxy", linkedAt: new Date().toISOString() }
      };
      try { localStorage.setItem("hh.video-editor.project.v1", JSON.stringify(linked)); } catch {}
      location.hash = "#/davinci-resolve";
    }
  }

  function handleInput(event) {
    const fieldNode = event.target.closest("[data-mg-field]");
    if (fieldNode) {
      const key = fieldNode.dataset.mgField;
      const value = fieldNode.type === "checkbox" ? fieldNode.checked : fieldNode.type === "number" || fieldNode.type === "range" ? Number(fieldNode.value) : fieldNode.value;
      setField(key, value);
      fieldNode.closest("label")?.querySelector("span b")?.replaceChildren(String(value));
      return;
    }
    const lock = event.target.closest("[data-mg-lock]")?.dataset.mgLock;
    if (lock) {
      state.composerLocks = { ...state.composerLocks, [lock]: event.target.checked };
      scheduleSync();
      return;
    }
    const hybrid = event.target.closest("[data-mg-hybrid]")?.dataset.mgHybrid;
    if (hybrid) {
      state.hybridSections = { ...state.hybridSections, [hybrid]: event.target.value };
      scheduleSync();
      return;
    }
    const automation = event.target.closest("[data-mg-automation]");
    if (automation) {
      const id = automation.dataset.mgAutomation;
      const lane = automation.dataset.lane;
      state.arrangement = state.arrangement.map((item) => item.id === id ? lane === "energy" ? { ...item, energy: Number(automation.value) } : { ...item, automation: { ...(item.automation || {}), [lane]: Number(automation.value) } } : item);
      scheduleSync();
      return;
    }
    const label = event.target.closest("[data-section-label]")?.dataset.sectionLabel;
    if (label) {
      state.arrangement = state.arrangement.map((item) => item.id === label ? { ...item, label: event.target.value } : item);
      scheduleSync();
      return;
    }
    const markerLabel = event.target.closest("[data-mg-marker-label]")?.dataset.mgMarkerLabel;
    if (markerLabel) {
      state.markers = state.markers.map((item) => item.id === markerLabel ? { ...item, label: event.target.value } : item);
      scheduleSync();
      return;
    }
    const markerLoop = event.target.closest("[data-mg-marker-loop]")?.dataset.mgMarkerLoop;
    if (markerLoop) {
      state.markers = state.markers.map((item) => item.id === markerLoop ? { ...item, loop: event.target.checked } : item);
      scheduleSync();
      return;
    }
    const splitName = event.target.closest("[data-mg-split-name]")?.dataset.mgSplitName;
    const splitRole = event.target.closest("[data-mg-split-role]")?.dataset.mgSplitRole;
    const splitPercent = event.target.closest("[data-mg-split-percent]")?.dataset.mgSplitPercent;
    if (splitName || splitRole || splitPercent) {
      const id = splitName || splitRole || splitPercent;
      state.releaseSplits = state.releaseSplits.map((item) => item.id === id ? { ...item, ...(splitName ? { name: event.target.value } : splitRole ? { role: event.target.value } : { percent: clamp(event.target.value, 0, 100, 0) }) } : item);
      scheduleSync();
      return;
    }
    if (event.target.closest(".mg-stage")) scheduleSync();
  }

  function handleChange(event) {
    if (event.target.matches("[data-mg-project-select]")) {
      creativeStore?.setActiveProject?.(event.target.value);
      state.dirty = false;
      loadFromCreative(true, true);
      toast("Đã chuyển Universal Project.");
    }
    if (event.target.matches("[data-mg-motion]")) {
      state.motion = event.target.value;
      writeState({ motion: state.motion });
    }
    if (event.target.matches("[data-mg-theme]")) {
      state.theme = event.target.value;
      scheduleSync();
      updateChrome();
    }
    if (event.target.matches("[data-mg-reference-file]")) {
      analyzeReference(event.target.files?.[0]).catch((error) => toast(error.message || String(error), "error"));
      event.target.value = "";
    }
    if (event.target.matches("[data-mg-mix-file]")) {
      analyzeMix(event.target.files?.[0]).catch((error) => toast(error.message || String(error), "error"));
      event.target.value = "";
    }
    if (event.target.matches("[data-mg-platform]")) {
      const name = event.target.dataset.mgPlatform;
      state.releasePlatforms = event.target.checked ? [...new Set([...state.releasePlatforms, name])] : state.releasePlatforms.filter((item) => item !== name);
      scheduleSync();
    }
    if (event.target.matches("[data-mg-visual-layer]")) {
      const layer = event.target.dataset.mgVisualLayer;
      state.visualLayers = event.target.checked ? [...new Set([...state.visualLayers, layer])] : state.visualLayers.filter((item) => item !== layer);
      scheduleSync();
      renderView(activeView);
    }
  }

  function handleKeydown(event) {
    const typing = /INPUT|TEXTAREA|SELECT/.test(event.target.tagName) || event.target.isContentEditable;
    if (!typing && event.code === "Space") {
      event.preventDefault();
      togglePlay();
    }
    if (!typing && event.altKey && /^[1-6]$/.test(event.key)) {
      event.preventDefault();
      routeTo(PLANETS[Number(event.key) - 1].id);
    }
    if (!typing && (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
      event.preventDefault();
      restoreArrangement(event.shiftKey ? arrangementRedo : arrangementUndo, event.shiftKey ? arrangementUndo : arrangementRedo);
    }
    if (!typing && (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "y") {
      event.preventDefault();
      restoreArrangement(arrangementRedo, arrangementUndo);
    }
    if (event.key === "Escape" && activeView !== "studio") routeTo("studio");
  }

  function handleDragStart(event) {
    const midi = event.target.closest("[data-mg-midi-drag]");
    if (midi) {
      const file = buildMidiFile();
      const url = URL.createObjectURL(file.blob);
      event.dataTransfer?.setData("DownloadURL", `audio/midi:${file.name}:${url}`);
      event.dataTransfer?.setData("text/uri-list", url);
      if (event.dataTransfer) event.dataTransfer.effectAllowed = "copy";
      globalScope.setTimeout(() => URL.revokeObjectURL(url), 60000);
      toast("Kéo file MIDI vào DAW của bạn.");
      return;
    }
    const section = event.target.closest("[data-section-id]");
    if (!section) return;
    dragSectionId = section.dataset.sectionId;
    section.classList.add("is-dragging");
  }

  function handleDragOver(event) {
    if (dragSectionId && event.target.closest("[data-section-id]")) event.preventDefault();
  }

  function handleDrop(event) {
    const targetId = event.target.closest("[data-section-id]")?.dataset.sectionId;
    if (!dragSectionId || !targetId || dragSectionId === targetId) return;
    event.preventDefault();
    const next = [...state.arrangement];
    const from = next.findIndex((item) => item.id === dragSectionId);
    const to = next.findIndex((item) => item.id === targetId);
    if (next[from]?.locked) return toast("Section đang khóa.", "error");
    snapshotArrangement();
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    state.arrangement = next;
    dragSectionId = "";
    scheduleSync();
    renderView(activeView);
  }

  function handleDragEnd() {
    dragSectionId = "";
    activeHost?.querySelectorAll(".is-dragging").forEach((node) => node.classList.remove("is-dragging"));
  }

  function recordAsset(meta = {}) {
    const store = ensureCreativeStore();
    const project = activeCreativeProject();
    if (!store || !project) return null;
    const asset = store.addAsset(project.id, {
      name: meta.name || `${state.project}-${meta.kind || "asset"}`,
      type: meta.type || meta.mimeType || "application/octet-stream",
      kind: meta.kind || "music-ai",
      size: Number(meta.size || 0),
      license: meta.license || "AI-generated; verify provider commercial terms",
      tags: ["music-ai", meta.provider || "local", meta.model || ""].filter(Boolean),
      createdAt: new Date().toISOString()
    });
    updateChrome();
    return asset;
  }

  function recordRun(meta = {}) {
    if (/status/i.test(meta.action || "")) return null;
    const store = ensureCreativeStore();
    const project = activeCreativeProject();
    if (!store || !project) return null;
    return store.addRun(project.id, {
      provider: meta.provider || "local",
      model: meta.model || "",
      action: meta.action || "music-ai",
      prompt: meta.prompt || state.promptMusic,
      seed: String(meta.seed || state.variations.find((item) => item.id === state.selectedVariationId)?.seed || ""),
      usageRights: meta.usageRights || "Review the selected provider terms before commercial release",
      version: meta.version || state.ab,
      estimatedCost: Number(meta.estimatedCost || 0),
      latencyMs: Number(meta.latencyMs || 0),
      status: meta.status || "success",
      createdAt: new Date().toISOString()
    });
  }

  function ingestStudioState(input = {}) {
    const project = input.project || {};
    const automation = input.automation || {};
    const next = {
      project: project.name || state.project,
      genre: project.genre || state.genre,
      bpm: clamp(project.bpm, 40, 240, state.bpm),
      mood: project.mood || state.mood,
      instruments: project.instruments || state.instruments,
      scene: project.scene || state.scene,
      palette: project.palette || state.palette,
      promptMusic: automation.idea || state.promptMusic,
      variations: Array.isArray(automation.variants) && automation.variants.length
        ? automation.variants.slice(0, 6).map((item, index) => ({
          id: item.id || `studio-${index + 1}`,
          name: item.name || `Studio ${index + 1}`,
          bpm: clamp(item.bpm || project.bpm, 40, 240, state.bpm),
          key: item.key || state.key,
          energy: clamp(item.energy || 50, 0, 100, 50),
          seed: item.seed || stableSeed(`${project.name || state.project}-${index}`)
        }))
        : state.variations
    };
    const changed = Object.entries(next).some(([key, value]) => JSON.stringify(state[key]) !== JSON.stringify(value));
    if (!changed) return false;
    state = { ...state, ...next };
    scheduleSync();
    return true;
  }

  function ingestAppsState(input = {}) {
    const concept = input.concept || {};
    const image = input.image || {};
    const music = input.music || {};
    const video = input.video || {};
    const next = {
      genre: concept.genre || state.genre,
      audience: concept.audience || state.audience,
      purpose: concept.idea || state.purpose,
      promptMusic: music.prompt || concept.idea || state.promptMusic,
      promptImage: image.prompt || state.promptImage,
      promptMotion: video.prompt || state.promptMotion,
      aspectRatio: image.aspectRatio || video.aspectRatio || state.aspectRatio
    };
    const changed = Object.entries(next).some(([key, value]) => state[key] !== value);
    if (!changed) return false;
    state = { ...state, ...next };
    scheduleSync();
    return true;
  }

  function mount(host, options = {}) {
    if (!host || typeof host.replaceChildren !== "function") return false;
    unmount();
    activeHost = host;
    activeOptions = options || {};
    state = readState();
    ensureCreativeStore();
    const project = activeCreativeProject();
    if (project && !state.lastCreativeUpdatedAt) loadFromCreative(true, false);
    const requested = supports(options.view) ? options.view : "studio";
    activeView = requested;
    controller = new AbortController();
    host.innerHTML = shellMarkup(requested);
    host.addEventListener("click", handleClick, { signal: controller.signal });
    host.addEventListener("input", handleInput, { signal: controller.signal });
    host.addEventListener("change", handleChange, { signal: controller.signal });
    host.addEventListener("keydown", handleKeydown, { signal: controller.signal });
    host.addEventListener("dragstart", handleDragStart, { signal: controller.signal });
    host.addEventListener("dragover", handleDragOver, { signal: controller.signal });
    host.addEventListener("drop", handleDrop, { signal: controller.signal });
    host.addEventListener("dragend", handleDragEnd, { signal: controller.signal });
    host.addEventListener("play", () => writeState({ playing: true }), { capture: true, signal: controller.signal });
    host.addEventListener("pause", () => writeState({ playing: false }), { capture: true, signal: controller.signal });
    renderView(requested);
    renderConflict();
    startClock();
    refreshProviders();
    return true;
  }

  function unmount() {
    stopClock();
    globalScope.clearTimeout(autosaveTimer);
    teardownEngine();
    controller?.abort();
    controller = null;
    if (activeHost) activeHost.replaceChildren();
    activeHost = null;
    activeOptions = {};
    activeView = "studio";
  }

  const api = Object.freeze({
    supports,
    mount,
    unmount,
    planets: PLANETS.map((item) => ({ ...item })),
    loadFromCreative,
    syncToCreative,
    recordAsset,
    recordRun,
    ingestStudioState,
    ingestAppsState,
    notifyDirty: scheduleSync,
    getState: () => ({ ...state }),
    getCreativeProject: activeCreativeProject
  });
  globalScope.HHMusicGalaxy = api;
  globalScope.HHMusicProductionSuite = api;
})(window);
