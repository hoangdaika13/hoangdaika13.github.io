(function (root) {
  "use strict";

  const STORAGE_KEY = "hh.music-daw-workspace.v1";
  const DATABASE_NAME = "hh-music-daw-assets-v1";
  const DATABASE_STORE = "audio-assets";
  const SUPPORTED_VIEWS = new Set(["arrange", "record"]);
  const SIGNATURES = ["3/4", "4/4", "6/8", "7/8"];
  const SNAP_VALUES = [0, 0.25, 0.5, 1, 2, 4];
  const SAMPLE_DEFINITIONS = {
    kick: { label: "Kick Pulse", frequency: 62, duration: 0.42, decay: 18, type: "sine" },
    click: { label: "Studio Click", frequency: 1320, duration: 0.08, decay: 45, type: "square" },
    pad: { label: "Aurora Pad", frequency: 220, duration: 4, decay: 0.7, type: "sine" }
  };
  const PRESETS = {
    pop: { label: "Modern Pop", bpm: 112, signature: "4/4", tracks: ["Drums", "Bass", "Harmony", "Vocal"] },
    lofi: { label: "Lofi Session", bpm: 76, signature: "4/4", tracks: ["Beat", "Keys", "Texture", "Vocal"] },
    cinematic: { label: "Cinematic", bpm: 84, signature: "6/8", tracks: ["Percussion", "Low Strings", "Orchestra", "Voice"] }
  };

  const runtime = {
    host: null,
    state: null,
    view: "arrange",
    assets: new Map(),
    objectUrls: new Set(),
    audioContext: null,
    playbackNodes: [],
    masterAnalyser: null,
    masterGain: null,
    animationFrame: 0,
    playStartedAt: 0,
    listeners: [],
    mediaStream: null,
    mediaRecorder: null,
    recordingChunks: [],
    recordingStartedAt: 0,
    recordingTimer: 0,
    recordUrl: "",
    inputAnalyser: null,
    inputAnimationFrame: 0,
    drag: null
  };

  const uid = (prefix) => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const clamp = (value, min, max) => Math.min(max, Math.max(min, Number(value) || 0));
  const round = (value, precision = 3) => Number(Number(value || 0).toFixed(precision));
  const safeColor = (value, fallback = "#63dff0") => /^#[0-9a-f]{6}$/i.test(String(value || "")) ? String(value) : fallback;
  const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;"
  })[character]);
  const formatTime = (seconds) => {
    const safe = Math.max(0, Number(seconds) || 0);
    const minutes = Math.floor(safe / 60);
    const remainder = Math.floor(safe % 60);
    const milliseconds = Math.floor((safe % 1) * 100);
    return `${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}.${String(milliseconds).padStart(2, "0")}`;
  };
  const formatBytes = (bytes) => {
    const safe = Math.max(0, Number(bytes) || 0);
    if (safe < 1024) return `${safe} B`;
    if (safe < 1048576) return `${(safe / 1024).toFixed(1)} KB`;
    return `${(safe / 1048576).toFixed(1)} MB`;
  };
  const safeFilename = (value) => String(value || "HH-Music-Project")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-+|-+$/g, "") || "HH-Music-Project";

  function defaultTrack(name, color) {
    return {
      id: uid("track"), name, color, volume: 0.82, pan: 0, muted: false, solo: false,
      effects: { highpass: 0, compressor: false }, clips: []
    };
  }

  function defaultState() {
    return {
      version: 1,
      project: { name: "HH Aurora Session", bpm: 96, signature: "4/4", zoom: 34, snap: 1 },
      transport: { playhead: 0, playing: false, loopEnabled: false, loopStart: 0, loopEnd: 16, masterVolume: 0.82 },
      markers: [{ id: uid("marker"), time: 0, label: "Bắt đầu" }],
      tracks: [
        defaultTrack("Drums", "#ff65ba"),
        defaultTrack("Music", "#63dff0"),
        defaultTrack("Vocal", "#b8f06b")
      ],
      assets: [],
      selection: { trackId: "", clipId: "" },
      prompt: { text: "", result: "" },
      workflow: { warp: "adapter-unavailable", timeStretch: "adapter-unavailable", midiExport: "adapter-unavailable" },
      recording: { status: "idle", message: "Micro chỉ được yêu cầu sau khi bạn bấm Thu âm.", lastName: "" },
      updatedAt: new Date().toISOString()
    };
  }

  function normalizeState(candidate) {
    const base = defaultState();
    if (!candidate || typeof candidate !== "object") return base;
    const project = { ...base.project, ...(candidate.project || {}) };
    project.bpm = clamp(project.bpm, 30, 260) || 96;
    project.signature = SIGNATURES.includes(project.signature) ? project.signature : "4/4";
    project.zoom = clamp(project.zoom, 16, 120) || 34;
    project.snap = SNAP_VALUES.includes(Number(project.snap)) ? Number(project.snap) : 1;
    const tracks = Array.isArray(candidate.tracks) && candidate.tracks.length
      ? candidate.tracks.slice(0, 24).map((track, index) => ({
        ...defaultTrack(`Track ${index + 1}`, ["#ff65ba", "#63dff0", "#b8f06b"][index % 3]),
        ...track,
        id: String(track.id || uid("track")),
        name: String(track.name || `Track ${index + 1}`).slice(0, 80),
        volume: clamp(track.volume ?? 0.82, 0, 1.2),
        pan: clamp(track.pan ?? 0, -1, 1),
        color: safeColor(track.color, ["#ff65ba", "#63dff0", "#b8f06b"][index % 3]),
        effects: {
          highpass: clamp(track.effects?.highpass || 0, 0, 1000),
          compressor: Boolean(track.effects?.compressor)
        },
        clips: Array.isArray(track.clips) ? track.clips.slice(0, 250).map((clip) => ({
          id: String(clip.id || uid("clip")), assetId: String(clip.assetId || ""),
          name: String(clip.name || "Audio clip").slice(0, 120), start: Math.max(0, Number(clip.start) || 0),
          sourceStart: Math.max(0, Number(clip.sourceStart) || 0), duration: Math.max(0.03, Number(clip.duration) || 1),
          fadeIn: Math.max(0, Number(clip.fadeIn) || 0), fadeOut: Math.max(0, Number(clip.fadeOut) || 0),
          gain: clamp(clip.gain ?? 1, 0, 2), lane: clamp(clip.lane || 0, 0, 5), color: safeColor(clip.color, safeColor(track.color))
        })) : []
      })) : base.tracks;
    return {
      ...base,
      ...candidate,
      version: 1,
      project,
      transport: {
        ...base.transport,
        playhead: Math.max(0, Number(candidate.transport?.playhead) || 0),
        playing: false,
        loopEnabled: Boolean(candidate.transport?.loopEnabled),
        loopStart: Math.max(0, Number(candidate.transport?.loopStart) || 0),
        loopEnd: Math.max(0.25, Number(candidate.transport?.loopEnd) || 16),
        masterVolume: clamp(candidate.transport?.masterVolume ?? base.transport.masterVolume, 0, 1)
      },
      tracks,
      markers: Array.isArray(candidate.markers) ? candidate.markers.slice(0, 100).map((marker, index) => ({
        id: String(marker?.id || uid("marker")),
        time: Math.max(0, Number(marker?.time) || 0),
        label: String(marker?.label || `Marker ${index + 1}`).slice(0, 80)
      })) : base.markers,
      assets: Array.isArray(candidate.assets) ? candidate.assets.slice(0, 500) : [],
      selection: { ...base.selection, ...(candidate.selection || {}) },
      prompt: { ...base.prompt, ...(candidate.prompt || {}) },
      workflow: { ...base.workflow, ...(candidate.workflow || {}) },
      recording: { ...base.recording, ...(candidate.recording || {}), status: "idle" }
    };
  }

  function loadState() {
    try {
      return normalizeState(JSON.parse(root.localStorage?.getItem(STORAGE_KEY) || "null"));
    } catch {
      return defaultState();
    }
  }

  function saveState() {
    if (!runtime.state) return;
    runtime.state.updatedAt = new Date().toISOString();
    const snapshot = { ...runtime.state, transport: { ...runtime.state.transport, playing: false } };
    try { root.localStorage?.setItem(STORAGE_KEY, JSON.stringify(snapshot)); } catch {}
  }

  function openAssetDatabase() {
    return new Promise((resolve, reject) => {
      if (!root.indexedDB) return reject(new Error("IndexedDB không được hỗ trợ trên trình duyệt này."));
      const request = root.indexedDB.open(DATABASE_NAME, 1);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains(DATABASE_STORE)) request.result.createObjectStore(DATABASE_STORE);
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error("Không thể mở kho âm thanh cục bộ."));
    });
  }

  async function persistAssetBlob(assetId, blob) {
    try {
      const database = await openAssetDatabase();
      await new Promise((resolve, reject) => {
        const transaction = database.transaction(DATABASE_STORE, "readwrite");
        transaction.objectStore(DATABASE_STORE).put(blob, assetId);
        transaction.oncomplete = resolve;
        transaction.onerror = () => reject(transaction.error);
      });
      database.close();
      return true;
    } catch {
      return false;
    }
  }

  async function readAssetBlob(assetId) {
    try {
      const database = await openAssetDatabase();
      const blob = await new Promise((resolve, reject) => {
        const request = database.transaction(DATABASE_STORE, "readonly").objectStore(DATABASE_STORE).get(assetId);
        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => reject(request.error);
      });
      database.close();
      return blob;
    } catch {
      return null;
    }
  }

  function ensureAudioContext() {
    const AudioContextClass = root.AudioContext || root.webkitAudioContext;
    if (!AudioContextClass) throw new Error("Web Audio API không được hỗ trợ.");
    if (!runtime.audioContext || runtime.audioContext.state === "closed") runtime.audioContext = new AudioContextClass();
    return runtime.audioContext;
  }

  function computePeaks(audioBuffer, count = 180) {
    if (!audioBuffer?.length) return [];
    const channel = audioBuffer.getChannelData(0);
    const block = Math.max(1, Math.floor(channel.length / count));
    const peaks = [];
    for (let index = 0; index < count; index += 1) {
      let peak = 0;
      const start = index * block;
      const end = Math.min(channel.length, start + block);
      for (let cursor = start; cursor < end; cursor += 1) peak = Math.max(peak, Math.abs(channel[cursor]));
      peaks.push(round(peak, 3));
    }
    return peaks;
  }

  async function decodeBlob(blob) {
    const context = ensureAudioContext();
    return context.decodeAudioData(await blob.arrayBuffer());
  }

  function assetMeta(assetId) {
    return runtime.state.assets.find((asset) => asset.id === assetId) || null;
  }

  async function registerAudioBlob(blob, options = {}) {
    if (!(blob instanceof Blob)) throw new Error("Tệp âm thanh không hợp lệ.");
    const audioBuffer = await decodeBlob(blob);
    const id = options.id || uid("asset");
    const name = String(options.name || blob.name || `Audio ${runtime.state.assets.length + 1}`).slice(0, 120);
    const metadata = {
      id, name, type: blob.type || "audio/webm", size: blob.size || 0,
      duration: round(audioBuffer.duration, 3), sampleRate: audioBuffer.sampleRate,
      channels: audioBuffer.numberOfChannels, origin: options.origin || "file",
      peaks: computePeaks(audioBuffer), createdAt: new Date().toISOString(), persisted: false
    };
    runtime.assets.set(id, { buffer: audioBuffer, blob });
    const existingIndex = runtime.state.assets.findIndex((asset) => asset.id === id);
    if (existingIndex >= 0) runtime.state.assets[existingIndex] = metadata;
    else runtime.state.assets.unshift(metadata);
    metadata.persisted = await persistAssetBlob(id, blob);
    saveState();
    return metadata;
  }

  async function restoreAssets() {
    const pending = runtime.state.assets.slice(0, 100).map(async (metadata) => {
      const blob = await readAssetBlob(metadata.id);
      if (!blob) return;
      try {
        runtime.assets.set(metadata.id, { buffer: await decodeBlob(blob), blob });
        metadata.persisted = true;
      } catch {
        metadata.persisted = false;
      }
    });
    await Promise.all(pending);
    saveState();
    render();
  }

  function selectedTrack() {
    return runtime.state.tracks.find((track) => track.id === runtime.state.selection.trackId) || runtime.state.tracks[0] || null;
  }

  function selectedClip() {
    for (const track of runtime.state.tracks) {
      const clip = track.clips.find((item) => item.id === runtime.state.selection.clipId);
      if (clip) return { track, clip };
    }
    return null;
  }

  function projectDuration() {
    const clipEnd = runtime.state.tracks.reduce((maximum, track) => Math.max(maximum, ...track.clips.map((clip) => clip.start + clip.duration), 0), 0);
    return Math.max(32, clipEnd + 8, runtime.state.transport.loopEnd + 4);
  }

  function snapTime(value) {
    const snap = Number(runtime.state.project.snap);
    return snap > 0 ? Math.max(0, Math.round(Number(value || 0) / snap) * snap) : Math.max(0, Number(value || 0));
  }

  function waveformSvg(peaks, color) {
    const values = Array.isArray(peaks) && peaks.length ? peaks : Array.from({ length: 48 }, (_, index) => 0.15 + ((index * 13) % 23) / 45);
    const bars = values.map((peak, index) => {
      const height = Math.max(4, Number(peak) * 38);
      return `<line x1="${index + 0.5}" y1="${24 - height / 2}" x2="${index + 0.5}" y2="${24 + height / 2}" />`;
    }).join("");
    return `<svg class="mdaw-waveform" viewBox="0 0 ${values.length} 48" preserveAspectRatio="none" aria-hidden="true" style="color:${escapeHtml(color)}">${bars}</svg>`;
  }

  function timelineRuler(duration) {
    const step = duration > 180 ? 30 : duration > 90 ? 15 : 5;
    const marks = [];
    for (let second = 0; second <= duration; second += step) {
      marks.push(`<button class="mdaw-ruler__mark" style="left:${second * runtime.state.project.zoom}px" data-seek="${second}" title="Tới ${formatTime(second)}"><span>${formatTime(second).slice(0, 5)}</span></button>`);
    }
    return marks.join("");
  }

  function renderClip(track, clip) {
    const metadata = assetMeta(clip.assetId);
    const isSelected = runtime.state.selection.clipId === clip.id;
    const width = Math.max(32, clip.duration * runtime.state.project.zoom);
    const left = clip.start * runtime.state.project.zoom;
    const top = 8 + clip.lane * 48;
    const offline = !runtime.assets.has(clip.assetId);
    return `<button class="mdaw-clip${isSelected ? " is-selected" : ""}${offline ? " is-offline" : ""}" type="button" data-clip-id="${escapeHtml(clip.id)}" data-track-id="${escapeHtml(track.id)}" style="left:${left}px;top:${top}px;width:${width}px;--clip-color:${escapeHtml(clip.color)}" aria-pressed="${isSelected}">
      ${waveformSvg(metadata?.peaks, clip.color)}
      <span class="mdaw-clip__name">${escapeHtml(clip.name)}</span>
      <span class="mdaw-clip__meta">${formatTime(clip.duration)}${clip.lane ? ` · Take ${clip.lane + 1}` : ""}${offline ? " · Offline" : ""}</span>
      <i class="mdaw-clip__fade mdaw-clip__fade--in" style="width:${Math.min(50, clip.fadeIn / clip.duration * 100)}%"></i>
      <i class="mdaw-clip__fade mdaw-clip__fade--out" style="width:${Math.min(50, clip.fadeOut / clip.duration * 100)}%"></i>
    </button>`;
  }

  function renderTrack(track) {
    const laneCount = Math.max(1, ...track.clips.map((clip) => clip.lane + 1));
    return `<section class="mdaw-track" data-track-row="${escapeHtml(track.id)}" style="--track-color:${escapeHtml(track.color)};--lane-count:${laneCount}">
      <header class="mdaw-track__header">
        <button class="mdaw-track__select" data-action="select-track" data-track-id="${escapeHtml(track.id)}" type="button"><span class="mdaw-track__dot"></span><strong>${escapeHtml(track.name)}</strong></button>
        <div class="mdaw-track__mini-actions">
          <button type="button" data-action="toggle-mute" data-track-id="${escapeHtml(track.id)}" class="${track.muted ? "is-on" : ""}" aria-pressed="${track.muted}" title="Tắt tiếng">M</button>
          <button type="button" data-action="toggle-solo" data-track-id="${escapeHtml(track.id)}" class="${track.solo ? "is-on" : ""}" aria-pressed="${track.solo}" title="Solo">S</button>
        </div>
      </header>
      <div class="mdaw-track__lane" data-track-drop="${escapeHtml(track.id)}" style="min-height:${laneCount * 48 + 16}px">${track.clips.map((clip) => renderClip(track, clip)).join("")}</div>
    </section>`;
  }

  function renderAssetBrowser() {
    const assets = runtime.state.assets.map((asset) => `<li>
      <button type="button" class="mdaw-asset" data-action="add-asset" data-asset-id="${escapeHtml(asset.id)}" ${runtime.assets.has(asset.id) ? "" : "disabled"}>
        <span class="mdaw-asset__icon">♪</span><span><strong>${escapeHtml(asset.name)}</strong><small>${formatTime(asset.duration)} · ${formatBytes(asset.size)}${runtime.assets.has(asset.id) ? "" : " · Offline"}</small></span><span aria-hidden="true">＋</span>
      </button>
    </li>`).join("");
    return `<aside class="mdaw-library" aria-label="Dự án và thư viện âm thanh">
      <div class="mdaw-panel-title"><span>DỰ ÁN</span><button type="button" data-action="export-project" title="Xuất project JSON">Xuất</button></div>
      <label class="mdaw-project-name"><span>Tên dự án</span><input data-field="project.name" value="${escapeHtml(runtime.state.project.name)}" maxlength="80"></label>
      <div class="mdaw-project-stat"><span>${runtime.state.tracks.length} track</span><span>${runtime.state.assets.length} asset</span><span>${formatTime(projectDuration())}</span></div>
      <div class="mdaw-library__actions">
        <label class="mdaw-button mdaw-button--primary" tabindex="0">Nhập audio<input type="file" data-audio-picker accept="audio/*" multiple hidden></label>
        <label class="mdaw-button" tabindex="0">Mở project<input type="file" data-project-picker accept="application/json,.json" hidden></label>
      </div>
      <div class="mdaw-dropzone" data-audio-drop tabindex="0"><strong>Thả audio vào đây</strong><span>MP3, WAV, M4A, OGG, WebM</span></div>
      <div class="mdaw-panel-title"><span>ASSET CỤC BỘ</span><span>${runtime.state.assets.length}</span></div>
      <ul class="mdaw-asset-list">${assets || "<li class=\"mdaw-empty\">Chưa có audio. Hãy nhập tệp hoặc thu âm.</li>"}</ul>
      <div class="mdaw-panel-title"><span>SAMPLE LAB</span><span>LOCAL</span></div>
      <div class="mdaw-chip-grid">${Object.entries(SAMPLE_DEFINITIONS).map(([id, sample]) => `<button type="button" data-action="add-sample" data-sample="${id}">${escapeHtml(sample.label)}</button>`).join("")}</div>
      <div class="mdaw-panel-title"><span>PRESET SESSION</span></div>
      <div class="mdaw-preset-list">${Object.entries(PRESETS).map(([id, preset]) => `<button type="button" data-action="apply-preset" data-preset="${id}"><strong>${escapeHtml(preset.label)}</strong><small>${preset.bpm} BPM · ${preset.signature}</small></button>`).join("")}</div>
    </aside>`;
  }

  function renderToolbar() {
    const snapOptions = SNAP_VALUES.map((value) => `<option value="${value}"${Number(runtime.state.project.snap) === value ? " selected" : ""}>${value ? `${value}s` : "Tắt"}</option>`).join("");
    const signatures = SIGNATURES.map((signature) => `<option value="${signature}"${runtime.state.project.signature === signature ? " selected" : ""}>${signature}</option>`).join("");
    return `<header class="mdaw-toolbar">
      <div class="mdaw-workspaces" role="tablist" aria-label="Không gian làm việc">
        <button role="tab" type="button" data-switch-view="arrange" aria-selected="${runtime.view === "arrange"}" class="${runtime.view === "arrange" ? "is-active" : ""}">Phối khí</button>
        <button role="tab" type="button" data-switch-view="record" aria-selected="${runtime.view === "record"}" class="${runtime.view === "record" ? "is-active" : ""}">Thu âm</button>
        <span aria-disabled="true">Sáng tác</span><span aria-disabled="true">Lời bài hát</span><span aria-disabled="true">Mix</span><span aria-disabled="true">Master</span><span aria-disabled="true">Video</span><span aria-disabled="true">Xuất bản</span>
      </div>
      <div class="mdaw-project-controls">
        <label>BPM <input type="number" min="30" max="260" data-field="project.bpm" value="${runtime.state.project.bpm}"></label>
        <label>Nhịp <select data-field="project.signature">${signatures}</select></label>
        <label>Snap <select data-field="project.snap">${snapOptions}</select></label>
        <button type="button" data-action="add-track">＋ Track</button>
        <button type="button" data-action="add-marker">◇ Marker</button>
      </div>
    </header>`;
  }

  function renderRecorder() {
    const canRecord = Boolean(root.navigator?.mediaDevices?.getUserMedia && root.MediaRecorder);
    const status = runtime.state.recording.status;
    return `<section class="mdaw-recorder" aria-labelledby="mdaw-recorder-title">
      <div class="mdaw-recorder__copy"><span>VOCAL CAPTURE</span><h2 id="mdaw-recorder-title">Phòng thu cục bộ</h2><p>Âm thanh chỉ được ghi sau thao tác rõ ràng của bạn và không tự tải lên máy chủ.</p></div>
      <div class="mdaw-recorder__meter"><i data-input-meter></i><span data-record-time>${status === "recording" ? "00:00.00" : "Sẵn sàng"}</span></div>
      <button class="mdaw-record-button${status === "recording" ? " is-recording" : ""}" type="button" data-action="record-toggle" ${canRecord ? "" : "disabled"}>${status === "recording" ? "Dừng & lưu take" : "Bắt đầu thu âm"}</button>
      <p class="mdaw-recorder__status" role="status">${escapeHtml(canRecord ? runtime.state.recording.message : "Trình duyệt này không hỗ trợ MediaRecorder hoặc quyền micro.")}</p>
      ${runtime.recordUrl ? `<audio controls src="${escapeHtml(runtime.recordUrl)}">Trình duyệt không phát được bản thu.</audio>` : ""}
    </section>`;
  }

  function renderTimeline() {
    const duration = projectDuration();
    const width = Math.max(920, duration * runtime.state.project.zoom);
    const loop = runtime.state.transport;
    return `<main class="mdaw-arrangement" aria-label="Timeline nhiều track">
      ${runtime.view === "record" ? renderRecorder() : ""}
      <div class="mdaw-editbar">
        <div>
          <button type="button" data-action="split">Cắt tại playhead</button>
          <button type="button" data-action="duplicate">Nhân đôi</button>
          <button type="button" data-action="new-take">Take mới</button>
          <button type="button" data-action="delete">Xóa</button>
        </div>
        <div>
          <button type="button" data-action="toggle-loop" class="${loop.loopEnabled ? "is-active" : ""}" aria-pressed="${loop.loopEnabled}">Loop</button>
          <label>In <input type="number" min="0" step="0.25" value="${loop.loopStart}" data-field="transport.loopStart"></label>
          <label>Out <input type="number" min="0.25" step="0.25" value="${loop.loopEnd}" data-field="transport.loopEnd"></label>
          <label>Zoom <input type="range" min="16" max="120" value="${runtime.state.project.zoom}" data-field="project.zoom"></label>
        </div>
      </div>
      <div class="mdaw-timeline-scroll" data-timeline-scroll>
        <div class="mdaw-timeline" style="width:${width + 174}px;--beat-size:${Math.max(8, runtime.state.project.zoom * 60 / runtime.state.project.bpm)}px">
          <div class="mdaw-ruler-spacer">TRACK</div>
          <div class="mdaw-ruler" data-ruler style="width:${width}px">${timelineRuler(duration)}
            ${runtime.state.markers.map((marker) => `<button type="button" class="mdaw-marker" data-marker-id="${escapeHtml(marker.id)}" style="left:${marker.time * runtime.state.project.zoom}px" title="${escapeHtml(marker.label)}"></button>`).join("")}
            <div class="mdaw-loop-region${loop.loopEnabled ? " is-visible" : ""}" style="left:${loop.loopStart * runtime.state.project.zoom}px;width:${Math.max(2, (loop.loopEnd - loop.loopStart) * runtime.state.project.zoom)}px"></div>
          </div>
          <div class="mdaw-track-stack">${runtime.state.tracks.map(renderTrack).join("")}</div>
          <div class="mdaw-playhead" data-playhead style="left:${174 + loop.playhead * runtime.state.project.zoom}px"><span></span></div>
        </div>
      </div>
    </main>`;
  }

  function renderInspector() {
    const selection = selectedClip();
    const prompt = runtime.state.prompt;
    const adapters = runtime.state.workflow;
    if (!selection) {
      return `<aside class="mdaw-inspector" aria-label="Thuộc tính và AI prompt">
        <div class="mdaw-panel-title"><span>INSPECTOR</span><span>LOCAL</span></div>
        <div class="mdaw-inspector-empty"><b>Chưa chọn clip</b><p>Chọn một clip trên timeline để chỉnh trim, fade, gain và take lane.</p></div>
        ${renderPrompt(prompt)}
        <div class="mdaw-adapters"><h3>Adapter nâng cao</h3><p><span>Warp marker</span><b>${escapeHtml(adapters.warp)}</b></p><p><span>Time stretch</span><b>${escapeHtml(adapters.timeStretch)}</b></p><small>Chưa có engine DSP nên các tác vụ này không được quảng cáo là đã hoạt động.</small></div>
      </aside>`;
    }
    const { track, clip } = selection;
    return `<aside class="mdaw-inspector" aria-label="Thuộc tính và AI prompt">
      <div class="mdaw-panel-title"><span>CLIP INSPECTOR</span><span>${escapeHtml(track.name)}</span></div>
      <label>Tên clip<input data-clip-field="name" value="${escapeHtml(clip.name)}" maxlength="120"></label>
      <div class="mdaw-field-pair"><label>Vị trí<input type="number" min="0" step="0.01" data-clip-field="start" value="${clip.start}"></label><label>Độ dài<input type="number" min="0.03" step="0.01" data-clip-field="duration" value="${clip.duration}"></label></div>
      <div class="mdaw-field-pair"><label>Trim đầu<input type="number" min="0" step="0.01" data-clip-field="sourceStart" value="${clip.sourceStart}"></label><label>Take lane<input type="number" min="0" max="5" step="1" data-clip-field="lane" value="${clip.lane}"></label></div>
      <label>Gain <output>${Math.round(clip.gain * 100)}%</output><input type="range" min="0" max="2" step="0.01" data-clip-field="gain" value="${clip.gain}"></label>
      <label>Fade in <output>${clip.fadeIn.toFixed(2)}s</output><input type="range" min="0" max="${Math.max(0.01, clip.duration / 2)}" step="0.01" data-clip-field="fadeIn" value="${clip.fadeIn}"></label>
      <label>Fade out <output>${clip.fadeOut.toFixed(2)}s</output><input type="range" min="0" max="${Math.max(0.01, clip.duration / 2)}" step="0.01" data-clip-field="fadeOut" value="${clip.fadeOut}"></label>
      <div class="mdaw-panel-title"><span>TRACK EFFECTS</span></div>
      <label>High-pass <output>${track.effects.highpass} Hz</output><input type="range" min="0" max="1000" step="10" data-track-effect="highpass" value="${track.effects.highpass}"></label>
      <label class="mdaw-check"><input type="checkbox" data-track-effect="compressor" ${track.effects.compressor ? "checked" : ""}> Compressor Web Audio</label>
      ${renderPrompt(prompt)}
    </aside>`;
  }

  function renderPrompt(prompt) {
    return `<section class="mdaw-prompt"><div class="mdaw-panel-title"><span>AI PROMPT DESK</span><span>LOCAL GUIDE</span></div>
      <label for="mdaw-prompt-input">Ý tưởng phối khí</label>
      <textarea id="mdaw-prompt-input" data-prompt-input placeholder="Ví dụ: Điệp khúc rộng hơn, vocal rõ, trống mạnh...">${escapeHtml(prompt.text)}</textarea>
      <button type="button" data-action="analyze-prompt">Tạo production brief</button>
      ${prompt.result ? `<output class="mdaw-prompt__result">${escapeHtml(prompt.result)}</output>` : ""}
      <small>Đây là gợi ý cục bộ có quy tắc, không gọi AI bên ngoài và không tự sửa dự án.</small>
    </section>`;
  }

  function renderMixer() {
    return `<footer class="mdaw-console" aria-label="Transport, mixer và master meter">
      <div class="mdaw-transport">
        <button type="button" data-action="rewind" title="Về đầu">|◀</button>
        <button type="button" data-action="play" class="mdaw-play" aria-pressed="${runtime.state.transport.playing}">${runtime.state.transport.playing ? "❚❚" : "▶"}</button>
        <button type="button" data-action="stop">■</button>
        <output data-time-display>${formatTime(runtime.state.transport.playhead)}</output>
      </div>
      <div class="mdaw-mixer-scroll">${runtime.state.tracks.map((track) => `<section class="mdaw-channel" style="--track-color:${escapeHtml(track.color)}">
        <strong>${escapeHtml(track.name)}</strong>
        <label>VOL<input type="range" min="0" max="1.2" step="0.01" value="${track.volume}" data-track-field="volume" data-track-id="${escapeHtml(track.id)}"></label>
        <label>PAN<input type="range" min="-1" max="1" step="0.01" value="${track.pan}" data-track-field="pan" data-track-id="${escapeHtml(track.id)}"></label>
      </section>`).join("")}</div>
      <section class="mdaw-master"><span>MASTER</span><div class="mdaw-master__meter"><i data-master-meter></i></div><label>Output<input type="range" min="0" max="1" step="0.01" value="${runtime.state.transport.masterVolume}" data-field="transport.masterVolume"></label></section>
    </footer>`;
  }

  function render() {
    if (!runtime.host || !runtime.state) return;
    runtime.host.innerHTML = `<section class="mdaw-shell" data-view="${escapeHtml(runtime.view)}">
      ${renderToolbar()}
      <div class="mdaw-workspace-grid">${renderAssetBrowser()}${renderTimeline()}${renderInspector()}</div>
      ${renderMixer()}
      <div class="mdaw-toast" data-toast role="status" aria-live="polite"></div>
    </section>`;
  }

  function showToast(message, tone = "info") {
    const toast = runtime.host?.querySelector("[data-toast]");
    if (!toast) return;
    toast.textContent = String(message || "");
    toast.dataset.tone = tone;
    toast.classList.add("is-visible");
    root.clearTimeout(showToast.timer);
    showToast.timer = root.setTimeout(() => toast.classList.remove("is-visible"), 2800);
  }

  async function addFiles(files, trackId) {
    const audioFiles = Array.from(files || []).filter((file) => file.type.startsWith("audio/") || /\.(mp3|wav|m4a|aac|ogg|flac|webm)$/i.test(file.name));
    if (!audioFiles.length) return showToast("Không tìm thấy tệp âm thanh hợp lệ.", "warning");
    const target = runtime.state.tracks.find((track) => track.id === trackId) || selectedTrack();
    let cursor = runtime.state.transport.playhead;
    for (const file of audioFiles) {
      try {
        const metadata = await registerAudioBlob(file, { name: file.name, origin: "file" });
        if (target) {
          target.clips.push({ id: uid("clip"), assetId: metadata.id, name: metadata.name, start: snapTime(cursor), sourceStart: 0, duration: metadata.duration, fadeIn: 0.02, fadeOut: 0.05, gain: 1, lane: 0, color: target.color });
          cursor += metadata.duration;
        }
      } catch (error) {
        showToast(`${file.name}: ${error.message || "không giải mã được"}`, "error");
      }
    }
    saveState();
    render();
    showToast(`Đã thêm ${audioFiles.length} tệp vào dự án.`, "success");
  }

  function createSampleBuffer(definition) {
    const context = ensureAudioContext();
    const length = Math.ceil(context.sampleRate * definition.duration);
    const buffer = context.createBuffer(1, length, context.sampleRate);
    const channel = buffer.getChannelData(0);
    for (let index = 0; index < length; index += 1) {
      const time = index / context.sampleRate;
      const phase = 2 * Math.PI * definition.frequency * time;
      const oscillator = definition.type === "square" ? (Math.sin(phase) >= 0 ? 1 : -1) : Math.sin(phase);
      channel[index] = oscillator * Math.exp(-definition.decay * time) * 0.65;
    }
    return buffer;
  }

  async function addBuiltInSample(sampleId) {
    const definition = SAMPLE_DEFINITIONS[sampleId];
    if (!definition) return;
    try {
      const buffer = createSampleBuffer(definition);
      const id = uid("sample");
      const metadata = { id, name: definition.label, type: "audio/x-generated", size: buffer.length * 4, duration: buffer.duration, sampleRate: buffer.sampleRate, channels: 1, origin: "generated-local", peaks: computePeaks(buffer), createdAt: new Date().toISOString(), persisted: false };
      runtime.assets.set(id, { buffer, blob: null });
      runtime.state.assets.unshift(metadata);
      addAssetToTrack(id);
    } catch (error) {
      showToast(error.message, "error");
    }
  }

  function addAssetToTrack(assetId) {
    const metadata = assetMeta(assetId);
    const track = selectedTrack();
    if (!metadata || !track || !runtime.assets.has(assetId)) return showToast("Asset đang offline hoặc chưa có track đích.", "warning");
    const clip = { id: uid("clip"), assetId, name: metadata.name, start: snapTime(runtime.state.transport.playhead), sourceStart: 0, duration: metadata.duration, fadeIn: 0.02, fadeOut: 0.05, gain: 1, lane: 0, color: track.color };
    track.clips.push(clip);
    runtime.state.selection = { trackId: track.id, clipId: clip.id };
    saveState(); render();
  }

  function splitSelectedClip() {
    const selection = selectedClip();
    if (!selection) return showToast("Hãy chọn clip cần cắt.", "warning");
    const { track, clip } = selection;
    const point = snapTime(runtime.state.transport.playhead);
    const relative = point - clip.start;
    if (relative <= 0.03 || relative >= clip.duration - 0.03) return showToast("Playhead phải nằm bên trong clip.", "warning");
    const right = { ...clip, id: uid("clip"), name: `${clip.name} B`, start: point, sourceStart: clip.sourceStart + relative, duration: clip.duration - relative, fadeIn: 0 };
    clip.name = `${clip.name} A`;
    clip.duration = relative;
    clip.fadeOut = 0;
    track.clips.push(right);
    runtime.state.selection.clipId = right.id;
    saveState(); render();
  }

  function duplicateSelected(asTake = false) {
    const selection = selectedClip();
    if (!selection) return showToast("Hãy chọn clip cần nhân đôi.", "warning");
    const copy = { ...selection.clip, id: uid("clip"), name: `${selection.clip.name} copy` };
    if (asTake) copy.lane = clamp(selection.clip.lane + 1, 0, 5);
    else copy.start = snapTime(selection.clip.start + selection.clip.duration);
    selection.track.clips.push(copy);
    runtime.state.selection.clipId = copy.id;
    saveState(); render();
  }

  function deleteSelected() {
    const selection = selectedClip();
    if (!selection) return;
    selection.track.clips = selection.track.clips.filter((clip) => clip.id !== selection.clip.id);
    runtime.state.selection.clipId = "";
    saveState(); render();
  }

  function stopPlayback(reset = false) {
    runtime.playbackNodes.forEach((node) => { try { node.stop?.(); } catch {} try { node.disconnect?.(); } catch {} });
    runtime.playbackNodes = [];
    try { runtime.masterGain?.disconnect(); } catch {}
    try { runtime.masterAnalyser?.disconnect(); } catch {}
    runtime.masterGain = null;
    runtime.masterAnalyser = null;
    root.cancelAnimationFrame?.(runtime.animationFrame);
    runtime.animationFrame = 0;
    if (runtime.state) {
      runtime.state.transport.playing = false;
      if (reset) runtime.state.transport.playhead = 0;
      updateTransportDom();
      const meter = runtime.host?.querySelector("[data-master-meter]");
      if (meter) meter.style.height = "0%";
      saveState();
    }
  }

  function connectTrackGraph(context, track, masterGain) {
    const gain = context.createGain();
    gain.gain.value = track.muted ? 0 : track.volume;
    let current = gain;
    const pan = typeof context.createStereoPanner === "function" ? context.createStereoPanner() : null;
    if (pan) { pan.pan.value = track.pan; current.connect(pan); current = pan; }
    if (Number(track.effects.highpass) > 0) {
      const filter = context.createBiquadFilter();
      filter.type = "highpass"; filter.frequency.value = track.effects.highpass;
      current.connect(filter); current = filter;
    }
    if (track.effects.compressor) {
      const compressor = context.createDynamicsCompressor();
      compressor.threshold.value = -22; compressor.ratio.value = 4;
      current.connect(compressor); current = compressor;
    }
    current.connect(masterGain);
    runtime.playbackNodes.push(gain);
    if (pan) runtime.playbackNodes.push(pan);
    if (current !== gain && current !== pan) runtime.playbackNodes.push(current);
    return gain;
  }

  async function startPlayback(from = runtime.state.transport.playhead) {
    stopPlayback(false);
    let context;
    try { context = ensureAudioContext(); await context.resume(); } catch (error) { return showToast(error.message, "error"); }
    const hasSolo = runtime.state.tracks.some((track) => track.solo);
    const masterGain = context.createGain();
    masterGain.gain.value = runtime.state.transport.masterVolume;
    const analyser = context.createAnalyser();
    analyser.fftSize = 256;
    masterGain.connect(analyser); analyser.connect(context.destination);
    runtime.masterGain = masterGain; runtime.masterAnalyser = analyser;
    let scheduled = 0;
    runtime.state.tracks.forEach((track) => {
      if (track.muted || (hasSolo && !track.solo)) return;
      const trackInput = connectTrackGraph(context, track, masterGain);
      track.clips.forEach((clip) => {
        const asset = runtime.assets.get(clip.assetId);
        if (!asset?.buffer || clip.start + clip.duration <= from) return;
        const source = context.createBufferSource();
        const clipGain = context.createGain();
        source.buffer = asset.buffer;
        source.connect(clipGain); clipGain.connect(trackInput);
        const lateBy = Math.max(0, from - clip.start);
        const when = context.currentTime + Math.max(0, clip.start - from);
        const offset = Math.min(asset.buffer.duration, clip.sourceStart + lateBy);
        const duration = Math.min(clip.duration - lateBy, asset.buffer.duration - offset);
        if (duration <= 0) return;
        const baseGain = clip.gain;
        clipGain.gain.setValueAtTime(baseGain, when);
        if (clip.fadeIn > lateBy) {
          clipGain.gain.setValueAtTime(Math.max(0.0001, baseGain * lateBy / Math.max(0.001, clip.fadeIn)), when);
          clipGain.gain.linearRampToValueAtTime(baseGain, when + clip.fadeIn - lateBy);
        }
        const fadeOutStart = clip.duration - clip.fadeOut;
        if (clip.fadeOut > 0 && fadeOutStart < lateBy + duration) {
          const fadeWhen = when + Math.max(0, fadeOutStart - lateBy);
          clipGain.gain.setValueAtTime(baseGain, fadeWhen);
          clipGain.gain.linearRampToValueAtTime(0.0001, when + duration);
        }
        source.start(when, offset, duration);
        runtime.playbackNodes.push(source, clipGain);
        scheduled += 1;
      });
    });
    if (!scheduled) {
      masterGain.disconnect(); analyser.disconnect();
      return showToast("Không có clip online để phát từ vị trí này.", "warning");
    }
    runtime.state.transport.playhead = from;
    runtime.state.transport.playing = true;
    runtime.playStartedAt = performance.now() - from * 1000;
    animatePlayback();
    updateTransportDom();
  }

  function animatePlayback() {
    if (!runtime.state?.transport.playing) return;
    const transport = runtime.state.transport;
    transport.playhead = Math.max(0, (performance.now() - runtime.playStartedAt) / 1000);
    if (transport.loopEnabled && transport.loopEnd > transport.loopStart && transport.playhead >= transport.loopEnd) {
      startPlayback(transport.loopStart);
      return;
    }
    if (transport.playhead >= projectDuration()) {
      stopPlayback(true);
      return;
    }
    updateTransportDom();
    updateMasterMeter();
    runtime.animationFrame = root.requestAnimationFrame(animatePlayback);
  }

  function updateTransportDom() {
    const time = runtime.host?.querySelector("[data-time-display]");
    const playhead = runtime.host?.querySelector("[data-playhead]");
    const playButton = runtime.host?.querySelector("[data-action='play']");
    if (time) time.textContent = formatTime(runtime.state.transport.playhead);
    if (playhead) playhead.style.left = `${174 + runtime.state.transport.playhead * runtime.state.project.zoom}px`;
    if (playButton) { playButton.textContent = runtime.state.transport.playing ? "❚❚" : "▶"; playButton.setAttribute("aria-pressed", String(runtime.state.transport.playing)); }
  }

  function updateMasterMeter() {
    const meter = runtime.host?.querySelector("[data-master-meter]");
    if (!meter || !runtime.masterAnalyser) return;
    const values = new Uint8Array(runtime.masterAnalyser.frequencyBinCount);
    runtime.masterAnalyser.getByteTimeDomainData(values);
    let sum = 0;
    values.forEach((value) => { const normalized = (value - 128) / 128; sum += normalized * normalized; });
    meter.style.height = `${Math.min(100, Math.sqrt(sum / values.length) * 170)}%`;
  }

  async function startRecording() {
    if (!root.navigator?.mediaDevices?.getUserMedia || !root.MediaRecorder) {
      runtime.state.recording = { ...runtime.state.recording, status: "unsupported", message: "MediaRecorder hoặc getUserMedia không khả dụng." };
      render(); return;
    }
    try {
      const stream = await root.navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: false } });
      if (!runtime.host || !runtime.state) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      runtime.mediaStream = stream;
      runtime.recordingChunks = [];
      runtime.mediaRecorder = new root.MediaRecorder(runtime.mediaStream);
      runtime.mediaRecorder.ondataavailable = (event) => { if (event.data?.size) runtime.recordingChunks.push(event.data); };
      runtime.mediaRecorder.onerror = () => {
        runtime.state.recording.status = "error";
        runtime.state.recording.message = "Thiết bị ghi âm báo lỗi.";
        render();
      };
      runtime.mediaRecorder.onstop = finishRecording;
      runtime.mediaRecorder.start(250);
      runtime.recordingStartedAt = performance.now();
      runtime.state.recording = { ...runtime.state.recording, status: "recording", message: "Đang thu cục bộ. Bấm Dừng để tạo take mới." };
      setupInputMeter(runtime.mediaStream);
      render();
      runtime.recordingTimer = root.setInterval(updateRecordingTime, 80);
    } catch (error) {
      runtime.mediaStream?.getTracks().forEach((track) => track.stop());
      runtime.mediaStream = null;
      if (!runtime.state) return;
      runtime.state.recording = { ...runtime.state.recording, status: "denied", message: error?.name === "NotAllowedError" ? "Quyền micro đã bị từ chối. Bạn có thể cấp lại trong cài đặt trình duyệt." : `Không mở được micro: ${error?.message || "lỗi thiết bị"}` };
      render();
    }
  }

  function setupInputMeter(stream) {
    try {
      const context = ensureAudioContext();
      const source = context.createMediaStreamSource(stream);
      const analyser = context.createAnalyser(); analyser.fftSize = 256;
      source.connect(analyser); runtime.inputAnalyser = analyser;
      const tick = () => {
        if (!runtime.inputAnalyser || runtime.state?.recording.status !== "recording") return;
        const values = new Uint8Array(runtime.inputAnalyser.frequencyBinCount); analyser.getByteTimeDomainData(values);
        let peak = 0; values.forEach((value) => { peak = Math.max(peak, Math.abs(value - 128) / 128); });
        const meter = runtime.host?.querySelector("[data-input-meter]"); if (meter) meter.style.width = `${Math.min(100, peak * 150)}%`;
        runtime.inputAnimationFrame = root.requestAnimationFrame(tick);
      };
      tick();
    } catch {}
  }

  function updateRecordingTime() {
    const output = runtime.host?.querySelector("[data-record-time]");
    if (output) output.textContent = formatTime((performance.now() - runtime.recordingStartedAt) / 1000);
  }

  function stopRecording() {
    if (runtime.mediaRecorder?.state === "recording") runtime.mediaRecorder.stop();
  }

  async function finishRecording() {
    root.clearInterval(runtime.recordingTimer); runtime.recordingTimer = 0;
    root.cancelAnimationFrame?.(runtime.inputAnimationFrame); runtime.inputAnimationFrame = 0;
    runtime.mediaStream?.getTracks().forEach((track) => track.stop()); runtime.mediaStream = null;
    const blob = new Blob(runtime.recordingChunks, { type: runtime.mediaRecorder?.mimeType || "audio/webm" });
    runtime.mediaRecorder = null; runtime.recordingChunks = [];
    if (!blob.size) {
      runtime.state.recording = { ...runtime.state.recording, status: "error", message: "Bản thu không có dữ liệu." }; render(); return;
    }
    try {
      const name = `Take ${new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}`;
      const metadata = await registerAudioBlob(blob, { name, origin: "micro" });
      if (runtime.recordUrl) { URL.revokeObjectURL(runtime.recordUrl); runtime.objectUrls.delete(runtime.recordUrl); }
      runtime.recordUrl = URL.createObjectURL(blob); runtime.objectUrls.add(runtime.recordUrl);
      const track = selectedTrack() || runtime.state.tracks[0];
      const lane = Math.max(0, ...track.clips.filter((clip) => Math.abs(clip.start - runtime.state.transport.playhead) < 0.1).map((clip) => clip.lane + 1));
      const clip = { id: uid("clip"), assetId: metadata.id, name, start: snapTime(runtime.state.transport.playhead), sourceStart: 0, duration: metadata.duration, fadeIn: 0.02, fadeOut: 0.05, gain: 1, lane: clamp(lane, 0, 5), color: track.color };
      track.clips.push(clip); runtime.state.selection = { trackId: track.id, clipId: clip.id };
      runtime.state.recording = { status: "ready", message: "Đã lưu take vào IndexedDB và đặt lên timeline.", lastName: name };
      saveState(); render();
    } catch (error) {
      runtime.state.recording = { ...runtime.state.recording, status: "error", message: `Không xử lý được bản thu: ${error.message}` }; render();
    }
  }

  function applyPreset(presetId) {
    const preset = PRESETS[presetId]; if (!preset) return;
    runtime.state.project.bpm = preset.bpm; runtime.state.project.signature = preset.signature;
    preset.tracks.forEach((name, index) => {
      if (runtime.state.tracks[index]) runtime.state.tracks[index].name = name;
      else runtime.state.tracks.push(defaultTrack(name, ["#ff65ba", "#63dff0", "#b8f06b", "#f3d36b"][index % 4]));
    });
    saveState(); render(); showToast(`Đã áp dụng ${preset.label}.`, "success");
  }

  function exportProject() {
    const payload = { format: "hh-music-daw", version: 1, exportedAt: new Date().toISOString(), note: "Audio blob không nằm trong JSON; asset đã lưu cục bộ trong IndexedDB của thiết bị này.", project: runtime.state };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob); runtime.objectUrls.add(url);
    const link = document.createElement("a"); link.href = url; link.download = `${safeFilename(runtime.state.project.name)}.hhmusic.json`; link.click();
    root.setTimeout(() => { URL.revokeObjectURL(url); runtime.objectUrls.delete(url); }, 1000);
  }

  async function importProject(file) {
    try {
      const payload = JSON.parse(await file.text());
      if (payload?.format !== "hh-music-daw" || !payload.project) throw new Error("Đây không phải project HH Music hợp lệ.");
      stopPlayback(false); runtime.assets.clear(); runtime.state = normalizeState(payload.project); saveState(); render(); await restoreAssets();
      showToast("Đã mở project. Asset chưa có trên thiết bị sẽ hiện Offline.", "success");
    } catch (error) { showToast(error.message || "Không đọc được project.", "error"); }
  }

  function analyzePrompt() {
    const input = runtime.host?.querySelector("[data-prompt-input]");
    const text = String(input?.value || "").trim().slice(0, 1000);
    runtime.state.prompt.text = text;
    if (!text) runtime.state.prompt.result = "Hãy nhập mục tiêu âm thanh trước khi tạo brief.";
    else {
      const lower = text.toLowerCase();
      const suggestions = [];
      if (/vocal|giọng|hát/.test(lower)) suggestions.push("giảm nhạc nền 2–3 dB quanh vocal và thử high-pass 80 Hz");
      if (/mạnh|năng lượng|điệp khúc/.test(lower)) suggestions.push("tăng tương phản bằng layer trống/bass ở đoạn điệp khúc");
      if (/êm|nhẹ|thư giãn|lofi/.test(lower)) suggestions.push("giữ transient mềm, giảm high-frequency và dùng fade dài hơn");
      if (/rộng|stereo/.test(lower)) suggestions.push("mở stereo cho pad nhưng giữ bass và vocal chính ở giữa");
      if (!suggestions.length) suggestions.push("tạo marker cho từng section, nghe A/B và chỉnh từng track trước khi master");
      runtime.state.prompt.result = `Production brief (${runtime.state.project.bpm} BPM, ${runtime.state.project.signature}): ${suggestions.join("; ")}. Đây là gợi ý, chưa thay đổi timeline.`;
    }
    saveState(); render();
  }

  function setNestedField(path, value) {
    const [group, field] = path.split(".");
    if (!runtime.state[group] || !field) return;
    const numeric = ["bpm", "zoom", "snap", "masterVolume", "loopStart", "loopEnd"].includes(field);
    runtime.state[group][field] = numeric ? Number(value) : String(value).slice(0, 120);
    if (field === "bpm") runtime.state[group][field] = clamp(value, 30, 260);
    if (field === "zoom") runtime.state[group][field] = clamp(value, 16, 120);
    if (field === "loopStart") runtime.state[group][field] = Math.max(0, Number(value) || 0);
    if (field === "loopEnd") runtime.state[group][field] = Math.max(runtime.state.transport.loopStart + 0.25, Number(value) || 0.25);
    if (field === "masterVolume" && runtime.masterGain) runtime.masterGain.gain.value = clamp(value, 0, 1);
    saveState();
  }

  function handleClick(event) {
    const clipButton = event.target.closest("[data-clip-id]");
    if (clipButton) {
      runtime.state.selection = { trackId: clipButton.dataset.trackId, clipId: clipButton.dataset.clipId };
      saveState(); render(); return;
    }
    const viewButton = event.target.closest("[data-switch-view]");
    if (viewButton) { runtime.view = viewButton.dataset.switchView; render(); return; }
    const seekButton = event.target.closest("[data-seek]");
    if (seekButton) { runtime.state.transport.playhead = Number(seekButton.dataset.seek) || 0; stopPlayback(false); updateTransportDom(); saveState(); return; }
    const ruler = event.target.closest("[data-ruler]");
    if (ruler) {
      const bounds = ruler.getBoundingClientRect();
      runtime.state.transport.playhead = snapTime((event.clientX - bounds.left) / runtime.state.project.zoom);
      stopPlayback(false); updateTransportDom(); saveState(); return;
    }
    const button = event.target.closest("[data-action]");
    if (!button) return;
    const action = button.dataset.action;
    if (action === "play") runtime.state.transport.playing ? stopPlayback(false) : startPlayback();
    else if (action === "stop") stopPlayback(true);
    else if (action === "rewind") { stopPlayback(false); runtime.state.transport.playhead = 0; updateTransportDom(); saveState(); }
    else if (action === "split") splitSelectedClip();
    else if (action === "duplicate") duplicateSelected(false);
    else if (action === "new-take") duplicateSelected(true);
    else if (action === "delete") deleteSelected();
    else if (action === "add-track") { runtime.state.tracks.push(defaultTrack(`Track ${runtime.state.tracks.length + 1}`, ["#ff65ba", "#63dff0", "#b8f06b", "#f3d36b"][runtime.state.tracks.length % 4])); saveState(); render(); }
    else if (action === "select-track") { runtime.state.selection.trackId = button.dataset.trackId; runtime.state.selection.clipId = ""; saveState(); render(); }
    else if (action === "toggle-mute" || action === "toggle-solo") { const track = runtime.state.tracks.find((item) => item.id === button.dataset.trackId); if (track) track[action === "toggle-mute" ? "muted" : "solo"] = !track[action === "toggle-mute" ? "muted" : "solo"]; saveState(); render(); }
    else if (action === "add-asset") addAssetToTrack(button.dataset.assetId);
    else if (action === "add-sample") addBuiltInSample(button.dataset.sample);
    else if (action === "apply-preset") applyPreset(button.dataset.preset);
    else if (action === "add-marker") { runtime.state.markers.push({ id: uid("marker"), time: snapTime(runtime.state.transport.playhead), label: `Marker ${runtime.state.markers.length + 1}` }); saveState(); render(); }
    else if (action === "toggle-loop") { runtime.state.transport.loopEnabled = !runtime.state.transport.loopEnabled; if (runtime.state.transport.loopEnd <= runtime.state.transport.loopStart) runtime.state.transport.loopEnd = runtime.state.transport.loopStart + 8; saveState(); render(); }
    else if (action === "analyze-prompt") analyzePrompt();
    else if (action === "record-toggle") runtime.state.recording.status === "recording" ? stopRecording() : startRecording();
    else if (action === "export-project") exportProject();
  }

  function handleInput(event) {
    const field = event.target.dataset.field;
    if (field) {
      setNestedField(field, event.target.value);
      if (["project.zoom", "project.signature", "project.snap"].includes(field)) render();
      return;
    }
    const clipField = event.target.dataset.clipField;
    if (clipField) {
      const selection = selectedClip(); if (!selection) return;
      const numeric = clipField !== "name";
      let value = numeric ? Number(event.target.value) : String(event.target.value).slice(0, 120);
      if (["start", "sourceStart", "fadeIn", "fadeOut"].includes(clipField)) value = Math.max(0, value || 0);
      if (clipField === "duration") value = Math.max(0.03, value || 0.03);
      if (clipField === "lane") value = clamp(Math.round(value), 0, 5);
      if (clipField === "gain") value = clamp(value, 0, 2);
      if (clipField === "fadeIn" || clipField === "fadeOut") value = Math.min(value, selection.clip.duration / 2);
      selection.clip[clipField] = value; saveState();
      if (event.type === "change") render();
      return;
    }
    const trackField = event.target.dataset.trackField;
    if (trackField) {
      const track = runtime.state.tracks.find((item) => item.id === event.target.dataset.trackId);
      if (track) { track[trackField] = trackField === "pan" ? clamp(event.target.value, -1, 1) : clamp(event.target.value, 0, 1.2); saveState(); }
      return;
    }
    const effect = event.target.dataset.trackEffect;
    if (effect) {
      const track = selectedClip()?.track || selectedTrack();
      if (track) { track.effects[effect] = event.target.type === "checkbox" ? event.target.checked : Number(event.target.value); saveState(); if (event.type === "change") render(); }
    }
  }

  function handleChange(event) {
    if (event.target.matches("[data-audio-picker]")) { addFiles(event.target.files); event.target.value = ""; }
    else if (event.target.matches("[data-project-picker]") && event.target.files[0]) { importProject(event.target.files[0]); event.target.value = ""; }
    else handleInput(event);
  }

  function handleKeydown(event) {
    const fileLabel = event.target.closest?.("label[tabindex]");
    if (fileLabel && (event.key === "Enter" || event.code === "Space")) {
      event.preventDefault();
      fileLabel.querySelector("input[type='file']")?.click();
      return;
    }
    if (event.target.matches("input, textarea, select")) return;
    if (event.code === "Space") { event.preventDefault(); runtime.state.transport.playing ? stopPlayback(false) : startPlayback(); }
    else if (event.key === "Delete" || event.key === "Backspace") { event.preventDefault(); deleteSelected(); }
    else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "d") { event.preventDefault(); duplicateSelected(false); }
    else if (event.key.toLowerCase() === "s") splitSelectedClip();
  }

  function handleDrop(event) {
    const dropzone = event.target.closest("[data-audio-drop], [data-track-drop]");
    if (!dropzone) return;
    event.preventDefault();
    runtime.host.querySelectorAll(".is-dragover").forEach((element) => element.classList.remove("is-dragover"));
    addFiles(event.dataTransfer?.files, dropzone.dataset.trackDrop);
  }

  function bind() {
    const events = [
      ["click", handleClick], ["input", handleInput], ["change", handleChange], ["keydown", handleKeydown],
      ["dragover", (event) => { const zone = event.target.closest("[data-audio-drop], [data-track-drop]"); if (zone && event.dataTransfer?.types.includes("Files")) { event.preventDefault(); zone.classList.add("is-dragover"); } }],
      ["dragleave", (event) => event.target.closest("[data-audio-drop], [data-track-drop]")?.classList.remove("is-dragover")],
      ["drop", handleDrop]
    ];
    events.forEach(([type, handler]) => { runtime.host.addEventListener(type, handler); runtime.listeners.push([runtime.host, type, handler]); });
  }

  function cleanupRuntime() {
    stopPlayback(false);
    root.clearInterval(runtime.recordingTimer);
    root.cancelAnimationFrame?.(runtime.inputAnimationFrame);
    if (runtime.mediaRecorder?.state === "recording") {
      runtime.mediaRecorder.onstop = null;
      runtime.mediaRecorder.ondataavailable = null;
      try { runtime.mediaRecorder.stop(); } catch {}
    }
    runtime.mediaStream?.getTracks().forEach((track) => track.stop());
    runtime.mediaStream = null; runtime.mediaRecorder = null; runtime.inputAnalyser = null;
    runtime.listeners.forEach(([target, type, handler]) => target.removeEventListener(type, handler)); runtime.listeners = [];
    runtime.objectUrls.forEach((url) => URL.revokeObjectURL(url)); runtime.objectUrls.clear(); runtime.recordUrl = "";
    if (runtime.audioContext && runtime.audioContext.state !== "closed") runtime.audioContext.close().catch(() => {});
    runtime.audioContext = null; runtime.assets.clear();
  }

  function mount(host, options = {}) {
    if (!host || typeof host.innerHTML !== "string") throw new TypeError("HHMusicDAWWorkspace.mount cần một phần tử host hợp lệ.");
    unmount();
    runtime.host = host;
    runtime.view = SUPPORTED_VIEWS.has(options.view) ? options.view : "arrange";
    runtime.state = loadState();
    runtime.state.recording.status = "idle";
    render(); bind(); restoreAssets();
  }

  function unmount() {
    if (runtime.state) saveState();
    cleanupRuntime();
    if (runtime.host) runtime.host.innerHTML = "";
    runtime.host = null; runtime.state = null;
  }

  const api = { supports: (id) => SUPPORTED_VIEWS.has(id), mount, unmount };
  root.HHMusicDAWWorkspace = api;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = { STORAGE_KEY, SIGNATURES, SNAP_VALUES, supports: api.supports, escapeHtml, formatTime, normalizeState, computePeaks, snapValue: (value, snap) => snap > 0 ? Math.max(0, Math.round(Number(value || 0) / snap) * snap) : Math.max(0, Number(value || 0)) };
  }
})(typeof window !== "undefined" ? window : globalThis);
