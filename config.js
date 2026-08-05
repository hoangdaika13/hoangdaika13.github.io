const HH_GITHUB_HOST = location.hostname === "github.io" || location.hostname.endsWith(".github.io");
const HH_LOCAL_HOST = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
const HH_VERCEL_API_ORIGIN = "https://hoangdaika13-github-io.vercel.app";
const HH_LOCAL_API_REQUESTED = HH_LOCAL_HOST && new URLSearchParams(location.search).get("api") === "local";
// The production/custom domains call their same-origin API. GitHub Pages and a
// plain local static server cannot host serverless routes, so they use the
// public production alias. `?api=local` remains available when running
// `vercel dev`, and an embedding shell may provide HH_API_BASE explicitly.
const HH_API_ORIGIN = String(
  window.HH_API_BASE
  || (HH_LOCAL_API_REQUESTED ? location.origin : "")
  || (HH_GITHUB_HOST || HH_LOCAL_HOST || location.protocol === "file:" ? HH_VERCEL_API_ORIGIN : location.origin)
).replace(/\/$/, "");
window.HH_API_BASE = HH_API_ORIGIN;
window.HH_REALTIME_URL = HH_API_ORIGIN;
window.HH_VOTE_API_URL = `${window.HH_REALTIME_URL}/api/votes`;
// Programmable Search Engine IDs are public. API keys remain server-side on Vercel.
window.HH_GOOGLE_CSE_ID = "67d13c3a6642e4d27";
// Optional persistent Node host (Render/Railway/VPS). REST APIs still use HH_REALTIME_URL.
window.HH_SOCKET_URL = /^(localhost|127\.0\.0\.1)$/.test(location.hostname)
  ? "http://127.0.0.1:4000"
  : "https://hoangdaika13-astra-realtime.onrender.com";
