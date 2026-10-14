const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(new URL('../js/storefront.js', `file://${__filename}`), 'utf8');
function declaration(name) {
  const marker = `${name}(`;
  const start = source.indexOf(marker);
  // Calls precede declarations, so locate the declaration explicitly.
  const asyncStart = source.indexOf(`async function ${marker}`);
  const syncStart = source.indexOf(`function ${marker}`);
  const offset = asyncStart >= 0 ? asyncStart : syncStart;
  assert.ok(start >= 0 && offset >= 0, `Missing ${name}`);
  return source.slice(offset, source.indexOf('\n}', offset) + 2);
}
function setup({ profile = null, search = '', accountPhone = '55842338', lookupError = null } = {}) {
  const opened = [], queries = [], popups = [];
  const order = { id: 'order-1', orden_dia: 'A-320', fecha: '2026-10-07T01:54:49Z', gestor: 'Vendedora', cliente: 'Cliente', telefono: '52515832', direccion: 'Dirección', municipio: 'Zona', producto: '1x Escalera', total: 44, costo_mensajeria: 6, comision_total: 5 };
  const popup = () => { const p = { location: { replace: url => opened.push(url) }, close() { this.closed = true; } }; popups.push(p); return p; };
  const confirmations = [];
  const root = { currentUserData: profile, location: { search }, PTHSecureData: { token: () => 'session-a', accountId: () => 'account-a' }, PTHCheckoutConfirmation: {show:value=>confirmations.push(value)}, open: url => url==='about:blank'?popup():opened.push(url) };
  const context = { window: root, URLSearchParams, console, alert: () => {}, myOrdersData: [order], pedidosRawAdmin: [order], supabaseClient: { from(table) { assert.equal(table, 'gestores'); return { select() { return this; }, eq(column, value) { queries.push([column, value]); return this; }, maybeSingle: async () => ({ data: lookupError ? null : { telefono: accountPhone }, error: lookupError }) }; } } };
  for (const name of ['normalizeCommercialPhone', 'getAgentPhone', 'obtenerTelefonoGestor', 'reenviarPedidoAdmin']) {
    if (source.includes(`function ${name}(`)) vm.runInNewContext(declaration(name), context);
  }
  return { context, root, opened, queries, order, popups, confirmations };
}
// A URL's contact parameter must not silently become the store's phone.
test('commercial link uses contact when no account is logged in', () => {
  const f = setup({ search: '?ref=seller-id&contact=55842338' });
  assert.equal(f.context.getAgentPhone(), '5355842338');
});
test('legacy tel parameter still works', () => {
  assert.equal(setup({ search: '?gestor=Vendedora&tel=55842338' }).context.getAgentPhone(), '5355842338');
});
// This catches borrowing the active administrator's phone for another seller.
test('recovered order uses its seller phone, not the active administrator phone', async () => {
  const f = setup({ profile: { nombre: 'Administradora', telefono: '56071095' } });
  await f.context.reenviarPedidoAdmin('order-1');
  const url = new URL(f.opened[0]);
  assert.equal(url.searchParams.get('phone'), '5356071095', 'routing stays with the store');
  assert.match(url.searchParams.get('text'), /Comercial: Vendedora\n/);
  assert.match(url.searchParams.get('text'), /Tel Comercial: 5355842338\n/);
  assert.doesNotMatch(url.searchParams.get('text'), /Tel Comercial: 5356071095/);
});
test('lookup failure never substitutes the administrator phone on the voucher', async () => {
  const f = setup({ profile: { nombre: 'Administradora', telefono: '56071095' }, lookupError: { message: 'Offline' } });
  await f.context.reenviarPedidoAdmin('order-1');
  const text = new URL(f.opened[0]).searchParams.get('text');
  assert.doesNotMatch(text, /Tel Comercial: 5356071095/);
  assert.match(text, /Tel Comercial: No disponible/);
});
test('subgestor re-send preserves assigned commission and routes to the parent', async () => {
  const f = setup({ profile: { nombre: 'Subgestor', telefono: '55112233', parent_id: 'parent', parent_telefono: '56071095' }, accountPhone: '55112233' });
  f.order.comision_total = 2;
  await f.context.reenviarPedidoAdmin('order-1');
  const url = new URL(f.opened[0]);
  assert.equal(url.searchParams.get('phone'), '5356071095');
  assert.match(url.searchParams.get('text'), /Comercial: Subgestor\nComisión: \$2\nTel Comercial: 5355112233/);
});
test('verified seller lookup normalizes a Cuban phone', async () => {
  const f = setup();
  assert.equal(await f.context.obtenerTelefonoGestor('Vendedora'), '5355842338');
});
test('account change during seller lookup cannot open the old private voucher', async () => {
  const f = setup({ profile: { nombre: 'Administradora', telefono: '56071095' } });
  let finish;
  f.context.supabaseClient.from = () => ({ select() { return this; }, eq() { return this; }, maybeSingle: () => new Promise(resolve => { finish = resolve; }) });
  const resend = f.context.reenviarPedidoAdmin('order-1');
  f.root.PTHSecureData.token = () => 'session-b';
  finish({ data: { telefono: '55842338' }, error: null });
  await assert.rejects(resend, { code: 'SESSION_CHANGED' });
  assert.equal(f.opened.length, 0);
  assert.equal(f.popups[0].closed, true);
});
test('account change still cancels a private re-send when the phone request rejects', async () => {
  const f = setup({ profile: { nombre: 'Administradora', telefono: '56071095' } });
  let reject;
  f.context.supabaseClient.from = () => ({ select() { return this; }, eq() { return this; }, maybeSingle: () => new Promise((_, fail) => { reject = fail; }) });
  const resend = f.context.reenviarPedidoAdmin('order-1');
  f.root.PTHSecureData.token = () => 'session-b';
  reject(Error('Network error'));
  await assert.rejects(resend, { code: 'SESSION_CHANGED' });
  assert.equal(f.opened.length, 0);
  assert.equal(f.popups[0].closed, true);
});
test('slow seller lookup reserves WhatsApp during the direct click before activation expires', async () => {
  const f = setup({ profile: { nombre: 'Administradora', telefono: '56071095' } });
  let finish, activation = true;
  const originalOpen = f.root.open;
  f.root.open = url => activation ? originalOpen(url) : null;
  f.context.supabaseClient.from = () => ({ select() { return this; }, eq() { return this; }, maybeSingle: () => new Promise(resolve => { finish = resolve; }) });
  const resend = f.context.reenviarPedidoAdmin('order-1');
  activation = false;
  finish({ data: { telefono: '55842338' }, error: null });
  await resend;
  assert.equal(f.opened.length, 1);
  assert.match(new URL(f.opened[0]).searchParams.get('text'), /Tel Comercial: 5355842338/);
});
test('blocked popup retains a direct-click confirmation with the correct commercial phone', async () => {
  const f = setup({ profile: { nombre: 'Administradora', telefono: '56071095' } });
  f.root.open = () => null;
  await f.context.reenviarPedidoAdmin('order-1');
  assert.equal(f.confirmations.length, 1);
  assert.equal(f.confirmations[0].phone, '5356071095');
  assert.match(f.confirmations[0].message, /Tel Comercial: 5355842338/);
});
