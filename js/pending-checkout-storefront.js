/* Explicit account-scoped local orders use the existing validated checkout. */
(() => {
  'use strict';
  const api = window.PTHPendingCheckout;
  if (!api) return;
  let storage, idb;
  try { storage = localStorage; idb = indexedDB; } catch (_) {}
  const queue = api.create(api.indexedStore(idb));
  const copyApi = window.PTHOfflineCheckoutCopy;
  const copies = copyApi?.create(idb);
  if (copies) copyApi.bindLifecycle(window, storage, copies);
  // Expiry can be detected by secure-data before this deferred module starts.
  // Clear the departing account's device data even when we missed that event.
  const expiredOwner = window.PTHSecureData.expiredCheckoutOwner?.();
  if (expiredOwner && api.localOwner(storage) !== expiredOwner) void Promise.allSettled([queue.logout(expiredOwner), copies?.clear(expiredOwner)]).then(() => render());
  const form = document.getElementById('checkout-form');
  const modal = document.getElementById('cart-modal');
  const confirmationHelp = document.getElementById('checkout-confirmation-help');
  const onlineConfirmationHelp = confirmationHelp?.textContent || '';
  const lastStep = document.getElementById('checkout-last-step');
  const owner = () => window.PTHSecureData.accountId?.() || null;
  const token = () => window.PTHSecureData.token();
  const offlineMode = () => navigator.onLine === false || window.PTHOfflineStorefront?.usingCopy?.() === true;
  const sameSession = (account, expectedToken) => api.localOwner(storage) === account && (!owner() || owner() === account) && token() === expectedToken;
  const pendingStates = ['queued', 'sending', 'uncertain', 'blocked', 'paused'];
  const labels = {
    queued: 'Guardado. Esperando conexión con el servidor.',
    sending: 'Comprobando y enviando al servidor…',
    uncertain: 'Comprobando si la tienda recibió el pedido. Conservamos el mismo intento.',
    blocked: 'Necesita revisión antes de enviarse.',
    paused: 'Reintentos detenidos. Comprueba la recepción antes de preparar el mismo pedido.',
    expired: 'El pendiente venció. Revisa tus pedidos antes de iniciar otro.',
    confirmed: 'La tienda confirmó que recibió este pedido.'
  };
  let active = null, busy = false, lastOwner = api.localOwner(storage), panel = null;
  let renderGeneration = 0, reviewing = null, preparing = false, saveIntent = null;
  let latestTariffs = [], copying = false;
  const savedGuidance = count => count === 1
    ? 'Pedido guardado en este teléfono. Sal a buscar señal y mantén esta página abierta. Cuando recuperes conexión, enviaremos tu pedido automáticamente. Te avisaremos cuando la tienda confirme que lo recibió.'
    : 'Pedidos guardados en este teléfono. Sal a buscar señal y mantén esta página abierta. Cuando recuperes conexión, enviaremos tus pedidos automáticamente. Te avisaremos cuando la tienda confirme que los recibió.';
  function localAccount() {
    const local = api.localOwner(storage);
    return owner() && owner() !== local ? null : owner() || local;
  }
  function message(value) {
    const target = document.getElementById('pth-pending-message');
    if (target) target.textContent = value;
  }
  function hide(node, hidden) {
    node.hidden = hidden;
    // The existing connectivity card/action classes use display:flex, which
    // otherwise overrides the browser's native [hidden] display rule.
    node.style.display = hidden ? 'none' : '';
  }
  function snapshot() {
    const values = {};
    for (const field of ['nombre', 'ci', 'tel', 'municipio', 'localidad', 'dir', 'notas', 'vuelto']) values[field] = document.getElementById('check-' + field)?.value || '';
    values.moneda = document.getElementById('check-moneda-pago').value;
    values.pickup = document.getElementById('check-recogida').checked;
    values.assisted = Boolean(document.getElementById('assisted-sale-checkbox')?.checked);
    const estimate = window.PTHCheckoutForm?.estimate({lines: cart, ...values, tariffs: latestTariffs.length ? latestTariffs : tarifasMensajeriaAdminRaw});
    if (!estimate || !Number.isFinite(estimate.shipping) || !Number.isFinite(estimate.total)) throw Object.assign(Error('DELIVERY_UNAVAILABLE'), {code: 'DELIVERY_UNAVAILABLE', safeMessage: 'Falta una tarifa de entrega válida. Conéctate para actualizarla o elige recogida en almacén.'});
    if (newCheckoutShippingOverride && newCheckoutShippingOverride.fingerprint === window.PTHLowConnectivity.fingerprint(cart) && newCheckoutShippingOverride.municipio === values.municipio && newCheckoutShippingOverride.localidad === values.localidad && Boolean(newCheckoutShippingOverride.pickup) === values.pickup) {
      estimate.shipping = Number(newCheckoutShippingOverride.cost);
      estimate.total = estimate.equipment + estimate.shipping;
    }
    return {lines: cart.map(product => ({id: product.id, qty: product.qty, price: Number(product.precio_venta)})), form: values, estimate};
  }
  function lockReviewFields(locked) {
    for (const input of form.querySelectorAll('input,select,textarea')) {
      if (input.tagName === 'SELECT' || ['checkbox', 'radio'].includes(input.type)) {
        if (locked) { input.dataset.pthPendingDisabled = String(input.disabled); input.disabled = true; }
        else if (input.dataset.pthPendingDisabled !== undefined) { input.disabled = input.dataset.pthPendingDisabled === 'true'; delete input.dataset.pthPendingDisabled; }
      } else input.readOnly = locked;
    }
  }
  function captureLiveForm() {
    return {
      cart: cart.map(product => ({...product})), revision: newCartRevision,
      shipping: newCheckoutShippingOverride, intent: volatileCheckoutIntent,
      modalClass: modal.className, inert: modal.inert,
      controls: [...form.querySelectorAll('input,select,textarea,button')].map(node => ({
        node, value: node.value, checked: node.checked, disabled: node.disabled,
        readOnly: node.readOnly, required: node.required, text: node.tagName === 'BUTTON' ? node.textContent : null,
        options: node.tagName === 'SELECT' ? [...node.children].map(option => option.cloneNode(true)) : null
      }))
    };
  }
  function restoreLiveForm(saved, account, expectedToken) {
    if (!saved || owner() !== account || !sameSession(account, expectedToken)) return;
    cart = saved.cart; newCartRevision = saved.revision;
    newCheckoutShippingOverride = saved.shipping; volatileCheckoutIntent = saved.intent;
    // localForm() still holds the pending context here; the unrelated account
    // draft and customer ghost leads must remain untouched while rendering.
    renderCart();
    for (const value of saved.controls) {
      const input = value.node;
      if (value.options) input.replaceChildren(...value.options);
      input.value = value.value; input.checked = value.checked;
      input.disabled = value.disabled; input.readOnly = value.readOnly; input.required = value.required;
      if (value.text !== null) input.textContent = value.text;
    }
    document.getElementById('cart-count').textContent = String(cart.reduce((sum, product) => sum + product.qty, 0));
    recalcularTotalFinal(); modal.className = saved.modalClass; modal.inert = saved.inert;
  }
  function bindForm(row) {
    if (row.lines.some(line => !productosRaw.some(product => product.id === line.id))) throw Object.assign(Error('PRODUCT_UNAVAILABLE'), {code: 'PRODUCT_UNAVAILABLE', safeMessage: 'Un producto no está disponible. Revisa el pendiente.'});
    cart = row.lines.map(line => {
      const product = productosRaw.find(item => item.id === line.id);
      return {...product, qty: line.qty, precio_venta: line.price, comision_actual: Number(product.comision || 0), comision_original_pool: Number(product.comision_original_pool || product.comision || 0), shipping_linea: 0};
    });
    newCartRevision = row.intentId || row.id; newCheckoutShippingOverride = null;
    for (const field of ['nombre', 'ci', 'tel', 'dir', 'notas', 'vuelto']) document.getElementById('check-' + field).value = row.form[field];
    document.getElementById('check-moneda-pago').value = row.form.moneda;
    document.getElementById('check-recogida').checked = row.form.pickup;
    toggleRecogidaEnAlmacen();
    if (!row.form.pickup) {
      if (!Object.keys(tarifasMensajeria).length) throw Object.assign(Error('Tariffs not loaded'), {code: 'NETWORK_ERROR'});
      const municipality = document.getElementById('check-municipio'); municipality.value = row.form.municipio;
      if (municipality.value !== row.form.municipio) throw Object.assign(Error('DELIVERY_UNAVAILABLE'), {code: 'DELIVERY_UNAVAILABLE', safeMessage: 'La zona de entrega necesita revisión.'});
      actualizarLocalidades(); document.getElementById('check-localidad').value = row.form.localidad;
      document.getElementById('check-dir').value = row.form.dir;
      if (document.getElementById('check-localidad').value !== row.form.localidad) throw Object.assign(Error('DELIVERY_UNAVAILABLE'), {code: 'DELIVERY_UNAVAILABLE', safeMessage: 'La localidad de entrega necesita revisión.'});
    }
    const assisted = document.getElementById('assisted-sale-checkbox'); if (assisted) assisted.checked = row.form.assisted;
    // Sending uses the amount explicitly saved/accepted for this order. The
    // mandatory fresh quote below must still match it before any submission.
    const approvedShipping = reviewing ? row.reviewEstimate?.shipping : row.estimate?.shipping;
    if (Number.isFinite(approvedShipping)) newCheckoutShippingOverride = {fingerprint: window.PTHLowConnectivity.fingerprint(cart), municipio: row.form.municipio, localidad: row.form.localidad, pickup: row.form.pickup, cost: approvedShipping};
    document.getElementById('cart-count').textContent = String(cart.reduce((sum, product) => sum + product.qty, 0));
    renderCart(); recalcularTotalFinal();
  }
  function leaveReview() {
    if (!reviewing || active) return;
    const review = reviewing;
    lockReviewFields(false);
    restoreLiveForm(review.previous, review.owner, review.token);
    reviewing = null; void render();
  }
  async function openReview(row, account) {
    if (busy || preparing || owner() !== account || api.localOwner(storage) !== account) return;
    const expectedToken = token(), previous = captureLiveForm();
    try {
      reviewing = {id: row.id, owner: account, token: expectedToken, previous, immutable: Boolean(row.outcome?.attempt)};
      bindForm(row); toggleCartModal(true); lockReviewFields(reviewing.immutable);
      message(reviewing.immutable ? 'Revisa el total. Este intento conserva sus datos originales. Para cambiar el cliente o los productos, detén los reintentos y comprueba primero la recepción.' : 'Revisa los datos, los productos y el total. Pulsa Guardar revisión y enviar pendiente para aceptar las condiciones actuales.');
    } catch (error) { leaveReview(); message(error.safeMessage || 'No se pudo abrir el pendiente. Actualiza el catálogo y vuelve a revisarlo.'); }
    await render();
  }
  async function render() {
    const generation = ++renderGeneration, account = localAccount();
    hide(queueButton, !account); hide(copyButton, !account);
    hide(help, !account); hide(copyHelp, !account);
    hide(exitReview, !reviewing);
    const submit = document.getElementById('final-submit-btn');
    if (confirmationHelp) confirmationHelp.textContent = account && offlineMode() || reviewing ? 'Guardaremos el pedido pendiente en este teléfono. Con esta página abierta y tu misma cuenta, comprobaremos los datos y lo enviaremos al recuperar conexión. Verás la confirmación cuando la tienda lo reciba.' : onlineConfirmationHelp;
    if (lastStep?.lastChild?.nodeType === 3) lastStep.lastChild.textContent = account && offlineMode() || reviewing ? 'Confirmación' : 'WhatsApp';
    if (submit && !active && !preparing && submit.innerText !== 'PROCESANDO...') {
      submit.innerText = reviewing ? 'Guardar revisión y enviar pendiente' : account && offlineMode() ? 'Guardar pedido pendiente' : 'Confirmar por WhatsApp';
    }
    if (!account) {
      if (panel) { hide(panel, true); panel.replaceChildren(); }
      return;
    }
    if (panel && panel.dataset.owner !== account) { hide(panel, true); panel.replaceChildren(); }
    let rows;
    try { rows = await queue.list(account); }
    catch (_) { message('Este navegador no pudo abrir el almacenamiento. El pedido no está guardado.'); return; }
    if (generation !== renderGeneration || api.localOwner(storage) !== account || owner() && owner() !== account) return;
    if (reviewing && !rows.some(row => row.id === reviewing.id && row.form)) leaveReview();
    if (!panel) {
      const catalog = document.getElementById('sec-catalogo'); if (!catalog) return;
      panel = document.createElement('aside'); panel.id = 'pth-pending-order-panel'; panel.className = 'pth-connectivity-card pth-pending-card'; panel.style.margin = '24px'; catalog.before(panel);
    }
    panel.replaceChildren(); panel.dataset.owner = account; hide(panel, !rows.length);
    if (!rows.length) return;
    const pending = rows.filter(row => row.form && pendingStates.includes(row.state));
    const ready = pending.filter(row => ['queued', 'sending', 'uncertain'].includes(row.state));
    const heading = document.createElement('h3'); heading.textContent = pending.length === 1 ? '1 pedido pendiente en este teléfono' : pending.length ? pending.length + ' pedidos pendientes en este teléfono' : 'Estado de los pedidos guardados';
    panel.append(heading);
    if (ready.length) {
      const guidance = document.createElement('p'); guidance.className = 'pth-pending-guidance'; guidance.textContent = savedGuidance(ready.length); panel.append(guidance);
    }
    for (const row of rows) {
      const item = document.createElement('section'); item.dataset.pendingId = row.id;
      const title = document.createElement('h4'); title.textContent = row.form ? row.form.nombre : row.state === 'confirmed' ? 'Pedido recibido' : 'Pedido detenido';
      const status = document.createElement('p'); status.setAttribute('role', 'status'); status.textContent = labels[row.state] || labels.blocked;
      const detail = document.createElement('p'); detail.textContent = row.state === 'confirmed' ? 'Referencia: ' + (row.receipts || []).map(receipt => receipt.reference).join(', ') : row.message || (row.form && row.estimate ? 'Total guardado: $' + row.estimate.total + ' USD. Se volverá a comprobar antes de enviarse.' : 'Los datos del cliente se borran al confirmar recepción.');
      item.append(title, status, detail);
      if (row.form && row.state === 'blocked') {
        const review = document.createElement('button'); review.type = 'button'; review.className = 'pth-connectivity-action'; review.textContent = 'Revisar pendiente'; review.disabled = busy || preparing; review.onclick = () => void openReview(row, account); item.append(review);
      }
      panel.append(item);
    }
    const review = document.createElement('a'); review.href = '/offline-order.html'; review.textContent = 'Ver o cancelar pedidos pendientes'; review.className = 'pth-connectivity-action'; panel.append(review);
  }
  function verifyEstimate(quote) {
    if (!active || quote.complete) return;
    const saved = active.row.estimate, terms = quote.terms || [];
    const shipping = terms.reduce((sum, term) => sum + Number(term.costo_mensajeria), 0);
    const total = terms.reduce((sum, term) => sum + Number(term.total), 0), equipment = total - shipping;
    if (!saved || ![shipping, total, equipment].every(Number.isFinite) || ['equipment', 'shipping', 'total'].some(field => Math.abs(Number(saved[field]) - ({equipment, shipping, total})[field]) > 0.001)) {
      if ([shipping, total, equipment].every(Number.isFinite)) active.reviewEstimate = {equipment, shipping, total};
      throw Object.assign(Error('DELIVERY_REVIEW'), {code: 'DELIVERY_REVIEW', safeMessage: saved ? 'Cambió el total o el coste de entrega. Revisa el pedido y acepta el importe actual antes de enviarlo.' : 'Este pedido antiguo no guardó el coste de entrega. Revisa y acepta el total actual antes de enviarlo.'});
    }
  }
  async function tick() {
    if (busy || preparing || reviewing || !owner() || api.localOwner(storage) !== owner() || navigator.onLine === false || !productosRaw.length || !modal.classList.contains('hidden')) return;
    busy = true;
    const account = owner();
    try {
      // Drain each currently runnable row once. A network failure retries on a
      // later tick; a blocked row cannot prevent the next customer's order.
      const rows = await queue.list(account);
      for (const row of rows.filter(item => item.form && ['queued', 'uncertain', 'sending'].includes(item.state))) {
        if (owner() !== account || api.localOwner(storage) !== account || navigator.onLine === false || !modal.classList.contains('hidden')) break;
        let previous = null, expectedToken = null;
        try {
          await queue.run(account, async context => {
            expectedToken = token();
            if (!expectedToken || owner() !== account || !sameSession(account, expectedToken)) throw Object.assign(Error('SESSION_CHANGED'), {code: 'SESSION_CHANGED', safeMessage: 'Inicia sesión de nuevo con esta misma cuenta para enviar el pedido.'});
            await PTHSecureData.restore();
            if (owner() !== account || !sameSession(account, expectedToken)) throw Object.assign(Error('SESSION_CHANGED'), {code: 'SESSION_CHANGED'});
            for (const attempt of context.row.priorAttempts || []) {
              const result = await PTHSecureData.checkout({operation: 'receipt', attempt}); if (result.error) throw result.error;
              if (owner() !== account || !sameSession(account, expectedToken)) throw Object.assign(Error('SESSION_CHANGED'), {code: 'SESSION_CHANGED'});
              if (result.data.confirmed.length) throw Object.assign(Error('Previous order received'), {code: 'REVIEW', safeMessage: 'El intento anterior fue recibido: ' + result.data.confirmed.map(receipt => receipt.reference).join(', ') + '. Este pendiente no se ha enviado. Revisa tus pedidos antes de continuar.'});
            }
            if (!modal.classList.contains('hidden')) throw Object.assign(Error('Editing another order'), {code: 'NETWORK_ERROR'});
            previous = captureLiveForm(); modal.inert = true;
            active = context; active.expectedToken = expectedToken;
            bindForm(context.row);
            await form.onsubmit({preventDefault() {}});
            if (context.row.state === 'confirmed') return;
            if (active.reviewEstimate) await context.save({reviewEstimate: active.reviewEstimate});
            if (active.failure) throw active.failure;
            await context.save({state: 'blocked', lines: cart.map(product => ({id: product.id, qty: product.qty, price: Number(product.precio_venta)})), message: active.message || 'Revisa el pedido antes de reintentar.', lease: null});
          }, row.id);
        } finally {
          restoreLiveForm(previous, account, expectedToken);
          active = null;
          if (previous) modal.inert = owner() === account && sameSession(account, expectedToken) ? previous.inert : false;
        }
      }
    } catch (_) { message('No se pudo guardar el estado de los pendientes. Mantén la página abierta y vuelve a comprobar.'); }
    finally { active = null; busy = false; await render(); }
  }
  async function savePending() {
    if (preparing || active || reviewing) return;
    const account = localAccount();
    if (!account) { message('Vuelve a tu cuenta para guardar un pendiente.'); return; }
    if (!form.reportValidity()) return;
    if (readNewCheckoutOutcome()) { message('Hay un envío anterior sin confirmar en este carrito. Recupera conexión y comprueba su recepción antes de guardarlo como otro pedido.'); return; }
    preparing = true; queueButton.disabled = true;
    const submit = document.getElementById('final-submit-btn'); submit.disabled = true;
    const expectedToken = token();
    let data;
    try {
      data = snapshot();
      const key = JSON.stringify(data);
      if (!saveIntent || saveIntent.key !== key || saveIntent.owner !== account) saveIntent = {owner: account, key, intentId: Array.from(crypto.getRandomValues(new Uint8Array(32)), value => value.toString(16).padStart(2, '0')).join(''), savedAt: Date.now()};
      await queue.save(account, data, saveIntent);
      if (!sameSession(account, expectedToken)) return;
      // A late IndexedDB response cannot erase another account's inputs.
      for (const field of ['nombre', 'ci', 'tel', 'dir', 'vuelto']) {
        try { const key = 'autosave_check-' + field; if (storage.getItem(key) === data.form[field]) storage.removeItem(key); } catch (_) {}
      }
      lowConnectivity.clearDraft(account);
      cart = []; newCartRevision = null; newCheckoutShippingOverride = null; volatileCheckoutIntent = null;
      form.reset(); toggleRecogidaEnAlmacen(); renderCart(); document.getElementById('cart-count').textContent = '0';
      saveIntent = null; message(savedGuidance(1)); toggleCartModal(false);
    } catch (error) {
      message(error.safeMessage || (error.code === 'LIMIT' ? 'Este teléfono ya tiene 25 pedidos pendientes. Envía o cancela alguno antes de guardar otro.' : error.code === 'INVALID' ? 'Completa los datos del cliente, la entrega y los productos.' : 'No se pudo guardar el pedido. No cierres esta pantalla; el pedido sigue en el formulario.'));
    } finally { queueButton.disabled = false; if (sameSession(account, expectedToken)) submit.disabled = false; preparing = false; await render(); }
    void tick();
  }
  async function saveReview() {
    if (!reviewing || active || preparing) return;
    const review = reviewing, expectedToken = token();
    preparing = true;
    try {
      if (owner() !== review.owner || !sameSession(review.owner, expectedToken)) return;
      const data = api.clean(snapshot()), row = await queue.read(review.owner, review.id);
      if (owner() !== review.owner || !sameSession(review.owner, expectedToken) || row?.id !== review.id) return;
      await queue.revise(review.owner, review.id, data);
      if (owner() !== review.owner || !sameSession(review.owner, expectedToken)) return;
      lockReviewFields(false); restoreLiveForm(review.previous, review.owner, expectedToken);
      reviewing = null; message(savedGuidance(1));
    } catch (error) { message(error.safeMessage || (error.code === 'SIGNED_CHANGE' ? 'Este intento conserva sus datos originales. Detén los reintentos y comprueba el recibo antes de cambiarlo.' : 'No se pudo guardar la revisión. El pendiente anterior se conserva.')); }
    finally { preparing = false; await render(); }
    void tick();
  }
  window.PTHPendingCheckoutUI = {
    active: () => active, cartLocked: () => Boolean(active || preparing || reviewing?.immutable),
    localForm: () => Boolean(active || reviewing || preparing), outcome: () => active?.row.outcome || null,
    intent: () => active ? {intentId: active.row.intentId || active.row.id, savedAt: active.row.createdAt} : null,
    async markOutcome(value) { if (active) await active.save({outcome: value}); },
    async confirmed(receipts) { if (active) { await active.confirmed(receipts); await render(); } },
    message(value) { if (active) { active.message = value; return true; } return false; },
    failure(error, value) { if (active) active.failure = Object.assign(Error(error.code || 'REVIEW'), {code: error.code || 'REVIEW', safeMessage: error.safeMessage || value}); },
    guard() { return Boolean(active && (owner() !== active.row.owner || !sameSession(active.row.owner, active.expectedToken))); },
    shouldIntercept: () => !active && Boolean(reviewing || preparing || localAccount() && offlineMode()),
    async interceptSubmit() { if (active) return false; if (reviewing) await saveReview(); else if (offlineMode()) await savePending(); return true; },
    verifyEstimate, async catalogReady() { await render(); await tick(); },
    saveDeliveryZones(rows) { latestTariffs = Array.isArray(rows) ? rows : []; },
    render, tick, leaveReview
  };
  const queueButton = document.createElement('button'); queueButton.type = 'button'; queueButton.id = 'pth-queue-order'; queueButton.className = 'pth-connectivity-action'; queueButton.textContent = 'Guardar como pendiente'; queueButton.hidden = true;
  const help = document.createElement('p'); help.className = 'pth-cart-draft-note'; help.textContent = 'Puedes guardar varios pedidos en este teléfono. Se envían con esta página abierta y tu misma cuenta al recuperar conexión. Los datos del cliente se borran al confirmar, cancelar, cerrar sesión o vencer la sesión. Si pasan 7 días, se borran al volver a abrir la cola.';
  const copyButton = document.createElement('button'); copyButton.type = 'button'; copyButton.id = 'pth-save-offline-copy'; copyButton.className = 'pth-connectivity-action'; copyButton.textContent = 'Guardar clientes y entregas en este teléfono'; copyButton.hidden = true;
  const copyHelp = document.createElement('p'); copyHelp.className = 'pth-cart-draft-note'; copyHelp.textContent = 'Guarda tus clientes recientes, los productos y las tarifas para completar este mismo formulario sin conexión. Hazlo en un teléfono de uso personal; esta copia se borra al cerrar sesión o al vencer.';
  const exitReview = document.createElement('button'); exitReview.type = 'button'; exitReview.id = 'pth-leave-pending-review'; exitReview.className = 'pth-connectivity-action'; exitReview.textContent = 'Volver a mi carrito'; exitReview.hidden = true; exitReview.onclick = leaveReview;
  const status = document.createElement('p'); status.id = 'pth-pending-message'; status.setAttribute('role', 'status');
  document.getElementById('final-submit-btn').before(queueButton, help, copyButton, copyHelp, exitReview, status);
  queueButton.onclick = () => void savePending();
  copyButton.onclick = async () => {
    if (copying || preparing || active) return;
    const account = localAccount(), expectedToken = token(), helper = window.PTHOfflineCheckoutCopy;
    if (!account || navigator.onLine === false) { message('Conéctate con tu cuenta para guardar o actualizar los clientes y las entregas.'); return; }
    if (!helper) { message('No se pudo abrir la copia para trabajar sin conexión. Recarga la página.'); return; }
    const sessionUntil = PTHSecureData.expiresAt?.();
    if (!Number.isFinite(sessionUntil) || sessionUntil <= Date.now()) { message('Renueva tu sesión con conexión antes de guardar los clientes y las entregas.'); return; }
    copying = true; copyButton.disabled = true;
    try {
      const profile = await PTHSecureData.restore();
      if (!profile || profile.id !== account || !sameSession(account, expectedToken)) return;
      const payload = await helper.capture({client: supabaseClient, profile, products: productosRaw, tariffs: latestTariffs.length ? latestTariffs : tarifasMensajeriaAdminRaw, storage, token: expectedToken, sessionUntil});
      if (!sameSession(account, expectedToken)) return;
      await (copies || helper.create(idb)).save(account, payload, {profile, consent: true, sessionUntil, guard: () => sameSession(account, expectedToken)});
      if (sameSession(account, expectedToken)) message('Copia guardada en este teléfono: tus clientes recientes, productos y tarifas están disponibles en el formulario sin conexión.');
    } catch (error) { message(error.safeMessage || (error.code === 'CLIENT_SCOPE_AMBIGUOUS' ? 'La cuenta necesita revisión antes de guardar clientes en este teléfono.' : 'No se pudo guardar la copia. Conserva la conexión y vuelve a intentarlo.')); }
    finally { copying = false; copyButton.disabled = false; }
  };
  window.addEventListener('pth:session-changed', event => {
    const next = owner();
    if (lastOwner && !next && ['logout', 'expired'].includes(event.reason)) void queue.logout(lastOwner).catch(() => message('El navegador no pudo borrar los datos locales. Revisa el almacenamiento de este teléfono antes de compartirlo.')).finally(render);
    reviewing = null; saveIntent = null; lockReviewFields(false); lastOwner = next;
    if (!next && event.reason === 'expired') message('Tu sesión venció. Los reintentos se detuvieron y se borraron los datos del cliente guardados en este teléfono. Inicia sesión y revisa tus pedidos antes de volver a prepararlos.');
    void render(); if (next) void tick();
  });
  window.addEventListener('online', () => { void render(); void tick(); });
  window.addEventListener('offline', () => void render());
  window.addEventListener('storage', event => {
    if (['pth_session', 'pth_secure_token'].includes(event.key) && api.localOwner(storage) !== owner()) {
      form.reset(); if (panel) { hide(panel, true); panel.replaceChildren(); }
      reviewing = null; saveIntent = null; lockReviewFields(false);
    }
  });
  window.addEventListener('focus', () => { void render(); void tick(); });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) { void render(); void tick(); } });
  setInterval(() => { void render(); void tick(); }, 15000);
  void render();
})();
