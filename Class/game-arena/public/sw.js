const VERSION = "ga-static-v3";
const PRECACHE = [
  "/",
  "/offline.html",
  "/js/arena.js",
  "/js/game-shell.js",
  "/js/icons.js",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/manifest.webmanifest"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(VERSION).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;

  event.respondWith((async () => {
    try {
      const fresh = await fetch(req);
      if (fresh.ok && (url.pathname.startsWith("/js/") || url.pathname.startsWith("/icons/") || url.pathname.endsWith(".webmanifest"))) {
        const cache = await caches.open(VERSION);
        cache.put(req, fresh.clone());
      }
      return fresh;
    } catch {
      const cached = await caches.match(req);
      if (cached) return cached;
      if (req.mode === "navigate") return caches.match("/offline.html");
      throw new Error("offline");
    }
  })());
});
