import readStorefront from './read-storefront.cjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const html = readStorefront();
const controllerPath = new URL('../js/admin-work-view.js', import.meta.url);
const angel = { id: 'angel-id', nombre: 'Angel Rodriguez', rol: 'superadmin', parent_id: null, password: '__session__' };

function page(profile = angel) {
    const values = new Map([['pth_secure_token', 'unchanged-token'], ['pth_session', JSON.stringify({ data: profile })]]);
    const storage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, String(value)), removeItem: key => values.delete(key) };
    const nodes = new Map();
    function element(hidden = false) {
        const classes = new Set(hidden ? ['hidden'] : []);
        const attributes = new Map();
        return { disabled: false, style: {}, innerText: '', textContent: '', value: '',
            setAttribute: (name, value) => attributes.set(name, String(value)), getAttribute: name => attributes.get(name) ?? null,
            classList: { add: c => classes.add(c), remove: c => classes.delete(c), contains: c => classes.has(c), toggle(c, force) { const add = force ?? !classes.has(c); add ? classes.add(c) : classes.delete(c); } },
            appendChild() {}, prepend() {}, insertBefore() {}, remove() {} };
    }
    const header = element();
    for (const match of html.matchAll(/<[^>]*\bid="([^"]+)"[^>]*>/g)) {
        const node = element(/\bclass="[^"]*\bhidden\b/.test(match[0]));
        node.parentElement = header; nodes.set(match[1], node);
    }
    const calls = [];
    const context = { console, Set, Promise, localStorage: storage, currentUserData: { ...profile },
        document: { documentElement: element(), body: element(), getElementById: id => nodes.get(id) ?? null, querySelectorAll: () => [], querySelector: () => header, createElement: () => element() },
        alert: message => calls.push(['alert', message]), scrollTo() {}, setTimeout() {},
        PTHSecureData: { restore: async () => ({ ...profile }) },
        supabaseClient: { from: () => ({ select() { return this; }, eq() { return this; }, single: async () => ({ data: { id: profile.id, parent_id: profile.parent_id } }), maybeSingle: async () => ({ data: { nombre: 'Principal', telefono: '5350000000' } }) }) },
        loadAdminData: async () => calls.push(['admin']), loadProducts: async () => calls.push(['catalogue']),
        loadProDashboard: async name => calls.push(['orders', name]), loadClientCRM: async () => {},
        loadMyPayoutRequests() {}, renderGestorHomeFromCache() {}, myOrdersData: [] };
    context.navigator = {onLine:true}; context.offlineStorefront = {usingCopy:()=>false,current:()=>null,fallback:async()=>null,live(){},status(){}};
 context.window = context;
    if (fs.existsSync(controllerPath)) vm.runInNewContext(fs.readFileSync(controllerPath, 'utf8'), context);
    const setupStart = html.indexOf('async function setupSession(');
    const setupEnd = html.indexOf('// --- 2. LÓGICA DASHBOARD PRO', setupStart);
    vm.runInNewContext(html.slice(setupStart, setupEnd), context);
    const sectionStart = html.lastIndexOf('function showSection(');
    const sectionEnd = html.indexOf('// GESTORES', sectionStart);
    vm.runInNewContext(html.slice(sectionStart, sectionEnd), context);
    const attributionStart = html.indexOf('async function obtenerDuenoReal(');
    const attributionEnd = html.indexOf('// --- SÚPER FUNCIÓN IA', attributionStart);
    vm.runInNewContext(html.slice(attributionStart, attributionEnd), context);
    const rankingStart = html.indexOf('function renderLockedRanking(');
    const rankingEnd = html.indexOf('\n}', rankingStart) + 2;
    vm.runInNewContext(html.slice(rankingStart, rankingEnd), context);
    context.renderRankingAnonimo = (orders, name) => calls.push(['ranking', name]);
    assert.ok(context.PTHWorkView, 'the work-view controller must exist');
    return { context, nodes, calls, values, storage };
}

