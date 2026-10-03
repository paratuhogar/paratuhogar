const PTH_CACHE_VERSION = 'pth-public-static-2026-10-03-sharefix1';
const PTH_IMAGE_CACHE = 'pth-public-images-v1';
const PTH_IMAGE_LIMIT = 100;
const PTH_CACHE_PREFIX = 'pth-public-static-';
const PTH_OFFLINE_URL = '/offline.html';
const PTH_SHELL_URL = '/offline-catalog.html';
const PTH_ORDER_SHELL_URL = '/offline-order.html';
const PTH_APP_SHELL_URL = '/index.html';
// This is the checked-in public template: no rendered customer/API data.
const PTH_NORMAL_BOOT = [PTH_APP_SHELL_URL,
  '/js/affiliate-links.js?v=20261003-alias1',
  '/js/public-name-editor.js?v=20261003-alias1',
  '/js/vendor/supabase-2.57.4.js',
  '/js/checkout-form-shared.js?v=20261003-pending2',
  '/js/offline-checkout-copy.js?v=20261003-pending2',
  '/js/offline-storefront-adapter.js?v=20261003-pending2',
  '/css/offline-storefront.css?v=20261003-pending2',
  '/js/storefront.min.js?v=20261003-alias1',
  '/js/storefront-extras.min.js?v=20261003-alias1',
  '/js/pending-checkout-storefront.js?v=20261003-pending2',
  '/js/pwa.js?v=20261003-pending2',
  '/css/tailwind.min.css?v=20261003-pending2',
  '/css/client-followup.css?v=2',
  '/css/work-navigation.css?v=20261001-1',
  '/css/low-connectivity.css?v=20261003-pending2',
  '/css/admin-panel.css?v=20261003-recent2',
  '/css/feedback-announcement.css?v=20261001-1',
  '/js/admin-panel-data.js?v=20261003-recent2',
  '/js/product-availability-form.js?v=20260924-1',
  '/js/product-description-editor.js?v=20260924-1',
  '/js/checkout-submit-guard.js?v=20261002-lowdata1',
  '/js/checkout-recovery.js?v=20261002-lowdata1',
  '/js/feedback-announcement.js?v=20261001-1',
  '/js/product-description-loader.js?v=20261001-images2',
  '/js/admin-work-view.js?v=20260930-admins2',
  '/js/admin-push-links.js?v=20261002-reminders1',
  '/js/internal-assets.js?v=20261003-sharefix1',
  '/log.jpeg', '/icons/product-placeholder.svg'];
// Public templates, local SDK and display code only. No private responses.
const PTH_MINIMAL_SHELL = [...PTH_NORMAL_BOOT, PTH_SHELL_URL, PTH_OFFLINE_URL, PTH_ORDER_SHELL_URL,
  '/css/offline-order.css?v=20261003-pending2',
  '/js/pending-checkout.js?v=20261003-pending2',
  '/js/pending-checkout-page.js?v=20261003-pending2',
  '/js/secure-data.js?v=20261003-alias1',
  '/js/low-connectivity.js?v=20261002-lowdata1',
  '/js/public-catalog-api.js?v=20261002-lowdata1',
  '/js/offline-catalog.js?v=20261002-lowdata2',
  '/css/offline-catalog.css?v=20261002-lowdata1',
  '/js/image-variants.js?v=20261001-images2',
  '/js/product-images.js?v=20261002-fasttools2'];
const PTH_PUBLIC_ASSETS = [...PTH_MINIMAL_SHELL,
  '/js/pending-checkout-storefront.js?v=20261003-pending2',
  PTH_SHELL_URL,
  PTH_OFFLINE_URL,
  '/js/secure-data.js?v=20261003-alias1',
  '/js/storefront.min.js?v=20261003-alias1',
  '/css/low-connectivity.css?v=20261003-pending2',
  '/js/product-description-loader.js?v=20261001-images2',
  '/js/storefront-extras.min.js?v=20261003-alias1',
  '/js/internal-assets.js?v=20261003-sharefix1',
  '/js/product-availability-form.js?v=20260924-1',
  '/js/product-description-editor.js?v=20260924-1',
  '/js/checkout-submit-guard.js?v=20261002-lowdata1',
  '/js/checkout-recovery.js?v=20261002-lowdata1',
  '/js/feedback-announcement.js?v=20261001-1',
  '/css/feedback-announcement.css?v=20261001-1',
  '/css/work-navigation.css?v=20261001-1',
  '/css/admin-panel.css?v=20261003-recent2',
  '/js/admin-panel-data.js?v=20261003-recent2',
  '/js/admin-work-view.js?v=20260930-admins2',
  '/js/admin-push-links.js?v=20261002-reminders1',
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

importScripts('/js/admin-push-worker.js?v=20261002-reminders1');

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

  // The normal route reopens its generic checked-in template. Own device data
  // stays in account-scoped IndexedDB; no API response or private route is cached.
  // Compatibility readers remain available at their explicit existing paths.
  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const response = await fetch(request);
        return response;
      } catch (error) {
        if (url.pathname === PTH_ORDER_SHELL_URL) {
          const orderShell = await caches.match(PTH_ORDER_SHELL_URL);
          if (orderShell) return orderShell;
        }
        if (url.pathname === '/' || url.pathname === '/index.html' || url.pathname.startsWith('/producto/')) {
          const app = await caches.match(PTH_APP_SHELL_URL);
          if (app) return app;
        }
        if (url.pathname === PTH_SHELL_URL) {
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
