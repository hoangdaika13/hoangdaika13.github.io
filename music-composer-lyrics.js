(function (globalScope) {
  "use strict";

  const VERSION = 1;
  const STORAGE_KEY = "hh.music.composer-lyrics.v1";
  const VIEWS = Object.freeze(["composer", "lyrics"]);
  const SECTION_TYPES = Object.freeze(["Intro", "Verse", "Chorus", "Bridge", "Outro"]);
  const MAX_SNAPSHOTS = 20;
  const MAX_SECTIONS = 16;
  const AUDIO_FORMAT = "mp3_48000_192";
  const GENRES = Object.freeze(["Pop", "Lo-fi", "Cinematic", "EDM", "Rock", "R&B", "Hip-hop", "Jazz", "Acoustic", "Ambient"]);
  const MOODS = Object.freeze(["Ấm áp", "Hy vọng", "Sâu lắng", "Hùng tráng", "Mơ màng", "Năng lượng", "Bí ẩn", "Lãng mạn"]);
  const INSTRUMENTS = Object.freeze(["Piano", "Guitar", "Strings", "Synth", "Bass", "Drums", "Percussion", "Flute", "Brass", "Ambient texture"]);
  const KEYS = Object.freeze(["C major", "G major", "D major", "A major", "E major", "F major", "A minor", "E minor", "D minor", "B minor"]);
  const SIGNATURES = Object.freeze(["4/4", "3/4", "6/8", "7/8"]);
  const RHYME_SCHEMES = Object.freeze(["AABB", "ABAB", "ABCB", "AAAA", "Tự do"]);

  const DEFAULT_SECTION_DURATIONS = Object.freeze({ Intro: 12, Verse: 30, Chorus: 28, Bridge: 22, Outro: 12 });
  const DEFAULT_STATE = Object.freeze({
    version: VERSION,
    composer: {
      title: "HH New Song",
      genre: "Pop",
      bpm: 92,
      key: "C major",
      timeSignature: "4/4",
      vocal: "Nữ trung, rõ lời",
      instruments: ["Piano", "Strings", "Bass", "Drums"],
      mood: "Hy vọng",
      duration: 104,
      positiveStyle: "Giai điệu nguyên bản, hook rõ, hòa âm giàu cảm xúc, chuyển đoạn tự nhiên",
      negativeStyle: "Không mô phỏng nghệ sĩ cụ thể, không méo tiếng, không mở đầu quá dài",
      seed: 130803,
      instrumental: false,
      activeVariation: "A",
      variationNonce: { A: 0, B: 1 },
      provider: { status: "local", configured: false, canRun: false, name: "HH Local Plan", model: "deterministic-v1", message: "Composition plan chạy cục bộ." },
      estimatedCost: 0,
      preview: { status: "idle", url: "", message: "Chưa yêu cầu bản nghe thử." },
      sections: [
        { id: "intro-1", type: "Intro", label: "Mở đầu", duration: 12, lyrics: "", direction: "Piano mở nhẹ, tạo không gian", locked: false, generation: 0 },
        { id: "verse-1", type: "Verse", label: "Verse 1", duration: 30, lyrics: "Một ngày mới đi qua ô cửa\nMang theo hy vọng thật gần", direction: "Giọng kể gần gũi, nhạc cụ tiết chế", locked: false, generation: 0 },
        { id: "chorus-1", type: "Chorus", label: "Điệp khúc", duration: 28, lyrics: "Ta đi cùng ánh sáng trong tim\nGiữ giấc mơ không bao giờ lặng im", direction: "Hook sáng, mở rộng stereo và bè cuối câu", locked: false, generation: 0 },
        { id: "bridge-1", type: "Bridge", label: "Chuyển đoạn", duration: 22, lyrics: "Nếu đôi chân từng mỏi mệt\nTa vẫn nghe ngày mai gọi tên", direction: "Giảm nhạc rồi nâng dần cao trào", locked: false, generation: 0 },
        { id: "outro-1", type: "Outro", label: "Kết", duration: 12, lyrics: "Ngày mai vẫn đang chờ", direction: "Trở lại motif đầu, kết sạch để dễ nối", locked: false, generation: 0 }
      ]
    },
    lyrics: {
      topic: "Bắt đầu lại và tin vào chính mình",
      language: "vi",
      audience: "Người nghe trẻ yêu nhạc tích cực",
      rhymeScheme: "ABAB",
      syllableTarget: 8,
      title: "Ánh Sáng Trong Tim",
      sections: [],
      snapshots: [],
      compareSnapshotId: "",
      updatedAt: ""
    },
    updatedAt: ""
  });

  let active = null;

  const clamp = (value, min, max) => Math.min(max, Math.max(min, Number(value) || min));
  const clone = (value) => JSON.parse(JSON.stringify(value));
  const cleanText = (value, max = 1000) => String(value == null ? "" : value).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").trim().slice(0, max);
  const escapeHtml = (value) => String(value == null ? "" : value).replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
  const safeId = (value, fallback = "item") => cleanText(value, 80).toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "") || fallback;
  const unique = (items, limit = 20) => [...new Set((Array.isArray(items) ? items : []).map((item) => cleanText(item, 80)).filter(Boolean))].slice(0, limit);

  function hashSeed(input) {
    let hash = 2166136261;
    const text = String(input || "");
    for (let index = 0; index < text.length; index += 1) {
      hash ^= text.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  }

  function seededPick(items, seed, salt = "") {
    const index = hashSeed(`${seed}:${salt}`) % items.length;
    return items[index];
  }

  function normalizeSection(section, index = 0) {
    const type = SECTION_TYPES.includes(section?.type) ? section.type : SECTION_TYPES[Math.min(index, SECTION_TYPES.length - 1)];
    return {
      id: safeId(section?.id, `${type.toLowerCase()}-${index + 1}`),
      type,
      label: cleanText(section?.label || type, 80),
      duration: clamp(section?.duration || DEFAULT_SECTION_DURATIONS[type], 2, 180),
      lyrics: cleanText(section?.lyrics, 6000),
      direction: cleanText(section?.direction, 800),
      locked: Boolean(section?.locked),
      generation: clamp(section?.generation || 0, 0, 9999)
    };
  }

  function normalizeComposer(input = {}) {
    const fallback = DEFAULT_STATE.composer;
    const sections = (Array.isArray(input.sections) ? input.sections : fallback.sections)
      .slice(0, MAX_SECTIONS)
      .map(normalizeSection);
    const selectedInstruments = unique(input.instruments || fallback.instruments, 12).filter((item) => INSTRUMENTS.includes(item));
    return {
      title: cleanText(input.title || fallback.title, 120),
      genre: GENRES.includes(input.genre) ? input.genre : fallback.genre,
      bpm: clamp(input.bpm || fallback.bpm, 30, 240),
      key: KEYS.includes(input.key) ? input.key : fallback.key,
      timeSignature: SIGNATURES.includes(input.timeSignature) ? input.timeSignature : fallback.timeSignature,
      vocal: cleanText(input.vocal || fallback.vocal, 140),
      instruments: selectedInstruments.length ? selectedInstruments : [...fallback.instruments],
      mood: MOODS.includes(input.mood) ? input.mood : fallback.mood,
      duration: clamp(input.duration || sections.reduce((sum, section) => sum + section.duration, 0), 10, 900),
      positiveStyle: cleanText(input.positiveStyle || fallback.positiveStyle, 1000),
      negativeStyle: cleanText(input.negativeStyle || fallback.negativeStyle, 1000),
      seed: Math.floor(clamp(input.seed || fallback.seed, 1, 2147483646)),
      instrumental: Boolean(input.instrumental),
      activeVariation: input.activeVariation === "B" ? "B" : "A",
      variationNonce: {
        A: clamp(input.variationNonce?.A || 0, 0, 9999),
        B: clamp(input.variationNonce?.B || 1, 0, 9999)
      },
      provider: {
        status: ["local", "checking", "ready", "blocked", "error"].includes(input.provider?.status) ? input.provider.status : "local",
        configured: Boolean(input.provider?.configured),
        canRun: Boolean(input.provider?.canRun),
        name: cleanText(input.provider?.name || "HH Local Plan", 80),
        model: cleanText(input.provider?.model || "deterministic-v1", 100),
        message: cleanText(input.provider?.message || "Composition plan chạy cục bộ.", 240)
      },
      estimatedCost: Math.max(0, Number(input.estimatedCost) || 0),
      preview: {
        status: ["idle", "requesting", "ready", "error"].includes(input.preview?.status) ? input.preview.status : "idle",
        url: "",
        message: cleanText(input.preview?.message || "Chưa yêu cầu bản nghe thử.", 240)
      },
      sections: sections.length ? sections : fallback.sections.map(normalizeSection)
    };
  }

  function composerSectionsAsLyrics(composer) {
    return composer.sections.map((section) => ({
      id: section.id,
      type: section.type,
      label: section.label,
      text: section.lyrics,
      pronunciation: "",
      performance: section.direction,
      harmony: section.type === "Chorus" ? "Bè quãng 3 ở câu cuối" : "",
      locked: section.locked
    }));
  }

  function normalizeLyricsSection(section, index = 0) {
    const fallbackType = SECTION_TYPES[Math.min(index, SECTION_TYPES.length - 1)];
    return {
      id: safeId(section?.id, `lyrics-${index + 1}`),
      type: SECTION_TYPES.includes(section?.type) ? section.type : fallbackType,
      label: cleanText(section?.label || section?.type || fallbackType, 80),
      text: cleanText(section?.text, 10000),
      pronunciation: cleanText(section?.pronunciation, 3000),
      performance: cleanText(section?.performance, 2000),
      harmony: cleanText(section?.harmony, 2000),
      locked: Boolean(section?.locked)
    };
  }

  function normalizeSnapshot(snapshot, index = 0) {
    return {
      id: safeId(snapshot?.id, `snapshot-${index + 1}`),
      label: cleanText(snapshot?.label || `Phiên bản ${index + 1}`, 100),
      createdAt: cleanText(snapshot?.createdAt || new Date(0).toISOString(), 40),
      title: cleanText(snapshot?.title, 120),
      sections: (Array.isArray(snapshot?.sections) ? snapshot.sections : []).slice(0, MAX_SECTIONS).map(normalizeLyricsSection)
    };
  }

  function normalizeLyrics(input = {}, composer) {
    const fallback = DEFAULT_STATE.lyrics;
    const sourceSections = Array.isArray(input.sections) && input.sections.length ? input.sections : composerSectionsAsLyrics(composer);
    return {
      topic: cleanText(input.topic || fallback.topic, 400),
      language: input.language === "en" ? "en" : "vi",
      audience: cleanText(input.audience || fallback.audience, 240),
      rhymeScheme: RHYME_SCHEMES.includes(input.rhymeScheme) ? input.rhymeScheme : fallback.rhymeScheme,
      syllableTarget: clamp(input.syllableTarget || fallback.syllableTarget, 3, 24),
      title: cleanText(input.title || fallback.title, 120),
      sections: sourceSections.slice(0, MAX_SECTIONS).map(normalizeLyricsSection),
      snapshots: (Array.isArray(input.snapshots) ? input.snapshots : []).slice(-MAX_SNAPSHOTS).map(normalizeSnapshot),
      compareSnapshotId: safeId(input.compareSnapshotId, ""),
      updatedAt: cleanText(input.updatedAt, 40)
    };
  }

  function normalizeState(input = {}) {
    const composer = normalizeComposer(input.composer || {});
    return {
      version: VERSION,
      composer,
      lyrics: normalizeLyrics(input.lyrics || {}, composer),
      updatedAt: cleanText(input.updatedAt, 40)
    };
  }

  function loadState(storage) {
    if (!storage?.getItem) return normalizeState(clone(DEFAULT_STATE));
    try {
      const value = JSON.parse(storage.getItem(STORAGE_KEY) || "null");
      if (!value || Number(value.version) !== VERSION) return normalizeState(clone(DEFAULT_STATE));
      return normalizeState(value);
    } catch (_) {
      return normalizeState(clone(DEFAULT_STATE));
    }
  }

  function saveState(state, storage) {
    const normalized = normalizeState({ ...state, updatedAt: new Date().toISOString() });
    if (storage?.setItem) {
      try { storage.setItem(STORAGE_KEY, JSON.stringify(normalized)); } catch (_) {}
    }
    return normalized;
  }

  function rebalanceDurations(sections, targetDuration) {
    const total = sections.reduce((sum, section) => sum + section.duration, 0) || 1;
    let consumed = 0;
    return sections.map((section, index) => {
      const duration = index === sections.length - 1
        ? Math.max(2, targetDuration - consumed)
        : Math.max(2, Math.round((section.duration / total) * targetDuration));
      consumed += duration;
      return { ...section, duration };
    });
  }

  function sectionPrompt(section, composer, variation) {
    const nonce = composer.variationNonce[variation];
    const texture = seededPick([
      "mở rộng hòa âm ở nửa sau",
      "giữ nhịp thở tự nhiên và khoảng trống rõ",
      "tạo một motif ngắn có thể nhận diện",
      "đẩy động lực bằng lớp nhạc cụ mới",
      "giảm mật độ trước điểm chuyển cảnh"
    ], composer.seed + section.generation + nonce, section.id);
    return `${section.type} ${section.duration}s: ${section.direction || texture}. ${texture}.`;
  }

  function buildCompositionPlan(input = {}, variation) {
    const composer = normalizeComposer(input.composer || input);
    const selectedVariation = variation === "B" ? "B" : composer.activeVariation;
    const sections = rebalanceDurations(composer.sections, composer.duration).map((section, index) => ({
      order: index + 1,
      id: section.id,
      type: section.type,
      label: section.label,
      durationSeconds: section.duration,
      startSeconds: 0,
      endSeconds: 0,
      locked: section.locked,
      lyrics: composer.instrumental ? "" : section.lyrics,
      direction: sectionPrompt(section, composer, selectedVariation)
    }));
    let cursor = 0;
    sections.forEach((section) => {
      section.startSeconds = cursor;
      cursor += section.durationSeconds;
      section.endSeconds = cursor;
    });
    const prompt = [
      `Original ${composer.genre} composition, ${composer.mood.toLowerCase()} mood, ${composer.bpm} BPM, key ${composer.key}, ${composer.timeSignature}.`,
      `Instrumentation: ${composer.instruments.join(", ")}.`,
      composer.instrumental ? "Instrumental only, no vocal or spoken word." : `Vocal: ${composer.vocal}. Sing only the supplied original lyrics.`,
      `Positive direction: ${composer.positiveStyle}.`,
      `Avoid: ${composer.negativeStyle}. Do not imitate a named artist or copyrighted song.`,
      `Variation ${selectedVariation}, deterministic seed ${composer.seed + composer.variationNonce[selectedVariation]}.`,
      ...sections.map((section) => `${section.order}. ${section.direction}${section.lyrics ? ` Lyrics: ${section.lyrics.replace(/\n/g, " / ")}` : ""}`)
    ].join("\n");
    return {
      format: "hh-composition-plan",
      version: VERSION,
      title: composer.title,
      variation: selectedVariation,
      seed: composer.seed + composer.variationNonce[selectedVariation],
      durationSeconds: cursor,
      instrumental: composer.instrumental,
      sections,
      prompt,
      providerRequest: {
        actionType: "music-track",
        input: prompt,
        meta: { durationSeconds: Math.min(120, cursor), instrumental: composer.instrumental, outputFormat: AUDIO_FORMAT, compositionPlan: sections }
      }
    };
  }

  function regenerateSection(composerInput, sectionId, variation) {
    const composer = normalizeComposer(composerInput);
    const index = composer.sections.findIndex((section) => section.id === sectionId);
    if (index < 0 || composer.sections[index].locked) return composer;
    const section = composer.sections[index];
    const generation = section.generation + 1;
    const direction = seededPick([
      "Bắt đầu tối giản rồi thêm lớp hòa âm ở nửa sau",
      "Đổi tiết tấu nhẹ, giữ motif chính và tạo khoảng nghỉ rõ",
      "Thêm đối âm ngắn, không che giọng hát",
      "Hạ năng lượng đầu đoạn rồi mở rộng ở hai ô nhịp cuối",
      "Giữ nhịp chắc, thay màu nhạc cụ và kết bằng pickup"
    ], composer.seed + generation + composer.variationNonce[variation === "B" ? "B" : "A"], section.id);
    composer.sections[index] = { ...section, generation, direction };
    return composer;
  }

  function toggleSectionLock(composerInput, sectionId, locked) {
    const composer = normalizeComposer(composerInput);
    composer.sections = composer.sections.map((section) => section.id === sectionId ? { ...section, locked: typeof locked === "boolean" ? locked : !section.locked } : section);
    return composer;
  }

  function estimateProviderCost(composerInput) {
    const composer = normalizeComposer(composerInput);
    return Number((Math.min(120, composer.duration) * 0.002).toFixed(3));
  }

  function countSyllables(line, language = "vi") {
    const words = cleanText(line, 2000).toLocaleLowerCase(language === "vi" ? "vi" : "en").match(/[\p{L}]+(?:['’-][\p{L}]+)*/gu) || [];
    if (language === "vi") return { count: words.length, method: "heuristic-word-units" };
    let count = 0;
    words.forEach((word) => {
      const simple = word.replace(/[^a-z]/g, "");
      if (!simple) return;
      if (simple.length <= 3) { count += 1; return; }
      let units = (simple.match(/[aeiouy]+/g) || []).length;
      if (/e$/.test(simple) && !/(le|ye)$/.test(simple) && units > 1) units -= 1;
      if (/(tion|sion)$/.test(simple) && units > 1) units -= 1;
      count += Math.max(1, units);
    });
    return { count, method: "heuristic-vowel-groups" };
  }

  function rhymeEnding(line, language) {
    const words = cleanText(line, 1000).toLocaleLowerCase(language === "vi" ? "vi" : "en").match(/[\p{L}]+/gu) || [];
    const word = words.at(-1) || "";
    if (!word) return "";
    if (language === "vi") return word.slice(-2);
    const vowel = Math.max(word.lastIndexOf("a"), word.lastIndexOf("e"), word.lastIndexOf("i"), word.lastIndexOf("o"), word.lastIndexOf("u"), word.lastIndexOf("y"));
    return word.slice(Math.max(0, vowel));
  }

  function analyzeLyrics(lyricsInput = {}) {
    const lyrics = normalizeLyrics(lyricsInput, normalizeComposer({}));
    const target = lyrics.syllableTarget;
    const scheme = lyrics.rhymeScheme === "Tự do" ? "" : lyrics.rhymeScheme;
    const lines = [];
    const warnings = [];
    lyrics.sections.forEach((section) => {
      const sectionLines = section.text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
      const analyzed = sectionLines.map((line, index) => {
        const syllables = countSyllables(line, lyrics.language);
        const rhyme = rhymeEnding(line, lyrics.language);
        const expected = scheme ? scheme[index % scheme.length] : "";
        if (Math.abs(syllables.count - target) > 2) warnings.push({ type: "length", sectionId: section.id, line: index + 1, message: `Dòng ${index + 1} của ${section.label} có ${syllables.count} âm tiết ước tính, mục tiêu ${target}.` });
        return { line, lineNumber: index + 1, syllables: syllables.count, method: syllables.method, rhyme, expected };
      });
      if (scheme) {
        const groups = new Map();
        analyzed.forEach((item) => {
          if (!item.expected || !item.rhyme) return;
          if (!groups.has(item.expected)) groups.set(item.expected, []);
          groups.get(item.expected).push(item);
        });
        groups.forEach((items, letter) => {
          const endings = new Set(items.map((item) => item.rhyme));
          if (items.length > 1 && endings.size > 1) warnings.push({ type: "rhyme", sectionId: section.id, line: items[0].lineNumber, message: `Nhóm vần ${letter} trong ${section.label} chưa đồng nhất (${[...endings].join(", ")}).` });
        });
      }
      lines.push({ sectionId: section.id, label: section.label, lines: analyzed });
    });
    return { lines, warnings, disclaimer: lyrics.language === "vi" ? "Đếm âm tiết tiếng Việt dựa trên đơn vị từ cách nhau bằng khoảng trắng." : "Đếm âm tiết tiếng Anh dùng nhóm nguyên âm và chỉ là ước tính." };
  }

  function createSnapshot(lyricsInput, label, now = new Date()) {
    const lyrics = normalizeLyrics(lyricsInput, normalizeComposer({}));
    const snapshot = normalizeSnapshot({
      id: `snapshot-${now.getTime()}`,
      label: cleanText(label || `Phiên bản ${lyrics.snapshots.length + 1}`, 100),
      createdAt: now.toISOString(),
      title: lyrics.title,
      sections: lyrics.sections
    });
    return { ...lyrics, snapshots: [...lyrics.snapshots, snapshot].slice(-MAX_SNAPSHOTS), compareSnapshotId: snapshot.id };
  }

  function compareLyrics(lyricsInput, snapshotId) {
    const lyrics = normalizeLyrics(lyricsInput, normalizeComposer({}));
    const snapshot = lyrics.snapshots.find((item) => item.id === snapshotId);
    if (!snapshot) return { found: false, changedSections: [], before: "", after: lyrics.sections.map((item) => item.text).join("\n\n") };
    const changedSections = lyrics.sections.filter((section) => {
      const before = snapshot.sections.find((item) => item.id === section.id);
      return !before || before.text !== section.text || before.pronunciation !== section.pronunciation || before.performance !== section.performance || before.harmony !== section.harmony;
    }).map((section) => section.id);
    return {
      found: true,
      changedSections,
      before: snapshot.sections.map((item) => `[${item.label}]\n${item.text}`).join("\n\n"),
      after: lyrics.sections.map((item) => `[${item.label}]\n${item.text}`).join("\n\n")
    };
  }

  function exportProject(stateInput) {
    return JSON.stringify({ format: "hh-music-composer-lyrics", version: VERSION, exportedAt: new Date().toISOString(), data: normalizeState(stateInput) }, null, 2);
  }

  function importProject(raw) {
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (!parsed || parsed.format !== "hh-music-composer-lyrics" || Number(parsed.version) !== VERSION) throw new Error("Project không đúng định dạng hoặc phiên bản.");
    return normalizeState(parsed.data);
  }

  function supports(id) {
    return VIEWS.includes(String(id || "").toLowerCase());
  }

  function authHeaders(json = true) {
    let token = "";
    try { token = globalScope.localStorage?.getItem("hh-auth-token") || ""; } catch (_) {}
    return { ...(json ? { "Content-Type": "application/json" } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) };
  }

  function apiBase(options = {}) {
    const origin = options.apiBase || globalScope.HH_REALTIME_URL || globalScope.location?.origin || "";
    return String(origin).replace(/\/$/, "");
  }

  async function checkProvider(options = {}) {
    if (typeof globalScope.fetch !== "function") throw new Error("Trình duyệt không hỗ trợ fetch.");
    const response = await globalScope.fetch(`${apiBase(options)}/api/modules/music-ai/actions`, { headers: authHeaders(false), cache: "no-store" });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(cleanText(data.error || `Music AI HTTP ${response.status}`, 240));
    const provider = data.providers?.music || {};
    return {
      status: provider.configured && data.canRunMedia ? "ready" : "blocked",
      configured: Boolean(provider.configured),
      canRun: Boolean(data.canRunMedia),
      name: cleanText(provider.provider || "Eleven Music", 80),
      model: cleanText(provider.model || "music_v2", 100),
      message: provider.configured ? (data.canRunMedia ? "Máy chủ sẵn sàng tạo bản nghe thử." : "Đã cấu hình nhưng tài khoản hiện tại chưa có quyền chạy media trả phí.") : "Chưa cấu hình Eleven Music trên máy chủ."
    };
  }

  async function requestProviderPreview(stateInput, options = {}) {
    const state = normalizeState(stateInput);
    const plan = buildCompositionPlan(state.composer);
    const response = await globalScope.fetch(`${apiBase(options)}/api/modules/music-ai/actions`, {
      method: "POST",
      headers: authHeaders(true),
      body: JSON.stringify(plan.providerRequest),
      cache: "no-store"
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(cleanText(data.error || `Eleven Music HTTP ${response.status}`, 240));
    if (!data.media?.data || !/^audio\//.test(data.media.mimeType || "")) throw new Error("Máy chủ không trả về audio hợp lệ.");
    return { data: data.media.data, mimeType: data.media.mimeType, model: cleanText(data.media.model || state.composer.provider.model, 100), durationSeconds: Number(data.media.durationSeconds) || plan.providerRequest.meta.durationSeconds, songId: cleanText(data.media.songId, 240) };
  }

  function fieldOptions(items, selected) {
    return items.map((item) => `<option value="${escapeHtml(item)}"${item === selected ? " selected" : ""}>${escapeHtml(item)}</option>`).join("");
  }

  function timecode(seconds) {
    const value = Math.max(0, Math.round(seconds));
    return `${String(Math.floor(value / 60)).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}`;
  }

  function renderShell(instance, content, eyebrow, title, subtitle) {
    const current = instance.view;
    instance.host.innerHTML = `<section class="mcl-shell" data-mcl-view="${current}">
      <header class="mcl-topbar">
        <div class="mcl-brand"><span aria-hidden="true">HH</span><div><small>${escapeHtml(eyebrow)}</small><h2>${escapeHtml(title)}</h2><p>${escapeHtml(subtitle)}</p></div></div>
        <nav class="mcl-view-tabs" aria-label="Music AI workspace">
          <button type="button" data-mcl-switch="composer" class="${current === "composer" ? "is-active" : ""}" aria-current="${current === "composer" ? "page" : "false"}">Sáng tác</button>
          <button type="button" data-mcl-switch="lyrics" class="${current === "lyrics" ? "is-active" : ""}" aria-current="${current === "lyrics" ? "page" : "false"}">Lời bài hát</button>
        </nav>
        <div class="mcl-save-state"><i></i><span>Local autosave</span></div>
      </header>
      ${content}
      <div class="mcl-toast" data-mcl-toast role="status" aria-live="polite"></div>
    </section>`;
  }

  function renderComposer(instance) {
    const state = instance.state;
    const composer = state.composer;
    const plan = buildCompositionPlan(composer);
    const provider = composer.provider;
    const selected = new Set(composer.instruments);
    const sectionMarkup = plan.sections.map((planned, index) => {
      const section = composer.sections.find((item) => item.id === planned.id);
      return `<article class="mcl-section ${section.locked ? "is-locked" : ""}" data-section-id="${escapeHtml(section.id)}">
        <div class="mcl-section__order"><b>${String(index + 1).padStart(2, "0")}</b><span>${timecode(planned.startSeconds)}</span></div>
        <div class="mcl-section__body">
          <div class="mcl-section__heading"><label><span>Loại đoạn</span><select data-mcl-section-field="type" ${section.locked ? "disabled" : ""}>${fieldOptions(SECTION_TYPES, section.type)}</select></label><label class="is-grow"><span>Tên đoạn</span><input data-mcl-section-field="label" value="${escapeHtml(section.label)}" maxlength="80" ${section.locked ? "disabled" : ""}></label><label><span>Thời lượng</span><input type="number" min="2" max="180" data-mcl-section-field="duration" value="${section.duration}" ${section.locked ? "disabled" : ""}></label></div>
          <textarea rows="2" data-mcl-section-field="lyrics" placeholder="Lời hát nguyên bản cho đoạn này" ${composer.instrumental ? "disabled" : ""}>${escapeHtml(section.lyrics)}</textarea>
          <input data-mcl-section-field="direction" value="${escapeHtml(section.direction)}" maxlength="800" aria-label="Chỉ dẫn phối khí ${escapeHtml(section.label)}" ${section.locked ? "disabled" : ""}>
        </div>
        <div class="mcl-section__actions">
          <button type="button" data-mcl-action="move-up" title="Đưa lên" aria-label="Đưa ${escapeHtml(section.label)} lên" ${index === 0 ? "disabled" : ""}>↑</button>
          <button type="button" data-mcl-action="move-down" title="Đưa xuống" aria-label="Đưa ${escapeHtml(section.label)} xuống" ${index === plan.sections.length - 1 ? "disabled" : ""}>↓</button>
          <button type="button" data-mcl-action="toggle-lock" class="${section.locked ? "is-active" : ""}" aria-pressed="${section.locked}">${section.locked ? "Đã khóa" : "Khóa"}</button>
          <button type="button" data-mcl-action="regenerate-section" ${section.locked ? "disabled" : ""}>Tạo lại</button>
        </div>
      </article>`;
    }).join("");
    const content = `<main class="mcl-daw">
      <aside class="mcl-panel mcl-control-panel">
        <div class="mcl-panel__title"><div><small>PROJECT SETUP</small><h3>Thông số bài hát</h3></div><button type="button" data-mcl-action="new-seed">Seed mới</button></div>
        <label class="mcl-field"><span>Tên project</span><input data-mcl-field="composer.title" value="${escapeHtml(composer.title)}" maxlength="120"></label>
        <div class="mcl-field-grid"><label class="mcl-field"><span>Thể loại</span><select data-mcl-field="composer.genre">${fieldOptions(GENRES, composer.genre)}</select></label><label class="mcl-field"><span>Cảm xúc</span><select data-mcl-field="composer.mood">${fieldOptions(MOODS, composer.mood)}</select></label></div>
        <div class="mcl-field-grid mcl-field-grid--3"><label class="mcl-field"><span>BPM</span><input type="number" min="30" max="240" data-mcl-field="composer.bpm" value="${composer.bpm}"></label><label class="mcl-field"><span>Giọng</span><select data-mcl-field="composer.key">${fieldOptions(KEYS, composer.key)}</select></label><label class="mcl-field"><span>Nhịp</span><select data-mcl-field="composer.timeSignature">${fieldOptions(SIGNATURES, composer.timeSignature)}</select></label></div>
        <label class="mcl-field"><span>Giọng hát</span><input data-mcl-field="composer.vocal" value="${escapeHtml(composer.vocal)}" maxlength="140" ${composer.instrumental ? "disabled" : ""}></label>
        <fieldset class="mcl-chip-field"><legend>Nhạc cụ</legend>${INSTRUMENTS.map((item) => `<label><input type="checkbox" data-mcl-instrument="${escapeHtml(item)}" ${selected.has(item) ? "checked" : ""}><span>${escapeHtml(item)}</span></label>`).join("")}</fieldset>
        <label class="mcl-field"><span>Positive style</span><textarea rows="3" data-mcl-field="composer.positiveStyle">${escapeHtml(composer.positiveStyle)}</textarea></label>
        <label class="mcl-field"><span>Negative style</span><textarea rows="3" data-mcl-field="composer.negativeStyle">${escapeHtml(composer.negativeStyle)}</textarea></label>
        <div class="mcl-field-grid"><label class="mcl-field"><span>Seed</span><input type="number" min="1" max="2147483646" data-mcl-field="composer.seed" value="${composer.seed}"></label><label class="mcl-field"><span>Thời lượng (giây)</span><input type="number" min="10" max="900" data-mcl-field="composer.duration" value="${composer.duration}"></label></div>
        <label class="mcl-switch"><input type="checkbox" data-mcl-field="composer.instrumental" ${composer.instrumental ? "checked" : ""}><i></i><span><b>Instrumental</b><small>Tắt toàn bộ phần lời trong request.</small></span></label>
      </aside>
      <section class="mcl-center-stage">
        <div class="mcl-timeline-head"><div><small>GENERATIVE TIMELINE</small><h3>Composition plan</h3></div><div class="mcl-variation" role="group" aria-label="So sánh variation"><button type="button" data-mcl-variation="A" class="${composer.activeVariation === "A" ? "is-active" : ""}>A</button><button type="button" data-mcl-variation="B" class="${composer.activeVariation === "B" ? "is-active" : ""}>B</button></div><button type="button" data-mcl-action="add-section">+ Đoạn</button></div>
        <div class="mcl-ruler" aria-hidden="true"><span>00:00</span><span>${timecode(plan.durationSeconds * .25)}</span><span>${timecode(plan.durationSeconds * .5)}</span><span>${timecode(plan.durationSeconds * .75)}</span><span>${timecode(plan.durationSeconds)}</span></div>
        <div class="mcl-section-list">${sectionMarkup}</div>
        <div class="mcl-plan-output"><div><small>PROMPT PREVIEW</small><strong>${plan.sections.length} đoạn · ${timecode(plan.durationSeconds)} · Seed ${plan.seed}</strong></div><textarea readonly rows="7" aria-label="Composition prompt">${escapeHtml(plan.prompt)}</textarea><div class="mcl-inline-actions"><button type="button" data-mcl-action="copy-plan">Sao chép prompt</button><button type="button" data-mcl-action="export-plan">Xuất plan JSON</button><button type="button" data-mcl-action="sync-lyrics">Đồng bộ sang Lyrics</button></div></div>
      </section>
      <aside class="mcl-panel mcl-inspector">
        <div class="mcl-panel__title"><div><small>PROVIDER</small><h3>AI Preview</h3></div><span class="mcl-status is-${provider.status}"><i></i>${escapeHtml(provider.status === "ready" ? "Sẵn sàng" : provider.status === "checking" ? "Đang kiểm tra" : provider.status === "error" ? "Có lỗi" : "Local")}</span></div>
        <div class="mcl-provider-card"><span>${escapeHtml(provider.name)}</span><strong>${escapeHtml(provider.model)}</strong><p>${escapeHtml(provider.message)}</p><button type="button" data-mcl-action="check-provider">Kiểm tra máy chủ</button></div>
        <dl class="mcl-metrics"><div><dt>Ước tính</dt><dd>$${estimateProviderCost(composer).toFixed(3)}</dd></div><div><dt>Giới hạn preview</dt><dd>${Math.min(120, plan.durationSeconds)}s</dd></div><div><dt>C2PA</dt><dd>Server yêu cầu ký</dd></div></dl>
        <div class="mcl-notice"><strong>Chi phí chỉ là ước tính</strong><p>Giá thực tế do nhà cung cấp và tài khoản máy chủ quyết định. HH không lưu API key ở client.</p></div>
        <button class="mcl-primary" type="button" data-mcl-action="request-preview" ${composer.preview.status === "requesting" ? "disabled" : ""}>${composer.preview.status === "requesting" ? "Đang yêu cầu…" : "Yêu cầu bản nghe thử"}</button>
        <p class="mcl-preview-message">${escapeHtml(composer.preview.message)}</p>
        ${instance.audioUrl ? `<audio class="mcl-audio" src="${escapeHtml(instance.audioUrl)}" controls></audio>` : ""}
        <div class="mcl-provider-log"><small>REQUEST CONTRACT</small><code>POST /api/modules/music-ai/actions</code><span>actionType: music-track</span><span>Không có credential trong payload.</span></div>
      </aside>
    </main>`;
    renderShell(instance, content, "AI COMPOSER PRO", "Studio sáng tác có cấu trúc", "Tạo composition plan cục bộ, khóa từng section và chỉ gọi Eleven Music qua backend chính thức.");
  }

  function renderLyrics(instance) {
    const lyrics = instance.state.lyrics;
    const analysis = analyzeLyrics(lyrics);
    const comparison = compareLyrics(lyrics, lyrics.compareSnapshotId);
    const warningsBySection = new Map();
    analysis.warnings.forEach((warning) => {
      if (!warningsBySection.has(warning.sectionId)) warningsBySection.set(warning.sectionId, []);
      warningsBySection.get(warning.sectionId).push(warning);
    });
    const sections = lyrics.sections.map((section, index) => {
      const sectionAnalysis = analysis.lines.find((item) => item.sectionId === section.id);
      const warnings = warningsBySection.get(section.id) || [];
      return `<article class="mcl-lyric-card ${section.locked ? "is-locked" : ""}" data-lyrics-section="${escapeHtml(section.id)}">
        <header><div><small>${String(index + 1).padStart(2, "0")} · ${escapeHtml(section.type)}</small><input data-mcl-lyrics-field="label" value="${escapeHtml(section.label)}" maxlength="80" aria-label="Tên phần lời"></div><button type="button" data-mcl-action="toggle-lyrics-lock" class="${section.locked ? "is-active" : ""}" aria-pressed="${section.locked}">${section.locked ? "Đã khóa" : "Khóa"}</button></header>
        <textarea rows="6" data-mcl-lyrics-field="text" ${section.locked ? "readonly" : ""} aria-label="Lời ${escapeHtml(section.label)}">${escapeHtml(section.text)}</textarea>
        <div class="mcl-line-meter">${(sectionAnalysis?.lines || []).map((line) => `<span class="${Math.abs(line.syllables - lyrics.syllableTarget) > 2 ? "is-warning" : ""}" title="${escapeHtml(line.method)}">D${line.lineNumber}: <b>${line.syllables}</b> âm · vần <b>${escapeHtml(line.rhyme || "-")}</b></span>`).join("") || "<span>Chưa có dòng để phân tích.</span>"}</div>
        ${warnings.length ? `<ul class="mcl-warning-list">${warnings.slice(0, 4).map((warning) => `<li>${escapeHtml(warning.message)}</li>`).join("")}</ul>` : `<p class="mcl-ok">Không có cảnh báo nổi bật.</p>`}
        <details><summary>Phiên âm, biểu diễn và bè</summary><label><span>Phiên âm/cách hát</span><textarea rows="2" data-mcl-lyrics-field="pronunciation">${escapeHtml(section.pronunciation)}</textarea></label><label><span>Chỉ dẫn biểu diễn</span><textarea rows="2" data-mcl-lyrics-field="performance">${escapeHtml(section.performance)}</textarea></label><label><span>Harmony cue</span><input data-mcl-lyrics-field="harmony" value="${escapeHtml(section.harmony)}" maxlength="2000"></label></details>
      </article>`;
    }).join("");
    const content = `<main class="mcl-lyrics-workspace">
      <aside class="mcl-panel mcl-lyrics-brief">
        <div class="mcl-panel__title"><div><small>LYRICS BRIEF</small><h3>Định hướng lời</h3></div></div>
        <label class="mcl-field"><span>Tựa bài</span><input data-mcl-field="lyrics.title" value="${escapeHtml(lyrics.title)}" maxlength="120"></label>
        <label class="mcl-field"><span>Chủ đề</span><textarea rows="3" data-mcl-field="lyrics.topic">${escapeHtml(lyrics.topic)}</textarea></label>
        <label class="mcl-field"><span>Đối tượng nghe</span><textarea rows="2" data-mcl-field="lyrics.audience">${escapeHtml(lyrics.audience)}</textarea></label>
        <div class="mcl-field-grid"><label class="mcl-field"><span>Ngôn ngữ</span><select data-mcl-field="lyrics.language"><option value="vi"${lyrics.language === "vi" ? " selected" : ""}>Tiếng Việt</option><option value="en"${lyrics.language === "en" ? " selected" : ""}>English</option></select></label><label class="mcl-field"><span>Sơ đồ vần</span><select data-mcl-field="lyrics.rhymeScheme">${fieldOptions(RHYME_SCHEMES, lyrics.rhymeScheme)}</select></label></div>
        <label class="mcl-field"><span>Mục tiêu âm tiết mỗi dòng</span><input type="number" min="3" max="24" data-mcl-field="lyrics.syllableTarget" value="${lyrics.syllableTarget}"></label>
        <div class="mcl-notice"><strong>Phân tích heuristic</strong><p>${escapeHtml(analysis.disclaimer)} Kết quả hỗ trợ biên tập, không thay thế nhạc sĩ hoặc chuyên gia ngôn ngữ.</p></div>
        <div class="mcl-stack-actions"><button type="button" data-mcl-action="snapshot">Tạo snapshot</button><button type="button" data-mcl-action="import-project">Nhập project</button><button type="button" data-mcl-action="export-project">Xuất project</button><input type="file" accept="application/json,.json" data-mcl-import hidden></div>
      </aside>
      <section class="mcl-lyrics-editor">
        <div class="mcl-timeline-head"><div><small>LYRIC TIMELINE</small><h3>${escapeHtml(lyrics.title)}</h3></div><span class="mcl-counter">${analysis.lines.reduce((sum, group) => sum + group.lines.length, 0)} dòng · ${analysis.warnings.length} cảnh báo</span></div>
        <div class="mcl-lyrics-list">${sections}</div>
      </section>
      <aside class="mcl-panel mcl-version-panel">
        <div class="mcl-panel__title"><div><small>VERSION HISTORY</small><h3>So sánh phiên bản</h3></div><b>${lyrics.snapshots.length}/${MAX_SNAPSHOTS}</b></div>
        <label class="mcl-field"><span>Snapshot gốc</span><select data-mcl-field="lyrics.compareSnapshotId"><option value="">Chọn phiên bản</option>${lyrics.snapshots.slice().reverse().map((snapshot) => `<option value="${escapeHtml(snapshot.id)}"${snapshot.id === lyrics.compareSnapshotId ? " selected" : ""}>${escapeHtml(snapshot.label)} · ${escapeHtml(snapshot.createdAt.slice(0, 16).replace("T", " "))}</option>`).join("")}</select></label>
        ${comparison.found ? `<div class="mcl-compare-summary"><strong>${comparison.changedSections.length} phần đã thay đổi</strong><span>${comparison.changedSections.map(escapeHtml).join(", ") || "Không thay đổi"}</span></div><div class="mcl-diff"><section><small>TRƯỚC</small><pre>${escapeHtml(comparison.before)}</pre></section><section><small>HIỆN TẠI</small><pre>${escapeHtml(comparison.after)}</pre></section></div>` : `<div class="mcl-empty"><b>Chưa chọn snapshot</b><p>Tạo một mốc trước khi sửa để xem khác biệt trước/sau.</p></div>`}
        <div class="mcl-rights"><strong>Originality checklist</strong><label><input type="checkbox"> Lời do tôi sở hữu hoặc được phép dùng</label><label><input type="checkbox"> Không sao chép bài hát đã phát hành</label><label><input type="checkbox"> Tên người và thương hiệu đã được kiểm tra</label></div>
      </aside>
    </main>`;
    renderShell(instance, content, "LYRICS STUDIO", "Biên tập lời có kiểm soát", "Đếm âm tiết heuristic, cảnh báo vần, khóa phần đã duyệt và so sánh snapshot trước/sau.");
  }

  function render(instance) {
    if (!instance?.host?.isConnected && globalScope.document?.documentElement?.contains(instance?.host) === false) return;
    if (instance.view === "lyrics") renderLyrics(instance); else renderComposer(instance);
  }

  function toast(instance, message, type = "ok") {
    const node = instance.host.querySelector("[data-mcl-toast]");
    if (!node) return;
    node.textContent = cleanText(message, 240);
    node.dataset.type = type;
    node.classList.add("is-visible");
    globalScope.clearTimeout(instance.toastTimer);
    instance.toastTimer = globalScope.setTimeout(() => node.classList.remove("is-visible"), 2800);
  }

  function persist(instance, message) {
    instance.state = saveState(instance.state, instance.storage);
    if (message) toast(instance, message);
  }

  function setPath(state, path, value) {
    const parts = path.split(".");
    let target = state;
    for (let index = 0; index < parts.length - 1; index += 1) target = target[parts[index]];
    const key = parts.at(-1);
    if (["bpm", "duration", "seed", "syllableTarget"].includes(key)) target[key] = Number(value);
    else if (key === "instrumental") target[key] = Boolean(value);
    else target[key] = value;
  }

  function syncLyricsFromComposer(state, preserveLocks = true) {
    const current = new Map(state.lyrics.sections.map((section) => [section.id, section]));
    state.lyrics.sections = state.composer.sections.map((section) => {
      const existing = current.get(section.id);
      if (preserveLocks && existing?.locked) return existing;
      return normalizeLyricsSection({ ...existing, id: section.id, type: section.type, label: section.label, text: section.lyrics, performance: section.direction, locked: section.locked });
    });
    state.lyrics.updatedAt = new Date().toISOString();
  }

  function downloadText(text, filename, type = "application/json") {
    const blob = new Blob([text], { type: `${type};charset=utf-8` });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1200);
  }

  async function copyText(text) {
    if (!globalScope.navigator?.clipboard?.writeText) throw new Error("Clipboard chưa được trình duyệt cấp quyền.");
    await globalScope.navigator.clipboard.writeText(text);
  }

  function sectionFromEvent(target, selector) {
    return target.closest(selector);
  }

  async function handleClick(instance, event) {
    const switcher = event.target.closest("[data-mcl-switch]");
    if (switcher) {
      instance.view = switcher.dataset.mclSwitch;
      render(instance);
      return;
    }
    const variation = event.target.closest("[data-mcl-variation]");
    if (variation) {
      instance.state.composer.activeVariation = variation.dataset.mclVariation;
      persist(instance);
      render(instance);
      return;
    }
    const button = event.target.closest("[data-mcl-action]");
    if (!button) return;
    const action = button.dataset.mclAction;
    const composerCard = sectionFromEvent(button, "[data-section-id]");
    const lyricsCard = sectionFromEvent(button, "[data-lyrics-section]");
    if (["move-up", "move-down"].includes(action) && composerCard) {
      const id = composerCard.dataset.sectionId;
      const index = instance.state.composer.sections.findIndex((section) => section.id === id);
      const nextIndex = action === "move-up" ? index - 1 : index + 1;
      if (index >= 0 && nextIndex >= 0 && nextIndex < instance.state.composer.sections.length) {
        const [section] = instance.state.composer.sections.splice(index, 1);
        instance.state.composer.sections.splice(nextIndex, 0, section);
        persist(instance);
        render(instance);
      }
    } else if (action === "toggle-lock" && composerCard) {
      instance.state.composer = toggleSectionLock(instance.state.composer, composerCard.dataset.sectionId);
      persist(instance, "Đã cập nhật khóa section.");
      render(instance);
    } else if (action === "regenerate-section" && composerCard) {
      instance.state.composer = regenerateSection(instance.state.composer, composerCard.dataset.sectionId, instance.state.composer.activeVariation);
      persist(instance, "Đã tạo lại chỉ dẫn cho section mở khóa.");
      render(instance);
    } else if (action === "add-section") {
      if (instance.state.composer.sections.length >= MAX_SECTIONS) return toast(instance, `Tối đa ${MAX_SECTIONS} section.`, "error");
      const count = instance.state.composer.sections.length + 1;
      instance.state.composer.sections.push(normalizeSection({ id: `verse-${Date.now()}`, type: "Verse", label: `Verse ${count}`, duration: 24, direction: "Phát triển motif hiện tại" }, count));
      persist(instance, "Đã thêm section.");
      render(instance);
    } else if (action === "new-seed") {
      instance.state.composer.seed = (hashSeed(`${Date.now()}:${instance.state.composer.title}`) % 2147483645) + 1;
      persist(instance, "Đã tạo seed mới.");
      render(instance);
    } else if (action === "copy-plan") {
      copyText(buildCompositionPlan(instance.state.composer).prompt).then(() => toast(instance, "Đã sao chép prompt.")).catch((error) => toast(instance, error.message, "error"));
    } else if (action === "export-plan") {
      downloadText(JSON.stringify(buildCompositionPlan(instance.state.composer), null, 2), `${safeId(instance.state.composer.title, "composition")}.plan.json`);
    } else if (action === "sync-lyrics") {
      syncLyricsFromComposer(instance.state, true);
      persist(instance, "Đã đồng bộ các section chưa khóa sang Lyrics Studio.");
      instance.view = "lyrics";
      render(instance);
    } else if (action === "check-provider") {
      instance.state.composer.provider.status = "checking";
      render(instance);
      try {
        instance.state.composer.provider = await checkProvider(instance.options);
        persist(instance, instance.state.composer.provider.message);
      } catch (error) {
        instance.state.composer.provider = { status: "error", configured: false, canRun: false, name: "Eleven Music", model: "unknown", message: cleanText(error.message, 240) };
        persist(instance);
      }
      render(instance);
    } else if (action === "request-preview") {
      instance.state.composer.preview = { status: "requesting", url: "", message: "Đang gửi composition plan tới backend…" };
      render(instance);
      try {
        const result = await requestProviderPreview(instance.state, instance.options);
        if (instance.audioUrl) URL.revokeObjectURL(instance.audioUrl);
        const bytes = Uint8Array.from(atob(result.data), (character) => character.charCodeAt(0));
        instance.audioUrl = URL.createObjectURL(new Blob([bytes], { type: result.mimeType }));
        instance.state.composer.preview = { status: "ready", url: "", message: `Đã nhận preview ${result.durationSeconds}s từ ${result.model}.` };
        instance.state.composer.provider = { ...instance.state.composer.provider, status: "ready", configured: true, canRun: true, model: result.model };
        persist(instance);
      } catch (error) {
        instance.state.composer.preview = { status: "error", url: "", message: cleanText(error.message, 240) };
        persist(instance);
      }
      render(instance);
    } else if (action === "toggle-lyrics-lock" && lyricsCard) {
      const section = instance.state.lyrics.sections.find((item) => item.id === lyricsCard.dataset.lyricsSection);
      if (section) section.locked = !section.locked;
      persist(instance, "Đã cập nhật khóa phần lời.");
      render(instance);
    } else if (action === "snapshot") {
      instance.state.lyrics = createSnapshot(instance.state.lyrics, `Phiên bản ${instance.state.lyrics.snapshots.length + 1}`);
      persist(instance, "Đã tạo snapshot.");
      render(instance);
    } else if (action === "export-project") {
      downloadText(exportProject(instance.state), `${safeId(instance.state.composer.title, "hh-music")}.hhmusic.json`);
    } else if (action === "import-project") {
      instance.host.querySelector("[data-mcl-import]")?.click();
    }
  }

  function handleInput(instance, event) {
    const field = event.target.closest("[data-mcl-field]");
    if (field) {
      setPath(instance.state, field.dataset.mclField, field.type === "checkbox" ? field.checked : field.value);
      persist(instance);
      return;
    }
    const composerField = event.target.closest("[data-mcl-section-field]");
    if (composerField) {
      const card = sectionFromEvent(composerField, "[data-section-id]");
      const section = instance.state.composer.sections.find((item) => item.id === card?.dataset.sectionId);
      if (section && !section.locked) section[composerField.dataset.mclSectionField] = composerField.type === "number" ? Number(composerField.value) : composerField.value;
      persist(instance);
      return;
    }
    const lyricsField = event.target.closest("[data-mcl-lyrics-field]");
    if (lyricsField) {
      const card = sectionFromEvent(lyricsField, "[data-lyrics-section]");
      const section = instance.state.lyrics.sections.find((item) => item.id === card?.dataset.lyricsSection);
      if (section && !section.locked) section[lyricsField.dataset.mclLyricsField] = lyricsField.value;
      persist(instance);
    }
  }

  function handleChange(instance, event) {
    const instrument = event.target.closest("[data-mcl-instrument]");
    if (instrument) {
      const selected = new Set(instance.state.composer.instruments);
      if (instrument.checked) selected.add(instrument.dataset.mclInstrument); else selected.delete(instrument.dataset.mclInstrument);
      instance.state.composer.instruments = [...selected];
      persist(instance);
      render(instance);
      return;
    }
    const importInput = event.target.closest("[data-mcl-import]");
    if (importInput?.files?.[0]) {
      const file = importInput.files[0];
      if (file.size > 2_000_000) return toast(instance, "Project phải nhỏ hơn 2 MB.", "error");
      const reader = new FileReader();
      reader.onload = () => {
        try {
          instance.state = importProject(String(reader.result || ""));
          persist(instance, "Đã nhập project.");
          render(instance);
        } catch (error) { toast(instance, error.message, "error"); }
      };
      reader.onerror = () => toast(instance, "Không đọc được tệp.", "error");
      reader.readAsText(file);
      return;
    }
    if (event.target.matches("select[data-mcl-field], input[type=checkbox][data-mcl-field], input[type=number][data-mcl-field]")) render(instance);
    if (event.target.matches("select[data-mcl-section-field], input[type=number][data-mcl-section-field]")) render(instance);
  }

  function handleKeydown(instance, event) {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
      event.preventDefault();
      persist(instance, "Đã lưu project trên thiết bị.");
    }
    if ((event.ctrlKey || event.metaKey) && event.key === "Enter" && instance.view === "composer") {
      event.preventDefault();
      instance.host.querySelector('[data-mcl-action="request-preview"]')?.click();
    }
  }

  function mount(host, options = {}) {
    if (!host || typeof host.addEventListener !== "function") throw new TypeError("HHMusicComposerLyrics.mount cần một DOM host hợp lệ.");
    unmount();
    const storage = options.storage || globalScope.localStorage;
    const instance = {
      host,
      options,
      storage,
      view: supports(options.view) ? options.view : "composer",
      state: loadState(storage),
      audioUrl: "",
      toastTimer: 0,
      handlers: {}
    };
    instance.handlers.click = (event) => { handleClick(instance, event); };
    instance.handlers.input = (event) => handleInput(instance, event);
    instance.handlers.change = (event) => handleChange(instance, event);
    instance.handlers.keydown = (event) => handleKeydown(instance, event);
    host.addEventListener("click", instance.handlers.click);
    host.addEventListener("input", instance.handlers.input);
    host.addEventListener("change", instance.handlers.change);
    host.addEventListener("keydown", instance.handlers.keydown);
    host.setAttribute("data-hh-music-composer-lyrics", "");
    active = instance;
    render(instance);
    return Object.freeze({
      getState: () => clone(instance.state),
      setView(nextView) { if (!supports(nextView)) return false; instance.view = nextView; render(instance); return true; },
      save: () => persist(instance),
      unmount
    });
  }

  function unmount() {
    if (!active) return false;
    const instance = active;
    instance.host.removeEventListener("click", instance.handlers.click);
    instance.host.removeEventListener("input", instance.handlers.input);
    instance.host.removeEventListener("change", instance.handlers.change);
    instance.host.removeEventListener("keydown", instance.handlers.keydown);
    instance.host.removeAttribute("data-hh-music-composer-lyrics");
    instance.host.replaceChildren();
    if (instance.audioUrl && globalScope.URL?.revokeObjectURL) globalScope.URL.revokeObjectURL(instance.audioUrl);
    globalScope.clearTimeout(instance.toastTimer);
    active = null;
    return true;
  }

  const browserApi = Object.freeze({ supports, mount, unmount });
  const testApi = Object.freeze({
    VERSION, STORAGE_KEY, VIEWS, SECTION_TYPES, MAX_SNAPSHOTS,
    cleanText, escapeHtml, hashSeed, normalizeSection, normalizeComposer, normalizeLyrics, normalizeState,
    loadState, saveState, buildCompositionPlan, regenerateSection, toggleSectionLock, estimateProviderCost,
    countSyllables, analyzeLyrics, createSnapshot, compareLyrics, exportProject, importProject,
    supports, mount, unmount
  });

  if (typeof module !== "undefined" && module.exports) module.exports = testApi;
  globalScope.HHMusicComposerLyrics = browserApi;
}(typeof globalThis !== "undefined" ? globalThis : this));
