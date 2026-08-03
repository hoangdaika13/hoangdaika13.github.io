const HH_GITHUB_HOST = location.hostname === "github.io" || location.hostname.endsWith(".github.io");
// The production/custom domains call their same-origin API. GitHub Pages uses
// the active Vercel project alias because it cannot host server endpoints.
window.HH_REALTIME_URL = HH_GITHUB_HOST
  ? "https://hoangdaika13-github-io.vercel.app"
  : location.origin;
window.HH_VOTE_API_URL = `${window.HH_REALTIME_URL}/api/votes`;
// Programmable Search Engine IDs are public. API keys remain server-side on Vercel.
window.HH_GOOGLE_CSE_ID = "67d13c3a6642e4d27";
// Optional persistent Node host (Render/Railway/VPS). REST APIs still use HH_REALTIME_URL.
window.HH_SOCKET_URL = /^(localhost|127\.0\.0\.1)$/.test(location.hostname)
  ? "http://127.0.0.1:4000"
  : "https://hoangdaika13-astra-realtime.onrender.com";
