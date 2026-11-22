/* Private points views. Local identity controls presentation only; the gateway authorizes every request. */
(function (root) {
  'use strict';
  const doc = root.document;
  const adminRoles = new Set(['admin', 'administrador', 'superadmin']);
  const uncertainCodes = new Set(['NETWORK_ERROR', 'REQUEST_TIMEOUT', 'SERVICE_UNAVAILABLE', 'INVALID_RESPONSE']);
  const number = value => new Intl.NumberFormat('es').format(Number(value) || 0);
  const operationKey = () => Array.from(root.crypto.getRandomValues(new Uint8Array(32)), byte => byte.toString(16).padStart(2, '0')).join('');
  let identity = '', generation = 0, expiryTimer = null, dialog, title, status, networkNote, content, opener;
  let currentProfile = null;

  function element(tag, className, text) {
    const node = doc.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }
  function button(text, action, className = '') {
    const node = element('button', 'pth-points-button ' + className, text);
    node.type = 'button';
    if (action) node.addEventListener('click', action);
    return node;
  }
  function profile() {
    try {
      const saved = JSON.parse(root.localStorage.getItem('pth_session') || 'null')?.data;
      const token = root.localStorage.getItem('pth_secure_token');
      const expires = Number(root.localStorage.getItem('pth_secure_token_expires_at'));
      if (!saved?.id || !token || saved.activo === false || saved.estado && saved.estado !== 'activo' || expires && expires <= Date.now()) return null;
      return { ...saved, token, expires };
    } catch (_) { return null; }
  }
  const ownerKey = p => p ? JSON.stringify([p.id, p.token, p.rol, p.parent_id || null]) : '';
  const isAdmin = p => !!p && !p.parent_id && adminRoles.has(String(p.rol || '').toLowerCase());
  function erase() {
    generation++;
    if (!dialog) return;
    content.replaceChildren(); status.textContent = ''; networkNote.textContent = '';
    if (dialog.open) dialog.close();
  }
  function sync() {
    const next = profile(), key = ownerKey(next);
    if (key !== identity) { erase(); identity = key; }
    currentProfile = next;
    mountEntry('pth-points-open', 'Mis puntos', doc.getElementById('btn-dash-resumen')?.parentElement, !!next, () => open(false));
    mountEntry('pth-points-admin-open', 'Puntos de gestores', doc.getElementById('sec-admin') || doc.getElementById('sec-admin-master'), isAdmin(next), () => open(true));
    if (expiryTimer !== null) root.clearTimeout(expiryTimer);
    expiryTimer = next?.expires ? root.setTimeout(sync, Math.min(2147483647, Math.max(1, next.expires - Date.now()))) : null;
    return next;
  }
  function mountEntry(id, text, parent, allowed, action) {
    const existing = doc.getElementById(id);
    if (!allowed) { existing?.remove(); return; }
    if (!existing && parent) {
      const entry = button(text, action, 'pth-points-entry'); entry.id = id;
      if (id === 'pth-points-admin-open' && parent.firstElementChild) parent.firstElementChild.after(entry);
      else parent.append(entry);
    }
  }
  function ensureDialog() {
    if (dialog) return;
    dialog = element('dialog', 'pth-points-dialog'); dialog.id = 'pth-points-dialog';
    dialog.setAttribute('aria-labelledby', 'pth-points-title');
    const header = element('header', 'pth-points-header');
    const heading = element('div'); heading.append(element('p', 'pth-points-eyebrow', 'ParaTuHogar · Programa de puntos'));
    title = element('h2'); title.id = 'pth-points-title'; heading.append(title);
    const close = button('Cerrar', () => dialog.close(), 'pth-points-close'); close.setAttribute('aria-label', 'Cerrar puntos');
    header.append(heading, close);
    networkNote = element('p', 'pth-points-notice'); networkNote.setAttribute('role', 'status'); networkNote.hidden = true;
    status = element('p', 'pth-points-status'); status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite');
    content = element('div', 'pth-points-content');
    dialog.append(header, networkNote, status, content); doc.body.append(dialog);
    dialog.addEventListener('close', () => { if (opener?.isConnected) opener.focus(); });
    // A native modal supplies keyboard containment and Escape; no custom focus trap.
  }
  function connection() {
    if (!dialog) return;
    const offline = root.navigator.onLine === false;
    networkNote.hidden = false;
    networkNote.textContent = offline
      ? 'Sin conexión. Los puntos no se han actualizado. No puedes registrar cambios.'
      : 'Conexión recuperada. Los puntos no se han actualizado; usa Actualizar para consultar.';
    for (const control of dialog.querySelectorAll('[data-points-write]')) control.disabled = offline || control.dataset.busy === 'true';
  }
  function setStatus(message, error = false) {
    status.textContent = message; status.classList.toggle('pth-points-error', error);
  }
  function valid(stamp, key) {
    if (ownerKey(profile()) !== key) { sync(); return false; }
    return generation === stamp && identity === key;
  }
  async function request(body) {
    const stamp = generation, key = identity;
    if (!key || !valid(stamp, key)) throw Object.assign(Error('La sesión cambió.'), { stale: true });
    if (root.navigator.onLine === false) throw Object.assign(Error('Sin conexión. Conéctate y vuelve a intentarlo.'), { code: 'OFFLINE' });
    let result;
    try {
      if (!root.PTHSecureData?.pointsWallet) throw Error('La sección de puntos no está disponible. Actualiza la página.');
      result = await root.PTHSecureData.pointsWallet(body);
    } catch (error) {
      if (!valid(stamp, key)) throw Object.assign(Error('La sesión cambió.'), { stale: true });
      throw Object.assign(Error(error.message || 'No se pudo conectar.'), { code: error.code || 'NETWORK_ERROR' });
    }
    if (!valid(stamp, key)) throw Object.assign(Error('La sesión cambió.'), { stale: true });
    if (result?.error) {
      if (['SESSION_CHANGED', 'SESSION_EXPIRED'].includes(result.error.code) || result.error.status === 401) {
        erase();
        throw Object.assign(Error('La sesión cambió. Vuelve a abrir los puntos.'), { stale: true });
      }
      throw Object.assign(Error(result.error.message || 'No se pudo completar la operación.'), result.error);
    }
    if (!result || !result.data || typeof result.data !== 'object') throw Object.assign(Error('La respuesta no se pudo confirmar.'), { code: 'INVALID_RESPONSE' });
    return result.data;
  }
  function open(admin) {
    const p = sync();
    if (!p || admin && !isAdmin(p)) return false;
    ensureDialog(); generation++; opener = doc.activeElement;
    title.textContent = admin ? 'Puntos de gestores' : 'Mis puntos';
    content.replaceChildren(); setStatus(''); networkNote.hidden = true;
    if (!dialog.open) dialog.showModal();
    if (root.navigator.onLine === false) connection();
    if (admin) renderAdmin();
    else {
      const host = element('section'); content.append(host);
      const view = summaryView(host);
      content.prepend(button('Actualizar puntos', () => view.refresh(), 'pth-points-refresh'));
    }
    return true;
  }
  function date(value) {
    const parsed = new Date(value);
    return Number.isFinite(parsed.getTime()) ? parsed.toLocaleString('es', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Fecha no disponible';
  }
  function summaryView(host, beneficiary, administrative = false, onSummary) {
    let sequence = 0, offset = null, list, more, loading = false;
    const error = element('p', 'pth-points-error'); error.setAttribute('role', 'alert');
    async function load(append = false) {
      if (loading && append) return;
      const ticket = ++sequence; loading = true;
      if (!append) { host.replaceChildren(element('p', 'pth-points-muted', 'Cargando puntos…')); onSummary?.(null); }
      if (more) more.disabled = true;
      try {
        const data = await request({ operation: 'summary', ...(beneficiary ? { beneficiaryId: beneficiary.id } : {}), offset: append ? offset : 0 });
        if (ticket !== sequence || !host.isConnected) return;
        if (!append) {
          host.replaceChildren();
          host.append(element('p', 'pth-points-account-name', data.beneficiary?.name || beneficiary?.name || currentProfile.nombre));
          const totals = element('div', 'pth-points-totals');
          const earned = element('div', 'pth-points-earned');
          earned.append(element('span', 'pth-points-metric-label', 'Puntos ganados'));
          const balance = element('strong', 'pth-points-balance', number(data.balance)); balance.id = 'pth-points-balance';
          earned.append(balance, element('span', 'pth-points-muted', 'Saldo del historial'));
          totals.append(earned);
          for (const [value, label, style] of [[data.pending, 'Pendientes de validar', 'pending'], [data.reversed, 'Revertidos', 'reversed']]) {
            const metric = element('div', 'pth-points-metric pth-points-' + style);
            metric.append(element('strong', '', number(value)), element('span', '', label)); totals.append(metric);
          }
          host.append(totals);
          host.append(element('p', 'pth-points-explainer', data.enabled
            ? 'Las ventas suman puntos al estar entregadas y conciliadas. Los pendientes todavía no forman parte del saldo.'
            : 'El programa no está activo para ventas nuevas. Los movimientos y obligaciones anteriores se conservan.'));
          host.append(element('p', 'pth-points-consulted', 'Última consulta: ' + date(new Date().toISOString())));
          host.append(element('h3', 'pth-points-section-title', 'Historial de movimientos'));
          list = element('ol', 'pth-points-ledger'); host.append(list);
          more = button('Ver más movimientos', () => load(true), 'pth-points-more'); host.append(more, error);
          onSummary?.(data);
        }
        error.textContent = '';
        for (const item of data.movements || []) renderMovement(list, item, beneficiary || data.beneficiary, administrative, () => load());
        if (!list.children.length) list.append(element('li', 'pth-points-empty', 'Todavía no tienes movimientos. Aquí aparecerán tus puntos cuando se validen.'));
        offset = data.nextOffset; more.hidden = offset === null || offset === undefined; more.disabled = false;
      } catch (failure) {
        if (failure.stale || ticket !== sequence || !host.isConnected) return;
        if (!append) host.replaceChildren(error);
        error.textContent = failure.message;
        if (more) more.disabled = false;
      } finally { if (ticket === sequence) loading = false; }
    }
    load(); return { refresh: () => load() };
  }
  function renderMovement(list, item, beneficiary, administrative, refresh) {
    const row = element('li', 'pth-points-movement');
    const meta = element('div', 'pth-points-movement-meta');
    const labels = { manual_credit: 'Reconocimiento', manual_grant: 'Reconocimiento', manual: 'Reconocimiento', sale: 'Venta validada', earned: 'Venta validada', sale_credit: 'Venta validada', reversal: 'Reverso', sale_restore: 'Puntos restaurados', restored: 'Puntos restaurados', restoration: 'Puntos restaurados' };
    meta.append(element('h4', '', labels[item.kind] || (item.points < 0 ? 'Reverso' : 'Puntos ganados')));
    const time = element('time', 'pth-points-muted', date(item.createdAt)); time.dateTime = item.createdAt; meta.append(time);
    if (item.orderReference) meta.append(element('span', 'pth-points-reference', item.orderReference));
    meta.append(element('p', 'pth-points-reason', item.reason || 'Sin motivo adicional'));
    if (item.reversalOf) meta.append(element('p', 'pth-points-muted', 'Corrige un movimiento anterior.'));
    const amount = element('strong', item.points < 0 ? 'pth-points-amount pth-points-negative' : 'pth-points-amount', (item.points > 0 ? '+' : '') + number(item.points));
    row.append(meta, amount); list.append(row);
    if (administrative && item.points > 0 && ['manual_credit', 'manual_grant', 'manual', 'grant'].includes(item.kind) && !item.reversalOf) {
      const reverse = button('Revertir reconocimiento', () => {
        if (row.querySelector('form')) return;
        const form = element('form', 'pth-points-form pth-points-reverse-form');
        const reason = field(form, 'Motivo del reverso', 'textarea'); reason.required = true; reason.maxLength = 1000;
        transaction(form, {
          review: 'Revisar reverso', confirm: 'Confirmar reverso', retry: 'Reintentar reverso', success: 'Reverso registrado.',
          payload: () => ({ operation: 'reverse', movementId: item.id, reason: requiredReason(reason) }),
          description: body => `${beneficiary.name} · ${number(item.points)} puntos. Motivo: ${body.reason}`,
          complete: () => { refresh(); }
        });
        row.append(form); reason.focus();
      }, 'pth-points-link');
      meta.append(reverse);
    }
  }
  function field(form, labelText, tag = 'input', type = 'text') {
    const label = element('label', 'pth-points-field'); label.append(element('span', '', labelText));
    const input = element(tag); if (tag === 'input') input.type = type;
    input.setAttribute('aria-label', labelText);
    label.append(input); form.append(label); return input;
  }
  function requiredReason(input) {
    const reason = input.value.trim();
    if (!reason || reason.length > 1000) throw Error('Escribe un motivo de hasta 1000 caracteres.');
    return reason;
  }
  function integer(input, minimum) {
    const raw = input.value.trim(), value = Number(raw);
    if (!/^\d+$/.test(raw) || !Number.isSafeInteger(value) || value < minimum || value > 2147483647) throw Error(minimum ? 'Indica una cantidad entera de puntos mayor que cero.' : 'Indica cero o una cantidad entera positiva.');
    return value;
  }
  function transaction(form, config) {
    let pending = null, busy = false, reviewBox = null;
    const message = element('p', 'pth-points-error'); message.setAttribute('role', 'alert');
    const review = element('button', 'pth-points-button pth-points-primary', config.review); review.type = 'submit';
    form.append(message, review);
    const unlock = () => { for (const input of form.querySelectorAll('input,textarea,select')) input.disabled = false; };
    async function execute(confirm) {
      if (busy || !pending || !form.isConnected) return;
      if (root.navigator.onLine === false) { connection(); return; }
      busy = true; confirm.disabled = true; confirm.dataset.busy = 'true'; message.textContent = 'Registrando…';
      try {
        const data = await request(pending.body);
        if (!form.isConnected) return;
        unlock(); pending = null; reviewBox.remove(); reviewBox = null; review.hidden = false;
        message.textContent = ''; setStatus(config.success);
        if (config.complete) config.complete(data);
      } catch (failure) {
        if (failure.stale || !form.isConnected) return;
        const uncertain = uncertainCodes.has(failure.code);
        message.textContent = uncertain ? 'No se pudo confirmar el resultado. Reintenta este mismo reconocimiento o cambio; no se enviará automáticamente.' : failure.message;
        if (uncertain) {
          for (const input of form.querySelectorAll('input,textarea,select')) input.disabled = true;
          reviewBox?.querySelector('[data-points-edit]')?.setAttribute('hidden', '');
        }
        confirm.textContent = uncertain ? config.retry : config.confirm;
      } finally {
        busy = false; confirm.dataset.busy = 'false'; confirm.disabled = root.navigator.onLine === false;
      }
    }
    form.addEventListener('submit', event => {
      event.preventDefault(); if (busy || !form.reportValidity()) return;
      try {
        const body = config.payload(), fingerprint = JSON.stringify(body);
        if (!pending || pending.fingerprint !== fingerprint) pending = { fingerprint, body: { ...body, idempotencyKey: operationKey() } };
        reviewBox?.remove(); reviewBox = element('div', 'pth-points-confirm');
        reviewBox.append(element('p', '', config.description(body)));
        const confirm = button(config.confirm, () => execute(confirm), 'pth-points-primary'); confirm.dataset.pointsWrite = '';
        confirm.disabled = root.navigator.onLine === false;
        const back = button('Volver a editar', () => { if (!busy) { reviewBox.remove(); reviewBox = null; review.hidden = false; message.textContent = ''; } }, 'pth-points-link');
        back.dataset.pointsEdit = '';
        reviewBox.append(confirm, back); form.append(reviewBox); review.hidden = true; message.textContent = ''; confirm.focus();
      } catch (failure) { message.textContent = failure.message; }
    });
  }
  function paged(parent, operation, renderRow, moreLabel, searchInput) {
    let sequence = 0, next = null, search = '', busy = false;
    const list = element('div', 'pth-points-list');
    const message = element('p', 'pth-points-muted'); message.setAttribute('role', 'status');
    const more = button(moreLabel, () => load(true), 'pth-points-more'); more.hidden = true;
    const retry = button('Reintentar consulta', () => load(false), 'pth-points-link'); retry.hidden = true;
    parent.append(message, list, more, retry);
    async function load(append = false) {
      if (busy && append) return;
      const ticket = ++sequence; busy = true; more.disabled = true; retry.hidden = true;
      if (!append) { search = searchInput?.value.trim() || ''; list.replaceChildren(); message.textContent = 'Cargando…'; }
      try {
        const data = await request({ operation, offset: append ? next : 0, ...(searchInput ? { search } : {}) });
        if (!parent.isConnected || ticket !== sequence) return;
        for (const row of data.rows || []) renderRow(list, row);
        message.textContent = list.children.length ? '' : operation === 'issues' ? 'No hay ventas por revisar.' : 'No se encontraron resultados. Prueba otra búsqueda.';
        next = data.nextOffset; more.hidden = next === null || next === undefined;
      } catch (failure) {
        if (!failure.stale && parent.isConnected && ticket === sequence) { message.textContent = failure.message; retry.hidden = false; }
      } finally { if (ticket === sequence) { busy = false; more.disabled = false; } }
    }
    load(); return { refresh: () => load() };
  }
  function renderAdmin() {
    const nav = element('nav', 'pth-points-tabs'); nav.setAttribute('aria-label', 'Herramientas de puntos');
    const settings = element('p', 'pth-points-muted', 'Consultando estado del programa…');
    const workspace = element('section', 'pth-points-workspace');
    content.append(nav, settings, workspace);
    const tabs = [ ['Cuentas', () => accounts(workspace)], ['Reglas por producto', () => rules(workspace)], ['Ventas por revisar', () => issues(workspace)] ];
    for (const [label, render] of tabs) {
      const tab = button(label, () => { workspace.replaceChildren(); for (const sibling of nav.children) sibling.setAttribute('aria-pressed', String(sibling === tab)); setStatus(''); render(); });
      tab.setAttribute('aria-pressed', String(!nav.children.length)); nav.append(tab);
    }
    request({operation:'settings'}).then(data => {
      if (settings.isConnected) settings.textContent = data.enabled ? 'Programa activo para ventas nuevas.' : 'Programa detenido para ventas nuevas. El historial se conserva.';
    }).catch(failure => { if (!failure.stale && settings.isConnected) settings.textContent = 'No se pudo consultar el estado del programa.'; });
    accounts(workspace);
  }
  function searchForm(parent, label, action) {
    const form = element('form', 'pth-points-search');
    const input = field(form, label, 'input', 'search'); input.maxLength = 120;
    const submit = element('button', 'pth-points-button', action); submit.type = 'submit'; form.append(submit); parent.append(form);
    return { form, input };
  }
  function accounts(workspace, issue) {
    const columns = element('div', 'pth-points-admin-columns');
    const sidebar = element('section', 'pth-points-account-search'), detail = element('section', 'pth-points-account-detail');
    const search = searchForm(sidebar, 'Buscar cuenta', 'Buscar cuentas');
    columns.append(sidebar, detail); workspace.append(columns);
    detail.append(element('p', 'pth-points-empty', issue ? 'Selecciona el destinatario de esta venta.' : 'Elige una cuenta para consultar su historial o reconocer su trabajo.'));
    const results = paged(sidebar, 'accounts', (list, row) => {
      list.append(button(row.name + (row.active === false ? ' · Inactiva' : ''), () => accountDetail(detail, row, issue), 'pth-points-account-result'));
    }, 'Ver más cuentas', search.input);
    search.form.addEventListener('submit', event => { event.preventDefault(); results.refresh(); });
  }
  function accountDetail(detail, beneficiary, issue) {
    detail.replaceChildren();
    if (!beneficiary?.id) { detail.append(element('p', 'pth-points-empty', 'Selecciona el destinatario de esta venta.')); return; }
    let grantForm = null;
    const programNote = element('p', 'pth-points-explainer'); programNote.hidden = true;
    const summaryHost = element('section'); detail.append(summaryHost);
    const view = summaryView(summaryHost, beneficiary, true, data => {
      if (grantForm) grantForm.hidden = !data?.enabled;
      programNote.hidden = !data || !!data.enabled;
      programNote.textContent = 'El programa está detenido. No se pueden otorgar nuevos reconocimientos; el historial y los reversos se conservan.';
    });
    detail.prepend(button('Actualizar puntos', () => view.refresh(), 'pth-points-refresh'));
    detail.append(programNote);
    if (beneficiary.active === false) {
      detail.append(element('p', 'pth-points-explainer', 'Cuenta inactiva. Su historial se conserva, pero no puede recibir nuevos reconocimientos.'));
      return;
    }
    const form = element('form', 'pth-points-form'); form.append(element('h3', 'pth-points-section-title', 'Otorgar un reconocimiento'));
    grantForm = form; form.hidden = true;
    if (issue) form.append(element('p', 'pth-points-notice', 'Resolver venta ' + issue.orderReference + '. Este reconocimiento quedará vinculado a la venta para evitar un crédito automático duplicado.'));
    form.append(element('p', 'pth-points-muted', 'Destinatario: ' + beneficiary.name));
    const points = field(form, 'Puntos a otorgar', 'input', 'number'); points.min = '1'; points.max = '2147483647'; points.step = '1'; points.required = true;
    const reason = field(form, 'Motivo del reconocimiento', 'textarea'); reason.required = true; reason.maxLength = 1000;
    transaction(form, {
      review:'Revisar reconocimiento', confirm:'Confirmar reconocimiento', retry:'Reintentar reconocimiento', success:'Reconocimiento registrado.',
      payload: () => ({operation:'grant',beneficiaryId:beneficiary.id,points:integer(points,1),reason:requiredReason(reason),...(issue?{captureId:issue.id}:{})}),
      description: body => `${beneficiary.name} · ${number(body.points)} puntos. Motivo: ${body.reason}${issue ? '. Venta: ' + issue.orderReference : ''}`,
      complete: () => { form.reset(); view.refresh(); }
    }); detail.append(form);
  }
  function rules(workspace) {
    workspace.append(element('p', 'pth-points-explainer', 'La regla especial sustituye los puntos por tamaño. Cero excluye el producto; la regla por tamaño recupera el valor predeterminado. Los pedidos anteriores no cambian.'));
    const search = searchForm(workspace, 'Buscar producto', 'Buscar productos');
    const results = paged(workspace, 'rules', (list, row) => {
      const card = element('article', 'pth-points-product');
      card.append(element('h3', '', row.name));
      const ruleLabel = element('p', 'pth-points-muted');
      const describe = (custom, effective) => custom === 0 ? 'Excluido · 0 puntos' : custom === null || custom === undefined ? effective === null || effective === undefined ? 'Sin clasificación · requiere revisión' : 'Por tamaño · ' + number(effective) + ' puntos por unidad' : 'Especial · ' + number(custom) + ' puntos por unidad';
      ruleLabel.textContent = describe(row.customPoints, row.pointsPerUnit); card.append(ruleLabel);
      card.append(button('Editar ' + row.name, () => {
        card.querySelector('form')?.remove();
        const form = element('form', 'pth-points-form');
        const mode = field(form, 'Tipo de regla', 'select');
        for (const [value, label] of [['default','Usar puntos por tamaño'],['custom','Puntos especiales']]) { const option = element('option','',label); option.value=value; mode.append(option); }
        mode.value = row.customPoints === null || row.customPoints === undefined ? 'default' : 'custom';
        const points = field(form,'Puntos por unidad','input','number'); points.min='0'; points.max='2147483647'; points.step='1'; points.value=String(row.customPoints ?? row.pointsPerUnit);
        const updateMode = () => { points.disabled = mode.value === 'default'; points.required = mode.value === 'custom'; }; mode.addEventListener('change',updateMode); updateMode();
        const reason = field(form,'Motivo del cambio','textarea'); reason.required=true; reason.maxLength=1000;
        transaction(form, {
          review:'Revisar regla',confirm:'Confirmar regla',retry:'Reintentar regla',success:'Regla guardada.',
          payload:()=>({operation:'save_rule',productId:row.productId,pointsPerUnit:mode.value==='default'?null:integer(points,0),reason:requiredReason(reason)}),
          description:body=>`${row.name} · ${body.pointsPerUnit === null ? 'Puntos predeterminados por tamaño' : number(body.pointsPerUnit) + ' puntos por unidad'}. Motivo: ${body.reason}`,
          complete:data=>{ row.customPoints=data.rule?.customPoints ?? (mode.value==='default'?null:Number(points.value)); ruleLabel.textContent=describe(row.customPoints,data.rule?.pointsPerUnit ?? row.pointsPerUnit); form.remove(); }
        }); card.append(form);
      },'pth-points-link')); list.append(card);
    },'Ver más productos',search.input);
    search.form.addEventListener('submit',event=>{event.preventDefault();results.refresh();});
  }
  function issues(workspace) {
    workspace.append(element('p','pth-points-explainer','Estas ventas necesitan revisión antes de generar puntos. Comprueba el pedido y escribe el motivo de cualquier reconocimiento manual.'));
    paged(workspace,'issues',(list,row)=>{
      const card=element('article','pth-points-product');
      const reasons = {missing_classification:'Producto sin clasificación',missing_beneficiary:'Cuenta vendedora sin identificar',unstructured_lines:'Venta sin detalle verificable de productos',invalid_lines:'Detalle de productos por revisar',missing_product:'Producto no encontrado'};
      card.append(element('h3','',row.orderReference),element('p','',row.name),element('p','pth-points-muted',reasons[row.reason] || row.reason));
      card.append(button('Resolver con puntos',()=>{
        workspace.replaceChildren();
        if (!row.beneficiaryId) { accounts(workspace,row); return; }
        const detail=element('section','pth-points-account-detail');workspace.append(detail);accountDetail(detail,{id:row.beneficiaryId,name:row.name},row);
      },'pth-points-link'));
      list.append(card);
    },'Ver más ventas');
  }
  root.PTHPointsWallet = { open: () => open(false), openAdmin: () => open(true) };
  root.addEventListener('pth:session-changed', sync);
  root.addEventListener('storage', event => { if (!event.key || ['pth_session','pth_secure_token','pth_secure_token_expires_at'].includes(event.key)) sync(); });
  root.addEventListener('offline', connection); root.addEventListener('online', connection);
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded',sync,{once:true}); else sync();
})(window);
