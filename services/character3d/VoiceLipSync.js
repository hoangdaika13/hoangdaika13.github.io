(function initHHCharacter3DVoiceLipSync(global) {
  "use strict";

  const VISEMES = Object.freeze(["aa", "ih", "ou", "ee", "oh"]);
  const clamp = (value, min, max) => Math.min(max, Math.max(min, Number(value) || 0));
  const sanitizeText = (value) => String(value || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, 1500);

  class VoiceLipSync {
    constructor(options = {}) {
      this.expressionController = options.expressionController || null;
      this.audioContext = null;
      this.audio = null;
      this.source = null;
      this.analyser = null;
      this.frame = 0;
      this.objectUrl = "";
      this.timeline = [];
      this.timelineStart = 0;
      this.activeUtterance = null;
      this.mode = "idle";
      this.disposed = false;
      this.onLevel = typeof options.onLevel === "function" ? options.onLevel : null;
      this.onState = typeof options.onState === "function" ? options.onState : null;
    }

    bindExpressionController(controller) { this.expressionController = controller || null; }

    listVoices() {
      const voices = global.speechSynthesis?.getVoices?.() || [];
      return voices.slice().sort((a, b) => Number(/^vi(?:-|$)/i.test(b.lang)) - Number(/^vi(?:-|$)/i.test(a.lang)) || a.name.localeCompare(b.name, "vi"));
    }

    defaultVietnameseFemaleVoice() {
      const voices = this.listVoices();
      const femaleHint = /female|nữ|woman|linh|mai|an\b|vy\b|hoai/i;
      return voices.find((voice) => /^vi(?:-|$)/i.test(voice.lang) && femaleHint.test(`${voice.name} ${voice.voiceURI}`))
        || voices.find((voice) => /^vi(?:-|$)/i.test(voice.lang)) || voices[0] || null;
    }

    async speak(text, options = {}) {
      const content = sanitizeText(text);
      if (!content) return { spoken: false, reason: "empty" };
      this.stop();
      if (options.backendUrl) {
        try { return await this.speakFromBackend(content, options); }
        catch (error) { options.onFallback?.(error.message); }
      }
      if (!global.speechSynthesis || typeof global.SpeechSynthesisUtterance !== "function") return { spoken: false, reason: "speech-synthesis-unsupported" };
      const utterance = new global.SpeechSynthesisUtterance(content);
      const voice = this.listVoices().find((item) => item.voiceURI === options.voiceURI) || this.defaultVietnameseFemaleVoice();
      if (voice) utterance.voice = voice;
      utterance.lang = voice?.lang || "vi-VN";
      utterance.rate = clamp(options.rate ?? 0.96, 0.5, 1.7);
      utterance.pitch = clamp(options.pitch ?? 1.05, 0.5, 1.8);
      utterance.volume = clamp(options.volume ?? 0.9, 0, 1);
      this.mode = "estimated-text";
      this.onState?.({ state: "speaking", mode: this.mode, accuracy: "estimated" });
      this.activeUtterance = utterance;
      this.startTextPulse(content, utterance.rate);
      await new Promise((resolve) => {
        utterance.onend = resolve;
        utterance.onerror = resolve;
        global.speechSynthesis.speak(utterance);
      });
      this.stopLip();
      this.activeUtterance = null;
      this.onState?.({ state: "idle", mode: this.mode, accuracy: "estimated" });
      return { spoken: true, provider: "browser", voice: voice?.name || "vi-VN mặc định", lipSync: "estimated" };
    }

    async speakFromBackend(text, options = {}) {
      const response = await fetch(options.backendUrl, {
        method: "POST", credentials: "include",
        headers: Object.assign({ "Content-Type": "application/json" }, options.headers || {}),
        body: JSON.stringify({ text, voice: options.voice || "vi-female", speed: clamp(options.rate ?? 0.96, 0.5, 1.7), timestamps: true })
      });
      if (!response.ok) throw new Error(`TTS backend chưa sẵn sàng (${response.status}).`);
      const contentType = response.headers.get("content-type") || "";
      if (contentType.includes("application/json")) {
        const data = await response.json();
        if (!data.audioUrl) throw new Error("TTS backend không trả audioUrl.");
        return this.playUrl(data.audioUrl, { timeline: data.visemes || data.timestamps, crossOrigin: "anonymous", allowOrigins: options.allowOrigins || [] });
      }
      return this.playBlob(await response.blob(), { timeline: [] });
    }

    async playFile(file, options = {}) {
      if (!(file instanceof Blob) || !/^audio\//i.test(file.type || "audio/unknown")) throw new Error("Vui lòng chọn một file âm thanh hợp lệ.");
      if (file.size > (options.maxBytes || 50 * 1024 * 1024)) throw new Error("File âm thanh vượt giới hạn dung lượng.");
      return this.playBlob(file, options);
    }

    async playBlob(blob, options = {}) {
      this.stop();
      this.objectUrl = URL.createObjectURL(blob);
      return this.playUrl(this.objectUrl, options);
    }

    async playUrl(url, options = {}) {
      this.stopAudioElement(url);
      const audio = new Audio();
      this.audio = audio;
      let parsed = null;
      try { parsed = new URL(url, global.location?.href || "https://hoang8.com/"); } catch (_) { /* handled below */ }
      const allowedAudioOrigins = new Set((options.allowOrigins || []).filter(Boolean));
      const isLocalSource = parsed && (parsed.protocol === "blob:" || parsed.protocol === "data:" || parsed.origin === global.location?.origin);
      if (!isLocalSource && (!parsed || !allowedAudioOrigins.has(parsed.origin))) throw new Error("Nguồn audio bên ngoài chưa nằm trong allowlist TTS/audio.");
      if (options.crossOrigin) audio.crossOrigin = options.crossOrigin;
      audio.src = parsed?.href || String(url);
      audio.preload = "auto";
      this.timeline = this.normalizeTimeline(options.timeline || []);
      if (this.timeline.length) {
        this.mode = "timestamped-visemes";
        this.timelineStart = performance.now();
        this.startTimelineLoop();
      } else {
        this.mode = "estimated-amplitude";
        await this.attachAnalyser(audio);
        this.startAmplitudeLoop();
      }
      this.onState?.({ state: "speaking", mode: this.mode, accuracy: this.timeline.length ? "provider-timestamp" : "estimated" });
      try {
        await new Promise((resolve, reject) => {
          audio.onended = resolve;
          audio.onerror = () => reject(new Error("Không phát được file âm thanh."));
          audio.play().catch(reject);
        });
        return { played: true, lipSync: this.timeline.length ? "timestamped" : "estimated-amplitude", duration: audio.duration || 0 };
      } finally {
        this.stopLip();
        this.stopAudioElement();
        this.onState?.({ state: "idle", mode: this.mode, accuracy: this.timeline.length ? "provider-timestamp" : "estimated" });
      }
    }

    normalizeTimeline(entries) {
      if (!Array.isArray(entries)) return [];
      return entries.map((entry) => ({
        time: Math.max(0, Number(entry.time ?? entry.start ?? entry.timestamp) || 0),
        duration: Math.max(0.02, Number(entry.duration ?? ((entry.end || 0) - (entry.start || 0))) || 0.12),
        viseme: VISEMES.includes(entry.viseme) ? entry.viseme : VISEMES.includes(entry.value) ? entry.value : "aa",
        weight: clamp(entry.weight ?? 1, 0, 1)
      })).sort((a, b) => a.time - b.time);
    }

    startTimelineLoop() {
      const tick = () => {
        if (!this.audio || this.audio.paused || this.audio.ended) return;
        const time = this.audio.currentTime;
        const active = this.timeline.find((item) => time >= item.time && time <= item.time + item.duration);
        if (active) this.expressionController?.setViseme?.(active.viseme, active.weight, { immediate: true });
        else this.expressionController?.clearVisemes?.({ immediate: true });
        this.frame = requestAnimationFrame(tick);
      };
      this.frame = requestAnimationFrame(tick);
    }

    async attachAnalyser(audio) {
      const AudioContext = global.AudioContext || global.webkitAudioContext;
      if (!AudioContext) return false;
      this.audioContext ||= new AudioContext();
      await this.audioContext.resume?.();
      this.source = this.audioContext.createMediaElementSource(audio);
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 512;
      this.analyser.smoothingTimeConstant = 0.72;
      this.source.connect(this.analyser);
      this.analyser.connect(this.audioContext.destination);
      return true;
    }

    async analyzeWaveform(blob, sampleCount = 160) {
      if (!(blob instanceof Blob)) throw new TypeError("Waveform analysis requires an audio Blob.");
      const AudioContext = global.AudioContext || global.webkitAudioContext;
      if (!AudioContext) throw new Error("Web Audio API chưa được hỗ trợ.");
      const temporary = new AudioContext();
      try {
        const buffer = await temporary.decodeAudioData(await blob.arrayBuffer());
        const samples = Math.max(24, Math.min(1024, Math.round(Number(sampleCount) || 160)));
        const block = Math.max(1, Math.floor(buffer.length / samples));
        const peaks = [];
        for (let index = 0; index < samples; index += 1) {
          let peak = 0;
          const start = index * block;
          const end = Math.min(buffer.length, start + block);
          for (let channel = 0; channel < buffer.numberOfChannels; channel += 1) {
            const data = buffer.getChannelData(channel);
            for (let cursor = start; cursor < end; cursor += 1) peak = Math.max(peak, Math.abs(data[cursor] || 0));
          }
          peaks.push(peak);
        }
        const max = Math.max(0.0001, ...peaks);
        return Object.freeze({ peaks: peaks.map((value) => value / max), duration: buffer.duration, sampleRate: buffer.sampleRate, channels: buffer.numberOfChannels, mode: "amplitude" });
      } finally { await temporary.close?.().catch?.(() => {}); }
    }

    startAmplitudeLoop() {
      if (!this.analyser) return this.startTextPulse("audio", 1);
      const samples = new Uint8Array(this.analyser.fftSize);
      const tick = () => {
        if (!this.audio || this.audio.paused || this.audio.ended) return;
        this.analyser.getByteTimeDomainData(samples);
        let sum = 0;
        for (let i = 0; i < samples.length; i += 1) { const n = (samples[i] - 128) / 128; sum += n * n; }
        const level = clamp(Math.sqrt(sum / samples.length) * 3.2, 0, 1);
        this.expressionController?.setViseme?.("aa", level, { immediate: true });
        this.onLevel?.(level);
        this.frame = requestAnimationFrame(tick);
      };
      this.frame = requestAnimationFrame(tick);
    }

    startTextPulse(text, rate = 1) {
      const start = performance.now();
      const estimatedDuration = Math.max(700, text.length * 58 / Math.max(0.5, rate));
      const tick = (now) => {
        const elapsed = now - start;
        if (elapsed >= estimatedDuration || !this.activeUtterance && this.mode === "estimated-text") return this.stopLip();
        const level = 0.12 + Math.abs(Math.sin(elapsed * 0.019)) * 0.7;
        this.expressionController?.setViseme?.("aa", level, { immediate: true });
        this.onLevel?.(level);
        this.frame = requestAnimationFrame(tick);
      };
      this.frame = requestAnimationFrame(tick);
    }

    stopLip() {
      cancelAnimationFrame(this.frame); this.frame = 0;
      this.expressionController?.clearVisemes?.({ immediate: true });
      this.onLevel?.(0);
    }

    stopAudioElement(preserveUrl = "") {
      if (this.audio) { this.audio.pause(); this.audio.removeAttribute("src"); this.audio.load?.(); this.audio = null; }
      try { this.source?.disconnect?.(); } catch (_) { /* no-op */ }
      try { this.analyser?.disconnect?.(); } catch (_) { /* no-op */ }
      this.source = null; this.analyser = null;
      if (this.objectUrl && this.objectUrl !== preserveUrl) { URL.revokeObjectURL(this.objectUrl); this.objectUrl = ""; }
    }

    stop() {
      global.speechSynthesis?.cancel?.();
      this.activeUtterance = null;
      this.stopLip();
      this.stopAudioElement();
      this.timeline = [];
      this.mode = "idle";
    }

    async dispose() {
      this.stop();
      await this.audioContext?.close?.().catch?.(() => {});
      this.audioContext = null;
      this.expressionController = null;
      this.disposed = true;
    }
  }

  global.HHCharacter3DVoiceLipSync = Object.freeze({ VoiceLipSync, VISEMES });
  global.HHCharacter3D = global.HHCharacter3D || {};
  global.HHCharacter3D.VoiceLipSync = VoiceLipSync;
})(typeof window !== "undefined" ? window : globalThis);
