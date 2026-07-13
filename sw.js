const CACHE = "hh-dev-hub-v54";
const CORE = [
  "./",
  "./index.html",
  "./app-shell.css?v=39",
  "./professional-tools.css?v=1",
  "./feature-lab.css?v=3",
  "./media-design-pro.css?v=1",
  "./script.js?v=52",
  "./extension-suite.css?v=1",
  "./auth-experience.css?v=2",
  "./auth-experience.js?v=1",
  "./extension-suite.js?v=1",
  "./professional-tools.js?v=1",
  "./media-design-studio.js?v=1",
  "./media-design-pro.js?v=1",
  "./feature-lab.js?v=3",
  "./feature-engines.js?v=1",
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
