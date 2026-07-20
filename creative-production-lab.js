(function (globalScope) {
  "use strict";

  const VERSION = 1;
  const FORMAT = "hh-creative-production-lab";
  const STORAGE_KEY = "hh.creative-production-lab.v1";
  const VIEWS = Object.freeze(["repurpose", "brand", "audio-dubbing", "prototype"]);
  const MAX_PROTOTYPE_LINKS = 1000;
  const mounted = new WeakMap();

  const PLATFORM_SPECS = Object.freeze({
    shorts: { label: "Shorts / Reels", ratio: "9:16", width: 1080, height: 1920, duration: "15-60 giay" },
    facebook: { label: "Facebook", ratio: "4:5", width: 1080, height: 1350, duration: "15-90 giay" },
    thumbnail: { label: "Thumbnail", ratio: "16:9", width: 1280, height: 720, duration: "Anh tinh" },
    podcast: { label: "Podcast", ratio: "1:1", width: 1400, height: 1400, duration: "5-30 phut" },
    email: { label: "Email", ratio: "responsive", width: 680, height: 0, duration: "2-4 phut doc" },
    blog: { label: "Blog", ratio: "responsive", width: 1200, height: 630, duration: "5-8 phut doc" },
    subtitle: { label: "Subtitle", ratio: "timecode", width: 0, height: 0, duration: "Theo video" }
  });

  const CLIP_TYPES = Object.freeze(["voice", "music", "ambience", "sfx", "subtitle", "translation"]);
  const VIEW_META = Object.freeze({
    repurpose: { code: "RP", title: "Content Repurpose", note: "Mot noi dung, nhieu dinh dang", accent: "#68e8ff" },
    brand: { code: "BI", title: "Brand Intelligence", note: "Giong thuong hieu va kiem duyet", accent: "#ff67bd" },
    "audio-dubbing": { code: "AD", title: "Audio & Dubbing", note: "Timeline, voice, nhac va phu de", accent: "#b8f36d" },
    prototype: { code: "PX", title: "Prototype from Prompt", note: "Flow tu prompt, preview an toan", accent: "#a995ff" }
  });

  function clone(value) {
    if (typeof structuredClone === "function") return structuredClone(value);
    return value == null ? value : JSON.parse(JSON.stringify(value));
  }

  function uid(prefix) {
    return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  function safeText(value, limit) {
    return String(value == null ? "" : value)
      .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "")
      .replace(/<[^>]*>/g, "")
      .trim().slice(0, limit || 12000);
  }

  function sanitizePrototypeText(value, limit) {
    return safeText(String(value == null ? "" : value)
      .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, "")
      .replace(/<[^>]*>/g, " ")
      .replace(/\b(?:globalThis|window|document)\s*\.\s*[\w$]+\s*=\s*[^;\n]*/gi, "")
      .replace(/javascript\s*:/gi, "")
      .replace(/\bon\w+\s*=/gi, ""), limit);
  }

  function safeFilename(value, extension) {
    const stem = safeText(value, 80).normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9-_ ]/g, "").trim().replace(/\s+/g, "-").toLowerCase() || "creative-project";
    return `${stem}.${extension}`;
  }

  function normalizeWhitespace(value) {
    return safeText(value, 120000).replace(/\r\n/g, "\n").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n");
  }

  function sentenceList(value) {
    const text = normalizeWhitespace(value);
    if (!text) return [];
    const sentences = text.match(/[^.!?\n]+[.!?]?/g) || [text];
    return sentences.map((item) => item.trim()).filter(Boolean).slice(0, 240);
  }

  function wordCount(value) {
    return normalizeWhitespace(value).split(/\s+/).filter(Boolean).length;
  }

  function titleFromText(value, fallback) {
    const words = normalizeWhitespace(value).replace(/\n/g, " ").split(/\s+/).filter(Boolean).slice(0, 10);
    return words.length ? words.join(" ").replace(/[.,;:!?]+$/, "") : (fallback || "Du an sang tao");
  }

  function formatTime(seconds, srt) {
    const value = Math.max(0, Number(seconds) || 0);
    const hours = Math.floor(value / 3600);
    const minutes = Math.floor((value % 3600) / 60);
    const wholeSeconds = Math.floor(value % 60);
    const millis = Math.floor((value % 1) * 1000);
    const base = [hours, minutes, wholeSeconds].map((item) => String(item).padStart(2, "0")).join(":");
    return srt ? `${base},${String(millis).padStart(3, "0")}` : base;
  }

  function splitCaptions(text, secondsPerCaption) {
    const sentences = sentenceList(text);
    const duration = Math.max(1.5, Number(secondsPerCaption) || 4);
    return sentences.map((content, index) => ({
      id: `caption-${index + 1}`,
      start: index * duration,
      end: (index + 1) * duration,
      text: content.slice(0, 180)
    }));
  }

  function captionsToSrt(captions) {
    return (captions || []).map((item, index) => `${index + 1}\n${formatTime(item.start, true)} --> ${formatTime(item.end, true)}\n${safeText(item.text, 500)}`).join("\n\n");
  }

  function fallbackTranslate(text, language) {
    const target = safeText(language || "vi", 20).toLowerCase();
    const dictionaries = {
      en: { "xin chao": "hello", "cam on": "thank you", "hom nay": "today", "sang tao": "creative", "video": "video" },
      vi: { hello: "xin chao", "thank you": "cam on", today: "hom nay", creative: "sang tao", video: "video" }
    };
    let output = normalizeWhitespace(text);
    Object.entries(dictionaries[target] || {}).forEach(([from, to]) => {
      output = output.replace(new RegExp(`\\b${from.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "gi"), to);
    });
    return { text: output, language: target, provider: "deterministic-local", notice: "Ban dich local chi xu ly tu dien co ban; can AI provider de dich tu nhien." };
  }

  function rewriteFallback(text, style) {
    const items = sentenceList(text);
    const selected = items.slice(0, Math.max(2, Math.min(8, items.length)));
    const prefix = {
      concise: "Tom tat nhanh",
      social: "Goc nhin dang chia se",
      professional: "Thong diep chinh",
      energetic: "Bat dau ngay"
    }[style] || "Noi dung chinh";
    return `${prefix}: ${selected.join(" ")}`.trim();
  }

  function generateRepurpose(input) {
    const source = normalizeWhitespace(input?.transcript || input?.description || "");
    const metadata = {
      title: safeText(input?.title, 180) || titleFromText(source),
      platform: safeText(input?.platform || "YouTube", 40),
      duration: Math.max(0, Number(input?.duration) || 0),
      language: safeText(input?.language || "vi", 20),
      targetLanguage: safeText(input?.targetLanguage || "vi", 20)
    };
    const sentences = sentenceList(source);
    const hook = (sentences[0] || metadata.title).slice(0, 140);
    const core = sentences.slice(0, 8).join(" ") || metadata.title;
    const summary = sentences.slice(0, 3).join(" ") || metadata.title;
    const captions = splitCaptions(source || metadata.title, input?.captionSeconds || 4);
    const translation = fallbackTranslate(core, metadata.targetLanguage);
    const hashtags = [...new Set(metadata.title.toLowerCase().split(/\s+/).filter((word) => word.length > 4).slice(0, 5))].map((word) => `#${word.replace(/[^a-z0-9\u00c0-\u024f]/gi, "")}`).join(" ");
    const now = new Date().toISOString();
    return {
      id: uid("repurpose"),
      status: "ready",
      createdAt: now,
      metadata,
      source: { transcript: source, words: wordCount(source) },
      outputs: {
        shorts: {
          title: `${metadata.title.slice(0, 70)} | Ban ngan`,
          hook,
          script: `${hook}\n\n${sentences.slice(1, 5).join(" ") || core}\n\nTheo doi de xem phan tiep theo.`,
          caption: `${summary}\n${hashtags}`.trim(),
          spec: PLATFORM_SPECS.shorts
        },
        facebook: { title: metadata.title, post: `${rewriteFallback(core, "social")}\n\nBan nghi sao ve chu de nay?\n${hashtags}`.trim(), spec: PLATFORM_SPECS.facebook },
        thumbnail: { headline: hook.split(/\s+/).slice(0, 7).join(" ").toUpperCase(), subline: "Noi dung moi", spec: PLATFORM_SPECS.thumbnail },
        podcast: { title: `Podcast: ${metadata.title}`, intro: `Chao mung ban. Hom nay chung ta cung noi ve ${metadata.title}.`, outline: sentences.slice(0, 6), spec: PLATFORM_SPECS.podcast },
        email: { subject: metadata.title.slice(0, 78), preview: summary.slice(0, 120), body: `${rewriteFallback(core, "professional")}\n\nCTA: Xem noi dung day du.`, spec: PLATFORM_SPECS.email },
        blog: { title: metadata.title, description: summary.slice(0, 160), markdown: `# ${metadata.title}\n\n${sentences.map((item, index) => `${index && index % 3 === 0 ? `## Y chinh ${Math.floor(index / 3) + 1}\n\n` : ""}${item}`).join("\n\n")}\n\n## Ket luan\n\n${summary}`, spec: PLATFORM_SPECS.blog },
        subtitle: { captions, srt: captionsToSrt(captions), translation, spec: PLATFORM_SPECS.subtitle }
      }
    };
  }

  function repurposeMarkdown(result) {
    if (!result?.outputs) return "";
    const out = result.outputs;
    return `# ${result.metadata.title}\n\n## Shorts\n\n${out.shorts.script}\n\n## Facebook\n\n${out.facebook.post}\n\n## Thumbnail\n\n${out.thumbnail.headline}\n${out.thumbnail.subline}\n\n## Podcast\n\n${out.podcast.intro}\n\n${out.podcast.outline.map((item) => `- ${item}`).join("\n")}\n\n## Email\n\n**${out.email.subject}**\n\n${out.email.body}\n\n${out.blog.markdown}`;
  }

  function exportRepurposeBundle(result) {
    return {
      format: `${FORMAT}-repurpose`,
      version: VERSION,
      exportedAt: new Date().toISOString(),
      project: clone(result),
      files: {
        "bundle.json": JSON.stringify(result, null, 2),
        "content.md": repurposeMarkdown(result),
        "subtitles.srt": result?.outputs?.subtitle?.srt || ""
      }
    };
  }

  function normalizeBrand(input) {
    const source = input && typeof input === "object" ? input : {};
    return {
      name: safeText(source.name || "HH Brand", 100),
      voice: safeText(source.voice || "ro rang, gan gui, dang tin cay", 500),
      voiceKeywords: Array.isArray(source.voiceKeywords) ? source.voiceKeywords.map((item) => safeText(item, 40)).filter(Boolean).slice(0, 20) : safeText(source.voiceKeywords, 500).split(",").map((item) => item.trim()).filter(Boolean).slice(0, 20),
      bannedWords: Array.isArray(source.bannedWords) ? source.bannedWords.map((item) => safeText(item, 40)).filter(Boolean).slice(0, 40) : safeText(source.bannedWords, 1000).split(",").map((item) => item.trim()).filter(Boolean).slice(0, 40),
      fonts: Array.isArray(source.fonts) ? source.fonts.map((item) => safeText(item, 80)).filter(Boolean).slice(0, 12) : safeText(source.fonts || "Be Vietnam Pro", 500).split(",").map((item) => item.trim()).filter(Boolean),
      colors: Array.isArray(source.colors) ? source.colors.filter((item) => /^#[0-9a-f]{6}$/i.test(item)).slice(0, 12) : safeText(source.colors || "#68E8FF,#FF67BD", 300).split(",").map((item) => item.trim()).filter((item) => /^#[0-9a-f]{6}$/i.test(item)),
      logo: { name: safeText(source.logo?.name || source.logoName || "", 120), type: safeText(source.logo?.type || source.logoType || "", 80), size: Math.max(0, Number(source.logo?.size || source.logoSize) || 0) },
      cta: safeText(source.cta || "Kham pha ngay", 160),
      templates: Array.isArray(source.templates) ? source.templates.map((item) => safeText(item, 240)).filter(Boolean).slice(0, 20) : []
    };
  }

  function countOccurrences(text, phrase) {
    if (!phrase) return 0;
    return (String(text).toLowerCase().match(new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g")) || []).length;
  }

  function scoreBrandOutput(output, brandInput) {
    const brand = normalizeBrand(brandInput);
    const text = normalizeWhitespace(output);
    const warnings = [];
    const reasons = [];
    let score = 100;
    brand.bannedWords.forEach((word) => {
      const count = countOccurrences(text, word);
      if (count) {
        score -= Math.min(30, count * 12);
        warnings.push({ code: "banned-word", value: word, count, message: `Tu cam \"${word}\" xuat hien ${count} lan.` });
      }
    });
    const voiceMatches = brand.voiceKeywords.filter((word) => countOccurrences(text, word));
    if (brand.voiceKeywords.length && !voiceMatches.length) {
      score -= 14;
      warnings.push({ code: "voice-missing", message: "Noi dung chua the hien tu khoa giong thuong hieu." });
    } else if (voiceMatches.length) reasons.push(`Khop ${voiceMatches.length} tu khoa thuong hieu.`);
    if (brand.cta && !String(text).toLowerCase().includes(brand.cta.toLowerCase())) {
      score -= 12;
      warnings.push({ code: "cta-missing", message: "Thieu CTA da quy dinh." });
    } else if (brand.cta) reasons.push("CTA dung quy tac.");
    if (text.length < 40) {
      score -= 10;
      warnings.push({ code: "too-short", message: "Noi dung qua ngan de danh gia day du." });
    }
    if (/[A-Z\u00c0-\u024f]{12,}/.test(text)) {
      score -= 8;
      warnings.push({ code: "shouting", message: "Co cum chu viet hoa dai, de tao cam giac gay gat." });
    }
    score = Math.max(0, Math.min(100, score));
    if (!warnings.length) reasons.push("Khong phat hien vi pham quy tac van ban.");
    return { score, grade: score >= 90 ? "A" : score >= 75 ? "B" : score >= 60 ? "C" : "D", reasons, warnings, brand: brand.name, checkedAt: new Date().toISOString() };
  }

  function autoFixBrandOutput(output, brandInput) {
    const brand = normalizeBrand(brandInput);
    const original = normalizeWhitespace(output);
    let fixed = original;
    brand.bannedWords.forEach((word) => {
      fixed = fixed.replace(new RegExp(word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi"), "");
    });
    fixed = fixed.replace(/\s{2,}/g, " ").replace(/\s+([.,!?])/g, "$1").trim();
    if (brand.voiceKeywords[0] && !countOccurrences(fixed, brand.voiceKeywords[0])) fixed = `${brand.voiceKeywords[0]}: ${fixed}`;
    if (brand.cta && !fixed.toLowerCase().includes(brand.cta.toLowerCase())) fixed = `${fixed}\n\n${brand.cta}`.trim();
    return {
      id: uid("brand-draft"),
      parentId: null,
      createdAt: new Date().toISOString(),
      original,
      output: fixed,
      report: scoreBrandOutput(fixed, brand),
      notice: "Da tao ban nhap moi; ban goc khong bi ghi de."
    };
  }

  function normalizeClip(input, index) {
    const source = input && typeof input === "object" ? input : {};
    const type = CLIP_TYPES.includes(source.type) ? source.type : "voice";
    const start = Math.max(0, Number(source.start) || 0);
    const duration = Math.max(0.1, Number(source.duration) || (type === "subtitle" ? 4 : 3));
    return {
      id: safeText(source.id || `clip-${index + 1}`, 80),
      type,
      speakerId: safeText(source.speakerId || "speaker-1", 80),
      start,
      duration,
      trimIn: Math.max(0, Number(source.trimIn) || 0),
      trimOut: Math.max(0, Number(source.trimOut) || 0),
      volume: Math.max(0, Math.min(1, Number(source.volume ?? 0.8))),
      text: safeText(source.text || "Noi dung clip", 3000),
      language: safeText(source.language || "vi", 20),
      sourceName: safeText(source.sourceName || "", 160)
    };
  }

  function normalizeTimeline(input) {
    const source = input && typeof input === "object" ? input : {};
    const speakers = Array.isArray(source.speakers) && source.speakers.length ? source.speakers.map((speaker, index) => ({
      id: safeText(speaker.id || `speaker-${index + 1}`, 80),
      name: safeText(speaker.name || `Speaker ${index + 1}`, 100),
      language: safeText(speaker.language || "vi", 20),
      color: /^#[0-9a-f]{6}$/i.test(speaker.color) ? speaker.color : ["#68e8ff", "#ff67bd", "#b8f36d"][index % 3]
    })) : [{ id: "speaker-1", name: "Nguoi dan", language: "vi", color: "#68e8ff" }];
    const clips = (Array.isArray(source.clips) ? source.clips : []).map(normalizeClip).sort((a, b) => a.start - b.start);
    const duration = Math.max(10, Number(source.duration) || 0, ...clips.map((clip) => clip.start + clip.duration));
    return { id: safeText(source.id || uid("timeline"), 80), name: safeText(source.name || "HH Dubbing Session", 140), duration, speakers, clips, updatedAt: new Date().toISOString() };
  }

  function addTimelineClip(timelineInput, clipInput) {
    const timeline = normalizeTimeline(timelineInput);
    const clip = normalizeClip({ ...clipInput, id: clipInput?.id || uid("clip") }, timeline.clips.length);
    return normalizeTimeline({ ...timeline, clips: [...timeline.clips, clip] });
  }

  function moveTimelineClip(timelineInput, clipId, nextStart) {
    const timeline = normalizeTimeline(timelineInput);
    timeline.clips = timeline.clips.map((clip) => clip.id === clipId ? { ...clip, start: Math.max(0, Number(nextStart) || 0) } : clip);
    return normalizeTimeline(timeline);
  }

  function trimTimelineClip(timelineInput, clipId, trimIn, trimOut) {
    const timeline = normalizeTimeline(timelineInput);
    timeline.clips = timeline.clips.map((clip) => {
      if (clip.id !== clipId) return clip;
      const nextIn = Math.max(0, Math.min(clip.duration - 0.1, Number(trimIn) || 0));
      const nextOut = Math.max(0, Math.min(clip.duration - nextIn - 0.1, Number(trimOut) || 0));
      return { ...clip, trimIn: nextIn, trimOut: nextOut };
    });
    return normalizeTimeline(timeline);
  }

  function timelineToSrt(timelineInput) {
    const timeline = normalizeTimeline(timelineInput);
    const clips = timeline.clips.filter((clip) => ["voice", "subtitle", "translation"].includes(clip.type) && clip.text);
    return captionsToSrt(clips.map((clip) => ({ start: clip.start, end: clip.start + Math.max(0.1, clip.duration - clip.trimIn - clip.trimOut), text: clip.text })));
  }

  function csvEscape(value) {
    const text = String(value == null ? "" : value);
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  }

  function timelineToCsv(timelineInput) {
    const timeline = normalizeTimeline(timelineInput);
    return ["id,type,speaker,start,duration,language,text", ...timeline.clips.map((clip) => [clip.id, clip.type, clip.speakerId, clip.start, clip.duration, clip.language, clip.text].map(csvEscape).join(","))].join("\n");
  }

  function writeAscii(view, offset, text) {
    for (let index = 0; index < text.length; index += 1) view.setUint8(offset + index, text.charCodeAt(index));
  }

  function renderTimelineWav(timelineInput, options) {
    const timeline = normalizeTimeline(timelineInput);
    const sampleRate = Math.max(8000, Math.min(48000, Number(options?.sampleRate) || 16000));
    const duration = Math.min(Math.max(0.25, timeline.duration), Number(options?.maxDuration) || 60);
    const samples = Math.floor(sampleRate * duration);
    const bytes = new ArrayBuffer(44 + samples * 2);
    const view = new DataView(bytes);
    writeAscii(view, 0, "RIFF");
    view.setUint32(4, 36 + samples * 2, true);
    writeAscii(view, 8, "WAVE");
    writeAscii(view, 12, "fmt ");
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    writeAscii(view, 36, "data");
    view.setUint32(40, samples * 2, true);
    const audible = timeline.clips.filter((clip) => !["subtitle", "translation"].includes(clip.type));
    for (let index = 0; index < samples; index += 1) {
      const time = index / sampleRate;
      let value = 0;
      audible.forEach((clip, clipIndex) => {
        if (time < clip.start || time > clip.start + clip.duration) return;
        const frequency = { voice: 220, music: 330, ambience: 110, sfx: 520 }[clip.type] || 220;
        const attack = Math.min(1, (time - clip.start) * 10);
        const release = Math.min(1, (clip.start + clip.duration - time) * 10);
        value += Math.sin(2 * Math.PI * (frequency + clipIndex * 7) * time) * 0.08 * clip.volume * attack * release;
      });
      view.setInt16(44 + index * 2, Math.max(-1, Math.min(1, value)) * 32767, true);
    }
    return new Uint8Array(bytes);
  }

  function detectAudioCapabilities(scope) {
    return {
      webAudio: Boolean(scope?.AudioContext || scope?.webkitAudioContext),
      recording: Boolean(scope?.navigator?.mediaDevices?.getUserMedia && scope?.MediaRecorder),
      wavExport: typeof ArrayBuffer !== "undefined" && typeof DataView !== "undefined",
      notice: "WAV local la preview mix thu tuc. Giai ma/mix file media goc can AudioBuffer kha dung trong trinh duyet."
    };
  }

  function sanitizePrompt(value) {
    return sanitizePrototypeText(value, 4000);
  }

  function component(id, type, text, action) {
    return { id, type, text: sanitizePrototypeText(text, 160), action: safeText(action || "", 80) };
  }

  function generatePrototype(promptInput) {
    const prompt = sanitizePrompt(promptInput);
    const lower = prompt.toLowerCase();
    const name = titleFromText(prompt, "HH Prototype").slice(0, 60);
    const screens = [{
      id: "welcome", name: "Chao mung", components: [
        component("hero-title", "heading", name),
        component("hero-copy", "text", prompt || "Mo ta san pham cua ban."),
        component("hero-action", "button", "Bat dau", "dashboard")
      ]
    }];
    if (/login|dang nhap|tai khoan|account/.test(lower)) screens.push({ id: "login", name: "Dang nhap", components: [component("email", "input", "Email"), component("password", "input", "Mat khau"), component("login-action", "button", "Dang nhap", "dashboard")] });
    screens.push({ id: "dashboard", name: "Tong quan", components: [component("dash-title", "heading", "Tong quan"), component("metric-1", "metric", "12 du an"), component("metric-2", "metric", "86% tien do"), component("dash-action", "button", "Xem chi tiet", "detail")] });
    screens.push({ id: "detail", name: "Chi tiet", components: [component("detail-title", "heading", "Chi tiet du an"), component("detail-copy", "text", "Noi dung va du lieu mau co the chinh sua."), component("back-action", "button", "Quay lai", "dashboard")] });
    if (/shop|store|ban hang|san pham/.test(lower)) screens.push({ id: "catalog", name: "San pham", components: [component("catalog-title", "heading", "Danh muc san pham"), component("product-1", "card", "San pham mau A"), component("cart-action", "button", "Them vao gio", "checkout")] }, { id: "checkout", name: "Thanh toan", components: [component("checkout-title", "heading", "Xac nhan don hang"), component("checkout-action", "button", "Hoan tat", "welcome")] });
    const ids = new Set(screens.map((screen) => screen.id));
    const links = [];
    screens.forEach((screen) => screen.components.forEach((item) => {
      if (item.action && ids.has(item.action)) links.push({ id: uid("link"), from: screen.id, componentId: item.id, to: item.action });
    }));
    return {
      id: uid("prototype"), name, prompt, createdAt: new Date().toISOString(),
      screens, links,
      mockData: { user: { name: "Nguoi dung mau", plan: "Free" }, stats: { projects: 12, progress: 86 } },
      activeScreen: screens[0].id,
      safety: "No user-authored script is executed. Preview is rendered from a fixed component schema."
    };
  }

  function normalizePrototype(input) {
    const source = input && typeof input === "object" ? input : generatePrototype("");
    const screens = (Array.isArray(source.screens) ? source.screens : []).slice(0, 40).map((screen, screenIndex) => ({
      id: safeText(screen.id || `screen-${screenIndex + 1}`, 80).replace(/[^a-zA-Z0-9-_]/g, "-") || `screen-${screenIndex + 1}`,
      name: safeText(screen.name || `Man hinh ${screenIndex + 1}`, 100),
      components: (Array.isArray(screen.components) ? screen.components : []).slice(0, 100).map((item, index) => component(safeText(item.id || `component-${index + 1}`, 80), ["heading", "text", "button", "input", "metric", "card"].includes(item.type) ? item.type : "text", item.text, item.action))
    }));
    const ids = new Set(screens.map((screen) => screen.id));
    return {
      id: safeText(source.id || uid("prototype"), 80), name: safeText(source.name || "HH Prototype", 100), prompt: sanitizePrompt(source.prompt), createdAt: source.createdAt || new Date().toISOString(), screens,
      links: (Array.isArray(source.links) ? source.links : []).slice(0, MAX_PROTOTYPE_LINKS).filter((link) => ids.has(link.from) && ids.has(link.to)).map((link) => ({ id: safeText(link.id || uid("link"), 80), from: safeText(link.from, 80), componentId: safeText(link.componentId, 80), to: safeText(link.to, 80) })),
      mockData: source.mockData && typeof source.mockData === "object" ? clone(source.mockData) : {},
      activeScreen: ids.has(source.activeScreen) ? source.activeScreen : screens[0]?.id || "",
      safety: "No user-authored script is executed. Preview is rendered from a fixed component schema."
    };
  }

  function exportPrototypeHtml(prototypeInput) {
    const prototype = normalizePrototype(prototypeInput);
    const links = new Map(prototype.links.map((link) => [`${link.from}:${link.componentId}`, link.to]));
    const renderComponent = (screen, item) => {
      const text = escapeHtml(item.text);
      const target = links.get(`${screen.id}:${item.id}`);
      if (item.type === "heading") return `<h2>${text}</h2>`;
      if (item.type === "input") return `<label>${text}<input placeholder="${text}" autocomplete="off"></label>`;
      if (item.type === "button") return target ? `<a class="button" href="#${escapeHtml(target)}">${text}</a>` : `<span class="button is-disabled">${text}</span>`;
      if (item.type === "metric") return `<strong class="metric">${text}</strong>`;
      if (item.type === "card") return `<article>${text}</article>`;
      return `<p>${text}</p>`;
    };
    return `<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(prototype.name)}</title><style>:root{color-scheme:dark;font-family:system-ui;background:#071019;color:#eef4f8}*{box-sizing:border-box}body{margin:0;padding:32px;background:radial-gradient(circle at 20% 10%,#173c4a,transparent 38%),#071019}nav{display:flex;gap:8px;flex-wrap:wrap;margin:auto auto 20px;max-width:900px}nav a,.button{padding:10px 14px;border:1px solid #65dbea;border-radius:8px;color:#dffbff;text-decoration:none;background:#102630}main{max-width:900px;margin:auto}.screen{display:none;min-height:440px;padding:40px;border:1px solid #29404d;border-radius:20px;background:#0d1722}.screen:target{display:grid;align-content:center;gap:16px}.screen:first-of-type{display:grid}.screen:target~.screen:first-of-type{display:none}h2{font-size:48px;margin:0}.metric,article,label{display:block;padding:18px;border-radius:12px;background:#162330}input{width:100%;padding:12px;margin-top:8px}@media(max-width:600px){body{padding:12px}.screen{padding:22px}h2{font-size:32px}}</style></head><body><nav>${prototype.screens.map((screen) => `<a href="#${escapeHtml(screen.id)}">${escapeHtml(screen.name)}</a>`).join("")}</nav><main>${prototype.screens.map((screen) => `<section class="screen" id="${escapeHtml(screen.id)}">${screen.components.map((item) => renderComponent(screen, item)).join("")}</section>`).join("")}</main></body></html>`;
  }

  function createDefaultState() {
    return {
      format: FORMAT,
      version: VERSION,
      projectId: uid("creative-project"),
      projectName: "Creative Production Lab",
      activeView: "repurpose",
      repurpose: { input: { title: "", transcript: "", platform: "YouTube", duration: 0, language: "vi", targetLanguage: "vi" }, result: null },
      brand: { kit: normalizeBrand({}), sample: "", report: null, drafts: [] },
      audio: { timeline: normalizeTimeline({ clips: [{ type: "voice", start: 0, duration: 4, text: "Xin chao mung ban den voi HH Creative OS." }, { type: "music", start: 0, duration: 8, text: "Nhac nen" }] }), consent: false },
      prototype: { prompt: "Ung dung quan ly du an sang tao cho nhom nho", project: generatePrototype("Ung dung quan ly du an sang tao cho nhom nho") },
      updatedAt: new Date().toISOString()
    };
  }

  function normalizeState(input) {
    const base = createDefaultState();
    const source = input && typeof input === "object" ? input : {};
    return {
      ...base,
      projectId: safeText(source.projectId || base.projectId, 100),
      projectName: safeText(source.projectName || base.projectName, 140),
      activeView: VIEWS.includes(source.activeView) ? source.activeView : base.activeView,
      repurpose: { input: { ...base.repurpose.input, ...(source.repurpose?.input || {}) }, result: source.repurpose?.result ? clone(source.repurpose.result) : null },
      brand: { kit: normalizeBrand(source.brand?.kit || base.brand.kit), sample: safeText(source.brand?.sample || "", 20000), report: source.brand?.report ? clone(source.brand.report) : null, drafts: Array.isArray(source.brand?.drafts) ? source.brand.drafts.slice(0, 30).map(clone) : [] },
      audio: { timeline: normalizeTimeline(source.audio?.timeline || base.audio.timeline), consent: Boolean(source.audio?.consent) },
      prototype: { prompt: sanitizePrompt(source.prototype?.prompt || base.prototype.prompt), project: normalizePrototype(source.prototype?.project || base.prototype.project) },
      updatedAt: source.updatedAt || base.updatedAt,
      format: FORMAT,
      version: VERSION
    };
  }

  function saveLocalState(state, storage) {
    if (!storage?.setItem) return { ok: false, reason: "unsupported" };
    try {
      storage.setItem(STORAGE_KEY, JSON.stringify(normalizeState(state)));
      return { ok: true };
    } catch (error) {
      return { ok: false, reason: error?.name === "QuotaExceededError" ? "quota" : "write-failed", error };
    }
  }

  function loadLocalState(storage) {
    if (!storage?.getItem) return null;
    try {
      const parsed = JSON.parse(storage.getItem(STORAGE_KEY) || "null");
      return parsed?.format === FORMAT ? normalizeState(parsed) : null;
    } catch (_) {
      return null;
    }
  }

  function projectFromStoreState(raw, projectId) {
    const storeState = raw && typeof raw === "object" ? raw : {};
    const projects = Array.isArray(storeState.projects) ? storeState.projects : [];
    const wanted = safeText(projectId || storeState.activeProjectId || "", 100);
    return projects.find((project) => project?.id === wanted) || projects[0] || null;
  }

  async function saveProjectState(store, state) {
    if (!store) return { ok: false, reason: "unsupported" };
    if (typeof store.getState === "function" && typeof store.updateProject === "function") {
      const existing = projectFromStoreState(store.getState(), state.projectId);
      if (!existing) return { ok: false, reason: "project-missing" };
      const payload = normalizeState({ ...state, projectId: existing.id, projectName: existing.name || state.projectName });
      const project = await store.updateProject(existing.id, {
        workflows: { ...(existing.workflows || {}), productionLab: payload },
        brand: {
          ...(existing.brand || {}),
          name: payload.brand.kit.name,
          voice: payload.brand.kit.voice,
          bannedWords: payload.brand.kit.bannedWords,
          fonts: payload.brand.kit.fonts,
          colors: payload.brand.kit.colors,
          ctaRules: payload.brand.kit.cta ? [payload.brand.kit.cta] : []
        }
      });
      return { ok: true, project, adapter: "creative-os" };
    }
    if (typeof store.saveProject === "function") {
      const existing = typeof store.getProject === "function" ? await store.getProject(state.projectId) : null;
      const project = await store.saveProject({
        ...(existing || {}), id: state.projectId, name: state.projectName,
        data: { ...(existing?.data || {}), creativeProductionLab: normalizeState(state) },
        tags: [...new Set([...(existing?.tags || []), "creative", "production-lab"])]
      });
      return { ok: true, project, adapter: "generic-project" };
    }
    return { ok: false, reason: "unsupported" };
  }

  async function loadProjectState(store, projectId) {
    if (!store) return null;
    if (typeof store.getState === "function") {
      const project = projectFromStoreState(store.getState(), projectId);
      const saved = project?.workflows?.productionLab;
      if (saved) return normalizeState({ ...saved, projectId: project.id, projectName: project.name || saved.projectName });
      if (project) return normalizeState({ ...createDefaultState(), projectId: project.id, projectName: project.name || "Creative Production Lab", brand: { ...createDefaultState().brand, kit: normalizeBrand(project.brand || {}) } });
      return null;
    }
    if (typeof store.getProject === "function" && projectId) {
      const project = await store.getProject(projectId);
      return project?.data?.creativeProductionLab ? normalizeState(project.data.creativeProductionLab) : null;
    }
    return null;
  }

  function detectCapabilities(scope, doc, storage) {
    return {
      localStorage: Boolean(storage?.getItem && storage?.setItem),
      download: Boolean(doc?.createElement && scope?.URL?.createObjectURL && scope?.Blob),
      clipboard: Boolean(scope?.navigator?.clipboard?.writeText),
      fileReader: Boolean(scope?.FileReader),
      ...detectAudioCapabilities(scope)
    };
  }

  function downloadFile(scope, doc, name, content, type) {
    if (!scope?.URL?.createObjectURL || !scope?.Blob || !doc?.createElement) return false;
    const blob = content instanceof Blob ? content : new Blob([content], { type: type || "text/plain;charset=utf-8" });
    const url = scope.URL.createObjectURL(blob);
    const anchor = doc.createElement("a");
    anchor.href = url;
    anchor.download = name;
    anchor.hidden = true;
    doc.body?.append(anchor);
    anchor.click();
    anchor.remove();
    scope.setTimeout(() => scope.URL.revokeObjectURL(url), 1000);
    return true;
  }

  function viewTabs(active) {
    return `<nav class="cpl-tabs" aria-label="Production Lab">${VIEWS.map((view) => { const item = VIEW_META[view]; return `<button type="button" role="tab" aria-selected="${view === active}" tabindex="${view === active ? "0" : "-1"}" data-cpl-view="${view}" style="--cpl-tab:${item.accent}"><i>${item.code}</i><span>${item.title}<small>${item.note}</small></span></button>`; }).join("")}</nav>`;
  }

  function shellMarkup(state, capabilities, body) {
    const meta = VIEW_META[state.activeView];
    return `<section class="cpl-app" data-creative-production-lab style="--cpl-accent:${meta.accent}"><header class="cpl-hero"><div><p><i></i>HH CREATIVE OS / PRODUCTION LAB</p><h1>${meta.title}</h1><span>${meta.note}</span></div><aside><span><b>${state.projectName}</b><small>Autosave ${capabilities.localStorage ? "local + project store" : "project store"}</small></span><button type="button" data-cpl-action="save">Luu</button></aside></header>${viewTabs(state.activeView)}<main class="cpl-stage">${body}</main><footer class="cpl-footer"><span><i></i>Xu ly tren thiet bi</span><span>${FORMAT} v${VERSION}</span><strong role="status" aria-live="polite" data-cpl-status>San sang.</strong></footer></section>`;
  }

  function repurposeMarkup(state) {
    const input = state.repurpose.input;
    const result = state.repurpose.result;
    return `<section class="cpl-repurpose"><aside class="cpl-panel cpl-source"><header><div><small>NGUON</small><h2>Transcript & metadata</h2></div><label class="cpl-file-button">Nhap TXT<input type="file" accept=".txt,.md,.srt,text/plain" data-cpl-transcript-file></label></header><label>Tieu de<input value="${escapeHtml(input.title)}" data-cpl-repurpose="title" placeholder="Ten video hoac chien dich"></label><div class="cpl-field-grid"><label>Nen tang<select data-cpl-repurpose="platform">${["YouTube", "TikTok", "Facebook", "Podcast"].map((item) => `<option ${item === input.platform ? "selected" : ""}>${item}</option>`).join("")}</select></label><label>Thoi luong (giay)<input type="number" min="0" value="${Number(input.duration) || 0}" data-cpl-repurpose="duration"></label><label>Ngon ngu nguon<input value="${escapeHtml(input.language)}" data-cpl-repurpose="language"></label><label>Dich sang<input value="${escapeHtml(input.targetLanguage)}" data-cpl-repurpose="targetLanguage"></label></div><label>Noi dung<textarea rows="15" data-cpl-repurpose="transcript" placeholder="Dan transcript, mo ta video hoac y tuong...">${escapeHtml(input.transcript)}</textarea></label><div class="cpl-actions"><button class="is-primary" type="button" data-cpl-action="repurpose-generate">Tao bo noi dung</button><button type="button" data-cpl-action="repurpose-ai">Chay AI neu da cau hinh</button></div></aside><section class="cpl-output"><header><div><small>OUTPUT MATRIX</small><h2>7 dinh dang san sang xuat ban</h2></div>${result ? `<span class="cpl-ready">${result.status}</span>` : ""}</header>${result ? `<div class="cpl-output-grid">${Object.entries(result.outputs).map(([key, output]) => { const spec = PLATFORM_SPECS[key]; const preview = output.script || output.post || output.headline || output.intro || output.body || output.markdown || output.srt || ""; return `<article><header><i>${key.slice(0, 2).toUpperCase()}</i><div><strong>${spec.label}</strong><small>${spec.width ? `${spec.width} x ${spec.height || "auto"}` : spec.ratio}</small></div><span>${spec.ratio}</span></header><p>${escapeHtml(String(preview).slice(0, 360))}</p><button type="button" data-cpl-copy-output="${key}">Sao chep</button></article>`; }).join("")}</div><div class="cpl-export-bar"><span><b>${result.source.words}</b> tu nguon</span><button type="button" data-cpl-action="repurpose-json">JSON</button><button type="button" data-cpl-action="repurpose-md">Markdown</button><button type="button" data-cpl-action="repurpose-srt">SRT</button></div>` : `<div class="cpl-empty"><i>RP</i><h3>Mot nguon, bay dinh dang</h3><p>Nhap transcript va Production Lab se tao ban nhap deterministic. Ket noi runAI la tuy chon.</p></div>`}</section></section>`;
  }

  function brandMarkup(state) {
    const brand = state.brand.kit;
    const report = state.brand.report;
    return `<section class="cpl-brand"><aside class="cpl-panel"><header><div><small>BRAND KIT</small><h2>Quy tac thuong hieu</h2></div><span class="cpl-chip">LOCAL</span></header><label>Ten thuong hieu<input value="${escapeHtml(brand.name)}" data-cpl-brand="name"></label><label>Brand voice<textarea rows="3" data-cpl-brand="voice">${escapeHtml(brand.voice)}</textarea></label><label>Tu khoa giong dieu<input value="${escapeHtml(brand.voiceKeywords.join(", "))}" data-cpl-brand="voiceKeywords"></label><label>Tu cam<input value="${escapeHtml(brand.bannedWords.join(", "))}" data-cpl-brand="bannedWords"></label><div class="cpl-field-grid"><label>Font<input value="${escapeHtml(brand.fonts.join(", "))}" data-cpl-brand="fonts"></label><label>Mau<input value="${escapeHtml(brand.colors.join(", "))}" data-cpl-brand="colors"></label></div><label>CTA bat buoc<input value="${escapeHtml(brand.cta)}" data-cpl-brand="cta"></label><label>Logo metadata<input value="${escapeHtml(brand.logo.name)}" data-cpl-brand="logoName" placeholder="logo.svg"></label></aside><section class="cpl-brand-work"><header><div><small>CONTENT GUARD</small><h2>Cham diem truoc khi xuat ban</h2></div>${report ? `<strong class="cpl-score" style="--score:${report.score * 3.6}deg">${report.score}<small>${report.grade}</small></strong>` : ""}</header><label class="cpl-editor-label">Noi dung can kiem tra<textarea rows="12" data-cpl-brand-sample placeholder="Nhap caption, tieu de, email hoac kich ban...">${escapeHtml(state.brand.sample)}</textarea></label><div class="cpl-actions"><button class="is-primary" type="button" data-cpl-action="brand-score">Cham diem</button><button type="button" data-cpl-action="brand-fix">Tao ban sua moi</button></div>${report ? `<div class="cpl-report"><header><strong>${report.warnings.length ? `${report.warnings.length} canh bao` : "Dat quy tac"}</strong><span>${report.reasons.length} diem tot</span></header>${report.warnings.map((item) => `<p class="is-warning"><i>!</i>${escapeHtml(item.message)}</p>`).join("")}${report.reasons.map((item) => `<p class="is-good"><i>+</i>${escapeHtml(item)}</p>`).join("")}</div>` : ""}<section class="cpl-drafts"><header><strong>Ban nhap khong pha huy</strong><span>${state.brand.drafts.length} phien ban</span></header>${state.brand.drafts.length ? state.brand.drafts.slice(0, 5).map((draft) => `<article><div><b>${draft.report.score}/100</b><small>${new Date(draft.createdAt).toLocaleString("vi-VN")}</small></div><p>${escapeHtml(draft.output.slice(0, 260))}</p><button type="button" data-cpl-use-draft="${escapeHtml(draft.id)}">Mo ban nay</button></article>`).join("") : `<p class="cpl-muted">Auto-fix luon tao ban moi, khong ghi de noi dung goc.</p>`}</section></section></section>`;
  }

  function audioMarkup(state, capabilities) {
    const timeline = state.audio.timeline;
    return `<section class="cpl-audio"><header class="cpl-audio-toolbar"><div><small>AUDIO SESSION</small><h2>${escapeHtml(timeline.name)}</h2></div><div><button type="button" data-cpl-action="audio-add">+ Clip</button><button type="button" data-cpl-action="audio-preview" ${capabilities.webAudio ? "" : "disabled"}>Nghe preview</button><button type="button" data-cpl-action="audio-stop">Dung</button></div></header><div class="cpl-audio-grid"><aside class="cpl-panel"><header><div><small>SPEAKERS</small><h3>${timeline.speakers.length} giong</h3></div></header>${timeline.speakers.map((speaker) => `<article class="cpl-speaker"><i style="--speaker:${speaker.color}">${escapeHtml(speaker.name.slice(0, 2).toUpperCase())}</i><span><strong>${escapeHtml(speaker.name)}</strong><small>${escapeHtml(speaker.language)}</small></span></article>`).join("")}<hr><label class="cpl-consent"><input type="checkbox" data-cpl-record-consent ${state.audio.consent ? "checked" : ""}><span><strong>Cho phep micro</strong><small>Chi xin quyen sau khi ban tick va bam ghi.</small></span></label><button type="button" data-cpl-action="audio-record" ${capabilities.recording ? "" : "disabled"}>Bat dau ghi am</button><p class="cpl-capability">${capabilities.recording ? "MediaRecorder kha dung." : "Trinh duyet khong ho tro ghi am tai cho."}</p></aside><section class="cpl-timeline"><div class="cpl-ruler">${Array.from({ length: 9 }, (_, index) => `<span>${Math.round(timeline.duration * index / 8)}s</span>`).join("")}</div>${CLIP_TYPES.map((type) => { const clips = timeline.clips.filter((clip) => clip.type === type); return `<div class="cpl-track"><header><i>${type.slice(0, 2).toUpperCase()}</i><span>${type}</span><small>${clips.length}</small></header><div class="cpl-track-lane">${clips.map((clip) => `<button type="button" style="--left:${Math.min(96, clip.start / timeline.duration * 100)}%;--width:${Math.max(5, (clip.duration - clip.trimIn - clip.trimOut) / timeline.duration * 100)}%" data-cpl-audio-clip="${escapeHtml(clip.id)}"><strong>${escapeHtml(clip.text.slice(0, 34))}</strong><small>${formatTime(clip.start)} +${clip.duration.toFixed(1)}s</small></button>`).join("")}</div></div>`; }).join("")}</section><aside class="cpl-panel cpl-audio-inspector"><header><div><small>EXPORT</small><h3>Ban giao</h3></div></header><button type="button" data-cpl-action="audio-wav" ${capabilities.wavExport ? "" : "disabled"}>WAV preview mix</button><button type="button" data-cpl-action="audio-srt">Subtitle SRT</button><button type="button" data-cpl-action="audio-csv">Cue sheet CSV</button><button type="button" data-cpl-action="audio-json">Project JSON</button><p>${escapeHtml(capabilities.notice)}</p><div data-cpl-audio-inspector><strong>Chon clip tren timeline</strong><small>Dieu chinh vi tri va cat trim ma khong sua file goc.</small></div></aside></div></section>`;
  }

  function previewComponents(prototype, screen) {
    const links = new Map(prototype.links.map((link) => [`${link.from}:${link.componentId}`, link.to]));
    return screen.components.map((item) => {
      const text = escapeHtml(item.text);
      const target = links.get(`${screen.id}:${item.id}`) || item.action;
      if (item.type === "heading") return `<h2>${text}</h2>`;
      if (item.type === "input") return `<label>${text}<input placeholder="${text}" disabled></label>`;
      if (item.type === "button") return `<button type="button" data-cpl-prototype-go="${escapeHtml(target)}">${text}</button>`;
      if (item.type === "metric") return `<strong class="cpl-proto-metric">${text}</strong>`;
      if (item.type === "card") return `<article>${text}</article>`;
      return `<p>${text}</p>`;
    }).join("");
  }

  function prototypeMarkup(state) {
    const project = state.prototype.project;
    const active = project.screens.find((screen) => screen.id === project.activeScreen) || project.screens[0];
    return `<section class="cpl-prototype"><aside class="cpl-panel"><header><div><small>PROMPT TO FLOW</small><h2>Mo ta san pham</h2></div><span class="cpl-chip">SAFE</span></header><label>Prompt<textarea rows="8" data-cpl-prototype-prompt>${escapeHtml(state.prototype.prompt)}</textarea></label><button class="is-primary" type="button" data-cpl-action="prototype-generate">Tao prototype</button><div class="cpl-safety"><i>!</i><p><strong>Preview schema an toan</strong><span>Khong eval, khong chay script tu prompt.</span></p></div><hr><header><div><small>SCREENS</small><h3>${project.screens.length} man hinh</h3></div><button type="button" data-cpl-action="prototype-add-screen">+</button></header><div class="cpl-screen-list">${project.screens.map((screen) => `<button type="button" class="${screen.id === active?.id ? "is-active" : ""}" data-cpl-prototype-screen="${escapeHtml(screen.id)}"><i>${screen.name.slice(0, 2).toUpperCase()}</i><span><strong>${escapeHtml(screen.name)}</strong><small>${screen.components.length} components</small></span></button>`).join("")}</div></aside><section class="cpl-prototype-work"><header><div><small>INTERACTIVE PREVIEW</small><h2>${escapeHtml(project.name)}</h2></div><div><button type="button" data-cpl-action="prototype-json">JSON</button><button type="button" data-cpl-action="prototype-html">HTML</button></div></header><div class="cpl-device"><div class="cpl-browser-bar"><i></i><i></i><i></i><span>hh-preview.local/${escapeHtml(active?.id || "")}</span></div><div class="cpl-proto-screen" data-cpl-prototype-preview>${active ? previewComponents(project, active) : ""}</div></div></section><aside class="cpl-panel cpl-component-panel"><header><div><small>COMPONENTS</small><h3>${escapeHtml(active?.name || "Man hinh")}</h3></div></header>${active?.components.map((item) => `<label><span>${escapeHtml(item.type)} / ${escapeHtml(item.id)}</span><input value="${escapeHtml(item.text)}" data-cpl-prototype-component="${escapeHtml(item.id)}"></label>`).join("") || ""}<button type="button" data-cpl-action="prototype-add-component">+ Component</button><hr><pre>${escapeHtml(JSON.stringify(project.mockData, null, 2))}</pre></aside></section>`;
  }

  function startAudioPreview(scope, timelineInput) {
    const AudioContextClass = scope?.AudioContext || scope?.webkitAudioContext;
    if (!AudioContextClass) return { ok: false, reason: "unsupported", stop() {} };
    const context = new AudioContextClass();
    const nodes = [];
    normalizeTimeline(timelineInput).clips.filter((clip) => !["subtitle", "translation"].includes(clip.type)).forEach((clip, index) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.frequency.value = ({ voice: 220, music: 330, ambience: 110, sfx: 520 }[clip.type] || 220) + index * 6;
      gain.gain.value = clip.volume * 0.06;
      oscillator.connect(gain).connect(context.destination);
      oscillator.start(context.currentTime + clip.start);
      oscillator.stop(context.currentTime + clip.start + Math.min(clip.duration, 10));
      nodes.push(oscillator, gain);
    });
    return { ok: true, context, stop() { nodes.forEach((node) => { try { node.disconnect(); } catch (_) {} }); context.close?.(); } };
  }

  function mount(target, options) {
    const opts = options || {};
    const doc = opts.document || globalScope.document;
    const root = typeof target === "string" ? doc?.querySelector(target) : target;
    if (!root || !doc) return null;
    unmount(root);
    const storage = Object.prototype.hasOwnProperty.call(opts, "storage") ? opts.storage : globalScope.localStorage;
    const capabilities = detectCapabilities(globalScope, doc, storage);
    let state = normalizeState(opts.state || loadLocalState(storage) || createDefaultState());
    const creativeProject = typeof opts.store?.getState === "function" ? projectFromStoreState(opts.store.getState(), opts.projectId) : null;
    if (creativeProject) {
      const projectState = creativeProject.workflows?.productionLab;
      state = projectState ? normalizeState({ ...projectState, projectId: creativeProject.id, projectName: creativeProject.name }) : normalizeState({ ...state, projectId: creativeProject.id, projectName: creativeProject.name, brand: { ...state.brand, kit: normalizeBrand(creativeProject.brand || state.brand.kit) } });
    }
    if (VIEWS.includes(opts.view)) state.activeView = opts.view;
    if (opts.projectId) state.projectId = safeText(opts.projectId, 100);
    const listeners = [];
    let audioPreview = null;
    let mediaRecorder = null;
    let recordStream = null;
    let recordingChunks = [];
    let syncTimer = 0;

    const on = (node, type, handler) => {
      node.addEventListener(type, handler);
      listeners.push(() => node.removeEventListener(type, handler));
    };
    const status = (message) => {
      const node = root.querySelector("[data-cpl-status]");
      if (node) node.textContent = safeText(message, 260);
    };
    const scheduleStoreSync = () => {
      globalScope.clearTimeout(syncTimer);
      syncTimer = globalScope.setTimeout(async () => {
        try {
          const result = await saveProjectState(opts.store, state);
          if (result.ok) status("Da dong bo vao Universal Creative Project.");
        } catch (error) {
          status(`Da luu local; project store loi: ${error.message}`);
        }
      }, 180);
    };
    const persist = (message) => {
      state.updatedAt = new Date().toISOString();
      const saved = saveLocalState(state, storage);
      scheduleStoreSync();
      if (message) status(`${message}${saved.ok ? "" : " Project store se duoc uu tien."}`);
    };
    const bodyMarkup = () => ({
      repurpose: () => repurposeMarkup(state),
      brand: () => brandMarkup(state),
      "audio-dubbing": () => audioMarkup(state, capabilities),
      prototype: () => prototypeMarkup(state)
    })[state.activeView]();
    const render = () => { root.innerHTML = shellMarkup(state, capabilities, bodyMarkup()); };

    function captureRepurpose() {
      root.querySelectorAll("[data-cpl-repurpose]").forEach((node) => { state.repurpose.input[node.dataset.cplRepurpose] = node.type === "number" ? Number(node.value) || 0 : node.value; });
    }

    function captureBrand() {
      root.querySelectorAll("[data-cpl-brand]").forEach((node) => {
        const key = node.dataset.cplBrand;
        if (["voiceKeywords", "bannedWords", "fonts", "colors"].includes(key)) state.brand.kit[key] = node.value.split(",").map((item) => item.trim()).filter(Boolean);
        else if (key === "logoName") state.brand.kit.logo.name = node.value;
        else state.brand.kit[key] = node.value;
      });
      state.brand.kit = normalizeBrand(state.brand.kit);
      state.brand.sample = root.querySelector("[data-cpl-brand-sample]")?.value || state.brand.sample;
    }

    async function copyText(value) {
      if (!capabilities.clipboard) return status("Clipboard khong kha dung; hay dung nut export.");
      try { await globalScope.navigator.clipboard.writeText(String(value || "")); status("Da sao chep."); } catch (_) { status("Trinh duyet tu choi quyen clipboard."); }
    }

    async function invokeRunAI(task, payload) {
      if (typeof opts.runAI !== "function") return null;
      const response = await opts.runAI({ task, payload: clone(payload), projectId: state.projectId, source: "creative-production-lab" });
      return response && typeof response === "object" ? response : { output: String(response || "") };
    }

    on(root, "click", async (event) => {
      const viewButton = event.target.closest("[data-cpl-view]");
      if (viewButton) {
        state.activeView = viewButton.dataset.cplView;
        persist("Da chuyen workspace.");
        render();
        opts.onNavigate?.(state.activeView);
        return;
      }
      const copyButton = event.target.closest("[data-cpl-copy-output]");
      if (copyButton && state.repurpose.result) {
        const output = state.repurpose.result.outputs[copyButton.dataset.cplCopyOutput];
        return copyText(output?.script || output?.post || output?.headline || output?.intro || output?.body || output?.markdown || output?.srt || JSON.stringify(output, null, 2));
      }
      const screenButton = event.target.closest("[data-cpl-prototype-screen]");
      if (screenButton) {
        state.prototype.project.activeScreen = screenButton.dataset.cplPrototypeScreen;
        persist(); render(); return;
      }
      const goButton = event.target.closest("[data-cpl-prototype-go]");
      if (goButton && state.prototype.project.screens.some((screen) => screen.id === goButton.dataset.cplPrototypeGo)) {
        state.prototype.project.activeScreen = goButton.dataset.cplPrototypeGo;
        persist(); render(); return;
      }
      const draftButton = event.target.closest("[data-cpl-use-draft]");
      if (draftButton) {
        const draft = state.brand.drafts.find((item) => item.id === draftButton.dataset.cplUseDraft);
        if (draft) { state.brand.sample = draft.output; state.brand.report = draft.report; persist("Da mo ban nhap. Ban goc van duoc giu."); render(); }
        return;
      }
      const clipButton = event.target.closest("[data-cpl-audio-clip]");
      if (clipButton) {
        const clip = state.audio.timeline.clips.find((item) => item.id === clipButton.dataset.cplAudioClip);
        const inspector = root.querySelector("[data-cpl-audio-inspector]");
        if (clip && inspector) inspector.innerHTML = `<strong>${escapeHtml(clip.type)} / ${escapeHtml(clip.id)}</strong><label>Bat dau<input type="number" step="0.1" min="0" value="${clip.start}" data-cpl-clip-start="${escapeHtml(clip.id)}"></label><label>Trim in<input type="number" step="0.1" min="0" value="${clip.trimIn}" data-cpl-clip-trim-in="${escapeHtml(clip.id)}"></label><label>Trim out<input type="number" step="0.1" min="0" value="${clip.trimOut}" data-cpl-clip-trim-out="${escapeHtml(clip.id)}"></label>`;
        return;
      }
      const actionButton = event.target.closest("[data-cpl-action]");
      if (!actionButton) return;
      const action = actionButton.dataset.cplAction;
      if (action === "save") persist("Da luu Production Lab.");
      else if (action === "repurpose-generate") {
        captureRepurpose(); state.repurpose.result = generateRepurpose(state.repurpose.input); persist("Da tao 7 dinh dang local."); render();
      } else if (action === "repurpose-ai") {
        captureRepurpose();
        if (typeof opts.runAI !== "function") return status("Chua co runAI. Dang dung engine deterministic local.");
        actionButton.disabled = true; status("Dang yeu cau AI tao ban nhap moi...");
        try {
          const response = await invokeRunAI("repurpose", state.repurpose.input);
          const local = generateRepurpose(state.repurpose.input);
          if (response?.outputs && typeof response.outputs === "object") local.outputs = { ...local.outputs, ...response.outputs };
          else if (response?.output) local.outputs.blog.markdown = safeText(response.output, 50000);
          local.provider = response?.provider || "configured-runAI";
          state.repurpose.result = local; persist("AI da tra ve ban nhap; chua tu xuat ban."); render();
        } catch (error) { status(`AI loi: ${error.message}. Du lieu khong bi ghi de.`); actionButton.disabled = false; }
      } else if (action.startsWith("repurpose-")) {
        if (!state.repurpose.result) return status("Chua co bundle de export.");
        const bundle = exportRepurposeBundle(state.repurpose.result);
        const type = action.split("-")[1];
        const files = { json: ["bundle.json", bundle.files["bundle.json"], "application/json"], md: ["content.md", bundle.files["content.md"], "text/markdown"], srt: ["subtitles.srt", bundle.files["subtitles.srt"], "application/x-subrip"] };
        const file = files[type]; if (file && downloadFile(globalScope, doc, safeFilename(state.projectName, file[0].split(".").pop()), file[1], file[2])) status(`Da export ${file[0]}.`); else status("Download khong kha dung.");
      } else if (action === "brand-score") {
        captureBrand(); state.brand.report = scoreBrandOutput(state.brand.sample, state.brand.kit); persist("Da cham diem theo quy tac da khai bao."); render();
      } else if (action === "brand-fix") {
        captureBrand(); const draft = autoFixBrandOutput(state.brand.sample, state.brand.kit); draft.parentId = state.brand.drafts[0]?.id || null; state.brand.drafts.unshift(draft); state.brand.drafts = state.brand.drafts.slice(0, 30); state.brand.report = draft.report; persist("Da tao ban sua moi, khong ghi de ban goc."); render();
      } else if (action === "audio-add") {
        state.audio.timeline = addTimelineClip(state.audio.timeline, { type: "voice", start: state.audio.timeline.clips.length * 2, duration: 3, text: `Clip moi ${state.audio.timeline.clips.length + 1}` }); persist("Da them clip."); render();
      } else if (action === "audio-preview") {
        audioPreview?.stop(); audioPreview = startAudioPreview(globalScope, state.audio.timeline); status(audioPreview.ok ? "Dang phat procedural preview mix." : "Web Audio khong kha dung.");
      } else if (action === "audio-stop") { audioPreview?.stop(); audioPreview = null; status("Da dung preview."); }
      else if (action === "audio-record") {
        if (!state.audio.consent) return status("Hay tick dong y micro truoc khi ghi.");
        if (!capabilities.recording) return status("Ghi am khong duoc ho tro tren trinh duyet nay.");
        if (mediaRecorder?.state === "recording") { mediaRecorder.stop(); return; }
        try {
          recordStream = await globalScope.navigator.mediaDevices.getUserMedia({ audio: true, video: false });
          recordingChunks = [];
          mediaRecorder = new globalScope.MediaRecorder(recordStream);
          mediaRecorder.ondataavailable = (item) => { if (item.data?.size) recordingChunks.push(item.data); };
          mediaRecorder.onstop = () => {
            const blob = new Blob(recordingChunks, { type: mediaRecorder.mimeType || "audio/webm" });
            state.audio.timeline = addTimelineClip(state.audio.timeline, { type: "voice", start: state.audio.timeline.duration, duration: 3, text: "Ban ghi am local", sourceName: `recording-${Date.now()}.webm`, blobSize: blob.size });
            recordStream?.getTracks().forEach((track) => track.stop()); recordStream = null; persist("Da them metadata ban ghi local vao timeline."); render();
          };
          mediaRecorder.start(); actionButton.textContent = "Dung ghi"; status("Dang ghi am. Du lieu chi nam trong phien trinh duyet.");
        } catch (error) { status(`Khong the mo micro: ${error.message}`); }
      } else if (action === "audio-wav") {
        const wav = renderTimelineWav(state.audio.timeline); downloadFile(globalScope, doc, safeFilename(state.audio.timeline.name, "wav"), wav, "audio/wav") ? status("Da export WAV procedural preview mix.") : status("WAV download khong kha dung.");
      } else if (action === "audio-srt") downloadFile(globalScope, doc, safeFilename(state.audio.timeline.name, "srt"), timelineToSrt(state.audio.timeline), "application/x-subrip") ? status("Da export SRT.") : status("Download khong kha dung.");
      else if (action === "audio-csv") downloadFile(globalScope, doc, safeFilename(state.audio.timeline.name, "csv"), timelineToCsv(state.audio.timeline), "text/csv") ? status("Da export CSV.") : status("Download khong kha dung.");
      else if (action === "audio-json") downloadFile(globalScope, doc, safeFilename(state.audio.timeline.name, "json"), JSON.stringify(state.audio.timeline, null, 2), "application/json") ? status("Da export project JSON.") : status("Download khong kha dung.");
      else if (action === "prototype-generate") {
        state.prototype.prompt = root.querySelector("[data-cpl-prototype-prompt]")?.value || "";
        state.prototype.project = generatePrototype(state.prototype.prompt); persist("Da tao flow moi tu schema an toan."); render();
      } else if (action === "prototype-add-screen") {
        const index = state.prototype.project.screens.length + 1; state.prototype.project.screens.push({ id: `screen-${index}`, name: `Man hinh ${index}`, components: [component(`title-${index}`, "heading", `Man hinh ${index}`)] }); state.prototype.project.activeScreen = `screen-${index}`; persist("Da them man hinh."); render();
      } else if (action === "prototype-add-component") {
        const screen = state.prototype.project.screens.find((item) => item.id === state.prototype.project.activeScreen); if (screen) screen.components.push(component(uid("text"), "text", "Noi dung moi")); persist("Da them component."); render();
      } else if (action === "prototype-json") downloadFile(globalScope, doc, safeFilename(state.prototype.project.name, "json"), JSON.stringify(state.prototype.project, null, 2), "application/json") ? status("Da export prototype JSON.") : status("Download khong kha dung.");
      else if (action === "prototype-html") downloadFile(globalScope, doc, safeFilename(state.prototype.project.name, "html"), exportPrototypeHtml(state.prototype.project), "text/html") ? status("Da export HTML an toan.") : status("Download khong kha dung.");
    });

    on(root, "change", (event) => {
      const node = event.target;
      if (node.matches("[data-cpl-record-consent]")) { state.audio.consent = node.checked; persist(node.checked ? "Da ghi nhan dong y micro cho thao tac ke tiep." : "Da huy dong y micro."); }
      if (node.matches("[data-cpl-clip-start]")) { state.audio.timeline = moveTimelineClip(state.audio.timeline, node.dataset.cplClipStart, node.value); persist("Da di chuyen clip."); render(); }
      if (node.matches("[data-cpl-clip-trim-in], [data-cpl-clip-trim-out]")) {
        const id = node.dataset.cplClipTrimIn || node.dataset.cplClipTrimOut;
        const clip = state.audio.timeline.clips.find((item) => item.id === id);
        if (clip) state.audio.timeline = trimTimelineClip(state.audio.timeline, id, node.dataset.cplClipTrimIn ? node.value : clip.trimIn, node.dataset.cplClipTrimOut ? node.value : clip.trimOut);
        persist("Da trim clip khong pha huy."); render();
      }
      if (node.matches("[data-cpl-prototype-component]")) {
        const screen = state.prototype.project.screens.find((item) => item.id === state.prototype.project.activeScreen);
        const item = screen?.components.find((entry) => entry.id === node.dataset.cplPrototypeComponent);
        if (item) item.text = safeText(node.value, 160);
        persist("Da cap nhat component."); render();
      }
      if (node.matches("[data-cpl-transcript-file]")) {
        const file = node.files?.[0]; if (!file) return;
        if (!capabilities.fileReader) return status("FileReader khong kha dung.");
        const reader = new globalScope.FileReader();
        reader.onload = () => { state.repurpose.input.transcript = normalizeWhitespace(reader.result); state.repurpose.input.title ||= file.name.replace(/\.[^.]+$/, ""); persist("Da nap transcript tu thiet bi."); render(); };
        reader.onerror = () => status("Khong the doc file da chon."); reader.readAsText(file); node.value = "";
      }
    });

    on(root, "input", (event) => {
      if (event.target.matches("[data-cpl-repurpose]")) state.repurpose.input[event.target.dataset.cplRepurpose] = event.target.type === "number" ? Number(event.target.value) || 0 : event.target.value;
      if (event.target.matches("[data-cpl-brand-sample]")) state.brand.sample = event.target.value;
      if (event.target.matches("[data-cpl-prototype-prompt]")) state.prototype.prompt = sanitizePrompt(event.target.value);
    });

    on(root, "keydown", (event) => {
      const tab = event.target.closest("[data-cpl-view]");
      if (tab && ["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) {
        event.preventDefault(); const index = VIEWS.indexOf(tab.dataset.cplView); const next = event.key === "Home" ? 0 : event.key === "End" ? VIEWS.length - 1 : (index + (event.key === "ArrowRight" ? 1 : -1) + VIEWS.length) % VIEWS.length; state.activeView = VIEWS[next]; persist(); render(); root.querySelector(`[data-cpl-view="${state.activeView}"]`)?.focus();
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") { event.preventDefault(); persist("Da luu bang phim tat."); }
    });

    render();
    const ready = opts.store && state.projectId ? loadProjectState(opts.store, state.projectId).then((projectState) => { if (projectState) { state = projectState; if (VIEWS.includes(opts.view)) state.activeView = opts.view; render(); status("Da nap du lieu tu Universal Creative Project."); } return clone(state); }).catch(() => clone(state)) : Promise.resolve(clone(state));
    const api = {
      ready,
      getState: () => clone(state),
      setState(next) { state = normalizeState(next); if (VIEWS.includes(opts.view)) state.activeView = opts.view; persist("Da thay trang thai Production Lab."); render(); return clone(state); },
      setView(view) { if (!VIEWS.includes(view)) return false; state.activeView = view; persist(); render(); return true; },
      save: () => { persist("Da luu Production Lab."); return saveProjectState(opts.store, state); },
      generateRepurpose(input) { state.repurpose.input = { ...state.repurpose.input, ...(input || {}) }; state.repurpose.result = generateRepurpose(state.repurpose.input); persist(); render(); return clone(state.repurpose.result); },
      scoreBrand(output, brand) { return scoreBrandOutput(output, brand || state.brand.kit); },
      getTimeline: () => clone(state.audio.timeline),
      getPrototype: () => clone(state.prototype.project)
    };
    mounted.set(root, { api, cleanup() { listeners.splice(0).forEach((off) => off()); globalScope.clearTimeout(syncTimer); audioPreview?.stop(); if (mediaRecorder?.state === "recording") mediaRecorder.stop(); recordStream?.getTracks().forEach((track) => track.stop()); } });
    return api;
  }

  function unmount(target) {
    const root = typeof target === "string" ? globalScope.document?.querySelector(target) : target;
    const instance = root && mounted.get(root);
    if (!instance) return false;
    instance.cleanup();
    mounted.delete(root);
    root.removeAttribute("data-creative-production-lab");
    root.innerHTML = "";
    return true;
  }

  const api = Object.freeze({
    VERSION, FORMAT, STORAGE_KEY, VIEWS, VIEW_META, PLATFORM_SPECS, CLIP_TYPES,
    escapeHtml, safeText, sanitizePrototypeText, safeFilename, normalizeWhitespace, sentenceList, wordCount, formatTime,
    splitCaptions, captionsToSrt, fallbackTranslate, rewriteFallback, generateRepurpose, repurposeMarkdown, exportRepurposeBundle,
    normalizeBrand, scoreBrandOutput, autoFixBrandOutput,
    normalizeClip, normalizeTimeline, addTimelineClip, moveTimelineClip, trimTimelineClip, timelineToSrt, timelineToCsv, renderTimelineWav, detectAudioCapabilities, startAudioPreview,
    sanitizePrompt, generatePrototype, normalizePrototype, exportPrototypeHtml,
    createDefaultState, normalizeState, saveLocalState, loadLocalState, projectFromStoreState, saveProjectState, loadProjectState, detectCapabilities,
    mount, unmount
  });

  globalScope.HHCreativeProductionLab = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
