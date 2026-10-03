/* Public display labels never identify an account. Existing names remain internal keys. */
(function (root) {
 'use strict';
 const uuid = value => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(value || ''));
 const keys = ['pth_referrer_smart', 'pth_referrer'];
 const plain = value => String(value || '').replace(/[<>\x00-\x1f\x7f\u202a-\u202e\u2066-\u2069]/g, '').trim();
 function publicName(profile, fallback = 'ParaTuHogar') {
  if (typeof profile === 'string') profile = { nombre: profile };
  const alias = plain(profile?.nombre_publico);
  return alias ? Array.from(alias).slice(0, 40).join('') : plain(profile?.nombre).split(/\s+/)[0] || fallback;
 }
 const reference = profile => uuid(profile?.id) ? profile.id : profile?.nombre || '';
 function link(input, profile) {
  const url = new URL(input, root.location?.origin || 'https://paratuhogar.org');
  const ref = reference(profile);
  if (ref) { url.searchParams.delete('gestor'); url.searchParams.delete('r'); url.searchParams.set('ref', ref); }
  if (profile?.telefono) url.searchParams.set('contact', String(profile.telefono).replace(/\D/g, ''));
  return url.toString();
 }
 function clear() { for (const key of keys) { try { root.localStorage.removeItem(key); } catch (_) {} } }
 function remember(profile, now = Date.now()) {
  const nombre = profile?.nombre;
  if (typeof nombre !== 'string' || !nombre.trim() || nombre.length > 200) return null;
  const record = { version: 2, nombre, telefono: String(profile.telefono || ''), timestamp: now, expiresAt: null };
  if (uuid(profile.id)) record.id = profile.id;
  if (profile.nombre_publico) record.nombre_publico = publicName(profile);
  for (const key of keys) { try { root.localStorage.setItem(key, JSON.stringify(record)); } catch (_) {} }
  return record;
 }
 function read(now = Date.now()) {
  let raw; try { raw = root.localStorage.getItem(keys[0]) || root.localStorage.getItem(keys[1]); } catch (_) { return null; }
  if (!raw) return null;
  let record; try { record = JSON.parse(raw); } catch (_) { clear(); return null; }
  if (!record || typeof record.nombre !== 'string' || !record.nombre.trim() || record.nombre.length > 200) { clear(); return null; }
  // Expired legacy history cannot be revived by a second, older storage key.
  if (record.expiresAt != null && (!Number.isFinite(Number(record.expiresAt)) || Number(record.expiresAt) <= now)) { clear(); return null; }
  if (record.version !== 2 || record.expiresAt !== null) return remember(record, Number(record.timestamp) || now);
  return record;
 }
 function incoming(search = root.location?.search || '') {
  const params = new URLSearchParams(search);
  let nombre = params.get('ref') || params.get('gestor'), telefono = params.get('contact') || params.get('tel') || '';
  // Legacy opaque fallback is data, never a command or an authentication token.
  const opaque = params.get('r');
  if (!nombre && opaque && opaque.length <= 2048 && /^[a-zA-Z0-9_-]+$/.test(opaque)) {
   try {
    const data = JSON.parse(new TextDecoder().decode(Uint8Array.from(root.atob(opaque.replace(/-/g, '+').replace(/_/g, '/')), char => char.charCodeAt(0))));
    if (typeof data.n === 'string') nombre = data.n;
    if (typeof data.t === 'string') telefono = data.t;
   } catch (_) {}
  }
  return typeof nombre === 'string' && nombre.trim() && nombre.length <= 200 ? { nombre, telefono, ...(uuid(nombre) ? { id: nombre } : {}) } : null;
 }
 function current() {
  return root.gestorName && root.currentUserData?.id ? root.currentUserData : root.activeSalesHierarchy?.agent || read();
 }
 root.PTHAffiliate = { uuid, publicName, reference, link, read, remember, clear, incoming, current };
})(window);
