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
    { id: "ideas-lyrics", label: "Ý tưởng & Lyrics", icon: "IL", color: "#ff70c8", views: ["composer", "lyrics"], provider: "concept" },
    { id: "compose-midi", label: "Sáng tác & MIDI", icon: "CM", color: "#8e7dff", views: ["musical-brain", "audio-midi", "session-band", "region-editor"], provider: "music" },
    { id: "arrange-record", label: "Phối khí & Thu âm", icon: "AR", color: "#61e9ef", views: ["arrange", "record", "stems", "vocal", "sound-design", "sample-browser", "adaptive-soundtrack"], provider: "local" },
    { id: "mix-master-hub", label: "Mix & Master", icon: "MM", color: "#b9f36a", views: ["mix", "master", "mix-doctor", "live-performance"], provider: "local" },
    { id: "visual-universe", label: "Visual Universe", icon: "VU", color: "#ff9b5c", views: ["video", "image-music", "visualizer", "realtime-jam"], provider: "image" },
    { id: "release-control", label: "Xuất bản & Bản quyền", icon: "RC", color: "#ffd76a", views: ["publish", "rights", "release-manager", "project-branches"], provider: "youtube" }
  ];

  const LEGACY_ROUTES = new Set([
    "project", "app-center", "concept-lab", "image-lab", "music-lab", "veo-lab", "render-lab",
    "prompt-studio", "loop-builder", "audio-qa", "chapters", "youtube-pack", "youtube-publisher", "publish-checklist"
  ]);
  const ALL_VIEWS = new Map([...PRIMARY_VIEWS, ...LAB_VIEWS].map((item) => [item.id, item]));
  const HUBS = new Set(PLANETS.map((item) => item.id));
  const ROUTABLE = new Set(["studio", ...HUBS, ...ALL_VIEWS.keys(), ...LEGACY_ROUTES]);
  const STORAGE_KEY = "hh.music.galaxy.v2";
  const STUDIO_KEY = "hh.music-ai-studio.v1";
  const APPS_KEY = "hh.music-ai.apps.v1";
  const DEFAULT_ARRANGEMENT = [
    { id: "intro", label: "Intro", bars: 8, energy: 24 },
    { id: "verse", label: "Verse", bars: 16, energy: 46 },
    { id: "chorus", label: "Chorus", bars: 16, energy: 78 },
    { id: "bridge", label: "Bridge", bars: 8, energy: 58 },
    { id: "outro", label: "Outro", bars: 8, energy: 20 }
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
    const saved = safeJson(STORAGE_KEY);
    return {
      ...base,
      ...saved,
      arrangement: Array.isArray(saved.arrangement) && saved.arrangement.length ? saved.arrangement.slice(0, 24) : base.arrangement,
      variations: Array.isArray(saved.variations) ? saved.variations.slice(0, 6) : [],
      markers: Array.isArray(saved.markers) ? saved.markers.slice(0, 80) : [],
      releasePlatforms: Array.isArray(saved.releasePlatforms) ? saved.releasePlatforms.slice(0, 8) : base.releasePlatforms
    };
  }

  let state = readState();

  function writeState(patch = {}) {
    state = { ...state, ...patch, updatedAt: new Date().toISOString() };
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch {}
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
      variations: Array.isArray(music.variations) ? music.variations : state.variations,
      mixTarget: music.mix?.target || state.mixTarget,
      loudness: music.mix?.loudness ?? state.loudness,
      truePeak: music.mix?.truePeak ?? state.truePeak,
      visualMode: music.visual?.mode || state.visualMode,
      aspectRatio: music.visual?.aspectRatio || state.aspectRatio,
      releaseTitle: music.release?.title || state.releaseTitle,
      releasePlatforms: Array.isArray(music.release?.platforms) ? music.release.platforms : state.releasePlatforms,
      rightsVerified: Boolean(project?.rights?.verified),
      metadataReady: Boolean(music.release?.checklist?.metadata),
      consentReady: Boolean(music.release?.checklist?.consent)
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
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch {}
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
      schemaVersion: 2,
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
      lyrics: { ...(oldMusic.lyrics || {}), content: state.lyrics, difficultLines: difficultLyrics(state.lyrics) },
      mix: { ...(oldMusic.mix || {}), target: state.mixTarget, loudness: state.loudness, truePeak: state.truePeak },
      visual: { ...(oldMusic.visual || {}), mode: state.visualMode, aspectRatio: state.aspectRatio, palette: state.palette },
      release: {
        ...(oldMusic.release || {}), title: state.releaseTitle, platforms: state.releasePlatforms,
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
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch {}
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
    const project = activeCreativeProject();
    return `<section class="mps-shell mg-shell ${state.playing ? "is-playing" : ""}" data-motion="${escapeText(state.motion)}" data-mps-view="${escapeText(view)}">
      <header class="mg-topbar">
        <button type="button" class="mg-brand" data-mg-route="studio"><span>HH</span><div><strong>Music Galaxy</strong><small>Universal AI Production System</small></div></button>
        <div class="mg-project-switcher">
          <label><span>Dự án Sáng tạo</span><select data-mg-project-select>${projectOptions()}</select></label>
          <span class="mg-sync-state" data-sync-state="${state.syncStatus === "Có xung đột" ? "conflict" : state.syncStatus === "Đang đồng bộ" ? "syncing" : "saved"}"><i></i>${escapeText(state.syncStatus)}</span>
          <button type="button" data-mg-action="load-creative">Nạp từ Sáng tạo</button>
          <button type="button" data-mg-action="sync-creative">Đồng bộ ngược</button>
        </div>
        <label class="mg-motion"><span>Hiệu ứng</span><select data-mg-motion><option value="static" ${state.motion === "static" ? "selected" : ""}>Tĩnh</option><option value="balanced" ${state.motion === "balanced" ? "selected" : ""}>Cân bằng</option><option value="cinematic" ${state.motion === "cinematic" ? "selected" : ""}>Điện ảnh</option></select></label>
      </header>
      <nav class="mg-planet-nav" aria-label="Sáu hành tinh sản xuất">${planetNav(view)}</nav>
      <main class="mps-stage mg-stage" data-mps-stage></main>
      ${transportMarkup()}
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

  function overviewMarkup() {
    const project = activeCreativeProject();
    const assets = project?.assets || [];
    const runs = project?.analytics?.runs || [];
    return `<div class="mg-overview">
      <section class="mg-hero">
        <div class="mg-nebula" aria-hidden="true"><i></i><i></i><i></i>${waveMarkup(70)}</div>
        <div class="mg-hero-copy"><p><i></i> HH MUSIC COSMOS · ${providerStatus.canRunMedia ? "AI ONLINE" : "LOCAL-FIRST"}</p><h1>Music Galaxy</h1><h2>Một dự án. Sáu hành tinh. Toàn bộ hành trình âm nhạc.</h2><span>Song DNA, MIDI, lyrics, arrangement, stem, vocal, mix, visual và phát hành cùng dùng một Universal Project.</span><div><button type="button" data-mg-route="ideas-lyrics">Bắt đầu sáng tạo</button><button type="button" data-mg-action="generate-variations">Tạo Variation Galaxy</button></div></div>
        <div class="mg-orbit-system" aria-label="Dự án hiện tại nằm ở trung tâm Music Galaxy">
          <div class="mg-project-star"><span>HH</span><strong>${escapeText(state.project)}</strong><small>${overallProgress()}%</small></div>
          ${PLANETS.map((planet, index) => `<button type="button" data-mg-route="${planet.id}" style="--orbit:${index};--planet:${planet.color}" title="${escapeText(planet.label)}"><i>${planet.icon}</i><span>${escapeText(planet.label)}</span></button>`).join("")}
        </div>
      </section>
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
      </section>
    </div>`;
  }

  function field(label, key, value, attrs = "") {
    return `<label class="mg-field"><span>${escapeText(label)}</span><input data-mg-field="${escapeText(key)}" value="${escapeText(value)}" ${attrs}></label>`;
  }

  function textarea(label, key, value, rows = 4) {
    return `<label class="mg-field mg-field--wide"><span>${escapeText(label)}</span><textarea data-mg-field="${escapeText(key)}" rows="${rows}">${escapeText(value)}</textarea></label>`;
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
    return `<header class="mg-hub-hero" style="--planet:${planet.color}"><div><p>HÀNH TINH ${escapeText(planet.icon)} · ${tasks.progress}%</p><h1>${escapeText(title)}</h1><span>${escapeText(copy)}</span></div><aside><strong>${tasks.remaining}</strong><small>tác vụ còn lại</small><button type="button" data-mg-route="studio">Về Music Galaxy</button></aside></header>`;
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
    return `<div class="mg-hub">${hubHeader(planet, "Ý tưởng & Lyrics", "Từ Creative Brief đến prompt có cấu trúc và lời hát khớp nhịp.")}
      <div class="mg-two-panel">
        <section class="mg-panel"><header><small>PROMPT COMPOSER</small><h2>Âm nhạc có cấu trúc</h2></header><div class="mg-form-grid">${field("Thể loại", "genre", state.genre)}${field("Mood", "mood", state.mood)}${field("Nhạc cụ", "instruments", state.instruments)}${field("Cấu trúc", "structure", state.structure)}${textarea("Prompt tạo nhạc", "promptMusic", state.promptMusic, 6)}${textarea("Negative prompt", "negativePrompt", state.negativePrompt, 3)}</div><footer><button type="button" data-mg-action="compose-prompt">Ghép prompt thông minh</button><button type="button" data-mg-route="composer">Mở AI Composer</button></footer></section>
        <section class="mg-panel"><header><small>LYRICS SYNC</small><h2>Nhịp âm tiết & phát âm</h2></header>${textarea("Lời bài hát", "lyrics", state.lyrics, 12)}<div class="mg-lyrics-health"><span><strong>${syllableCount(state.lyrics)}</strong><small>âm tiết ước tính</small></span><span><strong>${String(state.lyrics || "").split(/\n/).filter(Boolean).length}</strong><small>dòng lời</small></span><span class="${hard.length ? "is-warn" : ""}"><strong>${hard.length}</strong><small>dòng khó hát</small></span></div><footer><button type="button" data-mg-action="lyrics-template">Tạo khung Lyrics</button><button type="button" data-mg-route="lyrics">Mở Lyrics Studio</button></footer></section>
      </div>${toolsMarkup(planet.views)}</div>`;
  }

  function composeHub() {
    const planet = PLANETS[1];
    return `<div class="mg-hub">${hubHeader(planet, "Sáng tác & MIDI", "Song DNA, Variation Galaxy, chord, melody và bassline trong cùng một hệ.")}
      <div class="mg-two-panel">
        <section class="mg-panel"><header><small>SONG DNA</small><h2>Hồ sơ âm nhạc tái sử dụng</h2></header><div class="mg-form-grid">${field("BPM", "bpm", state.bpm, 'type="number" min="40" max="240"')}${field("Tone", "key", state.key)}${field("Nhịp", "timeSignature", state.timeSignature)}${field("Groove", "groove", state.groove)}${field("Hợp âm", "chords", state.chords)}${field("Energy 0–100", "energy", state.energy, 'type="range" min="0" max="100"')}</div><div class="mg-dna-orbit"><i style="--energy:${clamp(state.energy, 0, 100)}%"><span>DNA</span></i><p><strong>${escapeText(state.key)}</strong><small>${state.bpm} BPM · ${escapeText(state.timeSignature)}</small><em>${escapeText(state.chords)}</em></p></div></section>
        <section class="mg-panel"><header><small>VARIATION GALAXY</small><h2>So sánh A/B có seed</h2></header><div class="mg-variation-grid">${variationMarkup()}</div><footer><label>Số biến thể <select data-mg-variation-count><option>3</option><option>4</option><option>5</option><option>6</option></select></label><button type="button" data-mg-action="generate-variations">Tạo biến thể</button><button type="button" data-mg-route="region-editor">Biên tập từng vùng</button></footer></section>
      </div>
      <section class="mg-panel mg-chord-lab"><header><small>CHORD & MELODY LAB</small><h2>Ý tưởng có thể xuất MIDI</h2></header><div class="mg-form-grid">${field("Chord progression", "chords", state.chords)}${field("Melody notes", "melodyNotes", state.melodyNotes)}${field("Bassline", "bassline", state.bassline)}</div><div class="mg-piano-roll" aria-hidden="true">${Array.from({ length: 32 }, (_, index) => `<i class="${index % 7 === 0 || index % 11 === 0 ? "is-note" : ""}"></i>`).join("")}</div><footer><button type="button" data-mg-action="suggest-notes">Đề xuất melody & bass</button><button type="button" data-mg-route="audio-midi">Mở Piano Roll / Export MIDI</button></footer></section>
      ${toolsMarkup(planet.views)}</div>`;
  }

  function variationMarkup() {
    if (!state.variations.length) return `<div class="mg-empty">Chưa có biến thể. Chọn 3–6 phương án để tạo Variation Galaxy.</div>`;
    return state.variations.map((item, index) => `<button type="button" class="${state.selectedVariationId === item.id ? "is-selected" : ""}" data-mg-variation="${escapeText(item.id)}"><i>${String.fromCharCode(65 + index)}</i><span><strong>${escapeText(item.name)}</strong><small>${item.bpm} BPM · ${escapeText(item.key)} · Seed ${item.seed}</small></span><b>${item.energy}%</b></button>`).join("");
  }

  function arrangeHub() {
    const planet = PLANETS[2];
    return `<div class="mg-hub">${hubHeader(planet, "Phối khí & Thu âm", "Arrangement Canvas kéo thả, take lane, stem và vocal consent.")}
      <section class="mg-panel"><header><small>ARRANGEMENT CANVAS</small><h2>Kéo thả cấu trúc bài hát</h2></header><div class="mg-arrangement" data-mg-arrangement>${state.arrangement.map((section, index) => `<article draggable="true" data-section-id="${escapeText(section.id)}" style="--energy:${clamp(section.energy, 0, 100)}%"><i>${String(index + 1).padStart(2, "0")}</i><label><input data-section-label="${escapeText(section.id)}" value="${escapeText(section.label)}"><small>${section.bars} bars · Energy ${section.energy}%</small></label><div><button type="button" data-mg-move="${escapeText(section.id)}" data-direction="-1" aria-label="Đưa sang trái">←</button><button type="button" data-mg-move="${escapeText(section.id)}" data-direction="1" aria-label="Đưa sang phải">→</button><button type="button" data-mg-remove-section="${escapeText(section.id)}" aria-label="Xóa section">×</button></div></article>`).join("")}</div><footer><button type="button" data-mg-action="add-section">+ Section</button><button type="button" data-mg-route="arrange">Mở DAW Timeline</button><button type="button" data-mg-route="record">Thu microphone</button></footer></section>
      <section class="mg-stem-strip">${["Vocal", "Drums", "Bass", "Harmony", "FX"].map((name, index) => `<article><i style="--level:${35 + ((index * 19) % 55)}%"></i><strong>${name}</strong><span><button type="button">S</button><button type="button">M</button></span><small>${index ? "-3.0" : "0.0"} dB</small></article>`).join("")}</section>
      ${toolsMarkup(planet.views)}</div>`;
  }

  function mixHub() {
    const planet = PLANETS[3];
    const warnings = mixWarnings();
    return `<div class="mg-hub">${hubHeader(planet, "Mix & Master", "Chẩn đoán minh bạch và target riêng cho từng nền tảng.")}
      <div class="mg-two-panel">
        <section class="mg-panel"><header><small>AI MIX DOCTOR</small><h2>Tình trạng bản mix</h2></header><div class="mg-doctor-score"><strong>${Math.max(0, 100 - warnings.length * 18)}</strong><span>Mix health</span></div><div class="mg-warning-list">${warnings.length ? warnings.map((item) => `<article><i>!</i><span><strong>${escapeText(item.title)}</strong><small>${escapeText(item.copy)}</small></span><button type="button" data-mg-route="mix-doctor">Kiểm tra</button></article>`).join("") : `<article class="is-good"><i>✓</i><span><strong>Không có cảnh báo cấu hình</strong><small>Mở Mix Doctor để phân tích audio thật.</small></span></article>`}</div><footer><button type="button" data-mg-route="mix">Mở Mixer</button><button type="button" data-mg-route="mix-doctor">Phân tích audio</button></footer></section>
        <section class="mg-panel"><header><small>MASTER TARGETS</small><h2>Chuẩn đầu ra</h2></header><div class="mg-targets">${masterTargets().map((item) => `<button type="button" class="${state.mixTarget === item.id ? "is-selected" : ""}" data-mg-target="${item.id}"><i>${item.icon}</i><span><strong>${item.label}</strong><small>${item.lufs} LUFS · ${item.peak} dBTP</small></span></button>`).join("")}</div><div class="mg-form-grid">${field("Target LUFS", "loudness", state.loudness, 'type="number" min="-24" max="-5" step=".1"')}${field("True Peak dBTP", "truePeak", state.truePeak, 'type="number" min="-6" max="0" step=".1"')}</div><footer><button type="button" data-mg-route="master">Mở Master Room</button><button type="button" data-mg-action="snapshot">Lưu bản master</button></footer></section>
      </div>${toolsMarkup(planet.views)}</div>`;
  }

  function visualHub() {
    const planet = PLANETS[4];
    return `<div class="mg-hub">${hubHeader(planet, "Visual Universe", "Cover, lyric video và particle visualizer dùng thẳng palette của dự án Sáng tạo.")}
      <div class="mg-two-panel">
        <section class="mg-panel"><header><small>VISUAL DNA</small><h2>Màu sắc xuyên suốt</h2></header><div class="mg-form-grid">${field("Bảng màu", "palette", state.palette)}${field("Bối cảnh", "scene", state.scene)}${field("Tỷ lệ", "aspectRatio", state.aspectRatio)}${field("Chế độ", "visualMode", state.visualMode)}${textarea("Prompt cover", "promptImage", state.promptImage, 5)}${textarea("Prompt chuyển động", "promptMotion", state.promptMotion, 5)}</div><footer><button type="button" data-mg-action="visual-prompts">Tạo prompt từ Music DNA</button><button type="button" data-mg-route="image-music">Image-to-Music</button></footer></section>
        <section class="mg-visual-preview" style="--visual-a:${paletteColor(0)};--visual-b:${paletteColor(1)};--visual-c:${paletteColor(2)}"><div class="mg-preview-star"><span>HH</span></div>${waveMarkup(44)}<strong>${escapeText(state.project)}</strong><small>${escapeText(state.visualMode)} · ${escapeText(state.aspectRatio)}</small></section>
      </div>${toolsMarkup(planet.views)}</div>`;
  }

  function releaseHub() {
    const planet = PLANETS[5];
    const checklist = [
      ["rightsVerified", "Nguồn asset và giấy phép đã xác minh", state.rightsVerified],
      ["consentReady", "Consent giọng hát/giọng nói đã lưu", state.consentReady],
      ["metadataReady", "Title, mô tả, tag và thumbnail đã sẵn sàng", state.metadataReady]
    ];
    return `<div class="mg-hub">${hubHeader(planet, "Xuất bản & Bản quyền", "Metadata, split, provenance, checklist và lịch phát hành trong một control room.")}
      <div class="mg-two-panel">
        <section class="mg-panel"><header><small>RELEASE CONTROL</small><h2>Gói phát hành</h2></header><div class="mg-form-grid">${field("Tên bản phát hành", "releaseTitle", state.releaseTitle || state.project)}${field("Nền tảng chính", "platform", state.platform)}${field("Tỷ lệ visual", "aspectRatio", state.aspectRatio)}</div><div class="mg-platforms">${["YouTube", "Spotify", "TikTok", "Podcast"].map((name) => `<label><input type="checkbox" data-mg-platform="${name}" ${state.releasePlatforms.includes(name) ? "checked" : ""}><span>${name}</span></label>`).join("")}</div><footer><button type="button" data-mg-route="publish">Mở Publishing</button><button type="button" data-mg-route="release-manager">Metadata & Split</button></footer></section>
        <section class="mg-panel"><header><small>PREFLIGHT</small><h2>Quyền & provenance</h2></header><div class="mg-release-checks">${checklist.map(([key, label, checked]) => `<label><input type="checkbox" data-mg-field="${key}" ${checked ? "checked" : ""}><i></i><span>${escapeText(label)}</span></label>`).join("")}</div><div class="mg-release-score"><strong>${checklist.filter((item) => item[2]).length}/3</strong><span>cổng phát hành hoàn tất</span></div><footer><button type="button" data-mg-route="rights">Mở Rights Center</button><button type="button" data-mg-action="snapshot">Tạo phiên bản duyệt</button></footer></section>
      </div>${toolsMarkup(planet.views)}</div>`;
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
      seed: stableSeed(`${state.project}-${state.chords}-${index}`)
    }));
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
      { id: "podcast", label: "Podcast", icon: "PO", lufs: -16, peak: -1.5 }
    ];
  }

  function mixWarnings() {
    const warnings = [];
    if (Number(state.loudness) > -9) warnings.push({ title: "Loudness quá cao", copy: "Có nguy cơ bị nền tảng giảm âm lượng và mất dynamics." });
    if (Number(state.truePeak) > -1) warnings.push({ title: "True Peak sát 0 dBTP", copy: "Hạ limiter ceiling để tránh clipping sau mã hóa." });
    if (Number(state.energy) > 84) warnings.push({ title: "Energy liên tục cao", copy: "Nên tạo tương phản động giữa verse và chorus." });
    if (!state.instruments) warnings.push({ title: "Thiếu danh sách nhạc cụ", copy: "Mix Doctor cần biết vai trò từng nguồn âm." });
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
    shell.classList.toggle("is-playing", Boolean(state.playing));
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
    clockTimer = globalScope.setInterval(() => {
      if (state.playing && activeHost?.querySelector(".mg-shell")?.dataset.motion !== "static") {
        activeHost.querySelector(".mg-shell")?.style.setProperty("--galaxy-time", String(Date.now() % 100000));
      }
    }, 1000);
  }

  function stopClock() {
    if (clockTimer) globalScope.clearInterval(clockTimer);
    clockTimer = 0;
  }

  function teardownEngine() {
    if (activeEngine?.unmount) {
      try { activeEngine.unmount(); } catch {}
    }
    activeEngine = null;
  }

  function routeTo(view) {
    if (!ROUTABLE.has(view)) return;
    if (typeof activeOptions.onNavigate === "function") {
      activeOptions.onNavigate(view);
      return;
    }
    if (activeHost && supports(view)) mount(activeHost, { ...activeOptions, view });
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
    const next = [...state.arrangement];
    [next[index], next[target]] = [next[target], next[index]];
    state.arrangement = next;
    scheduleSync();
    renderView(activeView);
  }

  function handleClick(event) {
    const route = event.target.closest("[data-mg-route]")?.dataset.mgRoute;
    if (route) return routeTo(route);
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
      state.ab = state.ab === "A" ? "B" : "A";
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
    if (action === "add-section") {
      state.arrangement = [...state.arrangement, { id: `section-${Date.now()}`, label: "Section mới", bars: 8, energy: 50 }].slice(0, 24);
      scheduleSync();
      renderView(activeView);
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
  }

  function handleInput(event) {
    const fieldNode = event.target.closest("[data-mg-field]");
    if (fieldNode) {
      const key = fieldNode.dataset.mgField;
      const value = fieldNode.type === "checkbox" ? fieldNode.checked : fieldNode.type === "number" || fieldNode.type === "range" ? Number(fieldNode.value) : fieldNode.value;
      setField(key, value);
      return;
    }
    const label = event.target.closest("[data-section-label]")?.dataset.sectionLabel;
    if (label) {
      state.arrangement = state.arrangement.map((item) => item.id === label ? { ...item, label: event.target.value } : item);
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
    if (event.target.matches("[data-mg-platform]")) {
      const name = event.target.dataset.mgPlatform;
      state.releasePlatforms = event.target.checked ? [...new Set([...state.releasePlatforms, name])] : state.releasePlatforms.filter((item) => item !== name);
      scheduleSync();
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
    if (event.key === "Escape" && activeView !== "studio") routeTo("studio");
  }

  function handleDragStart(event) {
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
