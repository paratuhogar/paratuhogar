const PTH_CACHE_VERSION = 'pth-public-static-2026-10-09-session1';
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
  '/js/gestor-ranking.js?v=20261004-rolling30',
  '/js/vendor/supabase-2.57.4.js',
  '/js/checkout-form-shared.js?v=20261003-pending2',
  '/js/offline-checkout-copy.js?v=20261005-copy2',
  '/js/offline-storefront-adapter.js?v=20261005-cold7',
  '/css/offline-storefront.css?v=20261003-pending2',
  '/js/gestor-questionnaire.js?v=20261008-questionnaire2',
  '/js/checkout-confirmation.js?v=20261008-orders1',
  '/js/storefront.min.js?v=20261009-session1',
  '/js/storefront-extras.min.js?v=20261008-questionnaire2',
  '/js/pending-checkout-storefront.js?v=20261009-session1',
  '/js/pwa.js?v=20261006-ready1',
  '/css/tailwind.min.css?v=20261004-rolling30',
  '/css/gestor-ranking.css?v=20261004-rolling30',
  '/css/client-followup.css?v=2',
  '/css/work-navigation.css?v=20261001-1',
  '/css/gestor-guide.css?v=20261003-dashboard2',
  '/js/gestor-guide.js?v=20261003-dashboard2',
  '/css/work-welcome.css?v=20261003-welcome2',
  '/js/work-welcome.js?v=20261003-welcome2',
  '/css/low-connectivity.css?v=20261003-pending2',
  '/css/admin-panel.css?v=20261003-recent2',
  '/css/feedback-announcement.css?v=20261001-1',
  '/js/admin-panel-data.js?v=20261003-recent2',
  '/js/product-availability-form.js?v=20260924-1',
  '/js/product-description-editor.js?v=20260924-1',
  '/js/checkout-submit-guard.js?v=20261002-lowdata1',
  '/js/checkout-recovery.js?v=20261002-lowdata1',
  '/js/feedback-announcement.js?v=20261003-welcome2',
  '/js/product-description-loader.js?v=20261001-images2',
  '/js/admin-work-view.js?v=20260930-admins2',
  '/js/admin-push-links.js?v=20261002-reminders1',
  '/js/internal-assets.js?v=20261003-sharefix1',
  '/log.jpeg', '/icons/product-placeholder.svg'];
// Public templates, local SDK and display code only. No private responses.
const PTH_MINIMAL_SHELL = [...PTH_NORMAL_BOOT, PTH_SHELL_URL, PTH_OFFLINE_URL, PTH_ORDER_SHELL_URL,
  '/css/offline-order.css?v=20261003-pending2',
  '/js/pending-checkout.js?v=20261008-orders1',
  '/js/pending-checkout-page.js?v=20261005-cold7',
  '/js/secure-data.js?v=20261009-session1',
  '/js/low-connectivity.js?v=20261002-lowdata1',
  '/js/public-catalog-api.js?v=20261002-lowdata1',
  '/js/offline-catalog.js?v=20261002-lowdata2',
  '/css/offline-catalog.css?v=20261002-lowdata1',
  '/js/image-variants.js?v=20261001-images2',
  '/js/product-images.js?v=20261002-fasttools2'];
