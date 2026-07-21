(function (globalScope) {
  "use strict";

  const VERSION = 1;
  const STORAGE_KEY = "hh.music.mix-master.v1";
  const SUPPORTED_VIEWS = Object.freeze(["mix", "master"]);
  const PARAM_RANGES = Object.freeze({
    gainDb: [-60, 12], pan: [-1, 1], eqDb: [-18, 18], threshold: [-100, 0],
    ratio: [1, 20], attack: [0, 1], release: [0, 1], send: [0, 1],
    frequency: [20, 20000], delay: [0, 2], feedback: [0, 0.9],
    stereoWidth: [0, 2], ceiling: [-12, 0], automationTime: [0, 86400]
  });

  const MASTER_PRESETS = Object.freeze({
    youtube: Object.freeze({
      id: "youtube", label: "YouTube", target: "-14 LUFS (tham chiếu)", ceilingDb: -1,
      inputGainDb: 0, outputGainDb: -1, lowDb: 0, midDb: 0, highDb: 0.8,
      compressor: { threshold: -18, ratio: 2.2, attack: 0.02, release: 0.22 }, stereoWidth: 1
    }),
    podcast: Object.freeze({
      id: "podcast", label: "Podcast", target: "-16 LUFS (tham chiếu)", ceilingDb: -1,
      inputGainDb: 1, outputGainDb: -1, lowDb: -0.5, midDb: 1.2, highDb: 1,
      compressor: { threshold: -24, ratio: 3.2, attack: 0.012, release: 0.18 }, stereoWidth: 0.92
    }),
    streaming: Object.freeze({
      id: "streaming", label: "Streaming", target: "-14 LUFS (tham chiếu)", ceilingDb: -1,
      inputGainDb: 0, outputGainDb: -1, lowDb: 0.5, midDb: -0.3, highDb: 0.5,
      compressor: { threshold: -20, ratio: 2.5, attack: 0.025, release: 0.25 }, stereoWidth: 1.08
    }),
    shorts: Object.freeze({
      id: "shorts", label: "Video ngắn", target: "-12 LUFS (tham chiếu)", ceilingDb: -1,
      inputGainDb: 1.5, outputGainDb: -1, lowDb: 0.6, midDb: 0.8, highDb: 1.2,
      compressor: { threshold: -22, ratio: 3.5, attack: 0.01, release: 0.14 }, stereoWidth: 1.04
    })
  });

  let active = null;

  function clamp(value, min, max, fallback) {
    const number = Number(value);
    if (!Number.isFinite(number)) return fallback == null ? min : fallback;
    return Math.min(max, Math.max(min, number));
  }

  function clampRange(value, range, fallback) {
    return clamp(value, range[0], range[1], fallback);
  }

  function dbToGain(db) {
    return Math.pow(10, clampRange(db, PARAM_RANGES.gainDb, 0) / 20);
  }

  function gainToDb(gain) {
    const safe = Math.max(0.000001, Number(gain) || 0);
    return Math.max(-120, 20 * Math.log10(safe));
  }

  function uid(prefix) {
    return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  function safeText(value, limit) {
    return String(value == null ? "" : value)
      .replace(/[\u0000-\u001f\u007f]/g, " ").replace(/<[^>]*>/g, "")
      .trim().slice(0, limit || 160);
  }

  function clone(value) {
    if (typeof structuredClone === "function") return structuredClone(value);
    return JSON.parse(JSON.stringify(value));
  }

  function defaultChannel(index) {
    const names = ["Vocal", "Drums", "Bass", "Music"];
    const colors = ["#ff69b4", "#66e5ee", "#ffe071", "#9f8cff"];
    return {
      id: `channel-${index + 1}`, name: names[index] || `Track ${index + 1}`,
      color: colors[index % colors.length], gainDb: 0, pan: 0, mute: false, solo: false,
      eq: { lowDb: 0, midDb: 0, highDb: 0, lowHz: 120, midHz: 1200, highHz: 8000 },
      compressor: { enabled: true, threshold: -24, ratio: 3, attack: 0.02, release: 0.2 },
      sends: { reverb: 0.12, delay: 0.04 },
      automation: { gain: [], pan: [] }, file: null
    };
  }

  function defaultMaster() {
    return {
      preset: "youtube", inputGainDb: 0, outputGainDb: -1, ceilingDb: -1,
      lowDb: 0, midDb: 0, highDb: 0.8, stereoWidth: 1,
      compressor: { threshold: -18, ratio: 2.2, attack: 0.02, release: 0.22 },
      reverb: { duration: 1.5, decay: 2.2, wet: 0.18 },
      delay: { time: 0.28, feedback: 0.25, wet: 0.08 }
    };
  }

  function createDefaultState() {
    const master = defaultMaster();
    return {
      version: VERSION, view: "mix", projectName: "HH Mix Session", bypass: false,
      channels: Array.from({ length: 4 }, (_, index) => defaultChannel(index)),
      master, ab: { active: "A", A: clone(master), B: { ...clone(master), stereoWidth: 1.12 } },
      selectedChannelId: "channel-1", currentTime: 0, loop: false,
      updatedAt: new Date().toISOString()
    };
  }

  function normalizeAutomation(points, valueRange) {
    return (Array.isArray(points) ? points : []).slice(0, 256).map((point) => ({
      id: safeText(point?.id, 80) || uid("automation"),
      time: clampRange(point?.time, PARAM_RANGES.automationTime, 0),
      value: clampRange(point?.value, valueRange, 0)
    })).sort((a, b) => a.time - b.time);
  }

  function normalizeChannel(channel, index) {
    const base = defaultChannel(index);
    return {
      ...base, ...channel,
      id: safeText(channel?.id, 80) || base.id,
      name: safeText(channel?.name, 60) || base.name,
      color: /^#[0-9a-f]{6}$/i.test(channel?.color || "") ? channel.color : base.color,
      gainDb: clampRange(channel?.gainDb, PARAM_RANGES.gainDb, 0),
      pan: clampRange(channel?.pan, PARAM_RANGES.pan, 0),
      mute: Boolean(channel?.mute), solo: Boolean(channel?.solo),
      eq: {
        lowDb: clampRange(channel?.eq?.lowDb, PARAM_RANGES.eqDb, 0),
        midDb: clampRange(channel?.eq?.midDb, PARAM_RANGES.eqDb, 0),
        highDb: clampRange(channel?.eq?.highDb, PARAM_RANGES.eqDb, 0),
        lowHz: clampRange(channel?.eq?.lowHz, PARAM_RANGES.frequency, 120),
        midHz: clampRange(channel?.eq?.midHz, PARAM_RANGES.frequency, 1200),
        highHz: clampRange(channel?.eq?.highHz, PARAM_RANGES.frequency, 8000)
      },
      compressor: {
        enabled: channel?.compressor?.enabled !== false,
        threshold: clampRange(channel?.compressor?.threshold, PARAM_RANGES.threshold, -24),
        ratio: clampRange(channel?.compressor?.ratio, PARAM_RANGES.ratio, 3),
        attack: clampRange(channel?.compressor?.attack, PARAM_RANGES.attack, 0.02),
        release: clampRange(channel?.compressor?.release, PARAM_RANGES.release, 0.2)
      },
      sends: {
        reverb: clampRange(channel?.sends?.reverb, PARAM_RANGES.send, 0.12),
        delay: clampRange(channel?.sends?.delay, PARAM_RANGES.send, 0.04)
      },
      automation: {
        gain: normalizeAutomation(channel?.automation?.gain, PARAM_RANGES.gainDb),
        pan: normalizeAutomation(channel?.automation?.pan, PARAM_RANGES.pan)
      },
      file: channel?.file && typeof channel.file === "object" ? {
        name: safeText(channel.file.name, 180), type: safeText(channel.file.type, 80),
        size: Math.max(0, Number(channel.file.size) || 0), duration: Math.max(0, Number(channel.file.duration) || 0)
      } : null
    };
  }

  function normalizeMaster(master) {
    const base = defaultMaster();
    const source = master || {};
    return {
      ...base, ...source,
      preset: MASTER_PRESETS[source.preset] ? source.preset : base.preset,
      inputGainDb: clampRange(source.inputGainDb, PARAM_RANGES.gainDb, base.inputGainDb),
      outputGainDb: clampRange(source.outputGainDb, PARAM_RANGES.gainDb, base.outputGainDb),
      ceilingDb: clampRange(source.ceilingDb, PARAM_RANGES.ceiling, base.ceilingDb),
      lowDb: clampRange(source.lowDb, PARAM_RANGES.eqDb, base.lowDb),
      midDb: clampRange(source.midDb, PARAM_RANGES.eqDb, base.midDb),
      highDb: clampRange(source.highDb, PARAM_RANGES.eqDb, base.highDb),
      stereoWidth: clampRange(source.stereoWidth, PARAM_RANGES.stereoWidth, base.stereoWidth),
      compressor: {
        threshold: clampRange(source.compressor?.threshold, PARAM_RANGES.threshold, base.compressor.threshold),
        ratio: clampRange(source.compressor?.ratio, PARAM_RANGES.ratio, base.compressor.ratio),
        attack: clampRange(source.compressor?.attack, PARAM_RANGES.attack, base.compressor.attack),
        release: clampRange(source.compressor?.release, PARAM_RANGES.release, base.compressor.release)
      },
      reverb: {
        duration: clamp(source.reverb?.duration, 0.1, 8, base.reverb.duration),
        decay: clamp(source.reverb?.decay, 0.1, 8, base.reverb.decay),
        wet: clampRange(source.reverb?.wet, PARAM_RANGES.send, base.reverb.wet)
      },
      delay: {
        time: clampRange(source.delay?.time, PARAM_RANGES.delay, base.delay.time),
        feedback: clampRange(source.delay?.feedback, PARAM_RANGES.feedback, base.delay.feedback),
        wet: clampRange(source.delay?.wet, PARAM_RANGES.send, base.delay.wet)
      }
    };
  }

  function normalizeState(input) {
    const base = createDefaultState();
    const source = input && typeof input === "object" ? input : {};
    const channels = (Array.isArray(source.channels) ? source.channels : base.channels).slice(0, 24)
      .map((channel, index) => normalizeChannel(channel, index));
    while (channels.length < 1) channels.push(defaultChannel(0));
    const master = normalizeMaster(source.master);
    return {
      ...base, ...source, version: VERSION,
      view: SUPPORTED_VIEWS.includes(source.view) ? source.view : base.view,
      projectName: safeText(source.projectName, 100) || base.projectName,
      bypass: Boolean(source.bypass), channels, master,
      selectedChannelId: channels.some((item) => item.id === source.selectedChannelId) ? source.selectedChannelId : channels[0].id,
      ab: {
        active: source.ab?.active === "B" ? "B" : "A",
        A: normalizeMaster(source.ab?.A || master), B: normalizeMaster(source.ab?.B || master)
      },
      currentTime: Math.max(0, Number(source.currentTime) || 0), loop: Boolean(source.loop),
      updatedAt: safeText(source.updatedAt, 40) || base.updatedAt
    };
  }

  function loadState(scope) {
    try {
      const raw = scope?.localStorage?.getItem(STORAGE_KEY);
      return normalizeState(raw ? JSON.parse(raw) : null);
    } catch (_) {
      return createDefaultState();
    }
  }

  function saveState(state, scope) {
    const clean = normalizeState({ ...state, updatedAt: new Date().toISOString() });
    try { scope?.localStorage?.setItem(STORAGE_KEY, JSON.stringify(clean)); } catch (_) { /* local storage may be blocked */ }
    return clean;
  }

  function supports(id) {
    return SUPPORTED_VIEWS.includes(String(id || "").toLowerCase());
  }

  function estimateMetrics(samples) {
    const data = samples && typeof samples.length === "number" ? samples : [];
    if (!data.length) return { peak: 0, peakDb: -120, rms: 0, rmsDb: -120, truePeakEstimateDb: -120, lufsEstimate: -120, clipping: false };
    let peak = 0;
    let square = 0;
    for (let index = 0; index < data.length; index += 1) {
      const sample = Number(data[index]) || 0;
      peak = Math.max(peak, Math.abs(sample));
      square += sample * sample;
    }
    const rms = Math.sqrt(square / data.length);
    const peakDb = gainToDb(peak);
    const rmsDb = gainToDb(rms);
    return {
      peak, peakDb, rms, rmsDb,
      truePeakEstimateDb: Math.min(3, peakDb + (peak > 0.5 ? 0.5 : 0.2)),
      lufsEstimate: Math.max(-120, -0.691 + 10 * Math.log10(Math.max(1e-12, rms * rms))),
      clipping: peak >= 0.999
    };
  }

  function getMeterLabels(scope) {
    const analyzer = scope?.HHLoudnessAnalyzer;
    const standards = Boolean(analyzer?.isStandardsCompliant && typeof analyzer.measure === "function");
    return standards
      ? { standards, truePeak: "True Peak", lufs: "LUFS-I", note: "Đo bởi analyzer đạt chuẩn đã nạp." }
      : { standards, truePeak: "True Peak (ước tính)", lufs: "LUFS (ước tính)", note: "Chỉ để tham khảo; cần analyzer ITU-R BS.1770 đạt chuẩn để xuất bản chính thức." };
  }

  function createResourceTracker(scope) {
    const urls = new Set();
    const nodes = new Set();
    const sources = new Set();
    const frames = new Set();
    let context = null;
    return {
      setContext(value) { context = value; },
      addUrl(value) { if (value) urls.add(value); return value; },
      removeUrl(value) { urls.delete(value); },
      addNode(value) { if (value) nodes.add(value); return value; },
      removeNode(value) { nodes.delete(value); },
      addSource(value) { if (value) sources.add(value); return value; },
      removeSource(value) { sources.delete(value); },
      addFrame(value) { if (value != null) frames.add(value); return value; },
      removeFrame(value) { frames.delete(value); },
      stats() { return { urls: urls.size, nodes: nodes.size, sources: sources.size, frames: frames.size, hasContext: Boolean(context) }; },
      async cleanup() {
        for (const frame of frames) { try { scope?.cancelAnimationFrame?.(frame); } catch (_) { /* no-op */ } }
        frames.clear();
        for (const source of sources) { try { source.stop?.(); } catch (_) { /* already stopped */ } try { source.disconnect?.(); } catch (_) { /* no-op */ } }
        sources.clear();
        for (const node of nodes) { try { node.disconnect?.(); } catch (_) { /* no-op */ } }
        nodes.clear();
        for (const url of urls) { try { scope?.URL?.revokeObjectURL?.(url); } catch (_) { /* no-op */ } }
        urls.clear();
        if (context && context.state !== "closed") { try { await context.close?.(); } catch (_) { /* no-op */ } }
        context = null;
      }
    };
  }

  function makeImpulse(context, duration, decay) {
    const length = Math.max(1, Math.floor(context.sampleRate * duration));
    const buffer = context.createBuffer(2, length, context.sampleRate);
    for (let channel = 0; channel < 2; channel += 1) {
      const data = buffer.getChannelData(channel);
      for (let index = 0; index < length; index += 1) {
        data[index] = (Math.random() * 2 - 1) * Math.pow(1 - index / length, decay);
      }
    }
    return buffer;
  }

  function setAudioParam(param, value, time) {
    if (!param) return;
    if (typeof param.setValueAtTime === "function") param.setValueAtTime(value, time || 0);
    else param.value = value;
  }

  function configureBiquad(node, type, frequency, gain, contextTime) {
    node.type = type;
    setAudioParam(node.frequency, frequency, contextTime);
    if (node.gain) setAudioParam(node.gain, gain, contextTime);
    if (node.Q && type === "peaking") setAudioParam(node.Q, 0.8, contextTime);
  }

  function configureCompressor(node, settings, ceiling, contextTime) {
    const bypass = ceiling == null && settings.enabled === false;
    setAudioParam(node.threshold, bypass ? 0 : (ceiling == null ? settings.threshold : ceiling), contextTime);
    setAudioParam(node.ratio, bypass ? 1 : (ceiling == null ? settings.ratio : 20), contextTime);
    setAudioParam(node.attack, bypass ? 0 : (ceiling == null ? settings.attack : 0.003), contextTime);
    setAudioParam(node.release, bypass ? 0.01 : (ceiling == null ? settings.release : 0.08), contextTime);
    if (node.knee) setAudioParam(node.knee, bypass ? 0 : (ceiling == null ? 12 : 0), contextTime);
  }

  function setStereoWidthNodes(nodes, width, contextTime) {
    const amount = clampRange(width, PARAM_RANGES.stereoWidth, 1);
    const direct = (1 + amount) / 2;
    const cross = (1 - amount) / 2;
    setAudioParam(nodes.leftToLeft.gain, direct, contextTime);
    setAudioParam(nodes.leftToRight.gain, cross, contextTime);
    setAudioParam(nodes.rightToLeft.gain, cross, contextTime);
    setAudioParam(nodes.rightToRight.gain, direct, contextTime);
  }

  function applyAutomation(param, points, mapper, context, offset) {
    if (!param || !Array.isArray(points) || !points.length) return;
    const startOffset = Math.max(0, offset || 0);
    const now = context.currentTime;
    try { param.cancelScheduledValues(now); } catch (_) { /* old browser */ }
    const earlier = points.filter((point) => point.time <= startOffset).at(-1);
    setAudioParam(param, mapper(earlier ? earlier.value : points[0].value), now);
    points.filter((point) => point.time > startOffset).forEach((point) => {
      const at = now + point.time - startOffset;
      if (typeof param.linearRampToValueAtTime === "function") param.linearRampToValueAtTime(mapper(point.value), at);
      else setAudioParam(param, mapper(point.value), at);
    });
  }

  function createAudioGraph(runtime) {
    const context = runtime.context;
    const state = runtime.state;
    const tracker = runtime.tracker;
    const now = context.currentTime;
    const masterInput = tracker.addNode(context.createGain());
    const masterLow = tracker.addNode(context.createBiquadFilter());
    const masterMid = tracker.addNode(context.createBiquadFilter());
    const masterHigh = tracker.addNode(context.createBiquadFilter());
    const masterComp = tracker.addNode(context.createDynamicsCompressor());
    const limiter = tracker.addNode(context.createDynamicsCompressor());
    const stereoSplitter = tracker.addNode(context.createChannelSplitter(2));
    const stereoMerger = tracker.addNode(context.createChannelMerger(2));
    const leftToLeft = tracker.addNode(context.createGain());
    const leftToRight = tracker.addNode(context.createGain());
    const rightToLeft = tracker.addNode(context.createGain());
    const rightToRight = tracker.addNode(context.createGain());
    const masterOutput = tracker.addNode(context.createGain());
    const analyser = tracker.addNode(context.createAnalyser());
    const reverbInput = tracker.addNode(context.createGain());
    const convolver = tracker.addNode(context.createConvolver());
    const reverbReturn = tracker.addNode(context.createGain());
    const delayInput = tracker.addNode(context.createGain());
    const delay = tracker.addNode(context.createDelay(2));
    const delayFeedback = tracker.addNode(context.createGain());
    const delayReturn = tracker.addNode(context.createGain());

    configureBiquad(masterLow, "lowshelf", 120, state.master.lowDb, now);
    configureBiquad(masterMid, "peaking", 1500, state.master.midDb, now);
    configureBiquad(masterHigh, "highshelf", 9000, state.master.highDb, now);
    configureCompressor(masterComp, state.master.compressor, null, now);
    configureCompressor(limiter, state.master.compressor, state.master.ceilingDb, now);
    setAudioParam(masterInput.gain, dbToGain(state.master.inputGainDb), now);
    setAudioParam(masterOutput.gain, dbToGain(state.master.outputGainDb), now);
    setStereoWidthNodes({ leftToLeft, leftToRight, rightToLeft, rightToRight }, state.master.stereoWidth, now);
    analyser.fftSize = 2048;
    analyser.smoothingTimeConstant = 0.78;
    convolver.buffer = makeImpulse(context, state.master.reverb.duration, state.master.reverb.decay);
    setAudioParam(reverbReturn.gain, state.master.reverb.wet, now);
    setAudioParam(delay.delayTime, state.master.delay.time, now);
    setAudioParam(delayFeedback.gain, state.master.delay.feedback, now);
    setAudioParam(delayReturn.gain, state.master.delay.wet, now);

    masterInput.connect(masterLow).connect(masterMid).connect(masterHigh).connect(masterComp).connect(limiter).connect(stereoSplitter);
    stereoSplitter.connect(leftToLeft, 0); stereoSplitter.connect(leftToRight, 0);
    stereoSplitter.connect(rightToLeft, 1); stereoSplitter.connect(rightToRight, 1);
    leftToLeft.connect(stereoMerger, 0, 0); rightToLeft.connect(stereoMerger, 0, 0);
    leftToRight.connect(stereoMerger, 0, 1); rightToRight.connect(stereoMerger, 0, 1);
    stereoMerger.connect(masterOutput).connect(analyser).connect(context.destination);
    reverbInput.connect(convolver).connect(reverbReturn).connect(masterInput);
    delayInput.connect(delay).connect(delayReturn).connect(masterInput);
    delay.connect(delayFeedback).connect(delay);

    const anySolo = state.channels.some((channel) => channel.solo);
    const channels = new Map();
    state.channels.forEach((channel) => {
      const dry = tracker.addNode(context.createGain());
      const input = tracker.addNode(context.createGain());
      const low = tracker.addNode(context.createBiquadFilter());
      const mid = tracker.addNode(context.createBiquadFilter());
      const high = tracker.addNode(context.createBiquadFilter());
      const compressor = tracker.addNode(context.createDynamicsCompressor());
      const panner = tracker.addNode(context.createStereoPanner ? context.createStereoPanner() : context.createGain());
      const wet = tracker.addNode(context.createGain());
      const sendReverb = tracker.addNode(context.createGain());
      const sendDelay = tracker.addNode(context.createGain());
      configureBiquad(low, "lowshelf", channel.eq.lowHz, channel.eq.lowDb, now);
      configureBiquad(mid, "peaking", channel.eq.midHz, channel.eq.midDb, now);
      configureBiquad(high, "highshelf", channel.eq.highHz, channel.eq.highDb, now);
      configureCompressor(compressor, channel.compressor, null, now);
      setAudioParam(input.gain, dbToGain(channel.gainDb), now);
      if (panner.pan) setAudioParam(panner.pan, channel.pan, now);
      const audible = !channel.mute && (!anySolo || channel.solo);
      setAudioParam(dry.gain, state.bypass && audible ? 1 : 0, now);
      setAudioParam(wet.gain, !state.bypass && audible ? 1 : 0, now);
      setAudioParam(sendReverb.gain, audible ? channel.sends.reverb : 0, now);
      setAudioParam(sendDelay.gain, audible ? channel.sends.delay : 0, now);
      input.connect(low).connect(mid).connect(high).connect(compressor).connect(panner).connect(wet).connect(masterInput);
      panner.connect(sendReverb).connect(reverbInput);
      panner.connect(sendDelay).connect(delayInput);
      dry.connect(masterInput);
      channels.set(channel.id, { dry, input, low, mid, high, compressor, panner, wet, sendReverb, sendDelay });
    });
    return {
      masterInput, masterLow, masterMid, masterHigh, masterComp, limiter, masterOutput, analyser,
      stereoSplitter, stereoMerger, leftToLeft, leftToRight, rightToLeft, rightToRight,
      reverbInput, convolver, reverbReturn, delayInput, delay, delayFeedback, delayReturn, channels
    };
  }

  function disconnectGraph(runtime) {
    if (!runtime?.graph) return;
    Object.values(runtime.graph).forEach((value) => {
      if (value instanceof Map) return;
      try { value?.disconnect?.(); } catch (_) { /* no-op */ }
      runtime.tracker.removeNode(value);
    });
    runtime.graph.channels?.forEach((channel) => Object.values(channel).forEach((node) => {
      try { node.disconnect?.(); } catch (_) { /* no-op */ }
      runtime.tracker.removeNode(node);
    }));
    runtime.graph = null;
  }

  async function ensureContext(runtime) {
    if (runtime.context && runtime.context.state !== "closed") return runtime.context;
    const AudioContextClass = globalScope.AudioContext || globalScope.webkitAudioContext;
    if (!AudioContextClass) throw new Error("Trình duyệt không hỗ trợ Web Audio API.");
    runtime.context = new AudioContextClass();
    runtime.tracker.setContext(runtime.context);
    runtime.graph = createAudioGraph(runtime);
    return runtime.context;
  }

  function stopSources(runtime, preserveOffset) {
    if (!runtime) return;
    if (preserveOffset && runtime.playing && runtime.context) {
      runtime.state.currentTime = Math.max(0, runtime.playOffset + runtime.context.currentTime - runtime.startedAt);
    }
    for (const source of runtime.sources) {
      try { source.stop(); } catch (_) { /* source already stopped */ }
      try { source.disconnect(); } catch (_) { /* no-op */ }
      runtime.tracker.removeSource(source);
    }
    runtime.sources.clear();
    runtime.playing = false;
    stopMeters(runtime);
  }

  function scheduleChannelAutomation(runtime, channel) {
    const graph = runtime.graph?.channels?.get(channel.id);
    if (!graph) return;
    applyAutomation(graph.input.gain, channel.automation.gain, dbToGain, runtime.context, runtime.state.currentTime);
    if (graph.panner.pan) applyAutomation(graph.panner.pan, channel.automation.pan, (value) => value, runtime.context, runtime.state.currentTime);
  }

  async function play(runtime) {
    const context = await ensureContext(runtime);
    await context.resume?.();
    stopSources(runtime, false);
    const loaded = runtime.state.channels.filter((channel) => runtime.buffers.has(channel.id));
    if (!loaded.length) throw new Error("Hãy tải ít nhất một tệp âm thanh trước khi phát.");
    const maxDuration = Math.max(...loaded.map((channel) => runtime.buffers.get(channel.id).duration));
    if (runtime.state.currentTime >= maxDuration) runtime.state.currentTime = 0;
    runtime.playOffset = runtime.state.currentTime;
    runtime.startedAt = context.currentTime;
    runtime.playing = true;
    loaded.forEach((channel) => {
      const source = runtime.tracker.addSource(context.createBufferSource());
      const channelGraph = runtime.graph.channels.get(channel.id);
      source.buffer = runtime.buffers.get(channel.id);
      source.connect(channelGraph.dry);
      source.connect(channelGraph.input);
      scheduleChannelAutomation(runtime, channel);
      source.onended = () => {
        runtime.sources.delete(source);
        runtime.tracker.removeSource(source);
        if (!runtime.sources.size && runtime.playing) {
          runtime.playing = false;
          stopMeters(runtime);
          if (runtime.state.loop) { runtime.state.currentTime = 0; play(runtime).catch(() => {}); }
          else runtime.state.currentTime = 0;
        }
      };
      source.start(0, Math.min(runtime.state.currentTime, Math.max(0, source.buffer.duration - 0.001)));
      runtime.sources.add(source);
    });
    startMeters(runtime);
    updateTransport(runtime);
  }

  function updateGraph(runtime) {
    if (!runtime?.context || runtime.context.state === "closed") return;
    const state = runtime.state;
    const graph = runtime.graph;
    const now = runtime.context.currentTime;
    const anySolo = state.channels.some((channel) => channel.solo);
    state.channels.forEach((channel) => {
      const nodes = graph.channels.get(channel.id);
      if (!nodes) return;
      setAudioParam(nodes.input.gain, dbToGain(channel.gainDb), now);
      if (nodes.panner.pan) setAudioParam(nodes.panner.pan, channel.pan, now);
      setAudioParam(nodes.low.gain, channel.eq.lowDb, now);
      setAudioParam(nodes.mid.gain, channel.eq.midDb, now);
      setAudioParam(nodes.high.gain, channel.eq.highDb, now);
      configureCompressor(nodes.compressor, channel.compressor, null, now);
      const audible = !channel.mute && (!anySolo || channel.solo);
      setAudioParam(nodes.dry.gain, state.bypass && audible ? 1 : 0, now);
      setAudioParam(nodes.wet.gain, !state.bypass && audible ? 1 : 0, now);
      setAudioParam(nodes.sendReverb.gain, audible ? channel.sends.reverb : 0, now);
      setAudioParam(nodes.sendDelay.gain, audible ? channel.sends.delay : 0, now);
    });
    setAudioParam(graph.masterInput.gain, dbToGain(state.master.inputGainDb), now);
    setAudioParam(graph.masterOutput.gain, dbToGain(state.master.outputGainDb), now);
    setAudioParam(graph.masterLow.gain, state.master.lowDb, now);
    setAudioParam(graph.masterMid.gain, state.master.midDb, now);
    setAudioParam(graph.masterHigh.gain, state.master.highDb, now);
    configureCompressor(graph.masterComp, state.master.compressor, null, now);
    configureCompressor(graph.limiter, state.master.compressor, state.master.ceilingDb, now);
    setStereoWidthNodes(graph, state.master.stereoWidth, now);
    setAudioParam(graph.reverbReturn.gain, state.master.reverb.wet, now);
    setAudioParam(graph.delay.delayTime, state.master.delay.time, now);
    setAudioParam(graph.delayFeedback.gain, state.master.delay.feedback, now);
    setAudioParam(graph.delayReturn.gain, state.master.delay.wet, now);
  }

  async function loadAudioFiles(runtime, files, preferredChannelId) {
    const context = await ensureContext(runtime);
    const accepted = Array.from(files || []).filter((file) => file && (!file.type || file.type.startsWith("audio/"))).slice(0, 24);
    if (!accepted.length) throw new Error("Không tìm thấy tệp âm thanh hợp lệ.");
    let nextIndex = Math.max(0, runtime.state.channels.findIndex((channel) => channel.id === preferredChannelId));
    for (const file of accepted) {
      let channel = runtime.state.channels[nextIndex];
      if (!channel || channel.file) {
        channel = normalizeChannel({ id: uid("channel"), name: file.name.replace(/\.[^.]+$/, "") }, runtime.state.channels.length);
        runtime.state.channels.push(channel);
      }
      const arrayBuffer = await file.arrayBuffer();
      const decoded = await context.decodeAudioData(arrayBuffer.slice(0));
      runtime.buffers.set(channel.id, decoded);
      channel.name = safeText(file.name.replace(/\.[^.]+$/, ""), 60) || channel.name;
      channel.file = { name: safeText(file.name, 180), type: safeText(file.type || "audio", 80), size: file.size || arrayBuffer.byteLength, duration: decoded.duration };
      if (globalScope.URL?.createObjectURL) runtime.fileUrls.set(channel.id, runtime.tracker.addUrl(globalScope.URL.createObjectURL(file)));
      nextIndex += 1;
    }
    rebuildGraph(runtime);
    persist(runtime);
    render(runtime);
    return accepted.length;
  }

  function rebuildGraph(runtime) {
    if (!runtime.context || runtime.context.state === "closed") return;
    const wasPlaying = runtime.playing;
    if (wasPlaying) stopSources(runtime, true);
    disconnectGraph(runtime);
    runtime.graph = createAudioGraph(runtime);
    if (wasPlaying) play(runtime).catch((error) => showNotice(runtime, error.message, "error"));
  }

  function durationOf(runtime) {
    let duration = 0;
    runtime.buffers.forEach((buffer) => { duration = Math.max(duration, buffer.duration || 0); });
    return duration;
  }

  function currentTimeOf(runtime) {
    if (!runtime.playing || !runtime.context) return runtime.state.currentTime;
    const duration = durationOf(runtime);
    const value = runtime.playOffset + runtime.context.currentTime - runtime.startedAt;
    return duration && runtime.state.loop ? value % duration : Math.min(duration || value, value);
  }

  function formatTime(seconds) {
    const value = Math.max(0, Number(seconds) || 0);
    const minutes = Math.floor(value / 60);
    return `${String(minutes).padStart(2, "0")}:${String(Math.floor(value % 60)).padStart(2, "0")}.${String(Math.floor((value % 1) * 10))}`;
  }

  function waveformPath(buffer, width, height) {
    if (!buffer?.getChannelData) return [];
    const data = buffer.getChannelData(0);
    const buckets = Math.max(1, Math.floor(width));
    const step = Math.max(1, Math.floor(data.length / buckets));
    const points = [];
    for (let x = 0; x < buckets; x += 1) {
      let min = 1;
      let max = -1;
      const start = x * step;
      for (let index = start; index < Math.min(data.length, start + step); index += 1) {
        min = Math.min(min, data[index]); max = Math.max(max, data[index]);
      }
      points.push([x, (1 + min) * height / 2, (1 + max) * height / 2]);
    }
    return points;
  }

  function resizeCanvas(canvas) {
    if (!canvas) return null;
    const ratio = Math.min(2, globalScope.devicePixelRatio || 1);
    const rect = canvas.getBoundingClientRect?.() || { width: canvas.clientWidth || 640, height: canvas.clientHeight || 160 };
    const width = Math.max(1, Math.floor(rect.width * ratio));
    const height = Math.max(1, Math.floor(rect.height * ratio));
    if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height; }
    const context = canvas.getContext?.("2d");
    if (context) context.setTransform(ratio, 0, 0, ratio, 0, 0);
    return { context, width: rect.width, height: rect.height };
  }

  function drawTimeline(runtime) {
    const canvas = runtime.host.querySelector?.("[data-mm-timeline]");
    const sized = resizeCanvas(canvas);
    if (!sized?.context) return;
    const { context, width, height } = sized;
    context.clearRect(0, 0, width, height);
    context.fillStyle = "#080d15"; context.fillRect(0, 0, width, height);
    const rowHeight = Math.max(42, height / Math.max(1, runtime.state.channels.length));
    runtime.state.channels.forEach((channel, index) => {
      const y = index * rowHeight;
      context.fillStyle = index % 2 ? "rgba(255,255,255,.025)" : "rgba(255,255,255,.045)";
      context.fillRect(0, y, width, rowHeight - 1);
      const buffer = runtime.buffers.get(channel.id);
      if (buffer) {
        context.fillStyle = `${channel.color}33`; context.fillRect(4, y + 5, width - 8, rowHeight - 10);
        context.strokeStyle = channel.color; context.lineWidth = 1;
        context.beginPath();
        waveformPath(buffer, Math.max(1, width - 12), rowHeight - 12).forEach(([x, min, max]) => {
          context.moveTo(x + 6, y + 6 + min); context.lineTo(x + 6, y + 6 + max);
        });
        context.stroke();
      } else {
        context.fillStyle = "#7f8ca1"; context.font = "12px system-ui";
        context.fillText(`${channel.name} · chưa có audio`, 14, y + rowHeight / 2 + 4);
      }
    });
    const duration = durationOf(runtime);
    if (duration > 0) {
      const x = Math.min(width, currentTimeOf(runtime) / duration * width);
      context.strokeStyle = "#ff5fbd"; context.lineWidth = 2; context.beginPath(); context.moveTo(x, 0); context.lineTo(x, height); context.stroke();
    }
  }

  function drawSpectrum(runtime, frequencyData) {
    const canvas = runtime.host.querySelector?.("[data-mm-spectrum]");
    const sized = resizeCanvas(canvas);
    if (!sized?.context) return;
    const { context, width, height } = sized;
    const gradient = context.createLinearGradient(0, height, width, 0);
    gradient.addColorStop(0, "#67dba1"); gradient.addColorStop(0.5, "#66dce8"); gradient.addColorStop(1, "#ff5fbd");
    context.clearRect(0, 0, width, height); context.fillStyle = "#080d15"; context.fillRect(0, 0, width, height);
    context.beginPath();
    const count = Math.min(frequencyData?.length || 0, 160);
    for (let index = 0; index < count; index += 1) {
      const x = index / Math.max(1, count - 1) * width;
      const y = height - (frequencyData[index] / 255) * height;
      if (!index) context.moveTo(x, y); else context.lineTo(x, y);
    }
    context.lineTo(width, height); context.lineTo(0, height); context.closePath();
    context.fillStyle = gradient; context.globalAlpha = 0.7; context.fill(); context.globalAlpha = 1;
  }

  function drawStereo(runtime, timeData) {
    const canvas = runtime.host.querySelector?.("[data-mm-stereo]");
    const sized = resizeCanvas(canvas);
    if (!sized?.context) return;
    const { context, width, height } = sized;
    context.clearRect(0, 0, width, height); context.fillStyle = "#080d15"; context.fillRect(0, 0, width, height);
    context.strokeStyle = "rgba(102,220,232,.18)"; context.beginPath(); context.moveTo(width / 2, 0); context.lineTo(width / 2, height); context.moveTo(0, height / 2); context.lineTo(width, height / 2); context.stroke();
    if (!timeData?.length) return;
    context.fillStyle = "#8af3d0";
    for (let index = 0; index < timeData.length; index += 8) {
      const sample = timeData[index] || 0;
      const next = timeData[Math.min(timeData.length - 1, index + 3)] || 0;
      const x = width / 2 + (sample - next) * width * 0.38;
      const y = height / 2 - (sample + next) * height * 0.38;
      context.fillRect(x, y, 1.5, 1.5);
    }
  }

  function startMeters(runtime) {
    if (runtime.meterFrame != null) return;
    const loop = () => {
      runtime.tracker.removeFrame(runtime.meterFrame);
      runtime.meterFrame = null;
      if (!active || active !== runtime || !runtime.graph?.analyser) return;
      const analyser = runtime.graph.analyser;
      const timeData = new Float32Array(analyser.fftSize);
      const frequencyData = new Uint8Array(analyser.frequencyBinCount);
      analyser.getFloatTimeDomainData(timeData);
      analyser.getByteFrequencyData(frequencyData);
      const metrics = estimateMetrics(timeData);
      runtime.metrics = metrics;
      updateMeters(runtime, metrics);
      drawSpectrum(runtime, frequencyData); drawStereo(runtime, timeData); drawTimeline(runtime); updateTransport(runtime);
      runtime.meterFrame = runtime.tracker.addFrame(globalScope.requestAnimationFrame?.(loop));
    };
    runtime.meterFrame = runtime.tracker.addFrame(globalScope.requestAnimationFrame?.(loop));
  }

  function stopMeters(runtime) {
    if (!runtime || runtime.meterFrame == null) return;
    try { globalScope.cancelAnimationFrame?.(runtime.meterFrame); } catch (_) { /* no-op */ }
    runtime.tracker.removeFrame(runtime.meterFrame);
    runtime.meterFrame = null;
  }

  function updateMeters(runtime, metrics) {
    const values = {
      peak: `${metrics.peakDb.toFixed(1)} dBFS`, rms: `${metrics.rmsDb.toFixed(1)} dBFS`,
      truePeak: `${metrics.truePeakEstimateDb.toFixed(1)} dBTP`, lufs: `${metrics.lufsEstimate.toFixed(1)} LUFS`
    };
    Object.entries(values).forEach(([key, value]) => {
      const output = runtime.host.querySelector?.(`[data-mm-meter="${key}"]`);
      if (output) output.textContent = value;
    });
    const alert = runtime.host.querySelector?.("[data-mm-clipping]");
    if (alert) {
      alert.hidden = !metrics.clipping;
      alert.textContent = metrics.clipping ? "Clipping: tín hiệu chạm 0 dBFS. Hãy giảm gain hoặc ceiling." : "";
    }
    const meter = runtime.host.querySelector?.("[data-mm-master-meter]");
    if (meter) meter.style.setProperty("--mm-level", `${Math.max(0, Math.min(100, (metrics.peakDb + 60) / 60 * 100))}%`);
  }

  function updateTransport(runtime) {
    const current = currentTimeOf(runtime);
    const duration = durationOf(runtime);
    const time = runtime.host.querySelector?.("[data-mm-time]");
    if (time) time.textContent = `${formatTime(current)} / ${formatTime(duration)}`;
    const seek = runtime.host.querySelector?.("[data-mm-seek]");
    if (seek) { seek.max = String(Math.max(0.01, duration)); seek.value = String(Math.min(duration || 0, current)); }
    const playButton = runtime.host.querySelector?.("[data-mm-action=" + '"play"' + "]");
    if (playButton) { playButton.textContent = runtime.playing ? "Tạm dừng" : "Phát"; playButton.setAttribute("aria-pressed", String(runtime.playing)); }
  }

  function persist(runtime) {
    runtime.state = saveState(runtime.state, globalScope);
  }

  function showNotice(runtime, message, tone) {
    const notice = runtime.host.querySelector?.("[data-mm-notice]");
    if (!notice) return;
    notice.textContent = safeText(message, 300);
    notice.dataset.tone = tone || "info";
  }

  function channelStrip(channel, selected) {
    return `<article class="mm-channel${selected ? " is-selected" : ""}" data-mm-channel="${escapeHtml(channel.id)}" style="--channel:${escapeHtml(channel.color)}">
      <button class="mm-channel__select" type="button" data-mm-select-channel="${escapeHtml(channel.id)}"><span class="mm-channel__dot"></span><strong>${escapeHtml(channel.name)}</strong><small>${channel.file ? escapeHtml(formatTime(channel.file.duration)) : "Trống"}</small></button>
      <div class="mm-channel__toggles"><button type="button" data-mm-toggle="mute" aria-pressed="${channel.mute}">M</button><button type="button" data-mm-toggle="solo" aria-pressed="${channel.solo}">S</button></div>
      <label>Gain <output>${channel.gainDb.toFixed(1)} dB</output><input type="range" min="-60" max="12" step="0.1" value="${channel.gainDb}" data-mm-channel-param="gainDb"></label>
      <label>Pan <output>${channel.pan.toFixed(2)}</output><input type="range" min="-1" max="1" step="0.01" value="${channel.pan}" data-mm-channel-param="pan"></label>
      <div class="mm-channel__meter"><i></i></div>
    </article>`;
  }

  function mixerFader(channel) {
    return `<article class="mm-fader" style="--channel:${escapeHtml(channel.color)}"><strong>${escapeHtml(channel.name)}</strong>
      <div class="mm-fader__rail"><input aria-label="Gain ${escapeHtml(channel.name)}" type="range" orient="vertical" min="-60" max="12" step="0.1" value="${channel.gainDb}" data-mm-fader="${escapeHtml(channel.id)}"></div>
      <output>${channel.gainDb.toFixed(1)}</output><div><button type="button" data-mm-fader-toggle="mute" data-channel-id="${escapeHtml(channel.id)}" aria-pressed="${channel.mute}">M</button><button type="button" data-mm-fader-toggle="solo" data-channel-id="${escapeHtml(channel.id)}" aria-pressed="${channel.solo}">S</button></div>
    </article>`;
  }

  function rangeField(label, path, value, min, max, step, suffix) {
    return `<label class="mm-control"><span>${escapeHtml(label)} <output>${Number(value).toFixed(step < 0.1 ? 2 : 1)}${escapeHtml(suffix || "")}</output></span><input type="range" min="${min}" max="${max}" step="${step}" value="${value}" data-mm-path="${escapeHtml(path)}"></label>`;
  }

  function renderInspector(runtime) {
    const state = runtime.state;
    if (state.view === "master") {
      const labels = getMeterLabels(globalScope);
      return `<section class="mm-inspector" aria-label="Mastering controls">
        <header><div><small>MASTER CHAIN</small><h2>Finalizer</h2></div><span class="mm-chip">Không phá hủy</span></header>
        <div class="mm-preset-grid">${Object.values(MASTER_PRESETS).map((preset) => `<button type="button" data-mm-preset="${preset.id}" class="${state.master.preset === preset.id ? "is-active" : ""}"><strong>${escapeHtml(preset.label)}</strong><small>${escapeHtml(preset.target)}</small></button>`).join("")}</div>
        <fieldset><legend>Gain & Stereo</legend>${rangeField("Input", "master.inputGainDb", state.master.inputGainDb, -24, 12, 0.1, " dB")}${rangeField("Output", "master.outputGainDb", state.master.outputGainDb, -24, 3, 0.1, " dB")}${rangeField("Stereo width", "master.stereoWidth", state.master.stereoWidth, 0, 2, 0.01, "×")}</fieldset>
        <fieldset><legend>Master EQ</legend>${rangeField("Low", "master.lowDb", state.master.lowDb, -18, 18, 0.1, " dB")}${rangeField("Mid", "master.midDb", state.master.midDb, -18, 18, 0.1, " dB")}${rangeField("High", "master.highDb", state.master.highDb, -18, 18, 0.1, " dB")}</fieldset>
        <fieldset><legend>Glue Compressor</legend>${rangeField("Threshold", "master.compressor.threshold", state.master.compressor.threshold, -60, 0, 0.1, " dB")}${rangeField("Ratio", "master.compressor.ratio", state.master.compressor.ratio, 1, 20, 0.1, ":1")}</fieldset>
        <fieldset><legend>Limiter</legend>${rangeField("Ceiling", "master.ceilingDb", state.master.ceilingDb, -12, 0, 0.1, " dBTP")}</fieldset>
        <fieldset><legend>Return FX</legend>${rangeField("Reverb wet", "master.reverb.wet", state.master.reverb.wet, 0, 1, 0.01, "")}${rangeField("Delay time", "master.delay.time", state.master.delay.time, 0, 2, 0.01, " s")}${rangeField("Feedback", "master.delay.feedback", state.master.delay.feedback, 0, 0.9, 0.01, "")}${rangeField("Delay wet", "master.delay.wet", state.master.delay.wet, 0, 1, 0.01, "")}</fieldset>
        <div class="mm-meter-note"><strong>${escapeHtml(labels.lufs)} · ${escapeHtml(labels.truePeak)}</strong><p>${escapeHtml(labels.note)}</p></div>
      </section>`;
    }
    const selected = state.channels.find((channel) => channel.id === state.selectedChannelId) || state.channels[0];
    return `<section class="mm-inspector" aria-label="Channel properties">
      <header><div><small>CHANNEL</small><h2>${escapeHtml(selected.name)}</h2></div><input type="color" aria-label="Màu channel" value="${escapeHtml(selected.color)}" data-mm-channel-color></header>
      <label class="mm-text-field">Tên track<input value="${escapeHtml(selected.name)}" maxlength="60" data-mm-channel-name></label>
      <fieldset><legend>EQ ba băng tần</legend>${rangeField("Low", "selected.eq.lowDb", selected.eq.lowDb, -18, 18, 0.1, " dB")}${rangeField("Mid", "selected.eq.midDb", selected.eq.midDb, -18, 18, 0.1, " dB")}${rangeField("High", "selected.eq.highDb", selected.eq.highDb, -18, 18, 0.1, " dB")}</fieldset>
      <fieldset><legend>Compressor</legend><label class="mm-check"><input type="checkbox" data-mm-compressor-enabled ${selected.compressor.enabled ? "checked" : ""}> Bật compressor</label>${rangeField("Threshold", "selected.compressor.threshold", selected.compressor.threshold, -60, 0, 0.1, " dB")}${rangeField("Ratio", "selected.compressor.ratio", selected.compressor.ratio, 1, 20, 0.1, ":1")}</fieldset>
      <fieldset><legend>Send FX</legend>${rangeField("Reverb", "selected.sends.reverb", selected.sends.reverb, 0, 1, 0.01, "")}${rangeField("Delay", "selected.sends.delay", selected.sends.delay, 0, 1, 0.01, "")}</fieldset>
      <fieldset><legend>Automation</legend><div class="mm-inline"><select data-mm-automation-kind aria-label="Automation parameter"><option value="gain">Gain</option><option value="pan">Pan</option></select><button type="button" data-mm-action="add-automation">+ Điểm tại playhead</button></div><div class="mm-automation">${[...selected.automation.gain.map((point) => ({ ...point, kind: "gain" })), ...selected.automation.pan.map((point) => ({ ...point, kind: "pan" }))].sort((a, b) => a.time - b.time).map((point) => `<button type="button" data-mm-remove-automation="${escapeHtml(point.id)}" data-kind="${point.kind}" title="Xóa điểm">${escapeHtml(point.kind)} · ${formatTime(point.time)} · ${Number(point.value).toFixed(1)} ×</button>`).join("") || "<p>Chưa có điểm automation.</p>"}</div></fieldset>
    </section>`;
  }

  function render(runtime) {
    const state = runtime.state;
    const labels = getMeterLabels(globalScope);
    const selected = state.channels.find((channel) => channel.id === state.selectedChannelId) || state.channels[0];
    runtime.host.innerHTML = `<main class="mm-studio" data-mm-view="${state.view}">
      <header class="mm-topbar"><div class="mm-brand"><span>MM</span><div><small>HH AUDIO ENGINE</small><h1>Mix & Master Pro</h1></div></div>
        <nav aria-label="Không gian làm việc"><button type="button" data-mm-view-button="mix" class="${state.view === "mix" ? "is-active" : ""}">Mix</button><button type="button" data-mm-view-button="master" class="${state.view === "master" ? "is-active" : ""}">Master</button></nav>
        <div class="mm-top-actions"><button type="button" data-mm-action="ab" aria-label="Chuyển cấu hình A B">A/B: ${state.ab.active}</button><button type="button" data-mm-action="save-ab">Lưu ${state.ab.active}</button><button type="button" data-mm-action="bypass" aria-pressed="${state.bypass}">${state.bypass ? "Before" : "After"}</button><button class="is-primary" type="button" data-mm-action="export">Xuất</button></div>
      </header>
      <div class="mm-notice" data-mm-notice role="status" aria-live="polite">Mọi xử lý nằm trên thiết bị. Bản gốc không bị thay đổi.</div>
      <section class="mm-workbench">
        <aside class="mm-library" aria-label="Project and audio library"><header><div><small>PROJECT</small><input aria-label="Tên dự án" value="${escapeHtml(state.projectName)}" maxlength="100" data-mm-project-name></div><button type="button" data-mm-action="add-channel" title="Thêm channel">+</button></header>
          <label class="mm-dropzone" data-mm-dropzone><input type="file" accept="audio/*" multiple data-mm-file><span>＋</span><strong>Thêm audio / stems</strong><small>Kéo thả WAV, MP3, M4A, OGG hoặc FLAC trình duyệt hỗ trợ</small></label>
          <div class="mm-library__list">${state.channels.map((channel) => channelStrip(channel, channel.id === selected.id)).join("")}</div>
          <section class="mm-buses"><h3>Bus & Return</h3><button type="button"><i style="--bus:#67dba1"></i>MASTER <span>OUT</span></button><button type="button"><i style="--bus:#9f8cff"></i>REVERB <span>${Math.round(state.master.reverb.wet * 100)}%</span></button><button type="button"><i style="--bus:#ffe071"></i>DELAY <span>${Math.round(state.master.delay.wet * 100)}%</span></button></section>
        </aside>
        <section class="mm-center" aria-label="Timeline and analysis"><header class="mm-center__head"><div><small>${state.view === "mix" ? "GENERATIVE TIMELINE" : "MASTER ANALYSIS"}</small><h2>${escapeHtml(state.projectName)}</h2></div><div class="mm-badges"><span>${state.channels.filter((channel) => channel.file).length} audio</span><span>${state.channels.length} tracks</span><span>Local DSP</span></div></header>
          <div class="mm-ruler" aria-hidden="true"><span>00:00</span><span>00:15</span><span>00:30</span><span>00:45</span><span>01:00</span></div>
          <canvas class="mm-timeline" data-mm-timeline aria-label="Waveform timeline"></canvas>
          <div class="mm-analysis-grid"><article><header><strong>Spectrum</strong><span>FFT 2048</span></header><canvas data-mm-spectrum aria-label="Frequency spectrum"></canvas></article><article><header><strong>Stereo field</strong><span>Vectorscope</span></header><canvas data-mm-stereo aria-label="Stereo vectorscope"></canvas></article></div>
          <div class="mm-metrics"><article><small>PEAK</small><output data-mm-meter="peak">-120.0 dBFS</output></article><article><small>RMS</small><output data-mm-meter="rms">-120.0 dBFS</output></article><article><small>${escapeHtml(labels.truePeak)}</small><output data-mm-meter="truePeak">-120.0 dBTP</output></article><article><small>${escapeHtml(labels.lufs)}</small><output data-mm-meter="lufs">-120.0 LUFS</output></article></div>
          <p class="mm-clipping" data-mm-clipping role="alert" hidden></p>
        </section>
        ${renderInspector(runtime)}
      </section>
      <footer class="mm-console"><section class="mm-transport" aria-label="Transport controls"><button type="button" data-mm-action="stop" title="Dừng">■</button><button class="is-play" type="button" data-mm-action="play" aria-pressed="false">Phát</button><button type="button" data-mm-action="loop" aria-pressed="${state.loop}">Loop</button><output data-mm-time>00:00.0 / 00:00.0</output><input aria-label="Vị trí phát" type="range" min="0" max="0.01" value="0" step="0.01" data-mm-seek></section>
        <section class="mm-mixer" aria-label="Mixer channels">${state.channels.map(mixerFader).join("")}<article class="mm-fader mm-fader--master"><strong>MASTER</strong><div class="mm-master-meter" data-mm-master-meter><i></i></div><output>${state.master.outputGainDb.toFixed(1)}</output><span>OUT</span></article></section>
        <section class="mm-export-info"><strong>${globalScope.OfflineAudioContext || globalScope.webkitOfflineAudioContext ? "Offline render sẵn sàng" : "Manifest export"}</strong><small>${globalScope.OfflineAudioContext || globalScope.webkitOfflineAudioContext ? "Có thể render WAV cục bộ" : "Trình duyệt chưa hỗ trợ OfflineAudioContext"}</small></section>
      </footer>
    </main>`;
    drawTimeline(runtime); drawSpectrum(runtime, new Uint8Array(160)); drawStereo(runtime, new Float32Array(256));
    updateTransport(runtime);
  }

  function setNested(state, path, value) {
    const parts = path.split(".");
    let target = state;
    for (let index = 0; index < parts.length - 1; index += 1) target = target[parts[index]];
    target[parts.at(-1)] = value;
  }

  function valueForPath(path, raw) {
    const ranges = {
      "master.inputGainDb": PARAM_RANGES.gainDb, "master.outputGainDb": PARAM_RANGES.gainDb,
      "master.ceilingDb": PARAM_RANGES.ceiling, "master.lowDb": PARAM_RANGES.eqDb,
      "master.midDb": PARAM_RANGES.eqDb, "master.highDb": PARAM_RANGES.eqDb,
      "master.stereoWidth": PARAM_RANGES.stereoWidth,
      "master.compressor.threshold": PARAM_RANGES.threshold, "master.compressor.ratio": PARAM_RANGES.ratio,
      "master.reverb.wet": PARAM_RANGES.send, "master.delay.time": PARAM_RANGES.delay,
      "master.delay.feedback": PARAM_RANGES.feedback, "master.delay.wet": PARAM_RANGES.send,
      "selected.eq.lowDb": PARAM_RANGES.eqDb, "selected.eq.midDb": PARAM_RANGES.eqDb, "selected.eq.highDb": PARAM_RANGES.eqDb,
      "selected.compressor.threshold": PARAM_RANGES.threshold, "selected.compressor.ratio": PARAM_RANGES.ratio,
      "selected.sends.reverb": PARAM_RANGES.send, "selected.sends.delay": PARAM_RANGES.send
    };
    return clampRange(raw, ranges[path] || [-999, 999], 0);
  }

  function selectedChannel(runtime) {
    return runtime.state.channels.find((channel) => channel.id === runtime.state.selectedChannelId) || runtime.state.channels[0];
  }

  function applyPreset(runtime, presetId) {
    const preset = MASTER_PRESETS[presetId];
    if (!preset) return;
    runtime.state.master = normalizeMaster({ ...runtime.state.master, ...clone(preset), preset: presetId });
    runtime.state.ab[runtime.state.ab.active] = clone(runtime.state.master);
    updateGraph(runtime); persist(runtime); render(runtime);
    showNotice(runtime, `Đã nạp preset ${preset.label}. Mục tiêu loudness chỉ là tham chiếu cho tới khi đo bằng analyzer đạt chuẩn.`, "success");
  }

  function downloadBlob(runtime, blob, filename) {
    if (!globalScope.URL?.createObjectURL || !globalScope.document?.createElement) return false;
    const url = runtime.tracker.addUrl(globalScope.URL.createObjectURL(blob));
    const link = globalScope.document.createElement("a");
    link.href = url; link.download = filename; link.hidden = true;
    globalScope.document.body?.appendChild(link); link.click(); link.remove();
    globalScope.setTimeout?.(() => {
      try { globalScope.URL.revokeObjectURL(url); } catch (_) { /* no-op */ }
      runtime.tracker.removeUrl(url);
    }, 1000);
    return true;
  }

  function buildProcessingManifest(state, runtime) {
    const normalized = normalizeState(state);
    return {
      format: "hh-mix-master-manifest", version: VERSION, createdAt: new Date().toISOString(),
      project: normalized.projectName, nonDestructive: true,
      sourceFiles: normalized.channels.filter((channel) => channel.file).map((channel) => ({ channelId: channel.id, ...channel.file })),
      channels: normalized.channels.map((channel) => ({ ...channel, file: channel.file ? { ...channel.file } : null })),
      master: normalized.master, activeAB: normalized.ab.active,
      metering: { truePeak: "estimate-unless-standards-analyzer-loaded", lufs: "estimate-unless-itu-r-bs1770-analyzer-loaded" },
      renderCapability: Boolean((runtime || globalScope).OfflineAudioContext || (runtime || globalScope).webkitOfflineAudioContext),
      notice: "Tệp manifest lưu cấu hình DSP, không chứa audio và không thay đổi tệp nguồn."
    };
  }

  function encodeWav(audioBuffer) {
    const channels = Math.min(2, audioBuffer.numberOfChannels);
    const length = audioBuffer.length * channels * 2 + 44;
    const buffer = new ArrayBuffer(length);
    const view = new DataView(buffer);
    const writeString = (offset, text) => { for (let index = 0; index < text.length; index += 1) view.setUint8(offset + index, text.charCodeAt(index)); };
    writeString(0, "RIFF"); view.setUint32(4, length - 8, true); writeString(8, "WAVE"); writeString(12, "fmt ");
    view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, channels, true);
    view.setUint32(24, audioBuffer.sampleRate, true); view.setUint32(28, audioBuffer.sampleRate * channels * 2, true);
    view.setUint16(32, channels * 2, true); view.setUint16(34, 16, true); writeString(36, "data"); view.setUint32(40, length - 44, true);
    const data = Array.from({ length: channels }, (_, channel) => audioBuffer.getChannelData(channel));
    let offset = 44;
    for (let frame = 0; frame < audioBuffer.length; frame += 1) {
      for (let channel = 0; channel < channels; channel += 1) {
        const sample = Math.max(-1, Math.min(1, data[channel][frame] || 0));
        view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true); offset += 2;
      }
    }
    return new Blob([buffer], { type: "audio/wav" });
  }

  async function renderOffline(runtime) {
    const OfflineClass = globalScope.OfflineAudioContext || globalScope.webkitOfflineAudioContext;
    if (!OfflineClass) throw new Error("OfflineAudioContext chưa được hỗ trợ. Hệ thống sẽ xuất manifest thay thế.");
    const loaded = runtime.state.channels.filter((channel) => runtime.buffers.has(channel.id));
    if (!loaded.length) throw new Error("Chưa có audio để render.");
    const sampleRate = Math.min(48000, Math.max(...loaded.map((channel) => runtime.buffers.get(channel.id).sampleRate || 44100)));
    const duration = Math.min(600, Math.max(...loaded.map((channel) => runtime.buffers.get(channel.id).duration || 0)));
    const offline = new OfflineClass(2, Math.ceil(duration * sampleRate), sampleRate);
    const masterIn = offline.createGain();
    const masterLow = offline.createBiquadFilter();
    const masterMid = offline.createBiquadFilter();
    const masterHigh = offline.createBiquadFilter();
    const comp = offline.createDynamicsCompressor();
    const limiter = offline.createDynamicsCompressor();
    const stereoSplitter = offline.createChannelSplitter(2);
    const stereoMerger = offline.createChannelMerger(2);
    const leftToLeft = offline.createGain(); const leftToRight = offline.createGain();
    const rightToLeft = offline.createGain(); const rightToRight = offline.createGain();
    const out = offline.createGain();
    const reverbInput = offline.createGain();
    const convolver = offline.createConvolver();
    const reverbReturn = offline.createGain();
    const delayInput = offline.createGain();
    const delay = offline.createDelay(2);
    const delayFeedback = offline.createGain();
    const delayReturn = offline.createGain();
    setAudioParam(masterIn.gain, dbToGain(runtime.state.master.inputGainDb), 0);
    configureBiquad(masterLow, "lowshelf", 120, runtime.state.master.lowDb, 0);
    configureBiquad(masterMid, "peaking", 1500, runtime.state.master.midDb, 0);
    configureBiquad(masterHigh, "highshelf", 9000, runtime.state.master.highDb, 0);
    configureCompressor(comp, runtime.state.master.compressor, null, 0);
    configureCompressor(limiter, runtime.state.master.compressor, runtime.state.master.ceilingDb, 0);
    setStereoWidthNodes({ leftToLeft, leftToRight, rightToLeft, rightToRight }, runtime.state.master.stereoWidth, 0);
    setAudioParam(out.gain, dbToGain(runtime.state.master.outputGainDb), 0);
    convolver.buffer = makeImpulse(offline, runtime.state.master.reverb.duration, runtime.state.master.reverb.decay);
    setAudioParam(reverbReturn.gain, runtime.state.master.reverb.wet, 0);
    setAudioParam(delay.delayTime, runtime.state.master.delay.time, 0);
    setAudioParam(delayFeedback.gain, runtime.state.master.delay.feedback, 0);
    setAudioParam(delayReturn.gain, runtime.state.master.delay.wet, 0);
    masterIn.connect(masterLow).connect(masterMid).connect(masterHigh).connect(comp).connect(limiter).connect(stereoSplitter);
    stereoSplitter.connect(leftToLeft, 0); stereoSplitter.connect(leftToRight, 0);
    stereoSplitter.connect(rightToLeft, 1); stereoSplitter.connect(rightToRight, 1);
    leftToLeft.connect(stereoMerger, 0, 0); rightToLeft.connect(stereoMerger, 0, 0);
    leftToRight.connect(stereoMerger, 0, 1); rightToRight.connect(stereoMerger, 0, 1);
    stereoMerger.connect(out).connect(offline.destination);
    reverbInput.connect(convolver).connect(reverbReturn).connect(masterIn);
    delayInput.connect(delay).connect(delayReturn).connect(masterIn);
    delay.connect(delayFeedback).connect(delay);
    const anySolo = runtime.state.channels.some((channel) => channel.solo);
    loaded.forEach((channel) => {
      if (channel.mute || (anySolo && !channel.solo)) return;
      const source = offline.createBufferSource();
      const gain = offline.createGain();
      const low = offline.createBiquadFilter(); const mid = offline.createBiquadFilter(); const high = offline.createBiquadFilter();
      const channelComp = offline.createDynamicsCompressor();
      const panner = offline.createStereoPanner ? offline.createStereoPanner() : offline.createGain();
      const sendReverb = offline.createGain(); const sendDelay = offline.createGain();
      source.buffer = runtime.buffers.get(channel.id);
      setAudioParam(gain.gain, dbToGain(channel.gainDb), 0);
      configureBiquad(low, "lowshelf", channel.eq.lowHz, channel.eq.lowDb, 0);
      configureBiquad(mid, "peaking", channel.eq.midHz, channel.eq.midDb, 0);
      configureBiquad(high, "highshelf", channel.eq.highHz, channel.eq.highDb, 0);
      configureCompressor(channelComp, channel.compressor, null, 0);
      if (panner.pan) setAudioParam(panner.pan, channel.pan, 0);
      setAudioParam(sendReverb.gain, channel.sends.reverb, 0);
      setAudioParam(sendDelay.gain, channel.sends.delay, 0);
      if (runtime.state.bypass) {
        source.connect(masterIn);
      } else {
        source.connect(gain).connect(low).connect(mid).connect(high).connect(channelComp).connect(panner).connect(masterIn);
        panner.connect(sendReverb).connect(reverbInput);
        panner.connect(sendDelay).connect(delayInput);
        applyAutomation(gain.gain, channel.automation.gain, dbToGain, offline, 0);
        if (panner.pan) applyAutomation(panner.pan, channel.automation.pan, (value) => value, offline, 0);
      }
      source.start(0);
    });
    return offline.startRendering();
  }

  async function exportProject(runtime) {
    const manifest = buildProcessingManifest(runtime.state, globalScope);
    if ((globalScope.OfflineAudioContext || globalScope.webkitOfflineAudioContext) && runtime.buffers.size) {
      showNotice(runtime, "Đang render WAV cục bộ. Tệp nguồn vẫn giữ nguyên...", "info");
      try {
        const rendered = await renderOffline(runtime);
        downloadBlob(runtime, encodeWav(rendered), `${safeText(runtime.state.projectName, 60).replace(/\s+/g, "-").toLowerCase() || "hh-master"}.wav`);
        showNotice(runtime, "Đã render WAV cục bộ. LUFS/true-peak vẫn cần kiểm tra bằng analyzer đạt chuẩn.", "success");
        return;
      } catch (error) {
        showNotice(runtime, `${error.message} Đã chuyển sang manifest.`, "warning");
      }
    }
    const text = JSON.stringify(manifest, null, 2);
    downloadBlob(runtime, new Blob([text], { type: "application/json" }), "hh-mix-master-manifest.json");
    showNotice(runtime, "Đã xuất processing manifest. Manifest không chứa audio gốc.", "success");
  }

  function onInput(runtime, event) {
    const target = event.target;
    if (target.matches?.("[data-mm-project-name]")) { runtime.state.projectName = safeText(target.value, 100) || "HH Mix Session"; persist(runtime); return; }
    if (target.matches?.("[data-mm-seek]")) {
      const wasPlaying = runtime.playing;
      stopSources(runtime, false); runtime.state.currentTime = Math.max(0, Number(target.value) || 0);
      if (wasPlaying) play(runtime).catch((error) => showNotice(runtime, error.message, "error"));
      drawTimeline(runtime); updateTransport(runtime); return;
    }
    if (target.matches?.("[data-mm-channel-name]")) { selectedChannel(runtime).name = safeText(target.value, 60) || "Track"; persist(runtime); return; }
    if (target.matches?.("[data-mm-channel-color]")) { selectedChannel(runtime).color = target.value; persist(runtime); return; }
    if (target.matches?.("[data-mm-fader]")) {
      const channel = runtime.state.channels.find((item) => item.id === target.dataset.mmFader);
      if (channel) channel.gainDb = clampRange(target.value, PARAM_RANGES.gainDb, 0);
      updateGraph(runtime); persist(runtime); return;
    }
    if (target.matches?.("[data-mm-channel-param]")) {
      const channel = target.closest("[data-mm-channel]");
      const item = runtime.state.channels.find((entry) => entry.id === channel?.dataset.mmChannel);
      if (item) item[target.dataset.mmChannelParam] = clampRange(target.value, target.dataset.mmChannelParam === "pan" ? PARAM_RANGES.pan : PARAM_RANGES.gainDb, 0);
      updateGraph(runtime); persist(runtime); return;
    }
    if (target.matches?.("[data-mm-path]")) {
      const path = target.dataset.mmPath;
      const value = valueForPath(path, target.value);
      if (path.startsWith("selected.")) setNested(selectedChannel(runtime), path.replace("selected.", ""), value);
      else setNested(runtime.state, path, value);
      updateGraph(runtime); persist(runtime);
      const output = target.closest("label")?.querySelector("output");
      if (output) output.textContent = `${Number(value).toFixed(Number(target.step) < 0.1 ? 2 : 1)}${output.textContent.replace(/^-?[\d.]+/, "")}`;
    }
  }

  async function onChange(runtime, event) {
    const target = event.target;
    if (target.matches?.("[data-mm-file]")) {
      try { await loadAudioFiles(runtime, target.files, runtime.state.selectedChannelId); showNotice(runtime, "Đã giải mã audio cục bộ và đưa vào mixer.", "success"); }
      catch (error) { showNotice(runtime, error.message, "error"); }
    }
    if (target.matches?.("[data-mm-compressor-enabled]")) {
      selectedChannel(runtime).compressor.enabled = target.checked; updateGraph(runtime); persist(runtime);
    }
  }

  async function onClick(runtime, event) {
    const button = event.target.closest?.("button");
    if (!button) return;
    if (button.dataset.mmViewButton) { runtime.state.view = button.dataset.mmViewButton; persist(runtime); render(runtime); return; }
    if (button.dataset.mmSelectChannel) { runtime.state.selectedChannelId = button.dataset.mmSelectChannel; persist(runtime); render(runtime); return; }
    if (button.dataset.mmPreset) { applyPreset(runtime, button.dataset.mmPreset); return; }
    if (button.dataset.mmRemoveAutomation) {
      const channel = selectedChannel(runtime); const kind = button.dataset.kind;
      channel.automation[kind] = channel.automation[kind].filter((point) => point.id !== button.dataset.mmRemoveAutomation);
      persist(runtime); render(runtime); return;
    }
    const channelBox = button.closest?.("[data-mm-channel]");
    if (button.dataset.mmToggle && channelBox) {
      const channel = runtime.state.channels.find((item) => item.id === channelBox.dataset.mmChannel);
      if (channel) channel[button.dataset.mmToggle] = !channel[button.dataset.mmToggle];
      updateGraph(runtime); persist(runtime); render(runtime); return;
    }
    if (button.dataset.mmFaderToggle) {
      const channel = runtime.state.channels.find((item) => item.id === button.dataset.channelId);
      if (channel) channel[button.dataset.mmFaderToggle] = !channel[button.dataset.mmFaderToggle];
      updateGraph(runtime); persist(runtime); render(runtime); return;
    }
    switch (button.dataset.mmAction) {
      case "play":
        if (runtime.playing) { stopSources(runtime, true); persist(runtime); updateTransport(runtime); }
        else play(runtime).catch((error) => showNotice(runtime, error.message, "error"));
        break;
      case "stop": stopSources(runtime, false); runtime.state.currentTime = 0; persist(runtime); updateTransport(runtime); drawTimeline(runtime); break;
      case "loop": runtime.state.loop = !runtime.state.loop; persist(runtime); render(runtime); break;
      case "bypass": runtime.state.bypass = !runtime.state.bypass; updateGraph(runtime); persist(runtime); render(runtime); showNotice(runtime, runtime.state.bypass ? "Before: đang nghe tín hiệu gốc." : "After: đang nghe chuỗi xử lý.", "info"); break;
      case "ab": runtime.state.ab.active = runtime.state.ab.active === "A" ? "B" : "A"; runtime.state.master = normalizeMaster(runtime.state.ab[runtime.state.ab.active]); updateGraph(runtime); persist(runtime); render(runtime); break;
      case "save-ab": runtime.state.ab[runtime.state.ab.active] = clone(runtime.state.master); persist(runtime); showNotice(runtime, `Đã lưu cấu hình ${runtime.state.ab.active}.`, "success"); break;
      case "add-channel": runtime.state.channels.push(normalizeChannel({ id: uid("channel"), name: `Track ${runtime.state.channels.length + 1}` }, runtime.state.channels.length)); rebuildGraph(runtime); persist(runtime); render(runtime); break;
      case "add-automation": {
        const channel = selectedChannel(runtime); const select = runtime.host.querySelector?.("[data-mm-automation-kind]"); const kind = select?.value === "pan" ? "pan" : "gain";
        channel.automation[kind].push({ id: uid("automation"), time: currentTimeOf(runtime), value: kind === "pan" ? channel.pan : channel.gainDb });
        channel.automation[kind] = normalizeAutomation(channel.automation[kind], kind === "pan" ? PARAM_RANGES.pan : PARAM_RANGES.gainDb);
        scheduleChannelAutomation(runtime, channel); persist(runtime); render(runtime); break;
      }
      case "export": exportProject(runtime); break;
      default: break;
    }
  }

  function bind(runtime) {
    runtime.onClick = (event) => onClick(runtime, event);
    runtime.onInput = (event) => onInput(runtime, event);
    runtime.onChange = (event) => onChange(runtime, event);
    runtime.onDragOver = (event) => { event.preventDefault(); event.dataTransfer.dropEffect = "copy"; event.target.closest?.("[data-mm-dropzone]")?.classList.add("is-dragging"); };
    runtime.onDragLeave = (event) => event.target.closest?.("[data-mm-dropzone]")?.classList.remove("is-dragging");
    runtime.onDrop = async (event) => {
      const zone = event.target.closest?.("[data-mm-dropzone]"); if (!zone) return;
      event.preventDefault(); zone.classList.remove("is-dragging");
      try { await loadAudioFiles(runtime, event.dataTransfer.files, runtime.state.selectedChannelId); showNotice(runtime, "Đã thêm audio bằng kéo thả.", "success"); }
      catch (error) { showNotice(runtime, error.message, "error"); }
    };
    runtime.host.addEventListener?.("click", runtime.onClick);
    runtime.host.addEventListener?.("input", runtime.onInput);
    runtime.host.addEventListener?.("change", runtime.onChange);
    runtime.host.addEventListener?.("dragover", runtime.onDragOver);
    runtime.host.addEventListener?.("dragleave", runtime.onDragLeave);
    runtime.host.addEventListener?.("drop", runtime.onDrop);
  }

  function mount(host, options) {
    if (!host || typeof host !== "object") throw new TypeError("HHMusicMixMaster.mount cần một host hợp lệ.");
    if (active) unmount();
    const requested = String(options?.view || "mix").toLowerCase();
    const state = loadState(globalScope);
    state.view = supports(requested) ? requested : "mix";
    active = {
      host, state, context: null, graph: null, buffers: new Map(), fileUrls: new Map(), sources: new Set(),
      tracker: createResourceTracker(globalScope), playing: false, playOffset: 0, startedAt: 0,
      meterFrame: null, metrics: estimateMetrics([])
    };
    render(active); bind(active); persist(active);
    return active;
  }

  async function unmount() {
    const runtime = active;
    if (!runtime) return;
    active = null;
    stopSources(runtime, false);
    stopMeters(runtime);
    runtime.host.removeEventListener?.("click", runtime.onClick);
    runtime.host.removeEventListener?.("input", runtime.onInput);
    runtime.host.removeEventListener?.("change", runtime.onChange);
    runtime.host.removeEventListener?.("dragover", runtime.onDragOver);
    runtime.host.removeEventListener?.("dragleave", runtime.onDragLeave);
    runtime.host.removeEventListener?.("drop", runtime.onDrop);
    disconnectGraph(runtime);
    await runtime.tracker.cleanup();
    runtime.buffers.clear(); runtime.fileUrls.clear(); runtime.sources.clear();
    runtime.host.innerHTML = "";
  }

  function lifecycle() {
    return active ? { mounted: true, playing: active.playing, ...active.tracker.stats() } : { mounted: false, playing: false, urls: 0, nodes: 0, sources: 0, frames: 0, hasContext: false };
  }

  const api = {
    VERSION, STORAGE_KEY, PARAM_RANGES, MASTER_PRESETS, supports, mount, unmount,
    clamp, dbToGain, gainToDb, normalizeChannel, normalizeMaster, normalizeState,
    createDefaultState, estimateMetrics, getMeterLabels, buildProcessingManifest,
    createResourceTracker, encodeWav, lifecycle
  };

  globalScope.HHMusicMixMaster = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
