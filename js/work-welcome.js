/* Practical introduction to existing tools. No telemetry or automatic data capture. */
(function (root) {
    'use strict';
    const steps = [
        { title: 'Encuentra lo que vas a ofrecer', text: 'Busca por nombre o modelo y usa los filtros del Catálogo. Abre «Ver detalles» para revisar precio, disponibilidad y garantía.', action: 'Ir al catálogo', target: 'catalogo' },
        { title: 'Comparte y prepara el pedido', text: 'En una ficha puedes copiar la oferta o usar «Crear Story». Magic Studio prepara imágenes de varios equipos. Añade lo que el cliente confirme y revisa el pedido antes de enviarlo.', action: 'Ver productos', target: 'catalogo' },
        { title: 'Revisa tu trabajo en el Dashboard', text: 'Consulta pedidos, comisiones y ranking. Usa Seguimientos para próximos contactos y descarga la guía. Para trabajar con poca conexión, revisa primero los requisitos en la guía.', action: 'Abrir mi Dashboard', target: 'dashboard' }
    ];
    const prefix = 'pth_welcome_v2:';
    const seen = new Set();
    let step = 0, identity = null, timer = null, returnFocus = null;
    const dialog = () => root.document.getElementById('pth-welcome');
    const account = () => root.currentUserData?.id ? String(root.currentUserData.id) : null;
    function eligible() {
        const nav = root.document.getElementById('admin-nav');
        return Boolean(account() && root.currentUserData?.rol !== 'mensajero' && root.PTHSecureData?.token() && nav && !nav.hidden &&
            !nav.classList.contains('hidden') && !root.PTHWorkView?.isAdminView(root.currentUserData));
    }
    function read(key) { try { return root.localStorage.getItem(key); } catch (_) { return null; } }
    function remember(id) {
        seen.add(id);
        try { root.localStorage.setItem(prefix + id, 'seen'); } catch (_) {}
    }
    function alreadySeen(id) {
        if (seen.has(id) || read(prefix + id)) return true;
        // Preserve dismissal of the old introduction on this browser; migrate once.
        if (read('sl_tutorial_completed_v1')) {
            remember(id);
            try { root.localStorage.removeItem('sl_tutorial_completed_v1'); } catch (_) {}
            return true;
        }
        return false;
    }
    function visible(node) {
        const style = root.getComputedStyle(node);
        return node.getClientRects().length > 0 && style.display !== 'none' && style.visibility !== 'hidden';
    }
    function busy() {
        return Array.from(root.document.querySelectorAll('dialog[open], [role="dialog"][aria-modal="true"], .fixed.inset-0'))
            .some(node => node !== dialog() && visible(node));
    }
    function render() {
        const current = steps[step];
        root.document.getElementById('pth-welcome-step').textContent = `${step + 1} de ${steps.length}`;
        root.document.getElementById('pth-welcome-title').textContent = current.title;
        root.document.getElementById('pth-welcome-text').textContent = current.text;
        root.document.getElementById('pth-welcome-action').textContent = current.action;
        root.document.getElementById('pth-welcome-back').disabled = step === 0;
        root.document.getElementById('pth-welcome-next').textContent = step === steps.length - 1 ? 'Terminar' : 'Continuar';
    }
    function close(restore = true) {
        if (!dialog()?.open) return;
        dialog().close();
        if (restore && returnFocus?.isConnected && visible(returnFocus)) returnFocus.focus({ preventScroll: true });
        returnFocus = null;
    }
    function open() {
        if (!eligible() || busy() || !dialog()?.showModal) return false;
        if (dialog().open) return true;
        identity = account(); step = 0; render();
        returnFocus = root.document.activeElement;
        dialog().showModal(); remember(identity);
        root.document.getElementById('pth-welcome-title').focus({ preventScroll: true });
        return true;
    }
    function sync() {
        const id = account();
        if (dialog()?.open && (!eligible() || id !== identity || busy())) close(false);
        identity = id;
        if (!eligible() || alreadySeen(id) || dialog()?.open || busy()) return;
        open();
    }
    function schedule() {
        if (timer !== null) return;
        timer = root.setTimeout(() => { timer = null; sync(); }, 300);
    }
    function navigate() {
        if (!eligible() || account() !== identity) { close(false); return; }
        const target = steps[step].target;
        close(false);
        if (typeof root.showSection !== 'function') return;
        root.showSection(target);
        if (target === 'catalogo') root.document.getElementById('search-bar')?.focus({ preventScroll: true });
        else {
            const title = root.document.getElementById('gestor-home-title');
            if (title) { title.tabIndex = -1; title.focus({ preventScroll: true }); }
        }
    }
    function init() {
        if (!dialog()) return;
        root.document.getElementById('pth-welcome-skip').addEventListener('click', () => close());
        root.document.getElementById('pth-welcome-next').addEventListener('click', () => {
            if (!dialog().open || !eligible()) return;
            if (step === steps.length - 1) close(); else { step++; render(); }
        });
        root.document.getElementById('pth-welcome-back').addEventListener('click', () => { if (dialog().open && step > 0) { step--; render(); } });
        root.document.getElementById('pth-welcome-action').addEventListener('click', navigate);
        root.document.getElementById('pth-welcome-reopen')?.addEventListener('click', open);
        dialog().addEventListener('cancel', event => { event.preventDefault(); close(); });
        new MutationObserver(() => {
            if (dialog().open && (!eligible() || account() !== identity || busy())) close(false);
            schedule();
        }).observe(root.document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'style', 'hidden', 'open', 'aria-hidden'] });
        root.addEventListener('pth:session-changed', () => { close(false); schedule(); });
        root.addEventListener('storage', event => { if (event.key === null || event.key?.startsWith(prefix) || ['pth_session', 'pth_secure_token'].includes(event.key)) { close(false); schedule(); } });
        root.addEventListener('pagehide', () => close(false));
        root.addEventListener('pageshow', schedule);
        schedule();
    }
    root.PTHWelcome = { open, close, sync };
    if (root.document.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', init, { once: true });
    else init();
})(window);