const PTH_PUBLIC_ASSETS = [...PTH_MINIMAL_SHELL,
  '/js/pending-checkout-storefront.js?v=20261009-session1',
  PTH_SHELL_URL,
  PTH_OFFLINE_URL,
  '/js/secure-data.js?v=20261009-session1',
  '/js/gestor-questionnaire.js?v=20261008-questionnaire2',
  '/js/storefront.min.js?v=20261009-session1',
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
  '/js/pwa.js?v=20261006-ready1',
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

// Repair only missing checked-in public resources. Never clear storage or
// accept URLs/cache names from a page; concurrent retries share one repair.
let pthShellRepair=null;
const PTH_TEMPLATE_VERSION='20261006-ready1';
const PTH_TEMPLATE_DEPENDENCIES={
  '/index.html':[...PTH_NORMAL_BOOT.filter(url=>/\.(?:js|mjs|css)(?:\?|$)/.test(url)),'/js/secure-data.js?v=20261009-session1','/js/pending-checkout.js?v=20261008-orders1'],
  '/offline-catalog.html':['/css/offline-catalog.css?v=20261002-lowdata1','/js/low-connectivity.js?v=20261002-lowdata1','/js/public-catalog-api.js?v=20261002-lowdata1','/js/offline-catalog.js?v=20261002-lowdata2'],
  '/offline-order.html':['/css/tailwind.min.css?v=20261004-rolling30','/css/offline-order.css?v=20261003-pending2','/js/secure-data.js?v=20261009-session1','/js/pending-checkout.js?v=20261008-orders1','/js/checkout-form-shared.js?v=20261003-pending2','/js/offline-checkout-copy.js?v=20261005-copy2','/js/pending-checkout-page.js?v=20261005-cold7'],
  '/offline.html':[]
};
function templateAttribute(tag,name){
  const match=tag.match(new RegExp('(?:^|\\s)'+name+'\\s*=\\s*(?:"([^"]*)"|\'([^\']*)\'|([^\\s"\'=<>`]+))','i'));
  return match?match.slice(1).find(value=>value!==undefined):null;
}
async function compatibleOfflineTemplate(url,response){
  const path=new URL(url,self.location.origin).pathname,required=PTH_TEMPLATE_DEPENDENCIES[path];
  if(!required)return false;
  const html=await response.clone().text(),tags=html.match(/<(?:script|link|meta|base)\b[^>]*>/gi)||[];
  if(!tags.some(tag=>/^<meta\b/i.test(tag)&&templateAttribute(tag,'name')==='pth-offline-shell-version'&&templateAttribute(tag,'content')===PTH_TEMPLATE_VERSION))return false;
  const references=new Set();
  for(const tag of tags){
    if(/^<base\b/i.test(tag)&&templateAttribute(tag,'href')!=='/')return false;
    const script=/^<script\b/i.test(tag),stylesheet=(templateAttribute(tag,'rel')||'').toLowerCase().split(/\s+/).includes('stylesheet');
    if(!script&&!stylesheet)continue;
    const attribute=templateAttribute(tag,script?'src':'href');if(attribute===null)continue;
    let reference;try{reference=new URL(attribute,new URL(url,self.location.origin));}catch(_){return false;}
    if(reference.origin!==self.location.origin){
      // Only the existing optional fonts/icons may be absent offline.
      if(!script&&(reference.origin==='https://fonts.googleapis.com'&&reference.pathname==='/css2'||reference.href==='https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css'))continue;
      return false;
    }
    const key=reference.pathname+reference.search;
    if(key==='/js/google-measurement.js?v=20260928-google-1')continue;
    if(!PTH_MINIMAL_SHELL.includes(key))return false;
    references.add(key);
  }
  return required.every(key=>references.has(key));
}
async function offlineShellStatus(cache) {
  const assets=await Promise.all(PTH_MINIMAL_SHELL.map(url=>cache.match(url)));
  const missing=PTH_MINIMAL_SHELL.filter((_,index)=>!assets[index]);
  let incompatible=false;
  for(let index=0;index<PTH_MINIMAL_SHELL.length;index++)if(assets[index]&&PTH_MINIMAL_SHELL[index].endsWith('.html')&&!await compatibleOfflineTemplate(PTH_MINIMAL_SHELL[index],assets[index]))incompatible=true;
  return {ready:missing.length===0&&!incompatible,version:PTH_CACHE_VERSION,missingCount:missing.length,...(incompatible?{reason:'update'}:{})};
}
function repairOfflineShell() {
  if(pthShellRepair)return pthShellRepair;
  pthShellRepair=(async()=>{
    const cache=await caches.open(PTH_CACHE_VERSION);
    const missing=[];
    for(const url of new Set(PTH_MINIMAL_SHELL))if(!await cache.match(url))missing.push(url);
    let restoredCount=0,updateNeeded=false;
    await Promise.all(missing.map(async url=>{
      const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),12000);
      try{
        const response=await fetch(new Request(new URL(url,self.location.origin),{method:'GET',credentials:'omit',mode:'same-origin',redirect:'error',cache:'reload',signal:controller.signal}));
        if(!response.ok||response.type!=='basic')return;
        const path=new URL(url,self.location.origin).pathname;
        const mime=(response.headers.get('content-type')||'').split(';')[0].trim().toLowerCase();
        const validMime=path.endsWith('.html')?mime==='text/html':/\.(?:js|mjs)$/.test(path)?/^(?:text|application)\/(?:javascript|ecmascript|x-javascript)$/.test(mime):path.endsWith('.css')?mime==='text/css':mime.startsWith('image/');
        if(!validMime)return;
        if(path.endsWith('.html')&&!await compatibleOfflineTemplate(url,response)){updateNeeded=true;return;}
        await cache.put(url,response);restoredCount++;
      }catch(_){/* Keep every existing resource and report the remaining gaps. */}
      finally{clearTimeout(timeout);}
    }));
    return {...await offlineShellStatus(cache),restoredCount,...(updateNeeded?{reason:'update'}:{})};
  })().catch(()=>({ready:false,version:PTH_CACHE_VERSION,reason:'storage'})).finally(()=>{pthShellRepair=null;});
  return pthShellRepair;
}
self.addEventListener('message', event => {
  if (event.data?.type === 'PTH_CHECK_OFFLINE_SHELL') {
    event.waitUntil((async () => {
      const cache = await caches.open(PTH_CACHE_VERSION);
      event.ports?.[0]?.postMessage(await offlineShellStatus(cache));
    })().catch(()=>event.ports?.[0]?.postMessage({ready:false,version:PTH_CACHE_VERSION,reason:'storage'})));
  }
  if(event.data?.type==='PTH_REPAIR_OFFLINE_SHELL')event.waitUntil(repairOfflineShell().then(result=>event.ports?.[0]?.postMessage(result)));
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
