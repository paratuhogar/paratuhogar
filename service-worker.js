const PTH_CACHE_VERSION = 'pth-public-static-2026-10-02-quickstory1';
const PTH_IMAGE_CACHE = 'pth-public-images-v1';
const PTH_IMAGE_LIMIT = 100;
const PTH_CACHE_PREFIX = 'pth-public-static-';
const PTH_OFFLINE_URL = '/offline.html';
const PTH_SHELL_URL = '/offline-catalog.html';
// Repeat visits need only this public reader, not the SDK or account tools.
const PTH_MINIMAL_SHELL = [PTH_SHELL_URL, PTH_OFFLINE_URL,
  '/js/low-connectivity.js?v=20261002-lowdata1',
  '/js/public-catalog-api.js?v=20261002-lowdata1',
  '/js/offline-catalog.js?v=20261002-lowdata2',
  '/css/offline-catalog.css?v=20261002-lowdata1',
  '/js/image-variants.js?v=20261001-images2',
  '/js/product-images.js?v=20261002-fasttools2'];
const PTH_PUBLIC_ASSETS = [...PTH_MINIMAL_SHELL,
  PTH_SHELL_URL,
  PTH_OFFLINE_URL,
  '/js/secure-data.js?v=20261002-lowdata1',
  '/js/storefront.min.js?v=20261002-quickstory1',
  '/css/low-connectivity.css?v=20261002-fasttools2',
  '/js/product-description-loader.js?v=20261001-images2',
  '/js/storefront-extras.min.js?v=20261002-fasttools1',
  '/js/internal-assets.js?v=20261002-quickstory1',
  '/js/product-availability-form.js?v=20260924-1',
  '/js/product-description-editor.js?v=20260924-1',
  '/js/checkout-submit-guard.js?v=20261002-lowdata1',
  '/js/checkout-recovery.js?v=20261002-lowdata1',
  '/js/feedback-announcement.js?v=20261001-1',
  '/css/feedback-announcement.css?v=20261001-1',
  '/css/work-navigation.css?v=20261001-1',
  '/css/admin-panel.css?v=20261002-admin1',
  '/js/admin-panel-data.js?v=20261002-admin1',
  '/js/admin-work-view.js?v=20260930-admins2',
  '/js/admin-push-links.js?v=20261002-applications1',
  '/manifest.webmanifest',
  '/css/tailwind.min.css?v=20261002-lowdata1',
  '/css/client-followup.css?v=2',
  '/js/image-variants.js?v=20261001-images2',
  '/js/pwa.js?v=20261002-fasttools2',
  '/log.jpeg',
  '/icons/product-placeholder.svg',
  '/icons/icon-192.png',
  '/icons/icon-512.png'
];

importScripts('/js/admin-push-worker.js?v=20261002-applications1');

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(PTH_CACHE_VERSION).then(cache => cache.addAll(PTH_MINIMAL_SHELL))
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
    event.waitUntil(Promise.all([caches.delete(PTH_CACHE_VERSION), caches.delete(PTH_IMAGE_CACHE)]));
  }
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Only immutable, generated public thumbnails. No originals, queries, API,
  // pricing, screenshots or authenticated requests enter this runtime cache.
  if (request.destination === 'image' && !url.search
      && !request.headers?.has('authorization')
      && /^\/img_productos\/optimized\/[a-f0-9]{16}-(360|720)\.(avif|webp)$/.test(url.pathname)) {
    event.respondWith((async () => {
      let cache;
      try {
        cache = await caches.open(PTH_IMAGE_CACHE);
        const hit = await cache.match(request);
        if (hit) return hit;
      } catch (_) { /* Storage is optional. */ }
      const response = await fetch(request);
      if (cache && response.ok && response.type === 'basic') {
        try {
          await cache.put(request, response.clone());
          const keys = await cache.keys();
          await Promise.all(keys.slice(0, Math.max(0, keys.length - PTH_IMAGE_LIMIT)).map(key => cache.delete(key)));
        } catch (_) { /* Quota/privacy mode must not break a fetched image. */ }
      }
      return response;
    })());
    return;
  }

  // Offline navigation loads only the public reader. No account restoration,
  // private page, SDK response or authenticated document is cached here.
  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const response = await fetch(request);
        return response;
      } catch (error) {
        if (url.pathname === '/' || url.pathname === '/index.html' || url.pathname === PTH_SHELL_URL) {
          const shell = await caches.match(PTH_SHELL_URL);
          if (shell) return shell;
        }
        return caches.match(PTH_OFFLINE_URL);
      }
    })());
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
