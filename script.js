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
  const googleLogin = byId("googleLogin");
  const facebookLogin = byId("facebookLogin");
  if (!status || !online || !note || !consent) return;

  let token = localStorage.getItem("hh-auth-token") || "";
  let user = null;
  const anonymousIdKey = "hh-anonymous-id";
  let anonymousId = localStorage.getItem(anonymousIdKey);
  if (!anonymousId) {
    anonymousId = randomId();
    localStorage.setItem(anonymousIdKey, anonymousId);
  }

  const params = new URLSearchParams(location.search);
  if (params.get("authToken")) {
    token = params.get("authToken");
    localStorage.setItem("hh-auth-token", token);
    history.replaceState({}, document.title, `${location.pathname}#account`);
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

  const setGateState = () => {
    const unlocked = Boolean(user && token);
    document.body.classList.toggle("auth-unlocked", unlocked);
    document.body.classList.toggle("auth-locked", !unlocked);
    gate?.setAttribute("aria-hidden", unlocked ? "true" : "false");
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

  const renderAuth = () => {
    if (user) {
      setStatus(`Đã đăng nhập: ${user.name || user.email}`);
    } else if (token && REALTIME_URL) {
      setStatus("Đang kiểm tra tài khoản...");
    } else {
      setStatus("Chưa đăng nhập");
    }
    note.textContent = REALTIME_URL
      ? "Realtime backend đã cấu hình. Tracking chỉ chạy khi người dùng đồng ý hoặc đăng nhập."
      : "Chưa cấu hình realtime backend. Sau khi deploy server, dán URL vào config.js.";
    if (REALTIME_URL && !REALTIME_URL.includes("vercel.app")) {
      googleLogin.href = `${REALTIME_URL}/api/auth/google`;
      facebookLogin.href = `${REALTIME_URL}/api/auth/facebook`;
      googleLogin.setAttribute("aria-disabled", "false");
      facebookLogin.setAttribute("aria-disabled", "false");
    } else {
      googleLogin.href = "#account";
      facebookLogin.href = "#account";
      googleLogin.setAttribute("aria-disabled", "true");
      facebookLogin.setAttribute("aria-disabled", "true");
    }
    persistAuthUser();
    setGateState();
  };

  const loadMe = async () => {
    if (!token || !REALTIME_URL) return renderAuth();
    try {
      const data = await api("/api/auth/me");
      user = data.user;
      if (!user) localStorage.removeItem("hh-auth-token");
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
    try {
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
      location.hash = "#top";
    } catch (error) {
      setStatus(error.message);
    }
  };

  const handleLogin = async (event, formNode) => {
    event.preventDefault();
    const form = new FormData(formNode);
    try {
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
      location.hash = "#top";
    } catch (error) {
      setStatus(error.message);
    }
  };

  registerForm?.addEventListener("submit", (event) => handleRegister(event, registerForm));
  gateRegisterForm?.addEventListener("submit", (event) => handleRegister(event, gateRegisterForm));
  loginForm?.addEventListener("submit", (event) => handleLogin(event, loginForm));
  gateLoginForm?.addEventListener("submit", (event) => handleLogin(event, gateLoginForm));

  document.querySelectorAll("[data-oauth-disabled]").forEach((button) => {
    button.addEventListener("click", () => setStatus("Google/Facebook OAuth cần cấu hình Client ID và callback backend trước khi dùng."));
  });

  logoutButton?.addEventListener("click", () => {
    token = "";
    user = null;
    localStorage.removeItem("hh-auth-token");
    localStorage.removeItem("hh-chat-last-name");
    renderAuth();
    connectSocket();
    location.hash = "";
  });

  let socket;
  const loadSocketClient = () => new Promise((resolve, reject) => {
    if (window.io) return resolve();
    if (!REALTIME_URL) return reject(new Error("No realtime URL"));
    const script = document.createElement("script");
    script.src = `${REALTIME_URL}/socket.io/socket.io.js`;
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });

  async function connectSocket() {
    if (socket) {
      socket.disconnect();
      socket = null;
    }
    if (!REALTIME_URL || (!token && !consent.checked)) {
      online.textContent = "0 đang online";
      return;
    }
    try {
      await loadSocketClient();
      socket = window.io(REALTIME_URL, {
        transports: ["websocket", "polling"],
        auth: {
          token,
          anonymousId,
          consent: consent.checked,
          page: location.pathname,
          referrer: document.referrer
        }
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
    window.open(`https://www.google.com/search?q=${encodeURIComponent(query)}`, "_blank", "noopener");
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
      return { ...fallback, ...JSON.parse(localStorage.getItem(commandCenterKey) || "{}") };
    } catch {
      return fallback;
    }
  };

  const writeCommandCenterState = (state) => localStorage.setItem(commandCenterKey, JSON.stringify(state));

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
    "wishlist-compare": { verb: "Tạo so sánh", subject: "compare list", sample: "So sánh bản Lite/Full, wishlist download và store.", metrics: ["Wishlist", "Compare", "Saved"], items: ["Lite", "Full", "Download"] }
  };

  const profileFor = (module) => moduleProfiles[module.id] || {
    verb: "Tạo mục",
    subject: module.title,
    sample: `Tạo dữ liệu mẫu cho ${module.title}.`,
    metrics: (module.features || []).slice(0, 3),
    items: (module.features || []).slice(0, 3)
  };

  const commandCenterMarkup = () => {
    const state = readCommandCenterState();
    return `
      <section class="command-center-app" data-command-center>
        <div class="command-hero">
          <div>
            <p class="section-kicker">Command Center 01</p>
            <h4>Trung tâm điều khiển cá nhân</h4>
            <span>Đồng hồ, thời tiết, ghi chú, todo, Google, trạng thái server và app yêu thích.</span>
          </div>
          <div class="command-clock">
            <strong data-command-time>--:--:--</strong>
            <span data-command-date>Đang đồng bộ...</span>
          </div>
        </div>
        <div class="command-grid">
          <article class="command-widget weather-widget">
            <header><strong>Thời tiết</strong><button class="interactive" type="button" data-command-weather>Tải mới</button></header>
            <div class="weather-readout" data-command-weather-output>Ấn "Tải mới" để xem thời tiết Hà Nội.</div>
          </article>
          <article class="command-widget">
            <header><strong>Google nhanh</strong><button class="interactive" type="button" data-command-google>Google</button></header>
            <input data-command-search type="search" placeholder="Tìm nhanh trên Google...">
            <div class="command-mini-links">
              <a href="https://mail.google.com/" target="_blank" rel="noopener">Gmail</a>
              <a href="https://drive.google.com/" target="_blank" rel="noopener">Drive</a>
              <a href="https://calendar.google.com/" target="_blank" rel="noopener">Calendar</a>
              <a href="https://news.google.com/topstories?hl=vi&gl=VN&ceid=VN:vi" target="_blank" rel="noopener">News</a>
            </div>
          </article>
          <article class="command-widget notes-widget">
            <header><strong>Notes</strong><button class="interactive" type="button" data-command-save-notes>Lưu</button></header>
            <textarea data-command-notes rows="6">${escapeHtml(state.notes || "")}</textarea>
          </article>
          <article class="command-widget todo-widget">
            <header><strong>Todo</strong><button class="interactive" type="button" data-command-add-todo>Thêm</button></header>
            <input data-command-todo-input type="text" placeholder="Nhập việc cần làm...">
            <div class="command-todo-list" data-command-todos>
              ${(state.todos || []).map((todo, index) => `
                <label>
                  <input type="checkbox" data-command-toggle-todo="${index}" ${todo.done ? "checked" : ""}>
                  <span>${escapeHtml(todo.text)}</span>
                  <button class="interactive" type="button" data-command-remove-todo="${index}">Xóa</button>
                </label>
              `).join("")}
            </div>
          </article>
          <article class="command-widget">
            <header><strong>Server Status</strong><button class="interactive" type="button" data-command-server>Kiểm tra</button></header>
            <div class="server-readout" data-command-server-output>Backend: chờ kiểm tra.</div>
          </article>
          <article class="command-widget">
            <header><strong>Recent Activity</strong><button class="interactive" type="button" data-command-clear-activity>Dọn</button></header>
            <div class="command-activity" data-command-activity>
              ${(state.activity || []).slice(0, 6).map((item) => `<p>${escapeHtml(item)}</p>`).join("") || "<p>Chưa có hoạt động.</p>"}
            </div>
          </article>
        </div>
      </section>
    `;
  };

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
            ${module.id === "command-center" ? commandCenterMarkup(module) : module.id === "download-center" ? downloadCenterMarkup(module) : moduleStudioMarkup(module)}
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

  grid.addEventListener("click", (event) => {
    const favoriteButton = event.target.closest("[data-module-fav]");
    if (favoriteButton) {
      toggleFavorite(favoriteButton.dataset.moduleFav);
      if (selectedModule?.id === favoriteButton.dataset.moduleFav) renderDetail(selectedModule);
      render();
      return;
    }

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
      renderDetail(module);
      if (actionMode) actionMode.value = featureButton.dataset.inlineFeature;
      const nextInput = `${featureButton.dataset.inlineFeature}: ${input?.value || profileFor(module).sample}`;
      if (input && !input.value.trim()) input.value = nextInput;
      if (output) output.textContent = moduleDemoText(module, input?.value || nextInput);
      logModuleActivity(moduleId, `Chọn chức năng ${featureButton.dataset.inlineFeature}`);
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
      renderDetail(module);
      logModuleActivity(moduleId, "Mở workspace chi tiết");
      byId("moduleDetail")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  });

  const logCommandActivity = (message) => {
    const state = readCommandCenterState();
    const stamp = new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
    state.activity = [`${stamp} · ${message}`, ...(state.activity || [])].slice(0, 20);
    writeCommandCenterState(state);
    const activity = grid.querySelector("[data-command-activity]");
    if (activity) activity.innerHTML = state.activity.slice(0, 6).map((item) => `<p>${escapeHtml(item)}</p>`).join("");
  };

  const renderCommandTodos = () => {
    const state = readCommandCenterState();
    const list = grid.querySelector("[data-command-todos]");
    if (!list) return;
    list.innerHTML = (state.todos || []).map((todo, index) => `
      <label>
        <input type="checkbox" data-command-toggle-todo="${index}" ${todo.done ? "checked" : ""}>
        <span>${escapeHtml(todo.text)}</span>
        <button class="interactive" type="button" data-command-remove-todo="${index}">Xóa</button>
      </label>
    `).join("") || "<p>Chưa có việc cần làm.</p>";
  };

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
      window.open(`https://www.google.com/search?q=${encodeURIComponent(query)}`, "_blank", "noopener");
      logCommandActivity(`Tìm Google: ${query}`);
      return;
    }
    if (weather) {
      const output = grid.querySelector("[data-command-weather-output]");
      if (output) output.textContent = "Đang tải thời tiết...";
      try {
        const response = await fetch("https://api.open-meteo.com/v1/forecast?latitude=21.0285&longitude=105.8542&current=temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code&timezone=Asia%2FBangkok");
        const data = await response.json();
        const current = data.current || {};
        if (output) output.innerHTML = `
          <strong>${Math.round(current.temperature_2m ?? 0)}°C</strong>
          <span>Độ ẩm ${current.relative_humidity_2m ?? "--"}% · Gió ${current.wind_speed_10m ?? "--"} km/h</span>
          <em>Hà Nội · cập nhật ${new Date().toLocaleTimeString("vi-VN")}</em>
        `;
        logCommandActivity("Đã cập nhật thời tiết");
      } catch (error) {
        if (output) output.textContent = "Không tải được thời tiết. Hãy thử lại sau.";
      }
      return;
    }
    if (server) {
      const output = grid.querySelector("[data-command-server-output]");
      if (output) output.textContent = "Đang kiểm tra backend...";
      try {
        if (!REALTIME_URL) throw new Error("Chưa cấu hình backend");
        const response = await fetch(`${REALTIME_URL}/api/platform/summary`);
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Backend lỗi");
        if (output) output.innerHTML = `<strong>Online</strong><span>Modules: ${data.modules || "--"} · Users: ${data.users || "--"} · ${new Date().toLocaleTimeString("vi-VN")}</span>`;
        logCommandActivity("Backend online");
      } catch (error) {
        if (output) output.textContent = `Backend chưa sẵn sàng: ${error.message}`;
      }
      return;
    }
    if (clearActivity) {
      const state = readCommandCenterState();
      state.activity = [];
      writeCommandCenterState(state);
      const activity = grid.querySelector("[data-command-activity]");
      if (activity) activity.innerHTML = "<p>Chưa có hoạt động.</p>";
    }
  });

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
      const response = await fetch(`${REALTIME_URL}/api/downloads/resolve`, { cache: "no-store" });
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
      const response = await fetch(`${REALTIME_URL}/api/downloads/resolve`, {
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

  grid.addEventListener("change", (event) => {
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
    logCommandActivity(toggle.checked ? "Hoàn thành todo" : "Mở lại todo");
  });

  grid.addEventListener("click", (event) => {
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
    if (demoOutput) {
      demoOutput.textContent = moduleDemoText(selectedModule, demoInput?.value || "");
    }
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

resizeCanvas();
drawParticles();
updateScrollMeter();
initReveal();
initTheme();
initHomeNeonInteractions();
initVoteStats();
initRealtimeAuth();
initPlatformLivebar();
initSuperPlatform();
initCreatorWorkspace();
initCommunityChatV2();
initMusicPlayer();
initMiniTabs();
initTool();

window.addEventListener("resize", resizeCanvas);
window.addEventListener("scroll", updateScrollMeter, { passive: true });

