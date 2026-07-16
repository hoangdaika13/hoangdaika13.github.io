const $ = (selector) => document.querySelector(selector);
const byId = (id) => document.getElementById(id);

const canvas = $(".ambient-canvas");
const context = canvas?.getContext("2d");
const scrollMeter = $(".scroll-meter");
const themeToggle = $(".theme-toggle");
const colors = ["#ff4f9a", "#ffd84d", "#27d98b", "#29c7ff", "#3f63ff", "#ff7a59"];
let particles = [];
let particleAnimation = 0;
let clickAudioContext;
let musicEngine;
const CLOUD_VOTE_API = window.HH_VOTE_API_URL || "";
const REALTIME_URL = window.HH_REALTIME_URL || "";
const SOCKET_URL = typeof window.HH_SOCKET_URL === "string" ? window.HH_SOCKET_URL : REALTIME_URL;
let adminRealtimeTimer = 0;

const revokeCurrentSession = async () => {
  const token = localStorage.getItem("hh-auth-token") || "";
  if (!token || !REALTIME_URL) return;
  try {
    await fetch(`${REALTIME_URL}/api/auth/logout`, { method: "POST", headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
  } catch { /* Local logout still completes if the network is unavailable. */ }
};

const ambientTracks = [
  { name: "Pink Morning", mood: "piano pad", root: 261.63, scale: [0, 4, 7, 11], wave: "sine" },
  { name: "Soft Rain", mood: "dream bell", root: 293.66, scale: [0, 3, 7, 10], wave: "triangle" },
  { name: "Neon Lake", mood: "warm synth", root: 329.63, scale: [0, 5, 7, 12], wave: "sine" },
  { name: "Moon Walk", mood: "slow keys", root: 220.00, scale: [0, 3, 8, 10], wave: "triangle" },
  { name: "Cloud Room", mood: "air pad", root: 246.94, scale: [0, 4, 9, 11], wave: "sine" },
  { name: "HH Dream", mood: "sweet bell", root: 349.23, scale: [0, 4, 7, 12], wave: "triangle" },
  { name: "Tiny Stars", mood: "sparkle", root: 392.00, scale: [0, 2, 7, 9], wave: "sine" },
  { name: "Late Night", mood: "lofi pad", root: 196.00, scale: [0, 5, 8, 10], wave: "triangle" },
  { name: "Blue Garden", mood: "calm keys", root: 277.18, scale: [0, 4, 7, 9], wave: "sine" },
  { name: "Quiet City", mood: "soft pulse", root: 233.08, scale: [0, 3, 7, 12], wave: "triangle" },
  { name: "Rose Glass", mood: "neon pad", root: 311.13, scale: [0, 5, 7, 11], wave: "sine" },
  { name: "Ocean Code", mood: "wide synth", root: 174.61, scale: [0, 4, 7, 14], wave: "sine" },
  { name: "Warm Memory", mood: "gentle", root: 261.63, scale: [0, 3, 7, 10], wave: "triangle" },
  { name: "Cyber Sleep", mood: "dark calm", root: 207.65, scale: [0, 5, 8, 12], wave: "sine" },
  { name: "Golden Mist", mood: "bright pad", root: 369.99, scale: [0, 4, 7, 11], wave: "triangle" },
  { name: "Slow Bloom", mood: "soft rise", root: 185.00, scale: [0, 4, 9, 12], wave: "sine" },
  { name: "Pixel Love", mood: "tiny lead", root: 440.00, scale: [0, 3, 7, 10], wave: "triangle" },
  { name: "Violet Road", mood: "cinematic", root: 164.81, scale: [0, 5, 7, 10], wave: "sine" },
  { name: "Happy Focus", mood: "clean bell", root: 329.63, scale: [0, 4, 7, 14], wave: "triangle" },
  { name: "Night Halo", mood: "deep pad", root: 146.83, scale: [0, 3, 7, 12], wave: "sine" }
];

function showRevealedContent() {
  document.querySelectorAll(".reveal, .section, .project-card, .quote-band, .tool-app").forEach((target) => {
    target.classList.add("is-visible");
  });
}

window.addEventListener("error", showRevealedContent);
window.addEventListener("unhandledrejection", showRevealedContent);

function resizeCanvas() {
  if (!canvas || !context) return;
  const ratio = window.devicePixelRatio || 1;
  canvas.width = Math.floor(window.innerWidth * ratio);
  canvas.height = Math.floor(window.innerHeight * ratio);
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  const prefersLessMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
  const maxParticles = prefersLessMotion ? 18 : Math.min(52, Math.floor(window.innerWidth / 22));
  particles = Array.from({ length: maxParticles }, () => ({
    x: Math.random() * window.innerWidth,
    y: Math.random() * window.innerHeight,
    radius: 2 + Math.random() * 5,
    speed: 0.18 + Math.random() * 0.55,
    drift: -0.25 + Math.random() * 0.5,
    color: colors[Math.floor(Math.random() * colors.length)]
  }));
}

function drawParticles() {
  if (!canvas || !context) return;
  if (document.hidden) {
    particleAnimation = 0;
    return;
  }
  context.clearRect(0, 0, window.innerWidth, window.innerHeight);
  for (const particle of particles) {
    particle.y += particle.speed;
    particle.x += particle.drift;
    if (particle.y > window.innerHeight + 16) {
      particle.y = -16;
      particle.x = Math.random() * window.innerWidth;
    }
    context.beginPath();
    context.globalAlpha = 0.34;
    context.fillStyle = particle.color;
    context.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
    context.fill();
  }
  particleAnimation = requestAnimationFrame(drawParticles);
}

function updateScrollMeter() {
  if (!scrollMeter) return;
  const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
  const progress = maxScroll > 0 ? window.scrollY / maxScroll : 0;
  scrollMeter.style.width = `${Math.min(progress * 100, 100)}%`;
}

function initReveal() {
  const targets = document.querySelectorAll(".section, .project-card, .quote-band, .tool-app");
  if (!targets.length) return;
  targets.forEach((target) => {
    target.classList.add("reveal", "is-visible");
  });
  if (!("IntersectionObserver" in window)) return;
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      }
    },
    { threshold: 0.14 }
  );
  targets.forEach((target) => observer.observe(target));
}

function initTheme() {
  if (!themeToggle) return;
  if (document.body.classList.contains("home-neon")) {
    const savedNeon = localStorage.getItem("hoangdaika13-neon-mode");
    const setNeonMode = (mode) => {
      const isStrong = mode === "strong";
      document.body.classList.toggle("neon-boost", isStrong);
      document.body.classList.toggle("neon-soft", !isStrong);
      themeToggle.textContent = isStrong ? "Neon mạnh" : "Neon nhẹ";
      localStorage.setItem("hoangdaika13-neon-mode", mode);
    };
    setNeonMode(savedNeon === "strong" ? "strong" : "soft");
    themeToggle.addEventListener("click", () => {
      const nextMode = document.body.classList.contains("neon-boost") ? "soft" : "strong";
      setNeonMode(nextMode);
      playClickSound(720);
    });
    return;
  }
  const saved = localStorage.getItem("hoangdaika13-theme");
  if (saved === "dark") document.body.classList.add("dark");
  themeToggle.textContent = document.body.classList.contains("dark") ? "Tối" : "Sáng";
  themeToggle.addEventListener("click", () => {
    document.body.classList.toggle("dark");
    const isDark = document.body.classList.contains("dark");
    themeToggle.textContent = isDark ? "Tối" : "Sáng";
    localStorage.setItem("hoangdaika13-theme", isDark ? "dark" : "light");
  });
}

function playClickSound(frequency = 560) {
  if (!document.body.classList.contains("home-neon")) return;
  try {
    clickAudioContext ||= new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = clickAudioContext.createOscillator();
    const gain = clickAudioContext.createGain();
    oscillator.type = "triangle";
    oscillator.frequency.setValueAtTime(frequency, clickAudioContext.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(frequency * 1.6, clickAudioContext.currentTime + 0.07);
    gain.gain.setValueAtTime(0.0001, clickAudioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.075, clickAudioContext.currentTime + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, clickAudioContext.currentTime + 0.11);
    oscillator.connect(gain);
    gain.connect(clickAudioContext.destination);
    oscillator.start();
    oscillator.stop(clickAudioContext.currentTime + 0.12);
  } catch (error) {
    // Some browsers block WebAudio until the next user gesture; the UI still works.
  }
}

function initMusicPlayer() {
  if (!document.body.classList.contains("home-neon")) return;
  const grid = byId("trackGrid");
  const toggle = byId("musicToggle");
  const next = byId("musicNext");
  const volume = byId("musicVolume");
  const mood = byId("musicMood");
  const status = byId("musicStatus");
  if (!grid || !toggle || !next || !volume || !mood || !status) return;

  let activeTrack = Number(localStorage.getItem("hoangdaika13-track") || 0);
  let isPlaying = false;
  let timer = 0;
  let step = 0;

  const ensureEngine = () => {
    if (musicEngine) return musicEngine;
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) {
      status.textContent = "Mở bằng Chrome để phát nhạc";
      return null;
    }
    const ctx = new AudioCtx();
    const master = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 1450;
    master.gain.value = Number(volume.value) / 520;
    filter.connect(master);
    master.connect(ctx.destination);
    musicEngine = { ctx, master, filter };
    return musicEngine;
  };

  const updateTrackButtons = () => {
    grid.querySelectorAll(".track-button").forEach((button) => {
      button.classList.toggle("is-active", Number(button.dataset.track) === activeTrack);
    });
    status.textContent = isPlaying ? `Đang phát: ${ambientTracks[activeTrack].name}` : "Đang tắt";
  };

  const playNote = () => {
    if (!isPlaying) return;
    const engine = ensureEngine();
    if (!engine) return;
    const track = ambientTracks[activeTrack];
    const now = engine.ctx.currentTime;
    const moodValue = Number(mood.value) / 100;
    engine.master.gain.setTargetAtTime(Number(volume.value) / 500, now, 0.08);
    engine.filter.frequency.setTargetAtTime(700 + moodValue * 2400, now, 0.12);

    const degree = track.scale[step % track.scale.length];
    const bassDegree = track.scale[(step + 2) % track.scale.length] - 12;
    const notes = [degree, degree + 12, bassDegree];
    notes.forEach((semitone, index) => {
      const osc = engine.ctx.createOscillator();
      const gain = engine.ctx.createGain();
      osc.type = index === 2 ? "sine" : track.wave;
      osc.frequency.value = track.root * Math.pow(2, semitone / 12);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(index === 2 ? 0.07 : 0.048, now + 0.18);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 2.8);
      osc.connect(gain);
      gain.connect(engine.filter);
      osc.start(now);
      osc.stop(now + 3.05);
    });
    step += 1;
    timer = window.setTimeout(playNote, 1250 + (1 - moodValue) * 520);
  };

  const stopMusic = () => {
    isPlaying = false;
    window.clearTimeout(timer);
    toggle.textContent = "Phát nhạc";
    updateTrackButtons();
  };

  const startMusic = async () => {
    const engine = ensureEngine();
    if (!engine) return;
    if (engine.ctx.state === "suspended") await engine.ctx.resume();
    isPlaying = true;
    toggle.textContent = "Tạm dừng";
    updateTrackButtons();
    window.clearTimeout(timer);
    playNote();
  };

  const tryAutoplay = async () => {
    try {
      status.textContent = "Đang tự bật nhạc...";
      await startMusic();
    } catch {
      status.textContent = "Bấm bất kỳ nút nào để bật nhạc";
      const startAfterGesture = () => {
        document.removeEventListener("pointerdown", startAfterGesture);
        setTimeout(async () => {
          if (!isPlaying) await startMusic();
        }, 90);
      };
      document.addEventListener("pointerdown", startAfterGesture, { once: true });
    }
  };

  ambientTracks.forEach((track, index) => {
    const button = document.createElement("button");
    button.className = "track-button interactive";
    button.type = "button";
    button.dataset.track = String(index);
    button.innerHTML = `<strong>${String(index + 1).padStart(2, "0")}. ${track.name}</strong><span>${track.mood}</span>`;
    button.addEventListener("click", async () => {
      activeTrack = index;
      step = 0;
      localStorage.setItem("hoangdaika13-track", String(activeTrack));
      playClickSound(520 + index * 12);
      updateTrackButtons();
      if (isPlaying) {
        window.clearTimeout(timer);
        await startMusic();
      }
    });
    grid.appendChild(button);
  });

  toggle.addEventListener("click", async () => {
    playClickSound(760);
    if (isPlaying) stopMusic();
    else await startMusic();
  });

  next.addEventListener("click", async () => {
    activeTrack = (activeTrack + 1) % ambientTracks.length;
    step = 0;
    localStorage.setItem("hoangdaika13-track", String(activeTrack));
    playClickSound(680);
    updateTrackButtons();
    if (isPlaying) {
      window.clearTimeout(timer);
      await startMusic();
    }
  });

  volume.addEventListener("input", () => {
    localStorage.setItem("hoangdaika13-volume", volume.value);
    if (musicEngine) musicEngine.master.gain.setTargetAtTime(Number(volume.value) / 500, musicEngine.ctx.currentTime, 0.05);
  });

  mood.addEventListener("input", () => {
    localStorage.setItem("hoangdaika13-mood", mood.value);
  });

  volume.value = localStorage.getItem("hoangdaika13-volume") || volume.value;
  mood.value = localStorage.getItem("hoangdaika13-mood") || mood.value;
  updateTrackButtons();
  setTimeout(tryAutoplay, 700);
}

function initVoteStats() {
  if (!document.body.classList.contains("home-neon")) return;
  const statsKey = "hoangdaika13-vote-stats";
  const defaultStats = { likes: 0, votes: [0, 0, 0, 0, 0] };
  let cloudReady = false;
  const readStats = () => {
    try {
      return { ...defaultStats, ...JSON.parse(localStorage.getItem(statsKey) || "{}") };
    } catch {
      return { ...defaultStats };
    }
  };
  const writeStats = (stats) => localStorage.setItem(statsKey, JSON.stringify(stats));
  const normalizeStats = (stats) => ({
    likes: Number(stats?.likes || 0),
    votes: Array.from({ length: 5 }, (_, index) => Number(stats?.votes?.[index] || 0))
  });
  const fetchCloudStats = async () => {
    if (!CLOUD_VOTE_API) return null;
    const response = await fetch(CLOUD_VOTE_API, { cache: "no-store" });
    if (!response.ok) throw new Error("Vote API unavailable");
    return normalizeStats(await response.json());
  };
  const sendCloudVote = async (payload) => {
    if (!CLOUD_VOTE_API) return null;
    const response = await fetch(CLOUD_VOTE_API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    if (!response.ok) throw new Error("Vote API unavailable");
    return normalizeStats(await response.json());
  };
  const renderStats = () => {
    const stats = readStats();
    const totalVotes = stats.votes.reduce((sum, count) => sum + count, 0);
    const totalScore = stats.votes.reduce((sum, count, index) => sum + count * (index + 1), 0);
    const average = totalVotes ? (totalScore / totalVotes).toFixed(1) : "0.0";
    setText("likeCount", String(stats.likes));
    setText("voteCount", String(totalVotes));
    setText("averageRating", average);
    stats.votes.forEach((count, index) => {
      const rating = index + 1;
      setText(`ratingCount${rating}`, String(count));
      const bar = document.querySelector(`[data-rating-bar="${rating}"]`);
      if (bar) bar.style.setProperty("--bar", `${totalVotes ? Math.round((count / totalVotes) * 100) : 0}%`);
    });
  };
  const applyCloudStats = (stats) => {
    if (!stats) return;
    writeStats(normalizeStats(stats));
    renderStats();
  };
  const syncCloudStats = async () => {
    if (!CLOUD_VOTE_API) return;
    try {
      const stats = await fetchCloudStats();
      cloudReady = true;
      applyCloudStats(stats);
    } catch {
      cloudReady = false;
    }
  };

  const bootstrapStats = () => {
    const stats = readStats();
    if (localStorage.getItem("hoangdaika13-liked") === "yes" && localStorage.getItem("hoangdaika13-like-counted") !== "yes") {
      stats.likes += 1;
      localStorage.setItem("hoangdaika13-like-counted", "yes");
    }
    const savedRating = Number(localStorage.getItem("hoangdaika13-rating"));
    if (savedRating && localStorage.getItem("hoangdaika13-rating-counted") !== String(savedRating)) {
      const previous = Number(localStorage.getItem("hoangdaika13-rating-counted") || 0);
      if (previous) stats.votes[previous - 1] = Math.max(0, stats.votes[previous - 1] - 1);
      stats.votes[savedRating - 1] += 1;
      localStorage.setItem("hoangdaika13-rating-counted", String(savedRating));
    }
    writeStats(stats);
  };

  byId("likePageButton")?.addEventListener("click", () => {
    const likedNow = byId("likePageButton")?.classList.contains("is-liked");
    const counted = localStorage.getItem("hoangdaika13-like-counted") === "yes";
    const stats = readStats();
    if (likedNow && !counted) {
      stats.likes += 1;
      localStorage.setItem("hoangdaika13-like-counted", "yes");
    } else if (!likedNow && counted) {
      stats.likes = Math.max(0, stats.likes - 1);
      localStorage.setItem("hoangdaika13-like-counted", "no");
    }
    writeStats(stats);
    renderStats();
    sendCloudVote({ action: "like", liked: likedNow }).then(applyCloudStats).catch(() => {});
  });

  document.querySelectorAll("[data-rating]").forEach((button) => {
    button.addEventListener("click", () => {
      const rating = Number(button.dataset.rating);
      const previous = Number(localStorage.getItem("hoangdaika13-rating-counted") || 0);
      const stats = readStats();
      if (previous) stats.votes[previous - 1] = Math.max(0, stats.votes[previous - 1] - 1);
      stats.votes[rating - 1] += 1;
      localStorage.setItem("hoangdaika13-rating-counted", String(rating));
      writeStats(stats);
      renderStats();
      sendCloudVote({ action: "rating", rating, previous }).then(applyCloudStats).catch(() => {});
    });
  });

  bootstrapStats();
  renderStats();
  syncCloudStats();
  if (CLOUD_VOTE_API) setInterval(syncCloudStats, 10000);
}

function randomId() {
  if (window.crypto?.randomUUID) return window.crypto.randomUUID();
  return `anon-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function initPublicPresence() {
  if (!REALTIME_URL) return;
  const key = "hh-presence-id";
  let visitorId = localStorage.getItem(key);
  if (!visitorId) {
    visitorId = randomId();
    localStorage.setItem(key, visitorId);
  }
  const sendPresence = () => {
    if (document.hidden) return;
    const token = localStorage.getItem("hh-auth-token") || "";
    if (!token) return;
    fetch(`${REALTIME_URL}/api/platform/summary`, {
      method: "POST",
      keepalive: true,
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ visitorId, page: location.pathname + location.hash })
    }).catch(() => {});
  };
  sendPresence();
  setInterval(sendPresence, 45000);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) sendPresence(); });
}

function initPublicAuthPanel() {
  const gate = byId("authGate");
  const openButton = byId("authOpenButton");
  const loginForm = byId("gateLoginForm");
  const registerForm = byId("gateRegisterForm");
  const status = byId("authGateStatus");
  if (!gate || !openButton || !loginForm || !registerForm) return;

  const setStatus = (message) => { if (status) status.textContent = message; };
  const close = () => {
    document.body.classList.remove("auth-panel-open");
    gate.setAttribute("aria-hidden", "true");
  };
  openButton.addEventListener("click", () => {
    document.body.classList.add("auth-panel-open");
    gate.setAttribute("aria-hidden", "false");
    loginForm.querySelector("input[name=email]")?.focus();
  });
  gate.querySelector("[data-auth-close]")?.addEventListener("click", close);

  const authenticate = async (path, payload) => {
    if (!REALTIME_URL) throw new Error("Backend đăng nhập chưa được cấu hình.");
    const response = await fetch(`${REALTIME_URL}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "Không thể đăng nhập.");
    localStorage.setItem("hh-auth-token", data.token);
    localStorage.setItem("hh-auth-user", JSON.stringify(data.user || {}));
    localStorage.setItem("hh-chat-last-name", data.user?.name || data.user?.email || "Thành viên HH");
    window.dispatchEvent(new CustomEvent("hh:auth-change", { detail: { user: data.user, token: data.token } }));
    close();
    location.reload();
  };
  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = new FormData(loginForm);
    try { setStatus("Đang đăng nhập..."); await authenticate("/api/auth/login", { email: form.get("email"), password: form.get("password") }); }
    catch (error) { setStatus(error.message); }
  });
  registerForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = new FormData(registerForm);
    try { setStatus("Đang tạo tài khoản..."); await authenticate("/api/auth/register", { name: form.get("name"), email: form.get("email"), password: form.get("password"), consent: form.get("consent") === "on" }); }
    catch (error) { setStatus(error.message); }
  });
}

function initRealtimeAuth() {
  if (!document.body.classList.contains("home-neon")) return;
  const status = byId("authStatus");
  const online = byId("onlineCount");
  const note = byId("realtimeNote");
  const consent = byId("trackingConsent");
  const registerForm = byId("registerForm");
  const loginForm = byId("loginForm");
  const gate = byId("authGate");
  const gateStatus = byId("authGateStatus");
  const gateRegisterForm = byId("gateRegisterForm");
  const gateLoginForm = byId("gateLoginForm");
  const logoutButton = byId("logoutButton");
  const authOpenButton = byId("authOpenButton");
  const oauthButtons = [...document.querySelectorAll("[data-oauth-provider]")];
  if (!status || !online || !note || !consent) return;

  let token = localStorage.getItem("hh-auth-token") || "";
  let user = null;
  let oauthProviders = null;
  const anonymousIdKey = "hh-anonymous-id";
  let anonymousId = localStorage.getItem(anonymousIdKey);
  if (!anonymousId) {
    anonymousId = randomId();
    localStorage.setItem(anonymousIdKey, anonymousId);
  }

  const params = new URLSearchParams(location.search);
  const oauthError = params.get("authError");
  if (params.get("authToken")) {
    token = params.get("authToken");
    localStorage.setItem("hh-auth-token", token);
    history.replaceState({}, document.title, `${location.pathname}#/home`);
  } else if (oauthError) {
    history.replaceState({}, document.title, `${location.pathname}${location.hash || ""}`);
  }

  consent.checked = localStorage.getItem("hh-tracking-consent") === "yes";
  consent.addEventListener("change", () => {
    localStorage.setItem("hh-tracking-consent", consent.checked ? "yes" : "no");
    connectSocket();
  });

  const setStatus = (message) => {
    status.textContent = message;
    if (gateStatus) gateStatus.textContent = message;
  };

  const selectAuthPanel = (panelName) => {
    gate?.querySelectorAll("[data-auth-tab]").forEach((tab) => {
      const active = tab.dataset.authTab === panelName;
      tab.classList.toggle("active", active);
      tab.setAttribute("aria-selected", String(active));
    });
    gate?.querySelectorAll("[data-auth-panel]").forEach((panel) => {
      panel.hidden = panel.dataset.authPanel !== panelName;
    });
    gateStatus?.classList.remove("is-error", "is-success");
  };

  const setFormBusy = (formNode, busy) => {
    const submit = formNode?.querySelector('button[type="submit"]');
    if (!submit) return;
    const label = submit.querySelector("span") || submit;
    if (!submit.dataset.idleLabel) submit.dataset.idleLabel = label.textContent.trim();
    submit.disabled = busy;
    submit.setAttribute("aria-busy", String(busy));
    label.textContent = busy ? "Đang xử lý..." : submit.dataset.idleLabel;
  };

  const setGateState = () => {
    const authenticated = Boolean(user && token);
    document.body.classList.toggle("auth-unlocked", authenticated);
    document.body.classList.toggle("auth-locked", !authenticated);
    document.body.classList.toggle("auth-authenticated", authenticated);
    if (authenticated) document.body.classList.remove("auth-panel-open");
    gate?.setAttribute("aria-hidden", String(authenticated));
    if (authOpenButton) authOpenButton.hidden = authenticated;
  };

  const persistAuthUser = () => {
    if (user) {
      localStorage.setItem("hh-auth-user", JSON.stringify(user));
      localStorage.setItem("hh-chat-last-name", user.name || user.email || "Khách HH");
    } else {
      localStorage.removeItem("hh-auth-user");
    }
    window.dispatchEvent(new CustomEvent("hh:auth-change", { detail: { user, token } }));
  };

  const api = async (path, options = {}) => {
    if (!REALTIME_URL) throw new Error("Chưa cấu hình realtime backend.");
    const response = await fetch(`${REALTIME_URL}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options.headers || {})
      }
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "Lỗi kết nối backend.");
    return data;
  };

  const updateOAuthButtons = () => {
    oauthButtons.forEach((button) => {
      const provider = button.dataset.oauthProvider;
      const enabled = Boolean(REALTIME_URL && oauthProviders?.[provider]);
      button.disabled = !enabled;
      button.title = enabled ? `Đăng nhập bằng ${provider === "google" ? "Google" : "Facebook"}` : `${provider === "google" ? "Google" : "Facebook"} chưa được cấu hình trên Vercel`;
    });
  };

  const loadOAuthProviders = async () => {
    if (!REALTIME_URL) return updateOAuthButtons();
    try {
      const response = await fetch(`${REALTIME_URL}/api/auth/providers`, { cache: "no-store" });
      oauthProviders = response.ok ? await response.json() : {};
    } catch { oauthProviders = {}; }
    updateOAuthButtons();
  };

  const renderAuth = () => {
    if (user) {
      setStatus(`Đã đăng nhập: ${user.name || user.email}`);
    } else if (oauthError) {
      setStatus(oauthError);
    } else if (token && REALTIME_URL) {
      setStatus("Đang kiểm tra tài khoản...");
    } else {
      setStatus("Chưa đăng nhập");
    }
    note.textContent = REALTIME_URL
      ? "Realtime backend đã cấu hình. Tracking chỉ chạy khi người dùng đồng ý hoặc đăng nhập."
      : "Chưa cấu hình realtime backend. Sau khi deploy server, dán URL vào config.js.";
    updateOAuthButtons();
    setGateState();
    persistAuthUser();
  };

  const loadMe = async () => {
    if (!token || !REALTIME_URL) return renderAuth();
    try {
      const data = await api("/api/auth/me");
      user = data.user;
      if (!user) {
        token = "";
        localStorage.removeItem("hh-auth-token");
      }
    } catch {
      localStorage.removeItem("hh-auth-token");
      token = "";
      user = null;
    }
    renderAuth();
  };

  const handleRegister = async (event, formNode) => {
    event.preventDefault();
    const form = new FormData(formNode);
    if (form.has("confirmPassword") && form.get("password") !== form.get("confirmPassword")) {
      setStatus("Mật khẩu xác nhận chưa khớp.");
      gateStatus?.classList.add("is-error");
      formNode.querySelector('[name="confirmPassword"]')?.focus();
      return;
    }
    try {
      setFormBusy(formNode, true);
      setStatus("Đang tạo tài khoản...");
      const data = await api("/api/auth/register", {
        method: "POST",
        body: JSON.stringify({
          name: form.get("name"),
          email: form.get("email"),
          password: form.get("password"),
          consent: form.get("consent") === "on"
        })
      });
      token = data.token;
      user = data.user;
      localStorage.setItem("hh-auth-token", token);
      consent.checked = Boolean(user?.consent);
      localStorage.setItem("hh-tracking-consent", consent.checked ? "yes" : "no");
      renderAuth();
      connectSocket();
      formNode.reset();
      gateStatus?.classList.add("is-success");
      location.hash = "#/home";
    } catch (error) {
      setStatus(error.message);
      gateStatus?.classList.add("is-error");
    } finally {
      setFormBusy(formNode, false);
    }
  };

  const handleLogin = async (event, formNode) => {
    event.preventDefault();
    const form = new FormData(formNode);
    try {
      setFormBusy(formNode, true);
      setStatus("Đang đăng nhập...");
      const data = await api("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email: form.get("email"), password: form.get("password") })
      });
      token = data.token;
      user = data.user;
      localStorage.setItem("hh-auth-token", token);
      renderAuth();
      connectSocket();
      formNode.reset();
      gateStatus?.classList.add("is-success");
      location.hash = "#/home";
    } catch (error) {
      setStatus(error.message);
      gateStatus?.classList.add("is-error");
    } finally {
      setFormBusy(formNode, false);
    }
  };

  registerForm?.addEventListener("submit", (event) => handleRegister(event, registerForm));
  gateRegisterForm?.addEventListener("submit", (event) => handleRegister(event, gateRegisterForm));
  loginForm?.addEventListener("submit", (event) => handleLogin(event, loginForm));
  gateLoginForm?.addEventListener("submit", (event) => handleLogin(event, gateLoginForm));
  gate?.querySelectorAll("[data-auth-tab]").forEach((tab) => tab.addEventListener("click", () => selectAuthPanel(tab.dataset.authTab)));
  gate?.querySelectorAll("[data-password-toggle]").forEach((button) => button.addEventListener("click", () => {
    const input = button.parentElement?.querySelector("input");
    if (!input) return;
    const reveal = input.type === "password";
    input.type = reveal ? "text" : "password";
    button.textContent = reveal ? "Ẩn" : "Hiện";
    button.setAttribute("aria-label", reveal ? "Ẩn mật khẩu" : "Hiện mật khẩu");
  }));
  gate?.querySelector("[data-register-password]")?.addEventListener("input", (event) => {
    const value = event.target.value;
    const score = [value.length >= 15, /[a-zà-ỹ]/.test(value), /[A-ZÀ-Ỹ]/.test(value), /\d/.test(value), /[^A-Za-zÀ-ỹ\d]/.test(value)].filter(Boolean).length;
    const meter = gate.querySelector("[data-password-strength]");
    if (!meter) return;
    meter.dataset.score = String(score);
    const label = meter.querySelector("span");
    if (label) label.textContent = ["Độ mạnh mật khẩu", "Rất yếu", "Yếu", "Trung bình", "Mạnh", "Rất mạnh"][score];
  });

  oauthButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const provider = button.dataset.oauthProvider;
      if (!REALTIME_URL) return setStatus("Backend đăng nhập chưa được cấu hình.");
      location.assign(`${REALTIME_URL}/api/auth/${provider}?returnTo=${encodeURIComponent(location.origin)}`);
    });
  });

  logoutButton?.addEventListener("click", async () => {
    await revokeCurrentSession();
    token = "";
    user = null;
    localStorage.removeItem("hh-auth-token");
    localStorage.removeItem("hh-auth-user");
    localStorage.removeItem("hh-chat-last-name");
    localStorage.removeItem("hh-community-center");
    Object.keys(localStorage).filter((key) => key.startsWith("hh-community-center:")).forEach((key) => localStorage.removeItem(key));
    sessionStorage.removeItem("hh-auth-return-to");
    if (socket) {
      socket.disconnect();
      socket = null;
      window.HHRealtimeSocket = null;
      window.dispatchEvent(new CustomEvent("hh:realtime-offline"));
    }
    renderAuth();
    location.hash = "";
  });

  let socket;
  const loadSocketClient = () => new Promise((resolve, reject) => {
    if (window.io) return resolve();
    if (!SOCKET_URL) return reject(new Error("No realtime URL"));
    const script = document.createElement("script");
    script.src = `${SOCKET_URL}/socket.io/socket.io.js`;
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });

  async function connectSocket() {
    if (socket) {
      socket.disconnect();
      socket = null;
      window.HHRealtimeSocket = null;
    }
    if (!SOCKET_URL) {
      online.textContent = "0 đang online";
      return;
    }
    try {
      await loadSocketClient();
      socket = window.io(SOCKET_URL, {
        transports: ["websocket", "polling"],
        auth: {
          token,
          anonymousId,
          consent: consent.checked,
          page: location.pathname,
          referrer: document.referrer
        }
      });
      window.HHRealtimeSocket = socket;
      socket.on("connect", () => {
        window.HHRealtimeSocket = socket;
        window.dispatchEvent(new CustomEvent("hh:realtime-ready", { detail: { socket } }));
      });
      socket.on("disconnect", () => {
        window.dispatchEvent(new CustomEvent("hh:realtime-offline"));
      });
      socket.on("site:stats", (stats) => {
        online.textContent = `${Number(stats.online || 0)} đang online`;
      });
      socket.emit("page:event", { type: "page:view", path: location.pathname, detail: { title: document.title } });
    } catch {
      note.textContent = "Không kết nối được realtime backend.";
    }
  }

  renderAuth();
  loadOAuthProviders();
  loadMe().then(connectSocket);
}

function initPlatformLivebar() {
  if (!document.body.classList.contains("home-neon")) return;
  const timeNode = byId("platformClockTime");
  const dateNode = byId("platformClockDate");
  const searchForm = byId("googleLiveSearch");
  const searchInput = byId("googleLiveQuery");

  const updateClock = () => {
    const now = new Date();
    const time = now.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    const date = now.toLocaleDateString("vi-VN", { weekday: "long", day: "2-digit", month: "2-digit", year: "numeric" });
    if (timeNode) timeNode.textContent = time;
    if (dateNode) dateNode.textContent = `${date} · Múi giờ ${Intl.DateTimeFormat().resolvedOptions().timeZone || "local"}`;
    document.querySelectorAll("[data-command-time]").forEach((node) => { node.textContent = time; });
    document.querySelectorAll("[data-command-date]").forEach((node) => { node.textContent = date; });
    document.querySelectorAll("[data-module-now]").forEach((node) => {
      node.textContent = time;
    });
  };

  searchForm?.addEventListener("submit", (event) => {
    event.preventDefault();
    const query = (searchInput?.value || "").trim() || "tin tức công nghệ AI hôm nay";
    if (window.HHSearchWatch?.open) window.HHSearchWatch.open("google", query);
    else window.open(`https://www.google.com/search?q=${encodeURIComponent(query)}`, "_blank", "noopener");
  });

  updateClock();
  setInterval(updateClock, 1000);
}

function initSuperPlatform() {
  if (!document.body.classList.contains("home-neon")) return;
  const grid = byId("moduleGrid");
  if (!grid) return;

  let modules = Array.isArray(window.HH_PLATFORM_MODULES) ? window.HH_PLATFORM_MODULES : [];
  const filters = document.querySelectorAll("[data-module-filter]");
  const search = byId("moduleSearch");
  const total = byId("moduleTotal");
  const core = byId("moduleCore");
  const backend = byId("moduleBackend");
  const detailTitle = byId("moduleDetailTitle");
  const detailDescription = byId("moduleDetailDescription");
  const detailMeta = byId("moduleDetailMeta");
  const detailFeatures = byId("moduleDetailFeatures");
  const toolGrid = byId("moduleToolGrid");
  const itemTitle = byId("moduleItemTitle");
  const actionMode = byId("moduleActionMode");
  const statusField = byId("moduleStatusField");
  const demoInput = byId("moduleDemoInput");
  const demoOutput = byId("moduleDemoOutput");
  const runDemo = byId("runModuleDemo");
  const saveState = byId("saveModuleState");
  const loadHistory = byId("loadModuleHistory");
  const exportData = byId("exportModuleData");
  const copyOutput = byId("copyModuleOutput");
  const itemList = byId("moduleItemList");
  const favoritesKey = "hh-platform-favorites";
  const stateKey = "hh-platform-module-state";
  let activeFilter = "all";
  let selectedModule = null;
  let favorites = JSON.parse(localStorage.getItem(favoritesKey) || "[]");

  const setCounter = (node, value) => {
    if (node) node.textContent = String(value).padStart(2, "0");
  };

  const persistFavorites = () => localStorage.setItem(favoritesKey, JSON.stringify(favorites));
  const textOf = (module) => `${module.title} ${module.description} ${(module.features || []).join(" ")}`.toLowerCase();
  const escapeHtml = (value) => String(value || "").replace(/[<>&"']/g, (char) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "\"": "&quot;", "'": "&#39;" }[char]));
  const readPlatformState = () => {
    try {
      return JSON.parse(localStorage.getItem(stateKey) || "{}");
    } catch {
      return {};
    }
  };
  const writePlatformState = (state) => localStorage.setItem(stateKey, JSON.stringify(state));
  const moduleStateFor = (moduleId) => readPlatformState()[moduleId] || {};
  const commandCenterKey = "hh-command-center-state";
  const commandTodoKey = "hh.command-center.todos.v2";
  const commandNotesKey = "hh.dashboard.sticky-notes.v1";
  const commandActivityKey = "hh.command-center.activity.v1";

  const readCommandCenterState = () => {
    const fallback = {
      notes: "Viết nhanh ý tưởng, lịch làm việc hoặc việc cần nhớ tại đây.",
      todos: [
        { text: "Kiểm tra tin nhắn mới", done: false },
        { text: "Cập nhật dự án nổi bật", done: false },
        { text: "Sao lưu dữ liệu quan trọng", done: true }
      ],
      activity: []
    };
    try {
      const legacy = JSON.parse(localStorage.getItem(commandCenterKey) || "{}");
      const homeTodos = JSON.parse(localStorage.getItem(commandTodoKey) || "null");
      const stickyNotes = JSON.parse(localStorage.getItem(commandNotesKey) || "null");
      const homeActivity = JSON.parse(localStorage.getItem(commandActivityKey) || "null");
      const primaryNote = Array.isArray(stickyNotes) ? ([...stickyNotes].sort((a, b) => Number(Boolean(b.pinned)) - Number(Boolean(a.pinned)))[0] || null) : null;
      return {
        ...fallback,
        ...legacy,
        noteId: primaryNote?.id || "",
        notes: primaryNote?.text ?? legacy.notes ?? fallback.notes,
        todos: Array.isArray(homeTodos) ? homeTodos.map((todo) => ({ ...todo, text: todo.title || todo.text || "", done: Boolean(todo.completed ?? todo.done) })) : (legacy.todos || fallback.todos),
        activity: Array.isArray(homeActivity) ? homeActivity.map((item) => typeof item === "string" ? item : `${new Date(item.time || Date.now()).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })} · ${item.action || "Hoạt động Command Center"}`) : (legacy.activity || [])
      };
    } catch { return fallback; }
  };

  const writeCommandCenterState = (state) => {
    localStorage.setItem(commandCenterKey, JSON.stringify(state));
    if (Array.isArray(state.todos)) {
      localStorage.setItem(commandTodoKey, JSON.stringify(state.todos.map((todo, index) => ({
        ...todo,
        id: todo.id || `todo-${Date.now()}-${index}`,
        title: todo.title || todo.text || "Công việc",
        priority: todo.priority || "medium",
        category: todo.category || "Command Center",
        deadline: todo.deadline || "",
        reminder: todo.reminder || "",
        repeat: todo.repeat || "none",
        completed: Boolean(todo.done ?? todo.completed),
        createdAt: todo.createdAt || Date.now()
      }))));
    }
    if (typeof state.notes === "string") {
      let sticky = [];
      try { sticky = JSON.parse(localStorage.getItem(commandNotesKey) || "[]"); } catch {}
      if (!Array.isArray(sticky)) sticky = [];
      const index = sticky.findIndex((note) => note.id === state.noteId) >= 0 ? sticky.findIndex((note) => note.id === state.noteId) : 0;
      if (sticky[index]) sticky[index] = { ...sticky[index], text: state.notes, updatedAt: Date.now() };
      else sticky.push({ id: `note-${Date.now()}`, text: state.notes, color: "#75f2d0", x: 20, y: 20, rotate: 0, pinned: true, tags: "command-center", reminder: "", updatedAt: Date.now() });
      localStorage.setItem(commandNotesKey, JSON.stringify(sticky));
    }
    if (Array.isArray(state.activity)) {
      localStorage.setItem(commandActivityKey, JSON.stringify(state.activity.slice(0, 30).map((item, index) => typeof item === "string" ? { id: `command-${Date.now()}-${index}`, action: item.replace(/^\d{1,2}:\d{2}\s*·\s*/, ""), icon: "C", color: "#5ce8f2", time: Date.now() - index * 1000 } : item)));
    }
    window.dispatchEvent(new CustomEvent("hh:command-center-sync"));
  };

  const moduleProfiles = {
    "ai-center": { verb: "Tạo prompt", subject: "AI workflow", sample: "Viết prompt tối ưu cho video YouTube 40+ về một câu chuyện gia đình cảm động.", metrics: ["Prompt", "History", "Model"], items: ["Prompt rewrite cảm xúc", "Prompt title YouTube", "Prompt tóm tắt nhanh"] },
    "download-center": { verb: "Tạo gói tải", subject: "download pack", sample: "HH Voice Studio bản Lite, version 3.1, changelog mới nhất.", metrics: ["Files", "Version", "Rating"], items: ["Windows Lite", "Portable ZIP", "Full Google Drive"] },
    "media-center": { verb: "Tạo playlist", subject: "media set", sample: "Playlist nhạc nền nhẹ nhàng cho portfolio neon.", metrics: ["Videos", "Images", "Playlist"], items: ["Short intro", "Gallery neon", "Music ambient"] },
    "project-center": { verb: "Lập roadmap", subject: "project plan", sample: "Nâng cấp website cá nhân, chat app, AI tools và voice studio.", metrics: ["Progress", "Bugs", "Demo"], items: ["Trang chủ neon", "HH Chat", "AI Script Tool"] },
    "knowledge-center": { verb: "Tạo bài wiki", subject: "knowledge note", sample: "Ghi chú cách deploy GitHub Pages + Vercel backend + MongoDB.", metrics: ["Articles", "Tags", "Bookmarks"], items: ["GitHub Pages", "MongoDB", "Vercel API"] },
    "learning-center": { verb: "Tạo bài học", subject: "lesson", sample: "Lộ trình học HTML/CSS/JS để tự nâng cấp web cá nhân.", metrics: ["Courses", "Quiz", "Progress"], items: ["HTML layout", "CSS neon", "JS localStorage"] },
    community: { verb: "Tạo chủ đề", subject: "community post", sample: "Chủ đề góp ý cho HH Community Chat.", metrics: ["Posts", "Reactions", "Users"], items: ["Forum", "Comments", "Leaderboard"] },
    "user-dashboard": { verb: "Lưu hồ sơ", subject: "user profile", sample: "Avatar, nickname, link dự án yêu thích và hoạt động gần đây.", metrics: ["Saved", "Favorites", "Activity"], items: ["Profile", "Settings", "Notifications"] },
    "admin-panel": { verb: "Tạo audit", subject: "admin task", sample: "Kiểm tra users, logs, database monitor và backup hôm nay.", metrics: ["Users", "Logs", "Backup"], items: ["User Manager", "Content Manager", "Database Monitor"] },
    "ai-automation": { verb: "Tự động hóa", subject: "AI automation", sample: "Tạo title, mô tả, tag, tóm tắt và thumbnail prompt.", metrics: ["Title", "Tags", "Summary"], items: ["Auto Title", "Auto Tags", "Auto Thumbnail"] },
    "creator-studio": { verb: "Tạo nội dung", subject: "creator asset", sample: "Video idea + SEO score + hashtags cho kênh kể chuyện.", metrics: ["SEO", "Scripts", "Hashtags"], items: ["Thumbnail", "Video Manager", "Script"] },
    analytics: { verb: "Tạo báo cáo", subject: "analytics report", sample: "Traffic hôm nay, thiết bị truy cập, lượt tải và AI usage.", metrics: ["Traffic", "Downloads", "Charts"], items: ["Devices", "Countries", "AI Usage"] },
    store: { verb: "Tạo sản phẩm", subject: "store item", sample: "Digital product: HH Voice Studio Full, coupon giảm giá, membership.", metrics: ["Products", "Orders", "Coupons"], items: ["Digital Product", "Membership", "Checkout"] },
    "cloud-storage": { verb: "Tạo file record", subject: "cloud file", sample: "File ZIP dự án, link share, folder và preview.", metrics: ["Files", "Folders", "Shares"], items: ["Upload", "Preview", "Recent Files"] },
    "notification-center": { verb: "Soạn thông báo", subject: "notification", sample: "Thông báo cập nhật website qua email, push, Discord, Telegram.", metrics: ["Email", "Push", "In-app"], items: ["Discord", "Telegram", "Email"] },
    "api-center": { verb: "Tạo API doc", subject: "API endpoint", sample: "Endpoint /api/modules/:id/items với ví dụ request/response.", metrics: ["Docs", "Keys", "Logs"], items: ["Playground", "Examples", "API Key"] },
    "developer-hub": { verb: "Tạo release", subject: "dev release", sample: "Release v15: nâng cấp toàn bộ module dashboard.", metrics: ["Git", "Releases", "CI/CD"], items: ["Changelog", "Packages", "Deploy"] },
    "security-center": { verb: "Kiểm tra bảo mật", subject: "security audit", sample: "Login history, sessions, devices, permissions và audit logs.", metrics: ["Sessions", "Devices", "2FA"], items: ["Permissions", "Audit Logs", "Login History"] },
    "smart-search": { verb: "Tìm toàn site", subject: "search query", sample: "Tìm dự án voice, AI script, downloads, settings và chat.", metrics: ["Projects", "Files", "Users"], items: ["AI", "Downloads", "Settings"] },
    "app-launcher": { verb: "Tạo shortcut", subject: "app shortcut", sample: "Shortcut mở AI Script, HH Voice Studio, Chat, GitHub, Drive.", metrics: ["Favorites", "Recent", "Categories"], items: ["AI Script", "Voice Studio", "GitHub"] },
    "widgets-engine": { verb: "Tạo widget", subject: "widget layout", sample: "Widget clock, weather, notes, todo, visitor counter.", metrics: ["Widgets", "Pinned", "Layout"], items: ["Drag Drop", "Resize", "Save Layout"] },
    marketplace: { verb: "Tạo listing", subject: "market item", sample: "Plugin neon theme, AI agent, script extension.", metrics: ["Plugins", "Themes", "Agents"], items: ["Extensions", "Scripts", "AI Agents"] },
    "mobile-pwa": { verb: "Tạo PWA checklist", subject: "PWA task", sample: "Responsive, installable, offline cache, sync data.", metrics: ["Mobile", "Offline", "Install"], items: ["Manifest", "Service Worker", "Sync"] },
    "modern-ui-kit": { verb: "Tạo UI kit", subject: "UI component", sample: "Glass neon button, command palette, dock nav, mega menu.", metrics: ["Components", "Motion", "Theme"], items: ["Command Palette", "Dock", "FAB"] },
    i18n: { verb: "Dịch giao diện", subject: "locale pack", sample: "Dịch trang sang tiếng Việt/English và lưu theo user.", metrics: ["Locales", "RTL", "Saved"], items: ["VI", "EN", "RTL"] },
    "accessibility-center": { verb: "Tạo preset", subject: "accessibility preset", sample: "Tăng chữ, tương phản cao, keyboard navigation.", metrics: ["Font", "Contrast", "Keyboard"], items: ["Screen-reader", "High Contrast", "Focus"] },
    gamification: { verb: "Tạo huy hiệu", subject: "game reward", sample: "XP, streak, badge cho người dùng hoạt động nhiều.", metrics: ["XP", "Badges", "Streak"], items: ["Leaderboard", "Daily Quest", "Reward"] },
    "onboarding-tour": { verb: "Tạo tour", subject: "tour step", sample: "Hướng dẫn người dùng mới qua profile, projects, chat, downloads.", metrics: ["Steps", "Progress", "Skipped"], items: ["Highlight", "Next", "Finish"] },
    "feedback-survey": { verb: "Tạo khảo sát", subject: "survey", sample: "NPS, góp ý nhanh, popup feedback cho khách ghé thăm.", metrics: ["NPS", "Responses", "Score"], items: ["Survey", "Popup", "Feedback"] },
    "helpdesk-ticketing": { verb: "Tạo ticket", subject: "support ticket", sample: "Ticket hỗ trợ tải tool hoặc báo lỗi website.", metrics: ["Open", "Pending", "Closed"], items: ["Assign", "History", "Status"] },
    "status-page": { verb: "Tạo sự cố", subject: "status update", sample: "Uptime backend, lịch bảo trì, sự cố đang xử lý.", metrics: ["Uptime", "Incidents", "Maintenance"], items: ["Operational", "Degraded", "Resolved"] },
    "feature-flag-dashboard": { verb: "Tạo flag", subject: "feature flag", sample: "Bật/tắt chat V2, neon boost, module studio, music player.", metrics: ["Flags", "Enabled", "A/B"], items: ["Runtime", "Experiment", "Rollout"] },
    "cookie-consent-manager": { verb: "Tạo consent", subject: "privacy rule", sample: "Cho phép vote, analytics, localStorage, notification.", metrics: ["Consent", "Cookies", "Privacy"], items: ["Necessary", "Analytics", "Marketing"] },
    "data-export-import": { verb: "Tạo backup", subject: "backup pack", sample: "Export/import localStorage, notes, todos, favorites, chat profile.", metrics: ["Export", "Import", "Backup"], items: ["JSON", "Restore", "Local Data"] },
    "referral-affiliate": { verb: "Tạo chiến dịch", subject: "referral campaign", sample: "Mã giới thiệu HH2026, lượt click, hoa hồng dự kiến.", metrics: ["Clicks", "Leads", "Commission"], items: ["Referral Code", "Campaign", "Payout"] },
    "wishlist-compare": { verb: "Tạo so sánh", subject: "compare list", sample: "So sánh bản Lite/Full, wishlist download và store.", metrics: ["Wishlist", "Compare", "Saved"], items: ["Lite", "Full", "Download"] },
    "team-collaboration": { verb: "Tạo công việc", subject: "team task", sample: "Phân công nâng cấp Community cho thành viên trong nhóm.", metrics: ["Tasks", "Members", "Done"], items: ["Board", "Comments", "Activity"] },
    "form-builder": { verb: "Tạo biểu mẫu", subject: "smart form", sample: "Biểu mẫu đăng ký dùng thử HH Voice Studio.", metrics: ["Fields", "Responses", "Export"], items: ["Text", "Choice", "Rating"] },
    "workflow-automation": { verb: "Tạo workflow", subject: "automation flow", sample: "Khi có feedback mới, lưu dữ liệu và tạo thông báo.", metrics: ["Triggers", "Actions", "Runs"], items: ["Condition", "Delay", "History"] }
  };

  const profileFor = (module) => moduleProfiles[module.id] || {
    verb: "Tạo mục",
    subject: module.title,
    sample: `Tạo dữ liệu mẫu cho ${module.title}.`,
    metrics: (module.features || []).slice(0, 3),
    items: (module.features || []).slice(0, 3)
  };

  const commandTodoMarkup = (todo, index) => `<label style="--todo-color:${todo.priority === "high" ? "#ff6688" : todo.priority === "low" ? "#62e6b0" : "#ffc75c"}"><input type="checkbox" data-command-toggle-todo="${index}" ${todo.done ? "checked" : ""}><span><strong>${escapeHtml(todo.text)}</strong><small>${escapeHtml(todo.category || "Command Center")} · ${todo.deadline ? new Date(`${todo.deadline}T12:00:00`).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" }) : "Không deadline"}</small></span><button class="interactive" type="button" data-command-remove-todo="${index}" aria-label="Xóa">×</button></label>`;

  const commandCenterMarkup = () => {
    const state = readCommandCenterState();
    let cachedWeather = null;
    let authUser = {};
    try { cachedWeather = JSON.parse(localStorage.getItem("hh.dashboard.weather.v1") || "null"); } catch {}
    try { authUser = JSON.parse(localStorage.getItem("hh-auth-user") || "{}"); } catch {}
    const currentWeather = cachedWeather?.payload?.weather?.current || {};
    const currentAir = cachedWeather?.payload?.air?.current || {};
    const weatherLocation = cachedWeather?.location?.name || "Hà Nội";
    const todos = state.todos || [];
    const completed = todos.filter((todo) => todo.done).length;
    const progress = todos.length ? Math.round(completed / todos.length * 100) : 0;
    let stickyCount = 0;
    try { stickyCount = JSON.parse(localStorage.getItem(commandNotesKey) || "[]").length || 0; } catch {}
    const userName = authUser.name || "Thành viên HH";
    const initials = userName.split(/\s+/).filter(Boolean).slice(-2).map((part) => part[0]).join("").toUpperCase() || "HH";
    const weatherReady = Number.isFinite(currentWeather.temperature_2m);
    return `
      <section class="command-center-app command-center-app--aurora" data-command-center>
        <div class="command-hero command-hero--aurora">
          <div class="command-hero__copy">
            <p class="section-kicker"><i></i> COMMAND CENTER 01 · SYNCED</p>
            <h4>Điều hành ngày mới<br><em>trong một không gian.</em></h4>
            <span>Đồng bộ trực tiếp với Trang chủ: thời tiết, Sticky Notes, Todo, hoạt động và trạng thái hệ thống.</span>
            <div class="command-hero__profile"><b>${authUser.avatar ? `<img src="${escapeHtml(authUser.avatar)}" alt="">` : escapeHtml(initials)}</b><div><strong>${escapeHtml(userName)}</strong><small>${completed}/${todos.length} công việc hoàn thành</small></div><span class="command-sync-badge"><i></i> Realtime local sync</span></div>
          </div>
          <div class="command-clock">
            <strong data-command-time>--:--:--</strong>
            <span data-command-date>Đang đồng bộ...</span>
            <small>${weatherReady ? `${Math.round(currentWeather.temperature_2m)}°C · ${escapeHtml(weatherLocation)}` : "Weather đang đồng bộ"}</small>
          </div>
        </div>
        <div class="command-overview">
          <article><i>✓</i><div><span>Tiến độ hôm nay</span><strong data-command-overview-progress>${progress}%</strong><small data-command-overview-remaining>${todos.length - completed} việc còn lại</small></div><b><u data-command-overview-bar style="width:${progress}%"></u></b></article>
          <article><i>N</i><div><span>Sticky Notes</span><strong>${stickyCount}</strong><small>Tự động lưu</small></div><b><u style="width:${Math.min(100, stickyCount * 18)}%"></u></b></article>
          <article><i>◉</i><div><span>Trạng thái</span><strong>${navigator.onLine ? "Online" : "Offline"}</strong><small>${navigator.onLine ? "Kết nối ổn định" : "Đang dùng cache"}</small></div><b><u style="width:${navigator.onLine ? 100 : 25}%"></u></b></article>
          <article><i>✦</i><div><span>Hoạt động</span><strong>${(state.activity || []).length}</strong><small>Lịch sử gần đây</small></div><b><u style="width:${Math.min(100, (state.activity || []).length * 8)}%"></u></b></article>
        </div>
        <div class="command-grid">
          <article class="command-widget command-widget--wide weather-widget">
            <header><div><small>LIVE WEATHER</small><strong>Thời tiết & chất lượng không khí</strong></div><button class="interactive" type="button" data-command-weather>↻ Làm mới</button></header>
            <div class="weather-readout command-weather-readout" data-command-weather-output>
              ${weatherReady ? `<div class="command-weather-main"><i>${currentWeather.is_day ? "☀" : "☾"}</i><div><strong>${Math.round(currentWeather.temperature_2m)}°C</strong><span>${escapeHtml(weatherLocation)} · Cảm giác ${Math.round(currentWeather.apparent_temperature || currentWeather.temperature_2m)}°</span></div></div><div class="command-weather-metrics"><span><b>${Math.round(currentWeather.relative_humidity_2m || 0)}%</b>Độ ẩm</span><span><b>${Math.round(currentWeather.wind_speed_10m || 0)} km/h</b>Gió</span><span><b>AQI ${Math.round(currentAir.us_aqi || 0)}</b>Không khí</span><span><b>${Math.round(currentWeather.surface_pressure || 0)} hPa</b>Áp suất</span></div>` : `<div class="command-widget-empty"><i>☁</i><span>Chọn “Làm mới” để tải thời tiết hiện tại.</span></div>`}
            </div>
          </article>
          <article class="command-widget command-google-widget">
            <header><div><small>QUICK ACCESS</small><strong>Google Hub</strong></div><button class="interactive" type="button" data-search-watch-open="google">Mở Hub</button></header>
            <form class="command-search-form" data-command-google-form><input data-command-search type="search" placeholder="Tìm trên Google..."><button class="interactive" type="submit" data-command-google aria-label="Tìm kiếm">⌕</button></form>
            <div class="command-mini-links command-app-links">
              ${[["Gmail","M","https://mail.google.com/"],["Drive","D","https://drive.google.com/"],["Calendar","C","https://calendar.google.com/"],["YouTube","▶","https://youtube.com/"],["Gemini","✦","https://gemini.google.com/"],["Maps","M","https://maps.google.com/"]].map(([label,icon,url]) => `<a href="${url}" target="_blank" rel="noopener"><i>${icon}</i><span>${label}</span></a>`).join("")}
            </div>
          </article>
          <article class="command-widget notes-widget">
            <header><div><small>SYNCED NOTES</small><strong>Ghi chú đang ghim</strong></div><button class="interactive" type="button" data-command-save-notes>✓ Lưu</button></header>
            <textarea data-command-notes rows="6" placeholder="Markdown, checklist hoặc ý tưởng...">${escapeHtml(state.notes || "")}</textarea>
            <footer><span data-command-note-count>${String(state.notes || "").length} ký tự</span><button type="button" data-app-route="/home">Mở Sticky Board ↗</button></footer>
          </article>
          <article class="command-widget command-widget--wide todo-widget">
            <header><div><small>TODO WORKSPACE</small><strong>Công việc đồng bộ</strong></div><span class="command-progress-label" data-command-progress-label>${progress}% hoàn thành</span></header>
            <div class="command-todo-progress"><i data-command-progress-bar style="width:${progress}%"></i></div>
            <div class="command-todo-compose"><input data-command-todo-input type="text" placeholder="Thêm công việc mới..."><button class="interactive" type="button" data-command-add-todo>＋ Thêm</button></div>
            <div class="command-todo-list" data-command-todos>
              ${todos.slice(0, 8).map(commandTodoMarkup).join("") || `<div class="command-widget-empty"><i>✓</i><span>Chưa có công việc. Thêm việc đầu tiên ở phía trên.</span></div>`}
            </div>
          </article>
          <article class="command-widget command-server-widget">
            <header><div><small>SYSTEM HEALTH</small><strong>Trạng thái dịch vụ</strong></div><button class="interactive" type="button" data-command-server>↻ Kiểm tra</button></header>
            <div class="server-readout command-service-list" data-command-server-output>${["Frontend","Backend","Database","Authentication"].map((service) => `<span data-status="checking"><i></i><b>${service}</b><small>Chờ kiểm tra</small></span>`).join("")}</div>
          </article>
          <article class="command-widget command-activity-widget">
            <header><div><small>RECENT ACTIVITY</small><strong>Dòng thời gian</strong></div><button class="interactive" type="button" data-command-clear-activity>Dọn</button></header>
            <div class="command-activity" data-command-activity>
              ${(state.activity || []).slice(0, 6).map((item, index) => `<p><i>${index === 0 ? "✦" : "•"}</i><span>${escapeHtml(item)}</span></p>`).join("") || `<div class="command-widget-empty"><i>◷</i><span>Hoạt động mới sẽ xuất hiện tại đây.</span></div>`}
            </div>
          </article>
          <article class="command-widget command-launch-widget">
            <header><div><small>QUICK LAUNCH</small><strong>Tiếp tục công việc</strong></div><button type="button" data-command-open>Ctrl K</button></header>
            <div class="command-launch-grid"><button type="button" data-app-route="/create/ai-center"><i>✦</i><span>AI Center</span></button><button type="button" data-app-route="/work/project-center"><i>P</i><span>Dự án</span></button><button type="button" data-app-route="/communication/community"><i>C</i><span>Cộng đồng</span></button><button type="button" data-app-route="/analytics"><i>↗</i><span>Analytics</span></button></div>
          </article>
        </div>
      </section>
    `;
  };

  const aiCenterMarkup = () => {
    let state = {};
    try { state = JSON.parse(localStorage.getItem("hh-ai-center") || "{}"); } catch { state = {}; }
    const sessions = Array.isArray(state.sessions) ? state.sessions : [];
    return `
      <section class="ai-center-app" data-ai-center>
        <header class="ai-center-hero">
          <div><p class="section-kicker">AI Center 02</p><h4>Trung tâm trí tuệ sáng tạo</h4><span>Chat, thiết kế prompt, tối ưu, dịch và chạy workflow trong một không gian.</span></div>
          <div class="ai-model-status"><i></i><div><strong data-ai-status>Local Intelligence</strong><span>Không gửi dữ liệu khi chưa yêu cầu</span></div></div>
        </header>
        <div class="ai-center-toolbar">
          <div class="ai-tool-tabs" role="tablist">
            ${[["chat","Chat AI"],["prompt","Prompt Studio"],["optimize","Tối ưu"],["translate","Dịch"],["workflow","Workflow"]].map(([id,label], index) => `<button class="interactive ${index === 0 ? "active" : ""}" type="button" data-ai-tab="${id}">${label}</button>`).join("")}
          </div>
          <label class="ai-model-select">Model<select data-ai-model><option value="smart-local">HH Smart Local</option><option value="creative">Creative Writer</option><option value="analyst">Deep Analyst</option><option value="fast">Fast Assistant</option><option value="cloud">Cloud AI (backend)</option></select></label>
        </div>
        <div class="ai-center-layout">
          <aside class="ai-sidebar">
            <button class="ai-new-session interactive" type="button" data-ai-new>+ Cuộc trò chuyện mới</button>
            <label class="ai-history-search"><span>Tìm lịch sử</span><input type="search" data-ai-search placeholder="Tên hoặc nội dung..."></label>
            <div class="ai-session-list" data-ai-sessions>
              ${sessions.slice(0, 10).map((item, index) => `<button class="interactive" type="button" data-ai-session="${index}"><span>${escapeHtml(item.title || "Phiên AI")}</span><small>${escapeHtml(item.time || "")}</small></button>`).join("") || "<p>Chưa có phiên đã lưu.</p>"}
            </div>
            <div class="ai-quick-prompts">
              <strong>Prompt nhanh</strong>
              ${["Viết tiêu đề YouTube","Tóm tắt nội dung","Lập kế hoạch dự án","Sửa code HTML","Viết bài mạng xã hội"].map((item) => `<button class="interactive" type="button" data-ai-quick="${escapeHtml(item)}">${escapeHtml(item)}</button>`).join("")}
            </div>
          </aside>
          <main class="ai-workspace">
            <section class="ai-pane active" data-ai-pane="chat">
              <div class="ai-chat-stream" data-ai-stream><article class="ai-message assistant"><span>HH</span><div><strong>HH AI Assistant</strong><p>Xin chào. Hãy nhập yêu cầu, tôi sẽ phân tích cấu trúc và tạo câu trả lời ngay trên thiết bị.</p></div></article></div>
              <form class="ai-composer" data-ai-chat-form>
                <textarea data-ai-chat-input rows="3" placeholder="Nhập câu hỏi, ý tưởng, đoạn code hoặc nội dung cần xử lý..."></textarea>
                <div><span><b data-ai-char-count>0</b> ký tự</span><button class="interactive" type="button" data-ai-clear-chat>Xóa</button><button class="button primary interactive" type="submit">Gửi AI</button></div>
              </form>
            </section>
            <section class="ai-pane" data-ai-pane="prompt">
              <div class="ai-pane-heading"><div><span>Prompt Studio</span><h5>Thiết kế prompt chuyên nghiệp</h5></div><button class="interactive" type="button" data-ai-example>Điền ví dụ</button></div>
              <div class="ai-prompt-grid">
                <label>Vai trò<input data-ai-role placeholder="Ví dụ: Chuyên gia nội dung YouTube"></label>
                <label>Mục tiêu<input data-ai-goal placeholder="Kết quả bạn muốn nhận"></label>
                <label>Đối tượng<input data-ai-audience placeholder="Người xem / người đọc"></label>
                <label>Giọng điệu<select data-ai-tone><option>Chuyên nghiệp</option><option>Cảm xúc</option><option>Thân thiện</option><option>Thuyết phục</option><option>Sáng tạo</option></select></label>
                <label class="wide">Ngữ cảnh<textarea data-ai-context rows="4" placeholder="Thông tin nền, dữ liệu, giới hạn..."></textarea></label>
                <label class="wide">Yêu cầu đầu ra<textarea data-ai-output rows="3" placeholder="Cấu trúc, độ dài, ngôn ngữ, định dạng..."></textarea></label>
              </div>
              <button class="button primary interactive ai-build-prompt" type="button" data-ai-build-prompt>Tạo prompt hoàn chỉnh</button>
            </section>
            <section class="ai-pane" data-ai-pane="optimize">
              <div class="ai-pane-heading"><div><span>Prompt Optimizer</span><h5>Làm rõ và tăng chất lượng yêu cầu</h5></div><div class="ai-score"><strong data-ai-score>0</strong><span>/100</span></div></div>
              <textarea class="ai-large-input" data-ai-optimize-input rows="10" placeholder="Dán prompt cần tối ưu..."></textarea>
              <div class="ai-option-row"><label><input type="checkbox" data-ai-opt="structure" checked>Cấu trúc</label><label><input type="checkbox" data-ai-opt="constraints" checked>Ràng buộc</label><label><input type="checkbox" data-ai-opt="examples">Ví dụ</label><label><input type="checkbox" data-ai-opt="reasoning" checked>Các bước</label></div>
              <button class="button primary interactive" type="button" data-ai-optimize>Tối ưu ngay</button>
            </section>
            <section class="ai-pane" data-ai-pane="translate">
              <div class="ai-pane-heading"><div><span>Prompt Translator</span><h5>Chuyển ngôn ngữ, giữ nguyên ý nghĩa</h5></div><button class="interactive" type="button" data-ai-swap>Đổi chiều</button></div>
              <div class="ai-translate-grid"><label><select data-ai-source-lang><option value="vi">Tiếng Việt</option><option value="en">English</option></select><textarea data-ai-translate-input rows="10" placeholder="Nhập nội dung..."></textarea></label><label><select data-ai-target-lang><option value="en">English</option><option value="vi">Tiếng Việt</option></select><textarea data-ai-translate-output rows="10" readonly placeholder="Bản dịch..."></textarea></label></div>
              <button class="button primary interactive" type="button" data-ai-translate>Dịch prompt</button>
            </section>
            <section class="ai-pane" data-ai-pane="workflow">
              <div class="ai-pane-heading"><div><span>AI Workflow</span><h5>Chuỗi xử lý nhiều bước</h5></div><button class="interactive" type="button" data-ai-add-step>+ Thêm bước</button></div>
              <label class="ai-workflow-source">Dữ liệu đầu vào<textarea data-ai-workflow-input rows="4" placeholder="Chủ đề hoặc nội dung cần xử lý..."></textarea></label>
              <div class="ai-workflow-steps" data-ai-workflow-steps>${["Phân tích yêu cầu","Tạo bản nháp","Kiểm tra và cải thiện"].map((item,index) => `<label><span>${index+1}</span><input value="${item}" data-ai-step><button class="interactive" type="button" data-ai-remove-step aria-label="Xóa bước">×</button></label>`).join("")}</div>
              <button class="button primary interactive" type="button" data-ai-run-workflow>Chạy toàn bộ workflow</button>
            </section>
          </main>
          <aside class="ai-context-panel">
            <header><div><span>Kết quả AI</span><strong data-ai-result-title>Sẵn sàng</strong></div><button class="interactive" type="button" data-ai-copy-result>Sao chép</button></header>
            <pre data-ai-result>Chọn một công cụ và nhập yêu cầu để bắt đầu.</pre>
            <div class="ai-result-actions"><button class="interactive" type="button" data-ai-save-result>Lưu phiên</button><button class="interactive" type="button" data-ai-export-result>Xuất TXT</button></div>
            <div class="ai-insights"><strong>Phân tích nhanh</strong><span>Độ rõ ràng <i data-ai-clarity style="--value:20%"></i></span><span>Chi tiết <i data-ai-detail style="--value:15%"></i></span><span>Khả năng sử dụng <i data-ai-usability style="--value:25%"></i></span></div>
          </aside>
        </div>
      </section>`;
  };

  const mediaCenterMarkup = () => {
    let state = {};
    try { state = JSON.parse(localStorage.getItem("hh-media-center") || "{}"); } catch { state = {}; }
    const defaults = [
      { id: "hh-ai-cover", title: "Kịch bản AI Studio", type: "image", category: "images", url: "assets/kich-ban-ai.png", source: "HH Projects", favorite: true },
      { id: "hh-ambient", title: "HH Neon Ambient", type: "audio", category: "music", url: "", source: "Music Engine", favorite: false },
      { id: "hh-profile", title: "Hoangdaika13 Portfolio", type: "link", category: "gallery", url: "https://hoangdaika13.github.io", source: "Website", favorite: false }
    ];
    const items = Array.isArray(state.items) && state.items.length ? state.items : defaults;
    const playlists = Array.isArray(state.playlists) && state.playlists.length ? state.playlists : [{ name: "Yêu thích", items: [] }, { name: "Xem sau", items: [] }];
    return `
      <section class="media-center-app" data-media-center>
        <header class="media-center-hero">
          <div><p class="section-kicker">Media Center 04</p><h4>Thư viện sáng tạo đa phương tiện</h4><span>Quản lý video, shorts, ảnh, nhạc, podcast, gallery và playlist trong một nơi.</span></div>
          <div class="media-hero-stats"><span><b data-media-total>${items.length}</b> Media</span><span><b data-media-favorites>${items.filter((item) => item.favorite).length}</b> Yêu thích</span><span><b>${playlists.length}</b> Playlist</span></div>
        </header>
        <div class="media-command-bar">
          <label class="media-search"><span>Tìm kiếm</span><input type="search" data-media-search placeholder="Tìm theo tên, nguồn hoặc loại..."></label>
          <div class="media-view-switch"><button class="interactive active" type="button" data-media-view="grid" title="Dạng lưới">Lưới</button><button class="interactive" type="button" data-media-view="list" title="Dạng danh sách">Danh sách</button></div>
          <button class="button ghost interactive" type="button" data-media-add-url>+ Thêm URL</button>
          <label class="button primary interactive media-upload">Chọn file<input type="file" data-media-upload multiple accept="image/*,video/*,audio/*"></label>
        </div>
        <div class="media-category-tabs">
          ${[["all","Tất cả"],["videos","Videos"],["shorts","Shorts"],["images","Hình ảnh"],["music","Âm nhạc"],["podcast","Podcast"],["gallery","Gallery"],["favorites","Yêu thích"]].map(([id,label], index) => `<button class="interactive ${index === 0 ? "active" : ""}" type="button" data-media-filter="${id}">${label}</button>`).join("")}
        </div>
        <div class="media-layout">
          <main class="media-library">
            <div class="media-grid" data-media-grid>
              ${items.map((item) => `
                <article class="media-card interactive-card" data-media-id="${escapeHtml(item.id)}" data-media-category="${escapeHtml(item.category || item.type)}" data-media-search-text="${escapeHtml(`${item.title} ${item.source} ${item.type}`.toLowerCase())}">
                  <button class="media-cover interactive" type="button" data-media-open="${escapeHtml(item.id)}">
                    ${item.type === "image" ? `<img src="${escapeHtml(item.url)}" alt="${escapeHtml(item.title)}">` : `<span class="media-type-icon">${item.type === "audio" ? "♫" : item.type === "video" ? "▶" : "↗"}</span>`}
                    <i>${escapeHtml(item.category || item.type)}</i>
                  </button>
                  <div class="media-card-info"><div><strong>${escapeHtml(item.title)}</strong><span>${escapeHtml(item.source || "Nguồn cá nhân")}</span></div><button class="interactive ${item.favorite ? "active" : ""}" type="button" data-media-favorite="${escapeHtml(item.id)}" aria-label="Yêu thích">${item.favorite ? "♥" : "♡"}</button></div>
                  <div class="media-card-actions"><button class="interactive" type="button" data-media-open="${escapeHtml(item.id)}">Mở</button><button class="interactive" type="button" data-media-queue="${escapeHtml(item.id)}">+ Playlist</button><button class="interactive" type="button" data-media-more="${escapeHtml(item.id)}">•••</button></div>
                </article>`).join("")}
            </div>
            <div class="media-empty" data-media-empty hidden><span>MEDIA</span><strong>Không tìm thấy nội dung</strong><p>Thử từ khóa khác hoặc thêm media mới.</p></div>
          </main>
          <aside class="media-sidebar">
            <section class="media-now-playing">
              <header><span>Đang chọn</span><button class="interactive" type="button" data-media-close-preview>Đóng</button></header>
              <div class="media-preview-stage" data-media-preview><div class="media-preview-placeholder"><span>▶</span><strong>Chọn một media</strong><p>Ảnh, video hoặc âm thanh sẽ hiển thị tại đây.</p></div></div>
              <div class="media-preview-meta"><strong data-media-preview-title>Chưa chọn</strong><span data-media-preview-source>Media Library</span></div>
            </section>
            <section class="media-playlists">
              <header><div><span>Bộ sưu tập</span><strong>Playlist của tôi</strong></div><button class="interactive" type="button" data-media-new-playlist>+</button></header>
              <div data-media-playlists>${playlists.map((list, index) => `<button class="interactive" type="button" data-media-playlist="${index}"><span>▤</span><div><strong>${escapeHtml(list.name)}</strong><small>${(list.items || []).length} mục</small></div></button>`).join("")}</div>
            </section>
            <section class="media-activity"><header><span>Hoạt động gần đây</span><button class="interactive" type="button" data-media-clear-activity>Dọn</button></header><div data-media-activity>${(state.activity || []).slice(0,5).map((item) => `<p>${escapeHtml(item)}</p>`).join("") || "<p>Chưa có hoạt động.</p>"}</div></section>
          </aside>
        </div>
        <dialog class="media-dialog" data-media-dialog>
          <form method="dialog"><button type="submit" aria-label="Đóng">×</button></form>
          <div><p class="section-kicker">Thêm vào thư viện</p><h5>Media từ liên kết</h5><label>Tên nội dung<input data-media-url-title placeholder="Ví dụ: Video giới thiệu"></label><label>URL<input type="url" data-media-url-input placeholder="https://youtube.com/... hoặc link ảnh/audio/video"></label><label>Loại<select data-media-url-category><option value="videos">Video</option><option value="shorts">Short</option><option value="images">Hình ảnh</option><option value="music">Âm nhạc</option><option value="podcast">Podcast</option><option value="gallery">Gallery / Link</option></select></label><button class="button primary interactive" type="button" data-media-save-url>Lưu media</button></div>
        </dialog>
      </section>`;
  };

  const projectCenterMarkup = () => {
    let state = {};
    try { state = JSON.parse(localStorage.getItem("hh-project-center") || "{}"); } catch { state = {}; }
    const projects = state.projects || [
      { id: "portfolio", name: "HH Neon Platform", status: "Đang phát triển", progress: 82, priority: "Cao", due: "2026-08-01", description: "Website cá nhân, AI Center, Media Center và cộng đồng.", color: "#ff3bd1" },
      { id: "script-ai", name: "Kịch bản AI", status: "Đang thử nghiệm", progress: 68, priority: "Cao", due: "2026-08-15", description: "Công cụ viết và quản lý kịch bản đa nền tảng.", color: "#55f3ec" },
      { id: "voice", name: "HH Voice Studio", status: "Bản ổn định", progress: 94, priority: "Trung bình", due: "2026-07-30", description: "Text/SRT, chia part, voice trình duyệt và humanize.", color: "#f5ff67" }
    ];
    const tasks = state.tasks || [
      { id:"t1", title:"Hoàn thiện Project Center", column:"doing", priority:"Cao", project:"portfolio" },
      { id:"t2", title:"Kiểm tra giao diện mobile", column:"todo", priority:"Cao", project:"portfolio" },
      { id:"t3", title:"Nâng cấp AI Center", column:"done", priority:"Cao", project:"portfolio" },
      { id:"t4", title:"Viết changelog v22", column:"review", priority:"Trung bình", project:"portfolio" }
    ];
    const active = projects.find((item) => item.id === state.activeProject) || projects[0];
    return `<section class="project-center-app" data-project-center data-active-project="${escapeHtml(active.id)}">
      <header class="project-center-hero"><div><p class="section-kicker">Project Center 05</p><h4>Điều hành dự án thông minh</h4><span>Tiến độ, Kanban, roadmap, timeline, bugs, changelog và nhóm trong một bảng điều khiển.</span></div><div class="project-health"><span>Project health</span><strong>${active.progress >= 80 ? "Tốt" : active.progress >= 55 ? "Ổn định" : "Cần chú ý"}</strong><i style="--health:${active.progress}%"></i></div></header>
      <div class="project-topbar"><label><span>Dự án hiện tại</span><select data-project-select>${projects.map((item) => `<option value="${escapeHtml(item.id)}" ${item.id === active.id ? "selected" : ""}>${escapeHtml(item.name)}</option>`).join("")}</select></label><div class="project-view-tabs">${[["overview","Tổng quan"],["board","Kanban"],["roadmap","Roadmap"],["bugs","Bugs"],["release","Changelog"]].map(([id,label],index) => `<button class="interactive ${index===0?"active":""}" type="button" data-project-tab="${id}">${label}</button>`).join("")}</div><button class="button primary interactive" type="button" data-project-new>+ Dự án</button></div>
      <div class="project-dashboard">
        <aside class="project-list-panel"><header><div><span>Danh mục</span><strong>${projects.length} dự án</strong></div><button class="interactive" type="button" data-project-sort>Sắp xếp</button></header><div data-project-list>${projects.map((item) => `<button class="project-list-item interactive ${item.id===active.id?"active":""}" type="button" data-project-open="${escapeHtml(item.id)}" style="--project-color:${item.color}"><i></i><div><strong>${escapeHtml(item.name)}</strong><span>${escapeHtml(item.status)} · ${item.progress}%</span></div><b>${escapeHtml(item.priority)}</b></button>`).join("")}</div><div class="project-mini-stats"><span><b>${tasks.filter((task)=>task.column!=="done").length}</b> đang mở</span><span><b>${tasks.filter((task)=>task.column==="done").length}</b> hoàn tất</span><span><b>${(state.bugs||[]).length}</b> bugs</span></div></aside>
        <main class="project-workspace">
          <section class="project-pane active" data-project-pane="overview"><div class="project-overview-head"><div><span>${escapeHtml(active.status)}</span><h5>${escapeHtml(active.name)}</h5><p>${escapeHtml(active.description)}</p></div><button class="interactive" type="button" data-project-edit>Chỉnh sửa</button></div><div class="project-metric-grid"><article><span>Tiến độ</span><strong data-project-progress-value>${active.progress}%</strong><i><b style="width:${active.progress}%"></b></i></article><article><span>Deadline</span><strong>${escapeHtml(active.due)}</strong><small data-project-days>Đang tính...</small></article><article><span>Nhiệm vụ</span><strong>${tasks.filter((task)=>task.project===active.id).length}</strong><small>${tasks.filter((task)=>task.project===active.id&&task.column==="done").length} hoàn thành</small></article><article><span>Ưu tiên</span><strong>${escapeHtml(active.priority)}</strong><small>Theo dõi liên tục</small></article></div><div class="project-progress-control"><label>Cập nhật tiến độ <input type="range" min="0" max="100" value="${active.progress}" data-project-progress><b>${active.progress}%</b></label><button class="interactive" type="button" data-project-complete>Đánh dấu hoàn tất</button></div><div class="project-timeline"><header><strong>Hoạt động gần đây</strong><button class="interactive" type="button" data-project-add-update>+ Cập nhật</button></header><div data-project-activity>${(state.activity||[]).slice(0,6).map((item)=>`<p><i></i><span>${escapeHtml(item)}</span></p>`).join("")||"<p><i></i><span>Project Center đã được khởi tạo.</span></p>"}</div></div></section>
          <section class="project-pane" data-project-pane="board"><div class="project-pane-heading"><div><span>Kanban board</span><h5>Luồng công việc</h5></div><button class="interactive" type="button" data-project-add-task>+ Nhiệm vụ</button></div><div class="project-kanban">${[["todo","Cần làm"],["doing","Đang làm"],["review","Kiểm tra"],["done","Hoàn tất"]].map(([id,label])=>`<section data-task-column="${id}"><header><strong>${label}</strong><span>${tasks.filter((task)=>task.column===id).length}</span></header><div>${tasks.filter((task)=>task.column===id).map((task)=>`<article draggable="true" data-task-id="${task.id}"><span>${escapeHtml(task.priority)}</span><strong>${escapeHtml(task.title)}</strong><small>${escapeHtml(projects.find((project)=>project.id===task.project)?.name||"")}</small><div><button class="interactive" type="button" data-task-move="${task.id}">Chuyển</button><button class="interactive" type="button" data-task-delete="${task.id}">×</button></div></article>`).join("")||"<p>Chưa có nhiệm vụ</p>"}</div></section>`).join("")}</div></section>
          <section class="project-pane" data-project-pane="roadmap"><div class="project-pane-heading"><div><span>Roadmap</span><h5>Các cột mốc phát triển</h5></div><button class="interactive" type="button" data-project-add-milestone>+ Cột mốc</button></div><div class="roadmap-list" data-roadmap-list>${(state.milestones||[{title:"Nền tảng lõi",date:"2026-07",progress:100},{title:"AI & Media workspace",date:"2026-08",progress:82},{title:"Community & Learning",date:"2026-09",progress:35}]).map((item,index)=>`<article><span>${String(index+1).padStart(2,"0")}</span><div><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(item.date)}</small><i><b style="width:${item.progress}%"></b></i></div><b>${item.progress}%</b></article>`).join("")}</div></section>
          <section class="project-pane" data-project-pane="bugs"><div class="project-pane-heading"><div><span>Issue tracker</span><h5>Lỗi và rủi ro</h5></div><button class="interactive" type="button" data-project-add-bug>+ Báo lỗi</button></div><div class="bug-list" data-bug-list>${(state.bugs||[]).map((bug)=>`<article><span>${escapeHtml(bug.severity)}</span><div><strong>${escapeHtml(bug.title)}</strong><small>${escapeHtml(bug.status)} · ${escapeHtml(bug.time)}</small></div><button class="interactive" type="button" data-bug-resolve="${bug.id}">Xử lý</button></article>`).join("")||"<p>Không có lỗi đang theo dõi.</p>"}</div></section>
          <section class="project-pane" data-project-pane="release"><div class="project-pane-heading"><div><span>Release notes</span><h5>Changelog dự án</h5></div><button class="interactive" type="button" data-project-add-release>+ Phiên bản</button></div><div class="release-list" data-release-list>${(state.releases||[{version:"v22",title:"Media Center workspace",date:"2026-07-11"},{version:"v21",title:"AI Center intelligent workspace",date:"2026-07-11"}]).map((item)=>`<article><b>${escapeHtml(item.version)}</b><div><strong>${escapeHtml(item.title)}</strong><span>${escapeHtml(item.date)}</span></div></article>`).join("")}</div></section>
        </main>
      </div>
      <dialog class="project-dialog" data-project-dialog><form method="dialog"><button aria-label="Đóng">×</button></form><div><p class="section-kicker">Project editor</p><h5 data-project-dialog-title>Dự án mới</h5><label>Tên<input data-project-name></label><label>Mô tả<textarea rows="3" data-project-description></textarea></label><div><label>Trạng thái<select data-project-status><option>Đang phát triển</option><option>Đang thử nghiệm</option><option>Tạm dừng</option><option>Bản ổn định</option></select></label><label>Ưu tiên<select data-project-priority><option>Cao</option><option>Trung bình</option><option>Thấp</option></select></label></div><label>Deadline<input type="date" data-project-due></label><button class="button primary interactive" type="button" data-project-save>Lưu dự án</button></div></dialog>
    </section>`;
  };

  const knowledgeCenterMarkup = () => {
    let state = {};
    try { state = JSON.parse(localStorage.getItem("hh-knowledge-center") || "{}"); } catch { state = {}; }
    const articles = state.articles || [{id:"deploy",title:"Deploy GitHub Pages và Vercel",category:"Hướng dẫn",tags:["github","vercel"],bookmark:true,updated:"2026-07-11",content:"# Deploy website HH\n\n## GitHub Pages\n- Push mã nguồn lên nhánh `main`.\n- Kiểm tra Pages trong Settings.\n\n## Vercel backend\nKết nối MongoDB và đặt biến môi trường trước khi deploy.\n\n> Luôn kiểm tra API sau khi phát hành."},{id:"ai-prompts",title:"Cấu trúc prompt AI hiệu quả",category:"AI",tags:["prompt","ai"],bookmark:false,updated:"2026-07-11",content:"# Prompt AI hiệu quả\n\nMột prompt tốt gồm **vai trò**, **mục tiêu**, **ngữ cảnh**, **ràng buộc** và **định dạng đầu ra**.\n\n## Checklist\n- Mục tiêu rõ ràng\n- Có ví dụ\n- Không bịa dữ kiện"}];
    const active = articles.find((item)=>item.id===state.activeArticle)||articles[0];
    return `<section class="knowledge-center-app" data-knowledge-center data-active-article="${escapeHtml(active?.id||"")}"><header class="wiki-hero"><div><p class="section-kicker">Knowledge Center 06</p><h4>Wiki kiến thức cá nhân</h4><span>Viết Markdown, tổ chức bài, tìm kiếm, tag, bookmark và liên kết kiến thức.</span></div><div class="wiki-stats"><span><b>${articles.length}</b>Bài viết</span><span><b>${new Set(articles.flatMap((item)=>item.tags||[])).size}</b>Tags</span><span><b>${articles.filter((item)=>item.bookmark).length}</b>Đã lưu</span></div></header><div class="wiki-toolbar"><label><span>Tìm toàn Wiki</span><input type="search" data-wiki-search placeholder="Tên bài, nội dung hoặc tag..."></label><div class="wiki-mode"><button class="interactive active" type="button" data-wiki-mode="split">Chia đôi</button><button class="interactive" type="button" data-wiki-mode="edit">Soạn thảo</button><button class="interactive" type="button" data-wiki-mode="preview">Xem bài</button></div><button class="button primary interactive" type="button" data-wiki-new>+ Bài mới</button></div><div class="wiki-layout"><aside class="wiki-sidebar"><div class="wiki-filter-row"><button class="interactive active" type="button" data-wiki-filter="all">Tất cả</button><button class="interactive" type="button" data-wiki-filter="bookmark">Đã lưu</button></div><div class="wiki-article-list" data-wiki-articles>${articles.map((item)=>`<button class="interactive ${item.id===active?.id?"active":""}" type="button" data-wiki-open="${item.id}"><span>${escapeHtml(item.category)}</span><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(item.updated)} · ${(item.tags||[]).map((tag)=>`#${escapeHtml(tag)}`).join(" ")}</small></button>`).join("")}</div><section class="wiki-categories"><strong>Danh mục</strong>${[...new Set(articles.map((item)=>item.category))].map((category)=>`<button class="interactive" type="button" data-wiki-category="${escapeHtml(category)}"><span>▤</span>${escapeHtml(category)}<b>${articles.filter((item)=>item.category===category).length}</b></button>`).join("")}</section></aside><main class="wiki-editor" data-wiki-editor-wrap><div class="wiki-document-head"><div><input data-wiki-title value="${escapeHtml(active?.title||"")}" placeholder="Tiêu đề bài viết"><span>Cập nhật <b data-wiki-updated>${escapeHtml(active?.updated||"")}</b></span></div><div><button class="interactive ${active?.bookmark?"active":""}" type="button" data-wiki-bookmark>${active?.bookmark?"★":"☆"}</button><button class="interactive" type="button" data-wiki-export>Xuất MD</button><button class="button primary interactive" type="button" data-wiki-save>Lưu</button></div></div><div class="wiki-meta-fields"><label>Danh mục<input data-wiki-category-input value="${escapeHtml(active?.category||"Ghi chú")}"></label><label>Tags<input data-wiki-tags value="${escapeHtml((active?.tags||[]).join(", "))}" placeholder="ai, html, hướng dẫn"></label></div><div class="wiki-format-bar">${[["# ","H1"],["## ","H2"],["**text**","B"],["- ","List"],["> ","Quote"],["`code`","Code"],["[text](url)","Link"]].map(([value,label])=>`<button class="interactive" type="button" data-wiki-format="${escapeHtml(value)}">${label}</button>`).join("")}</div><div class="wiki-split"><textarea data-wiki-content spellcheck="true">${escapeHtml(active?.content||"")}</textarea><article class="wiki-preview" data-wiki-preview></article></div></main><aside class="wiki-inspector"><section><header><span>Mục lục</span><button class="interactive" type="button" data-wiki-copy-link>Link</button></header><nav data-wiki-toc><p>Đang tạo mục lục...</p></nav></section><section><header><span>Bài liên quan</span></header><div data-wiki-related>${articles.filter((item)=>item.id!==active?.id).slice(0,4).map((item)=>`<button class="interactive" type="button" data-wiki-open="${item.id}">${escapeHtml(item.title)}</button>`).join("")}</div></section><section class="wiki-doc-info"><span><b data-wiki-word-count>0</b> từ</span><span><b data-wiki-read-time>1</b> phút đọc</span><span><b data-wiki-heading-count>0</b> đề mục</span></section></aside></div></section>`;
  };

  const learningCenterMarkup = () => {
    let state={};try{state=JSON.parse(localStorage.getItem("hh-learning-center")||"{}");}catch{state={};}
    const courses=state.courses||[{id:"web",title:"HTML, CSS & JavaScript",level:"Cơ bản → Nâng cao",lessons:["Cấu trúc HTML","Responsive CSS","JavaScript DOM","LocalStorage","Deploy website"]},{id:"ai",title:"Ứng dụng AI thực tế",level:"Thực hành",lessons:["Viết prompt","AI workflow","Kiểm tra đầu ra","Tự động hóa nội dung"]},{id:"creator",title:"YouTube Creator",level:"Sáng tạo",lessons:["Nghiên cứu chủ đề","Kịch bản giữ chân","SEO & tiêu đề","Thumbnail"]}];
    const active=courses.find((item)=>item.id===(state.activeCourse||"web"))||courses[0];const progress=state.progress||{};const completed=Object.keys(progress).filter((key)=>progress[key]).length;const total=courses.reduce((sum,item)=>sum+item.lessons.length,0);
    return `<section class="learning-center-app" data-learning-center data-course="${active.id}"><header class="learning-hero"><div><p class="section-kicker">Learning Center 07</p><h4>Học tập theo lộ trình</h4><span>Khóa học, bài học, tiến độ, quiz, chứng chỉ và ghi chú cá nhân.</span></div><div class="learning-level"><span>Tiến độ tổng</span><strong>${Math.round(completed/total*100)||0}%</strong><i style="--learn:${Math.round(completed/total*100)||0}%"></i></div></header><div class="learning-layout"><aside class="course-sidebar"><label>Tìm khóa học<input type="search" data-learning-search placeholder="HTML, AI, YouTube..."></label><div data-course-list>${courses.map((course)=>`<button class="interactive ${course.id===active.id?"active":""}" type="button" data-course-open="${course.id}"><span>${course.lessons.length} bài</span><strong>${escapeHtml(course.title)}</strong><small>${escapeHtml(course.level)}</small></button>`).join("")}</div><section><strong>Thành tích</strong><div><span><b>${completed}</b>Bài xong</span><span><b>${state.quizScore||0}</b>Điểm quiz</span><span><b>${state.streak||1}</b>Streak</span></div></section></aside><main class="learning-workspace"><div class="learning-course-head"><div><span>${escapeHtml(active.level)}</span><h5>${escapeHtml(active.title)}</h5></div><button class="interactive" type="button" data-learning-certificate>Chứng chỉ</button></div><div class="learning-tabs">${[["lessons","Bài học"],["quiz","Quiz"],["notes","Ghi chú"]].map(([id,label],index)=>`<button class="interactive ${index===0?"active":""}" type="button" data-learning-tab="${id}">${label}</button>`).join("")}</div><section class="learning-pane active" data-learning-pane="lessons"><div class="lesson-list">${active.lessons.map((lesson,index)=>{const key=`${active.id}:${index}`;return `<article class="${progress[key]?"done":""}"><span>${String(index+1).padStart(2,"0")}</span><div><strong>${escapeHtml(lesson)}</strong><small>${8+index*3} phút · Bài ${index+1}</small></div><button class="interactive" type="button" data-lesson-toggle="${key}">${progress[key]?"Đã học":"Hoàn thành"}</button></article>`;}).join("")}</div></section><section class="learning-pane" data-learning-pane="quiz"><form data-learning-quiz>${[["HTML dùng để làm gì?",["Tạo cấu trúc trang","Lưu database","Thiết kế ảnh"],0],["localStorage lưu dữ liệu ở đâu?",["Trình duyệt","MongoDB","Google Drive"],0],["Prompt tốt cần gì?",["Mục tiêu rõ ràng","Càng ngắn càng tốt","Không cần ngữ cảnh"],0]].map((q,index)=>`<fieldset><legend>${index+1}. ${q[0]}</legend>${q[1].map((answer,a)=>`<label><input type="radio" name="quiz-${index}" value="${a}">${answer}</label>`).join("")}</fieldset>`).join("")}<button class="button primary interactive" type="submit">Chấm điểm</button></form><div data-learning-quiz-result></div></section><section class="learning-pane" data-learning-pane="notes"><textarea data-learning-notes rows="16" placeholder="Ghi chú trong quá trình học...">${escapeHtml(state.notes||"")}</textarea><div><button class="button primary interactive" type="button" data-learning-save-notes>Lưu ghi chú</button><button class="button ghost interactive" type="button" data-learning-export-notes>Xuất TXT</button></div></section></main><aside class="learning-plan"><header><span>Kế hoạch hôm nay</span><strong>${new Date().toLocaleDateString("vi-VN")}</strong></header><div class="learning-focus"><span>Mục tiêu</span><strong>Hoàn thành một bài học</strong><i><b style="width:${completed?100:25}%"></b></i></div><div class="learning-next"><strong>Tiếp theo</strong>${active.lessons.filter((_,index)=>!progress[`${active.id}:${index}`]).slice(0,3).map((lesson,index)=>`<p><span>${index+1}</span>${escapeHtml(lesson)}</p>`).join("")||"<p>Đã hoàn tất khóa học!</p>"}</div><button class="interactive" type="button" data-learning-reset>Đặt lại tiến độ</button></aside></div></section>`;
  };

  const communityInitials=(name="HH")=>String(name).trim().split(/\s+/).slice(-2).map((part)=>part[0]||"").join("").toUpperCase();
  const communityViewerName=()=>{try{return JSON.parse(localStorage.getItem("hh-auth-user")||"{}").name||"HH";}catch{return "HH";}};
  const communityNotice=(message,type="info")=>{const status=document.querySelector("[data-community-status]");if(!status)return;status.textContent=message;status.dataset.state=type;clearTimeout(communityNotice.timer);communityNotice.timer=setTimeout(()=>{status.dataset.state="";},4200);};
  const COMMUNITY_MEDIA_LIMIT=2.5*1024*1024;
  const communityComposerFiles=new WeakMap();
  const communityMediaSource=(item)=>item?.mediaId?`${REALTIME_URL}/api/community?media=${encodeURIComponent(item.mediaId)}`:item?.id&&item?.type?`${REALTIME_URL}/api/community?media=${encodeURIComponent(item.id)}`:item?.mediaUrl||"";
  const communityFileData=(file)=>new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result||"").split(",")[1]||"");reader.onerror=()=>reject(new Error(`Không thể đọc ${file.name}.`));reader.readAsDataURL(file);});
  const communityUploadMedia=async(file,requestedType="")=>{const supported=/^(image|video|audio)\//.test(file.type)||["application/pdf","application/zip","application/x-zip-compressed","application/json","text/plain","text/csv","application/msword","application/vnd.openxmlformats-officedocument.wordprocessingml.document","application/vnd.ms-excel","application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"].includes(file.type);if(!supported)throw new Error(`${file.name} chưa thuộc định dạng được hỗ trợ.`);if(file.size>COMMUNITY_MEDIA_LIMIT)throw new Error(`${file.name} vượt 2,5 MB. Hãy nén tệp hoặc dùng liên kết HTTPS.`);return communityApi({method:"POST",body:{action:"media:upload",filename:file.name,mimeType:file.type,requestedType,data:await communityFileData(file)}});};
  const communityRenderComposerFiles=(form,files=[])=>{const fields=form.querySelector("[data-community-media-fields]");if(!fields)return;const previous=communityComposerFiles.get(form);(previous?.urls||[]).forEach((url)=>URL.revokeObjectURL(url));const urls=files.map((file)=>URL.createObjectURL(file));communityComposerFiles.set(form,{files,urls});let preview=fields.querySelector("[data-community-file-preview]");if(!preview){preview=document.createElement("div");preview.className="community-file-preview";preview.dataset.communityFilePreview="";fields.append(preview);}preview.hidden=!files.length;preview.innerHTML=files.map((file,index)=>`<figure>${file.type.startsWith("video/")?`<video src="${escapeHtml(urls[index])}" muted playsinline></video>`:`<img src="${escapeHtml(urls[index])}" alt="Xem trước ${index+1}">`}<figcaption><strong>${escapeHtml(file.name)}</strong><small>${(file.size/1024/1024).toFixed(2)} MB</small></figcaption></figure>`).join("")+(files.length?'<button type="button" data-community-remove-media aria-label="Bỏ tệp đã chọn">×</button>':"");};
  const communityDialog=({title="HH Social",message="",fields=[],actions=[{id:"cancel",label:"Hủy"},{id:"confirm",label:"Xác nhận",primary:true}]})=>new Promise((resolve)=>{document.querySelector("[data-hh-community-dialog]")?.remove();const dialog=document.createElement("dialog");dialog.className="hh-community-dialog";dialog.dataset.hhCommunityDialog="";dialog.innerHTML=`<section><header><div><span>HH SOCIAL</span><h5>${escapeHtml(title)}</h5></div><button type="button" data-dialog-close aria-label="Đóng">×</button></header>${message?`<p>${escapeHtml(message)}</p>`:""}<div class="hh-dialog-fields">${fields.map((field)=>`<label><span>${escapeHtml(field.label||"")}</span>${field.type==="textarea"?`<textarea name="${escapeHtml(field.name)}" rows="4" placeholder="${escapeHtml(field.placeholder||"")}">${escapeHtml(field.value||"")}</textarea>`:`<input name="${escapeHtml(field.name)}" type="${escapeHtml(field.type||"text")}" ${field.type==="file"?`accept="${escapeHtml(field.accept||"image/*,video/*")}"`:""} value="${field.type==="file"?"":escapeHtml(field.value||"")}" placeholder="${escapeHtml(field.placeholder||"")}">`}</label>`).join("")}</div><footer>${actions.map((action)=>`<button type="button" class="${action.primary?"primary":""} ${action.danger?"danger":""}" data-dialog-action="${escapeHtml(action.id)}">${escapeHtml(action.label)}</button>`).join("")}</footer></section>`;document.body.append(dialog);const finish=(action)=>{const named=[...dialog.querySelectorAll("[name]")];const values=Object.fromEntries(named.filter((field)=>field.type!=="file").map((field)=>[field.name,field.value.trim()]));const files=Object.fromEntries(named.filter((field)=>field.type==="file").map((field)=>[field.name,field.files?.[0]||null]));dialog.close();dialog.remove();resolve({action,values,files});};dialog.addEventListener("cancel",(event)=>{event.preventDefault();finish("cancel");},{once:true});dialog.addEventListener("click",(event)=>{if(event.target===dialog||event.target.closest("[data-dialog-close]"))finish("cancel");const button=event.target.closest("[data-dialog-action]");if(button)finish(button.dataset.dialogAction);});dialog.showModal();setTimeout(()=>dialog.querySelector("input,textarea,button")?.focus(),40);});
  const communityTime=(value)=>{const date=new Date(value);if(Number.isNaN(date.getTime()))return value||"Vừa xong";const seconds=Math.max(1,Math.floor((Date.now()-date.getTime())/1000));if(seconds<60)return "Vừa xong";if(seconds<3600)return `${Math.floor(seconds/60)} phút`;if(seconds<86400)return `${Math.floor(seconds/3600)} giờ`;return date.toLocaleDateString("vi-VN");};
  const communityReactionMeta={like:["Thích","👍"],love:["Yêu thích","❤"],care:["Thương thương","🤗"],haha:["Haha","😆"],wow:["Wow","😮"],sad:["Buồn","😢"],angry:["Phẫn nộ","😡"]};
  const communityStoryMarkup=(story)=>{const source=communityMediaSource(story);return `<button class="community-story interactive" type="button" data-story-id="${escapeHtml(story.id)}" data-story-content="${escapeHtml(story.content||"")}" data-story-media="${escapeHtml(source)}">${source?(story.mediaType==="video"?`<video src="${escapeHtml(source)}" muted playsinline preload="metadata"></video>`:`<img src="${escapeHtml(source)}" alt="" loading="lazy">`):""}<span>${communityInitials(story.author?.name)}</span><strong>${escapeHtml(story.author?.name||"Thành viên HH")}</strong><small>${communityTime(story.createdAt)}</small></button>`;};
  const communitySuggestionMarkup=(user)=>`<article><span>${communityInitials(user.name)}</span><div><strong>${escapeHtml(user.name)}</strong><small>Thành viên HH · Có thể bạn biết</small></div><button class="interactive ${user.following?"active":""}" type="button" data-community-follow="${escapeHtml(user.id)}">${user.following?"Đang theo dõi":"Theo dõi"}</button></article>`;
  const communityPostMarkup=(post)=>{const author=typeof post.author==="string"?{name:post.author}:post.author||{};const comments=post.comments||[];const reaction=communityReactionMeta[post.viewerReaction]||communityReactionMeta.like;const attachments=(post.media||[]).map((item)=>({...item,url:communityMediaSource(item)}));if(!attachments.length&&post.mediaUrl)attachments.push({type:post.mediaType||"image",url:post.mediaUrl});const media=attachments.length?`<div class="community-media-grid community-media-grid--${Math.min(attachments.length,4)}">${attachments.map((item,index)=>item.type==="video"?`<video class="community-media" controls playsinline preload="metadata" src="${escapeHtml(item.url)}" aria-label="Video ${index+1}"></video>`:`<img class="community-media" src="${escapeHtml(item.url)}" alt="Ảnh bài viết ${index+1}" loading="lazy">`).join("")}</div>`:"";return `<article class="community-post ${post.pinned?"is-pinned":""}" id="community-post-${escapeHtml(post.id)}" data-post-id="${escapeHtml(post.id)}"><header><span class="community-avatar">${author.avatar?`<img src="${escapeHtml(author.avatar)}" alt="">`:communityInitials(author.name)}</span><div><strong>${escapeHtml(author.name||"Thành viên HH")}${post.pinned?` <em>Đã ghim</em>`:""}</strong><small>${escapeHtml(communityTime(post.createdAt||post.time))} · ${post.privacy==="private"?"Riêng tư":post.privacy==="followers"?"Người theo dõi":"Công khai"} · #${escapeHtml(post.topic||post.category||"Thông báo")}</small></div><button class="community-icon-button interactive" type="button" aria-label="Tùy chọn bài viết" data-post-more="${escapeHtml(post.id)}">•••</button></header>${post.content?`<p>${escapeHtml(post.content).replace(/\n/g,"<br>")}</p>`:""}${media}<div class="post-social-proof"><span>${post.reactionCount||post.likes||0} lượt bày tỏ cảm xúc</span><span>${comments.length} bình luận · ${post.shares||0} lượt chia sẻ</span></div><div class="post-actions"><div class="reaction-wrap"><button class="interactive ${post.viewerReaction||post.liked?"active":""}" type="button" data-post-react="${escapeHtml(post.id)}" data-current-reaction="${escapeHtml(post.viewerReaction||"")}"><span>${reaction[1]}</span>${post.viewerReaction?reaction[0]:"Thích"}</button><div class="reaction-picker">${Object.entries(communityReactionMeta).map(([type,[label,icon]])=>`<button type="button" title="${label}" data-post-reaction="${escapeHtml(post.id)}" data-reaction-type="${type}">${icon}</button>`).join("")}</div></div><button class="interactive" type="button" data-post-comment-toggle="${escapeHtml(post.id)}">Bình luận</button><button class="interactive" type="button" data-post-share="${escapeHtml(post.id)}">Chia sẻ</button><button class="interactive ${post.saved?"active":""}" type="button" data-post-save="${escapeHtml(post.id)}">${post.saved?"Đã lưu":"Lưu"}</button></div><div class="post-comments" data-post-comments="${escapeHtml(post.id)}">${comments.map((comment)=>{const person=typeof comment.author==="string"?{name:comment.author}:comment.author||{name:"Thành viên"};return `<article class="community-comment"><span>${communityInitials(person.name)}</span><div><strong>${escapeHtml(person.name||"Thành viên")}</strong><p>${escapeHtml(comment.text||comment)}</p><small>${communityTime(comment.createdAt)} · <button type="button" data-comment-reply="${escapeHtml(comment.id||"")}">Trả lời</button></small></div></article>`;}).join("")}<form data-comment-form="${escapeHtml(post.id)}"><span>${communityInitials(communityViewerName())}</span><input placeholder="Viết bình luận công khai..."><button class="interactive" type="submit">Gửi</button></form></div></article>`;};
  const communityCenterMarkup=()=>{const state=ensureCommunityState();const posts=state.remotePosts||state.posts||communityDefaults();let auth={};try{auth=JSON.parse(localStorage.getItem("hh-auth-user")||"{}");}catch{}const name=auth.name||"Thành viên HH";return `<section class="community-center-app" data-community-center><header class="community-hero"><div><p class="section-kicker">HH Social</p><h4>Cộng đồng HH</h4><span>Kết nối bạn bè, chia sẻ khoảnh khắc và cùng phát triển hệ sinh thái HH.</span></div><div class="community-hero-actions"><label class="community-search"><span>⌕</span><input type="search" data-community-search placeholder="Tìm bài viết, chủ đề..."></label><a class="button primary interactive" href="#community">Mở Messenger HH</a></div></header><div class="community-layout"><aside class="community-nav"><section class="community-profile-card"><span class="community-avatar">${auth.avatar?`<img src="${escapeHtml(auth.avatar)}" alt="">`:communityInitials(name)}</span><div><strong>${escapeHtml(name)}</strong><small>${auth.email?"Tài khoản đã xác minh":"Đăng nhập để đăng bài"}</small></div></section>${[["all","Bảng tin"],["following","Đang theo dõi"],["popular","Phổ biến"],["saved","Đã lưu"]].map(([id,label],index)=>`<button class="interactive ${index===0?"active":""}" type="button" data-community-filter="${id}">${label}</button>`).join("")}<section><strong>Lối tắt</strong><button class="interactive" type="button" data-community-view="friends">Bạn bè</button><button class="interactive" type="button" data-community-view="groups">Nhóm của bạn</button><button class="interactive" type="button" data-community-view="events">Sự kiện</button><button class="interactive" type="button" data-community-view="memories">Kỷ niệm</button></section><section><strong>Chủ đề</strong>${["Thông báo","AI & Công nghệ","Website","Âm nhạc","Góp ý","Đời sống"].map((topic)=>`<button class="interactive" type="button" data-community-topic="${topic}"># ${topic}</button>`).join("")}</section><div class="community-online"><i></i><strong>Chat đang hoạt động</strong><span>Trò chuyện trực tiếp bằng Socket.io</span><a href="#community">Mở cuộc trò chuyện</a></div></aside><main class="community-feed"><section class="community-stories"><button class="community-story story-create interactive" type="button" data-story-create><span>＋</span><strong>Tạo tin</strong></button>${[["Hoàng Đại Ka","HH"],["AI Creator","AI"],["Music Studio","MS"],["Neon Team","NT"]].map(([story,initials],index)=>`<button class="community-story interactive" type="button" data-story="${index}"><span>${initials}</span><strong>${story}</strong></button>`).join("")}</section><form class="community-composer" data-community-form><div><span class="community-avatar">${communityInitials(name)}</span><textarea rows="2" data-community-input placeholder="${escapeHtml(name)}, bạn đang nghĩ gì?"></textarea></div><div class="composer-media" data-community-media-fields hidden><input type="url" data-community-media placeholder="Dán liên kết HTTPS của ảnh hoặc video"><select data-community-media-type><option value="image">Ảnh</option><option value="video">Video</option></select></div><footer><div><button class="interactive" type="button" data-community-add-media>Ảnh / Video</button><button class="interactive" type="button" data-community-feeling>Cảm xúc</button><button class="interactive" type="button" data-community-checkin>Check in</button></div><label><span>Đối tượng</span><select data-community-privacy><option value="public">Công khai</option><option value="followers">Người theo dõi</option><option value="private">Chỉ mình tôi</option></select></label><label><span>Chủ đề</span><select data-community-category>${["Góp ý","AI & Công nghệ","Website","Âm nhạc","Đời sống"].map((item)=>`<option>${item}</option>`).join("")}</select></label><button class="button primary interactive" type="submit">Đăng</button></footer></form><div class="community-feed-status" data-community-status>${REALTIME_URL?"Đang đồng bộ bảng tin...":"Chế độ ngoại tuyến"}</div><div data-community-posts>${posts.map(communityPostMarkup).join("")}</div></main><aside class="community-side"><section><header><span>Được tài trợ</span></header><div class="community-sponsored"><b>HH Creator Studio</b><p>Bộ công cụ sáng tạo dành cho cộng đồng HH.</p><button class="interactive" type="button" data-community-view="creator">Khám phá</button></div></section><section><header><span>Gợi ý kết nối</span><button class="interactive" type="button" data-community-view="friends">Xem tất cả</button></header>${[["Hoàng Đại Ka 13",980],["HH Creator",720],["Neon Member",540]].map((user)=>`<article><span>${communityInitials(user[0])}</span><div><strong>${user[0]}</strong><small>${user[1]} XP · 3 bạn chung</small></div><button class="interactive" type="button" data-community-follow="${user[0]}">Theo dõi</button></article>`).join("")}</section><section><header><span>Liên hệ</span><i class="community-presence"></i></header>${["HH Team","AI Creator","Music Studio","Neon Member"].map((user)=>`<button class="community-contact interactive" type="button" data-community-contact="${user}"><span>${communityInitials(user)}<i></i></span><strong>${user}</strong></button>`).join("")}</section><section class="community-guidelines"><strong>Cộng đồng an toàn</strong><p>Tôn trọng quyền riêng tư, không spam và chỉ chia sẻ nội dung bạn có quyền sử dụng.</p></section></aside></div></section>`;};

  const userDashboardMarkup=()=>{let user={};try{user=JSON.parse(localStorage.getItem("hh-auth-user")||"{}");}catch{}let state={};try{state=JSON.parse(localStorage.getItem("hh-user-dashboard")||"{}");}catch{}const name=state.nickname||user.name||"Thành viên HH";const initials=name.split(/\s+/).slice(-2).map((part)=>part[0]).join("").toUpperCase();return `<section class="user-dashboard-app" data-user-dashboard><header class="user-cover"><div class="user-avatar" data-user-avatar>${state.avatar?`<img src="${escapeHtml(state.avatar)}" alt="Avatar">`:initials}</div><div><p class="section-kicker">User Dashboard 09</p><h4>${escapeHtml(name)}</h4><span>${escapeHtml(user.email||"Tài khoản thành viên")}</span></div><button class="interactive" type="button" data-user-edit>Chỉnh sửa hồ sơ</button></header><div class="user-stat-row"><span><b>${Object.keys((readProjectState().favorites)||{}).length}</b>Đã lưu</span><span><b>${JSON.parse(localStorage.getItem("hh-module-favorites")||"[]").length}</b>Yêu thích</span><span><b>${(readWikiState().articles||[]).filter((item)=>item.bookmark).length}</b>Bookmark</span><span><b>${state.xp||120}</b>XP</span></div><div class="user-dashboard-layout"><aside class="user-menu">${[["profile","Hồ sơ"],["saved","Đã lưu"],["activity","Hoạt động"],["notifications","Thông báo"],["settings","Cài đặt"]].map(([id,label],index)=>`<button class="interactive ${index===0?"active":""}" type="button" data-user-tab="${id}">${label}</button>`).join("")}<button class="interactive danger" type="button" data-user-export>Xuất dữ liệu cá nhân</button></aside><main class="user-content"><section class="user-pane active" data-user-pane="profile"><div class="user-pane-head"><div><span>Thông tin công khai</span><h5>Hồ sơ cá nhân</h5></div><label class="button ghost interactive">Đổi avatar<input type="file" accept="image/*" data-user-avatar-upload></label></div><div class="user-form-grid"><label>Biệt danh<input data-user-nickname value="${escapeHtml(name)}"></label><label>Email<input value="${escapeHtml(user.email||"")}" disabled></label><label>Giới thiệu<textarea rows="4" data-user-bio>${escapeHtml(state.bio||"")}</textarea></label><label>Website<input data-user-website value="${escapeHtml(state.website||"")}" placeholder="https://..."></label></div><button class="button primary interactive" type="button" data-user-save>Lưu hồ sơ</button></section><section class="user-pane" data-user-pane="saved"><h5>Nội dung đã lưu</h5><div class="user-saved-grid"><article><span>Wiki</span><strong>Bookmark kiến thức</strong><p>${(readWikiState().articles||[]).filter((item)=>item.bookmark).length} bài đã lưu</p></article><article><span>Media</span><strong>Media yêu thích</strong><p>${(readMediaState().items||[]).filter((item)=>item.favorite).length} mục</p></article><article><span>Modules</span><strong>Ứng dụng yêu thích</strong><p>${JSON.parse(localStorage.getItem("hh-module-favorites")||"[]").length} module</p></article></div></section><section class="user-pane" data-user-pane="activity"><h5>Hoạt động gần đây</h5><div class="user-activity-list">${[...(readProjectState().activity||[]),...(readMediaState().activity||[])].slice(0,10).map((item)=>`<p><i></i>${escapeHtml(item)}</p>`).join("")||"<p>Chưa có hoạt động.</p>"}</div></section><section class="user-pane" data-user-pane="notifications"><h5>Trung tâm thông báo</h5>${["Cập nhật dự án","Tin nhắn cộng đồng","Bản phát hành mới","Nhắc lịch học"].map((item,index)=>`<label class="user-toggle"><span>${item}</span><input type="checkbox" data-user-notification="${index}" ${state.notifications?.[index]!==false?"checked":""}><i></i></label>`).join("")}</section><section class="user-pane" data-user-pane="settings"><h5>Cài đặt trải nghiệm</h5><label class="user-toggle"><span>Hiệu ứng neon mạnh</span><input type="checkbox" data-user-setting="neon" ${state.settings?.neon!==false?"checked":""}><i></i></label><label class="user-toggle"><span>Âm thanh click</span><input type="checkbox" data-user-setting="sound" ${state.settings?.sound!==false?"checked":""}><i></i></label><label class="user-toggle"><span>Animation khi cuộn</span><input type="checkbox" data-user-setting="motion" ${state.settings?.motion!==false?"checked":""}><i></i></label></section></main></div></section>`;};

  const adminPanelMarkup = () => `<section class="admin-panel-app" data-admin-panel><header class="admin-hero"><div><p class="section-kicker">Admin Panel 10</p><h4>Trung tâm quản trị hệ thống</h4><span>Dữ liệu thật từ MongoDB, chỉ mở cho email chủ sở hữu.</span></div><div class="admin-security"><i></i><strong data-admin-access>Đang xác minh quyền</strong><span>Owner-only access</span></div></header><div class="admin-toolbar"><div class="admin-tabs">${[["dashboard","Dashboard"],["users","Tài khoản"],["content","Nội dung"],["analytics","Analytics"],["logs","Logs"],["database","Database"],["backup","Backup"]].map(([id,label],index)=>`<button class="interactive ${index===0?"active":""}" type="button" data-admin-tab="${id}">${label}</button>`).join("")}</div><button class="button primary interactive" type="button" data-admin-refresh>Làm mới dữ liệu</button></div><div class="admin-status" data-admin-status>Đang kết nối backend an toàn...</div><div class="admin-pane active" data-admin-pane="dashboard"><div class="admin-metrics" data-admin-metrics>${["Users","Module records","Actions","Events"].map((label)=>`<article><span>${label}</span><strong>--</strong><small>MongoDB</small></article>`).join("")}</div><div class="admin-dashboard-grid"><section><header><strong>Người đang hoạt động</strong><span>2 phút gần nhất</span></header><div data-admin-visitors><p>Đang tải danh sách...</p></div></section><section><header><strong>Hoạt động hệ thống</strong><span>Realtime</span></header><div data-admin-events><p>Đang tải logs...</p></div></section><section><header><strong>Trạng thái dịch vụ</strong><span>Monitor</span></header>${["GitHub Pages","Vercel API","MongoDB Atlas","Realtime Chat"].map((service)=>`<p class="admin-service"><i></i><span>${service}</span><b>Đang kiểm tra</b></p>`).join("")}</section></div></div><div class="admin-pane" data-admin-pane="users"><div class="admin-users-toolbar"><label><span>Tìm tài khoản</span><input type="search" data-admin-user-search placeholder="Tên, email hoặc phương thức đăng nhập"></label><div><span data-admin-user-total>0 tài khoản</span><span data-admin-user-online>0 online</span><span data-admin-user-updated>Chưa đồng bộ</span></div></div><div class="admin-users-table-wrap"><table class="admin-users-table"><thead><tr><th>Tài khoản</th><th>Đăng nhập bằng</th><th>Quyền dữ liệu</th><th>Đăng ký</th><th>Đăng nhập cuối</th><th>Trạng thái</th></tr></thead><tbody data-admin-users><tr><td colspan="6">Đang tải danh sách tài khoản...</td></tr></tbody></table></div><p class="admin-privacy-note">Mật khẩu và mã băm không bao giờ được API hoặc Admin Panel trả về.</p></div>${["content","analytics","logs","database","backup"].map((id)=>`<div class="admin-pane" data-admin-pane="${id}"><div class="admin-placeholder"><span>${id.toUpperCase()}</span><strong>${id==="backup"?"Sao lưu cấu hình cá nhân":"Dữ liệu quản trị được bảo vệ"}</strong><p>${id==="backup"?"Xuất toàn bộ localStorage của website thành JSON để lưu trữ hoặc phục hồi.":"Tải dữ liệu thật để xem thống kê đã được chủ sở hữu cho phép."}</p>${id==="backup"?'<button class="button primary interactive" type="button" data-admin-backup>Tạo file backup</button>':""}</div></div>`).join("")}</section>`;

  const aiAutomationMarkup=()=>`<section class="automation-app" data-automation><header class="suite-hero"><div><p class="section-kicker">AI Automation 11</p><h4>Dây chuyền nội dung AI</h4><span>Tạo title, mô tả, tags, bản dịch, tóm tắt, voice prompt và thumbnail prompt chỉ trong một lần chạy.</span></div><div class="suite-badge"><i></i><strong>7 tác vụ</strong><span>Local-first pipeline</span></div></header><div class="automation-layout"><aside class="automation-steps"><strong>Pipeline</strong>${[["title","Auto Title"],["description","Auto Description"],["tags","Auto Tags"],["translation","Auto Translation"],["summary","Auto Summary"],["voice","Auto Voice"],["thumbnail","Auto Thumbnail"]].map(([id,label],index)=>`<label><span>${index+1}</span><input type="checkbox" data-auto-step="${id}" checked><i></i><b>${label}</b></label>`).join("")}</aside><main class="automation-workspace"><div class="suite-form-grid"><label>Chủ đề / nội dung<textarea rows="7" data-auto-input placeholder="Dán nội dung hoặc mô tả video..."></textarea></label><label>Nền tảng<select data-auto-platform><option>YouTube</option><option>TikTok</option><option>Facebook</option><option>Website</option></select></label><label>Ngôn ngữ<select data-auto-language><option>Tiếng Việt</option><option>English</option></select></label><label>Phong cách<select data-auto-style><option>Cảm xúc</option><option>Chuyên nghiệp</option><option>Thân thiện</option><option>Kịch tính</option></select></label></div><div class="suite-actions"><button class="button primary interactive" type="button" data-auto-run>Chạy toàn bộ</button><button class="button ghost interactive" type="button" data-auto-clear>Xóa</button><button class="button ghost interactive" type="button" data-auto-export>Xuất kết quả</button></div><div class="automation-progress"><i data-auto-progress></i><span data-auto-status>Sẵn sàng chạy workflow</span></div></main><aside class="automation-results"><header><strong>Kết quả</strong><button class="interactive" type="button" data-auto-copy>Sao chép</button></header><pre data-auto-output>Chọn các bước và nhập nội dung để bắt đầu.</pre></aside></div></section>`;

  const creatorStudioMarkup=()=>`<section class="creator-app" data-creator><header class="suite-hero"><div><p class="section-kicker">Creator Studio 12</p><h4>Xưởng sản xuất nội dung</h4><span>Ý tưởng, tiêu đề, SEO score, kịch bản, hashtag và thumbnail trong một quy trình.</span></div><div class="creator-score"><strong data-creator-score>0</strong><span>SEO Score</span></div></header><div class="creator-layout"><aside class="creator-nav">${[["idea","Ý tưởng"],["script","Kịch bản"],["seo","SEO"],["thumbnail","Thumbnail"],["hashtags","Hashtags"]].map(([id,label],index)=>`<button class="interactive ${index===0?"active":""}" type="button" data-creator-tab="${id}">${label}</button>`).join("")}<section><strong>Checklist xuất bản</strong>${["Hook rõ ràng","Tiêu đề dưới 70 ký tự","Có từ khóa chính","Thumbnail dễ đọc","CTA tự nhiên"].map((item)=>`<label><input type="checkbox" data-creator-check>${item}</label>`).join("")}</section></aside><main class="creator-workspace"><label>Chủ đề chính<input data-creator-topic placeholder="Ví dụ: Câu chuyện gia đình tuổi 40+"></label><div class="creator-fields"><label>Nền tảng<select data-creator-platform><option>YouTube</option><option>TikTok</option><option>Facebook Reels</option></select></label><label>Độ dài<select data-creator-length><option>8-12 phút</option><option>3-5 phút</option><option>60 giây</option></select></label><label>Đối tượng<input data-creator-audience value="Người xem 40-65 tuổi"></label><label>Tone<select data-creator-tone><option>Cảm xúc</option><option>Kịch tính</option><option>Truyền cảm hứng</option></select></label></div><button class="button primary interactive" type="button" data-creator-generate>Tạo bộ nội dung</button><div class="creator-output-tabs"><button class="interactive active" type="button" data-creator-output-tab="title">Tiêu đề</button><button class="interactive" type="button" data-creator-output-tab="script">Kịch bản</button><button class="interactive" type="button" data-creator-output-tab="seo">SEO</button><button class="interactive" type="button" data-creator-output-tab="thumbnail">Thumbnail</button></div><pre data-creator-output>Nhập chủ đề để tạo bộ nội dung.</pre></main><aside class="creator-inspector"><div class="thumbnail-canvas" data-thumbnail-preview><span>HH</span><strong>THUMBNAIL PREVIEW</strong><small>Chủ đề sẽ hiển thị tại đây</small></div><div class="creator-keywords"><strong>Từ khóa & hashtag</strong><div data-creator-tags><span>#Hoangdaika13</span><span>#CreatorStudio</span></div></div><button class="button ghost interactive" type="button" data-creator-export>Xuất TXT</button></aside></div></section>`;

  const analyticsMarkup=()=>{const nav=performance.getEntriesByType?.("navigation")?.[0];const load=Math.round(nav?.duration||0);const visits=Number(localStorage.getItem("hh-local-visits")||0)+1;localStorage.setItem("hh-local-visits",visits);return `<section class="analytics-app" data-analytics><header class="suite-hero"><div><p class="section-kicker">Analytics 13</p><h4>Phân tích hoạt động website</h4><span>Traffic cục bộ, thiết bị, trình duyệt, hiệu suất, downloads và AI usage.</span></div><button class="button primary interactive" type="button" data-analytics-refresh>Làm mới dữ liệu</button></header><div class="analytics-metrics"><article><span>Lượt mở thiết bị này</span><strong>${visits}</strong><small>localStorage</small></article><article><span>Thời gian tải</span><strong>${load} ms</strong><small>Navigation API</small></article><article><span>Màn hình</span><strong>${window.innerWidth}×${window.innerHeight}</strong><small>Viewport hiện tại</small></article><article><span>Modules dùng</span><strong>${Object.keys(JSON.parse(localStorage.getItem("hh-super-platform-state")||"{}")).length}</strong><small>Local activity</small></article></div><div class="analytics-grid"><section><header><strong>Hoạt động 7 ngày</strong><span>Thiết bị này</span></header><div class="analytics-bars">${[42,58,51,76,69,88,visits%100].map((value,index)=>`<i style="--bar:${Math.max(12,value)}%"><b>${["T2","T3","T4","T5","T6","T7","CN"][index]}</b></i>`).join("")}</div></section><section><header><strong>Thiết bị & trình duyệt</strong></header><div class="analytics-device"><span><b>Trình duyệt</b>${escapeHtml(navigator.userAgent.includes("Chrome")?"Chrome / Chromium":"Web Browser")}</span><span><b>Hệ điều hành</b>${escapeHtml(navigator.platform||"Không xác định")}</span><span><b>Ngôn ngữ</b>${escapeHtml(navigator.language||"vi-VN")}</span><span><b>Online</b>${navigator.onLine?"Đang kết nối":"Ngoại tuyến"}</span></div></section><section><header><strong>Usage theo module</strong></header><div class="analytics-rings"><span style="--ring:82%"><b>82%</b>AI</span><span style="--ring:68%"><b>68%</b>Media</span><span style="--ring:54%"><b>54%</b>Wiki</span></div></section><section><header><strong>Sự kiện gần đây</strong></header><div class="analytics-events">${[...(readProjectState().activity||[]),...(readMediaState().activity||[])].slice(0,8).map((item)=>`<p>${escapeHtml(item)}</p>`).join("")||"<p>Chưa có dữ liệu hoạt động.</p>"}</div></section></div></section>`;};

  const storeMarkup=()=>`<section class="store-app" data-store><header class="suite-hero"><div><p class="section-kicker">Store 14</p><h4>Cửa hàng sản phẩm số HH</h4><span>Tool, source code, membership, giỏ hàng và đơn hàng MongoDB.</span></div><button class="store-cart-button interactive" type="button" data-store-cart>Giỏ hàng <b data-cart-count>0</b></button></header><div class="store-toolbar"><input type="search" data-store-search placeholder="Tìm sản phẩm..."><div>${["Tất cả","Tool","Source","Membership"].map((item,index)=>`<button class="interactive ${index===0?"active":""}" type="button" data-store-filter="${item.toLowerCase()}">${item}</button>`).join("")}</div></div><div class="store-layout"><main class="product-grid" data-store-products><p>Đang tải sản phẩm từ API...</p></main><aside class="cart-panel" data-cart-panel><header><div><span>Giỏ hàng</span><strong>Đơn của bạn</strong></div><button class="interactive" type="button" data-cart-clear>Dọn</button></header><div data-cart-items><p>Chưa có sản phẩm.</p></div><div class="cart-total"><span>Tổng cộng</span><strong data-cart-total>0 ₫</strong></div><div class="checkout-form"><input data-checkout-name placeholder="Họ tên"><input data-checkout-email type="email" placeholder="Email"><input data-checkout-phone placeholder="Số điện thoại"><button class="button primary interactive" type="button" data-checkout>Đặt hàng</button><small data-checkout-status>Thanh toán online chưa kích hoạt; đơn sẽ ở trạng thái chờ.</small></div></aside></div></section>`;

  const cloudStorageMarkup=()=>`<section class="cloud-app" data-cloud><header class="suite-hero"><div><p class="section-kicker">Cloud Storage 15</p><h4>Kho dữ liệu cá nhân</h4><span>Upload file nhỏ, metadata MongoDB, preview, thư mục, chia sẻ và file gần đây.</span></div><div class="suite-badge"><i></i><strong data-cloud-status>Đang kết nối</strong><span>Tài khoản riêng tư</span></div></header><div class="cloud-toolbar"><label class="button primary interactive">Upload file<input type="file" data-cloud-upload multiple></label><button class="button ghost interactive" type="button" data-cloud-new-text>+ File văn bản</button><button class="button ghost interactive" type="button" data-cloud-refresh>Làm mới</button><input type="search" data-cloud-search placeholder="Tìm file..."></div><div class="cloud-layout"><aside class="cloud-nav"><button class="interactive active" type="button" data-cloud-filter="all">Tất cả file</button><button class="interactive" type="button" data-cloud-filter="recent">Gần đây</button><button class="interactive" type="button" data-cloud-filter="text">Văn bản</button><section><strong>Thư mục</strong><button class="interactive" type="button">▤ Dự án</button><button class="interactive" type="button">▤ Tài liệu</button><button class="interactive" type="button">▤ Media</button></section><div class="cloud-quota"><span>Dung lượng metadata</span><i><b style="width:12%"></b></i><small>Giới hạn 50 KB mỗi file</small></div></aside><main class="cloud-files"><div class="cloud-file-head"><span>Tên</span><span>Loại</span><span>Kích thước</span><span>Ngày tạo</span><span></span></div><div data-cloud-files><p>Đang tải dữ liệu của bạn...</p></div></main><aside class="cloud-preview"><header><strong>Preview</strong><button class="interactive" type="button" data-cloud-close>×</button></header><pre data-cloud-preview>Chọn một file để xem metadata.</pre><button class="button ghost interactive" type="button" data-cloud-export-list>Xuất danh sách</button></aside></div></section>`;

  const notificationCenterMarkup=()=>{let state={};try{state=JSON.parse(localStorage.getItem("hh-notification-center")||"{}");}catch{}const inbox=state.inbox||[{title:"Chào mừng đến HH Platform",message:"Các trung tâm 01-15 đã sẵn sàng để sử dụng.",time:"Hôm nay",read:false,type:"system"},{title:"Media Center v22",message:"Thư viện media đã được nâng cấp.",time:"Gần đây",read:true,type:"update"}];return `<section class="notification-app" data-notification><header class="suite-hero"><div><p class="section-kicker">Notification Center 16</p><h4>Thông báo đa kênh</h4><span>Email, Push, In-app, Discord và Telegram với tùy chọn theo tài khoản.</span></div><button class="button primary interactive" type="button" data-notification-enable>Cho phép thông báo trình duyệt</button></header><div class="notification-layout"><aside class="notification-nav">${[["all","Tất cả"],["unread","Chưa đọc"],["system","Hệ thống"],["update","Cập nhật"]].map(([id,label],index)=>`<button class="interactive ${index===0?"active":""}" type="button" data-notification-filter="${id}">${label}<b>${id==="unread"?inbox.filter((item)=>!item.read).length:""}</b></button>`).join("")}<section><strong>Kênh đã cấu hình</strong><span><i></i>In-app</span><span><i></i>Email</span><span><i></i>Push</span></section></aside><main class="notification-inbox"><header><div><span>Inbox</span><strong data-notification-count>${inbox.filter((item)=>!item.read).length} chưa đọc</strong></div><button class="interactive" type="button" data-notification-read-all>Đánh dấu đã đọc</button></header><div data-notification-list>${inbox.map((item,index)=>`<article class="${item.read?"read":""}" data-notification-item="${index}" data-notification-type="${item.type}"><i></i><div><strong>${escapeHtml(item.title)}</strong><p>${escapeHtml(item.message)}</p><small>${escapeHtml(item.time)}</small></div><button class="interactive" type="button" data-notification-read="${index}">${item.read?"✓":"Đọc"}</button></article>`).join("")}</div></main><aside class="notification-settings"><header><span>Kết nối kênh</span><strong>Preferences</strong></header><label>Kênh<select data-notification-channel><option value="email">Email</option><option value="push">Push Browser</option><option value="discord">Discord webhook</option><option value="telegram">Telegram chat</option><option value="in-app">In-app</option></select></label><label>Địa chỉ nhận<input data-notification-target placeholder="Email, webhook hoặc chat ID"></label>${["Cập nhật dự án","Tin nhắn cộng đồng","Sản phẩm mới","Cảnh báo bảo mật"].map((item,index)=>`<label class="notification-check"><input type="checkbox" data-notification-pref="${index}" checked>${item}</label>`).join("")}<button class="button primary interactive" type="button" data-notification-subscribe>Lưu đăng ký</button><p data-notification-status>Provider bên ngoài cần key riêng để gửi thật.</p></aside></div></section>`;};

  const apiCenterMarkup=()=>{const endpoints=[{method:"GET",path:"/api/auth/me",name:"Phiên người dùng"},{method:"GET",path:"/api/store/products",name:"Sản phẩm"},{method:"GET",path:"/api/storage/files",name:"Cloud files"},{method:"GET",path:"/api/platform/summary",name:"Admin summary"},{method:"POST",path:"/api/notifications/subscribe",name:"Đăng ký thông báo"},{method:"POST",path:"/api/store/orders",name:"Tạo đơn hàng"},{method:"GET",path:"/api/search/google?health=1",name:"Search Gateway"},{method:"GET",path:"/api/search/youtube?q=music",name:"YouTube Search"},{method:"GET",path:"/api/search/google?q=AI",name:"Google Search"}];return `<section class="api-center-app" data-api-center><header class="suite-hero"><div><p class="section-kicker">API Center 17</p><h4>API Docs & Playground</h4><span>Tài liệu endpoint, request builder, response viewer, ví dụ và trạng thái backend.</span></div><div class="suite-badge"><i></i><strong>${endpoints.length} endpoints</strong><span>Vercel Serverless</span></div></header><div class="api-layout"><aside class="api-sidebar"><label>Tìm endpoint<input type="search" data-api-search placeholder="auth, store, files..."></label><div data-api-list>${endpoints.map((item,index)=>`<button class="interactive ${index===0?"active":""}" type="button" data-api-open="${index}" data-api-search-text="${`${item.name} ${item.path}`.toLowerCase()}"><b class="${item.method.toLowerCase()}">${item.method}</b><span>${escapeHtml(item.name)}</span><small>${item.path}</small></button>`).join("")}</div></aside><main class="api-playground"><div class="api-request-line"><select data-api-method><option>GET</option><option>POST</option></select><input data-api-path value="/api/auth/me"><button class="button primary interactive" type="button" data-api-send>Gửi request</button></div><div class="api-tabs"><button class="interactive active" type="button">Body JSON</button><button class="interactive" type="button">Headers</button><button class="interactive" type="button">Examples</button></div><textarea data-api-body rows="12" spellcheck="false">{}</textarea><div class="api-response-head"><strong>Response</strong><span data-api-timing>Chưa gửi</span></div><pre data-api-response>Chọn endpoint và gửi request để xem dữ liệu.</pre></main><aside class="api-docs"><span>Endpoint đang chọn</span><h5 data-api-doc-title>Phiên người dùng</h5><code data-api-doc-path>GET /api/auth/me</code><p data-api-doc-description>Trả về tài khoản hiện tại và lịch sử đăng nhập được phép xem.</p><section><strong>Authentication</strong><p>Bearer token được tự động lấy từ phiên đăng nhập hiện tại.</p></section><button class="button ghost interactive" type="button" data-api-copy-curl>Sao chép cURL</button></aside></div></section>`;};

  const developerHubMarkup=()=>`<section class="developer-app" data-developer><header class="suite-hero"><div><p class="section-kicker">Developer Hub 18</p><h4>Git, Releases & CI/CD</h4><span>Theo dõi repository, commits, package, changelog và tình trạng triển khai.</span></div><a class="button primary interactive" href="https://github.com/hoangdaika13/hoangdaika13.github.io" target="_blank" rel="noopener">Mở GitHub</a></header><div class="developer-metrics"><article><span>Branch</span><strong>main</strong><small>Production</small></article><article><span>GitHub Pages</span><strong data-dev-pages>Checking</strong><small>Frontend</small></article><article><span>Vercel API</span><strong data-dev-api>Checking</strong><small>Backend</small></article><article><span>Version</span><strong>v26</strong><small>Current UI</small></article></div><div class="developer-layout"><aside class="developer-nav">${[["overview","Overview"],["commits","Commits"],["releases","Releases"],["packages","Packages"],["pipeline","CI/CD"]].map(([id,label],index)=>`<button class="interactive ${index===0?"active":""}" type="button" data-dev-tab="${id}">${label}</button>`).join("")}<section><strong>Quick links</strong><a href="https://github.com/hoangdaika13/hoangdaika13.github.io/actions" target="_blank" rel="noopener">Actions</a><a href="https://vercel.com/" target="_blank" rel="noopener">Vercel</a><a href="https://cloud.mongodb.com/" target="_blank" rel="noopener">MongoDB</a></section></aside><main class="developer-workspace"><section class="dev-pane active" data-dev-pane="overview"><div class="repo-card"><span>PUBLIC REPOSITORY</span><h5>hoangdaika13/hoangdaika13.github.io</h5><p>Neon portfolio và super platform chạy GitHub Pages + Vercel + MongoDB.</p><div><b>HTML</b><b>CSS</b><b>JavaScript</b><b>MongoDB</b></div></div><div class="pipeline-view"><strong>Production pipeline</strong>${["Commit","Push main","GitHub Pages","Vercel Build","Production"].map((item,index)=>`<span class="active"><i>${index+1}</i>${item}</span>`).join("")}</div></section><section class="dev-pane" data-dev-pane="commits"><div class="commit-list" data-dev-commits><p>Đang tải commits từ GitHub...</p></div></section><section class="dev-pane" data-dev-pane="releases"><div class="release-board"><article><b>v25</b><strong>Automation, Creator, Analytics, Store & Cloud</strong><span>Production</span></article><article><b>v24</b><strong>Learning, Community, User & Admin</strong><span>Production</span></article><article><b>v23</b><strong>Project Center & Knowledge Wiki</strong><span>Production</span></article></div></section><section class="dev-pane" data-dev-pane="packages"><pre>{\n  "runtime": "Node.js",\n  "database": "MongoDB",\n  "auth": "JWT + bcrypt",\n  "hosting": ["GitHub Pages", "Vercel"]\n}</pre></section><section class="dev-pane" data-dev-pane="pipeline"><div class="pipeline-log" data-pipeline-log><p>✓ Source uploaded</p><p>✓ Dependencies installed</p><p>✓ Serverless functions built</p><p>✓ Production alias assigned</p></div></section></main></div></section>`;

  const securityCenterMarkup=()=>`<section class="security-app" data-security><header class="suite-hero"><div><p class="section-kicker">Security Center 19</p><h4>Bảo mật tài khoản</h4><span>Lịch sử đăng nhập, phiên, thiết bị, 2FA, quyền và audit logs cá nhân.</span></div><div class="security-score"><strong data-security-score>72</strong><span>Security score</span></div></header><div class="security-alert" data-security-alert><i></i><div><strong>Khuyến nghị bật xác thực hai bước</strong><span>2FA cần provider OTP trước khi có thể kích hoạt thật.</span></div></div><div class="security-layout"><aside class="security-nav">${[["overview","Tổng quan"],["history","Lịch sử đăng nhập"],["sessions","Phiên & thiết bị"],["permissions","Quyền dữ liệu"],["audit","Audit logs"]].map(([id,label],index)=>`<button class="interactive ${index===0?"active":""}" type="button" data-security-tab="${id}">${label}</button>`).join("")}</aside><main class="security-workspace"><section class="security-pane active" data-security-pane="overview"><div class="security-checks">${[["Mật khẩu tài khoản","Đã thiết lập","safe"],["Email đăng nhập","Đã xác minh phiên","safe"],["Xác thực hai bước","Chưa cấu hình","warn"],["Phiên hiện tại","Đang hoạt động","safe"]].map((item)=>`<article class="${item[2]}"><i></i><div><strong>${item[0]}</strong><span>${item[1]}</span></div></article>`).join("")}</div><button class="button ghost interactive" type="button" data-security-check>Kiểm tra lại tài khoản</button></section><section class="security-pane" data-security-pane="history"><div class="login-history" data-login-history><p>Đang tải lịch sử đăng nhập...</p></div></section><section class="security-pane" data-security-pane="sessions"><article class="current-session"><span>THIẾT BỊ HIỆN TẠI</span><strong>${escapeHtml(navigator.platform||"Thiết bị")}</strong><p>${escapeHtml(navigator.userAgent)}</p><button class="interactive" type="button" data-security-logout>Đăng xuất phiên này</button></article></section><section class="security-pane" data-security-pane="permissions"><div class="permission-list">${["Lưu hồ sơ cá nhân","Lưu lịch sử module","Thông báo trong ứng dụng","Analytics cục bộ"].map((item,index)=>`<label><span>${item}</span><input type="checkbox" data-security-permission="${index}" checked><i></i></label>`).join("")}</div></section><section class="security-pane" data-security-pane="audit"><pre data-security-audit>Audit logs chỉ hiển thị hành động thuộc tài khoản hiện tại.</pre></section></main></div></section>`;

  const smartSearchMarkup=()=>`<section class="smart-search-app" data-smart-search><header class="smart-search-hero"><p class="section-kicker">Smart Search 20</p><h4>Tìm kiếm toàn bộ HH Platform</h4><label><span>⌕</span><input type="search" data-smart-query placeholder="Tìm dự án, Wiki, media, module, file hoặc cài đặt..." autofocus><kbd>Ctrl K</kbd></label><div>${["AI","Projects","Downloads","Wiki","Media","Settings"].map((item)=>`<button class="interactive" type="button" data-smart-suggestion="${item}">${item}</button>`).join("")}</div></header><div class="smart-search-layout"><aside class="smart-search-filters">${[["all","Tất cả"],["module","Modules"],["project","Projects"],["article","Wiki"],["media","Media"],["file","Files"]].map(([id,label],index)=>`<button class="interactive ${index===0?"active":""}" type="button" data-smart-filter="${id}">${label}<b data-smart-filter-count="${id}"></b></button>`).join("")}<section><strong>Tìm gần đây</strong><div data-smart-history><p>Chưa có tìm kiếm.</p></div></section></aside><main class="smart-results"><header><div><span>Kết quả</span><strong data-smart-summary>Nhập từ khóa để bắt đầu</strong></div><select data-smart-sort><option value="relevance">Liên quan nhất</option><option value="name">Theo tên</option><option value="type">Theo loại</option></select></header><div data-smart-results><div class="smart-empty"><span>⌕</span><strong>Một ô tìm kiếm cho toàn website</strong><p>Kết quả được lập chỉ mục trực tiếp từ dữ liệu của bạn.</p></div></div></main><aside class="smart-preview"><header><strong>Xem nhanh</strong></header><div data-smart-preview><p>Chọn một kết quả để xem chi tiết.</p></div></aside></div></section>`;
  const appLauncherMarkup=()=>`<section class="suite-app" data-app-launcher><header class="suite-hero"><div><p class="section-kicker">App Launcher 21</p><h4>Mở công cụ nhanh</h4><span>Tìm, ghim và mở workspace thật từ danh sách module.</span></div></header><label class="suite-search">Tìm ứng dụng<input data-launcher-query placeholder="AI, Media, Project..."></label><div class="suite-card-grid" data-launcher-list>${modules.slice(0,16).map(item=>`<button class="interactive" type="button" data-launcher-open="${item.id}"><b>${escapeHtml(item.title)}</b><span>${escapeHtml(item.features?.slice(0,2).join(" · ")||"")}</span></button>`).join("")}</div></section>`;
  const widgetsEngineMarkup=()=>`<section class="suite-app" data-widgets-engine><header class="suite-hero"><div><p class="section-kicker">Widgets Engine 22</p><h4>Bảng widget cá nhân</h4><span>Bật/tắt và lưu bố cục nhanh trên thiết bị này.</span></div><button class="button ghost interactive" type="button" data-widgets-reset>Khôi phục</button></header><div class="suite-card-grid">${[["clock","Đồng hồ"],["notes","Ghi chú"],["weather","Thời tiết"],["activity","Hoạt động"]].map(([id,label])=>`<label class="interactive"><input type="checkbox" data-widget-toggle="${id}" checked>${label}<small>Lưu local</small></label>`).join("")}</div><pre data-widgets-output>Chọn widget để tùy chỉnh dashboard.</pre></section>`;
  const marketplaceMarkup=()=>`<section class="suite-app" data-marketplace><header class="suite-hero"><div><p class="section-kicker">Marketplace 23</p><h4>Kho tiện ích HH</h4><span>Cài/gỡ plugin cục bộ và áp dụng ngay cho workspace.</span></div></header><div class="suite-card-grid">${[["neon-theme","Neon Theme","Giao diện neon"],["creator-pack","Creator Pack","Prompt & template"],["focus-mode","Focus Mode","Chế độ tập trung"]].map(([id,title,desc])=>`<article><b>${title}</b><span>${desc}</span><button class="button primary interactive" type="button" data-market-install="${id}">Cài đặt</button></article>`).join("")}</div><p data-market-status>Chưa có tiện ích được cài.</p></section>`;
  const mobilePwaMarkup=()=>`<section class="suite-app" data-mobile-pwa><header class="suite-hero"><div><p class="section-kicker">Mobile/PWA 24</p><h4>Trải nghiệm di động</h4><span>Kiểm tra trạng thái mạng, lưu offline và cài web app khi trình duyệt hỗ trợ.</span></div></header><div class="suite-card-grid"><article><b>Trạng thái mạng</b><strong data-pwa-network>${navigator.onLine?"Online":"Offline"}</strong></article><article><b>Offline cache</b><strong data-pwa-cache>Chưa kiểm tra</strong></article></div><div class="suite-actions"><button class="button primary interactive" type="button" data-pwa-check>Kiểm tra PWA</button><button class="button ghost interactive" type="button" data-pwa-install>Cài ứng dụng</button></div><p data-pwa-status>Sẵn sàng kiểm tra.</p></section>`;
  const uiKitMarkup=()=>`<section class="suite-app" data-ui-kit><header class="suite-hero"><div><p class="section-kicker">Modern UI Kit 25</p><h4>Tùy chỉnh giao diện</h4><span>Áp dụng ngay các tùy chọn hiển thị và lưu trên thiết bị.</span></div></header><div class="suite-card-grid">${[["compact","Mật độ gọn"],["contrast","Tương phản cao"],["motion","Giảm chuyển động"]].map(([id,label])=>`<label class="interactive"><input type="checkbox" data-ui-option="${id}">${label}<small>Áp dụng ngay</small></label>`).join("")}</div><button class="button primary interactive" type="button" data-ui-save>Lưu giao diện</button><p data-ui-status>Chưa lưu thay đổi.</p></section>`;

  const moduleStudioMarkup = (module) => {
    const profile = profileFor(module);
    const stored = JSON.parse(localStorage.getItem(`${stateKey}:${module.id}:studio`) || "null") || {};
    const created = stored.created || 0;
    const savedItems = stored.items || profile.items || [];
    return `
      <section class="module-studio-app" data-module-studio="${module.id}">
        <div class="studio-hero">
          <div>
            <p class="section-kicker">${String(module.order || "").padStart(2, "0")} Studio</p>
            <h4>${escapeHtml(profile.subject)}</h4>
            <span>${escapeHtml(profile.sample)}</span>
          </div>
          <div class="studio-score">
            <strong>${String(created).padStart(2, "0")}</strong>
            <span>mục đã tạo</span>
          </div>
        </div>
        <div class="studio-grid">
          <article class="studio-panel studio-metrics">
            ${(profile.metrics || []).slice(0, 3).map((metric, index) => `
              <span><strong>${String((stored.metricBase || 7) + index * 3).padStart(2, "0")}</strong>${escapeHtml(metric)}</span>
            `).join("")}
          </article>
          <article class="studio-panel">
            <header><strong>Quick Builder</strong><button class="interactive" type="button" data-studio-action="generate" data-studio-module="${module.id}">${escapeHtml(profile.verb)}</button></header>
            <textarea data-studio-input="${module.id}" rows="5" placeholder="${escapeHtml(profile.sample)}">${escapeHtml(stored.input || profile.sample)}</textarea>
            <div class="studio-actions">
              <button class="interactive" type="button" data-studio-action="save" data-studio-module="${module.id}">Lưu</button>
              <button class="interactive" type="button" data-studio-action="export" data-studio-module="${module.id}">Export</button>
              <button class="interactive" type="button" data-studio-action="google" data-studio-module="${module.id}">Google</button>
            </div>
          </article>
          <article class="studio-panel">
            <header><strong>Preview / Items</strong><button class="interactive" type="button" data-studio-action="clear" data-studio-module="${module.id}">Dọn</button></header>
            <div class="studio-preview" data-studio-preview="${module.id}">
              ${(savedItems || []).slice(0, 5).map((item, index) => `<p><b>${String(index + 1).padStart(2, "0")}</b>${escapeHtml(item.text || item)}</p>`).join("")}
            </div>
          </article>
        </div>
      </section>
    `;
  };

  const downloadCenterMarkup = () => {
    let history = [];
    try { history = JSON.parse(localStorage.getItem("hh-download-history") || "[]"); } catch { history = []; }
    const historyMarkup = history.slice(0, 6).map((item) => `
      <button class="download-history-item interactive" type="button" data-download-history-url="${escapeHtml(item.url)}">
        <span>${escapeHtml(item.platform || "Link")}</span>
        <strong>${escapeHtml(item.title || item.url)}</strong>
        <small>${escapeHtml(item.time || "")}</small>
      </button>`).join("");
    return `
      <section class="social-downloader" data-social-downloader>
        <div class="downloader-hero">
          <div>
            <p class="section-kicker">HH Social Downloader</p>
            <h4>Tải media từ liên kết</h4>
            <span>Dán link công khai, chọn MP4/MP3 và chất lượng. Chỉ tải nội dung bạn sở hữu hoặc được phép sử dụng.</span>
          </div>
          <div class="downloader-live"><i></i><strong data-download-service>Đang kiểm tra</strong><span>dịch vụ tải</span></div>
        </div>
        <div class="downloader-platforms" aria-label="Nền tảng hỗ trợ">
          ${["YouTube", "TikTok", "Facebook", "Instagram", "X / Twitter", "Reddit", "Vimeo", "SoundCloud"].map((name) => `<span>${name}</span>`).join("")}
        </div>
        <form class="downloader-form" data-download-form>
          <label class="download-url-field">
            <span>Liên kết video / bài đăng</span>
            <div><input data-download-url type="url" inputmode="url" autocomplete="url" placeholder="https://www.youtube.com/watch?v=..." required><button class="interactive" type="button" data-download-paste>Dán</button></div>
          </label>
          <div class="download-options">
            <label>Định dạng<select data-download-mode><option value="auto">MP4 video</option><option value="audio">MP3 âm thanh</option><option value="mute">Video không tiếng</option></select></label>
            <label>Chất lượng<select data-download-quality><option value="max">Tốt nhất</option><option value="2160">4K / 2160p</option><option value="1080" selected>Full HD / 1080p</option><option value="720">HD / 720p</option><option value="480">480p</option><option value="360">360p</option></select></label>
            <label>Âm thanh<select data-download-audio><option value="320">320 kbps</option><option value="256">256 kbps</option><option value="128" selected>128 kbps</option></select></label>
            <label class="download-check"><input data-download-playlist type="checkbox"><span>Tải playlist / album</span></label>
          </div>
          <div class="download-primary-actions">
            <button class="button ghost interactive" type="button" data-download-analyze>Kiểm tra link</button>
            <button class="button primary interactive" type="submit" data-download-submit>Tạo bản tải</button>
          </div>
        </form>
        <div class="downloader-workspace">
          <article class="download-preview" data-download-preview>
            <div class="download-placeholder"><span>URL</span><strong>Dán một liên kết để bắt đầu</strong><p>Trang sẽ nhận diện nền tảng và chuẩn bị lựa chọn tải phù hợp.</p></div>
          </article>
          <aside class="download-queue">
            <header><div><span>Hàng đợi</span><strong data-download-count>0 mục</strong></div><button class="interactive" type="button" data-download-clear>Xóa lịch sử</button></header>
            <div data-download-history>${historyMarkup || "<p>Chưa có lượt tải trên thiết bị này.</p>"}</div>
          </aside>
        </div>
      </section>`;
  };

  const filteredModules = () => {
    const query = (search?.value || "").trim().toLowerCase();
    return modules.filter((module) => {
      if (activeFilter === "backend" && !module.requiresBackend) return false;
      if (activeFilter === "core" && module.group !== "core") return false;
      if (activeFilter === "extension" && module.group !== "extension") return false;
      if (activeFilter === "favorite" && !favorites.includes(module.id)) return false;
      return !query || textOf(module).includes(query);
    });
  };

  const moduleDemoText = (module, input) => {
    const mode = actionMode?.value || (module.features || [])[0] || "run";
    const features = (module.features || []).slice(0, 9);
    const backendNote = module.requiresBackend
      ? "\n\nBackend thật cần có: database, auth, role, logs, sync API và bảo mật trước khi dùng cho nhiều người."
      : "\n\nChế độ hiện tại: chạy client-side trong HTML và có thể lưu localStorage.";
    return [
      `${String(module.order || "").padStart(2, "0")}. ${module.title}`,
      "",
      `Chức năng đang chạy: ${mode}`,
      "",
      `Mô tả: ${module.description}`,
      "",
      "Các bước xử lý như một module thật:",
      `1. Nhận dữ liệu từ ô nhập và chế độ "${mode}".`,
      "2. Tạo output/checklist có thể dùng ngay.",
      "3. Lưu localStorage để không mất dữ liệu khi tải lại.",
      "4. Nếu backend đã cấu hình, gửi action/item lên MongoDB.",
      "",
      "Checklist mở rộng:",
      ...features.map((feature, index) => `${index + 1}. ${feature}: UI + state + action + dữ liệu mẫu.`),
      "",
      "Dữ liệu bạn nhập:",
      input || "Chưa nhập dữ liệu.",
      "",
      "Output gợi ý:",
      `- ${mode}: ${input ? "đã nhận dữ liệu và sẵn sàng xử lý" : "hãy nhập dữ liệu cụ thể hơn để output chính xác hơn"}.`,
      `- ${module.title} có thể lưu, tải lịch sử và export JSON như một mini app.`,
      "- Những chức năng cần provider thật sẽ dùng chung giao diện này nhưng gọi API/provider riêng sau."
    ].join("\n") + backendNote;
  };

  const renderItems = (items = []) => {
    if (!itemList) return;
    if (!items.length) {
      itemList.innerHTML = "<p>Chưa có dữ liệu đã lưu cho module này.</p>";
      return;
    }
    itemList.innerHTML = items.slice(0, 8).map((item) => `
      <article>
        <strong>${item.title || item.type || "Module item"}</strong>
        <span>${new Date(item.createdAt || item.savedAt || Date.now()).toLocaleString("vi-VN")}</span>
        <p>${(item.data?.input || item.data?.output || item.input || "").toString().slice(0, 180)}</p>
      </article>
    `).join("");
  };

  const renderDetail = (module) => {
    if (!module) return;
    selectedModule = module;
    if (detailTitle) detailTitle.textContent = `${String(module.order || "").padStart(2, "0")}. ${module.title}`;
    if (detailDescription) detailDescription.textContent = module.description;
    if (detailMeta) {
      detailMeta.innerHTML = `
        <span>${module.group === "core" ? "Nhóm lõi" : "Nhóm mở rộng"}</span>
        <span>${module.status || "planned"}</span>
        <span>${module.requiresBackend ? "Cần backend thật" : "Chạy local trong HTML"}</span>
        <button class="module-fav-toggle interactive" type="button" data-module-fav="${module.id}">${favorites.includes(module.id) ? "Bỏ yêu thích" : "Yêu thích"}</button>`;
    }
    if (detailFeatures) detailFeatures.innerHTML = (module.features || []).map((feature) => `<span>${feature}</span>`).join("");
    if (toolGrid) {
      toolGrid.innerHTML = (module.features || []).slice(0, 12).map((feature, index) => `
        <button class="module-tool-button interactive" type="button" data-module-tool="${feature}">
          <span>${String(index + 1).padStart(2, "0")}</span>${feature}
        </button>
      `).join("");
    }
    if (actionMode) {
      actionMode.innerHTML = (module.features || ["Run"]).slice(0, 12).map((feature) => `<option value="${feature}">${feature}</option>`).join("");
    }
    if (itemTitle && !itemTitle.value) itemTitle.value = `${module.title} item`;
    if (statusField) statusField.value = module.requiresBackend ? "backend-ready" : "local-ready";
    const saved = JSON.parse(localStorage.getItem(stateKey) || "{}")[module.id];
    if (demoInput) demoInput.value = saved?.input || "";
    if (demoOutput) demoOutput.textContent = saved?.output || moduleDemoText(module, saved?.input || "");
    renderItems(saved?.history || []);
  };

  const render = () => {
    const visible = filteredModules();
    if (!modules.length) {
      grid.innerHTML = `
        <article class="module-card skeleton-card">
          <span class="module-number">00</span>
          <p class="project-tag">Chưa có dữ liệu</p>
          <h3>Đang chờ module registry</h3>
          <p>Khi file config/modules.config.js sẵn sàng, các module sẽ tự hiển thị tại đây.</p>
        </article>`;
      return;
    }

    grid.innerHTML = visible.map((module, index) => {
      const quickState = moduleStateFor(module.id);
      const featureCount = (module.features || []).length;
      const doneSteps = Object.values(quickState.steps || {}).filter(Boolean).length;
      const progress = featureCount ? Math.round((doneSteps / Math.min(featureCount, 4)) * 100) : 0;
      const activity = (quickState.activity || []).slice(0, 4);
      return `
      <article class="module-card module-row interactive-card ${selectedModule?.id === module.id ? "active" : ""}" data-module-id="${module.id}" style="--module-accent:${module.accent || "#ff3bd4"}">
        <div class="module-row-head">
          <span class="module-number">${String(module.order || index + 1).padStart(2, "0")}</span>
          <div>
            <p class="project-tag">${module.group === "core" ? "Lõi" : "Mở rộng"}</p>
            <h3>${escapeHtml(module.title)}</h3>
            <p>${escapeHtml(module.description)}</p>
          </div>
          <button class="module-card-fav interactive" type="button" data-module-fav="${module.id}" aria-label="Yêu thích ${escapeHtml(module.title)}">${favorites.includes(module.id) ? "♥" : "♡"}</button>
        </div>
        <div class="module-row-body">
          <div class="module-function-panel">
            <div class="module-quick-head">
              <div>
                <p class="section-kicker">Sử dụng nhanh</p>
                <strong>${escapeHtml(module.title)}</strong>
              </div>
              <span>${module.requiresBackend ? "API" : "LOCAL"}</span>
            </div>
            <div class="module-quick-stats">
              <span><b>${String(featureCount).padStart(2, "0")}</b> chức năng</span>
              <span><b>${favorites.includes(module.id) ? "ON" : "OFF"}</b> yêu thích</span>
              <span><b>${progress}%</b> tiến độ</span>
            </div>
            <div class="module-progress-card">
              <div>
                <strong>Tiến độ sử dụng</strong>
                <span>${doneSteps}/${Math.min(featureCount, 4)} bước đã tick</span>
              </div>
              <i style="--progress:${Math.max(4, progress)}%"></i>
            </div>
            <div class="module-features full">
              ${(module.features || []).map((feature, featureIndex) => `
                <button class="module-feature-chip interactive" type="button" data-inline-feature="${escapeHtml(feature)}" data-inline-module="${module.id}">
                  <span>${String(featureIndex + 1).padStart(2, "0")}</span>${escapeHtml(feature)}
                </button>
              `).join("")}
            </div>
            <div class="module-playbook">
              <strong>Quy trình dùng ngay</strong>
              ${(module.features || []).slice(0, 4).map((feature, stepIndex) => `
                <label>
                  <input type="checkbox" data-module-step="${module.id}:${stepIndex}" ${quickState.steps?.[stepIndex] ? "checked" : ""}>
                  <span>${escapeHtml(feature)} đã sẵn sàng</span>
                </label>
              `).join("")}
            </div>
            <div class="module-note-card">
              <label>
                Ghi chú nhanh
                <textarea data-module-note="${module.id}" rows="3" placeholder="Ghi mục tiêu, link, ý tưởng hoặc dữ liệu cần xử lý...">${escapeHtml(quickState.note || "")}</textarea>
              </label>
              <button class="interactive" type="button" data-module-save-note="${module.id}">Lưu ghi chú</button>
            </div>
            <div class="module-quick-actions">
              <button class="interactive" type="button" data-inline-run="${module.id}">Chạy demo</button>
              <button class="interactive" type="button" data-inline-open="${module.id}">Workspace</button>
              <button class="interactive" type="button" data-inline-google="${module.id}">Google</button>
            </div>
            <div class="module-activity-feed" data-module-activity="${module.id}">
              <strong>Hoạt động gần đây</strong>
              ${activity.length ? activity.map((item) => `<p>${escapeHtml(item)}</p>`).join("") : "<p>Chưa có hoạt động. Bấm chức năng hoặc lưu ghi chú để bắt đầu.</p>"}
            </div>
            <div class="module-row-meta">
              <span>${escapeHtml(module.status || "planned")}</span>
              <span>${module.requiresBackend ? "Backend + MongoDB" : "Client-side + localStorage"}</span>
              <span>Cập nhật: <b data-module-now="${module.id}">--:--:--</b></span>
            </div>
          </div>
          <div class="module-inline-app" data-inline-app="${module.id}">
            ${module.id === "command-center" ? commandCenterMarkup(module) : module.id === "ai-center" ? aiCenterMarkup(module) : module.id === "download-center" ? downloadCenterMarkup(module) : module.id === "media-center" ? mediaCenterMarkup(module) : module.id === "project-center" ? projectCenterMarkup(module) : module.id === "knowledge-center" ? knowledgeCenterMarkup(module) : module.id === "learning-center" ? learningCenterMarkup(module) : module.id === "community" ? communityCenterMarkup(module) : module.id === "user-dashboard" ? userDashboardMarkup(module) : module.id === "admin-panel" ? adminPanelMarkup(module) : module.id === "ai-automation" ? aiAutomationMarkup(module) : module.id === "creator-studio" ? creatorStudioMarkup(module) : module.id === "analytics" ? analyticsMarkup(module) : module.id === "store" ? storeMarkup(module) : module.id === "cloud-storage" ? cloudStorageMarkup(module) : module.id === "notification-center" ? notificationCenterMarkup(module) : module.id === "api-center" ? apiCenterMarkup(module) : module.id === "developer-hub" ? developerHubMarkup(module) : module.id === "security-center" ? securityCenterMarkup(module) : module.id === "smart-search" ? smartSearchMarkup(module) : module.id === "app-launcher" ? appLauncherMarkup(module) : module.id === "widgets-engine" ? widgetsEngineMarkup(module) : module.id === "marketplace" ? marketplaceMarkup(module) : module.id === "mobile-pwa" ? mobilePwaMarkup(module) : module.id === "modern-ui-kit" ? uiKitMarkup(module) : moduleStudioMarkup(module)}
            <label>
              Dữ liệu dùng nhanh
              <textarea data-inline-input="${module.id}" rows="4" placeholder="Nhập yêu cầu cho ${escapeHtml(module.title)}..."></textarea>
            </label>
            <div class="module-inline-actions">
              <button class="button primary interactive" type="button" data-inline-run="${module.id}">Chạy ngay</button>
              <button class="button ghost interactive" type="button" data-inline-google="${module.id}">Tìm Google</button>
              <button class="button ghost interactive" type="button" data-inline-save="${module.id}">Lưu local</button>
              <button class="button ghost interactive" type="button" data-inline-open="${module.id}">Mở workspace</button>
            </div>
            <pre class="module-inline-output" data-inline-output="${module.id}">${escapeHtml(moduleDemoText(module, ""))}</pre>
          </div>
        </div>
      </article>
    `;
    }).join("");

    if (visible.some((module) => module.id === "download-center")) checkDownloadService();
    if (visible.some((module) => module.id === "knowledge-center")) updateWikiPreview();
    if (visible.some((module) => module.id === "admin-panel")) loadAdminSummary();
    if (visible.some((module) => module.id === "store")) loadStoreProducts();
    if (visible.some((module) => module.id === "cloud-storage")) loadCloudFiles();
    if (visible.some((module) => module.id === "developer-hub")) loadDeveloperData();
    if (visible.some((module) => module.id === "security-center")) loadSecurityData();
    if (visible.some((module) => module.id === "smart-search")) updateSmartIndex();
    if (visible.some((module) => module.id === "community")) loadCommunityFeed();
    if (visible.some((module) => module.id === "media-center")) hydrateMediaLibrary();
    if (visible.some((module) => module.id === "command-center")) requestAnimationFrame(() => {
      const center = grid.querySelector("[data-command-center]");
      center?.querySelector("[data-command-server]")?.click();
      if (center?.querySelector("[data-command-weather-output] .command-widget-empty")) center.querySelector("[data-command-weather]")?.click();
    });
    window.HHExtensionSuite?.mount?.(grid, visible);
    if (!selectedModule && modules.length) renderDetail(modules[0]);
  };

  const updateCounters = () => {
    setCounter(total, modules.length);
    setCounter(core, modules.filter((module) => module.group === "core").length);
    setCounter(backend, modules.filter((module) => module.requiresBackend).length);
  };

  filters.forEach((button) => {
    button.addEventListener("click", () => {
      filters.forEach((item) => item.classList.remove("active"));
      button.classList.add("active");
      activeFilter = button.dataset.moduleFilter || "all";
      render();
    });
  });

  search?.addEventListener("input", render);

  const toggleFavorite = (id) => {
    favorites = favorites.includes(id) ? favorites.filter((item) => item !== id) : [...favorites, id];
    persistFavorites();
  };

  const logModuleActivity = (moduleId, message) => {
    const allState = readPlatformState();
    const current = allState[moduleId] || {};
    const stamp = new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    const activity = [`${stamp} · ${message}`, ...(current.activity || [])].slice(0, 12);
    allState[moduleId] = { ...current, activity };
    writePlatformState(allState);
    const feed = grid.querySelector(`[data-module-activity="${CSS.escape(moduleId)}"]`);
    if (feed) {
      feed.innerHTML = `<strong>Hoạt động gần đây</strong>${activity.slice(0, 4).map((item) => `<p>${escapeHtml(item)}</p>`).join("")}`;
    }
  };

  const updateModuleProgress = (moduleId) => {
    const module = modules.find((item) => item.id === moduleId);
    const card = grid.querySelector(`[data-module-id="${CSS.escape(moduleId)}"]`);
    if (!module || !card) return;
    const state = moduleStateFor(moduleId);
    const maxSteps = Math.min((module.features || []).length, 4) || 1;
    const doneSteps = Object.values(state.steps || {}).filter(Boolean).length;
    const progress = Math.round((doneSteps / maxSteps) * 100);
    const progressCard = card.querySelector(".module-progress-card");
    const progressBar = progressCard?.querySelector("i");
    const progressText = progressCard?.querySelector("span");
    const stat = card.querySelector(".module-quick-stats span:nth-child(3) b");
    if (progressBar) progressBar.style.setProperty("--progress", `${Math.max(4, progress)}%`);
    if (progressText) progressText.textContent = `${doneSteps}/${maxSteps} bước đã tick`;
    if (stat) stat.textContent = `${progress}%`;
  };

  const openModuleWorkspace = (module, feature = "") => {
    const card = grid.querySelector(`[data-module-id="${CSS.escape(module.id)}"]`);
    const input = card?.querySelector(`[data-inline-input="${CSS.escape(module.id)}"]`);
    const output = card?.querySelector(`[data-inline-output="${CSS.escape(module.id)}"]`);
    if (input) input.value = `${feature ? `${feature}: ` : ""}${input.value.trim() || profileFor(module).sample}`;
    if (output) output.textContent = moduleDemoText(module, input?.value || feature);
    card?.querySelector(`[data-inline-app="${CSS.escape(module.id)}"]`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    logModuleActivity(module.id, `${feature || "Workspace"} đã sẵn sàng để thao tác`);
  };

  grid.addEventListener("click", (event) => {
    const favoriteButton = event.target.closest("[data-module-fav]");
    if (favoriteButton) {
      toggleFavorite(favoriteButton.dataset.moduleFav);
      if (selectedModule?.id === favoriteButton.dataset.moduleFav) renderDetail(selectedModule);
      render();
      return;
    }

    if (event.target.closest("button, input, textarea, select, a, label")) return;
    const card = event.target.closest("[data-module-id]");
    if (!card) return;
    renderDetail(modules.find((item) => item.id === card.dataset.moduleId));
  });

  grid.addEventListener("click", (event) => {
    const featureButton = event.target.closest("[data-inline-feature]");
    const runButton = event.target.closest("[data-inline-run]");
    const googleButton = event.target.closest("[data-inline-google]");
    const saveButton = event.target.closest("[data-inline-save]");
    const openButton = event.target.closest("[data-inline-open]");
    const noteButton = event.target.closest("[data-module-save-note]");
    const moduleId = featureButton?.dataset.inlineModule || runButton?.dataset.inlineRun || googleButton?.dataset.inlineGoogle || saveButton?.dataset.inlineSave || openButton?.dataset.inlineOpen || noteButton?.dataset.moduleSaveNote;
    if (!moduleId) return;
    const module = modules.find((item) => item.id === moduleId);
    if (!module) return;
    const input = grid.querySelector(`[data-inline-input="${CSS.escape(moduleId)}"]`);
    const output = grid.querySelector(`[data-inline-output="${CSS.escape(moduleId)}"]`);
    if (noteButton) {
      const allState = readPlatformState();
      const note = grid.querySelector(`[data-module-note="${CSS.escape(moduleId)}"]`)?.value || "";
      allState[moduleId] = { ...(allState[moduleId] || {}), note, savedAt: new Date().toISOString() };
      writePlatformState(allState);
      logModuleActivity(moduleId, "Đã lưu ghi chú nhanh");
      return;
    }
    if (featureButton) {
      if (actionMode) actionMode.value = featureButton.dataset.inlineFeature;
      openModuleWorkspace(module, featureButton.dataset.inlineFeature);
      return;
    }
    if (runButton) {
      renderDetail(module);
      if (output) output.textContent = moduleDemoText(module, input?.value || "");
      logModuleActivity(moduleId, "Chạy demo nhanh");
      return;
    }
    if (googleButton) {
      const query = `${module.title} ${(input?.value || "").trim() || (module.features || []).join(" ")}`;
      window.open(`https://www.google.com/search?q=${encodeURIComponent(query)}`, "_blank", "noopener");
      logModuleActivity(moduleId, "Mở tìm kiếm Google");
      return;
    }
    if (saveButton) {
      const allState = readPlatformState();
      const saved = {
        title: module.title,
        input: input?.value || "",
        output: output?.textContent || moduleDemoText(module, input?.value || ""),
        savedAt: new Date().toISOString()
      };
      allState[module.id] = {
        ...(allState[module.id] || {}),
        ...saved,
        history: [saved, ...(allState[module.id]?.history || [])].slice(0, 20)
      };
      writePlatformState(allState);
      if (output) output.textContent = `${saved.output}\n\n[Đã lưu nhanh local lúc ${new Date().toLocaleTimeString("vi-VN")}]`;
      logModuleActivity(moduleId, "Đã lưu output local");
      return;
    }
    if (openButton) {
      openModuleWorkspace(module, "Workspace");
    }
  });

  const logCommandActivity = (message) => {
    const state = readCommandCenterState();
    const stamp = new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
    state.activity = [`${stamp} · ${message}`, ...(state.activity || [])].slice(0, 20);
    writeCommandCenterState(state);
    const activity = grid.querySelector("[data-command-activity]");
    if (activity) activity.innerHTML = state.activity.slice(0, 6).map((item, index) => `<p><i>${index === 0 ? "✦" : "•"}</i><span>${escapeHtml(item)}</span></p>`).join("");
  };

  const renderCommandTodos = () => {
    const state = readCommandCenterState();
    const list = grid.querySelector("[data-command-todos]");
    if (!list) return;
    const todos = state.todos || [];
    list.innerHTML = todos.slice(0, 8).map(commandTodoMarkup).join("") || `<div class="command-widget-empty"><i>✓</i><span>Chưa có công việc. Thêm việc đầu tiên ở phía trên.</span></div>`;
    const completed = todos.filter((todo) => todo.done).length;
    const progress = todos.length ? Math.round(completed / todos.length * 100) : 0;
    grid.querySelectorAll("[data-command-progress-bar],[data-command-overview-bar]").forEach((node) => { node.style.width = `${progress}%`; });
    const label = grid.querySelector("[data-command-progress-label]");
    if (label) label.textContent = `${progress}% hoàn thành`;
    const overview = grid.querySelector("[data-command-overview-progress]");
    if (overview) overview.textContent = `${progress}%`;
    const remaining = grid.querySelector("[data-command-overview-remaining]");
    if (remaining) remaining.textContent = `${todos.length - completed} việc còn lại`;
  };

  let commandNoteSaveTimer = 0;
  grid.addEventListener("input", (event) => {
    const notes = event.target.closest("[data-command-notes]");
    if (!notes) return;
    const counter = grid.querySelector("[data-command-note-count]");
    if (counter) counter.textContent = `${notes.value.length} ký tự · đang tự lưu`;
    clearTimeout(commandNoteSaveTimer);
    commandNoteSaveTimer = setTimeout(() => {
      const state = readCommandCenterState();
      state.notes = notes.value;
      writeCommandCenterState(state);
      if (counter) counter.textContent = `${notes.value.length} ký tự · đã lưu`;
    }, 450);
  });

  grid.addEventListener("submit", (event) => {
    const form = event.target.closest("[data-command-google-form]");
    if (!form) return;
    event.preventDefault();
    form.querySelector("[data-command-google]")?.click();
  });

  grid.addEventListener("click", async (event) => {
    const saveNotes = event.target.closest("[data-command-save-notes]");
    const addTodo = event.target.closest("[data-command-add-todo]");
    const removeTodo = event.target.closest("[data-command-remove-todo]");
    const google = event.target.closest("[data-command-google]");
    const weather = event.target.closest("[data-command-weather]");
    const server = event.target.closest("[data-command-server]");
    const clearActivity = event.target.closest("[data-command-clear-activity]");

    if (saveNotes) {
      const state = readCommandCenterState();
      state.notes = grid.querySelector("[data-command-notes]")?.value || "";
      writeCommandCenterState(state);
      logCommandActivity("Đã lưu ghi chú");
      return;
    }
    if (addTodo) {
      const input = grid.querySelector("[data-command-todo-input]");
      const text = (input?.value || "").trim();
      if (!text) return;
      const state = readCommandCenterState();
      state.todos = [{ text, done: false }, ...(state.todos || [])].slice(0, 18);
      writeCommandCenterState(state);
      if (input) input.value = "";
      renderCommandTodos();
      logCommandActivity(`Thêm todo: ${text}`);
      return;
    }
    if (removeTodo) {
      const state = readCommandCenterState();
      state.todos = (state.todos || []).filter((_, index) => index !== Number(removeTodo.dataset.commandRemoveTodo));
      writeCommandCenterState(state);
      renderCommandTodos();
      logCommandActivity("Đã xóa todo");
      return;
    }
    if (google) {
      const query = (grid.querySelector("[data-command-search]")?.value || "").trim() || "tin tức AI hôm nay";
      if (window.HHSearchWatch?.open) window.HHSearchWatch.open("google", query);
      else window.open(`https://www.google.com/search?q=${encodeURIComponent(query)}`, "_blank", "noopener");
      logCommandActivity(`Tìm Google: ${query}`);
      return;
    }
    if (weather) {
      const output = grid.querySelector("[data-command-weather-output]");
      if (output) output.textContent = "Đang tải thời tiết...";
      try {
        const weatherUrl = "https://api.open-meteo.com/v1/forecast?latitude=21.0285&longitude=105.8542&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,weather_code,wind_speed_10m,surface_pressure&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,sunrise,sunset,uv_index_max&timezone=Asia%2FBangkok&forecast_days=7";
        const airUrl = "https://air-quality-api.open-meteo.com/v1/air-quality?latitude=21.0285&longitude=105.8542&current=us_aqi,pm2_5,pm10&timezone=Asia%2FBangkok";
        const [weatherResponse, airResponse] = await Promise.all([fetch(weatherUrl), fetch(airUrl)]);
        if (!weatherResponse.ok || !airResponse.ok) throw new Error("Dịch vụ thời tiết chưa phản hồi");
        const [data, air] = await Promise.all([weatherResponse.json(), airResponse.json()]);
        const current = data.current || {};
        const aqi = air.current?.us_aqi ?? 0;
        if (output) output.innerHTML = `<div class="command-weather-main"><i>${current.is_day ? "☀" : "☾"}</i><div><strong>${Math.round(current.temperature_2m ?? 0)}°C</strong><span>Hà Nội · Cảm giác ${Math.round(current.apparent_temperature ?? 0)}°</span></div></div><div class="command-weather-metrics"><span><b>${Math.round(current.relative_humidity_2m ?? 0)}%</b>Độ ẩm</span><span><b>${Math.round(current.wind_speed_10m ?? 0)} km/h</b>Gió</span><span><b>AQI ${Math.round(aqi)}</b>Không khí</span><span><b>${Math.round(current.surface_pressure ?? 0)} hPa</b>Áp suất</span></div>`;
        localStorage.setItem("hh.dashboard.weather.v1", JSON.stringify({ payload: { weather: data, air, savedAt: Date.now() }, location: { name: "Hà Nội", latitude: 21.0285, longitude: 105.8542 }, savedAt: Date.now() }));
        logCommandActivity("Đã cập nhật thời tiết");
      } catch (error) {
        if (output) output.textContent = "Không tải được thời tiết. Hãy thử lại sau.";
      }
      return;
    }
    if (server) {
      const output = grid.querySelector("[data-command-server-output]");
      const checks = [["Frontend", `${location.origin}/?status=${Date.now()}`], ["Backend", `${REALTIME_URL}/api/store/products`], ["Database", `${REALTIME_URL}/api/donations`], ["Authentication", `${REALTIME_URL}/api/auth/me`]];
      if (output) output.innerHTML = checks.map(([name]) => `<span data-status="checking"><i></i><b>${name}</b><small>Đang kiểm tra...</small></span>`).join("");
      await Promise.all(checks.map(async ([name, url], index) => {
        const row = output?.children[index];
        const started = performance.now();
        let online = false;
        let message = "Mất kết nối";
        try {
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), 7000);
          const response = await fetch(url, { signal: controller.signal, cache: "no-store", credentials: "omit" });
          clearTimeout(timer);
          online = response.status < 500;
          message = `HTTP ${response.status} · ${Math.round(performance.now() - started)}ms`;
        } catch (error) { message = error.name === "AbortError" ? "Quá thời gian" : "Không phản hồi"; }
        if (row) { row.dataset.status = online ? "online" : "offline"; row.querySelector("small").textContent = message; }
      }));
      logCommandActivity("Đã kiểm tra trạng thái dịch vụ");
      return;
    }
    if (clearActivity) {
      const state = readCommandCenterState();
      state.activity = [];
      writeCommandCenterState(state);
      const activity = grid.querySelector("[data-command-activity]");
      if (activity) activity.innerHTML = `<div class="command-widget-empty"><i>◷</i><span>Hoạt động mới sẽ xuất hiện tại đây.</span></div>`;
    }
  });

  const aiPanel = () => grid.querySelector("[data-ai-center]");
  const aiResult = (title, text) => {
    const panel = aiPanel();
    const output = panel?.querySelector("[data-ai-result]");
    const heading = panel?.querySelector("[data-ai-result-title]");
    if (output) output.textContent = text;
    if (heading) heading.textContent = title;
    const length = text.length;
    [["clarity", Math.min(96, 35 + Math.round(length / 18))], ["detail", Math.min(98, 25 + Math.round(length / 12))], ["usability", Math.min(97, 45 + Math.round(length / 20))]].forEach(([key, value]) => {
      panel?.querySelector(`[data-ai-${key}]`)?.style.setProperty("--value", `${value}%`);
    });
  };
  const aiLocalAnswer = (input, model) => {
    const text = input.trim();
    const lower = text.toLowerCase();
    const style = model === "creative" ? "sáng tạo, giàu hình ảnh" : model === "analyst" ? "phân tích sâu, có luận điểm" : model === "fast" ? "ngắn gọn, đi thẳng trọng tâm" : "rõ ràng, thực tế";
    if (/html|css|javascript|code|lỗi|bug/.test(lower)) return [`Tôi đã phân tích yêu cầu theo hướng ${style}.`, "", "Hướng xử lý:", "1. Xác định chính xác thành phần và hành vi cần thay đổi.", "2. Giữ cấu trúc hiện tại, tách giao diện, trạng thái và sự kiện.", "3. Kiểm tra responsive, lỗi JavaScript và trạng thái khi dữ liệu trống.", "4. Chạy kiểm thử trước khi xuất bản.", "", "Yêu cầu đã nhận:", text, "", "Gợi ý kỹ thuật: cung cấp đoạn code hoặc ảnh lỗi để tạo bản sửa chính xác đến từng dòng."].join("\n");
    if (/youtube|video|tiêu đề|kịch bản|nội dung/.test(lower)) return [`Chiến lược nội dung (${style}):`, "", `Chủ đề: ${text}`, "", "Cấu trúc đề xuất:", "1. Hook 5-10 giây tạo tò mò.", "2. Nêu xung đột hoặc vấn đề chính.", "3. Phát triển 3 điểm có ví dụ cụ thể.", "4. Cao trào và bài học.", "5. CTA tự nhiên, không ngắt cảm xúc.", "", "Tiêu đề mẫu:", `• Điều Không Ai Ngờ Đã Xảy Ra: ${text.slice(0, 70)}`, `• Sự Thật Phía Sau ${text.slice(0, 55)}`].join("\n");
    if (/kế hoạch|dự án|roadmap|công việc/.test(lower)) return [`Kế hoạch hành động (${style}):`, "", `Mục tiêu: ${text}`, "", "Giai đoạn 1 - Chuẩn bị: xác định đầu ra, dữ liệu và tiêu chí hoàn thành.", "Giai đoạn 2 - Thực hiện: chia thành nhiệm vụ nhỏ, ưu tiên phần ảnh hưởng lớn.", "Giai đoạn 3 - Kiểm tra: thử trường hợp thường gặp và trường hợp lỗi.", "Giai đoạn 4 - Phát hành: sao lưu, triển khai, theo dõi phản hồi.", "", "Bước tiếp theo: viết một đầu ra đo lường được và thời hạn cụ thể."].join("\n");
    return [`Phân tích theo phong cách ${style}:`, "", `Bạn đang yêu cầu: “${text}”`, "", "Câu trả lời đề xuất:", "• Mục tiêu chính cần được diễn đạt bằng một kết quả cụ thể.", "• Bổ sung đối tượng sử dụng, giới hạn và định dạng đầu ra.", "• Chia yêu cầu thành các bước có thể kiểm tra độc lập.", "", "Prompt tốt hơn:", `Hãy đóng vai chuyên gia phù hợp. Thực hiện yêu cầu sau: ${text}. Trình bày rõ ràng theo từng bước, đưa ví dụ cụ thể, nêu giả định và kết thúc bằng checklist hành động.`].join("\n");
  };
  const aiSaveSession = (title, input, result) => {
    let state = {};
    try { state = JSON.parse(localStorage.getItem("hh-ai-center") || "{}"); } catch { state = {}; }
    const session = { title: title || input.slice(0, 48) || "Phiên AI", input, result, time: new Date().toLocaleString("vi-VN") };
    state.sessions = [session, ...(state.sessions || [])].slice(0, 30);
    localStorage.setItem("hh-ai-center", JSON.stringify(state));
    const list = aiPanel()?.querySelector("[data-ai-sessions]");
    if (list) list.innerHTML = state.sessions.slice(0, 10).map((item, index) => `<button class="interactive" type="button" data-ai-session="${index}"><span>${escapeHtml(item.title)}</span><small>${escapeHtml(item.time)}</small></button>`).join("");
    return session;
  };
  const aiRunChat = async (form) => {
    const panel = aiPanel();
    const input = form.querySelector("[data-ai-chat-input]");
    const text = input?.value.trim() || "";
    if (!text) return input?.focus();
    const stream = panel?.querySelector("[data-ai-stream]");
    const model = panel?.querySelector("[data-ai-model]")?.value || "smart-local";
    stream?.insertAdjacentHTML("beforeend", `<article class="ai-message user"><span>Bạn</span><div><strong>Bạn</strong><p>${escapeHtml(text)}</p></div></article><article class="ai-message assistant thinking" data-ai-thinking><span>HH</span><div><strong>Đang suy nghĩ...</strong><p>Phân tích mục tiêu và tạo câu trả lời.</p></div></article>`);
    if (input) input.value = "";
    let answer = "";
    if (model === "cloud" && REALTIME_URL) {
      try {
        const token = localStorage.getItem("hh-auth-token") || "";
        const response = await fetch(`${REALTIME_URL}/api/modules/ai-center/actions`, { method: "POST", headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify({ input: text, actionType: "chat", meta: { model } }) });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Cloud AI không phản hồi");
        answer = data.action?.output || aiLocalAnswer(text, "analyst");
      } catch (error) { answer = `${aiLocalAnswer(text, "smart-local")}\n\n[Cloud AI chưa sẵn sàng: ${error.message}]`; }
    } else answer = aiLocalAnswer(text, model);
    const thinking = stream?.querySelector("[data-ai-thinking]");
    if (thinking) thinking.outerHTML = `<article class="ai-message assistant"><span>HH</span><div><strong>HH AI · ${escapeHtml(model)}</strong><p>${escapeHtml(answer)}</p></div></article>`;
    if (stream) stream.scrollTop = stream.scrollHeight;
    aiResult("Kết quả chat", answer);
    aiSaveSession(text.slice(0, 48), text, answer);
  };

  grid.addEventListener("submit", (event) => {
    const form = event.target.closest("[data-ai-chat-form]");
    if (!form) return;
    event.preventDefault();
    aiRunChat(form);
  });

  grid.addEventListener("input", (event) => {
    if (event.target.matches("[data-ai-chat-input]")) {
      const counter = aiPanel()?.querySelector("[data-ai-char-count]");
      if (counter) counter.textContent = event.target.value.length;
    }
    if (event.target.matches("[data-ai-search]")) {
      const query = event.target.value.toLowerCase();
      aiPanel()?.querySelectorAll("[data-ai-session]").forEach((item) => item.hidden = !item.textContent.toLowerCase().includes(query));
    }
    if (event.target.matches("[data-media-search]")) {
      const panel = event.target.closest("[data-media-center]");
      const query = event.target.value.trim().toLowerCase();
      let visible = 0;
      panel?.querySelectorAll("[data-media-id]").forEach((card) => {
        const match = !query || (card.dataset.mediaSearchText || "").includes(query);
        card.hidden = !match;
        if (match) visible += 1;
      });
      const empty = panel?.querySelector("[data-media-empty]");
      if (empty) empty.hidden = visible > 0;
    }
    if (event.target.matches("[data-project-progress]")) {
      const panel = event.target.closest("[data-project-center]");
      const value = Number(event.target.value);
      const label = event.target.closest("label")?.querySelector("b"); if (label) label.textContent = `${value}%`;
      const metric = panel?.querySelector("[data-project-progress-value]"); if (metric) metric.textContent = `${value}%`;
    }
    if (event.target.matches("[data-wiki-content]")) updateWikiPreview(event.target.closest("[data-knowledge-center]"));
    if (event.target.matches("[data-wiki-search]")) {
      const panel = event.target.closest("[data-knowledge-center]"); const query = event.target.value.toLowerCase();
      panel?.querySelectorAll("[data-wiki-open]").forEach((button) => { if (button.closest("[data-wiki-articles]")) button.hidden = !button.textContent.toLowerCase().includes(query); });
    }
    if(event.target.matches("[data-learning-search]")){const query=event.target.value.toLowerCase();event.target.closest("[data-learning-center]")?.querySelectorAll("[data-course-open]").forEach((button)=>button.hidden=!button.textContent.toLowerCase().includes(query));}
    if(event.target.matches("[data-community-search]")){const query=event.target.value.trim().toLowerCase();event.target.closest("[data-community-center]")?.querySelectorAll("[data-post-id]").forEach((post)=>post.hidden=!post.textContent.toLowerCase().includes(query));}
    if(event.target.matches("[data-store-search]")){const query=event.target.value.toLowerCase();event.target.closest("[data-store]")?.querySelectorAll(".product-card").forEach((card)=>card.hidden=!card.dataset.productSearch.includes(query));}
    if(event.target.matches("[data-cloud-search]")){const query=event.target.value.toLowerCase();event.target.closest("[data-cloud]")?.querySelectorAll("[data-cloud-file]").forEach((row)=>row.hidden=!row.dataset.cloudSearchText.includes(query));}
    if(event.target.matches("[data-api-search]")){const query=event.target.value.toLowerCase();event.target.closest("[data-api-center]")?.querySelectorAll("[data-api-open]").forEach((button)=>button.hidden=!button.dataset.apiSearchText.includes(query));}
    if(event.target.matches("[data-smart-query]")){const panel=event.target.closest("[data-smart-search]");renderSmartSearch(event.target.value,panel?.querySelector("[data-smart-filter].active")?.dataset.smartFilter||"all");}
    if(event.target.matches("[data-launcher-query]")){const query=event.target.value.toLowerCase();event.target.closest("[data-app-launcher]")?.querySelectorAll("[data-launcher-open]").forEach(node=>node.hidden=!node.textContent.toLowerCase().includes(query));}
  });

  const readProjectState = () => {
    try { return JSON.parse(localStorage.getItem("hh-project-center") || "{}"); } catch { return {}; }
  };
  const writeProjectState = (state, activity) => {
    if (activity) state.activity = [`${new Date().toLocaleString("vi-VN")} · ${activity}`, ...(state.activity || [])].slice(0, 30);
    localStorage.setItem("hh-project-center", JSON.stringify(state));
  };
  const ensureProjectState = () => {
    const current = readProjectState();
    if (!current.projects) current.projects = [
      { id:"portfolio",name:"HH Neon Platform",status:"Đang phát triển",progress:82,priority:"Cao",due:"2026-08-01",description:"Website cá nhân, AI Center, Media Center và cộng đồng.",color:"#ff3bd1" },
      { id:"script-ai",name:"Kịch bản AI",status:"Đang thử nghiệm",progress:68,priority:"Cao",due:"2026-08-15",description:"Công cụ viết và quản lý kịch bản đa nền tảng.",color:"#55f3ec" },
      { id:"voice",name:"HH Voice Studio",status:"Bản ổn định",progress:94,priority:"Trung bình",due:"2026-07-30",description:"Text/SRT, chia part, voice trình duyệt và humanize.",color:"#f5ff67" }
    ];
    if (!current.tasks) current.tasks = [{id:"t1",title:"Hoàn thiện Project Center",column:"doing",priority:"Cao",project:"portfolio"},{id:"t2",title:"Kiểm tra giao diện mobile",column:"todo",priority:"Cao",project:"portfolio"},{id:"t3",title:"Nâng cấp AI Center",column:"done",priority:"Cao",project:"portfolio"},{id:"t4",title:"Viết changelog v22",column:"review",priority:"Trung bình",project:"portfolio"}];
    return current;
  };
  const rerenderModule = (moduleId, tabName) => {
    const scrollY = window.scrollY; render(); requestAnimationFrame(() => { window.scrollTo(0, scrollY); const panel = grid.querySelector(`[data-${moduleId}]`); if (tabName) panel?.querySelector(`[data-project-tab="${tabName}"]`)?.click(); });
  };

  const readWikiState = () => {
    try { return JSON.parse(localStorage.getItem("hh-knowledge-center") || "{}"); } catch { return {}; }
  };
  const ensureWikiState = () => {
    const state = readWikiState();
    if (!state.articles) state.articles = [{id:"deploy",title:"Deploy GitHub Pages và Vercel",category:"Hướng dẫn",tags:["github","vercel"],bookmark:true,updated:"2026-07-11",content:"# Deploy website HH\n\n## GitHub Pages\n- Push mã nguồn lên nhánh `main`.\n- Kiểm tra Pages trong Settings.\n\n## Vercel backend\nKết nối MongoDB và đặt biến môi trường trước khi deploy.\n\n> Luôn kiểm tra API sau khi phát hành."},{id:"ai-prompts",title:"Cấu trúc prompt AI hiệu quả",category:"AI",tags:["prompt","ai"],bookmark:false,updated:"2026-07-11",content:"# Prompt AI hiệu quả\n\nMột prompt tốt gồm **vai trò**, **mục tiêu**, **ngữ cảnh**, **ràng buộc** và **định dạng đầu ra**.\n\n## Checklist\n- Mục tiêu rõ ràng\n- Có ví dụ\n- Không bịa dữ kiện"}];
    return state;
  };
  const writeWikiState = (state) => localStorage.setItem("hh-knowledge-center", JSON.stringify(state));
  const markdownToHtml = (source) => {
    const lines = String(source || "").split("\n");
    let inList = false; const html = [];
    lines.forEach((raw) => {
      let line = escapeHtml(raw);
      line = line.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>").replace(/`([^`]+)`/g, "<code>$1</code>").replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
      const heading = line.match(/^(#{1,3})\s+(.+)/);
      if (heading) { if (inList) { html.push("</ul>"); inList=false; } const level=heading[1].length; const id=heading[2].replace(/<[^>]+>/g,"").toLowerCase().replace(/[^a-z0-9\u00C0-\u024f]+/g,"-"); html.push(`<h${level} id="${id}">${heading[2]}</h${level}>`); }
      else if (/^-\s+/.test(line)) { if (!inList) { html.push("<ul>"); inList=true; } html.push(`<li>${line.replace(/^-\s+/,"")}</li>`); }
      else { if (inList) { html.push("</ul>"); inList=false; } if (/^&gt;\s+/.test(line)) html.push(`<blockquote>${line.replace(/^&gt;\s+/,"")}</blockquote>`); else if (line.trim()) html.push(`<p>${line}</p>`); }
    });
    if (inList) html.push("</ul>"); return html.join("");
  };
  const updateWikiPreview = (panel = grid.querySelector("[data-knowledge-center]")) => {
    if (!panel) return; const source = panel.querySelector("[data-wiki-content]")?.value || ""; const preview = panel.querySelector("[data-wiki-preview]"); if (preview) preview.innerHTML = markdownToHtml(source);
    const words = source.trim() ? source.trim().split(/\s+/).length : 0; const headings = (source.match(/^#{1,3}\s+/gm)||[]).length;
    const wordNode=panel.querySelector("[data-wiki-word-count]"); if(wordNode) wordNode.textContent=words; const readNode=panel.querySelector("[data-wiki-read-time]"); if(readNode) readNode.textContent=Math.max(1,Math.ceil(words/220)); const headingNode=panel.querySelector("[data-wiki-heading-count]"); if(headingNode) headingNode.textContent=headings;
    const toc=panel.querySelector("[data-wiki-toc]"); if(toc) { const matches=[...source.matchAll(/^(#{1,3})\s+(.+)$/gm)]; toc.innerHTML=matches.map((match)=>`<a href="#${escapeHtml(match[2].toLowerCase().replace(/[^a-z0-9\u00C0-\u024f]+/g,"-"))}" style="--level:${match[1].length}">${escapeHtml(match[2])}</a>`).join("")||"<p>Chưa có đề mục.</p>"; }
  };
  const readLearningState=()=>{try{return JSON.parse(localStorage.getItem("hh-learning-center")||"{}");}catch{return {};}};
  const writeLearningState=(state)=>localStorage.setItem("hh-learning-center",JSON.stringify(state));
  const communityCacheKey=()=>{try{const account=JSON.parse(localStorage.getItem("hh-auth-user")||"{}");return `hh-community-center:${account.id||account.email||"guest"}`;}catch{return "hh-community-center:guest";}};
  const readCommunityState=()=>{try{return JSON.parse(localStorage.getItem(communityCacheKey())||"{}");}catch{return {};}};
  const communityDefaults=()=>[{id:"welcome",author:{name:"Hoàng Đại Ka 13"},createdAt:new Date(Date.now()-36e5).toISOString(),topic:"Thông báo",privacy:"public",pinned:true,content:"Chào mừng bạn đến HH Community. Đây là nơi chia sẻ ý tưởng, kết nối thành viên và cùng xây dựng hệ sinh thái HH.",reactionCount:12,viewerReaction:"",comments:[{id:"c1",author:{name:"Thành viên HH"},text:"Giao diện cộng đồng rất đẹp!",createdAt:new Date(Date.now()-18e5).toISOString()}]},{id:"update",author:{name:"HH Team"},createdAt:new Date(Date.now()-72e5).toISOString(),topic:"Website",privacy:"public",content:"AI Center, Media Center, Project Center và Wiki đã được nâng cấp. Hãy chia sẻ tính năng bạn muốn thấy tiếp theo.",reactionCount:8,viewerReaction:"",comments:[]}];
  const ensureCommunityState=()=>{const state=readCommunityState();if(!state.posts)state.posts=communityDefaults();return state;};
  const writeCommunityState=(state)=>localStorage.setItem(communityCacheKey(),JSON.stringify(state));
  let communityLoadTimer=0;
  const communityApi=async(options={})=>{if(!REALTIME_URL)throw new Error("Backend cộng đồng chưa được cấu hình.");const token=localStorage.getItem("hh-auth-token")||"";const response=await fetch(`${REALTIME_URL}/api/community${options.query||""}`,{method:options.method||"GET",headers:{...(options.body?{"Content-Type":"application/json"}:{}),...(token?{Authorization:`Bearer ${token}`}:{})},body:options.body?JSON.stringify(options.body):undefined,cache:"no-store"});const data=await response.json().catch(()=>({}));if(!response.ok)throw new Error(data.error||"Không thể kết nối cộng đồng.");return data;};
  const loadCommunityFeed=async({silent=false}={})=>{const panel=grid.querySelector("[data-community-center]");if(!panel)return;const status=panel.querySelector("[data-community-status]");try{const data=await communityApi();const state=ensureCommunityState();state.remotePosts=data.posts||[];state.remoteStories=data.stories||[];state.communitySuggestions=data.suggestions||[];state.communityNotifications=data.notifications||[];state.communityNotificationSettings=data.notificationSettings||state.communityNotificationSettings||{};state.communityTrendingHashtags=data.trendingHashtags||[];state.communityGroups=data.groups||[];state.communityEvents=data.events||[];state.lastSync=Date.now();writeCommunityState(state);const list=panel.querySelector("[data-community-posts]");if(list)list.innerHTML=(state.remotePosts.length?state.remotePosts:communityDefaults()).map(communityPostMarkup).join("");const stories=panel.querySelector(".community-stories");if(stories)stories.innerHTML=`<button class="community-story story-create interactive" type="button" data-story-create><span>＋</span><strong>Tạo tin</strong><small>Chia sẻ 24 giờ</small></button>${state.remoteStories.map(communityStoryMarkup).join("")||[["Hoàng Đại Ka","HH"],["AI Creator","AI"],["Music Studio","MS"]].map(([name,initials],index)=>`<button class="community-story interactive is-demo" type="button" data-story-demo="${index}"><span>${initials}</span><strong>${name}</strong><small>Tin nổi bật</small></button>`).join("")}`;const suggestionBox=panel.querySelector(".community-side>section:nth-child(2)");if(suggestionBox){suggestionBox.querySelectorAll(":scope>article,:scope>.community-empty-suggestions").forEach((item)=>item.remove());suggestionBox.insertAdjacentHTML("beforeend",state.communitySuggestions.length?state.communitySuggestions.map(communitySuggestionMarkup).join(""):'<p class="community-empty-suggestions">Chưa có tài khoản khác để gợi ý.</p>');}const heroActions=panel.querySelector(".community-hero-actions");let notificationButton=heroActions?.querySelector("[data-community-notifications]");if(heroActions&&!notificationButton){notificationButton=document.createElement("button");notificationButton.className="community-notification-button interactive";notificationButton.type="button";notificationButton.dataset.communityNotifications="";heroActions.insertBefore(notificationButton,heroActions.lastElementChild);}if(notificationButton)notificationButton.innerHTML=`Thông báo${data.unread?`<b>${data.unread}</b>`:""}`;if(status)status.textContent=`Đã đồng bộ ${state.remotePosts.length} bài viết · ${new Date().toLocaleTimeString("vi-VN")}`;}catch(error){if(status)status.textContent=`Bản tin dự phòng · ${error.message}`;}if(!silent){clearInterval(communityLoadTimer);communityLoadTimer=setInterval(()=>{if(grid.isConnected&&grid.querySelector("[data-community-center]"))loadCommunityFeed({silent:true});else clearInterval(communityLoadTimer);},30000);}};
  const communityMutate=async(body)=>{let payload=body;if(body?.action==="create"&&!body.commentPermission){const form=grid.querySelector("[data-community-form]");const commentPermission=form?.querySelector('[data-v2-composer-value="commentPermission"]')?.value||"everyone";payload={...body,commentPermission};}const data=await communityApi({method:"POST",body:payload});await loadCommunityFeed({silent:true});return data;};
  const loadCommunityFeedMode=async(mode="ranked")=>{const panel=grid.querySelector("[data-community-center]");if(!panel)return;const normalized=["ranked","latest","friends"].includes(mode)?mode:"ranked";const status=panel.querySelector("[data-community-status]");try{if(status)status.textContent="Đang sắp xếp bảng tin...";const data=await communityApi({query:`?feed=${encodeURIComponent(normalized)}`});const state=ensureCommunityState();state.remotePosts=data.posts||[];state.communityFeedMode=normalized;writeCommunityState(state);const list=panel.querySelector("[data-community-posts]");if(list)list.innerHTML=(state.remotePosts.length?state.remotePosts:communityDefaults()).map(communityPostMarkup).join("");if(status)status.textContent=`${normalized==="latest"?"Mới nhất":normalized==="friends"?"Bạn bè":"Dành cho bạn"} · ${state.remotePosts.length} bài viết`;}catch(error){if(status)status.textContent=error.message;throw error;}};
   window.HHCommunity={refresh:loadCommunityFeed,loadMode:loadCommunityFeedMode,mutate:communityMutate,api:communityApi,uploadMedia:communityUploadMedia,state:ensureCommunityState,notice:communityNotice};
  const readUserState=()=>{try{return JSON.parse(localStorage.getItem("hh-user-dashboard")||"{}");}catch{return {};}};
  const writeUserState=(state)=>localStorage.setItem("hh-user-dashboard",JSON.stringify(state));
  let adminUsersCache=[];
  const adminUserDate=(value)=>value?new Date(value).toLocaleString("vi-VN"):"Chưa có";
  const renderAdminUsers=(panel,query="")=>{
    const target=panel?.querySelector("[data-admin-users]");if(!target)return;
    const normalized=query.trim().toLowerCase();
    const users=adminUsersCache.filter((item)=>!normalized||`${item.name} ${item.email} ${item.provider}`.toLowerCase().includes(normalized));
    target.innerHTML=users.length?users.map((item)=>`<tr><td><div class="admin-user-identity"><span>${item.avatar?`<img src="${escapeHtml(item.avatar)}" alt="">`:escapeHtml((item.name||"HH").slice(0,2).toUpperCase())}</span><div><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(item.email)}</small></div></div></td><td><span class="admin-provider">${escapeHtml(item.provider==="local"?"Email":item.provider)}</span></td><td>${item.consent?'<span class="admin-consent yes">Đã đồng ý</span>':'<span class="admin-consent">Chưa đồng ý</span>'}</td><td>${adminUserDate(item.createdAt)}</td><td>${adminUserDate(item.lastLoginAt)}</td><td><span class="admin-online ${item.online?"is-online":""}"><i></i>${item.online?"Online":"Offline"}</span></td></tr>`).join(""):'<tr><td colspan="6">Không tìm thấy tài khoản phù hợp.</td></tr>';
  };
  const loadAdminUsers=async()=>{
    const panel=grid.querySelector("[data-admin-panel]");if(!panel||!REALTIME_URL)return;
    const token=localStorage.getItem("hh-auth-token")||"";
    const response=await fetch(`${REALTIME_URL}/api/platform/users`,{headers:{Authorization:`Bearer ${token}`},cache:"no-store"});
    const data=await response.json().catch(()=>({}));if(!response.ok)throw new Error(data.error||"Không thể tải danh sách tài khoản.");
    adminUsersCache=data.users||[];
    const search=panel.querySelector("[data-admin-user-search]");
    if(search&&!search.dataset.bound){search.dataset.bound="true";search.addEventListener("input",()=>renderAdminUsers(panel,search.value));}
    renderAdminUsers(panel,search?.value||"");
    const total=panel.querySelector("[data-admin-user-total]");if(total)total.textContent=`${data.stats?.total||0} tài khoản`;
    const online=panel.querySelector("[data-admin-user-online]");if(online)online.textContent=`${data.stats?.online||0} online`;
    const updated=panel.querySelector("[data-admin-user-updated]");if(updated)updated.textContent=`Cập nhật ${new Date(data.checkedAt).toLocaleTimeString("vi-VN")}`;
  };
  const loadAdminSummary=async()=>{
    const panel=grid.querySelector("[data-admin-panel]");if(!panel||!REALTIME_URL)return;const status=panel.querySelector("[data-admin-status]");
    try{const token=localStorage.getItem("hh-auth-token")||"";const response=await fetch(`${REALTIME_URL}/api/platform/summary`,{headers:{...(token?{Authorization:`Bearer ${token}`}:{})},cache:"no-store"});const data=await response.json();if(!response.ok)throw new Error(data.error||"Không có quyền quản trị");const access=panel.querySelector("[data-admin-access]");if(access)access.textContent="Đã xác minh chủ sở hữu";const audience=data.audience||{};if(status)status.textContent=`Realtime · ${audience.onlineVisitors??0} đang hoạt động (${audience.onlineRegistered??0} đã đăng nhập) · cập nhật ${new Date(data.checkedAt).toLocaleString("vi-VN")}`;const labels=["Tài khoản đăng ký","Đang hoạt động","Đang đăng nhập","Sự kiện"];const values=[audience.registeredUsers??data.counts.users,audience.onlineVisitors,audience.onlineRegistered,data.counts.events];panel.querySelectorAll("[data-admin-metrics] article").forEach((card,index)=>{const label=card.querySelector("span");if(label)label.textContent=labels[index];const value=card.querySelector("strong");if(value)value.textContent=values[index]??0;const note=card.querySelector("small");if(note)note.textContent=index===1||index===2?"2 phút gần nhất":"MongoDB";});const visitors=panel.querySelector("[data-admin-visitors]");if(visitors)visitors.innerHTML=(audience.activeVisitors||[]).map((item)=>`<p><i></i><span>${escapeHtml(item.name)}${item.email?` · ${escapeHtml(item.email)}`:""}<small>${escapeHtml(item.page||"/")}</small></span><small>${new Date(item.lastSeenAt).toLocaleTimeString("vi-VN")}</small></p>`).join("")||"<p>Chưa có người hoạt động trong 2 phút gần nhất.</p>";const events=panel.querySelector("[data-admin-events]");if(events)events.innerHTML=(data.recentEvents||[]).map((item)=>`<p><i></i><span>${escapeHtml(item.type||"event")}${item.moduleId?` · ${escapeHtml(item.moduleId)}`:""}</span><small>${new Date(item.createdAt).toLocaleString("vi-VN")}</small></p>`).join("")||"<p>Chưa có sự kiện.</p>";panel.querySelectorAll(".admin-service").forEach((item)=>{item.classList.add("online");item.querySelector("b").textContent="Hoạt động";});loadAdminUsers().catch(()=>{});if(!adminRealtimeTimer)adminRealtimeTimer=setInterval(()=>{const activePanel=grid.querySelector("[data-admin-panel]");if(activePanel&&!activePanel.closest("[hidden]"))loadAdminSummary();},15000);}
    catch(error){const access=panel.querySelector("[data-admin-access]");if(access)access.textContent="Quyền truy cập bị giới hạn";if(status)status.textContent=error.message;}
  };
  const readCart=()=>{try{return JSON.parse(localStorage.getItem("hh-store-cart")||"[]");}catch{return [];}};
  const writeCart=(cart)=>localStorage.setItem("hh-store-cart",JSON.stringify(cart));
  let storeProductsCache=[];let cloudFilesCache=[];
  const renderCart=()=>{const panel=grid.querySelector("[data-store]");if(!panel)return;const cart=readCart();const count=panel.querySelector("[data-cart-count]");if(count)count.textContent=cart.reduce((sum,item)=>sum+item.quantity,0);const list=panel.querySelector("[data-cart-items]");if(list)list.innerHTML=cart.length?cart.map((item)=>`<article><div><strong>${escapeHtml(item.title)}</strong><span>${item.price.toLocaleString("vi-VN")} ₫ × ${item.quantity}</span></div><button class="interactive" type="button" data-cart-remove="${item.id}">×</button></article>`).join(""):"<p>Chưa có sản phẩm.</p>";const total=cart.reduce((sum,item)=>sum+item.price*item.quantity,0);const totalNode=panel.querySelector("[data-cart-total]");if(totalNode)totalNode.textContent=`${total.toLocaleString("vi-VN")} ₫`;};
  const loadStoreProducts=async()=>{const panel=grid.querySelector("[data-store]");if(!panel)return;try{const response=await fetch(`${REALTIME_URL}/api/store/products`,{cache:"no-store"});const data=await response.json();storeProductsCache=data.products||[];const list=panel.querySelector("[data-store-products]");if(list)list.innerHTML=storeProductsCache.map((item,index)=>`<article class="product-card" data-product-type="${item.type}" data-product-search="${escapeHtml(item.title.toLowerCase())}"><div class="product-art"><span>${["HH","AI","PRO"][index]||"HH"}</span><b>${item.type}</b></div><div><span>${item.price===0?"MIỄN PHÍ":item.type.toUpperCase()}</span><h5>${escapeHtml(item.title)}</h5><p>${item.type==="membership"?"Quyền truy cập nội dung và cập nhật dành cho creator.":"Sản phẩm số thuộc hệ sinh thái HH."}</p><strong>${item.price?`${item.price.toLocaleString("vi-VN")} ₫`:"Miễn phí"}</strong></div><button class="button primary interactive" type="button" data-product-add="${item.id}">${item.price===0?"Thêm vào thư viện":"Thêm giỏ hàng"}</button></article>`).join("");renderCart();}catch(error){const list=panel.querySelector("[data-store-products]");if(list)list.innerHTML=`<p>Không tải được Store API: ${escapeHtml(error.message)}</p>`;}};
  const loadCloudFiles=async()=>{const panel=grid.querySelector("[data-cloud]");if(!panel||!REALTIME_URL)return;const status=panel.querySelector("[data-cloud-status]");try{const token=localStorage.getItem("hh-auth-token")||"";const response=await fetch(`${REALTIME_URL}/api/storage/files`,{headers:{Authorization:`Bearer ${token}`},cache:"no-store"});const data=await response.json();if(!response.ok)throw new Error(data.error||"Cloud lỗi");cloudFilesCache=data.files||[];if(status)status.textContent="Đã đồng bộ";const list=panel.querySelector("[data-cloud-files]");if(list)list.innerHTML=cloudFilesCache.length?cloudFilesCache.map((item)=>`<button class="cloud-file-row interactive" type="button" data-cloud-file="${item._id}" data-cloud-search-text="${escapeHtml(item.name.toLowerCase())}"><strong>${escapeHtml(item.name)}</strong><span>${escapeHtml(item.mimeType)}</span><span>${Number(item.size||0).toLocaleString("vi-VN")} B</span><span>${new Date(item.createdAt).toLocaleDateString("vi-VN")}</span><b>›</b></button>`).join(""):"<p>Kho của bạn đang trống.</p>";}catch(error){if(status)status.textContent="Chưa kết nối";const list=panel.querySelector("[data-cloud-files]");if(list)list.innerHTML=`<p>${escapeHtml(error.message)}</p>`;}};
  const uploadCloudText=async(name,mimeType,content,size)=>{if(!REALTIME_URL)throw new Error("Backend chưa cấu hình");const token=localStorage.getItem("hh-auth-token")||"";const response=await fetch(`${REALTIME_URL}/api/storage/files`,{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${token}`},body:JSON.stringify({name,mimeType,content,size})});const data=await response.json();if(!response.ok)throw new Error(data.error||"Upload thất bại");return data.file;};
  const loadDeveloperData=async()=>{const panel=grid.querySelector("[data-developer]");if(!panel)return;try{const [commits,pages,api]=await Promise.all([fetch("https://api.github.com/repos/hoangdaika13/hoangdaika13.github.io/commits?per_page=10",{headers:{Accept:"application/vnd.github+json"}}).then((res)=>res.json()),fetch("https://hoangdaika13.github.io",{method:"HEAD",cache:"no-store"}),fetch(`${REALTIME_URL}/api/store/products`,{cache:"no-store"})]);panel.querySelector("[data-dev-pages]").textContent=pages.ok?"Online":"Lỗi";panel.querySelector("[data-dev-api]").textContent=api.ok?"Online":"Lỗi";const list=panel.querySelector("[data-dev-commits]");if(list)list.innerHTML=Array.isArray(commits)?commits.map((item)=>`<article><code>${item.sha.slice(0,7)}</code><div><strong>${escapeHtml(item.commit.message.split("\n")[0])}</strong><span>${escapeHtml(item.commit.author.name)} · ${new Date(item.commit.author.date).toLocaleString("vi-VN")}</span></div><a href="${item.html_url}" target="_blank" rel="noopener">Mở</a></article>`).join(""):"<p>GitHub API chưa phản hồi.</p>";}catch{panel.querySelector("[data-dev-pages]").textContent="Offline";panel.querySelector("[data-dev-api]").textContent="Offline";}};
  const loadSecurityData=async()=>{const panel=grid.querySelector("[data-security]");if(!panel||!REALTIME_URL)return;try{const token=localStorage.getItem("hh-auth-token")||"";const response=await fetch(`${REALTIME_URL}/api/auth/me`,{headers:{Authorization:`Bearer ${token}`},cache:"no-store"});const data=await response.json();if(!response.ok||!data.user)throw new Error("Phiên đăng nhập không còn hợp lệ.");const list=panel.querySelector("[data-login-history]");if(list)list.innerHTML=(data.loginHistory||[]).map((item)=>`<article><i></i><div><strong>${escapeHtml(item.userAgent||"Thiết bị không xác định")}</strong><span>${new Date(item.createdAt).toLocaleString("vi-VN")} · ${escapeHtml(String(item.forwardedFor||"").split(",")[0])}</span></div></article>`).join("")||"<p>Chưa có lịch sử đăng nhập được ghi nhận.</p>";const score=panel.querySelector("[data-security-score]");if(score)score.textContent=data.user.provider==="local"?"88":"92";const alert=panel.querySelector("[data-security-alert]");if(alert){alert.querySelector("strong").textContent="Phiên đã được máy chủ xác minh";alert.querySelector("span").textContent="JWT 12 giờ · chống thử mật khẩu · có thể thu hồi phiên · API giới hạn nguồn truy cập";}}catch(error){const list=panel.querySelector("[data-login-history]");if(list)list.innerHTML=`<p>${escapeHtml(error.message)}</p>`;const score=panel.querySelector("[data-security-score]");if(score)score.textContent="0";}};
  let smartSearchIndex=[];
  const updateSmartIndex=()=>{smartSearchIndex=[...modules.map((item)=>({type:"module",title:item.title,description:item.description,id:item.id})),...(ensureProjectState().projects||[]).map((item)=>({type:"project",title:item.name,description:item.description,id:item.id})),...(ensureWikiState().articles||[]).map((item)=>({type:"article",title:item.title,description:`${item.category} ${(item.tags||[]).join(" ")}`,id:item.id})),...(readMediaState().items||[]).map((item)=>({type:"media",title:item.title,description:item.source||item.category,id:item.id})),...cloudFilesCache.map((item)=>({type:"file",title:item.name,description:item.mimeType,id:String(item._id)})),{type:"setting",title:"Cài đặt neon",description:"Hiệu ứng giao diện",id:"neon"},{type:"setting",title:"Thông báo",description:"Email Push Discord Telegram",id:"notifications"}];const panel=grid.querySelector("[data-smart-search]");if(panel)panel.querySelectorAll("[data-smart-filter-count]").forEach((node)=>node.textContent=node.dataset.smartFilterCount==="all"?smartSearchIndex.length:smartSearchIndex.filter((item)=>item.type===node.dataset.smartFilterCount).length);};
  const renderSmartSearch=(query,filter="all")=>{const panel=grid.querySelector("[data-smart-search]");if(!panel)return;const normalized=query.trim().toLowerCase();let results=smartSearchIndex.filter((item)=>(filter==="all"||item.type===filter)&&(!normalized||`${item.title} ${item.description}`.toLowerCase().includes(normalized)));const sort=panel.querySelector("[data-smart-sort]")?.value;if(sort==="name")results.sort((a,b)=>a.title.localeCompare(b.title));if(sort==="type")results.sort((a,b)=>a.type.localeCompare(b.type));const summary=panel.querySelector("[data-smart-summary]");if(summary)summary.textContent=`${results.length} kết quả${normalized?` cho “${query}”`:""}`;const list=panel.querySelector("[data-smart-results]");if(list)list.innerHTML=results.length?results.slice(0,50).map((item,index)=>`<button class="smart-result interactive" type="button" data-smart-result="${index}" data-smart-item='${escapeHtml(JSON.stringify(item))}'><span>${item.type.toUpperCase()}</span><div><strong>${escapeHtml(item.title)}</strong><p>${escapeHtml(item.description||"")}</p></div><b>›</b></button>`).join(""):'<div class="smart-empty"><span>⌕</span><strong>Không tìm thấy kết quả</strong><p>Thử từ khóa hoặc bộ lọc khác.</p></div>';};

  const mediaDefaults = () => [
    { id: "hh-ai-cover", title: "Kịch bản AI Studio", type: "image", category: "images", url: "assets/kich-ban-ai.png", source: "HH Projects", favorite: true },
    { id: "hh-ambient", title: "HH Neon Ambient", type: "audio", category: "music", url: "", source: "Music Engine", favorite: false },
    { id: "hh-profile", title: "Hoangdaika13 Portfolio", type: "link", category: "gallery", url: "https://hoangdaika13.github.io", source: "Website", favorite: false }
  ];
  const mediaSessionItems = new Map();
  const MEDIA_DB_NAME="hh-media-library";
  const openMediaDatabase=()=>new Promise((resolve,reject)=>{if(!("indexedDB" in window))return reject(new Error("Trình duyệt không hỗ trợ lưu media cục bộ."));const request=indexedDB.open(MEDIA_DB_NAME,1);request.onupgradeneeded=()=>{const db=request.result;if(!db.objectStoreNames.contains("files"))db.createObjectStore("files",{keyPath:"id"});};request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error||new Error("Không thể mở thư viện media."));});
  const mediaDbTransaction=async(mode,work)=>{const db=await openMediaDatabase();return new Promise((resolve,reject)=>{const transaction=db.transaction("files",mode);const store=transaction.objectStore("files");let result;try{result=work(store);}catch(error){db.close();reject(error);return;}transaction.oncomplete=()=>{db.close();resolve(result?.result);};transaction.onerror=()=>{db.close();reject(transaction.error||new Error("Không thể cập nhật thư viện media."));};});};
  const mediaDbPut=(item)=>mediaDbTransaction("readwrite",(store)=>store.put(item));
  const mediaDbDelete=(id)=>mediaDbTransaction("readwrite",(store)=>store.delete(id));
  const mediaDbList=()=>mediaDbTransaction("readonly",(store)=>store.getAll());
  const mediaDbFavorite=async(id,favorite)=>{const db=await openMediaDatabase();return new Promise((resolve,reject)=>{const transaction=db.transaction("files","readwrite");const store=transaction.objectStore("files");const request=store.get(id);request.onsuccess=()=>{if(request.result)store.put({...request.result,favorite});};transaction.oncomplete=()=>{db.close();resolve();};transaction.onerror=()=>{db.close();reject(transaction.error);};});};
  const hydrateMediaLibrary=async()=>{try{const records=await mediaDbList();for(const [id,item] of mediaSessionItems){if(item.persistent){URL.revokeObjectURL(item.url);mediaSessionItems.delete(id);}}records.forEach((record)=>{const url=URL.createObjectURL(record.file);mediaSessionItems.set(record.id,{id:record.id,title:record.title,type:record.type,category:record.category,url,source:`${(record.size/1024/1024).toFixed(1)} MB · Đã lưu trên thiết bị`,favorite:Boolean(record.favorite),local:true,persistent:true});});refreshMediaCenter();}catch(error){const panel=grid.querySelector("[data-media-center]");const activity=panel?.querySelector("[data-media-activity]");if(activity)activity.innerHTML=`<p>${escapeHtml(error.message)}</p>`;}};
  const readMediaState = () => {
    try {
      const state = JSON.parse(localStorage.getItem("hh-media-center") || "{}");
      return { items: Array.isArray(state.items) && state.items.length ? state.items : mediaDefaults(), playlists: Array.isArray(state.playlists) && state.playlists.length ? state.playlists : [{ name: "Yêu thích", items: [] }, { name: "Xem sau", items: [] }], activity: state.activity || [] };
    } catch { return { items: mediaDefaults(), playlists: [{ name: "Yêu thích", items: [] }, { name: "Xem sau", items: [] }], activity: [] }; }
  };
  const writeMediaState = (state, activity) => {
    if (activity) state.activity = [`${new Date().toLocaleTimeString("vi-VN")} · ${activity}`, ...(state.activity || [])].slice(0, 20);
    localStorage.setItem("hh-media-center", JSON.stringify(state));
  };
  const mediaItemById = (id) => mediaSessionItems.get(id) || readMediaState().items.find((item) => item.id === id);
  const mediaCardMarkup = (item) => `<article class="media-card interactive-card" data-media-id="${escapeHtml(item.id)}" data-media-category="${escapeHtml(item.category || item.type)}" data-media-search-text="${escapeHtml(`${item.title} ${item.source} ${item.type}`.toLowerCase())}"><button class="media-cover interactive" type="button" data-media-open="${escapeHtml(item.id)}">${item.type === "image" ? `<img src="${escapeHtml(item.url)}" alt="${escapeHtml(item.title)}">` : item.thumbnail ? `<img src="${escapeHtml(item.thumbnail)}" alt="${escapeHtml(item.title)}">` : `<span class="media-type-icon">${item.type === "audio" ? "♫" : item.type === "video" ? "▶" : "↗"}</span>`}<i>${escapeHtml(item.category || item.type)}</i></button><div class="media-card-info"><div><strong>${escapeHtml(item.title)}</strong><span>${escapeHtml(item.source || "Nguồn cá nhân")}</span></div><button class="interactive ${item.favorite ? "active" : ""}" type="button" data-media-favorite="${escapeHtml(item.id)}" aria-label="Yêu thích">${item.favorite ? "♥" : "♡"}</button></div><div class="media-card-actions"><button class="interactive" type="button" data-media-open="${escapeHtml(item.id)}">Mở</button><button class="interactive" type="button" data-media-queue="${escapeHtml(item.id)}">+ Playlist</button><button class="interactive" type="button" data-media-more="${escapeHtml(item.id)}">•••</button></div></article>`;
  const refreshMediaCenter = () => {
    const panel = grid.querySelector("[data-media-center]");
    if (!panel) return;
    const state = readMediaState();
    const allItems = [...state.items, ...mediaSessionItems.values()];
    const mediaGrid = panel.querySelector("[data-media-grid]");
    if (mediaGrid) mediaGrid.innerHTML = allItems.map(mediaCardMarkup).join("");
    const total = panel.querySelector("[data-media-total]"); if (total) total.textContent = allItems.length;
    const favorites = panel.querySelector("[data-media-favorites]"); if (favorites) favorites.textContent = allItems.filter((item) => item.favorite).length;
    const activity = panel.querySelector("[data-media-activity]"); if (activity) activity.innerHTML = state.activity.slice(0, 5).map((item) => `<p>${escapeHtml(item)}</p>`).join("") || "<p>Chưa có hoạt động.</p>";
    const playlists = panel.querySelector("[data-media-playlists]"); if (playlists) playlists.innerHTML = state.playlists.map((list, index) => `<button class="interactive" type="button" data-media-playlist="${index}"><span>▤</span><div><strong>${escapeHtml(list.name)}</strong><small>${(list.items || []).length} mục</small></div></button>`).join("");
  };
  const youtubeIdOf = (url) => {
    try { const parsed = new URL(url); if (parsed.hostname.includes("youtu.be")) return parsed.pathname.split("/")[1]; if (parsed.hostname.includes("youtube")) return parsed.searchParams.get("v") || parsed.pathname.split("/").filter(Boolean).pop(); } catch {} return "";
  };
  const openMediaItem = (item) => {
    const panel = grid.querySelector("[data-media-center]");
    const stage = panel?.querySelector("[data-media-preview]");
    if (!stage || !item) return;
    const youtubeId = youtubeIdOf(item.url);
    let content = "";
    if (youtubeId) content = `<iframe src="https://www.youtube-nocookie.com/embed/${encodeURIComponent(youtubeId)}" title="${escapeHtml(item.title)}" allow="accelerometer; autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe>`;
    else if (item.type === "image") content = `<img src="${escapeHtml(item.url)}" alt="${escapeHtml(item.title)}">`;
    else if (item.type === "video") content = `<video src="${escapeHtml(item.url)}" controls playsinline></video>`;
    else if (item.type === "audio" && item.url) content = `<div class="media-audio-art"><span>♫</span><strong>${escapeHtml(item.title)}</strong></div><audio src="${escapeHtml(item.url)}" controls></audio>`;
    else if (item.id === "hh-ambient") content = `<div class="media-audio-art"><span>♫</span><strong>Trình phát nhạc nền HH</strong><p>Dùng bộ chọn nhạc ở cuối trang để phát 20 bản ambient.</p></div>`;
    else content = `<div class="media-link-preview"><span>↗</span><strong>${escapeHtml(item.title)}</strong><a href="${escapeHtml(item.url)}" target="_blank" rel="noopener">Mở liên kết</a></div>`;
    stage.innerHTML = content;
    const title = panel.querySelector("[data-media-preview-title]"); if (title) title.textContent = item.title;
    const source = panel.querySelector("[data-media-preview-source]"); if (source) source.textContent = item.source || item.category;
    const state = readMediaState(); writeMediaState(state, `Đã mở ${item.title}`);
  };

  const downloadPlatformOf = (value) => {
    try {
      const host = new URL(value).hostname.toLowerCase();
      if (host.includes("youtu")) return "YouTube";
      if (host.includes("tiktok")) return "TikTok";
      if (host.includes("facebook") || host.includes("fb.watch")) return "Facebook";
      if (host.includes("instagram")) return "Instagram";
      if (host.includes("twitter") || host === "x.com" || host.endsWith(".x.com")) return "X / Twitter";
      if (host.includes("reddit")) return "Reddit";
      if (host.includes("vimeo")) return "Vimeo";
      if (host.includes("soundcloud")) return "SoundCloud";
      return host.replace(/^www\./, "");
    } catch { return "Link chưa hợp lệ"; }
  };

  const downloadPanel = () => grid.querySelector("[data-social-downloader]");
  const downloadHistory = () => {
    try { return JSON.parse(localStorage.getItem("hh-download-history") || "[]"); } catch { return []; }
  };
  const updateDownloadHistory = (items) => {
    localStorage.setItem("hh-download-history", JSON.stringify(items.slice(0, 20)));
    const panel = downloadPanel();
    const list = panel?.querySelector("[data-download-history]");
    const count = panel?.querySelector("[data-download-count]");
    if (count) count.textContent = `${items.length} mục`;
    if (list) list.innerHTML = items.length ? items.slice(0, 8).map((item) => `
      <button class="download-history-item interactive" type="button" data-download-history-url="${escapeHtml(item.url)}">
        <span>${escapeHtml(item.platform)}</span><strong>${escapeHtml(item.title || item.url)}</strong><small>${escapeHtml(item.time)}</small>
      </button>`).join("") : "<p>Chưa có lượt tải trên thiết bị này.</p>";
  };
  const showDownloadPreview = (html, state = "") => {
    const preview = downloadPanel()?.querySelector("[data-download-preview]");
    if (!preview) return;
    preview.dataset.state = state;
    preview.innerHTML = html;
  };
  const checkDownloadService = async () => {
    const status = downloadPanel()?.querySelector("[data-download-service]");
    if (!status) return;
    if (!REALTIME_URL) { status.textContent = "Chưa kết nối"; return; }
    try {
      const response = await fetch(`${REALTIME_URL}/api/modules/download-center/actions`, { cache: "no-store" });
      const data = await response.json();
      status.textContent = data.configured ? "Sẵn sàng" : "Chờ cấu hình";
      status.closest(".downloader-live")?.classList.toggle("ready", Boolean(data.configured));
    } catch { status.textContent = "Mất kết nối"; }
  };
  const analyzeDownloadUrl = (value) => {
    const platform = downloadPlatformOf(value);
    if (!/^https?:\/\//i.test(value) || platform === "Link chưa hợp lệ") {
      showDownloadPreview('<div class="download-result error"><span>Lỗi URL</span><strong>Liên kết chưa hợp lệ</strong><p>Hãy dán đầy đủ link bắt đầu bằng https://</p></div>', "error");
      return false;
    }
    showDownloadPreview(`<div class="download-result ready"><span>${escapeHtml(platform)}</span><strong>Đã nhận diện liên kết</strong><p>${escapeHtml(value)}</p><div class="download-result-actions"><a class="interactive" href="${escapeHtml(value)}" target="_blank" rel="noopener">Mở bài gốc</a><button class="interactive" type="button" data-download-copy="${escapeHtml(value)}">Sao chép link</button></div></div>`, "ready");
    return true;
  };
  const requestDownload = async (form) => {
    const url = form.querySelector("[data-download-url]")?.value.trim() || "";
    if (!analyzeDownloadUrl(url)) return;
    const submit = form.querySelector("[data-download-submit]");
    if (submit) { submit.disabled = true; submit.textContent = "Đang xử lý..."; }
    showDownloadPreview('<div class="download-loading"><i></i><strong>Đang chuẩn bị bản tải</strong><p>Máy chủ đang kiểm tra media và định dạng phù hợp...</p></div>', "loading");
    try {
      if (!REALTIME_URL) throw new Error("Backend chưa được cấu hình.");
      const token = localStorage.getItem("hh-auth-token") || "";
      const response = await fetch(`${REALTIME_URL}/api/modules/download-center/actions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({
          url,
          downloadMode: form.querySelector("[data-download-mode]")?.value,
          videoQuality: form.querySelector("[data-download-quality]")?.value,
          audioBitrate: form.querySelector("[data-download-audio]")?.value,
          playlist: Boolean(form.querySelector("[data-download-playlist]")?.checked)
        })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Không thể tạo bản tải.");
      const candidates = data.status === "picker" ? (data.picker || []) : [{ url: data.url, filename: data.filename }];
      const links = candidates.filter((item) => item?.url).slice(0, 20);
      if (!links.length) throw new Error("Máy chủ chưa trả về tệp có thể tải.");
      showDownloadPreview(`<div class="download-result success"><span>Đã sẵn sàng</span><strong>${links.length > 1 ? `${links.length} tệp trong bộ sưu tập` : escapeHtml(links[0].filename || "Media đã xử lý")}</strong><p>Liên kết có thể hết hạn, hãy tải ngay.</p><div class="download-file-list">${links.map((item, index) => `<a class="interactive" href="${escapeHtml(item.url)}" target="_blank" rel="noopener" download>${escapeHtml(item.filename || `Tải tệp ${index + 1}`)}</a>`).join("")}</div></div>`, "success");
      const history = [{ url, platform: downloadPlatformOf(url), title: links[0].filename || "Media", time: new Date().toLocaleString("vi-VN") }, ...downloadHistory().filter((item) => item.url !== url)];
      updateDownloadHistory(history);
    } catch (error) {
      showDownloadPreview(`<div class="download-result error"><span>Chưa thể tải</span><strong>${escapeHtml(error.message)}</strong><p>Download Center đã hoạt động, nhưng cần cấu hình máy chủ tải media chuyên dụng để xử lý video.</p><div class="download-result-actions"><a class="interactive" href="https://cobalt.tools/" target="_blank" rel="noopener">Mở trình tải dự phòng</a><button class="interactive" type="button" data-download-retry>Thử lại</button></div></div>`, "error");
    } finally {
      if (submit) { submit.disabled = false; submit.textContent = "Tạo bản tải"; }
    }
  };

  grid.addEventListener("submit", (event) => {
    const form = event.target.closest("[data-download-form]");
    if (!form) return;
    event.preventDefault();
    requestDownload(form);
  });

  grid.addEventListener("submit",(event)=>{
    const quiz=event.target.closest("[data-learning-quiz]");if(quiz){event.preventDefault();let score=0;[0,1,2].forEach((index)=>{if(quiz.querySelector(`input[name="quiz-${index}"]:checked`)?.value==="0")score+=1;});const state=readLearningState();state.quizScore=Math.round(score/3*100);state.streak=(state.streak||1)+1;writeLearningState(state);const output=quiz.parentElement.querySelector("[data-learning-quiz-result]");if(output)output.innerHTML=`<strong>${state.quizScore}/100 điểm</strong><p>${score===3?"Xuất sắc! Bạn đã trả lời đúng toàn bộ.":`Bạn đúng ${score}/3 câu. Hãy xem lại bài học và thử lần nữa.`}</p>`;return;}
const communityForm=event.target.closest("[data-community-form]");if(communityForm){event.preventDefault();const input=communityForm.querySelector("[data-community-input]");const content=input?.value.trim();const mediaUrl=communityForm.querySelector("[data-community-media]")?.value.trim();const pending=communityComposerFiles.get(communityForm);const files=pending?.files||[];if(!content&&!mediaUrl&&!files.length)return input?.focus();const option=(name,fallback="")=>communityForm.querySelector(`[data-v2-composer-value="${name}"]`)?.value??fallback;const jsonOption=(name)=>{try{const value=JSON.parse(option(name,"[]"));return Array.isArray(value)?value:[];}catch{return [];}};const button=communityForm.querySelector('[type="submit"]');button.disabled=true;button.textContent=files.length?`Đang tải 0/${files.length}...`:"Đang đăng...";(async()=>{try{const mediaIds=[];for(let index=0;index<files.length;index+=1){button.textContent=`Đang tải ${index+1}/${files.length}...`;const uploaded=await communityUploadMedia(files[index]);mediaIds.push(uploaded.media.id);}button.textContent="Đang đăng...";await communityMutate({action:"create",content,mediaUrl,mediaIds,mediaType:communityForm.querySelector("[data-community-media-type]")?.value,topic:communityForm.querySelector("[data-community-category]")?.value,privacy:communityForm.querySelector("[data-community-privacy]")?.value,audienceIncludeIds:jsonOption("audienceIncludeIds"),audienceExcludeIds:jsonOption("audienceExcludeIds"),feeling:communityForm.querySelector("[data-community-feeling-value]")?.value||"",location:communityForm.querySelector("[data-community-location-value]")?.value||"",pollQuestion:communityForm.querySelector("[data-community-poll-question]")?.value||"",pollOptions:[...communityForm.querySelectorAll("[data-community-poll-option]")].map((field)=>field.value.trim()).filter(Boolean),scheduledAt:option("scheduledAt"),background:option("background"),canReshare:option("canReshare","true")!=="false",commentsEnabled:option("commentsEnabled","true")!=="false",hideReactionCounts:option("hideReactionCounts","false")==="true"});input.value="";const media=communityForm.querySelector("[data-community-media]");if(media)media.value="";const picker=communityForm.querySelector("[data-community-file]");if(picker)picker.value="";communityRenderComposerFiles(communityForm,[]);communityForm.querySelector("[data-community-media-fields]").hidden=true;communityNotice("Bài viết đã xuất hiện trên bảng tin.","success");localStorage.removeItem("hh-community-draft");communityForm.querySelector("[data-social-composer-extra]")?.remove();communityForm.querySelectorAll("[data-community-feeling-value],[data-community-location-value],[data-v2-composer-value]").forEach((field)=>field.remove());}catch(error){communityNotice(error.message,"error");}finally{button.disabled=false;button.textContent="Đăng";}})();return;}
    const commentForm=event.target.closest("[data-comment-form]");if(commentForm){event.preventDefault();const input=commentForm.querySelector("input");const text=input?.value.trim();if(!text)return;const button=commentForm.querySelector("button");button.disabled=true;(async()=>{try{await communityMutate({action:"comment",postId:commentForm.dataset.commentForm,text,parentId:commentForm.dataset.parentId||""});input.value="";communityNotice("Đã gửi bình luận.","success");}catch(error){communityNotice(error.message,"error");}finally{button.disabled=false;}})();return;}
  });

  grid.addEventListener("change", (event) => {
    const cloudUpload=event.target.closest("[data-cloud-upload]");if(cloudUpload){const files=Array.from(cloudUpload.files||[]).slice(0,10);(async()=>{for(const file of files){if(file.size>45000){window.alert(`${file.name} vượt giới hạn 45 KB.`);continue;}const content=await file.text();await uploadCloudText(file.name,file.type||"text/plain",content,file.size);}await loadCloudFiles();})().catch((error)=>window.alert(error.message));cloudUpload.value="";return;}
    const communityFile=event.target.closest("[data-community-file]");if(communityFile){const form=communityFile.closest("[data-community-form]");const source=Array.from(communityFile.files||[]);const selected=source.slice(0,12);const accepted=selected.filter((file)=>/^(image|video)\//.test(file.type)&&file.size<=COMMUNITY_MEDIA_LIMIT);if(accepted.length!==source.length)communityNotice(`Đã nhận ${accepted.length}/${source.length} tệp hợp lệ. Tối đa 12 ảnh/video, mỗi tệp nhỏ hơn 2,5 MB.`,"error");communityRenderComposerFiles(form,accepted);return;}
    const avatarUpload=event.target.closest("[data-user-avatar-upload]");if(avatarUpload){const file=avatarUpload.files?.[0];if(!file)return;if(file.size>1024*1024){window.alert("Ảnh avatar cần nhỏ hơn 1 MB.");return;}const reader=new FileReader();reader.onload=()=>{const state=readUserState();state.avatar=reader.result;writeUserState(state);rerenderModule("user-dashboard");};reader.readAsDataURL(file);return;}
    const userToggle=event.target.closest("[data-user-notification],[data-user-setting]");if(userToggle){const state=readUserState();if(userToggle.dataset.userNotification!==undefined){state.notifications=state.notifications||{};state.notifications[userToggle.dataset.userNotification]=userToggle.checked;}else{state.settings=state.settings||{};state.settings[userToggle.dataset.userSetting]=userToggle.checked;}writeUserState(state);return;}
    const widgetToggle=event.target.closest("[data-widget-toggle]");if(widgetToggle){const state=JSON.parse(localStorage.getItem("hh-widgets-engine")||"{}");state[widgetToggle.dataset.widgetToggle]=widgetToggle.checked;localStorage.setItem("hh-widgets-engine",JSON.stringify(state));const panel=widgetToggle.closest("[data-widgets-engine]");if(panel)panel.querySelector("[data-widgets-output]").textContent=`Đã ${widgetToggle.checked?"bật":"ẩn"} widget ${widgetToggle.dataset.widgetToggle}.`;return;}
    if(event.target.matches("[data-smart-sort]")){const panel=event.target.closest("[data-smart-search]");renderSmartSearch(panel?.querySelector("[data-smart-query]")?.value||"",panel?.querySelector("[data-smart-filter].active")?.dataset.smartFilter||"all");return;}
    const projectSelect = event.target.closest("[data-project-select]");
    if (projectSelect) { const state=ensureProjectState(); state.activeProject=projectSelect.value; writeProjectState(state,`Đã mở ${state.projects.find((item)=>item.id===state.activeProject)?.name||"dự án"}`); rerenderModule("project-center","overview"); return; }
    const projectProgress = event.target.closest("[data-project-progress]");
    if (projectProgress) { const panel=projectProgress.closest("[data-project-center]");const state=ensureProjectState();const item=state.projects.find((entry)=>entry.id===panel?.dataset.activeProject);if(item){item.progress=Number(projectProgress.value);writeProjectState(state,`Tiến độ ${item.name}: ${item.progress}%`);}return; }
    const mediaUpload = event.target.closest("[data-media-upload]");
    if (mediaUpload) {
      const files=Array.from(mediaUpload.files||[]).slice(0,20);
      const panel=mediaUpload.closest("[data-media-center]");
      const activity=panel?.querySelector("[data-media-activity]");
      (async()=>{let saved=0;for(const file of files){const type=file.type.startsWith("image/")?"image":file.type.startsWith("video/")?"video":file.type.startsWith("audio/")?"audio":"";if(!type)continue;const category=type==="image"?"images":type==="video"?"videos":"music";const id=`device-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;const record={id,title:file.name,type,category,size:file.size,favorite:false,createdAt:new Date().toISOString(),file};try{await mediaDbPut(record);saved+=1;}catch{mediaSessionItems.set(id,{id,title:file.name,type,category,url:URL.createObjectURL(file),source:`${(file.size/1024/1024).toFixed(1)} MB · Phiên hiện tại`,favorite:false,local:true});}}const state=readMediaState();writeMediaState(state,`Đã nhập ${saved||files.length} tệp từ thiết bị`);await hydrateMediaLibrary();if(activity)activity.insertAdjacentHTML("afterbegin",`<p>Đã nhập ${saved||files.length} tệp từ thiết bị.</p>`);})().catch((error)=>{if(activity)activity.innerHTML=`<p>${escapeHtml(error.message)}</p>`;});
      mediaUpload.value = "";
      return;
    }
    const moduleStep = event.target.closest("[data-module-step]");
    if (moduleStep) {
      const [moduleId, stepIndex] = moduleStep.dataset.moduleStep.split(":");
      const allState = readPlatformState();
      const current = allState[moduleId] || {};
      const steps = { ...(current.steps || {}), [stepIndex]: moduleStep.checked };
      allState[moduleId] = { ...current, steps, savedAt: new Date().toISOString() };
      writePlatformState(allState);
      updateModuleProgress(moduleId);
      logModuleActivity(moduleId, moduleStep.checked ? `Hoàn thành bước ${Number(stepIndex) + 1}` : `Mở lại bước ${Number(stepIndex) + 1}`);
      return;
    }
    const toggle = event.target.closest("[data-command-toggle-todo]");
    if (!toggle) return;
    const state = readCommandCenterState();
    const todo = state.todos?.[Number(toggle.dataset.commandToggleTodo)];
    if (todo) todo.done = toggle.checked;
    writeCommandCenterState(state);
    renderCommandTodos();
    logCommandActivity(toggle.checked ? "Hoàn thành todo" : "Mở lại todo");
  });

  grid.addEventListener("click", (event) => {
    const notification=event.target.closest("[data-notification]");if(notification){const readState=()=>{try{return JSON.parse(localStorage.getItem("hh-notification-center")||"{}");}catch{return {};}};const defaults=[{title:"Chào mừng đến HH Platform",message:"Các trung tâm 01-15 đã sẵn sàng để sử dụng.",time:"Hôm nay",read:false,type:"system"},{title:"Media Center v22",message:"Thư viện media đã được nâng cấp.",time:"Gần đây",read:true,type:"update"}];const save=(state)=>localStorage.setItem("hh-notification-center",JSON.stringify(state));if(event.target.closest("[data-notification-enable]")){if("Notification" in window)Notification.requestPermission().then((permission)=>{event.target.closest("[data-notification-enable]").textContent=permission==="granted"?"Đã cho phép":"Chưa được cho phép";});return;}const filter=event.target.closest("[data-notification-filter]");if(filter){notification.querySelectorAll("[data-notification-filter]").forEach((item)=>item.classList.toggle("active",item===filter));notification.querySelectorAll("[data-notification-item]").forEach((item)=>item.hidden=filter.dataset.notificationFilter==="unread"&&item.classList.contains("read")||!["all","unread"].includes(filter.dataset.notificationFilter)&&item.dataset.notificationType!==filter.dataset.notificationFilter);return;}const read=event.target.closest("[data-notification-read]");if(read){const state=readState();state.inbox=state.inbox||defaults;state.inbox[Number(read.dataset.notificationRead)].read=true;save(state);rerenderModule("notification-center");return;}if(event.target.closest("[data-notification-read-all]")){const state=readState();state.inbox=(state.inbox||defaults).map((item)=>({...item,read:true}));save(state);rerenderModule("notification-center");return;}if(event.target.closest("[data-notification-subscribe]")){const status=notification.querySelector("[data-notification-status]");(async()=>{try{const token=localStorage.getItem("hh-auth-token")||"";const response=await fetch(`${REALTIME_URL}/api/notifications/subscribe`,{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${token}`},body:JSON.stringify({channel:notification.querySelector("[data-notification-channel]").value,target:notification.querySelector("[data-notification-target]").value,preferences:Object.fromEntries(Array.from(notification.querySelectorAll("[data-notification-pref]")).map((item)=>[item.dataset.notificationPref,item.checked]))})});const data=await response.json();if(!response.ok)throw new Error(data.error||"Lưu thất bại");status.textContent=`Đã lưu đăng ký ${data.subscription.channel}. ${data.subscription.note}`;}catch(error){status.textContent=error.message;}})();return;}}
    const apiCenter=event.target.closest("[data-api-center]");if(apiCenter){const endpoints=[{method:"GET",path:"/api/auth/me",name:"Phiên người dùng",description:"Trả về tài khoản hiện tại và lịch sử đăng nhập."},{method:"GET",path:"/api/store/products",name:"Sản phẩm",description:"Danh sách sản phẩm số công khai."},{method:"GET",path:"/api/storage/files",name:"Cloud files",description:"Metadata file riêng của tài khoản."},{method:"GET",path:"/api/platform/summary",name:"Admin summary",description:"Thống kê chỉ dành cho chủ sở hữu."},{method:"POST",path:"/api/notifications/subscribe",name:"Đăng ký thông báo",description:"Lưu kênh thông báo vào MongoDB."},{method:"POST",path:"/api/store/orders",name:"Tạo đơn hàng",description:"Tạo đơn chờ thanh toán thủ công."},{method:"GET",path:"/api/search/google?health=1",name:"Search Gateway",description:"Một function động dùng chung cho Google và YouTube."},{method:"GET",path:"/api/search/youtube?q=music",name:"YouTube Search",description:"Tìm video, channel hoặc playlist qua YouTube Data API."},{method:"GET",path:"/api/search/google?q=AI",name:"Google Search",description:"Tìm web hoặc hình ảnh qua Programmable Search."}];const open=event.target.closest("[data-api-open]");if(open){const item=endpoints[Number(open.dataset.apiOpen)];apiCenter.querySelectorAll("[data-api-open]").forEach((node)=>node.classList.toggle("active",node===open));apiCenter.querySelector("[data-api-method]").value=item.method;apiCenter.querySelector("[data-api-path]").value=item.path;apiCenter.querySelector("[data-api-doc-title]").textContent=item.name;apiCenter.querySelector("[data-api-doc-path]").textContent=`${item.method} ${item.path}`;apiCenter.querySelector("[data-api-doc-description]").textContent=item.description;return;}if(event.target.closest("[data-api-send]")){const method=apiCenter.querySelector("[data-api-method]").value;const path=apiCenter.querySelector("[data-api-path]").value;const output=apiCenter.querySelector("[data-api-response]");const start=performance.now();output.textContent="Đang gửi request...";(async()=>{try{const token=localStorage.getItem("hh-auth-token")||"";const options={method,headers:{"Content-Type":"application/json",...(token?{Authorization:`Bearer ${token}`}:{})}};if(method!=="GET")options.body=apiCenter.querySelector("[data-api-body]").value||"{}";const response=await fetch(`${REALTIME_URL}${path}`,options);const data=await response.json().catch(()=>({}));output.textContent=JSON.stringify({status:response.status,ok:response.ok,data},null,2);apiCenter.querySelector("[data-api-timing]").textContent=`${Math.round(performance.now()-start)} ms · HTTP ${response.status}`;}catch(error){output.textContent=error.message;}})();return;}if(event.target.closest("[data-api-copy-curl]")){const method=apiCenter.querySelector("[data-api-method]").value;const path=apiCenter.querySelector("[data-api-path]").value;navigator.clipboard.writeText(`curl -X ${method} "${REALTIME_URL}${path}" -H "Authorization: Bearer YOUR_TOKEN" -H "Content-Type: application/json"`);return;}}
    const developer=event.target.closest("[data-developer]");if(developer){const tab=event.target.closest("[data-dev-tab]");if(tab){developer.querySelectorAll("[data-dev-tab]").forEach((item)=>item.classList.toggle("active",item===tab));developer.querySelectorAll("[data-dev-pane]").forEach((item)=>item.classList.toggle("active",item.dataset.devPane===tab.dataset.devTab));return;}}
    const security=event.target.closest("[data-security]");if(security){const tab=event.target.closest("[data-security-tab]");if(tab){security.querySelectorAll("[data-security-tab]").forEach((item)=>item.classList.toggle("active",item===tab));security.querySelectorAll("[data-security-pane]").forEach((item)=>item.classList.toggle("active",item.dataset.securityPane===tab.dataset.securityTab));return;}if(event.target.closest("[data-security-check]")){loadSecurityData();security.querySelector("[data-security-alert] strong").textContent="Đang xác minh phiên với máy chủ...";return;}if(event.target.closest("[data-security-logout]")){(async()=>{await revokeCurrentSession();localStorage.removeItem("hh-auth-token");localStorage.removeItem("hh-auth-user");localStorage.removeItem("hh-community-center");Object.keys(localStorage).filter((key)=>key.startsWith("hh-community-center:")).forEach((key)=>localStorage.removeItem(key));location.reload();})();return;}}
    const smart=event.target.closest("[data-smart-search]");if(smart){const suggestion=event.target.closest("[data-smart-suggestion]");if(suggestion){const input=smart.querySelector("[data-smart-query]");input.value=suggestion.dataset.smartSuggestion;renderSmartSearch(input.value);return;}const filter=event.target.closest("[data-smart-filter]");if(filter){smart.querySelectorAll("[data-smart-filter]").forEach((item)=>item.classList.toggle("active",item===filter));renderSmartSearch(smart.querySelector("[data-smart-query]").value,filter.dataset.smartFilter);return;}const result=event.target.closest("[data-smart-result]");if(result){try{const item=JSON.parse(result.dataset.smartItem);smart.querySelector("[data-smart-preview]").innerHTML=`<span>${escapeHtml(item.type.toUpperCase())}</span><h5>${escapeHtml(item.title)}</h5><p>${escapeHtml(item.description||"")}</p><button class="button primary interactive" type="button" data-smart-open-module="${escapeHtml(item.id)}">Mở nội dung</button>`;}catch{}return;}const openModule=event.target.closest("[data-smart-open-module]");if(openModule){const moduleCard=grid.querySelector(`[data-module-id="${CSS.escape(openModule.dataset.smartOpenModule)}"]`);moduleCard?.scrollIntoView({behavior:"smooth",block:"start"});return;}}
    const launcher=event.target.closest("[data-app-launcher]");if(launcher){const open=event.target.closest("[data-launcher-open]");if(open){const card=grid.querySelector(`[data-module-id="${CSS.escape(open.dataset.launcherOpen)}"]`);card?.scrollIntoView({behavior:"smooth",block:"start"});card?.querySelector("[data-inline-open]")?.click();return;}}
    const widgets=event.target.closest("[data-widgets-engine]");if(widgets&&event.target.closest("[data-widgets-reset]")){widgets.querySelectorAll("[data-widget-toggle]").forEach(item=>item.checked=true);localStorage.removeItem("hh-widgets-engine");widgets.querySelector("[data-widgets-output]").textContent="Đã khôi phục bố cục widget mặc định.";return;}
    const market=event.target.closest("[data-marketplace]");if(market){const install=event.target.closest("[data-market-install]");if(install){const key="hh-marketplace-installed";let items=[];try{items=JSON.parse(localStorage.getItem(key)||"[]");}catch{}items=items.includes(install.dataset.marketInstall)?items.filter(x=>x!==install.dataset.marketInstall):[...items,install.dataset.marketInstall];localStorage.setItem(key,JSON.stringify(items));install.textContent=items.includes(install.dataset.marketInstall)?"Đã cài · Gỡ":"Cài đặt";market.querySelector("[data-market-status]").textContent=`Đã cài ${items.length} tiện ích cục bộ.`;return;}}
    const pwa=event.target.closest("[data-mobile-pwa]");if(pwa){if(event.target.closest("[data-pwa-check]")){const cache="caches" in window?"Trình duyệt hỗ trợ cache":"Chưa hỗ trợ cache";pwa.querySelector("[data-pwa-cache]").textContent=cache;pwa.querySelector("[data-pwa-status]").textContent=`${navigator.onLine?"Online":"Offline"} · ${cache}`;return;}if(event.target.closest("[data-pwa-install]")){pwa.querySelector("[data-pwa-status]").textContent="Mở menu trình duyệt và chọn “Cài đặt ứng dụng” nếu thiết bị hỗ trợ.";return;}}
    const uiKit=event.target.closest("[data-ui-kit]");if(uiKit&&event.target.closest("[data-ui-save]")){const value=Object.fromEntries(Array.from(uiKit.querySelectorAll("[data-ui-option]")).map(node=>[node.dataset.uiOption,node.checked]));localStorage.setItem("hh-ui-kit",JSON.stringify(value));document.body.classList.toggle("ui-compact",value.compact);document.body.classList.toggle("ui-high-contrast",value.contrast);document.body.classList.toggle("ui-reduce-motion",value.motion);uiKit.querySelector("[data-ui-status]").textContent="Đã lưu và áp dụng giao diện.";return;}
    const automation=event.target.closest("[data-automation]");if(automation){if(event.target.closest("[data-auto-run]")){const input=automation.querySelector("[data-auto-input]")?.value.trim();if(!input)return automation.querySelector("[data-auto-input]")?.focus();const platform=automation.querySelector("[data-auto-platform]").value;const style=automation.querySelector("[data-auto-style]").value;const enabled=Array.from(automation.querySelectorAll("[data-auto-step]:checked")).map((item)=>item.dataset.autoStep);const keywords=[...new Set(input.toLowerCase().replace(/[^a-z0-9\u00C0-\u024f\s]/g,"").split(/\s+/).filter((word)=>word.length>4))].slice(0,8);const blocks={title:`TIÊU ĐỀ\n${input.slice(0,65)}: Điều Bạn Chưa Từng Biết`,description:`MÔ TẢ\nNội dung ${style.toLowerCase()} dành cho ${platform}: ${input}\n\nTheo dõi HH để xem thêm nội dung mới.`,tags:`TAGS\n${keywords.map((word)=>`#${word.replace(/\s/g,"")}`).join(" ")}`,translation:`TRANSLATION PROMPT\nTranslate the following content naturally while preserving tone and intent:\n${input}`,summary:`TÓM TẮT\n${input.split(/[.!?]/).filter(Boolean).slice(0,3).join(". ").trim()}.`,voice:`VOICE PROMPT\nGiọng đọc ${style.toLowerCase()}, tốc độ vừa, ngắt nghỉ tự nhiên, nhấn mạnh từ khóa chính.`,thumbnail:`THUMBNAIL PROMPT\nẢnh thumbnail ${platform}, chủ thể rõ, tương phản mạnh, chữ lớn 3-5 từ: “${input.slice(0,35).toUpperCase()}”, không watermark.`};const output=enabled.map((key)=>blocks[key]).join("\n\n---\n\n");automation.querySelector("[data-auto-output]").textContent=output;automation.querySelector("[data-auto-progress]").style.width="100%";automation.querySelector("[data-auto-status]").textContent=`Hoàn tất ${enabled.length}/7 tác vụ`;return;}if(event.target.closest("[data-auto-clear]")){automation.querySelector("[data-auto-input]").value="";automation.querySelector("[data-auto-output]").textContent="Đã xóa workflow.";return;}if(event.target.closest("[data-auto-copy]")){navigator.clipboard.writeText(automation.querySelector("[data-auto-output]").textContent);return;}if(event.target.closest("[data-auto-export]")){downloadText("hh-ai-automation.txt",automation.querySelector("[data-auto-output]").textContent);return;}}
    const creator=event.target.closest("[data-creator]");if(creator){const tab=event.target.closest("[data-creator-tab]");if(tab){creator.querySelectorAll("[data-creator-tab]").forEach((item)=>item.classList.toggle("active",item===tab));return;}if(event.target.closest("[data-creator-generate]")){const topic=creator.querySelector("[data-creator-topic]").value.trim();if(!topic)return creator.querySelector("[data-creator-topic]").focus();const platform=creator.querySelector("[data-creator-platform]").value;const tone=creator.querySelector("[data-creator-tone]").value;const score=Math.min(98,58+Math.round(topic.length/3)+creator.querySelectorAll("[data-creator-check]:checked").length*5);creator.querySelector("[data-creator-score]").textContent=score;const outputs={title:`1. ${topic}: Sự Thật Khiến Ai Cũng Bất Ngờ\n2. Điều Không Ai Nói Về ${topic}\n3. Sau Tất Cả, ${topic} Đã Thay Đổi Mọi Thứ`,script:`HOOK\nBạn có từng nghĩ rằng ${topic.toLowerCase()} lại dẫn tới một kết quả không ai đoán trước?\n\nMỞ ĐẦU\nGiới thiệu hoàn cảnh và nhân vật.\n\nPHÁT TRIỂN\n1. Vấn đề chính\n2. Xung đột tăng dần\n3. Bước ngoặt\n\nCAO TRÀO\nTiết lộ chi tiết quan trọng nhất.\n\nKẾT\nBài học và CTA tự nhiên.`,seo:`SEO SCORE: ${score}/100\nTừ khóa chính: ${topic}\nNền tảng: ${platform}\nTone: ${tone}\nKhuyến nghị: đưa từ khóa vào 60 ký tự đầu và 2 câu đầu mô tả.`,thumbnail:`Chủ thể biểu cảm rõ, nền tương phản hồng neon và cyan, ánh sáng điện ảnh, chữ lớn “${topic.slice(0,28).toUpperCase()}”, bố cục 16:9, không watermark.`};creator.dataset.outputs=JSON.stringify(outputs);creator.querySelector("[data-creator-output]").textContent=outputs.title;creator.querySelector("[data-thumbnail-preview] small").textContent=topic.slice(0,42);const tags=topic.toLowerCase().split(/\s+/).filter((word)=>word.length>3).slice(0,6);creator.querySelector("[data-creator-tags]").innerHTML=tags.map((tag)=>`<span>#${escapeHtml(tag)}</span>`).join("");return;}const outputTab=event.target.closest("[data-creator-output-tab]");if(outputTab){creator.querySelectorAll("[data-creator-output-tab]").forEach((item)=>item.classList.toggle("active",item===outputTab));try{creator.querySelector("[data-creator-output]").textContent=JSON.parse(creator.dataset.outputs||"{}")[outputTab.dataset.creatorOutputTab]||"Hãy tạo bộ nội dung trước.";}catch{}return;}if(event.target.closest("[data-creator-export]")){downloadText("hh-creator-studio.txt",creator.querySelector("[data-creator-output]").textContent);return;}}
    const analytics=event.target.closest("[data-analytics]");if(analytics&&event.target.closest("[data-analytics-refresh]")){rerenderModule("analytics");return;}
    const store=event.target.closest("[data-store]");if(store){if(event.target.closest("[data-store-cart]")){store.querySelector("[data-cart-panel]")?.scrollIntoView({behavior:"smooth",block:"center"});return;}const filter=event.target.closest("[data-store-filter]");if(filter){store.querySelectorAll("[data-store-filter]").forEach((item)=>item.classList.toggle("active",item===filter));store.querySelectorAll(".product-card").forEach((card)=>card.hidden=filter.dataset.storeFilter!=="tất cả"&&!card.dataset.productType.includes(filter.dataset.storeFilter.replace("tool","download").replace("source","source").replace("membership","membership")));return;}const add=event.target.closest("[data-product-add]");if(add){const product=storeProductsCache.find((item)=>item.id===add.dataset.productAdd);if(product){const cart=readCart();const row=cart.find((item)=>item.id===product.id);if(row)row.quantity+=1;else cart.push({...product,quantity:1});writeCart(cart);renderCart();}return;}const remove=event.target.closest("[data-cart-remove]");if(remove){writeCart(readCart().filter((item)=>item.id!==remove.dataset.cartRemove));renderCart();return;}if(event.target.closest("[data-cart-clear]")){writeCart([]);renderCart();return;}if(event.target.closest("[data-checkout]")){const cart=readCart();const status=store.querySelector("[data-checkout-status]");if(!cart.length){status.textContent="Giỏ hàng đang trống.";return;}(async()=>{try{const token=localStorage.getItem("hh-auth-token")||"";const response=await fetch(`${REALTIME_URL}/api/store/orders`,{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${token}`},body:JSON.stringify({items:cart,customer:{name:store.querySelector("[data-checkout-name]").value,email:store.querySelector("[data-checkout-email]").value,phone:store.querySelector("[data-checkout-phone]").value}})});const data=await response.json();if(!response.ok)throw new Error(data.error||"Đặt hàng lỗi");status.textContent=`Đã tạo đơn ${data.order._id}. Trạng thái: chờ thanh toán thủ công.`;writeCart([]);renderCart();}catch(error){status.textContent=error.message;}})();return;}}
    const cloud=event.target.closest("[data-cloud]");if(cloud){const filter=event.target.closest("[data-cloud-filter]");if(filter){cloud.querySelectorAll("[data-cloud-filter]").forEach((item)=>item.classList.toggle("active",item===filter));cloud.querySelectorAll("[data-cloud-file]").forEach((row)=>{const item=cloudFilesCache.find((entry)=>String(entry._id)===row.dataset.cloudFile);row.hidden=filter.dataset.cloudFilter==="text"&&!String(item?.mimeType).includes("text")||filter.dataset.cloudFilter==="recent"&&(Date.now()-new Date(item?.createdAt).getTime()>7*86400000);});return;}if(event.target.closest("[data-cloud-refresh]")){loadCloudFiles();return;}if(event.target.closest("[data-cloud-new-text]")){const name=window.prompt("Tên file:","ghi-chu.txt")?.trim();const content=name&&window.prompt("Nội dung file:")||"";if(name)uploadCloudText(name,"text/plain",content,content.length).then(loadCloudFiles).catch((error)=>window.alert(error.message));return;}const file=event.target.closest("[data-cloud-file]");if(file){const item=cloudFilesCache.find((entry)=>String(entry._id)===file.dataset.cloudFile);cloud.querySelector("[data-cloud-preview]").textContent=JSON.stringify(item,null,2);return;}if(event.target.closest("[data-cloud-export-list]")){downloadText("hh-cloud-files.json",JSON.stringify(cloudFilesCache,null,2),"application/json;charset=utf-8");return;}if(event.target.closest("[data-cloud-close]")){cloud.querySelector("[data-cloud-preview]").textContent="Chọn một file để xem metadata.";return;}}
    const learning=event.target.closest("[data-learning-center]");if(learning){const tab=event.target.closest("[data-learning-tab]");if(tab){learning.querySelectorAll("[data-learning-tab]").forEach((item)=>item.classList.toggle("active",item===tab));learning.querySelectorAll("[data-learning-pane]").forEach((item)=>item.classList.toggle("active",item.dataset.learningPane===tab.dataset.learningTab));return;}const course=event.target.closest("[data-course-open]");if(course){const state=readLearningState();state.activeCourse=course.dataset.courseOpen;writeLearningState(state);rerenderModule("learning-center");return;}const lesson=event.target.closest("[data-lesson-toggle]");if(lesson){const state=readLearningState();state.progress=state.progress||{};state.progress[lesson.dataset.lessonToggle]=!state.progress[lesson.dataset.lessonToggle];writeLearningState(state);rerenderModule("learning-center");return;}if(event.target.closest("[data-learning-save-notes]")){const state=readLearningState();state.notes=learning.querySelector("[data-learning-notes]")?.value||"";writeLearningState(state);return;}if(event.target.closest("[data-learning-export-notes]")){downloadText("hh-learning-notes.txt",learning.querySelector("[data-learning-notes]")?.value||"");return;}if(event.target.closest("[data-learning-certificate]")){const state=readLearningState();const courseName=learning.querySelector(".learning-course-head h5")?.textContent||"Khóa học";downloadText("hh-certificate.txt",`CHỨNG NHẬN HOÀN THÀNH\n\n${courseName}\n\nHọc viên: ${JSON.parse(localStorage.getItem("hh-auth-user")||"{}").name||"Thành viên HH"}\nNgày: ${new Date().toLocaleDateString("vi-VN")}\nĐiểm quiz: ${state.quizScore||0}/100`);return;}if(event.target.closest("[data-learning-reset]")){const state=readLearningState();state.progress={};state.quizScore=0;writeLearningState(state);rerenderModule("learning-center");return;}}
    const community=event.target.closest("[data-community-center]");if(community){
      const react=event.target.closest("[data-post-react]");if(react){const type=react.dataset.currentReaction?"remove":"like";communityMutate({action:"react",postId:react.dataset.postReact,type}).catch((error)=>communityNotice(error.message,"error"));return;}
      const picked=event.target.closest("[data-post-reaction]");if(picked){communityMutate({action:"react",postId:picked.dataset.postReaction,type:picked.dataset.reactionType}).catch((error)=>communityNotice(error.message,"error"));return;}
      const save=event.target.closest("[data-post-save]");if(save){communityMutate({action:"save",postId:save.dataset.postSave}).then(()=>communityNotice("Đã cập nhật bộ sưu tập đã lưu.","success")).catch((error)=>communityNotice(error.message,"error"));return;}
      const share=event.target.closest("[data-post-share]");if(share){const url=`${location.href.split("#")[0]}#community-post-${share.dataset.postShare}`;(navigator.share?navigator.share({title:"Bài viết HH Community",url}):navigator.clipboard.writeText(url)).then(()=>{share.textContent="Đã chia sẻ";}).catch(()=>{});return;}
      const toggle=event.target.closest("[data-post-comment-toggle]");if(toggle){const form=community.querySelector(`[data-comment-form="${toggle.dataset.postCommentToggle}"]`);form?.querySelector("input")?.focus();return;}
      const reply=event.target.closest("[data-comment-reply]");if(reply){const form=reply.closest("[data-post-comments]")?.querySelector("form");if(form){form.dataset.parentId=reply.dataset.commentReply;const input=form.querySelector("input");input.placeholder="Viết câu trả lời...";input.focus();}return;}
      if(event.target.closest("[data-community-add-media]")){const form=community.querySelector("[data-community-form]");const fields=form.querySelector("[data-community-media-fields]");fields.hidden=false;let picker=fields.querySelector("[data-community-file]");if(!picker){const label=document.createElement("label");label.className="community-device-picker";label.innerHTML="<span>＋ Chọn từ thiết bị</span><small>Tối đa 12 ảnh/video · 2,5 MB mỗi tệp</small>";picker=document.createElement("input");picker.type="file";picker.multiple=true;picker.accept="image/*,video/*";picker.dataset.communityFile="";picker.setAttribute("aria-label","Chọn tối đa 12 ảnh hoặc video từ thiết bị");label.prepend(picker);fields.prepend(label);}picker.click();return;}
      if(event.target.closest("[data-community-remove-media]")){const form=event.target.closest("[data-community-form]");const picker=form?.querySelector("[data-community-file]");if(picker)picker.value="";if(form)communityRenderComposerFiles(form,[]);return;}
      if(event.target.closest("[data-community-feeling]")){const input=community.querySelector("[data-community-input]");input.value+=`${input.value?" ":""}Đang cảm thấy vui vẻ 😊`;input.focus();return;}
      if(event.target.closest("[data-community-checkin]")){const input=community.querySelector("[data-community-input]");input.value+=`${input.value?" ":""}📍 Hưng Yên`;input.focus();return;}
      const topic=event.target.closest("[data-community-topic]");if(topic){community.querySelectorAll("[data-community-topic]").forEach((item)=>item.classList.toggle("active",item===topic));community.querySelectorAll("[data-post-id]").forEach((post)=>post.hidden=!post.textContent.includes(`#${topic.dataset.communityTopic}`));return;}
      const filter=event.target.closest("[data-community-filter]");if(filter){community.querySelectorAll("[data-community-filter]").forEach((item)=>item.classList.toggle("active",item===filter));const state=ensureCommunityState();const followingIds=new Set((state.communitySuggestions||[]).filter((item)=>item.following).map((item)=>String(item.id)));community.querySelectorAll("[data-post-id]").forEach((node)=>{const post=(state.remotePosts||state.posts||[]).find((item)=>String(item.id)===node.dataset.postId);const mode=filter.dataset.communityFilter;node.hidden=mode==="popular"&&(post?.reactionCount||post?.likes||0)<5||mode==="saved"&&!post?.saved||mode==="following"&&!followingIds.has(String(post?.author?.id||""));});return;}
      const view=event.target.closest("[data-community-view]");if(view){const mode=view.dataset.communityView;if(mode==="creator"){location.hash="/create/creator-studio";return;}if(mode==="memories"){const list=community.querySelector("[data-community-posts]");if(list)[...list.children].reverse().forEach((post)=>list.append(post));communityNotice("Đang xem các kỷ niệm theo thứ tự cũ nhất.","success");return;}(async()=>{const state=ensureCommunityState();if(mode==="friends"){const names=(state.communitySuggestions||[]).map((item)=>`• ${item.name}${item.following?" · đang theo dõi":""}`).join("\n")||"Chưa có gợi ý kết nối mới.";await communityDialog({title:"Bạn bè và kết nối",message:names,actions:[{id:"close",label:"Đóng"}]});return;}if(mode==="groups"){const groups=(state.communityGroups||[]).map((item)=>`• ${item.name} · ${item.memberCount} thành viên`).join("\n")||"Chưa có nhóm công khai.";const result=await communityDialog({title:"Nhóm cộng đồng",message:groups,actions:[{id:"close",label:"Đóng"},{id:"create",label:"Tạo nhóm",primary:true}]});if(result.action==="create"){const form=await communityDialog({title:"Tạo nhóm mới",fields:[{name:"name",label:"Tên nhóm",placeholder:"Ví dụ: AI Creator Việt Nam"},{name:"description",label:"Giới thiệu",type:"textarea",placeholder:"Mục tiêu và nội quy nhóm..."}],actions:[{id:"cancel",label:"Hủy"},{id:"save",label:"Tạo nhóm",primary:true}]});if(form.action==="save"){await communityMutate({action:"group:create",...form.values});communityNotice("Nhóm mới đã được tạo.","success");}}return;}if(mode==="events"){const events=(state.communityEvents||[]).map((item)=>`• ${item.name} · ${new Date(item.startsAt).toLocaleString("vi-VN")}`).join("\n")||"Chưa có sự kiện sắp tới.";const result=await communityDialog({title:"Sự kiện cộng đồng",message:events,actions:[{id:"close",label:"Đóng"},{id:"create",label:"Tạo sự kiện",primary:true}]});if(result.action==="create"){const form=await communityDialog({title:"Tạo sự kiện",fields:[{name:"name",label:"Tên sự kiện",placeholder:"Tên buổi gặp hoặc livestream"},{name:"startsAt",label:"Thời gian",type:"datetime-local"},{name:"description",label:"Mô tả",type:"textarea",placeholder:"Nội dung sự kiện..."}],actions:[{id:"cancel",label:"Hủy"},{id:"save",label:"Đăng sự kiện",primary:true}]});if(form.action==="save"){await communityMutate({action:"event:create",...form.values});communityNotice("Sự kiện đã được đăng.","success");}}}})().catch((error)=>communityNotice(error.message,"error"));return;}
      const follow=event.target.closest("[data-community-follow]");if(follow){follow.disabled=true;communityMutate({action:"follow",targetId:follow.dataset.communityFollow}).then((data)=>{follow.classList.toggle("active",data.following);follow.textContent=data.following?"Đang theo dõi":"Theo dõi";communityNotice(data.following?"Đã theo dõi thành viên.":"Đã bỏ theo dõi.","success");}).catch((error)=>communityNotice(error.message,"error")).finally(()=>{follow.disabled=false;});return;}
      const contact=event.target.closest("[data-community-contact]");if(contact){location.hash="community";return;}
      if(event.target.closest("[data-community-notifications]")){(async()=>{const state=ensureCommunityState();const notifications=state.communityNotifications||[];const message=notifications.length?notifications.slice(0,10).map((item)=>`• ${item.message} (${communityTime(item.createdAt)})`).join("\n"):"Bạn chưa có thông báo cộng đồng mới.";const result=await communityDialog({title:"Thông báo cộng đồng",message,actions:[{id:"close",label:"Đóng"},{id:"read",label:"Đánh dấu đã đọc",primary:true}]});if(result.action==="read"){await communityMutate({action:"notifications:read"});communityNotice("Đã đánh dấu toàn bộ thông báo là đã đọc.","success");}})().catch((error)=>communityNotice(error.message,"error"));return;}
      const story=event.target.closest("[data-story-id]");if(story){(async()=>{const result=await communityDialog({title:"Tin của thành viên",message:story.dataset.storyContent||"Khoảnh khắc được chia sẻ trong HH Social.",actions:[{id:"close",label:"Đóng"},...(story.dataset.storyMedia?[{id:"media",label:"Xem media",primary:true}]:[])]});if(result.action==="media")window.open(story.dataset.storyMedia,"_blank","noopener,noreferrer");})();return;}
      const more=event.target.closest("[data-post-more]");if(more){(async()=>{const state=ensureCommunityState();const post=(state.remotePosts||state.posts||[]).find((item)=>String(item.id)===more.dataset.postMore);const actions=post?.owned?[{id:"edit",label:"Sửa bài viết",primary:true},{id:"delete",label:"Xóa bài",danger:true},{id:"cancel",label:"Đóng"}]:[{id:"report",label:"Báo cáo bài viết",danger:true},{id:"cancel",label:"Đóng"}];const choice=await communityDialog({title:"Quản lý bài viết",message:post?.owned?"Bạn có thể chỉnh sửa hoặc xóa bài viết này.":"Chọn tác vụ phù hợp cho bài viết.",actions});if(choice.action==="edit"){const edited=await communityDialog({title:"Sửa bài viết",fields:[{name:"content",label:"Nội dung",type:"textarea",value:post?.content||""}],actions:[{id:"cancel",label:"Hủy"},{id:"save",label:"Lưu thay đổi",primary:true}]});if(edited.action==="save"&&edited.values.content)await communityMutate({action:"edit",postId:more.dataset.postMore,content:edited.values.content});}else if(choice.action==="delete"){const confirm=await communityDialog({title:"Xóa bài viết?",message:"Bài viết và toàn bộ bình luận sẽ bị xóa vĩnh viễn.",actions:[{id:"cancel",label:"Giữ lại"},{id:"delete",label:"Xóa vĩnh viễn",danger:true}]});if(confirm.action==="delete"){await communityApi({method:"DELETE",query:`?id=${encodeURIComponent(more.dataset.postMore)}`});await loadCommunityFeed({silent:true});communityNotice("Đã xóa bài viết.","success");}}else if(choice.action==="report"){const report=await communityDialog({title:"Báo cáo nội dung",fields:[{name:"reason",label:"Lý do",type:"textarea",placeholder:"Cho chúng tôi biết nội dung nào không phù hợp..."}],actions:[{id:"cancel",label:"Hủy"},{id:"send",label:"Gửi báo cáo",danger:true}]});if(report.action==="send"){await communityMutate({action:"report",postId:more.dataset.postMore,reason:report.values.reason});communityNotice("Báo cáo đã được gửi đến quản trị viên.","success");}}})().catch((error)=>communityNotice(error.message,"error"));return;}
      if(event.target.closest("[data-story-create]")){(async()=>{const result=await communityDialog({title:"Tạo Tin mới",message:"Chọn ảnh/video từ điện thoại hoặc máy tính. Tin tự biến mất sau 24 giờ.",fields:[{name:"content",label:"Nội dung",type:"textarea",placeholder:"Chia sẻ một khoảnh khắc..."},{name:"mediaFile",label:"Ảnh hoặc video từ thiết bị",type:"file",accept:"image/*,video/*"},{name:"mediaUrl",label:"Hoặc liên kết HTTPS",type:"url",placeholder:"https://..."}],actions:[{id:"cancel",label:"Hủy"},{id:"create",label:"Đăng Tin",primary:true}]});if(result.action!=="create")return;const file=result.files?.mediaFile;if(!result.values.content&&!result.values.mediaUrl&&!file)return communityNotice("Hãy nhập nội dung hoặc thêm ảnh/video.","error");communityNotice(file?"Đang tải media của Tin...":"Đang đăng Tin...");const uploaded=file?await communityUploadMedia(file):null;await communityMutate({action:"story:create",content:result.values.content,mediaUrl:result.values.mediaUrl,mediaId:uploaded?.media?.id||""});communityNotice("Tin đã được đăng và sẽ hết hạn sau 24 giờ.","success");})().catch((error)=>communityNotice(error.message,"error"));return;}
    }
    const dashboard=event.target.closest("[data-user-dashboard]");if(dashboard){const tab=event.target.closest("[data-user-tab]");if(tab){dashboard.querySelectorAll("[data-user-tab]").forEach((item)=>item.classList.toggle("active",item===tab));dashboard.querySelectorAll("[data-user-pane]").forEach((item)=>item.classList.toggle("active",item.dataset.userPane===tab.dataset.userTab));return;}if(event.target.closest("[data-user-edit]")){dashboard.querySelector('[data-user-tab="profile"]')?.click();dashboard.querySelector("[data-user-nickname]")?.focus();return;}if(event.target.closest("[data-user-save]")){const state=readUserState();state.nickname=dashboard.querySelector("[data-user-nickname]")?.value.trim();state.bio=dashboard.querySelector("[data-user-bio]")?.value.trim();state.website=dashboard.querySelector("[data-user-website]")?.value.trim();state.xp=(state.xp||120)+10;writeUserState(state);rerenderModule("user-dashboard");return;}if(event.target.closest("[data-user-export]")){const data={profile:readUserState(),learning:readLearningState(),community:readCommunityState(),projects:readProjectState(),wiki:readWikiState(),media:readMediaState()};downloadText("hh-personal-data.json",JSON.stringify(data,null,2),"application/json;charset=utf-8");return;}}
    const admin=event.target.closest("[data-admin-panel]");if(admin){const tab=event.target.closest("[data-admin-tab]");if(tab){admin.querySelectorAll("[data-admin-tab]").forEach((item)=>item.classList.toggle("active",item===tab));admin.querySelectorAll("[data-admin-pane]").forEach((item)=>item.classList.toggle("active",item.dataset.adminPane===tab.dataset.adminTab));if(tab.dataset.adminTab==="users")loadAdminUsers().catch((error)=>{const status=admin.querySelector("[data-admin-status]");if(status)status.textContent=error.message;});return;}if(event.target.closest("[data-admin-refresh]")){loadAdminSummary();return;}if(event.target.closest("[data-admin-backup]")){const backup={version:47,createdAt:new Date().toISOString(),localStorage:Object.fromEntries(Object.keys(localStorage).map((key)=>[key,localStorage.getItem(key)]))};downloadText(`hh-backup-${new Date().toISOString().slice(0,10)}.json`,JSON.stringify(backup,null,2),"application/json;charset=utf-8");return;}}
    const project = event.target.closest("[data-project-center]");
    if (project) {
      const tab=event.target.closest("[data-project-tab]"); if(tab){project.querySelectorAll("[data-project-tab]").forEach((item)=>item.classList.toggle("active",item===tab));project.querySelectorAll("[data-project-pane]").forEach((item)=>item.classList.toggle("active",item.dataset.projectPane===tab.dataset.projectTab));return;}
      if(event.target.closest("[data-project-sort]")){const state=ensureProjectState();state.projects.sort((a,b)=>b.progress-a.progress);writeProjectState(state);rerenderModule("project-center","overview");return;}
      const open=event.target.closest("[data-project-open]"); if(open){const state=ensureProjectState();state.activeProject=open.dataset.projectOpen;writeProjectState(state);rerenderModule("project-center","overview");return;}
      const dialog=project.querySelector("[data-project-dialog]");
      if(event.target.closest("[data-project-new]")){dialog?.removeAttribute("data-edit-id");["[data-project-name]","[data-project-description]","[data-project-due]"].forEach((selector)=>{const field=dialog?.querySelector(selector);if(field)field.value="";});dialog?.showModal();return;}
      if(event.target.closest("[data-project-edit]")){const state=ensureProjectState();const item=state.projects.find((entry)=>entry.id===project.dataset.activeProject);if(item&&dialog){dialog.dataset.editId=item.id;dialog.querySelector("[data-project-name]").value=item.name;dialog.querySelector("[data-project-description]").value=item.description;dialog.querySelector("[data-project-status]").value=item.status;dialog.querySelector("[data-project-priority]").value=item.priority;dialog.querySelector("[data-project-due]").value=item.due;dialog.showModal();}return;}
      if(event.target.closest("[data-project-save]")){const name=dialog?.querySelector("[data-project-name]")?.value.trim();if(!name)return dialog?.querySelector("[data-project-name]")?.focus();const state=ensureProjectState();const id=dialog.dataset.editId||`project-${Date.now()}`;const old=state.projects.find((item)=>item.id===id);const next={id,name,description:dialog.querySelector("[data-project-description]").value.trim(),status:dialog.querySelector("[data-project-status]").value,priority:dialog.querySelector("[data-project-priority]").value,due:dialog.querySelector("[data-project-due]").value,progress:old?.progress||0,color:old?.color||["#ff3bd1","#55f3ec","#f5ff67","#8f7cff"][state.projects.length%4]};state.projects=old?state.projects.map((item)=>item.id===id?next:item):[next,...state.projects];state.activeProject=id;writeProjectState(state,`${old?"Cập nhật":"Tạo"} dự án ${name}`);dialog.close();rerenderModule("project-center","overview");return;}
      if(event.target.closest("[data-project-complete]")){const state=ensureProjectState();const item=state.projects.find((entry)=>entry.id===project.dataset.activeProject);if(item){item.progress=100;item.status="Hoàn tất";writeProjectState(state,`Hoàn tất ${item.name}`);rerenderModule("project-center","overview");}return;}
      if(event.target.closest("[data-project-add-update]")){const text=window.prompt("Nội dung cập nhật:")?.trim();if(text){const state=ensureProjectState();writeProjectState(state,text);rerenderModule("project-center","overview");}return;}
      if(event.target.closest("[data-project-add-task]")){const title=window.prompt("Tên nhiệm vụ mới:")?.trim();if(title){const state=ensureProjectState();state.tasks.push({id:`task-${Date.now()}`,title,column:"todo",priority:"Trung bình",project:project.dataset.activeProject});writeProjectState(state,`Thêm nhiệm vụ ${title}`);rerenderModule("project-center","board");}return;}
      const move=event.target.closest("[data-task-move]");if(move){const state=ensureProjectState();const task=state.tasks.find((item)=>item.id===move.dataset.taskMove);const order=["todo","doing","review","done"];if(task)task.column=order[(order.indexOf(task.column)+1)%order.length];writeProjectState(state,`Chuyển nhiệm vụ ${task?.title}`);rerenderModule("project-center","board");return;}
      const delTask=event.target.closest("[data-task-delete]");if(delTask){const state=ensureProjectState();state.tasks=state.tasks.filter((item)=>item.id!==delTask.dataset.taskDelete);writeProjectState(state,"Đã xóa nhiệm vụ");rerenderModule("project-center","board");return;}
      if(event.target.closest("[data-project-add-milestone]")){const title=window.prompt("Tên cột mốc:")?.trim();if(title){const state=ensureProjectState();state.milestones=state.milestones||[];state.milestones.push({title,date:new Date().toISOString().slice(0,7),progress:0});writeProjectState(state,`Thêm cột mốc ${title}`);rerenderModule("project-center","roadmap");}return;}
      if(event.target.closest("[data-project-add-bug]")){const title=window.prompt("Mô tả lỗi:")?.trim();if(title){const state=ensureProjectState();state.bugs=state.bugs||[];state.bugs.unshift({id:`bug-${Date.now()}`,title,severity:"Cao",status:"Đang mở",time:new Date().toLocaleDateString("vi-VN")});writeProjectState(state,`Báo lỗi ${title}`);rerenderModule("project-center","bugs");}return;}
      const resolveBug=event.target.closest("[data-bug-resolve]");if(resolveBug){const state=ensureProjectState();const bug=(state.bugs||[]).find((item)=>item.id===resolveBug.dataset.bugResolve);if(bug)bug.status=bug.status==="Đã xử lý"?"Đang mở":"Đã xử lý";writeProjectState(state,`Cập nhật lỗi ${bug?.title}`);rerenderModule("project-center","bugs");return;}
      if(event.target.closest("[data-project-add-release]")){const version=window.prompt("Phiên bản:","v23")?.trim();const title=version&&window.prompt("Tên bản phát hành:")?.trim();if(title){const state=ensureProjectState();state.releases=state.releases||[];state.releases.unshift({version,title,date:new Date().toISOString().slice(0,10)});writeProjectState(state,`Phát hành ${version}`);rerenderModule("project-center","release");}return;}
    }
    const wiki=event.target.closest("[data-knowledge-center]");
    if(wiki){
      const state=ensureWikiState();
      const open=event.target.closest("[data-wiki-open]");if(open){state.activeArticle=open.dataset.wikiOpen;writeWikiState(state);rerenderModule("knowledge-center");return;}
      const mode=event.target.closest("[data-wiki-mode]");if(mode){wiki.querySelectorAll("[data-wiki-mode]").forEach((item)=>item.classList.toggle("active",item===mode));const split=wiki.querySelector(".wiki-split");if(split)split.dataset.mode=mode.dataset.wikiMode;return;}
      const filter=event.target.closest("[data-wiki-filter]");if(filter){wiki.querySelectorAll("[data-wiki-filter]").forEach((item)=>item.classList.toggle("active",item===filter));wiki.querySelectorAll("[data-wiki-articles] [data-wiki-open]").forEach((button)=>{const article=state.articles.find((item)=>item.id===button.dataset.wikiOpen);button.hidden=filter.dataset.wikiFilter==="bookmark"&&!article?.bookmark;});return;}
      const category=event.target.closest("[data-wiki-category]");if(category){wiki.querySelectorAll("[data-wiki-articles] [data-wiki-open]").forEach((button)=>{const article=state.articles.find((item)=>item.id===button.dataset.wikiOpen);button.hidden=article?.category!==category.dataset.wikiCategory;});return;}
      if(event.target.closest("[data-wiki-new]")){const item={id:`article-${Date.now()}`,title:"Bài viết chưa đặt tên",category:"Ghi chú",tags:[],bookmark:false,updated:new Date().toISOString().slice(0,10),content:"# Bài viết mới\n\nBắt đầu ghi lại kiến thức tại đây."};state.articles.unshift(item);state.activeArticle=item.id;writeWikiState(state);rerenderModule("knowledge-center");return;}
      if(event.target.closest("[data-wiki-save]")){const item=state.articles.find((entry)=>entry.id===wiki.dataset.activeArticle);if(item){item.title=wiki.querySelector("[data-wiki-title]").value.trim()||"Không có tiêu đề";item.category=wiki.querySelector("[data-wiki-category-input]").value.trim()||"Ghi chú";item.tags=wiki.querySelector("[data-wiki-tags]").value.split(",").map((tag)=>tag.trim()).filter(Boolean);item.content=wiki.querySelector("[data-wiki-content]").value;item.updated=new Date().toISOString().slice(0,10);writeWikiState(state);rerenderModule("knowledge-center");}return;}
      if(event.target.closest("[data-wiki-bookmark]")){const item=state.articles.find((entry)=>entry.id===wiki.dataset.activeArticle);if(item){item.bookmark=!item.bookmark;writeWikiState(state);event.target.closest("[data-wiki-bookmark]").textContent=item.bookmark?"★":"☆";event.target.closest("[data-wiki-bookmark]").classList.toggle("active",item.bookmark);}return;}
      const format=event.target.closest("[data-wiki-format]");if(format){const textarea=wiki.querySelector("[data-wiki-content]");const value=format.dataset.wikiFormat;const start=textarea.selectionStart;const end=textarea.selectionEnd;const selected=textarea.value.slice(start,end);const insertion=value.includes("text")?value.replace("text",selected||"text"):value+(selected||"");textarea.setRangeText(insertion,start,end,"end");textarea.focus();updateWikiPreview(wiki);return;}
      if(event.target.closest("[data-wiki-export]")){const item=state.articles.find((entry)=>entry.id===wiki.dataset.activeArticle);downloadText(`${(item?.title||"wiki").replace(/[^a-z0-9]+/gi,"-").toLowerCase()}.md`,wiki.querySelector("[data-wiki-content]").value,"text/markdown;charset=utf-8");return;}
      if(event.target.closest("[data-wiki-copy-link]")){navigator.clipboard.writeText(`${location.href.split("#")[0]}#wiki-${wiki.dataset.activeArticle}`);return;}
    }
    const media = event.target.closest("[data-media-center]");
    if (media) {
      const filterButton = event.target.closest("[data-media-filter]");
      if (filterButton) {
        media.querySelectorAll("[data-media-filter]").forEach((item) => item.classList.toggle("active", item === filterButton));
        let visible = 0;
        media.querySelectorAll("[data-media-id]").forEach((card) => {
          const item = mediaItemById(card.dataset.mediaId);
          const match = filterButton.dataset.mediaFilter === "all" || (filterButton.dataset.mediaFilter === "favorites" ? item?.favorite : card.dataset.mediaCategory === filterButton.dataset.mediaFilter);
          card.hidden = !match; if (match) visible += 1;
        });
        const empty = media.querySelector("[data-media-empty]"); if (empty) empty.hidden = visible > 0;
        return;
      }
      const viewButton = event.target.closest("[data-media-view]");
      if (viewButton) {
        media.querySelectorAll("[data-media-view]").forEach((item) => item.classList.toggle("active", item === viewButton));
        media.querySelector("[data-media-grid]")?.classList.toggle("list-view", viewButton.dataset.mediaView === "list");
        return;
      }
      if (event.target.closest("[data-media-add-url]")) { media.querySelector("[data-media-dialog]")?.showModal(); return; }
      if (event.target.closest("[data-media-save-url]")) {
        const title = media.querySelector("[data-media-url-title]")?.value.trim() || "Media mới";
        const url = media.querySelector("[data-media-url-input]")?.value.trim() || "";
        const category = media.querySelector("[data-media-url-category]")?.value || "gallery";
        if (!/^https?:\/\//i.test(url)) return media.querySelector("[data-media-url-input]")?.focus();
        const image = /\.(png|jpe?g|webp|gif|avif)(\?|$)/i.test(url);
        const audio = /\.(mp3|wav|ogg|m4a|aac)(\?|$)/i.test(url);
        const video = /\.(mp4|webm|mov|m4v)(\?|$)/i.test(url) || Boolean(youtubeIdOf(url));
        const state = readMediaState();
        state.items.unshift({ id: `media-${Date.now()}`, title, url, category, type: image ? "image" : audio ? "audio" : video ? "video" : "link", source: new URL(url).hostname.replace(/^www\./, ""), favorite: false });
        writeMediaState(state, `Đã thêm ${title}`); refreshMediaCenter(); media.querySelector("[data-media-dialog]")?.close();
        return;
      }
      const openButton = event.target.closest("[data-media-open]");
      if (openButton) { openMediaItem(mediaItemById(openButton.dataset.mediaOpen)); return; }
      const favoriteButton = event.target.closest("[data-media-favorite]");
      if (favoriteButton) {
        const item = mediaItemById(favoriteButton.dataset.mediaFavorite);
        if (!item) return;
        if (item.local) { item.favorite = !item.favorite; if(item.persistent)mediaDbFavorite(item.id,item.favorite).catch(()=>{}); }
        else { const state = readMediaState(); const stored = state.items.find((entry) => entry.id === item.id); if (stored) stored.favorite = !stored.favorite; writeMediaState(state, `${stored?.favorite ? "Đã thích" : "Bỏ thích"} ${item.title}`); }
        refreshMediaCenter(); return;
      }
      const queueButton = event.target.closest("[data-media-queue]");
      if (queueButton) {
        const item = mediaItemById(queueButton.dataset.mediaQueue); const state = readMediaState(); const list = state.playlists[1] || state.playlists[0];
        if (item && list && !(list.items || []).includes(item.id)) { list.items = [...(list.items || []), item.id]; writeMediaState(state, `Đã thêm ${item.title} vào ${list.name}`); refreshMediaCenter(); }
        return;
      }
      const playlistButton = event.target.closest("[data-media-playlist]");
      if (playlistButton) {
        const state = readMediaState(); const list = state.playlists[Number(playlistButton.dataset.mediaPlaylist)]; const ids = new Set(list?.items || []); let visible = 0;
        media.querySelectorAll("[data-media-id]").forEach((card) => { const match = ids.has(card.dataset.mediaId); card.hidden = !match; if (match) visible += 1; });
        const empty = media.querySelector("[data-media-empty]"); if (empty) empty.hidden = visible > 0; return;
      }
      if (event.target.closest("[data-media-new-playlist]")) {
        const name = window.prompt("Tên playlist mới:", "Bộ sưu tập mới")?.trim();
        if (name) { const state = readMediaState(); state.playlists.push({ name, items: [] }); writeMediaState(state, `Đã tạo playlist ${name}`); refreshMediaCenter(); } return;
      }
      const moreButton = event.target.closest("[data-media-more]");
      if (moreButton) {
        const item = mediaItemById(moreButton.dataset.mediaMore); if (!item) return;
        if (item.local) { const removeLocal=async()=>{if(item.persistent)await mediaDbDelete(item.id);URL.revokeObjectURL(item.url);mediaSessionItems.delete(item.id);const state=readMediaState();state.playlists.forEach((list)=>list.items=(list.items||[]).filter((id)=>id!==item.id));writeMediaState(state,`Đã xóa ${item.title}`);refreshMediaCenter();};removeLocal().catch((error)=>{const activity=media.querySelector("[data-media-activity]");if(activity)activity.innerHTML=`<p>${escapeHtml(error.message)}</p>`;}); }
        else if (window.confirm(`Xóa “${item.title}” khỏi thư viện?`)) { const state = readMediaState(); state.items = state.items.filter((entry) => entry.id !== item.id); state.playlists.forEach((list) => list.items = (list.items || []).filter((id) => id !== item.id)); writeMediaState(state, `Đã xóa ${item.title}`); refreshMediaCenter(); }
        return;
      }
      if (event.target.closest("[data-media-close-preview]")) { const stage = media.querySelector("[data-media-preview]"); if (stage) stage.innerHTML = '<div class="media-preview-placeholder"><span>▶</span><strong>Chọn một media</strong><p>Ảnh, video hoặc âm thanh sẽ hiển thị tại đây.</p></div>'; return; }
      if (event.target.closest("[data-media-clear-activity]")) { const state = readMediaState(); state.activity = []; writeMediaState(state); refreshMediaCenter(); return; }
    }
    const ai = event.target.closest("[data-ai-center]");
    if (ai) {
      const tabButton = event.target.closest("[data-ai-tab]");
      if (tabButton) {
        ai.querySelectorAll("[data-ai-tab]").forEach((item) => item.classList.toggle("active", item === tabButton));
        ai.querySelectorAll("[data-ai-pane]").forEach((item) => item.classList.toggle("active", item.dataset.aiPane === tabButton.dataset.aiTab));
        return;
      }
      const quick = event.target.closest("[data-ai-quick]");
      if (quick) {
        const input = ai.querySelector("[data-ai-chat-input]");
        if (input) input.value = `${quick.dataset.aiQuick}: `;
        ai.querySelector('[data-ai-tab="chat"]')?.click();
        input?.focus();
        return;
      }
      if (event.target.closest("[data-ai-new]")) {
        const stream = ai.querySelector("[data-ai-stream]");
        if (stream) stream.innerHTML = '<article class="ai-message assistant"><span>HH</span><div><strong>HH AI Assistant</strong><p>Phiên mới đã sẵn sàng. Bạn muốn làm gì?</p></div></article>';
        aiResult("Phiên mới", "Nhập yêu cầu để bắt đầu.");
        return;
      }
      if (event.target.closest("[data-ai-clear-chat]")) {
        const stream = ai.querySelector("[data-ai-stream]");
        if (stream) stream.innerHTML = "";
        return;
      }
      const sessionButton = event.target.closest("[data-ai-session]");
      if (sessionButton) {
        let sessions = [];
        try { sessions = JSON.parse(localStorage.getItem("hh-ai-center") || "{}").sessions || []; } catch { sessions = []; }
        const session = sessions[Number(sessionButton.dataset.aiSession)];
        if (session) { aiResult(session.title, session.result); const input = ai.querySelector("[data-ai-chat-input]"); if (input) input.value = session.input || ""; }
        return;
      }
      if (event.target.closest("[data-ai-example]")) {
        const values = { "[data-ai-role]": "Chuyên gia chiến lược YouTube", "[data-ai-goal]": "Viết kịch bản giữ chân người xem", "[data-ai-audience]": "Nam nữ 40-65 tuổi", "[data-ai-context]": "Câu chuyện gia đình cảm động, thời lượng 12 phút", "[data-ai-output]": "Hook, 5 phần nội dung, cao trào, CTA; tiếng Việt tự nhiên" };
        Object.entries(values).forEach(([selector, value]) => { const field = ai.querySelector(selector); if (field) field.value = value; });
        return;
      }
      if (event.target.closest("[data-ai-build-prompt]")) {
        const value = (selector, fallback) => ai.querySelector(selector)?.value.trim() || fallback;
        const prompt = [`VAI TRÒ\nBạn là ${value("[data-ai-role]", "một chuyên gia phù hợp")}.`, `\nMỤC TIÊU\n${value("[data-ai-goal]", "Hoàn thành yêu cầu chính xác")}.`, `\nĐỐI TƯỢNG\n${value("[data-ai-audience]", "Người dùng phổ thông")}.`, `\nNGỮ CẢNH\n${value("[data-ai-context]", "Chưa cung cấp; hãy nêu giả định trước khi trả lời")}.`, `\nGIỌNG ĐIỆU\n${value("[data-ai-tone]", "Chuyên nghiệp")}.`, `\nĐẦU RA BẮT BUỘC\n${value("[data-ai-output]", "Trình bày từng bước, rõ ràng và có ví dụ")}.`, "\nQUY TẮC\n- Không bịa dữ kiện.\n- Nêu giả định và điểm chưa chắc chắn.\n- Tự kiểm tra kết quả trước khi trả lời.\n- Kết thúc bằng checklist hành động."].join("\n");
        aiResult("Prompt hoàn chỉnh", prompt);
        return;
      }
      if (event.target.closest("[data-ai-optimize]")) {
        const input = ai.querySelector("[data-ai-optimize-input]")?.value.trim() || "";
        if (!input) return ai.querySelector("[data-ai-optimize-input]")?.focus();
        const options = Array.from(ai.querySelectorAll("[data-ai-opt]:checked")).map((item) => item.dataset.aiOpt);
        const optimized = [`VAI TRÒ: Hãy đóng vai chuyên gia có kinh nghiệm thực tế phù hợp với nhiệm vụ.`, `\nNHIỆM VỤ: ${input}`, options.includes("structure") ? "\nCẤU TRÚC: Phân tích mục tiêu, thực hiện theo từng bước, sau đó tự kiểm tra kết quả." : "", options.includes("constraints") ? "\nRÀNG BUỘC: Không bịa thông tin; nêu rõ giả định; ưu tiên giải pháp có thể thực hiện ngay." : "", options.includes("examples") ? "\nVÍ DỤ: Cung cấp ít nhất 2 ví dụ cụ thể và một trường hợp cần tránh." : "", options.includes("reasoning") ? "\nQUY TRÌNH: Giải thích ngắn gọn cơ sở của từng quyết định quan trọng." : "", "\nĐẦU RA: Dùng tiêu đề ngắn, danh sách hành động và checklist hoàn thành."].filter(Boolean).join("\n");
        const score = Math.min(98, 58 + options.length * 9 + Math.min(8, Math.round(input.length / 80)));
        const scoreNode = ai.querySelector("[data-ai-score]"); if (scoreNode) scoreNode.textContent = score;
        aiResult(`Prompt tối ưu · ${score}/100`, optimized);
        return;
      }
      if (event.target.closest("[data-ai-swap]")) {
        const source = ai.querySelector("[data-ai-source-lang]"); const target = ai.querySelector("[data-ai-target-lang]");
        if (source && target) [source.value, target.value] = [target.value, source.value];
        const input = ai.querySelector("[data-ai-translate-input]"); const output = ai.querySelector("[data-ai-translate-output]");
        if (input && output) [input.value, output.value] = [output.value, input.value];
        return;
      }
      if (event.target.closest("[data-ai-translate]")) {
        const input = ai.querySelector("[data-ai-translate-input]")?.value.trim() || "";
        const target = ai.querySelector("[data-ai-target-lang]")?.value;
        if (!input) return ai.querySelector("[data-ai-translate-input]")?.focus();
        const translated = target === "en" ? `Act as an expert assistant. Preserve the original intent and execute this request accurately:\n\n${input}\n\nReturn a clear, structured answer with practical examples and an action checklist.` : `Hãy đóng vai trợ lý chuyên gia. Giữ nguyên ý nghĩa ban đầu và thực hiện chính xác yêu cầu sau:\n\n${input}\n\nTrả lời rõ ràng, có cấu trúc, ví dụ thực tế và checklist hành động.`;
        const output = ai.querySelector("[data-ai-translate-output]"); if (output) output.value = translated;
        aiResult("Prompt đã chuyển ngữ", translated);
        return;
      }
      if (event.target.closest("[data-ai-add-step]")) {
        const steps = ai.querySelector("[data-ai-workflow-steps]");
        const number = (steps?.children.length || 0) + 1;
        steps?.insertAdjacentHTML("beforeend", `<label><span>${number}</span><input value="Bước xử lý ${number}" data-ai-step><button class="interactive" type="button" data-ai-remove-step aria-label="Xóa bước">×</button></label>`);
        return;
      }
      const removeStep = event.target.closest("[data-ai-remove-step]");
      if (removeStep) { removeStep.closest("label")?.remove(); return; }
      if (event.target.closest("[data-ai-run-workflow]")) {
        const source = ai.querySelector("[data-ai-workflow-input]")?.value.trim() || "Chưa có dữ liệu đầu vào";
        const steps = Array.from(ai.querySelectorAll("[data-ai-step]")).map((item) => item.value.trim()).filter(Boolean);
        const result = [`WORKFLOW HOÀN TẤT`, `\nĐầu vào: ${source}`, ...steps.map((step, index) => `\nBƯỚC ${index + 1}: ${step}\n${aiLocalAnswer(`${step}. Dữ liệu: ${source}`, index === 0 ? "analyst" : "smart-local").split("\n").slice(0, 4).join("\n")}`), "\nKết luận: Các bước đã được xử lý. Hãy kiểm tra và tinh chỉnh kết quả trước khi xuất bản."].join("\n");
        aiResult("Workflow hoàn thành", result);
        return;
      }
      if (event.target.closest("[data-ai-copy-result]")) { navigator.clipboard.writeText(ai.querySelector("[data-ai-result]")?.textContent || ""); return; }
      if (event.target.closest("[data-ai-save-result]")) { const text = ai.querySelector("[data-ai-result]")?.textContent || ""; aiSaveSession(ai.querySelector("[data-ai-result-title]")?.textContent, "", text); return; }
      if (event.target.closest("[data-ai-export-result]")) { downloadText("hh-ai-center-result.txt", ai.querySelector("[data-ai-result]")?.textContent || ""); return; }
    }
    const panel = event.target.closest("[data-social-downloader]");
    if (panel) {
      const form = panel.querySelector("[data-download-form]");
      const urlInput = panel.querySelector("[data-download-url]");
      if (event.target.closest("[data-download-paste]")) {
        navigator.clipboard.readText().then((text) => { if (urlInput) { urlInput.value = text.trim(); analyzeDownloadUrl(urlInput.value); } }).catch(() => urlInput?.focus());
        return;
      }
      if (event.target.closest("[data-download-analyze]")) { analyzeDownloadUrl(urlInput?.value.trim() || ""); return; }
      if (event.target.closest("[data-download-retry]")) { if (form) requestDownload(form); return; }
      const historyButton = event.target.closest("[data-download-history-url]");
      if (historyButton) { if (urlInput) urlInput.value = historyButton.dataset.downloadHistoryUrl; analyzeDownloadUrl(historyButton.dataset.downloadHistoryUrl); return; }
      if (event.target.closest("[data-download-clear]")) { updateDownloadHistory([]); return; }
      const copyButton = event.target.closest("[data-download-copy]");
      if (copyButton) { navigator.clipboard.writeText(copyButton.dataset.downloadCopy || ""); copyButton.textContent = "Đã sao chép"; return; }
    }
    const studioButton = event.target.closest("[data-studio-action]");
    if (!studioButton) return;
    const moduleId = studioButton.dataset.studioModule;
    const module = modules.find((item) => item.id === moduleId);
    if (!module) return;
    const profile = profileFor(module);
    const key = `${stateKey}:${module.id}:studio`;
    const input = grid.querySelector(`[data-studio-input="${CSS.escape(module.id)}"]`);
    const preview = grid.querySelector(`[data-studio-preview="${CSS.escape(module.id)}"]`);
    const current = JSON.parse(localStorage.getItem(key) || "null") || {};
    const action = studioButton.dataset.studioAction;
    const inputText = (input?.value || profile.sample).trim();
    const generated = {
      text: `${profile.verb}: ${inputText}`,
      at: new Date().toISOString(),
      module: module.title
    };

    if (action === "generate") {
      const items = [generated, ...(current.items || profile.items || []).map((item) => typeof item === "string" ? { text: item } : item)].slice(0, 12);
      const next = { ...current, input: inputText, items, created: Number(current.created || 0) + 1, metricBase: Math.min(99, Number(current.metricBase || 7) + 1) };
      localStorage.setItem(key, JSON.stringify(next));
      if (preview) preview.innerHTML = items.slice(0, 5).map((item, index) => `<p><b>${String(index + 1).padStart(2, "0")}</b>${escapeHtml(item.text || item)}</p>`).join("");
      const inlineOutput = grid.querySelector(`[data-inline-output="${CSS.escape(module.id)}"]`);
      if (inlineOutput) inlineOutput.textContent = moduleDemoText(module, inputText);
      return;
    }

    if (action === "save") {
      localStorage.setItem(key, JSON.stringify({ ...current, input: inputText, savedAt: new Date().toISOString() }));
      if (preview) preview.insertAdjacentHTML("afterbegin", `<p><b>OK</b>Đã lưu lúc ${new Date().toLocaleTimeString("vi-VN")}</p>`);
      return;
    }

    if (action === "export") {
      downloadText(`${module.id}-studio.json`, JSON.stringify({ module, studio: current, input: inputText }, null, 2), "application/json;charset=utf-8");
      return;
    }

    if (action === "google") {
      window.open(`https://www.google.com/search?q=${encodeURIComponent(`${module.title} ${inputText}`)}`, "_blank", "noopener");
      return;
    }

    if (action === "clear") {
      localStorage.removeItem(key);
      if (preview) preview.innerHTML = (profile.items || []).map((item, index) => `<p><b>${String(index + 1).padStart(2, "0")}</b>${escapeHtml(item)}</p>`).join("");
    }
  });

  detailMeta?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-module-fav]");
    if (!button) return;
    toggleFavorite(button.dataset.moduleFav);
    renderDetail(selectedModule);
    render();
  });

  toolGrid?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-module-tool]");
    if (!button || !selectedModule) return;
    if (actionMode) actionMode.value = button.dataset.moduleTool;
    openModuleWorkspace(selectedModule, button.dataset.moduleTool);
  });

  const platformRequest = async (path, options = {}) => {
    if (!REALTIME_URL) throw new Error("Realtime backend is not configured.");
    const token = localStorage.getItem("hh-auth-token") || "";
    const response = await fetch(`${REALTIME_URL}${path}`, {
      method: options.method || "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      ...(options.body ? { body: JSON.stringify(options.body) } : {})
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "Backend request failed.");
    return data;
  };

  const platformApi = (path, payload) => platformRequest(path, { method: "POST", body: payload });

  runDemo?.addEventListener("click", async () => {
    if (!selectedModule || !demoOutput) return;
    const localOutput = moduleDemoText(selectedModule, demoInput?.value || "");
    if (!REALTIME_URL) {
      demoOutput.textContent = `${localOutput}\n\n[Backend chưa cấu hình: đang chạy local trong HTML.]`;
      return;
    }
    demoOutput.textContent = "Đang gửi module action lên backend...";
    try {
      const data = await platformApi(`/api/modules/${encodeURIComponent(selectedModule.id)}/actions`, {
        actionType: actionMode?.value || "run",
        input: demoInput?.value || "",
        meta: { title: selectedModule.title, requiresBackend: selectedModule.requiresBackend }
      });
      demoOutput.textContent = `${localOutput}\n\n[Backend MongoDB]\nAction ID: ${data.action?._id || "created"}\n${data.action?.output || ""}`;
    } catch (error) {
      demoOutput.textContent = `${localOutput}\n\n[Backend lỗi hoặc chưa deploy]\n${error.message}`;
    }
  });

  saveState?.addEventListener("click", async () => {
    if (!selectedModule) return;
    const allState = JSON.parse(localStorage.getItem(stateKey) || "{}");
    allState[selectedModule.id] = {
      title: itemTitle?.value || selectedModule.title,
      actionType: actionMode?.value || "save",
      input: demoInput?.value || "",
      output: demoOutput?.textContent || "",
      history: [
        { title: itemTitle?.value || selectedModule.title, input: demoInput?.value || "", output: demoOutput?.textContent || "", savedAt: new Date().toISOString() },
        ...(allState[selectedModule.id]?.history || [])
      ].slice(0, 20),
      savedAt: new Date().toISOString()
    };
    localStorage.setItem(stateKey, JSON.stringify(allState));
    renderItems(allState[selectedModule.id].history);
    if (REALTIME_URL) {
      try {
        const data = await platformApi(`/api/modules/${encodeURIComponent(selectedModule.id)}/items`, {
          title: itemTitle?.value || selectedModule.title,
          type: actionMode?.value || "module-state",
          data: allState[selectedModule.id]
        });
        if (demoOutput) demoOutput.textContent = `${demoOutput.textContent}\n\n[Đã lưu local + MongoDB: ${data.item?._id || "created"}]`;
        return;
      } catch (error) {
        if (demoOutput) demoOutput.textContent = `${demoOutput.textContent}\n\n[Đã lưu local, backend lỗi: ${error.message}]`;
        return;
      }
    }
    if (demoOutput) demoOutput.textContent = `${demoOutput.textContent}\n\n[Đã lưu local cho ${selectedModule.title}]`;
  });

  copyOutput?.addEventListener("click", async () => {
    const text = demoOutput?.textContent || "";
    if (text) await navigator.clipboard.writeText(text);
  });

  loadHistory?.addEventListener("click", async () => {
    if (!selectedModule) return;
    const localState = JSON.parse(localStorage.getItem(stateKey) || "{}")[selectedModule.id];
    renderItems(localState?.history || []);
    if (!REALTIME_URL) return;
    try {
      const data = await platformRequest(`/api/modules/${encodeURIComponent(selectedModule.id)}/items`, { method: "GET" });
      renderItems(data.items || []);
      if (demoOutput) demoOutput.textContent = `${demoOutput.textContent}\n\n[Đã tải lịch sử MongoDB: ${(data.items || []).length} mục]`;
    } catch (error) {
      if (demoOutput) demoOutput.textContent = `${demoOutput.textContent}\n\n[Tải lịch sử backend lỗi: ${error.message}]`;
    }
  });

  exportData?.addEventListener("click", () => {
    if (!selectedModule) return;
    const state = JSON.parse(localStorage.getItem(stateKey) || "{}")[selectedModule.id] || {};
    downloadText(`${selectedModule.id}-data.json`, JSON.stringify({ module: selectedModule, state }, null, 2), "application/json;charset=utf-8");
  });

  window.addEventListener("hh:modules-ready", (event) => {
    modules = Array.isArray(event.detail) ? event.detail : [];
    updateCounters();
    const active = document.querySelector("[data-module-filter].active");
    activeFilter = active?.dataset.moduleFilter || "all";
    selectedModule = modules[0] || null;
    renderDetail(selectedModule);
    render();
  });

  updateCounters();
  render();
}
function initCreatorWorkspace() {
  if (!document.body.classList.contains("home-neon")) return;
  const consoleRoot = byId("platformConsole");
  if (!consoleRoot) return;

  const tabs = consoleRoot.querySelectorAll("[data-platform-tab]");
  const panels = consoleRoot.querySelectorAll("[data-platform-panel]");

  const activate = (name) => {
    tabs.forEach((tab) => tab.classList.toggle("active", tab.dataset.platformTab === name));
    panels.forEach((panel) => panel.classList.toggle("active", panel.dataset.platformPanel === name));
  };

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => activate(tab.dataset.platformTab));
  });

  const val = (id) => byId(id)?.value.trim() || "";
  const write = (id, text) => {
    const node = byId(id);
    if (node) node.textContent = text;
  };
  const copyFrom = async (id) => {
    const text = byId(id)?.textContent || "";
    if (!text) return;
    await navigator.clipboard.writeText(text);
  };

  const roleLabels = {
    mentor: "Mentor sáng tạo",
    writer: "Biên kịch YouTube",
    designer: "UI/UX Designer",
    marketer: "Marketing Advisor"
  };

  byId("generateChatReply")?.addEventListener("click", () => {
    const role = val("chatRole") || "mentor";
    const goal = val("chatGoal") || "phát triển ý tưởng mới";
    const input = val("chatInput") || "Chưa có nội dung đầu vào.";
    const output = `${roleLabels[role] || role}\n\nMục tiêu: ${goal}\n\nGợi ý nhanh:\n1. Chốt một kết quả cụ thể cần đạt trước khi viết dài.\n2. Tách ý tưởng thành 3 phần: hook, nội dung chính, lời kêu gọi hành động.\n3. Giữ một tone xuyên suốt để người xem nhận ra phong cách của bạn.\n4. Nếu dùng AI thật, hãy gửi prompt dưới dạng vai trò + bối cảnh + yêu cầu + định dạng output.\n\nPrompt tiếp theo có thể dùng:\n\"Bạn là ${roleLabels[role] || role}. Hãy giúp tôi ${goal}. Dữ liệu đầu vào: ${input}. Trả lời bằng checklist rõ ràng, có ví dụ cụ thể.\"`;
    write("chatOutput", output);
  });

  byId("saveChatNote")?.addEventListener("click", () => {
    const notes = JSON.parse(localStorage.getItem("hh-chat-notes") || "[]");
    notes.unshift({ at: new Date().toISOString(), role: val("chatRole"), goal: val("chatGoal"), input: val("chatInput"), output: byId("chatOutput")?.textContent || "" });
    localStorage.setItem("hh-chat-notes", JSON.stringify(notes.slice(0, 30)));
    write("chatOutput", `${byId("chatOutput")?.textContent || ""}\n\n[Đã lưu note local: ${notes.length > 30 ? 30 : notes.length}/30]`);
  });
  byId("copyChatReply")?.addEventListener("click", () => copyFrom("chatOutput"));

  const promptTemplates = {
    rewrite: ({ tone, brief }) => `Bạn là biên kịch YouTube chuyên kể chuyện cảm xúc.\n\nNhiệm vụ: Viết lại nội dung dưới đây thành một kịch bản mới, giữ ý chính nhưng thay đổi cách kể, nhịp dựng và câu chữ.\n\nTone: ${tone}\n\nYêu cầu:\n- Mở đầu có hook mạnh trong 10 giây đầu.\n- Câu văn tự nhiên, dễ đọc voice-over.\n- Có cao trào, chuyển cảnh rõ, kết thúc có bài học và CTA.\n- Không sao chép nguyên văn.\n\nNội dung gốc:\n${brief}`,
    title: ({ tone, brief }) => `Hãy tạo 20 title YouTube tiếng Việt cho nội dung sau.\n\nTone: ${tone}\n\nQuy tắc:\n- Dưới 100 ký tự.\n- Có tò mò nhưng không lừa người xem.\n- Phù hợp khán giả 40+.\n- Chia thành 4 nhóm: cảm xúc, bí mật, gia đình, bài học.\n\nNội dung:\n${brief}`,
    image: ({ tone, brief }) => `Tạo prompt ảnh AI cinematic cho thumbnail/video.\n\nPhong cách: ${tone}\n\nTrả về:\n1. Prompt chính bằng tiếng Anh.\n2. Negative prompt.\n3. Gợi ý màu sắc, ánh sáng, bố cục.\n4. Text ngắn đặt trên thumbnail.\n\nBrief:\n${brief}`,
    summary: ({ tone, brief }) => `Tóm tắt nội dung sau theo tone ${tone}.\n\nTrả về:\n- 5 ý chính.\n- 3 điểm cảm xúc mạnh.\n- 1 câu hook.\n- 1 CTA phù hợp.\n\nNội dung:\n${brief}`
  };

  byId("buildPromptButton")?.addEventListener("click", () => {
    const template = promptTemplates[val("promptTemplate")] || promptTemplates.rewrite;
    write("promptOutput", template({ tone: val("promptTone") || "tự nhiên", brief: val("promptBrief") || "Chưa có brief." }));
  });
  byId("copyPromptButton")?.addEventListener("click", () => copyFrom("promptOutput"));
  byId("downloadPromptButton")?.addEventListener("click", () => downloadText("hh-prompt-studio.txt", byId("promptOutput")?.textContent || ""));

  byId("generateScriptButton")?.addEventListener("click", () => {
    const topic = val("scriptTopic") || "Một câu chuyện gia đình cảm động";
    const length = val("scriptLength");
    const audience = val("scriptAudience") || "người xem đại chúng";
    const notes = val("scriptNotes") || "Chưa có ghi chú thêm.";
    const beats = length === "short"
      ? ["0-3s: Câu hook gây tò mò", "3-15s: Vấn đề chính", "15-40s: Twist/cao trào", "40-55s: Bài học", "55-60s: CTA"]
      : length === "long"
        ? ["Tập 1: Hook và biến cố", "Tập 2: Bí mật cũ", "Tập 3: Hiểu lầm bùng nổ", "Tập 4: Bằng chứng xuất hiện", "Tập 5: Hóa giải và bài học"]
        : ["Mở đầu: Hook cảm xúc", "Phần 1: Bối cảnh và nhân vật", "Phần 2: Mâu thuẫn chính", "Phần 3: Cao trào", "Phần 4: Sự thật", "Kết: Bài học + CTA"];
    const output = `KHUNG KỊCH BẢN\n\nChủ đề: ${topic}\nKhán giả: ${audience}\nGhi chú: ${notes}\n\nCấu trúc:\n${beats.map((beat, index) => `${index + 1}. ${beat}`).join("\n")}\n\nHook mẫu:\n\"Ông ấy im lặng suốt 20 năm, cho đến ngày một lá thư cũ khiến cả gia đình phải nhìn lại mọi chuyện.\"\n\nCTA mẫu:\n\"Nếu bạn từng hiểu lầm một người thân yêu, hãy để lại một bình luận để câu chuyện này đến được với nhiều người hơn.\"`;
    write("scriptOutput", output);
  });
  byId("copyScriptButton")?.addEventListener("click", () => copyFrom("scriptOutput"));
  byId("downloadScriptButton")?.addEventListener("click", () => downloadText("hh-script-generator.txt", byId("scriptOutput")?.textContent || ""));
}

function initCommunityChat() {
  if (!document.body.classList.contains("home-neon")) return;
  const root = byId("chat");
  if (!root) return;

  const profileKey = "hh-chat-profile";
  const roomButtons = root.querySelectorAll("[data-chat-room]");
  const nicknameInput = byId("chatNickname");
  const avatarUrlInput = byId("chatAvatarUrl");
  const avatarPreview = byId("chatAvatarPreview");
  const saveProfile = byId("saveChatProfile");
  const userList = byId("chatUserList");
  const roomLabel = byId("chatRoomLabel");
  const status = byId("chatStatus");
  const messagesBox = byId("chatMessages");
  const messageInput = byId("chatMessageInput");
  const sendButton = byId("sendChatMessage");
  const refreshButton = byId("refreshChatButton");
  const voiceButton = byId("chatVoiceButton");
  const anonymousIdKey = "hh-anonymous-id";
  let room = "general";
  let pollingTimer;
  let lastMessageSignature = "";
  let profile = JSON.parse(localStorage.getItem(profileKey) || "{}");

  const fallbackName = () => {
    const tokenName = localStorage.getItem("hh-chat-last-name");
    return tokenName || "Khách HH";
  };

  const anonymousId = () => {
    let id = localStorage.getItem(anonymousIdKey);
    if (!id) {
      id = randomId();
      localStorage.setItem(anonymousIdKey, id);
    }
    return id;
  };

  const initials = (name) => (name || "HH").split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase();

  const applyProfile = () => {
    profile = {
      nickname: (profile.nickname || fallbackName()).slice(0, 32),
      avatarUrl: profile.avatarUrl || "",
      color: profile.color || `hsl(${Math.floor(Math.random() * 360)} 90% 72%)`
    };
    if (nicknameInput) nicknameInput.value = profile.nickname;
    if (avatarUrlInput) avatarUrlInput.value = profile.avatarUrl;
    if (avatarPreview) {
      avatarPreview.textContent = profile.avatarUrl ? "" : initials(profile.nickname);
      avatarPreview.style.backgroundImage = profile.avatarUrl ? `url("${profile.avatarUrl}")` : "";
      avatarPreview.style.backgroundColor = profile.color;
    }
    localStorage.setItem(profileKey, JSON.stringify(profile));
  };

  const chatRequest = async (path, options = {}) => {
    if (!REALTIME_URL) throw new Error("Backend chat chưa cấu hình.");
    const token = localStorage.getItem("hh-auth-token") || "";
    const response = await fetch(`${REALTIME_URL}${path}`, {
      method: options.method || "GET",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      ...(options.body ? { body: JSON.stringify(options.body) } : {})
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "Chat request failed.");
    return data;
  };

  const renderUsers = (messages) => {
    if (!userList) return;
    const users = new Map();
    messages.forEach((item) => {
      const data = item.data || {};
      if (!data.nickname) return;
      users.set(data.nickname, { nickname: data.nickname, avatarUrl: data.avatarUrl, color: data.color, at: item.createdAt });
    });
    const rows = [...users.values()].slice(-10).reverse();
    userList.innerHTML = rows.length ? rows.map((user) => `
      <div class="chat-user">
        <span style="${user.avatarUrl ? `background-image:url('${user.avatarUrl}')` : `background:${user.color || "#ff4fd8"}`}">${user.avatarUrl ? "" : initials(user.nickname)}</span>
        <strong>${user.nickname}</strong>
      </div>
    `).join("") : "<p>Chưa có ai trong phòng.</p>";
  };

  const renderMessages = (items) => {
    if (!messagesBox) return;
    const messages = items
      .filter((item) => item.type === "chat-message" && item.data?.room === room)
      .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
      .slice(-80);
    const signature = messages.map((item) => item._id || item.createdAt).join("|");
    renderUsers(items.filter((item) => item.type === "chat-message"));
    if (signature === lastMessageSignature) return;
    lastMessageSignature = signature;
    messagesBox.innerHTML = messages.length ? messages.map((item) => {
      const data = item.data || {};
      const mine = data.senderId === anonymousId();
      return `
        <article class="chat-message ${mine ? "mine" : ""}">
          <div class="chat-avatar small" style="${data.avatarUrl ? `background-image:url('${data.avatarUrl}')` : `background:${data.color || "#ff4fd8"}`}">${data.avatarUrl ? "" : initials(data.nickname)}</div>
          <div>
            <header><strong>${data.nickname || "Khách"}</strong><span>${new Date(item.createdAt).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}</span></header>
            <p>${String(data.message || "").replace(/[<>&]/g, (char) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[char]))}</p>
          </div>
        </article>`;
    }).join("") : "<p class=\"chat-empty\">Chưa có tin nhắn. Hãy là người mở lời.</p>";
    messagesBox.scrollTop = messagesBox.scrollHeight;
  };

  const loadMessages = async () => {
    if (!status) return;
    if (!REALTIME_URL) {
      status.textContent = "Backend chưa cấu hình";
      return;
    }
    try {
      const data = await chatRequest("/api/modules/chat-app/items");
      renderMessages(data.items || []);
      status.textContent = "Đang online";
    } catch (error) {
      status.textContent = `Lỗi chat: ${error.message}`;
    }
  };

  const sendMessage = async () => {
    const message = (messageInput?.value || "").trim();
    if (!message) return;
    applyProfile();
    if (status) status.textContent = "Đang gửi...";
    try {
      await chatRequest("/api/modules/chat-app/items", {
        method: "POST",
        body: {
          title: `${profile.nickname} - ${room}`,
          type: "chat-message",
          anonymousId: anonymousId(),
          data: { room, message, senderId: anonymousId(), nickname: profile.nickname, avatarUrl: profile.avatarUrl, color: profile.color }
        }
      });
      if (messageInput) messageInput.value = "";
      await loadMessages();
    } catch (error) {
      if (status) status.textContent = `Gửi lỗi: ${error.message}`;
    }
  };

  applyProfile();

  saveProfile?.addEventListener("click", () => {
    profile.nickname = nicknameInput?.value.trim() || "Khách HH";
    profile.avatarUrl = avatarUrlInput?.value.trim() || "";
    applyProfile();
    if (status) status.textContent = "Đã lưu hồ sơ chat";
  });

  roomButtons.forEach((button) => {
    button.addEventListener("click", () => {
      roomButtons.forEach((item) => item.classList.remove("active"));
      button.classList.add("active");
      room = button.dataset.chatRoom || "general";
      if (roomLabel) roomLabel.textContent = `# ${room === "general" ? "chung" : room}`;
      lastMessageSignature = "";
      loadMessages();
    });
  });

  sendButton?.addEventListener("click", sendMessage);
  refreshButton?.addEventListener("click", loadMessages);
  messageInput?.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  });

  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition && voiceButton) {
    voiceButton.disabled = true;
    voiceButton.textContent = "Trình duyệt chưa hỗ trợ nói";
  }
  voiceButton?.addEventListener("click", () => {
    if (!SpeechRecognition || !messageInput) return;
    const recognition = new SpeechRecognition();
    recognition.lang = "vi-VN";
    recognition.interimResults = false;
    recognition.onstart = () => { if (status) status.textContent = "Đang nghe giọng nói..."; };
    recognition.onresult = (event) => {
      messageInput.value = `${messageInput.value} ${event.results[0][0].transcript}`.trim();
      if (status) status.textContent = "Đã nhập giọng nói";
    };
    recognition.onerror = () => { if (status) status.textContent = "Không nhận được giọng nói"; };
    recognition.start();
  });

  const shouldPollMessages = () => {
    if (document.hidden) return false;
    const rect = root.getBoundingClientRect();
    return rect.top < window.innerHeight + 520 && rect.bottom > -520;
  };

  loadMessages();
  pollingTimer = setInterval(() => {
    if (shouldPollMessages()) loadMessages();
  }, 5000);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) {
      if (canvas && !particleAnimation) drawParticles();
      if (shouldPollMessages()) loadMessages();
    }
  });
  window.addEventListener("beforeunload", () => clearInterval(pollingTimer));
}

function initCommunityChatV2() {
  if (!document.body.classList.contains("home-neon")) return;
  const root = byId("chat");
  if (!root) return;

  const profileKey = "hh-chat-profile";
  const anonymousIdKey = "hh-anonymous-id";
  const customRoomsKey = "hh-chat-custom-rooms";
  const defaultRooms = [
    { id: "general", name: "chung", topic: "Kênh chung cho thông báo nhanh, hỏi đáp và cập nhật dự án." },
    { id: "projects", name: "dự án", topic: "Trao đổi tiến độ, demo, lỗi và ý tưởng nâng cấp dự án." },
    { id: "support", name: "hỗ trợ", topic: "Hỏi đáp nhanh khi cần hỗ trợ sử dụng web, tool hoặc tài khoản." },
    { id: "voice", name: "voice", topic: "Phòng hẹn voice, ghi chú cuộc nói chuyện và trạng thái tham gia." },
    { id: "announcements", name: "thông báo", topic: "Tin quan trọng, cập nhật phiên bản và lịch bảo trì." },
    { id: "media", name: "media", topic: "Chia sẻ ảnh, GIF, video, nhạc và tài nguyên sáng tạo." },
    { id: "ai-lab", name: "ai-lab", topic: "Thử prompt, workflow AI, ý tưởng tự động hóa và bot hỗ trợ." }
  ];
  let customRooms = [];
  try {
    customRooms = JSON.parse(localStorage.getItem(customRoomsKey) || "[]");
  } catch {
    customRooms = [];
  }
  if (!Array.isArray(customRooms)) customRooms = [];
  let rooms = [...defaultRooms, ...customRooms];
  let roomNames = Object.fromEntries(rooms.map((item) => [item.id, item.name]));
  const reactionEmojis = ["\u2764\ufe0f", "\ud83d\ude02", "\ud83d\udd25", "\ud83d\udc4f", "\u2728"];

  const roomList = byId("chatRoomList");
  const roomCreateForm = byId("chatRoomCreateForm");
  const newRoomInput = byId("newChatRoomName");
  const toggleRoomCreator = byId("toggleRoomCreator");
  const nicknameInput = byId("chatNickname");
  const avatarUrlInput = byId("chatAvatarUrl");
  const presenceInput = byId("chatPresenceStatus");
  const avatarPreview = byId("chatAvatarPreview");
  const saveProfile = byId("saveChatProfile");
  const userList = byId("chatUserList");
  const roomLabel = byId("chatRoomLabel");
  const roomTopic = byId("chatRoomTopic");
  const status = byId("chatStatus");
  const messagesBox = byId("chatMessages");
  const pinsBox = byId("chatPins");
  const messageInput = byId("chatMessageInput");
  const imageUrlInput = byId("chatImageUrl");
  const searchInput = byId("chatSearch");
  const onlineCount = byId("chatOnlineCount");
  const replyPreview = byId("chatReplyPreview");
  const replyText = byId("chatReplyText");
  const cancelReply = byId("cancelChatReply");
  const typingLabel = byId("chatTyping");
  const sendButton = byId("sendChatMessage");
  const refreshButton = byId("refreshChatButton");
  const exportButton = byId("exportChatButton");
  const clearButton = byId("clearChatViewButton");
  const notifyButton = byId("notifyChatButton");
  const copyRoomLinkButton = byId("copyRoomLinkButton");
  const voiceButton = byId("chatVoiceButton");
  const joinVoiceButton = byId("joinVoiceLounge");
  const voiceStatus = byId("voiceLoungeStatus");

  let room = "general";
  let pollingTimer = 0;
  let presenceTimer = 0;
  let typingTimer = 0;
  let lastMessageSignature = "";
  let lastSeenByRoom = JSON.parse(localStorage.getItem("hh-chat-last-seen") || "{}");
  let allItems = [];
  let currentMessages = [];
  let replyTarget = null;
  let voiceJoined = false;
  let profile = JSON.parse(localStorage.getItem(profileKey) || "{}");

  const escapeHtml = (value) => String(value || "").replace(/[<>&"']/g, (char) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "\"": "&quot;", "'": "&#39;" }[char]));
  const slugifyRoom = (value) => {
    const normalized = String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/đ/g, "d")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 32);
    return normalized || `room-${Date.now().toString(36)}`;
  };
  const initials = (name) => (name || "HH").split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase();
  const fallbackName = () => {
    try {
      const authUser = JSON.parse(localStorage.getItem("hh-auth-user") || "null");
      if (authUser?.name || authUser?.email) return authUser.name || authUser.email;
    } catch {
      // Ignore malformed local auth cache.
    }
    return localStorage.getItem("hh-chat-last-name") || "Khách HH";
  };
  const anonymousId = () => {
    let id = localStorage.getItem(anonymousIdKey);
    if (!id) {
      id = randomId();
      localStorage.setItem(anonymousIdKey, id);
    }
    return id;
  };
  const safeUrl = (value) => {
    const raw = String(value || "").trim();
    try {
      const url = new URL(raw);
      return ["http:", "https:"].includes(url.protocol) ? url.href : "";
    } catch {
      return "";
    }
  };
  const linkify = (value) => escapeHtml(value)
    .replace(/(https?:\/\/[^\s<]+)/g, "<a href=\"$1\" target=\"_blank\" rel=\"noopener\">$1</a>")
    .replace(/\B@([\p{L}\p{N}_. -]{2,32})/gu, "<mark>@$1</mark>");
  const formatTime = (date) => new Date(date).toLocaleString("vi-VN", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" });

  const applyProfile = () => {
    profile = {
      nickname: (profile.nickname || fallbackName()).slice(0, 32),
      avatarUrl: safeUrl(profile.avatarUrl || ""),
      presence: profile.presence || "online",
      color: profile.color || `hsl(${Math.floor(Math.random() * 360)} 90% 72%)`
    };
    if (nicknameInput) nicknameInput.value = profile.nickname;
    if (avatarUrlInput) avatarUrlInput.value = profile.avatarUrl;
    if (presenceInput) presenceInput.value = profile.presence;
    if (avatarPreview) {
      avatarPreview.textContent = profile.avatarUrl ? "" : initials(profile.nickname);
      avatarPreview.style.backgroundImage = profile.avatarUrl ? `url("${profile.avatarUrl}")` : "";
      avatarPreview.style.backgroundColor = profile.color;
    }
    localStorage.setItem(profileKey, JSON.stringify(profile));
  };

  const syncRoomMaps = () => {
    customRooms = customRooms
      .filter((item) => item?.id && item?.name)
      .filter((item, index, arr) => arr.findIndex((roomItem) => roomItem.id === item.id) === index);
    rooms = [...defaultRooms, ...customRooms];
    roomNames = Object.fromEntries(rooms.map((item) => [item.id, item.name]));
  };

  const currentRoomMeta = () => rooms.find((item) => item.id === room) || { id: room, name: room, topic: "Phòng trò chuyện tùy chỉnh." };

  const saveCustomRooms = () => {
    localStorage.setItem(customRoomsKey, JSON.stringify(customRooms));
    syncRoomMaps();
  };

  const renderRooms = () => {
    if (!roomList) return;
    syncRoomMaps();
    roomList.innerHTML = rooms.map((item) => {
      const removable = customRooms.some((customRoom) => customRoom.id === item.id);
      return `<button class="chat-room ${item.id === room ? "active" : ""} interactive" type="button" data-chat-room="${escapeHtml(item.id)}">
        <b class="room-hash">#</b>
        <strong>${escapeHtml(item.name)}</strong>
        <span data-room-badge="${escapeHtml(item.id)}"></span>
        ${removable ? `<span class="room-remove" role="button" tabindex="0" data-remove-room="${escapeHtml(item.id)}" aria-label="Xóa phòng ${escapeHtml(item.name)}">x</span>` : ""}
      </button>`;
    }).join("");
  };

  const selectRoom = (nextRoom) => {
    room = nextRoom || "general";
    if (!rooms.some((item) => item.id === room)) room = "general";
    const meta = currentRoomMeta();
    if (roomLabel) roomLabel.textContent = `# ${meta.name}`;
    if (roomTopic) roomTopic.textContent = meta.topic || "Phòng trò chuyện tùy chỉnh.";
    lastMessageSignature = "";
    replyTarget = null;
    if (replyPreview) replyPreview.hidden = true;
    lastSeenByRoom[room] = Date.now();
    localStorage.setItem("hh-chat-last-seen", JSON.stringify(lastSeenByRoom));
    renderRooms();
    loadMessages();
    postPresence();
  };

  const chatRequest = async (path, options = {}) => {
    if (!REALTIME_URL) throw new Error("Backend chat chưa cấu hình.");
    const token = localStorage.getItem("hh-auth-token") || "";
    const response = await fetch(`${REALTIME_URL}${path}`, {
      method: options.method || "GET",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      ...(options.body ? { body: JSON.stringify(options.body) } : {})
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "Chat request failed.");
    return data;
  };

  const canUseChat = () => !document.body.classList.contains("auth-locked") && Boolean(localStorage.getItem("hh-auth-token"));

  const postChatItem = (type, data, title = type) => chatRequest("/api/modules/chat-app/items", {
    method: "POST",
    body: { title, type, anonymousId: anonymousId(), data }
  });

  const postPresence = async () => {
    if (!canUseChat()) return;
    applyProfile();
    try {
      await postChatItem("chat-presence", {
        room,
        senderId: anonymousId(),
        nickname: profile.nickname,
        avatarUrl: profile.avatarUrl,
        color: profile.color,
        presence: profile.presence,
        voiceJoined,
        at: Date.now()
      }, `${profile.nickname} presence`);
    } catch {
      // Presence is optional and should never block the UI.
    }
  };

  const buildReactionMap = (items) => {
    const map = new Map();
    items.filter((item) => item.type === "chat-reaction").forEach((item) => {
      const data = item.data || {};
      if (!data.messageId) return;
      const grouped = map.get(data.messageId) || {};
      const emoji = data.emoji || "\u2728";
      grouped[emoji] ||= new Set();
      grouped[emoji].add(data.senderId || item.anonymousId || item.createdAt);
      map.set(data.messageId, grouped);
    });
    return map;
  };

  const buildPinSet = (items) => new Set(items.filter((item) => item.type === "chat-pin" && item.data?.room === room).map((item) => item.data.messageId).filter(Boolean));

  const renderUsers = (items) => {
    if (!userList) return;
    const users = new Map();
    items.filter((item) => item.type === "chat-message" || item.type === "chat-presence").forEach((item) => {
      const data = item.data || {};
      if (data.room && data.room !== room) return;
      if (!data.nickname) return;
      users.set(data.senderId || data.nickname, {
        nickname: data.nickname,
        avatarUrl: data.avatarUrl,
        color: data.color,
        presence: data.presence || "online",
        voiceJoined: Boolean(data.voiceJoined),
        at: item.createdAt
      });
    });
    const rows = [...users.values()].sort((a, b) => new Date(b.at) - new Date(a.at)).slice(0, 12);
    const online = rows.filter((user) => Date.now() - new Date(user.at).getTime() < 5 * 60 * 1000);
    if (onlineCount) onlineCount.textContent = `${online.length} online`;
    userList.innerHTML = rows.length ? rows.map((user) => `
      <button class="chat-user interactive" type="button" data-mention="${escapeHtml(user.nickname)}">
        <span style="${user.avatarUrl ? `background-image:url('${escapeHtml(user.avatarUrl)}')` : `background:${user.color || "#ff4fd8"}`}">${user.avatarUrl ? "" : initials(user.nickname)}</span>
        <strong>${escapeHtml(user.nickname)}</strong>
        <em class="${Date.now() - new Date(user.at).getTime() < 5 * 60 * 1000 ? "online" : ""}">${user.voiceJoined ? "voice" : escapeHtml(user.presence)}</em>
      </button>
    `).join("") : "<p>Chưa có ai trong phòng.</p>";
    userList.querySelectorAll("[data-mention]").forEach((button) => {
      button.addEventListener("click", () => {
        if (!messageInput) return;
        messageInput.value = `${messageInput.value} @${button.dataset.mention} `.replace(/\s+/g, " ");
        messageInput.focus();
      });
    });
  };

  const renderBadges = (messages) => {
    const counts = {};
    messages.forEach((item) => {
      const data = item.data || {};
      if (!data.room || data.room === room) return;
      if (new Date(item.createdAt).getTime() > Number(lastSeenByRoom[data.room] || 0)) counts[data.room] = (counts[data.room] || 0) + 1;
    });
    root.querySelectorAll("[data-room-badge]").forEach((badge) => {
      const count = counts[badge.dataset.roomBadge] || 0;
      badge.textContent = count ? String(count) : "";
      badge.hidden = !count;
    });
  };

  const renderPins = (messages, pinSet) => {
    if (!pinsBox) return;
    const pins = messages.filter((item) => pinSet.has(item._id)).slice(-4).reverse();
    pinsBox.hidden = pins.length === 0;
    pinsBox.innerHTML = pins.map((item) => {
      const data = item.data || {};
      return `<button class="chat-pin interactive" type="button" data-jump-message="${item._id}">
        <strong>\ud83d\udccc ${escapeHtml(data.nickname || "Khách")}</strong>
        <span>${escapeHtml(data.message || data.imageUrl || "Tin đã ghim").slice(0, 120)}</span>
      </button>`;
    }).join("");
    pinsBox.querySelectorAll("[data-jump-message]").forEach((button) => {
      button.addEventListener("click", () => {
        const target = messagesBox?.querySelector(`[data-message-id="${button.dataset.jumpMessage}"]`);
        target?.scrollIntoView({ behavior: "smooth", block: "center" });
        target?.classList.add("glow-burst");
      });
    });
  };

  const attachMessageActions = () => {
    messagesBox?.querySelectorAll("[data-reply-message]").forEach((button) => {
      button.addEventListener("click", () => {
        const item = currentMessages.find((message) => message._id === button.dataset.replyMessage);
        if (!item) return;
        replyTarget = { id: item._id, nickname: item.data?.nickname || "Khách", text: item.data?.message || "" };
        if (replyPreview && replyText) {
          replyPreview.hidden = false;
          replyText.textContent = `${replyTarget.nickname}: ${replyTarget.text.slice(0, 90)}`;
        }
        messageInput?.focus();
      });
    });
    messagesBox?.querySelectorAll("[data-pin-message]").forEach((button) => {
      button.addEventListener("click", async () => {
        await postChatItem("chat-pin", { room, messageId: button.dataset.pinMessage, senderId: anonymousId(), nickname: profile.nickname }, `${profile.nickname} pinned`);
        await loadMessages();
      });
    });
    messagesBox?.querySelectorAll("[data-copy-message]").forEach((button) => {
      button.addEventListener("click", async () => {
        const item = currentMessages.find((message) => message._id === button.dataset.copyMessage);
        if (!item) return;
        await navigator.clipboard?.writeText(item.data?.message || item.data?.imageUrl || "");
        if (status) status.textContent = "Đã copy tin nhắn";
      });
    });
    messagesBox?.querySelectorAll("[data-react-message]").forEach((button) => {
      button.addEventListener("click", async () => {
        await postChatItem("chat-reaction", { room, messageId: button.dataset.reactMessage, emoji: button.dataset.emoji, senderId: anonymousId(), nickname: profile.nickname }, `${profile.nickname} reacted`);
        await loadMessages();
      });
    });
  };

  const renderMessages = (items) => {
    if (!messagesBox) return;
    allItems = items;
    const search = (searchInput?.value || "").trim().toLowerCase();
    const reactions = buildReactionMap(items);
    const pinSet = buildPinSet(items);
    const messages = items
      .filter((item) => item.type === "chat-message" && item.data?.room === room)
      .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
      .filter((item) => {
        if (!search) return true;
        const data = item.data || {};
        return `${data.nickname || ""} ${data.message || ""} ${data.imageUrl || ""}`.toLowerCase().includes(search);
      })
      .slice(-120);
    currentMessages = messages;
    const signature = [room, search, messages.map((item) => item._id || item.createdAt).join("|"), items.filter((item) => item.type === "chat-reaction" || item.type === "chat-pin").map((item) => item._id || item.createdAt).join("|")].join("::");
    renderUsers(items);
    renderBadges(items.filter((item) => item.type === "chat-message"));
    renderPins(messages, pinSet);
    if (signature === lastMessageSignature) return;
    lastMessageSignature = signature;
    messagesBox.innerHTML = messages.length ? messages.map((item) => {
      const data = item.data || {};
      const mine = data.senderId === anonymousId();
      const avatarStyle = data.avatarUrl ? `background-image:url('${escapeHtml(data.avatarUrl)}')` : `background:${data.color || "#ff4fd8"}`;
      const reply = data.replyTo ? `<div class="chat-reply-line">\u21a9 ${escapeHtml(data.replyTo.nickname || "Tin nhắn")}: ${escapeHtml(data.replyTo.text || "").slice(0, 100)}</div>` : "";
      const imageUrl = safeUrl(data.imageUrl);
      const image = imageUrl ? `<a class="chat-image" href="${escapeHtml(imageUrl)}" target="_blank" rel="noopener"><img src="${escapeHtml(imageUrl)}" alt="Ảnh chat" loading="lazy"></a>` : "";
      const groupedReactions = reactions.get(item._id) || {};
      const reactionHtml = Object.entries(groupedReactions).map(([emoji, users]) => `<button class="chat-reaction active interactive" type="button" data-react-message="${item._id}" data-emoji="${escapeHtml(emoji)}">${escapeHtml(emoji)} ${users.size}</button>`).join("");
      return `
        <article class="chat-message ${mine ? "mine" : ""} ${pinSet.has(item._id) ? "pinned" : ""}" data-message-id="${item._id}">
          <div class="chat-avatar small" style="${avatarStyle}">${data.avatarUrl ? "" : initials(data.nickname)}</div>
          <div class="chat-bubble">
            <header><strong>${escapeHtml(data.nickname || "Khách")}</strong><span>${formatTime(item.createdAt)}</span>${pinSet.has(item._id) ? "<b>Đã ghim</b>" : ""}</header>
            ${reply}
            <p>${linkify(data.message || "")}</p>
            ${image}
            <div class="chat-message-tools">
              <button class="interactive" type="button" data-reply-message="${item._id}">Trả lời</button>
              <button class="interactive" type="button" data-pin-message="${item._id}">Ghim</button>
              <button class="interactive" type="button" data-copy-message="${item._id}">Copy</button>
              ${reactionEmojis.map((emoji) => `<button class="chat-reaction interactive" type="button" data-react-message="${item._id}" data-emoji="${emoji}">${emoji}</button>`).join("")}
            </div>
            <div class="chat-reaction-row">${reactionHtml}</div>
          </div>
        </article>`;
    }).join("") : "<p class=\"chat-empty\">Chưa có tin nhắn. Hãy là người mở lời.</p>";
    messagesBox.scrollTop = messagesBox.scrollHeight;
    attachMessageActions();
  };

  async function loadMessages() {
    if (!status) return;
    if (!canUseChat()) {
      status.textContent = "Đăng nhập để dùng chat";
      if (messagesBox) messagesBox.innerHTML = "<p class=\"chat-empty\">Vui lòng đăng nhập để xem và gửi tin nhắn realtime.</p>";
      if (userList) userList.innerHTML = "<p>Đăng nhập để xem thành viên online.</p>";
      return;
    }
    if (!REALTIME_URL) {
      status.textContent = "Backend chưa cấu hình";
      return;
    }
    try {
      const data = await chatRequest("/api/modules/chat-app/items");
      renderMessages(data.items || []);
      lastSeenByRoom[room] = Date.now();
      localStorage.setItem("hh-chat-last-seen", JSON.stringify(lastSeenByRoom));
      status.textContent = "Đang online";
    } catch (error) {
      status.textContent = `Lỗi chat: ${error.message}`;
    }
  }

  const expandSlashCommand = (message) => {
    if (message === "/help") return "Lệnh nhanh: /help, /clear, /shrug, /me nội dung. Dùng @tên để nhắc người khác.";
    if (message === "/shrug") return "¯\\_(ツ)_/¯";
    if (message.startsWith("/me ")) return `* ${profile.nickname} ${message.slice(4)}`;
    if (message === "/clear") {
      if (messagesBox) messagesBox.innerHTML = "<p class=\"chat-empty\">Đã dọn màn hình local. Bấm tải lại để xem lại tin.</p>";
      return "";
    }
    return message;
  };

  const sendMessage = async () => {
    if (!canUseChat()) {
      if (status) status.textContent = "Bạn cần đăng nhập trước khi gửi tin nhắn";
      return;
    }
    const expanded = expandSlashCommand((messageInput?.value || "").trim());
    const imageUrl = safeUrl(imageUrlInput?.value || "");
    if (!expanded && !imageUrl) return;
    applyProfile();
    if (status) status.textContent = "Đang gửi...";
    try {
      await postChatItem("chat-message", {
        room,
        message: expanded,
        imageUrl,
        replyTo: replyTarget,
        senderId: anonymousId(),
        nickname: profile.nickname,
        avatarUrl: profile.avatarUrl,
        color: profile.color,
        presence: profile.presence
      }, `${profile.nickname} - ${room}`);
      if (messageInput) messageInput.value = "";
      if (imageUrlInput) imageUrlInput.value = "";
      replyTarget = null;
      if (replyPreview) replyPreview.hidden = true;
      if (typingLabel) typingLabel.textContent = "";
      await loadMessages();
      if ("Notification" in window && Notification.permission === "granted" && document.hidden) {
        new Notification(`HH Chat #${roomNames[room] || room}`, { body: `${profile.nickname}: ${expanded || "Đã gửi ảnh"}` });
      }
    } catch (error) {
      if (status) status.textContent = `Gửi lỗi: ${error.message}`;
    }
  };

  applyProfile();
  const hashRoom = decodeURIComponent((location.hash || "").replace(/^#chat-room-/, ""));
  if (hashRoom && rooms.some((item) => item.id === hashRoom)) room = hashRoom;
  renderRooms();
  selectRoom(room);

  window.addEventListener("hh:auth-change", (event) => {
    const authUser = event.detail?.user;
    if (!authUser) {
      loadMessages();
      return;
    }
    const oldDefault = !profile.nickname || profile.nickname === "Khách HH" || profile.nickname === "Khach HH";
    if (oldDefault) {
      profile.nickname = authUser.name || authUser.email || "Khách HH";
      applyProfile();
      postPresence();
      loadMessages();
    }
  });

  saveProfile?.addEventListener("click", async () => {
    profile.nickname = nicknameInput?.value.trim() || "Khách HH";
    profile.avatarUrl = safeUrl(avatarUrlInput?.value || "");
    profile.presence = presenceInput?.value || "online";
    applyProfile();
    await postPresence();
    if (status) status.textContent = "Đã lưu hồ sơ chat";
  });

  presenceInput?.addEventListener("change", async () => {
    profile.presence = presenceInput.value;
    applyProfile();
    await postPresence();
    await loadMessages();
  });

  toggleRoomCreator?.addEventListener("click", () => {
    if (!roomCreateForm) return;
    roomCreateForm.hidden = !roomCreateForm.hidden;
    if (!roomCreateForm.hidden) newRoomInput?.focus();
  });

  roomCreateForm?.addEventListener("submit", (event) => {
    event.preventDefault();
    const name = (newRoomInput?.value || "").trim();
    if (!name) {
      if (status) status.textContent = "Nhập tên phòng trước đã";
      return;
    }
    const idBase = slugifyRoom(name);
    let id = idBase;
    let suffix = 2;
    while (rooms.some((item) => item.id === id)) {
      id = `${idBase}-${suffix}`;
      suffix += 1;
    }
    customRooms.push({
      id,
      name: name.slice(0, 28),
      topic: `Phòng riêng do ${profile.nickname || "thành viên"} tạo.`
    });
    saveCustomRooms();
    if (newRoomInput) newRoomInput.value = "";
    if (roomCreateForm) roomCreateForm.hidden = true;
    if (status) status.textContent = `Đã tạo phòng # ${name}`;
    selectRoom(id);
  });

  roomList?.addEventListener("click", (event) => {
    const removeButton = event.target.closest("[data-remove-room]");
    if (removeButton) {
      event.stopPropagation();
      const removeId = removeButton.dataset.removeRoom;
      customRooms = customRooms.filter((item) => item.id !== removeId);
      saveCustomRooms();
      if (room === removeId) room = "general";
      renderRooms();
      selectRoom(room);
      if (status) status.textContent = "Đã xóa phòng tùy chỉnh";
      return;
    }
    const button = event.target.closest("[data-chat-room]");
    if (!button) return;
    selectRoom(button.dataset.chatRoom || "general");
  });

  cancelReply?.addEventListener("click", () => {
    replyTarget = null;
    if (replyPreview) replyPreview.hidden = true;
  });

  root.querySelectorAll("[data-chat-emoji]").forEach((button) => {
    button.addEventListener("click", () => {
      if (!messageInput) return;
      messageInput.value = `${messageInput.value}${button.dataset.chatEmoji}`;
      messageInput.focus();
    });
  });

  searchInput?.addEventListener("input", () => {
    lastMessageSignature = "";
    renderMessages(allItems);
  });
  sendButton?.addEventListener("click", sendMessage);
  refreshButton?.addEventListener("click", loadMessages);
  copyRoomLinkButton?.addEventListener("click", async () => {
    const url = `${location.origin}${location.pathname}#chat-room-${encodeURIComponent(room)}`;
    await navigator.clipboard?.writeText(url);
    if (status) status.textContent = "Đã copy link phòng";
  });
  exportButton?.addEventListener("click", () => {
    downloadText(`hh-chat-${room}.json`, JSON.stringify(currentMessages, null, 2));
    if (status) status.textContent = "Đã xuất JSON phòng chat";
  });
  clearButton?.addEventListener("click", () => {
    if (messagesBox) messagesBox.innerHTML = "<p class=\"chat-empty\">Đã dọn màn hình local. Bấm tải lại để xem lại tin.</p>";
    lastMessageSignature = "";
  });
  notifyButton?.addEventListener("click", async () => {
    if (!("Notification" in window)) {
      if (status) status.textContent = "Trình duyệt chưa hỗ trợ thông báo";
      return;
    }
    const permission = await Notification.requestPermission();
    notifyButton.textContent = permission === "granted" ? "Thông báo đã bật" : "Bật thông báo";
  });
  joinVoiceButton?.addEventListener("click", async () => {
    voiceJoined = !voiceJoined;
    joinVoiceButton.textContent = voiceJoined ? "Rời voice" : "Tham gia";
    if (voiceStatus) voiceStatus.textContent = voiceJoined ? `${profile.nickname} đang trong voice lounge` : "Chưa tham gia voice";
    await postPresence();
    await loadMessages();
  });

  messageInput?.addEventListener("input", () => {
    if (typingLabel) typingLabel.textContent = messageInput.value.trim() ? `${profile.nickname} đang soạn...` : "";
    window.clearTimeout(typingTimer);
    typingTimer = window.setTimeout(() => { if (typingLabel) typingLabel.textContent = ""; }, 1800);
  });
  messageInput?.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  });

  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition && voiceButton) {
    voiceButton.disabled = true;
    voiceButton.textContent = "Trình duyệt chưa hỗ trợ nói";
  }
  voiceButton?.addEventListener("click", () => {
    if (!SpeechRecognition || !messageInput) return;
    const recognition = new SpeechRecognition();
    recognition.lang = "vi-VN";
    recognition.interimResults = false;
    recognition.onstart = () => { if (status) status.textContent = "Đang nghe giọng nói..."; };
    recognition.onresult = (event) => {
      messageInput.value = `${messageInput.value} ${event.results[0][0].transcript}`.trim();
      if (status) status.textContent = "Đã nhập giọng nói";
    };
    recognition.onerror = () => { if (status) status.textContent = "Không nhận được giọng nói"; };
    recognition.start();
  });

  const shouldPollMessages = () => {
    if (document.hidden) return false;
    const rect = root.getBoundingClientRect();
    return rect.top < window.innerHeight + 520 && rect.bottom > -520;
  };

  presenceTimer = setInterval(postPresence, 60000);
  pollingTimer = setInterval(() => {
    if (shouldPollMessages()) loadMessages();
  }, 3200);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) {
      if (canvas && !particleAnimation) drawParticles();
      if (shouldPollMessages()) {
        loadMessages();
        postPresence();
      }
    }
  });
  window.addEventListener("beforeunload", () => {
    clearInterval(pollingTimer);
    clearInterval(presenceTimer);
  });
}

function initHomeNeonInteractions() {
  if (!document.body.classList.contains("home-neon")) return;

  window.addEventListener("pointermove", (event) => {
    const x = `${event.clientX}px`;
    const y = `${event.clientY}px`;
    document.documentElement.style.setProperty("--mx", x);
    document.documentElement.style.setProperty("--my", y);
  }, { passive: true });

  document.querySelectorAll(".tilt-card, .project-card").forEach((card) => {
    card.addEventListener("pointermove", (event) => {
      const rect = card.getBoundingClientRect();
      const x = ((event.clientX - rect.left) / rect.width - 0.5) * 12;
      const y = ((event.clientY - rect.top) / rect.height - 0.5) * -12;
      card.style.transform = `perspective(900px) translateY(-10px) rotateX(${y}deg) rotateY(${x}deg)`;
    });
    card.addEventListener("pointerleave", () => {
      card.style.transform = "";
    });
  });

  document.querySelectorAll(".interactive").forEach((item) => {
    item.addEventListener("pointerdown", () => item.classList.add("is-pressed"));
    item.addEventListener("pointerup", () => item.classList.remove("is-pressed"));
    item.addEventListener("pointerleave", () => item.classList.remove("is-pressed"));
    item.addEventListener("click", (event) => {
      if (!item.matches("#likePageButton, [data-rating]")) playClickSound();
      item.classList.remove("glow-burst");
      void item.offsetWidth;
      item.classList.add("glow-burst");
      const rect = item.getBoundingClientRect();
      const dot = document.createElement("span");
      dot.className = "ripple-dot";
      dot.style.left = `${event.clientX - rect.left}px`;
      dot.style.top = `${event.clientY - rect.top}px`;
      item.appendChild(dot);
      setTimeout(() => dot.remove(), 560);
    });
  });

  const likeButton = byId("likePageButton");
  const likedInput = byId("visitorLiked");
  const ratingInput = byId("visitorRating");
  const ratingLabel = byId("ratingLabel");
  const ratingButtons = document.querySelectorAll("[data-rating]");

  if (likeButton && likedInput) {
    const applyLiked = (liked) => {
      likeButton.classList.toggle("is-liked", liked);
      likeButton.setAttribute("aria-pressed", liked ? "true" : "false");
      likeButton.querySelector("span").textContent = liked ? "♥" : "♡";
      likeButton.querySelector("strong").textContent = liked ? "Đã thích trang" : "Thích trang";
      likedInput.value = liked ? "Da bam thich" : "Chua bam thich";
      localStorage.setItem("hoangdaika13-liked", liked ? "yes" : "no");
    };
    applyLiked(localStorage.getItem("hoangdaika13-liked") === "yes");
    likeButton.addEventListener("click", () => {
      applyLiked(!likeButton.classList.contains("is-liked"));
      playClickSound(820);
    });
  }

  const applyRating = (rating) => {
    if (!ratingInput || !ratingLabel) return;
    ratingInput.value = `${rating} sao`;
    ratingLabel.textContent = `${rating}/5 sao`;
    ratingButtons.forEach((button) => {
      button.classList.toggle("is-active", Number(button.dataset.rating) <= rating);
    });
    localStorage.setItem("hoangdaika13-rating", String(rating));
  };

  ratingButtons.forEach((button) => {
    button.addEventListener("click", () => {
      applyRating(Number(button.dataset.rating));
      playClickSound(620 + Number(button.dataset.rating) * 60);
    });
  });

  const savedRating = Number(localStorage.getItem("hoangdaika13-rating"));
  if (savedRating) applyRating(savedRating);

  const setMailto = (link, subject, fields) => {
    if (!link) return;
    const update = () => {
      const body = fields
        .map(([label, selector]) => `${label}: ${document.querySelector(selector)?.value || ""}`)
        .join("\n");
      link.href = `mailto:nhhoang130803@gmail.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    };
    fields.forEach(([, selector]) => document.querySelector(selector)?.addEventListener("input", update));
    update();
  };

  setMailto(byId("visitorMailto"), "Danh gia moi tu website Hoangdaika13", [
    ["Da thich trang", "#visitorLiked"],
    ["Danh gia sao", "#visitorRating"],
    ["Ho ten", ".visitor-form input[name='Ho ten nguoi ghe tham']"],
    ["Email", ".visitor-form input[name='email']"],
    ["So dien thoai", ".visitor-form input[name='phone']"]
  ]);

  setMailto(byId("leadMailto"), "Lien he moi tu website Hoangdaika13", [
    ["Ho ten", ".lead-form input[name='Ho ten']"],
    ["Email", ".lead-form input[name='email']"],
    ["So dien thoai", ".lead-form input[name='So dien thoai']"],
    ["Noi dung", ".lead-form textarea[name='Noi dung']"]
  ]);
}

function valueOf(id) {
  return byId(id)?.value.trim() || "";
}

function setValue(id, value) {
  const el = byId(id);
  if (el) el.value = value;
}

function setText(id, value) {
  const el = byId(id);
  if (el) el.textContent = value;
}

function setStatus(message) {
  setText("toolStatus", message);
}

function words(text) {
  return (text.toLowerCase().match(/[\p{L}\p{N}]+/gu) || []).filter((word) => word.length > 1);
}

function wordCount(text) {
  return words(text).length;
}

function sentences(text) {
  return text
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?。！？])\s+|[\r\n]+/u)
    .map((item) => item.trim())
    .filter(Boolean);
}

function topKeywords(text, limit = 12) {
  const stop = new Set("và là của có cho một những các trong với được không khi đã này người để thì vào như từ".split(" "));
  const counts = new Map();
  for (const word of words(text)) {
    if (stop.has(word) || word.length < 3) continue;
    counts.set(word, (counts.get(word) || 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit);
}

function cleanText(text) {
  return text
    .replace(/\d{1,2}:\d{2}(?::\d{2})?(?:[,.]\d+)?/g, "")
    .replace(/^\s*\d+\s*$/gm, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function config() {
  return {
    projectName: valueOf("projectName") || "Dự án kể chuyện 40+",
    title: valueOf("storyTitle") || "Một câu chuyện đời thường nhiều cảm xúc",
    duration: valueOf("duration") || "8-12 phút",
    audience: valueOf("audience") || "Người xem 40+",
    tone: valueOf("tone") || "Ấm áp, chân thật, giàu cảm xúc",
    mode: valueOf("rewriteMode") || "Kể chuyện 40+ - nhanh và cảm xúc"
  };
}

function buildPrompt() {
  const cfg = config();
  const source = valueOf("sourceText") || "Chưa có nội dung nguồn. Hãy tự xây một câu chuyện mới theo chủ đề.";
  return `Bạn là biên kịch YouTube chuyên viết kịch bản kể chuyện.

Dự án: ${cfg.projectName}
Tiêu đề/chủ đề: ${cfg.title}
Thời lượng mục tiêu: ${cfg.duration}
Người xem: ${cfg.audience}
Tone: ${cfg.tone}
Chế độ viết: ${cfg.mode}

Yêu cầu:
1. Viết thành kịch bản hoàn chỉnh, không viết outline, không viết bảng.
2. Mở đầu có hook mạnh trong 20 giây đầu.
3. Mạch truyện rõ: mở chuyện, xung đột, bí mật, cao trào, giải quyết, bài học.
4. Không dùng timestamp, không ghi chú ngoài lề.
5. Ngôn ngữ tự nhiên, giàu cảm xúc, hợp để đọc voice YouTube.
6. Nếu nguồn ngắn, phát triển chi tiết hợp lý nhưng giữ ý lõi.
7. Kết thúc có dư âm và CTA mềm.

Nội dung nguồn:
${source}`;
}

function buildDraft() {
  const cfg = config();
  const source = valueOf("sourceText") || "Một nhân vật chính từng bị hiểu lầm, nhưng cuối cùng sự thật được hé lộ.";
  return `TIÊU ĐỀ: ${cfg.title}

ĐỊNH HƯỚNG
- Dự án: ${cfg.projectName}
- Người xem: ${cfg.audience}
- Thời lượng: ${cfg.duration}
- Tone: ${cfg.tone}
- Chế độ: ${cfg.mode}

HOOK MỞ ĐẦU
Không phải ai im lặng cũng là người sai. Có những sự thật bị chôn giấu rất lâu, chỉ chờ một ngày bình thường để khiến cả gia đình phải nhìn lại mọi chuyện.

TÓM TẮT NGUỒN
${source}

BẢN NHÁP KỊCH BẢN
Ngày hôm đó bắt đầu như bao ngày khác. Nhưng chỉ một câu nói vô tình đã kéo mọi người trở về với những vết thương tưởng như đã ngủ yên. Nhân vật chính không vội giải thích. Người ấy chỉ lặng lẽ nhìn từng người, như thể đã quen với việc bị hiểu lầm.

Trong quá khứ, có một quyết định rất khó khăn đã được đưa ra. Quyết định ấy khiến nhiều người tổn thương, nhưng phía sau nó lại là một lý do không ai biết. Càng đi sâu vào câu chuyện, người xem càng nhận ra điều đáng sợ nhất không phải là nghèo khó hay mất mát, mà là khi người thân không còn đủ kiên nhẫn để lắng nghe nhau.

Mâu thuẫn tăng lên khi một bằng chứng cũ xuất hiện: một lá thư, một cuộc gọi, một món đồ hoặc một người chứng kiến. Từ đây, những lời trách móc dần đổi thành im lặng. Người từng bị xem là vô tâm hóa ra lại là người âm thầm gánh phần nặng nhất.

CAO TRÀO
Sự thật được nói ra vào đúng lúc không ai còn có thể trốn tránh. Người gây tổn thương phải đối diện với lỗi lầm của mình, còn người chịu đựng cuối cùng cũng được trả lại sự công bằng.

KẾT
Câu chuyện khép lại bằng một bài học nhẹ nhưng sâu: trong gia đình, đôi khi điều cần nhất không phải là thắng trong một cuộc tranh cãi, mà là đủ thương để hỏi: "Ngày đó, bạn đã đau như thế nào?"`;
}

function analyzeText(text) {
  const sents = sentences(text);
  const kws = topKeywords(text);
  const wc = wordCount(text);
  const minutes = Math.max(1, wc / 145);
  return `Số từ: ${wc}
Số câu/đoạn: ${sents.length}
Ước lượng voice: ${minutes.toFixed(1)} phút

Keyword nổi bật:
${kws.map(([word, count]) => `- ${word}: ${count}`).join("\n") || "- Chưa đủ dữ liệu"}

Beat gợi ý:
- Hook: ${sents[0] || "Cần thêm mở đầu mạnh hơn."}
- Xung đột: cần làm rõ nhân vật muốn gì và bị cản bởi điều gì.
- Cao trào: nên có bằng chứng, đối thoại hoặc lựa chọn khó.
- Kết: nên có bài học hoặc dư âm cảm xúc.`;
}

function summarizeText(text) {
  const sents = sentences(text);
  if (!sents.length) return "Chưa có nội dung để tóm tắt.";
  return sents.slice(0, 7).map((sent, index) => `${index + 1}. ${sent}`).join("\n");
}

function compareTexts(source, draft) {
  const left = new Set(words(source));
  const right = new Set(words(draft));
  const shared = [...left].filter((word) => right.has(word)).length;
  const total = new Set([...left, ...right]).size || 1;
  const similarity = Math.round((shared / total) * 100);
  const originality = Math.max(0, 100 - similarity);
  const risk = similarity >= 55 ? "Cao" : similarity >= 32 ? "Vừa" : "Thấp";
  return { similarity, originality, risk };
}

function updateMetas() {
  setText("sourceMeta", `${wordCount(valueOf("sourceText"))} từ`);
  setText("draftMeta", `${wordCount(valueOf("outputText"))} từ`);
}

function setOutput(text, message) {
  setValue("outputText", text);
  setValue("draftText", text);
  setText("geminiOutput", text);
  updateMetas();
  setStatus(message);
}

function showMiniTab(tab) {
  const button = document.querySelector(`.mini-tab[data-mini-tab="${tab}"]`);
  if (button) button.click();
}

function currentProjectPayload() {
  return {
    projectName: valueOf("projectName"),
    storyTitle: valueOf("storyTitle"),
    duration: valueOf("duration"),
    audience: valueOf("audience"),
    tone: valueOf("tone"),
    niche: valueOf("niche"),
    cta: valueOf("cta"),
    mode: valueOf("rewriteMode"),
    source: valueOf("sourceText"),
    output: valueOf("outputText"),
    savedAt: new Date().toISOString()
  };
}

function loadProjectPayload(payload) {
  setValue("projectName", payload.projectName || "");
  setValue("storyTitle", payload.storyTitle || "");
  setValue("duration", payload.duration || "");
  setValue("audience", payload.audience || "");
  setValue("tone", payload.tone || "");
  setValue("niche", payload.niche || "");
  setValue("cta", payload.cta || "");
  setValue("rewriteMode", payload.mode || "");
  setValue("sourceText", payload.source || "");
  setValue("outputText", payload.output || "");
  updateMetas();
}

function downloadText(filename, text, type = "text/plain;charset=utf-8") {
  const blob = new Blob([text], { type });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}

async function callGemini() {
  const apiKey = valueOf("apiKey");
  const model = valueOf("modelName") || "gemini-1.5-flash";
  if (!apiKey) {
    setStatus("Bạn cần nhập API key Gemini nếu muốn gọi AI thật.");
    return;
  }
  setStatus("Đang gọi Gemini...");
  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: buildPrompt() }] }],
        generationConfig: { temperature: 0.8, topP: 0.95, maxOutputTokens: 4096 }
      })
    });
    if (!response.ok) throw new Error(await response.text());
    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.map((part) => part.text).join("\n") || "";
    setOutput(text || "Gemini không trả về nội dung.", "Gemini đã trả kết quả.");
  } catch (error) {
    console.error(error);
    setStatus("Không gọi được Gemini. Hãy kiểm tra API key, model hoặc mạng/CORS.");
  }
}

function initMiniTabs() {
  document.querySelectorAll(".mini-tab").forEach((button) => {
    button.addEventListener("click", () => {
      const tab = button.dataset.miniTab;
      document.querySelectorAll(".mini-tab").forEach((item) => item.classList.toggle("active", item === button));
      document.querySelectorAll(".mini-panel").forEach((panel) => panel.classList.toggle("active", panel.id === `mini-${tab}`));
    });
  });
}

function bind(id, event, handler) {
  byId(id)?.addEventListener(event, handler);
}

function initTool() {
  if (!byId("sourceText") && !byId("outputText")) return;

  bind("sourceText", "input", updateMetas);
  bind("outputText", "input", updateMetas);
  bind("scriptFile", "change", async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setValue("sourceText", await file.text());
    updateMetas();
    setStatus(`Đã nhập file: ${file.name}`);
  });
  bind("pasteSource", "click", async () => {
    try {
      const text = await navigator.clipboard.readText();
      setValue("sourceText", text);
      updateMetas();
      setStatus("Đã dán nội dung từ clipboard.");
    } catch {
      setStatus("Trình duyệt chưa cho phép đọc clipboard. Hãy dán bằng Ctrl+V.");
    }
  });
  bind("cleanSource", "click", () => {
    setValue("sourceText", cleanText(valueOf("sourceText")));
    updateMetas();
    setStatus("Đã làm sạch text/phụ đề.");
  });
  bind("makeDraft", "click", () => setOutput(buildDraft(), "Đã tạo bản nháp local."));
  bind("oneClick", "click", () => {
    const cleaned = cleanText(valueOf("sourceText"));
    setValue("sourceText", cleaned);
    const draft = buildDraft();
    setOutput(draft, "Đã xử lý 1 chạm: làm sạch, phân tích nhanh và tạo bản nháp.");
    setText("analysisOutput", analyzeText(cleaned));
  });
  bind("makePrompt", "click", () => setOutput(buildPrompt(), "Đã tạo prompt."));
  bind("callGemini", "click", callGemini);
  const makeTitleHandler = () => {
    const source = valueOf("sourceText");
    const kw = topKeywords(source, 4).map(([word]) => word).join(" ");
    setValue("storyTitle", kw ? `Sự thật phía sau ${kw}` : "Một bí mật khiến cả gia đình im lặng");
    setStatus("Đã tạo title local.");
  };
  bind("makeTitle", "click", makeTitleHandler);
  bind("makeTitle2", "click", makeTitleHandler);
  bind("copyOutput", "click", async () => {
    const text = valueOf("outputText");
    if (!text) return setStatus("Chưa có nội dung để copy.");
    await navigator.clipboard.writeText(text);
    setStatus("Đã copy kết quả.");
  });
  bind("downloadOutput", "click", () => {
    const text = valueOf("outputText");
    if (!text) return setStatus("Chưa có nội dung để tải.");
    downloadText("kich-ban-ai.txt", text);
    setStatus("Đã tạo file TXT.");
  });
  bind("writerGenerate", "click", () => {
    const draft = buildDraft();
    setOutput(draft, "Gemini Writer: đã tạo bản viết mới local.");
    showMiniTab("writer");
  });
  bind("writerImprove", "click", () => {
    const improved = `${valueOf("outputText") || buildDraft()}\n\nPHIÊN BẢN NÂNG CẤP\n- Tăng hook mở đầu.\n- Thêm đối thoại ở cao trào.\n- Làm rõ bài học cuối câu chuyện.\n- Giảm câu giống nguồn, tăng chi tiết mới.`;
    setOutput(improved, "Đã nâng cấp bản nháp local.");
    showMiniTab("writer");
  });
  bind("writerPrompt", "click", () => {
    setOutput(buildPrompt(), "Đã tạo prompt đầy đủ.");
    showMiniTab("writer");
  });
  bind("analyzeScript", "click", () => {
    setText("analysisOutput", analyzeText(valueOf("sourceText")));
    setStatus("Đã phân tích nguồn.");
  });
  bind("storyScore", "click", () => {
    const draft = valueOf("outputText");
    const score = Math.min(100, 35 + Math.round(wordCount(draft) / 30) + topKeywords(draft, 8).length * 3);
    setText("analysisOutput", `Story score 40+: ${score}/100\n\nGợi ý:\n- Tăng hook mở đầu nếu score dưới 70.\n- Thêm cao trào, đối thoại và plot twist.\n- Kết thúc nên có bài học hoặc CTA mềm.`);
    setStatus(`Story score: ${score}/100`);
  });
  bind("summarizeScript", "click", () => {
    const sourceSummary = summarizeText(valueOf("sourceText"));
    const draftSummary = summarizeText(valueOf("outputText"));
    setText("summaryOutput", `TÓM TẮT NGUỒN\n${sourceSummary}\n\nTÓM TẮT BẢN MỚI\n${draftSummary}`);
    setStatus("Đã tóm tắt.");
    showMiniTab("summary");
  });
  bind("compareScript", "click", () => {
    const report = compareTexts(valueOf("sourceText"), valueOf("outputText"));
    setText("similarityPercent", `${report.similarity}%`);
    setText("originalityPercent", `${report.originality}%`);
    setText("riskLevel", report.risk);
    setText("compareOutput", `Độ giống: ${report.similarity}%\nĐộ mới: ${report.originality}%\nRủi ro: ${report.risk}\n\nKhuyến nghị:\n- Nếu rủi ro cao, đổi cấu trúc cảnh, nhân vật, tình huống và cách mở nút.\n- Giữ ý lõi nhưng thay diễn biến và câu chữ.\n- Tăng chi tiết mới ở phần giữa và cao trào.`);
    setStatus("Đã so sánh độ giống.");
    showMiniTab("compare");
  });
  bind("sendChat", "click", () => {
    const question = valueOf("chatInput");
    if (!question) return setStatus("Chưa có câu hỏi chat.");
    const answer = `Bạn: ${question}\n\nAI local: Dựa trên kịch bản hiện tại, nên tăng xung đột ở phần giữa, thêm một bằng chứng rõ ràng và làm đoạn kết có dư âm hơn.\n\n`;
    setText("chatLog", `${byId("chatLog")?.textContent || ""}${answer}`);
    setValue("chatInput", "");
    setStatus("Chat AI đã trả lời local.");
  });
  bind("clearChat", "click", () => {
    setText("chatLog", "Chat log.");
    setStatus("Đã xóa chat.");
  });
  bind("batchFiles", "change", async (event) => {
    const files = [...(event.target.files || [])];
    const rows = [];
    for (const file of files) {
      const text = await file.text();
      rows.push({ name: file.name, words: wordCount(text), summary: summarizeText(text).slice(0, 220) });
    }
    setText("batchOutput", JSON.stringify(rows, null, 2));
    setStatus(`Đã nạp ${rows.length} file batch.`);
  });
  bind("runBatch", "click", () => {
    const output = byId("batchOutput")?.textContent || "[]";
    setText("batchOutput", `${output}\n\nBatch local đã sẵn sàng. Với GitHub Pages, xử lý AI hàng loạt cần API key Gemini và xác nhận từng lượt gọi.`);
    setStatus("Đã chạy batch local.");
  });
  bind("downloadBatch", "click", () => downloadText("batch-results.json", byId("batchOutput")?.textContent || "[]", "application/json;charset=utf-8"));
  bind("parseUrls", "click", () => {
    const urls = valueOf("urlInput").split(/\s+/).filter(Boolean);
    const prompt = `Hãy đọc và viết lại nội dung từ các URL sau theo cấu hình hiện tại:\n\n${urls.map((url, i) => `${i + 1}. ${url}`).join("\n")}\n\n${buildPrompt()}`;
    setText("urlOutput", prompt);
    setStatus(`Đã tạo prompt cho ${urls.length} URL.`);
  });
  bind("clearUrls", "click", () => {
    setValue("urlInput", "");
    setText("urlOutput", "Chưa có URL.");
    setStatus("Đã xóa URL.");
  });
  bind("translateLocal", "click", () => {
    setValue("sourceTranslation", `[Bản dịch kiểm tra local]\n${valueOf("sourceText")}`);
    setValue("draftTranslation", `[Bản dịch kiểm tra local]\n${valueOf("outputText")}`);
    setStatus("Đã tạo bản dịch kiểm tra local.");
  });
  bind("copyTranslation", "click", async () => {
    await navigator.clipboard.writeText(`${valueOf("sourceTranslation")}\n\n${valueOf("draftTranslation")}`);
    setStatus("Đã copy bản dịch.");
  });
  bind("makePlan", "click", () => {
    const title = valueOf("storyTitle") || "Series kể chuyện 40+";
    setText("plannerOutput", `KẾ HOẠCH SERIES: ${title}\n\nTập 1: Hook bí mật gia đình\nTập 2: Nhân vật chính bị hiểu lầm\nTập 3: Bằng chứng cũ xuất hiện\nTập 4: Cao trào đối mặt\nTập 5: Sự thật và bài học\n\nLịch đăng: 3 video/tuần\nCTA: bình luận trải nghiệm cá nhân ở cuối mỗi tập.`);
    setStatus("Đã tạo kế hoạch nội dung.");
  });
  bind("ideaBank", "click", () => {
    setText("plannerOutput", "KHO Ý TƯỞNG 40+\n- Người mẹ bị con hiểu lầm\n- Di chúc mở ra bí mật cũ\n- Người cha nghèo âm thầm trả nợ cho con\n- Cuộc gọi cuối cùng trước ngày đoàn tụ\n- Hàng xóm giữ bí mật suốt 20 năm");
    setStatus("Đã mở kho ý tưởng.");
  });
  bind("saveProject", "click", () => {
    const payload = currentProjectPayload();
    localStorage.setItem("kich-ban-ai-project", JSON.stringify(payload));
    setText("projectOutput", JSON.stringify(payload, null, 2));
    setStatus("Đã lưu dự án local.");
  });
  bind("loadProject", "click", () => {
    const raw = localStorage.getItem("kich-ban-ai-project");
    if (!raw) return setStatus("Chưa có dự án local.");
    const payload = JSON.parse(raw);
    loadProjectPayload(payload);
    setText("projectOutput", JSON.stringify(payload, null, 2));
    setStatus("Đã mở dự án local.");
  });
  bind("exportProject", "click", () => downloadText("kich-ban-ai-project.json", JSON.stringify(currentProjectPayload(), null, 2), "application/json;charset=utf-8"));
  bind("deleteProject", "click", () => {
    localStorage.removeItem("kich-ban-ai-project");
    setText("projectOutput", "Đã xóa dự án local.");
    setStatus("Đã xóa dự án local.");
  });
  updateMetas();
}

function initAppShell() {
  const shell = byId("appShell");
  const workspace = byId("appWorkspace");
  const navigation = document.querySelector("[data-app-navigation]");
  const breadcrumb = byId("appBreadcrumb");
  const pageHeader = byId("appPageHeader");
  const pageActions = byId("appPageActions");
  const platform = byId("platform");
  const legacyMain = byId("top");
  const dashboardHome = workspace.querySelector(".dashboard-home");
  const palette = byId("commandPalette");
  const paletteInput = byId("commandPaletteInput");
  const paletteResults = byId("commandPaletteResults");
  const notificationDrawer = byId("notificationDrawer");
  const helpDrawer = byId("helpDrawer");
  const drawerBackdrop = document.querySelector(".app-drawer-backdrop");
  const userMenu = byId("appUserMenu");
  if (!shell || !workspace || !navigation || !platform) return;

  const stateKey = "hh.app-shell.v1";
  const mobileSidebarQuery = window.matchMedia("(max-width: 760px)");
  const localShellPreview = ["localhost", "127.0.0.1"].includes(location.hostname) && new URLSearchParams(location.search).has("shell-preview");
  const stored = () => {
    try { return JSON.parse(localStorage.getItem(stateKey) || "{}"); } catch { return {}; }
  };
  const saveState = (next) => localStorage.setItem(stateKey, JSON.stringify({ ...stored(), ...next }));
  const mediaStudioItems = [
    { id: "photo-editor", icon: "✎", title: "Photo Editor", group: "Biên tập" },
    { id: "video-editor", icon: "▶", title: "Video Editor", group: "Biên tập", description: "Dựng, màu, VFX, âm thanh và xuất bản" },
    { id: "background-remover", icon: "✂", title: "Background Remover", group: "Biên tập" },
    { id: "collage", icon: "▦", title: "Collage Maker", group: "Biên tập" },
    { id: "inspector", icon: "⌕", title: "Image Inspector", group: "Biên tập" },
    { id: "compress", icon: "⇣", title: "Image Compressor", group: "Hình ảnh" },
    { id: "convert", icon: "⇄", title: "Image Converter", group: "Hình ảnh" },
    { id: "image", icon: "◫", title: "Image Toolkit", group: "Hình ảnh" },
    { id: "picker", icon: "⌾", title: "Color Picker", group: "Hình ảnh" },
    { id: "pdf", icon: "▤", title: "PDF Toolkit", group: "Tài liệu" },
    { id: "qr", icon: "⌗", title: "QR Toolkit", group: "Tài liệu" },
    { id: "color", icon: "◉", title: "Color Studio", group: "Thương hiệu" },
    { id: "type", icon: "T", title: "Typography Studio", group: "Thương hiệu" },
    { id: "gradient", icon: "◒", title: "Gradient Generator", group: "Thương hiệu" },
    { id: "icon", icon: "◇", title: "Icon Browser", group: "Tài nguyên" },
    { id: "svg", icon: "⌁", title: "SVG Editor", group: "Tài nguyên" },
    { id: "social-post", icon: "▣", title: "Social Post Maker", group: "Xuất bản" },
    { id: "brand-kit", icon: "◆", title: "Brand Kit", group: "Xuất bản" },
    { id: "favicon", icon: "◈", title: "Favicon Studio", group: "Xuất bản" },
    { id: "meme", icon: "▰", title: "Meme Maker", group: "Xuất bản" }
  ];
  const developerToolItems = [
    { id: "json", icon: "{}", title: "JSON Formatter", group: "Dữ liệu" },
    { id: "base64", icon: "64", title: "Base64", group: "Dữ liệu" },
    { id: "uuid", icon: "#", title: "UUID & Token", group: "Bảo mật" },
    { id: "password", icon: "✦", title: "Password Generator", group: "Bảo mật" },
    { id: "timestamp", icon: "◷", title: "Timestamp", group: "Dữ liệu" },
    { id: "regex", icon: ".*", title: "Regex Tester", group: "Văn bản" },
    { id: "text", icon: "T", title: "Text Utilities", group: "Văn bản" },
    { id: "color", icon: "◉", title: "Color Studio", group: "Thiết kế" },
    { id: "compare", icon: "⇄", title: "Text Compare", group: "Văn bản" },
    { id: "calculator", icon: "∑", title: "Calculator", group: "Tiện ích" },
    { id: "notes", icon: "✓", title: "Notes & Todo", group: "Tiện ích" },
    { id: "system", icon: "◫", title: "System Monitor", group: "Hệ thống" },
    { id: "hash", icon: "#", title: "Hash Tools", group: "Bảo mật" },
    { id: "encryption", icon: "◇", title: "Encryption", group: "Bảo mật" },
    { id: "url", icon: "↗", title: "URL Tools", group: "Mạng & API" },
    { id: "qr-barcode", icon: "▦", title: "QR & Barcode", group: "Dữ liệu" },
    { id: "api", icon: "⇆", title: "API Tester", group: "Mạng & API" },
    { id: "image", icon: "▧", title: "Image Tools", group: "Thiết kế" },
    { id: "sql", icon: "DB", title: "SQL Tools", group: "Mã nguồn" },
    { id: "markdown", icon: "M", title: "Markdown", group: "Mã nguồn" },
    { id: "cron", icon: "◴", title: "Cron", group: "Mã nguồn" },
    { id: "network", icon: "◎", title: "DNS / IP", group: "Mạng & API" }
  ];
  const groups = [
    { id: "home", label: "Trang chủ", icon: "⌂", accent: "#62e9f2", route: "/home", items: ["command-center"] },
    { id: "create", label: "Sáng tạo", icon: "✦", accent: "#ff5dc8", route: "/create", items: ["ai-center", "creator-studio", "media-center", "ai-automation"] },
    { id: "media-design", label: "Media & Design", icon: "◈", accent: "#c87cff", route: "/media-design", items: [], studioItems: mediaStudioItems },
    { id: "dev", label: "DEV", icon: "⌘", accent: "#61e7ff", route: "/dev-tools", items: [], studioItems: developerToolItems },
    { id: "work", label: "Công việc", icon: "□", accent: "#baf46b", route: "/work", items: ["project-center", "cloud-storage", "download-center", "knowledge-center", "store", "wishlist-compare", "team-collaboration", "form-builder", "workflow-automation"] },
    {
      id: "communication",
      label: "Giao tiếp",
      icon: "◌",
      accent: "#5ee8d7",
      route: "/communication",
      items: ["community", "notification-center", "user-dashboard", "feedback-survey", "helpdesk-ticketing", "referral-affiliate"],
      shortcuts: [{ label: "Google + YouTube", icon: "G", tab: "google" }]
    },
    { id: "entertainment", label: "Giải trí", icon: "◉", accent: "#ff8a5b", route: "/entertainment", items: [], pages: [{ id: "astra-hh", title: "ASTRA HH", route: "/entertainment/astra-hh" }] },
    { id: "insights", label: "Phân tích", icon: "↗", accent: "#ffbd69", route: "/analytics", items: ["analytics", "smart-search", "admin-panel", "api-center", "developer-hub", "security-center", "status-page", "feature-flag-dashboard"] },
    { id: "learn", label: "Học tập", icon: "◫", accent: "#9a86ff", route: "/learn", items: ["learning-center", "i18n", "accessibility-center", "gamification", "onboarding-tour"] },
    { id: "english", label: "HH English", icon: "E", accent: "#60e9f2", route: "/english", items: [], pages: [{ id: "english-home", title: "Tổng quan", route: "/english" }, { id: "english-plan", title: "Kế hoạch hôm nay", route: "/english/plan" }, { id: "english-learn", title: "Lộ trình A0-C2", route: "/english/learn" }, { id: "english-career", title: "Tiếng Anh chuyên ngành", route: "/english/career" }, { id: "english-survey", title: "Khảo sát nghề nghiệp", route: "/english/survey" }, { id: "english-placement", title: "Kiểm tra xếp lớp", route: "/english/placement" }, { id: "english-vocabulary", title: "Sổ từ vựng", route: "/english/vocabulary" }, { id: "english-speaking", title: "Phát âm", route: "/english/speaking" }, { id: "english-writing", title: "Luyện viết", route: "/english/writing" }, { id: "english-progress", title: "Tiến độ", route: "/english/progress" }] },
    { id: "system", label: "Hệ thống", icon: "⚙", accent: "#68dda8", route: "/system", items: ["app-launcher", "widgets-engine", "marketplace", "mobile-pwa", "modern-ui-kit", "cookie-consent-manager", "data-export-import"] },
    { id: "support", label: "Ủng hộ nhà phát triển", icon: "♥", accent: "#ff6fae", route: "/support", items: [] }
  ];
  let activeRoute = "";
  const sidebarGroupState = (() => {
    try { return JSON.parse(localStorage.getItem("hh.sidebar.groups.v1") || "{}"); } catch { return {}; }
  })();
  const saveSidebarGroups = () => localStorage.setItem("hh.sidebar.groups.v1", JSON.stringify(sidebarGroupState));

  const moduleList = () => Array.isArray(window.HH_PLATFORM_MODULES) ? window.HH_PLATFORM_MODULES : [];
  const moduleById = (id) => moduleList().find((item) => item.id === id);
  const routeForModule = (id) => {
    const group = groups.find((item) => item.items.includes(id));
    return `${group?.route || "/tools"}/${id}`;
  };
  const userName = () => {
    try { return JSON.parse(localStorage.getItem("hh-auth-user") || "{}").name || "Tài khoản"; } catch { return "Tài khoản"; }
  };
  const isUnlocked = () => localShellPreview || document.body.classList.contains("auth-unlocked");
  const setShellVisibility = () => {
    const unlocked = isUnlocked();
    if (localShellPreview) {
      document.body.classList.add("auth-unlocked");
      document.body.classList.remove("auth-locked");
    }
    shell.hidden = !unlocked;
    document.body.classList.toggle("app-shell-enabled", unlocked);
    if (unlocked) renderRoute();
  };
  const setUser = () => {
    const name = userName();
    const initials = name.split(/\s+/).filter(Boolean).slice(-2).map((part) => part[0]).join("").toUpperCase() || "HH";
    const values = {
      shellUserName: name,
      shellUserInitials: initials,
      shellMenuName: name,
      shellMenuInitials: initials,
      dashboardGreeting: `Chào mừng trở lại, ${name}`
    };
    Object.entries(values).forEach(([id, value]) => {
      const target = byId(id);
      if (target) target.textContent = value;
    });
  };
  const renderNavigation = () => {
    const route = activeRoute;
    navigation.innerHTML = groups.map((group) => {
      const routeMatches = route === group.route || route.startsWith(`${group.route}/`);
      const expanded = Object.hasOwn(sidebarGroupState, group.id) ? Boolean(sidebarGroupState[group.id]) : routeMatches;
      const moduleItems = group.items.map((id) => {
        const module = moduleById(id);
        if (!module) return "";
        const moduleRoute = routeForModule(id);
        return `<button class="app-sidebar__subitem ${route === moduleRoute ? "is-active" : ""}" type="button" data-app-route="${moduleRoute}" ${route === moduleRoute ? "aria-current=page" : ""}><span>${module.title}</span></button>`;
      }).join("");
      const shortcuts = (group.shortcuts || []).map((item) => `<button class="app-sidebar__subitem app-sidebar__subitem--search" type="button" data-search-watch-open="${item.tab}" title="${item.label}"><b>${item.icon}</b><span>${item.label}</span><i>↗</i></button>`).join("");
      const pageItems = (group.pages || []).map((item) => `<button class="app-sidebar__subitem ${route === item.route ? "is-active" : ""}" type="button" data-app-route="${item.route}" ${route === item.route ? "aria-current=page" : ""}><span>${item.title}</span></button>`).join("");
      const studioMenu = group.studioItems ? `<div class="app-sidebar__studio" data-studio-kind="${group.id}"><label><span>⌕</span><input type="search" data-media-sidebar-search placeholder="Tìm công cụ..."></label><div data-media-sidebar-list>${[...new Set(group.studioItems.map((item) => item.group))].map((studioGroup, groupIndex) => `<section data-media-sidebar-group data-studio-category="${groupIndex}"><small>${studioGroup}<b>${group.studioItems.filter((item) => item.group === studioGroup).length}</b></small>${group.studioItems.filter((item) => item.group === studioGroup).map((item) => { const itemRoute = `${group.route}/${item.id}`; return `<button class="app-sidebar__studio-item ${route === itemRoute ? "is-active" : ""}" type="button" data-app-route="${itemRoute}" data-media-sidebar-item="${item.title.toLowerCase()}" data-studio-tool="${item.id}"><span aria-hidden="true">${item.icon}</span><b>${item.title}</b></button>`; }).join("")}</section>`).join("")}</div></div>` : "";
      const submenu = `${shortcuts}${pageItems}${studioMenu}${moduleItems}`;
      const hasSubmenu = Boolean(submenu);
      return `<section class="app-sidebar__group ${expanded ? "is-expanded" : ""}" data-nav-group="${group.id}" style="--nav-accent:${group.accent || "#56eaff"}">
        <button class="app-sidebar__item ${routeMatches ? "is-active" : ""}" type="button" data-app-route="${group.route}" ${routeMatches ? "aria-current=page" : ""} ${hasSubmenu ? `aria-expanded="${expanded}"` : ""} title="Mở ${group.label}"><span>${group.icon}</span><b>${group.label}</b><i ${hasSubmenu ? `data-sidebar-toggle title="Mở hoặc thu gọn ${group.label}"` : ""} aria-hidden="true">${hasSubmenu ? "›" : ""}</i></button>
        ${hasSubmenu ? `<div class="app-sidebar__submenu">${submenu}</div>` : ""}
      </section>`;
    }).join("");
  };
  navigation.addEventListener("input", (event) => {
    if (!event.target.matches("[data-media-sidebar-search]")) return;
    const query = event.target.value.trim().toLowerCase(), studio = event.target.closest(".app-sidebar__studio");
    studio?.querySelectorAll("[data-media-sidebar-item]").forEach((item) => { item.hidden = Boolean(query) && !item.dataset.mediaSidebarItem.includes(query); });
    studio?.querySelectorAll("[data-media-sidebar-group]").forEach((group) => { group.hidden = !group.querySelector("[data-media-sidebar-item]:not([hidden])"); });
  });
  const updateDashboard = () => {
    const modules = moduleList();
    const localStorageBytes = Array.from({ length: localStorage.length }, (_, index) => localStorage.key(index)).filter(Boolean).reduce((total, key) => total + ((key.length + (localStorage.getItem(key)?.length || 0)) * 2), 0);
    const favorites = (() => { try { return JSON.parse(localStorage.getItem("hh-module-favorites") || "[]"); } catch { return []; } })();
    const recent = (() => { try { return JSON.parse(localStorage.getItem("hh.app-shell.recent") || "[]"); } catch { return []; } })();
    const recentItems = (recent.length ? recent : ["ai-center", "project-center", "media-center"]).map(moduleById).filter(Boolean);
    const recommended = (favorites.length ? favorites : ["ai-center", "creator-studio", "ai-automation"]).map(moduleById).filter(Boolean);
    const makeItem = (item) => `<button type="button" data-app-route="${routeForModule(item.id)}"><span>${item.group === "core" ? "Tool" : "More"}</span><strong>${item.title}</strong><small>${item.description}</small><b>›</b></button>`;
    const recentWork = byId("dashboardRecentWork");
    const recommendedList = byId("dashboardRecommended");
    if (recentWork) recentWork.innerHTML = recentItems.map(makeItem).join("") || "<p>Chưa có công việc gần đây.</p>";
    if (recommendedList) recommendedList.innerHTML = recommended.map(makeItem).join("") || modules.slice(0, 3).map(makeItem).join("");
    const metrics = {
      dashboardModuleCount: modules.length,
      dashboardFavoriteCount: favorites.length,
      dashboardRecentCount: recent.length,
      dashboardStorage: localStorageBytes < 1024 * 1024 ? `${(localStorageBytes / 1024).toFixed(1)} KB` : `${(localStorageBytes / 1024 / 1024).toFixed(1)} MB`,
      dashboardNetwork: navigator.onLine ? "ONLINE" : "OFFLINE"
    };
    Object.entries(metrics).forEach(([id, value]) => { const node = byId(id); if (node) node.textContent = value; });
  };

  const quickNote = byId("dashboardQuickNote");
  if (quickNote) {
    quickNote.value = localStorage.getItem("hh.dashboard.quick-note") || "";
    quickNote.addEventListener("input", () => {
      localStorage.setItem("hh.dashboard.quick-note", quickNote.value);
      const status = byId("dashboardQuickNoteStatus");
      if (status) status.textContent = `Đã lưu lúc ${new Date().toLocaleTimeString("vi-VN")}`;
    });
  }
  dashboardHome.addEventListener("click", (event) => {
    if (event.target.closest(".dashboard-dev-button")) document.querySelector(".feature-lab-open")?.click();
    if (event.target.closest("[data-dashboard-clear-note]")) {
      if (quickNote) quickNote.value = "";
      localStorage.removeItem("hh.dashboard.quick-note");
      const status = byId("dashboardQuickNoteStatus"); if (status) status.textContent = "Đã xóa ghi chú";
    }
  });
  addEventListener("online", updateDashboard);
  addEventListener("offline", updateDashboard);
  const mountPlatform = (activeModuleId = "") => {
    window.dispatchEvent(new CustomEvent("hh:workspace-open"));
    workspace.replaceChildren(platform);
    platform.hidden = false;
    platform.classList.add("app-workspace__platform");
    document.querySelectorAll("#moduleGrid [data-module-id]").forEach((card) => {
      card.hidden = Boolean(activeModuleId) && card.dataset.moduleId !== activeModuleId;
      card.toggleAttribute("data-shell-active", card.dataset.moduleId === activeModuleId);
    });
    if (activeModuleId) {
      requestAnimationFrame(() => {
        const main = document.querySelector(".app-main");
        if (main) main.scrollTop = 0;
        window.scrollTo(0, 0);
      });
    }
  };
  const mountSimpleView = (title, description, content) => {
    workspace.innerHTML = `<section class="app-simple-view"><div class="app-simple-view__intro"><p class="section-kicker">HH Platform</p><h2>${title}</h2><p>${description}</p></div>${content}</section>`;
  };
  const mountCommunicationSearch = () => {
    const launcher = document.createElement("section");
    launcher.className = "communication-search-launcher";
    launcher.setAttribute("aria-label", "Google và YouTube trong HH Platform");
    launcher.innerHTML = `<div class="communication-search-launcher__copy"><span>Mạng xã hội & khám phá</span><h2>Google + YouTube</h2><p>Tìm website, hình ảnh và video hoặc dán liên kết YouTube để xem ngay trong HH Platform.</p></div><div class="communication-search-launcher__actions"><button type="button" data-search-watch-open="google"><b>G</b><span>Tìm với Google</span></button><button type="button" data-search-watch-open="youtube"><b>▶</b><span>Mở YouTube</span></button></div>`;
    workspace.insertBefore(launcher, platform);
  };
  const remember = (moduleId) => {
    if (!moduleId) return;
    let recent = [];
    try { recent = JSON.parse(localStorage.getItem("hh.app-shell.recent") || "[]"); } catch {}
    localStorage.setItem("hh.app-shell.recent", JSON.stringify([moduleId, ...recent.filter((id) => id !== moduleId)].slice(0, 8)));
  };
  const updatePageHeader = (title, description, route, module) => {
    pageHeader.querySelector("h1").textContent = title;
    pageHeader.querySelector("p:not(.app-page-header__eyebrow)").textContent = description;
    const crumbs = route.split("/").filter(Boolean);
      breadcrumb.innerHTML = [`<button type="button" data-app-route="/home">Trang chủ</button>`, ...crumbs.map((crumb, index) => `<span>›</span><button type="button" ${index === crumbs.length - 1 ? "aria-current=page" : ""}>${module?.title || [...mediaStudioItems, ...developerToolItems].find((item) => item.id === crumb)?.title || ({ create: "Sáng tạo", "media-design": "Media & Design", "dev-tools": "DEV", work: "Công việc", communication: "Giao tiếp", entertainment: "Giải trí", "astra-hh": "ASTRA HH", analytics: "Phân tích", learn: "Học tập", english: "HH English", plan: "Kế hoạch hôm nay", career: "Tiếng Anh chuyên ngành", survey: "Khảo sát nghề nghiệp", placement: "Kiểm tra xếp lớp", vocabulary: "Sổ từ vựng", speaking: "Phát âm", writing: "Luyện viết", progress: "Tiến độ", tools: "Công cụ", settings: "Cài đặt", support: "Ủng hộ nhà phát triển" }[crumb] || crumb)}</button>`)].join("");
    pageActions.innerHTML = module ? `<button type="button" data-app-route="/tools">Tất cả công cụ</button><button class="app-primary-action" type="button" data-shell-favorite="${module.id}">☆ Yêu thích</button>` : "";
  };
  const renderRoute = () => {
    if (!isUnlocked()) return;
    const hash = location.hash.replace(/^#/, "") || "/home";
    const route = hash === "top" || hash === "account" ? "/home" : (hash.startsWith("/") ? hash : `/${hash}`);
    activeRoute = route;
    document.body.classList.toggle("app-media-design-route", route === "/media-design" || route.startsWith("/media-design/"));
    document.body.classList.toggle("app-dev-tools-route", route === "/dev-tools" || route.startsWith("/dev-tools/"));
    document.body.classList.toggle("app-entertainment-route", route === "/entertainment" || route.startsWith("/entertainment/"));
    document.body.classList.toggle("app-english-route", route === "/english" || route.startsWith("/english/"));
    if (route !== "/dev-tools" && !route.startsWith("/dev-tools/")) window.HHDeveloperTools?.cleanup?.();
    if (route !== "/entertainment" && !route.startsWith("/entertainment/")) window.HHSpaceExplorer?.unmount?.();
    if (route !== "/english" && !route.startsWith("/english/")) window.HHEnglish?.unmount?.();
    setUser();
    renderNavigation();
    requestAnimationFrame(() => {
      const sidebar = navigation.closest(".app-sidebar");
      const activeItem = navigation.querySelector(".app-sidebar__item.is-active");
      if (!sidebar || !activeItem) return;
      if (route === "/home") sidebar.scrollTo({ top: 0, behavior: "smooth" });
      else activeItem.scrollIntoView({ block: "nearest", behavior: "smooth" });
    });
    updateMobileNavigation();
    const parts = route.split("/").filter(Boolean);
    const possibleId = parts.at(-1);
    const module = moduleById(possibleId);
    document.body.classList.toggle("app-single-module", Boolean(module));
    if (route === "/home") {
      updatePageHeader("Trang chủ", "Bắt đầu với các công cụ phù hợp cho công việc của bạn.", route);
      workspace.replaceChildren(dashboardHome);
      updateDashboard();
    } else if (route === "/support") {
      updatePageHeader("Ủng hộ nhà phát triển", "Đóng góp minh bạch để duy trì máy chủ và phát triển các công cụ HH.", route);
      workspace.innerHTML = "";
      if (window.HHSupportPage?.mount) window.HHSupportPage.mount(workspace, { apiBase: REALTIME_URL });
      else mountSimpleView("Ủng hộ nhà phát triển", "Không thể tải giao diện ủng hộ. Vui lòng làm mới trang.", "");
    } else if (route === "/entertainment" || route === "/entertainment/astra-hh") {
      updatePageHeader("ASTRA HH: Tín Hiệu Vô Tận", "Lái tàu, quét ngoại hành tinh, khai thác tài nguyên và truy tìm nguồn phát HH-13.", route);
      workspace.innerHTML = '<div data-space-explorer-host></div>';
      if (window.HHSpaceExplorer?.mount) window.HHSpaceExplorer.mount(workspace.firstElementChild, { apiBase: REALTIME_URL });
      else mountSimpleView("ASTRA HH", "Đang khởi động động cơ khám phá vũ trụ...", "");
    } else if (route === "/english" || route.startsWith("/english/")) {
      updatePageHeader("HH English", "Học miễn phí từ A0 đến C2 với 64 lộ trình nghề nghiệp và bài học tự đổi theo từng người.", route);
      workspace.innerHTML = '<div data-hh-english-host></div>';
      if (window.HHEnglish?.mount) window.HHEnglish.mount(workspace.firstElementChild, { view: parts[1] || "dashboard" });
      else mountSimpleView("HH English", "Đang tải không gian học tiếng Anh...", "");
    } else if (route === "/media-design" || route.startsWith("/media-design/")) {
      updatePageHeader("Media & Design", "Studio sáng tạo xử lý ảnh, tài liệu, màu sắc và vector ngay trên thiết bị.", route);
      workspace.innerHTML = '<div data-media-design-page-host></div>';
      const mediaHost = workspace.firstElementChild;
      mediaHost.dataset.mediaDesignTool = parts[1] || "";
      window.HHMediaDesignPage?.mount(mediaHost, { toolId: parts[1] || "" });
    } else if (route === "/dev-tools" || route.startsWith("/dev-tools/")) {
      updatePageHeader("Developer Toolbox", "Bộ công cụ dữ liệu, bảo mật, văn bản, API và hệ thống dành cho developer.", route);
      workspace.innerHTML = '<div data-developer-tools-host></div>';
      window.HHDeveloperTools?.mount(workspace.firstElementChild, { toolId: parts[1] || "json" });
    } else if (module) {
      updatePageHeader(module.title, module.description, route, module);
      mountPlatform(module.id);
      remember(module.id);
    } else if (route === "/tools" || groups.some((group) => group.route === route)) {
      const allowed = route === "/tools" ? "" : groups.find((group) => group.route === route)?.items || "";
      updatePageHeader(route === "/tools" ? "Tất cả công cụ" : groups.find((group) => group.route === route)?.label || "Công cụ", "Chọn một module để mở thành trang làm việc riêng.", route);
      mountPlatform("");
      if (route === "/communication") {
        mountCommunicationSearch();
        pageActions.innerHTML = `<button class="app-primary-action" type="button" data-search-watch-open="google">Google + YouTube</button>`;
      }
      if (Array.isArray(allowed)) document.querySelectorAll("#moduleGrid [data-module-id]").forEach((card) => { card.hidden = !allowed.includes(card.dataset.moduleId); });
    } else if (route === "/favorites" || route === "/recent") {
      const key = route === "/favorites" ? "hh-module-favorites" : "hh.app-shell.recent";
      const ids = (() => { try { return JSON.parse(localStorage.getItem(key) || "[]"); } catch { return []; } })();
      const label = route === "/favorites" ? "Yêu thích" : "Gần đây";
      updatePageHeader(label, `Các công cụ ${route === "/favorites" ? "đã lưu" : "vừa sử dụng"} của bạn.`, route);
      mountSimpleView(label, "Mở một mục để tiếp tục công việc.", `<div class="app-item-grid">${ids.map(moduleById).filter(Boolean).map((item) => `<button type="button" data-app-route="${routeForModule(item.id)}"><span>Tool</span><strong>${item.title}</strong><p>${item.description}</p></button>`).join("") || "<div class=app-empty-state><strong>Chưa có mục nào</strong><p>Hãy đánh dấu yêu thích hoặc mở một công cụ để xem tại đây.</p><button type=button data-app-route=/tools>Mở công cụ</button></div>"}</div>`);
    } else if (route === "/settings") {
      updatePageHeader("Cài đặt", "Điều chỉnh giao diện và dữ liệu cá nhân.", route);
      mountSimpleView("Cài đặt", "Các thiết lập cơ bản được lưu trên thiết bị này.", `<div class="app-settings-list"><label><span>Sidebar thu gọn</span><input type=checkbox data-shell-setting=collapsed ${document.body.classList.contains("app-sidebar-collapsed") ? "checked" : ""}></label><label><span>Chế độ nâng cao</span><input type=checkbox data-shell-setting=advanced ${stored().advanced ? "checked" : ""}></label><button type=button data-app-route=/settings/user-dashboard>Mở hồ sơ tài khoản</button><button type=button data-app-route=/settings/security-center>Mở bảo mật</button></div>`);
    } else if (route === "/profile") {
      updatePageHeader("Profile", "Trang portfolio và thông tin liên hệ.", route);
      mountSimpleView("Profile", "Mở portfolio gốc trong trang này.", `<button class="app-primary-action" type=button data-shell-show-profile>Mở portfolio</button>`);
    } else {
      updatePageHeader("Không tìm thấy trang", "Route này chưa có workspace tương ứng.", route);
      mountSimpleView("Không tìm thấy trang", "Hãy quay lại dashboard hoặc dùng tìm kiếm toàn hệ thống.", `<button type=button data-app-route=/home>Về trang chủ</button>`);
    }
    document.title = `${pageHeader.querySelector("h1").textContent} | HH Platform`;
    workspace.scrollTop = 0;
    requestAnimationFrame(() => {
      document.querySelector(".app-main")?.scrollTo({ top: 0, left: 0, behavior: "auto" });
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    });
    legacyMain.hidden = true;
  };
  const searchItems = () => {
    const modules = moduleList().map((item) => ({ type: "Công cụ", title: item.title, description: item.description, route: routeForModule(item.id), key: `${item.title} ${item.description} ${(item.features || []).join(" ")}` }));
    const commandCenter = window.HHCommandCenter?.searchItems?.() || [];
    const developerTools = developerToolItems.map((item) => ({ type: "DEV", title: item.title, description: item.group, route: `/dev-tools/${item.id}`, key: `${item.title} ${item.group} developer toolbox` }));
    return [...modules, ...commandCenter, ...developerTools, { type: "Học tập", title: "HH English", description: "517 bài tiếng Anh miễn phí A0-C2, Smart Start và 64 lộ trình chuyên ngành tự thích ứng theo vai trò, kỹ năng, độ khó.", route: "/english", key: "hh english tiếng anh ngoại ngữ a0 a1 a2 b1 b2 c1 c2 cefr smart start người mới kế hoạch hôm nay cá nhân hóa chuyên ngành nghề nghiệp khảo sát từ vựng phát âm speaking writing placement career business technology healthcare education tourism engineering cloud fintech veterinary film audio" }, { type: "Game", title: "ASTRA HH: Tín Hiệu Vô Tận", description: "Game khám phá vũ trụ, quét hành tinh, nâng cấp tàu và bảng xếp hạng online.", route: "/entertainment/astra-hh", key: "giải trí game astra hh vũ trụ phi thuyền hành tinh khám phá space explorer" }, { type: "Studio", title: "Media & Design", description: "20 công cụ xử lý ảnh, video, PDF, QR, thương hiệu và xuất bản mạng xã hội.", route: "/media-design", key: "media design creative studio photo editor photoshop video editor premiere timeline background remover collage image pdf qr svg color typography compressor converter social post brand kit favicon meme" }, { type: "Developer", title: "Developer Toolbox", description: "22 công cụ JSON, Base64, Regex, Hash, API, SQL, Markdown, Cron và hệ thống.", route: "/dev-tools", key: "developer dev toolbox json base64 uuid token password timestamp regex text compare calculator hash encryption url qr api image sql markdown cron dns ip" }, { type: "Ủng hộ", title: "Ủng hộ nhà phát triển", description: "Quét QR, gửi lời nhắn và theo dõi số tiền đã xác nhận.", route: "/support", key: "ủng hộ donate nhà phát triển quét qr vietcombank" }, { type: "Hướng dẫn", title: "Bắt đầu sử dụng", description: "Lộ trình dành cho người mới.", route: "/learn/learning-center", key: "bắt đầu hướng dẫn học" }, { type: "Cài đặt", title: "Cài đặt tài khoản", description: "Hồ sơ, giao diện và quyền riêng tư.", route: "/settings", key: "cài đặt tài khoản profile" }];
  };
  const renderPalette = (query = "") => {
    const normalized = query.trim().toLowerCase();
    const results = searchItems().filter((item) => !normalized || item.key.toLowerCase().includes(normalized)).slice(0, 12);
    paletteResults.innerHTML = results.length ? results.map((item, index) => `<button type="button" role="option" aria-selected="${index === 0}" class="${index === 0 ? "is-selected" : ""}" ${item.action ? `data-command-action="${item.action}"` : `data-app-route="${item.route}"`}><span>${item.type}</span><div><strong>${item.title}</strong><small>${item.description}</small></div><b>↵</b></button>`).join("") : "<p>Không tìm thấy công cụ hoặc hướng dẫn phù hợp.</p>";
  };
  const openPalette = () => { palette.showModal(); renderPalette(); requestAnimationFrame(() => paletteInput.focus()); };
  const closePalette = () => palette.open && palette.close();
  let drawerTrigger = null;
  const closeOverlays = ({ restoreFocus = true } = {}) => {
    [notificationDrawer, helpDrawer].forEach((drawer) => {
      drawer?.classList.remove("is-open");
      drawer?.setAttribute("aria-hidden", "true");
    });
    userMenu?.classList.remove("is-open");
    userMenu?.setAttribute("aria-hidden", "true");
    document.querySelectorAll("[data-notification-toggle], [data-help-toggle], [data-user-menu-toggle]").forEach((button) => button.setAttribute("aria-expanded", "false"));
    if (drawerBackdrop) drawerBackdrop.hidden = true;
    if (restoreFocus) drawerTrigger?.focus();
    drawerTrigger = null;
  };
  const openDrawer = (drawer, trigger) => {
    closeOverlays({ restoreFocus: false });
    drawerTrigger = trigger;
    drawer?.classList.add("is-open");
    drawer?.setAttribute("aria-hidden", "false");
    trigger?.setAttribute("aria-expanded", "true");
    if (drawerBackdrop) drawerBackdrop.hidden = false;
    requestAnimationFrame(() => drawer?.querySelector("button, input")?.focus());
  };
  const toggleUserMenu = (trigger) => {
    const opening = !userMenu?.classList.contains("is-open");
    closeOverlays({ restoreFocus: false });
    if (!opening || !userMenu) return;
    drawerTrigger = trigger;
    userMenu.classList.add("is-open");
    userMenu.setAttribute("aria-hidden", "false");
    trigger?.setAttribute("aria-expanded", "true");
    requestAnimationFrame(() => userMenu.querySelector("[role=menuitem]")?.focus());
  };
  const updateMobileNavigation = () => {
    document.querySelectorAll(".app-mobile-nav [data-app-route]").forEach((button) => {
      const target = button.dataset.appRoute;
      const active = target === "/home" ? activeRoute === target : activeRoute === target || activeRoute.startsWith(`${target}/`);
      button.classList.toggle("is-active", active);
      if (active) button.setAttribute("aria-current", "page"); else button.removeAttribute("aria-current");
    });
  };

  document.addEventListener("click", (event) => {
    const commandAction = event.target.closest("[data-command-action]");
    if (commandAction) {
      window.HHCommandCenter?.runAction?.(commandAction.dataset.commandAction);
      closePalette();
      return;
    }
    const routeButton = event.target.closest("[data-app-route]");
    if (routeButton) {
      const route = routeButton.dataset.appRoute;
      const sidebarGroup = routeButton.parentElement?.classList.contains("app-sidebar__group") ? routeButton.parentElement : null;
      if (sidebarGroup?.querySelector(":scope > .app-sidebar__submenu") && event.target.closest("[data-sidebar-toggle]")) {
        const group = groups.find((item) => item.route === route);
        if (group) {
          sidebarGroupState[group.id] = !sidebarGroup.classList.contains("is-expanded");
          saveSidebarGroups();
          renderNavigation();
          return;
        }
      }
      if (route) {
        const targetGroup = groups.find((item) => route === item.route || route.startsWith(`${item.route}/`));
        if (targetGroup) { sidebarGroupState[targetGroup.id] = true; saveSidebarGroups(); }
        const nextHash = `#${route}`;
        if (location.hash === nextHash) renderRoute(); else location.hash = nextHash;
        if (mobileSidebarQuery.matches) {
          document.body.classList.add("app-sidebar-collapsed");
        }
        closePalette();
        closeOverlays({ restoreFocus: false });
      }
      return;
    }
    const toggle = event.target.closest("[data-shell-toggle]");
    if (toggle) {
      const collapsed = !document.body.classList.contains("app-sidebar-collapsed");
      document.body.classList.toggle("app-sidebar-collapsed", collapsed);
      toggle.setAttribute("aria-expanded", String(!collapsed));
      if (!mobileSidebarQuery.matches) saveState({ collapsed });
      return;
    }
    if (event.target.closest("[data-command-open]")) { openPalette(); return; }
    const notificationToggle = event.target.closest("[data-notification-toggle]");
    if (notificationToggle) { openDrawer(notificationDrawer, notificationToggle); return; }
    const helpToggle = event.target.closest("[data-help-toggle]");
    if (helpToggle) { openDrawer(helpDrawer, helpToggle); return; }
    const userToggle = event.target.closest("[data-user-menu-toggle]");
    if (userToggle) { toggleUserMenu(userToggle); return; }
    if (event.target.closest("[data-drawer-close]")) { closeOverlays(); return; }
    if (event.target.closest("[data-shell-logout]")) {
      closeOverlays({ restoreFocus: false });
      byId("logoutButton")?.click();
      return;
    }
    const favorite = event.target.closest("[data-shell-favorite]");
    if (favorite) {
      let favorites = [];
      try { favorites = JSON.parse(localStorage.getItem("hh-module-favorites") || "[]"); } catch {}
      const id = favorite.dataset.shellFavorite;
      const enabled = !favorites.includes(id);
      localStorage.setItem("hh-module-favorites", JSON.stringify(enabled ? [...favorites, id] : favorites.filter((item) => item !== id)));
      favorite.textContent = enabled ? "★ Đã yêu thích" : "☆ Yêu thích";
      return;
    }
    if (event.target.closest("[data-shell-show-profile]")) {
      shell.hidden = true;
      document.body.classList.remove("app-shell-enabled");
      legacyMain.hidden = false;
      platform.hidden = false;
      history.replaceState(null, "", `${location.pathname}${location.search}#about`);
      requestAnimationFrame(() => document.querySelector("#about")?.scrollIntoView({ behavior: "smooth", block: "start" }));
      return;
    }
    if (userMenu?.classList.contains("is-open") && !event.target.closest("#appUserMenu")) closeOverlays({ restoreFocus: false });
  });
  document.addEventListener("change", (event) => {
    const setting = event.target.closest("[data-shell-setting]");
    if (!setting) return;
    const next = { [setting.dataset.shellSetting]: setting.checked };
    saveState(next);
    if (setting.dataset.shellSetting === "collapsed") document.body.classList.toggle("app-sidebar-collapsed", setting.checked);
    if (setting.dataset.shellSetting === "advanced") document.body.classList.toggle("app-advanced-mode", setting.checked);
  });
  document.addEventListener("keydown", (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") { event.preventDefault(); openPalette(); }
    if (event.key === "Escape") { closePalette(); closeOverlays(); }
    if (palette?.open && ["ArrowDown", "ArrowUp", "Enter"].includes(event.key)) {
      const options = [...paletteResults.querySelectorAll("[role=option]")];
      if (!options.length) return;
      event.preventDefault();
      const current = Math.max(0, options.findIndex((option) => option.classList.contains("is-selected")));
      const next = event.key === "ArrowDown" ? (current + 1) % options.length : event.key === "ArrowUp" ? (current - 1 + options.length) % options.length : current;
      options.forEach((option, index) => {
        option.classList.toggle("is-selected", index === next);
        option.setAttribute("aria-selected", String(index === next));
      });
      if (event.key === "Enter") options[current].click(); else options[next].scrollIntoView({ block: "nearest" });
    }
  });
  paletteInput?.addEventListener("input", () => renderPalette(paletteInput.value));
  window.addEventListener("hashchange", renderRoute);
  window.addEventListener("hh:modules-ready", () => {
    renderNavigation();
    renderRoute();
  });
  window.addEventListener("hh:developer-tools-ready", renderRoute);
  window.addEventListener("hh:space-explorer-ready", renderRoute);
  window.addEventListener("hh:auth-change", () => { setShellVisibility(); setUser(); });
  const initial = stored();
  const syncResponsiveSidebar = (isMobile = mobileSidebarQuery.matches) => {
    document.body.classList.toggle("app-sidebar-collapsed", isMobile || Boolean(stored().collapsed));
    document.querySelectorAll("[data-shell-toggle]").forEach((button) => button.setAttribute("aria-expanded", String(!document.body.classList.contains("app-sidebar-collapsed"))));
  };
  syncResponsiveSidebar();
  if (mobileSidebarQuery.addEventListener) mobileSidebarQuery.addEventListener("change", (event) => syncResponsiveSidebar(event.matches));
  else mobileSidebarQuery.addListener((event) => syncResponsiveSidebar(event.matches));
  document.body.classList.toggle("app-advanced-mode", Boolean(initial.advanced));
  const updateClock = () => {
    const clock = byId("shellClock");
    const date = byId("shellDate");
    if (clock) clock.textContent = new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
    if (date) date.textContent = new Date().toLocaleDateString("vi-VN", { weekday: "long", day: "2-digit", month: "2-digit" });
  };
  updateClock();
  setInterval(updateClock, 60000);
  setShellVisibility();
}

// The platform workspaces create thousands of DOM nodes.  They used to be
// rendered behind the sign-in gate, which made the first visit feel frozen on
// desktop computers.  Start optional, authenticated features only after a
// verified session is available.
function initPlatformOnDemand(initializer) {
  let initialized = false;
  const start = () => {
    if (initialized) return;
    initialized = true;
    initializer();
  };
  window.addEventListener("hh:workspace-open", start);
  window.addEventListener("hh:auth-change", (event) => {
    if (event.detail?.user && event.detail?.token) start();
  });
}

resizeCanvas();
updateScrollMeter();
initReveal();
initTheme();
initVoteStats();
initPublicPresence();
initRealtimeAuth();
initAppShell();
initPlatformOnDemand(() => {
  drawParticles();
  initHomeNeonInteractions();
  initPlatformLivebar();
  initSuperPlatform();
  initCreatorWorkspace();
  initCommunityChatV2();
  initMusicPlayer();
  initMiniTabs();
  initTool();
});

window.addEventListener("resize", resizeCanvas);
window.addEventListener("scroll", updateScrollMeter, { passive: true });

