(function musicMixPerformance(globalScope) {
  "use strict";

  const VERSION = 1;
  const STORAGE_KEY = "hh.music.mix-performance.v1";
  const SUPPORTED = new Set(["mix-doctor", "live-performance"]);
  const MAX_AUTOMATION_EVENTS = 5000;
  const TRACKS = Object.freeze(["drums", "bass", "chords", "lead"]);
  const TRACK_LABELS = Object.freeze({ drums: "Trống", bass: "Bass", chords: "Hợp âm", lead: "Lead" });
  const PAD_NOTES = Object.freeze([48, 50, 52, 53, 55, 57, 59, 60]);

  const MIX_PRESETS = Object.freeze({
    youtube: Object.freeze({
      id: "youtube", label: "YouTube", targetLufs: -14, ceilingDb: -1,
      description: "Mục tiêu tham chiếu cho video; LUFS trong workspace này chỉ là ước tính.",
      adjustments: [
        { type: "highpass", label: "Lọc hạ âm 28 Hz", frequency: 28, enabled: true },
        { type: "compressor", label: "Nén bus nhẹ", threshold: -20, ratio: 2.2, attack: 0.025, release: 0.22, enabled: true },
        { type: "gain", label: "Headroom đầu ra", gainDb: -1, enabled: true }
      ]
    }),
    streaming: Object.freeze({
      id: "streaming", label: "Streaming", targetLufs: -14, ceilingDb: -1,
      description: "Cân bằng độ động cho nền tảng nghe nhạc; không thay thế chuẩn đo BS.1770.",
      adjustments: [
        { type: "highpass", label: "Lọc hạ âm 25 Hz", frequency: 25, enabled: true },
        { type: "compressor", label: "Glue compressor", threshold: -22, ratio: 2, attack: 0.03, release: 0.25, enabled: true },
        { type: "highshelf", label: "Air nhẹ", frequency: 9000, gainDb: 0.8, enabled: true }
      ]
    }),
    podcast: Object.freeze({
      id: "podcast", label: "Podcast", targetLufs: -16, ceilingDb: -1,
      description: "Ưu tiên lời nói rõ và ổn định; LUFS hiển thị là ước tính cục bộ.",
      adjustments: [
        { type: "highpass", label: "Lọc ù 75 Hz", frequency: 75, enabled: true },
        { type: "peaking", label: "Tăng độ rõ giọng", frequency: 2800, q: 1.1, gainDb: 1.5, enabled: true },
        { type: "compressor", label: "Ổn định hội thoại", threshold: -24, ratio: 3, attack: 0.012, release: 0.18, enabled: true }
      ]
    })
  });

  const SCENES = Object.freeze([
    Object.freeze({ id: "intro", label: "Mở đầu", color: "cyan", patterns: Object.freeze({
      drums: [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0],
      bass: [1, 0, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0, 1, 0],
      chords: [1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0],
      lead: [0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0]
    }) }),
    Object.freeze({ id: "verse", label: "Đoạn chính", color: "green", patterns: Object.freeze({
      drums: [1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0],
      bass: [1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1, 0, 0, 1, 0],
      chords: [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0],
      lead: [0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 1, 0, 0]
    }) }),
    Object.freeze({ id: "chorus", label: "Điệp khúc", color: "pink", patterns: Object.freeze({
      drums: [1, 0, 1, 1, 1, 0, 1, 0, 1, 0, 1, 1, 1, 0, 1, 1],
      bass: [1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0],
      chords: [1, 0, 0, 1, 1, 0, 0, 1, 1, 0, 0, 1, 1, 0, 0, 1],
      lead: [1, 0, 1, 0, 0, 1, 1, 0, 1, 0, 1, 0, 0, 1, 1, 0]
    }) }),
    Object.freeze({ id: "break", label: "Chuyển đoạn", color: "yellow", patterns: Object.freeze({
      drums: [1, 0, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0, 1, 1],
      bass: [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0],
      chords: [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
      lead: [0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 1]
    }) })
  ]);

  let active = null;

  function clamp(value, min, max, fallback) {
    const numeric = Number(value);
    return Math.min(max, Math.max(min, Number.isFinite(numeric) ? numeric : fallback));
  }

  function safeText(value, limit) {
    return String(value == null ? "" : value)
      .replace(/[\u0000-\u001f\u007f]/g, " ")
      .replace(/<[^>]*>/g, "")
      .trim().slice(0, limit || 160);
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  function clone(value) {
    if (typeof structuredClone === "function") return structuredClone(value);
    return JSON.parse(JSON.stringify(value));
  }

  function uid(prefix) {
    return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  }

  function db(value) {
    const safe = Math.max(0.000001, Number(value) || 0);
    return Math.max(-120, 20 * Math.log10(safe));
  }

  function supports(view) {
    return SUPPORTED.has(String(view || "").toLowerCase());
  }

  function readProjectContext(scope) {
    const fallback = { source: "fallback", bpm: null, key: null };
    try {
      const projectContext = scope?.HHMusicProjectContext;
      if (!projectContext || typeof projectContext.getSnapshot !== "function") return fallback;
      const snapshot = projectContext.getSnapshot();
      if (!snapshot || typeof snapshot !== "object") return fallback;
      const bpm = Number(snapshot.bpm ?? snapshot.tempo);
      const key = safeText(snapshot.key || snapshot.musicalKey || snapshot.tonality, 40);
      return {
        source: "HHMusicProjectContext",
        bpm: Number.isFinite(bpm) && bpm >= 30 && bpm <= 300 ? bpm : null,
        key: key || null
      };
    } catch (_error) {
      return fallback;
    }
  }

  function createDefaultState() {
    return {
      version: VERSION,
      view: "mix-doctor",
      project: { bpm: 112, key: "C minor", contextSource: "fallback" },
      mix: {
        preset: "youtube", file: null, metrics: null, issues: [], ab: "A",
        adjustmentStack: [], updatedAt: ""
      },
      live: {
        bpm: 112, key: "C minor", playing: false, loop: true, overdub: false,
        activeScene: "intro", activeClips: { drums: "intro", bass: "intro", chords: "intro", lead: "intro" },
        macros: { mood: 50, groove: 35, tension: 42, density: 68 },
        midi: { mappings: {}, learnTarget: "pad-0", status: "Chưa kết nối" },
        automation: { recording: false, startedAt: 0, events: [] }, updatedAt: ""
      }
    };
  }

  function normalizeAdjustment(item, index) {
    const type = ["gain", "highpass", "lowshelf", "highshelf", "peaking", "compressor", "stereo-width"].includes(item?.type) ? item.type : "gain";
    return {
      id: safeText(item?.id, 80) || `adjustment-${index + 1}`,
      sourceSuggestionId: safeText(item?.sourceSuggestionId, 80),
      type,
      label: safeText(item?.label, 100) || "Điều chỉnh",
      enabled: item?.enabled !== false,
      gainDb: clamp(item?.gainDb, -18, 18, 0),
      frequency: clamp(item?.frequency, 20, 20000, 1000),
      q: clamp(item?.q, 0.1, 20, 1),
      threshold: clamp(item?.threshold, -100, 0, -20),
      ratio: clamp(item?.ratio, 1, 20, 2),
      attack: clamp(item?.attack, 0, 1, 0.02),
      release: clamp(item?.release, 0, 1, 0.2),
      width: clamp(item?.width, 0, 2, 1)
    };
  }

  function normalizeState(input) {
    const base = createDefaultState();
    const source = input && typeof input === "object" ? input : {};
    const live = source.live || {};
    const mix = source.mix || {};
    const activeClips = {};
    TRACKS.forEach((track) => {
      const sceneId = safeText(live.activeClips?.[track], 30);
      activeClips[track] = SCENES.some((scene) => scene.id === sceneId) ? sceneId : base.live.activeClips[track];
    });
    return {
      version: VERSION,
      view: supports(source.view) ? source.view : base.view,
      project: {
        bpm: clamp(source.project?.bpm, 30, 300, base.project.bpm),
        key: safeText(source.project?.key, 40) || base.project.key,
        contextSource: source.project?.contextSource === "HHMusicProjectContext" ? "HHMusicProjectContext" : "fallback"
      },
      mix: {
        preset: MIX_PRESETS[mix.preset] ? mix.preset : base.mix.preset,
        file: mix.file && typeof mix.file === "object" ? {
          name: safeText(mix.file.name, 180), type: safeText(mix.file.type, 80),
          size: Math.max(0, Number(mix.file.size) || 0), duration: Math.max(0, Number(mix.file.duration) || 0),
          availableThisSession: false
        } : null,
        metrics: mix.metrics && typeof mix.metrics === "object" ? normalizeMetrics(mix.metrics) : null,
        issues: Array.isArray(mix.issues) ? mix.issues.slice(0, 24).map(normalizeIssue) : [],
        ab: mix.ab === "B" ? "B" : "A",
        adjustmentStack: (Array.isArray(mix.adjustmentStack) ? mix.adjustmentStack : []).slice(0, 32).map(normalizeAdjustment),
        updatedAt: safeText(mix.updatedAt, 40)
      },
      live: {
        bpm: clamp(live.bpm, 30, 300, base.live.bpm), key: safeText(live.key, 40) || base.live.key,
        playing: false, loop: live.loop !== false, overdub: Boolean(live.overdub),
        activeScene: SCENES.some((scene) => scene.id === live.activeScene) ? live.activeScene : base.live.activeScene,
        activeClips,
        macros: {
          mood: clamp(live.macros?.mood, 0, 100, base.live.macros.mood),
          groove: clamp(live.macros?.groove, 0, 100, base.live.macros.groove),
          tension: clamp(live.macros?.tension, 0, 100, base.live.macros.tension),
          density: clamp(live.macros?.density, 0, 100, base.live.macros.density)
        },
        midi: {
          mappings: normalizeMappings(live.midi?.mappings),
          learnTarget: safeText(live.midi?.learnTarget, 40) || base.live.midi.learnTarget,
          status: "Chưa kết nối"
        },
        automation: {
          recording: false, startedAt: 0,
          events: normalizeAutomationEvents(live.automation?.events)
        },
        updatedAt: safeText(live.updatedAt, 40)
      }
    };
  }

  function normalizeMetrics(metrics) {
    return {
      peak: clamp(metrics?.peak, 0, 4, 0), peakDb: clamp(metrics?.peakDb, -120, 24, -120),
      rms: clamp(metrics?.rms, 0, 4, 0), rmsDb: clamp(metrics?.rmsDb, -120, 24, -120),
      lufsEstimate: clamp(metrics?.lufsEstimate, -120, 24, -120),
      crestDb: clamp(metrics?.crestDb, 0, 60, 0), dynamicRangeDb: clamp(metrics?.dynamicRangeDb, 0, 80, 0),
      clippingSamples: Math.max(0, Number(metrics?.clippingSamples) || 0),
      clippingRatio: clamp(metrics?.clippingRatio, 0, 1, 0), dcOffset: clamp(metrics?.dcOffset, -1, 1, 0),
      stereoCorrelation: clamp(metrics?.stereoCorrelation, -1, 1, 1), duration: Math.max(0, Number(metrics?.duration) || 0),
      sampleRate: Math.max(0, Number(metrics?.sampleRate) || 0), channels: Math.max(1, Number(metrics?.channels) || 1),
      spectrum: {
        low: clamp(metrics?.spectrum?.low, 0, 1, 0), mid: clamp(metrics?.spectrum?.mid, 0, 1, 0),
        high: clamp(metrics?.spectrum?.high, 0, 1, 0), centroidHz: clamp(metrics?.spectrum?.centroidHz, 0, 24000, 0)
      }
    };
  }

  function normalizeIssue(issue, index) {
    const severity = ["high", "medium", "low", "good"].includes(issue?.severity) ? issue.severity : "low";
    return {
      id: safeText(issue?.id, 80) || `issue-${index + 1}`, severity,
      title: safeText(issue?.title, 100) || "Nhận xét",
      explanation: safeText(issue?.explanation, 320),
      suggestion: issue?.suggestion ? {
        id: safeText(issue.suggestion.id, 80) || uid("suggestion"),
        label: safeText(issue.suggestion.label, 120) || "Áp dụng đề xuất",
        explanation: safeText(issue.suggestion.explanation, 260),
        adjustment: normalizeAdjustment(issue.suggestion.adjustment || {}, 0)
      } : null
    };
  }

  function normalizeMappings(mappings) {
    const output = {};
    if (!mappings || typeof mappings !== "object") return output;
    Object.entries(mappings).slice(0, 64).forEach(([signature, target]) => {
      const safeSignature = safeText(signature, 40);
      const safeTarget = safeText(target, 40);
      if (/^\d{1,3}:\d{1,3}$/.test(safeSignature) && /^(pad-[0-7]|macro-(mood|groove|tension|density))$/.test(safeTarget)) output[safeSignature] = safeTarget;
    });
    return output;
  }

  function normalizeAutomationEvents(events) {
    return (Array.isArray(events) ? events : []).slice(-MAX_AUTOMATION_EVENTS).map((event) => ({
      id: safeText(event?.id, 80) || uid("auto"),
      time: clamp(event?.time, 0, 86400000, 0),
      target: safeText(event?.target, 50),
      value: typeof event?.value === "string" ? safeText(event.value, 80) : clamp(event?.value, 0, 127, 0)
    })).filter((event) => event.target);
  }

  function storageOf(scope) {
    try { return scope?.localStorage || globalScope.localStorage || null; } catch (_error) { return null; }
  }

  function loadState(scope) {
    try {
      const raw = storageOf(scope)?.getItem(STORAGE_KEY);
      return normalizeState(raw ? JSON.parse(raw) : null);
    } catch (_error) {
      return createDefaultState();
    }
  }

  function saveState(runtime) {
    runtime.state.mix.updatedAt = new Date().toISOString();
    runtime.state.live.updatedAt = runtime.state.mix.updatedAt;
    const safe = normalizeState(runtime.state);
    safe.view = runtime.state.view;
    safe.mix.file = runtime.state.mix.file ? { ...runtime.state.mix.file, availableThisSession: false } : null;
    try { storageOf(runtime.scope)?.setItem(STORAGE_KEY, JSON.stringify(safe)); } catch (_error) { /* Local workspace remains usable. */ }
  }

  function mergeProjectContext(state, scope) {
    const context = readProjectContext(scope);
    if (context.bpm) {
      state.project.bpm = context.bpm;
      state.live.bpm = context.bpm;
    }
    if (context.key) {
      state.project.key = context.key;
      state.live.key = context.key;
    }
    state.project.contextSource = context.source;
    return context;
  }

  function percentile(sorted, position) {
    if (!sorted.length) return 0;
    const index = clamp(position, 0, 1, 0) * (sorted.length - 1);
    const low = Math.floor(index);
    const high = Math.ceil(index);
    if (low === high) return sorted[low];
    return sorted[low] + (sorted[high] - sorted[low]) * (index - low);
  }

  function estimateSpectrum(samples, sampleRate) {
    const source = samples && samples.length ? samples : [];
    if (!source.length) return { low: 0, mid: 0, high: 0, centroidHz: 0 };
    const size = Math.min(512, source.length);
    const offset = Math.max(0, Math.floor((source.length - size) / 2));
    const energies = { low: 0, mid: 0, high: 0 };
    let weighted = 0;
    let total = 0;
    for (let bin = 1; bin < size / 2; bin += 2) {
      let real = 0;
      let imaginary = 0;
      for (let index = 0; index < size; index += 1) {
        const windowed = (Number(source[offset + index]) || 0) * (0.5 - 0.5 * Math.cos((2 * Math.PI * index) / (size - 1)));
        const angle = (2 * Math.PI * bin * index) / size;
        real += windowed * Math.cos(angle);
        imaginary -= windowed * Math.sin(angle);
      }
      const energy = real * real + imaginary * imaginary;
      const frequency = (bin * sampleRate) / size;
      if (frequency < 250) energies.low += energy;
      else if (frequency < 4000) energies.mid += energy;
      else energies.high += energy;
      total += energy;
      weighted += energy * frequency;
    }
    const safeTotal = total || 1;
    return {
      low: energies.low / safeTotal, mid: energies.mid / safeTotal, high: energies.high / safeTotal,
      centroidHz: total ? weighted / total : 0
    };
  }

  function analyzePCM(channels, sampleRate) {
    const data = (Array.isArray(channels) ? channels : []).filter((channel) => channel && typeof channel.length === "number" && channel.length);
    const rate = clamp(sampleRate, 8000, 384000, 48000);
    if (!data.length) return normalizeMetrics({ sampleRate: rate, channels: 1, stereoCorrelation: 1 });
    const length = Math.min(...data.map((channel) => channel.length));
    const stride = Math.max(1, Math.floor(length / 1000000));
    let peak = 0;
    let squares = 0;
    let sum = 0;
    let clippingSamples = 0;
    let count = 0;
    let sumLR = 0;
    let sumLL = 0;
    let sumRR = 0;
    const mono = data[0];
    const right = data[1] || data[0];
    for (let index = 0; index < length; index += stride) {
      let mixed = 0;
      for (let channelIndex = 0; channelIndex < data.length; channelIndex += 1) mixed += Number(data[channelIndex][index]) || 0;
      mixed /= data.length;
      const absolute = Math.abs(mixed);
      peak = Math.max(peak, absolute);
      squares += mixed * mixed;
      sum += mixed;
      if (absolute >= 0.999) clippingSamples += 1;
      const leftValue = Number(mono[index]) || 0;
      const rightValue = Number(right[index]) || 0;
      sumLR += leftValue * rightValue;
      sumLL += leftValue * leftValue;
      sumRR += rightValue * rightValue;
      count += 1;
    }
    const rms = Math.sqrt(squares / Math.max(1, count));
    const blockDb = [];
    const windowSize = Math.max(128, Math.floor(rate * 0.05));
    const blockStride = Math.max(windowSize, Math.floor(length / 240));
    for (let start = 0; start < length; start += blockStride) {
      let blockSquares = 0;
      let blockCount = 0;
      for (let index = start; index < Math.min(length, start + windowSize); index += Math.max(1, stride)) {
        const value = Number(mono[index]) || 0;
        blockSquares += value * value;
        blockCount += 1;
      }
      const blockRms = Math.sqrt(blockSquares / Math.max(1, blockCount));
      if (blockRms > 0.00001) blockDb.push(db(blockRms));
    }
    blockDb.sort((a, b) => a - b);
    const denominator = Math.sqrt(sumLL * sumRR);
    return normalizeMetrics({
      peak, peakDb: db(peak), rms, rmsDb: db(rms), lufsEstimate: db(rms) - 0.7,
      crestDb: Math.max(0, db(peak) - db(rms)),
      dynamicRangeDb: blockDb.length ? Math.max(0, percentile(blockDb, 0.95) - percentile(blockDb, 0.1)) : 0,
      clippingSamples, clippingRatio: clippingSamples / Math.max(1, count), dcOffset: sum / Math.max(1, count),
      stereoCorrelation: data.length > 1 && denominator ? sumLR / denominator : 1,
      duration: length / rate, sampleRate: rate, channels: data.length,
      spectrum: estimateSpectrum(mono, rate)
    });
  }

  function suggestion(id, label, explanation, adjustment) {
    return { id, label, explanation, adjustment: normalizeAdjustment({ id: uid("adjustment"), ...adjustment }, 0) };
  }

  function buildMixIssues(metrics, presetId) {
    const value = normalizeMetrics(metrics || {});
    const preset = MIX_PRESETS[presetId] || MIX_PRESETS.youtube;
    const issues = [];
    if (value.clippingSamples > 0 || value.peakDb > -0.2) {
      issues.push({ id: "clipping", severity: "high", title: "Có nguy cơ clipping", explanation: `${value.clippingSamples} mẫu chạm ngưỡng; peak ${value.peakDb.toFixed(1)} dBFS có thể gây méo khi mã hóa.`, suggestion: suggestion("reduce-gain", "Tạo Gain -3 dB", "Thêm một lớp gain có thể tắt hoặc xóa; tệp gốc không thay đổi.", { type: "gain", label: "Giảm peak an toàn", gainDb: -3 }) });
    }
    if (Math.abs(value.dcOffset) > 0.01) {
      issues.push({ id: "dc-offset", severity: "medium", title: "DC offset đáng chú ý", explanation: `Độ lệch trung bình ${value.dcOffset.toFixed(4)} có thể làm giảm headroom.`, suggestion: suggestion("dc-filter", "Thêm High-pass 25 Hz", "Lọc hạ âm không phá hủy để giảm offset và rung rất thấp.", { type: "highpass", label: "Loại DC/hạ âm", frequency: 25 }) });
    }
    if (value.stereoCorrelation < -0.15) {
      issues.push({ id: "phase", severity: "high", title: "Tương quan stereo âm", explanation: `Correlation ${value.stereoCorrelation.toFixed(2)} báo hiệu khả năng triệt tiêu khi nghe mono.`, suggestion: suggestion("narrow-stereo", "Thu stereo về 75%", "Giảm side signal trong chuỗi nghe thử; hãy kiểm tra lại bằng tai và mono.", { type: "stereo-width", label: "Stereo safety", width: 0.75 }) });
    }
    if (value.dynamicRangeDb < 5 && value.rmsDb > -40) {
      issues.push({ id: "flat-dynamics", severity: "medium", title: "Độ động khá hẹp", explanation: `Khoảng động ước tính ${value.dynamicRangeDb.toFixed(1)} dB; bản mix có thể thiếu tương phản.`, suggestion: suggestion("relax-output", "Giảm drive 1.5 dB", "Tạo thêm headroom thay vì tự động nén mạnh hơn.", { type: "gain", label: "Mở headroom", gainDb: -1.5 }) });
    }
    if (value.crestDb > 18 && value.peakDb > -8) {
      issues.push({ id: "transients", severity: "low", title: "Transient nổi bật", explanation: `Crest factor ${value.crestDb.toFixed(1)} dB; vài đỉnh có thể lấn át độ lớn cảm nhận.`, suggestion: suggestion("soft-compression", "Thêm compressor nhẹ", "Nén tỉ lệ thấp để nghe thử, không ghi lên audio gốc.", { type: "compressor", label: "Kiểm soát transient", threshold: -18, ratio: 1.8, attack: 0.03, release: 0.2 }) });
    }
    const lufsDifference = value.lufsEstimate - preset.targetLufs;
    if (Math.abs(lufsDifference) > 3 && value.rmsDb > -100) {
      const amount = clamp(-lufsDifference, -6, 6, 0);
      issues.push({ id: "loudness", severity: "low", title: "Loudness lệch preset tham chiếu", explanation: `LUFS ước tính ${value.lufsEstimate.toFixed(1)}, mục tiêu ${preset.targetLufs} LUFS. Đây không phải phép đo ITU-R BS.1770.`, suggestion: suggestion("target-loudness", `Thử Gain ${amount >= 0 ? "+" : ""}${amount.toFixed(1)} dB`, "Chỉ thêm lớp nghe thử; đo lại bằng loudness meter chuẩn trước khi phát hành.", { type: "gain", label: `Tham chiếu ${preset.label}`, gainDb: amount }) });
    }
    if (!issues.length) issues.push({ id: "healthy", severity: "good", title: "Không phát hiện lỗi lớn", explanation: "Các heuristic cục bộ đang ở vùng hợp lý. Vẫn cần kiểm tra bằng tai, loa kiểm âm và meter chuẩn.", suggestion: null });
    return issues.map(normalizeIssue);
  }

  function applySuggestion(state, suggestionValue) {
    if (!state?.mix || !suggestionValue?.adjustment) return false;
    const suggestionId = safeText(suggestionValue.id, 80);
    if (state.mix.adjustmentStack.some((item) => item.sourceSuggestionId === suggestionId)) return false;
    const adjustment = normalizeAdjustment({ ...suggestionValue.adjustment, id: uid("adjustment") }, state.mix.adjustmentStack.length);
    adjustment.sourceSuggestionId = suggestionId;
    state.mix.adjustmentStack.push(adjustment);
    state.mix.ab = "B";
    return true;
  }

  function applyPreset(state, presetId) {
    const preset = MIX_PRESETS[presetId];
    if (!state?.mix || !preset) return false;
    preset.adjustments.forEach((adjustment) => state.mix.adjustmentStack.push(normalizeAdjustment({ ...adjustment, id: uid("adjustment") }, state.mix.adjustmentStack.length)));
    state.mix.preset = presetId;
    state.mix.ab = "B";
    return true;
  }

  function createMixReport(state) {
    const preset = MIX_PRESETS[state?.mix?.preset] || MIX_PRESETS.youtube;
    return {
      format: "hh-mix-doctor-report", version: VERSION, generatedAt: new Date().toISOString(),
      project: clone(state?.project || {}), sourceFile: clone(state?.mix?.file || null),
      metering: {
        standardCompliant: false,
        notice: "LUFS và True Peak trong báo cáo này là ước tính cục bộ, không phải phép đo ITU-R BS.1770/EBU R128.",
        metrics: clone(state?.mix?.metrics || null), preset: { id: preset.id, targetLufs: preset.targetLufs, ceilingDb: preset.ceilingDb }
      },
      issues: clone(state?.mix?.issues || []), adjustmentStack: clone(state?.mix?.adjustmentStack || []),
      nonDestructive: true, sourceModified: false
    };
  }

  function recordAutomationEvent(liveState, target, value, now) {
    if (!liveState?.automation?.recording) return null;
    const event = {
      id: uid("auto"), time: Math.max(0, (Number(now) || Date.now()) - (Number(liveState.automation.startedAt) || 0)),
      target: safeText(target, 50), value: typeof value === "string" ? safeText(value, 80) : clamp(value, 0, 127, 0)
    };
    if (!event.target) return null;
    liveState.automation.events.push(event);
    if (liveState.automation.events.length > MAX_AUTOMATION_EVENTS) liveState.automation.events.splice(0, liveState.automation.events.length - MAX_AUTOMATION_EVENTS);
    return event;
  }

  function exportAutomationData(state) {
    return {
      format: "hh-live-performance-automation", version: VERSION, exportedAt: new Date().toISOString(),
      bpm: state.live.bpm, key: state.live.key, loop: state.live.loop, overdub: state.live.overdub,
      macros: clone(state.live.macros), midiMappings: clone(state.live.midi.mappings), events: clone(state.live.automation.events)
    };
  }

  function createResourceBag(scope) {
    const urls = new Set();
    const nodes = new Set();
    const sources = new Set();
    const frames = new Set();
    const intervals = new Set();
    const midiInputs = new Set();
    let context = null;
    return {
      setContext(value) { context = value; return value; },
      addUrl(value) { if (value) urls.add(value); return value; },
      removeUrl(value) { urls.delete(value); },
      addNode(value) { if (value) nodes.add(value); return value; },
      removeNode(value) { nodes.delete(value); },
      addSource(value) { if (value) sources.add(value); return value; },
      removeSource(value) { sources.delete(value); },
      addFrame(value) { if (value != null) frames.add(value); return value; },
      removeFrame(value) { frames.delete(value); },
      addInterval(value) { if (value != null) intervals.add(value); return value; },
      removeInterval(value) { intervals.delete(value); },
      addMidiInput(value) { if (value) midiInputs.add(value); return value; },
      stats() { return { urls: urls.size, nodes: nodes.size, sources: sources.size, frames: frames.size, intervals: intervals.size, midiInputs: midiInputs.size, hasContext: Boolean(context) }; },
      async cleanup() {
        frames.forEach((frame) => { try { scope.cancelAnimationFrame?.(frame); } catch (_error) {} });
        intervals.forEach((timer) => { try { scope.clearInterval?.(timer); } catch (_error) {} });
        sources.forEach((source) => { try { source.stop?.(); } catch (_error) {} try { source.disconnect?.(); } catch (_error) {} });
        nodes.forEach((node) => { try { node.disconnect?.(); } catch (_error) {} });
        midiInputs.forEach((input) => { try { input.onmidimessage = null; } catch (_error) {} });
        urls.forEach((url) => { try { scope.URL?.revokeObjectURL?.(url); } catch (_error) {} });
        if (context && context.state !== "closed") { try { await context.close?.(); } catch (_error) {} }
        urls.clear(); nodes.clear(); sources.clear(); frames.clear(); intervals.clear(); midiInputs.clear(); context = null;
      }
    };
  }

  function bytes(value) {
    const size = Number(value) || 0;
    if (size < 1024) return `${size} B`;
    if (size < 1048576) return `${(size / 1024).toFixed(1)} KB`;
    return `${(size / 1048576).toFixed(1)} MB`;
  }

  function formatTime(seconds) {
    const safe = Math.max(0, Number(seconds) || 0);
    return `${String(Math.floor(safe / 60)).padStart(2, "0")}:${String(Math.floor(safe % 60)).padStart(2, "0")}`;
  }

  function shellMarkup(state) {
    return `<section class="hmp-shell" data-hmp-view="${escapeHtml(state.view)}" aria-label="HH Mix Doctor và Live Performance">
      <header class="hmp-header">
        <div><p class="hmp-kicker">HH MUSIC / ANALYZE + PERFORM</p><h1>${state.view === "mix-doctor" ? "Mix Doctor" : "Live Performance"}</h1><p>${state.project.contextSource === "HHMusicProjectContext" ? "Đồng bộ context dự án" : "Chế độ độc lập"} · ${state.project.bpm} BPM · ${escapeHtml(state.project.key)}</p></div>
        <nav aria-label="Chọn workspace"><button type="button" data-hmp-view-button="mix-doctor" class="${state.view === "mix-doctor" ? "is-active" : ""}">Mix Doctor</button><button type="button" data-hmp-view-button="live-performance" class="${state.view === "live-performance" ? "is-active" : ""}">Live Performance</button></nav>
      </header>
      <div class="hmp-workspace">${state.view === "mix-doctor" ? mixMarkup(state) : liveMarkup(state)}</div>
      <div class="hmp-toast" role="status" aria-live="polite" data-hmp-notice></div>
    </section>`;
  }

  function mixMarkup(state) {
    const mix = state.mix;
    const metrics = mix.metrics;
    const file = mix.file;
    const preset = MIX_PRESETS[mix.preset];
    const metric = (label, value, note, tone) => `<article class="hmp-metric ${tone || ""}"><span>${label}</span><strong>${value}</strong><small>${note}</small></article>`;
    return `<div class="hmp-mix-layout">
      <section class="hmp-panel hmp-source-panel">
        <div class="hmp-panel-head"><div><p class="hmp-kicker">NGUỒN PHÂN TÍCH</p><h2>${file ? escapeHtml(file.name) : "Nhập bản mix"}</h2></div><span class="hmp-badge">Local · không tải lên</span></div>
        <button type="button" class="hmp-dropzone" data-hmp-dropzone data-hmp-action="choose-file"><span aria-hidden="true">＋</span><strong>${file?.availableThisSession ? "Đổi tệp audio" : file ? "Chọn lại tệp để phát" : "Chọn hoặc kéo thả audio"}</strong><small>WAV, MP3, M4A, OGG, FLAC tùy trình duyệt hỗ trợ</small></button>
        <input class="hmp-visually-hidden" type="file" accept="audio/*" data-hmp-file aria-label="Chọn tệp audio để phân tích">
        ${file ? `<div class="hmp-file-meta"><span>${bytes(file.size)}</span><span>${formatTime(file.duration)}</span><span>${metrics?.channels || 0} kênh</span><span>${metrics?.sampleRate ? `${Math.round(metrics.sampleRate / 1000)} kHz` : "--"}</span></div>` : ""}
        <div class="hmp-wave-stack"><canvas data-hmp-waveform aria-label="Waveform bản mix"></canvas><canvas data-hmp-spectrum aria-label="Spectrum thời gian thực"></canvas></div>
        <div class="hmp-transport"><button type="button" data-hmp-action="mix-play" ${file?.availableThisSession ? "" : "disabled"}>${state.mixPlaying ? "Dừng" : "Phát kiểm tra"}</button><div class="hmp-ab" role="group" aria-label="So sánh A B"><button type="button" data-hmp-action="ab" data-value="A" class="${mix.ab === "A" ? "is-active" : ""}" aria-pressed="${mix.ab === "A"}">A · Gốc</button><button type="button" data-hmp-action="ab" data-value="B" class="${mix.ab === "B" ? "is-active" : ""}" aria-pressed="${mix.ab === "B"}">B · Xử lý</button></div></div>
      </section>

      <section class="hmp-panel hmp-diagnostics">
        <div class="hmp-panel-head"><div><p class="hmp-kicker">ĐO LƯỜNG CỤC BỘ</p><h2>Chẩn đoán tín hiệu</h2></div><span class="hmp-warning">LUFS ước tính</span></div>
        <div class="hmp-metrics-grid">
          ${metric("Peak", metrics ? `${metrics.peakDb.toFixed(1)} dBFS` : "--", "sample peak", metrics?.peakDb > -0.2 ? "is-danger" : "")}
          ${metric("LUFS", metrics ? `${metrics.lufsEstimate.toFixed(1)}` : "--", "ước tính, không BS.1770")}
          ${metric("Độ động", metrics ? `${metrics.dynamicRangeDb.toFixed(1)} dB` : "--", "P95 - P10")}
          ${metric("Stereo", metrics ? metrics.stereoCorrelation.toFixed(2) : "--", "correlation", metrics?.stereoCorrelation < -0.15 ? "is-danger" : "")}
          ${metric("Crest", metrics ? `${metrics.crestDb.toFixed(1)} dB` : "--", "peak / RMS")}
          ${metric("Centroid", metrics ? `${Math.round(metrics.spectrum.centroidHz)} Hz` : "--", "phổ ước tính")}
        </div>
        <p class="hmp-meter-note">Các số đo hỗ trợ rà nhanh tại thiết bị. Hãy dùng loudness meter chuẩn ITU-R BS.1770/EBU R128 trước khi phát hành.</p>
        <div class="hmp-issues">${mix.issues.length ? mix.issues.map((issue) => `<article class="hmp-issue is-${issue.severity}"><span class="hmp-status-dot" aria-hidden="true"></span><div><strong>${escapeHtml(issue.title)}</strong><p>${escapeHtml(issue.explanation)}</p>${issue.suggestion ? `<details><summary>Xem cách xử lý</summary><p>${escapeHtml(issue.suggestion.explanation)}</p><button type="button" data-hmp-apply-suggestion="${escapeHtml(issue.suggestion.id)}">${escapeHtml(issue.suggestion.label)}</button></details>` : ""}</div></article>`).join("") : `<div class="hmp-empty">Nhập audio để bắt đầu phân tích peak, RMS, độ động, phase và phổ.</div>`}</div>
      </section>

      <section class="hmp-panel hmp-stack-panel">
        <div class="hmp-panel-head"><div><p class="hmp-kicker">NON-DESTRUCTIVE</p><h2>Adjustment Mix</h2></div><span>${mix.adjustmentStack.length} lớp</span></div>
        <div class="hmp-preset-row">${Object.values(MIX_PRESETS).map((item) => `<button type="button" data-hmp-action="preset" data-value="${item.id}" class="${mix.preset === item.id ? "is-active" : ""}">${item.label}<small>${item.targetLufs} LUFS*</small></button>`).join("")}</div>
        <p class="hmp-preset-copy">${escapeHtml(preset.description)}</p>
        <div class="hmp-adjustment-list">${mix.adjustmentStack.length ? mix.adjustmentStack.map((item, index) => `<article><button type="button" class="hmp-stack-toggle ${item.enabled ? "is-on" : ""}" data-hmp-toggle-adjustment="${escapeHtml(item.id)}" aria-pressed="${item.enabled}"><span>${String(index + 1).padStart(2, "0")}</span><div><strong>${escapeHtml(item.label)}</strong><small>${escapeHtml(adjustmentSummary(item))}</small></div></button><button type="button" class="hmp-icon-button" data-hmp-remove-adjustment="${escapeHtml(item.id)}" aria-label="Xóa ${escapeHtml(item.label)}">×</button></article>`).join("") : `<div class="hmp-empty">Chưa áp dụng thay đổi. Đề xuất luôn cần bạn xác nhận.</div>`}</div>
        <div class="hmp-panel-actions"><button type="button" data-hmp-action="report" ${metrics ? "" : "disabled"}>Xuất báo cáo JSON</button><button type="button" data-hmp-action="clear-stack" ${mix.adjustmentStack.length ? "" : "disabled"}>Xóa stack</button></div>
      </section>
    </div>`;
  }

  function adjustmentSummary(item) {
    if (item.type === "gain") return `${item.gainDb >= 0 ? "+" : ""}${item.gainDb.toFixed(1)} dB`;
    if (["highpass", "lowshelf", "highshelf", "peaking"].includes(item.type)) return `${item.frequency.toFixed(0)} Hz${item.type !== "highpass" ? ` · ${item.gainDb >= 0 ? "+" : ""}${item.gainDb.toFixed(1)} dB` : ""}`;
    if (item.type === "compressor") return `${item.threshold.toFixed(0)} dB · ${item.ratio.toFixed(1)}:1`;
    return `Width ${Math.round(item.width * 100)}%`;
  }

  function liveMarkup(state) {
    const live = state.live;
    const macroLabels = { mood: "Mood", groove: "Groove", tension: "Tension", density: "Density" };
    const mappingCount = Object.keys(live.midi.mappings).length;
    return `<div class="hmp-live-layout">
      <section class="hmp-panel hmp-live-topbar">
        <div><p class="hmp-kicker">CLIP PERFORMANCE ENGINE</p><h2>${live.bpm} BPM · ${escapeHtml(live.key)}</h2><p>Context: ${state.project.contextSource === "HHMusicProjectContext" ? "dự án chung" : "fallback cục bộ"}</p></div>
        <div class="hmp-live-transport"><button type="button" class="hmp-primary" data-hmp-action="live-toggle">${live.playing ? "Dừng" : "Phát"}</button><button type="button" data-hmp-action="loop" class="${live.loop ? "is-active" : ""}" aria-pressed="${live.loop}">Loop</button><button type="button" data-hmp-action="overdub" class="${live.overdub ? "is-active" : ""}" aria-pressed="${live.overdub}">Overdub</button><span data-hmp-step>1.1</span></div>
      </section>

      <section class="hmp-panel hmp-launcher">
        <div class="hmp-panel-head"><div><p class="hmp-kicker">SCENES</p><h2>Clip Launcher</h2></div><span>Quantize 1/16</span></div>
        <div class="hmp-clip-grid" role="grid" aria-label="Ma trận clip">
          <div class="hmp-grid-corner"></div>${SCENES.map((scene) => `<button type="button" class="hmp-scene-head is-${scene.color} ${live.activeScene === scene.id ? "is-active" : ""}" data-hmp-scene="${scene.id}">${scene.label}<small>Phát cảnh</small></button>`).join("")}
          ${TRACKS.map((track) => `<div class="hmp-track-name"><strong>${TRACK_LABELS[track]}</strong><small>${track.toUpperCase()}</small></div>${SCENES.map((scene) => { const enabled = live.activeClips[track] === scene.id; return `<button type="button" role="gridcell" class="hmp-clip is-${scene.color} ${enabled ? "is-active" : ""}" data-hmp-clip="${track}" data-scene="${scene.id}" aria-pressed="${enabled}"><span aria-hidden="true">${enabled ? "▶" : "＋"}</span><strong>${scene.label}</strong><small>${scene.patterns[track].filter(Boolean).length} hits</small></button>`; }).join("")}`).join("")}
        </div>
      </section>

      <section class="hmp-panel hmp-pads-panel">
        <div class="hmp-panel-head"><div><p class="hmp-kicker">PERFORMANCE PADS</p><h2>Chơi trực tiếp</h2></div><span>Velocity cảm ứng MIDI</span></div>
        <div class="hmp-pads">${PAD_NOTES.map((note, index) => `<button type="button" data-hmp-pad="${index}" aria-label="Pad ${index + 1}, MIDI note ${note}"><span>P${index + 1}</span><strong>${["C", "D", "E", "F", "G", "A", "B", "C+"][index]}</strong><small>${note}</small></button>`).join("")}</div>
      </section>

      <section class="hmp-panel hmp-macro-panel">
        <div class="hmp-panel-head"><div><p class="hmp-kicker">MACRO CONTROL</p><h2>Biến đổi phiên diễn</h2></div><span>Automation-ready</span></div>
        <div class="hmp-macros">${Object.entries(live.macros).map(([name, value]) => `<label><span>${macroLabels[name]}<output data-hmp-macro-output="${name}">${value}%</output></span><input type="range" min="0" max="100" value="${value}" data-hmp-macro="${name}" aria-label="${macroLabels[name]}"></label>`).join("")}</div>
      </section>

      <section class="hmp-panel hmp-midi-panel">
        <div class="hmp-panel-head"><div><p class="hmp-kicker">WEB MIDI</p><h2>MIDI Learn</h2></div><span class="${runtimeMidiTone(live.midi.status)}">${escapeHtml(live.midi.status)}</span></div>
        <p>Quyền MIDI chỉ được hỏi sau khi bạn bấm kết nối. Module không yêu cầu SysEx.</p>
        <div class="hmp-midi-actions"><button type="button" data-hmp-action="connect-midi">Kết nối MIDI</button><select data-hmp-midi-target aria-label="Chọn điều khiển cho MIDI Learn">${PAD_NOTES.map((_, index) => `<option value="pad-${index}" ${live.midi.learnTarget === `pad-${index}` ? "selected" : ""}>Pad ${index + 1}</option>`).join("")}<option value="macro-mood" ${live.midi.learnTarget === "macro-mood" ? "selected" : ""}>Macro Mood</option><option value="macro-groove" ${live.midi.learnTarget === "macro-groove" ? "selected" : ""}>Macro Groove</option><option value="macro-tension" ${live.midi.learnTarget === "macro-tension" ? "selected" : ""}>Macro Tension</option><option value="macro-density" ${live.midi.learnTarget === "macro-density" ? "selected" : ""}>Macro Density</option></select><button type="button" data-hmp-action="midi-learn">Chờ tín hiệu</button></div>
        <div class="hmp-midi-map"><strong>${mappingCount} ánh xạ</strong><span>${mappingCount ? Object.entries(live.midi.mappings).map(([key, target]) => `${escapeHtml(key)} → ${escapeHtml(target)}`).join(" · ") : "Chưa có mapping"}</span></div>
      </section>

      <section class="hmp-panel hmp-automation-panel">
        <div class="hmp-panel-head"><div><p class="hmp-kicker">AUTOMATION</p><h2>Ghi chuyển động</h2></div><span>${live.automation.events.length} event</span></div>
        <div class="hmp-record-state ${live.automation.recording ? "is-recording" : ""}"><i aria-hidden="true"></i><div><strong>${live.automation.recording ? "Đang ghi automation" : "Sẵn sàng ghi"}</strong><small>${live.overdub ? "Overdub giữ lại event cũ" : "Bản ghi mới sẽ thay event cũ"}</small></div></div>
        <div class="hmp-panel-actions"><button type="button" data-hmp-action="automation-record" class="${live.automation.recording ? "is-active" : ""}">${live.automation.recording ? "Dừng ghi" : "Bắt đầu ghi"}</button><button type="button" data-hmp-action="automation-export" ${live.automation.events.length ? "" : "disabled"}>Xuất automation</button><button type="button" data-hmp-action="automation-clear" ${live.automation.events.length ? "" : "disabled"}>Xóa</button></div>
      </section>
    </div>`;
  }

  function runtimeMidiTone(status) {
    return /Đã kết nối/.test(status) ? "hmp-status-good" : /Không|lỗi|chặn/i.test(status) ? "hmp-status-bad" : "";
  }

  function render(runtime) {
    const playing = runtime.state.live.playing;
    runtime.state.mixPlaying = runtime.mixPlaying;
    runtime.host.innerHTML = shellMarkup(runtime.state);
    runtime.state.live.playing = playing;
    if (runtime.state.view === "mix-doctor" && runtime.audioBuffer) drawWaveform(runtime);
  }

  function notice(runtime, message, tone) {
    const element = runtime.host.querySelector?.("[data-hmp-notice]");
    if (!element) return;
    element.textContent = safeText(message, 260);
    element.dataset.tone = tone || "info";
    element.classList.add("is-visible");
    runtime.scope.clearTimeout?.(runtime.noticeTimer);
    runtime.noticeTimer = runtime.scope.setTimeout?.(() => element.classList.remove("is-visible"), 3600);
  }

  function ensureAudioContext(runtime) {
    if (runtime.audioContext && runtime.audioContext.state !== "closed") return runtime.audioContext;
    const AudioContextClass = runtime.scope.AudioContext || runtime.scope.webkitAudioContext;
    if (!AudioContextClass) throw new Error("Trình duyệt này chưa hỗ trợ Web Audio API.");
    runtime.audioContext = runtime.resources.setContext(new AudioContextClass());
    return runtime.audioContext;
  }

  async function decodeFile(runtime, file) {
    if (!file || (!String(file.type || "").startsWith("audio/") && !/\.(wav|mp3|m4a|aac|ogg|flac|webm)$/i.test(file.name || ""))) throw new Error("Hãy chọn một tệp audio hợp lệ.");
    if (Number(file.size) > 1024 * 1024 * 600) throw new Error("Tệp vượt quá 600 MB. Hãy dùng proxy hoặc Desktop Bridge cho dự án lớn.");
    const context = ensureAudioContext(runtime);
    if (context.state === "suspended") await context.resume();
    const arrayBuffer = typeof file.arrayBuffer === "function" ? await file.arrayBuffer() : await readFileAsArrayBuffer(runtime.scope, file);
    const buffer = await context.decodeAudioData(arrayBuffer.slice(0));
    runtime.audioBuffer = buffer;
    const channels = Array.from({ length: buffer.numberOfChannels }, (_, index) => buffer.getChannelData(index));
    const metrics = analyzePCM(channels, buffer.sampleRate);
    runtime.state.mix.file = { name: safeText(file.name, 180) || "audio", type: safeText(file.type, 80), size: Number(file.size) || 0, duration: buffer.duration, availableThisSession: true };
    runtime.state.mix.metrics = metrics;
    runtime.state.mix.issues = buildMixIssues(metrics, runtime.state.mix.preset);
    runtime.state.mix.ab = "A";
    stopMix(runtime);
    saveState(runtime);
    render(runtime);
    notice(runtime, "Đã giải mã và phân tích audio ngay trên thiết bị.", "success");
  }

  function readFileAsArrayBuffer(scope, file) {
    return new Promise((resolve, reject) => {
      const Reader = scope.FileReader;
      if (!Reader) { reject(new Error("Không thể đọc tệp trên trình duyệt này.")); return; }
      const reader = new Reader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error("Đọc tệp audio thất bại."));
      reader.readAsArrayBuffer(file);
    });
  }

  function drawCanvas(runtime, selector, painter) {
    const canvas = runtime.host.querySelector?.(selector);
    const context = canvas?.getContext?.("2d");
    if (!canvas || !context) return null;
    const bounds = canvas.getBoundingClientRect?.() || { width: 640, height: 150 };
    const ratio = Math.min(2, runtime.scope.devicePixelRatio || 1);
    canvas.width = Math.max(1, Math.floor((bounds.width || 640) * ratio));
    canvas.height = Math.max(1, Math.floor((bounds.height || 150) * ratio));
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    painter(context, bounds.width || 640, bounds.height || 150);
    return canvas;
  }

  function drawWaveform(runtime) {
    if (!runtime.audioBuffer) return;
    drawCanvas(runtime, "[data-hmp-waveform]", (context, width, height) => {
      context.clearRect(0, 0, width, height);
      const data = runtime.audioBuffer.getChannelData(0);
      const step = Math.max(1, Math.ceil(data.length / width));
      const middle = height / 2;
      context.strokeStyle = "#63dce5";
      context.lineWidth = 1;
      context.beginPath();
      for (let x = 0; x < width; x += 1) {
        let min = 1;
        let max = -1;
        for (let offset = 0; offset < step; offset += 1) {
          const value = data[x * step + offset] || 0;
          min = Math.min(min, value);
          max = Math.max(max, value);
        }
        context.moveTo(x, middle + min * middle * 0.88);
        context.lineTo(x, middle + max * middle * 0.88);
      }
      context.stroke();
      context.strokeStyle = "rgba(255,255,255,.15)";
      context.beginPath(); context.moveTo(0, middle); context.lineTo(width, middle); context.stroke();
    });
  }

  function createStereoWidthChain(context, width) {
    if (!context.createChannelSplitter || !context.createChannelMerger) return null;
    const splitter = context.createChannelSplitter(2);
    const merger = context.createChannelMerger(2);
    const coefficients = [(1 + width) / 2, (1 - width) / 2, (1 - width) / 2, (1 + width) / 2];
    const gains = coefficients.map((value) => { const node = context.createGain(); node.gain.value = value; return node; });
    splitter.connect(gains[0], 0); gains[0].connect(merger, 0, 0);
    splitter.connect(gains[1], 1); gains[1].connect(merger, 0, 0);
    splitter.connect(gains[2], 0); gains[2].connect(merger, 0, 1);
    splitter.connect(gains[3], 1); gains[3].connect(merger, 0, 1);
    return { input: splitter, output: merger, nodes: [splitter, merger, ...gains] };
  }

  function buildAdjustmentGraph(runtime, context, source) {
    let tail = source;
    const nodes = [];
    if (runtime.state.mix.ab === "B") {
      runtime.state.mix.adjustmentStack.filter((item) => item.enabled).forEach((item) => {
        if (item.type === "gain") {
          const node = context.createGain(); node.gain.value = Math.pow(10, item.gainDb / 20); tail.connect(node); tail = node; nodes.push(node);
        } else if (["highpass", "lowshelf", "highshelf", "peaking"].includes(item.type)) {
          const node = context.createBiquadFilter(); node.type = item.type; node.frequency.value = item.frequency; node.Q.value = item.q; node.gain.value = item.gainDb; tail.connect(node); tail = node; nodes.push(node);
        } else if (item.type === "compressor") {
          const node = context.createDynamicsCompressor(); node.threshold.value = item.threshold; node.ratio.value = item.ratio; node.attack.value = item.attack; node.release.value = item.release; tail.connect(node); tail = node; nodes.push(node);
        } else if (item.type === "stereo-width") {
          const chain = createStereoWidthChain(context, item.width);
          if (chain) { tail.connect(chain.input); tail = chain.output; nodes.push(...chain.nodes); }
        }
      });
    }
    nodes.forEach((node) => {
      runtime.resources.addNode(node);
      runtime.mixNodes.add(node);
    });
    return tail;
  }

  async function playMix(runtime) {
    if (!runtime.audioBuffer) throw new Error("Hãy nhập audio trước.");
    if (runtime.mixPlaying) { stopMix(runtime); render(runtime); return; }
    const context = ensureAudioContext(runtime);
    if (context.state === "suspended") await context.resume();
    const source = context.createBufferSource();
    source.buffer = runtime.audioBuffer;
    const analyser = context.createAnalyser();
    analyser.fftSize = 1024;
    analyser.smoothingTimeConstant = 0.76;
    const tail = buildAdjustmentGraph(runtime, context, source);
    tail.connect(analyser);
    analyser.connect(context.destination);
    runtime.resources.addSource(source); runtime.resources.addNode(analyser); runtime.mixNodes.add(analyser);
    runtime.mixSource = source; runtime.mixAnalyser = analyser; runtime.mixPlaying = true;
    source.onended = () => { if (runtime.mixSource === source) { runtime.resources.removeSource(source); runtime.mixSource = null; runtime.mixPlaying = false; stopSpectrum(runtime); render(runtime); } };
    source.start();
    drawSpectrum(runtime);
    render(runtime);
  }

  function stopSpectrum(runtime) {
    if (runtime.spectrumFrame != null) {
      runtime.scope.cancelAnimationFrame?.(runtime.spectrumFrame);
      runtime.resources.removeFrame(runtime.spectrumFrame);
      runtime.spectrumFrame = null;
    }
  }

  function stopMix(runtime) {
    stopSpectrum(runtime);
    if (runtime.mixSource) {
      try { runtime.mixSource.onended = null; runtime.mixSource.stop(); runtime.mixSource.disconnect(); } catch (_error) {}
      runtime.resources.removeSource(runtime.mixSource);
    }
    runtime.mixSource = null; runtime.mixAnalyser = null; runtime.mixPlaying = false;
    runtime.mixNodes.forEach((node) => {
      try { node.disconnect?.(); } catch (_error) {}
      runtime.resources.removeNode(node);
    });
    runtime.mixNodes.clear();
  }

  function drawSpectrum(runtime) {
    stopSpectrum(runtime);
    const tick = () => {
      if (runtime.spectrumFrame != null) {
        runtime.resources.removeFrame(runtime.spectrumFrame);
        runtime.spectrumFrame = null;
      }
      if (!runtime.mixPlaying || !runtime.mixAnalyser) return;
      const values = new Uint8Array(runtime.mixAnalyser.frequencyBinCount);
      runtime.mixAnalyser.getByteFrequencyData(values);
      drawCanvas(runtime, "[data-hmp-spectrum]", (context, width, height) => {
        context.clearRect(0, 0, width, height);
        const bars = 48;
        const gap = 3;
        const barWidth = Math.max(2, width / bars - gap);
        for (let index = 0; index < bars; index += 1) {
          const sourceIndex = Math.floor((index / bars) ** 1.8 * values.length);
          const normalized = values[sourceIndex] / 255;
          context.fillStyle = index < 12 ? "#63dce5" : index < 34 ? "#f06bb7" : "#f6d86b";
          context.fillRect(index * (barWidth + gap), height - normalized * height, barWidth, normalized * height);
        }
      });
      runtime.spectrumFrame = runtime.scope.requestAnimationFrame?.(tick);
      if (runtime.spectrumFrame != null) runtime.resources.addFrame(runtime.spectrumFrame);
    };
    tick();
  }

  function downloadJson(runtime, filename, data) {
    const BlobClass = runtime.scope.Blob;
    if (!BlobClass || !runtime.scope.URL?.createObjectURL || !runtime.scope.document?.createElement) {
      notice(runtime, "Trình duyệt không hỗ trợ tải tệp JSON.", "error"); return false;
    }
    const blob = new BlobClass([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = runtime.resources.addUrl(runtime.scope.URL.createObjectURL(blob));
    const link = runtime.scope.document.createElement("a");
    link.href = url; link.download = filename; link.click();
    runtime.scope.setTimeout?.(() => { runtime.scope.URL.revokeObjectURL(url); runtime.resources.removeUrl(url); }, 1000);
    return true;
  }

  function sceneById(id) {
    return SCENES.find((scene) => scene.id === id) || SCENES[0];
  }

  function frequencyFromMidi(note) {
    return 440 * Math.pow(2, (note - 69) / 12);
  }

  function scheduleTone(runtime, frequency, time, duration, type, gainValue) {
    const context = runtime.audioContext;
    if (!context) return;
    const oscillator = context.createOscillator();
    const gainNode = context.createGain();
    oscillator.type = type || "triangle";
    oscillator.frequency.setValueAtTime(frequency, time);
    gainNode.gain.setValueAtTime(Math.max(0.0001, gainValue || 0.1), time);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, time + duration);
    oscillator.connect(gainNode); gainNode.connect(context.destination);
    runtime.resources.addSource(oscillator); runtime.resources.addNode(gainNode);
    oscillator.onended = () => {
      try { oscillator.disconnect(); gainNode.disconnect(); } catch (_error) {}
      runtime.resources.removeSource(oscillator); runtime.resources.removeNode(gainNode);
    };
    oscillator.start(time); oscillator.stop(time + duration + 0.02);
  }

  function scheduleDrum(runtime, time, accent) {
    const context = runtime.audioContext;
    const oscillator = context.createOscillator();
    const gainNode = context.createGain();
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(125, time);
    oscillator.frequency.exponentialRampToValueAtTime(48, time + 0.12);
    gainNode.gain.setValueAtTime(0.22 * accent, time);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, time + 0.16);
    oscillator.connect(gainNode); gainNode.connect(context.destination);
    runtime.resources.addSource(oscillator); runtime.resources.addNode(gainNode);
    oscillator.onended = () => {
      try { oscillator.disconnect(); gainNode.disconnect(); } catch (_error) {}
      runtime.resources.removeSource(oscillator); runtime.resources.removeNode(gainNode);
    };
    oscillator.start(time); oscillator.stop(time + 0.18);
  }

  function scheduleTrackStep(runtime, track, scene, step, time) {
    const pattern = scene.patterns[track];
    if (!pattern[step]) return;
    const density = runtime.state.live.macros.density / 100;
    if (((step * 37 + TRACKS.indexOf(track) * 19) % 100) / 100 > density) return;
    const tension = runtime.state.live.macros.tension;
    const mood = runtime.state.live.macros.mood;
    if (track === "drums") scheduleDrum(runtime, time, step % 4 === 0 ? 1 : 0.72);
    if (track === "bass") scheduleTone(runtime, frequencyFromMidi(36 + (tension > 70 ? 3 : 0) + (step >= 8 ? 5 : 0)), time, 0.18, "sawtooth", 0.07);
    if (track === "chords") {
      const root = 48 + (mood > 60 ? 4 : 0) + (step >= 8 ? 5 : 0);
      [0, mood >= 50 ? 4 : 3, 7].forEach((offset) => scheduleTone(runtime, frequencyFromMidi(root + offset), time, 0.34, "triangle", 0.035));
    }
    if (track === "lead") scheduleTone(runtime, frequencyFromMidi(60 + ((step * 5 + Math.round(tension / 20)) % 12)), time, 0.12, "square", 0.028);
  }

  function updateStepIndicator(runtime) {
    const element = runtime.host.querySelector?.("[data-hmp-step]");
    if (element) element.textContent = `${Math.floor(runtime.liveStep / 4) + 1}.${(runtime.liveStep % 4) + 1}`;
  }

  function schedulerTick(runtime) {
    const context = runtime.audioContext;
    if (!context) return;
    const secondsPerStep = 60 / runtime.state.live.bpm / 4;
    while (runtime.nextNoteTime < context.currentTime + 0.1) {
      const swing = runtime.liveStep % 2 ? secondsPerStep * (runtime.state.live.macros.groove / 100) * 0.28 : 0;
      TRACKS.forEach((track) => {
        const sceneId = runtime.state.live.activeClips[track];
        if (sceneId) scheduleTrackStep(runtime, track, sceneById(sceneId), runtime.liveStep, runtime.nextNoteTime + swing);
      });
      runtime.liveStep = (runtime.liveStep + 1) % 16;
      runtime.nextNoteTime += secondsPerStep;
      if (runtime.liveStep === 0 && !runtime.state.live.loop) { stopLive(runtime); break; }
    }
    updateStepIndicator(runtime);
  }

  async function startLive(runtime) {
    const context = ensureAudioContext(runtime);
    if (context.state === "suspended") await context.resume();
    if (runtime.schedulerId != null) return;
    mergeProjectContext(runtime.state, runtime.scope);
    runtime.state.live.playing = true;
    runtime.nextNoteTime = context.currentTime + 0.05;
    runtime.liveStep = 0;
    runtime.schedulerId = runtime.scope.setInterval?.(() => schedulerTick(runtime), 25);
    if (runtime.schedulerId != null) runtime.resources.addInterval(runtime.schedulerId);
    saveState(runtime); render(runtime);
  }

  function stopLive(runtime) {
    if (runtime.schedulerId != null) {
      runtime.scope.clearInterval?.(runtime.schedulerId);
      runtime.resources.removeInterval(runtime.schedulerId);
      runtime.schedulerId = null;
    }
    runtime.state.live.playing = false;
    saveState(runtime);
  }

  async function triggerPad(runtime, index, velocity) {
    const context = ensureAudioContext(runtime);
    if (context.state === "suspended") await context.resume();
    const padIndex = clamp(index, 0, PAD_NOTES.length - 1, 0);
    const level = clamp(velocity, 1, 127, 100) / 127;
    scheduleTone(runtime, frequencyFromMidi(PAD_NOTES[padIndex]), context.currentTime, 0.32, padIndex % 2 ? "triangle" : "sawtooth", 0.06 + level * 0.09);
    recordAutomationEvent(runtime.state.live, `pad-${padIndex}`, Math.round(level * 127), Date.now());
    saveState(runtime);
  }

  function midiSignature(data) {
    const status = (Number(data?.[0]) || 0) & 0xf0;
    const control = Number(data?.[1]) || 0;
    return `${status}:${control}`;
  }

  function applyMidiTarget(runtime, target, value) {
    const padMatch = /^pad-([0-7])$/.exec(target);
    if (padMatch && value > 0) { triggerPad(runtime, Number(padMatch[1]), value).catch((error) => notice(runtime, error.message, "error")); return; }
    const macroMatch = /^macro-(mood|groove|tension|density)$/.exec(target);
    if (macroMatch) {
      runtime.state.live.macros[macroMatch[1]] = Math.round(clamp(value, 0, 127, 0) / 127 * 100);
      recordAutomationEvent(runtime.state.live, target, value, Date.now());
      saveState(runtime); render(runtime);
    }
  }

  function onMidiMessage(runtime, event) {
    const data = event?.data || [];
    const status = (Number(data[0]) || 0) & 0xf0;
    const value = Number(data[2]) || 0;
    if (![0x90, 0xb0].includes(status) || (status === 0x90 && value === 0)) return;
    const signature = midiSignature(data);
    if (runtime.midiLearning) {
      runtime.state.live.midi.mappings[signature] = runtime.state.live.midi.learnTarget;
      runtime.midiLearning = false;
      saveState(runtime); render(runtime); notice(runtime, `Đã gán ${signature} cho ${runtime.state.live.midi.learnTarget}.`, "success"); return;
    }
    const target = runtime.state.live.midi.mappings[signature];
    if (target) applyMidiTarget(runtime, target, value);
  }

  async function connectMidi(runtime) {
    if (typeof runtime.scope.navigator?.requestMIDIAccess !== "function") {
      runtime.state.live.midi.status = "Không hỗ trợ Web MIDI"; render(runtime); return;
    }
    try {
      const access = await runtime.scope.navigator.requestMIDIAccess({ sysex: false });
      runtime.midiAccess = access;
      const attachInputs = () => {
        const currentInputs = Array.from(access.inputs?.values?.() || []);
        currentInputs.forEach((input) => { input.onmidimessage = (event) => onMidiMessage(runtime, event); runtime.resources.addMidiInput(input); });
        return currentInputs;
      };
      const inputs = attachInputs();
      access.onstatechange = () => {
        const count = attachInputs().length;
        runtime.state.live.midi.status = `Đã kết nối · ${count} input`;
        render(runtime);
      };
      runtime.state.live.midi.status = `Đã kết nối · ${inputs.length} input`;
      render(runtime); notice(runtime, inputs.length ? "MIDI sẵn sàng." : "Đã cấp quyền nhưng chưa thấy thiết bị MIDI.", inputs.length ? "success" : "info");
    } catch (error) {
      runtime.state.live.midi.status = "Quyền MIDI bị từ chối";
      render(runtime); notice(runtime, error?.message || "Không thể kết nối MIDI.", "error");
    }
  }

  async function handleClick(runtime, event) {
    const button = event.target.closest?.("button");
    if (!button) return;
    if (button.dataset.hmpViewButton) {
      stopMix(runtime); stopLive(runtime); runtime.state.view = button.dataset.hmpViewButton;
      mergeProjectContext(runtime.state, runtime.scope); saveState(runtime); render(runtime); return;
    }
    if (button.dataset.hmpAction === "choose-file") { runtime.host.querySelector?.("[data-hmp-file]")?.click?.(); return; }
    if (button.dataset.hmpApplySuggestion) {
      const suggestionValue = runtime.state.mix.issues.map((item) => item.suggestion).find((item) => item?.id === button.dataset.hmpApplySuggestion);
      if (applySuggestion(runtime.state, suggestionValue)) { saveState(runtime); render(runtime); notice(runtime, "Đã thêm đề xuất vào Adjustment Mix. Tệp gốc không đổi.", "success"); }
      return;
    }
    if (button.dataset.hmpToggleAdjustment) {
      const item = runtime.state.mix.adjustmentStack.find((entry) => entry.id === button.dataset.hmpToggleAdjustment);
      if (item) item.enabled = !item.enabled; saveState(runtime); render(runtime); return;
    }
    if (button.dataset.hmpRemoveAdjustment) {
      runtime.state.mix.adjustmentStack = runtime.state.mix.adjustmentStack.filter((item) => item.id !== button.dataset.hmpRemoveAdjustment);
      saveState(runtime); render(runtime); return;
    }
    if (button.dataset.hmpScene) {
      runtime.state.live.activeScene = button.dataset.hmpScene;
      TRACKS.forEach((track) => { runtime.state.live.activeClips[track] = button.dataset.hmpScene; });
      recordAutomationEvent(runtime.state.live, "scene", button.dataset.hmpScene, Date.now());
      if (!runtime.state.live.playing) await startLive(runtime); else { saveState(runtime); render(runtime); }
      return;
    }
    if (button.dataset.hmpClip) {
      const track = button.dataset.hmpClip;
      const sceneId = button.dataset.scene;
      runtime.state.live.activeClips[track] = runtime.state.live.activeClips[track] === sceneId ? null : sceneId;
      recordAutomationEvent(runtime.state.live, `clip-${track}`, runtime.state.live.activeClips[track] || "off", Date.now());
      saveState(runtime); render(runtime); return;
    }
    if (button.dataset.hmpPad != null) { await triggerPad(runtime, Number(button.dataset.hmpPad), 108); return; }
    const action = button.dataset.hmpAction;
    if (action === "mix-play") { try { await playMix(runtime); } catch (error) { notice(runtime, error.message, "error"); } return; }
    if (action === "ab") {
      runtime.state.mix.ab = button.dataset.value === "B" ? "B" : "A";
      const wasPlaying = runtime.mixPlaying; stopMix(runtime); saveState(runtime); render(runtime);
      if (wasPlaying) await playMix(runtime); return;
    }
    if (action === "preset") {
      if (applyPreset(runtime.state, button.dataset.value)) { runtime.state.mix.issues = runtime.state.mix.metrics ? buildMixIssues(runtime.state.mix.metrics, button.dataset.value) : []; saveState(runtime); render(runtime); notice(runtime, "Preset đã được thêm thành các lớp có thể tắt hoặc xóa.", "success"); }
      return;
    }
    if (action === "clear-stack") { runtime.state.mix.adjustmentStack = []; runtime.state.mix.ab = "A"; saveState(runtime); render(runtime); return; }
    if (action === "report") { downloadJson(runtime, "hh-mix-doctor-report.json", createMixReport(runtime.state)); return; }
    if (action === "live-toggle") { if (runtime.state.live.playing) { stopLive(runtime); render(runtime); } else await startLive(runtime); return; }
    if (action === "loop" || action === "overdub") { runtime.state.live[action] = !runtime.state.live[action]; recordAutomationEvent(runtime.state.live, action, runtime.state.live[action] ? 1 : 0, Date.now()); saveState(runtime); render(runtime); return; }
    if (action === "connect-midi") { await connectMidi(runtime); return; }
    if (action === "midi-learn") { runtime.midiLearning = true; notice(runtime, `Đang chờ MIDI cho ${runtime.state.live.midi.learnTarget}…`, "info"); return; }
    if (action === "automation-record") {
      const automation = runtime.state.live.automation;
      if (automation.recording) automation.recording = false;
      else { if (!runtime.state.live.overdub) automation.events = []; automation.recording = true; automation.startedAt = Date.now(); }
      saveState(runtime); render(runtime); return;
    }
    if (action === "automation-export") { downloadJson(runtime, "hh-live-automation.json", exportAutomationData(runtime.state)); return; }
    if (action === "automation-clear") { runtime.state.live.automation.events = []; saveState(runtime); render(runtime); }
  }

  function handleInput(runtime, event) {
    const target = event.target;
    if (target.matches?.("[data-hmp-macro]")) {
      const name = target.dataset.hmpMacro;
      const value = clamp(target.value, 0, 100, 50);
      runtime.state.live.macros[name] = value;
      const output = runtime.host.querySelector?.(`[data-hmp-macro-output="${name}"]`);
      if (output) output.textContent = `${value}%`;
      recordAutomationEvent(runtime.state.live, `macro-${name}`, Math.round(value / 100 * 127), Date.now());
      saveState(runtime);
    }
  }

  async function handleChange(runtime, event) {
    const target = event.target;
    if (target.matches?.("[data-hmp-file]") && target.files?.[0]) {
      try { await decodeFile(runtime, target.files[0]); } catch (error) { notice(runtime, error.message, "error"); }
    }
    if (target.matches?.("[data-hmp-midi-target]")) {
      runtime.state.live.midi.learnTarget = safeText(target.value, 40);
      saveState(runtime);
    }
  }

  function bind(runtime) {
    runtime.onClick = (event) => { handleClick(runtime, event).catch((error) => notice(runtime, error?.message || "Tác vụ thất bại.", "error")); };
    runtime.onInput = (event) => handleInput(runtime, event);
    runtime.onChange = (event) => { handleChange(runtime, event).catch((error) => notice(runtime, error?.message || "Không thể đọc dữ liệu.", "error")); };
    runtime.onDragOver = (event) => { const zone = event.target.closest?.("[data-hmp-dropzone]"); if (!zone) return; event.preventDefault(); zone.classList.add("is-dragging"); };
    runtime.onDragLeave = (event) => event.target.closest?.("[data-hmp-dropzone]")?.classList.remove("is-dragging");
    runtime.onDrop = (event) => {
      const zone = event.target.closest?.("[data-hmp-dropzone]"); if (!zone) return;
      event.preventDefault(); zone.classList.remove("is-dragging");
      const file = event.dataTransfer?.files?.[0];
      if (file) decodeFile(runtime, file).catch((error) => notice(runtime, error.message, "error"));
    };
    runtime.host.addEventListener?.("click", runtime.onClick);
    runtime.host.addEventListener?.("input", runtime.onInput);
    runtime.host.addEventListener?.("change", runtime.onChange);
    runtime.host.addEventListener?.("dragover", runtime.onDragOver);
    runtime.host.addEventListener?.("dragleave", runtime.onDragLeave);
    runtime.host.addEventListener?.("drop", runtime.onDrop);
  }

  function mount(host, options) {
    if (!host || typeof host !== "object") throw new TypeError("HHMusicMixPerformance.mount cần một host hợp lệ.");
    if (active) void unmount();
    const scope = options?.scope || globalScope;
    const state = loadState(scope);
    state.view = supports(options?.view) ? String(options.view).toLowerCase() : "mix-doctor";
    mergeProjectContext(state, scope);
    active = {
      host, scope, state, resources: createResourceBag(scope), audioContext: null, audioBuffer: null,
      mixSource: null, mixAnalyser: null, mixPlaying: false, mixNodes: new Set(), spectrumFrame: null,
      schedulerId: null, liveStep: 0, nextNoteTime: 0, midiAccess: null, midiLearning: false, noticeTimer: null
    };
    render(active); bind(active); saveState(active);
    return active;
  }

  async function unmount() {
    const runtime = active;
    if (!runtime) return;
    active = null;
    stopMix(runtime); stopLive(runtime);
    runtime.scope.clearTimeout?.(runtime.noticeTimer);
    if (runtime.midiAccess) runtime.midiAccess.onstatechange = null;
    runtime.host.removeEventListener?.("click", runtime.onClick);
    runtime.host.removeEventListener?.("input", runtime.onInput);
    runtime.host.removeEventListener?.("change", runtime.onChange);
    runtime.host.removeEventListener?.("dragover", runtime.onDragOver);
    runtime.host.removeEventListener?.("dragleave", runtime.onDragLeave);
    runtime.host.removeEventListener?.("drop", runtime.onDrop);
    await runtime.resources.cleanup();
    runtime.audioBuffer = null; runtime.midiAccess = null;
    runtime.host.innerHTML = "";
  }

  function lifecycle() {
    return active ? { mounted: true, view: active.state.view, mixPlaying: active.mixPlaying, livePlaying: active.state.live.playing, ...active.resources.stats() } : { mounted: false, view: null, mixPlaying: false, livePlaying: false, urls: 0, nodes: 0, sources: 0, frames: 0, intervals: 0, midiInputs: 0, hasContext: false };
  }

  const api = Object.freeze({
    VERSION, STORAGE_KEY, MIX_PRESETS, SCENES, supports, mount, unmount, lifecycle,
    readProjectContext, createDefaultState, normalizeState, analyzePCM, estimateSpectrum,
    buildMixIssues, applySuggestion, applyPreset, createMixReport,
    recordAutomationEvent, exportAutomationData, createResourceBag
  });

  globalScope.HHMusicMixPerformance = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
