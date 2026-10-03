/* Generated public pages share the storefront's referral reader and last-link policy. */
(function (root) {
 'use strict';
 const A = root.PTHAffiliate, d = root.document;
 if (!A || !d) return;
 const params = new URLSearchParams(root.location.search);
 const referralKeys = ['ref', 'gestor', 'contact', 'tel', 'r', 's'];
 const short = params.get('s');
 const initialMemory = JSON.stringify(A.read());
 let pageRecord = null, pendingShort = short && /^[a-zA-Z0-9_-]{1,128}$/.test(short) ? short : null;
 let storageChanged = false, memorySnapshot = initialMemory;

 function navigationURL(href, record, slug) {
  if (!href || href.startsWith('#')) return href;
  const url = new URL(href, root.location.href);
  if (url.origin !== root.location.origin || !/^\/(?:$|index\.html$|producto\/|categoria\/)/.test(url.pathname)) return href;
  // An explicitly attributed destination is a new link, never overwrite it.
  if (referralKeys.some(key => url.searchParams.has(key))) return href;
  if (slug) url.searchParams.set('s', slug);
  else if (record) return A.link(url, record);
  return url.toString();
 }
 function updateLinks() {
  d.querySelectorAll('a[href]').forEach(link => {
   if (!link.dataset.pthBaseHref) link.dataset.pthBaseHref = link.getAttribute('href');
   link.setAttribute('href', navigationURL(link.dataset.pthBaseHref, pageRecord, pendingShort));
  });
 }
 function cleanVisibleURL() {
  const url = new URL(root.location.href);
  referralKeys.forEach(key => url.searchParams.delete(key));
  root.history.replaceState(root.history.state, '', url.pathname + url.search + url.hash);
 }
 async function resolveShort() {
  const element = d.getElementById('pth-short-links');
  if (!pendingShort || !element) return;
  let timer;
  try {
   const config = JSON.parse(element.textContent);
   const origin = new URL(config.url);
   if (origin.protocol !== 'https:' || !origin.hostname.endsWith('.supabase.co') || typeof config.key !== 'string') return;
   const query = new URLSearchParams({slug: 'eq.' + pendingShort, select: 'original_url,gestor', limit: '1'});
   const controller = new AbortController();
   timer = root.setTimeout(() => controller.abort(), 8000);
   const response = await root.fetch(origin.origin + '/rest/v1/short_links?' + query, {
    headers: {apikey: config.key, Authorization: 'Bearer ' + config.key},
    credentials: 'omit', referrerPolicy: 'no-referrer', signal: controller.signal
   });
   if (!response.ok) return;
   const rows = await response.json(), record = Array.isArray(rows) ? rows[0] : null;
   if (!record) return;
   if (storageChanged || JSON.stringify(A.read()) !== initialMemory) {
    pageRecord = A.read();
    pendingShort = null;
    return;
   }
   let incoming, originalParams;
   try {
    originalParams = new URL(record.original_url, root.location.origin).searchParams;
    incoming = A.incoming('?' + originalParams);
   } catch (_) {}
   if (!incoming && typeof record.gestor === 'string') {
    incoming = A.incoming('?' + new URLSearchParams({gestor: record.gestor,
     contact: originalParams?.get('contact') || originalParams?.get('tel') || ''}));
   }
   if (!incoming) return;
   pageRecord = A.remember(incoming);
   memorySnapshot = JSON.stringify(A.read());
   pendingShort = null;
   cleanVisibleURL();
  } catch (_) {
   // Keep the unresolved short code on local links so another page can retry.
  } finally {
   if (timer) root.clearTimeout(timer);
   updateLinks();
  }
 }
 // Navigation never assigns a customer, sends an order, or touches authentication.
 if (!short) {
  const incoming = A.incoming();
  pageRecord = incoming ? A.remember(incoming) : A.read();
  if (incoming) cleanVisibleURL();
 } else pageRecord = A.read();
 memorySnapshot = JSON.stringify(A.read());
 d.addEventListener('click', () => {
  const current = A.read(), snapshot = JSON.stringify(current);
  if (snapshot === memorySnapshot) return;
  storageChanged = true;
  pendingShort = null;
  pageRecord = current;
  memorySnapshot = snapshot;
  updateLinks();
 }, true);
 root.addEventListener('storage', event => {
  if (event.key !== null && !['pth_referrer_smart', 'pth_referrer'].includes(event.key)) return;
  storageChanged = true;
  pendingShort = null;
  pageRecord = A.read();
  memorySnapshot = JSON.stringify(pageRecord);
  updateLinks();
 });
 updateLinks();
 root.PTHSeoAffiliate = {ready: resolveShort()};
})(window);
