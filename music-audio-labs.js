(function () {
  "use strict";

  const STORAGE_KEY = "hh.music.audio-labs.v1";
  const SUPPORTED = new Set(["stems", "vocal", "sound-design"]);
  const AUDIO_TYPES = ["audio/mpeg", "audio/wav", "audio/x-wav", "audio/ogg", "audio/webm", "audio/mp4", "audio/aac", "audio/flac"];
  const STEM_TYPES = ["vocal", "drums", "bass", "guitar", "piano", "other"];
  const SFX_TYPES = ["ambience", "impact", "riser", "whoosh", "foley", "loop"];
  const DEFAULTS = {
    version: 1,
    stems: {
      mode: "full",
      master: 0.9,
      tracks: [],
      sync: { enabled: true, toleranceMs: 12, referenceTrackId: "" },
      replacements: [],
      separation: { status: "idle", detail: "", adapter: "none" }
    },
    vocal: {
      inputGain: 1,
      highPass: 80,
      presence: 1,
      compressor: true,
      deEsser: 35,
      pitchCorrection: 0,
      lyric: "",
      cues: [],
      takes: [],
      selectedTake: "",
      selection: { start: 0, end: 4 },
      compSegments: [],
      timingCorrection: 0,
      breathControl: 0,
      harmonyAmount: 0,
      harmonyInterval: 3,
      voiceClone: { ownerConfirmed: false, purposeConfirmed: false }
    },
    sound: {
      prompt: "Mưa nhẹ ngoài cửa sổ, ấm áp, không sấm, loop liền mạch",
      type: "ambience",
      duration: 8,
      bpm: 80,
      key: "C major",
      items: [],
      backend: { status: "unknown", detail: "Chưa kiểm tra" }
    },
    updatedAt: ""
  };

  let host = null;
  let view = "stems";
  let options = {};
  let state = loadState();
  let controller = null;
  let audioContext = null;
  let masterNode = null;
  let masterAnalyser = null;
  let playback = { playing: false, startedAt: 0, offset: 0, duration: 0, sources: new Map(), frame: 0 };
  let mediaStream = null;
  let mediaRecorder = null;
  let recordChunks = [];
  let recordStartedAt = 0;
  let recordTimer = 0;
  let activePreview = null;
  const runtimeTracks = new Map();
  const runtimeTakes = new Map();
  const runtimeSounds = new Map();
  const objectUrls = new Set();

  const escapeHtml = (value) => String(value ?? "").replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char]);
  const clamp = (value, min, max) => {
    const numeric = Number(value);
    return Math.min(max, Math.max(min, Number.isFinite(numeric) ? numeric : min));
  };
  const uid = (prefix) => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const formatTime = (seconds) => {
    const safe = Math.max(0, Number(seconds) || 0);
    const minutes = Math.floor(safe / 60);
    return `${String(minutes).padStart(2, "0")}:${String(Math.floor(safe % 60)).padStart(2, "0")}.${String(Math.floor((safe % 1) * 10))}`;
  };
  const bytes = (value) => {
    const size = Number(value) || 0;
    if (size < 1024) return `${size} B`;
    if (size < 1048576) return `${(size / 1024).toFixed(1)} KB`;
    return `${(size / 1048576).toFixed(1)} MB`;
  };

  function getProjectMusicContext() {
    try {
      const snapshot = window.HHMusicProjectContext?.getSnapshot?.();
      if (snapshot && typeof snapshot === "object") {
        const bpm = Number(snapshot.bpm);
        return {
          source: "HHMusicProjectContext",
          bpm: Number.isFinite(bpm) && bpm > 0 ? bpm : null,
          key: String(snapshot.key || snapshot.musicalKey || "").trim() || null
        };
      }
    } catch {}
    return { source: "standalone", bpm: null, key: null };
  }

  function cloneDefaults() {
    return JSON.parse(JSON.stringify(DEFAULTS));
  }

  function loadState() {
    const base = cloneDefaults();
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
      if (!saved || typeof saved !== "object") return base;
      return {
        ...base,
        ...saved,
        stems: {
          ...base.stems,
          ...(saved.stems || {}),
          sync: {
            ...base.stems.sync,
            ...(saved.stems?.sync || {}),
            enabled: typeof saved.stems?.sync?.enabled === "boolean" ? saved.stems.sync.enabled : (saved.stems?.tracks || []).every((item) => Math.abs(Number(item.offset) || 0) <= base.stems.sync.toleranceMs / 1000)
          },
          tracks: Array.isArray(saved.stems?.tracks) ? saved.stems.tracks.map((item) => ({ ...item, availableThisSession: false })) : [],
          replacements: Array.isArray(saved.stems?.replacements) ? saved.stems.replacements.map((item) => ({ ...item, active: false, status: "draft" })) : []
        },
        vocal: {
          ...base.vocal,
          ...(saved.vocal || {}),
          cues: Array.isArray(saved.vocal?.cues) ? saved.vocal.cues : [],
          takes: Array.isArray(saved.vocal?.takes) ? saved.vocal.takes.map((item) => ({ ...item, availableThisSession: false })) : [],
          selection: { ...base.vocal.selection, ...(saved.vocal?.selection || {}) },
          compSegments: Array.isArray(saved.vocal?.compSegments) ? saved.vocal.compSegments : [],
          voiceClone: { ...base.vocal.voiceClone, ...(saved.vocal?.voiceClone || {}) }
        },
        sound: { ...base.sound, ...(saved.sound || {}), items: Array.isArray(saved.sound?.items) ? saved.sound.items.map((item) => ({ ...item, availableThisSession: false })) : [] }
      };
    } catch {
      return base;
    }
  }

  function saveState() {
    state.updatedAt = new Date().toISOString();
    const safe = JSON.parse(JSON.stringify(state));
    safe.vocal.voiceClone = { ownerConfirmed: false, purposeConfirmed: false };
    safe.stems.tracks = safe.stems.tracks.map((item) => ({ ...item, availableThisSession: false }));
    safe.vocal.takes = safe.vocal.takes.map((item) => ({ ...item, availableThisSession: false }));
    safe.sound.items = safe.sound.items.map((item) => ({ ...item, availableThisSession: false }));
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(safe)); } catch {}
  }

  function makeUrl(blob) {
    const url = URL.createObjectURL(blob);
    objectUrls.add(url);
    return url;
  }

  function revokeUrl(url) {
    if (!url) return;
    URL.revokeObjectURL(url);
    objectUrls.delete(url);
  }

  function getAudioContext() {
    if (!audioContext || audioContext.state === "closed") {
      const Context = window.AudioContext || window.webkitAudioContext;
      if (!Context) throw new Error("Trình duyệt này không hỗ trợ Web Audio API.");
      audioContext = new Context();
      masterNode = audioContext.createGain();
      masterAnalyser = audioContext.createAnalyser();
      masterAnalyser.fftSize = 256;
      masterNode.connect(masterAnalyser).connect(audioContext.destination);
    }
    return audioContext;
  }

  async function decodeFile(file) {
    const context = getAudioContext();
    if (context.state === "suspended") await context.resume();
    const data = await file.arrayBuffer();
    return context.decodeAudioData(data.slice(0));
  }

  function analyzeBuffer(buffer) {
    const channel = buffer.getChannelData(0);
    const stride = Math.max(1, Math.floor(channel.length / 160));
    const waveform = [];
    let peak = 0;
    let sum = 0;
    let zeroCrossings = 0;
    let previous = channel[0] || 0;
    for (let index = 0; index < channel.length; index += 1) {
      const sample = channel[index];
      const absolute = Math.abs(sample);
      peak = Math.max(peak, absolute);
      sum += sample * sample;
      if ((sample >= 0) !== (previous >= 0)) zeroCrossings += 1;
      previous = sample;
      if (index % stride === 0) waveform.push(sample);
    }
    const health = analyzeAudioHealth(buffer);
    return {
      duration: buffer.duration,
      channels: buffer.numberOfChannels,
      sampleRate: buffer.sampleRate,
      peakDb: peak ? 20 * Math.log10(peak) : -Infinity,
      rmsDb: channel.length ? 20 * Math.log10(Math.sqrt(sum / channel.length) || 0.000001) : -Infinity,
      zeroCrossingHz: buffer.duration ? zeroCrossings / (buffer.duration * 2) : 0,
      health,
      waveform
    };
  }

  function dbFromAmplitude(value) {
    return value > 0 ? 20 * Math.log10(value) : -120;
  }

  function mergeAnalysisRanges(ranges, minimumDuration = 0.08, limit = 80) {
    const merged = [];
    ranges.forEach((range) => {
      const previous = merged[merged.length - 1];
      if (previous && range.start - previous.end <= 0.03) previous.end = range.end;
      else merged.push({ start: range.start, end: range.end });
    });
    return merged
      .filter((range) => range.end - range.start >= minimumDuration)
      .slice(0, limit)
      .map((range) => ({ start: Number(range.start.toFixed(3)), end: Number(range.end.toFixed(3)) }));
  }

  function analyzeAudioHealth(buffer) {
    const sampleRate = buffer.sampleRate || 44100;
    const frameSize = Math.max(128, Math.round(sampleRate * 0.02));
    const silenceThreshold = -52;
    const clippingThreshold = 0.999;
    const frames = [];
    const silence = [];
    const clipping = [];
    let clippedSamples = 0;
    let totalSamples = 0;
    for (let offset = 0; offset < buffer.length; offset += frameSize) {
      const end = Math.min(buffer.length, offset + frameSize);
      let sum = 0;
      let peak = 0;
      let frameClips = 0;
      for (let channelIndex = 0; channelIndex < buffer.numberOfChannels; channelIndex += 1) {
        const channel = buffer.getChannelData(channelIndex);
        for (let index = offset; index < end; index += 1) {
          const sample = channel[index] || 0;
          const absolute = Math.abs(sample);
          sum += sample * sample;
          peak = Math.max(peak, absolute);
          if (absolute >= clippingThreshold) frameClips += 1;
          totalSamples += 1;
        }
      }
      const count = Math.max(1, (end - offset) * buffer.numberOfChannels);
      const rmsDb = dbFromAmplitude(Math.sqrt(sum / count));
      const startTime = offset / sampleRate;
      const endTime = end / sampleRate;
      frames.push({ rmsDb, peakDb: dbFromAmplitude(peak) });
      if (rmsDb <= silenceThreshold) silence.push({ start: startTime, end: endTime });
      if (frameClips) clipping.push({ start: startTime, end: endTime });
      clippedSamples += frameClips;
    }
    const audibleFrames = frames.map((frame) => frame.rmsDb).filter((value) => value > -90).sort((a, b) => a - b);
    const percentileIndex = Math.max(0, Math.floor(audibleFrames.length * 0.15) - 1);
    const noiseFloorDb = audibleFrames.length ? audibleFrames[percentileIndex] : -120;
    const silenceRanges = mergeAnalysisRanges(silence, 0.12);
    const clippingRanges = mergeAnalysisRanges(clipping, 0.02);
    const silenceDuration = silenceRanges.reduce((sum, range) => sum + range.end - range.start, 0);
    return {
      method: "windowed-rms-local-v1",
      windowMs: Math.round(frameSize / sampleRate * 1000),
      silenceThresholdDb: silenceThreshold,
      silenceRatio: buffer.duration ? clamp(silenceDuration / buffer.duration, 0, 1) : 0,
      silenceRanges,
      noiseFloorDb: Number(noiseFloorDb.toFixed(1)),
      noiseRisk: noiseFloorDb > -38 ? "high" : noiseFloorDb > -48 ? "medium" : "low",
      clippingThreshold,
      clippedSamples,
      clippingRatio: totalSamples ? clippedSamples / totalSamples : 0,
      clippingRanges
    };
  }

  function inferStem(name) {
    const value = String(name || "").toLowerCase();
    if (/vocal|voice|acapella|vox/.test(value)) return "vocal";
    if (/drum|kick|snare|perc/.test(value)) return "drums";
    if (/bass|sub/.test(value)) return "bass";
    if (/guitar|gtr/.test(value)) return "guitar";
    if (/piano|keys|keyboard/.test(value)) return "piano";
    return "other";
  }

  function isAudioFile(file) {
    return file && (String(file.type).startsWith("audio/") || AUDIO_TYPES.includes(file.type) || /\.(mp3|wav|ogg|m4a|aac|flac|webm)$/i.test(file.name));
  }

  function metadataFromRuntime(item) {
    return {
      id: item.id,
      name: item.name,
      stem: item.stem,
      size: item.file?.size || item.size || 0,
      mimeType: item.file?.type || item.mimeType || "audio/*",
      duration: item.analysis?.duration || item.duration || 0,
      channels: item.analysis?.channels || item.channels || 0,
      sampleRate: item.analysis?.sampleRate || item.sampleRate || 0,
      peakDb: Number.isFinite(item.analysis?.peakDb) ? item.analysis.peakDb : null,
      rmsDb: Number.isFinite(item.analysis?.rmsDb) ? item.analysis.rmsDb : null,
      health: item.analysis?.health || item.health || null,
      volume: item.volume ?? 1,
      pan: item.pan ?? 0,
      mute: Boolean(item.mute),
      solo: Boolean(item.solo),
      offset: item.offset || 0,
      source: item.source || "local",
      availableThisSession: Boolean(item.buffer),
      addedAt: item.addedAt || new Date().toISOString()
    };
  }

  async function importAudioFiles(files, target) {
    const list = Array.from(files || []).filter(isAudioFile);
    if (!list.length) return notify("Không tìm thấy tệp âm thanh được hỗ trợ.", "error");
    notify(`Đang giải mã ${list.length} tệp bằng Web Audio...`, "info");
    for (const file of list) {
      try {
        const buffer = await decodeFile(file);
        const analysis = analyzeBuffer(buffer);
        const item = {
          id: uid(target === "stem" ? "stem" : target === "take" ? "take" : "sfx"),
          name: file.name,
          stem: target === "stem" ? inferStem(file.name) : target,
          file,
          url: makeUrl(file),
          buffer,
          analysis,
          volume: 1,
          pan: 0,
          mute: false,
          solo: false,
          source: "local",
          addedAt: new Date().toISOString()
        };
        if (target === "stem") {
          runtimeTracks.set(item.id, item);
          state.stems.tracks.push(metadataFromRuntime(item));
          if (!state.stems.sync.referenceTrackId) state.stems.sync.referenceTrackId = item.id;
        } else if (target === "take") {
          runtimeTakes.set(item.id, item);
          state.vocal.takes.push({ ...metadataFromRuntime(item), label: `Take ${state.vocal.takes.length + 1}`, lane: state.vocal.takes.length + 1 });
          state.vocal.selectedTake = item.id;
        } else {
          runtimeSounds.set(item.id, item);
          state.sound.items.push({ ...metadataFromRuntime(item), type: state.sound.type, bpm: state.sound.bpm, key: state.sound.key, prompt: "Tệp cục bộ" });
        }
      } catch (error) {
        notify(`Không đọc được ${file.name}: ${error.message}`, "error");
      }
    }
    saveState();
    render();
    notify(`Đã nạp ${list.length} tệp. Audio chỉ tồn tại trong phiên hiện tại.`);
  }

  function trackRuntime(id) {
    return runtimeTracks.get(id) || runtimeTakes.get(id) || runtimeSounds.get(id);
  }

  function updateMetadata(collection, id, patch) {
    const item = collection.find((entry) => entry.id === id);
    if (item) Object.assign(item, patch);
    const runtime = trackRuntime(id);
    if (runtime) Object.assign(runtime, patch);
    saveState();
  }

  function resolvedStemTracks() {
    const activeDrafts = state.stems.replacements.filter((draft) => draft.active);
    const replacementSources = new Set(activeDrafts.map((draft) => draft.replacementTrackId));
    return state.stems.tracks
      .filter((metadata) => !replacementSources.has(metadata.id) || activeDrafts.some((draft) => draft.targetTrackId === metadata.id))
      .map((metadata) => {
        const draft = activeDrafts.find((entry) => entry.targetTrackId === metadata.id);
        const sourceMetadata = draft ? state.stems.tracks.find((entry) => entry.id === draft.replacementTrackId) : metadata;
        const runtime = sourceMetadata ? runtimeTracks.get(sourceMetadata.id) : null;
        if (!runtime?.buffer) return null;
        return {
          ...runtime,
          id: metadata.id,
          name: draft ? `${metadata.name} ← ${sourceMetadata.name}` : metadata.name,
          stem: metadata.stem,
          offset: metadata.offset || 0,
          volume: metadata.volume ?? 1,
          pan: metadata.pan ?? 0,
          mute: Boolean(metadata.mute),
          solo: Boolean(metadata.solo),
          replacementDraftId: draft?.id || ""
        };
      })
      .filter(Boolean);
  }

  function stopPlayback(reset = false) {
    playback.sources.forEach((entry) => {
      try { entry.source.stop(); } catch {}
      try { entry.source.disconnect(); entry.gain.disconnect(); entry.pan?.disconnect(); } catch {}
    });
    playback.sources.clear();
    cancelAnimationFrame(playback.frame);
    if (playback.playing && audioContext) playback.offset += audioContext.currentTime - playback.startedAt;
    playback.playing = false;
    if (reset) playback.offset = 0;
    updateTransportUI();
  }

  async function playStemMix() {
    const context = getAudioContext();
    await context.resume();
    if (playback.playing) return stopPlayback(false);
    const tracks = resolvedStemTracks();
    if (!tracks.length) return notify("Hãy nạp stem hoặc bản mix trước.", "error");
    const hasSolo = tracks.some((item) => item.solo);
    playback.duration = Math.max(...tracks.map((item) => item.buffer.duration + (item.offset || 0)), 0);
    if (playback.offset >= playback.duration) playback.offset = 0;
    masterNode.gain.value = clamp(state.stems.master, 0, 1.5);
    tracks.forEach((item) => {
      if (item.mute || (hasSolo && !item.solo)) return;
      const source = context.createBufferSource();
      const gain = context.createGain();
      const pan = context.createStereoPanner ? context.createStereoPanner() : null;
      source.buffer = item.buffer;
      gain.gain.value = clamp(item.volume, 0, 1.5);
      if (pan) pan.pan.value = clamp(item.pan, -1, 1);
      source.connect(gain);
      if (pan) gain.connect(pan).connect(masterNode); else gain.connect(masterNode);
      const timelineOffset = item.offset || 0;
      const sourceOffset = Math.max(0, playback.offset - timelineOffset);
      const delay = Math.max(0, timelineOffset - playback.offset);
      if (sourceOffset < item.buffer.duration) source.start(context.currentTime + delay, sourceOffset);
      playback.sources.set(item.id, { source, gain, pan });
    });
    playback.startedAt = context.currentTime;
    playback.playing = true;
    tickTransport();
  }

  function tickTransport() {
    if (!playback.playing || !audioContext) return;
    const current = Math.min(playback.duration, playback.offset + audioContext.currentTime - playback.startedAt);
    const position = host?.querySelector("[data-mal-position]");
    const progress = host?.querySelector("[data-mal-progress]");
    if (position) position.textContent = formatTime(current);
    if (progress) progress.value = playback.duration ? current / playback.duration * 100 : 0;
    if (masterAnalyser) {
      const values = new Uint8Array(masterAnalyser.frequencyBinCount);
      masterAnalyser.getByteFrequencyData(values);
      const level = values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length) / 255;
      host?.querySelectorAll("[data-mal-meter]").forEach((meter, index) => { meter.style.setProperty("--level", `${Math.min(100, level * (105 + index * 8))}%`); });
    }
    if (current >= playback.duration) return stopPlayback(true);
    playback.frame = requestAnimationFrame(tickTransport);
  }

  function updateTransportUI() {
    const button = host?.querySelector('[data-mal-action="play-mix"]');
    if (button) button.textContent = playback.playing ? "Tạm dừng" : "Phát";
    const position = host?.querySelector("[data-mal-position]");
    if (position) position.textContent = formatTime(playback.offset);
  }

  function applyRouting(mode) {
    state.stems.mode = mode;
    state.stems.tracks.forEach((track) => {
      if (mode === "instrumental" || mode === "karaoke") track.mute = track.stem === "vocal";
      else if (mode === "acapella") track.mute = track.stem !== "vocal";
      else track.mute = false;
      updateMetadata(state.stems.tracks, track.id, { mute: track.mute });
    });
    stopPlayback(true);
    saveState();
    render();
  }

  function synchronizeStemTracks() {
    stopPlayback(true);
    state.stems.tracks.forEach((track) => updateMetadata(state.stems.tracks, track.id, { offset: 0 }));
    state.stems.sync.enabled = true;
    state.stems.sync.referenceTrackId = state.stems.tracks[0]?.id || "";
    saveState();
    render();
    notify("Đã căn mọi track về mốc 00:00. Audio gốc không bị thay đổi.");
  }

  function createStemReplacementDraft() {
    const targetTrackId = host?.querySelector("[data-mal-replacement-target]")?.value || "";
    const replacementTrackId = host?.querySelector("[data-mal-replacement-source]")?.value || "";
    if (!targetTrackId || !replacementTrackId || targetTrackId === replacementTrackId) return notify("Chọn hai track khác nhau để tạo bản thay thế.", "error");
    const target = state.stems.tracks.find((track) => track.id === targetTrackId);
    const replacement = state.stems.tracks.find((track) => track.id === replacementTrackId);
    if (!target || !replacement) return notify("Track thay thế không còn tồn tại.", "error");
    state.stems.replacements.push({
      id: uid("replacement"),
      targetTrackId,
      replacementTrackId,
      targetName: target.name,
      replacementName: replacement.name,
      preserveOffset: true,
      preserveMixSettings: true,
      active: false,
      status: "draft",
      createdAt: new Date().toISOString()
    });
    saveState();
    render();
    notify("Đã tạo replacement draft. Bật audition để nghe mà không sửa file gốc.");
  }

  function toggleStemReplacement(id) {
    const draft = state.stems.replacements.find((entry) => entry.id === id);
    if (!draft) return;
    if (!runtimeTracks.get(draft.replacementTrackId)?.buffer) return notify("Hãy nạp lại file nguồn thay thế trong phiên này.", "error");
    state.stems.replacements.forEach((entry) => {
      if (entry.targetTrackId === draft.targetTrackId && entry.id !== draft.id) entry.active = false;
    });
    draft.active = !draft.active;
    draft.status = draft.active ? "audition" : "draft";
    stopPlayback(true);
    saveState();
    render();
  }

  function wavFromAudioBuffer(buffer) {
    const channels = buffer.numberOfChannels;
    const sampleRate = buffer.sampleRate;
    const frames = buffer.length;
    const output = new ArrayBuffer(44 + frames * channels * 2);
    const view = new DataView(output);
    const write = (offset, text) => [...text].forEach((char, index) => view.setUint8(offset + index, char.charCodeAt(0)));
    write(0, "RIFF"); view.setUint32(4, 36 + frames * channels * 2, true); write(8, "WAVE"); write(12, "fmt ");
    view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, channels, true);
    view.setUint32(24, sampleRate, true); view.setUint32(28, sampleRate * channels * 2, true); view.setUint16(32, channels * 2, true); view.setUint16(34, 16, true);
    write(36, "data"); view.setUint32(40, frames * channels * 2, true);
    let offset = 44;
    for (let frame = 0; frame < frames; frame += 1) {
      for (let channel = 0; channel < channels; channel += 1) {
        const sample = clamp(buffer.getChannelData(channel)[frame], -1, 1);
        view.setInt16(offset, sample < 0 ? sample * 32768 : sample * 32767, true);
        offset += 2;
      }
    }
    return new Blob([output], { type: "audio/wav" });
  }

  async function exportStemMix() {
    const tracks = resolvedStemTracks();
    if (!tracks.length) return notify("Không có audio trong phiên để xuất mix.", "error");
    const sampleRate = Math.max(...tracks.map((item) => item.buffer.sampleRate));
    const duration = Math.max(...tracks.map((item) => item.buffer.duration + (item.offset || 0)));
    const Offline = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    if (!Offline) return notify("Trình duyệt không hỗ trợ OfflineAudioContext.", "error");
    notify("Đang render WAV đồng bộ trên thiết bị...", "info");
    const context = new Offline(2, Math.ceil(duration * sampleRate), sampleRate);
    const master = context.createGain();
    master.gain.value = clamp(state.stems.master, 0, 1.5);
    master.connect(context.destination);
    const hasSolo = tracks.some((item) => item.solo);
    tracks.forEach((item) => {
      if (item.mute || (hasSolo && !item.solo)) return;
      const source = context.createBufferSource();
      const gain = context.createGain();
      const pan = context.createStereoPanner ? context.createStereoPanner() : null;
      source.buffer = item.buffer;
      gain.gain.value = clamp(item.volume, 0, 1.5);
      source.connect(gain);
      if (pan) { pan.pan.value = clamp(item.pan, -1, 1); gain.connect(pan).connect(master); } else gain.connect(master);
      source.start(item.offset || 0);
    });
    const rendered = await context.startRendering();
    downloadBlob(wavFromAudioBuffer(rendered), `hh-${state.stems.mode}-mix.wav`);
    downloadManifest("stems");
    notify("Đã xuất WAV và manifest đồng bộ.");
  }

  async function renderSynchronizedTrack(item, duration, sampleRate) {
    const Offline = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    const context = new Offline(2, Math.ceil(duration * sampleRate), sampleRate);
    const source = context.createBufferSource();
    const gain = context.createGain();
    const pan = context.createStereoPanner ? context.createStereoPanner() : null;
    source.buffer = item.buffer;
    gain.gain.value = clamp(item.volume, 0, 1.5) * clamp(state.stems.master, 0, 1.5);
    source.connect(gain);
    if (pan) { pan.pan.value = clamp(item.pan, -1, 1); gain.connect(pan).connect(context.destination); } else gain.connect(context.destination);
    source.start(item.offset || 0);
    return context.startRendering();
  }

  async function exportSynchronizedStems() {
    const tracks = resolvedStemTracks().filter((item) => !item.mute);
    const Offline = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    if (!Offline || !tracks.length) return notify("Không có stem khả dụng để xuất WAV đồng bộ.", "error");
    const sampleRate = Math.max(...tracks.map((item) => item.buffer.sampleRate));
    const duration = Math.max(...tracks.map((item) => item.buffer.duration + (item.offset || 0)));
    notify(`Đang render ${tracks.length} stem cùng mốc thời gian...`, "info");
    for (let index = 0; index < tracks.length; index += 1) {
      const track = tracks[index];
      const rendered = await renderSynchronizedTrack(track, duration, sampleRate);
      const safeName = `${String(index + 1).padStart(2, "0")}-${track.stem || "stem"}`.replace(/[^a-z0-9-_]+/gi, "-");
      downloadBlob(wavFromAudioBuffer(rendered), `hh-sync-${safeName}.wav`);
      await new Promise((resolve) => setTimeout(resolve, 120));
    }
    downloadManifest("stems");
    notify("Đã xuất từng WAV cùng timeline và manifest đối chiếu.");
  }

  function apiBase() {
    return String(options.apiBase || window.HH_REALTIME_URL || location.origin).replace(/\/$/, "");
  }

  function authHeaders() {
    const token = localStorage.getItem("hh-auth-token") || "";
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  async function separateStems() {
    const source = [...runtimeTracks.values()][0];
    if (!source?.file) return notify("Hãy nạp bản mix nguồn trước khi tách stem.", "error");
    const adapter = options.stemAdapter || window.HH_MUSIC_STEM_ADAPTER;
    const endpoint = options.stemEndpoint || window.HH_MUSIC_STEM_ENDPOINT;
    if (!adapter && !endpoint) {
      state.stems.separation = { status: "unavailable", adapter: "none", detail: "Chưa cấu hình máy chủ GPU/Demucs. Trình duyệt không giả lập kết quả tách stem." };
      saveState(); render(); return;
    }
    state.stems.separation = { status: "running", adapter: typeof adapter === "function" ? "function" : "http", detail: "Đang gửi tệp tới adapter tách stem đã cấu hình..." };
    saveState(); render();
    try {
      let result;
      if (typeof adapter === "function") result = await adapter({ file: source.file, stems: STEM_TYPES, signal: controller?.signal });
      else {
        const form = new FormData();
        form.append("audio", source.file, source.file.name);
        form.append("stems", JSON.stringify(STEM_TYPES));
        form.append("model", "demucs");
        const response = await fetch(endpoint, { method: "POST", headers: authHeaders(), body: form, signal: controller?.signal });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || `Stem server HTTP ${response.status}`);
        result = data;
      }
      if (Array.isArray(result?.stems)) {
        const separated = [];
        for (const stem of result.stems) {
          let blob = stem?.blob instanceof Blob ? stem.blob : null;
          if (!blob && stem?.url) {
            const response = await fetch(stem.url, { signal: controller?.signal });
            if (!response.ok) throw new Error(`Không tải được stem ${stem.name || stem.type || "audio"}.`);
            blob = await response.blob();
          }
          if (blob) separated.push(new File([blob], stem.name || `${stem.type || "stem"}.wav`, { type: blob.type || "audio/wav" }));
        }
        if (separated.length) await importAudioFiles(separated, "stem");
      }
      state.stems.separation = { status: result?.status || "queued", adapter: typeof adapter === "function" ? "function" : "http", detail: result?.message || `Job ${result?.jobId || "đã nhận"}. Nạp các stem trả về để mix cục bộ.` };
    } catch (error) {
      if (error.name !== "AbortError") state.stems.separation = { status: "error", detail: error.message };
    }
    saveState(); render();
  }

  async function startRecording() {
    if (mediaRecorder?.state === "recording") return stopRecording();
    const consent = host?.querySelector("[data-mal-mic-consent]");
    if (!consent?.checked) return notify("Bạn cần xác nhận cấp micro cho lần thu này.", "error");
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) return notify("Trình duyệt không hỗ trợ thu âm MediaRecorder.", "error");
    try {
      mediaStream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: true, autoGainControl: false } });
      const preferred = ["audio/webm;codecs=opus", "audio/ogg;codecs=opus", "audio/webm"].find((type) => MediaRecorder.isTypeSupported?.(type));
      mediaRecorder = new MediaRecorder(mediaStream, preferred ? { mimeType: preferred } : undefined);
      recordChunks = [];
      mediaRecorder.ondataavailable = (event) => { if (event.data?.size) recordChunks.push(event.data); };
      mediaRecorder.onstop = finishRecording;
      mediaRecorder.start(250);
      recordStartedAt = performance.now();
      recordTimer = window.setInterval(updateRecordingClock, 100);
      updateRecordingUI(true);
    } catch (error) {
      stopMediaStream();
      notify(`Không mở được micro: ${error.message}`, "error");
    }
  }

  function stopRecording() {
    if (mediaRecorder?.state === "recording") mediaRecorder.stop();
  }

  async function finishRecording() {
    clearInterval(recordTimer);
    const mimeType = mediaRecorder?.mimeType || "audio/webm";
    const blob = new Blob(recordChunks, { type: mimeType });
    stopMediaStream();
    if (!blob.size) return notify("Take không có dữ liệu.", "error");
    try {
      const file = new File([blob], `vocal-take-${state.vocal.takes.length + 1}.webm`, { type: mimeType });
      await importAudioFiles([file], "take");
      notify("Đã giữ take trong bộ nhớ phiên. Không lưu dữ liệu giọng nói vào localStorage.");
    } catch (error) { notify(error.message, "error"); }
    updateRecordingUI(false);
  }

  function stopMediaStream() {
    mediaStream?.getTracks().forEach((track) => track.stop());
    mediaStream = null;
    mediaRecorder = null;
  }

  function updateRecordingClock() {
    const clock = host?.querySelector("[data-mal-record-time]");
    if (clock) clock.textContent = formatTime((performance.now() - recordStartedAt) / 1000);
  }

  function updateRecordingUI(recording) {
    const button = host?.querySelector('[data-mal-action="record"]');
    if (button) { button.textContent = recording ? "Dừng và lưu take" : "Bắt đầu thu"; button.classList.toggle("is-recording", recording); }
  }

  function releasePreview(preview, stopSources = false) {
    if (!preview) return;
    const sources = preview.sources || (preview.source ? [preview.source] : []);
    if (stopSources) sources.forEach((source) => { try { source.stop(); } catch {} });
    (preview.nodes || []).forEach((node) => { try { node.disconnect(); } catch {} });
  }

  function stopPreview() {
    const preview = activePreview;
    activePreview = null;
    releasePreview(preview, true);
  }

  function connectVocalPreviewChain(context, source, destination) {
    const highPass = context.createBiquadFilter();
    const presence = context.createBiquadFilter();
    const deEsser = context.createBiquadFilter();
    const compressor = context.createDynamicsCompressor();
    const gain = context.createGain();
    highPass.type = "highpass"; highPass.frequency.value = clamp(state.vocal.highPass, 20, 240);
    presence.type = "peaking"; presence.frequency.value = 4200; presence.Q.value = 0.8; presence.gain.value = clamp(state.vocal.presence, -6, 6);
    deEsser.type = "peaking"; deEsser.frequency.value = 7200; deEsser.Q.value = 1.8; deEsser.gain.value = -clamp(state.vocal.deEsser, 0, 100) * 0.08;
    compressor.threshold.value = -22; compressor.ratio.value = state.vocal.compressor ? 3.5 : 1;
    gain.gain.value = clamp(state.vocal.inputGain, 0, 2) * (1 - clamp(state.vocal.breathControl, 0, 100) * 0.0025);
    source.connect(highPass).connect(presence).connect(deEsser).connect(compressor).connect(gain).connect(destination);
    return [source, highPass, presence, deEsser, compressor, gain];
  }

  async function previewVocal(id, range = null) {
    stopPreview();
    const item = runtimeTakes.get(id) || runtimeSounds.get(id);
    if (!item?.buffer) return notify("Audio không còn dữ liệu sau khi tải lại trang. Hãy nhập lại tệp.", "error");
    const context = getAudioContext();
    await context.resume();
    const source = context.createBufferSource();
    source.buffer = item.buffer;
    const nodes = connectVocalPreviewChain(context, source, masterNode);
    const start = clamp(range?.start ?? 0, 0, item.buffer.duration);
    const end = clamp(range?.end ?? item.buffer.duration, start, item.buffer.duration);
    source.start(0, start, Math.max(0.01, end - start));
    const preview = { source, sources: [source], nodes };
    source.onended = () => {
      if (activePreview !== preview) return;
      activePreview = null;
      releasePreview(preview, false);
    };
    activePreview = preview;
  }

  function addCompSegment() {
    const take = state.vocal.takes.find((item) => item.id === state.vocal.selectedTake);
    if (!take) return notify("Chọn một take trước khi thêm vào comp.", "error");
    const start = clamp(state.vocal.selection.start, 0, take.duration || 0);
    const end = clamp(state.vocal.selection.end, start, take.duration || 0);
    if (end - start < 0.05) return notify("Vùng chọn phải dài ít nhất 0,05 giây.", "error");
    state.vocal.compSegments.push({
      id: uid("comp"),
      takeId: take.id,
      takeLabel: take.label || take.name,
      start,
      end,
      gain: 1,
      fadeIn: 0.015,
      fadeOut: 0.025,
      projectContext: getProjectMusicContext(),
      createdAt: new Date().toISOString()
    });
    saveState();
    render();
    notify("Đã thêm vùng chọn vào comp playlist, take gốc được giữ nguyên.");
  }

  function moveCompSegment(id, direction) {
    const index = state.vocal.compSegments.findIndex((segment) => segment.id === id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= state.vocal.compSegments.length) return;
    const [segment] = state.vocal.compSegments.splice(index, 1);
    state.vocal.compSegments.splice(target, 0, segment);
    saveState();
    render();
  }

  function availableCompSegments() {
    return state.vocal.compSegments.map((segment) => ({ segment, runtime: runtimeTakes.get(segment.takeId) })).filter((entry) => entry.runtime?.buffer);
  }

  async function previewVocalComp() {
    stopPreview();
    const entries = availableCompSegments();
    if (!entries.length) return notify("Comp playlist chưa có audio khả dụng trong phiên.", "error");
    const context = getAudioContext();
    await context.resume();
    const sources = [];
    const nodes = [];
    let cursor = 0;
    entries.forEach(({ segment, runtime }) => {
      const source = context.createBufferSource();
      source.buffer = runtime.buffer;
      const chain = connectVocalPreviewChain(context, source, masterNode);
      const start = clamp(segment.start, 0, runtime.buffer.duration);
      const duration = clamp(segment.end - segment.start, 0.01, runtime.buffer.duration - start);
      const segmentGain = chain[chain.length - 1];
      const targetGain = segmentGain.gain.value * clamp(segment.gain, 0, 2);
      segmentGain.gain.setValueAtTime(0.0001, context.currentTime + cursor);
      segmentGain.gain.linearRampToValueAtTime(Math.max(0.0001, targetGain), context.currentTime + cursor + Math.min(segment.fadeIn, duration / 2));
      segmentGain.gain.setValueAtTime(Math.max(0.0001, targetGain), context.currentTime + cursor + Math.max(segment.fadeIn, duration - segment.fadeOut));
      segmentGain.gain.linearRampToValueAtTime(0.0001, context.currentTime + cursor + duration);
      source.start(context.currentTime + cursor, start, duration);
      cursor += duration;
      sources.push(source);
      nodes.push(...chain);
    });
    const preview = { source: sources[0], sources, nodes };
    sources[sources.length - 1].onended = () => {
      if (activePreview !== preview) return;
      activePreview = null;
      releasePreview(preview, false);
    };
    activePreview = preview;
  }

  async function exportVocalComp() {
    const entries = availableCompSegments();
    const Offline = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    if (!Offline || !entries.length) return notify("Không có comp audio khả dụng để xuất.", "error");
    const sampleRate = Math.max(...entries.map(({ runtime }) => runtime.buffer.sampleRate));
    const duration = entries.reduce((sum, { segment }) => sum + Math.max(0.01, segment.end - segment.start), 0);
    const context = new Offline(2, Math.ceil(duration * sampleRate), sampleRate);
    let cursor = 0;
    entries.forEach(({ segment, runtime }) => {
      const source = context.createBufferSource();
      source.buffer = runtime.buffer;
      const chain = connectVocalPreviewChain(context, source, context.destination);
      const start = clamp(segment.start, 0, runtime.buffer.duration);
      const segmentDuration = clamp(segment.end - segment.start, 0.01, runtime.buffer.duration - start);
      const gain = chain[chain.length - 1];
      gain.gain.value *= clamp(segment.gain, 0, 2);
      source.start(cursor, start, segmentDuration);
      cursor += segmentDuration;
    });
    const rendered = await context.startRendering();
    downloadBlob(wavFromAudioBuffer(rendered), "hh-vocal-comp.wav");
    downloadManifest("vocal");
    notify("Đã xuất comp WAV và manifest chỉnh sửa không phá hủy.");
  }

  function addLyricCue() {
    const text = host?.querySelector("[data-mal-cue-text]")?.value.trim();
    const time = clamp(host?.querySelector("[data-mal-cue-time]")?.value, 0, 86400);
    if (!text) return notify("Nhập câu hát trước khi thêm cue.", "error");
    state.vocal.cues.push({ id: uid("cue"), time, text });
    state.vocal.cues.sort((a, b) => a.time - b.time);
    saveState(); render();
  }

  function createVietnameseSyllableCues() {
    const syllables = String(state.vocal.lyric || "").replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
    if (!syllables.length) return notify("Dán lời tiếng Việt trước khi tạo cue âm tiết.", "error");
    const take = state.vocal.takes.find((item) => item.id === state.vocal.selectedTake);
    const start = clamp(state.vocal.selection.start, 0, take?.duration || 86400);
    const requestedEnd = Math.max(start + syllables.length * 0.12, Number(state.vocal.selection.end) || take?.duration || start + syllables.length * 0.5);
    const end = take ? clamp(requestedEnd, start, take.duration) : requestedEnd;
    const step = Math.max(0.05, (end - start) / syllables.length);
    const generated = syllables.map((text, index) => ({ id: uid("syllable"), time: Number((start + index * step).toFixed(3)), text, kind: "syllable", language: "vi" }));
    state.vocal.cues = [...state.vocal.cues.filter((cue) => cue.kind !== "syllable"), ...generated].sort((a, b) => a.time - b.time);
    saveState();
    render();
    notify(`Đã tạo ${generated.length} cue âm tiết tiếng Việt để bạn tinh chỉnh thủ công.`);
  }

  async function generateLocalSfx() {
    const Offline = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    if (!Offline) return notify("Trình duyệt không hỗ trợ tạo audio offline.", "error");
    const duration = clamp(state.sound.duration, 0.5, 30);
    const sampleRate = 44100;
    const context = new Offline(2, Math.ceil(duration * sampleRate), sampleRate);
    const output = context.createGain();
    output.connect(context.destination);
    const noise = context.createBuffer(2, Math.ceil(duration * sampleRate), sampleRate);
    for (let channel = 0; channel < 2; channel += 1) {
      const data = noise.getChannelData(channel);
      let previous = 0;
      for (let index = 0; index < data.length; index += 1) {
        const white = Math.random() * 2 - 1;
        previous = state.sound.type === "ambience" ? previous * 0.985 + white * 0.015 : white;
        data[index] = previous * 0.35;
      }
    }
    const source = context.createBufferSource();
    const filter = context.createBiquadFilter();
    const gain = context.createGain();
    source.buffer = noise;
    filter.type = state.sound.type === "whoosh" ? "bandpass" : "lowpass";
    filter.frequency.setValueAtTime(state.sound.type === "impact" ? 1400 : 500, 0);
    if (["riser", "whoosh"].includes(state.sound.type)) filter.frequency.exponentialRampToValueAtTime(9000, Math.max(0.1, duration));
    const attack = state.sound.type === "impact" ? 0.005 : state.sound.type === "riser" ? duration * 0.8 : 0.08;
    gain.gain.setValueAtTime(0.0001, 0);
    gain.gain.linearRampToValueAtTime(0.8, Math.max(0.005, attack));
    gain.gain.exponentialRampToValueAtTime(0.0001, duration);
    source.connect(filter).connect(gain).connect(output);
    source.start();
    const rendered = await context.startRendering();
    const blob = wavFromAudioBuffer(rendered);
    const file = new File([blob], `hh-${state.sound.type}-${Date.now()}.wav`, { type: "audio/wav" });
    await importAudioFiles([file], "sound");
    notify("Đã tạo bản nháp procedural local. Đây không phải kết quả ElevenLabs.");
  }

  async function generateBackendSfx() {
    const adapter = options.soundEffectAdapter || window.HH_MUSIC_SFX_ADAPTER;
    const endpoint = options.soundEffectEndpoint || window.HH_MUSIC_SFX_ENDPOINT;
    if (!adapter && !endpoint) {
      state.sound.backend = { status: "unavailable", detail: "Chưa cấu hình Eleven Sound Effects adapter ở backend." };
      saveState(); render(); return;
    }
    state.sound.backend = { status: "running", detail: "Đang tạo âm thanh qua backend..." };
    saveState(); render();
    try {
      const payload = { prompt: state.sound.prompt, type: state.sound.type, durationSeconds: Number(state.sound.duration), bpm: Number(state.sound.bpm), key: state.sound.key, loop: state.sound.type === "loop" };
      let result;
      if (typeof adapter === "function") result = await adapter({ ...payload, signal: controller?.signal });
      else {
        const response = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json", ...authHeaders() }, body: JSON.stringify(payload), signal: controller?.signal });
        if (!response.ok) throw new Error(`Sound Effects backend HTTP ${response.status}`);
        const contentType = response.headers.get("content-type") || "";
        if (contentType.startsWith("audio/")) result = { blob: await response.blob(), message: "Đã tạo âm thanh" };
        else result = await response.json();
      }
      if (result?.blob instanceof Blob) {
        const file = new File([result.blob], result.name || `eleven-${state.sound.type}.mp3`, { type: result.blob.type || "audio/mpeg" });
        await importAudioFiles([file], "sound");
      } else if (result?.url) {
        const response = await fetch(result.url, { signal: controller?.signal });
        if (!response.ok) throw new Error("Backend trả URL audio không tải được.");
        const blob = await response.blob();
        await importAudioFiles([new File([blob], result.name || `eleven-${state.sound.type}.mp3`, { type: blob.type })], "sound");
      } else if (result?.media?.data) {
        const binary = atob(String(result.media.data).replace(/^data:[^;]+;base64,/, ""));
        const data = Uint8Array.from(binary, (char) => char.charCodeAt(0));
        const blob = new Blob([data], { type: result.media.mimeType || "audio/mpeg" });
        await importAudioFiles([new File([blob], result.name || `eleven-${state.sound.type}.mp3`, { type: blob.type })], "sound");
      }
      state.sound.backend = { status: result?.status || "ready", detail: result?.message || "Backend đã hoàn tất." };
    } catch (error) {
      if (error.name !== "AbortError") state.sound.backend = { status: "error", detail: error.message };
    }
    saveState(); render();
  }

  function timelinePayload(id) {
    const item = runtimeSounds.get(id);
    const meta = state.sound.items.find((entry) => entry.id === id);
    if (!meta) return null;
    return {
      schema: "hh.music.timeline-clip.v1",
      id: meta.id,
      name: meta.name,
      kind: "audio",
      type: meta.type,
      duration: meta.duration,
      bpm: meta.bpm,
      key: meta.key,
      prompt: meta.prompt,
      source: meta.source,
      availableThisSession: Boolean(item?.file),
      createdAt: meta.addedAt
    };
  }

  function sendToTimeline(id) {
    const payload = timelinePayload(id);
    if (!payload) return;
    if (host) host.dispatchEvent(new CustomEvent("hh:music-audio-clip", { detail: payload, bubbles: true }));
    else window.dispatchEvent(new CustomEvent("hh:music-audio-clip", { detail: payload }));
    notify("Đã gửi manifest clip tới timeline qua sự kiện hh:music-audio-clip.");
  }

  function downloadBlob(blob, name) {
    const link = document.createElement("a");
    const url = makeUrl(blob);
    link.href = url;
    link.download = name;
    link.click();
    setTimeout(() => revokeUrl(url), 1800);
  }

  function downloadManifest(kind) {
    let payload;
    const projectContext = getProjectMusicContext();
    if (kind === "stems") payload = { schema: "hh.music.stems.v1", mode: state.stems.mode, master: state.stems.master, timelineStart: 0, tracks: state.stems.tracks, sync: state.stems.sync, replacements: state.stems.replacements, projectContext, exportedAt: new Date().toISOString() };
    else if (kind === "vocal") payload = { schema: "hh.music.vocal-session.v1", settings: { ...state.vocal, voiceClone: { consentStored: false } }, projectContext, note: "Không chứa dữ liệu sinh trắc học hoặc file giọng nói.", exportedAt: new Date().toISOString() };
    else payload = { schema: "hh.music.soundboard.v1", settings: { prompt: state.sound.prompt, type: state.sound.type, duration: state.sound.duration, bpm: state.sound.bpm, key: state.sound.key }, projectContext, clips: state.sound.items.map((item) => timelinePayload(item.id) || item), exportedAt: new Date().toISOString() };
    downloadBlob(new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" }), `hh-${kind}-manifest.json`);
  }

  function drawWaveforms() {
    host?.querySelectorAll("canvas[data-mal-waveform]").forEach((canvas) => {
      const item = trackRuntime(canvas.dataset.malWaveform);
      const waveform = item?.analysis?.waveform;
      const context = canvas.getContext("2d");
      const rect = canvas.getBoundingClientRect();
      const ratio = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.max(1, rect.width * ratio);
      canvas.height = Math.max(1, rect.height * ratio);
      context.scale(ratio, ratio);
      context.clearRect(0, 0, rect.width, rect.height);
      context.strokeStyle = item ? "#62e9f4" : "#405161";
      context.lineWidth = 1;
      context.beginPath();
      if (waveform?.length) waveform.forEach((sample, index) => {
        const x = index / Math.max(1, waveform.length - 1) * rect.width;
        const y = rect.height / 2 + sample * rect.height * 0.45;
        if (!index) context.moveTo(x, y); else context.lineTo(x, y);
      });
      else { context.moveTo(0, rect.height / 2); context.lineTo(rect.width, rect.height / 2); }
      context.stroke();
    });
  }

  function statusBadge(status, detail) {
    const normalized = ["ready", "running", "queued"].includes(status) ? status : status === "error" ? "error" : "idle";
    return `<span class="mal-status is-${normalized}" title="${escapeHtml(detail || "")}"><i></i>${escapeHtml(status || "local")}</span>`;
  }

  function shell(content, title, eyebrow, help) {
    return `<section class="mal-suite mal-view-${view}">
      <header class="mal-topbar">
        <div class="mal-brand"><span>HH</span><div><small>${escapeHtml(eyebrow)}</small><h2>${escapeHtml(title)}</h2></div></div>
        <div class="mal-runtime"><span><i></i> Web Audio local</span><span>${escapeHtml(help)}</span></div>
      </header>
      ${content}
      <div class="mal-toast" data-mal-toast role="status" aria-live="polite"></div>
    </section>`;
  }

  function emptySession(message) {
    return `<div class="mal-empty"><span>WAVE</span><strong>${escapeHtml(message)}</strong><p>File audio chỉ được giữ trong bộ nhớ của tab hiện tại.</p></div>`;
  }

  function healthBadges(item) {
    const health = item.health;
    if (!health) return `<span class="mal-health-chip">Chờ phân tích</span>`;
    const clippingClass = health.clippedSamples ? "is-danger" : "is-ok";
    const noiseClass = health.noiseRisk === "high" ? "is-danger" : health.noiseRisk === "medium" ? "is-warn" : "is-ok";
    return `<span class="mal-health-chip is-ok">Im lặng ${Math.round((health.silenceRatio || 0) * 100)}%</span><span class="mal-health-chip ${noiseClass}">Nền ${Number(health.noiseFloorDb || -120).toFixed(1)} dB</span><span class="mal-health-chip ${clippingClass}">Clip ${health.clippedSamples || 0}</span>`;
  }

  function replacementDraft(draft) {
    return `<li class="${draft.active ? "is-active" : ""}"><div><strong>${escapeHtml(draft.targetName)}</strong><span>← ${escapeHtml(draft.replacementName)}</span></div><button type="button" data-mal-action="toggle-replacement" data-id="${escapeHtml(draft.id)}" aria-pressed="${Boolean(draft.active)}">${draft.active ? "Đang nghe" : "Nghe thử"}</button><button type="button" data-mal-action="remove-replacement" data-id="${escapeHtml(draft.id)}" aria-label="Xóa bản nháp">×</button></li>`;
  }

  function stemTrack(item, index) {
    const runtime = runtimeTracks.get(item.id);
    return `<article class="mal-track ${item.mute ? "is-muted" : ""}" data-track-id="${escapeHtml(item.id)}">
      <div class="mal-track__identity"><b>${String(index + 1).padStart(2, "0")}</b><div><strong>${escapeHtml(item.name)}</strong><select data-mal-track-field="stem" aria-label="Loại stem của ${escapeHtml(item.name)}">${STEM_TYPES.map((stem) => `<option value="${stem}" ${item.stem === stem ? "selected" : ""}>${stem}</option>`).join("")}</select></div></div>
      <div class="mal-track__wave"><canvas data-mal-waveform="${escapeHtml(item.id)}" aria-label="Waveform ${escapeHtml(item.name)}"></canvas><div class="mal-track__health">${healthBadges(item)}</div><span>${runtime ? formatTime(item.duration) : "Nạp lại file"}</span></div>
      <div class="mal-track__mix">
        <button type="button" data-mal-track-toggle="solo" class="${item.solo ? "is-active" : ""}" aria-pressed="${Boolean(item.solo)}">S</button>
        <button type="button" data-mal-track-toggle="mute" class="${item.mute ? "is-active" : ""}" aria-pressed="${Boolean(item.mute)}">M</button>
        <label>Vol <input type="range" min="0" max="1.5" step="0.01" value="${item.volume}" data-mal-track-field="volume"></label>
        <label>Pan <input type="range" min="-1" max="1" step="0.01" value="${item.pan}" data-mal-track-field="pan"></label>
        <label class="mal-offset-field">Offset <input type="number" min="0" max="3600" step="0.01" value="${item.offset || 0}" data-mal-track-field="offset" aria-label="Offset giây của ${escapeHtml(item.name)}"></label>
        <button type="button" data-mal-action="remove-track" title="Xóa track">×</button>
      </div>
    </article>`;
  }

  function stemView() {
    const tracks = state.stems.tracks;
    const duration = tracks.reduce((max, item) => Math.max(max, item.duration + (item.offset || 0)), 0);
    const optionList = tracks.map((item) => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.name)}</option>`).join("");
    const health = tracks.reduce((summary, item) => ({ clips: summary.clips + (item.health?.clippedSamples || 0), silence: summary.silence + (item.health?.silenceRanges?.length || 0), noisy: summary.noisy + (item.health?.noiseRisk === "high" ? 1 : 0) }), { clips: 0, silence: 0, noisy: 0 });
    const content = `<main class="mal-daw">
      <aside class="mal-library">
        <div class="mal-panel-title"><div><small>PROJECT</small><h3>Stem & Remix</h3></div><button type="button" data-mal-action="export-stem-manifest">JSON</button></div>
        <label class="mal-dropzone" data-mal-drop="stem"><input type="file" accept="audio/*,.flac" multiple data-mal-file="stem"><b>+</b><strong>Nạp mix hoặc stem</strong><span>Thả MP3, WAV, FLAC, M4A</span></label>
        <div class="mal-route-list" role="group" aria-label="Chế độ routing">
          ${[["full", "Full mix"], ["instrumental", "Instrumental"], ["karaoke", "Karaoke"], ["acapella", "Acapella"]].map(([id, label]) => `<button type="button" data-mal-route="${id}" class="${state.stems.mode === id ? "is-active" : ""}">${label}</button>`).join("")}
        </div>
        <section class="mal-server-card"><div><small>GPU SEPARATION</small><strong>Demucs / server adapter</strong></div>${statusBadge(state.stems.separation.status, state.stems.separation.detail)}<p>${escapeHtml(state.stems.separation.detail || "Tách stem cần máy chủ GPU thật. Local mixer không tự nhận là đã tách stem.")}</p><p>Adapter: <code>${escapeHtml(state.stems.separation.adapter || "none")}</code>. API key chỉ nằm ở server.</p><button type="button" data-mal-action="separate-stems">Gửi job tách stem</button></section>
        <section class="mal-replacement"><div><small>REPLACEMENT DRAFT</small><strong>Thay thử, không phá hủy</strong></div><label>Track đích<select data-mal-replacement-target>${optionList}</select></label><label>Nguồn thay thế<select data-mal-replacement-source>${optionList}</select></label><button type="button" data-mal-action="create-replacement" ${tracks.length < 2 ? "disabled" : ""}>Tạo bản nháp</button><ul>${state.stems.replacements.map(replacementDraft).join("") || "<li class=\"is-empty\">Chưa có bản nháp</li>"}</ul></section>
      </aside>
      <section class="mal-arrangement">
        <div class="mal-ruler"><span>00:00</span><span>${formatTime(duration * 0.25)}</span><span>${formatTime(duration * 0.5)}</span><span>${formatTime(duration * 0.75)}</span><span>${formatTime(duration)}</span></div>
        <div class="mal-track-list">${tracks.length ? tracks.map(stemTrack).join("") : emptySession("Nạp bản mix hoặc các stem để bắt đầu")}</div>
      </section>
      <aside class="mal-inspector">
        <div class="mal-panel-title"><div><small>INSPECTOR</small><h3>Mix bus</h3></div><span>LOCAL</span></div>
        <label class="mal-control"><span>Master gain <output>${Math.round(state.stems.master * 100)}%</output></span><input type="range" min="0" max="1.5" step="0.01" value="${state.stems.master}" data-mal-field="stems.master"></label>
        <div class="mal-meter-bank" aria-label="Master meter"><i data-mal-meter></i><i data-mal-meter></i></div>
        <dl class="mal-specs"><div><dt>Tracks</dt><dd>${tracks.length}</dd></div><div><dt>Thời lượng</dt><dd>${formatTime(duration)}</dd></div><div><dt>Vùng im lặng</dt><dd>${health.silence}</dd></div><div><dt>Mẫu clipping</dt><dd>${health.clips}</dd></div><div><dt>Track nền ồn</dt><dd>${health.noisy}</dd></div><div><dt>Đồng bộ</dt><dd>${state.stems.sync.enabled ? "00:00" : "Tùy chỉnh"}</dd></div></dl>
        <button type="button" data-mal-action="sync-stems">Căn mọi track về 00:00</button>
        <button class="is-primary" type="button" data-mal-action="export-stem-mix">Xuất mix WAV + manifest</button>
        <button type="button" data-mal-action="export-sync-stems">Xuất từng stem WAV đồng bộ</button>
      </aside>
      <footer class="mal-transport">
        <button type="button" data-mal-action="stop-mix" aria-label="Về đầu">■</button><button class="is-primary" type="button" data-mal-action="play-mix">Phát</button>
        <strong data-mal-position>${formatTime(playback.offset)}</strong><input data-mal-progress type="range" min="0" max="100" value="0" aria-label="Vị trí phát"><span>${formatTime(duration)}</span>
      </footer>
    </main>`;
    return shell(content, "Stem & Remix Lab", "AUDIO WORKSPACE", "decode · waveform · mix · export");
  }

  function vocalTake(item, index) {
    const runtime = runtimeTakes.get(item.id);
    return `<article class="mal-take ${state.vocal.selectedTake === item.id ? "is-selected" : ""}"><button type="button" data-mal-action="select-take" data-id="${escapeHtml(item.id)}"><b>Lane ${item.lane || index + 1} · ${escapeHtml(item.label || `Take ${index + 1}`)}</b><span>${escapeHtml(item.name)} · ${formatTime(item.duration)}</span></button><div class="mal-take-wave"><canvas data-mal-waveform="${escapeHtml(item.id)}"></canvas><div>${healthBadges(item)}</div></div><button type="button" data-mal-action="preview-take" data-id="${escapeHtml(item.id)}" ${runtime ? "" : "disabled"}>Nghe</button><button type="button" data-mal-action="remove-take" data-id="${escapeHtml(item.id)}" aria-label="Xóa take">×</button></article>`;
  }

  function vocalCompSegment(segment, index) {
    return `<li><span>${String(index + 1).padStart(2, "0")}</span><div><strong>${escapeHtml(segment.takeLabel)}</strong><small>${formatTime(segment.start)} → ${formatTime(segment.end)} · ${formatTime(segment.end - segment.start)}</small></div><button type="button" data-mal-action="move-comp-up" data-id="${escapeHtml(segment.id)}" aria-label="Đưa đoạn lên">↑</button><button type="button" data-mal-action="move-comp-down" data-id="${escapeHtml(segment.id)}" aria-label="Đưa đoạn xuống">↓</button><button type="button" data-mal-action="remove-comp" data-id="${escapeHtml(segment.id)}" aria-label="Xóa đoạn khỏi comp">×</button></li>`;
  }

  function vocalView() {
    const v = state.vocal;
    const content = `<main class="mal-vocal-grid">
      <section class="mal-vocal-stage">
        <header><div><small>RECORDING ROOM</small><h3>Thu và quản lý take</h3></div><strong data-mal-record-time>00:00.0</strong></header>
        <div class="mal-mic-consent"><label><input type="checkbox" data-mal-mic-consent> Tôi đồng ý mở micro cho lần thu này</label><p>Quyền chỉ được yêu cầu sau khi bấm Thu. Luồng micro và dữ liệu giọng không được lưu làm sinh trắc học.</p></div>
        <div class="mal-record-actions"><button class="is-danger" type="button" data-mal-action="record">Bắt đầu thu</button><label class="mal-file-button"><input type="file" accept="audio/*" multiple data-mal-file="take">Nhập take có sẵn</label><button type="button" data-mal-action="stop-preview">Dừng nghe</button></div>
        <div class="mal-take-list">${v.takes.length ? v.takes.map(vocalTake).join("") : emptySession("Chưa có vocal take")}</div>
        <section class="mal-comp-editor" aria-labelledby="mal-comp-title"><div class="mal-panel-title"><div><small>NON-DESTRUCTIVE COMP</small><h3 id="mal-comp-title">Comp playlist</h3></div><span>${v.compSegments.length} đoạn</span></div><div class="mal-range-editor"><label>Bắt đầu (giây)<input type="number" min="0" step="0.01" value="${v.selection.start}" data-mal-field="vocal.selection.start"></label><label>Kết thúc (giây)<input type="number" min="0.05" step="0.01" value="${v.selection.end}" data-mal-field="vocal.selection.end"></label><button type="button" data-mal-action="preview-selection" ${v.selectedTake ? "" : "disabled"}>Nghe vùng chọn</button><button class="is-primary" type="button" data-mal-action="add-comp" ${v.selectedTake ? "" : "disabled"}>Thêm vào comp</button></div><ol class="mal-comp-list">${v.compSegments.map(vocalCompSegment).join("") || "<li class=\"is-empty\">Chọn take và một khoảng thời gian để ghép.</li>"}</ol><div class="mal-record-actions"><button type="button" data-mal-action="preview-comp">Nghe comp</button><button class="is-primary" type="button" data-mal-action="export-vocal-comp">Xuất comp WAV + JSON</button></div><p>Playlist chỉ tham chiếu vùng thời gian của take; audio gốc không bị cắt hoặc ghi đè.</p></section>
      </section>
      <aside class="mal-vocal-effects">
        <div class="mal-panel-title"><div><small>VOCAL CHAIN</small><h3>Preview cục bộ</h3></div><span>LIVE</span></div>
        <label class="mal-control"><span>Input gain <output>${Math.round(v.inputGain * 100)}%</output></span><input type="range" min="0" max="2" step="0.01" value="${v.inputGain}" data-mal-field="vocal.inputGain"></label>
        <label class="mal-control"><span>High-pass <output>${v.highPass} Hz</output></span><input type="range" min="20" max="240" step="1" value="${v.highPass}" data-mal-field="vocal.highPass"></label>
        <label class="mal-control"><span>Presence EQ <output>${v.presence} dB</output></span><input type="range" min="-6" max="6" step="0.5" value="${v.presence}" data-mal-field="vocal.presence"></label>
        <label class="mal-switch"><input type="checkbox" ${v.compressor ? "checked" : ""} data-mal-field="vocal.compressor"><span></span><b>Compressor preview</b></label>
        <div class="mal-effect-block"><span>LOCAL PREVIEW</span><label class="mal-control"><b>De-esser EQ <output>${v.deEsser}%</output></b><input type="range" min="0" max="100" value="${v.deEsser}" data-mal-field="vocal.deEsser"></label><label class="mal-control"><b>Giảm hơi thở <output>${v.breathControl}%</output></b><input type="range" min="0" max="100" value="${v.breathControl}" data-mal-field="vocal.breathControl"></label><p>Preview dùng EQ/gain Web Audio đơn giản, không phải mô hình ML.</p></div>
        <div class="mal-effect-block is-backend"><span>BACKEND REQUIRED · METADATA ONLY</span><label class="mal-control"><b>Pitch correction <output>${v.pitchCorrection}%</output></b><input type="range" min="0" max="100" value="${v.pitchCorrection}" data-mal-field="vocal.pitchCorrection"></label><label class="mal-control"><b>Timing correction <output>${v.timingCorrection}%</output></b><input type="range" min="0" max="100" value="${v.timingCorrection}" data-mal-field="vocal.timingCorrection"></label><label class="mal-control"><b>Harmony <output>${v.harmonyAmount}%</output></b><input type="range" min="0" max="100" value="${v.harmonyAmount}" data-mal-field="vocal.harmonyAmount"></label><label class="mal-control"><span>Quãng bè</span><select data-mal-field="vocal.harmonyInterval"><option value="3" ${String(v.harmonyInterval) === "3" ? "selected" : ""}>Quãng 3</option><option value="5" ${String(v.harmonyInterval) === "5" ? "selected" : ""}>Quãng 5</option><option value="12" ${String(v.harmonyInterval) === "12" ? "selected" : ""}>Quãng 8</option></select></label><p>Các giá trị này được lưu vào manifest để backend phù hợp xử lý. Trình duyệt không tự nhận là đã Auto-Tune, căn timing hay sinh bè.</p></div>
      </aside>
      <section class="mal-lyrics">
        <div class="mal-panel-title"><div><small>LYRIC SYNC</small><h3>Lời và timestamp</h3></div><button type="button" data-mal-action="export-vocal-manifest">Xuất JSON</button></div>
        <textarea data-mal-field="vocal.lyric" rows="6" placeholder="Dán lời bài hát...">${escapeHtml(v.lyric)}</textarea>
        <div class="mal-cue-form"><input type="number" min="0" step="0.1" value="0" data-mal-cue-time aria-label="Thời gian cue"><input type="text" data-mal-cue-text placeholder="Câu hát tại timestamp"><button type="button" data-mal-action="add-cue">Thêm cue</button></div>
        <button type="button" data-mal-action="create-syllable-cues">Tạo cue âm tiết tiếng Việt trong vùng chọn</button><p class="mal-adapter-note">Tách theo khoảng trắng tiếng Việt và phân bố thời gian cục bộ; hãy nghe lại để căn chính xác phát âm.</p>
        <ol class="mal-cues">${v.cues.map((cue) => `<li class="${cue.kind === "syllable" ? "is-syllable" : ""}"><time>${formatTime(cue.time)}</time><span>${escapeHtml(cue.text)}</span><button type="button" data-mal-action="remove-cue" data-id="${escapeHtml(cue.id)}">×</button></li>`).join("") || "<li class=\"is-empty\">Chưa có cue</li>"}</ol>
        <div class="mal-clone-gate"><strong>Voice clone consent gate</strong><label><input type="checkbox" data-mal-field="vocal.voiceClone.ownerConfirmed"> Tôi là chủ giọng nói hoặc có giấy phép rõ ràng</label><label><input type="checkbox" data-mal-field="vocal.voiceClone.purposeConfirmed"> Tôi xác nhận mục đích sử dụng hợp pháp</label><p>HH chỉ tạo manifest đồng ý trong phiên. Không lưu giọng, embedding hoặc mẫu sinh trắc học.</p><button type="button" data-mal-action="voice-clone-manifest">Tạo phiếu đồng ý</button></div>
      </section>
    </main>`;
    return shell(content, "Vocal Studio", "CONSENT-FIRST RECORDING", "MediaRecorder · local preview · lyric cues");
  }

  function soundCard(item) {
    const runtime = runtimeSounds.get(item.id);
    return `<article class="mal-sound-card" draggable="${Boolean(runtime)}" data-mal-drag-sound="${escapeHtml(item.id)}"><div><b>${escapeHtml(item.type || "sound")}</b><span>${formatTime(item.duration)} · ${item.bpm || "—"} BPM · ${escapeHtml(item.key || "—")}</span></div><strong>${escapeHtml(item.name)}</strong><canvas data-mal-waveform="${escapeHtml(item.id)}"></canvas><p>${escapeHtml(item.prompt || "Tệp cục bộ")}</p><footer><button type="button" data-mal-action="preview-sound" data-id="${escapeHtml(item.id)}" ${runtime ? "" : "disabled"}>Nghe</button><button type="button" data-mal-action="timeline-sound" data-id="${escapeHtml(item.id)}">Đưa timeline</button><button type="button" data-mal-action="download-sound" data-id="${escapeHtml(item.id)}" ${runtime ? "" : "disabled"}>Tải</button><button type="button" data-mal-action="remove-sound" data-id="${escapeHtml(item.id)}">×</button></footer></article>`;
  }

  function soundView() {
    const s = state.sound;
    const content = `<main class="mal-sound-layout">
      <aside class="mal-prompt-rack">
        <div class="mal-panel-title"><div><small>SOUND PROMPT</small><h3>Sound Design</h3></div>${statusBadge(s.backend.status, s.backend.detail)}</div>
        <label class="mal-control"><span>Mô tả âm thanh</span><textarea rows="5" data-mal-field="sound.prompt">${escapeHtml(s.prompt)}</textarea></label>
        <div class="mal-type-grid">${SFX_TYPES.map((type) => `<button type="button" data-mal-sfx-type="${type}" class="${s.type === type ? "is-active" : ""}">${type}</button>`).join("")}</div>
        <div class="mal-field-pair"><label>Thời lượng (giây)<input type="number" min="0.5" max="30" step="0.5" value="${s.duration}" data-mal-field="sound.duration"></label><label>BPM<input type="number" min="30" max="240" value="${s.bpm}" data-mal-field="sound.bpm"></label></div>
        <label class="mal-control"><span>Tông</span><select data-mal-field="sound.key">${["C major", "A minor", "D minor", "E minor", "F major", "G major", "Không xác định"].map((key) => `<option ${s.key === key ? "selected" : ""}>${key}</option>`).join("")}</select></label>
        <div class="mal-action-stack"><button class="is-primary" type="button" data-mal-action="generate-backend-sfx">Tạo bằng Eleven backend</button><button type="button" data-mal-action="generate-local-sfx">Tạo bản nháp local</button></div>
        <p class="mal-adapter-note">${escapeHtml(s.backend.detail)} ElevenLabs chỉ được gọi qua adapter server; API key không xuất hiện trong trình duyệt.</p>
      </aside>
      <section class="mal-soundboard" data-mal-drop="sound">
        <header><div><small>LOCAL SOUNDBOARD</small><h3>Âm thanh dự án</h3></div><div><label class="mal-file-button"><input type="file" accept="audio/*" multiple data-mal-file="sound">Nhập audio</label><button type="button" data-mal-action="export-sound-manifest">Xuất board</button></div></header>
        <div class="mal-sound-grid">${s.items.length ? s.items.map(soundCard).join("") : emptySession("Thả sound effect vào đây")}</div>
      </section>
      <aside class="mal-timeline-drop"><small>TIMELINE BRIDGE</small><h3>Kéo clip sang DAW</h3><p>Mỗi clip phát sự kiện <code>hh:music-audio-clip</code> kèm manifest có BPM, key, duration và nguồn.</p><div class="mal-drop-target">DROP<br>TO TIMELINE</div><dl class="mal-specs"><div><dt>Clips</dt><dd>${s.items.length}</dd></div><div><dt>Engine</dt><dd>Web Audio</dd></div><div><dt>AI adapter</dt><dd>${escapeHtml(s.backend.status)}</dd></div></dl></aside>
    </main>`;
    return shell(content, "Sound Design Lab", "SFX · FOLEY · LOOP", "local soundboard · timeline manifest");
  }

  function render() {
    if (!host) return;
    host.innerHTML = view === "vocal" ? vocalView() : view === "sound-design" ? soundView() : stemView();
    requestAnimationFrame(drawWaveforms);
    updateTransportUI();
  }

  function notify(message, type = "success") {
    const toast = host?.querySelector("[data-mal-toast]");
    if (!toast) return;
    toast.textContent = message;
    toast.dataset.type = type;
    toast.classList.add("is-visible");
    clearTimeout(notify.timer);
    notify.timer = setTimeout(() => toast.classList.remove("is-visible"), 3600);
  }

  function setPath(path, value) {
    const parts = path.split(".");
    let target = state;
    while (parts.length > 1) target = target[parts.shift()];
    target[parts[0]] = value;
    saveState();
  }

  function formatControlValue(path, value) {
    if (/inputGain|master/.test(path)) return `${Math.round(value * 100)}%`;
    if (/highPass/.test(path)) return `${value} Hz`;
    if (/deEsser|breathControl|pitchCorrection|timingCorrection|harmonyAmount/.test(path)) return `${value}%`;
    if (/presence/.test(path)) return `${value} dB`;
    return String(value);
  }

  function handleInput(event) {
    const field = event.target.closest("[data-mal-field]");
    if (field) {
      const value = field.type === "checkbox" ? field.checked : field.type === "number" || field.type === "range" ? Number(field.value) : field.value;
      setPath(field.dataset.malField, value);
      const output = field.closest(".mal-control")?.querySelector("output");
      if (output && field.type === "range") output.textContent = formatControlValue(field.dataset.malField, value);
      if (field.dataset.malField === "stems.master" && masterNode) masterNode.gain.value = clamp(value, 0, 1.5);
    }
    const trackField = event.target.closest("[data-mal-track-field]");
    if (trackField) {
      const track = trackField.closest("[data-track-id]");
      const value = trackField.type === "range" ? Number(trackField.value) : trackField.value;
      updateMetadata(state.stems.tracks, track.dataset.trackId, { [trackField.dataset.malTrackField]: value });
      if (trackField.dataset.malTrackField === "offset") {
        state.stems.sync.enabled = state.stems.tracks.every((item) => Math.abs(Number(item.offset) || 0) <= state.stems.sync.toleranceMs / 1000);
        saveState();
      }
      const live = playback.sources.get(track.dataset.trackId);
      if (live?.gain && trackField.dataset.malTrackField === "volume") live.gain.gain.value = value;
      if (live?.pan && trackField.dataset.malTrackField === "pan") live.pan.pan.value = value;
    }
  }

  function handleChange(event) {
    const fileInput = event.target.closest("[data-mal-file]");
    if (fileInput) importAudioFiles(fileInput.files, fileInput.dataset.malFile);
  }

  function removeRuntime(map, id) {
    const runtime = map.get(id);
    if (runtime?.url) revokeUrl(runtime.url);
    map.delete(id);
  }

  function handleClick(event) {
    const route = event.target.closest("[data-mal-route]");
    if (route) return applyRouting(route.dataset.malRoute);
    const type = event.target.closest("[data-mal-sfx-type]");
    if (type) { state.sound.type = type.dataset.malSfxType; saveState(); return render(); }
    const toggle = event.target.closest("[data-mal-track-toggle]");
    if (toggle) {
      const id = toggle.closest("[data-track-id]").dataset.trackId;
      const item = state.stems.tracks.find((entry) => entry.id === id);
      if (item) updateMetadata(state.stems.tracks, id, { [toggle.dataset.malTrackToggle]: !item[toggle.dataset.malTrackToggle] });
      stopPlayback(true); return render();
    }
    const button = event.target.closest("[data-mal-action]");
    if (!button) return;
    const action = button.dataset.malAction;
    const id = button.dataset.id || button.closest("[data-track-id]")?.dataset.trackId;
    if (action === "play-mix") playStemMix();
    if (action === "stop-mix") stopPlayback(true);
    if (action === "remove-track") { stopPlayback(true); removeRuntime(runtimeTracks, id); state.stems.tracks = state.stems.tracks.filter((item) => item.id !== id); state.stems.replacements = state.stems.replacements.filter((draft) => draft.targetTrackId !== id && draft.replacementTrackId !== id); if (state.stems.sync.referenceTrackId === id) state.stems.sync.referenceTrackId = state.stems.tracks[0]?.id || ""; saveState(); render(); }
    if (action === "export-stem-mix") exportStemMix();
    if (action === "export-sync-stems") exportSynchronizedStems();
    if (action === "export-stem-manifest") downloadManifest("stems");
    if (action === "separate-stems") separateStems();
    if (action === "sync-stems") synchronizeStemTracks();
    if (action === "create-replacement") createStemReplacementDraft();
    if (action === "toggle-replacement") toggleStemReplacement(id);
    if (action === "remove-replacement") { state.stems.replacements = state.stems.replacements.filter((draft) => draft.id !== id); stopPlayback(true); saveState(); render(); }
    if (action === "record") startRecording();
    if (action === "stop-preview") stopPreview();
    if (action === "preview-take") previewVocal(id);
    if (action === "select-take") { state.vocal.selectedTake = id; saveState(); render(); }
    if (action === "preview-selection") previewVocal(state.vocal.selectedTake, state.vocal.selection);
    if (action === "add-comp") addCompSegment();
    if (action === "preview-comp") previewVocalComp();
    if (action === "export-vocal-comp") exportVocalComp();
    if (action === "move-comp-up") moveCompSegment(id, -1);
    if (action === "move-comp-down") moveCompSegment(id, 1);
    if (action === "remove-comp") { state.vocal.compSegments = state.vocal.compSegments.filter((segment) => segment.id !== id); saveState(); render(); }
    if (action === "remove-take") { stopPreview(); removeRuntime(runtimeTakes, id); state.vocal.takes = state.vocal.takes.filter((item) => item.id !== id); state.vocal.compSegments = state.vocal.compSegments.filter((segment) => segment.takeId !== id); if (state.vocal.selectedTake === id) state.vocal.selectedTake = ""; saveState(); render(); }
    if (action === "add-cue") addLyricCue();
    if (action === "create-syllable-cues") createVietnameseSyllableCues();
    if (action === "remove-cue") { state.vocal.cues = state.vocal.cues.filter((cue) => cue.id !== id); saveState(); render(); }
    if (action === "export-vocal-manifest") downloadManifest("vocal");
    if (action === "voice-clone-manifest") {
      if (!state.vocal.voiceClone.ownerConfirmed || !state.vocal.voiceClone.purposeConfirmed) return notify("Cần đủ hai xác nhận quyền sử dụng giọng nói.", "error");
      downloadBlob(new Blob([JSON.stringify({ schema: "hh.voice-consent.v1", confirmedAt: new Date().toISOString(), ownerConfirmed: true, lawfulPurposeConfirmed: true, biometricDataStored: false }, null, 2)], { type: "application/json" }), "hh-voice-consent.json");
    }
    if (action === "generate-local-sfx") generateLocalSfx();
    if (action === "generate-backend-sfx") generateBackendSfx();
    if (action === "preview-sound") previewVocal(id);
    if (action === "timeline-sound") sendToTimeline(id);
    if (action === "download-sound") { const item = runtimeSounds.get(id); if (item?.file) downloadBlob(item.file, item.name); }
    if (action === "remove-sound") { stopPreview(); removeRuntime(runtimeSounds, id); state.sound.items = state.sound.items.filter((item) => item.id !== id); saveState(); render(); }
    if (action === "export-sound-manifest") downloadManifest("sound-design");
  }

  function handleDragOver(event) {
    if (!event.target.closest("[data-mal-drop]")) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
  }

  function handleDrop(event) {
    const zone = event.target.closest("[data-mal-drop]");
    if (!zone) return;
    event.preventDefault();
    importAudioFiles(event.dataTransfer.files, zone.dataset.malDrop);
  }

  function handleDragStart(event) {
    const card = event.target.closest("[data-mal-drag-sound]");
    if (!card) return;
    const payload = timelinePayload(card.dataset.malDragSound);
    if (!payload) return event.preventDefault();
    event.dataTransfer.effectAllowed = "copy";
    event.dataTransfer.setData("application/x-hh-music-clip", JSON.stringify(payload));
    event.dataTransfer.setData("text/plain", payload.name);
  }

  function mount(nextHost, config = {}) {
    unmount();
    if (!nextHost) throw new Error("HHMusicAudioLabs.mount cần host hợp lệ.");
    host = nextHost;
    options = config || {};
    view = SUPPORTED.has(config.view) ? config.view : "stems";
    state = loadState();
    controller = new AbortController();
    const signal = controller.signal;
    host.addEventListener("input", handleInput, { signal });
    host.addEventListener("change", handleChange, { signal });
    host.addEventListener("click", handleClick, { signal });
    host.addEventListener("dragover", handleDragOver, { signal });
    host.addEventListener("drop", handleDrop, { signal });
    host.addEventListener("dragstart", handleDragStart, { signal });
    render();
  }

  function unmount() {
    controller?.abort();
    controller = null;
    clearTimeout(notify.timer);
    clearInterval(recordTimer);
    stopPlayback(true);
    stopPreview();
    if (mediaRecorder) mediaRecorder.onstop = null;
    if (mediaRecorder?.state === "recording") mediaRecorder.stop();
    stopMediaStream();
    objectUrls.forEach((url) => URL.revokeObjectURL(url));
    objectUrls.clear();
    runtimeTracks.clear();
    runtimeTakes.clear();
    runtimeSounds.clear();
    if (audioContext && audioContext.state !== "closed") audioContext.close().catch(() => {});
    audioContext = null;
    masterNode = null;
    masterAnalyser = null;
    playback = { playing: false, startedAt: 0, offset: 0, duration: 0, sources: new Map(), frame: 0 };
    if (host) host.innerHTML = "";
    host = null;
    options = {};
  }

  window.HHMusicAudioLabs = { supports: (id) => SUPPORTED.has(id), mount, unmount };
})();
