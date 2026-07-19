const CACHE = "hh-dev-hub-v131";
const CORE = [
  "./",
  "./index.html",
  "./app-shell.css?v=44",
  "./dashboard-aurora.css?v=3",
  "./command-center-pro.css?v=3",
  "./professional-tools.css?v=3",
  "./feature-lab.css?v=3",
  "./media-design-pro.css?v=1",
  "./media-design-page.css?v=6",
  "./media-design-advanced.css?v=3",
  "./media-design-publish.css?v=1",
  "./video-editor-studio.css?v=2",
  "./video-editor-resolve.css?v=5",
  "./photo-editor-pro.css?v=1",
  "./editor-workflow-pro.css?v=1",
  "./script.js?v=96",
  "./music-ai-studio.css?v=3",
  "./music-ai-studio.js?v=3",
  "./dashboard-aurora.js?v=3",
  "./command-center-pro.js?v=4",
  "./extension-suite.css?v=1",
  "./auth-experience.css?v=5",
  "./assets/favicon.svg?v=3",
  "./auth-experience.js?v=4",
  "./search-watch-center.css?v=5",
  "./search-watch-center.js?v=7",
  "./youtube-pip.html",
  "./communication-overview.css?v=1",
  "./communication-overview.js?v=2",
  "./work-center.css?v=1",
  "./work-center.js?v=1",
  "./download-center-pro.css?v=1",
  "./team-collaboration-pro.css?v=1",
  "./team-collaboration-pro.js?v=1",
  "./creative-suite.css?v=5",
  "./ai-center-pro.css?v=1",
  "./sidebar-navigation-pro.css?v=3",
  "./space-explorer.css?v=3",
  "./english-learning.css?v=11",
  "./english-voice-coach.css?v=1",
  "./community-social-pro.css?v=3",
  "./community-social-pro.js?v=4",
  "./community-platform-v2.css?v=10",
  "./community-platform-v2.js?v=12",
  "./community-messenger-pro.css?v=1",
  "./community-calls.js?v=1",
  "./community-admin.css?v=3",
  "./community-admin.js?v=4",
  "./insights-pro.css?v=1",
  "./motion-comfort.css?v=1",
  "./insights-pro.js?v=2",
  "./creative-suite.js?v=5",
  "./extension-suite.js?v=2",
  "./professional-tools.js?v=4",
  "./media-design-studio.js?v=1",
  "./media-design-pro.js?v=2",
  "./media-design-advanced.js?v=3",
  "./media-design-publish.js?v=1",
  "./video-editor-studio.js?v=2",
  "./video-editor-resolve.js?v=6",
  "./photo-editor-pro.js?v=1",
  "./editor-workflow-pro.js?v=1",
  "./media-design-page.js?v=6",
  "./feature-lab.js?v=4",
  "./feature-engines.js?v=2",
  "./space-explorer.js?v=3",
  "./english-curriculum.js?v=1",
  "./english-career-expansion.js?v=1",
  "./english-career-curriculum.js?v=2",
  "./english-learning.js?v=13",
  "./config.js?v=7",
  "./data/ai-super-platform-modules.json"
];
self.addEventListener("install", event => event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(CORE)).then(() => self.skipWaiting())));
self.addEventListener("activate", event => event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim())));
self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  const isPrivateRequest = url.pathname.startsWith("/api/") || request.headers.has("authorization");
  if (url.origin !== self.location.origin || isPrivateRequest) {
    event.respondWith(fetch(request));
    return;
  }

  event.respondWith(fetch(request).then(response => {
    if (response.ok && response.type === "basic") {
      const copy = response.clone();
      caches.open(CACHE).then(cache => cache.put(request, copy));
    }
    return response;
  }).catch(async () => {
    const cached = await caches.match(request);
    if (cached) return cached;
    if (request.mode === "navigate") return caches.match("./index.html");
    return Response.error();
  }));
});
