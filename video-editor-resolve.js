(function exposeResolveOperations(globalScope, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (globalScope) globalScope.HHVideoEditorResolveOps = api;
})(typeof window !== "undefined" ? window : globalThis, () => {
  "use strict";

  const LIMITS = Object.freeze({ tracks: 24, clips: 500, subtitles: 300, keyframes: 500, nodes: 80, queue: 30, history: 60, nested: 80, automation: 200 });
  const clone = (value) => JSON.parse(JSON.stringify(value));
  const number = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
  const clamp = (value, min, max) => Math.min(max, Math.max(min, number(value)));
  const cleanText = (value, max = 120) => String(value ?? "").replace(/[<>\u0000-\u001f]/g, " ").trim().slice(0, max);
  const makeId = (prefix, seed = Date.now()) => `${prefix}-${String(seed).replace(/[^a-z0-9-]/gi, "").slice(-24) || "local"}`;
  const list = (value) => Array.isArray(value) ? value : [];
  const record = (value) => value && typeof value === "object" && !Array.isArray(value) ? value : {};
  function uniqueId(value, fallback, used) {
    const base = cleanText(value || fallback, 80) || fallback;
    let id = base, suffix = 2;
    while (used.has(id)) { id = `${base.slice(0, 70)}-${suffix}`; suffix += 1; }
    used.add(id); return id;
  }
  function normalizeFrameSize(value) {
    const match = /^(\d{2,5})x(\d{2,5})$/i.exec(String(value || ""));
    if (!match) return "1920x1080";
    const width = Math.round(clamp(match[1], 160, 7680)), height = Math.round(clamp(match[2], 90, 4320));
    return `${width}x${height}`;
  }
  const defaultTracks = () => [
    { id: "V2", type: "video", name: "Video 2", locked: false, muted: false },
    { id: "V1", type: "video", name: "Video 1", locked: false, muted: false },
    { id: "A1", type: "audio", name: "Audio 1", locked: false, muted: false }
  ];
  const createProject = () => ({
    version: 2,
    revision: 0,
    workspace: "edit",
    fps: 30,
    snap: { enabled: true, thresholdFrames: 5 },
    tracks: defaultTracks(),
    clips: [],
    subtitles: [],
    nestedSequences: [],
    multicam: { enabled: false, activeAngle: 1, angles: [] },
    proxyPlan: { enabled: false, scale: .5, status: "source", notice: "Chưa tạo tệp proxy. Trình duyệt đang phát media nguồn." },
    keyframes: [],
    motion: { tracking: { status: "idle", points: [] }, stabilization: { enabled: false, strength: 0, status: "idle" }, speedRamp: { enabled: false, points: [{ time: 0, speed: 1 }] } },
    color: { lut: "none", wheels: { lift: 0, gamma: 0, gain: 0, offset: 0 }, curves: [{ x: 0, y: 0 }, { x: 1, y: 1 }], nodes: [{ id: "corrector-1", type: "corrector", enabled: true }] },
    audio: { channels: [{ id: "A1", gain: 1, pan: 0, muted: false, solo: false, eq: { low: 0, mid: 0, high: 0 }, compressor: { enabled: false, threshold: -24, ratio: 3 }, noiseReduction: { enabled: false, amount: 0 }, automation: [] }] },
    exportQueue: []
  });

  function normalizeClip(input = {}, index = 0, trackIds = ["V1"]) {
    const raw = record(input);
    const track = trackIds.includes(raw.track) ? raw.track : trackIds[0] || "V1";
    const duration = clamp(raw.duration, 1 / 120, 21600);
    const sourceDuration = clamp(raw.sourceDuration || duration, duration, 43200);
    return {
      id: cleanText(raw.id || makeId("clip", index), 80),
      name: cleanText(raw.name || `Clip ${index + 1}`, 160),
      track,
      start: clamp(raw.start, 0, 86400),
      duration,
      sourceIn: clamp(raw.sourceIn, 0, Math.max(0, sourceDuration - duration)),
      sourceDuration,
      type: raw.type === "audio" ? "audio" : raw.type === "nested" ? "nested" : "video",
      nestedId: cleanText(raw.nestedId || "", 80)
    };
  }

  function normalizeProject(input = {}) {
    const raw = record(input), base = createProject(), trackIdsUsed = new Set();
    const tracks = (list(raw.tracks).length ? list(raw.tracks) : base.tracks).slice(0, LIMITS.tracks).map((value, index) => {
      const track = record(value), fallback = `${track.type === "audio" ? "A" : "V"}${index + 1}`;
      return { id: uniqueId(track.id, fallback, trackIdsUsed), type: track.type === "audio" ? "audio" : "video", name: cleanText(track.name || track.id || `Rãnh ${index + 1}`, 80), locked: Boolean(track.locked), muted: Boolean(track.muted) };
    });
    const trackIds = tracks.map((track) => track.id), clipIds = new Set(), subtitleIds = new Set(), keyframeIds = new Set(), queueIds = new Set(), nestedIds = new Set(), nodeIds = new Set(), audioIds = new Set();
    const clips = list(raw.clips).slice(0, LIMITS.clips).map((value, index) => { const clip = normalizeClip(value, index, trackIds); clip.id = uniqueId(clip.id, makeId("clip", index), clipIds); return clip; });
    const subtitles = list(raw.subtitles).slice(0, LIMITS.subtitles).map((value, index) => { const item = record(value); return { id: uniqueId(item.id, makeId("subtitle", index), subtitleIds), start: clamp(item.start, 0, 86400), duration: clamp(item.duration || 2, .1, 3600), text: cleanText(item.text || "Phụ đề mới", 500), language: cleanText(item.language || "vi", 12) || "vi" }; });
    const keyframes = list(raw.keyframes).slice(-LIMITS.keyframes).map((value, index) => { const item = record(value); return { id: uniqueId(item.id, makeId("kf", index), keyframeIds), property: cleanText(item.property || "position", 40), time: clamp(item.time, 0, 86400), value: clamp(item.value, -1000000, 1000000), easing: ["linear", "ease-in", "ease-out", "ease-in-out"].includes(item.easing) ? item.easing : "ease-in-out" }; });
    const exportQueue = list(raw.exportQueue).slice(-LIMITS.queue).map((value, index) => {
      const job = record(value), status = ["queued", "processing", "completed", "failed", "cancelled", "unsupported", "provider-not-configured"].includes(job.status) ? job.status : "queued";
      return { id: uniqueId(job.id, makeId("export", index), queueIds), idempotencyKey: cleanText(job.idempotencyKey || "", 120), name: cleanText(job.name || "HH Export", 120), mime: cleanText(job.mime || "video/webm", 100), size: normalizeFrameSize(job.size), bitrate: Math.round(clamp(job.bitrate || 8000000, 250000, 80000000)), includeAudio: job.includeAudio !== false, status, progress: clamp(job.progress, 0, 100), notice: cleanText(job.notice || "Chưa bắt đầu kết xuất.", 240), createdAt: clamp(job.createdAt || Date.now(), 0, 4102444800000) };
    });
    const nestedSequences = list(raw.nestedSequences).slice(-LIMITS.nested).map((value, sequenceIndex) => {
      const sequence = record(value), sequenceClipIds = new Set(), sequenceClips = list(sequence.clips).slice(0, 120).map((clip, clipIndex) => { const normalized = normalizeClip(clip, clipIndex, trackIds); normalized.id = uniqueId(normalized.id, makeId("nested-clip", clipIndex), sequenceClipIds); return normalized; });
      const measuredDuration = sequenceClips.reduce((maximum, clip) => Math.max(maximum, clip.start + clip.duration), 0);
      return { id: uniqueId(sequence.id, makeId("nested", sequenceIndex), nestedIds), name: cleanText(sequence.name || `Sequence ${sequenceIndex + 1}`, 100), duration: clamp(sequence.duration || measuredDuration, 1 / 120, 86400), clips: sequenceClips };
    });
    const snap = record(raw.snap), proxy = record(raw.proxyPlan), multicam = record(raw.multicam), motion = record(raw.motion), tracking = record(motion.tracking), stabilization = record(motion.stabilization), speedRamp = record(motion.speedRamp), color = record(raw.color), wheels = record(color.wheels), audio = record(raw.audio);
    const angles = list(multicam.angles).slice(0, 16).map((value, index) => { const angle = record(value); return { id: cleanText(angle.id || `cam-${index + 1}`, 80), name: cleanText(angle.name || `CAM ${index + 1}`, 80), clipId: cleanText(angle.clipId || "", 80) }; });
    const colorNodes = (list(color.nodes).length ? list(color.nodes) : base.color.nodes).slice(-LIMITS.nodes).map((value, index) => { const node = record(value); return { id: uniqueId(node.id, makeId("color-node", index), nodeIds), type: cleanText(node.type || "corrector", 40), enabled: node.enabled !== false }; });
    const channels = (list(audio.channels).length ? list(audio.channels) : base.audio.channels).slice(0, LIMITS.tracks).map((value, index) => {
      const channel = record(value), eq = record(channel.eq), compressor = record(channel.compressor), noiseReduction = record(channel.noiseReduction);
      return { id: uniqueId(channel.id, `A${index + 1}`, audioIds), gain: clamp(channel.gain ?? 1, 0, 1.5), pan: clamp(channel.pan, -1, 1), muted: Boolean(channel.muted), solo: Boolean(channel.solo), eq: { low: clamp(eq.low, -18, 18), mid: clamp(eq.mid, -18, 18), high: clamp(eq.high, -18, 18) }, compressor: { enabled: Boolean(compressor.enabled), threshold: clamp(compressor.threshold ?? -24, -60, 0), ratio: clamp(compressor.ratio ?? 3, 1, 20) }, noiseReduction: { enabled: Boolean(noiseReduction.enabled), amount: clamp(noiseReduction.amount, 0, 1) }, automation: list(channel.automation).slice(-LIMITS.automation).map((value) => { const point = record(value); return { time: clamp(point.time, 0, 86400), value: clamp(point.value, 0, 1.5) }; }).sort((a, b) => a.time - b.time) };
    });
    if (!channels.some((channel) => channel.id === "A1")) { if (channels.length >= LIMITS.tracks) channels.pop(); channels.unshift({ ...base.audio.channels[0], eq: { ...base.audio.channels[0].eq }, compressor: { ...base.audio.channels[0].compressor }, noiseReduction: { ...base.audio.channels[0].noiseReduction }, automation: [] }); }
    return {
      version: 2,
      revision: Math.max(0, Math.floor(number(raw.revision))),
      workspace: ["media", "cut", "edit", "fusion", "color", "audio", "deliver"].includes(raw.workspace) ? raw.workspace : "edit",
      fps: clamp(raw.fps || 30, 1, 120), tracks, clips, subtitles, nestedSequences, keyframes, exportQueue,
      snap: { enabled: snap.enabled !== false, thresholdFrames: clamp(snap.thresholdFrames ?? 5, 1, 30) },
      proxyPlan: { enabled: Boolean(proxy.enabled), scale: clamp(proxy.scale ?? .5, .1, 1), estimatedBytes: Math.max(0, Math.floor(number(proxy.estimatedBytes))), status: ["source", "planned", "ready", "failed", "provider-not-configured"].includes(proxy.status) ? proxy.status : "source", notice: cleanText(proxy.notice || base.proxyPlan.notice, 240) },
      multicam: { enabled: Boolean(multicam.enabled) && angles.length > 1, activeAngle: clamp(multicam.activeAngle || 1, 1, Math.max(1, angles.length)), angles },
      motion: {
        tracking: { status: ["idle", "processing", "local-transform", "completed", "failed", "provider-not-configured"].includes(tracking.status) ? tracking.status : "idle", points: list(tracking.points).slice(-300).map((value) => { const point = record(value); return { time: clamp(point.time, 0, 86400), x: clamp(point.x, -100000, 100000), y: clamp(point.y, -100000, 100000) }; }) },
        stabilization: { enabled: Boolean(stabilization.enabled), strength: clamp(stabilization.strength, 0, 1), status: ["idle", "processing", "local-transform", "completed", "failed", "provider-not-configured"].includes(stabilization.status) ? stabilization.status : "idle" },
        speedRamp: { enabled: Boolean(speedRamp.enabled), points: (list(speedRamp.points).length ? list(speedRamp.points) : base.motion.speedRamp.points).slice(-80).map((value) => { const point = record(value); return { time: clamp(point.time, 0, 86400), speed: clamp(point.speed || 1, .05, 8) }; }).sort((a, b) => a.time - b.time) }
      },
      color: { lut: cleanText(color.lut || base.color.lut, 80), wheels: { lift: clamp(wheels.lift, -100, 100), gamma: clamp(wheels.gamma, -100, 100), gain: clamp(wheels.gain, -100, 100), offset: clamp(wheels.offset, -100, 100) }, curves: (list(color.curves).length ? list(color.curves) : base.color.curves).slice(-40).map((value) => { const point = record(value); return { x: clamp(point.x, 0, 1), y: clamp(point.y, 0, 1) }; }).sort((a, b) => a.x - b.x), nodes: colorNodes },
      audio: { channels }
    };
  }

  const commit = (project, mutate) => {
    const next = normalizeProject(project);
    mutate(next);
    next.revision += 1;
    return normalizeProject(next);
  };
  const clipsOnTrack = (project, track) => project.clips.filter((clip) => clip.track === track).sort((a, b) => a.start - b.start);

  function snapTime(project, value, points = []) {
    const fps = project.fps || 30;
    if (!project.snap?.enabled) return Math.max(0, number(value));
    const frame = Math.round(number(value) * fps) / fps;
    const threshold = (project.snap.thresholdFrames || 5) / fps;
    const candidates = [...points, 0, ...project.clips.flatMap((clip) => [clip.start, clip.start + clip.duration])];
    const nearestEdit = candidates.reduce((best, point) => best == null || Math.abs(point - value) < Math.abs(best - value) ? point : best, null);
    return Math.max(0, nearestEdit != null && Math.abs(nearestEdit - value) <= threshold ? nearestEdit : frame);
  }

  function applyTimelineOperation(project, operation = {}) {
    const type = operation.type;
    return commit(project, (next) => {
      const clip = next.clips.find((item) => item.id === operation.clipId);
      const clipTrack = clip ? next.tracks.find((track) => track.id === clip.track) : null;
      const editableClip = clip && !clipTrack?.locked ? clip : null;
      if (type === "toggle-snap") next.snap.enabled = operation.enabled == null ? !next.snap.enabled : Boolean(operation.enabled);
      else if (type === "set-track") {
        const track = next.tracks.find((item) => item.id === operation.trackId);
        if (track) { if (operation.locked != null) track.locked = Boolean(operation.locked); if (operation.muted != null) track.muted = Boolean(operation.muted); if (operation.name != null) track.name = cleanText(operation.name, 80) || track.name; }
      }
      else if (type === "add-track" && next.tracks.length < LIMITS.tracks) {
        const id = cleanText(operation.id || `${operation.trackType === "audio" ? "A" : "V"}${next.tracks.length + 1}`, 24);
        if (id && !next.tracks.some((track) => track.id === id)) {
          const trackType = operation.trackType === "audio" ? "audio" : "video";
          next.tracks.push({ id, type: trackType, name: cleanText(operation.name || id, 80), locked: false, muted: false });
          if (trackType === "audio" && !next.audio.channels.some((channel) => channel.id === id)) next.audio.channels.push({ id, gain: 1, pan: 0, muted: false, solo: false, eq: { low: 0, mid: 0, high: 0 }, compressor: { enabled: false, threshold: -24, ratio: 3 }, noiseReduction: { enabled: false, amount: 0 }, automation: [] });
        }
      } else if (type === "add-clip" && next.clips.length < LIMITS.clips) {
        const candidate = normalizeClip(operation.clip, next.clips.length, next.tracks.map((track) => track.id)), targetTrack = next.tracks.find((track) => track.id === candidate.track);
        if (!targetTrack?.locked && !next.clips.some((item) => item.id === candidate.id)) next.clips.push(candidate);
      } else if (type === "duplicate" && editableClip && next.clips.length < LIMITS.clips) {
        const id = cleanText(operation.newId || makeId("clip", `${editableClip.id}-${next.revision}`), 80);
        if (!next.clips.some((item) => item.id === id)) next.clips.push({ ...editableClip, id, name: cleanText(`${editableClip.name} Copy`, 160), start: snapTime({ ...next, clips: next.clips.filter((item) => item.id !== editableClip.id) }, operation.at ?? editableClip.start + editableClip.duration) });
      } else if (type === "move" && editableClip) {
        const targetTrack = operation.track ? next.tracks.find((track) => track.id === operation.track) : clipTrack;
        if (targetTrack && !targetTrack.locked) { editableClip.track = targetTrack.id; editableClip.start = snapTime({ ...next, clips: next.clips.filter((item) => item.id !== editableClip.id) }, operation.at ?? editableClip.start + number(operation.delta)); }
      } else if (type === "trim-start" && editableClip) {
        const originalEnd = editableClip.start + editableClip.duration, at = clamp(operation.at ?? editableClip.start + number(operation.delta), editableClip.start, originalEnd - 1 / next.fps), amount = at - editableClip.start;
        editableClip.start = at; editableClip.duration = originalEnd - at; editableClip.sourceIn = clamp(editableClip.sourceIn + amount, 0, Math.max(0, editableClip.sourceDuration - editableClip.duration));
      } else if (type === "trim-end" && editableClip) {
        const end = clamp(operation.at ?? editableClip.start + editableClip.duration + number(operation.delta), editableClip.start + 1 / next.fps, editableClip.start + editableClip.sourceDuration - editableClip.sourceIn);
        editableClip.duration = end - editableClip.start;
      } else if (type === "blade" && editableClip) {
        const at = clamp(operation.at, editableClip.start + 1 / next.fps, editableClip.start + editableClip.duration - 1 / next.fps);
        if (at > editableClip.start && at < editableClip.start + editableClip.duration && next.clips.length < LIMITS.clips) {
          const leftDuration = at - editableClip.start, rightDuration = editableClip.duration - leftDuration, id = cleanText(operation.newId || makeId("clip", `${editableClip.id}-${next.revision}`), 80);
          if (next.clips.some((item) => item.id === id)) return;
          editableClip.duration = leftDuration;
          next.clips.push({ ...editableClip, id, name: cleanText(`${editableClip.name} B`, 160), start: at, duration: rightDuration, sourceIn: editableClip.sourceIn + leftDuration });
        }
      } else if (type === "ripple-delete" && editableClip) {
        const end = editableClip.start + editableClip.duration, track = editableClip.track, amount = editableClip.duration;
        next.clips = next.clips.filter((item) => item.id !== editableClip.id).map((item) => item.track === track && item.start >= end ? { ...item, start: Math.max(0, item.start - amount) } : item);
      } else if (type === "slip" && editableClip) editableClip.sourceIn = clamp(editableClip.sourceIn + number(operation.delta), 0, Math.max(0, editableClip.sourceDuration - editableClip.duration));
      else if (type === "slide" && editableClip) {
        const rows = clipsOnTrack(next, editableClip.track), index = rows.findIndex((item) => item.id === editableClip.id), previous = rows[index - 1], following = rows[index + 1];
        const minDelta = previous ? -Math.max(0, previous.duration - 1 / next.fps) : -editableClip.start;
        const maxDelta = following ? Math.max(0, following.duration - 1 / next.fps) : 86400 - editableClip.start - editableClip.duration;
        const delta = clamp(operation.delta, minDelta, maxDelta);
        editableClip.start += delta;
        if (previous) previous.duration += delta;
        if (following) { following.start += delta; following.duration -= delta; following.sourceIn += delta; }
      }
    });
  }

  function addSubtitle(project, subtitle = {}) {
    return commit(project, (next) => {
      if (next.subtitles.length >= LIMITS.subtitles) return;
      const data = record(subtitle), id = cleanText(data.id || makeId("subtitle", `${next.revision}-${next.subtitles.length}`), 80);
      if (!id || next.subtitles.some((item) => item.id === id)) return;
      next.subtitles.push({ id, start: clamp(data.start, 0, 86400), duration: clamp(data.duration || 2, .1, 3600), text: cleanText(data.text || "Phụ đề mới", 500), language: cleanText(data.language || "vi", 12) });
    });
  }

  function createNestedSequence(project, clipIds = [], name = "Sequence lồng") {
    return commit(project, (next) => {
      const ids = new Set(list(clipIds).map((id) => cleanText(id, 80))), selected = next.clips.filter((clip) => ids.has(clip.id));
      if (!selected.length || selected.some((clip) => next.tracks.find((track) => track.id === clip.track)?.locked)) return;
      const start = Math.min(...selected.map((clip) => clip.start)), end = Math.max(...selected.map((clip) => clip.start + clip.duration));
      const nested = { id: makeId("nested", `${next.revision}-${selected.length}`), name: cleanText(name, 100), clips: clone(selected), duration: end - start };
      next.nestedSequences.push(nested);
      next.clips = next.clips.filter((clip) => !clipIds.includes(clip.id));
      next.clips.push(normalizeClip({ id: makeId("clip", nested.id), name: nested.name, track: selected[0].track, start, duration: nested.duration, sourceDuration: nested.duration, sourceIn: 0, type: "nested", nestedId: nested.id }, next.clips.length, next.tracks.map((track) => track.id)));
    });
  }

  function planProxy(asset = {}, scale = .5) {
    const source = record(asset), sourceSize = Math.max(0, number(source.size));
    return { assetId: cleanText(source.id || "media", 80), enabled: true, scale: clamp(scale, .1, 1), estimatedBytes: Math.round(sourceSize * clamp(scale, .1, 1) ** 2), status: "planned", notice: "Đây là kế hoạch proxy. Trình duyệt chưa tạo hoặc thay thế codec của tệp nguồn." };
  }

  function createWaveformEnvelope(samples, buckets = 64) {
    const values = samples && Number.isFinite(Number(samples.length)) ? samples : [];
    const count = Math.max(1, Math.min(512, Math.floor(number(buckets, 64))));
    if (!values.length) return Array.from({ length: count }, () => ({ min: 0, max: 0, rms: 0 }));
    return Array.from({ length: count }, (_, index) => {
      const from = Math.floor(index * values.length / count), to = Math.max(from + 1, Math.floor((index + 1) * values.length / count));
      const stride = Math.max(1, Math.ceil((to - from) / 8192)); let minimum = 1, maximum = -1, squares = 0, measured = 0;
      for (let offset = from; offset < to; offset += stride) { const value = clamp(values[offset], -1, 1); minimum = Math.min(minimum, value); maximum = Math.max(maximum, value); squares += value * value; measured += 1; }
      return { min: minimum, max: maximum, rms: Math.sqrt(squares / Math.max(1, measured)) };
    });
  }

  function addKeyframe(project, keyframe = {}) {
    const data = record(keyframe);
    return commit(project, (next) => {
      const id = cleanText(data.id || makeId("kf", `${next.revision}-${next.keyframes.length}`), 80);
      if (next.keyframes.some((item) => item.id === id)) return;
      next.keyframes.push({ id, property: cleanText(data.property || "position", 40), time: clamp(data.time, 0, 86400), value: clamp(data.value, -1000000, 1000000), easing: ["linear", "ease-in", "ease-out", "ease-in-out"].includes(data.easing) ? data.easing : "ease-in-out" });
      next.keyframes = next.keyframes.slice(-LIMITS.keyframes);
    });
  }

  function setMulticam(project, angles = [], activeAngle = 1) {
    return commit(project, (next) => {
      const safeAngles = list(angles);
      next.multicam = {
        enabled: safeAngles.length > 1,
        activeAngle: clamp(activeAngle, 1, Math.max(1, Math.min(16, safeAngles.length))),
        angles: safeAngles.slice(0, 16).map((value, index) => { const angle = record(value); return { id: cleanText(angle.id || `cam-${index + 1}`, 80), name: cleanText(angle.name || `CAM ${index + 1}`, 80), clipId: cleanText(angle.clipId || "", 80) }; })
      };
    });
  }

  function setMotionModel(project, kind, patch = {}) {
    const update = record(patch);
    return commit(project, (next) => {
      if (kind === "tracking") next.motion.tracking = { ...next.motion.tracking, ...update, points: (Array.isArray(update.points) ? update.points : next.motion.tracking.points).slice(-300) };
      if (kind === "stabilization") next.motion.stabilization = { ...next.motion.stabilization, ...update, strength: clamp(update.strength ?? next.motion.stabilization.strength, 0, 1) };
      if (kind === "speedRamp") next.motion.speedRamp = { ...next.motion.speedRamp, ...update, points: (Array.isArray(update.points) ? update.points : next.motion.speedRamp.points).slice(-80).map((value) => { const point = record(value); return { time: clamp(point.time, 0, 86400), speed: clamp(point.speed, .05, 8) }; }) };
    });
  }

  function updateColor(project, patch = {}) {
    const update = record(patch);
    return commit(project, (next) => {
      if (update.lut != null) next.color.lut = cleanText(update.lut, 80);
      if (record(update.wheels) === update.wheels) Object.entries(update.wheels).forEach(([key, value]) => { if (key in next.color.wheels) next.color.wheels[key] = clamp(value, -100, 100); });
      if (Array.isArray(update.curves)) next.color.curves = update.curves.slice(0, 40).map((value) => { const point = record(value); return { x: clamp(point.x, 0, 1), y: clamp(point.y, 0, 1) }; });
      const node = record(update.addNode);
      if (Object.keys(node).length && next.color.nodes.length < LIMITS.nodes) { const id = cleanText(node.id || makeId("color-node", next.revision), 80); if (!next.color.nodes.some((item) => item.id === id)) next.color.nodes.push({ id, type: cleanText(node.type || "corrector", 40), enabled: node.enabled !== false }); }
    });
  }

  function updateAudioChannel(project, channelId, patch = {}) {
    const update = record(patch);
    return commit(project, (next) => {
      const channel = next.audio.channels.find((item) => item.id === channelId);
      if (!channel) return;
      if (update.gain != null) channel.gain = clamp(update.gain, 0, 1.5);
      if (update.pan != null) channel.pan = clamp(update.pan, -1, 1);
      if (update.muted != null) channel.muted = Boolean(update.muted);
      if (update.solo != null) channel.solo = Boolean(update.solo);
      const eq = record(update.eq); if (Object.keys(eq).length) channel.eq = { low: clamp(eq.low ?? channel.eq.low, -18, 18), mid: clamp(eq.mid ?? channel.eq.mid, -18, 18), high: clamp(eq.high ?? channel.eq.high, -18, 18) };
      const compressor = record(update.compressor); if (Object.keys(compressor).length) channel.compressor = { ...channel.compressor, ...compressor, enabled: compressor.enabled == null ? channel.compressor.enabled : Boolean(compressor.enabled), threshold: clamp(compressor.threshold ?? channel.compressor.threshold, -60, 0), ratio: clamp(compressor.ratio ?? channel.compressor.ratio, 1, 20) };
      const noiseReduction = record(update.noiseReduction); if (Object.keys(noiseReduction).length) channel.noiseReduction = { enabled: Boolean(noiseReduction.enabled), amount: clamp(noiseReduction.amount, 0, 1) };
      if (Array.isArray(update.automation)) channel.automation = update.automation.slice(-LIMITS.automation).map((value) => { const point = record(value); return { time: clamp(point.time, 0, 86400), value: clamp(point.value, 0, 1.5) }; }).sort((a, b) => a.time - b.time);
    });
  }

  function enqueueExport(project, job = {}, capabilities = {}) {
    const current = normalizeProject(project), data = record(job), support = record(capabilities), idempotencyKey = cleanText(data.idempotencyKey || data.id || "", 120);
    if (idempotencyKey && current.exportQueue.some((item) => item.idempotencyKey === idempotencyKey || item.id === idempotencyKey)) return current;
    return commit(current, (next) => {
      if (next.exportQueue.length >= LIMITS.queue) return;
      const mime = cleanText(data.mime || "video/webm;codecs=vp9,opus", 100);
      const mp4Requested = /^video\/mp4/i.test(mime);
      const recognized = /^video\/(?:mp4|webm)(?:;|$)/i.test(mime);
      let codecSupported = false;
      try { codecSupported = !support.isTypeSupported || Boolean(support.isTypeSupported(mime)); } catch (_) { codecSupported = false; }
      const supported = Boolean(recognized && support.mediaRecorder && support.canvasCapture && codecSupported);
      const status = supported ? "queued" : "unsupported";
      const notice = status === "queued"
        ? mp4Requested
          ? "Đã xếp hàng cho bộ mã hóa MP4 H.264/AAC thật trên thiết bị."
          : "Đã xếp hàng cho bộ kết xuất WebM cục bộ của trình duyệt."
        : mp4Requested
          ? "Trình duyệt chưa cung cấp bộ mã hóa MP4 H.264/AAC qua MediaRecorder."
          : "Trình duyệt chưa hỗ trợ tổ hợp MediaRecorder, Canvas capture hoặc codec đã chọn.";
      next.exportQueue.push({ id: cleanText(data.id || makeId("export", `${next.revision}-${next.exportQueue.length}`), 80), idempotencyKey, name: cleanText(data.name || "HH Export", 120), mime, size: normalizeFrameSize(data.size), bitrate: Math.round(clamp(data.bitrate || 8000000, 250000, 80000000)), includeAudio: data.includeAudio !== false, status, progress: 0, notice, createdAt: Date.now() });
    });
  }

  function updateExportStatus(project, jobId, status, detail = {}) {
    const allowed = ["queued", "processing", "completed", "failed", "cancelled", "unsupported", "provider-not-configured"];
    if (!allowed.includes(status)) return normalizeProject(project);
    const info = record(detail);
    return commit(project, (next) => {
      const job = next.exportQueue.find((item) => item.id === jobId); if (!job) return;
      job.status = status; job.progress = status === "completed" ? 100 : clamp(info.progress ?? job.progress, 0, 100);
      if (info.notice != null) job.notice = cleanText(info.notice, 240);
    });
  }
  function recoverInterruptedExports(project) {
    const normalized = normalizeProject(project);
    if (!normalized.exportQueue.some((job) => job.status === "processing")) return normalized;
    return commit(normalized, (next) => { next.exportQueue.forEach((job) => { if (job.status === "processing") { job.status = "failed"; job.notice = "Phiên kết xuất trước đã bị gián đoạn. Kiểm tra codec rồi bấm Thử lại."; job.progress = 0; } }); });
  }

  function createHistory(project) { return { past: [], present: normalizeProject(project), future: [] }; }
  function commitHistory(history, nextProject) { return { past: [...history.past, clone(history.present)].slice(-LIMITS.history), present: normalizeProject(nextProject), future: [] }; }
  function undo(history) { if (!history.past.length) return history; return { past: history.past.slice(0, -1), present: normalizeProject(history.past.at(-1)), future: [clone(history.present), ...history.future].slice(0, LIMITS.history) }; }
  function redo(history) { if (!history.future.length) return history; return { past: [...history.past, clone(history.present)].slice(-LIMITS.history), present: normalizeProject(history.future[0]), future: history.future.slice(1) }; }

  return Object.freeze({ LIMITS, createProject, normalizeProject, snapTime, applyTimelineOperation, addSubtitle, createNestedSequence, planProxy, createWaveformEnvelope, addKeyframe, setMulticam, setMotionModel, updateColor, updateAudioChannel, enqueueExport, updateExportStatus, recoverInterruptedExports, createHistory, commitHistory, undo, redo });
});

