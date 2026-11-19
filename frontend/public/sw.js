const STATIC_CACHE = 'kampango-static-v5';
const MEDIA_CACHE = 'kampango-media-v4';
const MAX_MEDIA_ENTRIES = 120;

const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/logo.png',
  '/icon-192.png',
  '/icon-512.png',
  '/login-bg.jpeg',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(PRECACHE_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== STATIC_CACHE && k !== MEDIA_CACHE)
          .map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

async function trimCache(cacheName, maxEntries) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  if (keys.length > maxEntries) {
    const excess = keys.length - maxEntries;
    for (let i = 0; i < excess; i += 1) {
      await cache.delete(keys[i]);
    }
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.pathname.startsWith('/api/')) return;

  // 1. HTML Navigation: Network-First so users always get latest app shell, offline fallback to cached index.html
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(STATIC_CACHE).then((cache) => cache.put('/index.html', clone));
          }
          return response;
        })
        .catch(() => caches.match('/index.html'))
    );
    return;
  }

  // 2. Versioned Vite JS/CSS bundles & core brand icons: Cache-First for instant loads
  const isSameOrigin = url.origin === self.location.origin;
  const isImmutableAsset =
    isSameOrigin &&
    (url.pathname.startsWith('/assets/') ||
      PRECACHE_ASSETS.includes(url.pathname));

  if (isImmutableAsset) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(STATIC_CACHE).then((cache) => cache.put(request, clone));
          }
          return response;
        });
      })
    );
    return;
  }

  // 3. Product images & uploaded media: Stale-While-Revalidate with bounded cache size
  if (request.destination === 'image' || url.pathname.startsWith('/uploads/')) {
    event.respondWith(
      caches.open(MEDIA_CACHE).then(async (cache) => {
        const cached = await cache.match(request);
        const networkPromise = fetch(request)
          .then((response) => {
            if (response && (response.ok || response.type === 'opaque')) {
              cache.put(request, response.clone()).then(() => trimCache(MEDIA_CACHE, MAX_MEDIA_ENTRIES));
            }
            return response;
          })
          .catch(() => cached);
        return cached || networkPromise;
      })
    );
    return;
  }
});
