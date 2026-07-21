(function musicIntelligenceEngine(globalScope) {
  "use strict";

  const VERSION = 1;
  const STORAGE_KEY = "hh.music.intelligence-engine.v1";
  const SHARED_STORAGE_KEY = "hh.music.shared-project.v1";
  const PROJECT_EVENT = "hh:music-project-change";
  const VIEWS = Object.freeze(["musical-brain", "audio-midi"]);
  const ROOTS = Object.freeze(["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]);
  const QUALITIES = Object.freeze(["major", "minor", "dim", "sus2", "sus4", "7", "maj7", "min7"]);
  const QUALITY_LABELS = Object.freeze({ major: "Trưởng", minor: "Thứ", dim: "Giảm", sus2: "Sus2", sus4: "Sus4", 7: "Dominant 7", maj7: "Major 7", min7: "Minor 7" });
  const QUALITY_SUFFIX = Object.freeze({ major: "", minor: "m", dim: "dim", sus2: "sus2", sus4: "sus4", 7: "7", maj7: "maj7", min7: "m7" });
  const QUALITY_INTERVALS = Object.freeze({
    major: [0, 4, 7], minor: [0, 3, 7], dim: [0, 3, 6], sus2: [0, 2, 7],
    sus4: [0, 5, 7], 7: [0, 4, 7, 10], maj7: [0, 4, 7, 11], min7: [0, 3, 7, 10]
  });
  const MAJOR_PROFILE = Object.freeze([6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88]);
  const MINOR_PROFILE = Object.freeze([6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17]);
  const NOTE_NAMES = ROOTS;
  const DEFAULT_DNA = Object.freeze({
    version: 1,
    name: "DNA bài hát HH",
    motif: "Motif 4 nốt đi lên, kết ở chủ âm",
    instruments: ["Piano", "Bass", "Drums", "Strings"],
    timbre: "Ấm, rõ trung âm, không quá nén",
    style: "Pop điện ảnh nguyên bản",
    locked: false,
    updatedAt: ""
  });
  const DEFAULT_CHORDS = Object.freeze([
    { id: "chord-1", start: 0, duration: 2, root: "C", quality: "major", source: "manual", confidence: 1 },
    { id: "chord-2", start: 2, duration: 2, root: "A", quality: "minor", source: "manual", confidence: 1 },
    { id: "chord-3", start: 4, duration: 2, root: "F", quality: "major", source: "manual", confidence: 1 },
    { id: "chord-4", start: 6, duration: 2, root: "G", quality: "major", source: "manual", confidence: 1 }
  ]);
  const DEFAULT_STATE = Object.freeze({
    version: VERSION,
    view: "musical-brain",
    analysis: {
      fileName: "", duration: 0, bpm: 96, key: "C major", timeSignature: "4/4",
      bpmConfidence: 0, keyConfidence: 0, analyzedAt: "", structure: [], waveform: []
    },
    midi: { quantize: "1/16", notes: [], chords: [] },
    updatedAt: ""
  });

  let active = null;

  const clone = (value) => JSON.parse(JSON.stringify(value));
  const clamp = (value, min, max) => Math.min(max, Math.max(min, Number(value) || min));
  const round = (value, precision = 3) => Number(Number(value || 0).toFixed(precision));
  const cleanText = (value, max = 500) => String(value == null ? "" : value)
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .trim()
    .slice(0, max);
  const escapeHtml = (value) => String(value == null ? "" : value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[character]);
  const safeId = (value, fallback = "item") => cleanText(value, 80).toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "") || fallback;
  const uid = (prefix = "item") => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

  function chordLabel(chord) {
    const root = ROOTS.includes(chord?.root) ? chord.root : "C";
    const quality = QUALITIES.includes(chord?.quality) ? chord.quality : "major";
    return `${root}${QUALITY_SUFFIX[quality]}`;
  }

  function normalizeChord(chord, index = 0) {
    const root = ROOTS.includes(chord?.root) ? chord.root : "C";
    const quality = QUALITIES.includes(chord?.quality) ? chord.quality : "major";
    const normalized = {
      id: safeId(chord?.id, `chord-${index + 1}`),
      start: round(clamp(chord?.start, 0, 86400)),
      duration: round(clamp(chord?.duration || 1, 0.05, 3600)),
      root,
      quality,
      source: ["analysis", "manual", "suggestion"].includes(chord?.source) ? chord.source : "manual",
      confidence: round(clamp(chord?.confidence == null ? 1 : chord.confidence, 0, 1))
    };
    normalized.label = chordLabel(normalized);
    return normalized;
  }

  function normalizeChordTrack(track) {
    return (Array.isArray(track) ? track : []).slice(0, 512).map(normalizeChord)
      .sort((left, right) => left.start - right.start || left.id.localeCompare(right.id));
  }

  function normalizeSongDNA(input = {}) {
    const instruments = Array.isArray(input.instruments)
      ? input.instruments
      : String(input.instruments || "").split(",");
    return {
      version: 1,
      name: cleanText(input.name || DEFAULT_DNA.name, 100),
      motif: cleanText(input.motif || DEFAULT_DNA.motif, 500),
      instruments: [...new Set(instruments.map((item) => cleanText(item, 60)).filter(Boolean))].slice(0, 24),
      timbre: cleanText(input.timbre || DEFAULT_DNA.timbre, 500),
      style: cleanText(input.style || DEFAULT_DNA.style, 500),
      locked: Boolean(input.locked),
      updatedAt: cleanText(input.updatedAt, 40)
    };
  }

  function normalizeNote(note, index = 0) {
    return {
      id: safeId(note?.id, `note-${index + 1}`),
      start: round(clamp(note?.start, 0, 86400)),
      duration: round(clamp(note?.duration || 0.25, 0.02, 3600)),
      pitch: Math.round(clamp(note?.pitch == null ? 60 : note.pitch, 0, 127)),
      velocity: Math.round(clamp(note?.velocity == null ? 92 : note.velocity, 1, 127)),
      channel: Math.round(clamp(note?.channel == null ? 0 : note.channel, 0, 15)),
      source: ["analysis", "manual", "chord"].includes(note?.source) ? note.source : "manual"
    };
  }

  function normalizeStructure(item, index = 0) {
    const start = clamp(item?.start, 0, 86400);
    return {
      id: safeId(item?.id, `section-${index + 1}`),
      label: cleanText(item?.label || `Phần ${index + 1}`, 80),
      start: round(start),
      end: round(clamp(item?.end || start + 1, start + 0.05, 86400)),
      energy: Math.round(clamp(item?.energy || 0, 0, 100))
    };
  }

  function normalizeState(input = {}) {
    const analysis = input.analysis || {};
    return {
      version: VERSION,
      view: VIEWS.includes(input.view) ? input.view : DEFAULT_STATE.view,
      analysis: {
        fileName: cleanText(analysis.fileName, 240),
        duration: round(clamp(analysis.duration, 0, 86400)),
        bpm: round(clamp(analysis.bpm || 96, 30, 260), 1),
        key: /^([A-G]#?) (major|minor)$/.test(analysis.key || "") ? analysis.key : "C major",
        timeSignature: ["3/4", "4/4", "6/8", "7/8"].includes(analysis.timeSignature) ? analysis.timeSignature : "4/4",
        bpmConfidence: Math.round(clamp(analysis.bpmConfidence, 0, 100)),
        keyConfidence: Math.round(clamp(analysis.keyConfidence, 0, 100)),
        analyzedAt: cleanText(analysis.analyzedAt, 40),
        structure: (Array.isArray(analysis.structure) ? analysis.structure : []).slice(0, 24).map(normalizeStructure),
        waveform: (Array.isArray(analysis.waveform) ? analysis.waveform : []).slice(0, 160).map((value) => round(clamp(value, 0, 1)))
      },
      midi: {
        quantize: ["1/4", "1/8", "1/8T", "1/16", "1/32"].includes(input.midi?.quantize) ? input.midi.quantize : "1/16",
        notes: (Array.isArray(input.midi?.notes) ? input.midi.notes : []).slice(0, 5000).map(normalizeNote),
        chords: normalizeChordTrack(input.midi?.chords)
      },
      updatedAt: cleanText(input.updatedAt, 40)
    };
  }

  function safeStorage(scope = globalScope) {
    try { return scope.localStorage || null; } catch (_) { return null; }
  }

  function loadState(storage = safeStorage()) {
    try {
      const parsed = JSON.parse(storage?.getItem(STORAGE_KEY) || "null");
      return parsed?.version === VERSION ? normalizeState(parsed) : normalizeState(clone(DEFAULT_STATE));
    } catch (_) {
      return normalizeState(clone(DEFAULT_STATE));
    }
  }

  function saveState(state, storage = safeStorage()) {
    const normalized = normalizeState({ ...state, updatedAt: new Date().toISOString() });
    try { storage?.setItem(STORAGE_KEY, JSON.stringify(normalized)); } catch (_) {}
    return normalized;
  }

  function normalizeSharedProject(input = {}) {
    return {
      version: 1,
      chordTrack: normalizeChordTrack(Array.isArray(input.chordTrack) ? input.chordTrack : DEFAULT_CHORDS),
      songDNA: normalizeSongDNA(input.songDNA || DEFAULT_DNA),
      updatedAt: cleanText(input.updatedAt, 40)
    };
  }

  function loadSharedProject(storage = safeStorage()) {
    try {
      const parsed = JSON.parse(storage?.getItem(SHARED_STORAGE_KEY) || "null");
      return parsed?.version === 1 ? normalizeSharedProject(parsed) : normalizeSharedProject();
    } catch (_) {
      return normalizeSharedProject();
    }
  }

  function createProjectContext(storage = safeStorage(), eventTarget = globalScope) {
    let snapshot = loadSharedProject(storage);
    const subscribers = new Set();

    function getSnapshot() { return clone(snapshot); }
    function getChordTrack() { return clone(snapshot.chordTrack); }
    function getSongDNA() { return clone(snapshot.songDNA); }

    function notify(reason) {
      snapshot = normalizeSharedProject({ ...snapshot, updatedAt: new Date().toISOString() });
      try { storage?.setItem(SHARED_STORAGE_KEY, JSON.stringify(snapshot)); } catch (_) {}
      const detail = Object.freeze({ reason: cleanText(reason || "update", 80), snapshot: getSnapshot() });
      subscribers.forEach((callback) => {
        try { callback(detail.snapshot, detail); } catch (_) {}
      });
      if (typeof eventTarget?.dispatchEvent === "function" && typeof globalScope.CustomEvent === "function") {
        try { eventTarget.dispatchEvent(new globalScope.CustomEvent(PROJECT_EVENT, { detail })); } catch (_) {}
      }
      return getSnapshot();
    }

    function updateChordTrack(next, reason = "chord-track") {
      const candidate = typeof next === "function" ? next(getChordTrack()) : next;
      snapshot = { ...snapshot, chordTrack: normalizeChordTrack(candidate) };
      return notify(reason).chordTrack;
    }

    function updateSongDNA(next, reason = "song-dna") {
      const current = getSongDNA();
      const candidate = typeof next === "function" ? next(current) : { ...current, ...(next || {}) };
      snapshot = { ...snapshot, songDNA: normalizeSongDNA({ ...candidate, updatedAt: new Date().toISOString() }) };
      return notify(reason).songDNA;
    }

    function subscribe(callback) {
      if (typeof callback !== "function") return () => {};
      subscribers.add(callback);
      return () => subscribers.delete(callback);
    }

    function applyExternal(value) {
      snapshot = normalizeSharedProject(value);
      const copy = getSnapshot();
      subscribers.forEach((callback) => {
        try { callback(copy, { reason: "storage", snapshot: copy }); } catch (_) {}
      });
    }

    return Object.freeze({ getSnapshot, getChordTrack, getSongDNA, updateChordTrack, updateSongDNA, subscribe, applyExternal });
  }

  const projectContextInternal = createProjectContext();
  const projectContextApi = Object.freeze({
    getSnapshot: projectContextInternal.getSnapshot,
    getChordTrack: projectContextInternal.getChordTrack,
    getSongDNA: projectContextInternal.getSongDNA,
    updateChordTrack: projectContextInternal.updateChordTrack,
    updateSongDNA: projectContextInternal.updateSongDNA,
    subscribe: projectContextInternal.subscribe
  });

  if (typeof globalScope.addEventListener === "function") {
    globalScope.addEventListener("storage", (event) => {
      if (event.key !== SHARED_STORAGE_KEY || !event.newValue) return;
      try { projectContextInternal.applyExternal(JSON.parse(event.newValue)); } catch (_) {}
    });
  }

  function addChord(track, chord = {}) {
    const list = normalizeChordTrack(track);
    const last = list[list.length - 1];
    const next = normalizeChord({
      id: chord.id || uid("chord"),
      start: chord.start == null ? (last ? last.start + last.duration : 0) : chord.start,
      duration: chord.duration || last?.duration || 2,
      root: chord.root || "C",
      quality: chord.quality || "major",
      source: chord.source || "manual",
      confidence: chord.confidence == null ? 1 : chord.confidence
    }, list.length);
    return normalizeChordTrack([...list, next]);
  }

  function updateChord(track, id, patch = {}) {
    return normalizeChordTrack(track).map((chord, index) => chord.id === id ? normalizeChord({ ...chord, ...patch, id }, index) : chord);
  }

  function deleteChord(track, id) {
    return normalizeChordTrack(track).filter((chord) => chord.id !== id);
  }

  function transposeChordTrack(track, semitones) {
    const shift = Math.round(clamp(semitones, -48, 48));
    return normalizeChordTrack(track).map((chord) => ({
      ...chord,
      root: ROOTS[(ROOTS.indexOf(chord.root) + shift + 120) % 12],
      label: chordLabel({ ...chord, root: ROOTS[(ROOTS.indexOf(chord.root) + shift + 120) % 12] })
    }));
  }

  function parseKey(key) {
    const match = /^([A-G]#?) (major|minor)$/.exec(key || "");
    return match ? { root: match[1], mode: match[2] } : { root: "C", mode: "major" };
  }

  function suggestNextChords(track, key = "C major") {
    const parsed = parseKey(key);
    const tonic = ROOTS.indexOf(parsed.root);
    const scale = parsed.mode === "minor" ? [0, 2, 3, 5, 7, 8, 10] : [0, 2, 4, 5, 7, 9, 11];
    const qualities = parsed.mode === "minor"
      ? ["minor", "dim", "major", "minor", "minor", "major", "major"]
      : ["major", "minor", "minor", "major", "major", "minor", "dim"];
    const list = normalizeChordTrack(track);
    const lastRoot = list.length ? ROOTS.indexOf(list[list.length - 1].root) : tonic;
    const lastDegree = scale.findIndex((offset) => (tonic + offset) % 12 === lastRoot);
    const transitions = {
      0: [3, 4, 5, 1], 1: [4, 6, 3, 0], 2: [5, 3, 4, 0], 3: [4, 0, 1, 5],
      4: [0, 5, 3, 2], 5: [3, 1, 4, 0], 6: [0, 2, 4, 5]
    };
    return (transitions[lastDegree] || [3, 4, 5, 0]).map((degree, index) => {
      const chord = normalizeChord({
        id: `suggestion-${degree}`,
        root: ROOTS[(tonic + scale[degree]) % 12],
        quality: qualities[degree],
        source: "suggestion",
        confidence: 0.9 - index * 0.08
      });
      return { ...chord, degree: degree + 1, reason: degree === 0 ? "Trở về chủ âm" : degree === 4 ? "Tạo lực hút về chủ âm" : "Giữ hòa âm trong giọng" };
    });
  }

  function downmixAudioBuffer(audioBuffer) {
    const channels = Math.max(1, Number(audioBuffer?.numberOfChannels) || 1);
    const length = Math.max(0, Number(audioBuffer?.length) || 0);
    const output = new Float32Array(length);
    for (let channel = 0; channel < channels; channel += 1) {
      const data = audioBuffer.getChannelData(channel);
      for (let index = 0; index < length; index += 1) output[index] += (Number(data[index]) || 0) / channels;
    }
    return output;
  }

  function resampleLinear(samples, sampleRate, targetRate = 11025) {
    if (!(samples instanceof Float32Array) || !samples.length) return new Float32Array();
    if (sampleRate <= targetRate + 1) return samples.slice();
    const ratio = sampleRate / targetRate;
    const result = new Float32Array(Math.max(1, Math.floor(samples.length / ratio)));
    for (let index = 0; index < result.length; index += 1) {
      const position = index * ratio;
      const left = Math.floor(position);
      const mix = position - left;
      result[index] = samples[left] * (1 - mix) + (samples[Math.min(left + 1, samples.length - 1)] || 0) * mix;
    }
    return result;
  }

  function computeWaveform(samples, points = 120) {
    const output = [];
    const bucket = Math.max(1, Math.floor(samples.length / points));
    for (let point = 0; point < points; point += 1) {
      const start = point * bucket;
      const end = Math.min(samples.length, start + bucket);
      let peak = 0;
      for (let index = start; index < end; index += Math.max(1, Math.floor(bucket / 256))) peak = Math.max(peak, Math.abs(samples[index] || 0));
      output.push(round(clamp(peak, 0, 1)));
    }
    return output;
  }

  function estimateBPM(samples, sampleRate) {
    if (!samples?.length || sampleRate <= 0) return { bpm: 96, confidence: 0 };
    const hop = Math.max(256, Math.round(sampleRate * 0.04644));
    const energies = [];
    for (let start = 0; start + hop <= samples.length; start += hop) {
      let sum = 0;
      const step = Math.max(1, Math.floor(hop / 256));
      for (let index = start; index < start + hop; index += step) sum += Math.abs(samples[index] || 0);
      energies.push(sum / Math.ceil(hop / step));
    }
    if (energies.length < 16) return { bpm: 96, confidence: 0 };
    const envelope = energies.map((value, index) => Math.max(0, value - (energies[index - 1] || value)));
    const frameRate = sampleRate / hop;
    let best = { bpm: 96, score: -Infinity };
    const scores = [];
    for (let bpm = 60; bpm <= 200; bpm += 1) {
      const lag = Math.max(1, Math.round((frameRate * 60) / bpm));
      let score = 0;
      let normA = 0;
      let normB = 0;
      for (let index = lag; index < envelope.length; index += 1) {
        score += envelope[index] * envelope[index - lag];
        normA += envelope[index] ** 2;
        normB += envelope[index - lag] ** 2;
      }
      score = score / Math.sqrt(normA * normB || 1);
      scores.push(score);
      if (score > best.score) best = { bpm, score };
    }
    let bpm = best.bpm;
    while (bpm < 75) bpm *= 2;
    while (bpm > 180) bpm /= 2;
    const average = scores.reduce((sum, value) => sum + value, 0) / scores.length;
    return { bpm: round(bpm, 1), confidence: Math.round(clamp((best.score - average) * 170, 0, 100)) };
  }

  function goertzelMagnitude(samples, sampleRate, start, length, frequency) {
    const omega = (2 * Math.PI * frequency) / sampleRate;
    const coefficient = 2 * Math.cos(omega);
    let previous = 0;
    let previous2 = 0;
    const end = Math.min(samples.length, start + length);
    for (let index = start; index < end; index += 1) {
      const phase = (index - start) / Math.max(1, length - 1);
      const windowed = (samples[index] || 0) * (0.5 - 0.5 * Math.cos(2 * Math.PI * phase));
      const current = windowed + coefficient * previous - previous2;
      previous2 = previous;
      previous = current;
    }
    return Math.max(0, previous2 ** 2 + previous ** 2 - coefficient * previous * previous2);
  }

  function computeChroma(samples, sampleRate, start = 0, length = 4096) {
    const chroma = Array(12).fill(0);
    if (!samples?.length || sampleRate <= 0) return chroma;
    for (let midi = 36; midi <= 95; midi += 1) {
      const frequency = 440 * (2 ** ((midi - 69) / 12));
      if (frequency >= sampleRate / 2) continue;
      chroma[midi % 12] += Math.sqrt(goertzelMagnitude(samples, sampleRate, start, length, frequency)) / (1 + Math.abs(midi - 60) * 0.015);
    }
    const total = chroma.reduce((sum, value) => sum + value, 0) || 1;
    return chroma.map((value) => value / total);
  }

  function scoreKey(chroma) {
    let best = { key: "C major", score: -Infinity };
    const scores = [];
    for (let tonic = 0; tonic < 12; tonic += 1) {
      for (const [mode, profile] of [["major", MAJOR_PROFILE], ["minor", MINOR_PROFILE]]) {
        let score = 0;
        for (let pitch = 0; pitch < 12; pitch += 1) score += chroma[(pitch + tonic) % 12] * profile[pitch];
        scores.push(score);
        if (score > best.score) best = { key: `${ROOTS[tonic]} ${mode}`, score };
      }
    }
    const sorted = scores.sort((a, b) => b - a);
    const confidence = Math.round(clamp(((sorted[0] - sorted[1]) / Math.max(0.001, sorted[0])) * 400, 0, 100));
    return { key: best.key, confidence };
  }

  function detectChordFromChroma(chroma) {
    let best = { root: "C", quality: "major", score: -Infinity };
    for (let root = 0; root < 12; root += 1) {
      for (const quality of ["major", "minor", "dim", "sus2", "sus4"] ) {
        const intervals = QUALITY_INTERVALS[quality];
        const chordTones = new Set(intervals.map((interval) => (root + interval) % 12));
        let score = 0;
        for (let pitch = 0; pitch < 12; pitch += 1) score += chroma[pitch] * (chordTones.has(pitch) ? (pitch === root ? 1.35 : 1) : -0.22);
        if (score > best.score) best = { root: ROOTS[root], quality, score };
      }
    }
    return best;
  }

  function estimateKeyAndChords(samples, sampleRate, duration) {
    const frameLength = Math.min(4096, samples.length);
    const segments = Math.max(1, Math.min(32, Math.ceil(duration / 2)));
    const aggregate = Array(12).fill(0);
    const raw = [];
    for (let segment = 0; segment < segments; segment += 1) {
      const start = Math.max(0, Math.min(samples.length - frameLength, Math.floor(((segment + 0.5) / segments) * samples.length - frameLength / 2)));
      const chroma = computeChroma(samples, sampleRate, start, frameLength);
      chroma.forEach((value, index) => { aggregate[index] += value; });
      const detected = detectChordFromChroma(chroma);
      raw.push(normalizeChord({
        id: `analysis-${segment + 1}`,
        start: (duration * segment) / segments,
        duration: duration / segments,
        root: detected.root,
        quality: detected.quality,
        source: "analysis",
        confidence: clamp(detected.score * 1.7, 0, 1)
      }, segment));
    }
    const merged = [];
    raw.forEach((chord) => {
      const previous = merged[merged.length - 1];
      if (previous && previous.root === chord.root && previous.quality === chord.quality) {
        previous.duration = round(chord.start + chord.duration - previous.start);
        previous.confidence = round((previous.confidence + chord.confidence) / 2);
      } else merged.push({ ...chord });
    });
    return { ...scoreKey(aggregate), chords: merged };
  }

  function estimateStructure(samples, sampleRate, duration) {
    if (duration <= 0) return [];
    const labels = duration < 30 ? ["Mở đầu", "Phần chính", "Kết"] : ["Mở đầu", "Đoạn A", "Điệp khúc", "Chuyển đoạn", "Kết"];
    const weights = labels.length === 3 ? [0, 0.2, 0.82, 1] : [0, 0.1, 0.4, 0.7, 0.9, 1];
    return labels.map((label, index) => {
      const start = duration * weights[index];
      const end = duration * weights[index + 1];
      const sampleStart = Math.floor(start * sampleRate);
      const sampleEnd = Math.min(samples.length, Math.floor(end * sampleRate));
      let sum = 0;
      let count = 0;
      const step = Math.max(1, Math.floor((sampleEnd - sampleStart) / 1000));
      for (let cursor = sampleStart; cursor < sampleEnd; cursor += step) { sum += Math.abs(samples[cursor] || 0); count += 1; }
      return normalizeStructure({ id: `section-${index + 1}`, label, start, end, energy: clamp((sum / Math.max(1, count)) * 260, 0, 100) }, index);
    });
  }

  function analyzePCM(samples, sampleRate) {
    if (!(samples instanceof Float32Array) || !samples.length || !(sampleRate > 0)) throw new TypeError("PCM hoặc sample rate không hợp lệ.");
    const duration = samples.length / sampleRate;
    const bpm = estimateBPM(samples, sampleRate);
    const spectralRate = Math.min(11025, sampleRate);
    const spectral = resampleLinear(samples, sampleRate, spectralRate);
    const harmony = estimateKeyAndChords(spectral, spectralRate, duration);
    return {
      duration: round(duration),
      bpm: bpm.bpm,
      bpmConfidence: bpm.confidence,
      key: harmony.key,
      keyConfidence: harmony.confidence,
      timeSignature: "4/4",
      chords: harmony.chords,
      structure: estimateStructure(samples, sampleRate, duration),
      waveform: computeWaveform(samples)
    };
  }

  function detectPitch(frame, sampleRate) {
    if (!frame?.length || sampleRate <= 0) return null;
    let rms = 0;
    for (let index = 0; index < frame.length; index += 1) rms += frame[index] ** 2;
    rms = Math.sqrt(rms / frame.length);
    if (rms < 0.012) return null;
    const minLag = Math.max(2, Math.floor(sampleRate / 1200));
    const maxLag = Math.min(Math.floor(sampleRate / 55), Math.floor(frame.length / 2));
    let bestLag = 0;
    let bestCorrelation = 0;
    const correlations = [];
    for (let lag = minLag; lag <= maxLag; lag += 1) {
      let sum = 0;
      let normA = 0;
      let normB = 0;
      for (let index = 0; index < frame.length - lag; index += 2) {
        const a = frame[index];
        const b = frame[index + lag];
        sum += a * b;
        normA += a * a;
        normB += b * b;
      }
      const correlation = sum / Math.sqrt(normA * normB || 1);
      correlations[lag] = correlation;
      if (correlation > bestCorrelation) { bestCorrelation = correlation; bestLag = lag; }
    }
    const strongThreshold = Math.max(0.58, bestCorrelation * 0.97);
    for (let lag = minLag + 1; lag < maxLag; lag += 1) {
      const current = correlations[lag] || 0;
      if (current >= strongThreshold && current >= (correlations[lag - 1] || 0) && current >= (correlations[lag + 1] || 0)) {
        bestLag = lag;
        bestCorrelation = current;
        break;
      }
    }
    if (!bestLag || bestCorrelation < 0.58) return null;
    const frequency = sampleRate / bestLag;
    const midi = Math.round(69 + 12 * Math.log2(frequency / 440));
    if (midi < 0 || midi > 127) return null;
    return { midi, frequency: round(frequency, 2), confidence: round(bestCorrelation), velocity: Math.round(clamp(rms * 460, 24, 127)) };
  }

  function detectNoteEvents(samples, sampleRate, maxEvents = 2000) {
    const targetRate = Math.min(8000, sampleRate);
    const data = resampleLinear(samples, sampleRate, targetRate);
    const frameSize = 1024;
    const naturalHop = 512;
    const availableFrames = Math.max(0, Math.floor((data.length - frameSize) / naturalHop));
    const stride = Math.max(1, Math.ceil(availableFrames / 720));
    const hop = naturalHop * stride;
    const notes = [];
    for (let start = 0; start + frameSize <= data.length && notes.length < maxEvents; start += hop) {
      const pitch = detectPitch(data.subarray(start, start + frameSize), targetRate);
      const time = start / targetRate;
      const frameDuration = hop / targetRate;
      const previous = notes[notes.length - 1];
      if (pitch && previous && Math.abs(previous.pitch - pitch.midi) <= 0 && time <= previous.start + previous.duration + frameDuration * 0.6) {
        previous.duration = round(time + frameDuration - previous.start);
        previous.velocity = Math.round((previous.velocity + pitch.velocity) / 2);
      } else if (pitch) {
        notes.push(normalizeNote({ id: `detected-${notes.length + 1}`, start: time, duration: frameDuration, pitch: pitch.midi, velocity: pitch.velocity, source: "analysis" }, notes.length));
      }
    }
    return notes.filter((note) => note.duration >= 0.04);
  }

  function quantizeStepSeconds(division, bpm) {
    const beat = 60 / clamp(bpm || 120, 30, 260);
    return ({ "1/4": beat, "1/8": beat / 2, "1/8T": beat / 3, "1/16": beat / 4, "1/32": beat / 8 })[division] || beat / 4;
  }

  function quantizeNoteEvents(notes, bpm, division = "1/16") {
    const step = quantizeStepSeconds(division, bpm);
    return (Array.isArray(notes) ? notes : []).map((note, index) => normalizeNote({
      ...note,
      start: Math.round((Number(note.start) || 0) / step) * step,
      duration: Math.max(step, Math.round((Number(note.duration) || step) / step) * step)
    }, index));
  }

  function noteName(midi) {
    const value = Math.round(clamp(midi, 0, 127));
    return `${NOTE_NAMES[value % 12]}${Math.floor(value / 12) - 1}`;
  }

  function chordMidiNotes(chord, octave = 4) {
    const root = ROOTS.indexOf(chord?.root);
    const intervals = QUALITY_INTERVALS[chord?.quality] || QUALITY_INTERVALS.major;
    const base = (octave + 1) * 12 + Math.max(0, root);
    return intervals.map((interval) => Math.min(127, base + interval));
  }

  function utf8Bytes(text) {
    if (typeof TextEncoder !== "undefined") return [...new TextEncoder().encode(String(text))];
    return [...unescape(encodeURIComponent(String(text)))].map((character) => character.charCodeAt(0));
  }

  function variableLength(value) {
    let buffer = Math.max(0, Math.round(value)) & 0x7f;
    const output = [];
    while ((value >>= 7)) { buffer <<= 8; buffer |= ((value & 0x7f) | 0x80); }
    while (true) {
      output.push(buffer & 0xff);
      if (buffer & 0x80) buffer >>= 8; else break;
    }
    return output;
  }

  function uint32(value) { return [(value >>> 24) & 255, (value >>> 16) & 255, (value >>> 8) & 255, value & 255]; }
  function uint16(value) { return [(value >>> 8) & 255, value & 255]; }
  function ascii(text) { return [...text].map((character) => character.charCodeAt(0)); }

  function createMidiSMF({ notes = [], chords = [], bpm = 120, timeSignature = "4/4", title = "HH Audio to MIDI", ppq = 480 } = {}) {
    const safeBpm = clamp(bpm, 30, 260);
    const secondsToTick = (seconds) => Math.max(0, Math.round((Number(seconds) || 0) * (safeBpm / 60) * ppq));
    const events = [];
    const tempo = Math.round(60000000 / safeBpm);
    const titleBytes = utf8Bytes(cleanText(title, 120));
    events.push({ tick: 0, order: 0, bytes: [0xff, 0x03, ...variableLength(titleBytes.length), ...titleBytes] });
    events.push({ tick: 0, order: 1, bytes: [0xff, 0x51, 0x03, (tempo >>> 16) & 255, (tempo >>> 8) & 255, tempo & 255] });
    const numerator = Number(String(timeSignature).split("/")[0]) || 4;
    const denominator = Number(String(timeSignature).split("/")[1]) || 4;
    events.push({ tick: 0, order: 2, bytes: [0xff, 0x58, 0x04, numerator, Math.round(Math.log2(denominator)), 24, 8] });
    normalizeChordTrack(chords).forEach((chord) => {
      const start = secondsToTick(chord.start);
      const end = Math.max(start + 1, secondsToTick(chord.start + chord.duration));
      const marker = utf8Bytes(chordLabel(chord));
      events.push({ tick: start, order: 3, bytes: [0xff, 0x06, ...variableLength(marker.length), ...marker] });
      chordMidiNotes(chord, 3).forEach((pitch) => {
        events.push({ tick: start, order: 5, bytes: [0x91, pitch, 68] });
        events.push({ tick: end, order: 4, bytes: [0x81, pitch, 0] });
      });
    });
    (Array.isArray(notes) ? notes : []).map(normalizeNote).forEach((note) => {
      const start = secondsToTick(note.start);
      const end = Math.max(start + 1, secondsToTick(note.start + note.duration));
      events.push({ tick: start, order: 5, bytes: [0x90 | note.channel, note.pitch, note.velocity] });
      events.push({ tick: end, order: 4, bytes: [0x80 | note.channel, note.pitch, 0] });
    });
    events.sort((left, right) => left.tick - right.tick || left.order - right.order);
    const track = [];
    let previousTick = 0;
    events.forEach((event) => {
      track.push(...variableLength(event.tick - previousTick), ...event.bytes);
      previousTick = event.tick;
    });
    track.push(0x00, 0xff, 0x2f, 0x00);
    return new Uint8Array([
      ...ascii("MThd"), ...uint32(6), ...uint16(0), ...uint16(1), ...uint16(ppq),
      ...ascii("MTrk"), ...uint32(track.length), ...track
    ]);
  }

  function supports(view) { return VIEWS.includes(view); }

  function sharedSnapshot() {
    return projectContextApi.getSnapshot();
  }

  function analysisMarkup(instance) {
    const analysis = instance.state.analysis;
    const hasAudio = Boolean(instance.audioBuffer || analysis.fileName);
    return `
      <section class="mie-import" data-mie-drop aria-label="Nhập audio để phân tích">
        <input class="mie-sr-only" id="mie-audio-input" type="file" accept="audio/*,.wav,.mp3,.m4a,.aac,.ogg,.flac,.webm" data-mie-audio-input>
        <label for="mie-audio-input"><span aria-hidden="true">＋</span><strong>${hasAudio ? escapeHtml(analysis.fileName || "Audio trong phiên") : "Chọn hoặc thả tệp audio"}</strong><small>Phân tích deterministic bằng Web Audio trên thiết bị. Không tải audio lên máy chủ.</small></label>
        ${instance.audioUrl ? `<audio controls preload="metadata" src="${escapeHtml(instance.audioUrl)}" aria-label="Nghe tệp đang phân tích"></audio>` : ""}
      </section>
      <canvas class="mie-waveform" width="1000" height="150" data-mie-waveform aria-label="Waveform của tệp audio"></canvas>
      <div class="mie-analysis-cards" aria-label="Kết quả phân tích">
        <article><small>Tempo ước lượng</small><strong>${analysis.bpm} BPM</strong><span>${analysis.bpmConfidence}% tin cậy</span></article>
        <article><small>Giọng ước lượng</small><strong>${escapeHtml(analysis.key)}</strong><span>${analysis.keyConfidence}% tin cậy</span></article>
        <article><small>Nhịp</small><strong>${escapeHtml(analysis.timeSignature)}</strong><span>Có thể sửa thủ công</span></article>
        <article><small>Thời lượng</small><strong>${formatTime(analysis.duration)}</strong><span>${analysis.structure.length} phần</span></article>
      </div>`;
  }

  function chordOptions(selected) {
    return ROOTS.map((root) => `<option value="${root}"${root === selected ? " selected" : ""}>${root}</option>`).join("");
  }

  function qualityOptions(selected) {
    return QUALITIES.map((quality) => `<option value="${quality}"${quality === selected ? " selected" : ""}>${escapeHtml(QUALITY_LABELS[quality])}</option>`).join("");
  }

  function musicalBrainMarkup(instance) {
    const shared = sharedSnapshot();
    const dna = shared.songDNA;
    const suggestions = suggestNextChords(shared.chordTrack, instance.state.analysis.key);
    return `
      <div class="mie-brain-layout">
        <main class="mie-main-column">
          ${analysisMarkup(instance)}
          <section class="mie-panel" aria-labelledby="mie-chord-title">
            <div class="mie-panel-head"><div><p>HARMONY MAP</p><h2 id="mie-chord-title">Chord Track dùng chung</h2></div><div class="mie-toolbar"><button type="button" data-mie-action="transpose-down" aria-label="Hạ toàn bộ hợp âm một bán cung">-1</button><button type="button" data-mie-action="transpose-up" aria-label="Nâng toàn bộ hợp âm một bán cung">+1</button><button class="is-primary" type="button" data-mie-action="add-chord">Thêm hợp âm</button></div></div>
            <div class="mie-chord-track" role="list" aria-label="Danh sách hợp âm">
              ${shared.chordTrack.length ? shared.chordTrack.map((chord) => `
                <article role="listitem" data-mie-chord-id="${escapeHtml(chord.id)}">
                  <span class="mie-chord-name">${escapeHtml(chord.label)}</span>
                  <label>Nốt gốc<select data-mie-chord-field="root">${chordOptions(chord.root)}</select></label>
                  <label>Loại<select data-mie-chord-field="quality">${qualityOptions(chord.quality)}</select></label>
                  <label>Bắt đầu<input type="number" min="0" step="0.1" value="${chord.start}" data-mie-chord-field="start"></label>
                  <label>Độ dài<input type="number" min="0.05" step="0.1" value="${chord.duration}" data-mie-chord-field="duration"></label>
                  <button type="button" data-mie-action="delete-chord" aria-label="Xóa hợp âm ${escapeHtml(chord.label)}">Xóa</button>
                </article>`).join("") : `<p class="mie-empty">Chord Track đang trống. Hãy thêm hợp âm hoặc phân tích audio.</p>`}
            </div>
            <div class="mie-suggestions" aria-label="Gợi ý hợp âm tiếp theo">
              <strong>Gợi ý theo ${escapeHtml(instance.state.analysis.key)}</strong>
              ${suggestions.map((chord) => `<button type="button" data-mie-suggest-root="${chord.root}" data-mie-suggest-quality="${chord.quality}" title="${escapeHtml(chord.reason)}">${escapeHtml(chord.label)}<small>${escapeHtml(chord.reason)}</small></button>`).join("")}
            </div>
          </section>
          <section class="mie-panel" aria-labelledby="mie-structure-title">
            <div class="mie-panel-head"><div><p>LOCAL STRUCTURE</p><h2 id="mie-structure-title">Cấu trúc ước lượng</h2></div><small>Heuristic cục bộ, có thể hiệu chỉnh trong DAW</small></div>
            <div class="mie-structure">
              ${instance.state.analysis.structure.length ? instance.state.analysis.structure.map((section) => `<article style="--energy:${section.energy}%"><strong>${escapeHtml(section.label)}</strong><span>${formatTime(section.start)} - ${formatTime(section.end)}</span><i aria-label="Năng lượng ${section.energy}%"></i></article>`).join("") : `<p class="mie-empty">Nhập audio để tạo bản đồ cấu trúc.</p>`}
            </div>
          </section>
        </main>
        <aside class="mie-dna mie-panel" aria-labelledby="mie-dna-title">
          <div class="mie-panel-head"><div><p>SONG IDENTITY</p><h2 id="mie-dna-title">Song DNA</h2></div><button type="button" data-mie-action="toggle-dna-lock" aria-pressed="${dna.locked}">${dna.locked ? "Mở khóa" : "Khóa DNA"}</button></div>
          <p class="mie-hint">Bộ quy tắc này được chia sẻ cho các workspace âm nhạc. Đây là dữ liệu do bạn kiểm soát, không phải AI cloud.</p>
          <label>Tên DNA<input value="${escapeHtml(dna.name)}" maxlength="100" data-mie-dna-field="name" ${dna.locked ? "disabled" : ""}></label>
          <label>Motif<textarea rows="4" maxlength="500" data-mie-dna-field="motif" ${dna.locked ? "disabled" : ""}>${escapeHtml(dna.motif)}</textarea></label>
          <label>Nhạc cụ, cách nhau bằng dấu phẩy<input value="${escapeHtml(dna.instruments.join(", "))}" maxlength="500" data-mie-dna-field="instruments" ${dna.locked ? "disabled" : ""}></label>
          <label>Âm sắc<textarea rows="3" maxlength="500" data-mie-dna-field="timbre" ${dna.locked ? "disabled" : ""}>${escapeHtml(dna.timbre)}</textarea></label>
          <label>Phong cách<textarea rows="3" maxlength="500" data-mie-dna-field="style" ${dna.locked ? "disabled" : ""}>${escapeHtml(dna.style)}</textarea></label>
          <button class="mie-save-dna" type="button" data-mie-action="save-dna" ${dna.locked ? "disabled" : ""}>Lưu Song DNA dùng chung</button>
          <div class="mie-dna-status"><span>${dna.locked ? "Đã khóa để giữ nhất quán" : "Cho phép chỉnh sửa"}</span><small>Version ${dna.version}</small></div>
        </aside>
      </div>`;
  }

  function pianoRollMarkup(notes, duration) {
    const visible = notes.slice(0, 400);
    const maxTime = Math.max(duration || 0, ...visible.map((note) => note.start + note.duration), 8);
    const minPitch = Math.max(0, Math.min(...visible.map((note) => note.pitch), 48) - 2);
    const maxPitch = Math.min(127, Math.max(...visible.map((note) => note.pitch), 72) + 2);
    return `<div class="mie-piano-roll" style="--rows:${maxPitch - minPitch + 1}" role="img" aria-label="Piano roll gồm ${notes.length} nốt">
      ${visible.map((note) => {
        const left = clamp((note.start / maxTime) * 100, 0, 100);
        const width = clamp((note.duration / maxTime) * 100, 0.2, 100 - left);
        const row = maxPitch - note.pitch + 1;
        return `<button type="button" data-mie-select-note="${escapeHtml(note.id)}" style="--left:${round(left)}%;--width:${round(width)}%;--row:${row}" aria-label="${noteName(note.pitch)}, ${round(note.start)} giây">${noteName(note.pitch)}</button>`;
      }).join("")}
    </div>`;
  }

  function audioMidiMarkup(instance) {
    const notes = instance.state.midi.notes;
    const chords = sharedSnapshot().chordTrack;
    return `
      <div class="mie-midi-layout">
        <main class="mie-main-column">
          ${analysisMarkup(instance)}
          <section class="mie-panel mie-roll-panel" aria-labelledby="mie-roll-title">
            <div class="mie-panel-head"><div><p>LOCAL TRANSCRIPTION</p><h2 id="mie-roll-title">Audio-to-MIDI Editor</h2></div><div class="mie-toolbar"><label>Grid<select data-mie-quantize>${["1/4", "1/8", "1/8T", "1/16", "1/32"].map((value) => `<option${value === instance.state.midi.quantize ? " selected" : ""}>${value}</option>`).join("")}</select></label><button type="button" data-mie-action="quantize">Quantize</button><button class="is-primary" type="button" data-mie-action="export-midi">Xuất MIDI</button></div></div>
            ${pianoRollMarkup(notes, instance.state.analysis.duration)}
            <p class="mie-hint">Nhận diện cao độ là phép ước lượng monophonic cục bộ. Bản phối nhiều nhạc cụ cần chỉnh thủ công sau khi chuyển đổi.</p>
          </section>
          <section class="mie-panel" aria-labelledby="mie-note-table-title">
            <div class="mie-panel-head"><div><p>EVENT LIST</p><h2 id="mie-note-table-title">Sự kiện nốt</h2></div><button type="button" data-mie-action="add-note">Thêm nốt</button></div>
            <div class="mie-table-wrap"><table><thead><tr><th>Nốt</th><th>Bắt đầu</th><th>Độ dài</th><th>Velocity</th><th></th></tr></thead><tbody>
              ${notes.length ? notes.slice(0, 500).map((note) => `<tr data-mie-note-id="${escapeHtml(note.id)}"><td><label class="mie-sr-only">Cao độ MIDI</label><input type="number" min="0" max="127" value="${note.pitch}" data-mie-note-field="pitch"><small>${noteName(note.pitch)}</small></td><td><input type="number" min="0" step="0.01" value="${note.start}" data-mie-note-field="start"></td><td><input type="number" min="0.02" step="0.01" value="${note.duration}" data-mie-note-field="duration"></td><td><input type="number" min="1" max="127" value="${note.velocity}" data-mie-note-field="velocity"></td><td><button type="button" data-mie-action="delete-note" aria-label="Xóa ${noteName(note.pitch)}">Xóa</button></td></tr>`).join("") : `<tr><td colspan="5" class="mie-empty">Chưa có nốt. Nhập audio hoặc thêm nốt thủ công.</td></tr>`}
            </tbody></table></div>
          </section>
        </main>
        <aside class="mie-panel mie-midi-inspector" aria-labelledby="mie-export-title">
          <div class="mie-panel-head"><div><p>MIDI SMF</p><h2 id="mie-export-title">Bàn giao MIDI</h2></div><span class="mie-local-badge">LOCAL</span></div>
          <dl><div><dt>Sự kiện nốt</dt><dd>${notes.length}</dd></div><div><dt>Chord marker</dt><dd>${chords.length}</dd></div><div><dt>Tempo</dt><dd>${instance.state.analysis.bpm} BPM</dd></div><div><dt>Định dạng</dt><dd>SMF Type 0</dd></div></dl>
          <label>Tên tệp<input value="${escapeHtml(baseFileName(instance.state.analysis.fileName) || "hh-audio-to-midi")}" maxlength="80" data-mie-export-name></label>
          <button class="mie-export-button" type="button" data-mie-action="export-midi">Tạo và tải tệp .mid</button>
          <p class="mie-hint">Tệp MIDI chứa tempo, time signature, marker hợp âm và các nốt đã chỉnh. Không chứa audio gốc.</p>
          <section class="mie-chord-export">
            <div><h3>Chord event</h3><button type="button" data-mie-action="add-chord">Thêm</button></div>
            ${chords.map((chord) => `<article data-mie-chord-id="${escapeHtml(chord.id)}"><strong>${escapeHtml(chord.label)}</strong><label>Nốt gốc<select data-mie-chord-field="root">${chordOptions(chord.root)}</select></label><label>Loại<select data-mie-chord-field="quality">${qualityOptions(chord.quality)}</select></label><label>Bắt đầu<input type="number" min="0" step="0.1" value="${chord.start}" data-mie-chord-field="start"></label><label>Độ dài<input type="number" min="0.05" step="0.1" value="${chord.duration}" data-mie-chord-field="duration"></label><button type="button" data-mie-action="delete-chord" aria-label="Xóa hợp âm ${escapeHtml(chord.label)}">Xóa</button></article>`).join("") || `<p class="mie-empty">Chưa có hợp âm.</p>`}
          </section>
        </aside>
      </div>`;
  }

  function shellMarkup(instance) {
    return `<section class="mie" data-view="${instance.view}" aria-label="HH Music Intelligence Engine">
      <header class="mie-header"><div><span class="mie-logo" aria-hidden="true">MI</span><div><p>HH LOCAL MUSIC LAB</p><h1>${instance.view === "musical-brain" ? "Musical Brain" : "Audio-to-MIDI 2.0"}</h1></div></div><span class="mie-trust"><i></i>Xử lý trên thiết bị</span></header>
      <nav class="mie-tabs" role="tablist" aria-label="Music Intelligence workspace">
        <button type="button" role="tab" aria-selected="${instance.view === "musical-brain"}" class="${instance.view === "musical-brain" ? "is-active" : ""}" data-mie-view="musical-brain"><span>MB</span><strong>Musical Brain</strong><small>BPM, tone, hợp âm, cấu trúc và Song DNA</small></button>
        <button type="button" role="tab" aria-selected="${instance.view === "audio-midi"}" class="${instance.view === "audio-midi" ? "is-active" : ""}" data-mie-view="audio-midi"><span>AM</span><strong>Audio-to-MIDI</strong><small>Nhận diện nốt, chỉnh event, quantize và xuất SMF</small></button>
      </nav>
      <div class="mie-content">${instance.view === "musical-brain" ? musicalBrainMarkup(instance) : audioMidiMarkup(instance)}</div>
      <div class="mie-toast" role="status" aria-live="polite" data-mie-toast></div>
    </section>`;
  }

  function formatTime(seconds) {
    const value = Math.max(0, Number(seconds) || 0);
    const minutes = Math.floor(value / 60);
    const remainder = Math.floor(value % 60);
    return `${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
  }

  function baseFileName(name) {
    return cleanText(name, 180).replace(/\.[^.]+$/, "").replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
  }

  function drawWaveform(instance) {
    const canvas = instance.host.querySelector("[data-mie-waveform]");
    if (!canvas?.getContext) return;
    const context = canvas.getContext("2d");
    if (!context) return;
    const peaks = instance.state.analysis.waveform;
    const width = canvas.width;
    const height = canvas.height;
    context.clearRect(0, 0, width, height);
    context.fillStyle = "#071019";
    context.fillRect(0, 0, width, height);
    context.strokeStyle = "rgba(99, 226, 231, .18)";
    context.beginPath();
    context.moveTo(0, height / 2);
    context.lineTo(width, height / 2);
    context.stroke();
    if (!peaks.length) return;
    const gradient = context.createLinearGradient(0, 0, width, 0);
    gradient.addColorStop(0, "#f05caf");
    gradient.addColorStop(0.5, "#62dfe7");
    gradient.addColorStop(1, "#c9f56a");
    context.fillStyle = gradient;
    const barWidth = width / peaks.length;
    peaks.forEach((peak, index) => {
      const barHeight = Math.max(2, peak * (height - 18));
      context.fillRect(index * barWidth, (height - barHeight) / 2, Math.max(1, barWidth - 2), barHeight);
    });
  }

  function render(instance, preserveFocus = false) {
    if (!instance?.host) return;
    const focus = preserveFocus ? instance.host.ownerDocument?.activeElement : null;
    const focusKey = focus?.dataset?.mieDnaField || focus?.dataset?.mieChordField || focus?.dataset?.mieNoteField || "";
    instance.host.innerHTML = shellMarkup(instance);
    drawWaveform(instance);
    if (focusKey) instance.host.querySelector(`[data-mie-dna-field="${focusKey}"],[data-mie-chord-field="${focusKey}"],[data-mie-note-field="${focusKey}"]`)?.focus();
  }

  function toast(instance, message, tone = "info") {
    const node = instance.host.querySelector("[data-mie-toast]");
    if (!node) return;
    node.textContent = cleanText(message, 240);
    node.dataset.tone = tone;
    node.classList.add("is-visible");
    globalScope.clearTimeout(instance.toastTimer);
    instance.toastTimer = globalScope.setTimeout(() => node.classList.remove("is-visible"), 3000);
  }

  function persist(instance) {
    instance.state = saveState(instance.state, instance.storage);
  }

  function setView(instance, view) {
    if (!supports(view)) return false;
    if (typeof instance.options.onNavigate === "function") instance.options.onNavigate(view);
    else {
      instance.view = view;
      instance.state.view = view;
      persist(instance);
      render(instance);
    }
    return true;
  }

  async function importAudio(instance, file) {
    const isAudio = /^audio\//i.test(file?.type || "") || /\.(wav|mp3|m4a|aac|ogg|flac|webm)$/i.test(file?.name || "");
    if (!file || !isAudio) throw new Error("Hãy chọn một tệp audio được trình duyệt hỗ trợ.");
    if (file.size > 500 * 1024 * 1024) throw new Error("Tệp lớn hơn 500 MB. Hãy dùng proxy hoặc tệp ngắn hơn.");
    const AudioContextClass = globalScope.AudioContext || globalScope.webkitAudioContext;
    if (!AudioContextClass) throw new Error("Trình duyệt không hỗ trợ Web Audio API.");
    toast(instance, "Đang giải mã và phân tích cục bộ...", "working");
    await new Promise((resolve) => globalScope.setTimeout(resolve, 20));
    if (!instance.audioContext) instance.audioContext = new AudioContextClass();
    const bytes = await file.arrayBuffer();
    const audioBuffer = await instance.audioContext.decodeAudioData(bytes.slice(0));
    const mono = downmixAudioBuffer(audioBuffer);
    const analysis = analyzePCM(mono, audioBuffer.sampleRate);
    const notes = detectNoteEvents(mono, audioBuffer.sampleRate);
    if (instance.audioUrl && globalScope.URL?.revokeObjectURL) globalScope.URL.revokeObjectURL(instance.audioUrl);
    instance.audioUrl = globalScope.URL?.createObjectURL ? globalScope.URL.createObjectURL(file) : "";
    instance.audioBuffer = audioBuffer;
    instance.state.analysis = normalizeState({ analysis: { ...analysis, fileName: file.name, analyzedAt: new Date().toISOString() } }).analysis;
    instance.state.midi.notes = notes;
    instance.state.midi.chords = analysis.chords;
    persist(instance);
    projectContextApi.updateChordTrack(analysis.chords, "audio-analysis");
    render(instance);
    toast(instance, `Đã phân tích ${file.name}: ${analysis.bpm} BPM, ${analysis.key}, ${notes.length} nốt ước lượng.`, "success");
  }

  function downloadMidi(instance) {
    const nameInput = instance.host.querySelector("[data-mie-export-name]");
    const fileName = baseFileName(nameInput?.value || instance.state.analysis.fileName) || "hh-audio-to-midi";
    const bytes = createMidiSMF({
      notes: instance.state.midi.notes,
      chords: projectContextApi.getChordTrack(),
      bpm: instance.state.analysis.bpm,
      timeSignature: instance.state.analysis.timeSignature,
      title: fileName
    });
    if (!globalScope.Blob || !globalScope.URL?.createObjectURL || !globalScope.document?.createElement) {
      toast(instance, "Trình duyệt không hỗ trợ tải Blob MIDI.", "error");
      return bytes;
    }
    const url = globalScope.URL.createObjectURL(new globalScope.Blob([bytes], { type: "audio/midi" }));
    const anchor = globalScope.document.createElement("a");
    anchor.href = url;
    anchor.download = `${fileName}.mid`;
    anchor.hidden = true;
    globalScope.document.body.append(anchor);
    anchor.click();
    anchor.remove();
    globalScope.setTimeout(() => globalScope.URL.revokeObjectURL(url), 1000);
    toast(instance, `Đã tạo ${fileName}.mid trên thiết bị.`, "success");
    return bytes;
  }

  function updateContextChord(track, reason) {
    projectContextApi.updateChordTrack(track, reason);
  }

  function handleClick(instance, event) {
    const viewButton = event.target.closest("[data-mie-view]");
    if (viewButton) return setView(instance, viewButton.dataset.mieView);
    const suggestion = event.target.closest("[data-mie-suggest-root]");
    if (suggestion) {
      updateContextChord(addChord(projectContextApi.getChordTrack(), { root: suggestion.dataset.mieSuggestRoot, quality: suggestion.dataset.mieSuggestQuality, source: "suggestion" }), "chord-suggestion");
      toast(instance, "Đã thêm hợp âm gợi ý vào Chord Track.", "success");
      return;
    }
    const action = event.target.closest("[data-mie-action]")?.dataset.mieAction;
    if (!action) return;
    const shared = sharedSnapshot();
    if (action === "add-chord") updateContextChord(addChord(shared.chordTrack), "chord-add");
    if (action === "transpose-down") updateContextChord(transposeChordTrack(shared.chordTrack, -1), "chord-transpose");
    if (action === "transpose-up") updateContextChord(transposeChordTrack(shared.chordTrack, 1), "chord-transpose");
    if (action === "delete-chord") {
      const id = event.target.closest("[data-mie-chord-id]")?.dataset.mieChordId;
      updateContextChord(deleteChord(shared.chordTrack, id), "chord-delete");
    }
    if (action === "toggle-dna-lock") projectContextApi.updateSongDNA({ locked: !shared.songDNA.locked }, "song-dna-lock");
    if (action === "save-dna") {
      const fields = {};
      instance.host.querySelectorAll("[data-mie-dna-field]").forEach((input) => { fields[input.dataset.mieDnaField] = input.value; });
      projectContextApi.updateSongDNA(fields, "song-dna-save");
      toast(instance, "Đã lưu Song DNA dùng chung.", "success");
    }
    if (action === "add-note") {
      const notes = instance.state.midi.notes;
      const last = notes[notes.length - 1];
      notes.push(normalizeNote({ id: uid("note"), start: last ? last.start + last.duration : 0, duration: 0.5, pitch: 60, velocity: 92, source: "manual" }, notes.length));
      persist(instance);
      render(instance);
    }
    if (action === "delete-note") {
      const id = event.target.closest("[data-mie-note-id]")?.dataset.mieNoteId;
      instance.state.midi.notes = instance.state.midi.notes.filter((note) => note.id !== id);
      persist(instance);
      render(instance);
    }
    if (action === "quantize") {
      instance.state.midi.notes = quantizeNoteEvents(instance.state.midi.notes, instance.state.analysis.bpm, instance.state.midi.quantize);
      persist(instance);
      render(instance);
      toast(instance, `Đã quantize theo ${instance.state.midi.quantize}.`, "success");
    }
    if (action === "export-midi") downloadMidi(instance);
  }

  function handleInput(instance, event) {
    const chordField = event.target.closest("[data-mie-chord-field]");
    if (chordField) {
      const id = chordField.closest("[data-mie-chord-id]")?.dataset.mieChordId;
      const value = ["start", "duration"].includes(chordField.dataset.mieChordField) ? Number(chordField.value) : chordField.value;
      instance.suppressSharedRender = true;
      try {
        updateContextChord(updateChord(projectContextApi.getChordTrack(), id, { [chordField.dataset.mieChordField]: value }), "chord-edit");
      } finally {
        instance.suppressSharedRender = false;
      }
      return;
    }
    const noteField = event.target.closest("[data-mie-note-field]");
    if (noteField) {
      const id = noteField.closest("[data-mie-note-id]")?.dataset.mieNoteId;
      instance.state.midi.notes = instance.state.midi.notes.map((note, index) => note.id === id ? normalizeNote({ ...note, [noteField.dataset.mieNoteField]: Number(noteField.value) }, index) : note);
      persist(instance);
    }
  }

  function handleChange(instance, event) {
    const file = event.target.closest("[data-mie-audio-input]")?.files?.[0];
    if (file) importAudio(instance, file).catch((error) => toast(instance, error.message || "Không phân tích được tệp audio.", "error"));
    const quantize = event.target.closest("[data-mie-quantize]");
    if (quantize) { instance.state.midi.quantize = quantize.value; persist(instance); }
    if (event.target.closest("[data-mie-chord-field]")) render(instance);
    const noteField = event.target.closest("[data-mie-note-field]");
    if (noteField) render(instance);
  }

  function handleDrag(instance, event) {
    const drop = event.target.closest("[data-mie-drop]");
    if (!drop) return;
    event.preventDefault();
    drop.classList.toggle("is-dragging", event.type === "dragover");
    if (event.type === "drop") {
      const file = event.dataTransfer?.files?.[0];
      if (file) importAudio(instance, file).catch((error) => toast(instance, error.message || "Không phân tích được tệp audio.", "error"));
    }
  }

  function handleKeydown(instance, event) {
    if (event.key === "Escape") {
      if (instance.host.ownerDocument?.activeElement?.matches("input,textarea,select")) instance.host.ownerDocument.activeElement.blur();
      else if (typeof instance.options.onNavigate === "function") instance.options.onNavigate("studio");
    }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
      event.preventDefault();
      persist(instance);
      toast(instance, "Đã lưu dữ liệu phân tích trên thiết bị.", "success");
    }
  }

  function mount(host, options = {}) {
    if (!host || typeof host.addEventListener !== "function") throw new TypeError("HHMusicIntelligenceEngine.mount cần một DOM host hợp lệ.");
    unmount();
    const storage = options.storage || safeStorage();
    const instance = {
      host, options, storage,
      view: supports(options.view) ? options.view : "musical-brain",
      state: loadState(storage),
      audioBuffer: null, audioContext: null, audioUrl: "", toastTimer: 0, handlers: {}, unsubscribe: null
    };
    instance.state.view = instance.view;
    instance.handlers.click = (event) => handleClick(instance, event);
    instance.handlers.input = (event) => handleInput(instance, event);
    instance.handlers.change = (event) => handleChange(instance, event);
    instance.handlers.dragover = (event) => handleDrag(instance, event);
    instance.handlers.dragleave = (event) => handleDrag(instance, event);
    instance.handlers.drop = (event) => handleDrag(instance, event);
    instance.handlers.keydown = (event) => handleKeydown(instance, event);
    Object.entries(instance.handlers).forEach(([type, handler]) => host.addEventListener(type, handler));
    instance.unsubscribe = projectContextApi.subscribe(() => {
      if (active === instance && !instance.suppressSharedRender) render(instance);
    });
    host.setAttribute("data-hh-music-intelligence", "");
    active = instance;
    persist(instance);
    render(instance);
    return Object.freeze({
      getState: () => ({ ...clone(instance.state), sharedProject: sharedSnapshot() }),
      setView: (view) => setView(instance, view),
      analyzePCM,
      exportMidi: () => downloadMidi(instance),
      unmount
    });
  }

  function unmount() {
    if (!active) return false;
    const instance = active;
    Object.entries(instance.handlers).forEach(([type, handler]) => instance.host.removeEventListener(type, handler));
    instance.unsubscribe?.();
    if (instance.audioUrl && globalScope.URL?.revokeObjectURL) globalScope.URL.revokeObjectURL(instance.audioUrl);
    if (instance.audioContext?.close) instance.audioContext.close().catch(() => {});
    globalScope.clearTimeout(instance.toastTimer);
    instance.host.removeAttribute("data-hh-music-intelligence");
    instance.host.replaceChildren();
    active = null;
    return true;
  }

  const browserApi = Object.freeze({ supports, mount, unmount });
  const testApi = Object.freeze({
    VERSION, STORAGE_KEY, SHARED_STORAGE_KEY, PROJECT_EVENT, VIEWS, ROOTS, QUALITIES,
    cleanText, escapeHtml, chordLabel, normalizeChord, normalizeChordTrack, normalizeSongDNA, normalizeNote,
    normalizeState, loadState, saveState, normalizeSharedProject, loadSharedProject, createProjectContext,
    addChord, updateChord, deleteChord, transposeChordTrack, suggestNextChords,
    downmixAudioBuffer, resampleLinear, computeWaveform, estimateBPM, computeChroma, scoreKey,
    estimateKeyAndChords, estimateStructure, analyzePCM, detectPitch, detectNoteEvents,
    quantizeStepSeconds, quantizeNoteEvents, noteName, chordMidiNotes, variableLength, createMidiSMF,
    supports, mount, unmount
  });

  if (typeof module !== "undefined" && module.exports) module.exports = testApi;
  globalScope.HHMusicProjectContext = projectContextApi;
  globalScope.HHMusicIntelligenceEngine = browserApi;
}(typeof globalThis !== "undefined" ? globalThis : this));
