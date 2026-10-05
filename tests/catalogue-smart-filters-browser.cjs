// Complete storefront, synthetic sessions/products, intercepted traffic only.
const { chromium } = require(process.env.PTH_PLAYWRIGHT_PATH || 'playwright');
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict'), { execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const out = process.env.PTH_FILTER_EVIDENCE || '/tmp/pth-smart-filters';
const baseline = process.env.PTH_FILTER_BASELINE;
const now = Date.parse('2026-10-05T19:00:00Z');
const parent = { id: '11111111-1111-4111-8111-111111111111', nombre: 'Gestor sintético', rol: 'gestor', estado: 'activo', telefono: '5350000000', password: '__session__' };
const child = { ...parent, id: '22222222-2222-4222-8222-222222222222', nombre: 'Subgestor sintético', parent_id: parent.id, parent_nombre: parent.nombre, comision_sub_pct: 99 };
const rows = [
    ['exact', 'Exact10', '10.00', '2026-10-05T19:00:00Z'],
    ['above', 'Above10', '10.01', '2026-10-04T19:00:00Z'],
    ['stale', 'Stale11', '11.00', '2026-09-01T00:00:00Z'],
    ['future', 'Future11', '11.00', '2026-10-06T19:00:00Z'],
    ['invalid', 'Invalid11', '11.00', 'not-a-date'],
    ['missing', 'Missing11', '11.00', null],
    ['low', 'Low9.99', '9.99', '2026-10-04T19:00:00Z'],
    ['infinite', 'Infinite', 'Infinity', '2026-09-01T00:00:00Z']
].map(([id, nombre, comision, created_at]) => ({ id, nombre, comision, created_at, precio: '100.00', precio_flexible: 'NO', categoria: id === 'low' ? 'COCINA' : 'HOGAR', disponible: 'SI', thumbnail: 'synthetic.svg', garantia: 'Dato ficticio', mensajeria: 'Dato ficticio' }));
const assignedValues = { exact: '12.00', above: '5.00', stale: '11.00', future: '11.00', invalid: '10.00', missing: '0.00', low: '20.00', infinite: '0.00' };
const assigned = new Map(rows.map(p => [p.id, { producto_id: p.id, gestor: parent.nombre, nuevo_precio: p.precio, comision_subgestor: assignedValues[p.id], visible_subgestor: true }]));
const sdk = `window.supabase={createClient(){return {from(table){let single=false;const q={then(ok,no){let data=table==='control_sistema'?{valor:'synthetic-v1'}:[];if(single&&Array.isArray(data))data=null;return Promise.resolve({data,error:null,count:0}).then(ok,no)}};for(const name of ['select','eq','neq','gt','gte','lt','lte','order','limit','range','in','is','not','or'])q[name]=()=>q;for(const name of ['single','maybeSingle'])q[name]=()=>{single=true;return q};return q;},rpc(){return Promise.resolve({data:[],error:null})},channel(){const q={on:()=>q,subscribe:()=>q};return q;},removeChannel(){}}}};`;

