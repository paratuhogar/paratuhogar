const PTH_CACHE_VERSION = 'pth-public-static-2026-08-02-pwa1';
const PTH_CACHE_PREFIX = 'pth-public-static-';
const PTH_OFFLINE_URL = '/offline.html';
const PTH_PUBLIC_ASSETS = [
  PTH_OFFLINE_URL,
  '/manifest.webmanifest',
  '/css/tailwind.min.css?v=2026-08-02',
  '/js/pwa.js?v=2026-08-02-pwa1',
  '/log.jpeg',
  '/icons/icon-192.png',
  '/icons/icon-512.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(PTH_CACHE_VERSION).then(cache => cache.addAll(PTH_PUBLIC_ASSETS))
  );
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys
      .filter(key => key.startsWith(PTH_CACHE_PREFIX) && key !== PTH_CACHE_VERSION)
      .map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
  if (event.data?.type === 'CLEAR_PUBLIC_CACHE') {
    event.waitUntil(caches.delete(PTH_CACHE_VERSION));
  }
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Las navegaciones siempre buscan la versión actual en la red. Nunca se
  // guardan HTML internos, sesiones ni respuestas privadas.
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(() => caches.match(PTH_OFFLINE_URL)));
    return;
  }

  const assetKey = `${url.pathname}${url.search}`;
  if (!PTH_PUBLIC_ASSETS.includes(assetKey)) return;

  event.respondWith((async () => {
    const cache = await caches.open(PTH_CACHE_VERSION);
    const cached = await cache.match(request);
    if (cached) return cached;
    const response = await fetch(request);
    if (response.ok) await cache.put(request, response.clone());
    return response;
  })());
});
