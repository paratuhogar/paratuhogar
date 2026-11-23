/* Cash incentive views. The authenticated gateway, never this UI, authorizes money records. */
(function (root) {
  'use strict';
  const doc = root.document;
  const labels = {requested:'Solicitado',approved:'Aprobado · sin pagar',in_payment:'En pago',paid:'Pagado · registro',rejected:'Rechazado',cancelled:'Cancelado',refunded:'Devuelto'};
  const eventLabels = {request:'Solicitud creada',approve:'Aprobación',reject:'Rechazo',cancel:'Cancelación',start_payment:'Asignación de pago',record_payment:'Pago registrado',release_payment:'Liberación sin pago',refund:'Devolución registrada',backing_reversed:'Reserva cancelada por ajuste de puntos'};
  const operations = {
    request:['Revisar cobro','Confirmar solicitud','Solicitud de cobro registrada.'],
    approve:['Revisar aprobación','Confirmar aprobación','Solicitud aprobada. El dinero todavía no se ha pagado.'],
    reject:['Revisar rechazo','Confirmar rechazo','Solicitud rechazada y reserva liberada.'],
    cancel:['Revisar cancelación','Confirmar cancelación','Solicitud cancelada y reserva liberada.'],
    start_payment:['Revisar inicio de pago','Confirmar inicio de pago','Pago asignado. Comprueba el desembolso antes de registrarlo.'],
    record_payment:['Revisar pago','Confirmar pago registrado','Pago registrado. La web no transfirió dinero.'],
    release_payment:['Revisar liberación','Confirmar liberación','Asignación liberada tras comprobar que no hubo pago.'],
    refund:['Revisar devolución','Confirmar devolución registrada','Devolución registrada y puntos reintegrados.']
  };
  const uncertain = new Set(['NETWORK_ERROR','REQUEST_TIMEOUT','SERVICE_UNAVAILABLE','INVALID_RESPONSE','POINTS_CASH_UNAVAILABLE']);
  const adminRoles = new Set(['admin','administrador','superadmin']);
  const number = value => new Intl.NumberFormat('es').format(value);
  const key = () => Array.from(root.crypto.getRandomValues(new Uint8Array(32)), b => b.toString(16).padStart(2,'0')).join('');
  const mounts = new Set();
  const storagePrefix = 'pth_cash_pending_';
  function node(tag, className, text) {
    const el = doc.createElement(tag); if (className) el.className = className;
    if (text !== undefined) el.textContent = text; return el;
  }
  function button(text, action, primary = false) {
    const el = node('button','pth-points-button' + (primary ? ' pth-points-primary' : ''),text);
    el.type = 'button'; el.addEventListener('click',action); return el;
  }
  function currentIdentity() {
    try {
      const p = JSON.parse(root.localStorage.getItem('pth_session') || 'null')?.data;
      const token = root.localStorage.getItem('pth_secure_token');
      const expires = Number(root.localStorage.getItem('pth_secure_token_expires_at'));
      if (!p?.id || !token || p.activo === false || p.estado && p.estado !== 'activo' || expires && expires <= Date.now()) return '';
      return JSON.stringify([p.id,token,p.rol,p.parent_id || null]);
    } catch (_) { return ''; }
  }
  // A non-secret namespace only; authorization uses the exact live identity above.
  function namespace(value) {
    let a = 2166136261, b = 5381;
    for (let i = 0; i < value.length; i++) { a = Math.imul(a ^ value.charCodeAt(i),16777619); b = Math.imul(b,33) ^ value.charCodeAt(i); }
    return (a >>> 0).toString(16).padStart(8,'0') + (b >>> 0).toString(16).padStart(8,'0');
  }
  function forgetStorage(except = '') {
    try { for (const k of Object.keys(root.sessionStorage)) if (k.startsWith(storagePrefix) && (!except || !k.startsWith(except))) root.sessionStorage.removeItem(k); } catch (_) { /* no browser storage */ }
  }
  function date(value) {
    const d = new Date(value); return Number.isFinite(d.getTime()) ? d.toLocaleString('es',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}) : 'Fecha no disponible';
  }
  function invalid() { return Object.assign(Error('La respuesta no se pudo confirmar. Actualiza la consulta.'),{code:'INVALID_RESPONSE'}); }
  function integer(input, maximum) {
    const raw = input.value.trim(), value = Number(raw);
    if (!/^\d+$/.test(raw) || !Number.isSafeInteger(value) || value < 1 || value > Math.min(715827882,maximum)) throw Error('Indica un importe en USD enteros dentro del disponible.');
    return value;
  }
  function field(parent, text, tag = 'input', type = 'text') {
    const label = node('label','pth-points-field'); label.append(node('span','',text));
    const input = node(tag); if (tag === 'input') input.type = type;
    input.setAttribute('aria-label',text); label.append(input); parent.append(label); return input;
  }
  function required(input, maximum) {
    const value = input.value.trim(); if (!value || value.length > maximum) throw Error('Completa el motivo y la constancia solicitados.'); return value;
  }
  function mount({container,admin = false,profile,request,onChanged}) {
    const identity = currentIdentity();
    if (!container || !identity || !profile?.id || JSON.parse(identity)[0] !== profile.id || typeof request !== 'function') return null;
    admin = !!admin && !profile.parent_id && adminRoles.has(String(profile.rol || '').toLowerCase());
    const scope = storagePrefix + namespace(identity) + '_', storageKey = scope + (admin ? 'admin' : 'own');
    forgetStorage(scope);
    let stopped = false, summary = null, summarySequence = 0, listSequence = 0, detailSequence = 0, backingSequence = 0, listOffset = null, eventOffset = null;
    let listBusy = false, detailBusy = false, pending = null, writeBusy = false, selected = null, activeForm = null;
    try { pending = JSON.parse(root.sessionStorage.getItem(storageKey) || 'null'); } catch (_) { /* absent draft */ }
    if (!pending?.body || !operations[pending.body.operation] || !/^[a-f0-9]{64}$/.test(pending.body.idempotencyKey || '')) pending = null;
    const wrapper = node('section','pth-cash');
    wrapper.setAttribute('aria-label',admin ? 'Solicitudes de cobro por puntos' : 'Cobrar incentivo por puntos');
    const header = node('header','pth-cash-header');
    const heading = node('div'); heading.append(node('p','pth-cash-eyebrow','INCENTIVO POR PUNTOS'),node('h3','',admin ? 'Solicitudes de cobro' : 'Tus puntos también se cobran'));
    const refresh = button('Actualizar cobros',async () => {
      if (refresh.disabled) return;
      refresh.disabled = true;
      try {await reload(); if (alive()) await onChanged?.();}
      finally {if (alive()) refresh.disabled = false;}
    }); header.append(heading,refresh);
    const receipt = node('div','pth-cash-receipt');
    receipt.append(node('strong','','3 puntos = 1 USD'),node('p','','Administración realiza el pago y lo registra aquí.'));
    const network = node('p','pth-cash-note'); network.setAttribute('role','status'); network.hidden = true;
    const status = node('p','pth-cash-status'); status.setAttribute('role','status'); status.setAttribute('aria-live','polite');
    const metrics = node('div','pth-cash-metrics'), requestSlot = node('div','pth-cash-request-slot'), recovery = node('div','pth-cash-recovery');
    const programNote = node('p','pth-cash-note','Los nuevos cobros están desactivados. El historial y las obligaciones se conservan.'); programNote.hidden = true;
    const filters = node('form','pth-cash-filters');
    const state = field(filters,'Estado del cobro','select');
    for (const [value,label] of [['','Todos los estados'],...Object.entries(labels)]) { const option = node('option','',label); option.value = value; state.append(option); }
    let search;
    if (admin) { search = field(filters,'Buscar solicitudes','input','search'); search.maxLength = 120; }
    const submit = node('button','pth-points-button','Buscar cobros'); submit.type = 'submit'; filters.append(submit);
    const listMessage = node('p','pth-cash-note'); listMessage.setAttribute('role','status');
    const list = node('div','pth-cash-list');
    const more = button('Ver más solicitudes',() => void loadList(true)); more.hidden = true;
    const detail = node('section','pth-cash-detail'); detail.hidden = true;
    wrapper.append(header,receipt,network,status,metrics,recovery,programNote,requestSlot,filters,listMessage,list,more,detail); container.replaceChildren(wrapper);
    function alive() {
      if (currentIdentity() !== identity) { destroy(true); return false; }
      return !stopped && container.isConnected && wrapper.isConnected;
    }
    function destroy(clear = false) {
      stopped = true; summarySequence++; listSequence++; detailSequence++;
      root.removeEventListener('online',connection); root.removeEventListener('offline',connection);
      mounts.delete(instance); wrapper.remove(); if (clear) forgetStorage();
    }
    function validRow(row) {
      return !!row && typeof row.id === 'string' && typeof row.beneficiaryId === 'string' && typeof row.beneficiaryName === 'string' &&
        Number.isSafeInteger(row.usd) && row.usd >= 1 && row.usd <= 715827882 && row.points === row.usd * 3 &&
        Object.hasOwn(labels,row.state) && Number.isSafeInteger(row.revision) && row.revision > 0 &&
        (admin || row.beneficiaryId === profile.id);
    }
    async function read(body) {
      if (!alive()) throw Object.assign(Error('La sesión cambió.'),{stale:true});
      if (root.navigator.onLine === false) throw Object.assign(Error('Sin conexión. Consulta la última información guardada.'),{code:'OFFLINE'});
      const data = await request(body);
      if (!alive()) throw Object.assign(Error('La sesión cambió.'),{stale:true});
      return data;
    }
    function connection(event) {
      if (!alive()) return;
      const offline = root.navigator.onLine === false;
      if (offline || event?.type === 'online') {
        network.hidden = false;
        network.textContent = offline ? 'Sin conexión. Información de la última consulta guardada; no puedes registrar cambios.' : 'Conexión recuperada. Actualiza para comprobar el estado actual.';
      }
      for (const control of wrapper.querySelectorAll('[data-cash-write]')) control.disabled = offline || writeBusy || control.dataset.cashUnavailable === 'true' || control.closest('form')?.dataset.cashOperation === 'request' && !summary?.enabled || !!pending && control.dataset.cashRecovery !== 'true';
    }
    function markWrite(control, recover = false) {
      control.dataset.cashWrite = ''; if (recover) control.dataset.cashRecovery = 'true';
      control.disabled = root.navigator.onLine === false || writeBusy || !!pending && !recover;
      return control;
    }
    function metric(value,label,name) {
      const item = node('div','pth-cash-metric'); if (name) item.dataset.cashMetric = name;
      item.append(node('strong','',number(value)),node('span','',label)); return item;
    }
    function validSummary(data,beneficiaryId) {
      return data?.beneficiary?.id === beneficiaryId && data.rate === 3 && typeof data.enabled === 'boolean' && ['available','reserved','redeemedPoints','paidUsd','deficit','earnedConfirmed'].every(k => Number.isSafeInteger(data[k]) && data[k] >= 0);
    }
    function paintSummary(data) {
      if (!validSummary(data,profile.id)) throw invalid();
      summary = data;
      programNote.hidden = admin || data.enabled;
      if (!admin) {
        metrics.replaceChildren(metric(data.available,'Disponibles','available'),metric(data.reserved,'Reservados','reserved'),metric(data.redeemedPoints,'Canjeados','redeemed'));
        if (data.deficit) metrics.append(metric(data.deficit,'Ajuste pendiente','deficit'));
      }
      paintRequest(); connection();
    }
    function paintRequest() {
      if (admin || activeForm?.isConnected) return;
      requestSlot.replaceChildren();
      if (pending || !summary) return;
      if (!summary.enabled) return;
      requestSlot.append(node('p','pth-cash-note',`Puedes solicitar hasta ${number(Math.floor(summary.available / 3))} USD enteros. Los puntos pendientes no se pueden cobrar.`));
      const cta = markWrite(button('Solicitar cobro',() => openForm('request'),true)); cta.dataset.cashUnavailable = String(summary.available < 3); cta.disabled ||= summary.available < 3; requestSlot.append(cta);
    }
    function paintRecovery() {
      recovery.replaceChildren();
      if (!pending) {paintRequest(); return;}
      const title = node('strong','','No se pudo confirmar el resultado.');
      recovery.append(title,node('p','',`${pending.description || 'Operación de cobro pendiente.'} No crees otro cobro. Comprobar reutiliza exactamente la misma operación; no realiza una transferencia.`));
      recovery.append(markWrite(button('Comprobar resultado',() => void execute(),true),true));
      if (!admin) requestSlot.replaceChildren();
      connection();
    }
    async function loadSummary() {
      const ticket = ++summarySequence;
      try { const data = await read({operation:'summary'}); if (ticket === summarySequence) paintSummary(data); }
      catch (failure) { if (!failure.stale && ticket === summarySequence && alive()) status.textContent = failure.message; }
    }
    function listRow(row) {
      const card = node('article','pth-cash-row');
      const name = node('h4','',row.beneficiaryName), amount = node('strong','pth-cash-amount',`${number(row.usd)} USD`);
      const chip = node('span','pth-cash-state',labels[row.state]); chip.dataset.state = row.state;
      card.append(name,amount,chip,node('p','pth-cash-note',`${number(row.points)} puntos · ${date(row.createdAt)}`));
      if (row.reason) card.append(node('p','pth-cash-reason',row.reason));
      card.append(button('Ver solicitud',() => void loadDetail(row.id))); list.append(card);
    }
    let appliedState = '', appliedSearch = '';
    async function loadList(append = false) {
      if (append && (listBusy || listOffset === null)) return;
      const ticket = ++listSequence; listBusy = true; more.disabled = true;
      if (!append) { appliedState = state.value; appliedSearch = search?.value.trim() || ''; }
      try {
        const data = await read({operation:'list',offset:append ? listOffset : 0,...(appliedState ? {state:appliedState} : {}),...(admin && appliedSearch ? {search:appliedSearch} : {})});
        if (ticket !== listSequence) return;
        if (!Array.isArray(data.rows) || !data.rows.every(validRow)) throw invalid();
        if (!append) list.replaceChildren();
        for (const row of data.rows) listRow(row);
        listMessage.textContent = list.children.length ? '' : 'No hay solicitudes para esta consulta.';
        listOffset = data.nextOffset; more.hidden = !Number.isSafeInteger(listOffset);
        if (admin && data.totals) {
          const t = data.totals;
          if (!['requestedUsd','approvedUsd','inPaymentUsd','paidUsd'].every(k => Number.isSafeInteger(t[k]) && t[k] >= 0)) throw invalid();
          metrics.replaceChildren(metric(t.requestedUsd,'USD solicitados'),metric(t.approvedUsd,'USD aprobados'),metric(t.inPaymentUsd,'USD en pago'),metric(t.paidUsd,'USD pagados'));
        }
      } catch (failure) { if (!failure.stale && ticket === listSequence && alive()) listMessage.textContent = failure.message; }
      finally { if (ticket === listSequence) {listBusy = false; more.disabled = false;} }
    }
    async function loadDetail(id,append = false) {
      if (append && (detailBusy || eventOffset === null)) return;
      const ticket = ++detailSequence; detailBusy = true;
      try {
        const data = await read({operation:'detail',requestId:id,...(append ? {offset:eventOffset} : {})});
        if (ticket !== detailSequence) return;
        if (!validRow(data.request) || data.request.id !== id || !Array.isArray(data.events)) throw invalid();
        selected = data.request;
        if (!append) renderDetail(selected);
        const audit = detail.querySelector('.pth-cash-audit');
        for (const item of data.events) {
          const event = node('li','');
          const actor = item.operation === 'backing_reversed' && item.actorId === null ? 'Ajuste automático de puntos' : item.actorName || 'Autor no disponible';
          event.append(node('strong','',`${eventLabels[item.operation] || 'Cambio registrado'} · ${labels[item.state] || 'Estado registrado'}`),node('p','pth-cash-note',`${actor} · ${date(item.createdAt)} · Revisión ${number(item.revision)}`));
          if (item.reason) event.append(node('p','',item.reason));
          if (item.reference) event.append(node('p','','Constancia: ' + item.reference)); audit.append(event);
        }
        eventOffset = data.nextOffset;
        detail.querySelector('.pth-cash-more-events').hidden = !Number.isSafeInteger(eventOffset);
        if (admin && !append) await loadBacking(data.request,ticket);
      } catch (failure) { if (!failure.stale && alive()) status.textContent = failure.message; }
      finally { if (ticket === detailSequence) detailBusy = false; }
    }
    async function loadBacking(row,ticket) {
      const backingTicket = ++backingSequence;
      const current = () => backingTicket === backingSequence && ticket === detailSequence && alive() && selected?.id === row.id;
      try {
        const data = await read({operation:'summary',beneficiaryId:row.beneficiaryId});
        if (!current()) return;
        if (!validSummary(data,row.beneficiaryId)) throw invalid();
        const warning = detail.querySelector('.pth-cash-backing-warning');
        warning.textContent = data.deficit > 0 ? `Esta cuenta tiene un ajuste pendiente de ${number(data.deficit)} puntos. Comprueba si el dinero ya se pagó antes de continuar. La reserva no se libera automáticamente.` : '';
        warning.hidden = data.deficit === 0;
      } catch (failure) {
        if (failure.stale || !current()) return;
        const warning = detail.querySelector('.pth-cash-backing-warning');
        warning.hidden = false; warning.textContent = 'No se pudo verificar el respaldo. Comprueba el estado del pago antes de continuar.';
      }
    }
    function renderDetail(row) {
      // Refreshing a summary or list never destroys an erroneous payment form.
      if (activeForm?.isConnected && activeForm.closest('.pth-cash-detail')) activeForm.remove();
      activeForm = null; detail.replaceChildren(); detail.hidden = false;
      detail.append(node('h3','','Detalle del cobro'),node('h4','',row.beneficiaryName),node('strong','pth-cash-detail-amount',`${number(row.usd)} USD · ${number(row.points)} puntos`),node('p','',labels[row.state]),node('p','pth-cash-note',`Solicitud ${row.id} · revisión ${row.revision}`));
      if (row.claimedBy) detail.append(node('p','pth-cash-note','Pago asignado a: ' + (row.claimedByName || row.claimedBy)));
      if (row.reason) detail.append(node('p','pth-cash-reason',row.reason));
      if (row.state === 'approved') detail.append(node('p','pth-cash-note','Aprobar mantiene los puntos reservados. El dinero todavía no se ha pagado.'));
      if (row.state === 'paid') detail.append(node('p','pth-cash-note',`Pago registrado: ${row.paymentMethod || 'medio guardado'} · ${row.paymentReference || 'constancia guardada'} · ${date(row.paidAt)}. La web no transfirió dinero.`));
      if (admin) {
        const warning = node('p','pth-cash-backing-warning pth-cash-recovery','Comprobando el respaldo de esta cuenta…'); warning.setAttribute('role','status'); warning.setAttribute('aria-live','polite'); detail.append(warning);
      }
      const actions = node('div','pth-cash-actions');
      const action = (text,operation) => actions.append(markWrite(button(text,() => openForm(operation,row))));
      if (admin) {
        if (row.state === 'requested') {action('Aprobar','approve');action('Rechazar','reject');}
        if (row.state === 'approved') {action('Iniciar pago','start_payment');action('Cancelar solicitud','cancel');}
        if (row.state === 'in_payment') {if (row.claimedBy === profile.id) action('Registrar pago','record_payment');action('Resolver sin pago','release_payment');}
        if (row.state === 'paid') action('Registrar devolución','refund');
      } else if (row.state === 'requested' && row.beneficiaryId === profile.id) action('Cancelar solicitud','cancel');
      detail.append(actions,node('h4','pth-cash-audit-heading','Historial de esta solicitud'));
      detail.append(node('ol','pth-cash-audit'));
      const older = button('Ver más eventos',() => void loadDetail(row.id,true)); older.classList.add('pth-cash-more-events'); older.hidden = true; detail.append(older);
    }
    function openForm(operation,row) {
      if (!alive() || pending || writeBusy || root.navigator.onLine === false) return;
      if (activeForm?.isConnected) {activeForm.querySelector('input,textarea,button')?.focus();return;}
      const form = node('form','pth-points-form pth-cash-form'); form.dataset.cashOperation = operation; activeForm = form;
      const config = operations[operation];
      form.append(node('h4','',operation === 'request' ? 'Solicitar cobro' : config[0]));
      if (row) form.append(node('p','pth-cash-note',`${row.beneficiaryName} · ${row.usd} USD · ${row.points} puntos · ${labels[row.state]}`));
      let usd,reason,reference,method,confirmation;
      if (['request','record_payment','refund'].includes(operation)) {
        usd = field(form,{request:'Importe a cobrar (USD)',record_payment:'Importe pagado (USD)',refund:'Importe devuelto (USD)'}[operation],'input','number');
        usd.required = true; usd.min = '1'; usd.max = String(operation === 'request' ? Math.floor(summary.available / 3) : row.usd); usd.step = '1'; usd.inputMode = 'numeric'; if (row) usd.value = String(row.usd);
      }
      if (operation === 'record_payment') {
        method = field(form,'Medio de pago','select');
        for (const [value,label] of [['efectivo','Efectivo'],['transferencia','Transferencia'],['otro','Otro']]) { const option = node('option','',label); option.value = value; method.append(option); }
      }
      if (['reject','cancel','release_payment','refund'].includes(operation)) { reason = field(form,'Motivo','textarea'); reason.required = true; reason.maxLength = 1000; }
      if (['record_payment','release_payment','refund'].includes(operation)) { reference = field(form,'Referencia o constancia'); reference.required = true; reference.maxLength = 200; }
      if (['record_payment','release_payment','refund'].includes(operation)) {
        const text = {record_payment:'Confirmo que el dinero ya se entregó completo',release_payment:'Confirmo que no se entregó dinero',refund:'Confirmo que el dinero se devolvió completo'}[operation];
        confirmation = field(form,text,'input','checkbox'); confirmation.required = true; confirmation.closest('label').classList.add('pth-cash-check');
      }
      const message = node('p','pth-points-error'); message.setAttribute('role','alert');
      const review = node('button','pth-points-button pth-points-primary',config[0]); review.type = 'submit'; markWrite(review);
      const cancel = button('Cerrar formulario',() => {if (!writeBusy && !pending) {form.remove();activeForm = null;paintRequest();}});
      form.append(message,review,cancel);
      let confirmationBox = null;
      form.addEventListener('submit',event => {
        event.preventDefault(); if (!alive() || writeBusy || pending || !form.reportValidity()) return;
        try {
          const body = {operation,...(row ? {requestId:row.id,revision:row.revision} : {})};
          if (usd) { body.usd = integer(usd,operation === 'request' ? Math.floor(summary.available / 3) : row.usd); if (row && body.usd !== row.usd) throw Error('Registra el importe completo de la solicitud.'); }
          if (reason) body.reason = required(reason,1000);
          if (reference) body.reference = required(reference,200);
          if (method) body.method = method.value;
          if (confirmation) { if (!confirmation.checked) throw Error('Confirma la comprobación del dinero.'); body[{record_payment:'confirmPaid',release_payment:'confirmNotPaid',refund:'confirmReturned'}[operation]] = true; }
          body.idempotencyKey = key();
          const description = `${row?.beneficiaryName || profile.nombre || summary.beneficiary.name} · ${number(body.usd || row.usd)} USD · ${number(operation === 'request' ? body.usd * 3 : row.points)} puntos. ${body.reason || ''}`;
          confirmationBox?.remove(); confirmationBox = node('div','pth-cash-confirm'); confirmationBox.append(node('p','',description));
          const confirm = markWrite(button(config[1],() => {
            if (pending || writeBusy || operation === 'request' && !summary?.enabled) return;
            pending = {body,description};
            void execute();
          },true));
          const edit = button('Volver a editar',() => {if (!writeBusy && !pending) {confirmationBox.remove();review.hidden = false;message.textContent = '';for (const input of form.querySelectorAll('input,textarea,select')) input.disabled = false;}});
          confirmationBox.append(confirm,edit); form.append(confirmationBox); review.hidden = true; message.textContent = '';
          for (const input of form.querySelectorAll('input,textarea,select')) input.disabled = true;
          confirm.focus();
        } catch (failure) { message.textContent = failure.message; }
      });
      (row ? detail : requestSlot).append(form); form.querySelector('input,textarea,button')?.focus();
    }
    async function execute() {
      if (!pending || writeBusy || !alive() || root.navigator.onLine === false) return;
      const draft = pending;
      try { root.sessionStorage.setItem(storageKey,JSON.stringify(draft)); }
      catch (_) { status.textContent = 'No se pudo guardar la operación pendiente. Habilita el almacenamiento de esta pestaña antes de continuar.'; pending = null; return; }
      writeBusy = true; status.textContent = 'Comprobando operación…'; connection();
      for (const input of activeForm?.querySelectorAll('input,textarea,select,button') || []) input.disabled = true;
      try {
        const data = await read(draft.body), row = data?.request;
        const expected = {request:'requested',approve:'approved',reject:'rejected',cancel:'cancelled',start_payment:'in_payment',record_payment:'paid',release_payment:'approved',refund:'refunded'}[draft.body.operation];
        if (!validRow(row) || row.state !== expected || draft.body.requestId && row.id !== draft.body.requestId || draft.body.usd && row.usd !== draft.body.usd || draft.body.operation === 'record_payment' && (!row.paidAt || !row.paymentReference || !row.paymentMethod)) throw invalid();
        root.sessionStorage.removeItem(storageKey); pending = null;
        activeForm?.remove(); activeForm = null; recovery.replaceChildren();
        if (draft.body.requestId) await loadDetail(row.id);
        await reload(); await onChanged?.();
        if (alive()) status.textContent = operations[draft.body.operation][2];
      } catch (failure) {
        if (failure.stale || !alive()) return;
        const ambiguous = uncertain.has(failure.code) || failure.status >= 500 || !failure.code;
        if (ambiguous) {paintRecovery();status.textContent = '';}
        else {
          root.sessionStorage.removeItem(storageKey); pending = null;
          status.textContent = failure.message;
          for (const input of activeForm?.querySelectorAll('input,textarea,select,button') || []) input.disabled = false;
          // A definite failure permits a new review; values stay available to correct.
          activeForm?.querySelector('.pth-cash-confirm')?.remove();
          if (activeForm) activeForm.querySelector('button[type=submit]').hidden = false;
        }
      } finally { writeBusy = false; if (alive()) {connection();paintRequest();} }
    }
    // Both reads may rebalance and lock this account. Do not make them compete.
    async function reload() {
      if (!alive()) return;
      await loadSummary(); if (!alive()) return;
      await loadList();
      if (admin && selected && !detail.hidden && alive()) await loadBacking(selected,detailSequence);
    }
    filters.addEventListener('submit',event => {event.preventDefault();void loadList();});
    const instance = {refresh:reload,destroy}; mounts.add(instance);
    root.addEventListener('online',connection); root.addEventListener('offline',connection);
    paintRecovery(); if (root.navigator.onLine === false) connection(); void reload(); return instance;
  }
  function sessionChanged() {
    for (const instance of [...mounts]) instance.refresh();
    const identity = currentIdentity(); forgetStorage(identity ? storagePrefix + namespace(identity) + '_' : '');
  }
  root.addEventListener('pth:session-changed',sessionChanged);
  root.addEventListener('storage',event => {if (!event.key || ['pth_session','pth_secure_token','pth_secure_token_expires_at'].includes(event.key)) sessionChanged();});
  const initialIdentity = currentIdentity(); forgetStorage(initialIdentity ? storagePrefix + namespace(initialIdentity) + '_' : '');
  root.PTHPointsCash = {mount,clear:() => {for (const instance of [...mounts]) instance.destroy(true);forgetStorage();}};
})(window);
