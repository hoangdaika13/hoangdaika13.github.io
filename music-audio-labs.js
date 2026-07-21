(function () {
  "use strict";

  const STORAGE_KEY = "hh.music.audio-labs.v1";
  const SUPPORTED = new Set(["stems", "vocal", "sound-design"]);
  const AUDIO_TYPES = ["audio/mpeg", "audio/wav", "audio/x-wav", "audio/ogg", "audio/webm", "audio/mp4", "audio/aac", "audio/flac"];
  const STEM_TYPES = ["vocal", "drums", "bass", "guitar", "piano", "other"];
  const SFX_TYPES = ["ambience", "impact", "riser", "whoosh", "foley", "loop"];
  const DEFAULTS = {
    version: 1,
    stems: { mode: "full", master: 0.9, tracks: [], separation: { status: "idle", detail: "" } },
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
        stems: { ...base.stems, ...(saved.stems || {}), tracks: Array.isArray(saved.stems?.tracks) ? saved.stems.tracks.map((item) => ({ ...item, availableThisSession: false })) : [] },
        vocal: {
          ...base.vocal,
          ...(saved.vocal || {}),
          cues: Array.isArray(saved.vocal?.cues) ? saved.vocal.cues : [],
          takes: Array.isArray(saved.vocal?.takes) ? saved.vocal.takes.map((item) => ({ ...item, availableThisSession: false })) : [],
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
    return {
      duration: buffer.duration,
      channels: buffer.numberOfChannels,
      sampleRate: buffer.sampleRate,
      peakDb: peak ? 20 * Math.log10(peak) : -Infinity,
      rmsDb: channel.length ? 20 * Math.log10(Math.sqrt(sum / channel.length) || 0.000001) : -Infinity,
      zeroCrossingHz: buffer.duration ? zeroCrossings / (buffer.duration * 2) : 0,
      waveform
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
        } else if (target === "take") {
          runtimeTakes.set(item.id, item);
          state.vocal.takes.push({ ...metadataFromRuntime(item), label: `Take ${state.vocal.takes.length + 1}` });
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
    const tracks = [...runtimeTracks.values()].filter((item) => item.buffer);
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
    const tracks = [...runtimeTracks.values()].filter((item) => item.buffer);
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
      state.stems.separation = { status: "unavailable", detail: "Chưa cấu hình máy chủ GPU/Demucs. Trình duyệt không giả lập kết quả tách stem." };
      saveState(); render(); return;
    }
    state.stems.separation = { status: "running", detail: "Đang gửi tệp tới adapter tách stem đã cấu hình..." };
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
      state.stems.separation = { status: result?.status || "queued", detail: result?.message || `Job ${result?.jobId || "đã nhận"}. Nạp các stem trả về để mix cục bộ.` };
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

  function stopPreview() {
    if (!activePreview) return;
    try { activePreview.source.stop(); } catch {}
    try { activePreview.nodes.forEach((node) => node.disconnect()); } catch {}
    activePreview = null;
  }

  async function previewVocal(id) {
    stopPreview();
    const item = runtimeTakes.get(id) || runtimeSounds.get(id);
    if (!item?.buffer) return notify("Audio không còn dữ liệu sau khi tải lại trang. Hãy nhập lại tệp.", "error");
    const context = getAudioContext();
    await context.resume();
    const source = context.createBufferSource();
    const highPass = context.createBiquadFilter();
    const presence = context.createBiquadFilter();
    const compressor = context.createDynamicsCompressor();
    const gain = context.createGain();
    source.buffer = item.buffer;
    highPass.type = "highpass"; highPass.frequency.value = clamp(state.vocal.highPass, 20, 240);
    presence.type = "peaking"; presence.frequency.value = 4200; presence.Q.value = 0.8; presence.gain.value = clamp(state.vocal.presence, -6, 6);
    compressor.threshold.value = -22; compressor.ratio.value = state.vocal.compressor ? 3.5 : 1;
    gain.gain.value = clamp(state.vocal.inputGain, 0, 2);
    source.connect(highPass).connect(presence).connect(compressor).connect(gain).connect(masterNode);
    source.start();
    source.onended = () => { if (activePreview?.source === source) activePreview = null; };
    activePreview = { source, nodes: [source, highPass, presence, compressor, gain] };
  }

  function addLyricCue() {
    const text = host?.querySelector("[data-mal-cue-text]")?.value.trim();
    const time = clamp(host?.querySelector("[data-mal-cue-time]")?.value, 0, 86400);
    if (!text) return notify("Nhập câu hát trước khi thêm cue.", "error");
    state.vocal.cues.push({ id: uid("cue"), time, text });
    state.vocal.cues.sort((a, b) => a.time - b.time);
    saveState(); render();
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
    if (kind === "stems") payload = { schema: "hh.music.stems.v1", mode: state.stems.mode, master: state.stems.master, timelineStart: 0, tracks: state.stems.tracks, exportedAt: new Date().toISOString() };
    else if (kind === "vocal") payload = { schema: "hh.music.vocal-session.v1", settings: { ...state.vocal, voiceClone: { consentStored: false } }, note: "Không chứa dữ liệu sinh trắc học hoặc file giọng nói.", exportedAt: new Date().toISOString() };
    else payload = { schema: "hh.music.soundboard.v1", settings: { prompt: state.sound.prompt, type: state.sound.type, duration: state.sound.duration, bpm: state.sound.bpm, key: state.sound.key }, clips: state.sound.items.map((item) => timelinePayload(item.id) || item), exportedAt: new Date().toISOString() };
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

  function stemTrack(item, index) {
    const runtime = runtimeTracks.get(item.id);
    return `<article class="mal-track ${item.mute ? "is-muted" : ""}" data-track-id="${escapeHtml(item.id)}">
      <div class="mal-track__identity"><b>${String(index + 1).padStart(2, "0")}</b><div><strong>${escapeHtml(item.name)}</strong><select data-mal-track-field="stem" aria-label="Loại stem của ${escapeHtml(item.name)}">${STEM_TYPES.map((stem) => `<option value="${stem}" ${item.stem === stem ? "selected" : ""}>${stem}</option>`).join("")}</select></div></div>
      <div class="mal-track__wave"><canvas data-mal-waveform="${escapeHtml(item.id)}" aria-label="Waveform ${escapeHtml(item.name)}"></canvas><span>${runtime ? formatTime(item.duration) : "Nạp lại file"}</span></div>
      <div class="mal-track__mix">
        <button type="button" data-mal-track-toggle="solo" class="${item.solo ? "is-active" : ""}" aria-pressed="${Boolean(item.solo)}">S</button>
        <button type="button" data-mal-track-toggle="mute" class="${item.mute ? "is-active" : ""}" aria-pressed="${Boolean(item.mute)}">M</button>
        <label>Vol <input type="range" min="0" max="1.5" step="0.01" value="${item.volume}" data-mal-track-field="volume"></label>
        <label>Pan <input type="range" min="-1" max="1" step="0.01" value="${item.pan}" data-mal-track-field="pan"></label>
        <button type="button" data-mal-action="remove-track" title="Xóa track">×</button>
      </div>
    </article>`;
  }

  function stemView() {
    const tracks = state.stems.tracks;
    const duration = tracks.reduce((max, item) => Math.max(max, item.duration + (item.offset || 0)), 0);
    const content = `<main class="mal-daw">
      <aside class="mal-library">
        <div class="mal-panel-title"><div><small>PROJECT</small><h3>Stem & Remix</h3></div><button type="button" data-mal-action="export-stem-manifest">JSON</button></div>
        <label class="mal-dropzone" data-mal-drop="stem"><input type="file" accept="audio/*,.flac" multiple data-mal-file="stem"><b>+</b><strong>Nạp mix hoặc stem</strong><span>Thả MP3, WAV, FLAC, M4A</span></label>
        <div class="mal-route-list" role="group" aria-label="Chế độ routing">
          ${[["full", "Full mix"], ["instrumental", "Instrumental"], ["karaoke", "Karaoke"], ["acapella", "Acapella"]].map(([id, label]) => `<button type="button" data-mal-route="${id}" class="${state.stems.mode === id ? "is-active" : ""}">${label}</button>`).join("")}
        </div>
        <section class="mal-server-card"><div><small>GPU SEPARATION</small><strong>Demucs / server adapter</strong></div>${statusBadge(state.stems.separation.status, state.stems.separation.detail)}<p>${escapeHtml(state.stems.separation.detail || "Tách stem cần máy chủ GPU thật. Local mixer không tự nhận là đã tách stem.")}</p><button type="button" data-mal-action="separate-stems">Gửi job tách stem</button></section>
      </aside>
      <section class="mal-arrangement">
        <div class="mal-ruler"><span>00:00</span><span>${formatTime(duration * 0.25)}</span><span>${formatTime(duration * 0.5)}</span><span>${formatTime(duration * 0.75)}</span><span>${formatTime(duration)}</span></div>
        <div class="mal-track-list">${tracks.length ? tracks.map(stemTrack).join("") : emptySession("Nạp bản mix hoặc các stem để bắt đầu")}</div>
      </section>
      <aside class="mal-inspector">
        <div class="mal-panel-title"><div><small>INSPECTOR</small><h3>Mix bus</h3></div><span>LOCAL</span></div>
        <label class="mal-control"><span>Master gain <output>${Math.round(state.stems.master * 100)}%</output></span><input type="range" min="0" max="1.5" step="0.01" value="${state.stems.master}" data-mal-field="stems.master"></label>
        <div class="mal-meter-bank" aria-label="Master meter"><i data-mal-meter></i><i data-mal-meter></i></div>
        <dl class="mal-specs"><div><dt>Tracks</dt><dd>${tracks.length}</dd></div><div><dt>Thời lượng</dt><dd>${formatTime(duration)}</dd></div><div><dt>Routing</dt><dd>${escapeHtml(state.stems.mode)}</dd></div><div><dt>Engine</dt><dd>Web Audio</dd></div></dl>
        <button class="is-primary" type="button" data-mal-action="export-stem-mix">Xuất WAV + manifest</button>
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
    return `<article class="mal-take ${state.vocal.selectedTake === item.id ? "is-selected" : ""}"><button type="button" data-mal-action="select-take" data-id="${escapeHtml(item.id)}"><b>${escapeHtml(item.label || `Take ${index + 1}`)}</b><span>${escapeHtml(item.name)} · ${formatTime(item.duration)}</span></button><canvas data-mal-waveform="${escapeHtml(item.id)}"></canvas><button type="button" data-mal-action="preview-take" data-id="${escapeHtml(item.id)}" ${runtime ? "" : "disabled"}>Nghe</button><button type="button" data-mal-action="remove-take" data-id="${escapeHtml(item.id)}">×</button></article>`;
  }

  function vocalView() {
    const v = state.vocal;
    const content = `<main class="mal-vocal-grid">
      <section class="mal-vocal-stage">
        <header><div><small>RECORDING ROOM</small><h3>Thu và quản lý take</h3></div><strong data-mal-record-time>00:00.0</strong></header>
        <div class="mal-mic-consent"><label><input type="checkbox" data-mal-mic-consent> Tôi đồng ý mở micro cho lần thu này</label><p>Quyền chỉ được yêu cầu sau khi bấm Thu. Luồng micro và dữ liệu giọng không được lưu làm sinh trắc học.</p></div>
        <div class="mal-record-actions"><button class="is-danger" type="button" data-mal-action="record">Bắt đầu thu</button><label class="mal-file-button"><input type="file" accept="audio/*" multiple data-mal-file="take">Nhập take có sẵn</label><button type="button" data-mal-action="stop-preview">Dừng nghe</button></div>
        <div class="mal-take-list">${v.takes.length ? v.takes.map(vocalTake).join("") : emptySession("Chưa có vocal take")}</div>
      </section>
      <aside class="mal-vocal-effects">
        <div class="mal-panel-title"><div><small>VOCAL CHAIN</small><h3>Preview cục bộ</h3></div><span>LIVE</span></div>
        <label class="mal-control"><span>Input gain <output>${Math.round(v.inputGain * 100)}%</output></span><input type="range" min="0" max="2" step="0.01" value="${v.inputGain}" data-mal-field="vocal.inputGain"></label>
        <label class="mal-control"><span>High-pass <output>${v.highPass} Hz</output></span><input type="range" min="20" max="240" step="1" value="${v.highPass}" data-mal-field="vocal.highPass"></label>
        <label class="mal-control"><span>Presence EQ <output>${v.presence} dB</output></span><input type="range" min="-6" max="6" step="0.5" value="${v.presence}" data-mal-field="vocal.presence"></label>
        <label class="mal-switch"><input type="checkbox" ${v.compressor ? "checked" : ""} data-mal-field="vocal.compressor"><span></span><b>Compressor preview</b></label>
        <div class="mal-effect-block is-backend"><span>BACKEND REQUIRED</span><label class="mal-control"><b>De-esser</b><input type="range" min="0" max="100" value="${v.deEsser}" data-mal-field="vocal.deEsser"></label><label class="mal-control"><b>Pitch correction</b><input type="range" min="0" max="100" value="${v.pitchCorrection}" data-mal-field="vocal.pitchCorrection"></label><p>Các nút này lưu ý định xử lý, không giả lập de-esser hoặc Auto-Tune trong preview.</p></div>
      </aside>
      <section class="mal-lyrics">
        <div class="mal-panel-title"><div><small>LYRIC SYNC</small><h3>Lời và timestamp</h3></div><button type="button" data-mal-action="export-vocal-manifest">Xuất JSON</button></div>
        <textarea data-mal-field="vocal.lyric" rows="6" placeholder="Dán lời bài hát...">${escapeHtml(v.lyric)}</textarea>
        <div class="mal-cue-form"><input type="number" min="0" step="0.1" value="0" data-mal-cue-time aria-label="Thời gian cue"><input type="text" data-mal-cue-text placeholder="Câu hát tại timestamp"><button type="button" data-mal-action="add-cue">Thêm cue</button></div>
        <ol class="mal-cues">${v.cues.map((cue) => `<li><time>${formatTime(cue.time)}</time><span>${escapeHtml(cue.text)}</span><button type="button" data-mal-action="remove-cue" data-id="${escapeHtml(cue.id)}">×</button></li>`).join("") || "<li class=\"is-empty\">Chưa có cue</li>"}</ol>
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

  function handleInput(event) {
    const field = event.target.closest("[data-mal-field]");
    if (field) {
      const value = field.type === "checkbox" ? field.checked : field.type === "number" || field.type === "range" ? Number(field.value) : field.value;
      setPath(field.dataset.malField, value);
      const output = field.closest(".mal-control")?.querySelector("output");
      if (output && field.type === "range") output.textContent = field.dataset.malField.includes("Gain") || field.dataset.malField.includes("master") ? `${Math.round(value * 100)}%` : field.dataset.malField.includes("highPass") ? `${value} Hz` : `${value} dB`;
      if (field.dataset.malField === "stems.master" && masterNode) masterNode.gain.value = clamp(value, 0, 1.5);
    }
    const trackField = event.target.closest("[data-mal-track-field]");
    if (trackField) {
      const track = trackField.closest("[data-track-id]");
      const value = trackField.type === "range" ? Number(trackField.value) : trackField.value;
      updateMetadata(state.stems.tracks, track.dataset.trackId, { [trackField.dataset.malTrackField]: value });
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
    if (action === "remove-track") { stopPlayback(true); removeRuntime(runtimeTracks, id); state.stems.tracks = state.stems.tracks.filter((item) => item.id !== id); saveState(); render(); }
    if (action === "export-stem-mix") exportStemMix();
    if (action === "export-stem-manifest") downloadManifest("stems");
    if (action === "separate-stems") separateStems();
    if (action === "record") startRecording();
    if (action === "stop-preview") stopPreview();
    if (action === "preview-take") previewVocal(id);
    if (action === "select-take") { state.vocal.selectedTake = id; saveState(); render(); }
    if (action === "remove-take") { stopPreview(); removeRuntime(runtimeTakes, id); state.vocal.takes = state.vocal.takes.filter((item) => item.id !== id); if (state.vocal.selectedTake === id) state.vocal.selectedTake = ""; saveState(); render(); }
    if (action === "add-cue") addLyricCue();
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