test('administrator switches to catalogue and back without changing identity, token or role', async () => {
    const { context, nodes, calls, storage } = page();
    const session = storage.getItem('pth_session');
    await context.setupSession(angel.nombre, true);
    assert.equal(nodes.get('sec-admin-master').classList.contains('hidden'), false);
    assert.equal(nodes.get('btn-admin-to-sales').classList.contains('hidden'), false);
    await context.PTHWorkView.switchView('gestor');
    assert.equal(context.gestorName, 'Angel Rodriguez');
    assert.equal(context.currentUserData.rol, 'superadmin');
    assert.equal(await context.obtenerDuenoReal('5351234567'), 'Angel Rodriguez');
    assert.equal(context.isAdmin, false);
    assert.equal(nodes.get('sec-admin-master').classList.contains('hidden'), true);
    assert.equal(nodes.get('sec-catalogo').style.display, 'block');
    assert.equal(nodes.get('btn-sales-to-admin').classList.contains('hidden'), false);
    assert.ok(calls.some(([kind, name]) => kind === 'orders' && name === 'Angel Rodriguez'));
    await context.PTHWorkView.switchView('admin');
    assert.equal(context.isAdmin, true);
    assert.equal(nodes.get('sec-admin-master').classList.contains('hidden'), false);
    assert.equal(nodes.get('sec-dashboard').classList.contains('hidden'), true);
    assert.equal(nodes.get('gestor-command-center').classList.contains('hidden'), true);
    assert.equal(nodes.get('btn-sales-to-admin').classList.contains('hidden'), true);
    assert.equal(storage.getItem('pth_secure_token'), 'unchanged-token');
    assert.equal(storage.getItem('pth_session'), session);
});

test('sales preference survives page setup but is isolated to the verified account', async () => {
    const { context } = page();
    await context.PTHWorkView.switchView('gestor');
    await context.setupSession(angel.nombre, true);
    assert.equal(context.isAdmin, false);
    assert.equal(context.PTHWorkView.isAdminView({ id: 'other-admin', rol: 'superadmin', parent_id: null }), true);
});

test('Jomil and Beatriz enter the panel and switch views with their existing admin role', async () => {
    for (const nombre of ['Jomil', 'Beatriz Barrero']) {
        const profile = { id: 'admin-' + nombre, nombre, rol: 'admin', parent_id: null };
        const { context, nodes, storage } = page(profile);
        const session = storage.getItem('pth_session');
        await context.setupSession(nombre, false);
        assert.equal(context.isAdmin, true);
        assert.equal(nodes.get('btn-admin-to-sales').classList.contains('hidden'), false);
        await context.PTHWorkView.switchView('gestor');
        assert.equal(context.isAdmin, false);
        assert.equal(nodes.get('btn-sales-to-admin').classList.contains('hidden'), false);
        assert.equal(await context.obtenerDuenoReal('5350000000'), nombre);
        await context.setupSession(nombre, true);
        assert.equal(context.isAdmin, false, 'reload retains the account sales preference');
        await context.PTHWorkView.switchView('admin');
        assert.equal(context.isAdmin, true);
        assert.equal(context.currentUserData.rol, 'admin');
        assert.equal(storage.getItem('pth_session'), session);
        assert.equal(storage.getItem('pth_secure_token'), 'unchanged-token');
    }
});

test('every server-recognized administrative role can switch but parent-linked accounts cannot', async () => {
    for (const rol of ['admin', 'administrador', 'superadmin', 'logistica', 'ADMIN']) {
        for (const parent_id of [null, 'principal']) {
            const profile = { id: rol, nombre: 'Admin', rol, parent_id };
            const { context, nodes } = page(profile);
            await context.setupSession(profile.nombre, true);
            assert.equal(context.isAdmin, parent_id === null, rol);
            assert.equal(nodes.get('btn-admin-to-sales').classList.contains('hidden'), parent_id !== null);
        }
    }
});

test('verified admin login saves administrative mode before opening the panel', async () => {
    const profile = { id: 'jomil-test', nombre: 'Jomil', rol: 'admin', parent_id: null };
    const { context, nodes, storage } = page(profile);
    context.PTHSecureData.login = async () => ({ ...profile });
    nodes.get('log-user').value = 'Jomil';
    nodes.get('log-pass').value = 'test-only-credential';
    const saveStart = html.indexOf('function saveSessionToMemory(');
    vm.runInNewContext(html.slice(saveStart, html.indexOf('function enterAsClient(', saveStart)), context);
    const loginStart = html.indexOf('async function processLogin(');
    vm.runInNewContext(html.slice(loginStart, html.indexOf('window.togglePassword', loginStart)), context);
    await context.processLogin();
    assert.equal(JSON.parse(storage.getItem('pth_session')).isAdmin, true);
    assert.equal(context.isAdmin, true);
    assert.equal(nodes.get('login-overlay').classList.contains('hidden'), true);
});

