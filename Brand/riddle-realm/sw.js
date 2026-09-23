/* Riddle Realm — Service Worker (Phase 17)
   Offline shell: caches app shell + last known data files.
   Version bump CACHE to force refresh after deploys. */
const CACHE = 'rr-shell-v22';
const SHELL = [
  './',
  './index.html',
  './style.css',
  './script.js',
  './manifest.webmanifest',
  './data/riddles-data.js',
  './js/storage.js',
  './js/riddles.js',
  './js/game.js',
  './js/daily.js',
  './js/streaks.js',
  './js/hints.js',
  './js/achievements.js',
  './js/missions.js',
  './js/shop.js',
  './js/leaderboard.js',
  './js/analytics.js',
  './js/meta-pixel.js',
  './js/entitlements.js',
  './js/monetization.js',
  './js/ai-service.js',
  './js/share.js',
  './js/audio.js',
  './js/api.js',
  './js/ui.js',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  if (req.url.indexOf('founder.html') !== -1) return;

  event.respondWith(
    caches.match(req).then((cached) => {
      const fetchPromise = fetch(req).then((res) => {
        // Cache successful same-origin GETs
        if (res && res.ok && req.url.startsWith(self.location.origin)) {
          const copy = res.clone();
          caches.open(CACHE).then((cache) => cache.put(req, copy));
        }
        return res;
      }).catch(() => cached);

      // Prefer network, fall back to cache (stale-while-revalidate style)
      return cached ? fetchPromise.catch(() => cached) : fetchPromise.then((r) => r || cached);
    }).then((res) => res || caches.match('./index.html'))
  );
});
