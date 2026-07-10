const $ = (selector) => document.querySelector(selector);
const byId = (id) => document.getElementById(id);

const canvas = $(".ambient-canvas");
const context = canvas?.getContext("2d");
const scrollMeter = $(".scroll-meter");
const themeToggle = $(".theme-toggle");
const colors = ["#ff4f9a", "#ffd84d", "#27d98b", "#29c7ff", "#3f63ff", "#ff7a59"];
let particles = [];
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

function resizeCanvas() {
  if (!canvas || !context) return;
  const ratio = window.devicePixelRatio || 1;
  canvas.width = Math.floor(window.innerWidth * ratio);
  canvas.height = Math.floor(window.innerHeight * ratio);
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  particles = Array.from({ length: Math.min(80, Math.floor(window.innerWidth / 16)) }, () => ({
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
  requestAnimationFrame(drawParticles);
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
  targets.forEach((target) => {
    target.classList.add("reveal");
    observer.observe(target);
  });
}

function initTheme() {
  if (!themeToggle) return;
  if (document.body.classList.contains("home-neon")) {
    const savedNeon = localStorage.getItem("hoangdaika13-neon-mode");
    const setNeonMode = (mode) => {
      const isStrong = mode === "strong";
      document.body.classList.toggle("neon-boost", isStrong);
      document.body.classList.toggle("neon-soft", !isStrong);
      themeToggle.textContent = isStrong ? "Neon máº¡nh" : "Neon nháº¹";
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
  themeToggle.textContent = document.body.classList.contains("dark") ? "Tá»‘i" : "SÃ¡ng";
  themeToggle.addEventListener("click", () => {
    document.body.classList.toggle("dark");
    const isDark = document.body.classList.contains("dark");
    themeToggle.textContent = isDark ? "Tá»‘i" : "SÃ¡ng";
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
      status.textContent = "Má»Ÿ báº±ng Chrome Ä‘á»ƒ phÃ¡t nháº¡c";
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
    status.textContent = isPlaying ? `Äang phÃ¡t: ${ambientTracks[activeTrack].name}` : "Äang táº¯t";
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
    toggle.textContent = "PhÃ¡t nháº¡c";
    updateTrackButtons();
  };

  const startMusic = async () => {
    const engine = ensureEngine();
    if (!engine) return;
    if (engine.ctx.state === "suspended") await engine.ctx.resume();
    isPlaying = true;
    toggle.textContent = "Táº¡m dá»«ng";
    updateTrackButtons();
    window.clearTimeout(timer);
    playNote();
  };

  const tryAutoplay = async () => {
    try {
      status.textContent = "Äang tá»± báº­t nháº¡c...";
      await startMusic();
    } catch {
      status.textContent = "Báº¥m báº¥t ká»³ nÃºt nÃ o Ä‘á»ƒ báº­t nháº¡c";
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
  };

  const api = async (path, options = {}) => {
    if (!REALTIME_URL) throw new Error("ChÆ°a cáº¥u hÃ¬nh realtime backend.");
    const response = await fetch(`${REALTIME_URL}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options.headers || {})
      }
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "Lá»—i káº¿t ná»‘i backend.");
    return data;
  };

  const renderAuth = () => {
    if (user) {
      setStatus(`ÄÃ£ Ä‘Äƒng nháº­p: ${user.name || user.email}`);
    } else if (token && REALTIME_URL) {
      setStatus("Äang kiá»ƒm tra tÃ i khoáº£n...");
    } else {
      setStatus("ChÆ°a Ä‘Äƒng nháº­p");
    }
    note.textContent = REALTIME_URL
      ? "Realtime backend Ä‘Ã£ cáº¥u hÃ¬nh. Tracking chá»‰ cháº¡y khi ngÆ°á»i dÃ¹ng Ä‘á»“ng Ã½ hoáº·c Ä‘Äƒng nháº­p."
      : "ChÆ°a cáº¥u hÃ¬nh realtime backend. Sau khi deploy server, dÃ¡n URL vÃ o config.js.";
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

  registerForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = new FormData(registerForm);
    try {
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
    } catch (error) {
      setStatus(error.message);
    }
  });

  loginForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = new FormData(loginForm);
    try {
      const data = await api("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email: form.get("email"), password: form.get("password") })
      });
      token = data.token;
      user = data.user;
      localStorage.setItem("hh-auth-token", token);
      renderAuth();
      connectSocket();
    } catch (error) {
      setStatus(error.message);
    }
  });

  logoutButton?.addEventListener("click", () => {
    token = "";
    user = null;
    localStorage.removeItem("hh-auth-token");
    renderAuth();
    connectSocket();
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
      online.textContent = "0 Ä‘ang online";
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
        online.textContent = `${Number(stats.online || 0)} Ä‘ang online`;
      });
      socket.emit("page:event", { type: "page:view", path: location.pathname, detail: { title: document.title } });
    } catch {
      note.textContent = "KhÃ´ng káº¿t ná»‘i Ä‘Æ°á»£c realtime backend.";
    }
  }

  renderAuth();
  loadMe().then(connectSocket);
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
  const demoInput = byId("moduleDemoInput");
  const demoOutput = byId("moduleDemoOutput");
  const runDemo = byId("runModuleDemo");
  const saveState = byId("saveModuleState");
  const copyOutput = byId("copyModuleOutput");
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
    const features = (module.features || []).slice(0, 9);
    const backendNote = module.requiresBackend
      ? "\n\nBackend thật cần có: database, auth, role, logs, sync API và bảo mật trước khi dùng cho nhiều người."
      : "\n\nChế độ hiện tại: chạy client-side trong HTML và có thể lưu localStorage.";
    return [
      `${String(module.order || "").padStart(2, "0")}. ${module.title}`,
      "",
      `Mô tả: ${module.description}`,
      "",
      "Checklist chức năng:",
      ...features.map((feature, index) => `${index + 1}. ${feature}: UI + state + action + dữ liệu mẫu.`),
      "",
      "Dữ liệu bạn nhập:",
      input || "Chưa nhập dữ liệu.",
      "",
      "Output gợi ý:",
      `- Tạo workspace động cho ${module.title}.`,
      "- Có search/filter/favorite và trạng thái lưu local.",
      "- Nếu module cần backend, UI giữ nguyên và thay localStorage bằng API thật sau."
    ].join("\n") + backendNote;
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
    const saved = JSON.parse(localStorage.getItem(stateKey) || "{}")[module.id];
    if (demoInput) demoInput.value = saved?.input || "";
    if (demoOutput) demoOutput.textContent = saved?.output || moduleDemoText(module, saved?.input || "");
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

    grid.innerHTML = visible.map((module, index) => `
      <article class="module-card interactive-card interactive ${selectedModule?.id === module.id ? "active" : ""}" data-module-id="${module.id}" style="--module-accent:${module.accent || "#ff3bd4"}">
        <span class="module-number">${String(module.order || index + 1).padStart(2, "0")}</span>
        <p class="project-tag">${module.group === "core" ? "Lõi" : "Mở rộng"}</p>
        <h3>${module.title}</h3>
        <p>${module.description}</p>
        <div class="module-features">
          ${(module.features || []).slice(0, 4).map((feature) => `<span>${feature}</span>`).join("")}
        </div>
        <footer>
          <span>${module.status || "planned"}</span>
          ${module.requiresBackend ? "<strong>Cần backend</strong>" : "<strong>Client-side</strong>"}
          <button class="module-card-fav interactive" type="button" data-module-fav="${module.id}" aria-label="Yêu thích ${module.title}">${favorites.includes(module.id) ? "♥" : "♡"}</button>
        </footer>
      </article>
    `).join("");

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
    render();
  });

  detailMeta?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-module-fav]");
    if (!button) return;
    toggleFavorite(button.dataset.moduleFav);
    renderDetail(selectedModule);
    render();
  });

  const platformApi = async (path, payload) => {
    if (!REALTIME_URL) throw new Error("Realtime backend is not configured.");
    const token = localStorage.getItem("hh-auth-token") || "";
    const response = await fetch(`${REALTIME_URL}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      body: JSON.stringify(payload)
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "Backend request failed.");
    return data;
  };

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
        actionType: "run",
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
      input: demoInput?.value || "",
      output: demoOutput?.textContent || "",
      savedAt: new Date().toISOString()
    };
    localStorage.setItem(stateKey, JSON.stringify(allState));
    if (REALTIME_URL) {
      try {
        const data = await platformApi(`/api/modules/${encodeURIComponent(selectedModule.id)}/items`, {
          title: selectedModule.title,
          type: "module-state",
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
    mentor: "Mentor sÃ¡ng táº¡o",
    writer: "BiÃªn ká»‹ch YouTube",
    designer: "UI/UX Designer",
    marketer: "Marketing Advisor"
  };

  byId("generateChatReply")?.addEventListener("click", () => {
    const role = val("chatRole") || "mentor";
    const goal = val("chatGoal") || "phÃ¡t triá»ƒn Ã½ tÆ°á»Ÿng má»›i";
    const input = val("chatInput") || "ChÆ°a cÃ³ ná»™i dung Ä‘áº§u vÃ o.";
    const output = `${roleLabels[role] || role}\n\nMá»¥c tiÃªu: ${goal}\n\nGá»£i Ã½ nhanh:\n1. Chá»‘t má»™t káº¿t quáº£ cá»¥ thá»ƒ cáº§n Ä‘áº¡t trÆ°á»›c khi viáº¿t dÃ i.\n2. TÃ¡ch Ã½ tÆ°á»Ÿng thÃ nh 3 pháº§n: hook, ná»™i dung chÃ­nh, lá»i kÃªu gá»i hÃ nh Ä‘á»™ng.\n3. Giá»¯ má»™t tone xuyÃªn suá»‘t Ä‘á»ƒ ngÆ°á»i xem nháº­n ra phong cÃ¡ch cá»§a báº¡n.\n4. Náº¿u dÃ¹ng AI tháº­t, hÃ£y gá»­i prompt dÆ°á»›i dáº¡ng vai trÃ² + bá»‘i cáº£nh + yÃªu cáº§u + Ä‘á»‹nh dáº¡ng output.\n\nPrompt tiáº¿p theo cÃ³ thá»ƒ dÃ¹ng:\n\"Báº¡n lÃ  ${roleLabels[role] || role}. HÃ£y giÃºp tÃ´i ${goal}. Dá»¯ liá»‡u Ä‘áº§u vÃ o: ${input}. Tráº£ lá»i báº±ng checklist rÃµ rÃ ng, cÃ³ vÃ­ dá»¥ cá»¥ thá»ƒ.\"`;
    write("chatOutput", output);
  });

  byId("saveChatNote")?.addEventListener("click", () => {
    const notes = JSON.parse(localStorage.getItem("hh-chat-notes") || "[]");
    notes.unshift({ at: new Date().toISOString(), role: val("chatRole"), goal: val("chatGoal"), input: val("chatInput"), output: byId("chatOutput")?.textContent || "" });
    localStorage.setItem("hh-chat-notes", JSON.stringify(notes.slice(0, 30)));
    write("chatOutput", `${byId("chatOutput")?.textContent || ""}\n\n[ÄÃ£ lÆ°u note local: ${notes.length > 30 ? 30 : notes.length}/30]`);
  });
  byId("copyChatReply")?.addEventListener("click", () => copyFrom("chatOutput"));

  const promptTemplates = {
    rewrite: ({ tone, brief }) => `Báº¡n lÃ  biÃªn ká»‹ch YouTube chuyÃªn ká»ƒ chuyá»‡n cáº£m xÃºc.\n\nNhiá»‡m vá»¥: Viáº¿t láº¡i ná»™i dung dÆ°á»›i Ä‘Ã¢y thÃ nh má»™t ká»‹ch báº£n má»›i, giá»¯ Ã½ chÃ­nh nhÆ°ng thay Ä‘á»•i cÃ¡ch ká»ƒ, nhá»‹p dá»±ng vÃ  cÃ¢u chá»¯.\n\nTone: ${tone}\n\nYÃªu cáº§u:\n- Má»Ÿ Ä‘áº§u cÃ³ hook máº¡nh trong 10 giÃ¢y Ä‘áº§u.\n- CÃ¢u vÄƒn tá»± nhiÃªn, dá»… Ä‘á»c voice-over.\n- CÃ³ cao trÃ o, chuyá»ƒn cáº£nh rÃµ, káº¿t thÃºc cÃ³ bÃ i há»c vÃ  CTA.\n- KhÃ´ng sao chÃ©p nguyÃªn vÄƒn.\n\nNá»™i dung gá»‘c:\n${brief}`,
    title: ({ tone, brief }) => `HÃ£y táº¡o 20 title YouTube tiáº¿ng Viá»‡t cho ná»™i dung sau.\n\nTone: ${tone}\n\nQuy táº¯c:\n- DÆ°á»›i 100 kÃ½ tá»±.\n- CÃ³ tÃ² mÃ² nhÆ°ng khÃ´ng lá»«a ngÆ°á»i xem.\n- PhÃ¹ há»£p khÃ¡n giáº£ 40+.\n- Chia thÃ nh 4 nhÃ³m: cáº£m xÃºc, bÃ­ máº­t, gia Ä‘Ã¬nh, bÃ i há»c.\n\nNá»™i dung:\n${brief}`,
    image: ({ tone, brief }) => `Táº¡o prompt áº£nh AI cinematic cho thumbnail/video.\n\nPhong cÃ¡ch: ${tone}\n\nTráº£ vá»:\n1. Prompt chÃ­nh báº±ng tiáº¿ng Anh.\n2. Negative prompt.\n3. Gá»£i Ã½ mÃ u sáº¯c, Ã¡nh sÃ¡ng, bá»‘ cá»¥c.\n4. Text ngáº¯n Ä‘áº·t trÃªn thumbnail.\n\nBrief:\n${brief}`,
    summary: ({ tone, brief }) => `TÃ³m táº¯t ná»™i dung sau theo tone ${tone}.\n\nTráº£ vá»:\n- 5 Ã½ chÃ­nh.\n- 3 Ä‘iá»ƒm cáº£m xÃºc máº¡nh.\n- 1 cÃ¢u hook.\n- 1 CTA phÃ¹ há»£p.\n\nNá»™i dung:\n${brief}`
  };

  byId("buildPromptButton")?.addEventListener("click", () => {
    const template = promptTemplates[val("promptTemplate")] || promptTemplates.rewrite;
    write("promptOutput", template({ tone: val("promptTone") || "tá»± nhiÃªn", brief: val("promptBrief") || "ChÆ°a cÃ³ brief." }));
  });
  byId("copyPromptButton")?.addEventListener("click", () => copyFrom("promptOutput"));
  byId("downloadPromptButton")?.addEventListener("click", () => downloadText("hh-prompt-studio.txt", byId("promptOutput")?.textContent || ""));

  byId("generateScriptButton")?.addEventListener("click", () => {
    const topic = val("scriptTopic") || "Má»™t cÃ¢u chuyá»‡n gia Ä‘Ã¬nh cáº£m Ä‘á»™ng";
    const length = val("scriptLength");
    const audience = val("scriptAudience") || "ngÆ°á»i xem Ä‘áº¡i chÃºng";
    const notes = val("scriptNotes") || "ChÆ°a cÃ³ ghi chÃº thÃªm.";
    const beats = length === "short"
      ? ["0-3s: CÃ¢u hook gÃ¢y tÃ² mÃ²", "3-15s: Váº¥n Ä‘á» chÃ­nh", "15-40s: Twist/cao trÃ o", "40-55s: BÃ i há»c", "55-60s: CTA"]
      : length === "long"
        ? ["Táº­p 1: Hook vÃ  biáº¿n cá»‘", "Táº­p 2: BÃ­ máº­t cÅ©", "Táº­p 3: Hiá»ƒu láº§m bÃ¹ng ná»•", "Táº­p 4: Báº±ng chá»©ng xuáº¥t hiá»‡n", "Táº­p 5: HÃ³a giáº£i vÃ  bÃ i há»c"]
        : ["Má»Ÿ Ä‘áº§u: Hook cáº£m xÃºc", "Pháº§n 1: Bá»‘i cáº£nh vÃ  nhÃ¢n váº­t", "Pháº§n 2: MÃ¢u thuáº«n chÃ­nh", "Pháº§n 3: Cao trÃ o", "Pháº§n 4: Sá»± tháº­t", "Káº¿t: BÃ i há»c + CTA"];
    const output = `KHUNG Ká»ŠCH Báº¢N\n\nChá»§ Ä‘á»: ${topic}\nKhÃ¡n giáº£: ${audience}\nGhi chÃº: ${notes}\n\nCáº¥u trÃºc:\n${beats.map((beat, index) => `${index + 1}. ${beat}`).join("\n")}\n\nHook máº«u:\n\"Ã”ng áº¥y im láº·ng suá»‘t 20 nÄƒm, cho Ä‘áº¿n ngÃ y má»™t lÃ¡ thÆ° cÅ© khiáº¿n cáº£ gia Ä‘Ã¬nh pháº£i nhÃ¬n láº¡i má»i chuyá»‡n.\"\n\nCTA máº«u:\n\"Náº¿u báº¡n tá»«ng hiá»ƒu láº§m má»™t ngÆ°á»i thÃ¢n yÃªu, hÃ£y Ä‘á»ƒ láº¡i má»™t bÃ¬nh luáº­n Ä‘á»ƒ cÃ¢u chuyá»‡n nÃ y Ä‘áº¿n Ä‘Æ°á»£c vá»›i nhiá»u ngÆ°á»i hÆ¡n.\"`;
    write("scriptOutput", output);
  });
  byId("copyScriptButton")?.addEventListener("click", () => copyFrom("scriptOutput"));
  byId("downloadScriptButton")?.addEventListener("click", () => downloadText("hh-script-generator.txt", byId("scriptOutput")?.textContent || ""));
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
      likeButton.querySelector("span").textContent = liked ? "â™¥" : "â™¡";
      likeButton.querySelector("strong").textContent = liked ? "ÄÃ£ thÃ­ch trang" : "ThÃ­ch trang";
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
    .split(/(?<=[.!?ã€‚ï¼ï¼Ÿ])\s+|[\r\n]+/u)
    .map((item) => item.trim())
    .filter(Boolean);
}

function topKeywords(text, limit = 12) {
  const stop = new Set("vÃ  lÃ  cá»§a cÃ³ cho má»™t nhá»¯ng cÃ¡c trong vá»›i Ä‘Æ°á»£c khÃ´ng khi Ä‘Ã£ nÃ y ngÆ°á»i Ä‘á»ƒ thÃ¬ vÃ o nhÆ° tá»«".split(" "));
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
    projectName: valueOf("projectName") || "Dá»± Ã¡n ká»ƒ chuyá»‡n 40+",
    title: valueOf("storyTitle") || "Má»™t cÃ¢u chuyá»‡n Ä‘á»i thÆ°á»ng nhiá»u cáº£m xÃºc",
    duration: valueOf("duration") || "8-12 phÃºt",
    audience: valueOf("audience") || "NgÆ°á»i xem 40+",
    tone: valueOf("tone") || "áº¤m Ã¡p, chÃ¢n tháº­t, giÃ u cáº£m xÃºc",
    mode: valueOf("rewriteMode") || "Ká»ƒ chuyá»‡n 40+ - nhanh vÃ  cáº£m xÃºc"
  };
}

function buildPrompt() {
  const cfg = config();
  const source = valueOf("sourceText") || "ChÆ°a cÃ³ ná»™i dung nguá»“n. HÃ£y tá»± xÃ¢y má»™t cÃ¢u chuyá»‡n má»›i theo chá»§ Ä‘á».";
  return `Báº¡n lÃ  biÃªn ká»‹ch YouTube chuyÃªn viáº¿t ká»‹ch báº£n ká»ƒ chuyá»‡n.

Dá»± Ã¡n: ${cfg.projectName}
TiÃªu Ä‘á»/chá»§ Ä‘á»: ${cfg.title}
Thá»i lÆ°á»£ng má»¥c tiÃªu: ${cfg.duration}
NgÆ°á»i xem: ${cfg.audience}
Tone: ${cfg.tone}
Cháº¿ Ä‘á»™ viáº¿t: ${cfg.mode}

YÃªu cáº§u:
1. Viáº¿t thÃ nh ká»‹ch báº£n hoÃ n chá»‰nh, khÃ´ng viáº¿t outline, khÃ´ng viáº¿t báº£ng.
2. Má»Ÿ Ä‘áº§u cÃ³ hook máº¡nh trong 20 giÃ¢y Ä‘áº§u.
3. Máº¡ch truyá»‡n rÃµ: má»Ÿ chuyá»‡n, xung Ä‘á»™t, bÃ­ máº­t, cao trÃ o, giáº£i quyáº¿t, bÃ i há»c.
4. KhÃ´ng dÃ¹ng timestamp, khÃ´ng ghi chÃº ngoÃ i lá».
5. NgÃ´n ngá»¯ tá»± nhiÃªn, giÃ u cáº£m xÃºc, há»£p Ä‘á»ƒ Ä‘á»c voice YouTube.
6. Náº¿u nguá»“n ngáº¯n, phÃ¡t triá»ƒn chi tiáº¿t há»£p lÃ½ nhÆ°ng giá»¯ Ã½ lÃµi.
7. Káº¿t thÃºc cÃ³ dÆ° Ã¢m vÃ  CTA má»m.

Ná»™i dung nguá»“n:
${source}`;
}

function buildDraft() {
  const cfg = config();
  const source = valueOf("sourceText") || "Má»™t nhÃ¢n váº­t chÃ­nh tá»«ng bá»‹ hiá»ƒu láº§m, nhÆ°ng cuá»‘i cÃ¹ng sá»± tháº­t Ä‘Æ°á»£c hÃ© lá»™.";
  return `TIÃŠU Äá»€: ${cfg.title}

Äá»ŠNH HÆ¯á»šNG
- Dá»± Ã¡n: ${cfg.projectName}
- NgÆ°á»i xem: ${cfg.audience}
- Thá»i lÆ°á»£ng: ${cfg.duration}
- Tone: ${cfg.tone}
- Cháº¿ Ä‘á»™: ${cfg.mode}

HOOK Má»ž Äáº¦U
KhÃ´ng pháº£i ai im láº·ng cÅ©ng lÃ  ngÆ°á»i sai. CÃ³ nhá»¯ng sá»± tháº­t bá»‹ chÃ´n giáº¥u ráº¥t lÃ¢u, chá»‰ chá» má»™t ngÃ y bÃ¬nh thÆ°á»ng Ä‘á»ƒ khiáº¿n cáº£ gia Ä‘Ã¬nh pháº£i nhÃ¬n láº¡i má»i chuyá»‡n.

TÃ“M Táº®T NGUá»’N
${source}

Báº¢N NHÃP Ká»ŠCH Báº¢N
NgÃ y hÃ´m Ä‘Ã³ báº¯t Ä‘áº§u nhÆ° bao ngÃ y khÃ¡c. NhÆ°ng chá»‰ má»™t cÃ¢u nÃ³i vÃ´ tÃ¬nh Ä‘Ã£ kÃ©o má»i ngÆ°á»i trá»Ÿ vá» vá»›i nhá»¯ng váº¿t thÆ°Æ¡ng tÆ°á»Ÿng nhÆ° Ä‘Ã£ ngá»§ yÃªn. NhÃ¢n váº­t chÃ­nh khÃ´ng vá»™i giáº£i thÃ­ch. NgÆ°á»i áº¥y chá»‰ láº·ng láº½ nhÃ¬n tá»«ng ngÆ°á»i, nhÆ° thá»ƒ Ä‘Ã£ quen vá»›i viá»‡c bá»‹ hiá»ƒu láº§m.

Trong quÃ¡ khá»©, cÃ³ má»™t quyáº¿t Ä‘á»‹nh ráº¥t khÃ³ khÄƒn Ä‘Ã£ Ä‘Æ°á»£c Ä‘Æ°a ra. Quyáº¿t Ä‘á»‹nh áº¥y khiáº¿n nhiá»u ngÆ°á»i tá»•n thÆ°Æ¡ng, nhÆ°ng phÃ­a sau nÃ³ láº¡i lÃ  má»™t lÃ½ do khÃ´ng ai biáº¿t. CÃ ng Ä‘i sÃ¢u vÃ o cÃ¢u chuyá»‡n, ngÆ°á»i xem cÃ ng nháº­n ra Ä‘iá»u Ä‘Ã¡ng sá»£ nháº¥t khÃ´ng pháº£i lÃ  nghÃ¨o khÃ³ hay máº¥t mÃ¡t, mÃ  lÃ  khi ngÆ°á»i thÃ¢n khÃ´ng cÃ²n Ä‘á»§ kiÃªn nháº«n Ä‘á»ƒ láº¯ng nghe nhau.

MÃ¢u thuáº«n tÄƒng lÃªn khi má»™t báº±ng chá»©ng cÅ© xuáº¥t hiá»‡n: má»™t lÃ¡ thÆ°, má»™t cuá»™c gá»i, má»™t mÃ³n Ä‘á»“ hoáº·c má»™t ngÆ°á»i chá»©ng kiáº¿n. Tá»« Ä‘Ã¢y, nhá»¯ng lá»i trÃ¡ch mÃ³c dáº§n Ä‘á»•i thÃ nh im láº·ng. NgÆ°á»i tá»«ng bá»‹ xem lÃ  vÃ´ tÃ¢m hÃ³a ra láº¡i lÃ  ngÆ°á»i Ã¢m tháº§m gÃ¡nh pháº§n náº·ng nháº¥t.

CAO TRÃ€O
Sá»± tháº­t Ä‘Æ°á»£c nÃ³i ra vÃ o Ä‘Ãºng lÃºc khÃ´ng ai cÃ²n cÃ³ thá»ƒ trá»‘n trÃ¡nh. NgÆ°á»i gÃ¢y tá»•n thÆ°Æ¡ng pháº£i Ä‘á»‘i diá»‡n vá»›i lá»—i láº§m cá»§a mÃ¬nh, cÃ²n ngÆ°á»i chá»‹u Ä‘á»±ng cuá»‘i cÃ¹ng cÅ©ng Ä‘Æ°á»£c tráº£ láº¡i sá»± cÃ´ng báº±ng.

Káº¾T
CÃ¢u chuyá»‡n khÃ©p láº¡i báº±ng má»™t bÃ i há»c nháº¹ nhÆ°ng sÃ¢u: trong gia Ä‘Ã¬nh, Ä‘Ã´i khi Ä‘iá»u cáº§n nháº¥t khÃ´ng pháº£i lÃ  tháº¯ng trong má»™t cuá»™c tranh cÃ£i, mÃ  lÃ  Ä‘á»§ thÆ°Æ¡ng Ä‘á»ƒ há»i: "NgÃ y Ä‘Ã³, báº¡n Ä‘Ã£ Ä‘au nhÆ° tháº¿ nÃ o?"`;
}

function analyzeText(text) {
  const sents = sentences(text);
  const kws = topKeywords(text);
  const wc = wordCount(text);
  const minutes = Math.max(1, wc / 145);
  return `Sá»‘ tá»«: ${wc}
Sá»‘ cÃ¢u/Ä‘oáº¡n: ${sents.length}
Æ¯á»›c lÆ°á»£ng voice: ${minutes.toFixed(1)} phÃºt

Keyword ná»•i báº­t:
${kws.map(([word, count]) => `- ${word}: ${count}`).join("\n") || "- ChÆ°a Ä‘á»§ dá»¯ liá»‡u"}

Beat gá»£i Ã½:
- Hook: ${sents[0] || "Cáº§n thÃªm má»Ÿ Ä‘áº§u máº¡nh hÆ¡n."}
- Xung Ä‘á»™t: cáº§n lÃ m rÃµ nhÃ¢n váº­t muá»‘n gÃ¬ vÃ  bá»‹ cáº£n bá»Ÿi Ä‘iá»u gÃ¬.
- Cao trÃ o: nÃªn cÃ³ báº±ng chá»©ng, Ä‘á»‘i thoáº¡i hoáº·c lá»±a chá»n khÃ³.
- Káº¿t: nÃªn cÃ³ bÃ i há»c hoáº·c dÆ° Ã¢m cáº£m xÃºc.`;
}

function summarizeText(text) {
  const sents = sentences(text);
  if (!sents.length) return "ChÆ°a cÃ³ ná»™i dung Ä‘á»ƒ tÃ³m táº¯t.";
  return sents.slice(0, 7).map((sent, index) => `${index + 1}. ${sent}`).join("\n");
}

function compareTexts(source, draft) {
  const left = new Set(words(source));
  const right = new Set(words(draft));
  const shared = [...left].filter((word) => right.has(word)).length;
  const total = new Set([...left, ...right]).size || 1;
  const similarity = Math.round((shared / total) * 100);
  const originality = Math.max(0, 100 - similarity);
  const risk = similarity >= 55 ? "Cao" : similarity >= 32 ? "Vá»«a" : "Tháº¥p";
  return { similarity, originality, risk };
}

function updateMetas() {
  setText("sourceMeta", `${wordCount(valueOf("sourceText"))} tá»«`);
  setText("draftMeta", `${wordCount(valueOf("outputText"))} tá»«`);
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
    setStatus("Báº¡n cáº§n nháº­p API key Gemini náº¿u muá»‘n gá»i AI tháº­t.");
    return;
  }
  setStatus("Äang gá»i Gemini...");
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
    setOutput(text || "Gemini khÃ´ng tráº£ vá» ná»™i dung.", "Gemini Ä‘Ã£ tráº£ káº¿t quáº£.");
  } catch (error) {
    console.error(error);
    setStatus("KhÃ´ng gá»i Ä‘Æ°á»£c Gemini. HÃ£y kiá»ƒm tra API key, model hoáº·c máº¡ng/CORS.");
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
    setStatus(`ÄÃ£ nháº­p file: ${file.name}`);
  });
  bind("pasteSource", "click", async () => {
    try {
      const text = await navigator.clipboard.readText();
      setValue("sourceText", text);
      updateMetas();
      setStatus("ÄÃ£ dÃ¡n ná»™i dung tá»« clipboard.");
    } catch {
      setStatus("TrÃ¬nh duyá»‡t chÆ°a cho phÃ©p Ä‘á»c clipboard. HÃ£y dÃ¡n báº±ng Ctrl+V.");
    }
  });
  bind("cleanSource", "click", () => {
    setValue("sourceText", cleanText(valueOf("sourceText")));
    updateMetas();
    setStatus("ÄÃ£ lÃ m sáº¡ch text/phá»¥ Ä‘á».");
  });
  bind("makeDraft", "click", () => setOutput(buildDraft(), "ÄÃ£ táº¡o báº£n nhÃ¡p local."));
  bind("oneClick", "click", () => {
    const cleaned = cleanText(valueOf("sourceText"));
    setValue("sourceText", cleaned);
    const draft = buildDraft();
    setOutput(draft, "ÄÃ£ xá»­ lÃ½ 1 cháº¡m: lÃ m sáº¡ch, phÃ¢n tÃ­ch nhanh vÃ  táº¡o báº£n nhÃ¡p.");
    setText("analysisOutput", analyzeText(cleaned));
  });
  bind("makePrompt", "click", () => setOutput(buildPrompt(), "ÄÃ£ táº¡o prompt."));
  bind("callGemini", "click", callGemini);
  const makeTitleHandler = () => {
    const source = valueOf("sourceText");
    const kw = topKeywords(source, 4).map(([word]) => word).join(" ");
    setValue("storyTitle", kw ? `Sá»± tháº­t phÃ­a sau ${kw}` : "Má»™t bÃ­ máº­t khiáº¿n cáº£ gia Ä‘Ã¬nh im láº·ng");
    setStatus("ÄÃ£ táº¡o title local.");
  };
  bind("makeTitle", "click", makeTitleHandler);
  bind("makeTitle2", "click", makeTitleHandler);
  bind("copyOutput", "click", async () => {
    const text = valueOf("outputText");
    if (!text) return setStatus("ChÆ°a cÃ³ ná»™i dung Ä‘á»ƒ copy.");
    await navigator.clipboard.writeText(text);
    setStatus("ÄÃ£ copy káº¿t quáº£.");
  });
  bind("downloadOutput", "click", () => {
    const text = valueOf("outputText");
    if (!text) return setStatus("ChÆ°a cÃ³ ná»™i dung Ä‘á»ƒ táº£i.");
    downloadText("kich-ban-ai.txt", text);
    setStatus("ÄÃ£ táº¡o file TXT.");
  });
  bind("writerGenerate", "click", () => {
    const draft = buildDraft();
    setOutput(draft, "Gemini Writer: Ä‘Ã£ táº¡o báº£n viáº¿t má»›i local.");
    showMiniTab("writer");
  });
  bind("writerImprove", "click", () => {
    const improved = `${valueOf("outputText") || buildDraft()}\n\nPHIÃŠN Báº¢N NÃ‚NG Cáº¤P\n- TÄƒng hook má»Ÿ Ä‘áº§u.\n- ThÃªm Ä‘á»‘i thoáº¡i á»Ÿ cao trÃ o.\n- LÃ m rÃµ bÃ i há»c cuá»‘i cÃ¢u chuyá»‡n.\n- Giáº£m cÃ¢u giá»‘ng nguá»“n, tÄƒng chi tiáº¿t má»›i.`;
    setOutput(improved, "ÄÃ£ nÃ¢ng cáº¥p báº£n nhÃ¡p local.");
    showMiniTab("writer");
  });
  bind("writerPrompt", "click", () => {
    setOutput(buildPrompt(), "ÄÃ£ táº¡o prompt Ä‘áº§y Ä‘á»§.");
    showMiniTab("writer");
  });
  bind("analyzeScript", "click", () => {
    setText("analysisOutput", analyzeText(valueOf("sourceText")));
    setStatus("ÄÃ£ phÃ¢n tÃ­ch nguá»“n.");
  });
  bind("storyScore", "click", () => {
    const draft = valueOf("outputText");
    const score = Math.min(100, 35 + Math.round(wordCount(draft) / 30) + topKeywords(draft, 8).length * 3);
    setText("analysisOutput", `Story score 40+: ${score}/100\n\nGá»£i Ã½:\n- TÄƒng hook má»Ÿ Ä‘áº§u náº¿u score dÆ°á»›i 70.\n- ThÃªm cao trÃ o, Ä‘á»‘i thoáº¡i vÃ  plot twist.\n- Káº¿t thÃºc nÃªn cÃ³ bÃ i há»c hoáº·c CTA má»m.`);
    setStatus(`Story score: ${score}/100`);
  });
  bind("summarizeScript", "click", () => {
    const sourceSummary = summarizeText(valueOf("sourceText"));
    const draftSummary = summarizeText(valueOf("outputText"));
    setText("summaryOutput", `TÃ“M Táº®T NGUá»’N\n${sourceSummary}\n\nTÃ“M Táº®T Báº¢N Má»šI\n${draftSummary}`);
    setStatus("ÄÃ£ tÃ³m táº¯t.");
    showMiniTab("summary");
  });
  bind("compareScript", "click", () => {
    const report = compareTexts(valueOf("sourceText"), valueOf("outputText"));
    setText("similarityPercent", `${report.similarity}%`);
    setText("originalityPercent", `${report.originality}%`);
    setText("riskLevel", report.risk);
    setText("compareOutput", `Äá»™ giá»‘ng: ${report.similarity}%\nÄá»™ má»›i: ${report.originality}%\nRá»§i ro: ${report.risk}\n\nKhuyáº¿n nghá»‹:\n- Náº¿u rá»§i ro cao, Ä‘á»•i cáº¥u trÃºc cáº£nh, nhÃ¢n váº­t, tÃ¬nh huá»‘ng vÃ  cÃ¡ch má»Ÿ nÃºt.\n- Giá»¯ Ã½ lÃµi nhÆ°ng thay diá»…n biáº¿n vÃ  cÃ¢u chá»¯.\n- TÄƒng chi tiáº¿t má»›i á»Ÿ pháº§n giá»¯a vÃ  cao trÃ o.`);
    setStatus("ÄÃ£ so sÃ¡nh Ä‘á»™ giá»‘ng.");
    showMiniTab("compare");
  });
  bind("sendChat", "click", () => {
    const question = valueOf("chatInput");
    if (!question) return setStatus("ChÆ°a cÃ³ cÃ¢u há»i chat.");
    const answer = `Báº¡n: ${question}\n\nAI local: Dá»±a trÃªn ká»‹ch báº£n hiá»‡n táº¡i, nÃªn tÄƒng xung Ä‘á»™t á»Ÿ pháº§n giá»¯a, thÃªm má»™t báº±ng chá»©ng rÃµ rÃ ng vÃ  lÃ m Ä‘oáº¡n káº¿t cÃ³ dÆ° Ã¢m hÆ¡n.\n\n`;
    setText("chatLog", `${byId("chatLog")?.textContent || ""}${answer}`);
    setValue("chatInput", "");
    setStatus("Chat AI Ä‘Ã£ tráº£ lá»i local.");
  });
  bind("clearChat", "click", () => {
    setText("chatLog", "Chat log.");
    setStatus("ÄÃ£ xÃ³a chat.");
  });
  bind("batchFiles", "change", async (event) => {
    const files = [...(event.target.files || [])];
    const rows = [];
    for (const file of files) {
      const text = await file.text();
      rows.push({ name: file.name, words: wordCount(text), summary: summarizeText(text).slice(0, 220) });
    }
    setText("batchOutput", JSON.stringify(rows, null, 2));
    setStatus(`ÄÃ£ náº¡p ${rows.length} file batch.`);
  });
  bind("runBatch", "click", () => {
    const output = byId("batchOutput")?.textContent || "[]";
    setText("batchOutput", `${output}\n\nBatch local Ä‘Ã£ sáºµn sÃ ng. Vá»›i GitHub Pages, xá»­ lÃ½ AI hÃ ng loáº¡t cáº§n API key Gemini vÃ  xÃ¡c nháº­n tá»«ng lÆ°á»£t gá»i.`);
    setStatus("ÄÃ£ cháº¡y batch local.");
  });
  bind("downloadBatch", "click", () => downloadText("batch-results.json", byId("batchOutput")?.textContent || "[]", "application/json;charset=utf-8"));
  bind("parseUrls", "click", () => {
    const urls = valueOf("urlInput").split(/\s+/).filter(Boolean);
    const prompt = `HÃ£y Ä‘á»c vÃ  viáº¿t láº¡i ná»™i dung tá»« cÃ¡c URL sau theo cáº¥u hÃ¬nh hiá»‡n táº¡i:\n\n${urls.map((url, i) => `${i + 1}. ${url}`).join("\n")}\n\n${buildPrompt()}`;
    setText("urlOutput", prompt);
    setStatus(`ÄÃ£ táº¡o prompt cho ${urls.length} URL.`);
  });
  bind("clearUrls", "click", () => {
    setValue("urlInput", "");
    setText("urlOutput", "ChÆ°a cÃ³ URL.");
    setStatus("ÄÃ£ xÃ³a URL.");
  });
  bind("translateLocal", "click", () => {
    setValue("sourceTranslation", `[Báº£n dá»‹ch kiá»ƒm tra local]\n${valueOf("sourceText")}`);
    setValue("draftTranslation", `[Báº£n dá»‹ch kiá»ƒm tra local]\n${valueOf("outputText")}`);
    setStatus("ÄÃ£ táº¡o báº£n dá»‹ch kiá»ƒm tra local.");
  });
  bind("copyTranslation", "click", async () => {
    await navigator.clipboard.writeText(`${valueOf("sourceTranslation")}\n\n${valueOf("draftTranslation")}`);
    setStatus("ÄÃ£ copy báº£n dá»‹ch.");
  });
  bind("makePlan", "click", () => {
    const title = valueOf("storyTitle") || "Series ká»ƒ chuyá»‡n 40+";
    setText("plannerOutput", `Káº¾ HOáº CH SERIES: ${title}\n\nTáº­p 1: Hook bÃ­ máº­t gia Ä‘Ã¬nh\nTáº­p 2: NhÃ¢n váº­t chÃ­nh bá»‹ hiá»ƒu láº§m\nTáº­p 3: Báº±ng chá»©ng cÅ© xuáº¥t hiá»‡n\nTáº­p 4: Cao trÃ o Ä‘á»‘i máº·t\nTáº­p 5: Sá»± tháº­t vÃ  bÃ i há»c\n\nLá»‹ch Ä‘Äƒng: 3 video/tuáº§n\nCTA: bÃ¬nh luáº­n tráº£i nghiá»‡m cÃ¡ nhÃ¢n á»Ÿ cuá»‘i má»—i táº­p.`);
    setStatus("ÄÃ£ táº¡o káº¿ hoáº¡ch ná»™i dung.");
  });
  bind("ideaBank", "click", () => {
    setText("plannerOutput", "KHO Ã TÆ¯á»žNG 40+\n- NgÆ°á»i máº¹ bá»‹ con hiá»ƒu láº§m\n- Di chÃºc má»Ÿ ra bÃ­ máº­t cÅ©\n- NgÆ°á»i cha nghÃ¨o Ã¢m tháº§m tráº£ ná»£ cho con\n- Cuá»™c gá»i cuá»‘i cÃ¹ng trÆ°á»›c ngÃ y Ä‘oÃ n tá»¥\n- HÃ ng xÃ³m giá»¯ bÃ­ máº­t suá»‘t 20 nÄƒm");
    setStatus("ÄÃ£ má»Ÿ kho Ã½ tÆ°á»Ÿng.");
  });
  bind("saveProject", "click", () => {
    const payload = currentProjectPayload();
    localStorage.setItem("kich-ban-ai-project", JSON.stringify(payload));
    setText("projectOutput", JSON.stringify(payload, null, 2));
    setStatus("ÄÃ£ lÆ°u dá»± Ã¡n local.");
  });
  bind("loadProject", "click", () => {
    const raw = localStorage.getItem("kich-ban-ai-project");
    if (!raw) return setStatus("ChÆ°a cÃ³ dá»± Ã¡n local.");
    const payload = JSON.parse(raw);
    loadProjectPayload(payload);
    setText("projectOutput", JSON.stringify(payload, null, 2));
    setStatus("ÄÃ£ má»Ÿ dá»± Ã¡n local.");
  });
  bind("exportProject", "click", () => downloadText("kich-ban-ai-project.json", JSON.stringify(currentProjectPayload(), null, 2), "application/json;charset=utf-8"));
  bind("deleteProject", "click", () => {
    localStorage.removeItem("kich-ban-ai-project");
    setText("projectOutput", "ÄÃ£ xÃ³a dá»± Ã¡n local.");
    setStatus("ÄÃ£ xÃ³a dá»± Ã¡n local.");
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
initSuperPlatform();
initCreatorWorkspace();
initMusicPlayer();
initMiniTabs();
initTool();

window.addEventListener("resize", resizeCanvas);
window.addEventListener("scroll", updateScrollMeter, { passive: true });

