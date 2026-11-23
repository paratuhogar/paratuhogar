/* One public short-link format. No credentials, customer data or long fallback. */
(function (root) {
 'use strict';
 const origin = 'https://paratuhogar.org', code = /^[a-zA-Z0-9_-]{1,128}$/;
 const pending = new Map(), known = new Map();
 let client;
 const unavailable = () => Error('No se pudo preparar el enlace corto. Comprueba la conexión y vuelve a intentarlo.');
 function configure(connection) { if (client !== connection) { pending.clear(); known.clear(); client = connection; } }
 function target(input) {
  const url = new URL(String(input), origin);
  if (url.username || url.password || url.port || url.protocol !== 'https:') throw unavailable();
  if (url.hostname === 'paratuhogar.github.io') {
   if (!/^\/paratuhogar(?:\/|$)/.test(url.pathname)) throw unavailable();
   url.pathname = url.pathname.replace(/^\/paratuhogar(?=\/|$)/, '') || '/';
   url.hostname = 'paratuhogar.org';
  }
  if (url.hostname === 'www.paratuhogar.org') url.hostname = 'paratuhogar.org';
  // Existing technical sheets and legacy public media remain usable. Store
  // referrals themselves must always target our own origin (checked below).
  const media = url.hostname === 'raw.githubusercontent.com' && /^\/paratuhogar\/(?:paratuhogar|paratuhogar-fotos)\//.test(url.pathname) ||
   url.hostname === 'ljqwaovevfatkiigirhf.supabase.co' && url.pathname.startsWith('/storage/v1/object/public/');
  if (url.origin !== origin && !media) throw unavailable();
  return url;
 }
 function checkRef(url, expectedRef) {
  if (expectedRef && (url.origin !== origin || url.searchParams.get('ref') !== expectedRef)) throw Error('El enlace no corresponde a la cuenta seleccionada. Vuelve a intentarlo.');
 }
 function remember(slug, row, url) {
  if (!code.test(slug)) throw unavailable();
  known.set(slug, { row, url:url.href });
  if (known.size > 250) known.delete(known.keys().next().value);
  return origin + '/?s=' + slug;
 }
 async function query(builder) {
  const controller = new AbortController();
  let timer;
  try {
   const request = typeof builder.abortSignal === 'function' ? builder.abortSignal(controller.signal) : builder;
   const result = await Promise.race([Promise.resolve(request), new Promise((_, reject) => {
    timer = root.setTimeout(() => { controller.abort(); reject(unavailable()); }, 8000);
   })]);
   if (result?.error || !result) throw unavailable();
   return result.data;
  } finally { root.clearTimeout(timer); }
 }
 async function resolve(slug) {
  if (!code.test(slug || '') || !client) throw unavailable();
  const cached = known.get(slug);
  if (cached) return cached;
  const row = await query(client.from('short_links').select('slug,original_url,gestor').eq('slug', slug).maybeSingle());
  if (!row?.original_url) throw unavailable();
  const url = target(row.original_url);
  if (url.searchParams.has('s')) throw unavailable(); // Never follow nested/circular redirects.
  remember(slug, row, url); return known.get(slug);
 }
 function slug() {
  const alphabet = 'abcdefghjkmnpqrstuvwxyz23456789', bytes = new Uint32Array(7);
  if (!root.crypto?.getRandomValues) throw unavailable();
  root.crypto.getRandomValues(bytes);
  return Array.from(bytes, value => alphabet[value % alphabet.length]).join('');
 }
 async function shorten(input, { gestor = 'ParaTuHogar', expectedRef = '' } = {}) {
  if (!client) throw unavailable();
  const url = target(input), existingCode = url.searchParams.get('s');
  if (url.searchParams.has('s')) {
   if (url.origin !== origin || url.pathname !== '/' || [...url.searchParams.keys()].length !== 1) throw unavailable();
   const resolved = await resolve(existingCode); checkRef(new URL(resolved.url), expectedRef);
   return origin + '/?s=' + existingCode;
  }
  checkRef(url, expectedRef);
  for (const [key, value] of known) if (value.url === url.href) return origin + '/?s=' + key;
  const owner = String(gestor || 'ParaTuHogar').trim().slice(0, 200), key = owner + '\n' + url.href;
  if (pending.has(key)) return pending.get(key);
  const task = (async () => {
   const row = await query(client.from('short_links').select('slug,original_url,gestor').eq('gestor', owner).eq('original_url', url.href).limit(1).maybeSingle());
   if (row?.slug) {
    const destination = target(row.original_url); checkRef(destination, expectedRef);
    if (destination.href !== url.href || destination.searchParams.has('s')) throw unavailable();
    return remember(row.slug, row, destination);
   }
   for (let attempt = 0; attempt < 3; attempt++) {
    const row = { slug:slug(), original_url:url.href, gestor:owner };
    // Preserve collision codes while still bounding a stalled insert.
    const controller = new AbortController(); let timer;
    try {
     let request = client.from('short_links').insert([row]);
     if (typeof request.abortSignal === 'function') request = request.abortSignal(controller.signal);
     const result = await Promise.race([Promise.resolve(request), new Promise((_, reject) => {
      timer = root.setTimeout(() => { controller.abort(); reject(unavailable()); }, 8000);
     })]);
     if (!result?.error && result) return remember(row.slug, row, url);
     if (result?.error?.code !== '23505') throw unavailable();
    } finally { root.clearTimeout(timer); }
   }
   throw unavailable();
  })().finally(() => pending.delete(key));
  pending.set(key, task); return task;
 }
 root.PTHShortLinks = { configure, target, shorten, resolve };
})(window);
