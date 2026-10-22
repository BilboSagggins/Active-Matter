// Offline support for the Active Matter Field Guide.
// Network first for everything, so new data and code show up as soon as they're pushed;
// the cache is only used when the phone is offline. Map images are cache-first (they rarely change).
const CACHE = "am-guide-v1";
const SHELL = ["./", "index.html", "assets/style.css", "assets/app.js", "manifest.webmanifest",
  "data/news.json", "data/loot.json", "data/keys.json", "data/tiers.json", "data/threats.json", "icons/icon-192.png"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;
  const key = url.origin + url.pathname; // ignore ?v= cache busters
  if (url.pathname.includes("/maps/")) {
    e.respondWith(caches.match(key).then(hit => hit || fetch(req).then(res => { const copy = res.clone(); caches.open(CACHE).then(c => c.put(key, copy)); return res; })));
    return;
  }
  e.respondWith(fetch(req).then(res => {
    if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(key, copy)); }
    return res;
  }).catch(() => caches.match(key).then(hit => hit || caches.match(url.origin + url.pathname.replace(/[^/]*$/, "")))));
});
