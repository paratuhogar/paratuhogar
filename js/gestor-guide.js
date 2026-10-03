/* Static, reviewed tutorial only. No customer fields, sessions or reports in the asset. */
(function (root) {
    'use strict';
    const PDF_PATH = '/guias/guia-gestores.pdf';
    let generation = 0, ready = null, inFlight = null, checked = false;
    const card = () => root.document.getElementById('pth-guide-download');
    const link = () => root.document.getElementById('pth-guide-link');
    function eligible() {
        const nav = root.document.getElementById('admin-nav');
        const dashboard = root.document.getElementById('sec-dashboard');
        return Boolean(root.currentUserData?.id && root.currentUserData?.rol !== 'mensajero' && root.PTHSecureData?.token() && nav && dashboard &&
            !dashboard.classList.contains('hidden') && !dashboard.hidden &&
            !nav.classList.contains('hidden') && !nav.hidden &&
            !root.PTHWorkView?.isAdminView(root.currentUserData));
    }
    function hide() { if (card()) card().hidden = true; link()?.removeAttribute('href'); }
    function validate(value) {
        if (!value || value.published !== true || value.status !== 'final' || value.path !== PDF_PATH ||
            !Number.isSafeInteger(value.bytes) || value.bytes < 10 || value.bytes > 5000000 ||
            !/^\d{4}-\d{2}-\d{2}\.\d+$/.test(value.revision || '') ||
            !/^\d{4}-\d{2}-\d{2}$/.test(value.updatedAt || '') ||
            !/^[a-f0-9]{64}$/.test(value.sha256 || '')) return null;
        const [year, month, day] = value.updatedAt.split('-').map(Number);
        const date = new Date(Date.UTC(year, month - 1, day, 12));
        if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
        return { ...value, date };
    }
    function render() {
        if (!ready || !eligible()) { hide(); return; }
        const date = new Intl.DateTimeFormat('es', { dateStyle: 'medium', timeZone: 'America/Havana' }).format(ready.date);
        const weight = new Intl.NumberFormat('es', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(ready.bytes / 1000000);
        root.document.getElementById('pth-guide-meta').textContent = `Actualizado: ${date} · Revisión ${ready.revision.split('.').pop()} · PDF ${weight} MB`;
        link().href = PDF_PATH + '?v=' + encodeURIComponent(ready.revision);
        card().hidden = false;
    }
    async function sync(force = false) {
        if (!card() || !eligible()) { hide(); return; }
        if (checked && !force) { render(); return; }
        if (inFlight) return inFlight;
        const version = generation;
        inFlight = (async () => {
            try {
                const response = await root.fetch('/guias/gestores.json?v=20261003-guide1', { cache: 'no-cache', credentials: 'same-origin' });
                if (!response.ok) throw Error('guide metadata unavailable');
                const release = validate(await response.json());
                if (release) {
                    const pdf = await root.fetch(PDF_PATH + '?v=' + encodeURIComponent(release.revision), { method: 'HEAD', cache: 'no-cache', credentials: 'same-origin' });
                    const length = pdf.headers.get('content-length');
                    if (!pdf.ok || !/^application\/pdf(?:;|$)/i.test(pdf.headers.get('content-type') || '') ||
                        (length !== null && Number(length) !== release.bytes)) throw Error('guide file unavailable');
                }
                if (version !== generation) return;
                ready = release; checked = true;
                render();
            } catch (_) { if (version === generation) { ready = null; checked = true; hide(); } }
            finally { if (version === generation) inFlight = null; }
        })();
        return inFlight;
    }
    function reset() { generation++; ready = null; checked = false; inFlight = null; hide(); void sync(); }
    function init() {
        const nav = root.document.getElementById('admin-nav');
        if (!nav || !card()) return;
        new MutationObserver(() => { void sync(); }).observe(nav, { attributes: true, attributeFilter: ['class', 'hidden', 'style'] });
        const dashboard = root.document.getElementById('sec-dashboard');
        if (dashboard) new MutationObserver(() => { void sync(); }).observe(dashboard, { attributes: true, attributeFilter: ['class', 'hidden', 'style'] });
        root.addEventListener('pth:session-changed', reset);
        root.addEventListener('storage', event => { if (event.key === null || ['pth_secure_token', 'pth_session'].includes(event.key)) reset(); });
        root.addEventListener('online', () => { void sync(true); });
        root.addEventListener('pagehide', hide);
        root.addEventListener('pageshow', () => { void sync(); });
        void sync();
    }
    if (root.document.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', init, { once: true });
    else init();
    root.PTHGuide = { sync, reset };
})(window);