(() => {
  if (typeof window === "undefined") return;

  const base = window.HHMediaDesign;
  if (!base) return;
  const resolveOps = window.HHVideoEditorResolveOps;

  const TOOL = "Video Editor";
  const STORE_KEY = "hh.resolve-web-studio.v1";
  const $ = (root, selector) => root?.querySelector(selector);
  const $$ = (root, selector) => [...(root?.querySelectorAll(selector) || [])];
  const clamp = (value, min, max) => Math.min(max, Math.max(min, Number(value) || 0));
  const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
  const clean = (value, max = 120) => String(value ?? "").replace(/[<>\u0000-\u001f]/g, " ").trim().slice(0, max);
  const uid = (prefix) => `${prefix}-${crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`}`;
  const icon = (name) => `<i data-lucide="${name}"></i>`;
  const pages = [
    ["media", "Media", "Kho media", "folder-kanban", "Shift+1"],
    ["cut", "Cut", "Cắt nhanh", "scissors", "Shift+2"],
    ["edit", "Edit", "Biên tập", "film", "Shift+3"],
    ["fusion", "Fusion", "Hiệu ứng", "git-merge", "Shift+4"],
    ["color", "Color", "Màu sắc", "palette", "Shift+5"],
    ["audio", "Audio", "Âm thanh", "audio-lines", "Shift+6"],
    ["deliver", "Deliver", "Xuất bản", "send", "Shift+7"]
  ];
  const defaults = {
    page: "edit",
    proxy: false,
    grade: { exposure: 0, contrast: 100, saturation: 100, temperature: 0, tint: 0, lift: 0, gamma: 0, gain: 0, highlights: 0, shadows: 0, blur: 0, sharpen: 0 },
    audio: { master: 100, pan: 0, low: 0, mid: 0, high: 0, threshold: -24, muted: false, solo: false, armed: false },
    nodes: [
      { id: "media-in", name: "MediaIn1", type: "input", enabled: true },
      { id: "color-corrector", name: "ColorCorrector1", type: "color", enabled: true },
      { id: "media-out", name: "MediaOut1", type: "output", enabled: true }
    ],
    selectedNode: "color-corrector",
    multicam: false,
    keyframes: [],
    queue: [],
    bins: ["Master", "Video", "Âm thanh", "Đồ họa"],
    selectedBin: "Master",
    pro: resolveOps.createProject()
  };
  const state = {
    root: null,
    outer: null,
    workspace: null,
    stage: null,
    panels: {},
    page: defaults.page,
    data: structuredClone(defaults),
    observers: [],
    scopeFrame: 0,
    restoreFrame: 0,
    meterFrame: 0,
    audio: null,
    micRecorder: null,
    micStream: null,
    micChunks: [],
    proHistory: resolveOps.createHistory(defaults.pro),
    timer: 0,
    scopeTimer: 0,
    exportListener: null,
    keyListener: null,
    lifecycle: 0,
    micRequest: 0,
    micPending: false,
    exportJobId: "",
    stillBusy: false,
    lastQueueAt: 0,
    pageScroll: {},
    urls: new Set(),
    urlTimers: new Set()
  };

  function load() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORE_KEY) || "{}"), saved = parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
      const grade = {}, gradeBounds = { exposure: [-100, 100], contrast: [0, 260], saturation: [0, 300], temperature: [-100, 100], tint: [-100, 100], lift: [-100, 100], gamma: [-100, 100], gain: [-100, 100], highlights: [-100, 100], shadows: [-100, 100], blur: [0, 12], sharpen: [0, 100] };
      Object.entries(defaults.grade).forEach(([key, fallback]) => { grade[key] = clamp(saved.grade?.[key] ?? fallback, ...gradeBounds[key]); });
      const audio = { master: clamp(saved.audio?.master ?? 100, 0, 150), pan: clamp(saved.audio?.pan, -100, 100), low: clamp(saved.audio?.low, -18, 18), mid: clamp(saved.audio?.mid, -18, 18), high: clamp(saved.audio?.high, -18, 18), threshold: clamp(saved.audio?.threshold ?? -24, -60, 0), muted: Boolean(saved.audio?.muted), solo: Boolean(saved.audio?.solo), armed: false };
      const nodeIds = new Set(), nodes = (Array.isArray(saved.nodes) ? saved.nodes : defaults.nodes).slice(0, resolveOps.LIMITS.nodes).map((value, index) => { const node = value && typeof value === "object" ? value : {}, baseId = clean(node.id || `node-${index + 1}`, 80) || `node-${index + 1}`; let id = baseId, suffix = 2; while (nodeIds.has(id)) { id = `${baseId}-${suffix}`; suffix += 1; } nodeIds.add(id); return { id, name: clean(node.name || `Node ${index + 1}`, 100), type: clean(node.type || "effect", 40), enabled: node.enabled !== false }; });
      if (!nodes.length) nodes.push(...structuredClone(defaults.nodes));
      const pro = resolveOps.recoverInterruptedExports(saved.pro || defaults.pro);
      state.data = {
        page: pages.some(([id]) => id === saved.page) ? saved.page : "edit",
        proxy: Boolean(saved.proxy), grade, audio, nodes,
        selectedNode: nodes.some((node) => node.id === saved.selectedNode) ? saved.selectedNode : nodes.find((node) => !["input", "output"].includes(node.type))?.id || nodes[0].id,
        multicam: pro.multicam.enabled,
        keyframes: (Array.isArray(saved.keyframes) ? saved.keyframes : []).slice(-80).map((item, index) => ({ id: clean(item?.id || `keyframe-${index + 1}`, 80), timecode: clean(item?.timecode || "00:00:00:00", 16), time: clamp(item?.time, 0, 86400), x: clamp(item?.x, -100000, 100000), y: clamp(item?.y, -100000, 100000), scale: clamp(item?.scale ?? 100, 0, 10000), rotation: clamp(item?.rotation, -36000, 36000), opacity: clamp(item?.opacity ?? 100, 0, 100), volume: clamp(item?.volume ?? 100, 0, 150), speed: clamp(item?.speed ?? 100, 5, 800) })),
        queue: [],
        bins: [...defaults.bins],
        selectedBin: defaults.bins.includes(saved.selectedBin) ? saved.selectedBin : defaults.selectedBin,
        pro
      };
      state.page = saved.page === "fairlight" ? "audio" : pages.some(([id]) => id === saved.page) ? saved.page : "edit";
      state.proHistory = resolveOps.createHistory(state.data.pro);
    } catch {
      state.data = structuredClone(defaults);
      state.page = "edit";
      state.proHistory = resolveOps.createHistory(state.data.pro);
    }
  }

  function save() {
    state.data.page = state.page;
    state.data.pro = resolveOps.normalizeProject(state.data.pro);
    if (state.proHistory) state.proHistory.present = state.data.pro;
    try { localStorage.setItem(STORE_KEY, JSON.stringify(state.data)); return true; }
    catch (_) { const node = $(state.root, ".vr-project-state small"); if (node) { node.textContent = "Không thể tự động lưu"; node.dataset.state = "error"; } return false; }
  }

  function commitPro(next, message = "Đã cập nhật timeline chuyên nghiệp.") {
    const before = JSON.stringify(state.proHistory.present), after = JSON.stringify(resolveOps.normalizeProject(next));
    if (before === after) { status("Không có thay đổi hợp lệ để áp dụng.", "info"); return false; }
    state.proHistory = resolveOps.commitHistory(state.proHistory, next);
    state.data.pro = state.proHistory.present;
    save();
    renderProSummary();
    status(message, "success");
    return true;
  }

  function undoPro(direction) {
    if (direction === "redo" ? !state.proHistory.future.length : !state.proHistory.past.length) return status(direction === "redo" ? "Không có thao tác để làm lại." : "Không có thao tác để hoàn tác.", "info");
    state.proHistory = direction === "redo" ? resolveOps.redo(state.proHistory) : resolveOps.undo(state.proHistory);
    state.data.pro = state.proHistory.present;
    save();
    renderProSummary();
    status(direction === "redo" ? "Đã làm lại thao tác Pro." : "Đã hoàn tác thao tác Pro.", "success");
  }

  function status(message, kind = "info") {
    const node = $(state.root, "[data-ve-status]");
    if (node) {
      node.textContent = message;
      node.dataset.state = kind;
    }
    const toast = $(state.root, "[data-vr-toast]");
    if (!toast) return;
    toast.textContent = message;
    toast.dataset.kind = kind;
    toast.hidden = false;
    clearTimeout(state.timer);
    const lifecycle = state.lifecycle;
    state.timer = setTimeout(() => { if (state.lifecycle === lifecycle && toast.isConnected) toast.hidden = true; }, 2600);
  }

  function clickBase(selector) {
    const node = $(state.root, selector);
    if (node) node.click();
    return Boolean(node);
  }

  function setActionLabel(id, label, title = label) {
    $$ (state.root, `[data-ve-action="${id}"]`).forEach((button) => {
      const span = $(button, "span");
      if (span) span.textContent = label;
      button.title = title;
    });
  }

  function localize() {
    state.root.lang = "vi";
    const brand = $(state.root, ".ve-brand");
    if (brand) brand.innerHTML = `${icon("clapperboard")}<b>HH</b><span>Resolve Web Studio</span>`;
    const menuLabels = ["Tệp", "Chỉnh sửa", "Clip", "Timeline", "Dấu mốc", "Tiêu đề", "Cửa sổ", "Trợ giúp"];
    $$(state.root, ".ve-menu>summary").forEach((node, index) => { node.textContent = menuLabels[index] || node.textContent; });
    const labels = {
      new: "Dự án mới", import: "Nhập media", "project-open": "Mở dự án JSON", save: "Lưu dự án", "project-export": "Xuất dự án JSON",
      render: "Xuất video", undo: "Hoàn tác", redo: "Làm lại", duplicate: "Nhân đôi", delete: "Xóa", split: "Cắt tại đầu phát",
      "trim-start": "Cắt đầu tới đầu phát", "trim-end": "Cắt cuối tới đầu phát", speed: "Tốc độ và thời lượng", "sequence-start": "Về đầu timeline",
      "sequence-end": "Tới cuối timeline", marker: "Thêm dấu mốc", "marker-clear": "Xóa mọi dấu mốc", title: "Thêm tiêu đề", caption: "Thêm phụ đề",
      fullscreen: "Toàn màn hình", "reset-layout": "Khôi phục bố cục", shortcuts: "Phím tắt", about: "Giới thiệu", "prev-edit": "Điểm cắt trước",
      "next-edit": "Điểm cắt sau", "step-back": "Lùi một khung hình", "step-forward": "Tiến một khung hình", play: "Phát hoặc tạm dừng",
      "ripple-delete": "Xóa và dồn khoảng trống", normalize: "Chuẩn hóa âm lượng", "reset-motion": "Đặt lại chuyển động", "dialog-close": "Đóng"
    };
    Object.entries(labels).forEach(([id, label]) => setActionLabel(id, label));
    const exportButton = $(state.root, ".ve-export");
    if (exportButton) exportButton.innerHTML = `${icon("send")}<span>Xuất nhanh</span>`;
    const toolbarLabels = $$(state.root, ".ve-toolbar>label");
    if (toolbarLabels[0]) toolbarLabels[0].childNodes[0].textContent = "Không gian ";
    if (toolbarLabels[1]) toolbarLabels[1].childNodes[0].textContent = "Timeline ";
    if (toolbarLabels[2]) toolbarLabels[2].lastChild.textContent = " Bám dính";
    const workspace = $(state.root, "[data-ve-workspace]");
    if (workspace) ["Biên tập", "Màu sắc", "Âm thanh", "Đồ họa"].forEach((label, index) => { if (workspace.options[index]) workspace.options[index].textContent = label; });
    const panelTabs = $$(state.root, "[data-ve-panel-tab]");
    ["Kho media", "Hiệu ứng", "Âm thanh"].forEach((label, index) => { if (panelTabs[index]) panelTabs[index].textContent = label; });
    const inspectorTabs = $$(state.root, "[data-ve-inspector-tab]");
    ["Thanh tra", "Tiêu đề", "Siêu dữ liệu"].forEach((label, index) => { if (inspectorTabs[index]) inspectorTabs[index].textContent = label; });
    const monitorTabs = $$(state.root, "[data-ve-monitor-tab]");
    if (monitorTabs[0]) monitorTabs[0].textContent = "Nguồn";
    if (monitorTabs[1]) monitorTabs[1].childNodes[0].textContent = "Timeline: ";
    const empty = $(state.root, "[data-ve-empty]");
    if (empty) empty.innerHTML = `${icon("film")}<strong>Màn hình chương trình</strong><span>Nhập media hoặc kéo clip vào timeline</span><button data-ve-action="import">Nhập media</button>`;
    const search = $(state.root, "[data-ve-search]");
    if (search) search.placeholder = "Tìm trong dự án";
    const effectSearch = $(state.root, "[data-ve-effect-search]");
    if (effectSearch) effectSearch.placeholder = "Tìm hiệu ứng";
    const effects = { none: "Đặt lại", cinema: "Điện ảnh", vivid: "Rực rỡ", mono: "Đen trắng", warm: "Tông ấm", cool: "Tông lạnh", blur: "Làm mờ Gaussian", fade: "Mờ dần về đen" };
    Object.entries(effects).forEach(([id, label]) => { const span = $(state.root, `[data-ve-effect="${id}"] span`); if (span) span.textContent = label; });
    const propertyHeadings = $$(state.root, ".ve-properties form>section header strong");
    ["Chuyển động", "Độ trong suốt", "Ánh xạ thời gian", "Âm lượng"].forEach((label, index) => { if (propertyHeadings[index]) propertyHeadings[index].textContent = label; });
    const noClip = $(state.root, "[data-ve-properties-empty]");
    if (noClip) noClip.innerHTML = "<strong>Chưa chọn clip</strong><span>Hãy chọn một clip trên timeline để chỉnh sửa.</span>";
    const ruler = $(state.root, ".ve-ruler-head");
    if (ruler) ruler.textContent = "Rãnh";
    const foot = $(state.root, "[data-ve-status]");
    if (foot) foot.textContent = "Sẵn sàng · tệp được xử lý riêng tư trên thiết bị";
    const shortcutDialog = $(state.root, '[data-ve-dialog="shortcuts"]');
    if (shortcutDialog) {
      $(shortcutDialog, "header strong").textContent = "Phím tắt bàn dựng";
      $(shortcutDialog, "header span").textContent = "Tương thích luồng dựng chuyên nghiệp";
      const shortcutLabels = ["Phát / tạm dừng", "Công cụ chọn", "Dao cắt", "Cắt tại đầu phát", "Đánh dấu In / Out", "Thêm dấu mốc", "Phát lùi / dừng / phát tới", "Lùi / tiến khung hình", "Điểm cắt trước / sau", "Đầu / cuối timeline", "Hoàn tác", "Làm lại", "Xóa clip", "Xóa và dồn", "Nhân đôi clip", "Lưu dự án", "Xuất video", "Thu phóng timeline"];
      $$(shortcutDialog, ".ve-shortcuts span").forEach((row, index) => { const key = $(row, "kbd"); row.lastChild.textContent = shortcutLabels[index] || row.lastChild.textContent; if (key) row.prepend(key); });
    }
    const exportDialog = $(state.root, '[data-ve-dialog="export"]');
    if (exportDialog) {
      $(exportDialog, "header strong").textContent = "Xuất video";
      $(exportDialog, "header span").textContent = "Kết xuất timeline theo thời gian thực";
      const labels = $$(exportDialog, ".ve-export-settings>label");
      ["Tên tệp", "Định dạng", "Độ phân giải", "Bitrate video"].forEach((label, index) => { if (labels[index]) labels[index].childNodes[0].textContent = label; });
      const note = $(exportDialog, ".ve-export-settings p");
      if (note) {
        const mp4Ready = Boolean(window.HHVideoExport?.mp4Supported?.());
        note.textContent = mp4Ready
          ? "MP4 H.264/AAC và WebM được kết xuất thật trên thiết bị. Giữ tab này hoạt động trong lúc xuất."
          : "Thiết bị chưa hỗ trợ MP4 qua MediaRecorder; WebM vẫn khả dụng nếu codec được trình duyệt cung cấp.";
        note.dataset.state = mp4Ready ? "ready" : "unsupported";
      }
      const buttons = $$(exportDialog, "footer button");
      if (buttons[0]) buttons[0].textContent = "Hủy";
      if (buttons[1]) buttons[1].textContent = "Bắt đầu xuất";
    }
  }

  function timecodeSeconds() {
    const parts = ($(state.root, "[data-ve-timecode]")?.textContent || "00:00:00:00").split(":").map(Number);
    return (parts[0] || 0) * 3600 + (parts[1] || 0) * 60 + (parts[2] || 0) + (parts[3] || 0) / (state.data.pro.fps || 30);
  }

  function selectedModelClip() {
    const node = $(state.root, ".ve-clip.is-selected[data-ve-clip]");
    if (!node) return null;
    const id = node.dataset.veClip;
    let clip = state.data.pro.clips.find((item) => item.id === id);
    if (!clip) {
      const zoom = Math.max(1, Number($(state.root, "[data-ve-zoom]")?.value) || 18);
      const start = (parseFloat(node.style.left) || 0) / zoom;
      const duration = Math.max(1 / state.data.pro.fps, (parseFloat(node.style.width) || 90) / zoom);
      const next = resolveOps.applyTimelineOperation(state.data.pro, { type: "add-clip", clip: { id, name: $(node, "b")?.textContent || "Clip", track: node.dataset.veClipTrack || "V1", start, duration, sourceDuration: Math.max(duration, 3600) } });
      state.proHistory = resolveOps.commitHistory(state.proHistory, next);
      state.data.pro = state.proHistory.present;
      clip = state.data.pro.clips.find((item) => item.id === id);
      save();
    }
    return clip;
  }

  function renderProSummary() {
    if (!state.root) return;
    const project = state.data.pro;
    const values = {
      tracks: `${project.tracks.length} rãnh`, clips: `${project.clips.length} clip`, subtitles: `${project.subtitles.length} phụ đề`, nested: `${project.nestedSequences.length} sequence lồng`,
      snap: project.snap.enabled ? "Bám dính bật" : "Bám dính tắt", proxy: project.proxyPlan.enabled ? "Proxy kế hoạch" : "Media nguồn",
      revision: `Bản sửa ${project.revision}`, undo: state.proHistory.past.length, redo: state.proHistory.future.length
    };
    Object.entries(values).forEach(([key, value]) => { const node = $(state.root, `[data-vr-summary="${key}"]`); if (node) node.textContent = value; });
    $$(state.root, '[data-vr-action="timeline-snap"]').forEach((button) => button.classList.toggle("is-active", project.snap.enabled));
    const proxy = $(state.root, '[data-vr-action="proxy"]'); if (proxy) proxy.classList.toggle("is-active", project.proxyPlan.enabled);
    const undo = $(state.root, '[data-vr-action="pro-undo"]'); if (undo) undo.disabled = !state.proHistory.past.length;
    const redo = $(state.root, '[data-vr-action="pro-redo"]'); if (redo) redo.disabled = !state.proHistory.future.length;
  }

  function editRibbonMarkup() {
    return `<section class="vr-edit-ribbon" data-vr-edit-ribbon aria-label="Công cụ dựng chuyên nghiệp">
      <div class="vr-edit-ribbon__group"><strong>Dựng hình</strong>
        <button type="button" data-vr-action="timeline-blade" title="Cắt clip tại đầu phát (B)">${icon("scissors")}<span>Dao cắt</span><kbd>B</kbd></button>
        <button type="button" data-vr-action="timeline-ripple" title="Xóa và dồn khoảng trống">${icon("between-horizontal-end")}<span>Ripple</span></button>
        <button type="button" data-vr-action="timeline-slip-back" title="Trượt nội dung nguồn lùi một giây">${icon("step-back")}<span>Slip -1s</span></button>
        <button type="button" data-vr-action="timeline-slip-forward" title="Trượt nội dung nguồn tiến một giây">${icon("step-forward")}<span>Slip +1s</span></button>
        <button type="button" data-vr-action="timeline-slide-back" title="Trượt clip và điều chỉnh hai clip kề">${icon("move-left")}<span>Slide -1s</span></button>
        <button type="button" data-vr-action="timeline-slide-forward" title="Trượt clip và điều chỉnh hai clip kề">${icon("move-right")}<span>Slide +1s</span></button>
        <button type="button" data-vr-action="timeline-trim-start" title="Cắt đầu clip tới đầu phát">${icon("panel-left-close")}<span>Trim In</span></button>
        <button type="button" data-vr-action="timeline-trim-end" title="Cắt cuối clip tới đầu phát">${icon("panel-right-close")}<span>Trim Out</span></button>
        <button type="button" data-vr-action="timeline-duplicate" title="Nhân đôi clip đang chọn">${icon("copy-plus")}<span>Nhân đôi</span></button>
        <button type="button" data-vr-action="timeline-track-lock" title="Khóa hoặc mở khóa rãnh đang chọn">${icon("lock-keyhole")}<span>Khóa rãnh</span></button>
        <button type="button" data-vr-action="timeline-snap" title="Bật hoặc tắt bám dính">${icon("magnet")}<span data-vr-summary="snap">Bám dính bật</span><kbd>N</kbd></button>
      </div>
      <div class="vr-edit-ribbon__group"><strong>Cấu trúc</strong>
        <button type="button" data-vr-action="subtitle-add">${icon("subtitles")}<span>Phụ đề</span></button>
        <button type="button" data-vr-action="nested-create">${icon("layers-3")}<span>Sequence lồng</span></button>
        <button type="button" data-vr-action="pro-multicam">${icon("layout-grid")}<span>Multicam</span></button>
      </div>
      <div class="vr-edit-ribbon__group"><strong>Chuyển động</strong>
        <button type="button" data-vr-action="motion-track">${icon("scan-search")}<span>Tracking</span></button>
        <button type="button" data-vr-action="motion-stabilize">${icon("focus")}<span>Ổn định</span></button>
        <button type="button" data-vr-action="motion-ramp">${icon("gauge")}<span>Speed Ramp</span></button>
        <button type="button" data-vr-action="pro-keyframes">${icon("diameter")}<span>Keyframe</span></button>
      </div>
      <div class="vr-edit-history"><button type="button" data-vr-action="pro-undo" title="Hoàn tác mô hình Pro">${icon("undo-2")}<span data-vr-summary="undo">0</span></button><button type="button" data-vr-action="pro-redo" title="Làm lại mô hình Pro">${icon("redo-2")}<span data-vr-summary="redo">0</span></button></div>
      <div class="vr-edit-summary" role="status"><span data-vr-summary="tracks">3 rãnh</span><span data-vr-summary="clips">0 clip</span><span data-vr-summary="subtitles">0 phụ đề</span><span data-vr-summary="nested">0 sequence lồng</span><span data-vr-summary="proxy">Media nguồn</span><span data-vr-summary="revision">Bản sửa 0</span></div>
    </section>`;
  }

  function shellMarkup() {
    return `<div class="vr-commandbar">
      <div class="vr-project-state"><span></span><b>Dự án cục bộ</b><small>Tự động lưu</small></div>
      <div class="vr-commandbar__center"><b data-vr-page-title>Biên tập</b><span data-vr-page-help>Timeline nhiều rãnh và bộ công cụ dựng chính xác</span></div>
      <div class="vr-commandbar__actions">
        <details class="vr-pro-menu"><summary>${icon("wrench")}<span>Công cụ Pro</span></summary><div>
          <button type="button" data-vr-action="pro-multicam">${icon("layout-grid")} Multicam Viewer</button>
          <button type="button" data-vr-action="pro-keyframes">${icon("diameter")} Keyframe Editor</button>
          <button type="button" data-vr-action="pro-caption">${icon("subtitles")} Thêm phụ đề</button>
          <button type="button" data-vr-action="pro-speed">${icon("gauge")} Speed Ramp 150%</button>
          <button type="button" data-vr-action="pro-stabilize">${icon("focus")} Ổn định hình</button>
          <button type="button" data-vr-action="pro-scopes">${icon("chart-no-axes-combined")} Video Scopes</button>
          <button type="button" data-vr-action="pro-audio">${icon("audio-lines")} Sửa âm thanh</button>
          <button type="button" data-vr-action="pro-media">${icon("folder-kanban")} Media Management</button>
        </div></details>
        <button type="button" data-vr-action="proxy">${icon("gauge")}<span>Proxy</span></button>
        <button type="button" data-vr-action="inspector">${icon("panel-right")}<span>Thanh tra</span></button>
        <button class="is-primary" type="button" data-vr-action="quick-export">${icon("send")}<span>Xuất nhanh</span></button>
      </div>
    </div>${editRibbonMarkup()}
    <section class="vr-stage" data-vr-stage hidden></section>
    <aside class="vr-pro-drawer" data-vr-pro-drawer hidden><header><div>${icon("diameter")}<span><strong>Keyframe Editor</strong><small>Transform · Opacity · Speed</small></span></div><button data-vr-action="pro-close">${icon("x")}</button></header><div class="vr-keyframe-toolbar"><button data-vr-action="pro-keyframe-add">${icon("diamond-plus")} Thêm keyframe</button><button data-vr-action="pro-keyframe-delete">${icon("trash-2")} Xóa cuối</button><span>Đầu phát hiện tại: <b data-vr-keyframe-time>00:00:00:00</b></span></div><div class="vr-keyframe-track" data-vr-keyframes></div></aside>
    <nav class="vr-page-dock" aria-label="Các trang biên tập">
      ${pages.map(([id, english, vietnamese, iconName, shortcut]) => `<button type="button" data-vr-page="${id}" title="${vietnamese} (${shortcut})">${icon(iconName)}<span>${english}</span><small>${vietnamese}</small></button>`).join("")}
    </nav>
    <div class="vr-toast" data-vr-toast hidden></div>`;
  }

  function restorePanels() {
    const { project, monitor, properties, timeline } = state.panels;
    [project, monitor, properties, timeline].forEach((panel) => { if (panel) state.workspace.append(panel); });
    [project, monitor, properties, timeline].forEach((panel) => { if (panel) panel.hidden = false; });
  }

  function slot(name, panel) {
    const host = $(state.stage, `[data-vr-slot="${name}"]`);
    if (host && panel) host.append(panel);
  }

  function mediaBinKind(bin) {
    const index = state.data.bins.indexOf(bin);
    return index === 1 ? "video" : index === 2 ? "audio" : index === 3 ? "image" : index === 0 ? "all" : "custom";
  }

  function applyMediaBinFilter() {
    const kind = mediaBinKind(state.data.selectedBin);
    let visible = 0;
    $$(state.root, "[data-ve-asset]").forEach((asset) => {
      const show = kind === "all" || asset.dataset.assetKind === kind;
      asset.hidden = !show;
      if (show) visible += 1;
    });
    const count = $(state.root, "[data-ve-asset-count]");
    if (count) count.textContent = `${visible} / ${$$(state.root, "[data-ve-asset]").length} media`;
  }

  function mediaPage() {
    const counts = { all: $$(state.root, "[data-ve-asset]").length, video: $$(state.root, '[data-asset-kind="video"]').length, audio: $$(state.root, '[data-asset-kind="audio"]').length, image: $$(state.root, '[data-asset-kind="image"]').length, custom: 0 };
    const bins = state.data.bins.map((bin) => {
      const kind = mediaBinKind(bin);
      return `<button class="${state.data.selectedBin === bin ? "is-active" : ""}" data-vr-bin="${esc(bin)}">${icon(kind === "all" ? "folder-open" : "folder")}<span>${esc(bin)}</span><b>${counts[kind] || 0}</b></button>`;
    }).join("");
    return `<div class="vr-media-layout">
      <aside class="vr-bins"><header><strong>Nhóm media</strong><span>${icon("folders")} Smart bins</span></header>${bins}<section><strong>Lọc nhanh theo loại media</strong><small>Video, âm thanh và hình ảnh dùng các bin có số lượng thật ở trên.</small></section></aside>
      <div class="vr-slot vr-slot--project" data-vr-slot="project"></div>
      <div class="vr-slot vr-slot--monitor" data-vr-slot="monitor"></div>
      <aside class="vr-media-info"><header><strong>Chuẩn bị media</strong><span>LOCAL</span></header>
        <button class="vr-drop-import" data-ve-action="import">${icon("upload-cloud")}<strong>Nhập từ máy tính hoặc điện thoại</strong><small>Video, audio và hình ảnh được giữ trên thiết bị</small></button>
        <div class="vr-info-grid"><span>Đồng bộ A/V<b>Web Audio waveform</b></span><span>Proxy<b data-vr-proxy-state>Media nguồn</b></span><span>Color space<b>Rec.709</b></span><span>Frame rate<b>${state.data.pro.fps} fps</b></span></div>
        <div class="vr-proxy-plan" data-vr-proxy-plan><strong>${icon("gauge")} Kế hoạch proxy cục bộ</strong><span>${esc(state.data.pro.proxyPlan.notice)}</span><small>Không thay codec hoặc tệp nguồn nếu trình duyệt không hỗ trợ.</small></div>
        <button data-vr-action="sync-media">${icon("refresh-cw")} Phân tích điểm đồng bộ A/V</button><button data-vr-action="analyze-media">${icon("scan-search")} Đọc metadata trên thiết bị</button>
      </aside>
    </div>`;
  }

  function cutPage() {
    return `<div class="vr-cut-layout">
      <div class="vr-cut-tools"><strong>Cắt nhanh</strong><button data-vr-action="source-tape">${icon("library")} Source Tape</button><button data-vr-action="append">${icon("list-end")} Nối cuối</button><button data-vr-action="timeline-blade">${icon("scissors")} Blade</button><button data-vr-action="timeline-ripple">${icon("between-horizontal-end")} Ripple</button><button data-vr-action="timeline-slip-back">${icon("step-back")} Slip</button><button data-vr-action="timeline-slide-forward">${icon("move-right")} Slide</button><button data-vr-action="timeline-snap">${icon("magnet")} Snapping</button><button data-vr-action="transition">${icon("blend")} Chuyển cảnh</button><button data-vr-action="smart-reframe">${icon("scan")} Auto Reframe</button></div>
      <div class="vr-slot vr-slot--project" data-vr-slot="project"></div><div class="vr-slot vr-slot--monitor" data-vr-slot="monitor"></div><div class="vr-slot vr-slot--timeline" data-vr-slot="timeline"></div>
    </div>`;
  }

  function fusionPage() {
    return `<div class="vr-fusion-layout">
      <aside class="vr-fusion-library"><header><strong>Thư viện nút</strong><small>Kéo hoặc bấm để thêm</small></header>
        ${[["blur","Làm mờ","droplets"],["color","Hiệu chỉnh màu","palette"],["transform","Biến đổi","move-3d"],["text","Text+","type"],["glow","Phát sáng","sparkles"],["mask","Mặt nạ","scan"],["merge","Trộn lớp","git-merge"],["keyer","Tách nền","wand-sparkles"]].map(([id,label,name]) => `<button data-vr-action="add-node" data-node-type="${id}">${icon(name)}<span>${label}</span></button>`).join("")}
      </aside>
      <section class="vr-fusion-center"><div class="vr-slot vr-slot--monitor" data-vr-slot="monitor"></div><div class="vr-node-toolbar"><button data-vr-action="node-delete">${icon("trash-2")} Xóa</button><button data-vr-action="node-duplicate">${icon("copy")} Nhân đôi</button><button data-vr-action="node-toggle">${icon("power")} Bật/tắt</button><button data-vr-action="node-organize">${icon("layout-grid")} Sắp xếp</button><span>Đồ thị nút xử lý theo thứ tự từ trái sang phải</span></div><div class="vr-node-graph" data-vr-node-graph></div></section>
      <aside class="vr-fusion-inspector"><header><strong>Thanh tra Fusion</strong><span>2D</span></header><div data-vr-node-inspector></div></aside>
    </div>`;
  }

  function rangeControl(id, label, min, max, step = 1, suffix = "") {
    const value = state.data.grade[id];
    return `<label><span>${label}<b data-vr-grade-value="${id}">${value}${suffix}</b></span><input type="range" min="${min}" max="${max}" step="${step}" value="${value}" data-vr-grade="${id}"></label>`;
  }

  function colorPage() {
    return `<div class="vr-color-layout">
      <aside class="vr-gallery"><header><strong>Gallery</strong><button data-vr-action="save-still">${icon("camera")} Lưu still</button></header><div data-vr-stills><button data-vr-action="apply-look" data-look="cinema"><i class="look-cinema"></i><span>Điện ảnh</span></button><button data-vr-action="apply-look" data-look="warm"><i class="look-warm"></i><span>Tông ấm</span></button><button data-vr-action="apply-look" data-look="cool"><i class="look-cool"></i><span>Tông lạnh</span></button><button data-vr-action="apply-look" data-look="mono"><i class="look-mono"></i><span>Đen trắng</span></button></div></aside>
      <section class="vr-color-view"><div class="vr-slot vr-slot--monitor" data-vr-slot="monitor"></div><div class="vr-scopes"><article><header>Waveform</header><canvas width="340" height="120" data-vr-scope="waveform"></canvas></article><article><header>Histogram RGB</header><canvas width="340" height="120" data-vr-scope="histogram"></canvas></article></div></section>
      <aside class="vr-color-nodes"><header><strong>Nút màu</strong><button data-vr-action="auto-color">${icon("wand-sparkles")} Cân bằng cục bộ</button></header>${state.data.pro.color.nodes.map((node, index) => `<button class="${index === 0 ? "is-active" : ""}"><span>${String(index + 1).padStart(2, "0")}</span><b>${esc(node.type)}</b><small>${node.enabled ? "Đang bật" : "Đã bỏ qua"}</small></button>`).join("")}<button data-vr-action="add-serial-node"><span>+</span><b>Thêm nút nối tiếp</b><small>Alt+S</small></button></aside>
      <section class="vr-color-controls"><header><div><strong>Primary Wheels</strong><span>DaVinci YRGB</span></div><button data-vr-action="grade-reset">Đặt lại</button><button data-vr-action="copy-grade">Sao chép màu</button></header>
        <div class="vr-wheels">${[["lift","Lift","#78b9d9"],["gamma","Gamma","#cf8cc8"],["gain","Gain","#e0c276"],["exposure","Offset","#91d3a2"]].map(([id,label,color]) => `<label style="--wheel:${color}"><i><span></span></i><b>${label}</b><input type="range" min="-100" max="100" value="${state.data.grade[id]}" data-vr-grade="${id}"><output data-vr-grade-value="${id}">${state.data.grade[id]}</output></label>`).join("")}</div>
        <div class="vr-grade-sliders"><label><span>LUT cục bộ<b>${esc(state.data.pro.color.lut)}</b></span><select data-vr-lut><option value="none">Không dùng LUT</option><option value="cinema">Cinema 709</option><option value="warm">Warm Film</option><option value="cool">Cool Night</option></select></label>${rangeControl("temperature","Nhiệt độ",-100,100)}${rangeControl("tint","Sắc độ",-100,100)}${rangeControl("contrast","Tương phản",0,200)}${rangeControl("saturation","Bão hòa",0,200)}${rangeControl("highlights","Vùng sáng",-100,100)}${rangeControl("shadows","Vùng tối",-100,100)}${rangeControl("blur","Làm mờ",0,12,.2,"px")}<div class="vr-curve-model"><strong>Curves</strong><svg viewBox="0 0 100 60" role="img" aria-label="Đường cong màu"><path d="M0 60 L100 0"></path>${state.data.pro.color.curves.map((point) => `<circle cx="${point.x * 100}" cy="${60 - point.y * 60}" r="2.5"></circle>`).join("")}</svg><button data-vr-action="curve-contrast">S-Curve</button></div></div>
      </section>
      <div class="vr-slot vr-slot--timeline" data-vr-slot="timeline"></div>
    </div>`;
  }

  function audioControl(id, label, min, max, step = 1, suffix = "") {
    const value = state.data.audio[id];
    return `<label><span>${label}</span><input type="range" min="${min}" max="${max}" step="${step}" value="${value}" data-vr-audio="${id}"><b data-vr-audio-value="${id}">${value}${suffix}</b></label>`;
  }

  function audioPage() {
    return `<div class="vr-fairlight-layout">
      <div class="vr-fairlight-toolbar"><strong>Audio</strong><button data-vr-action="audio-record">${icon("circle-dot")} Thu âm</button><button data-vr-action="audio-normalize">${icon("activity")} Chuẩn hóa</button><button data-vr-action="audio-duck">${icon("mic-vocal")} Ducking</button><button data-vr-action="audio-noise">${icon("audio-waveform")} Giảm nhiễu</button><button data-vr-action="audio-fade">${icon("trending-down")} Fade</button><button data-vr-action="audio-automation">${icon("git-commit-horizontal")} Automation</button><span>Web Audio · 48 kHz khi nguồn hỗ trợ</span></div>
      <div class="vr-slot vr-slot--timeline" data-vr-slot="timeline"></div>
      <section class="vr-mixer"><header><strong>Mixer</strong><span>Bus 1</span></header>
        <article class="vr-channel"><div><b>A1</b><small>Timeline Audio</small></div><canvas width="38" height="168" data-vr-meter></canvas>${audioControl("master","Fader",0,150,1,"%")}${audioControl("pan","Pan",-100,100)}<div class="vr-channel-buttons"><button data-vr-action="audio-mute">M</button><button data-vr-action="audio-solo">S</button><button data-vr-action="audio-arm">R</button></div></article>
        <article class="vr-channel vr-channel--eq"><header><b>EQ và Dynamics</b><button data-vr-action="eq-reset">Đặt lại</button></header>${audioControl("low","Low",-18,18,.5," dB")}${audioControl("mid","Mid",-18,18,.5," dB")}${audioControl("high","High",-18,18,.5," dB")}${audioControl("threshold","Compressor",-60,0,1," dB")}</article>
        <article class="vr-audio-fx"><header><strong>Audio FX cục bộ</strong></header><button data-vr-action="audio-noise">Noise Reduction<small>EQ + bộ lọc Web Audio, không phải AI isolation</small></button><button data-vr-action="audio-deesser">De-Esser<small>Giảm dải cao bằng EQ</small></button><button data-vr-action="audio-hum">Hum Remover<small>Lọc dải tần thấp</small></button><button data-vr-action="audio-limiter">Compressor<small>Giới hạn đỉnh âm thanh</small></button><div class="vr-automation-lane"><strong>Automation</strong><span>${state.data.pro.audio.channels[0]?.automation.length || 0} điểm</span><i></i></div></article>
      </section>
      <div class="vr-slot vr-slot--monitor" data-vr-slot="monitor"></div>
    </div>`;
  }

  function deliverPage() {
    const labels = { queued: "Đã xếp hàng", processing: "Đang xử lý", completed: "Hoàn tất", failed: "Thất bại", cancelled: "Đã hủy", unsupported: "Không hỗ trợ", "provider-not-configured": "Chưa cấu hình" };
    const queue = state.data.pro.exportQueue.map((job) => `<article data-vr-job="${job.id}"><span class="${job.status}" style="--progress:${job.progress || 0}%"></span><div><strong>${esc(job.name)}</strong><small>${esc(job.mime)} · ${esc(job.size)} · ${Math.round((job.bitrate || 0) / 1000000)} Mbps<br>${esc(job.notice)}</small></div><b>${labels[job.status] || "Chờ"}${job.status === "processing" ? ` · ${Math.round(job.progress || 0)}%` : ""}</b><div class="vr-job-actions">${["failed", "cancelled"].includes(job.status) ? `<button data-vr-action="queue-retry" data-job-id="${job.id}" title="Thử lại">${icon("rotate-cw")}</button>` : ""}${job.status === "processing" ? `<button data-vr-action="queue-cancel" data-job-id="${job.id}" title="Hủy kết xuất">${icon("square")}</button>` : `<button data-vr-action="queue-remove" data-job-id="${job.id}" title="Xóa khỏi hàng đợi">${icon("x")}</button>`}</div></article>`).join("") || `<div class="vr-queue-empty">${icon("list-video")}<strong>Hàng đợi đang trống</strong><span>Chỉ MediaRecorder + Canvas capture được hỗ trợ thật trên trình duyệt.</span></div>`;
    return `<div class="vr-deliver-layout">
      <section class="vr-deliver-settings"><header><strong>Cài đặt kết xuất</strong><span>Web Export</span></header>
        <div class="vr-render-presets"><button data-vr-preset="youtube">${icon("youtube")} YouTube 1080p</button><button data-vr-preset="vertical">${icon("smartphone")} TikTok / Reels</button><button data-vr-preset="archive">${icon("archive")} Master chất lượng cao</button></div>
        <label>Tên tệp<input data-vr-render-name value="hh-resolve-project"></label><label>Định dạng<select data-vr-render-format><option value="video/mp4;codecs=&quot;avc1.424028,mp4a.40.2&quot;">MP4 H.264 + AAC · trên thiết bị nếu hỗ trợ</option><option value="video/webm;codecs=vp9,opus">WebM VP9 + Opus · trên thiết bị</option><option value="video/webm;codecs=vp8,opus">WebM VP8 + Opus · trên thiết bị</option></select></label>
        <div class="vr-render-grid"><label>Độ phân giải<select data-vr-render-size><option value="1920x1080">1920 × 1080</option><option value="1280x720">1280 × 720</option><option value="1080x1920">1080 × 1920</option><option value="1080x1080">1080 × 1080</option></select></label><label>Bitrate<select data-vr-render-bitrate><option value="4000000">4 Mbps</option><option value="8000000" selected>8 Mbps</option><option value="12000000">12 Mbps</option></select></label></div>
        <label class="vr-check"><input type="checkbox" checked data-vr-render-audio> Xuất âm thanh</label><label class="vr-check"><input type="checkbox" checked data-vr-render-stream> Tối ưu phát trực tuyến</label><button class="is-primary" data-vr-action="queue-add">${icon("list-plus")} Thêm vào hàng đợi</button>
      </section>
      <div class="vr-slot vr-slot--monitor" data-vr-slot="monitor"></div>
      <aside class="vr-render-queue"><header><div><strong>Hàng đợi kết xuất</strong><span>${state.data.pro.exportQueue.length} tác vụ</span></div><button data-vr-action="queue-clear">Xóa hết</button></header><div data-vr-queue>${queue}</div><footer><p>MP4 H.264/AAC và WebM chỉ được xếp hàng khi MediaRecorder xác nhận codec thật trên thiết bị.</p><button class="is-primary" data-vr-action="queue-start">${icon("play")} Xuất tác vụ khả dụng</button></footer></aside>
    </div>`;
  }

  function capturePageView() {
    if (!state.stage || state.stage.hidden) return null;
    state.pageScroll[state.page] = { top: state.stage.scrollTop, left: state.stage.scrollLeft };
    const active = document.activeElement;
    if (!active || !state.stage.contains(active)) return null;
    for (const name of ["data-vr-action", "data-vr-preset", "data-look", "data-vr-bin", "data-job-id"]) if (active.hasAttribute?.(name)) return { name, value: active.getAttribute(name) };
    return null;
  }

  function restorePageView(page, focus) {
    cancelAnimationFrame(state.restoreFrame);
    const lifecycle = state.lifecycle;
    state.restoreFrame = requestAnimationFrame(() => {
      if (state.lifecycle !== lifecycle || !state.stage?.isConnected) return;
      const scroll = state.pageScroll[page] || { top: 0, left: 0 }; state.stage.scrollTop = scroll.top; state.stage.scrollLeft = scroll.left;
      if (focus) { const value = window.CSS?.escape ? window.CSS.escape(focus.value) : String(focus.value).replace(/[^a-z0-9_-]/gi, ""); $(state.stage, `[${focus.name}="${value}"]`)?.focus({ preventScroll: true }); }
    });
  }

  function renderPage(page) {
    if (!state.root) return;
    const previousPage = state.page, focus = capturePageView();
    state.page = pages.some(([id]) => id === page) ? page : "edit";
    if (previousPage === "audio" && state.page !== "audio" && state.micRecorder?.state === "recording") { try { state.micRecorder.stop(); } catch (_) {} status("Đã dừng microphone khi rời trang Âm thanh.", "info"); }
    if (previousPage === "audio" && state.page !== "audio" && state.audio?.context?.state === "running") state.audio.context.suspend?.().catch?.(() => {});
    restorePanels();
    state.root.dataset.vrPage = state.page;
    $$(state.root, "[data-vr-page]").forEach((button) => button.classList.toggle("is-active", button.dataset.vrPage === state.page));
    const config = pages.find(([id]) => id === state.page);
    $(state.root, "[data-vr-page-title]").textContent = config?.[2] || "Biên tập";
    const help = { media: "Nhập, phân loại, tìm kiếm và lập kế hoạch proxy", cut: "Source Tape, blade, ripple, slip, slide và snapping", edit: "Timeline đa rãnh, sequence lồng, multicam và keyframe", fusion: "Compositing theo nút, motion graphics và hiệu ứng", color: "Color wheels, curves, scopes, LUT và node effects", audio: "Mixer, EQ, compressor, giảm nhiễu và automation", deliver: "Preset, kiểm tra khả năng và hàng đợi xuất trung thực" };
    $(state.root, "[data-vr-page-help]").textContent = help[state.page];
    cancelAnimationFrame(state.scopeFrame); clearTimeout(state.scopeTimer);
    cancelAnimationFrame(state.meterFrame);
    if (state.page === "edit") {
      state.workspace.hidden = false;
      state.stage.hidden = true;
      const ribbon = $(state.root, "[data-vr-edit-ribbon]"); if (ribbon) ribbon.hidden = false;
      state.data.pro.workspace = "edit";
      renderProSummary();
      save();
      return;
    }
    state.workspace.hidden = true;
    state.stage.hidden = false;
    const renderers = { media: mediaPage, cut: cutPage, fusion: fusionPage, color: colorPage, audio: audioPage, deliver: deliverPage };
    state.stage.innerHTML = renderers[state.page]?.() || "";
    if (state.page === "media") { slot("project", state.panels.project); slot("monitor", state.panels.monitor); applyMediaBinFilter(); }
    if (state.page === "cut") { slot("project", state.panels.project); slot("monitor", state.panels.monitor); slot("timeline", state.panels.timeline); }
    if (state.page === "fusion") { slot("monitor", state.panels.monitor); renderNodes(); }
    if (state.page === "color") { slot("monitor", state.panels.monitor); slot("timeline", state.panels.timeline); applyGrade(); drawScopes(); }
    if (state.page === "audio") { slot("timeline", state.panels.timeline); slot("monitor", state.panels.monitor); startMeter(); }
    if (state.page === "deliver") slot("monitor", state.panels.monitor);
    updateProxy();
    const ribbon = $(state.root, "[data-vr-edit-ribbon]"); if (ribbon) ribbon.hidden = state.page !== "edit";
    state.data.pro.workspace = state.page;
    renderProSummary();
    window.lucide?.createIcons?.({ attrs: { width: 15, height: 15, "stroke-width": 1.7 } });
    save();
    restorePageView(state.page, previousPage === state.page ? focus : null);
  }

  function updateProxy() {
    const button = $(state.root, '[data-vr-action="proxy"]');
    if (button) button.classList.toggle("is-active", state.data.pro.proxyPlan.enabled);
    const node = $(state.root, "[data-vr-proxy-state]");
    if (node) node.textContent = state.data.pro.proxyPlan.enabled ? "Kế hoạch 1/2" : "Media nguồn";
    const video = $(state.root, "[data-ve-video]");
    if (video) video.dataset.proxy = state.data.pro.proxyPlan.enabled ? "on" : "off";
    renderProSummary();
  }

  function renderKeyframes() {
    const list = $(state.root, "[data-vr-keyframes]");
    if (!list) return;
    const durationText = $(state.root, "[data-ve-duration]")?.textContent || "00:00:05:00";
    const durationParts = durationText.split(":").map(Number), duration = Math.max(5, (durationParts[0] || 0) * 3600 + (durationParts[1] || 0) * 60 + (durationParts[2] || 0) + (durationParts[3] || 0) / 30);
    list.innerHTML = `<div class="vr-keyframe-ruler">${[0,25,50,75,100].map((value) => `<span style="left:${value}%">${Math.round(duration * value / 100)}s</span>`).join("")}</div>${["Vị trí","Tỷ lệ","Xoay","Opacity","Tốc độ"].map((label,index) => `<div class="vr-keyframe-row"><b>${label}</b><i></i>${state.data.keyframes.map((keyframe) => `<button style="left:${Math.min(100,keyframe.time / duration * 100)}%" title="${keyframe.timecode} · ${label}" data-vr-keyframe="${keyframe.id}">${icon("diamond")}</button>`).join("")}</div>`).join("")}`;
    const current = $(state.root, "[data-ve-timecode]")?.textContent || "00:00:00:00";
    const output = $(state.root, "[data-vr-keyframe-time]"); if (output) output.textContent = current;
    window.lucide?.createIcons?.({ attrs: { width: 11, height: 11 } });
  }

  function toggleProDrawer(force) {
    const drawer = $(state.root, "[data-vr-pro-drawer]"); if (!drawer) return;
    drawer.hidden = force == null ? !drawer.hidden : !force;
    if (!drawer.hidden) renderKeyframes();
  }

  function addKeyframe() {
    const timecode = $(state.root, "[data-ve-timecode]")?.textContent || "00:00:00:00", parts = timecode.split(":").map(Number);
    const value = (key, fallback = 0) => Number($(state.root, `[data-ve-prop="${key}"]`)?.value ?? fallback);
    const values = { x: value("x"), y: value("y"), scale: value("scale",100), rotation: value("rotation"), opacity: value("opacity",100), volume: value("volume",100) };
    state.root.dispatchEvent(new CustomEvent("hh:video-keyframe-add", { detail: { values } }));
    state.data.keyframes.push({ id: uid("keyframe"), timecode, time: (parts[0] || 0) * 3600 + (parts[1] || 0) * 60 + (parts[2] || 0) + (parts[3] || 0) / 30, ...values, speed: value("speed",100) });
    state.data.keyframes = state.data.keyframes.slice(-80);
    const next = resolveOps.addKeyframe(state.data.pro, { id: state.data.keyframes.at(-1).id, property: "transform", time: timecodeSeconds(), value: value("scale", 100), easing: "ease-in-out" });
    commitPro(next, "Đã lưu keyframe vào graph chuyển động.");
    renderKeyframes();
  }

  function gradeFilter() {
    const g = state.data.grade;
    const brightness = clamp(100 + g.exposure * .55 + g.lift * .18 + g.gamma * .12 + g.gain * .2, 10, 260);
    const contrast = clamp(g.contrast + g.highlights * .16 - g.shadows * .08, 10, 260);
    const saturate = clamp(g.saturation, 0, 300);
    const sepia = Math.abs(g.temperature) * .18;
    const hue = g.tint * .18 + (g.temperature < 0 ? 185 : 0);
    return `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturate}%) sepia(${sepia}%) hue-rotate(${hue}deg) blur(${g.blur}px)`;
  }

  function applyGrade() {
    const video = $(state.root, "[data-ve-video]");
    const image = $(state.root, "[data-ve-image]");
    if (video) video.style.setProperty("filter", gradeFilter(), "important");
    if (image) image.style.setProperty("filter", gradeFilter(), "important");
    save();
  }

  function applyLook(look) {
    const values = {
      cinema: { contrast: 122, saturation: 88, temperature: 8, tint: -3, shadows: -12, highlights: -8 },
      warm: { contrast: 108, saturation: 118, temperature: 34, tint: 5, shadows: -4, highlights: 7 },
      cool: { contrast: 112, saturation: 104, temperature: -34, tint: -4, shadows: -8, highlights: 5 },
      mono: { contrast: 126, saturation: 0, temperature: 0, tint: 0, shadows: -14, highlights: 12 }
    };
    Object.assign(state.data.grade, values[look] || defaults.grade);
    state.data.pro = resolveOps.updateColor(state.data.pro, { lut: values[look] ? look : "none" });
    renderPage("color");
    status(`Đã áp dụng look ${look}.`, "success");
  }

  async function saveStill() {
    if (state.stillBusy) return status("Khung hình đang được tạo, vui lòng chờ.", "info");
    const video = $(state.root, "[data-ve-video]");
    const image = $(state.root, "[data-ve-image]");
    const source = !image?.hidden && image?.complete && image.naturalWidth ? image : video?.readyState >= 2 && video.videoWidth ? video : null;
    if (!source) return status("Chưa có khung hình media thật để lưu still.", "error");
    const sequence = ($(state.root, "[data-ve-sequence]")?.value || "1920x1080").split("x").map(Number);
    const width = clamp(sequence[0], 320, 3840);
    const height = clamp(sequence[1], 180, 2160);
    const isImage = source === image;
    const sourceWidth = isImage ? source.naturalWidth : source.videoWidth;
    const sourceHeight = isImage ? source.naturalHeight : source.videoHeight;
    const ratio = Math.min(width / sourceWidth, height / sourceHeight);
    const drawWidth = sourceWidth * ratio;
    const drawHeight = sourceHeight * ratio;
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d"); if (!context) return status("Canvas 2D không khả dụng trên thiết bị này.", "error");
    state.stillBusy = true; const lifecycle = state.lifecycle;
    try {
      context.fillStyle = "#000";
      context.fillRect(0, 0, width, height);
      context.filter = gradeFilter();
      context.drawImage(source, (width - drawWidth) / 2, (height - drawHeight) / 2, drawWidth, drawHeight);
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
      if (state.lifecycle !== lifecycle || !state.root?.isConnected) return;
      if (!blob?.size) return status("Trình duyệt không thể tạo tệp PNG từ khung hình này.", "error");
      const anchor = document.createElement("a"), url = URL.createObjectURL(blob); state.urls.add(url);
      anchor.href = url; anchor.download = `hh-still-${new Date().toISOString().replace(/[:.]/g, "-")}.png`; anchor.rel = "noopener"; anchor.click();
      const timer = setTimeout(() => { URL.revokeObjectURL(url); state.urls.delete(url); state.urlTimers.delete(timer); }, 1500); state.urlTimers.add(timer);
      let stills = []; try { const parsed = JSON.parse(localStorage.getItem(`${STORE_KEY}.stills`) || "[]"); if (Array.isArray(parsed)) stills = parsed.slice(0, 11); } catch (_) {}
      stills.unshift({ at: Date.now(), width, height, size: blob.size, grade: { ...state.data.grade } });
      try { localStorage.setItem(`${STORE_KEY}.stills`, JSON.stringify(stills.slice(0, 12))); } catch (_) {}
      status(`Đã tạo PNG ${width}×${height} · ${Math.round(blob.size / 1024)} KB.`, "success");
    } finally { if (state.lifecycle === lifecycle) state.stillBusy = false; }
  }

  async function copyGrade() {
    if (!navigator.clipboard?.writeText) return status("Trình duyệt không cho phép ghi clipboard trong ngữ cảnh này.", "error");
    try {
      await navigator.clipboard.writeText(JSON.stringify(state.data.grade, null, 2));
      status("Đã sao chép thông số màu thật vào clipboard.", "success");
    } catch {
      status("Không thể ghi clipboard. Hãy cấp quyền rồi thử lại.", "error");
    }
  }

  function drawScopes() {
    if (state.page !== "color") return;
    const video = $(state.root, "[data-ve-video]");
    const image = $(state.root, "[data-ve-image]");
    const waveform = $(state.root, '[data-vr-scope="waveform"]');
    const histogram = $(state.root, '[data-vr-scope="histogram"]');
    if (!waveform || !histogram) return;
    const drawGrid = (ctx, width, height) => {
      ctx.fillStyle = "#070a0d"; ctx.fillRect(0, 0, width, height); ctx.strokeStyle = "#43515b55"; ctx.lineWidth = 1;
      for (let x = 0; x <= width; x += width / 4) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke(); }
      for (let y = 0; y <= height; y += height / 4) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke(); }
    };
    const wctx = waveform.getContext("2d"), hctx = histogram.getContext("2d");
    drawGrid(wctx, waveform.width, waveform.height); drawGrid(hctx, histogram.width, histogram.height);
    try {
      const source = !image?.hidden && image?.complete && image.naturalWidth ? image : video?.readyState >= 2 && video.videoWidth ? video : null;
      if (source) {
        const sample = document.createElement("canvas"); sample.width = 128; sample.height = 72;
        const sctx = sample.getContext("2d", { willReadFrequently: true }); sctx.filter = gradeFilter(); sctx.drawImage(source, 0, 0, sample.width, sample.height);
        const pixels = sctx.getImageData(0, 0, sample.width, sample.height).data, bins = [new Uint16Array(64), new Uint16Array(64), new Uint16Array(64)];
        wctx.globalAlpha = .22;
        for (let i = 0; i < pixels.length; i += 16) {
          const r = pixels[i], g = pixels[i + 1], b = pixels[i + 2], l = .2126 * r + .7152 * g + .0722 * b, x = (i / 4 % sample.width) / sample.width * waveform.width, y = waveform.height - l / 255 * waveform.height;
          wctx.fillStyle = `rgb(${r},${g},${b})`; wctx.fillRect(x, y, 2, 2);
          bins[0][Math.min(63, r >> 2)]++; bins[1][Math.min(63, g >> 2)]++; bins[2][Math.min(63, b >> 2)]++;
        }
        wctx.globalAlpha = 1;
        ["#ff5f69", "#5ee596", "#5bb7ff"].forEach((color, channel) => {
          const max = Math.max(...bins[channel], 1); hctx.strokeStyle = color; hctx.beginPath();
          bins[channel].forEach((count, index) => { const x = index / 63 * histogram.width, y = histogram.height - count / max * (histogram.height - 8); index ? hctx.lineTo(x, y) : hctx.moveTo(x, y); }); hctx.stroke();
        });
      }
    } catch {}
    const lifecycle = state.lifecycle;
    state.scopeFrame = requestAnimationFrame(() => { state.scopeTimer = setTimeout(() => { if (state.lifecycle === lifecycle) drawScopes(); }, 220); });
  }

  function renderNodes() {
    const graph = $(state.root, "[data-vr-node-graph]");
    if (!graph) return;
    graph.innerHTML = `<svg aria-hidden="true">${state.data.nodes.slice(0, -1).map((node, index) => `<line x1="${130 + index * 160}" y1="120" x2="${210 + index * 160}" y2="120"></line>`).join("")}</svg>${state.data.nodes.map((node, index) => `<button class="vr-node ${state.data.selectedNode === node.id ? "is-active" : ""} ${node.enabled === false ? "is-disabled" : ""}" style="left:${45 + index * 160}px;top:${78 + (index % 2) * 22}px" data-vr-node="${node.id}"><i>${index + 1}</i><span>${esc(node.name)}</span><small>${esc(node.type)}</small><b></b></button>`).join("")}`;
    const selected = state.data.nodes.find((node) => node.id === state.data.selectedNode);
    const inspector = $(state.root, "[data-vr-node-inspector]");
    if (inspector) inspector.innerHTML = selected ? `<div class="vr-selected-node"><i>${icon("git-merge")}</i><strong>${esc(selected.name)}</strong><span>${selected.enabled === false ? "Đang bỏ qua" : "Đang hoạt động"}</span></div><label>Tên nút<input value="${esc(selected.name)}" data-vr-node-name></label><p>${["input", "output"].includes(selected.type) ? "Nút luồng media." : "Nút này được nối với hiệu ứng thật của preview và file xuất khi engine hỗ trợ."}</p><button data-vr-action="node-toggle">${selected.enabled === false ? "Bật nút" : "Bỏ qua nút"}</button>` : "<p>Chọn một nút để chỉnh thuộc tính.</p>";
    window.lucide?.createIcons?.({ attrs: { width: 15, height: 15 } });
  }

  function addNode(type) {
    const names = { blur: "GaussianBlur", color: "ColorCorrector", transform: "Transform", text: "TextPlus", glow: "SoftGlow", mask: "PolygonMask", merge: "Merge", keyer: "DeltaKeyer" };
    if (state.data.nodes.length >= resolveOps.LIMITS.nodes) return status(`Dự án đã đạt giới hạn ${resolveOps.LIMITS.nodes} nút để bảo vệ hiệu năng.`, "error");
    if (["mask", "merge", "keyer"].includes(type)) {
      status("Compositor mask/merge/keyer cần renderer pixel nhiều lớp; chức năng này chưa được bật thay vì tạo kết quả giả.", "error");
      return;
    }
    const outputIndex = Math.max(1, state.data.nodes.findIndex((node) => node.type === "output"));
    const node = { id: uid("node"), name: `${names[type] || "Tool"}${state.data.nodes.length}`, type, enabled: true };
    state.data.nodes.splice(outputIndex, 0, node); state.data.selectedNode = node.id; save(); renderNodes();
    const effectMap = { blur: "blur", color: "cinema", glow: "vivid" };
    if (effectMap[type]) clickBase(`[data-ve-effect="${effectMap[type]}"]`);
    if (type === "text") clickBase('[data-ve-action="title"]');
    if (type === "transform") clickBase('[data-ve-inspector-tab="effect"]');
    status(`Đã thêm nút ${node.name}.`, "success");
  }

  async function ensureAudio() {
    if (state.audio) return state.audio;
    const video = $(state.root, "[data-ve-video]");
    if (!video || !(window.AudioContext || window.webkitAudioContext)) return null;
    try {
      const context = new (window.AudioContext || window.webkitAudioContext)();
      const source = context.createMediaElementSource(video), low = context.createBiquadFilter(), mid = context.createBiquadFilter(), high = context.createBiquadFilter(), compressor = context.createDynamicsCompressor(), panner = context.createStereoPanner(), gain = context.createGain(), analyser = context.createAnalyser(), exportDestination = context.createMediaStreamDestination();
      low.type = "lowshelf"; low.frequency.value = 180; mid.type = "peaking"; mid.frequency.value = 1200; mid.Q.value = .8; high.type = "highshelf"; high.frequency.value = 6200; analyser.fftSize = 256;
      source.connect(low).connect(mid).connect(high).connect(compressor).connect(panner).connect(gain).connect(analyser);
      analyser.connect(context.destination);
      analyser.connect(exportDestination);
      video.__hhProcessedAudioStream = exportDestination.stream;
      state.audio = { context, source, low, mid, high, compressor, panner, gain, analyser, exportDestination, video };
      applyAudio();
    } catch {}
    return state.audio;
  }

  async function toggleAudioRecord() {
    if (state.micRecorder?.state === "recording") {
      state.micRecorder.stop();
      return;
    }
    if (state.micPending) return status("Trình duyệt đang xử lý yêu cầu microphone.", "info");
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) return status("Trình duyệt này chưa hỗ trợ thu âm.", "error");
    const lifecycle = state.lifecycle, request = ++state.micRequest; let stream = null;
    try {
      state.micPending = true; state.data.audio.armed = true; save();
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: false } });
      if (state.lifecycle !== lifecycle || request !== state.micRequest || !state.root?.isConnected) { stream.getTracks().forEach((track) => track.stop()); return; }
      const mime = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"].find((type) => !MediaRecorder.isTypeSupported || MediaRecorder.isTypeSupported(type)) || "";
      const chunks = [], recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      state.micStream = stream; state.micChunks = chunks; state.micRecorder = recorder;
      recorder.ondataavailable = (event) => { if (event.data?.size) chunks.push(event.data); };
      recorder.onerror = () => status("Ghi âm bị gián đoạn. Hãy kiểm tra microphone.", "error");
      recorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        if (state.micStream === stream) state.micStream = null; if (state.micRecorder === recorder) state.micRecorder = null; state.micChunks = [];
        state.data.audio.armed = false; save();
        if (state.lifecycle !== lifecycle || !state.root?.isConnected) return;
        const blob = new Blob(chunks, { type: recorder.mimeType || "audio/webm" });
        if (!blob.size) return status("Bản thu rỗng nên không được thêm vào dự án.", "error");
        const extension = /mp4/i.test(blob.type) ? "m4a" : "webm", file = new File([blob], `ban-thu-${new Date().toISOString().replace(/[:.]/g, "-")}.${extension}`, { type: blob.type });
        const input = $(state.root, "[data-ve-file]");
        if (!input || typeof DataTransfer !== "function") return status("Bản thu đã dừng nhưng trình duyệt không hỗ trợ chuyển tệp vào Media Pool.", "error");
        const transfer = new DataTransfer(); transfer.items.add(file); input.files = transfer.files; input.dispatchEvent(new Event("change", { bubbles: true }));
        status("Đã chuyển bản thu thật vào luồng nhập Media Pool.", "success");
      };
      recorder.start(250);
      status("Đang thu âm · bấm Thu âm lần nữa để dừng.", "success");
    } catch {
      stream?.getTracks?.().forEach((track) => track.stop());
      state.data.audio.armed = false;
      save();
      status("Không thể truy cập micro. Hãy kiểm tra quyền của trình duyệt.", "error");
    } finally { if (state.lifecycle === lifecycle && request === state.micRequest) state.micPending = false; }
  }

  function applyAudio() {
    const graph = state.audio, a = state.data.audio;
    const master = $(state.root, "[data-ve-master-volume]");
    if (master) { master.value = String(a.master); master.dispatchEvent(new Event("input", { bubbles: true })); }
    if (graph) {
      const at = graph.context.currentTime;
      graph.gain.gain.setTargetAtTime(a.muted ? 0 : a.master / 100, at, .015); graph.panner.pan.setTargetAtTime(a.pan / 100, at, .015);
      graph.low.gain.setTargetAtTime(a.low, at, .015); graph.mid.gain.setTargetAtTime(a.mid, at, .015); graph.high.gain.setTargetAtTime(a.high, at, .015); graph.compressor.threshold.setTargetAtTime(a.threshold, at, .015);
    }
    save();
  }

  async function startMeter() {
    const graph = await ensureAudio();
    const canvas = $(state.root, "[data-vr-meter]");
    if (!canvas) return;
    const ctx = canvas.getContext("2d"), data = new Uint8Array(graph?.analyser.frequencyBinCount || 64);
    const loop = () => {
      if (state.page !== "audio" || !canvas.isConnected) return;
      if (graph) graph.analyser.getByteFrequencyData(data);
      const level = graph ? data.reduce((sum, value) => sum + value, 0) / data.length / 255 : 0;
      ctx.fillStyle = "#080b0d"; ctx.fillRect(0, 0, canvas.width, canvas.height);
      const gradient = ctx.createLinearGradient(0, canvas.height, 0, 0); gradient.addColorStop(0, "#53df91"); gradient.addColorStop(.7, "#f5d158"); gradient.addColorStop(1, "#ef6471");
      ctx.fillStyle = gradient; const height = Math.max(4, level * canvas.height); ctx.fillRect(8, canvas.height - height, 9, height); ctx.fillRect(22, canvas.height - height * .92, 9, height * .92);
      state.meterFrame = requestAnimationFrame(loop);
    };
    loop();
  }

  function exportCapabilities() {
    return {
      mediaRecorder: Boolean(window.MediaRecorder),
      canvasCapture: Boolean(window.HTMLCanvasElement?.prototype?.captureStream),
      isTypeSupported: (type) => Boolean(window.HHVideoExport?.resolveRecorderMime?.(type)
        || (!window.MediaRecorder?.isTypeSupported || window.MediaRecorder.isTypeSupported(type)))
    };
  }
  function canExportMime(mime) { const capabilities = exportCapabilities(); try { return Boolean(capabilities.mediaRecorder && capabilities.canvasCapture && capabilities.isTypeSupported(mime)); } catch (_) { return false; } }

  function addQueueJob() {
    const now = Date.now();
    if (now - state.lastQueueAt < 650) return status("Tác vụ vừa được thêm; thao tác lặp đã được bỏ qua.", "info");
    const name = $(state.root, "[data-vr-render-name]")?.value.trim() || "hh-resolve-project";
    const mime = $(state.root, "[data-vr-render-format]")?.value || "video/webm";
    const size = $(state.root, "[data-vr-render-size]")?.value || "1920x1080";
    const bitrate = Number($(state.root, "[data-vr-render-bitrate]")?.value) || 8000000, includeAudio = $(state.root, "[data-vr-render-audio]")?.checked !== false, id = uid("render");
    state.lastQueueAt = now;
    const next = resolveOps.enqueueExport(state.data.pro, { id, idempotencyKey: id, name, mime, size, bitrate, includeAudio }, exportCapabilities());
    const queued = next.exportQueue.at(-1);
    commitPro(next, queued?.status === "unsupported"
      ? "Codec đã chọn chưa được MediaRecorder trên thiết bị này hỗ trợ."
      : `Đã thêm tác vụ ${queued?.mime?.startsWith("video/mp4") ? "MP4" : "WebM"} khả dụng vào hàng đợi.`);
    renderPage("deliver");
  }

  function configureExport(job) {
    const pairs = [["[data-ve-export-name]", "[data-vr-render-name]"], ["[data-ve-export-format]", "[data-vr-render-format]"], ["[data-ve-export-size]", "[data-vr-render-size]"], ["[data-ve-export-bitrate]", "[data-vr-render-bitrate]"]];
    pairs.forEach(([targetSelector, sourceSelector]) => { const target = $(state.root, targetSelector), source = $(state.root, sourceSelector); if (target && source) target.value = source.value; });
    if (job) {
      const name = $(state.root, "[data-ve-export-name]");
      const format = $(state.root, "[data-ve-export-format]");
      const size = $(state.root, "[data-ve-export-size]");
      if (name) name.value = job.name;
      if (format) format.value = job.mime;
      if (size) size.value = job.size;
      format?.dispatchEvent(new Event("change", { bubbles: true }));
    }
  }

  function nudgeBaseProperty(key, delta) {
    const field = $(state.root, `[data-ve-prop="${key}"]`);
    if (!field || field.closest("form")?.hidden) return false;
    field.value = String(Math.max(0, Number(field.value || 0) + delta));
    field.dispatchEvent(new Event("input", { bubbles: true }));
    field.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  }

  function runTimelineOperation(type, delta = 0) {
    const clip = selectedModelClip();
    if (!clip) return status("Hãy chọn một clip trên timeline trước.", "error");
    let next = state.data.pro;
    if (type === "blade") {
      const at = timecodeSeconds();
      if (at <= clip.start || at >= clip.start + clip.duration) return status("Đầu phát phải nằm bên trong clip để cắt.", "error");
      clickBase('[data-ve-action="split"]');
      next = resolveOps.applyTimelineOperation(next, { type: "blade", clipId: clip.id, at });
      commitPro(next, "Đã cắt clip tại đầu phát bằng engine cục bộ.");
    } else if (type === "ripple-delete") {
      clickBase('[data-ve-action="ripple-delete"]');
      next = resolveOps.applyTimelineOperation(next, { type, clipId: clip.id });
      commitPro(next, "Đã xóa clip và dồn khoảng trống trên rãnh.");
    } else if (type === "slip") {
      if (!nudgeBaseProperty("in", delta)) return status("Không thể slip: thuộc tính nguồn của clip chưa sẵn sàng.", "error");
      nudgeBaseProperty("out", delta);
      next = resolveOps.applyTimelineOperation(next, { type, clipId: clip.id, delta });
      commitPro(next, `Đã slip nội dung nguồn ${delta > 0 ? "tiến" : "lùi"} ${Math.abs(delta)} giây.`);
    } else if (type === "slide") {
      if (!nudgeBaseProperty("start", delta)) return status("Không thể slide: hãy mở Thanh tra của clip.", "error");
      next = resolveOps.applyTimelineOperation(next, { type, clipId: clip.id, delta });
      commitPro(next, `Đã slide clip ${delta > 0 ? "sang phải" : "sang trái"} ${Math.abs(delta)} giây.`);
    } else if (type === "trim-start" || type === "trim-end") {
      const at = timecodeSeconds(), from = clip.start, to = clip.start + clip.duration;
      if (at <= from || at >= to) return status("Đầu phát phải nằm bên trong clip để trim.", "error");
      clickBase(`[data-ve-action="${type}"]`);
      next = resolveOps.applyTimelineOperation(next, { type, clipId: clip.id, at });
      commitPro(next, type === "trim-start" ? "Đã cắt đầu clip tới đầu phát." : "Đã cắt cuối clip tới đầu phát.");
    } else if (type === "duplicate") {
      const originalId = clip.id;
      if (!clickBase('[data-ve-action="duplicate"]')) return status("Engine timeline chưa thể nhân đôi clip.", "error");
      const duplicate = selectedModelClip();
      if (!duplicate || duplicate.id === originalId) return status("Không thể xác nhận clip nhân đôi trên timeline.", "error");
      renderProSummary(); status("Đã nhân đôi clip và đồng bộ mô hình timeline.", "success");
    } else if (type === "track-lock") {
      const track = state.data.pro.tracks.find((item) => item.id === clip.track); if (!track) return;
      clickBase(`[data-ve-track-lock="${track.id}"]`);
      commitPro(resolveOps.applyTimelineOperation(next, { type: "set-track", trackId: track.id, locked: !track.locked }), `Rãnh ${track.name} đã ${track.locked ? "mở khóa" : "khóa"}.`);
    }
  }

  function handleResolveClick(event) {
    const page = event.target.closest("button[data-vr-page]");
    if (page) { renderPage(page.dataset.vrPage); return true; }
    const bin = event.target.closest("[data-vr-bin]");
    if (bin) { state.data.selectedBin = bin.dataset.vrBin; save(); renderPage("media"); return true; }
    const node = event.target.closest("[data-vr-node]");
    if (node) { state.data.selectedNode = node.dataset.vrNode; save(); renderNodes(); return true; }
    const preset = event.target.closest("[data-vr-preset]");
    if (preset) {
      const config = { youtube: ["1920x1080", "8000000"], vertical: ["1080x1920", "8000000"], archive: ["1920x1080", "12000000"] }[preset.dataset.vrPreset];
      $(state.root, "[data-vr-render-size]").value = config[0]; $(state.root, "[data-vr-render-bitrate]").value = config[1]; $$(state.root, "[data-vr-preset]").forEach((button) => button.classList.toggle("is-active", button === preset)); return true;
    }
    const look = event.target.closest("[data-look]");
    if (look) { applyLook(look.dataset.look); return true; }
    const action = event.target.closest("[data-vr-action]")?.dataset.vrAction;
    if (!action) return false;
    if (action === "proxy") {
      const enabled = !state.data.pro.proxyPlan.enabled;
      const plan = enabled ? resolveOps.planProxy({ id: "active-media", size: 0 }, .5) : resolveOps.createProject().proxyPlan;
      const next = resolveOps.normalizeProject({ ...state.data.pro, proxyPlan: plan });
      commitPro(next, enabled ? "Đã bật chế độ xem nhẹ và tạo kế hoạch proxy. Chưa có tệp proxy mới." : "Đã quay lại phát media nguồn.");
      if (enabled) status("Proxy file chưa được tạo: cần ffmpeg worker hoặc render provider. Preview vẫn dùng media nguồn.", "info");
      updateProxy();
    }
    else if (action === "inspector") { const panel = state.panels.properties; if (panel) panel.hidden = !panel.hidden; }
    else if (action === "quick-export") { clickBase('[data-ve-action="render"]'); }
    else if (action === "pro-multicam") {
      const assets = $$(state.root, "[data-ve-asset]").slice(0, 4).map((asset, index) => ({ id: asset.dataset.veAsset || `cam-${index + 1}`, name: $(asset, "b")?.textContent || `CAM ${index + 1}`, clipId: asset.dataset.veAsset || "" }));
      if (!state.data.pro.multicam.enabled && assets.length < 2) return status("Multicam cần ít nhất hai media trong Kho media.", "error");
      const next = state.data.pro.multicam.enabled ? resolveOps.setMulticam(state.data.pro, [], 1) : resolveOps.setMulticam(state.data.pro, assets, 1);
      commitPro(next, next.multicam.enabled ? "Đã mở Multicam bằng các media thật trong dự án." : "Đã tắt Multicam Viewer.");
      state.data.multicam = next.multicam.enabled; state.root.classList.toggle("is-vr-multicam", next.multicam.enabled);
      let grid = $(state.root, "[data-vr-multicam]");
      if (next.multicam.enabled && !grid) { grid = document.createElement("div"); grid.className = "vr-multicam-grid"; grid.dataset.vrMulticam = ""; ($(state.root, "[data-ve-monitor-frame]") || $(state.root, "[data-ve-monitor]"))?.append(grid); }
      if (grid) { grid.innerHTML = next.multicam.angles.map((camera, index) => `<button type="button" data-vr-action="multicam-angle" data-angle="${index + 1}"><b>${esc(camera.name)}</b><small>${index === 0 ? "PROGRAM" : "ANGLE"}</small></button>`).join(""); grid.hidden = !next.multicam.enabled; }
    }
    else if (action === "pro-keyframes") toggleProDrawer();
    else if (action === "multicam-angle") {
      const angle = Number(event.target.closest("[data-angle]")?.dataset.angle || 1);
      const next = resolveOps.setMulticam(state.data.pro, state.data.pro.multicam.angles, angle); commitPro(next, `Đã chọn góc máy ${angle} trong Multicam Viewer.`);
      $$(state.root, "[data-angle]").forEach((button) => button.classList.toggle("is-program", Number(button.dataset.angle) === angle));
    }
    else if (action === "pro-close") toggleProDrawer(false);
    else if (action === "pro-keyframe-add") addKeyframe();
    else if (action === "pro-keyframe-delete") { if (!state.data.pro.keyframes.length) return status("Chưa có keyframe để xóa.", "info"); state.root.dispatchEvent(new CustomEvent("hh:video-keyframe-delete")); state.data.keyframes.pop(); commitPro(resolveOps.normalizeProject({ ...state.data.pro, keyframes: state.data.pro.keyframes.slice(0, -1) }), "Đã xóa keyframe cuối; có thể hoàn tác bằng Undo Pro."); renderKeyframes(); }
    else if (action === "pro-caption" || action === "subtitle-add") { clickBase('[data-ve-action="caption"]'); commitPro(resolveOps.addSubtitle(state.data.pro, { start: timecodeSeconds(), duration: 3, text: "Phụ đề mới", language: "vi" }), "Đã thêm phụ đề vào timeline và mô hình phụ đề."); }
    else if (action === "pro-speed" || action === "motion-ramp") {
      const clip = selectedModelClip(); if (!clip) return status("Hãy chọn một clip trước khi tạo Speed Ramp.", "error");
      const speed = $(state.root, '[data-ve-prop="speed"]'); if (speed) { speed.value = "150"; speed.dispatchEvent(new Event("input", { bubbles: true })); speed.dispatchEvent(new Event("change", { bubbles: true })); }
      commitPro(resolveOps.setMotionModel(state.data.pro, "speedRamp", { enabled: true, points: [{ time: clip.start, speed: 1.5 }, { time: clip.start + clip.duration, speed: 1.5 }] }), "Đã đặt tốc độ clip thật thành 150% và lưu mô hình tốc độ.");
    }
    else if (action === "pro-stabilize" || action === "motion-stabilize") { if (!selectedModelClip()) return status("Hãy chọn một clip để ổn định.", "error"); clickBase('[data-ve-action="reset-motion"]'); commitPro(resolveOps.setMotionModel(state.data.pro, "stabilization", { enabled: true, strength: .5, status: "local-transform" }), "Đã cân transform clip về tâm."); status("Optical stabilization chưa có worker phân tích chuyển động; hệ thống không giả kết quả.", "info"); }
    else if (action === "motion-track") { if (!selectedModelClip()) return status("Hãy chọn một clip để tạo tracking model.", "error"); commitPro(resolveOps.setMotionModel(state.data.pro, "tracking", { status: "provider-not-configured", points: [] }), "Đã ghi yêu cầu tracking vào project."); status("Motion tracking cần optical-flow worker chưa được cấu hình; chưa có điểm tracking giả nào được tạo.", "info"); }
    else if (action === "timeline-blade") runTimelineOperation("blade");
    else if (action === "timeline-ripple") runTimelineOperation("ripple-delete");
    else if (action === "timeline-slip-back") runTimelineOperation("slip", -1);
    else if (action === "timeline-slip-forward") runTimelineOperation("slip", 1);
    else if (action === "timeline-slide-back") runTimelineOperation("slide", -1);
    else if (action === "timeline-slide-forward") runTimelineOperation("slide", 1);
    else if (action === "timeline-trim-start") runTimelineOperation("trim-start");
    else if (action === "timeline-trim-end") runTimelineOperation("trim-end");
    else if (action === "timeline-duplicate") runTimelineOperation("duplicate");
    else if (action === "timeline-track-lock") runTimelineOperation("track-lock");
    else if (action === "timeline-snap") { const next = resolveOps.applyTimelineOperation(state.data.pro, { type: "toggle-snap" }); const checkbox = $(state.root, "[data-ve-snap]"); if (checkbox) { checkbox.checked = next.snap.enabled; checkbox.dispatchEvent(new Event("change", { bubbles: true })); } commitPro(next, `Bám dính đã ${next.snap.enabled ? "bật" : "tắt"}.`); }
    else if (action === "nested-create") { const clip = selectedModelClip(); if (!clip) return status("Hãy chọn clip để tạo sequence lồng.", "error"); commitPro(resolveOps.createNestedSequence(state.data.pro, [clip.id], `Nested ${state.data.pro.nestedSequences.length + 1}`), "Đã lưu sequence lồng vào project."); status("Sequence lồng đã được lưu nhưng renderer playback lồng chưa hỗ trợ; timeline gốc không bị thay đổi giả.", "info"); }
    else if (action === "pro-undo") undoPro("undo");
    else if (action === "pro-redo") undoPro("redo");
    else if (action === "pro-scopes") renderPage("color");
    else if (action === "pro-audio") renderPage("audio");
    else if (action === "pro-media") renderPage("media");
    else if (action === "sync-media") status("Đồng bộ A/V tự động cần ít nhất hai waveform và bộ so khớp chưa được bật; chưa có clip nào bị di chuyển.", "info");
    else if (action === "analyze-media") status(`Đã đọc metadata trình duyệt của ${$$(state.root, "[data-ve-asset]").length} media đang có trên thiết bị.`, "success");
    else if (action === "source-tape") { clickBase('[data-ve-panel-tab="project"]'); status("Source Tape hiển thị toàn bộ media theo thứ tự."); }
    else if (action === "append") { const asset = $(state.root, "[data-ve-asset]"); asset?.querySelector('[data-ve-action="asset-add"]')?.click(); }
    else if (action === "split") clickBase('[data-ve-action="split"]');
    else if (action === "ripple") clickBase('[data-ve-action="ripple-delete"]');
    else if (action === "transition") { clickBase('[data-ve-effect="fade"]'); status("Đã áp dụng chuyển cảnh mờ dần cho clip đang chọn.", "success"); }
    else if (action === "smart-reframe") { const sequence = $(state.root, "[data-ve-sequence]"); if (sequence) { sequence.value = "1080x1920"; sequence.dispatchEvent(new Event("change", { bubbles: true })); } status("Đã chuyển timeline sang khung dọc 9:16.", "success"); }
    else if (action === "add-node") addNode(event.target.closest("[data-node-type]").dataset.nodeType);
    else if (action === "node-delete") { const index = state.data.nodes.findIndex((item) => item.id === state.data.selectedNode); if (index > 0 && index < state.data.nodes.length - 1) { state.data.nodes.splice(index, 1); state.data.selectedNode = state.data.nodes[Math.max(0, index - 1)].id; save(); renderNodes(); } else status("Không thể xóa nút đầu vào hoặc đầu ra.", "error"); }
    else if (action === "node-duplicate") { const selected = state.data.nodes.find((item) => item.id === state.data.selectedNode); if (state.data.nodes.length >= resolveOps.LIMITS.nodes) return status(`Đã đạt giới hạn ${resolveOps.LIMITS.nodes} nút.`, "error"); if (selected && !["input", "output"].includes(selected.type)) { const copy = { ...selected, id: uid("node"), name: clean(`${selected.name} Copy`, 100) }; state.data.nodes.splice(state.data.nodes.indexOf(selected) + 1, 0, copy); state.data.selectedNode = copy.id; save(); renderNodes(); } }
    else if (action === "node-toggle") { const selected = state.data.nodes.find((item) => item.id === state.data.selectedNode); if (selected) { selected.enabled = selected.enabled === false; const effectMap = { blur: "blur", color: "cinema", glow: "vivid" }; clickBase(`[data-ve-effect="${selected.enabled === false ? "none" : effectMap[selected.type] || "none"}"]`); save(); renderNodes(); status(`${selected.name} đã ${selected.enabled === false ? "bỏ qua" : "bật"}.`, "success"); } }
    else if (action === "node-organize") { const rank = (node) => node.type === "input" ? 0 : node.type === "output" ? 2 : 1; state.data.nodes = state.data.nodes.map((node, index) => ({ node, index })).sort((a, b) => rank(a.node) - rank(b.node) || a.index - b.index).map((row) => row.node); save(); renderNodes(); status("Đã sắp xếp và lưu lại thứ tự đồ thị nút.", "success"); }
    else if (action === "grade-reset") { state.data.grade = { ...defaults.grade }; commitPro(resolveOps.updateColor(state.data.pro, { lut: "none", wheels: { lift: 0, gamma: 0, gain: 0, offset: 0 }, curves: [{ x: 0, y: 0 }, { x: 1, y: 1 }] }), "Đã đặt lại toàn bộ hiệu chỉnh màu cục bộ."); renderPage("color"); }
    else if (action === "auto-color") { Object.assign(state.data.grade, { exposure: 6, contrast: 112, saturation: 108, temperature: 4, shadows: 8, highlights: -10 }); renderPage("color"); status("Đã áp dụng preset cân bằng cục bộ. Đây không phải phân tích AI.", "success"); }
    else if (action === "apply-look") applyLook(event.target.closest("[data-look]")?.dataset.look || "cinema");
    else if (action === "save-still") saveStill().catch((error) => status(`Không thể lưu still: ${error.message}`, "error"));
    else if (action === "copy-grade") copyGrade();
    else if (action === "add-serial-node") { commitPro(resolveOps.updateColor(state.data.pro, { addNode: { id: uid("corrector"), type: "corrector", enabled: true } }), "Đã thêm nút chỉnh màu nối tiếp."); renderPage("color"); }
    else if (action === "curve-contrast") { commitPro(resolveOps.updateColor(state.data.pro, { curves: [{ x: 0, y: 0 }, { x: .25, y: .18 }, { x: .75, y: .82 }, { x: 1, y: 1 }] }), "Đã tạo S-Curve không phá hủy trong mô hình màu."); renderPage("color"); }
    else if (action === "audio-normalize") clickBase('[data-ve-action="normalize"]');
    else if (action === "audio-noise") { state.data.audio.high = -2; state.data.audio.low = -4; applyAudio(); state.data.pro = resolveOps.updateAudioChannel(state.data.pro, "A1", { eq: { low: -4, mid: 0, high: -2 }, noiseReduction: { enabled: true, amount: .35 } }); save(); renderPage("audio"); status("Đã áp dụng EQ giảm nhiễu cục bộ. Không giả nhận diện giọng nói AI.", "success"); }
    else if (action === "audio-duck") { state.data.audio.master = 76; applyAudio(); state.data.pro = resolveOps.updateAudioChannel(state.data.pro, "A1", { gain: .76, automation: [{ time: timecodeSeconds(), value: .76 }] }); save(); renderPage("audio"); status("Đã thêm điểm ducking vào automation A1.", "success"); }
    else if (action === "audio-fade") { const fadeIn = $(state.root, '[data-ve-prop="fadeIn"]'), fadeOut = $(state.root, '[data-ve-prop="fadeOut"]'); if (!fadeIn || fadeIn.closest("form")?.hidden) return status("Hãy chọn một clip có âm thanh trước.", "error"); [fadeIn, fadeOut].forEach((field) => { field.value = "1"; field.dispatchEvent(new Event("input", { bubbles: true })); field.dispatchEvent(new Event("change", { bubbles: true })); }); status("Đã đặt fade in/out 1 giây vào clip thật.", "success"); }
    else if (action === "audio-mute") { state.data.audio.muted = !state.data.audio.muted; state.data.pro = resolveOps.updateAudioChannel(state.data.pro, "A1", { muted: state.data.audio.muted }); applyAudio(); renderPage("audio"); status(`Rãnh A1 đã ${state.data.audio.muted ? "tắt tiếng" : "bật tiếng"}.`, "success"); }
    else if (action === "audio-solo") { state.data.audio.solo = !state.data.audio.solo; state.data.pro = resolveOps.updateAudioChannel(state.data.pro, "A1", { solo: state.data.audio.solo }); save(); renderPage("audio"); status(`Solo A1 đã ${state.data.audio.solo ? "bật" : "tắt"} và được lưu vào project.`, "success"); }
    else if (action === "audio-arm") { state.data.audio.armed = !state.data.audio.armed; save(); renderPage("audio"); status(state.data.audio.armed ? "A1 đã được arm. Bấm Thu âm để cấp quyền micro và ghi file thật." : "Đã bỏ arm rãnh A1.", "success"); }
    else if (action === "audio-record") toggleAudioRecord();
    else if (action === "audio-deesser") { state.data.audio.high = -5; applyAudio(); renderPage("audio"); status("Đã giảm dải cao bằng EQ cục bộ.", "success"); }
    else if (action === "audio-hum") { state.data.audio.low = -8; applyAudio(); renderPage("audio"); status("Đã giảm dải tần thấp bằng EQ cục bộ.", "success"); }
    else if (action === "audio-limiter") { state.data.audio.threshold = -6; applyAudio(); state.data.pro = resolveOps.updateAudioChannel(state.data.pro, "A1", { compressor: { enabled: true, threshold: -6, ratio: 10 } }); save(); renderPage("audio"); status("Đã bật compressor giới hạn đỉnh bằng Web Audio.", "success"); }
    else if (action === "audio-automation") { state.data.pro = resolveOps.updateAudioChannel(state.data.pro, "A1", { automation: [...(state.data.pro.audio.channels[0]?.automation || []), { time: timecodeSeconds(), value: state.data.audio.master / 100 }] }); save(); renderPage("audio"); status("Đã thêm điểm automation tại đầu phát.", "success"); }
    else if (action === "eq-reset") { Object.assign(state.data.audio, { low: 0, mid: 0, high: 0, threshold: -24, reverb: 0 }); applyAudio(); state.data.pro = resolveOps.updateAudioChannel(state.data.pro, "A1", { eq: { low: 0, mid: 0, high: 0 }, compressor: { enabled: false, threshold: -24, ratio: 3 }, noiseReduction: { enabled: false, amount: 0 } }); save(); renderPage("audio"); }
    else if (action === "queue-add") addQueueJob();
    else if (action === "queue-remove") { const id = event.target.closest("[data-job-id]").dataset.jobId, job = state.data.pro.exportQueue.find((item) => item.id === id); if (job?.status === "processing") return status("Hãy hủy kết xuất trước khi xóa tác vụ.", "error"); state.data.pro.exportQueue = state.data.pro.exportQueue.filter((item) => item.id !== id); state.data.pro = resolveOps.normalizeProject(state.data.pro); save(); renderPage("deliver"); }
    else if (action === "queue-clear") { const activeJobs = state.data.pro.exportQueue.filter((job) => job.status === "processing"); state.data.pro.exportQueue = activeJobs; state.data.pro = resolveOps.normalizeProject(state.data.pro); save(); renderPage("deliver"); if (activeJobs.length) status("Đã giữ lại tác vụ đang kết xuất. Hãy hủy trước nếu muốn xóa.", "info"); }
    else if (action === "queue-retry") { const id = event.target.closest("[data-job-id]").dataset.jobId, job = state.data.pro.exportQueue.find((item) => item.id === id); if (!job || !["failed", "cancelled"].includes(job.status)) return; if (!canExportMime(job.mime)) { job.status = "unsupported"; job.notice = "MediaRecorder, Canvas capture hoặc codec không còn khả dụng trên thiết bị này."; } else { job.status = "queued"; job.progress = 0; job.notice = "Đã kiểm tra lại codec và đưa tác vụ về hàng chờ."; } state.data.pro = resolveOps.normalizeProject(state.data.pro); save(); renderPage("deliver"); }
    else if (action === "queue-cancel") { const id = event.target.closest("[data-job-id]").dataset.jobId; if (state.exportJobId && id !== state.exportJobId) return status("Tác vụ này không phải phiên kết xuất đang hoạt động.", "error"); clickBase('[data-ve-action="render-cancel"]'); state.data.pro = resolveOps.updateExportStatus(state.data.pro, id, "cancelled", { notice: "Người dùng đã yêu cầu hủy tác vụ kết xuất." }); state.exportJobId = ""; save(); renderPage("deliver"); status("Đã gửi yêu cầu hủy kết xuất.", "info"); }
    else if (action === "queue-start") {
      if (state.exportJobId || state.data.pro.exportQueue.some((item) => item.status === "processing")) return status("Một tác vụ đang kết xuất. Hãy chờ hoặc hủy trước.", "info");
      const job = state.data.pro.exportQueue.find((item) => item.status === "queued" && /^video\/(?:mp4|webm)/i.test(item.mime));
      if (!job) return status(state.data.pro.exportQueue.length ? "Không có tác vụ nào được trình duyệt xác nhận hỗ trợ." : "Hãy thêm ít nhất một tác vụ vào hàng đợi.", "error");
      if (!canExportMime(job.mime)) { state.data.pro = resolveOps.updateExportStatus(state.data.pro, job.id, "unsupported", { notice: "MediaRecorder, Canvas capture hoặc codec đã chọn không còn khả dụng." }); save(); renderPage("deliver"); return status("Engine hoặc codec đã chọn không còn khả dụng trên thiết bị.", "error"); }
      configureExport(job); state.exportJobId = job.id; state.data.pro = resolveOps.updateExportStatus(state.data.pro, job.id, "processing", { progress: 0, notice: `MediaRecorder đang kết xuất ${job.mime.startsWith("video/mp4") ? "MP4" : "WebM"} thật trên thiết bị.` }); save();
      const opened = clickBase('[data-ve-action="render"]'), confirmed = opened && clickBase('[data-ve-action="render-confirm"]');
      if (!confirmed) { state.data.pro = resolveOps.updateExportStatus(state.data.pro, job.id, "failed", { notice: "Không mở được engine kết xuất của Video Editor." }); state.exportJobId = ""; save(); renderPage("deliver"); return status("Không thể khởi động engine kết xuất.", "error"); }
      renderPage("deliver");
      status(`Đã bắt đầu kết xuất ${job.mime.startsWith("video/mp4") ? "MP4 H.264/AAC" : "WebM"} trên thiết bị.`, "success");
    }
    return true;
  }

  function handleResolveInput(event) {
    if (event.target.matches("[data-vr-grade]")) {
      const key = event.target.dataset.vrGrade, bounds = { exposure: [-100, 100], contrast: [0, 260], saturation: [0, 300], temperature: [-100, 100], tint: [-100, 100], lift: [-100, 100], gamma: [-100, 100], gain: [-100, 100], highlights: [-100, 100], shadows: [-100, 100], blur: [0, 12], sharpen: [0, 100] }[key] || [-100, 100]; state.data.grade[key] = clamp(event.target.value, ...bounds);
      event.target.value = String(state.data.grade[key]); const value = $(state.root, `[data-vr-grade-value="${key}"]`); if (value) value.textContent = `${state.data.grade[key]}${key === "blur" ? "px" : ""}`;
      const wheelKey = key === "exposure" ? "offset" : ["lift", "gamma", "gain"].includes(key) ? key : null;
      if (wheelKey) state.data.pro = resolveOps.updateColor(state.data.pro, { wheels: { [wheelKey]: Number(event.target.value) } });
      applyGrade(); return true;
    }
    if (event.target.matches("[data-vr-lut]")) {
      state.data.pro = resolveOps.updateColor(state.data.pro, { lut: event.target.value });
      const look = { cinema: "cinema", warm: "warm", cool: "cool" }[event.target.value]; if (look) applyLook(look); else { save(); renderPage("color"); }
      return true;
    }
    if (event.target.matches("[data-vr-audio]")) {
      const key = event.target.dataset.vrAudio, bounds = { master: [0, 150], pan: [-100, 100], low: [-18, 18], mid: [-18, 18], high: [-18, 18], threshold: [-60, 0] }[key] || [-100, 100]; state.data.audio[key] = clamp(event.target.value, ...bounds);
      event.target.value = String(state.data.audio[key]); const value = $(state.root, `[data-vr-audio-value="${key}"]`); if (value) value.textContent = event.target.value;
      const patch = key === "master" ? { gain: Number(event.target.value) / 100 } : key === "pan" ? { pan: Number(event.target.value) / 100 } : ["low", "mid", "high"].includes(key) ? { eq: { ...state.data.pro.audio.channels[0]?.eq, [key]: Number(event.target.value) } } : key === "threshold" ? { compressor: { ...state.data.pro.audio.channels[0]?.compressor, enabled: true, threshold: Number(event.target.value) } } : {};
      state.data.pro = resolveOps.updateAudioChannel(state.data.pro, "A1", patch);
      ensureAudio().then(applyAudio); return true;
    }
    if (event.target.matches("[data-ve-snap]")) {
      state.data.pro = resolveOps.applyTimelineOperation(state.data.pro, { type: "toggle-snap", enabled: event.target.checked }); save(); renderProSummary(); return false;
    }
    if (event.target.matches("[data-vr-node-name]")) {
      const selected = state.data.nodes.find((node) => node.id === state.data.selectedNode); if (selected) { selected.name = clean(event.target.value, 100); save(); }
      return true;
    }
    return false;
  }

  function handleExportStatus(event) {
    if (!state.root?.isConnected) return;
    const detail = event.detail || {};
    const job = state.data.pro.exportQueue.find((item) => item.id === state.exportJobId && item.status === "processing")
      || (!state.exportJobId ? state.data.pro.exportQueue.find((item) => item.status === "processing") : null);
    if (!job) return;
    const statusMap = { processing: "processing", completed: "completed", failed: "failed", cancelled: "cancelled" };
    const nextStatus = statusMap[detail.status]; if (!nextStatus) return;
    let notice = job.notice;
    if (detail.status === "processing") notice = `Đang kết xuất trên thiết bị · ${Math.round(clamp(detail.progress, 0, 100))}%.`;
    if (detail.status === "completed") notice = `Đã tạo tệp ${clean(detail.name || job.name, 100)} · ${Math.round(clamp(detail.size, 0, 10737418240) / 1024)} KB.`;
    if (detail.status === "failed") notice = `Kết xuất thất bại · ${clean(detail.message || "Không xác định", 160)}.`;
    if (detail.status === "cancelled") notice = "Người dùng đã hủy tác vụ kết xuất.";
    state.data.pro = resolveOps.updateExportStatus(state.data.pro, job.id, nextStatus, { progress: detail.progress, notice });
    const updatedJob = state.data.pro.exportQueue.find((item) => item.id === job.id);
    if (["completed", "failed", "cancelled"].includes(nextStatus)) state.exportJobId = "";
    save();
    if (["completed", "failed", "cancelled"].includes(nextStatus) && state.page === "deliver") { renderPage("deliver"); return; }
    const id = window.CSS?.escape ? window.CSS.escape(job.id) : job.id.replace(/[^a-z0-9_-]/gi, ""), article = $(state.root, `[data-vr-job="${id}"]`);
    if (article) {
      const dot = article.querySelector(":scope>span");
      if (dot) { dot.className = updatedJob.status; dot.style.setProperty("--progress", `${updatedJob.progress || 0}%`); }
      const notice = article.querySelector("small");
      if (notice) notice.innerHTML = `${esc(updatedJob.mime)} · ${esc(updatedJob.size)}<br>${esc(updatedJob.notice)}`;
      const label = article.querySelector(":scope>b");
      if (label) label.textContent = ({ processing: "Đang xử lý", completed: "Hoàn tất", failed: "Thất bại", cancelled: "Đã hủy" })[updatedJob.status] || updatedJob.status;
    }
  }

  function observeCore() {
    const video = $(state.root, "[data-ve-video]");
    if (video) {
      const observer = new MutationObserver(() => {
        if (video.style.getPropertyPriority("filter") !== "important" || video.style.getPropertyValue("filter") !== gradeFilter()) applyGrade();
      });
      observer.observe(video, { attributes: true, attributeFilter: ["style", "src"] }); state.observers.push(observer);
    }
  }

  function handleGlobalKeydown(event) {
    if (!state.root?.isConnected || !location.hash.includes("/davinci-resolve")) return;
    const typing = /INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName || "") || document.activeElement?.isContentEditable;
    if (event.shiftKey && /^[1-7]$/.test(event.key) && !typing) { event.preventDefault(); renderPage(pages[Number(event.key) - 1][0]); }
    if (!typing && !event.ctrlKey && !event.metaKey && event.key.toLowerCase() === "b") { event.preventDefault(); runTimelineOperation("blade"); }
    if (!typing && !event.ctrlKey && !event.metaKey && event.key.toLowerCase() === "n") { event.preventDefault(); $(state.root, '[data-vr-action="timeline-snap"]')?.click(); }
    if (!typing && event.key === "F9") { event.preventDefault(); $(state.root, '[data-ve-asset] [data-ve-action="asset-add"]')?.click(); }
  }

  function decorate(outer) {
    cleanupOwn();
    state.outer = outer; state.root = $(outer, "[data-ve-editor]");
    if (!state.root) return;
    load();
    state.root.classList.add("ve-resolve");
    state.workspace = $(state.root, ".ve-workspace");
    state.panels = { project: $(state.root, ".ve-project-panel"), monitor: $(state.root, ".ve-monitor-panel"), properties: $(state.root, ".ve-properties"), timeline: $(state.root, ".ve-timeline-panel") };
    localize();
    const shell = document.createElement("div"); shell.className = "vr-shell-fragment"; shell.innerHTML = shellMarkup();
    const toolbar = $(state.root, ".ve-toolbar"); toolbar.after(...shell.childNodes);
    state.stage = $(state.root, "[data-vr-stage]");
    const dock = $(state.root, ".vr-page-dock"), toast = $(state.root, "[data-vr-toast]");
    if (dock) state.workspace.after(dock);
    if (toast) dock?.after(toast);
    observeCore(); applyGrade(); updateProxy(); renderPage(state.page);
    state.exportListener = handleExportStatus;
    window.addEventListener("hh:video-export-status", state.exportListener);
    state.keyListener = handleGlobalKeydown;
    window.addEventListener("keydown", state.keyListener);
    state.root.classList.toggle("is-vr-multicam", state.data.multicam);
    window.lucide?.createIcons?.({ attrs: { width: 15, height: 15, "stroke-width": 1.7 } });
  }

  function cleanupOwn() {
    state.lifecycle += 1; state.micRequest += 1;
    clearTimeout(state.timer); clearTimeout(state.scopeTimer); cancelAnimationFrame(state.scopeFrame); cancelAnimationFrame(state.meterFrame); cancelAnimationFrame(state.restoreFrame);
    state.observers.splice(0).forEach((observer) => observer.disconnect());
    if (state.exportListener) window.removeEventListener("hh:video-export-status", state.exportListener);
    if (state.keyListener) window.removeEventListener("keydown", state.keyListener);
    const recorder = state.micRecorder;
    if (recorder) { recorder.ondataavailable = null; recorder.onstop = null; recorder.onerror = null; try { if (recorder.state !== "inactive") recorder.stop(); } catch (_) {} }
    state.micStream?.getTracks().forEach((track) => track.stop());
    state.urlTimers.forEach((timer) => clearTimeout(timer)); state.urlTimers.clear(); state.urls.forEach((url) => URL.revokeObjectURL(url)); state.urls.clear();
    if (state.audio?.video) delete state.audio.video.__hhProcessedAudioStream;
    [state.audio?.source, state.audio?.low, state.audio?.mid, state.audio?.high, state.audio?.compressor, state.audio?.panner, state.audio?.gain, state.audio?.analyser, state.audio?.exportDestination].forEach((node) => { try { node?.disconnect?.(); } catch (_) {} });
    if (state.audio?.context && state.audio.context.state !== "closed") state.audio.context.close().catch(() => {});
    Object.assign(state, { root: null, outer: null, workspace: null, stage: null, panels: {}, audio: null, micRecorder: null, micStream: null, micChunks: [], micPending: false, scopeFrame: 0, scopeTimer: 0, meterFrame: 0, restoreFrame: 0, exportListener: null, keyListener: null, exportJobId: "", stillBusy: false });
  }

  window.HHMediaDesign = {
    supports: (name) => name === TOOL || base.supports(name),
    render(outer, name) { base.render(outer, name); if (name === TOOL) decorate(outer); },
    cleanup() { cleanupOwn(); base.cleanup?.(); },
    handleClick(event, outer, name) { if (name === TOOL && handleResolveClick(event)) return; return base.handleClick?.(event, outer, name); },
    handleInput(event, outer, name) { if (name === TOOL && handleResolveInput(event)) return; return base.handleInput?.(event, outer, name); },
    handleChange(event, outer, name) { if (name === TOOL && handleResolveInput(event)) return; return base.handleChange?.(event, outer, name); }
  };
})();
