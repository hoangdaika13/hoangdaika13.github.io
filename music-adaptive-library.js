(function musicAdaptiveLibraryModule(globalScope, factory) {
  "use strict";

  const api = factory(globalScope || {});
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (globalScope && typeof globalScope === "object") globalScope.HHMusicAdaptiveLibrary = api;
})(typeof window !== "undefined" ? window : globalThis, function createMusicAdaptiveLibrary(globalScope) {
  "use strict";

  const VERSION = 1;
  const STORAGE_KEY = "hh.music.adaptive-library.v1";
  const DB_NAME = "hh-music-adaptive-library";
  const DB_STORE = "metadata";
  const SUPPORTED = new Set(["adaptive-soundtrack", "sample-browser"]);
  const CUE_TYPES = ["scene", "emotion", "transition"];
  const EMOTIONS = ["trung tính", "ấm áp", "vui", "hy vọng", "căng thẳng", "bí ẩn", "buồn", "hùng tráng"];
  const LICENSES = ["Chưa xác định", "Tự tạo", "CC0", "CC BY", "CC BY-SA", "Royalty-free", "Được cấp phép riêng"];
  const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  const MAJOR_PROFILE = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
  const MINOR_PROFILE = [6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];
  const instances = new Map();

  function clone(value) {
    if (value == null) return value;
    return JSON.parse(JSON.stringify(value));
  }

  function clamp(value, min, max, fallback) {
    const number = Number(value);
    return Math.min(max, Math.max(min, Number.isFinite(number) ? number : fallback));
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, (character) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;"
    })[character]);
  }

  function uid(prefix) {
    return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  }

  function formatTime(seconds) {
    const safe = Math.max(0, Number(seconds) || 0);
    const minutes = Math.floor(safe / 60);
    const remainder = safe - minutes * 60;
    return `${String(minutes).padStart(2, "0")}:${remainder.toFixed(2).padStart(5, "0")}`;
  }

  function csvCell(value) {
    const text = String(value == null ? "" : value);
    return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  }

  function normalizeKey(value, fallback = "C major") {
    const text = String(value || "").trim();
    const match = text.match(/^([A-Ga-g])([#b]?)(?:\s+|\s*-\s*)?(major|minor|maj|min|trưởng|thứ)?$/i);
    if (!match) return fallback;
    let pitch = match[1].toUpperCase() + (match[2] || "");
    const flats = { Db: "C#", Eb: "D#", Gb: "F#", Ab: "G#", Bb: "A#" };
    pitch = flats[pitch] || pitch;
    const mode = /minor|min|thứ/i.test(match[3] || "") ? "minor" : "major";
    return `${pitch} ${mode}`;
  }

  function readProjectContext(scope = globalScope) {
    const standalone = { source: "standalone", bpm: null, key: null, dna: null };
    try {
      const snapshot = scope.HHMusicProjectContext?.getSnapshot?.();
      if (!snapshot || typeof snapshot !== "object") return standalone;
      const bpm = Number(snapshot.bpm ?? snapshot.tempo);
      const dnaCandidate = snapshot.dna ?? snapshot.songDNA ?? snapshot.songDna ?? snapshot.musicalDNA;
      return {
        source: "HHMusicProjectContext",
        bpm: Number.isFinite(bpm) && bpm >= 20 && bpm <= 320 ? bpm : null,
        key: String(snapshot.key || snapshot.musicalKey || "").trim() ? normalizeKey(snapshot.key || snapshot.musicalKey) : null,
        dna: dnaCandidate && typeof dnaCandidate === "object" ? clone(dnaCandidate) : null
      };
    } catch (_error) {
      return standalone;
    }
  }

  function createDefaultState(contextInput) {
    const context = contextInput || readProjectContext();
    return {
      version: VERSION,
      adaptive: {
        projectName: "Adaptive Score 01",
        media: null,
        duration: 0,
        targetDuration: 0,
        preservePitch: true,
        cues: [],
        context: { bpm: context.bpm || 96, key: context.key || "C minor", dna: context.dna || null, source: context.source }
      },
      samples: {
        projectBpm: context.bpm || 96,
        projectKey: context.key || "C minor",
        query: "",
        activeCollectionId: "all",
        selectedId: "",
        items: [],
        collections: [{ id: "favorites", name: "Yêu thích", sampleIds: [] }],
        context: { dna: context.dna || null, source: context.source }
      },
      updatedAt: ""
    };
  }

  function normalizeCue(input, index = 0) {
    const start = clamp(input?.start, 0, 86400, index * 4);
    const end = clamp(input?.end, start, 86400, start + 4);
    const type = CUE_TYPES.includes(input?.type) ? input.type : "scene";
    return {
      id: String(input?.id || uid("cue")),
      start: Number(start.toFixed(3)),
      end: Number(end.toFixed(3)),
      type,
      title: String(input?.title || `${type === "scene" ? "Cảnh" : type === "emotion" ? "Cảm xúc" : "Chuyển cảnh"} ${index + 1}`).slice(0, 160),
      emotion: String(input?.emotion || "trung tính").slice(0, 80),
      transition: String(input?.transition || "cut").slice(0, 80),
      note: String(input?.note || "").slice(0, 1200)
    };
  }

  function sortCues(cues) {
    return (Array.isArray(cues) ? cues : []).map(normalizeCue).sort((left, right) => left.start - right.start || left.end - right.end || left.id.localeCompare(right.id));
  }

  function retimeCueSheet(cues, sourceDuration, targetDuration) {
    const source = clamp(sourceDuration, 0.001, 86400, 1);
    const target = clamp(targetDuration, 0.001, 86400, source);
    const ratio = target / source;
    return {
      sourceDuration: source,
      targetDuration: target,
      ratio: Number(ratio.toFixed(6)),
      preservePitch: true,
      processing: "metadata-only",
      cues: sortCues(cues).map((cue) => ({
        ...cue,
        start: Number((cue.start * ratio).toFixed(3)),
        end: Number((cue.end * ratio).toFixed(3))
      }))
    };
  }

  function exportCueJson(adaptive, projectContext) {
    return JSON.stringify({
      schema: "hh.adaptive-cue-sheet.v1",
      truthfulEngine: "local-metadata",
      project: adaptive.projectName,
      media: adaptive.media ? { ...adaptive.media, availableThisSession: undefined } : null,
      duration: Number(adaptive.duration) || 0,
      targetDuration: Number(adaptive.targetDuration) || Number(adaptive.duration) || 0,
      preservePitch: Boolean(adaptive.preservePitch),
      projectContext: projectContext || adaptive.context || null,
      cues: sortCues(adaptive.cues),
      exportedAt: new Date().toISOString()
    }, null, 2);
  }

  function exportCueCsv(adaptive) {
    const rows = [["id", "start", "end", "type", "title", "emotion", "transition", "note"]];
    sortCues(adaptive.cues).forEach((cue) => rows.push([cue.id, cue.start, cue.end, cue.type, cue.title, cue.emotion, cue.transition, cue.note]));
    return rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
  }

  function estimateBpm(samples, sampleRate) {
    if (!samples || samples.length < 2048 || !Number.isFinite(sampleRate) || sampleRate <= 0) return { bpm: null, confidence: 0 };
    const hop = Math.max(256, Math.round(sampleRate / 100));
    const envelope = [];
    for (let offset = 0; offset < samples.length; offset += hop) {
      let energy = 0;
      const end = Math.min(samples.length, offset + hop);
      for (let i = offset; i < end; i += 1) energy += samples[i] * samples[i];
      envelope.push(Math.sqrt(energy / Math.max(1, end - offset)));
    }
    const mean = envelope.reduce((total, value) => total + value, 0) / Math.max(1, envelope.length);
    const centered = Float64Array.from(envelope, (value) => Math.max(0, value - mean));
    const framesPerSecond = sampleRate / hop;
    let bestLag = 0;
    let bestScore = -Infinity;
    const minLag = Math.max(1, Math.floor(framesPerSecond * 60 / 200));
    const maxLag = Math.min(centered.length - 2, Math.ceil(framesPerSecond * 60 / 60));
    for (let lag = minLag; lag <= maxLag; lag += 1) {
      let numerator = 0;
      let leftEnergy = 0;
      let rightEnergy = 0;
      for (let i = lag; i < centered.length; i += 1) {
        const left = centered[i];
        const right = centered[i - lag];
        numerator += left * right;
        leftEnergy += left * left;
        rightEnergy += right * right;
      }
      const score = numerator / Math.sqrt(Math.max(1e-12, leftEnergy * rightEnergy));
      if (score > bestScore) { bestScore = score; bestLag = lag; }
    }
    if (!bestLag || !Number.isFinite(bestScore)) return { bpm: null, confidence: 0 };
    let bpm = 60 * framesPerSecond / bestLag;
    while (bpm < 70) bpm *= 2;
    while (bpm > 180) bpm /= 2;
    return { bpm: Math.round(bpm), confidence: Number(clamp(bestScore, 0, 1, 0).toFixed(3)) };
  }

  function chromaForPcm(samples, sampleRate) {
    const chroma = new Float64Array(12);
    if (!samples || !samples.length || !sampleRate) return chroma;
    const maxSamples = Math.min(samples.length, Math.floor(sampleRate * 8));
    const frameSize = 2048;
    const hop = 4096;
    for (let start = 0; start + frameSize < maxSamples; start += hop) {
      for (let midi = 36; midi <= 83; midi += 1) {
        const frequency = 440 * Math.pow(2, (midi - 69) / 12);
        const omega = 2 * Math.PI * frequency / sampleRate;
        const coefficient = 2 * Math.cos(omega);
        let previous = 0;
        let previous2 = 0;
        for (let index = 0; index < frameSize; index += 1) {
          const window = 0.5 - 0.5 * Math.cos(2 * Math.PI * index / (frameSize - 1));
          const current = samples[start + index] * window + coefficient * previous - previous2;
          previous2 = previous;
          previous = current;
        }
        const power = Math.max(0, previous2 * previous2 + previous * previous - coefficient * previous * previous2);
        chroma[midi % 12] += Math.sqrt(power);
      }
    }
    return chroma;
  }

  function correlationRotated(chroma, profile, tonic) {
    const length = 12;
    const chromaMean = Array.from(chroma).reduce((sum, value) => sum + value, 0) / length;
    const profileMean = profile.reduce((sum, value) => sum + value, 0) / length;
    let numerator = 0;
    let a = 0;
    let b = 0;
    for (let index = 0; index < length; index += 1) {
      const left = chroma[(index + tonic) % length] - chromaMean;
      const right = profile[index] - profileMean;
      numerator += left * right;
      a += left * left;
      b += right * right;
    }
    return numerator / Math.sqrt(Math.max(1e-12, a * b));
  }

  function detectKey(samples, sampleRate) {
    const chroma = chromaForPcm(samples, sampleRate);
    const energy = Array.from(chroma).reduce((sum, value) => sum + value, 0);
    if (!energy) return { key: null, confidence: 0, chroma: Array(12).fill(0) };
    let best = { key: "C major", confidence: -Infinity };
    for (let tonic = 0; tonic < 12; tonic += 1) {
      for (const [mode, profile] of [["major", MAJOR_PROFILE], ["minor", MINOR_PROFILE]]) {
        const confidence = correlationRotated(chroma, profile, tonic);
        if (confidence > best.confidence) best = { key: `${NOTE_NAMES[tonic]} ${mode}`, confidence };
      }
    }
    return { ...best, confidence: Number(clamp((best.confidence + 1) / 2, 0, 1, 0).toFixed(3)), chroma: Array.from(chroma, (value) => Number((value / energy).toFixed(5))) };
  }

  function analyzePcm(samplesInput, sampleRate, durationInput) {
    const samples = samplesInput instanceof Float32Array ? samplesInput : Float32Array.from(samplesInput || []);
    if (!samples.length || !sampleRate) return { duration: 0, sampleRate: Number(sampleRate) || 0, peak: 0, rms: 0, dynamicRangeDb: 0, zcr: 0, brightness: 0, bpm: null, bpmConfidence: 0, key: null, keyConfidence: 0, vector: [0, 0, 0, 0, 0, 0, 0] };
    let peak = 0;
    let square = 0;
    let differenceSquare = 0;
    let zeroCrossings = 0;
    for (let index = 0; index < samples.length; index += 1) {
      const value = samples[index];
      peak = Math.max(peak, Math.abs(value));
      square += value * value;
      if (index) {
        const difference = value - samples[index - 1];
        differenceSquare += difference * difference;
        if ((value >= 0) !== (samples[index - 1] >= 0)) zeroCrossings += 1;
      }
    }
    const rms = Math.sqrt(square / samples.length);
    const brightness = Math.sqrt(differenceSquare / Math.max(1, samples.length - 1));
    const bpm = estimateBpm(samples, sampleRate);
    const key = detectKey(samples, sampleRate);
    const duration = Number(durationInput) || samples.length / sampleRate;
    const pitchIndex = key.key ? NOTE_NAMES.indexOf(key.key.split(" ")[0]) : -1;
    const mode = key.key?.endsWith("minor") ? 1 : 0;
    const result = {
      duration: Number(duration.toFixed(3)), sampleRate, peak: Number(peak.toFixed(5)), rms: Number(rms.toFixed(5)),
      dynamicRangeDb: Number((20 * Math.log10(Math.max(1e-8, peak) / Math.max(1e-8, rms))).toFixed(2)),
      zcr: Number((zeroCrossings / Math.max(1, samples.length - 1)).toFixed(5)), brightness: Number(brightness.toFixed(5)),
      bpm: bpm.bpm, bpmConfidence: bpm.confidence, key: key.key, keyConfidence: key.confidence, chroma: key.chroma
    };
    result.vector = [clamp((result.bpm || 100) / 200, 0, 1, 0.5), clamp(result.brightness * 5, 0, 1, 0), clamp(result.rms * 4, 0, 1, 0), clamp(result.zcr * 4, 0, 1, 0), clamp(result.duration / 60, 0, 1, 0), pitchIndex < 0 ? 0.5 : pitchIndex / 11, mode];
    return result;
  }

  function normalizeTokens(value) {
    return String(value || "").toLocaleLowerCase("vi").normalize("NFD").replace(/[\u0300-\u036f]/g, "").split(/[^a-z0-9#]+/).filter(Boolean);
  }

  function expandSemanticTokens(tokens) {
    const aliases = {
      trong: ["drums", "drum", "beat", "percussion"], dien: ["electronic", "synth"], tu: ["electronic"],
      toi: ["dark", "moody"], manh: ["powerful", "energetic", "impact"], nhe: ["soft", "gentle"],
      am: ["warm"], ap: ["warm"], vui: ["happy", "bright"], buon: ["sad", "melancholy"],
      bi: ["mysterious"], an: ["mysterious"], hung: ["epic"], trang: ["epic"],
      dan: ["guitar", "strings"], piano: ["keys"], guitar: ["dan"], giong: ["vocal", "voice"], hat: ["vocal"],
      mua: ["rain", "ambience"], bien: ["ocean", "waves", "ambience"], phim: ["cinematic", "score"]
    };
    const expanded = new Set(tokens);
    tokens.forEach((token) => (aliases[token] || []).forEach((alias) => expanded.add(alias)));
    return Array.from(expanded);
  }

  function sampleText(sample) {
    return [sample.name, sample.tags?.join(" "), sample.mood, sample.instrument, sample.license?.type, sample.license?.author, sample.license?.source].filter(Boolean).join(" ");
  }

  function semanticSearch(samples, query, contextInput) {
    const context = contextInput || {};
    const tokens = expandSemanticTokens(normalizeTokens(query));
    const bpmMatch = String(query || "").match(/\b(\d{2,3})\s*bpm\b/i);
    return (Array.isArray(samples) ? samples : []).map((sample) => {
      const haystack = new Set(normalizeTokens(sampleText(sample)));
      let score = tokens.reduce((total, token) => total + (haystack.has(token) ? 4 : Array.from(haystack).some((word) => word.includes(token)) ? 1.5 : 0), 0);
      if (bpmMatch && sample.analysis?.bpm) score += Math.max(0, 4 - Math.abs(Number(bpmMatch[1]) - sample.analysis.bpm) / 8);
      if (context.bpm && sample.analysis?.bpm) score += Math.max(0, 2 - Math.abs(context.bpm - sample.analysis.bpm) / 20);
      if (context.key && sample.analysis?.key === normalizeKey(context.key)) score += 2;
      const dnaTokens = normalizeTokens(JSON.stringify(context.dna || {}));
      const dnaMatches = dnaTokens.filter((token) => haystack.has(token)).length;
      score += Math.min(3, dnaMatches * 0.5);
      return { sample, score: Number(score.toFixed(4)) };
    }).filter((entry) => !tokens.length || entry.score > 0).sort((left, right) => right.score - left.score || left.sample.name.localeCompare(right.sample.name) || left.sample.id.localeCompare(right.sample.id));
  }

  function jaccard(leftInput, rightInput) {
    const left = new Set(leftInput || []);
    const right = new Set(rightInput || []);
    const union = new Set([...left, ...right]);
    if (!union.size) return 0;
    let overlap = 0;
    left.forEach((value) => { if (right.has(value)) overlap += 1; });
    return overlap / union.size;
  }

  function rankSimilarSamples(reference, samples) {
    if (!reference) return [];
    const sourceVector = reference.analysis?.vector || [];
    return (Array.isArray(samples) ? samples : []).filter((sample) => sample.id !== reference.id).map((sample) => {
      const target = sample.analysis?.vector || [];
      let distance = 0;
      const weights = [2.2, 1.2, 1, 0.7, 0.5, 0.8, 0.5];
      for (let index = 0; index < weights.length; index += 1) distance += weights[index] * Math.pow((sourceVector[index] ?? 0.5) - (target[index] ?? 0.5), 2);
      const audioSimilarity = 1 / (1 + Math.sqrt(distance));
      const tagSimilarity = jaccard(normalizeTokens(sampleText(reference)), normalizeTokens(sampleText(sample)));
      return { sample, score: Number((audioSimilarity * 0.82 + tagSimilarity * 0.18).toFixed(6)) };
    }).sort((left, right) => right.score - left.score || left.sample.name.localeCompare(right.sample.name) || left.sample.id.localeCompare(right.sample.id));
  }

  function keyPitchClass(key) {
    const normalized = normalizeKey(key || "C major");
    return NOTE_NAMES.indexOf(normalized.split(" ")[0]);
  }

  function buildSyncPlan(sample, projectInput) {
    const project = projectInput || {};
    const rawSourceBpm = Number(sample?.analysis?.bpm);
    const sourceBpm = Number.isFinite(rawSourceBpm) && rawSourceBpm >= 20 ? clamp(rawSourceBpm, 20, 320, rawSourceBpm) : 0;
    const targetBpm = clamp(project.bpm, 20, 320, sourceBpm || 96);
    const playbackRate = sourceBpm ? clamp(targetBpm / sourceBpm, 0.5, 2, 1) : 1;
    const sourcePitch = keyPitchClass(sample?.analysis?.key || project.key || "C major");
    const targetPitch = keyPitchClass(project.key || sample?.analysis?.key || "C major");
    let semitones = targetPitch - sourcePitch;
    if (semitones > 6) semitones -= 12;
    if (semitones < -6) semitones += 12;
    return {
      sourceBpm: sourceBpm || null,
      targetBpm,
      playbackRate: Number(playbackRate.toFixed(4)),
      preservePitch: true,
      sourceKey: sample?.analysis?.key || null,
      targetKey: normalizeKey(project.key || sample?.analysis?.key || "C major"),
      transposeSemitones: semitones,
      mode: sourceBpm ? "estimated-beat-sync" : "raw-preview",
      notice: "BPM/key là ước tính Web Audio cục bộ; kế hoạch transpose không thay đổi tệp nguồn."
    };
  }

  function normalizeState(input, contextInput) {
    const context = contextInput || readProjectContext();
    const base = createDefaultState(context);
    const saved = input && typeof input === "object" ? input : {};
    const samples = Array.isArray(saved.samples?.items) ? saved.samples.items.map((item) => ({
      id: String(item.id || uid("sample")), name: String(item.name || "Sample local"), type: String(item.type || "audio/*"), size: Number(item.size) || 0,
      tags: Array.isArray(item.tags) ? item.tags.map(String).slice(0, 30) : [], mood: String(item.mood || ""), instrument: String(item.instrument || ""),
      favorite: Boolean(item.favorite), collectionIds: Array.isArray(item.collectionIds) ? item.collectionIds.map(String) : [],
      license: { type: LICENSES.includes(item.license?.type) ? item.license.type : "Chưa xác định", author: String(item.license?.author || ""), source: String(item.license?.source || ""), url: String(item.license?.url || ""), attribution: String(item.license?.attribution || ""), commercialUse: Boolean(item.license?.commercialUse) },
      analysis: item.analysis && typeof item.analysis === "object" ? item.analysis : null, availableThisSession: false, importedAt: String(item.importedAt || "")
    })) : [];
    const collections = Array.isArray(saved.samples?.collections) && saved.samples.collections.length ? saved.samples.collections.map((item) => ({ id: String(item.id || uid("collection")), name: String(item.name || "Bộ sưu tập").slice(0, 80), sampleIds: Array.isArray(item.sampleIds) ? item.sampleIds.map(String) : [] })) : base.samples.collections;
    return {
      version: VERSION,
      adaptive: {
        ...base.adaptive, ...(saved.adaptive || {}), media: saved.adaptive?.media ? { ...saved.adaptive.media, availableThisSession: false } : null,
        duration: clamp(saved.adaptive?.duration, 0, 86400, 0), targetDuration: clamp(saved.adaptive?.targetDuration, 0, 86400, 0), cues: sortCues(saved.adaptive?.cues),
        context: { bpm: context.bpm || saved.adaptive?.context?.bpm || base.adaptive.context.bpm, key: context.key || saved.adaptive?.context?.key || base.adaptive.context.key, dna: context.dna || saved.adaptive?.context?.dna || null, source: context.source }
      },
      samples: {
        ...base.samples, ...(saved.samples || {}), items: samples, collections,
        activeCollectionId: ["all", "favorites", ...collections.map((item) => item.id)].includes(saved.samples?.activeCollectionId) ? saved.samples.activeCollectionId : "all",
        projectBpm: context.bpm || clamp(saved.samples?.projectBpm, 20, 320, 96), projectKey: context.key || normalizeKey(saved.samples?.projectKey || "C minor"),
        context: { dna: context.dna || saved.samples?.context?.dna || null, source: context.source }
      },
      updatedAt: String(saved.updatedAt || "")
    };
  }

  function loadLocalState(scope = globalScope) {
    try { return normalizeState(JSON.parse(scope.localStorage?.getItem(STORAGE_KEY) || "null")); } catch (_error) { return createDefaultState(); }
  }

  function persistedSnapshot(state) {
    const snapshot = clone(state);
    snapshot.updatedAt = new Date().toISOString();
    if (snapshot.adaptive.media) snapshot.adaptive.media.availableThisSession = false;
    snapshot.samples.items.forEach((item) => { item.availableThisSession = false; });
    return snapshot;
  }

  function openDatabase(scope = globalScope) {
    if (!scope.indexedDB) return Promise.reject(new Error("IndexedDB không khả dụng"));
    return new Promise((resolve, reject) => {
      const request = scope.indexedDB.open(DB_NAME, VERSION);
      request.onupgradeneeded = () => { if (!request.result.objectStoreNames.contains(DB_STORE)) request.result.createObjectStore(DB_STORE); };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error("Không mở được IndexedDB"));
    });
  }

  async function idbWrite(snapshot, scope = globalScope) {
    const database = await openDatabase(scope);
    await new Promise((resolve, reject) => {
      const transaction = database.transaction(DB_STORE, "readwrite");
      transaction.objectStore(DB_STORE).put(snapshot, "workspace");
      transaction.oncomplete = resolve;
      transaction.onerror = () => reject(transaction.error || new Error("Không ghi được IndexedDB"));
    });
    database.close();
  }

  async function idbRead(scope = globalScope) {
    const database = await openDatabase(scope);
    const value = await new Promise((resolve, reject) => {
      const request = database.transaction(DB_STORE, "readonly").objectStore(DB_STORE).get("workspace");
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error || new Error("Không đọc được IndexedDB"));
    });
    database.close();
    return value;
  }

  function saveState(instance) {
    const snapshot = persistedSnapshot(instance.state);
    instance.state.updatedAt = snapshot.updatedAt;
    try { globalScope.localStorage?.setItem(STORAGE_KEY, JSON.stringify(snapshot)); } catch (_error) { /* local fallback is optional */ }
    void idbWrite(snapshot).catch(() => {});
  }

  function downloadText(name, content, type) {
    if (!globalScope.document || !globalScope.URL || !globalScope.Blob) return false;
    const url = globalScope.URL.createObjectURL(new globalScope.Blob([content], { type }));
    const anchor = globalScope.document.createElement("a");
    anchor.href = url; anchor.download = name; anchor.hidden = true;
    globalScope.document.body.append(anchor); anchor.click(); anchor.remove();
    globalScope.setTimeout(() => globalScope.URL.revokeObjectURL(url), 0);
    return true;
  }

  function status(instance, message, tone = "info") {
    const node = instance.root.querySelector?.("[data-mal-status]");
    if (!node) return;
    node.textContent = message;
    node.dataset.tone = tone;
  }

  function adaptiveMarkup(instance) {
    const data = instance.state.adaptive;
    const context = data.context;
    const media = data.media;
    const timelineDuration = Math.max(1, data.targetDuration || data.duration || Math.max(1, ...data.cues.map((cue) => cue.end)));
    return `<section class="mal-workspace mal-adaptive" aria-label="Adaptive Soundtrack">
      <header class="mal-hero"><div><p class="mal-kicker">ADAPTIVE SCORE / LOCAL ENGINE</p><h1>Âm nhạc đi đúng nhịp từng cảnh.</h1><p>Nhập video hoặc storyboard, tạo cue sheet và retime metadata không phá hủy. Engine không tự render hay tuyên bố giữ pitch nếu chưa qua DAW/backend.</p></div><div class="mal-context"><span>${context.source === "HHMusicProjectContext" ? "Đã nối Project Context" : "Chạy độc lập"}</span><strong>${context.bpm} BPM · ${escapeHtml(context.key)}</strong><small>${context.dna ? "Song DNA đang khóa định hướng" : "Chưa có Song DNA"}</small></div></header>
      <div class="mal-adaptive-grid"><aside class="mal-panel mal-source-panel"><div class="mal-panel-head"><div><p class="mal-kicker">01 / SOURCE</p><h2>Media & storyboard</h2></div><label class="mal-upload">Nhập tệp<input hidden type="file" data-mal-adaptive-file accept="video/*,audio/*,image/*,application/json,.json"></label></div>
        <div class="mal-dropzone" data-mal-drop="adaptive" tabindex="0" role="button" aria-label="Kéo thả video hoặc storyboard"><span>＋</span><strong>Kéo video, audio, ảnh hoặc cue JSON</strong><small>Tệp chỉ được đọc trên thiết bị này.</small></div>
        ${media ? `<article class="mal-media-card"><div><strong>${escapeHtml(media.name)}</strong><small>${escapeHtml(media.type)} · ${(media.size / 1048576).toFixed(1)} MB</small></div><span class="${media.availableThisSession ? "is-live" : ""}">${media.availableThisSession ? "Trong phiên" : "Cần nhập lại"}</span></article>` : `<div class="mal-empty-small">Chưa có media nguồn.</div>`}
        <div class="mal-preview" data-mal-preview>${instance.mediaUrl && media?.type.startsWith("video/") ? `<video controls preload="metadata" src="${escapeHtml(instance.mediaUrl)}" data-mal-media></video>` : instance.mediaUrl && media?.type.startsWith("audio/") ? `<audio controls preload="metadata" src="${escapeHtml(instance.mediaUrl)}" data-mal-media></audio>` : instance.mediaUrl && media?.type.startsWith("image/") ? `<img src="${escapeHtml(instance.mediaUrl)}" alt="Storyboard đã nhập">` : `<div><span>SCENE</span><p>Preview media sẽ xuất hiện tại đây.</p></div>`}</div>
      </aside><main class="mal-panel mal-cue-panel"><div class="mal-panel-head"><div><p class="mal-kicker">02 / CUE SHEET</p><h2>Cảnh, cảm xúc & chuyển cảnh</h2></div><button type="button" class="mal-primary" data-mal-action="add-cue">+ Cue tại playhead</button></div>
        <div class="mal-timeline" aria-label="Tổng quan cue sheet"><div class="mal-ruler">${Array.from({ length: 6 }, (_, index) => `<span style="left:${index * 20}%">${formatTime(timelineDuration * index / 5)}</span>`).join("")}</div><div class="mal-marker-track">${data.cues.map((cue) => `<button type="button" data-mal-seek="${cue.start}" class="is-${cue.type}" style="left:${clamp(cue.start / timelineDuration * 100, 0, 99, 0)}%" title="${escapeHtml(cue.title)} · ${formatTime(cue.start)}"><span></span></button>`).join("")}</div></div>
        <div class="mal-cue-table" role="region" aria-label="Danh sách cue" tabindex="0"><div class="mal-cue-row mal-cue-heading"><span>Bắt đầu / kết thúc</span><span>Loại</span><span>Nội dung</span><span>Cảm xúc / chuyển</span><span></span></div>${data.cues.length ? data.cues.map((cue) => `<div class="mal-cue-row" data-cue-id="${escapeHtml(cue.id)}"><div class="mal-time-pair"><input aria-label="Bắt đầu" type="number" min="0" step="0.1" value="${cue.start}" data-cue-field="start"><input aria-label="Kết thúc" type="number" min="0" step="0.1" value="${cue.end}" data-cue-field="end"></div><select aria-label="Loại marker" data-cue-field="type">${CUE_TYPES.map((type) => `<option value="${type}" ${type === cue.type ? "selected" : ""}>${type === "scene" ? "Cảnh" : type === "emotion" ? "Cảm xúc" : "Chuyển cảnh"}</option>`).join("")}</select><div><input aria-label="Tên cue" value="${escapeHtml(cue.title)}" data-cue-field="title"><input aria-label="Ghi chú cue" value="${escapeHtml(cue.note)}" placeholder="Ghi chú nhạc, thoại..." data-cue-field="note"></div><div><select aria-label="Cảm xúc" data-cue-field="emotion">${EMOTIONS.map((emotion) => `<option ${emotion === cue.emotion ? "selected" : ""}>${emotion}</option>`).join("")}</select><input aria-label="Chuyển cảnh" value="${escapeHtml(cue.transition)}" data-cue-field="transition"></div><button type="button" class="mal-icon-button" data-mal-action="remove-cue" data-id="${escapeHtml(cue.id)}" aria-label="Xóa cue">×</button></div>`).join("") : `<div class="mal-empty">Chưa có cue. Di chuyển playhead rồi chọn “Cue tại playhead”.</div>`}</div>
      </main><aside class="mal-panel mal-retime-panel"><p class="mal-kicker">03 / RETIME</p><h2>Khớp thời lượng</h2><label>Thời lượng nguồn<input type="number" min="0" step="0.1" value="${data.duration || ""}" data-adaptive-field="duration"></label><label>Thời lượng đích<input type="number" min="0" step="0.1" value="${data.targetDuration || data.duration || ""}" data-adaptive-field="targetDuration"></label><label class="mal-check"><input type="checkbox" ${data.preservePitch ? "checked" : ""} data-adaptive-field="preservePitch"> Ghi metadata giữ cao độ</label><button type="button" class="mal-primary" data-mal-action="retime">Retime cue sheet</button><div class="mal-truth"><strong>Không phá hủy</strong><p>Chỉ co giãn timestamp. Tệp media không bị sửa; pitch-preserve là yêu cầu cho renderer kế tiếp.</p></div><div class="mal-export"><button type="button" data-mal-action="export-cue-json">Xuất JSON</button><button type="button" data-mal-action="export-cue-csv">Xuất CSV</button></div></aside></div>
    </section>`;
  }

  function sampleCard(item, selected) {
    const analysis = item.analysis;
    return `<article class="mal-sample-card ${selected ? "is-selected" : ""}" data-sample-id="${escapeHtml(item.id)}"><button type="button" class="mal-sample-main" data-mal-action="select-sample"><span class="mal-wave-mini" aria-hidden="true">${Array.from({ length: 16 }, (_, index) => `<i style="height:${18 + ((index * 29 + item.name.length * 7) % 74)}%"></i>`).join("")}</span><span><strong>${escapeHtml(item.name)}</strong><small>${analysis ? `${analysis.bpm || "?"} BPM · ${escapeHtml(analysis.key || "chưa rõ")} · ${analysis.duration.toFixed(1)}s` : "Chưa phân tích"}</small><em>${escapeHtml([item.instrument, item.mood, ...(item.tags || []).slice(0, 3)].filter(Boolean).join(" · ") || "Chưa gắn tag")}</em></span></button><button type="button" class="mal-favorite ${item.favorite ? "is-active" : ""}" data-mal-action="favorite" aria-label="${item.favorite ? "Bỏ yêu thích" : "Yêu thích"}" aria-pressed="${item.favorite}">★</button></article>`;
  }

  function sampleBrowserMarkup(instance) {
    const data = instance.state.samples;
    const context = { bpm: data.projectBpm, key: data.projectKey, dna: data.context.dna };
    const selected = data.items.find((item) => item.id === data.selectedId) || data.items[0] || null;
    const collection = data.collections.find((item) => item.id === data.activeCollectionId);
    const collectionItems = data.activeCollectionId === "favorites" ? data.items.filter((item) => item.favorite) : collection && collection.id !== "favorites" ? data.items.filter((item) => collection.sampleIds.includes(item.id)) : data.items;
    const searchResults = semanticSearch(collectionItems, data.query, context);
    const visible = (data.query ? searchResults.map((entry) => entry.sample) : collectionItems);
    const similar = rankSimilarSamples(selected, data.items).slice(0, 5);
    const plan = selected ? buildSyncPlan(selected, context) : null;
    return `<section class="mal-workspace mal-library" aria-label="Semantic Sample Browser"><header class="mal-hero"><div><p class="mal-kicker">SEMANTIC SAMPLE LIBRARY / WEB AUDIO</p><h1>Tìm đúng âm thanh bằng ngôn ngữ của bạn.</h1><p>Phân tích BPM, tone và đặc trưng cơ bản ngay trên thiết bị. Xếp hạng ngữ nghĩa và tương tự là thuật toán local xác định, không gửi audio lên AI.</p></div><div class="mal-context"><span>${data.context.source === "HHMusicProjectContext" ? "Theo Project Context" : "Thiết lập riêng"}</span><label>BPM<input type="number" min="20" max="320" value="${data.projectBpm}" data-sample-setting="projectBpm"></label><label>Tone<input value="${escapeHtml(data.projectKey)}" data-sample-setting="projectKey"></label></div></header>
      <div class="mal-library-grid"><aside class="mal-panel mal-library-sidebar"><div class="mal-panel-head"><div><p class="mal-kicker">LIBRARY</p><h2>Kho âm thanh</h2></div><label class="mal-upload">Nhập audio<input hidden type="file" multiple accept="audio/*" data-mal-sample-file></label></div><div class="mal-dropzone mal-dropzone-compact" data-mal-drop="samples" tabindex="0" role="button" aria-label="Kéo thả audio"><span>＋</span><strong>Kéo sample vào đây</strong><small>WAV, MP3, OGG, M4A tùy trình duyệt.</small></div><label class="mal-search"><span>⌕</span><input value="${escapeHtml(data.query)}" data-mal-search placeholder="Ví dụ: trống điện tử tối 120 BPM" aria-label="Tìm sample theo ngữ nghĩa"></label><nav class="mal-collections" aria-label="Bộ sưu tập"><button type="button" class="${data.activeCollectionId === "all" ? "is-active" : ""}" data-mal-collection="all"><span>Tất cả sample</span><strong>${data.items.length}</strong></button>${data.collections.map((entry) => `<button type="button" class="${data.activeCollectionId === entry.id ? "is-active" : ""}" data-mal-collection="${escapeHtml(entry.id)}"><span>${escapeHtml(entry.name)}</span><strong>${entry.id === "favorites" ? data.items.filter((item) => item.favorite).length : entry.sampleIds.length}</strong></button>`).join("")}</nav><div class="mal-new-collection"><input placeholder="Tên bộ sưu tập" data-mal-new-collection maxlength="80"><button type="button" data-mal-action="add-collection" aria-label="Tạo bộ sưu tập">＋</button></div>${data.activeCollectionId !== "all" && data.activeCollectionId !== "favorites" ? `<button type="button" class="mal-delete-collection" data-mal-action="delete-collection">Xóa bộ sưu tập đang mở</button>` : ""}</aside>
      <main class="mal-panel mal-sample-results"><div class="mal-panel-head"><div><p class="mal-kicker">RESULTS</p><h2>${data.query ? `${visible.length} kết quả local` : "Sample gần đây"}</h2></div><span class="mal-local-badge">Không upload</span></div><div class="mal-sample-list">${visible.length ? visible.map((item) => sampleCard(item, item.id === selected?.id)).join("") : `<div class="mal-empty">${data.items.length ? "Không có sample khớp. Thử mô tả ngắn hơn." : "Nhập audio để bắt đầu phân tích cục bộ."}</div>`}</div></main>
      <aside class="mal-panel mal-inspector"><div class="mal-panel-head"><div><p class="mal-kicker">INSPECTOR</p><h2>${selected ? escapeHtml(selected.name) : "Chưa chọn sample"}</h2></div>${selected ? `<button type="button" class="mal-icon-button" data-mal-action="remove-sample" aria-label="Xóa sample">×</button>` : ""}</div>${selected ? `<div class="mal-analysis-grid"><span><small>BPM ước tính</small><strong>${selected.analysis?.bpm || "?"}</strong><em>${Math.round((selected.analysis?.bpmConfidence || 0) * 100)}% tin cậy</em></span><span><small>Tone ước tính</small><strong>${escapeHtml(selected.analysis?.key || "?")}</strong><em>${Math.round((selected.analysis?.keyConfidence || 0) * 100)}% tin cậy</em></span><span><small>Peak / RMS</small><strong>${selected.analysis ? `${(20 * Math.log10(Math.max(1e-8, selected.analysis.peak))).toFixed(1)} dB` : "?"}</strong><em>${selected.analysis ? selected.analysis.rms.toFixed(3) : "-"}</em></span><span><small>Dynamic</small><strong>${selected.analysis?.dynamicRangeDb ?? "?"} dB</strong><em>${selected.analysis?.sampleRate || "?"} Hz</em></span></div><div class="mal-sync-plan"><div><p class="mal-kicker">SYNC PLAN</p><strong>${plan.sourceBpm || "?"} → ${plan.targetBpm} BPM</strong></div><span>${plan.playbackRate}× · ${plan.transposeSemitones >= 0 ? "+" : ""}${plan.transposeSemitones} semitone</span><small>${escapeHtml(plan.notice)}</small><button type="button" class="mal-primary" data-mal-action="preview-sync" ${selected.availableThisSession ? "" : "disabled"}>Nghe preview đồng bộ</button></div><div class="mal-form-grid"><label>Nhạc cụ<input value="${escapeHtml(selected.instrument)}" data-sample-field="instrument"></label><label>Cảm xúc<input value="${escapeHtml(selected.mood)}" data-sample-field="mood"></label><label class="mal-span-2">Tags<input value="${escapeHtml((selected.tags || []).join(", "))}" data-sample-field="tags" placeholder="drums, dark, electronic"></label><label>Giấy phép<select data-sample-field="license.type">${LICENSES.map((license) => `<option ${license === selected.license.type ? "selected" : ""}>${license}</option>`).join("")}</select></label><label>Tác giả<input value="${escapeHtml(selected.license.author)}" data-sample-field="license.author"></label><label class="mal-span-2">Nguồn / URL<input value="${escapeHtml(selected.license.source || selected.license.url)}" data-sample-field="license.source"></label><label class="mal-check mal-span-2"><input type="checkbox" ${selected.license.commercialUse ? "checked" : ""} data-sample-field="license.commercialUse"> Đã xác nhận quyền dùng thương mại</label></div><div class="mal-collection-assign"><p class="mal-kicker">BỘ SƯU TẬP</p>${data.collections.filter((entry) => entry.id !== "favorites").length ? data.collections.filter((entry) => entry.id !== "favorites").map((entry) => `<label><input type="checkbox" data-mal-toggle-collection="${escapeHtml(entry.id)}" ${entry.sampleIds.includes(selected.id) ? "checked" : ""}> ${escapeHtml(entry.name)}</label>`).join("") : `<small>Tạo bộ sưu tập ở cột trái để phân loại sample.</small>`}</div><div class="mal-similar"><p class="mal-kicker">SIMILAR SOUND</p>${similar.length ? similar.map((entry) => `<button type="button" data-mal-select-id="${escapeHtml(entry.sample.id)}"><span>${escapeHtml(entry.sample.name)}</span><strong>${Math.round(entry.score * 100)}%</strong></button>`).join("") : `<small>Cần ít nhất hai sample để so sánh.</small>`}</div>` : `<div class="mal-empty">Chọn một sample để xem phân tích, giấy phép và kế hoạch đồng bộ.</div>`}</aside></div></section>`;
  }

  function render(instance) {
    instance.root.classList.add("hh-music-adaptive-library");
    instance.root.innerHTML = instance.view === "adaptive-soundtrack" ? adaptiveMarkup(instance) : sampleBrowserMarkup(instance);
    instance.root.insertAdjacentHTML?.("beforeend", `<footer class="mal-statusbar"><span data-mal-status role="status" aria-live="polite">Sẵn sàng. Mọi phân tích chạy cục bộ trên thiết bị.</span><span>Metadata: IndexedDB + localStorage fallback</span></footer>`);
    const mediaElement = instance.root.querySelector?.("[data-mal-media]");
    if (mediaElement) mediaElement.addEventListener("loadedmetadata", () => {
      const duration = Number(mediaElement.duration);
      if (!Number.isFinite(duration) || duration <= 0) return;
      instance.state.adaptive.duration = Number(duration.toFixed(3));
      if (!instance.state.adaptive.targetDuration) instance.state.adaptive.targetDuration = instance.state.adaptive.duration;
      saveState(instance);
      status(instance, `Đã đọc HTMLMediaElement metadata: ${formatTime(duration)}.`, "success");
    }, { once: true });
  }

  function revokeUrl(instance, id) {
    const url = instance.urls.get(id);
    if (url && globalScope.URL?.revokeObjectURL) globalScope.URL.revokeObjectURL(url);
    instance.urls.delete(id);
  }

  function stopAudio(instance) {
    if (instance.audio) {
      try { instance.audio.pause(); instance.audio.removeAttribute?.("src"); instance.audio.load?.(); } catch (_error) { /* best effort */ }
      instance.audio = null;
    }
    if (instance.audioContext && instance.audioContext.state !== "closed") void instance.audioContext.close().catch(() => {});
    instance.audioContext = null;
  }

  async function decodeAudioFile(instance, file) {
    const AudioContextCtor = globalScope.AudioContext || globalScope.webkitAudioContext;
    if (!AudioContextCtor) throw new Error("Trình duyệt chưa hỗ trợ Web Audio AudioContext.");
    const context = new AudioContextCtor();
    instance.contexts.add(context);
    try {
      const arrayBuffer = await file.arrayBuffer();
      const audioBuffer = await context.decodeAudioData(arrayBuffer.slice(0));
      const length = audioBuffer.length;
      const mono = new Float32Array(length);
      for (let channel = 0; channel < audioBuffer.numberOfChannels; channel += 1) {
        const data = audioBuffer.getChannelData(channel);
        for (let index = 0; index < length; index += 1) mono[index] += data[index] / audioBuffer.numberOfChannels;
      }
      return analyzePcm(mono, audioBuffer.sampleRate, audioBuffer.duration);
    } finally {
      instance.contexts.delete(context);
      await context.close().catch(() => {});
    }
  }

  async function importSamples(instance, filesInput) {
    const files = Array.from(filesInput || []).filter((file) => String(file.type || "").startsWith("audio/"));
    if (!files.length) return status(instance, "Không tìm thấy tệp audio hợp lệ.", "error");
    status(instance, `Đang phân tích ${files.length} sample bằng Web Audio...`);
    for (const file of files) {
      const id = uid("sample");
      const url = globalScope.URL?.createObjectURL?.(file) || "";
      if (url) instance.urls.set(id, url);
      try {
        const analysis = await decodeAudioFile(instance, file);
        instance.files.set(id, file);
        instance.state.samples.items.unshift({ id, name: file.name, type: file.type || "audio/*", size: file.size || 0, tags: [], mood: "", instrument: "", favorite: false, collectionIds: [], license: { type: "Chưa xác định", author: "", source: "", url: "", attribution: "", commercialUse: false }, analysis, availableThisSession: true, importedAt: new Date().toISOString() });
        instance.state.samples.selectedId = id;
      } catch (error) {
        revokeUrl(instance, id);
        status(instance, `${file.name}: ${error.message}`, "error");
      }
    }
    saveState(instance); render(instance); status(instance, "Phân tích hoàn tất. BPM/tone là ước tính local, bạn có thể chỉnh metadata.", "success");
  }

  async function importAdaptive(instance, file) {
    if (!file) return;
    if (file.type === "application/json" || file.name.toLowerCase().endsWith(".json")) {
      try {
        const data = JSON.parse(await file.text());
        const cues = Array.isArray(data) ? data : data.cues;
        if (!Array.isArray(cues)) throw new Error("JSON không có mảng cues.");
        instance.state.adaptive.cues = sortCues(cues);
        if (Number(data.duration) > 0) instance.state.adaptive.duration = Number(data.duration);
        if (Number(data.targetDuration) > 0) instance.state.adaptive.targetDuration = Number(data.targetDuration);
        saveState(instance); render(instance); status(instance, `Đã nhập ${cues.length} cue từ storyboard JSON.`, "success");
      } catch (error) { status(instance, `Không đọc được storyboard: ${error.message}`, "error"); }
      return;
    }
    if (instance.mediaUrl) { globalScope.URL?.revokeObjectURL?.(instance.mediaUrl); instance.mediaUrl = ""; }
    instance.mediaUrl = globalScope.URL?.createObjectURL?.(file) || "";
    instance.state.adaptive.media = { name: file.name, type: file.type || "application/octet-stream", size: file.size || 0, availableThisSession: true, importedAt: new Date().toISOString() };
    saveState(instance); render(instance); status(instance, "Đã nhập media local; đang đọc metadata thời lượng.", "success");
  }

  function updateCue(instance, cueId, field, value) {
    const cue = instance.state.adaptive.cues.find((item) => item.id === cueId);
    if (!cue || !["start", "end", "type", "title", "emotion", "transition", "note"].includes(field)) return;
    if (field === "start") cue.start = clamp(value, 0, 86400, cue.start);
    else if (field === "end") cue.end = clamp(value, cue.start, 86400, cue.end);
    else if (field === "type") cue.type = CUE_TYPES.includes(value) ? value : cue.type;
    else cue[field] = String(value).slice(0, field === "note" ? 1200 : 160);
    instance.state.adaptive.cues = sortCues(instance.state.adaptive.cues);
    saveState(instance);
  }

  function updateSelectedSample(instance, field, input) {
    const sample = instance.state.samples.items.find((item) => item.id === instance.state.samples.selectedId);
    if (!sample) return;
    if (field === "tags") sample.tags = String(input.value || "").split(",").map((tag) => tag.trim()).filter(Boolean).slice(0, 30);
    else if (field === "license.commercialUse") sample.license.commercialUse = Boolean(input.checked);
    else if (field.startsWith("license.")) sample.license[field.split(".")[1]] = String(input.value || "").slice(0, 500);
    else if (["instrument", "mood"].includes(field)) sample[field] = String(input.value || "").slice(0, 120);
    saveState(instance);
  }

  function onInput(instance, event) {
    const cueField = event.target.dataset?.cueField;
    if (cueField) return updateCue(instance, event.target.closest("[data-cue-id]")?.dataset.cueId, cueField, event.target.value);
    const adaptiveField = event.target.dataset?.adaptiveField;
    if (adaptiveField) {
      instance.state.adaptive[adaptiveField] = adaptiveField === "preservePitch" ? Boolean(event.target.checked) : clamp(event.target.value, 0, 86400, 0);
      return saveState(instance);
    }
    const sampleField = event.target.dataset?.sampleField;
    if (sampleField) return updateSelectedSample(instance, sampleField, event.target);
    const setting = event.target.dataset?.sampleSetting;
    if (setting) {
      instance.state.samples[setting] = setting === "projectBpm" ? clamp(event.target.value, 20, 320, 96) : normalizeKey(event.target.value, instance.state.samples.projectKey);
      return saveState(instance);
    }
    if (event.target.matches?.("[data-mal-search]")) {
      instance.state.samples.query = event.target.value;
      const cursor = event.target.selectionStart;
      render(instance);
      const input = instance.root.querySelector("[data-mal-search]");
      input?.focus(); input?.setSelectionRange?.(cursor, cursor);
    }
  }

  function addCue(instance) {
    const player = instance.root.querySelector?.("[data-mal-media]");
    const start = Number(player?.currentTime) || Math.max(0, ...instance.state.adaptive.cues.map((cue) => cue.end));
    const duration = instance.state.adaptive.targetDuration || instance.state.adaptive.duration || start + 4;
    instance.state.adaptive.cues.push(normalizeCue({ start, end: Math.min(duration, start + 4), type: "scene", title: `Cảnh ${instance.state.adaptive.cues.length + 1}` }, instance.state.adaptive.cues.length));
    instance.state.adaptive.cues = sortCues(instance.state.adaptive.cues);
    saveState(instance); render(instance);
  }

  function previewSample(instance) {
    const sample = instance.state.samples.items.find((item) => item.id === instance.state.samples.selectedId);
    const url = sample ? instance.urls.get(sample.id) : "";
    if (!sample || !url || !globalScope.Audio) return status(instance, "Sample này không còn trong phiên. Hãy nhập lại tệp để nghe.", "error");
    stopAudio(instance);
    const plan = buildSyncPlan(sample, { bpm: instance.state.samples.projectBpm, key: instance.state.samples.projectKey });
    const audio = new globalScope.Audio(url);
    audio.playbackRate = plan.playbackRate;
    if ("preservesPitch" in audio) audio.preservesPitch = true;
    instance.audio = audio;
    audio.addEventListener("ended", () => { if (instance.audio === audio) instance.audio = null; }, { once: true });
    void audio.play().then(() => status(instance, `Đang nghe ${sample.name} ở ${plan.playbackRate}×; transpose chỉ là metadata.`, "success")).catch((error) => status(instance, `Không phát được audio: ${error.message}`, "error"));
  }

  function handleAction(instance, event) {
    const seek = event.target.closest?.("[data-mal-seek]");
    if (seek) { const player = instance.root.querySelector?.("[data-mal-media]"); if (player) player.currentTime = Number(seek.dataset.malSeek) || 0; return; }
    const selectId = event.target.closest?.("[data-mal-select-id]");
    if (selectId) { instance.state.samples.selectedId = selectId.dataset.malSelectId; saveState(instance); return render(instance); }
    const collectionButton = event.target.closest?.("[data-mal-collection]");
    if (collectionButton) { instance.state.samples.activeCollectionId = collectionButton.dataset.malCollection; saveState(instance); return render(instance); }
    const collectionToggle = event.target.closest?.("[data-mal-toggle-collection]");
    if (collectionToggle) {
      const sample = instance.state.samples.items.find((item) => item.id === instance.state.samples.selectedId);
      const collection = instance.state.samples.collections.find((item) => item.id === collectionToggle.dataset.malToggleCollection);
      if (sample && collection) {
        if (collectionToggle.checked && !collection.sampleIds.includes(sample.id)) collection.sampleIds.push(sample.id);
        if (!collectionToggle.checked) collection.sampleIds = collection.sampleIds.filter((id) => id !== sample.id);
        sample.collectionIds = instance.state.samples.collections.filter((item) => item.sampleIds.includes(sample.id)).map((item) => item.id);
        saveState(instance);
      }
      return;
    }
    const card = event.target.closest?.("[data-sample-id]");
    const actionButton = event.target.closest?.("[data-mal-action]");
    if (!actionButton) return;
    const action = actionButton.dataset.malAction;
    if (action === "add-cue") return addCue(instance);
    if (action === "remove-cue") { instance.state.adaptive.cues = instance.state.adaptive.cues.filter((cue) => cue.id !== actionButton.dataset.id); saveState(instance); return render(instance); }
    if (action === "retime") {
      const result = retimeCueSheet(instance.state.adaptive.cues, instance.state.adaptive.duration || instance.state.adaptive.targetDuration || 1, instance.state.adaptive.targetDuration || instance.state.adaptive.duration || 1);
      instance.state.adaptive.cues = result.cues; instance.state.adaptive.duration = result.targetDuration;
      saveState(instance); render(instance); return status(instance, `Đã retime ${result.cues.length} cue theo tỉ lệ ${result.ratio}×. Pitch chỉ được giữ trong metadata.`, "success");
    }
    if (action === "export-cue-json") return downloadText("hh-adaptive-cues.json", exportCueJson(instance.state.adaptive, readProjectContext()), "application/json");
    if (action === "export-cue-csv") return downloadText("hh-adaptive-cues.csv", exportCueCsv(instance.state.adaptive), "text/csv;charset=utf-8");
    if (action === "select-sample") { instance.state.samples.selectedId = card?.dataset.sampleId || ""; saveState(instance); return render(instance); }
    if (action === "favorite") { const sample = instance.state.samples.items.find((item) => item.id === card?.dataset.sampleId); if (sample) sample.favorite = !sample.favorite; saveState(instance); return render(instance); }
    if (action === "preview-sync") return previewSample(instance);
    if (action === "remove-sample") {
      const id = instance.state.samples.selectedId; stopAudio(instance); revokeUrl(instance, id); instance.files.delete(id);
      instance.state.samples.collections.forEach((collectionEntry) => { collectionEntry.sampleIds = collectionEntry.sampleIds.filter((sampleId) => sampleId !== id); });
      instance.state.samples.items = instance.state.samples.items.filter((item) => item.id !== id); instance.state.samples.selectedId = instance.state.samples.items[0]?.id || ""; saveState(instance); return render(instance);
    }
    if (action === "add-collection") {
      const input = instance.root.querySelector?.("[data-mal-new-collection]"); const name = String(input?.value || "").trim();
      if (!name) return status(instance, "Nhập tên bộ sưu tập.", "error");
      instance.state.samples.collections.push({ id: uid("collection"), name: name.slice(0, 80), sampleIds: [] }); saveState(instance); return render(instance);
    }
    if (action === "delete-collection") {
      const id = instance.state.samples.activeCollectionId;
      if (id === "all" || id === "favorites") return;
      instance.state.samples.collections = instance.state.samples.collections.filter((item) => item.id !== id);
      instance.state.samples.items.forEach((item) => { item.collectionIds = (item.collectionIds || []).filter((collectionId) => collectionId !== id); });
      instance.state.samples.activeCollectionId = "all";
      saveState(instance); return render(instance);
    }
  }

  function onChange(instance, event) {
    if (event.target.matches?.("[data-mal-adaptive-file]")) return void importAdaptive(instance, event.target.files?.[0]);
    if (event.target.matches?.("[data-mal-sample-file]")) return void importSamples(instance, event.target.files);
    onInput(instance, event);
  }

  function onDrop(instance, event) {
    const zone = event.target.closest?.("[data-mal-drop]");
    if (!zone) return;
    event.preventDefault();
    if (zone.dataset.malDrop === "adaptive") void importAdaptive(instance, event.dataTransfer?.files?.[0]);
    else void importSamples(instance, event.dataTransfer?.files);
  }

  function bind(instance) {
    const root = instance.root;
    const click = (event) => handleAction(instance, event);
    const input = (event) => onInput(instance, event);
    const change = (event) => onChange(instance, event);
    const dragover = (event) => { if (event.target.closest?.("[data-mal-drop]")) { event.preventDefault(); if (event.dataTransfer) event.dataTransfer.dropEffect = "copy"; } };
    const drop = (event) => onDrop(instance, event);
    const keydown = (event) => { const zone = event.target.closest?.("[data-mal-drop]"); if (zone && (event.key === "Enter" || event.key === " ")) { event.preventDefault(); root.querySelector(zone.dataset.malDrop === "adaptive" ? "[data-mal-adaptive-file]" : "[data-mal-sample-file]")?.click(); } };
    root.addEventListener("click", click); root.addEventListener("input", input); root.addEventListener("change", change); root.addEventListener("dragover", dragover); root.addEventListener("drop", drop); root.addEventListener("keydown", keydown);
    instance.handlers = { click, input, change, dragover, drop, keydown };
  }

  function supports(view) { return SUPPORTED.has(view); }

  function mount(root, options = {}) {
    if (!root || typeof root.addEventListener !== "function") throw new TypeError("HHMusicAdaptiveLibrary.mount cần một DOM host hợp lệ.");
    unmount(root);
    const view = supports(options.view) ? options.view : "adaptive-soundtrack";
    const context = readProjectContext();
    const state = normalizeState(loadLocalState(), context);
    const instance = { root, view, options, state, context, handlers: null, urls: new Map(), files: new Map(), contexts: new Set(), mediaUrl: "", audio: null, audioContext: null };
    instances.set(root, instance);
    bind(instance); render(instance);
    void idbRead().then((saved) => {
      if (!saved || !instances.has(root)) return;
      const currentTimestamp = Date.parse(instance.state.updatedAt || 0) || 0;
      const savedTimestamp = Date.parse(saved.updatedAt || 0) || 0;
      if (savedTimestamp > currentTimestamp) { instance.state = normalizeState(saved, readProjectContext()); render(instance); status(instance, "Đã khôi phục metadata từ IndexedDB.", "success"); }
    }).catch(() => {});
    return { view, getState: () => clone(instance.state), getProjectContext: () => clone(readProjectContext()), unmount: () => unmount(root) };
  }

  function unmount(root) {
    if (!root) {
      let removed = false;
      Array.from(instances.keys()).forEach((target) => { removed = unmount(target) || removed; });
      return removed;
    }
    const instance = instances.get(root);
    if (!instance) return false;
    stopAudio(instance);
    if (instance.mediaUrl) globalScope.URL?.revokeObjectURL?.(instance.mediaUrl);
    instance.urls.forEach((url) => globalScope.URL?.revokeObjectURL?.(url));
    instance.contexts.forEach((context) => { if (context?.state !== "closed") void context.close?.().catch?.(() => {}); });
    instance.contexts.clear(); instance.urls.clear(); instance.files.clear();
    if (instance.handlers) Object.entries(instance.handlers).forEach(([name, handler]) => root.removeEventListener(name, handler));
    root.classList?.remove("hh-music-adaptive-library");
    if (typeof root.replaceChildren === "function") root.replaceChildren(); else root.innerHTML = "";
    instances.delete(root);
    return true;
  }

  return Object.freeze({
    VERSION, STORAGE_KEY, supports, mount, unmount, readProjectContext, createDefaultState, normalizeState, normalizeCue, sortCues,
    retimeCueSheet, exportCueJson, exportCueCsv, estimateBpm, detectKey, analyzePcm, semanticSearch, rankSimilarSamples, buildSyncPlan
  });
});
