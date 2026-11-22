/* Public personal links only. Verified sessions authorize selection; QR generation is local. */
(function (root) {
  'use strict';
  if (root.PTHPersonalQR) return;
  const doc = root.document;
  const vendorURL = new URL('vendor/qrcode-generator-2.0.4.js', doc.currentScript?.src || new URL('/js/personal-qr.js', root.location.href)).href;
  const columns = 'id,nombre,nombre_publico,estado,activo,parent_id';
  const adminRoles = new Set(['admin', 'administrador', 'superadmin']);
  const uuid = value => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(value || ''));
  const active = profile => !!profile && profile.estado === 'activo' && profile.activo !== false;
  const commercial = profile => uuid(profile?.id) && active(profile) && profile.rol !== 'mensajero' && profile.rol !== 'logistica';
  const administrator = profile => commercial(profile) && !profile.parent_id && adminRoles.has(String(profile.rol).toLowerCase());
  const clean = value => String(value || '').replace(/[<>\x00-\x1f\x7f\u202a-\u202e\u2066-\u2069]/g, '').trim();
  const name = profile => root.PTHAffiliate?.publicName(profile) || clean(profile?.nombre_publico || profile?.nombre).split(/\s+/)[0] || 'ParaTuHogar';
  let dialog, title, content, status, opener, context = null, generation = 0, searchVersion = 0;
  let identity = '', expiryTimer = null, watchTimer = null, encoder = null, loadingEncoder = null;

  function node(tag, className, text) {
    const element = doc.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
  }
  function button(label, action, className = '') {
    const element = node('button', 'pth-qr-button ' + className, label);
    element.type = 'button';
    element.addEventListener('click', () => { void Promise.resolve().then(action).catch(() => { if (dialog?.open) status.textContent = 'No se pudo completar la acción. Vuelve a intentar.'; }); });
    return element;
  }
  function saved() {
    try {
      const profile = JSON.parse(root.localStorage.getItem('pth_session') || 'null')?.data;
      const token = root.PTHSecureData?.token();
      const expires = Number(root.localStorage.getItem('pth_secure_token_expires_at'));
      return token && commercial(profile) && expires > Date.now() ? { profile, token, expires } : null;
    } catch (_) { return null; }
  }
  function key() {
    const current = saved(), shown = root.currentUserData;
    return current ? JSON.stringify([current.token, current.profile.id, current.profile.rol, current.profile.parent_id || null,
      current.profile.estado, current.profile.activo, shown?.id || null, shown?.rol || null, shown?.parent_id || null, shown?.estado || null, shown?.activo]) : '';
  }
  function erase(restoreFocus = true) {
    generation++; searchVersion++; context = null;
    if (watchTimer !== null) root.clearInterval(watchTimer);
    watchTimer = null;
    content?.replaceChildren(); if (status) status.textContent = '';
    if (dialog?.open) dialog.close();
    const target = opener; opener = null;
    if (restoreFocus && target?.isConnected && !target.hidden) target.focus({ preventScroll:true });
  }
  function ensureDialog() {
    if (dialog) return;
    dialog = node('dialog', 'pth-qr-dialog'); dialog.id = 'pth-personal-qr-dialog';
    dialog.setAttribute('aria-labelledby', 'pth-personal-qr-title');
    const header = node('header', 'pth-qr-header');
    const heading = node('div'); heading.append(node('p', 'pth-qr-brand', 'ParaTuHogar · enlace personal'));
    title = node('h2', '', 'Mi QR'); title.id = 'pth-personal-qr-title'; title.tabIndex = -1;
    heading.append(title); header.append(heading, button('Cerrar', () => erase(), 'pth-qr-close'));
    content = node('div', 'pth-qr-content'); content.id = 'pth-personal-qr-content';
    status = node('p', 'pth-qr-status'); status.id = 'pth-personal-qr-status'; status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite');
    dialog.append(header, content, status); doc.body.append(dialog);
    dialog.addEventListener('cancel', event => { event.preventDefault(); erase(); });
    dialog.addEventListener('close', () => { if (!dialog.open) erase(); });
    dialog.addEventListener('keydown', event => {
      if (event.key !== 'Tab') return;
      const controls = [...dialog.querySelectorAll('button:not(:disabled), a[href], input:not(:disabled), [tabindex="0"]')]
        .filter(element => !element.hidden && element.getClientRects().length);
      const first = controls[0], last = controls[controls.length - 1];
      if (!first) { event.preventDefault(); title.focus(); }
      else if (event.shiftKey && (doc.activeElement === first || doc.activeElement === title)) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && doc.activeElement === last) { event.preventDefault(); first.focus(); }
    });
  }
  function begin(mode) {
    sync(); ensureDialog();
    generation++; searchVersion++; context = null; content.replaceChildren(); status.textContent = 'Verificando la cuenta…';
    if (!dialog.open) opener = doc.activeElement === doc.body ? null : doc.activeElement;
    if (!dialog.open) dialog.showModal();
    title.textContent = mode === 'admin' ? 'QR de gestores' : 'Mi QR'; title.focus({ preventScroll:true });
    if (watchTimer === null) watchTimer = root.setInterval(sync, 500);
    return { version:generation, key:key(), mode };
  }
  const current = request => dialog?.open && request.version === generation && request.key && request.key === key();
  async function actorFor(request) {
    const security = root.PTHSecureData, token = security?.token();
    if (!token || !request.key || typeof security.refresh !== 'function') throw Error('Inicia sesión para generar tu QR.');
    const actor = await security.refresh();
    if (!current(request) || token !== security.token()) return null;
    if (!commercial(actor)) throw Error('La cuenta no está activa para generar un QR.');
    if (actor.id !== saved()?.profile.id) throw Error('La sesión cambió. Vuelve a abrir el QR.');
    if (request.mode === 'admin' && !administrator(actor)) throw Error('Esta cuenta no tiene acceso a los QR de otros gestores.');
    return actor;
  }
  function client() {
    const connection = typeof supabaseClient !== 'undefined' ? supabaseClient : root.supabaseClient;
    if (!connection?.__pthSecure) throw Error('No se pudo verificar la cuenta. Recarga e intenta de nuevo.');
    return connection;
  }
  function accountQuery(token) {
    const query = client().from('gestores').select(columns);
    if (typeof query.forSession !== 'function') throw Error('No se pudo verificar la sesión. Recarga e intenta de nuevo.');
    return query.forSession(token);
  }
  async function verifiedAccount(id, actor, request) {
    if (!uuid(id) || id !== actor.id && !administrator(actor)) throw Error('Solo puedes generar el QR de tu propia cuenta.');
    const result = await accountQuery(root.PTHSecureData.token()).eq('id', id).maybeSingle();
    if (!current(request)) return null;
    if (result.error || !result.data || result.data.id !== id) throw Error('No se pudo verificar la cuenta. Cierra y vuelve a intentar.');
    if (!active(result.data)) throw Error('Esta cuenta está inactiva. No se puede generar un QR nuevo.');
    return result.data;
  }
  function personalLink(account) {
    // Pass only the UUID: affiliate helpers also support phone and legacy names,
    // neither of which belongs in this public QR payload.
    if (!uuid(account.id) || !root.PTHAffiliate?.link) throw Error('No se pudo preparar el enlace personal. Recarga e intenta de nuevo.');
    const link = root.PTHAffiliate.link('https://paratuhogar.org/', { id:account.id });
    const url = new URL(link);
    if (url.protocol !== 'https:' || url.hostname !== 'paratuhogar.org' || url.pathname !== '/' || url.username || url.password || url.hash ||
      url.searchParams.get('ref') !== account.id || [...url.searchParams.keys()].length !== 1) throw Error('No se pudo verificar el enlace personal.');
    return url.href;
  }
  function loadEncoder() {
    if (encoder) return Promise.resolve(encoder);
    if (loadingEncoder) return loadingEncoder;
    loadingEncoder = new Promise((resolve, reject) => {
      const script = doc.createElement('script'); script.src = vendorURL; script.async = true;
      let timeout;
      const fail = () => { root.clearTimeout(timeout); script.remove(); loadingEncoder = null; reject(Error('No se pudo cargar el QR.')); };
      script.onerror = fail;
      script.onload = () => {
        root.clearTimeout(timeout);
        if (typeof root.qrcode !== 'function') { fail(); return; }
        encoder = root.qrcode; resolve(encoder);
      };
      timeout = root.setTimeout(fail, 15000); doc.head.append(script);
    });
    return loadingEncoder;
  }
  function pngCanvas(encode, link) {
    const matrix = encode(0, 'M'); matrix.addData(link, 'Byte'); matrix.make();
    const modules = matrix.getModuleCount(), scale = Math.floor(1024 / (modules + 8));
    const offset = Math.floor((1024 - modules * scale) / 2);
    const canvas = node('canvas', 'pth-qr-code'); canvas.width = 1024; canvas.height = 1024;
    canvas.setAttribute('role', 'img'); canvas.setAttribute('aria-label', 'QR del enlace personal; también disponible como texto debajo');
    const brush = canvas.getContext('2d');
    if (!brush) throw Error('El navegador no pudo dibujar el QR.');
    brush.fillStyle = '#ffffff'; brush.fillRect(0, 0, 1024, 1024); brush.fillStyle = '#102b4e';
    for (let row = 0; row < modules; row++) for (let column = 0; column < modules; column++) {
      if (matrix.isDark(row, column)) brush.fillRect(offset + column * scale, offset + row * scale, scale, scale);
    }
    return canvas;
  }
  async function renderQR(request, account) {
    if (!current(request)) return;
    const link = personalLink(account);
    context = { request, accountId:account.id, link, png:null, canvas:null };
    content.replaceChildren();
    const accountName = node('h3', 'pth-qr-name', name(account)); accountName.id = 'pth-personal-qr-name';
    const stage = node('div', 'pth-qr-stage'); stage.setAttribute('aria-busy', 'true');
    const linkText = node('a', 'pth-qr-link', link); linkText.id = 'pth-personal-qr-link'; linkText.href = link; linkText.target = '_blank'; linkText.rel = 'noopener noreferrer';
    const actions = node('div', 'pth-qr-actions');
    const download = button('Descargar PNG', () => downloadPNG(request), 'pth-qr-primary'); download.id = 'pth-personal-qr-download'; download.disabled = true;
    const copy = button('Copiar enlace', async () => {
      if (!current(request) || !context) return;
      try { await root.navigator.clipboard.writeText(link); if (current(request)) status.textContent = 'Enlace copiado.'; }
      catch (_) { if (current(request)) status.textContent = 'No se pudo copiar. Selecciona el enlace de arriba y cópialo.'; }
    });
    actions.append(download, copy);
    content.append(accountName, node('p', 'pth-qr-caption', 'Escanea para abrir la tienda con este enlace personal.'), stage, linkText, actions);
    if (request.mode === 'admin') content.append(button('Elegir otra cuenta', () => openAdmin(), 'pth-qr-secondary'));
    status.textContent = 'Preparando QR…';
    try {
      const encode = await loadEncoder(); if (!current(request)) return;
      const canvas = pngCanvas(encode, link); stage.replaceChildren(canvas); stage.setAttribute('aria-busy', 'false');
      const png = await new Promise((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(Error('No se pudo preparar el PNG.')), 'image/png'));
      if (!current(request)) return;
      context.png = png; context.canvas = canvas; download.disabled = false; status.textContent = 'PNG de 1024 × 1024, listo para guardar o imprimir.';
      const file = new File([png], filename(account.id), { type:'image/png' });
      if (root.navigator.share && root.navigator.canShare?.({ files:[file] })) {
        actions.append(button('Compartir PNG', async () => {
          if (!current(request) || !context?.png) return;
          try { await root.navigator.share({ files:[file], title:'ParaTuHogar · ' + name(account) }); if (current(request)) status.textContent = 'Compartido.'; }
          catch (error) { if (current(request)) status.textContent = error?.name === 'AbortError' ? 'Se canceló la acción. Puedes descargar el PNG.' : 'No se pudo compartir. Puedes descargar el PNG.'; }
        }, 'pth-qr-secondary'));
      }
    } catch (_) {
      if (!current(request)) return;
      stage.replaceChildren(); stage.setAttribute('aria-busy', 'false');
      status.textContent = 'No se pudo preparar el QR. El enlace sigue disponible; comprueba la conexión y reintenta.';
      stage.append(button('Reintentar QR', () => selectAccount(account.id, request.mode)));
    }
  }
  const filename = id => 'paratuhogar-qr-' + id + '.png';
  function downloadPNG(request) {
    if (!current(request) || !context?.png) { sync(); return; }
    const url = root.URL.createObjectURL(context.png), anchor = node('a');
    anchor.href = url; anchor.download = filename(context.accountId); doc.body.append(anchor); anchor.click(); anchor.remove();
    root.setTimeout(() => root.URL.revokeObjectURL(url), 1000);
    // Browsers cannot confirm the save picker outcome. Do not claim completion.
    status.textContent = 'El navegador gestiona la descarga. Si la cancelas, puedes volver a intentarlo.';
  }
  async function selectAccount(id, mode = 'own') {
    const request = begin(mode);
    try {
      const actor = await actorFor(request); if (!actor) return false;
      const account = await verifiedAccount(id || actor.id, actor, request); if (!account) return false;
      await renderQR(request, account); return current(request);
    } catch (error) { if (dialog.open && request.version === generation) status.textContent = error.message || 'No se pudo abrir el QR. Vuelve a intentar.'; return false; }
  }
  async function openAdmin() {
    const request = begin('admin');
    try {
      const actor = await actorFor(request); if (!actor) return false;
      const form = node('form', 'pth-qr-search'), label = node('label', '', 'Buscar cuenta');
      const input = node('input'); input.type = 'search'; input.maxLength = 80; input.setAttribute('aria-label', 'Buscar cuenta'); input.placeholder = 'Nombre de cuenta o nombre público'; label.append(input);
      const submit = node('button', 'pth-qr-button', 'Buscar'); submit.type = 'submit'; form.append(label, submit);
      const list = node('div', 'pth-qr-accounts');
      const more = button('Mostrar más cuentas', () => search(false), 'pth-qr-secondary'); more.hidden = true;
      content.append(node('p', 'pth-qr-caption', 'Elige la cuenta cuyo enlace quieres compartir. Las cuentas inactivas no generan QR.'), form, list, more);
      let offset = 0, searchTerm = '';
      async function search(reset = true) {
        const version = ++searchVersion;
        if (reset) { offset = 0; list.replaceChildren(); }
        // PostgREST filter syntax is not user input. Keep only plain name text.
        const term = clean(input.value).replace(/[^\p{L}\p{N}\s-]/gu, '').slice(0, 80);
        if (reset) searchTerm = term;
        more.hidden = true; status.textContent = 'Buscando cuentas…';
        try {
          let query = accountQuery(root.PTHSecureData.token()).order('nombre', { ascending:true }).order('id', { ascending:true }).range(offset, offset + 25);
          if (searchTerm) query = query.or('nombre.ilike.*' + searchTerm + '*,nombre_publico.ilike.*' + searchTerm + '*');
          const result = await query;
          if (!current(request) || version !== searchVersion) return;
          if (result.error || !Array.isArray(result.data)) throw Error('No se pudieron consultar las cuentas. Pulsa Buscar para reintentar.');
          const rows = result.data.filter(account => uuid(account?.id));
          for (const account of rows.slice(0, 25)) {
            const row = node('div', 'pth-qr-account');
            const choice = button(name(account), () => selectAccount(account.id, 'admin')); choice.disabled = !active(account);
            row.append(choice, node('span', 'pth-qr-account-state', active(account) ? account.parent_id ? 'Subgestor' : 'Gestor' : 'Cuenta inactiva'));
            list.append(row);
          }
          offset += 25; more.hidden = rows.length < 26;
          status.textContent = list.children.length ? 'Selecciona una cuenta para ver su QR.' : 'No hay cuentas que coincidan con la búsqueda.';
        } catch (error) { if (current(request) && version === searchVersion) status.textContent = error.message; }
      }
      form.addEventListener('submit', event => { event.preventDefault(); void search(); });
      await search(); return current(request);
    } catch (error) { if (dialog.open && request.version === generation) status.textContent = error.message || 'No se pudo abrir la selección. Vuelve a intentar.'; return false; }
  }
  function mountEntry(id, parent, label, allowed, action, after) {
    const existing = doc.getElementById(id);
    if (!allowed) { existing?.remove(); return; }
    if (existing || !parent) return;
    const entry = button(label, action, 'pth-qr-entry'); entry.id = id;
    if (after) after.insertAdjacentElement('afterend', entry); else parent.append(entry);
  }
  function sync() {
    const next = saved(), nextKey = key();
    if (identity !== nextKey) { erase(); identity = nextKey; }
    const personalLinkButton = doc.querySelector('[data-personal-link], [onclick*="copyGestorStoreLink"]');
    mountEntry('pth-personal-qr-open', personalLinkButton?.parentElement, 'Mi QR', !!next, () => selectAccount(null), personalLinkButton);
    mountEntry('pth-personal-qr-admin-open', doc.getElementById('admin-master-nav'), 'QR de gestores', administrator(next?.profile), openAdmin);
    if (expiryTimer !== null) root.clearTimeout(expiryTimer);
    expiryTimer = next ? root.setTimeout(sync, Math.min(2147483647, Math.max(1, next.expires - Date.now()))) : null;
  }
  root.PTHPersonalQR = { openOwn:() => selectAccount(null), openAdmin, openAccount:account => selectAccount(account?.id, account?.id === saved()?.profile.id ? 'own' : 'admin'), sync };
  root.addEventListener('pth:session-changed', sync);
  root.addEventListener('storage', event => { if (!event.key || ['pth_session', 'pth_secure_token', 'pth_secure_token_expires_at'].includes(event.key)) sync(); });
  root.addEventListener('pagehide', () => erase(false));
  root.addEventListener('focus', sync);
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', sync, { once:true }); else sync();
})(window);
