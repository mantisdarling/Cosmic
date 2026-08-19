const CACHE_NAME = 'cosmic-shell-v2';
const APP_SHELL = ['/', '/icon.svg', '/manifest.json'];
const CACHEABLE_STATIC = /\.(?:css|js|svg|ico|json|woff2?)$/i;
const MAX_CACHEABLE_BYTES = 320_000;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => Promise.all(cacheNames.filter((name) => name !== CACHE_NAME).map((name) => caches.delete(name))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);

  if (request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request, { cache: 'no-store' })
        .catch(() => caches.match('/'))
    );
    return;
  }

  if (!CACHEABLE_STATIC.test(url.pathname)) return;

  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      const networkResponse = fetch(request).then((response) => {
        const length = Number(response.headers.get('content-length') || 0);
        if (response.ok && response.type === 'basic' && (!length || length <= MAX_CACHEABLE_BYTES)) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy)).catch(() => {});
        }
        return response;
      });
      return cachedResponse || networkResponse;
    })
  );
});
