(function (root) {
  "use strict";

  const VERSION = 1;
  const STORAGE_KEY = "hh.music.generative-arrangement.v1";
  const VIEWS = Object.freeze(["session-band", "region-editor"]);
  const MAX_BRANCHES = 16;
  const MAX_VERSIONS = 32;
  const PPQ = 480;
  const browserScope = root.window && typeof root.window === "object" ? root.window : root;

  const INSTRUMENTS = Object.freeze([
    { id: "drums", label: "Trống", short: "DR", channel: 9, color: "#ff6ca8", techniques: ["Pocket", "Half-time", "Syncopated", "Cinematic"] },
    { id: "bass", label: "Bass", short: "BS", channel: 1, color: "#69d9e7", techniques: ["Root groove", "Walking", "Octave pulse", "Legato"] },
    { id: "piano", label: "Piano", short: "PN", channel: 2, color: "#f1d66b", techniques: ["Block chord", "Arpeggio", "Broken chord", "Rhythmic"] },
    { id: "guitar", label: "Guitar", short: "GT", channel: 3, color: "#91df77", techniques: ["Strum", "Fingerstyle", "Muted", "Arpeggio"] },
    { id: "synth", label: "Synth", short: "SY", channel: 4, color: "#a78bfa", techniques: ["Pulse", "Pluck", "Lead", "Sequence"] },
    { id: "strings", label: "Strings", short: "ST", channel: 5, color: "#ff9f68", techniques: ["Sustain", "Ostinato", "Pizzicato", "Swell"] }
  ]);
  const INSTRUMENT_MAP = Object.freeze(Object.fromEntries(INSTRUMENTS.map((item) => [item.id, item])));
  const REGION_ACTIONS = Object.freeze(["regenerate", "extend", "replace", "add-harmony", "reduce-energy"]);
  const NOTE_NAMES = Object.freeze(["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]);
  const ROOTS = Object.freeze({ C: 0, "C#": 1, Db: 1, D: 2, "D#": 3, Eb: 3, E: 4, F: 5, "F#": 6, Gb: 6, G: 7, "G#": 8, Ab: 8, A: 9, "A#": 10, Bb: 10, B: 11 });
  let active = null;

  const clone = (value) => JSON.parse(JSON.stringify(value));
  const clamp = (value, min, max) => {
    const number = Number(value);
    return Math.min(max, Math.max(min, Number.isFinite(number) ? number : min));
  };
  const cleanText = (value, max = 500) => String(value == null ? "" : value).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").trim().slice(0, max);
  const escapeHtml = (value) => String(value == null ? "" : value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
  const safeId = (value, fallback = "item") => cleanText(value, 100).toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "") || fallback;
  const makeId = (prefix, now = Date.now()) => `${prefix}-${Number(now).toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  const supports = (id) => VIEWS.includes(id);

  function hashSeed(input) {
    let hash = 2166136261;
    const text = String(input == null ? "" : input);
    for (let index = 0; index < text.length; index += 1) {
      hash ^= text.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  }

  function seededRandom(seed) {
    let value = hashSeed(seed) || 1;
    return function random() {
      value += 0x6d2b79f5;
      let result = value;
      result = Math.imul(result ^ (result >>> 15), result | 1);
      result ^= result + Math.imul(result ^ (result >>> 7), result | 61);
      return ((result ^ (result >>> 14)) >>> 0) / 4294967296;
    };
  }

  function beatsPerBar(signature) {
    const match = /^(\d+)\/(\d+)$/.exec(String(signature || "4/4"));
    if (!match) return 4;
    return clamp(Number(match[1]) * (4 / Number(match[2])), 1, 12);
  }

  function noteName(pitch) {
    const midi = Math.round(clamp(pitch, 0, 127));
    return `${NOTE_NAMES[midi % 12]}${Math.floor(midi / 12) - 1}`;
  }

  function parseChord(symbol) {
    const text = cleanText(symbol || "C", 24).replace(/\s+major$/i, "").replace(/\s+minor$/i, "m");
    const match = /^([A-G](?:#|b)?)(.*)$/.exec(text);
    const rootName = match?.[1] || "C";
    const suffix = (match?.[2] || "").toLowerCase();
    const root = ROOTS[rootName] ?? 0;
    let intervals = [0, 4, 7];
    if (/m(?!aj)/.test(suffix)) intervals = [0, 3, 7];
    if (/dim|o/.test(suffix)) intervals = [0, 3, 6];
    if (/aug|\+/.test(suffix)) intervals = [0, 4, 8];
    if (/sus2/.test(suffix)) intervals = [0, 2, 7];
    if (/sus4|sus/.test(suffix)) intervals = [0, 5, 7];
    if (/7/.test(suffix)) intervals.push(/maj7/.test(suffix) ? 11 : 10);
    return { symbol: text, root, rootName, intervals: [...new Set(intervals)] };
  }

  function normalizeChord(item, index, barCount = 8) {
    const startBar = Math.floor(clamp(item?.startBar ?? item?.bar ?? index * 2, 0, Math.max(0, barCount - 1)));
    return {
      id: safeId(item?.id, `chord-${index + 1}`),
      symbol: cleanText(item?.symbol || item?.chord || "C", 24),
      startBar,
      bars: Math.floor(clamp(item?.bars ?? item?.lengthBars ?? 2, 1, Math.max(1, barCount - startBar))),
      locked: Boolean(item?.locked)
    };
  }

  function normalizeChordTrack(input, barCount = 8) {
    const source = Array.isArray(input) ? input : Array.isArray(input?.chords) ? input.chords : [];
    const fallback = [
      { id: "chord-c", symbol: "C", startBar: 0, bars: 2 },
      { id: "chord-am", symbol: "Am", startBar: 2, bars: 2 },
      { id: "chord-f", symbol: "F", startBar: 4, bars: 2 },
      { id: "chord-g", symbol: "G", startBar: 6, bars: 2 }
    ];
    const normalized = (source.length ? source : fallback).slice(0, 64).map((item, index) => normalizeChord(item, index, barCount));
    normalized.sort((a, b) => a.startBar - b.startBar || a.id.localeCompare(b.id));
    return normalized;
  }

  function normalizeSongDNA(input = {}) {
    const instruments = Array.isArray(input.instruments) ? input.instruments.map((item) => cleanText(item, 40)).filter(Boolean).slice(0, 12) : INSTRUMENTS.map((item) => item.label);
    return {
      motif: cleanText(input.motif || input.melodicMotif || "1-3-5-6", 80),
      instruments: instruments.length ? instruments : INSTRUMENTS.map((item) => item.label),
      timbre: cleanText(input.timbre || input.soundPalette || "Ấm, rõ, không gian vừa", 160),
      style: cleanText(input.style || input.genre || "Pop điện ảnh hiện đại", 160),
      mood: cleanText(input.mood || "Hy vọng", 80),
      locked: input.locked !== false
    };
  }

  function readSharedProjectContext() {
    const context = browserScope.HHMusicProjectContext;
    if (!context || typeof context !== "object") return { available: false, chordTrack: null, songDNA: null, context: null };
    let chordTrack = null;
    let songDNA = null;
    try { if (typeof context.getChordTrack === "function") chordTrack = context.getChordTrack(); } catch {}
    try { if (typeof context.getSongDNA === "function") songDNA = context.getSongDNA(); } catch {}
    return { available: Boolean(chordTrack || songDNA), chordTrack, songDNA, context };
  }

  function subscribeSharedProjectContext(listener) {
    const context = browserScope.HHMusicProjectContext;
    if (!context || typeof context.subscribe !== "function") return () => {};
    try {
      const subscription = context.subscribe(listener);
      if (typeof subscription === "function") return subscription;
      if (subscription && typeof subscription.unsubscribe === "function") return () => subscription.unsubscribe();
    } catch {}
    return () => {};
  }

  function normalizeMusician(id, input = {}) {
    const meta = INSTRUMENT_MAP[id];
    const techniques = meta.techniques;
    return {
      id,
      enabled: input.enabled !== false,
      complexity: Math.round(clamp(input.complexity ?? 52, 0, 100)),
      energy: Math.round(clamp(input.energy ?? 64, 0, 100)),
      density: Math.round(clamp(input.density ?? 56, 0, 100)),
      technique: techniques.includes(input.technique) ? input.technique : techniques[0],
      generation: Math.floor(clamp(input.generation ?? 0, 0, 9999))
    };
  }

  function normalizeNote(note, index = 0) {
    return {
      id: safeId(note?.id, `note-${index + 1}`),
      pitch: Math.round(clamp(note?.pitch ?? 60, 24, 108)),
      startBeat: Math.round(clamp(note?.startBeat ?? 0, 0, 9999) * 4) / 4,
      durationBeats: Math.round(clamp(note?.durationBeats ?? 1, 0.25, 32) * 4) / 4,
      velocity: Math.round(clamp(note?.velocity ?? 96, 1, 127)),
      chordId: safeId(note?.chordId, "chord"),
      chordSymbol: cleanText(note?.chordSymbol || "C", 24),
      locked: Boolean(note?.locked)
    };
  }

  function chordAtBar(chordTrack, bar) {
    return [...chordTrack].reverse().find((chord) => bar >= chord.startBar) || chordTrack[0];
  }

  function addPatternNote(notes, data, totalBeats) {
    const note = normalizeNote(data, notes.length);
    if (note.startBeat >= totalBeats) return;
    note.durationBeats = Math.min(note.durationBeats, Math.max(0.25, totalBeats - note.startBeat));
    note.id = `${data.instrument || "note"}-${notes.length + 1}-${Math.round(note.startBeat * 100)}`;
    notes.push(note);
  }

  function generateInstrumentPattern(projectInput, musicianInput) {
    const project = normalizeProject(projectInput);
    const musician = normalizeMusician(musicianInput?.id || "piano", musicianInput);
    const random = seededRandom(`${project.seed}:${musician.id}:${musician.generation}:${musician.complexity}:${musician.energy}:${musician.density}:${musician.technique}:${project.chordTrack.map((item) => item.symbol).join("-")}`);
    const barBeats = beatsPerBar(project.timeSignature);
    const totalBeats = project.bars * barBeats;
    const densityGate = 0.2 + musician.density / 125;
    const velocityBase = 48 + musician.energy * 0.62;
    const notes = [];
    const motif = project.songDNA.motif.split(/[^0-9]+/).map(Number).filter((value) => value > 0).slice(0, 16);

    for (let bar = 0; bar < project.bars; bar += 1) {
      const chordItem = chordAtBar(project.chordTrack, bar);
      const chord = parseChord(chordItem.symbol);
      const beatStart = bar * barBeats;
      const common = { chordId: chordItem.id, chordSymbol: chordItem.symbol, instrument: musician.id };
      if (musician.id === "drums") {
        const step = musician.complexity > 72 ? 0.5 : 1;
        for (let offset = 0; offset < barBeats; offset += step) {
          if (offset % 1 === 0 || random() < densityGate) addPatternNote(notes, { ...common, pitch: 42, startBeat: beatStart + offset, durationBeats: 0.25, velocity: velocityBase - 16 + random() * 16 }, totalBeats);
          if (offset === 0 || (Math.abs(offset - 2) < 0.01 && barBeats >= 4) || random() < musician.complexity / 550) addPatternNote(notes, { ...common, pitch: 36, startBeat: beatStart + offset, durationBeats: 0.25, velocity: velocityBase + 12 }, totalBeats);
          if ((Math.abs(offset - 1) < 0.01 || Math.abs(offset - 3) < 0.01) && barBeats >= 4) addPatternNote(notes, { ...common, pitch: 38, startBeat: beatStart + offset, durationBeats: 0.25, velocity: velocityBase + 5 }, totalBeats);
        }
      } else if (musician.id === "bass") {
        const count = Math.max(1, Math.round(1 + musician.density / 24));
        for (let step = 0; step < count; step += 1) {
          if (step > 0 && random() > densityGate) continue;
          const interval = step % 3 === 2 && musician.complexity > 45 ? 7 : 0;
          addPatternNote(notes, { ...common, pitch: 36 + chord.root + interval, startBeat: beatStart + step * (barBeats / count), durationBeats: Math.max(0.25, barBeats / count * 0.82), velocity: velocityBase + random() * 10 }, totalBeats);
        }
      } else if (musician.id === "piano") {
        const hits = musician.technique === "Arpeggio" || musician.technique === "Broken chord" ? Math.max(3, Math.round(3 + musician.density / 18)) : musician.density > 72 ? 2 : 1;
        for (let hit = 0; hit < hits; hit += 1) {
          if (hit > 0 && random() > densityGate) continue;
          const interval = chord.intervals[hit % chord.intervals.length];
          const chordNotes = musician.technique === "Block chord" ? chord.intervals : [interval];
          chordNotes.forEach((tone, toneIndex) => addPatternNote(notes, { ...common, pitch: 60 + chord.root + tone + (toneIndex > 2 ? 12 : 0), startBeat: beatStart + hit * (barBeats / hits), durationBeats: musician.technique === "Block chord" ? barBeats * 0.82 : Math.max(0.25, barBeats / hits * 0.78), velocity: velocityBase - toneIndex * 3 }, totalBeats));
        }
      } else if (musician.id === "guitar") {
        const steps = Math.max(2, Math.round(2 + musician.density / 15));
        for (let step = 0; step < steps; step += 1) {
          if (random() > densityGate && step > 0) continue;
          const tone = chord.intervals[step % chord.intervals.length];
          addPatternNote(notes, { ...common, pitch: 52 + chord.root + tone, startBeat: beatStart + step * (barBeats / steps), durationBeats: musician.technique === "Strum" ? 1.5 : Math.max(0.25, barBeats / steps * 0.7), velocity: velocityBase - 5 + random() * 13 }, totalBeats);
        }
      } else if (musician.id === "synth") {
        const steps = Math.max(2, Math.round(2 + musician.density / 10));
        for (let step = 0; step < steps; step += 1) {
          if (step > 0 && random() > densityGate) continue;
          const degree = motif.length ? motif[step % motif.length] - 1 : step;
          const tone = chord.intervals[degree % chord.intervals.length] + (degree >= chord.intervals.length ? 12 : 0);
          addPatternNote(notes, { ...common, pitch: 60 + chord.root + tone, startBeat: beatStart + step * (barBeats / steps), durationBeats: Math.max(0.25, barBeats / steps * 0.68), velocity: velocityBase + random() * 12 }, totalBeats);
        }
      } else if (musician.id === "strings") {
        const chordNotes = musician.complexity > 60 ? chord.intervals : chord.intervals.slice(0, 2);
        chordNotes.forEach((tone, toneIndex) => addPatternNote(notes, { ...common, pitch: 55 + chord.root + tone, startBeat: beatStart, durationBeats: barBeats * 0.96, velocity: velocityBase - 16 + toneIndex * 2 }, totalBeats));
        if (musician.technique === "Ostinato" || musician.technique === "Pizzicato") {
          for (let offset = 0; offset < barBeats; offset += 1) addPatternNote(notes, { ...common, pitch: 67 + chord.root + chord.intervals[Math.floor(offset) % chord.intervals.length], startBeat: beatStart + offset, durationBeats: 0.5, velocity: velocityBase - 8 }, totalBeats);
        }
      }
    }
    return notes.sort((a, b) => a.startBeat - b.startBeat || a.pitch - b.pitch);
  }

  function normalizeProject(input = {}) {
    const bars = Math.floor(clamp(input.bars ?? 8, 2, 64));
    return {
      title: cleanText(input.title || "HH Generative Arrangement", 120),
      bpm: Math.round(clamp(input.bpm ?? 96, 30, 260)),
      key: cleanText(input.key || "C major", 32),
      timeSignature: ["3/4", "4/4", "6/8", "7/8"].includes(input.timeSignature) ? input.timeSignature : "4/4",
      bars,
      seed: Math.floor(clamp(input.seed ?? 130803, 1, 2147483646)),
      chordTrack: normalizeChordTrack(input.chordTrack, bars),
      songDNA: normalizeSongDNA(input.songDNA),
      contextSource: input.contextSource === "HHMusicProjectContext" ? "HHMusicProjectContext" : "fallback-deterministic"
    };
  }

  function normalizeRegion(region, index = 0) {
    const startBeat = clamp(region?.startBeat ?? index * 8, 0, 9999);
    const endBeat = clamp(region?.endBeat ?? startBeat + 8, startBeat + 0.25, 10000);
    return {
      id: safeId(region?.id, `region-${index + 1}`),
      sourceRegionId: safeId(region?.sourceRegionId, ""),
      label: cleanText(region?.label || `Vùng ${index + 1}`, 80),
      instrument: INSTRUMENT_MAP[region?.instrument] ? region.instrument : INSTRUMENTS[index % INSTRUMENTS.length].id,
      startBeat: Math.round(startBeat * 4) / 4,
      endBeat: Math.round(endBeat * 4) / 4,
      energy: Math.round(clamp(region?.energy ?? 65, 0, 100)),
      seed: Math.floor(clamp(region?.seed ?? 130803 + index, 1, 2147483646)),
      chord: cleanText(region?.chord || "C", 24),
      tempo: Math.round(clamp(region?.tempo ?? 96, 30, 260)),
      vocal: cleanText(region?.vocal || "Giữ nguyên", 100),
      harmony: Boolean(region?.harmony),
      generation: Math.floor(clamp(region?.generation ?? 0, 0, 9999)),
      operation: REGION_ACTIONS.includes(region?.operation) ? region.operation : "regenerate"
    };
  }

  function makeInitialRegions(project) {
    const totalBeats = project.bars * beatsPerBar(project.timeSignature);
    const sections = ["Mở đầu", "Đoạn 1", "Điệp khúc", "Kết"];
    const size = totalBeats / sections.length;
    return sections.map((label, index) => {
      const chord = chordAtBar(project.chordTrack, Math.floor(index * project.bars / sections.length));
      return normalizeRegion({ id: `base-${index + 1}`, label, instrument: ["piano", "guitar", "synth", "strings"][index], startBeat: index * size, endBeat: (index + 1) * size, energy: 48 + index * 10, seed: project.seed + index, chord: chord.symbol, tempo: project.bpm }, index);
    });
  }

  function makeVersion(regions, operation = "initial", label = "Bản gốc", now = Date.now()) {
    return { id: `version-${Number(now).toString(36)}-${hashSeed(`${operation}:${label}:${now}`).toString(36).slice(0, 5)}`, label: cleanText(label, 100), operation, createdAt: new Date(now).toISOString(), regions: clone(regions) };
  }

  function makeInitialEditor(project, now = Date.now()) {
    const regions = makeInitialRegions(project);
    const version = makeVersion(regions, "initial", "Bản gốc", now);
    return {
      selection: { startBeat: 0, endBeat: Math.min(8, project.bars * beatsPerBar(project.timeSignature)) },
      locks: { seed: true, chord: true, tempo: true, vocal: true },
      activeBranchId: "branch-main",
      compare: { beforeId: version.id, afterId: version.id },
      branches: [{ id: "branch-main", name: "Main", parentId: "", createdAt: new Date(now).toISOString(), regions, versions: [version] }],
      provider: { configured: false, status: "local", name: "HH Local Draft", message: "Bản nháp deterministic chạy trên thiết bị; chưa gửi tới AI server." }
    };
  }

  function normalizeVersion(version, index = 0) {
    return {
      id: safeId(version?.id, `version-${index + 1}`),
      label: cleanText(version?.label || `Phiên bản ${index + 1}`, 100),
      operation: REGION_ACTIONS.includes(version?.operation) || version?.operation === "initial" || version?.operation === "restore" ? version.operation : "initial",
      createdAt: cleanText(version?.createdAt || new Date(0).toISOString(), 40),
      regions: (Array.isArray(version?.regions) ? version.regions : []).slice(0, 256).map(normalizeRegion)
    };
  }

  function normalizeEditor(input, project) {
    const fallback = makeInitialEditor(project, 1700000000000);
    const branches = (Array.isArray(input?.branches) && input.branches.length ? input.branches : fallback.branches).slice(-MAX_BRANCHES).map((branch, index) => {
      const regions = (Array.isArray(branch?.regions) ? branch.regions : fallback.branches[0].regions).slice(0, 256).map(normalizeRegion);
      const versions = (Array.isArray(branch?.versions) && branch.versions.length ? branch.versions : [makeVersion(regions, "initial", "Bản gốc", 1700000000000 + index)]).slice(-MAX_VERSIONS).map(normalizeVersion);
      return { id: safeId(branch?.id, `branch-${index + 1}`), name: cleanText(branch?.name || `Nhánh ${index + 1}`, 80), parentId: safeId(branch?.parentId, ""), createdAt: cleanText(branch?.createdAt || new Date(0).toISOString(), 40), regions, versions };
    });
    const activeBranchId = branches.some((item) => item.id === input?.activeBranchId) ? input.activeBranchId : branches[0].id;
    const totalBeats = project.bars * beatsPerBar(project.timeSignature);
    const startBeat = clamp(input?.selection?.startBeat ?? 0, 0, totalBeats - 0.25);
    const endBeat = clamp(input?.selection?.endBeat ?? Math.min(8, totalBeats), startBeat + 0.25, totalBeats);
    return {
      selection: { startBeat, endBeat },
      locks: { seed: input?.locks?.seed !== false, chord: input?.locks?.chord !== false, tempo: input?.locks?.tempo !== false, vocal: input?.locks?.vocal !== false },
      activeBranchId,
      compare: { beforeId: cleanText(input?.compare?.beforeId, 100), afterId: cleanText(input?.compare?.afterId, 100) },
      branches,
      provider: { configured: false, status: "local", name: "HH Local Draft", message: "Bản nháp deterministic chạy trên thiết bị; chưa gửi tới AI server." }
    };
  }

  function createDefaultState(now = Date.now()) {
    const project = normalizeProject({});
    const musicians = Object.fromEntries(INSTRUMENTS.map((item) => [item.id, normalizeMusician(item.id)]));
    const patterns = Object.fromEntries(INSTRUMENTS.map((item) => [item.id, generateInstrumentPattern(project, musicians[item.id])]));
    return {
      version: VERSION,
      project,
      sessionBand: { activeInstrument: "piano", selectedNoteId: "", musicians, patterns },
      regionEditor: makeInitialEditor(project, now),
      updatedAt: ""
    };
  }

  function normalizeState(input = {}) {
    const fallback = createDefaultState(1700000000000);
    const project = normalizeProject(input.project || fallback.project);
    const musicians = Object.fromEntries(INSTRUMENTS.map((item) => [item.id, normalizeMusician(item.id, input.sessionBand?.musicians?.[item.id])]));
    const patterns = Object.fromEntries(INSTRUMENTS.map((item) => {
      const saved = input.sessionBand?.patterns?.[item.id];
      return [item.id, Array.isArray(saved) ? saved.slice(0, 4096).map(normalizeNote) : generateInstrumentPattern(project, musicians[item.id])];
    }));
    return {
      version: VERSION,
      project,
      sessionBand: {
        activeInstrument: INSTRUMENT_MAP[input.sessionBand?.activeInstrument] ? input.sessionBand.activeInstrument : "piano",
        selectedNoteId: safeId(input.sessionBand?.selectedNoteId, ""),
        musicians,
        patterns
      },
      regionEditor: normalizeEditor(input.regionEditor, project),
      updatedAt: cleanText(input.updatedAt, 40)
    };
  }

  function loadState(storage) {
    try {
      const raw = storage?.getItem?.(STORAGE_KEY);
      if (!raw) return createDefaultState();
      const parsed = JSON.parse(raw);
      if (parsed?.version !== VERSION) return createDefaultState();
      return normalizeState(parsed);
    } catch { return createDefaultState(); }
  }

  function saveState(input, storage) {
    const state = normalizeState(input);
    state.updatedAt = new Date().toISOString();
    state.regionEditor.provider = { configured: false, status: "local", name: "HH Local Draft", message: "Provider runtime không được lưu vào localStorage." };
    try { storage?.setItem?.(STORAGE_KEY, JSON.stringify(state)); } catch {}
    return state;
  }

  function applySharedContext(stateInput) {
    const state = normalizeState(stateInput);
    const shared = readSharedProjectContext();
    if (!shared.available) {
      const changed = state.project.contextSource !== "fallback-deterministic";
      state.project.contextSource = "fallback-deterministic";
      return { state, changed, source: "fallback-deterministic" };
    }
    const before = JSON.stringify({ chordTrack: state.project.chordTrack, songDNA: state.project.songDNA });
    if (shared.chordTrack) state.project.chordTrack = normalizeChordTrack(shared.chordTrack, state.project.bars);
    if (shared.songDNA) state.project.songDNA = normalizeSongDNA(shared.songDNA);
    state.project.contextSource = "HHMusicProjectContext";
    const after = JSON.stringify({ chordTrack: state.project.chordTrack, songDNA: state.project.songDNA });
    if (before !== after) {
      for (const item of INSTRUMENTS) state.sessionBand.patterns[item.id] = generateInstrumentPattern(state.project, state.sessionBand.musicians[item.id]);
    }
    return { state, changed: before !== after, source: "HHMusicProjectContext" };
  }

  function selectedRegions(branch, selection) {
    return branch.regions.filter((region) => region.endBeat > selection.startBeat && region.startBeat < selection.endBeat);
  }

  function operationLabel(operation) {
    return ({ regenerate: "Tạo lại", extend: "Mở rộng", replace: "Thay nhạc cụ", "add-harmony": "Thêm bè", "reduce-energy": "Giảm năng lượng" })[operation] || operation;
  }

  function applyRegionOperation(editorInput, operation, options = {}) {
    if (!REGION_ACTIONS.includes(operation)) throw new TypeError("Thao tác vùng không hợp lệ.");
    const project = normalizeProject(options.project || {});
    const editor = normalizeEditor(editorInput, project);
    const source = editor.branches.find((item) => item.id === editor.activeBranchId) || editor.branches[0];
    const selection = options.selection ? { startBeat: clamp(options.selection.startBeat, 0, 9999), endBeat: clamp(options.selection.endBeat, 0.25, 10000) } : editor.selection;
    if (selection.endBeat <= selection.startBeat) selection.endBeat = selection.startBeat + 0.25;
    const locks = { ...editor.locks, ...(options.locks || {}) };
    const regions = clone(source.regions);
    const chosen = selectedRegions({ regions }, selection);
    const random = seededRandom(`${project.seed}:${operation}:${selection.startBeat}:${selection.endBeat}:${source.versions.length}`);
    const changedIds = new Set(chosen.map((item) => item.id));

    if (operation === "add-harmony") {
      chosen.forEach((region, index) => {
        regions.push(normalizeRegion({ ...region, id: `${region.id}-harmony-${source.versions.length + 1}-${index}`, sourceRegionId: region.id, label: `${region.label} · Bè`, instrument: options.instrument && INSTRUMENT_MAP[options.instrument] ? options.instrument : "strings", energy: Math.max(20, region.energy - 12), harmony: true, seed: locks.seed ? region.seed : region.seed + 17, generation: region.generation + 1, operation }, regions.length));
      });
    } else if (operation === "extend") {
      const template = chosen.at(-1) || source.regions.at(-1);
      if (template) {
        const duration = clamp(options.durationBeats ?? selection.endBeat - selection.startBeat, 1, project.bars * beatsPerBar(project.timeSignature));
        const startBeat = Math.max(selection.endBeat, template.endBeat);
        regions.push(normalizeRegion({ ...template, id: `${template.id}-extend-${source.versions.length + 1}`, sourceRegionId: template.id, label: `${template.label} · Mở rộng`, startBeat, endBeat: startBeat + duration, seed: locks.seed ? template.seed : template.seed + Math.floor(random() * 997) + 1, chord: locks.chord ? template.chord : project.chordTrack[Math.floor(random() * project.chordTrack.length)].symbol, tempo: locks.tempo ? template.tempo : project.bpm, vocal: locks.vocal ? template.vocal : "Biến thể nối tiếp", generation: template.generation + 1, operation }, regions.length));
      }
    } else {
      regions.forEach((region) => {
        if (!changedIds.has(region.id)) return;
        region.operation = operation;
        region.generation += 1;
        if (!locks.seed) region.seed += Math.floor(random() * 1009) + 1;
        if (!locks.chord) region.chord = project.chordTrack[Math.floor(random() * project.chordTrack.length)].symbol;
        if (!locks.tempo) region.tempo = Math.round(clamp(project.bpm + (random() - 0.5) * 10, 30, 260));
        if (!locks.vocal) region.vocal = operation === "reduce-energy" ? "Giọng gần, ít bè" : "Biến thể mới";
        if (operation === "replace") region.instrument = INSTRUMENT_MAP[options.instrument] ? options.instrument : INSTRUMENTS[(INSTRUMENTS.findIndex((item) => item.id === region.instrument) + 1) % INSTRUMENTS.length].id;
        if (operation === "reduce-energy") region.energy = Math.max(0, region.energy - Math.round(clamp(options.amount ?? 20, 5, 60)));
        if (operation === "regenerate") region.energy = Math.round(clamp(region.energy + (random() - 0.5) * 14, 0, 100));
      });
    }

    regions.sort((a, b) => a.startBeat - b.startBeat || a.instrument.localeCompare(b.instrument));
    const branchNumber = editor.branches.length + 1;
    const now = options.now ?? Date.now();
    const version = makeVersion(regions, operation, `${operationLabel(operation)} · v${source.versions.length + 1}`, now);
    const branch = {
      id: `branch-${Number(now).toString(36)}-${hashSeed(`${operation}:${branchNumber}:${now}`).toString(36).slice(0, 4)}`,
      name: cleanText(options.branchName || `${operationLabel(operation)} ${branchNumber}`, 80),
      parentId: source.id,
      createdAt: new Date(now).toISOString(),
      regions,
      versions: [...source.versions.slice(-MAX_VERSIONS + 1), version]
    };
    editor.branches = [...editor.branches.slice(-MAX_BRANCHES + 1), branch];
    editor.activeBranchId = branch.id;
    editor.selection = selection;
    editor.compare = { beforeId: source.versions.at(-1)?.id || "", afterId: version.id };
    return editor;
  }

  function findVersion(editor, versionId) {
    for (const branch of editor.branches || []) {
      const version = branch.versions?.find((item) => item.id === versionId);
      if (version) return { branch, version };
    }
    return null;
  }

  function compareVersions(editorInput, beforeId, afterId) {
    const before = findVersion(editorInput, beforeId)?.version;
    const after = findVersion(editorInput, afterId)?.version;
    if (!before || !after) return { found: false, added: [], removed: [], changed: [] };
    const beforeMap = new Map(before.regions.map((item) => [item.id, item]));
    const afterMap = new Map(after.regions.map((item) => [item.id, item]));
    const added = [...afterMap.keys()].filter((id) => !beforeMap.has(id));
    const removed = [...beforeMap.keys()].filter((id) => !afterMap.has(id));
    const changed = [...afterMap.keys()].filter((id) => beforeMap.has(id) && JSON.stringify(beforeMap.get(id)) !== JSON.stringify(afterMap.get(id)));
    return { found: true, before: before.label, after: after.label, added, removed, changed };
  }

  function restoreVersion(editorInput, versionId, options = {}) {
    const editor = clone(editorInput);
    const found = findVersion(editor, versionId);
    if (!found) return editor;
    const activeBranch = editor.branches.find((item) => item.id === editor.activeBranchId) || editor.branches[0];
    const now = options.now ?? Date.now();
    activeBranch.regions = clone(found.version.regions);
    const restored = makeVersion(activeBranch.regions, "restore", `Khôi phục ${found.version.label}`, now);
    activeBranch.versions = [...activeBranch.versions.slice(-MAX_VERSIONS + 1), restored];
    editor.compare = { beforeId: activeBranch.versions.at(-2)?.id || versionId, afterId: restored.id };
    return editor;
  }

  function variableLength(value) {
    let number = Math.max(0, Math.floor(value));
    const bytes = [number & 0x7f];
    while ((number >>= 7)) bytes.unshift((number & 0x7f) | 0x80);
    return bytes;
  }

  function ascii(text) {
    return [...String(text)].map((char) => char.charCodeAt(0) & 0x7f);
  }

  function int32(value) { return [(value >>> 24) & 255, (value >>> 16) & 255, (value >>> 8) & 255, value & 255]; }
  function int16(value) { return [(value >>> 8) & 255, value & 255]; }

  function midiTrack(name, notes, channel) {
    const events = [];
    notes.forEach((note) => {
      const start = Math.round(note.startBeat * PPQ);
      const end = Math.max(start + 1, Math.round((note.startBeat + note.durationBeats) * PPQ));
      events.push({ tick: start, order: 1, data: [0x90 | channel, note.pitch, note.velocity] });
      events.push({ tick: end, order: 0, data: [0x80 | channel, note.pitch, 0] });
    });
    events.sort((a, b) => a.tick - b.tick || a.order - b.order);
    const nameBytes = ascii(name);
    const data = [0, 0xff, 0x03, ...variableLength(nameBytes.length), ...nameBytes];
    let last = 0;
    events.forEach((event) => { data.push(...variableLength(event.tick - last), ...event.data); last = event.tick; });
    data.push(0, 0xff, 0x2f, 0);
    return [...ascii("MTrk"), ...int32(data.length), ...data];
  }

  function exportMidi(stateInput, instrumentId = "all") {
    const state = normalizeState(stateInput);
    const selected = instrumentId === "all" ? INSTRUMENTS.filter((item) => state.sessionBand.musicians[item.id].enabled) : INSTRUMENTS.filter((item) => item.id === instrumentId);
    const tempo = Math.round(60000000 / state.project.bpm);
    const signature = state.project.timeSignature.split("/").map(Number);
    const denominatorPower = Math.round(Math.log2(signature[1] || 4));
    const tempoData = [0, 0xff, 0x51, 3, (tempo >>> 16) & 255, (tempo >>> 8) & 255, tempo & 255, 0, 0xff, 0x58, 4, signature[0] || 4, denominatorPower, 24, 8, 0, 0xff, 0x2f, 0];
    const tracks = [[...ascii("MTrk"), ...int32(tempoData.length), ...tempoData], ...selected.map((item) => midiTrack(item.label, state.sessionBand.patterns[item.id] || [], item.channel))];
    return Uint8Array.from([...ascii("MThd"), ...int32(6), ...int16(1), ...int16(tracks.length), ...int16(PPQ), ...tracks.flat()]);
  }

  function downloadBlob(blob, filename) {
    const url = root.URL.createObjectURL(blob);
    const anchor = root.document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.hidden = true;
    root.document.body.append(anchor);
    anchor.click();
    anchor.remove();
    root.setTimeout(() => root.URL.revokeObjectURL(url), 500);
  }

  function resolveProvider(options = {}) {
    const adapter = typeof options.providerAdapter === "function" ? options.providerAdapter : typeof browserScope.HH_MUSIC_REGION_ADAPTER === "function" ? browserScope.HH_MUSIC_REGION_ADAPTER : null;
    const endpointCandidate = cleanText(options.providerEndpoint || browserScope.HH_MUSIC_REGION_ENDPOINT, 400);
    const endpoint = /^(?:https:\/\/|\/)/.test(endpointCandidate) ? endpointCandidate : "";
    if (adapter) return { configured: true, status: "ready", name: "Region AI Adapter", message: "Adapter server đã được cấu hình; API key không nằm trong trình duyệt.", adapter, endpoint: "" };
    if (endpoint) return { configured: true, status: "ready", name: "Region AI Endpoint", message: "Endpoint server đã được cấu hình; kết quả chỉ được xác nhận sau response hợp lệ.", adapter: null, endpoint };
    return { configured: false, status: "local", name: "HH Local Draft", message: "Chưa cấu hình AI server. Các thao tác hiện tạo bản nháp deterministic trên thiết bị.", adapter: null, endpoint: "" };
  }

  async function callProvider(instance, operation) {
    const provider = instance.provider;
    if (!provider.configured) {
      toast(instance, "Chưa cấu hình provider server; bản nháp local vẫn được giữ nguyên.", "warning");
      return null;
    }
    const branch = instance.state.regionEditor.branches.find((item) => item.id === instance.state.regionEditor.activeBranchId);
    const payload = {
      action: operation,
      project: { bpm: instance.state.project.bpm, key: instance.state.project.key, timeSignature: instance.state.project.timeSignature, chordTrack: clone(instance.state.project.chordTrack), songDNA: clone(instance.state.project.songDNA) },
      selection: clone(instance.state.regionEditor.selection),
      locks: clone(instance.state.regionEditor.locks),
      branch: { id: branch.id, regions: clone(branch.regions) }
    };
    instance.state.regionEditor.provider = { configured: true, status: "running", name: provider.name, message: "Đang chờ provider server xử lý..." };
    render(instance);
    try {
      let result;
      if (provider.adapter) result = await provider.adapter(payload);
      else {
        const response = await root.fetch(provider.endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "same-origin", body: JSON.stringify(payload), signal: instance.controller.signal });
        result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result.error || `Provider trả HTTP ${response.status}.`);
      }
      if (!result || typeof result !== "object") throw new Error("Provider không trả dữ liệu hợp lệ.");
      instance.state.regionEditor.provider = { configured: true, status: "ready", name: provider.name, message: cleanText(result.message || "Provider đã phản hồi. Bản local chưa bị ghi đè.", 240) };
      persist(instance, "Đã nhận phản hồi provider; dữ liệu gốc không bị ghi đè.");
      render(instance);
      return result;
    } catch (error) {
      instance.state.regionEditor.provider = { configured: true, status: "error", name: provider.name, message: cleanText(error.message || "Provider thất bại.", 240) };
      render(instance);
      toast(instance, instance.state.regionEditor.provider.message, "error");
      return null;
    }
  }

  function activeBranch(state) {
    return state.regionEditor.branches.find((item) => item.id === state.regionEditor.activeBranchId) || state.regionEditor.branches[0];
  }

  function renderChordTrack(instance) {
    const project = instance.state.project;
    return `<div class="mga-chord-track" aria-label="Chord Track dùng chung">${project.chordTrack.map((chord) => `<button type="button" data-mga-select-chord="${escapeHtml(chord.id)}" style="--start:${chord.startBar / project.bars * 100}%;--width:${chord.bars / project.bars * 100}%" title="Ô nhịp ${chord.startBar + 1} đến ${chord.startBar + chord.bars}"><strong>${escapeHtml(chord.symbol)}</strong><small>${chord.bars} ô nhịp</small></button>`).join("")}</div>`;
  }

  function renderMusicianCards(instance) {
    const band = instance.state.sessionBand;
    return INSTRUMENTS.map((meta) => {
      const musician = band.musicians[meta.id];
      const notes = band.patterns[meta.id]?.length || 0;
      return `<article class="mga-musician ${band.activeInstrument === meta.id ? "is-active" : ""}" style="--instrument:${meta.color}">
        <button class="mga-musician-head" type="button" data-mga-instrument="${meta.id}" aria-pressed="${band.activeInstrument === meta.id}"><i>${meta.short}</i><span><strong>${meta.label}</strong><small>${notes} nốt · Gen ${musician.generation + 1}</small></span><b>${musician.enabled ? "ON" : "OFF"}</b></button>
        <div class="mga-musician-controls">
          <label>Độ phức tạp <output>${musician.complexity}%</output><input type="range" min="0" max="100" value="${musician.complexity}" data-mga-musician-field="complexity" data-instrument="${meta.id}"></label>
          <label>Năng lượng <output>${musician.energy}%</output><input type="range" min="0" max="100" value="${musician.energy}" data-mga-musician-field="energy" data-instrument="${meta.id}"></label>
          <label>Mật độ <output>${musician.density}%</output><input type="range" min="0" max="100" value="${musician.density}" data-mga-musician-field="density" data-instrument="${meta.id}"></label>
          <label>Kỹ thuật<select data-mga-musician-field="technique" data-instrument="${meta.id}">${meta.techniques.map((technique) => `<option ${technique === musician.technique ? "selected" : ""}>${technique}</option>`).join("")}</select></label>
        </div>
        <footer><label class="mga-switch"><input type="checkbox" data-mga-musician-field="enabled" data-instrument="${meta.id}" ${musician.enabled ? "checked" : ""}><span></span>Bật nhạc công</label><button type="button" data-mga-action="generate-one" data-instrument="${meta.id}">Tạo lại</button></footer>
      </article>`;
    }).join("");
  }

  function renderPianoRoll(instance) {
    const state = instance.state;
    const instrumentId = state.sessionBand.activeInstrument;
    const meta = INSTRUMENT_MAP[instrumentId];
    const notes = state.sessionBand.patterns[instrumentId] || [];
    const totalBeats = state.project.bars * beatsPerBar(state.project.timeSignature);
    const pitchMin = instrumentId === "drums" ? 32 : 36;
    const pitchMax = instrumentId === "drums" ? 48 : 84;
    const selected = notes.find((item) => item.id === state.sessionBand.selectedNoteId);
    return `<section class="mga-roll-panel mga-panel" style="--instrument:${meta.color}">
      <header class="mga-panel-head"><div><small>PIANO ROLL · ${meta.short}</small><h3>${meta.label} theo Chord Track</h3></div><div class="mga-toolbar"><button type="button" data-mga-action="add-note">+ Nốt</button><button type="button" data-mga-action="quantize">Quantize 1/4</button><button type="button" data-mga-action="transpose-down" aria-label="Hạ một quãng tám">-12</button><button type="button" data-mga-action="transpose-up" aria-label="Tăng một quãng tám">+12</button><button type="button" data-mga-action="delete-note" ${selected ? "" : "disabled"}>Xóa</button></div></header>
      <div class="mga-roll-scroll"><div class="mga-piano-keys" aria-hidden="true">${Array.from({ length: pitchMax - pitchMin + 1 }, (_, index) => pitchMax - index).map((pitch) => `<span class="${NOTE_NAMES[pitch % 12].includes("#") ? "is-black" : ""}">${noteName(pitch)}</span>`).join("")}</div>
        <div class="mga-piano-roll" role="application" aria-label="Piano roll ${meta.label}; nhấp đúp để thêm nốt" data-mga-piano-roll data-pitch-min="${pitchMin}" data-pitch-max="${pitchMax}" style="--rows:${pitchMax - pitchMin + 1};--beats:${totalBeats}">
          ${notes.map((note) => `<button type="button" class="mga-note ${note.id === state.sessionBand.selectedNoteId ? "is-selected" : ""}" data-note-id="${escapeHtml(note.id)}" aria-label="${noteName(note.pitch)}, beat ${note.startBeat + 1}, velocity ${note.velocity}" style="--x:${note.startBeat / totalBeats * 100}%;--w:${Math.max(.35, note.durationBeats / totalBeats * 100)}%;--y:${(pitchMax - note.pitch) / (pitchMax - pitchMin + 1) * 100}%;--h:${100 / (pitchMax - pitchMin + 1)}%;--velocity:${note.velocity / 127}"><span>${instrumentId === "drums" ? ({36:"Kick",38:"Snare",42:"Hat"}[note.pitch] || noteName(note.pitch)) : noteName(note.pitch)}</span></button>`).join("")}
        </div></div>
      <footer class="mga-roll-footer"><span>${notes.length} nốt · ${totalBeats} beat · Double click để thêm</span>${selected ? `<div><label>Velocity <input type="number" min="1" max="127" value="${selected.velocity}" data-mga-note-field="velocity"></label><label>Độ dài <input type="number" min="0.25" max="32" step="0.25" value="${selected.durationBeats}" data-mga-note-field="durationBeats"></label><b>${noteName(selected.pitch)}</b></div>` : "<em>Chọn một nốt để chỉnh thuộc tính</em>"}</footer>
    </section>`;
  }

  function renderSessionBand(instance) {
    const state = instance.state;
    const dna = state.project.songDNA;
    return `<main class="mga-session" data-mga-workspace="session-band">
      <section class="mga-conductor mga-panel"><div class="mga-conductor-grid">
        <label>BPM<input type="number" min="30" max="260" value="${state.project.bpm}" data-mga-project-field="bpm"></label>
        <label>Tone<input value="${escapeHtml(state.project.key)}" maxlength="32" data-mga-project-field="key"></label>
        <label>Nhịp<select data-mga-project-field="timeSignature">${["3/4","4/4","6/8","7/8"].map((item) => `<option ${item === state.project.timeSignature ? "selected" : ""}>${item}</option>`).join("")}</select></label>
        <label>Ô nhịp<input type="number" min="2" max="64" value="${state.project.bars}" data-mga-project-field="bars"></label>
        <label>Seed<input type="number" min="1" max="2147483646" value="${state.project.seed}" data-mga-project-field="seed"></label>
        <button class="mga-primary" type="button" data-mga-action="generate-all">Điều phối lại ban nhạc</button>
      </div>${renderChordTrack(instance)}</section>
      <div class="mga-session-layout"><aside class="mga-band-list"><header><small>AI SESSION BAND</small><strong>6 nhạc công deterministic</strong></header>${renderMusicianCards(instance)}</aside>
        <div class="mga-session-center">${renderPianoRoll(instance)}</div>
        <aside class="mga-dna-panel mga-panel"><header class="mga-panel-head"><div><small>SONG DNA</small><h3>Khóa bản sắc bài hát</h3></div><span class="mga-source ${state.project.contextSource === "HHMusicProjectContext" ? "is-shared" : ""}">${state.project.contextSource === "HHMusicProjectContext" ? "Project Context" : "Fallback local"}</span></header>
          <div class="mga-dna-fields"><label>Motif<input value="${escapeHtml(dna.motif)}" data-mga-dna-field="motif" ${state.project.contextSource === "HHMusicProjectContext" ? "readonly" : ""}></label><label>Âm sắc<textarea rows="3" data-mga-dna-field="timbre" ${state.project.contextSource === "HHMusicProjectContext" ? "readonly" : ""}>${escapeHtml(dna.timbre)}</textarea></label><label>Phong cách<textarea rows="3" data-mga-dna-field="style" ${state.project.contextSource === "HHMusicProjectContext" ? "readonly" : ""}>${escapeHtml(dna.style)}</textarea></label><label>Cảm xúc<input value="${escapeHtml(dna.mood)}" data-mga-dna-field="mood" ${state.project.contextSource === "HHMusicProjectContext" ? "readonly" : ""}></label></div>
          <div class="mga-dna-summary"><span><b>${state.project.chordTrack.length}</b> hợp âm</span><span><b>${INSTRUMENTS.filter((item) => state.sessionBand.musicians[item.id].enabled).length}</b> nhạc công</span><span><b>${Object.values(state.sessionBand.patterns).reduce((sum, notes) => sum + notes.length, 0)}</b> nốt</span></div>
          <footer><button type="button" data-mga-action="export-midi-one">Xuất MIDI nhạc cụ</button><button class="mga-primary" type="button" data-mga-action="export-midi-all">Xuất MIDI toàn band</button></footer>
        </aside></div>
    </main>`;
  }

  function renderRegionTimeline(instance) {
    const state = instance.state;
    const branch = activeBranch(state);
    const totalBeats = state.project.bars * beatsPerBar(state.project.timeSignature);
    return `<div class="mga-region-timeline" aria-label="Timeline vùng tạo sinh" style="--beats:${totalBeats}">
      <div class="mga-ruler">${Array.from({ length: state.project.bars }, (_, index) => `<span style="--x:${index / state.project.bars * 100}%">${index + 1}</span>`).join("")}</div>
      <div class="mga-selection-range" style="--x:${state.regionEditor.selection.startBeat / totalBeats * 100}%;--w:${(state.regionEditor.selection.endBeat - state.regionEditor.selection.startBeat) / totalBeats * 100}%"><span>Vùng chọn</span></div>
      ${INSTRUMENTS.map((instrument) => `<div class="mga-region-lane" style="--instrument:${instrument.color}"><b>${instrument.short}</b><div>${branch.regions.filter((region) => region.instrument === instrument.id).map((region) => `<button type="button" data-mga-region="${escapeHtml(region.id)}" style="--x:${region.startBeat / totalBeats * 100}%;--w:${(region.endBeat - region.startBeat) / totalBeats * 100}%" title="${escapeHtml(region.label)} · ${region.chord} · ${region.energy}%"><span>${escapeHtml(region.label)}</span><small>${escapeHtml(region.chord)} · ${region.energy}%${region.harmony ? " · Bè" : ""}</small></button>`).join("")}</div></div>`).join("")}
    </div>`;
  }

  function renderRegionEditor(instance) {
    const state = instance.state;
    const editor = state.regionEditor;
    const branch = activeBranch(state);
    const totalBeats = state.project.bars * beatsPerBar(state.project.timeSignature);
    const comparison = compareVersions(editor, editor.compare.beforeId, editor.compare.afterId);
    const versions = editor.branches.flatMap((item) => item.versions.map((version) => ({ ...version, branchName: item.name })));
    return `<main class="mga-region" data-mga-workspace="region-editor">
      <section class="mga-region-command mga-panel"><header><div><small>GENERATIVE REGION EDITOR</small><h2>Biên tập vùng không phá hủy</h2></div><span class="mga-provider-badge" data-status="${editor.provider.status}"><i></i>${escapeHtml(editor.provider.name)}</span></header>
        <div class="mga-region-actions"><button type="button" data-mga-region-operation="regenerate"><b>RG</b><span>Tạo lại<small>Biến thể cùng độ dài</small></span></button><button type="button" data-mga-region-operation="extend"><b>EX</b><span>Mở rộng<small>Nối vùng đã chọn</small></span></button><button type="button" data-mga-region-operation="replace"><b>RP</b><span>Thay nhạc cụ<small>Giữ cấu trúc vùng</small></span></button><button type="button" data-mga-region-operation="add-harmony"><b>HM</b><span>Thêm bè<small>Tạo layer song song</small></span></button><button type="button" data-mga-region-operation="reduce-energy"><b>DN</b><span>Giảm năng lượng<small>Giữ bản gốc</small></span></button></div>
        <p class="mga-provider-note" role="status" aria-live="polite">${escapeHtml(editor.provider.message)}</p>
      </section>
      <div class="mga-region-layout"><aside class="mga-region-inspector mga-panel"><header class="mga-panel-head"><div><small>RANGE & LOCKS</small><h3>Phạm vi xử lý</h3></div></header>
        <div class="mga-range-fields"><label>Beat bắt đầu <input type="number" min="0" max="${totalBeats - .25}" step="0.25" value="${editor.selection.startBeat}" data-mga-selection="startBeat"></label><label>Beat kết thúc <input type="number" min="0.25" max="${totalBeats}" step="0.25" value="${editor.selection.endBeat}" data-mga-selection="endBeat"></label><div><span style="--range:${(editor.selection.endBeat - editor.selection.startBeat) / totalBeats * 100}%"></span></div></div>
        <fieldset class="mga-locks"><legend>Khóa khi tạo biến thể</legend>${[["seed","Seed"],["chord","Hợp âm"],["tempo","Tempo"],["vocal","Vocal"]].map(([id,label]) => `<label><input type="checkbox" data-mga-lock="${id}" ${editor.locks[id] ? "checked" : ""}><span>⌁</span>${label}</label>`).join("")}</fieldset>
        <label class="mga-replace-field">Nhạc cụ thay thế<select data-mga-replace-instrument>${INSTRUMENTS.map((item) => `<option value="${item.id}">${item.label}</option>`).join("")}</select></label>
        <div class="mga-truth-card"><b>LOCAL DRAFT</b><p>Mỗi thao tác tạo branch mới. Chỉ nút gọi provider mới gửi request khi server đã được cấu hình.</p><button type="button" data-mga-action="provider-run" ${instance.provider.configured ? "" : "disabled"}>${instance.provider.configured ? "Chạy provider cho vùng" : "Chưa có server adapter"}</button></div>
      </aside>
      <section class="mga-region-canvas mga-panel"><header class="mga-panel-head"><div><small>${escapeHtml(branch.name.toUpperCase())}</small><h3>Timeline tạo sinh</h3></div><span>${branch.regions.length} vùng · ${branch.versions.length} phiên bản</span></header>${renderChordTrack(instance)}<div class="mga-region-scroll">${renderRegionTimeline(instance)}</div></section>
      <aside class="mga-version-panel mga-panel"><header class="mga-panel-head"><div><small>BRANCH & VERSION</small><h3>Lịch sử không phá hủy</h3></div><b>${editor.branches.length}/${MAX_BRANCHES}</b></header>
        <div class="mga-branch-list">${editor.branches.slice().reverse().map((item) => `<button type="button" data-mga-branch="${escapeHtml(item.id)}" class="${item.id === editor.activeBranchId ? "is-active" : ""}"><i></i><span><strong>${escapeHtml(item.name)}</strong><small>${item.versions.length} phiên bản · từ ${escapeHtml(item.parentId || "root")}</small></span></button>`).join("")}</div>
        <div class="mga-compare-controls"><label>Trước<select data-mga-compare="beforeId">${versions.map((version) => `<option value="${escapeHtml(version.id)}" ${version.id === editor.compare.beforeId ? "selected" : ""}>${escapeHtml(version.branchName)} · ${escapeHtml(version.label)}</option>`).join("")}</select></label><label>Sau<select data-mga-compare="afterId">${versions.map((version) => `<option value="${escapeHtml(version.id)}" ${version.id === editor.compare.afterId ? "selected" : ""}>${escapeHtml(version.branchName)} · ${escapeHtml(version.label)}</option>`).join("")}</select></label></div>
        <div class="mga-comparison">${comparison.found ? `<span><b>+${comparison.added.length}</b> thêm</span><span><b>~${comparison.changed.length}</b> đổi</span><span><b>-${comparison.removed.length}</b> xóa</span>` : "<p>Chọn hai phiên bản để so sánh.</p>"}</div>
        <div class="mga-version-list">${branch.versions.slice().reverse().map((version) => `<article><i></i><div><strong>${escapeHtml(version.label)}</strong><small>${new Date(version.createdAt).toLocaleString("vi-VN")}</small></div><button type="button" data-mga-restore="${escapeHtml(version.id)}">Khôi phục</button></article>`).join("")}</div>
      </aside></div>
    </main>`;
  }

  function render(instance) {
    const state = instance.state;
    instance.host.innerHTML = `<section class="mga-shell" data-view="${instance.view}">
      <header class="mga-hero"><div class="mga-brand"><span>GA</span><i></i></div><div><small>HH GENERATIVE ARRANGEMENT · v${VERSION}</small><h1>${instance.view === "session-band" ? "Session Band" : "Region Editor"}</h1><p>${instance.view === "session-band" ? "Sáu nhạc công theo Chord Track, Song DNA và piano roll MIDI." : "Chọn vùng, tạo branch và thử biến thể mà không phá bản gốc."}</p></div><div class="mga-hero-stats"><span><b>${state.project.bpm}</b>BPM</span><span><b>${escapeHtml(state.project.key)}</b>Tone</span><span><b>${state.project.bars}</b>Bars</span></div></header>
      <nav class="mga-view-tabs" role="tablist" aria-label="Generative Arrangement"><button type="button" role="tab" aria-selected="${instance.view === "session-band"}" data-mga-view="session-band"><i>SB</i><span>Session Band<small>Nhạc công và MIDI</small></span></button><button type="button" role="tab" aria-selected="${instance.view === "region-editor"}" data-mga-view="region-editor"><i>RE</i><span>Region Editor<small>Branch và biến thể</small></span></button><div><span class="mga-context-state ${state.project.contextSource === "HHMusicProjectContext" ? "is-online" : ""}"><i></i>${state.project.contextSource === "HHMusicProjectContext" ? "Đồng bộ Project Context" : "Fallback deterministic"}</span><button type="button" data-mga-action="save">Lưu</button></div></nav>
      ${instance.view === "session-band" ? renderSessionBand(instance) : renderRegionEditor(instance)}
      <footer class="mga-footer"><span>Local-first · Versioned storage · Không chứa API key</span><span>${state.updatedAt ? `Lưu lúc ${new Date(state.updatedAt).toLocaleTimeString("vi-VN")}` : "Sẵn sàng"}</span></footer><div class="mga-toast" role="status" aria-live="polite"></div>
    </section>`;
  }

  function persist(instance, message = "Đã lưu trên thiết bị.") {
    instance.state = saveState(instance.state, instance.storage);
    if (message) toast(instance, message);
  }

  function toast(instance, message, type = "success") {
    const target = instance.host.querySelector(".mga-toast");
    if (!target) return;
    root.clearTimeout(instance.toastTimer);
    target.textContent = message;
    target.dataset.type = type;
    target.classList.add("is-visible");
    instance.toastTimer = root.setTimeout(() => target.classList.remove("is-visible"), 2400);
  }

  function regenerate(instance, instrumentId) {
    const ids = instrumentId ? [instrumentId] : INSTRUMENTS.map((item) => item.id);
    ids.forEach((id) => {
      const musician = instance.state.sessionBand.musicians[id];
      musician.generation += 1;
      instance.state.sessionBand.patterns[id] = generateInstrumentPattern(instance.state.project, musician);
    });
    instance.state.sessionBand.selectedNoteId = "";
    persist(instance, instrumentId ? `Đã tạo lại ${INSTRUMENT_MAP[instrumentId].label}.` : "Đã điều phối lại toàn bộ ban nhạc.");
    render(instance);
  }

  function addNote(instance, pitch = 60, startBeat = 0) {
    const id = instance.state.sessionBand.activeInstrument;
    const chord = chordAtBar(instance.state.project.chordTrack, Math.floor(startBeat / beatsPerBar(instance.state.project.timeSignature)));
    const note = normalizeNote({ id: makeId(id), pitch, startBeat, durationBeats: 1, velocity: 96, chordId: chord.id, chordSymbol: chord.symbol });
    instance.state.sessionBand.patterns[id].push(note);
    instance.state.sessionBand.patterns[id].sort((a, b) => a.startBeat - b.startBeat || a.pitch - b.pitch);
    instance.state.sessionBand.selectedNoteId = note.id;
    persist(instance, "Đã thêm nốt vào piano roll.");
    render(instance);
  }

  function downloadMidi(instance, instrumentId) {
    const bytes = exportMidi(instance.state, instrumentId);
    const suffix = instrumentId === "all" ? "session-band" : instrumentId;
    downloadBlob(new Blob([bytes], { type: "audio/midi" }), `${safeId(instance.state.project.title, "hh-song")}-${suffix}.mid`);
    toast(instance, `Đã xuất MIDI ${instrumentId === "all" ? "toàn ban nhạc" : INSTRUMENT_MAP[instrumentId].label}.`);
  }

  function executeRegionOperation(instance, operation) {
    const replacement = instance.host.querySelector("[data-mga-replace-instrument]")?.value || "synth";
    instance.state.regionEditor = applyRegionOperation(instance.state.regionEditor, operation, { project: instance.state.project, instrument: replacement });
    instance.state.regionEditor.provider = { configured: instance.provider.configured, status: instance.provider.configured ? "ready" : "local", name: instance.provider.name, message: instance.provider.message };
    persist(instance, `Đã tạo branch mới: ${operationLabel(operation)}.`);
    render(instance);
  }

  function handleClick(instance, event) {
    const target = event.target.closest("button");
    if (!target || !instance.host.contains(target)) return;
    if (target.dataset.mgaView) { instance.view = target.dataset.mgaView; render(instance); return; }
    if (target.dataset.mgaInstrument) { instance.state.sessionBand.activeInstrument = target.dataset.mgaInstrument; instance.state.sessionBand.selectedNoteId = ""; render(instance); return; }
    if (target.dataset.noteId) { instance.state.sessionBand.selectedNoteId = target.dataset.noteId; render(instance); return; }
    if (target.dataset.mgaRegion) {
      const region = activeBranch(instance.state).regions.find((item) => item.id === target.dataset.mgaRegion);
      if (region) { instance.state.regionEditor.selection = { startBeat: region.startBeat, endBeat: region.endBeat }; render(instance); }
      return;
    }
    if (target.dataset.mgaBranch) { instance.state.regionEditor.activeBranchId = target.dataset.mgaBranch; const branch = activeBranch(instance.state); const last = branch.versions.at(-1)?.id || ""; instance.state.regionEditor.compare = { beforeId: branch.versions.at(-2)?.id || last, afterId: last }; render(instance); return; }
    if (target.dataset.mgaRestore) { instance.state.regionEditor = restoreVersion(instance.state.regionEditor, target.dataset.mgaRestore); persist(instance, "Đã khôi phục dưới dạng phiên bản mới."); render(instance); return; }
    if (target.dataset.mgaRegionOperation) { executeRegionOperation(instance, target.dataset.mgaRegionOperation); return; }
    const action = target.dataset.mgaAction;
    if (!action) return;
    if (action === "save") { persist(instance); render(instance); }
    if (action === "generate-all") regenerate(instance);
    if (action === "generate-one") regenerate(instance, target.dataset.instrument);
    if (action === "add-note") addNote(instance, instance.state.sessionBand.activeInstrument === "drums" ? 42 : 60, 0);
    if (action === "delete-note") {
      const id = instance.state.sessionBand.activeInstrument;
      instance.state.sessionBand.patterns[id] = instance.state.sessionBand.patterns[id].filter((note) => note.id !== instance.state.sessionBand.selectedNoteId);
      instance.state.sessionBand.selectedNoteId = ""; persist(instance, "Đã xóa nốt."); render(instance);
    }
    if (action === "quantize") {
      const id = instance.state.sessionBand.activeInstrument;
      instance.state.sessionBand.patterns[id].forEach((note) => { note.startBeat = Math.round(note.startBeat * 4) / 4; note.durationBeats = Math.max(.25, Math.round(note.durationBeats * 4) / 4); });
      persist(instance, "Đã quantize theo 1/4 beat."); render(instance);
    }
    if (action === "transpose-up" || action === "transpose-down") {
      const delta = action === "transpose-up" ? 12 : -12;
      const id = instance.state.sessionBand.activeInstrument;
      instance.state.sessionBand.patterns[id].forEach((note) => { note.pitch = Math.round(clamp(note.pitch + delta, 24, 108)); });
      persist(instance, `Đã ${delta > 0 ? "tăng" : "hạ"} một quãng tám.`); render(instance);
    }
    if (action === "export-midi-one") downloadMidi(instance, instance.state.sessionBand.activeInstrument);
    if (action === "export-midi-all") downloadMidi(instance, "all");
    if (action === "provider-run") callProvider(instance, "regenerate");
  }

  function handleChange(instance, event) {
    const target = event.target;
    if (target.dataset.mgaMusicianField) {
      const musician = instance.state.sessionBand.musicians[target.dataset.instrument];
      const field = target.dataset.mgaMusicianField;
      musician[field] = field === "enabled" ? target.checked : ["complexity", "energy", "density"].includes(field) ? Math.round(clamp(target.value, 0, 100)) : cleanText(target.value, 60);
      instance.state.sessionBand.patterns[musician.id] = generateInstrumentPattern(instance.state.project, musician);
      persist(instance, `Đã cập nhật ${INSTRUMENT_MAP[musician.id].label}.`); render(instance); return;
    }
    if (target.dataset.mgaProjectField) {
      const field = target.dataset.mgaProjectField;
      instance.state.project[field] = ["bpm", "bars", "seed"].includes(field) ? Number(target.value) : cleanText(target.value, 40);
      instance.state.project = normalizeProject(instance.state.project);
      for (const item of INSTRUMENTS) instance.state.sessionBand.patterns[item.id] = generateInstrumentPattern(instance.state.project, instance.state.sessionBand.musicians[item.id]);
      persist(instance, "Đã cập nhật thiết lập dự án."); render(instance); return;
    }
    if (target.dataset.mgaDnaField) { instance.state.project.songDNA[target.dataset.mgaDnaField] = cleanText(target.value, 160); persist(instance, "Đã cập nhật Song DNA."); render(instance); return; }
    if (target.dataset.mgaSelection) {
      const total = instance.state.project.bars * beatsPerBar(instance.state.project.timeSignature);
      const selection = instance.state.regionEditor.selection;
      selection[target.dataset.mgaSelection] = Number(target.value);
      selection.startBeat = clamp(selection.startBeat, 0, total - .25);
      selection.endBeat = clamp(selection.endBeat, selection.startBeat + .25, total);
      persist(instance, ""); render(instance); return;
    }
    if (target.dataset.mgaLock) { instance.state.regionEditor.locks[target.dataset.mgaLock] = target.checked; persist(instance, "Đã cập nhật khóa biến thể."); render(instance); return; }
    if (target.dataset.mgaCompare) { instance.state.regionEditor.compare[target.dataset.mgaCompare] = target.value; persist(instance, ""); render(instance); return; }
    if (target.dataset.mgaNoteField) {
      const notes = instance.state.sessionBand.patterns[instance.state.sessionBand.activeInstrument];
      const note = notes.find((item) => item.id === instance.state.sessionBand.selectedNoteId);
      if (note) note[target.dataset.mgaNoteField] = target.dataset.mgaNoteField === "velocity" ? Math.round(clamp(target.value, 1, 127)) : Math.round(clamp(target.value, .25, 32) * 4) / 4;
      persist(instance, "Đã cập nhật nốt."); render(instance);
    }
  }

  function handleDoubleClick(instance, event) {
    const roll = event.target.closest("[data-mga-piano-roll]");
    if (!roll || event.target.closest("[data-note-id]")) return;
    const rect = roll.getBoundingClientRect();
    const pitchMin = Number(roll.dataset.pitchMin);
    const pitchMax = Number(roll.dataset.pitchMax);
    const totalBeats = instance.state.project.bars * beatsPerBar(instance.state.project.timeSignature);
    const startBeat = Math.round(clamp((event.clientX - rect.left) / rect.width, 0, .999) * totalBeats * 4) / 4;
    const pitch = Math.round(pitchMax - clamp((event.clientY - rect.top) / rect.height, 0, .999) * (pitchMax - pitchMin));
    addNote(instance, pitch, startBeat);
  }

  function handleKeydown(instance, event) {
    if ((event.key === "Delete" || event.key === "Backspace") && instance.state.sessionBand.selectedNoteId && !/INPUT|TEXTAREA|SELECT/.test(event.target.tagName)) {
      event.preventDefault();
      instance.host.querySelector('[data-mga-action="delete-note"]')?.click();
    }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") { event.preventDefault(); persist(instance); render(instance); }
  }

  function refreshFromSharedContext(instance) {
    const result = applySharedContext(instance.state);
    instance.state = result.state;
    if (result.changed) {
      persist(instance, "Chord Track và Song DNA đã đồng bộ từ Project Context.");
      render(instance);
    }
  }

  function mount(host, options = {}) {
    if (!host || typeof host.addEventListener !== "function") throw new TypeError("HHMusicGenerativeArrangement.mount cần một DOM host hợp lệ.");
    unmount();
    const storage = options.storage || browserScope.localStorage;
    const initial = loadState(storage);
    const sharedResult = applySharedContext(initial);
    const instance = {
      host,
      storage,
      options,
      state: sharedResult.state,
      view: supports(options.view) ? options.view : "session-band",
      provider: resolveProvider(options),
      controller: new root.AbortController(),
      toastTimer: 0,
      unsubscribeContext: () => {},
      handlers: {}
    };
    instance.state.regionEditor.provider = { configured: instance.provider.configured, status: instance.provider.status, name: instance.provider.name, message: instance.provider.message };
    instance.handlers.click = (event) => handleClick(instance, event);
    instance.handlers.change = (event) => handleChange(instance, event);
    instance.handlers.dblclick = (event) => handleDoubleClick(instance, event);
    instance.handlers.keydown = (event) => handleKeydown(instance, event);
    host.addEventListener("click", instance.handlers.click);
    host.addEventListener("change", instance.handlers.change);
    host.addEventListener("dblclick", instance.handlers.dblclick);
    host.addEventListener("keydown", instance.handlers.keydown);
    host.setAttribute("data-hh-music-generative-arrangement", "");
    instance.unsubscribeContext = subscribeSharedProjectContext(() => refreshFromSharedContext(instance));
    active = instance;
    render(instance);
    return Object.freeze({
      getState: () => clone(instance.state),
      setView(nextView) { if (!supports(nextView)) return false; instance.view = nextView; render(instance); return true; },
      refreshProjectContext: () => refreshFromSharedContext(instance),
      save: () => persist(instance),
      unmount
    });
  }

  function unmount() {
    if (!active) return false;
    const instance = active;
    instance.host.removeEventListener("click", instance.handlers.click);
    instance.host.removeEventListener("change", instance.handlers.change);
    instance.host.removeEventListener("dblclick", instance.handlers.dblclick);
    instance.host.removeEventListener("keydown", instance.handlers.keydown);
    instance.unsubscribeContext();
    instance.controller.abort();
    root.clearTimeout(instance.toastTimer);
    instance.host.removeAttribute("data-hh-music-generative-arrangement");
    instance.host.replaceChildren();
    active = null;
    return true;
  }

  const browserApi = Object.freeze({ supports, mount, unmount });
  const testApi = Object.freeze({
    VERSION, STORAGE_KEY, VIEWS, INSTRUMENTS, REGION_ACTIONS, PPQ,
    clamp, cleanText, escapeHtml, hashSeed, seededRandom, beatsPerBar, noteName, parseChord,
    normalizeChordTrack, normalizeSongDNA, normalizeMusician, normalizeNote, normalizeProject, normalizeRegion,
    createDefaultState, normalizeState, loadState, saveState, applySharedContext,
    generateInstrumentPattern, applyRegionOperation, compareVersions, restoreVersion, exportMidi,
    readSharedProjectContext, subscribeSharedProjectContext, resolveProvider, supports, mount, unmount
  });
  if (typeof module !== "undefined" && module.exports) module.exports = testApi;
  browserScope.HHMusicGenerativeArrangement = browserApi;
}(typeof globalThis !== "undefined" ? globalThis : this));
