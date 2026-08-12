(function (global) {
  "use strict";

  let activeAudio = null;
  let activeRecognition = null;
  let lipTimer = 0;
  const audioCache = new Map();
  const synth = global.speechSynthesis;
  const clamp = (value, min, max) => Math.min(max, Math.max(min, Number(value) || 0));

  function voices() {
    return synth?.getVoices?.().slice().sort((a, b) => {
      const av = /^vi(?:-|$)/i.test(a.lang) ? 0 : 1;
      const bv = /^vi(?:-|$)/i.test(b.lang) ? 0 : 1;
      return av - bv || a.name.localeCompare(b.name);
    }) || [];
  }

  function preferredVoice(uri = "") {
    const list = voices();
    return list.find((voice) => voice.voiceURI === uri)
      || list.find((voice) => /^vi(?:-|$)/i.test(voice.lang) && /female|nữ|hoai|linh|an/i.test(voice.name))
      || list.find((voice) => /^vi(?:-|$)/i.test(voice.lang))
      || list[0]
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
    const key = `${text}\u001f${settings.voiceURI || "coral"}\u001f${settings.rate}`;
    if (audioCache.has(key)) return audioCache.get(key);
    const token = global.HHAuthSession?.token?.() || "";
    if (!token) throw new Error("Cloud TTS cần tài khoản HH đã đăng nhập.");
    const response = await fetch("/api/assistant/tts", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ text, voice: settings.cloudVoice || "coral", speed: settings.rate })
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
    return url;
  }

  async function speak(text, settings = {}, hooks = {}) {
    stop();
    if (!settings.voiceEnabled || !String(text || "").trim()) return { spoken: false, reason: "disabled" };
    const cleanText = String(text).replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, 900);
    hooks.onStart?.();
    simulatedLip(hooks.onLip);
    if (settings.voiceProvider === "cloud") {
      try {
        const url = await cloudAudio(cleanText, settings);
        activeAudio = new Audio(url);
        activeAudio.volume = clamp(settings.volume, 0, 1);
        await new Promise((resolve, reject) => {
          activeAudio.onended = resolve;
          activeAudio.onerror = () => reject(new Error("Không phát được âm thanh Cloud TTS."));
          activeAudio.play().catch(reject);
        });
        stop();
        hooks.onEnd?.();
        return { spoken: true, provider: "cloud" };
      } catch (error) {
        hooks.onFallback?.(error.message);
      }
    }
    if (!synth || typeof SpeechSynthesisUtterance === "undefined") {
      stop(); hooks.onEnd?.();
      return { spoken: false, reason: "unsupported" };
    }
    const utterance = new SpeechSynthesisUtterance(cleanText);
    const voice = preferredVoice(settings.voiceURI);
    if (voice) utterance.voice = voice;
    utterance.lang = voice?.lang || "vi-VN";
    utterance.rate = clamp(settings.rate || 1, .65, 1.5);
    utterance.pitch = clamp(settings.pitch || 1, .7, 1.5);
    utterance.volume = clamp(settings.volume ?? .78, 0, 1);
    await new Promise((resolve) => {
      utterance.onend = resolve;
      utterance.onerror = resolve;
      synth.speak(utterance);
    });
    stop(); hooks.onEnd?.();
    return { spoken: true, provider: "browser", voice: voice?.name || "Mặc định của trình duyệt" };
  }

  async function listen(hooks = {}) {
    stop();
    const Recognition = global.SpeechRecognition || global.webkitSpeechRecognition;
    if (!Recognition) throw new Error("Trình duyệt này chưa hỗ trợ nhận giọng nói.");
    let permissionStream = null;
    try {
      permissionStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } finally {
      permissionStream?.getTracks?.().forEach((track) => track.stop());
    }
    return new Promise((resolve, reject) => {
      const recognition = new Recognition();
      activeRecognition = recognition;
      recognition.lang = "vi-VN";
      recognition.interimResults = true;
      recognition.continuous = false;
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

  global.HHVirtualAssistantVoice = Object.freeze({ voices, preferredVoice, speak, listen, stop });
})(window);
