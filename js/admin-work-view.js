/* View preference only. Authorization remains in the verified server session. */
(function (root) {
    'use strict';
    const buttonIds = ['btn-admin-to-sales', 'btn-sales-to-admin'];
    let switching = false;
    let setupVersion = 0;
    const keyFor = profile => 'pth_work_view:' + profile.id;
    const beginSetup = () => ++setupVersion;
    const isCurrentSetup = version => version === setupVersion;

    function canSwitch(profile = root.currentUserData) {
        return Boolean(profile?.id && !profile.parent_id && ['superadmin', 'logistica'].includes(profile.rol));
    }
    function isAdminView(profile) {
        if (!canSwitch(profile)) return false;
        try { return root.localStorage.getItem(keyFor(profile)) !== 'gestor'; }
        catch (_) { return true; }
    }
    function syncButtons(profile, adminView) {
        const allowed = canSwitch(profile);
        root.document.getElementById('btn-admin-to-sales')?.classList.toggle('hidden', !allowed || !adminView);
        root.document.getElementById('btn-sales-to-admin')?.classList.toggle('hidden', !allowed || adminView);
    }
    async function switchView(view) {
        if (switching) return;
        switching = true;
        buttonIds.forEach(id => { const button = root.document.getElementById(id); if (button) button.disabled = true; });
        let preferenceKey;
        let previous;
        let rendering = false;
        const previousState = { profile: root.currentUserData, name: root.gestorName, admin: root.isAdmin };
        const viewIds = ['sec-admin-master', 'sec-catalogo', 'sec-dashboard', 'gestor-command-center', 'admin-nav', ...buttonIds];
        const previousNodes = viewIds.map(id => root.document.getElementById(id)).filter(Boolean)
            .map(node => ({ node, hidden: node.classList.contains('hidden'), display: node.style.display }));
        const label = root.document.getElementById('gestor-label');
        const previousLabel = label?.innerText;
        try {
            if (!['gestor', 'admin'].includes(view)) throw Error('Vista no válida.');
            const profile = await root.PTHSecureData.restore();
            if (!canSwitch(profile)) throw Error('Esta cuenta no tiene acceso a las dos vistas.');
            preferenceKey = keyFor(profile);
            previous = root.localStorage.getItem(preferenceKey);
            root.localStorage.setItem(preferenceKey, view);
            root.currentUserData = profile;
            rendering = true;
            await root.setupSession(profile.nombre, view === 'admin');
            root.scrollTo(0, 0);
        } catch (error) {
            if (preferenceKey) {
                try { previous === null ? root.localStorage.removeItem(preferenceKey) : root.localStorage.setItem(preferenceKey, previous); } catch (_) {}
            }
            if (rendering) {
                beginSetup(); // Invalidate any unfinished rendering before restoring the old frame.
                root.currentUserData = previousState.profile;
                root.gestorName = previousState.name;
                root.isAdmin = previousState.admin;
                previousNodes.forEach(({node, hidden, display}) => { node.classList.toggle('hidden', hidden); node.style.display = display; });
                if (label) label.innerText = previousLabel;
            }
            root.alert(error.message || 'No se pudo cambiar de vista. Intenta de nuevo.');
        } finally {
            switching = false;
            buttonIds.forEach(id => { const button = root.document.getElementById(id); if (button) button.disabled = false; });
        }
    }
    root.PTHWorkView = { canSwitch, isAdminView, syncButtons, switchView, beginSetup, isCurrentSetup };
})(window);
