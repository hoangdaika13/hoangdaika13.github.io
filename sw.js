const CACHE = "hh-dev-hub-v71";
const CORE = [
  "./",
  "./index.html",
  "./app-shell.css?v=40",
  "./dashboard-aurora.css?v=3",
  "./command-center-pro.css?v=2",
  "./professional-tools.css?v=3",
  "./feature-lab.css?v=3",
  "./media-design-pro.css?v=1",
  "./media-design-page.css?v=5",
  "./media-design-advanced.css?v=3",
  "./media-design-publish.css?v=1",
  "./video-editor-studio.css?v=1",
  "./video-editor-resolve.css?v=4",
  "./script.js?v=64",
  "./dashboard-aurora.js?v=3",
  "./command-center-pro.js?v=2",
  "./extension-suite.css?v=1",
  "./auth-experience.css?v=2",
  "./auth-experience.js?v=1",
  "./search-watch-center.css?v=1",
  "./search-watch-center.js?v=2",
  "./creative-suite.css?v=2",
  "./creative-suite.js?v=2",
  "./extension-suite.js?v=1",
  "./professional-tools.js?v=3",
  "./media-design-studio.js?v=1",
  "./media-design-pro.js?v=1",
  "./media-design-advanced.js?v=3",
  "./media-design-publish.js?v=1",
  "./video-editor-studio.js?v=1",
  "./video-editor-resolve.js?v=4",
  "./media-design-page.js?v=6",
  "./feature-lab.js?v=4",
  "./feature-engines.js?v=2",
  "./config.js?v=3",
  "./data/ai-super-platform-modules.json"
];
self.addEventListener("install", event => event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(CORE)).then(() => self.skipWaiting())));
self.addEventListener("activate", event => event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim())));
self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;
  event.respondWith(fetch(event.request).then(response => {
    const copy = response.clone();
    caches.open(CACHE).then(cache => cache.put(event.request, copy));
    return response;
  }).catch(() => caches.match(event.request).then(response => response || caches.match("./index.html"))));
});
