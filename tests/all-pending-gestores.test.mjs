import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import data from '../js/admin-panel-data.js';

const source = fs.readFileSync(new URL('../js/storefront-extras.js', import.meta.url), 'utf8');
const code = source.slice(source.indexOf('let pendingGestoresCache'), source.indexOf('// 2. RENDERIZADO DE TABLA'));
const now = Date.parse('2026-10-06T00:51:00Z');
const row = (id, days, extra = {}) => ({ id, nombre: id, estado: 'pendiente', created_at: new Date(now - days * 86400000).toISOString(), ...extra });

function fixture(rows = [], failAt = -1, withQuestionnaire = false) {
    const elements = new Map(), reads = [], events = {}, actions = [];
    const element = () => ({ children: [], textContent: '', value: '', hidden: false,
        append(...children) { this.children.push(...children); },
        replaceChildren(...children) { this.children = children; this.textContent = ''; },
        setAttribute(name, value) { this[name] = value; }, addEventListener(name, handler) { this[name] = handler; }, focus() {}, scrollIntoView() {} });
    const document = { getElementById(id) { if (!elements.has(id)) elements.set(id, element()); return elements.get(id); }, createElement: element };
    const context = vm.createContext({ Date: class extends Date { static now() { return now; } }, console, Set, document,
        window: { addEventListener(name, handler) { events[name] = handler; } }, PTHAdminData: data,
        supabaseClient: { from(table) {
            let start = 0, end = 499;
            const q = { select() { return q; }, in() { return q; }, order() { return q; }, limit() { return q; },
                range(a, b) { start = a; end = b; return q; },
                then(ok, no) {
                    if (table !== 'gestores') return Promise.resolve({ data: [] }).then(ok, no);
                    reads.push([start, end]);
                    return Promise.resolve(reads.length === failAt ? { data: null, error: {} } : { data: rows.slice(start, end + 1), error: null }).then(ok, no);
                } };
            return q;
        } }, globalAgentsList: [], renderAgentTeamTable() {}, changeAdminTab() {},
        approveGestorOnly(...args) { actions.push(args); }, approveGestor(...args) { actions.push(args); }
    });
    if(withQuestionnaire){context.window.PTHQuestionnaire=context.PTHQuestionnaire={render(_document,answers){const box=element();box.textContent=answers?'Respuestas del cuestionario':'Solicitud anterior al cuestionario';box.open=false;return box;}};}
    vm.runInContext(code, context);
    return { run: s => vm.runInContext(s, context), elements, reads, events, actions,
        visible: () => document.getElementById('list-admin-aprobaciones').children.map(tr => tr.children[0].textContent) };
}

test('all pending requests, including over two months old and uncertain dates, appear with a matching total', async () => {
    const rows = [row('recent', 1), row('old', 70, { telefono: 'demo-phone', email: 'demo@example.test' }),
        row('missing', 1, { created_at: null }), row('future', -1), row('recent', 1),
        row('Carlos demo approved', 80, { estado: 'activo' }), row('rejected', 80, { estado: 'bloqueado' }),
        row('child', 70, { parent_id: 'parent' })];
    const f = fixture(rows);
    await f.run('loadPendingGestores()');
    assert.deepEqual(new Set(f.visible()), new Set(['old', 'recent', 'missing', 'future']));
    assert.equal(f.visible()[0], 'old');
    assert.equal(f.elements.get('admin-pending-count').textContent, '4');
    assert.equal(f.elements.get('admin-pending-review').hidden, false);
    const contact = f.elements.get('list-admin-aprobaciones').children[0].children[1].textContent;
    assert.ok(contact.includes('demo-phone')); assert.ok(contact.includes('demo@example.test'));
    assert.ok(f.elements.get('admin-pending-review-total').textContent.includes('4 solicitudes pendientes'));
    assert.equal(f.actions.length, 0, 'loading never activates, rejects or contacts applicants');
    assert.deepEqual(rows.map(r => r.estado), ['pendiente', 'pendiente', 'pendiente', 'pendiente', 'pendiente', 'activo', 'bloqueado', 'pendiente']);
});

test('ordering and the review entry point keep all pending requests visible', async () => {
    const f = fixture([row('old', 70), row('recent', 1)]);
    await f.run('loadPendingGestores()');
    f.run("setPendingGestorOrder('newest')");
    assert.deepEqual(f.visible(), ['recent', 'old']);
    assert.equal(f.elements.get('admin-pending-count').textContent, '2');
    f.run('openPendingGestorReview()');
    assert.deepEqual(f.visible(), ['old', 'recent']);
    f.events['pth:session-changed']();
    assert.deepEqual(f.visible(), []); assert.equal(f.elements.get('admin-pending-count').hidden, true);
});

test('paged roster loading displays all 1201 pending records beyond the backend default cap', async () => {
    const f = fixture(Array.from({ length: 1201 }, (_, id) => row(`request-${id}`, 70)));
    await f.run('loadPendingGestores()');
    assert.equal(f.visible().length, 1201); assert.equal(f.elements.get('admin-pending-count').textContent, '1201');
    assert.deepEqual(f.reads, [[0, 499], [500, 999], [1000, 1499]]);
});

test('exact page multiples are complete; a later page failure never publishes a partial count', async () => {
    const rows = Array.from({ length: 1000 }, (_, id) => row(`request-${id}`, 70));
    const complete = fixture(rows);
    await complete.run('loadPendingGestores()');
    assert.equal(complete.visible().length, 1000); assert.equal(complete.reads.length, 3);
    const failed = fixture(rows, 2);
    await failed.run('loadPendingGestores()');
    assert.equal(failed.visible().length, 0); assert.equal(failed.elements.get('admin-pending-count').hidden, true);
    assert.equal(failed.elements.get('admin-pending-review').hidden, true);
});


test('each questionnaire has an explicit accessible review button bound to its own request', async () => {
 const f=fixture([row('old',70),row('first',1,{questionnaire:{version:1}}),row('second',0,{questionnaire:{version:1}})],-1,true);
 await f.run('loadPendingGestores()');
 const rows=f.elements.get('list-admin-aprobaciones').children;
 assert.equal(rows.length,6);
 assert.equal(rows[1].children[0].children[0].textContent,'Solicitud anterior al cuestionario');
 const buttons=rows[2].children[3].children;
 const view=buttons.find(b=>b.textContent==='Ver respuestas');
 assert.ok(view,'visible entry per application');assert.equal(view['aria-expanded'],'false');
 assert.equal(view['aria-label'],'Ver respuestas de first');view.click();
 assert.equal(rows[3].children[0].children[0].open,true);
 assert.equal(rows[5].children[0].children[0].open,false,'another request remains closed');
 assert.equal(view['aria-expanded'],'true');view.click();assert.equal(view['aria-expanded'],'false');
 assert.equal(f.actions.length,0,'viewing never activates or rejects');
});