test('gestors and parent-linked accounts cannot select administrative view', async () => {
    for (const profile of [{ id: 'gestor', nombre: 'Normal', rol: 'gestor' }, { ...angel, parent_id: 'principal' }]) {
        const { context, nodes, calls, values } = page(profile);
        values.set('pth_work_view:' + profile.id, 'admin');
        await context.setupSession(profile.nombre, true);
        assert.equal(context.isAdmin, false);
        assert.equal(nodes.get('btn-admin-to-sales').classList.contains('hidden'), true);
        await context.PTHWorkView.switchView('admin');
        assert.equal(context.isAdmin, false);
        assert.equal(calls.filter(([kind]) => kind === 'admin').length, 0);
    }
});

test('session verification failure cannot change view or credentials', async () => {
    const { context, nodes, storage, calls } = page();
    await context.setupSession(angel.nombre, true);
    context.PTHSecureData.restore = async () => { throw Error('Connection unavailable'); };
    await context.PTHWorkView.switchView('gestor');
    assert.equal(context.isAdmin, true);
    assert.equal(storage.getItem('pth_work_view:angel-id'), null);
    assert.equal(nodes.get('btn-admin-to-sales').disabled, false);
    assert.ok(calls.some(([kind]) => kind === 'alert'));
    assert.equal(storage.getItem('pth_secure_token'), 'unchanged-token');
});

test('switch checks the restored profile rather than locally claiming an administrator role', async () => {
    const { context, calls, storage } = page();
    context.PTHSecureData.restore = async () => ({ id: 'normal', nombre: 'Normal', rol: 'gestor' });
    await context.PTHWorkView.switchView('admin');
    assert.equal(storage.getItem('pth_work_view:normal'), null);
    assert.equal(calls.filter(([kind]) => kind === 'admin').length, 0);
    assert.ok(calls.some(([kind]) => kind === 'alert'));
});

test('repeated taps cannot race two simultaneous view changes', async () => {
    const { context, nodes, calls } = page();
    let finish;
    context.PTHSecureData.restore = () => new Promise(resolve => { finish = resolve; });
    const first = context.PTHWorkView.switchView('gestor');
    assert.equal(nodes.get('btn-admin-to-sales').disabled, true);
    await context.PTHWorkView.switchView('admin');
    finish({ ...angel });
    await first;
    assert.equal(context.isAdmin, false);
    assert.equal(calls.filter(([kind]) => kind === 'admin').length, 0);
    assert.equal(nodes.get('btn-sales-to-admin').disabled, false);
});

test('a slow initial sales setup cannot reopen the catalogue after returning to admin', async () => {
    const { context, nodes, storage } = page();
    storage.setItem('pth_work_view:angel-id', 'gestor');
    let finish;
    let started;
    const loadingStarted = new Promise(resolve => { started = resolve; });
    context.loadProducts = () => { started(); return new Promise(resolve => { finish = resolve; }); };
    const initialSetup = context.setupSession(angel.nombre, true);
    await loadingStarted;
    await context.PTHWorkView.switchView('admin');
    finish();
    await initialSetup;
    assert.equal(context.isAdmin, true);
    assert.equal(nodes.get('sec-admin-master').classList.contains('hidden'), false);
    assert.equal(nodes.get('sec-catalogo').style.display, 'none');
    assert.equal(nodes.get('sec-dashboard').classList.contains('hidden'), true);
});

test('failed sales rendering restores the complete previous admin view', async () => {
    const { context, nodes, storage } = page();
    await context.setupSession(angel.nombre, true);
    context.loadProducts = async () => { throw Error('Catalog loading failed'); };
    await context.PTHWorkView.switchView('gestor');
    assert.equal(storage.getItem('pth_work_view:angel-id'), null);
    assert.equal(context.isAdmin, true);
    assert.equal(context.gestorName, 'Angel Rodriguez');
    assert.equal(nodes.get('sec-admin-master').classList.contains('hidden'), false);
    assert.equal(nodes.get('sec-catalogo').style.display, 'none');
    assert.equal(nodes.get('btn-admin-to-sales').classList.contains('hidden'), false);
    assert.equal(nodes.get('btn-sales-to-admin').classList.contains('hidden'), true);
});

test('administrator retains ranking privileges in sales while normal low-level gestor stays locked', async () => {
    for (const [profile, expected] of [[angel, 1], [{ id: 'normal', nombre: 'Normal', rol: 'gestor' }, 0]]) {
        const { context, calls } = page(profile);
        context.isAdmin = false;
        context.currentGestorLevel = 0;
        context.renderLockedRanking([], profile.nombre);
        assert.equal(calls.filter(([kind]) => kind === 'ranking').length, expected);
    }
});
