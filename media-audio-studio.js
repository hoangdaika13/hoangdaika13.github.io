(function initHHMediaAudioStudio(root, factory) {
  "use strict";
  const api = factory(root || globalThis);
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.HHMediaAudioStudio = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createHHMediaAudioStudio(root) {
  "use strict";

  const STORAGE_KEY = "hh.media.audio-studio.v1";
  let active = null;
  const clamp = (value, min, max) => Math.max(min, Math.min(max, Number(value) || 0));
  const escapeHtml = (value) => String(value == null ? "" : value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
  const formatTime = (seconds) => `${Math.floor(Math.max(0, seconds) / 60)}:${String(Math.floor(Math.max(0, seconds) % 60)).padStart(2, "0")}.${String(Math.floor((Math.max(0, seconds) % 1) * 10))}`;
  function normalizeState(input) {
    const raw = input && typeof input === "object" ? input : {};
    return {
      gain: clamp(raw.gain ?? 0, -24, 12),
      normalize: raw.normalize !== false,
      fadeIn: clamp(raw.fadeIn ?? .15, 0, 10),
      fadeOut: clamp(raw.fadeOut ?? .25, 0, 10),
      gate: clamp(raw.gate ?? -54, -80, -12),
      compressor: raw.compressor !== false,
      limiter: clamp(raw.limiter ?? -1, -12, 0),
      start: Math.max(0, Number(raw.start) || 0),
      end: Math.max(0, Number(raw.end) || 0)
    };
  }
  function trimRange(duration, start, end) {
    const safeDuration = Math.max(0, Number(duration) || 0), from = clamp(start, 0, safeDuration), to = clamp(end || safeDuration, from, safeDuration);
    return { start: from, end: to, duration: Math.max(0, to - from) };
  }
  function encodeWav(buffer) {
    const channels = Math.max(1, buffer.numberOfChannels || 1), sampleRate = buffer.sampleRate || 44100, length = buffer.length || 0;
    const output = new ArrayBuffer(44 + length * channels * 2), view = new DataView(output);
    const write = (offset, text) => { for (let index = 0; index < text.length; index += 1) view.setUint8(offset + index, text.charCodeAt(index)); };
    write(0, "RIFF"); view.setUint32(4, 36 + length * channels * 2, true); write(8, "WAVE"); write(12, "fmt "); view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, channels, true); view.setUint32(24, sampleRate, true); view.setUint32(28, sampleRate * channels * 2, true); view.setUint16(32, channels * 2, true); view.setUint16(34, 16, true); write(36, "data"); view.setUint32(40, length * channels * 2, true);
    let offset = 44;
    for (let frame = 0; frame < length; frame += 1) for (let channel = 0; channel < channels; channel += 1) {
      const data = buffer.getChannelData(Math.min(channel, buffer.numberOfChannels - 1)), sample = clamp(data[frame], -1, 1);
      view.setInt16(offset, sample < 0 ? sample * 32768 : sample * 32767, true); offset += 2;
    }
    return output;
  }
  function processBuffer(context, source, settings) {
    const state = normalizeState(settings), range = trimRange(source.duration, state.start, state.end), startFrame = Math.floor(range.start * source.sampleRate), frames = Math.max(1, Math.floor(range.duration * source.sampleRate));
    const output = context.createBuffer(source.numberOfChannels, frames, source.sampleRate), gain = Math.pow(10, state.gain / 20), gate = Math.pow(10, state.gate / 20), compressorThreshold = Math.pow(10, -18 / 20), limit = Math.pow(10, state.limiter / 20);
    let peak = 0;
    for (let channel = 0; channel < source.numberOfChannels; channel += 1) {
      const input = source.getChannelData(channel), target = output.getChannelData(channel);
      for (let frame = 0; frame < frames; frame += 1) {
        let sample = (input[startFrame + frame] || 0) * gain, magnitude = Math.abs(sample);
        if (magnitude < gate) sample = 0;
        else if (state.compressor && magnitude > compressorThreshold) sample = Math.sign(sample) * (compressorThreshold + (magnitude - compressorThreshold) / 4);
        sample = clamp(sample, -limit, limit); target[frame] = sample; peak = Math.max(peak, Math.abs(sample));
      }
    }
    const normalizeGain = state.normalize && peak > 0 ? Math.min(8, .98 / peak) : 1, fadeInFrames = Math.min(frames, Math.floor(state.fadeIn * source.sampleRate)), fadeOutFrames = Math.min(frames, Math.floor(state.fadeOut * source.sampleRate));
    for (let channel = 0; channel < output.numberOfChannels; channel += 1) {
      const data = output.getChannelData(channel);
      for (let frame = 0; frame < frames; frame += 1) {
        let envelope = 1;
        if (fadeInFrames && frame < fadeInFrames) envelope *= frame / fadeInFrames;
        if (fadeOutFrames && frame >= frames - fadeOutFrames) envelope *= (frames - frame - 1) / fadeOutFrames;
        data[frame] = clamp(data[frame] * normalizeGain * Math.max(0, envelope), -1, 1);
      }
    }
    return output;
  }
  function drawWaveform(canvas, buffer, state) {
    const context = canvas?.getContext?.("2d"); if (!context) return;
    const width = canvas.width = Math.max(720, Math.floor(canvas.clientWidth * Math.min(2, root.devicePixelRatio || 1))), height = canvas.height = Math.max(220, Math.floor(canvas.clientHeight * Math.min(2, root.devicePixelRatio || 1)));
    context.clearRect(0, 0, width, height); context.fillStyle = "#07152a"; context.fillRect(0, 0, width, height);
    context.strokeStyle = "rgba(104,238,218,.12)"; context.lineWidth = 1;
    for (let line = 1; line < 8; line += 1) { const x = width * line / 8; context.beginPath(); context.moveTo(x, 0); context.lineTo(x, height); context.stroke(); }
    if (!buffer) { context.fillStyle = "#91a9c5"; context.font = `${Math.max(16, width / 48)}px system-ui`; context.textAlign = "center"; context.fillText("Thả audio hoặc chọn tệp để dựng waveform thật", width / 2, height / 2); return; }
    const data = buffer.getChannelData(0), step = Math.max(1, Math.floor(data.length / width)), center = height / 2;
    context.strokeStyle = "#6cf2dc"; context.lineWidth = 1.5; context.shadowColor = "#48efd5"; context.shadowBlur = 9; context.beginPath();
    for (let x = 0; x < width; x += 1) { let min = 1, max = -1; const start = x * step; for (let index = 0; index < step; index += 1) { const sample = data[start + index] || 0; min = Math.min(min, sample); max = Math.max(max, sample); } context.moveTo(x, center + min * center * .86); context.lineTo(x, center + max * center * .86); }
    context.stroke(); context.shadowBlur = 0;
    const range = trimRange(buffer.duration, state.start, state.end), left = range.start / buffer.duration * width, right = range.end / buffer.duration * width;
    context.fillStyle = "rgba(255,103,210,.2)"; context.fillRect(0, 0, left, height); context.fillRect(right, 0, width - right, height); context.strokeStyle = "#ff75d5"; context.lineWidth = 3; context.strokeRect(left, 1, Math.max(1, right - left), height - 2);
  }
  function loadSaved() { try { return normalizeState(JSON.parse(root.localStorage?.getItem(STORAGE_KEY) || "{}")); } catch (_) { return normalizeState({}); } }
  function save(state) { try { root.localStorage?.setItem(STORAGE_KEY, JSON.stringify(normalizeState(state))); } catch (_) {} }
  function download(bytes, name) { const blob = new Blob([bytes], { type: "audio/wav" }), url = URL.createObjectURL(blob), anchor = document.createElement("a"); anchor.href = url; anchor.download = name; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }

  function mount(host, options) {
    if (!host) return null; unmount();
    const controller = new AbortController(), AudioContext = root.AudioContext || root.webkitAudioContext, audioContext = AudioContext ? new AudioContext() : null;
    const session = { host, controller, audioContext, source: null, buffer: null, file: null, stream: null, recorder: null, chunks: [], state: loadSaved(), playing: null, options: options || {} }; active = session;
    host.innerHTML = `<section class="mas-studio" data-media-audio-studio><header><div><small>AUDIO & PODCAST · LOCAL-FIRST</small><h2>Waveform Studio</h2><p>Cắt, fade, gate, compressor, limiter, normalize và xuất WAV trực tiếp trên thiết bị.</p></div><div><span data-mas-status>Chưa có audio</span><label>＋ Mở audio<input type="file" accept="audio/*" multiple data-mas-file></label></div></header><div class="mas-grid"><main><section class="mas-wave-card"><header><div><strong data-mas-name>Chưa chọn tệp</strong><small data-mas-meta>Audio không rời khỏi thiết bị</small></div><div><button type="button" data-mas-play disabled>▶ Phát vùng chọn</button><button type="button" data-mas-stop disabled>■ Dừng</button></div></header><canvas data-mas-wave aria-label="Waveform audio"></canvas><div class="mas-trim"><label>Bắt đầu <span data-mas-start-label>0:00.0</span><input type="range" min="0" max="100" value="0" data-mas-start></label><label>Kết thúc <span data-mas-end-label>0:00.0</span><input type="range" min="0" max="100" value="100" data-mas-end></label></div></section><section class="mas-timeline"><span><i></i>TRACK 1 · ORIGINAL</span><div><b></b><em></em></div><span><i></i>BUS · PROCESSED</span><div><b></b><em></em></div></section></main><aside><section><header><small>INPUT</small><strong>Gain & cleanup</strong></header><label>Gain <b data-mas-gain-label>${session.state.gain} dB</b><input type="range" min="-24" max="12" step=".5" value="${session.state.gain}" data-mas-setting="gain"></label><label>Noise gate <b data-mas-gate-label>${session.state.gate} dB</b><input type="range" min="-80" max="-12" step="1" value="${session.state.gate}" data-mas-setting="gate"></label><label class="mas-switch"><input type="checkbox" data-mas-setting="compressor" ${session.state.compressor ? "checked" : ""}><span>Compressor 4:1 · −18 dB</span></label></section><section><header><small>ENVELOPE</small><strong>Fade & loudness</strong></header><label>Fade in <b data-mas-fade-in-label>${session.state.fadeIn}s</b><input type="range" min="0" max="10" step=".05" value="${session.state.fadeIn}" data-mas-setting="fadeIn"></label><label>Fade out <b data-mas-fade-out-label>${session.state.fadeOut}s</b><input type="range" min="0" max="10" step=".05" value="${session.state.fadeOut}" data-mas-setting="fadeOut"></label><label>Limiter <b data-mas-limiter-label>${session.state.limiter} dB</b><input type="range" min="-12" max="0" step=".5" value="${session.state.limiter}" data-mas-setting="limiter"></label><label class="mas-switch"><input type="checkbox" data-mas-setting="normalize" ${session.state.normalize ? "checked" : ""}><span>Normalize peak tới −0.17 dBFS</span></label></section><section class="mas-recorder"><header><small>MICROPHONE</small><strong>Podcast recorder</strong></header><button type="button" data-mas-record>● Bắt đầu thu</button><small>Trình duyệt sẽ hỏi quyền microphone. Bản thu chỉ được giữ local.</small></section></aside></div><footer><button type="button" data-mas-save-bin disabled>＋ Global Media Bin</button><span>PCM 16-bit · giữ sample rate nguồn</span><button type="button" class="is-primary" data-mas-export disabled>Xuất WAV vùng chọn →</button></footer><div class="mas-toast" data-mas-toast hidden></div></section>`;
    const canvas = host.querySelector("[data-mas-wave]"); drawWaveform(canvas, null, session.state);
    const announce = (message, tone) => { const node = host.querySelector("[data-mas-toast]"); if (!node) return; node.textContent = message; node.dataset.tone = tone || "info"; node.hidden = false; clearTimeout(announce.timer); announce.timer = setTimeout(() => { if (node.isConnected) node.hidden = true; }, 3200); };
    const updateLabels = () => {
      const duration = session.buffer?.duration || 0, range = trimRange(duration, session.state.start, session.state.end || duration);
      host.querySelector("[data-mas-start]").value = duration ? String(range.start / duration * 100) : "0"; host.querySelector("[data-mas-end]").value = duration ? String(range.end / duration * 100) : "100";
      host.querySelector("[data-mas-start-label]").textContent = formatTime(range.start); host.querySelector("[data-mas-end-label]").textContent = formatTime(range.end);
      [["gain", "gain"], ["gate", "gate"], ["fade-in", "fadeIn"], ["fade-out", "fadeOut"], ["limiter", "limiter"]].forEach(([label, key]) => { const node = host.querySelector(`[data-mas-${label}-label]`); if (node) node.textContent = `${session.state[key]}${key.startsWith("fade") ? "s" : " dB"}`; });
      drawWaveform(canvas, session.buffer, session.state); save(session.state);
    };
    const loadFile = async (file) => {
      if (!audioContext || !file) { announce("Web Audio chưa khả dụng trên trình duyệt này.", "error"); return; }
      try { host.querySelector("[data-mas-status]").textContent = "Đang giải mã…"; const data = await file.arrayBuffer(); session.buffer = await audioContext.decodeAudioData(data.slice(0)); session.file = file; session.state.start = 0; session.state.end = session.buffer.duration; host.querySelector("[data-mas-name]").textContent = file.name; host.querySelector("[data-mas-meta]").textContent = `${formatTime(session.buffer.duration)} · ${session.buffer.sampleRate} Hz · ${session.buffer.numberOfChannels} kênh · ${(file.size / 1048576).toFixed(2)} MB`; host.querySelector("[data-mas-status]").textContent = "Audio sẵn sàng"; host.querySelectorAll("[data-mas-play],[data-mas-stop],[data-mas-export],[data-mas-save-bin]").forEach((button) => { button.disabled = false; }); updateLabels(); announce("Đã dựng waveform từ dữ liệu audio thật.", "success"); } catch (error) { announce(`Không giải mã được audio: ${error.message}`, "error"); }
    };
    const stopPlayback = () => { try { session.playing?.stop(); } catch (_) {} session.playing = null; host.classList.remove("is-playing"); };
    host.addEventListener("click", async (event) => {
      if (event.target.closest("[data-mas-play]")) { if (!session.buffer || !audioContext) return; stopPlayback(); await audioContext.resume(); const processed = processBuffer(audioContext, session.buffer, session.state), source = audioContext.createBufferSource(); source.buffer = processed; source.connect(audioContext.destination); source.onended = () => { session.playing = null; host.classList.remove("is-playing"); }; session.playing = source; host.classList.add("is-playing"); source.start(); return; }
      if (event.target.closest("[data-mas-stop]")) { stopPlayback(); return; }
      if (event.target.closest("[data-mas-export]")) { if (!session.buffer || !audioContext) return; const processed = processBuffer(audioContext, session.buffer, session.state); download(encodeWav(processed), `${(session.file?.name || "hh-audio").replace(/\.[^.]+$/, "")}-processed.wav`); announce("Đã xuất WAV PCM 16-bit thật.", "success"); return; }
      if (event.target.closest("[data-mas-save-bin]")) { if (!session.file || !session.options.mediaApi?.createStore) return; const store = session.options.mediaApi.createStore(); try { await store.ready(); const project = (await store.listProjects())[0] || await store.saveProject({ name: "Universal Media Project" }); await store.saveAsset({ projectId: project.id, name: session.file.name, type: session.file.type, size: session.file.size, lastModified: session.file.lastModified, blob: session.file }); announce("Đã thêm audio nguồn vào Global Media Bin.", "success"); } catch (error) { announce(error.message, "error"); } finally { try { await store.close?.(); } catch (_) {} } return; }
      const record = event.target.closest("[data-mas-record]"); if (record) { if (session.recorder?.state === "recording") { session.recorder.stop(); record.textContent = "● Bắt đầu thu"; return; } if (!root.navigator?.mediaDevices?.getUserMedia || typeof root.MediaRecorder !== "function") { announce("Trình duyệt chưa hỗ trợ ghi âm MediaRecorder.", "error"); return; } try { session.stream = await root.navigator.mediaDevices.getUserMedia({ audio: true }); session.chunks = []; session.recorder = new root.MediaRecorder(session.stream); session.recorder.ondataavailable = (item) => { if (item.data?.size) session.chunks.push(item.data); }; session.recorder.onstop = async () => { const blob = new Blob(session.chunks, { type: session.recorder.mimeType || "audio/webm" }), file = new File([blob], `podcast-${Date.now()}.webm`, { type: blob.type }); session.stream?.getTracks().forEach((track) => track.stop()); session.stream = null; await loadFile(file); }; session.recorder.start(250); record.textContent = "■ Dừng và mở bản thu"; announce("Đang thu microphone trên thiết bị.", "success"); } catch (error) { announce(`Không mở được microphone: ${error.message}`, "error"); } }
    }, { signal: controller.signal });
    host.addEventListener("change", (event) => { if (event.target.matches("[data-mas-file]")) { loadFile(event.target.files?.[0]); event.target.value = ""; } }, { signal: controller.signal });
    host.addEventListener("input", (event) => { const setting = event.target.dataset.masSetting; if (setting) { session.state[setting] = event.target.type === "checkbox" ? event.target.checked : Number(event.target.value); updateLabels(); return; } if (event.target.matches("[data-mas-start],[data-mas-end]")) { const duration = session.buffer?.duration || 0, value = Number(event.target.value) / 100 * duration; if (event.target.matches("[data-mas-start]")) session.state.start = Math.min(value, session.state.end - .02); else session.state.end = Math.max(value, session.state.start + .02); updateLabels(); } }, { signal: controller.signal });
    host.addEventListener("dragover", (event) => event.preventDefault(), { signal: controller.signal }); host.addEventListener("drop", (event) => { const file = [...(event.dataTransfer?.files || [])].find((item) => item.type.startsWith("audio/")); if (file) { event.preventDefault(); loadFile(file); } }, { signal: controller.signal });
    return Object.freeze({ getState: () => ({ ...session.state }), loadFile, unmount });
  }
  function unmount() { if (!active) return; try { active.playing?.stop(); } catch (_) {} try { active.recorder?.stop(); } catch (_) {} active.stream?.getTracks?.().forEach((track) => track.stop()); active.controller.abort(); active.audioContext?.close?.().catch?.(() => {}); active.host.innerHTML = ""; active = null; }
  return Object.freeze({ STORAGE_KEY, normalizeState, trimRange, encodeWav, processBuffer, mount, unmount });
});
