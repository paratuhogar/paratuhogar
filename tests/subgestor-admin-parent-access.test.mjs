import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const html = fs.readFileSync(new URL('../subgestores.html', import.meta.url), 'utf8');
const start = html.indexOf("window.addEventListener('load', async () =>");
const init = html.slice(start, html.indexOf('function mostrarBloqueo()', start));

async function openNetwork(profile) {
    const nodes = new Map();
    for (const id of ['alert-access-denied', 'parent-dashboard-content', 'label-parent-name', 'input-invite-link', 'input-direct-invite-link']) {
        const classes = new Set(['hidden']);
        nodes.set(id, { value: '', innerText: '', classList: { remove: key => classes.delete(key), contains: key => classes.has(key) } });
    }
    let saved = JSON.stringify({ name: profile.nombre, isAdmin: true, data: profile });
    let onLoad;
    const context = {
        console, currentParent: null,
        localStorage: { getItem: () => saved, setItem: (_, value) => { saved = value; } },
        document: { getElementById: id => nodes.get(id) },
        location: { origin: 'https://paratuhogar.org', pathname: '/subgestores.html' },
        PTHSecureData: { restore: async () => ({ ...profile }) },
        supabaseClient: { from: () => ({ select() { return this; }, eq() { return this; }, maybeSingle: async () => ({ data: { ...profile }, error: null }) }) },
        getOrGenerateShortLink: async (_, link) => link, loadData() {},
        mostrarBloqueo: () => nodes.get('alert-access-denied').classList.remove('hidden'),
        addEventListener: (_, fn) => { onLoad = fn; }
    };
    context.window = context;
    vm.runInNewContext(init, context);
    await onLoad();
    return { context, nodes };
}

test('administrators can still manage their own subgestor network in sales mode', async () => {
    for (const nombre of ['Jomil', 'Beatriz Barrero']) {
        const { context, nodes } = await openNetwork({ id: nombre, nombre, rol: 'admin', estado: 'activo', parent_id: null });
        assert.equal(nodes.get('alert-access-denied').classList.contains('hidden'), true);
        assert.equal(nodes.get('parent-dashboard-content').classList.contains('hidden'), false);
        assert.equal(context.currentParent.nombre, nombre);
        assert.equal(nodes.get('label-parent-name').innerText, 'Gestor Principal: ' + nombre.toUpperCase());
    }
});

test('admin-labelled subgestors and inactive accounts cannot open the parent network', async () => {
    for (const profile of [
        { id: 'sub', nombre: 'Sub', rol: 'admin', estado: 'activo', parent_id: 'principal' },
        { id: 'inactive', nombre: 'Inactive', rol: 'admin', estado: 'inactivo', parent_id: null }
    ]) {
        const { context, nodes } = await openNetwork(profile);
        assert.equal(nodes.get('alert-access-denied').classList.contains('hidden'), false);
        assert.equal(nodes.get('parent-dashboard-content').classList.contains('hidden'), true);
        assert.equal(context.currentParent, null);
    }
});
