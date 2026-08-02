(function () {
    'use strict';

    const TABLE = 'seguimientos_clientes';
    const SYNC_INTERVAL = 15 * 60 * 1000;
    const MAX_REMOTE_ROWS = 200;
    const MAX_LOCAL_ROWS = 200;
    const CLOSED_STATES = new Set(['vendido', 'no_interesado', 'cerrado']);
    const STATE_LABELS = {
        nuevo: 'Nuevo',
        interesado: 'Interesado',
        esperando_pago: 'Esperando pago',
        vendido: 'Vendido',
        no_interesado: 'No interesado',
        cerrado: 'Cerrado'
    };

    let session = null;
    let owner = '';
    let storageKey = '';
    let items = [];
    let lastSync = 0;
    let remoteAvailable = true;
    let activeFilter = 'hoy';
    let root = null;

    function normalize(value) {
        return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
            .toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
    }

    function createId() {
        if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, char => {
            const random = Math.random() * 16 | 0;
            const value = char === 'x' ? random : (random & 0x3 | 0x8);
            return value.toString(16);
        });
    }

    function escapeHtml(value) {
        return String(value ?? '').replace(/[&<>"']/g, char => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
        }[char]));
    }

    function readJSON(key, fallback) {
        try {
            const value = JSON.parse(localStorage.getItem(key));
            return value ?? fallback;
        } catch (_) {
            return fallback;
        }
    }

    function loadLocal() {
        const cache = readJSON(storageKey, {});
        items = Array.isArray(cache.items) ? cache.items : [];
        lastSync = Number(cache.lastSync) || 0;
        remoteAvailable = cache.remoteAvailable !== false;
        pruneLocal();
    }

    function saveLocal() {
        pruneLocal();
        localStorage.setItem(storageKey, JSON.stringify({
            items: items.slice(0, MAX_LOCAL_ROWS),
            lastSync,
            remoteAvailable
        }));
    }

    function pruneLocal() {
        const ninetyDaysAgo = Date.now() - 90 * 24 * 60 * 60 * 1000;
        items = items
            .filter(item => !CLOSED_STATES.has(item.estado) || new Date(item.updated_at || 0).getTime() >= ninetyDaysAgo)
            .sort((a, b) => new Date(b.updated_at || 0) - new Date(a.updated_at || 0))
            .slice(0, MAX_LOCAL_ROWS);
    }

    function mergeItems(incoming) {
        const map = new Map(items.map(item => [item.id, item]));
        incoming.forEach(item => map.set(item.id, { ...(map.get(item.id) || {}), ...item }));
        items = [...map.values()];
        pruneLocal();
    }

    function remoteRow(item) {
        return {
            id: item.id,
            gestor: item.gestor,
            subgestor: item.subgestor || null,
            cliente: item.cliente,
            telefono: item.telefono,
            producto: item.producto || null,
            estado: item.estado,
            proximo_contacto: item.proximo_contacto || null,
            ultimo_contacto: item.ultimo_contacto || null,
            nota_corta: item.nota_corta || null,
            pedido_id: item.pedido_id || null,
            created_at: item.created_at,
            updated_at: item.updated_at
        };
    }

    async function flushPending() {
        const pending = items.filter(item => item._pending).slice(0, 20);
        if (!pending.length || !remoteAvailable) return;
        const { error } = await supabaseClient.from(TABLE)
            .upsert(pending.map(remoteRow), { onConflict: 'id' });
        if (!error) pending.forEach(item => delete item._pending);
    }

    function isMissingTable(error) {
        const message = String(error?.message || error || '').toLowerCase();
        return error?.code === '42P01' || error?.code === 'PGRST205'
            || message.includes('seguimientos_clientes') && message.includes('not');
    }

    async function sync(force) {
        if (!remoteAvailable && !force) return render();
        if (!force && Date.now() - lastSync < SYNC_INTERVAL) return render();
        if (typeof supabaseClient === 'undefined') {
            remoteAvailable = false;
            saveLocal();
            return render();
        }

        setSyncLabel('Sincronizando…');
        let query = supabaseClient.from(TABLE)
            .select('id,gestor,subgestor,cliente,telefono,producto,estado,proximo_contacto,ultimo_contacto,nota_corta,pedido_id,created_at,updated_at')
            .eq('gestor', owner)
            .order('updated_at', { ascending: false })
            .limit(MAX_REMOTE_ROWS);

        if (items.length && lastSync) {
            query = query.gt('updated_at', new Date(lastSync).toISOString());
        }

        const { data, error } = await query;
        if (error) {
            if (isMissingTable(error)) remoteAvailable = false;
            setSyncLabel(remoteAvailable ? 'Sin conexión · datos locales' : 'Modo local · falta activar tabla');
            saveLocal();
            return render();
        }

        remoteAvailable = true;
        mergeItems(data || []);
        await flushPending();
        lastSync = Date.now();
        saveLocal();
        render();
    }

    async function persistNew(item) {
        items.unshift(item);
        if (!remoteAvailable) item._pending = true;
        saveLocal();
        render();
        if (!remoteAvailable || typeof supabaseClient === 'undefined') return;

        const { error } = await supabaseClient.from(TABLE).insert([item]);
        if (error) {
            if (isMissingTable(error)) remoteAvailable = false;
            item._pending = true;
            saveLocal();
            render();
        }
    }

    async function persistUpdate(id, patch) {
        const item = items.find(row => row.id === id);
        if (!item) return;
        Object.assign(item, patch, { updated_at: new Date().toISOString() });
        saveLocal();
        render();
        if (!remoteAvailable || typeof supabaseClient === 'undefined') return;

        const remotePatch = { ...patch, updated_at: item.updated_at };
        const { error } = await supabaseClient.from(TABLE).update(remotePatch)
            .eq('id', id).eq('gestor', owner);
        if (error) {
            if (isMissingTable(error)) remoteAvailable = false;
            item._pending = true;
            saveLocal();
            render();
        } else {
            delete item._pending;
            saveLocal();
        }
    }

    function dayStart(date = new Date()) {
        const result = new Date(date);
        result.setHours(0, 0, 0, 0);
        return result;
    }

    function dayEnd(date = new Date()) {
        const result = new Date(date);
        result.setHours(23, 59, 59, 999);
        return result;
    }

    function dueTime(item) {
        return item.proximo_contacto ? new Date(item.proximo_contacto).getTime() : Infinity;
    }

    function isClosed(item) {
        return CLOSED_STATES.has(item.estado);
    }

    function getStats() {
        const start = dayStart().getTime();
        const end = dayEnd().getTime();
        return {
            overdue: items.filter(item => !isClosed(item) && dueTime(item) < start).length,
            today: items.filter(item => !isClosed(item) && dueTime(item) >= start && dueTime(item) <= end).length,
            interested: items.filter(item => item.estado === 'interesado' || item.estado === 'esperando_pago').length
        };
    }

    function filteredItems() {
        const start = dayStart().getTime();
        const end = dayEnd().getTime();
        const list = items.filter(item => {
            const due = dueTime(item);
            if (activeFilter === 'hoy') return !isClosed(item) && due <= end;
            if (activeFilter === 'atrasados') return !isClosed(item) && due < start;
            if (activeFilter === 'proximos') return !isClosed(item) && due > end;
            if (activeFilter === 'interesados') return item.estado === 'interesado' || item.estado === 'esperando_pago';
            if (activeFilter === 'cerrados') return isClosed(item);
            return true;
        });
        return list.sort((a, b) => dueTime(a) - dueTime(b));
    }

    function initials(name) {
        return String(name || '?').split(/\s+/).slice(0, 2).map(part => part[0] || '').join('').toUpperCase();
    }

    function dueLabel(item) {
        if (!item.proximo_contacto) return 'Sin fecha';
        const due = new Date(item.proximo_contacto);
        const start = dayStart().getTime();
        const end = dayEnd().getTime();
        if (due.getTime() < start) return 'Atrasado';
        if (due.getTime() <= end) return due.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });
        return due.toLocaleDateString('es', { day: '2-digit', month: 'short' });
    }

    function statusOptions(selected) {
        return Object.entries(STATE_LABELS).map(([value, label]) =>
            `<option value="${value}" ${value === selected ? 'selected' : ''}>${label}</option>`
        ).join('');
    }

    function cardHTML(item) {
        const overdue = !isClosed(item) && dueTime(item) < dayStart().getTime();
        return `
            <article class="pth-followup-card ${overdue ? 'is-overdue' : ''}" data-id="${escapeHtml(item.id)}">
                <div class="pth-followup-card-head">
                    <div class="pth-followup-avatar">${escapeHtml(initials(item.cliente))}</div>
                    <div class="pth-followup-card-copy">
                        <h4 class="pth-followup-name">${escapeHtml(item.cliente)}</h4>
                        <p class="pth-followup-product">${escapeHtml(item.producto || item.telefono)}</p>
                    </div>
                    <span class="pth-followup-due">${escapeHtml(dueLabel(item))}</span>
                </div>
                ${item.nota_corta ? `<p class="pth-followup-note">${escapeHtml(item.nota_corta)}</p>` : ''}
                <div class="pth-followup-card-actions">
                    <button class="is-whatsapp" data-action="whatsapp">WhatsApp</button>
                    <button data-action="snooze" data-days="1">Mañana</button>
                    <button data-action="snooze" data-days="3">+3 días</button>
                    <select data-action="status" aria-label="Estado">${statusOptions(item.estado)}</select>
                    <button data-action="edit">Editar</button>
                </div>
                ${item._pending ? '<p class="pth-followup-mode">Pendiente de sincronizar · guardado en este dispositivo</p>' : ''}
            </article>`;
    }

    function render() {
        if (!root) return;
        const stats = getStats();
        const list = filteredItems();
        const overdue = root.querySelector('[data-stat="overdue"]');
        const today = root.querySelector('[data-stat="today"]');
        const interested = root.querySelector('[data-stat="interested"]');
        if (overdue) overdue.textContent = stats.overdue;
        if (today) today.textContent = stats.today;
        if (interested) interested.textContent = stats.interested;

        const listNode = root.querySelector('.pth-followup-list');
        if (listNode) {
            listNode.innerHTML = list.length
                ? list.map(cardHTML).join('')
                : `<div class="pth-followup-empty"><strong>Todo al día</strong>No hay clientes en esta sección.</div>`;
        }

        root.querySelectorAll('.pth-followup-tab').forEach(button => {
            button.classList.toggle('is-active', button.dataset.filter === activeFilter);
        });
        updateLauncherBadge(stats.overdue + stats.today);
        setSyncLabel(remoteAvailable
            ? `Sincronizado ${lastSync ? relativeTime(lastSync) : 'pendiente'}`
            : 'Modo local · activa la tabla para sincronizar');
        window.dispatchEvent(new CustomEvent('pth:followups-updated', {
            detail: { stats: { ...stats } }
        }));
    }

    function relativeTime(timestamp) {
        const minutes = Math.max(0, Math.round((Date.now() - timestamp) / 60000));
        if (minutes < 2) return 'ahora';
        if (minutes < 60) return `hace ${minutes} min`;
        return `hace ${Math.round(minutes / 60)} h`;
    }

    function setSyncLabel(text) {
        const label = root?.querySelector('.pth-followup-sync');
        if (label) label.textContent = text;
    }

    function updateLauncherBadge(count) {
        const badge = document.getElementById('pth-followup-launcher-badge');
        if (!badge) return;
        badge.textContent = count > 99 ? '99+' : String(count);
        badge.style.display = count ? 'grid' : 'none';
    }

    function existingOrders() {
        try {
            if (typeof myOrdersData !== 'undefined' && Array.isArray(myOrdersData)) {
                return myOrdersData.slice(0, 50);
            }
        } catch (_) {}
        return [];
    }

    function formHTML(item = null) {
        const orders = existingOrders();
        const next = item?.proximo_contacto
            ? new Date(new Date(item.proximo_contacto).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16)
            : new Date(Date.now() + 24 * 60 * 60 * 1000 - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16);
        const orderOptions = orders.map(order =>
            `<option value="${escapeHtml(order.id)}">${escapeHtml(order.cliente)} · ${escapeHtml(String(order.producto || '').slice(0, 42))}</option>`
        ).join('');

        return `
            <form class="pth-followup-form" data-edit-id="${escapeHtml(item?.id || '')}">
                <div class="pth-followup-topline">
                    <div>
                        <p class="pth-followup-kicker">Acción comercial</p>
                        <h3>${item ? 'Editar seguimiento' : 'Nuevo seguimiento'}</h3>
                    </div>
                    <button type="button" class="pth-followup-icon-btn" data-action="close-form">✕</button>
                </div>
                ${orders.length && !item ? `
                    <label class="pth-followup-field">
                        <span>Completar desde un pedido</span>
                        <select name="source_order"><option value="">Seleccionar cliente…</option>${orderOptions}</select>
                    </label>` : ''}
                <div class="pth-followup-form-grid">
                    <label class="pth-followup-field"><span>Cliente</span><input name="cliente" required maxlength="100" value="${escapeHtml(item?.cliente || '')}"></label>
                    <label class="pth-followup-field"><span>Teléfono</span><input name="telefono" required maxlength="30" inputmode="tel" value="${escapeHtml(item?.telefono || '')}"></label>
                </div>
                <label class="pth-followup-field"><span>Producto de interés</span><input name="producto" maxlength="160" value="${escapeHtml(item?.producto || '')}"></label>
                <div class="pth-followup-form-grid">
                    <label class="pth-followup-field"><span>Próximo contacto</span><input type="datetime-local" name="proximo_contacto" required value="${next}"></label>
                    <label class="pth-followup-field"><span>Estado</span><select name="estado">${statusOptions(item?.estado || 'nuevo')}</select></label>
                </div>
                <label class="pth-followup-field"><span>Nota breve</span><textarea name="nota_corta" maxlength="300" placeholder="Qué necesita, objeción o próximo paso…">${escapeHtml(item?.nota_corta || '')}</textarea></label>
                <div class="pth-followup-actions">
                    <button type="submit" class="pth-followup-primary">${item ? 'Guardar cambios' : 'Crear recordatorio'}</button>
                    ${item?.id ? '<button type="button" class="pth-followup-primary is-whatsapp" data-action="whatsapp-form">Contactar por WhatsApp</button>' : ''}
                    <button type="button" class="pth-followup-secondary" data-action="close-form">Cancelar</button>
                </div>
                <p class="pth-followup-mode">Solo se guardan datos comerciales mínimos. No incluye comisión, CI ni dirección.</p>
            </form>`;
    }

    function openForm(item = null) {
        const wrap = root.querySelector('.pth-followup-form-wrap');
        wrap.innerHTML = formHTML(item);
        wrap.classList.add('is-open');
    }

    function closeForm() {
        const wrap = root.querySelector('.pth-followup-form-wrap');
        wrap.classList.remove('is-open');
        wrap.innerHTML = '';
    }

    function fillFromOrder(select) {
        const order = existingOrders().find(row => String(row.id) === String(select.value));
        if (!order) return;
        const form = select.closest('form');
        form.elements.cliente.value = order.cliente || '';
        form.elements.telefono.value = order.telefono || '';
        form.elements.producto.value = order.producto || '';
        form.dataset.pedidoId = order.id || '';
    }

    async function submitForm(form) {
        const editId = form.dataset.editId;
        const payload = {
            cliente: form.elements.cliente.value.trim(),
            telefono: form.elements.telefono.value.trim(),
            producto: form.elements.producto.value.trim(),
            estado: form.elements.estado.value,
            proximo_contacto: new Date(form.elements.proximo_contacto.value).toISOString(),
            nota_corta: form.elements.nota_corta.value.trim().slice(0, 300),
            pedido_id: form.dataset.pedidoId || null
        };
        if (!payload.cliente || !payload.telefono || !payload.proximo_contacto) return;

        if (editId) {
            await persistUpdate(editId, payload);
        } else {
            const now = new Date().toISOString();
            await persistNew({
                id: createId(),
                gestor: owner,
                subgestor: session.data?.parent_id ? owner : null,
                ...payload,
                ultimo_contacto: null,
                created_at: now,
                updated_at: now
            });
        }
        closeForm();
    }

    async function whatsapp(item) {
        const phone = String(item.telefono || '').replace(/\D/g, '');
        const greeting = `Hola ${String(item.cliente || '').split(' ')[0]}, soy ${owner} de ParaTuHogar. `
            + `Quería saludarte y saber cómo te ha ido con ${item.producto || 'tu compra anterior'}. `
            + 'También puedo mostrarte productos nuevos o complementarios y confirmar disponibilidad, precio y entrega.';
        window.open(`https://wa.me/${phone}?text=${encodeURIComponent(greeting)}`, '_blank', 'noopener');
        const contactedAt = new Date().toISOString();
        await persistUpdate(item.id, { ultimo_contacto: contactedAt });
        if (typeof window.renewCustomerProtection === 'function') {
            await window.renewCustomerProtection(item.telefono, owner, 'seguimiento_whatsapp');
        }
    }

    function snooze(item, days) {
        const date = new Date();
        date.setDate(date.getDate() + Number(days));
        date.setHours(10, 0, 0, 0);
        persistUpdate(item.id, { proximo_contacto: date.toISOString() });
    }

    async function scheduleProtectedCustomer({ cliente, telefono, producto, pedido_id }) {
        const normalizedPhone = String(telefono || '').replace(/\D/g, '');
        if (!normalizedPhone || !owner) return;
        const existing = items.find(item => String(item.telefono || '').replace(/\D/g, '') === normalizedPhone && !isClosed(item));
        const nextContact = new Date();
        nextContact.setDate(nextContact.getDate() + 60);
        nextContact.setHours(10, 0, 0, 0);

        if (existing) {
            await persistUpdate(existing.id, {
                cliente: cliente || existing.cliente,
                producto: producto || existing.producto,
                pedido_id: pedido_id || existing.pedido_id,
                estado: 'interesado',
                proximo_contacto: nextContact.toISOString(),
                nota_corta: 'Posventa: saludar, comprobar experiencia y recomendar productos relacionados.'
            });
            return;
        }

        const now = new Date().toISOString();
        await persistNew({
            id: createId(), gestor: owner, subgestor: session.data?.parent_id ? owner : null,
            cliente: cliente || 'Cliente', telefono, producto: producto || 'Compra anterior',
            estado: 'interesado', proximo_contacto: nextContact.toISOString(), ultimo_contacto: null,
            nota_corta: 'Posventa: saludar, comprobar experiencia y recomendar productos relacionados.',
            pedido_id: pedido_id || null, created_at: now, updated_at: now
        });
    }

    async function importProtectedCustomers(customers = []) {
        if (!owner || !Array.isArray(customers) || !customers.length) return { imported: 0 };
        await sync(true);

        const knownPhones = new Set(items.map(item => String(item.telefono || '').replace(/\D/g, '')).filter(Boolean));
        if (remoteAvailable && typeof supabaseClient !== 'undefined') {
            const { data } = await supabaseClient.from(TABLE)
                .select('telefono').eq('gestor', owner).limit(500);
            (data || []).forEach(row => knownPhones.add(String(row.telefono || '').replace(/\D/g, '')));
        }

        const missing = customers.filter(customer => {
            const phone = String(customer.telefono || '').replace(/\D/g, '');
            return phone && !knownPhones.has(phone) && (knownPhones.add(phone), true);
        });
        if (!missing.length) return { imported: 0 };

        const now = new Date();
        const created = missing.map((customer, index) => {
            // Distribuye la cartera en grupos de cinco por día para que sea atendible.
            const next = new Date(now);
            next.setDate(next.getDate() + 1 + Math.floor(index / 5));
            next.setHours(10, 0, 0, 0);
            const iso = now.toISOString();
            return {
                id: createId(), gestor: owner, subgestor: session.data?.parent_id ? owner : null,
                cliente: customer.cliente || 'Cliente protegido', telefono: customer.telefono,
                producto: customer.producto || 'Compra anterior', estado: 'interesado',
                proximo_contacto: next.toISOString(), ultimo_contacto: null,
                nota_corta: 'Cliente protegido importado. Saludar, comprobar su experiencia y recomendar algo relacionado.',
                pedido_id: customer.pedido_id || null, created_at: iso, updated_at: iso
            };
        });

        if (remoteAvailable && typeof supabaseClient !== 'undefined') {
            const { error } = await supabaseClient.from(TABLE).insert(created.map(remoteRow));
            if (error) created.forEach(item => { item._pending = true; });
        } else {
            created.forEach(item => { item._pending = true; });
        }
        mergeItems(created);
        saveLocal();
        render();
        return { imported: created.length };
    }

    function openCustomer(phone) {
        const normalizedPhone = String(phone || '').replace(/\D/g, '');
        const item = items.find(row => String(row.telefono || '').replace(/\D/g, '') === normalizedPhone);
        root?.classList.add('is-open');
        document.body.style.overflow = 'hidden';
        if (item) openForm(item);
        else {
            openForm();
            const form = root?.querySelector('.pth-followup-form');
            if (form?.elements?.telefono) form.elements.telefono.value = phone;
        }
    }

    function exportBackup() {
        const blob = new Blob([JSON.stringify({ owner, exportedAt: new Date().toISOString(), items }, null, 2)], {
            type: 'application/json'
        });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `seguimientos_${normalize(owner)}.json`;
        link.click();
        URL.revokeObjectURL(link.href);
    }

    function handleClick(event) {
        const actionNode = event.target.closest('[data-action]');
        if (!actionNode) return;
        const action = actionNode.dataset.action;
        if (action === 'close') return close();
        if (action === 'new') return openForm();
        if (action === 'close-form') return closeForm();
        if (action === 'sync') return sync(true);
        if (action === 'export') return exportBackup();
        if (action === 'whatsapp-form') {
            const editId = actionNode.closest('form')?.dataset.editId;
            const formItem = items.find(row => row.id === editId);
            if (formItem) whatsapp(formItem);
            return;
        }
        const card = actionNode.closest('[data-id]');
        const item = items.find(row => row.id === card?.dataset.id);
        if (!item) return;
        if (action === 'whatsapp') whatsapp(item);
        if (action === 'snooze') snooze(item, actionNode.dataset.days);
        if (action === 'edit') openForm(item);
    }

    function buildUI() {
        root = document.createElement('div');
        root.className = 'pth-followup-overlay';
        root.innerHTML = `
            <section class="pth-followup-panel" role="dialog" aria-modal="true" aria-label="Seguimiento de clientes">
                <header class="pth-followup-header">
                    <div class="pth-followup-topline">
                        <div><p class="pth-followup-kicker">Tu agenda comercial</p><h2 class="pth-followup-title">Seguimiento de clientes</h2></div>
                        <button class="pth-followup-icon-btn" data-action="close" aria-label="Cerrar">✕</button>
                    </div>
                    <div class="pth-followup-stats">
                        <div class="pth-followup-stat is-overdue"><small>Atrasados</small><strong data-stat="overdue">0</strong></div>
                        <div class="pth-followup-stat is-today"><small>Para hoy</small><strong data-stat="today">0</strong></div>
                        <div class="pth-followup-stat is-interest"><small>Interesados</small><strong data-stat="interested">0</strong></div>
                    </div>
                </header>
                <div class="pth-followup-toolbar">
                    <div class="pth-followup-actions">
                        <button class="pth-followup-primary" data-action="new">+ Nuevo</button>
                        <button class="pth-followup-secondary" data-action="sync">Actualizar</button>
                        <button class="pth-followup-secondary" data-action="export">Copia</button>
                        <span class="pth-followup-sync">Preparando…</span>
                    </div>
                    <nav class="pth-followup-tabs">
                        <button class="pth-followup-tab is-active" data-filter="hoy">Hoy</button>
                        <button class="pth-followup-tab" data-filter="atrasados">Atrasados</button>
                        <button class="pth-followup-tab" data-filter="proximos">Próximos</button>
                        <button class="pth-followup-tab" data-filter="interesados">Interesados</button>
                        <button class="pth-followup-tab" data-filter="cerrados">Cerrados</button>
                    </nav>
                </div>
                <main class="pth-followup-list"></main>
                <div class="pth-followup-form-wrap"></div>
            </section>`;
        document.body.appendChild(root);

        root.addEventListener('click', handleClick);
        root.addEventListener('click', event => {
            const tab = event.target.closest('[data-filter]');
            if (tab) {
                activeFilter = tab.dataset.filter;
                render();
            } else if (event.target === root) {
                close();
            }
        });
        root.addEventListener('change', event => {
            if (event.target.name === 'source_order') fillFromOrder(event.target);
            if (event.target.dataset.action === 'status') {
                const item = items.find(row => row.id === event.target.closest('[data-id]')?.dataset.id);
                if (item) persistUpdate(item.id, { estado: event.target.value });
            }
        });
        root.addEventListener('submit', event => {
            event.preventDefault();
            submitForm(event.target);
        });
    }

    function buildLauncher() {
        const reference = document.getElementById('btn-magic-studio');
        if (!reference || document.getElementById('btn-client-followup')) return;
        const button = document.createElement('button');
        button.id = 'btn-client-followup';
        button.className = 'pth-followup-launcher h-10 px-4 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 text-white border border-indigo-400 flex items-center justify-center gap-2 shadow-lg whitespace-nowrap';
        button.title = 'Seguimiento de clientes';
        button.innerHTML = `<span class="material-symbols-outlined text-xl">notification_important</span><span class="text-xs font-black">Seguimientos</span><span id="pth-followup-launcher-badge" class="pth-followup-badge">0</span>`;
        button.addEventListener('click', open);
        reference.insertAdjacentElement('afterend', button);
    }

    function open(filter) {
        if (!root) return;
        if (['hoy', 'atrasados', 'proximos', 'interesados', 'cerrados'].includes(filter)) {
            activeFilter = filter;
            render();
        }
        root.classList.add('is-open');
        document.body.style.overflow = 'hidden';
        sync(false);
    }

    function close() {
        root.classList.remove('is-open');
        closeForm();
        document.body.style.overflow = '';
    }

    function init() {
        session = readJSON('pth_session', null);
        if (!session?.name) return;
        owner = String(session.name);
        storageKey = `pth_followups_v1_${normalize(owner)}`;
        loadLocal();
        buildLauncher();
        buildUI();
        render();
        sync(false);
    }

    window.PTHFollowups = {
        getStats: () => ({ ...getStats() }),
        open,
        sync: () => sync(true),
        scheduleProtectedCustomer,
        importProtectedCustomers,
        openCustomer
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init, { once: true });
    } else {
        init();
    }
})();
