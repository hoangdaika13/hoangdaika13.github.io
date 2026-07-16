window.HH_VOTE_API_URL = "https://hoangdaika13githubio.vercel.app/api/votes";
window.HH_REALTIME_URL = /^(localhost|127\.0\.0\.1)$/.test(location.hostname)
  ? location.origin
  : "https://hoangdaika13githubio.vercel.app";
// Optional persistent Node host (Render/Railway/VPS). REST APIs still use HH_REALTIME_URL.
window.HH_SOCKET_URL = /^(localhost|127\.0\.0\.1)$/.test(location.hostname)
  ? "http://127.0.0.1:4000"
  : "https://hoangdaika13-astra-realtime.onrender.com";
