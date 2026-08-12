(function (global) {
  "use strict";

  let activeAudio = null;
  let activeRecognition = null;
  let lipTimer = 0;
  const audioCache = new Map();
  const synth = global.speechSynthesis;
  const clamp = (value, min, max) => Math.min(max, Math.max(min, Number(value) || 0));

  const PRESETS = Object.freeze([
    { id: "hikari-gentle", label: "Hikari dịu dàng", gender: "female", rate: .92, pitch: 1.08, googleVoice: "vi-VN-Neural2-A", openaiVoice: "coral", hints: /female|nữ|hoai|linh|an|mai/i },
    { id: "hikari-natural", label: "Hikari tự nhiên", gender: "female", rate: 1, pitch: 1.02, googleVoice: "vi-VN-Wavenet-C", openaiVoice: "marin", hints: /female|nữ|linh|an|mai|vy/i },
    { id: "hikari-bright", label: "Hikari năng động", gender: "female", rate: 1.08, pitch: 1.13, googleVoice: "vi-VN-Chirp3-HD-Zephyr", openaiVoice: "shimmer", hints: /female|nữ|linh|an|mai/i },
    { id: "north-female", label: "Nữ miền Bắc", gender: "female", rate: .97, pitch: 1.04, googleVoice: "vi-VN-Standard-A", openaiVoice: "coral", hints: /female|nữ|north|bắc|an|hoai/i },
    { id: "south-female", label: "Nữ miền Nam", gender: "female", rate: 1, pitch: 1.05, googleVoice: "vi-VN-Standard-C", openaiVoice: "marin", hints: /female|nữ|south|nam|linh|mai/i },
    { id: "deep-male", label: "Nam trầm", gender: "male", rate: .9, pitch: .88, googleVoice: "vi-VN-Neural2-D", openaiVoice: "onyx", hints: /male|nam|minh|long/i },
    { id: "slow-clear", label: "Chậm và rõ", gender: "female", rate: .78, pitch: 1, googleVoice: "vi-VN-Standard-A", openaiVoice: "coral", hints: /female|nữ|an|hoai/i },
    { id: "narration", label: "Thuyết minh", gender: "female", rate: .9, pitch: .96, googleVoice: "vi-VN-Chirp3-HD-Pulcherrima", openaiVoice: "sage", hints: /female|nữ|mai|an/i }
  ]);

  const GOOGLE_VOICES = Object.freeze([
    { id: "vi-VN-Neural2-A", label: "Neural2 A · nữ tự nhiên", gender: "female", tier: "premium" },
    { id: "vi-VN-Wavenet-A", label: "WaveNet A · nữ", gender: "female", tier: "premium" },
    { id: "vi-VN-Wavenet-C", label: "WaveNet C · nữ", gender: "female", tier: "premium" },
    { id: "vi-VN-Standard-A", label: "Standard A · nữ", gender: "female", tier: "standard" },
    { id: "vi-VN-Standard-C", label: "Standard C · nữ", gender: "female", tier: "standard" },
    { id: "vi-VN-Chirp3-HD-Leda", label: "Chirp HD Leda · nữ", gender: "female", tier: "premium" },
    { id: "vi-VN-Chirp3-HD-Pulcherrima", label: "Chirp HD Pulcherrima · nữ", gender: "female", tier: "premium" },
    { id: "vi-VN-Chirp3-HD-Sulafat", label: "Chirp HD Sulafat · nữ", gender: "female", tier: "premium" },
    { id: "vi-VN-Chirp3-HD-Vindemiatrix", label: "Chirp HD Vindemiatrix · nữ", gender: "female", tier: "premium" },
    { id: "vi-VN-Chirp3-HD-Zephyr", label: "Chirp HD Zephyr · nữ", gender: "female", tier: "premium" },
    { id: "vi-VN-Neural2-D", label: "Neural2 D · nam", gender: "male", tier: "premium" },
    { id: "vi-VN-Wavenet-B", label: "WaveNet B · nam", gender: "male", tier: "premium" },
    { id: "vi-VN-Wavenet-D", label: "WaveNet D · nam", gender: "male", tier: "premium" },
    { id: "vi-VN-Standard-B", label: "Standard B · nam", gender: "male", tier: "standard" },
    { id: "vi-VN-Standard-D", label: "Standard D · nam", gender: "male", tier: "standard" }
  ]);

  const OPENAI_VOICES = Object.freeze(["coral", "marin", "shimmer", "sage", "nova", "alloy", "ash", "ballad", "echo", "fable", "onyx", "verse", "cedar"]);
  const preset = (id) => PRESETS.find((item) => item.id === id) || PRESETS[0];

  function estimateGender(voice) {
    const value = `${voice?.name || ""} ${voice?.voiceURI || ""}`;
    if (/female|nữ|woman|hoai|linh|mai|an\b|vy\b/i.test(value)) return "female-estimated";
    if (/male|nam|man|minh|long/i.test(value)) return "male-estimated";
    return "unknown";
  }

  function catalog() {
    return synth?.getVoices?.().map((voice) => ({
      voice,
      voiceURI: voice.voiceURI,
      name: voice.name,
      lang: voice.lang || "",
      localService: voice.localService !== false,
      gender: estimateGender(voice),
      vietnamese: /^vi(?:-|$)/i.test(voice.lang || "")
    })).sort((a, b) => Number(b.vietnamese) - Number(a.vietnamese)
      || Number(b.gender === "female-estimated") - Number(a.gender === "female-estimated")
      || Number(b.localService) - Number(a.localService)
      || a.name.localeCompare(b.name, "vi")) || [];
  }

  function voices() { return catalog().map((item) => item.voice); }

  function preferredVoice(uri = "", presetId = "hikari-gentle") {
    const list = catalog();
    const selectedPreset = preset(presetId);
    return list.find((item) => item.voiceURI === uri)?.voice
      || list.find((item) => item.vietnamese && item.gender === "female-estimated" && selectedPreset.hints.test(item.name))?.voice
      || list.find((item) => item.vietnamese && item.gender === "female-estimated")?.voice
      || list.find((item) => item.vietnamese)?.voice
      || list[0]?.voice
      || null;
  }

  function stop() {
    clearInterval(lipTimer);
    lipTimer = 0;
    synth?.cancel?.();
    activeRecognition?.abort?.();
    activeRecognition = null;
    if (activeAudio) {
      activeAudio.pause();
      activeAudio.src = "";
      activeAudio = null;
    }
  }

  function simulatedLip(onPulse) {
    clearInterval(lipTimer);
    lipTimer = setInterval(() => onPulse?.(.18 + Math.random() * .82), 95 + Math.random() * 45);
  }

  async function cloudAudio(text, settings) {
    const selectedPreset = preset(settings.voicePreset);
    const provider = ["google", "openai", "selfhost"].includes(settings.voiceProvider) ? settings.voiceProvider : "openai";
    const providerVoice = provider === "google"
      ? (settings.googleVoice || selectedPreset.googleVoice)
      : provider === "selfhost" ? (settings.selfhostVoice || "vi-female-1") : (settings.openaiVoice || selectedPreset.openaiVoice);
    const key = `${text}\u001f${provider}\u001f${providerVoice}\u001f${settings.rate}`;
    if (audioCache.has(key)) return audioCache.get(key);
    const token = global.HHAuthSession?.token?.() || "";
    if (!token) throw new Error("Cloud TTS cần tài khoản HH đã đăng nhập.");
    const response = await fetch("/api/assistant/tts", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ text, provider, voice: providerVoice, speed: settings.rate, pitch: settings.pitch })
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.error || "Cloud TTS chưa sẵn sàng.");
    }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    audioCache.set(key, url);
    if (audioCache.size > 12) {
      const oldest = audioCache.keys().next().value;
      URL.revokeObjectURL(audioCache.get(oldest));
      audioCache.delete(oldest);
    }
    return { url, provider };
  }

  async function speak(text, settings = {}, hooks = {}) {
    stop();
    if (!settings.voiceEnabled || !String(text || "").trim()) return { spoken: false, reason: "disabled" };
    const cleanText = String(text).replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, 900);
    const selectedPreset = preset(settings.voicePreset);
    hooks.onStart?.();
    simulatedLip(hooks.onLip);
    if (["google", "openai", "selfhost", "cloud"].includes(settings.voiceProvider)) {
      try {
        const result = await cloudAudio(cleanText, settings);
        activeAudio = new Audio(result.url);
        activeAudio.volume = clamp(settings.volume, 0, 1);
        await new Promise((resolve, reject) => {
          activeAudio.onended = resolve;
          activeAudio.onerror = () => reject(new Error("Không phát được âm thanh Cloud TTS."));
          activeAudio.play().catch(reject);
        });
        stop(); hooks.onEnd?.();
        return { spoken: true, provider: result.provider };
      } catch (error) { hooks.onFallback?.(error.message); }
    }
    if (!synth || typeof SpeechSynthesisUtterance === "undefined") {
      stop(); hooks.onEnd?.();
      return { spoken: false, reason: "unsupported" };
    }
    const utterance = new SpeechSynthesisUtterance(cleanText);
    const selectedVoice = preferredVoice(settings.voiceURI, settings.voicePreset);
    if (selectedVoice) utterance.voice = selectedVoice;
    utterance.lang = selectedVoice?.lang || "vi-VN";
    utterance.rate = clamp(settings.rate || selectedPreset.rate, .65, 1.5);
    utterance.pitch = clamp(settings.pitch || selectedPreset.pitch, .7, 1.5);
    utterance.volume = clamp(settings.volume ?? .78, 0, 1);
    await new Promise((resolve) => {
      utterance.onend = resolve; utterance.onerror = resolve; synth.speak(utterance);
    });
    stop(); hooks.onEnd?.();
    return { spoken: true, provider: "browser", voice: selectedVoice?.name || "Mặc định tiếng Việt" };
  }

  async function listen(hooks = {}) {
    stop();
    const Recognition = global.SpeechRecognition || global.webkitSpeechRecognition;
    if (!Recognition) throw new Error("Trình duyệt này chưa hỗ trợ nhận giọng nói.");
    let permissionStream = null;
    try { permissionStream = await navigator.mediaDevices.getUserMedia({ audio: true }); }
    finally { permissionStream?.getTracks?.().forEach((track) => track.stop()); }
    return new Promise((resolve, reject) => {
      const recognition = new Recognition(); activeRecognition = recognition;
      recognition.lang = "vi-VN"; recognition.interimResults = true; recognition.continuous = false;
      recognition.onstart = () => hooks.onStart?.();
      recognition.onresult = (event) => {
        const transcript = [...event.results].map((result) => result[0]?.transcript || "").join(" ").trim();
        hooks.onInterim?.(transcript);
        if (event.results[event.results.length - 1]?.isFinal) resolve(transcript);
      };
      recognition.onerror = (event) => reject(new Error(event.error === "not-allowed" ? "Bạn chưa cho phép microphone." : "Không nhận được giọng nói."));
      recognition.onend = () => { activeRecognition = null; hooks.onEnd?.(); };
      recognition.start();
    });
  }

  global.HHVirtualAssistantVoice = Object.freeze({ PRESETS, GOOGLE_VOICES, OPENAI_VOICES, catalog, voices, preferredVoice, preset, speak, listen, stop });
})(window);
