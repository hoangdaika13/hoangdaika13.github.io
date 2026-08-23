(function initHHMediaAudioStudio(root, factory) {
  "use strict";
  const api = factory(root || globalThis);
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.HHMediaAudioStudio = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createHHMediaAudioStudio(root) {
  "use strict";

  const STORAGE_KEY = "hh.media.audio-studio.v2";
  const LEGACY_STORAGE_KEY = "hh.media.audio-studio.v1";
  const LIMITS = Object.freeze({ tracks: 12, markers: 100, regions: 80, automation: 160, history: 40, fileBytes: 256 * 1024 * 1024, renderBytes: 192 * 1024 * 1024 });
  let active = null;
  const clamp = (value, min, max) => Math.max(min, Math.min(max, Number(value) || 0));
  const cleanText = (value, max = 120) => String(value == null ? "" : value).replace(/[<>\u0000-\u001f]/g, " ").trim().slice(0, max);
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
      pan: clamp(raw.pan ?? 0, -100, 100),
      highPass: clamp(raw.highPass ?? 70, 0, 400),
      loopPreview: Boolean(raw.loopPreview),
      ducking: {
        enabled: Boolean(raw.ducking?.enabled),
        amountDb: clamp(raw.ducking?.amountDb ?? 10, 0, 24),
        thresholdDb: clamp(raw.ducking?.thresholdDb ?? -32, -60, -6),
        attack: clamp(raw.ducking?.attack ?? .025, .005, .5),
        release: clamp(raw.ducking?.release ?? .28, .02, 2)
      },
      start: Math.max(0, Number(raw.start) || 0),
      end: Math.max(0, Number(raw.end) || 0),
      markers: Array.isArray(raw.markers) ? raw.markers.slice(-LIMITS.markers).map((item, index) => ({ id: cleanText(item?.id || `chapter-${index + 1}`, 80), time: clamp(item?.time, 0, 86400), title: cleanText(item?.title || "Chương", 120) || "Chương" })) : [],
      regions: Array.isArray(raw.regions) ? raw.regions.slice(-LIMITS.regions).map((item, index) => { const start = clamp(item?.start, 0, 86400), end = clamp(item?.end, start, 86400); return { id: cleanText(item?.id || `region-${index + 1}`, 80), start, end, title: cleanText(item?.title || `Vùng ${index + 1}`, 120) || `Vùng ${index + 1}` }; }).filter((item) => item.end > item.start) : [],
      activeRegion: cleanText(raw.activeRegion || "", 80),
      podcast: {
        title: String(raw.podcast?.title || "").slice(0, 160),
        show: String(raw.podcast?.show || "HH Podcast").slice(0, 160),
        author: String(raw.podcast?.author || "").slice(0, 120),
        description: String(raw.podcast?.description || "").slice(0, 600),
        episode: clamp(raw.podcast?.episode ?? 1, 1, 99999),
        language: cleanText(raw.podcast?.language || "vi", 16) || "vi",
        category: cleanText(raw.podcast?.category || "Education", 80) || "Education",
        explicit: Boolean(raw.podcast?.explicit)
      }
    };
  }
  function normalizeTrack(input, index = 0) {
    const raw = input && typeof input === "object" ? input : {};
    const sourceDuration = clamp(raw.sourceDuration || raw.buffer?.duration || raw.sourceOut || 0, 0, 86400), sourceIn = clamp(raw.sourceIn, 0, sourceDuration), sourceOut = clamp(raw.sourceOut || sourceDuration, sourceIn, sourceDuration);
    return {
      id: cleanText(raw.id || `track-${index + 1}`, 80) || `track-${index + 1}`,
      name: cleanText(raw.name || raw.file?.name || `Track ${index + 1}`, 160) || `Track ${index + 1}`,
      gain: clamp(raw.gain ?? 0, -24, 12),
      pan: clamp(raw.pan ?? 0, -100, 100),
      muted: Boolean(raw.muted),
      solo: Boolean(raw.solo),
      offset: clamp(raw.offset, 0, 86400),
      sourceDuration,
      sourceIn,
      sourceOut,
      loop: Boolean(raw.loop),
      loopCount: Math.round(clamp(raw.loopCount || 1, 1, 32)),
      fadeIn: clamp(raw.fadeIn, 0, 10),
      fadeOut: clamp(raw.fadeOut, 0, 10),
      role: ["voice", "music", "sfx"].includes(raw.role) ? raw.role : index === 0 ? "voice" : "music",
      automation: Array.isArray(raw.automation) ? raw.automation.slice(-LIMITS.automation).map((point) => ({ time: clamp(point?.time, 0, 86400), value: clamp(point?.value ?? 1, 0, 1.5) })).sort((a, b) => a.time - b.time) : [],
      file: raw.file || null,
      buffer: raw.buffer || null,
      analysis: raw.analysis && typeof raw.analysis === "object" ? raw.analysis : null
    };
  }
  function trackSegmentDuration(track) { const item = normalizeTrack(track); return Math.max(0, item.sourceOut - item.sourceIn); }
  function trackTimelineDuration(track) { const item = normalizeTrack(track), segment = trackSegmentDuration(item); return segment * (item.loop ? item.loopCount : 1); }
  function automationValue(points, time) {
    const rows = (Array.isArray(points) ? points : []).slice(-LIMITS.automation).map((point) => ({ time: clamp(point?.time, 0, 86400), value: clamp(point?.value ?? 1, 0, 1.5) })).sort((a, b) => a.time - b.time);
    if (!rows.length) return 1;
    if (time <= rows[0].time) return rows[0].value;
    const last = rows[rows.length - 1]; if (time >= last.time) return last.value;
    for (let index = 1; index < rows.length; index += 1) if (time <= rows[index].time) { const before = rows[index - 1], after = rows[index], ratio = (time - before.time) / Math.max(.000001, after.time - before.time); return before.value + (after.value - before.value) * ratio; }
    return 1;
  }
  function updateRegions(input, operation = {}) {
    const state = normalizeState({ regions: input }), rows = state.regions.slice(), index = rows.findIndex((item) => item.id === operation.id);
    if (operation.type === "add" && rows.length < LIMITS.regions) {
      const start = clamp(operation.region?.start, 0, 86400), end = clamp(operation.region?.end, start, 86400), id = cleanText(operation.region?.id || `region-${Date.now()}`, 80);
      if (end > start && id && !rows.some((item) => item.id === id)) rows.push({ id, start, end, title: cleanText(operation.region?.title || `Vùng ${rows.length + 1}`, 120) || `Vùng ${rows.length + 1}` });
    } else if (operation.type === "remove" && index >= 0) rows.splice(index, 1);
    else if (operation.type === "update" && index >= 0) { const patch = operation.patch || {}, start = clamp(patch.start ?? rows[index].start, 0, 86400), end = clamp(patch.end ?? rows[index].end, start, 86400); if (end > start) rows[index] = { ...rows[index], start, end, title: cleanText(patch.title ?? rows[index].title, 120) || rows[index].title }; }
    return rows.sort((a, b) => a.start - b.start).slice(-LIMITS.regions);
  }
  function updateTrackList(input, operation = {}) {
    operation = operation && typeof operation === "object" ? operation : {};
    const tracks = (Array.isArray(input) ? input : []).slice(0, LIMITS.tracks).map(normalizeTrack);
    const index = tracks.findIndex((track) => track.id === operation.id);
    if (operation.type === "add" && tracks.length < LIMITS.tracks) {
      const next = normalizeTrack(operation.track, tracks.length);
      if (!tracks.some((track) => track.id === next.id)) tracks.push(next);
    } else if (operation.type === "remove" && index >= 0) tracks.splice(index, 1);
    else if (operation.type === "duplicate" && index >= 0 && tracks.length < LIMITS.tracks) {
      const source = tracks[index], copy = normalizeTrack({ ...source, id: cleanText(operation.newId || `${source.id}-copy`, 80), name: `${source.name} · bản sao`, offset: operation.at ?? source.offset + trackTimelineDuration(source) }, tracks.length);
      if (!tracks.some((track) => track.id === copy.id)) tracks.splice(index + 1, 0, copy);
    } else if (operation.type === "move" && index >= 0) {
      const target = clamp(index + Number(operation.delta || 0), 0, tracks.length - 1);
      if (target !== index) tracks.splice(target, 0, tracks.splice(index, 1)[0]);
    } else if (operation.type === "update" && index >= 0) tracks[index] = normalizeTrack({ ...tracks[index], ...(operation.patch || {}), id: tracks[index].id }, index);
    else if (operation.type === "split" && index >= 0 && tracks.length < LIMITS.tracks) {
      const source = tracks[index], segment = trackSegmentDuration(source), at = clamp(operation.at, source.offset, source.offset + segment), relative = at - source.offset;
      if (!source.loop && relative > .001 && relative < segment - .001) {
        const rightId = cleanText(operation.newId || `${source.id}-split-${Date.now()}`, 80);
        if (!tracks.some((track) => track.id === rightId)) {
          const cut = source.sourceIn + relative, left = normalizeTrack({ ...source, sourceOut: cut }, index), right = normalizeTrack({ ...source, id: rightId, name: `${source.name} · B`, offset: at, sourceIn: cut }, index + 1);
          tracks.splice(index, 1, left, right);
        }
      }
    } else if (operation.type === "trim" && index >= 0) {
      const source = tracks[index], segment = trackSegmentDuration(source), currentEnd = source.offset + segment, from = clamp(operation.start ?? source.offset, source.offset, currentEnd), to = clamp(operation.end ?? currentEnd, from, currentEnd);
      if (to - from > .001) tracks[index] = normalizeTrack({ ...source, offset: from, sourceIn: source.sourceIn + from - source.offset, sourceOut: source.sourceIn + to - source.offset, loop: false, loopCount: 1 }, index);
    } else if (operation.type === "add-automation" && index >= 0) {
      const source = tracks[index], segment = trackTimelineDuration(source), time = clamp(operation.time, 0, segment), value = clamp(operation.value ?? 1, 0, 1.5), points = source.automation.filter((point) => Math.abs(point.time - time) > .001);
      points.push({ time, value }); tracks[index] = normalizeTrack({ ...source, automation: points.sort((a, b) => a.time - b.time).slice(-LIMITS.automation) }, index);
    } else if (operation.type === "remove-automation" && index >= 0) {
      const source = tracks[index], time = Number(operation.time); tracks[index] = normalizeTrack({ ...source, automation: Number.isFinite(time) ? source.automation.filter((point) => Math.abs(point.time - time) > .001) : [] }, index);
    }
    return tracks;
  }
  function trimRange(duration, start, end) {
    const safeDuration = Math.max(0, Number(duration) || 0), from = clamp(start, 0, safeDuration), to = clamp(end || safeDuration, from, safeDuration);
    return { start: from, end: to, duration: Math.max(0, to - from) };
  }
  function encodeWav(buffer) {
    if (!buffer || typeof buffer.getChannelData !== "function" || !(buffer.numberOfChannels > 0)) throw new TypeError("AudioBuffer không hợp lệ.");
    const channels = Math.max(1, buffer.numberOfChannels || 1), sampleRate = buffer.sampleRate || 44100, length = buffer.length || 0;
    const byteLength = 44 + length * channels * 2;
    if (byteLength > LIMITS.renderBytes) throw new Error(`WAV đầu ra vượt giới hạn an toàn ${Math.round(LIMITS.renderBytes / 1048576)} MB.`);
    const output = new ArrayBuffer(byteLength), view = new DataView(output);
    const write = (offset, text) => { for (let index = 0; index < text.length; index += 1) view.setUint8(offset + index, text.charCodeAt(index)); };
    write(0, "RIFF"); view.setUint32(4, 36 + length * channels * 2, true); write(8, "WAVE"); write(12, "fmt "); view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, channels, true); view.setUint32(24, sampleRate, true); view.setUint32(28, sampleRate * channels * 2, true); view.setUint16(32, channels * 2, true); view.setUint16(34, 16, true); write(36, "data"); view.setUint32(40, length * channels * 2, true);
    let offset = 44;
    for (let frame = 0; frame < length; frame += 1) for (let channel = 0; channel < channels; channel += 1) {
      const data = buffer.getChannelData(Math.min(channel, buffer.numberOfChannels - 1)), sample = clamp(data[frame], -1, 1);
      view.setInt16(offset, sample < 0 ? sample * 32768 : sample * 32767, true); offset += 2;
    }
    return output;
  }
  async function encodeWavAsync(buffer, options = {}) {
    if (!buffer || typeof buffer.getChannelData !== "function" || !(buffer.numberOfChannels > 0)) throw new TypeError("AudioBuffer không hợp lệ.");
    const channels = clamp(buffer?.numberOfChannels || 1, 1, 32), sampleRate = clamp(buffer?.sampleRate || 44100, 8000, 384000), length = Math.max(0, Math.floor(Number(buffer?.length) || 0));
    const byteLength = 44 + length * channels * 2;
    if (byteLength > LIMITS.renderBytes) throw new Error(`WAV đầu ra vượt giới hạn an toàn ${Math.round(LIMITS.renderBytes / 1048576)} MB.`);
    const output = new ArrayBuffer(byteLength), view = new DataView(output);
    const write = (offset, value) => { for (let index = 0; index < value.length; index += 1) view.setUint8(offset + index, value.charCodeAt(index)); };
    write(0, "RIFF"); view.setUint32(4, 36 + length * channels * 2, true); write(8, "WAVE"); write(12, "fmt "); view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, channels, true); view.setUint32(24, sampleRate, true); view.setUint32(28, sampleRate * channels * 2, true); view.setUint16(32, channels * 2, true); view.setUint16(34, 16, true); write(36, "data"); view.setUint32(40, length * channels * 2, true);
    const channelData = Array.from({ length: channels }, (_, channel) => buffer.getChannelData(Math.min(channel, buffer.numberOfChannels - 1)));
    let offset = 44;
    for (let from = 0; from < length; from += 65536) {
      if (options.signal?.aborted) { const error = new Error("Đã hủy mã hóa"); error.name = "AbortError"; throw error; }
      const to = Math.min(length, from + 65536);
      for (let frame = from; frame < to; frame += 1) for (let channel = 0; channel < channels; channel += 1) {
        const sample = clamp(channelData[channel][frame], -1, 1);
        view.setInt16(offset, sample < 0 ? sample * 32768 : sample * 32767, true); offset += 2;
      }
      options.onProgress?.(to / Math.max(1, length));
      await (typeof root.scheduler?.yield === "function" ? root.scheduler.yield() : new Promise((resolve) => root.setTimeout(resolve, 0)));
    }
    return output;
  }
  function processBuffer(context, source, settings) {
    if (!context?.createBuffer || !source || typeof source.getChannelData !== "function" || !(source.numberOfChannels > 0) || !(source.sampleRate > 0)) throw new TypeError("AudioBuffer hoặc AudioContext không hợp lệ.");
    const state = normalizeState(settings), range = trimRange(source.duration, state.start, state.end), startFrame = Math.floor(range.start * source.sampleRate), frames = Math.max(1, Math.floor(range.duration * source.sampleRate));
    const output = context.createBuffer(source.numberOfChannels, frames, source.sampleRate), gain = Math.pow(10, state.gain / 20), gate = Math.pow(10, state.gate / 20), compressorThreshold = Math.pow(10, -18 / 20), limit = Math.pow(10, state.limiter / 20);
    let peak = 0;
    for (let channel = 0; channel < source.numberOfChannels; channel += 1) {
      const input = source.getChannelData(channel), target = output.getChannelData(channel);
      const cutoff = state.highPass, dt = 1 / source.sampleRate, rc = cutoff > 0 ? 1 / (2 * Math.PI * cutoff) : 0, alpha = cutoff > 0 ? rc / (rc + dt) : 0;
      let previousInput = 0, previousOutput = 0;
      for (let frame = 0; frame < frames; frame += 1) {
        const rawSample = input[startFrame + frame] || 0;
        let sample = cutoff > 0 ? alpha * (previousOutput + rawSample - previousInput) : rawSample;
        previousInput = rawSample; previousOutput = sample; sample *= gain;
        if (source.numberOfChannels > 1) sample *= channel === 0 ? Math.cos((state.pan + 100) / 200 * Math.PI / 2) * Math.SQRT2 : Math.sin((state.pan + 100) / 200 * Math.PI / 2) * Math.SQRT2;
        const magnitude = Math.abs(sample);
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
  function renderEstimate(tracks, settings) {
    const sources = (Array.isArray(tracks) ? tracks : []).filter((track) => track?.buffer?.length).map(normalizeTrack);
    const duration = sources.reduce((maximum, track) => Math.max(maximum, track.offset + trackTimelineDuration(track)), 0);
    const range = trimRange(duration, settings?.start, settings?.end);
    const sampleRate = clamp(sources[0]?.buffer?.sampleRate || 44100, 8000, 192000);
    const channels = clamp(Math.max(1, ...sources.map((track) => track.buffer.numberOfChannels || 1)), 1, 2);
    const frames = Math.max(0, Math.floor(range.duration * sampleRate));
    return { duration, range, sampleRate, channels, frames, bytes: frames * channels * 4, allowed: Boolean(frames) && frames * channels * 4 <= LIMITS.renderBytes };
  }
  async function renderMixAsync(context, tracks, settings, options = {}) {
    const state = normalizeState(settings), sources = (Array.isArray(tracks) ? tracks : []).filter((track) => track?.buffer?.length).map(normalizeTrack);
    const estimate = renderEstimate(sources, state);
    if (!sources.length) throw new Error("Chưa có rãnh audio để kết xuất.");
    if (!estimate.allowed) throw new Error(`Vùng chọn quá lớn để xử lý an toàn trên thiết bị (${Math.round(estimate.bytes / 1048576)} MB bộ nhớ đầu ra).`);
    const output = context.createBuffer(estimate.channels, Math.max(1, estimate.frames), estimate.sampleRate);
    const audible = sources.filter((track) => !track.muted), soloed = audible.filter((track) => track.solo), activeTracks = soloed.length ? soloed : audible;
    const headroom = 1 / Math.sqrt(Math.max(1, activeTracks.length)), gate = Math.pow(10, state.gate / 20), limit = Math.pow(10, state.limiter / 20), globalGain = Math.pow(10, state.gain / 20), threshold = Math.pow(10, -18 / 20);
    const filterState = Array.from({ length: estimate.channels }, () => ({ input: 0, output: 0, duck: 1 }));
    const duckThreshold = Math.pow(10, state.ducking.thresholdDb / 20), duckTarget = Math.pow(10, -state.ducking.amountDb / 20), duckAttack = 1 - Math.exp(-1 / (state.ducking.attack * estimate.sampleRate)), duckRelease = 1 - Math.exp(-1 / (state.ducking.release * estimate.sampleRate));
    let peak = 0;
    const yieldTask = () => typeof root.scheduler?.yield === "function" ? root.scheduler.yield() : new Promise((resolve) => root.setTimeout(resolve, 0));
    for (let from = 0; from < estimate.frames; from += 32768) {
      if (options.signal?.aborted) { const error = new Error("Đã hủy kết xuất"); error.name = "AbortError"; throw error; }
      const to = Math.min(estimate.frames, from + 32768);
      for (let channel = 0; channel < estimate.channels; channel += 1) {
        const target = output.getChannelData(channel), filter = filterState[channel], cutoff = state.highPass, dt = 1 / estimate.sampleRate, rc = cutoff > 0 ? 1 / (2 * Math.PI * cutoff) : 0, alpha = cutoff > 0 ? rc / (rc + dt) : 0;
        for (let frame = from; frame < to; frame += 1) {
          const absoluteTime = estimate.range.start + frame / estimate.sampleRate;
          let sample = 0, voicePeak = 0; const components = [];
          for (const track of activeTracks) {
            const source = track.buffer, segment = trackSegmentDuration(track), localTimeline = absoluteTime - track.offset, total = trackTimelineDuration(track);
            if (!(segment > 0) || localTimeline < 0 || localTimeline >= total) continue;
            const localSource = track.loop ? localTimeline % segment : localTimeline, sourceTime = track.sourceIn + localSource, sourceFrame = Math.floor(sourceTime * source.sampleRate);
            if (sourceFrame < 0 || sourceFrame >= source.length) continue;
            const sourceChannel = source.numberOfChannels === 1 ? 0 : Math.min(channel, source.numberOfChannels - 1), pan = (track.pan + 100) / 200, panGain = estimate.channels === 1 ? 1 : channel === 0 ? Math.cos(pan * Math.PI / 2) * Math.SQRT2 : Math.sin(pan * Math.PI / 2) * Math.SQRT2;
            let envelope = automationValue(track.automation, localTimeline);
            if (track.fadeIn > 0 && localTimeline < track.fadeIn) envelope *= localTimeline / track.fadeIn;
            if (track.fadeOut > 0 && total - localTimeline < track.fadeOut) envelope *= Math.max(0, (total - localTimeline) / track.fadeOut);
            const value = (source.getChannelData(sourceChannel)[sourceFrame] || 0) * Math.pow(10, track.gain / 20) * panGain * headroom * envelope;
            if (track.role === "voice") voicePeak = Math.max(voicePeak, Math.abs(value));
            components.push({ role: track.role, value });
          }
          const wantedDuck = state.ducking.enabled && voicePeak >= duckThreshold ? duckTarget : 1, coefficient = wantedDuck < filter.duck ? duckAttack : duckRelease; filter.duck += (wantedDuck - filter.duck) * coefficient;
          for (const component of components) sample += component.role === "music" ? component.value * filter.duck : component.value;
          if (estimate.channels > 1) {
            const masterPan = (state.pan + 100) / 200;
            sample *= channel === 0 ? Math.cos(masterPan * Math.PI / 2) * Math.SQRT2 : Math.sin(masterPan * Math.PI / 2) * Math.SQRT2;
          }
          sample *= globalGain;
          if (cutoff > 0) { const filtered = alpha * (filter.output + sample - filter.input); filter.input = sample; filter.output = filtered; sample = filtered; }
          const magnitude = Math.abs(sample);
          if (magnitude < gate) sample = 0;
          else if (state.compressor && magnitude > threshold) sample = Math.sign(sample) * (threshold + (magnitude - threshold) / 4);
          sample = clamp(sample, -limit, limit); target[frame] = sample; peak = Math.max(peak, Math.abs(sample));
        }
      }
      options.onProgress?.(Math.min(.82, to / estimate.frames * .82));
      await yieldTask();
    }
    const normalization = state.normalize && peak > 0 ? Math.min(8, .98 / peak) : 1, fadeInFrames = Math.min(estimate.frames, Math.floor(state.fadeIn * estimate.sampleRate)), fadeOutFrames = Math.min(estimate.frames, Math.floor(state.fadeOut * estimate.sampleRate));
    for (let from = 0; from < estimate.frames; from += 65536) {
      if (options.signal?.aborted) { const error = new Error("Đã hủy kết xuất"); error.name = "AbortError"; throw error; }
      const to = Math.min(estimate.frames, from + 65536);
      for (let channel = 0; channel < output.numberOfChannels; channel += 1) {
        const data = output.getChannelData(channel);
        for (let frame = from; frame < to; frame += 1) {
          let envelope = 1;
          if (fadeInFrames && frame < fadeInFrames) envelope *= frame / fadeInFrames;
          if (fadeOutFrames && frame >= estimate.frames - fadeOutFrames) envelope *= (estimate.frames - frame - 1) / fadeOutFrames;
          data[frame] = clamp(data[frame] * normalization * Math.max(0, envelope), -1, 1);
        }
      }
      options.onProgress?.(.82 + Math.min(.18, to / estimate.frames * .18));
      await yieldTask();
    }
    return output;
  }
  function estimateLoudness(buffer) {
    if (!buffer?.length) return { peakDbfs: -Infinity, rmsDbfs: -Infinity, estimatedLufs: -Infinity, samples: 0 };
    let peak = 0, squares = 0, samples = 0;
    const stride = Math.max(1, Math.floor(buffer.length / 1_500_000));
    for (let channel = 0; channel < buffer.numberOfChannels; channel += 1) {
      const data = buffer.getChannelData(channel);
      for (let index = 0; index < data.length; index += stride) { const sample = data[index] || 0; peak = Math.max(peak, Math.abs(sample)); squares += sample * sample; samples += 1; }
    }
    const rms = Math.sqrt(squares / Math.max(1, samples));
    return { peakDbfs: peak ? 20 * Math.log10(peak) : -Infinity, rmsDbfs: rms ? 20 * Math.log10(rms) : -Infinity, estimatedLufs: rms ? 20 * Math.log10(rms) - .691 : -Infinity, samples };
  }
  function findSpeechBounds(buffer, thresholdDb = -48) {
    if (!buffer?.length) return { start: 0, end: 0 };
    const threshold = Math.pow(10, Number(thresholdDb) / 20), windowSize = Math.max(128, Math.floor(buffer.sampleRate * .02));
    let first = -1, last = -1;
    const loud = (offset) => { let peak = 0; for (let channel = 0; channel < buffer.numberOfChannels; channel += 1) { const data = buffer.getChannelData(channel); for (let index = offset; index < Math.min(data.length, offset + windowSize); index += 1) peak = Math.max(peak, Math.abs(data[index] || 0)); } return peak >= threshold; };
    for (let offset = 0; offset < buffer.length; offset += windowSize) { if (loud(offset)) { first = offset; break; } }
    for (let offset = Math.max(0, buffer.length - windowSize); offset >= 0; offset -= windowSize) { if (loud(offset)) { last = Math.min(buffer.length - 1, offset + windowSize); break; } }
    return first < 0 || last < 0 ? { start: 0, end: 0 } : { start: first / buffer.sampleRate, end: last / buffer.sampleRate };
  }
  async function findSpeechBoundsAsync(buffer, thresholdDb = -48, options = {}) {
    if (!buffer?.length) return { start: 0, end: 0 };
    const threshold = Math.pow(10, Number(thresholdDb) / 20), windowSize = Math.max(128, Math.floor(buffer.sampleRate * .02)), windows = Math.ceil(buffer.length / windowSize);
    const loud = (offset) => { let peak = 0; for (let channel = 0; channel < buffer.numberOfChannels; channel += 1) { const data = buffer.getChannelData(channel); for (let index = offset; index < Math.min(data.length, offset + windowSize); index += 1) peak = Math.max(peak, Math.abs(data[index] || 0)); } return peak >= threshold; };
    const yieldTask = () => typeof root.scheduler?.yield === "function" ? root.scheduler.yield() : new Promise((resolve) => root.setTimeout(resolve, 0));
    let first = -1, last = -1;
    for (let windowIndex = 0; windowIndex < windows; windowIndex += 1) {
      if (options.signal?.aborted) { const error = new Error("Đã hủy phân tích"); error.name = "AbortError"; throw error; }
      const offset = windowIndex * windowSize; if (loud(offset)) { first = offset; break; }
      if (windowIndex % 256 === 255) { options.onProgress?.(windowIndex / Math.max(1, windows) * .5); await yieldTask(); }
    }
    if (first < 0) return { start: 0, end: 0 };
    for (let windowIndex = windows - 1; windowIndex >= 0; windowIndex -= 1) {
      if (options.signal?.aborted) { const error = new Error("Đã hủy phân tích"); error.name = "AbortError"; throw error; }
      const offset = windowIndex * windowSize; if (loud(offset)) { last = Math.min(buffer.length - 1, offset + windowSize); break; }
      if (windowIndex % 256 === 0) { options.onProgress?.(.5 + (windows - windowIndex) / Math.max(1, windows) * .5); await yieldTask(); }
    }
    return { start: first / buffer.sampleRate, end: last / buffer.sampleRate };
  }
  function chaptersJson(state) { return JSON.stringify({ version: "1.2.0", title: state.podcast.title || "HH Podcast", chapters: state.markers.slice().sort((a, b) => a.time - b.time).map((item) => ({ startTime: item.time, title: item.title })) }, null, 2); }
  function rssItem(state, duration) {
    const xml = (value) => String(value || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
    const normalized = normalizeState(state);
    return `<?xml version="1.0" encoding="UTF-8"?>\n<item>\n  <title>${xml(normalized.podcast.title || "Tập mới")}</title>\n  <author>${xml(normalized.podcast.author)}</author>\n  <description>${xml(normalized.podcast.description)}</description>\n  <itunes:episode>${normalized.podcast.episode}</itunes:episode>\n  <itunes:duration>${Math.round(duration || 0)}</itunes:duration>\n  <itunes:explicit>${normalized.podcast.explicit ? "true" : "false"}</itunes:explicit>\n  <dc:language>${xml(normalized.podcast.language)}</dc:language>\n  <itunes:category text="${xml(normalized.podcast.category)}" />\n</item>\n`;
  }
  function podcastManifest(state, tracks = [], duration = 0) {
    const normalized = normalizeState(state);
    return JSON.stringify({
      schema: "hh.podcast-manifest.v1", title: normalized.podcast.title || "HH Podcast", show: normalized.podcast.show, author: normalized.podcast.author,
      description: normalized.podcast.description, episode: normalized.podcast.episode, language: normalized.podcast.language, category: normalized.podcast.category, explicit: normalized.podcast.explicit,
      duration: Math.max(0, Number(duration) || 0), chapters: normalized.markers.slice().sort((a, b) => a.time - b.time), regions: normalized.regions,
      tracks: (Array.isArray(tracks) ? tracks : []).slice(0, LIMITS.tracks).map((track) => { const item = normalizeTrack(track); return { id: item.id, name: item.name, role: item.role, offset: item.offset, sourceIn: item.sourceIn, sourceOut: item.sourceOut, loop: item.loop, loopCount: item.loopCount, gain: item.gain, pan: item.pan, fadeIn: item.fadeIn, fadeOut: item.fadeOut, automation: item.automation }; })
    }, null, 2);
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
  function loadSaved() {
    try {
      const value = root.localStorage?.getItem(STORAGE_KEY) || root.localStorage?.getItem(LEGACY_STORAGE_KEY) || "{}";
      return normalizeState(JSON.parse(value));
    } catch (_) { return normalizeState({}); }
  }
  function save(state) { try { root.localStorage?.setItem(STORAGE_KEY, JSON.stringify(normalizeState(state))); return true; } catch (_) { return false; } }
  function safeStem(value, fallback = "hh-audio") { return cleanText(String(value || fallback).replace(/\.[^.]+$/, ""), 100).replace(/[\\/:*?"|]+/g, "-") || fallback; }
  function downloadBlob(session, blob, name) {
    const url = root.URL?.createObjectURL?.(blob);
    if (!url) throw new Error("Trình duyệt không thể tạo tệp tải xuống.");
    session.urls.add(url);
    const anchor = root.document.createElement("a"); anchor.href = url; anchor.download = name; anchor.rel = "noopener"; anchor.click();
    const timer = root.setTimeout(() => { root.URL.revokeObjectURL(url); session.urls.delete(url); session.timers.delete(timer); }, 1500);
    session.timers.add(timer);
  }

  function mount(host, options) {
    if (!host) return null;
    unmount();
    const controller = new AbortController();
    const session = {
      host, controller, options: options || {}, state: loadSaved(), audioContext: null, tracks: [], selectedTrackId: "",
      buffer: null, file: null, analysis: null, playing: null, stream: null, recorder: null, chunks: [], acquiringMic: false,
      busy: "", generation: 0, closing: false, toastTimer: 0, drawFrame: 0, renderController: null, urls: new Set(), timers: new Set(), storeBusy: false,
      history: { past: [], future: [] }, trackDrafts: new Map()
    };
    active = session;
    host.innerHTML = `<section class="mas-studio" data-media-audio-studio>
      <header><div><small>AUDIO & PODCAST · LOCAL-FIRST</small><h2>Waveform Studio</h2><p>Mixer nhiều rãnh, cắt, fade, dynamics, chapter và WAV PCM thật trên thiết bị.</p></div><div><span data-mas-status role="status">Chưa có audio</span><label>＋ Mở audio<input type="file" accept="audio/*" multiple data-mas-file></label></div></header>
      <div class="mas-grid"><main>
        <section class="mas-wave-card"><header><div><strong data-mas-name>Chưa chọn tệp</strong><small data-mas-meta>Audio không rời khỏi thiết bị</small></div><div><button type="button" data-mas-play disabled>▶ Phát bản mix</button><button type="button" data-mas-stop disabled>■ Dừng / hủy</button></div></header><canvas data-mas-wave aria-label="Waveform audio của rãnh đang chọn"></canvas><div class="mas-meter-deck"><article><small>PEAK</small><strong data-mas-meter="peak">—</strong><i></i></article><article><small>RMS</small><strong data-mas-meter="rms">—</strong><i></i></article><article><small>LOUDNESS ƯỚC TÍNH</small><strong data-mas-meter="lufs">—</strong><i></i><span>Không thay thế máy đo EBU R128</span></article><button type="button" data-mas-silence disabled>Cắt im lặng đầu/cuối</button></div><div class="mas-trim"><label>Bắt đầu <span data-mas-start-label>0:00.0</span><input type="range" min="0" max="100" value="0" data-mas-start></label><label>Kết thúc <span data-mas-end-label>0:00.0</span><input type="range" min="0" max="100" value="100" data-mas-end></label></div><div class="mas-edit-actions"><button type="button" data-mas-split disabled>✂ Tách rãnh tại In</button><button type="button" data-mas-trim-track disabled>Trim rãnh theo vùng chọn</button><button type="button" data-mas-region-add disabled>＋ Lưu vùng chọn</button><label class="mas-switch"><input type="checkbox" data-mas-setting="loopPreview" ${session.state.loopPreview ? "checked" : ""}><span>Loop preview</span></label></div><div class="mas-region-strip" data-mas-regions></div></section>
        <section class="mas-track-mixer"><header><div><strong>Mixer nhiều rãnh</strong><small>Offset, trim, loop, automation và vai trò sidechain thật</small></div><div class="mas-track-history"><button type="button" data-mas-history="undo" disabled aria-label="Hoàn tác mixer">↶</button><button type="button" data-mas-history="redo" disabled aria-label="Làm lại mixer">↷</button><label>＋ Thêm rãnh<input type="file" accept="audio/*" multiple data-mas-file></label></div></header><div data-mas-tracks><p>Chưa có rãnh. Mở nhiều tệp audio để bắt đầu.</p></div></section>
        <section class="mas-timeline"><span><i></i><b data-mas-track-count>0 TRACK</b></span><div><b></b><em></em></div><span><i></i>MASTER BUS · PCM</span><div><b></b><em></em></div></section>
      </main><aside>
        <section><header><small>MASTER BUS</small><strong>Gain & cleanup</strong></header><label>Gain <b data-mas-gain-label>${session.state.gain} dB</b><input type="range" min="-24" max="12" step=".5" value="${session.state.gain}" data-mas-setting="gain"></label><label>Noise gate <b data-mas-gate-label>${session.state.gate} dB</b><input type="range" min="-80" max="-12" step="1" value="${session.state.gate}" data-mas-setting="gate"></label><label>Pan stereo <b data-mas-pan-label>${session.state.pan}%</b><input type="range" min="-100" max="100" step="1" value="${session.state.pan}" data-mas-setting="pan"></label><label>High-pass <b data-mas-high-pass-label>${session.state.highPass} Hz</b><input type="range" min="0" max="400" step="5" value="${session.state.highPass}" data-mas-setting="highPass"></label><label class="mas-switch"><input type="checkbox" data-mas-setting="compressor" ${session.state.compressor ? "checked" : ""}><span>Compressor 4:1 · −18 dB</span></label><div class="mas-presets"><button type="button" data-mas-preset="voice">Voice Clean</button><button type="button" data-mas-preset="podcast">Podcast</button><button type="button" data-mas-preset="music">Music</button></div><div class="mas-ducking"><label class="mas-switch"><input type="checkbox" data-mas-ducking="enabled" ${session.state.ducking.enabled ? "checked" : ""}><span>Sidechain ducking giọng → nhạc</span></label><label>Mức giảm <b data-mas-duck-label="amountDb">${session.state.ducking.amountDb} dB</b><input type="range" min="0" max="24" value="${session.state.ducking.amountDb}" data-mas-ducking="amountDb"></label><label>Ngưỡng giọng <b data-mas-duck-label="thresholdDb">${session.state.ducking.thresholdDb} dB</b><input type="range" min="-60" max="-6" value="${session.state.ducking.thresholdDb}" data-mas-ducking="thresholdDb"></label><label>Attack <b data-mas-duck-label="attack">${Math.round(session.state.ducking.attack * 1000)} ms</b><input type="range" min=".005" max=".5" step=".005" value="${session.state.ducking.attack}" data-mas-ducking="attack"></label><label>Release <b data-mas-duck-label="release">${session.state.ducking.release.toFixed(2)} s</b><input type="range" min=".02" max="2" step=".02" value="${session.state.ducking.release}" data-mas-ducking="release"></label></div></section>
        <section><header><small>ENVELOPE</small><strong>Fade & loudness</strong></header><label>Fade in <b data-mas-fade-in-label>${session.state.fadeIn}s</b><input type="range" min="0" max="10" step=".05" value="${session.state.fadeIn}" data-mas-setting="fadeIn"></label><label>Fade out <b data-mas-fade-out-label>${session.state.fadeOut}s</b><input type="range" min="0" max="10" step=".05" value="${session.state.fadeOut}" data-mas-setting="fadeOut"></label><label>Limiter <b data-mas-limiter-label>${session.state.limiter} dB</b><input type="range" min="-12" max="0" step=".5" value="${session.state.limiter}" data-mas-setting="limiter"></label><label class="mas-switch"><input type="checkbox" data-mas-setting="normalize" ${session.state.normalize ? "checked" : ""}><span>Normalize peak tới −0.17 dBFS</span></label></section>
        <section class="mas-podcast"><header><small>PODCAST DELIVERY</small><strong>Metadata & chapters</strong></header><div class="mas-podcast-grid"><label>Tiêu đề<input value="${escapeHtml(session.state.podcast.title)}" maxlength="160" data-mas-podcast="title"></label><label>Chương trình<input value="${escapeHtml(session.state.podcast.show)}" maxlength="160" data-mas-podcast="show"></label><label>Tác giả<input value="${escapeHtml(session.state.podcast.author)}" maxlength="120" data-mas-podcast="author"></label><label>Số tập<input type="number" min="1" max="99999" value="${session.state.podcast.episode}" data-mas-podcast="episode"></label><label>Ngôn ngữ<input value="${escapeHtml(session.state.podcast.language)}" maxlength="16" data-mas-podcast="language"></label><label>Danh mục<input value="${escapeHtml(session.state.podcast.category)}" maxlength="80" data-mas-podcast="category"></label><label class="mas-switch"><input type="checkbox" data-mas-podcast="explicit" ${session.state.podcast.explicit ? "checked" : ""}><span>Nội dung explicit</span></label></div><label>Mô tả<textarea maxlength="600" rows="3" data-mas-podcast="description">${escapeHtml(session.state.podcast.description)}</textarea></label><div class="mas-podcast-actions"><button type="button" data-mas-chapter disabled>＋ Chapter tại In</button><button type="button" data-mas-chapters disabled>Chapters JSON</button><button type="button" data-mas-rss disabled>RSS item</button><button type="button" data-mas-manifest disabled>Project manifest</button></div><div class="mas-chapter-list" data-mas-chapter-list></div></section>
        <section class="mas-recorder"><header><small>MICROPHONE</small><strong>Podcast recorder</strong></header><button type="button" data-mas-record>● Bắt đầu thu</button><small>Quyền microphone chỉ được dùng trong phiên này và luôn dừng khi rời công cụ.</small></section>
      </aside></div>
      <footer><button type="button" data-mas-save-bin disabled>＋ Global Media Bin</button><span data-mas-export-detail>PCM 16-bit · worker-friendly · không tải lên máy chủ</span><button type="button" class="is-primary" data-mas-export disabled>Xuất WAV bản mix →</button></footer>
      <div class="mas-toast" data-mas-toast role="status" aria-live="polite" hidden></div>
    </section>`;
    const studio = host.querySelector("[data-media-audio-studio]"), canvas = host.querySelector("[data-mas-wave]");
    drawWaveform(canvas, null, session.state);

    const isCurrent = () => active === session && !session.closing && host.isConnected;
    const ensureContext = async () => {
      if (session.audioContext?.state !== "closed") return session.audioContext;
      const AudioContext = root.AudioContext || root.webkitAudioContext;
      if (!AudioContext) throw new Error("Web Audio chưa khả dụng trên trình duyệt này.");
      session.audioContext = new AudioContext();
      return session.audioContext;
    };
    const announce = (message, tone = "info") => {
      if (!isCurrent()) return;
      const node = host.querySelector("[data-mas-toast]"); if (!node) return;
      node.textContent = cleanText(message, 360); node.dataset.tone = tone; node.hidden = false;
      root.clearTimeout(session.toastTimer); session.toastTimer = root.setTimeout(() => { if (node.isConnected) node.hidden = true; }, 3200);
    };
    const setStatus = (message) => { const node = host.querySelector("[data-mas-status]"); if (node) node.textContent = message; };
    const duration = () => session.tracks.reduce((maximum, track) => Math.max(maximum, track.offset + trackTimelineDuration(track)), 0);
    const selectedTrack = () => session.tracks.find((track) => track.id === session.selectedTrackId) || session.tracks[0] || null;
    const cloneTracks = (tracks) => tracks.map((track, index) => normalizeTrack(track, index));
    const updateHistoryButtons = () => { const undo = host.querySelector('[data-mas-history="undo"]'), redo = host.querySelector('[data-mas-history="redo"]'); if (undo) undo.disabled = !session.history.past.length; if (redo) redo.disabled = !session.history.future.length; };
    const commitTracks = (next, message, focusId = session.selectedTrackId) => {
      const normalized = cloneTracks(next); if (JSON.stringify(normalized.map(({ file, buffer, analysis, ...track }) => track)) === JSON.stringify(session.tracks.map(({ file, buffer, analysis, ...track }) => track))) return false;
      session.history.past.push(cloneTracks(session.tracks)); session.history.past = session.history.past.slice(-LIMITS.history); session.history.future = []; session.tracks = normalized;
      if (!session.tracks.some((track) => track.id === session.selectedTrackId)) session.selectedTrackId = session.tracks[0]?.id || "";
      session.state.end = Math.max(session.state.start, duration()); renderTracks(focusId); renderRegions(); updateLabels(); updateHistoryButtons(); if (message) announce(message, "success"); return true;
    };
    const trackSnapshot = (tracks) => JSON.stringify(tracks.map(({ file, buffer, analysis, ...track }) => track));
    const beginTrackDraft = (id, key) => {
      const draftKey = `${id}:${key}`;
      if (!session.trackDrafts.has(draftKey)) session.trackDrafts.set(draftKey, cloneTracks(session.tracks));
      return draftKey;
    };
    const finishTrackDraft = (id, key) => {
      const draftKey = `${id}:${key}`, before = session.trackDrafts.get(draftKey);
      if (!before) return false;
      session.trackDrafts.delete(draftKey);
      if (trackSnapshot(before) === trackSnapshot(session.tracks)) return false;
      session.history.past.push(before); session.history.past = session.history.past.slice(-LIMITS.history); session.history.future = [];
      session.state.end = Math.max(session.state.start, duration()); updateLabels(); updateHistoryButtons(); announce("Đã lưu thay đổi rãnh vào lịch sử mixer.", "success"); return true;
    };
    const scheduleWaveform = () => {
      root.cancelAnimationFrame?.(session.drawFrame);
      session.drawFrame = root.requestAnimationFrame ? root.requestAnimationFrame(() => { if (isCurrent()) drawWaveform(canvas, selectedTrack()?.buffer || null, session.state); }) : 0;
      if (!root.requestAnimationFrame) drawWaveform(canvas, selectedTrack()?.buffer || null, session.state);
    };
    const renderChapters = () => {
      const list = host.querySelector("[data-mas-chapter-list]"); if (!list) return;
      list.innerHTML = session.state.markers.length ? session.state.markers.slice().sort((a, b) => a.time - b.time).map((item) => `<span><b>${formatTime(item.time)}</b>${escapeHtml(item.title)}<button type="button" aria-label="Xóa ${escapeHtml(item.title)}" data-mas-marker-remove="${escapeHtml(item.id)}">×</button></span>`).join("") : "<small>Chưa có chapter.</small>";
    };
    const renderRegions = () => {
      const list = host.querySelector("[data-mas-regions]"); if (!list) return;
      list.innerHTML = session.state.regions.length ? session.state.regions.map((region) => `<span class="${session.state.activeRegion === region.id ? "is-active" : ""}"><button type="button" data-mas-region-select="${escapeHtml(region.id)}"><b>${escapeHtml(region.title)}</b><small>${formatTime(region.start)}–${formatTime(region.end)}</small></button><button type="button" data-mas-region-remove="${escapeHtml(region.id)}" aria-label="Xóa vùng ${escapeHtml(region.title)}">×</button></span>`).join("") : "<small>Chưa lưu vùng chọn.</small>";
    };
    const renderTracks = (focusId = "") => {
      const list = host.querySelector("[data-mas-tracks]"); if (!list) return;
      list.innerHTML = session.tracks.length ? session.tracks.map((track, index) => `<article class="${track.id === session.selectedTrackId ? "is-selected" : ""}" data-mas-track-row="${escapeHtml(track.id)}"><button type="button" class="mas-track-select" data-mas-track-select="${escapeHtml(track.id)}"><i>${String(index + 1).padStart(2, "0")}</i><span><strong>${escapeHtml(track.name)}</strong><small>${formatTime(trackTimelineDuration(track))} · In ${formatTime(track.sourceIn)} · ${track.automation.length} automation</small></span></button><label>Gain <output>${track.gain} dB</output><input type="range" min="-24" max="12" step=".5" value="${track.gain}" data-mas-track-setting="gain" data-track-id="${escapeHtml(track.id)}"></label><label>Pan <output>${track.pan}%</output><input type="range" min="-100" max="100" value="${track.pan}" data-mas-track-setting="pan" data-track-id="${escapeHtml(track.id)}"></label><div class="mas-track-routing"><label>Vai trò<select data-mas-track-setting="role" data-track-id="${escapeHtml(track.id)}"><option value="voice" ${track.role === "voice" ? "selected" : ""}>Giọng</option><option value="music" ${track.role === "music" ? "selected" : ""}>Nhạc</option><option value="sfx" ${track.role === "sfx" ? "selected" : ""}>SFX</option></select></label><label>Offset<input type="number" min="0" max="86400" step=".1" value="${track.offset}" data-mas-track-setting="offset" data-track-id="${escapeHtml(track.id)}"></label><label>Loop <input type="checkbox" ${track.loop ? "checked" : ""} data-mas-track-setting="loop" data-track-id="${escapeHtml(track.id)}"></label><label>Số vòng<input type="number" min="1" max="32" value="${track.loopCount}" data-mas-track-setting="loopCount" data-track-id="${escapeHtml(track.id)}"></label><label>Fade in<input type="number" min="0" max="10" step=".05" value="${track.fadeIn}" data-mas-track-setting="fadeIn" data-track-id="${escapeHtml(track.id)}"></label><label>Fade out<input type="number" min="0" max="10" step=".05" value="${track.fadeOut}" data-mas-track-setting="fadeOut" data-track-id="${escapeHtml(track.id)}"></label></div><div class="mas-track-actions"><button type="button" class="${track.muted ? "is-active" : ""}" data-mas-track-action="mute" data-track-id="${escapeHtml(track.id)}" aria-pressed="${track.muted}" title="Mute">M</button><button type="button" class="${track.solo ? "is-active" : ""}" data-mas-track-action="solo" data-track-id="${escapeHtml(track.id)}" aria-pressed="${track.solo}" title="Solo">S</button><button type="button" data-mas-track-action="automation" data-track-id="${escapeHtml(track.id)}" title="Thêm automation tại In">A+</button><button type="button" data-mas-track-action="clear-automation" data-track-id="${escapeHtml(track.id)}" title="Xóa automation">A×</button><button type="button" data-mas-track-action="up" data-track-id="${escapeHtml(track.id)}" aria-label="Đưa rãnh lên">↑</button><button type="button" data-mas-track-action="down" data-track-id="${escapeHtml(track.id)}" aria-label="Đưa rãnh xuống">↓</button><button type="button" data-mas-track-action="duplicate" data-track-id="${escapeHtml(track.id)}" aria-label="Nhân bản rãnh">⧉</button><button type="button" data-mas-track-action="remove" data-track-id="${escapeHtml(track.id)}" aria-label="Xóa rãnh">×</button></div></article>`).join("") : "<p>Chưa có rãnh. Mở nhiều tệp audio để bắt đầu.</p>";
      const count = host.querySelector("[data-mas-track-count]"); if (count) count.textContent = `${session.tracks.length} TRACK`;
      if (focusId) host.querySelector(`[data-mas-track-select="${root.CSS?.escape ? root.CSS.escape(focusId) : focusId.replace(/[^a-z0-9_-]/gi, "")}"]`)?.focus();
      updateHistoryButtons();
    };
    const updateLabels = () => {
      const total = duration(), range = trimRange(total, session.state.start, session.state.end || total), track = selectedTrack();
      session.buffer = track?.buffer || null; session.file = track?.file || null; session.analysis = track?.analysis || null;
      const start = host.querySelector("[data-mas-start]"), end = host.querySelector("[data-mas-end]"); if (start) start.value = total ? String(range.start / total * 100) : "0"; if (end) end.value = total ? String(range.end / total * 100) : "100";
      const startLabel = host.querySelector("[data-mas-start-label]"), endLabel = host.querySelector("[data-mas-end-label]"); if (startLabel) startLabel.textContent = formatTime(range.start); if (endLabel) endLabel.textContent = formatTime(range.end);
      [["gain", "gain"], ["gate", "gate"], ["fade-in", "fadeIn"], ["fade-out", "fadeOut"], ["limiter", "limiter"]].forEach(([label, key]) => { const node = host.querySelector(`[data-mas-${label}-label]`); if (node) node.textContent = `${session.state[key]}${key.startsWith("fade") ? "s" : " dB"}`; });
      const pan = host.querySelector("[data-mas-pan-label]"), highPass = host.querySelector("[data-mas-high-pass-label]"); if (pan) pan.textContent = `${session.state.pan}%`; if (highPass) highPass.textContent = `${session.state.highPass} Hz`;
      const display = (value) => Number.isFinite(value) ? `${value.toFixed(1)} dB` : "−∞"; const peak = host.querySelector('[data-mas-meter="peak"]'), rms = host.querySelector('[data-mas-meter="rms"]'), lufs = host.querySelector('[data-mas-meter="lufs"]'); if (peak) peak.textContent = display(session.analysis?.peakDbfs); if (rms) rms.textContent = display(session.analysis?.rmsDbfs); if (lufs) lufs.textContent = Number.isFinite(session.analysis?.estimatedLufs) ? `${session.analysis.estimatedLufs.toFixed(1)} LUFS*` : "−∞";
      const name = host.querySelector("[data-mas-name]"), meta = host.querySelector("[data-mas-meta]"); if (name) name.textContent = track?.name || "Chưa chọn tệp"; if (meta) meta.textContent = track ? `${formatTime(track.buffer.duration)} · ${track.buffer.sampleRate} Hz · ${track.buffer.numberOfChannels} kênh · ${(track.file.size / 1048576).toFixed(2)} MB` : "Audio không rời khỏi thiết bị";
      const enabled = Boolean(session.tracks.length); host.querySelectorAll("[data-mas-play],[data-mas-stop],[data-mas-export],[data-mas-save-bin],[data-mas-silence],[data-mas-chapter],[data-mas-chapters],[data-mas-rss],[data-mas-manifest],[data-mas-split],[data-mas-trim-track],[data-mas-region-add]").forEach((button) => { button.disabled = !enabled || (Boolean(session.busy) && !button.matches("[data-mas-stop]")); });
      host.querySelectorAll("[data-mas-duck-label]").forEach((node) => { const key = node.dataset.masDuckLabel, value = session.state.ducking[key]; node.textContent = key === "attack" ? `${Math.round(value * 1000)} ms` : key === "release" ? `${value.toFixed(2)} s` : `${value} dB`; });
      scheduleWaveform(); save(session.state);
    };
    const stopPlayback = () => {
      session.renderController?.abort(); session.renderController = null;
      try { session.playing?.stop(); } catch (_) {}
      session.playing = null; session.busy = ""; studio?.classList.remove("is-playing", "is-rendering"); updateLabels();
    };
    const loadFiles = async (input) => {
      const files = [...(input || [])].slice(0, Math.max(0, LIMITS.tracks - session.tracks.length));
      if (!files.length) return;
      const valid = files.filter((file) => (!file.type || file.type.startsWith("audio/")) && file.size > 0 && file.size <= LIMITS.fileBytes);
      if (!valid.length) return announce(`Không có audio hợp lệ dưới ${Math.round(LIMITS.fileBytes / 1048576)} MB.`, "error");
      const context = await ensureContext().catch((error) => { announce(error.message, "error"); return null; }); if (!context) return;
      const token = ++session.generation; session.busy = "decode"; setStatus(`Đang giải mã 0/${valid.length}…`); updateLabels();
      let loaded = 0; const before = cloneTracks(session.tracks);
      try {
        for (const file of valid) {
          const data = await file.arrayBuffer(); if (!isCurrent() || token !== session.generation) return;
          const buffer = await context.decodeAudioData(data.slice(0)); if (!isCurrent() || token !== session.generation) return;
          const id = `track-${Date.now()}-${loaded}-${Math.random().toString(16).slice(2, 8)}`;
          session.tracks = updateTrackList(session.tracks, { type: "add", track: { id, name: file.name, file, buffer, sourceDuration: buffer.duration, sourceOut: buffer.duration, role: session.tracks.length ? "music" : "voice", analysis: estimateLoudness(buffer) } }); session.selectedTrackId = id; loaded += 1; setStatus(`Đang giải mã ${loaded}/${valid.length}…`);
        }
        const total = duration(); session.state.start = 0; session.state.end = total;
        if (!session.state.podcast.title) { session.state.podcast.title = safeStem(valid[0].name, "HH Podcast"); const title = host.querySelector('[data-mas-podcast="title"]'); if (title) title.value = session.state.podcast.title; }
        if (loaded) { session.history.past.push(before); session.history.past = session.history.past.slice(-LIMITS.history); session.history.future = []; }
        renderTracks(); updateLabels(); renderChapters(); renderRegions(); setStatus(`${session.tracks.length} rãnh sẵn sàng`); announce(`Đã thêm ${loaded} rãnh và dựng waveform từ audio thật.`, "success");
      } catch (error) { if (isCurrent() && token === session.generation) announce(`Không giải mã được audio: ${cleanText(error?.message || error)}`, "error"); }
      finally { if (isCurrent() && token === session.generation) { session.busy = ""; updateLabels(); } }
    };
    const runRender = async (mode) => {
      if (!session.tracks.length || session.busy) return;
      const context = await ensureContext().catch((error) => { announce(error.message, "error"); return null; }); if (!context) return;
      stopPlayback(); session.busy = mode; session.renderController = new AbortController(); const signal = session.renderController.signal; studio?.classList.add("is-rendering"); updateLabels();
      try {
        await context.resume();
        const processed = await renderMixAsync(context, session.tracks, session.state, { signal, onProgress: (value) => { if (isCurrent()) setStatus(`${mode === "play" ? "Đang dựng preview" : "Đang kết xuất"} · ${Math.round(value * 100)}%`); } });
        if (!isCurrent() || signal.aborted) return;
        if (mode === "play") {
          const source = context.createBufferSource(); source.buffer = processed; source.loop = session.state.loopPreview; source.connect(context.destination); session.playing = source; session.busy = ""; session.renderController = null; studio?.classList.remove("is-rendering"); studio?.classList.add("is-playing"); source.onended = () => { if (session.playing === source) { session.playing = null; studio?.classList.remove("is-playing"); setStatus(`${session.tracks.length} rãnh sẵn sàng`); updateLabels(); } }; source.start(); setStatus(session.state.loopPreview ? "Đang phát lặp vùng chọn" : "Đang phát bản mix đã xử lý"); updateLabels();
        } else {
          const wav = await encodeWavAsync(processed, { signal, onProgress: (value) => { if (isCurrent()) setStatus(`Đang đóng gói WAV · ${Math.round(value * 100)}%`); } });
          if (!isCurrent() || signal.aborted) return;
          downloadBlob(session, new Blob([wav], { type: "audio/wav" }), `${safeStem(session.file?.name)}-mix.wav`); setStatus("Đã xuất WAV PCM 16-bit"); announce("Đã xuất WAV PCM 16-bit thật từ toàn bộ rãnh nghe được.", "success");
        }
      } catch (error) { if (error?.name !== "AbortError") announce(cleanText(error?.message || error), "error"); }
      finally { if (isCurrent() && (mode !== "play" || !session.playing)) { session.busy = ""; session.renderController = null; studio?.classList.remove("is-rendering"); updateLabels(); } }
    };
    const saveToBin = async () => {
      if (session.storeBusy || !session.tracks.length) return;
      if (!session.options.mediaApi?.createStore) return announce("Global Media Bin chưa được kết nối trong workspace này.", "error");
      session.storeBusy = true; const button = host.querySelector("[data-mas-save-bin]"); if (button) button.disabled = true; let store;
      try { store = session.options.mediaApi.createStore(); await store.ready(); const project = (await store.listProjects())[0] || await store.saveProject({ name: "Universal Media Project" }), uniqueFiles = session.tracks.map((track) => track.file).filter((file, index, rows) => file && rows.findIndex((item) => item === file || item?.name === file.name && item?.size === file.size && item?.lastModified === file.lastModified) === index); for (const file of uniqueFiles) await store.saveAsset({ projectId: project.id, name: file.name, type: file.type, size: file.size, lastModified: file.lastModified, blob: file }); announce(`Đã thêm ${uniqueFiles.length} audio nguồn duy nhất vào Global Media Bin.`, "success"); }
      catch (error) { announce(cleanText(error?.message || error), "error"); }
      finally { try { await store?.close?.(); } catch (_) {} session.storeBusy = false; updateLabels(); }
    };
    const toggleRecorder = async (button) => {
      if (session.recorder?.state === "recording") { button.disabled = true; session.recorder.stop(); return; }
      if (session.acquiringMic || session.closing) return;
      if (!root.navigator?.mediaDevices?.getUserMedia || typeof root.MediaRecorder !== "function") return announce("Trình duyệt chưa hỗ trợ ghi âm MediaRecorder.", "error");
      session.acquiringMic = true; button.disabled = true; const token = ++session.generation; let stream;
      try {
        stream = await root.navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: false } });
        if (!isCurrent() || token !== session.generation) { stream.getTracks().forEach((track) => track.stop()); return; }
        const mime = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"].find((type) => !root.MediaRecorder.isTypeSupported || root.MediaRecorder.isTypeSupported(type));
        const recorder = new root.MediaRecorder(stream, mime ? { mimeType: mime } : undefined), chunks = [];
        session.stream = stream; session.recorder = recorder; session.chunks = chunks;
        recorder.ondataavailable = (item) => { if (item.data?.size) chunks.push(item.data); };
        recorder.onerror = () => announce("Ghi âm bị gián đoạn. Hãy kiểm tra microphone.", "error");
        recorder.onstop = async () => {
          stream.getTracks().forEach((track) => track.stop());
          if (session.stream === stream) session.stream = null; if (session.recorder === recorder) session.recorder = null;
          if (!isCurrent()) return;
          button.disabled = false; button.textContent = "● Bắt đầu thu";
          const blob = new Blob(chunks, { type: recorder.mimeType || "audio/webm" });
          if (!blob.size) return announce("Bản thu rỗng nên không được thêm vào dự án.", "error");
          const FileCtor = root.File; if (typeof FileCtor !== "function") return announce("Trình duyệt không thể tạo tệp từ bản thu.", "error");
          const extension = /mp4/i.test(blob.type) ? "m4a" : "webm";
          await loadFiles([new FileCtor([blob], `podcast-${Date.now()}.${extension}`, { type: blob.type })]);
        };
        recorder.start(250); button.textContent = "■ Dừng và mở bản thu"; button.disabled = false; announce("Đang thu microphone trên thiết bị.", "success");
      } catch (error) { stream?.getTracks?.().forEach((track) => track.stop()); if (isCurrent()) announce(`Không mở được microphone: ${cleanText(error?.message || error)}`, "error"); }
      finally { session.acquiringMic = false; if (isCurrent() && session.recorder?.state !== "recording") button.disabled = false; }
    };

    host.addEventListener("click", async (event) => {
      if (event.target.closest("[data-mas-play]")) return runRender("play");
      if (event.target.closest("[data-mas-stop]")) { stopPlayback(); if (session.recorder?.state === "recording") session.recorder.stop(); setStatus(`${session.tracks.length} rãnh sẵn sàng`); return; }
      if (event.target.closest("[data-mas-export]")) return runRender("export");
      if (event.target.closest("[data-mas-save-bin]")) return saveToBin();
      const history = event.target.closest("[data-mas-history]"); if (history) { const direction = history.dataset.masHistory, source = direction === "undo" ? session.history.past : session.history.future; if (!source.length) return; const destination = direction === "undo" ? session.history.future : session.history.past; destination.push(cloneTracks(session.tracks)); session.tracks = cloneTracks(source.pop()); if (!session.tracks.some((track) => track.id === session.selectedTrackId)) session.selectedTrackId = session.tracks[0]?.id || ""; session.state.end = duration(); renderTracks(session.selectedTrackId); updateLabels(); updateHistoryButtons(); announce(direction === "undo" ? "Đã hoàn tác thao tác mixer." : "Đã làm lại thao tác mixer.", "success"); return; }
      const trackSelect = event.target.closest("[data-mas-track-select]"); if (trackSelect) { session.selectedTrackId = trackSelect.dataset.masTrackSelect; renderTracks(session.selectedTrackId); updateLabels(); return; }
      const trackAction = event.target.closest("[data-mas-track-action]"); if (trackAction) {
        const id = trackAction.dataset.trackId, action = trackAction.dataset.masTrackAction, track = session.tracks.find((item) => item.id === id); if (!track) return;
        let next = session.tracks, message = "Đã cập nhật mixer.";
        if (action === "remove") { next = updateTrackList(next, { type: "remove", id }); message = "Đã xóa rãnh khỏi phiên hiện tại."; }
        if (action === "duplicate") { next = updateTrackList(next, { type: "duplicate", id, newId: `${id}-${Date.now()}` }); message = "Đã nhân bản clip audio sang cuối timeline."; }
        if (action === "up" || action === "down") { next = updateTrackList(next, { type: "move", id, delta: action === "up" ? -1 : 1 }); message = "Đã đổi thứ tự rãnh."; }
        if (action === "mute" || action === "solo") next = updateTrackList(next, { type: "update", id, patch: { [action === "mute" ? "muted" : "solo"]: !track[action === "mute" ? "muted" : "solo"] } });
        if (action === "automation") { const local = clamp(session.state.start - track.offset, 0, trackTimelineDuration(track)), answer = root.prompt?.("Mức automation tại In (0–1.5):", "0.75"); if (answer == null || String(answer).trim() === "" || !Number.isFinite(Number(answer))) return; const value = clamp(answer, 0, 1.5); next = updateTrackList(next, { type: "add-automation", id, time: local, value }); message = `Đã thêm automation ${value.toFixed(2)} tại ${formatTime(local)}.`; }
        if (action === "clear-automation") { next = updateTrackList(next, { type: "remove-automation", id }); message = "Đã xóa automation của rãnh."; }
        commitTracks(next, message, id); return;
      }
      if (event.target.closest("[data-mas-split]")) { const track = selectedTrack(); if (!track) return; if (track.loop) return announce("Hãy tắt loop trước khi tách để giữ source range chính xác.", "error"); const before = session.tracks.length, next = updateTrackList(session.tracks, { type: "split", id: track.id, at: session.state.start, newId: `${track.id}-split-${Date.now()}` }); if (next.length === before) return announce("Điểm In phải nằm bên trong rãnh đang chọn.", "error"); commitTracks(next, "Đã tách rãnh tại điểm In.", track.id); return; }
      if (event.target.closest("[data-mas-trim-track]")) { const track = selectedTrack(); if (!track) return; const next = updateTrackList(session.tracks, { type: "trim", id: track.id, start: session.state.start, end: session.state.end }); if (!commitTracks(next, "Đã trim rãnh theo vùng chọn.", track.id)) announce("Vùng chọn không cắt qua rãnh đang chọn.", "error"); return; }
      if (event.target.closest("[data-mas-region-add]")) { const range = trimRange(duration(), session.state.start, session.state.end); if (!(range.duration > .01)) return; const title = cleanText(root.prompt?.("Tên vùng chọn:", `Vùng ${session.state.regions.length + 1}`), 120); if (!title) return; const id = `region-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`; session.state.regions = updateRegions(session.state.regions, { type: "add", region: { id, start: range.start, end: range.end, title } }); session.state.activeRegion = session.state.regions.some((region) => region.id === id) ? id : ""; save(session.state); renderRegions(); announce("Đã lưu vùng chọn để phát hoặc xuất lại.", "success"); return; }
      const regionSelect = event.target.closest("[data-mas-region-select]"); if (regionSelect) { const region = session.state.regions.find((item) => item.id === regionSelect.dataset.masRegionSelect); if (!region) return; session.state.start = region.start; session.state.end = region.end; session.state.activeRegion = region.id; save(session.state); renderRegions(); updateLabels(); return; }
      const regionRemove = event.target.closest("[data-mas-region-remove]"); if (regionRemove) { session.state.regions = updateRegions(session.state.regions, { type: "remove", id: regionRemove.dataset.masRegionRemove }); if (session.state.activeRegion === regionRemove.dataset.masRegionRemove) session.state.activeRegion = ""; save(session.state); renderRegions(); return; }
      const preset = event.target.closest("[data-mas-preset]"); if (preset) { const values = { voice: { gain: 1.5, gate: -48, compressor: true, limiter: -1, highPass: 90, normalize: true, fadeIn: .08, fadeOut: .18 }, podcast: { gain: 0, gate: -52, compressor: true, limiter: -1, highPass: 70, normalize: true, fadeIn: .12, fadeOut: .25 }, music: { gain: 0, gate: -72, compressor: false, limiter: -1, highPass: 20, normalize: false, fadeIn: .35, fadeOut: .8 } }[preset.dataset.masPreset]; Object.assign(session.state, values); host.querySelectorAll("[data-mas-setting]").forEach((input) => { const key = input.dataset.masSetting; if (Object.prototype.hasOwnProperty.call(values, key)) input.type === "checkbox" ? input.checked = Boolean(values[key]) : input.value = values[key]; }); updateLabels(); announce(`Đã áp dụng preset ${preset.textContent.trim()}.`, "success"); return; }
      if (event.target.closest("[data-mas-silence]")) {
        const track = selectedTrack(); if (!track || session.busy) return;
        session.busy = "analysis"; session.renderController = new AbortController(); const signal = session.renderController.signal; updateLabels(); setStatus("Đang tìm khoảng lặng…");
        try { const bounds = await findSpeechBoundsAsync(track.buffer, session.state.gate, { signal, onProgress: (value) => setStatus(`Đang tìm khoảng lặng · ${Math.round(value * 100)}%`) }); if (!isCurrent() || signal.aborted) return; if (bounds.end <= bounds.start) announce("Rãnh đang chọn không có tín hiệu vượt ngưỡng gate.", "error"); else { session.state.start = bounds.start; session.state.end = bounds.end; announce(`Đã tìm vùng có tín hiệu ${formatTime(bounds.start)} → ${formatTime(bounds.end)} trên rãnh đang chọn.`, "success"); } }
        catch (error) { if (error?.name !== "AbortError") announce(cleanText(error?.message || error), "error"); }
        finally { if (isCurrent()) { session.busy = ""; session.renderController = null; setStatus(`${session.tracks.length} rãnh sẵn sàng`); updateLabels(); } } return;
      }
      if (event.target.closest("[data-mas-chapter]")) { const title = cleanText(root.prompt?.("Tên chapter:", `Chương ${session.state.markers.length + 1}`), 120); if (!title || session.state.markers.length >= LIMITS.markers) return; session.state.markers.push({ id: `chapter-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`, time: session.state.start, title }); save(session.state); renderChapters(); announce("Đã thêm chapter tại điểm In.", "success"); return; }
      const markerRemove = event.target.closest("[data-mas-marker-remove]"); if (markerRemove) { session.state.markers = session.state.markers.filter((item) => item.id !== markerRemove.dataset.masMarkerRemove); save(session.state); renderChapters(); markerRemove.closest("span")?.previousElementSibling?.querySelector("button")?.focus(); return; }
      if (event.target.closest("[data-mas-chapters]")) { downloadBlob(session, new Blob([chaptersJson(session.state)], { type: "application/json" }), `${safeStem(session.file?.name, "hh-podcast")}-chapters.json`); announce("Đã xuất Podcast Namespace chapters JSON.", "success"); return; }
      if (event.target.closest("[data-mas-rss]")) { downloadBlob(session, new Blob([rssItem(session.state, duration())], { type: "application/xml" }), `${safeStem(session.file?.name, "hh-podcast")}-rss-item.xml`); announce("Đã xuất RSS item metadata.", "success"); return; }
      if (event.target.closest("[data-mas-manifest]")) { downloadBlob(session, new Blob([podcastManifest(session.state, session.tracks, duration())], { type: "application/json" }), `${safeStem(session.file?.name, "hh-podcast")}-project.json`); announce("Đã xuất project manifest gồm metadata, chapter, region và mixer automation.", "success"); return; }
      const record = event.target.closest("[data-mas-record]"); if (record) return toggleRecorder(record);
    }, { signal: controller.signal });
    host.addEventListener("change", (event) => {
      if (event.target.matches("[data-mas-file]")) { loadFiles(event.target.files); event.target.value = ""; return; }
      const trackSetting = event.target.dataset.masTrackSetting;
      if (trackSetting) finishTrackDraft(event.target.dataset.trackId, trackSetting);
    }, { signal: controller.signal });
    host.addEventListener("input", (event) => {
      const trackSetting = event.target.dataset.masTrackSetting;
      if (trackSetting) { const id = event.target.dataset.trackId; beginTrackDraft(id, trackSetting); const value = event.target.type === "checkbox" ? event.target.checked : trackSetting === "role" ? event.target.value : Number(event.target.value); session.tracks = updateTrackList(session.tracks, { type: "update", id, patch: { [trackSetting]: value } }); const output = event.target.closest("label")?.querySelector("output"); if (output) output.textContent = `${event.target.value}${trackSetting === "gain" ? " dB" : trackSetting === "pan" ? "%" : ""}`; if (["offset", "loop", "loopCount", "fadeIn", "fadeOut"].includes(trackSetting)) { session.state.end = duration(); updateLabels(); } return; }
      const setting = event.target.dataset.masSetting; if (setting) { session.state[setting] = event.target.type === "checkbox" ? event.target.checked : Number(event.target.value); updateLabels(); return; }
      const ducking = event.target.dataset.masDucking; if (ducking) { session.state.ducking[ducking] = event.target.type === "checkbox" ? event.target.checked : Number(event.target.value); session.state = normalizeState(session.state); updateLabels(); return; }
      const podcast = event.target.dataset.masPodcast; if (podcast) { session.state.podcast[podcast] = podcast === "episode" ? clamp(event.target.value, 1, 99999) : podcast === "explicit" ? event.target.checked : cleanText(event.target.value, podcast === "description" ? 600 : podcast === "language" ? 16 : podcast === "category" ? 80 : 160); save(session.state); return; }
      if (event.target.matches("[data-mas-start],[data-mas-end]")) { const total = duration(), value = Number(event.target.value) / 100 * total; if (event.target.matches("[data-mas-start]")) session.state.start = Math.max(0, Math.min(value, session.state.end - .02)); else session.state.end = Math.min(total, Math.max(value, session.state.start + .02)); session.state.activeRegion = ""; renderRegions(); updateLabels(); }
    }, { signal: controller.signal });
    host.addEventListener("dragover", (event) => { if ([...(event.dataTransfer?.items || [])].some((item) => item.kind === "file")) event.preventDefault(); }, { signal: controller.signal });
    host.addEventListener("drop", (event) => { const files = [...(event.dataTransfer?.files || [])].filter((file) => !file.type || file.type.startsWith("audio/")); if (files.length) { event.preventDefault(); loadFiles(files); } }, { signal: controller.signal });
    renderTracks(); renderChapters(); renderRegions(); updateLabels();
    return Object.freeze({ getState: () => ({ ...normalizeState(session.state), tracks: session.tracks.map((track) => { const { file, buffer, analysis, ...metadata } = normalizeTrack(track); return metadata; }) }), loadFile: (file) => loadFiles([file]), loadFiles, stop: stopPlayback, unmount });
  }
  function unmount() {
    const session = active; if (!session) return;
    active = null; session.closing = true; session.generation += 1; session.controller.abort(); session.renderController?.abort();
    root.clearTimeout(session.toastTimer); root.cancelAnimationFrame?.(session.drawFrame); session.timers.forEach((timer) => root.clearTimeout(timer)); session.urls.forEach((url) => root.URL?.revokeObjectURL?.(url));
    try { session.playing?.stop(); } catch (_) {}
    const recorder = session.recorder; if (recorder) { recorder.ondataavailable = null; recorder.onstop = null; recorder.onerror = null; try { if (recorder.state !== "inactive") recorder.stop(); } catch (_) {} }
    session.stream?.getTracks?.().forEach((track) => track.stop()); session.audioContext?.close?.().catch?.(() => {});
    if (session.host) session.host.innerHTML = "";
  }
  return Object.freeze({ STORAGE_KEY, LIMITS, normalizeState, normalizeTrack, trackSegmentDuration, trackTimelineDuration, automationValue, updateTrackList, updateRegions, trimRange, encodeWav, encodeWavAsync, processBuffer, renderEstimate, renderMixAsync, estimateLoudness, findSpeechBounds, findSpeechBoundsAsync, chaptersJson, rssItem, podcastManifest, mount, unmount });
});