(async () => {
    fs.mkdirSync(out, { recursive: true });
    const { projectRow } = await import('../supabase/functions/secure-data/policy.mjs');
    const { validateQuery } = await import('../supabase/functions/secure-data/handler.mjs');
    const browser = await chromium.launch({ headless: true, ...(process.env.PTH_CHROMIUM_PATH ? { executablePath: process.env.PTH_CHROMIUM_PATH } : {}) });
    const report = [];
    try {
        for (const role of baseline ? ['gestor'] : ['gestor', 'subgestor', 'admin']) for (const width of baseline ? [390] : [390, 1280]) {
            const profile = role === 'subgestor' ? child : role === 'admin' ? { ...parent, rol: 'admin' } : parent;
            const context = await browser.newContext({ viewport: { width, height: 900 }, serviceWorkers: 'block' });
            const page = await context.newPage(), errors = [], actions = [], dialogs = [];
            page.on('pageerror', error => errors.push(error.message));
            page.on('dialog', async dialog => { dialogs.push(dialog.message()); await dialog.dismiss(); });
            await page.addInitScript(({ profile, now }) => {
                Date.now = () => now;
                sessionStorage.setItem('pth_intro_vista', 'true');
                sessionStorage.setItem('pth_entry_logged', 'true');
                localStorage.setItem('pth_last_seen_level', '0');
                for (const key of ['info_precios_v1', 'sl_tutorial_completed_v1', 'pth_subgestor_onboarding_v1']) localStorage.setItem(key, 'true');
                localStorage.setItem('pth_secure_token', 'a'.repeat(64));
                localStorage.setItem('pth_session', JSON.stringify({ name: profile.nombre, isAdmin: false, data: profile }));
            }, { profile, now });
            await page.route('**/*', async route => {
                const req = route.request(), url = new URL(req.url());
                if (url.pathname === '/functions/v1/secure-data') {
                    const body = req.postDataJSON(); actions.push(body.action);
                    const readOnlyRpc = body.action === 'rpc' && /^(mis_|listar_|resumen_|owner_statistics_|es_admin_boveda$)/.test(body.name);
                    const announcementStatus = body.action === 'announcement' && body.operation === 'status';
                    assert.ok(['session', 'query', 'ranking'].includes(body.action) || readOnlyRpc || announcementStatus, `No real/business mutations permitted: ${body.action} ${body.name || ''}`);
                    let data = [];
                    if (announcementStatus) data = { acknowledged: true };
                    if (body.action === 'session') data = { profile, expiresAt: '2099-01-01T00:00:00Z' };
                    if (body.action === 'ranking') data = (await import('./fixtures/ranking.mjs')).summary(profile.id);
                    if (body.action === 'query') {
                        const actor = req.headers().authorization ? profile : null;
                        validateQuery(body, actor);
                        assert.equal(body.op, 'select', 'Only read-only synthetic queries');
                        if (body.table === 'productos') data = rows.map(p => projectRow('productos', p, actor, assigned));
                        if (body.table === 'gestores') data = [parent, child];
                        if (body.table === 'precios_personalizados') data = role === 'subgestor' ? [...assigned.values()] : [];
                        for (const f of body.filters || []) if (f.method === 'eq') data = data.filter(p => p[f.column] === f.value);
                        if (body.single) data = data[0] || null;
                    }
                    return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ data, error: null, count: 0 }) });
                }
                if (url.hostname === '127.0.0.1') {
                    const rel = url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname.slice(1));
                    const file = path.resolve(root, rel);
                    if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) return route.fulfill({ status: 404, body: '' });
                    const body = rel === 'js/vendor/supabase-2.57.4.js' ? sdk : baseline && rel === 'js/storefront.min.js' ? execFileSync('git', ['show', `${baseline}:${rel}`], { cwd: root }) : fs.readFileSync(file);
                    return route.fulfill({ body, contentType: rel.endsWith('.html') ? 'text/html; charset=utf-8' : /\.(js|mjs)$/.test(rel) ? 'application/javascript' : rel.endsWith('.css') ? 'text/css' : 'application/octet-stream' });
                }
                if (/\.(png|jpe?g|svg|webp)(\?|$)/i.test(url.href)) return route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300"><rect width="300" height="300" fill="#e2e8f0"/><text x="40" y="150" font-size="22">Producto ficticio</text></svg>' });
                return route.fulfill({ contentType: 'application/json', body: '{}' });
            });
            await page.goto('http://127.0.0.1:8137/', { waitUntil: 'domcontentloaded' });
            if (role === 'admin') {
                await page.waitForFunction(() => window.currentUserData?.rol === 'admin');
                await page.evaluate(() => PTHWorkView.switchView('gestor'));
            }
            await page.waitForFunction(() => typeof productosRaw !== 'undefined' && productosRaw.length === 8);
            await page.locator('#btn-logout').waitFor({ state: 'visible' });
            await page.evaluate(() => { showSection('catalogo'); const label = document.createElement('p'); label.textContent = 'DEMOSTRACIÓN LOCAL · DATOS FICTICIOS · SIN ENVÍOS'; label.style = 'padding:12px;background:#0b2550;color:white;text-align:center;font-weight:bold'; document.getElementById('gestor-command-center').prepend(label); });
            const names = async () => (await page.locator('#productos-container article h3').allTextContents()).sort();
            await page.locator('[data-gestor-catalog-filter="nuevos"]').first().click();
            assert.deepEqual(await names(), baseline ? ['Above10', 'Exact10', 'Future11', 'Low9.99'] : ['Above10', 'Exact10', 'Low9.99']);
            assert.equal(await page.locator('#gestor-catalog-new').innerText(), baseline ? '4' : '3');
            await page.locator('#gestor-command-center').scrollIntoViewIfNeeded();
            await page.screenshot({ path: path.join(out, `${baseline ? 'before' : 'after'}-${role}-${width}-new.png`), fullPage: true });
            await page.locator('[data-gestor-catalog-filter="comision"]').first().click();
            assert.deepEqual(await names(), role === 'subgestor' ? ['Exact10', 'Future11', 'Low9.99', 'Stale11'] : baseline ? ['Above10', 'Future11', 'Infinite', 'Invalid11', 'Missing11', 'Stale11'] : ['Above10', 'Future11', 'Invalid11', 'Missing11', 'Stale11']);
            // Empty high-commission result, with the independent switch off.
            await page.locator('#search-bar').fill(role === 'subgestor' ? 'Above10' : 'Low9.99');
            assert.deepEqual(await names(), []);
            const fallback = await page.evaluate(() => getProductsVisibleOnScreen().map(p => p.nombre));
            assert.deepEqual(fallback, baseline ? ['Low9.99'] : []);
            if (!baseline) {
                await page.locator('#btn-copy-bulk').click();
                await page.waitForFunction(() => window.PTHSalesTools);
                assert.match(dialogs.at(-1), /No hay productos visibles/);
                assert.equal(await page.locator('#sales-composer-modal').count(), 0);
            }
            await page.locator('#search-bar').fill('Stale11');
            await page.locator('[data-gestor-catalog-filter="nuevos"]').first().click();
            assert.deepEqual(await names(), []);
            assert.deepEqual(await page.evaluate(() => getProductsVisibleOnScreen().map(p => p.nombre)), baseline ? ['Stale11'] : []);
            await page.locator('#gestor-command-center').scrollIntoViewIfNeeded();
            await page.screenshot({ path: path.join(out, `${baseline ? 'before' : 'after'}-${role}-${width}-empty.png`), fullPage: true });
            // Category + query + switch retain an empty result; switching to a qualifying category restores only matches.
            await page.evaluate(() => { document.getElementById('search-bar').value = 'Low9.99'; document.getElementById('filter-high-comm').checked = true; filterByCategory('COCINA'); });
            assert.deepEqual(await names(), role === 'subgestor' ? ['Low9.99'] : []);
            assert.deepEqual(errors, []);
            report.push({ role, width, baseline: baseline || null, newCount: baseline ? 4 : 3, fallbackEmpty: !baseline, mutations: 0, pageErrors: errors.length, actions: [...new Set(actions)] });
            await context.close();
        }
        fs.writeFileSync(path.join(out, baseline ? 'browser-before.json' : 'browser-after.json'), JSON.stringify(report, null, 2) + '\n');
        console.log(JSON.stringify(report, null, 2));
    } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
