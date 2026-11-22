const { before, after, test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { startPointsPostgres } = require('./helpers/points-postgres.cjs');

let db;
before(async () => { db = await startPointsPostgres(); });
after(async () => { if (db) await db.stop(); });

async function rpc(actor, operation, body = {}) {
  const result = await db.service('select public.pth_points_wallet($1,$2,$3) result', [actor, operation, body]);
  return result.rows[0].result;
}
async function world({ enabled = true } = {}) {
  const ids = { admin: randomUUID(), parent: randomUUID(), child: randomUUID(), other: randomUUID(), logistics: randomUUID() };
  for (const [name, id] of Object.entries(ids)) {
    await db.query('insert into gestores(id,nombre,rol,parent_id) values($1,$2,$3,$4)',
      [id, name + '-' + id, name === 'admin' ? 'admin' : name === 'logistics' ? 'logistica' : 'gestor', name === 'child' ? ids.parent : null]);
  }
  ids.products = [];
  for (const size of ['Pequeño', 'Mediano', 'Grande', null]) {
    const id = randomUUID(); ids.products.push(id);
    await db.query('insert into productos(id,nombre,"tamaño_envio") values($1,$2,$3)', [id, 'Producto ' + (size || 'sin tamaño'), size]);
  }
  await db.query('update pth_points.config set enabled=$1,started_at=clock_timestamp()-interval \'1 second\'', [enabled]);
  return ids;
}
function sale(w, { child = false, lines, beneficiary, id = randomUUID(), token = 'pthn2.1795348800000.p.1.' + randomUUID() + '.actor.payload.providers.signature' } = {}) {
  const row = { id, submission_token: token, proveedor: 'TEST', cliente: 'Cliente sintético', telefono: '55555555',
    ci: '11111111111', direccion: 'Dirección', municipio: 'Municipio', producto: 'No interpretar este texto',
    total: 123, costo_mensajeria: 5, comision_total: 12, comision_subgestor: 4,
    estado: child ? 'Pendiente Aprobacion' : 'Pendiente', garantia_venta: 'Garantía', garantia_dias: 30,
    ...(child ? { subgestor_id: w.child, subgestor_nombre: 'child-' + w.child,
      parent_gestor_id: w.parent, parent_gestor_nombre: 'parent-' + w.parent }
      : { gestor: 'parent-' + w.parent, origen: 'Gestor', pago_gestor: 'Pendiente' }) };
  if (!child) delete row.comision_subgestor;
  return { table: child ? 'pedidos_subgestores' : 'pedidos', rows: [row], captures: [{ pedido_id: id,
    beneficiary_id: beneficiary === undefined ? (child ? w.child : w.parent) : beneficiary,
    sales_channel: 'referral_link',
    lines: lines === undefined ? [{ producto_id: w.products[0], cantidad: 1 }, { producto_id: w.products[1], cantidad: 2 }, { producto_id: w.products[2], cantidad: 1 }] : lines }] };
}
async function insert(s, tariff = null) {
  const result = await db.service('select public.pth_insert_checkout_points($1,$2,$3,$4) result', [s.table, JSON.stringify(s.rows), JSON.stringify(s.captures), tariff]);
  return result.rows[0].result;
}
async function eligible(s, state = 'Conciliado_Prov') {
  await db.service(`update ${s.table} set estado='Entregado',estado_financiero=$2 where id=$1`, [s.rows[0].id, state]);
}
const summary = (id, body) => rpc(id, 'summary', body);
const grant = (w, body) => rpc(w.admin, 'grant', { beneficiaryId: w.parent, points: 7, reason: 'Reto completado', idempotencyKey: randomUUID(), ...body });
const outcome = promise => promise.then(value => ({ ok: true, value }), error => ({ ok: false, error }));
async function waitForBlocking(waiterPid, holderPid, finished = () => false) {
  const deadline = Date.now() + 2000;
  while (Date.now() < deadline) {
    if (finished()) return false;
    const result = await db.query('select $2::integer=any(pg_blocking_pids($1::integer)) blocked', [waiterPid, holderPid]);
    if (result.rows[0].blocked) return true;
    await new Promise(resolve => setTimeout(resolve, 5));
  }
  assert.fail('Expected database concurrency barrier was not reached');
}

test('program begins disabled and settings cannot activate it', async () => {
  const exists = await db.query("select to_regprocedure('public.pth_points_wallet(uuid,text,jsonb)') is not null available");
  assert.equal(exists.rows[0].available, true, 'service-only wallet RPC must exist');
  const w = await world({ enabled: false });
  const settings = await rpc(w.admin, 'settings');
  assert.equal(settings.enabled, false);
  await assert.rejects(rpc(w.admin, 'settings', { enabled: true }), /invalid|válid|solo|read|lectura/i);
  const s = sale(w); await insert(s); await eligible(s);
  assert.equal((await summary(w.parent)).balance, 0);
  await assert.rejects(grant(w), /desactiv|disabled|habilit/i);
});

test('child earns frozen 1+2+2+3 only after delivery AND collection, including approval transfer', async () => {
  const w = await world(); const s = sale(w, { child: true }); const receipt = await insert(s);
  assert.match(receipt[0].orden_dia, /^TEST-\d+$/);
  assert.equal((await summary(w.child)).pending, 8);
  const version = (await db.query('select md5(to_jsonb(s)::text) version from pedidos_subgestores s where id=$1', [s.rows[0].id])).rows[0].version;
  await db.service("select public.pth_review_subgestor($1,'approve',$2,$3)", [w.admin, s.rows[0].id, version]);
  s.table = 'pedidos';
  await db.service("update pedidos set estado='Entregado',pago_gestor='Pagado' where id=$1", [s.rows[0].id]);
  assert.equal((await summary(w.child)).balance, 0);
  await db.service("update pedidos set estado_financiero='Conciliado_Prov' where id=$1", [s.rows[0].id]);
  assert.equal((await summary(w.child)).balance, 8);
  assert.equal((await summary(w.parent)).balance, 0);
  await eligible(s, 'Liquidado_Gestor');
  assert.equal((await summary(w.child)).movements.length, 1);
});

test('collection alone is pending and repeated valid states cannot mint credits', async () => {
  const w = await world(); const s = sale(w); await insert(s);
  await db.service("update pedidos set estado_financiero='Conciliado_Prov' where id=$1", [s.rows[0].id]);
  assert.equal((await summary(w.parent)).balance, 0);
  await eligible(s); await eligible(s);
  assert.equal((await summary(w.parent)).balance, 8);
  assert.equal((await summary(w.parent)).pending, 0);
});

test('cancellation and deconciliation reverse exact net and restoration is linked and bounded', async () => {
  const w = await world(); const s = sale(w); await insert(s); await eligible(s);
  await db.service("update pedidos set estado='Cancelado' where id=$1", [s.rows[0].id]);
  let wallet = await summary(w.parent); assert.equal(wallet.balance, 0); assert.equal(wallet.reversed, 8);
  assert.equal(wallet.pending, 0, 'cancelled orders are not pending rewards');
  assert.ok(wallet.movements.find(m => m.points === -8).reversalOf);
  await eligible(s); await eligible(s);
  assert.equal((await summary(w.parent)).balance, 8);
  await db.service("update pedidos set estado_financiero='Pendiente' where id=$1", [s.rows[0].id]);
  await db.service("update pedidos set estado_financiero='Pendiente' where id=$1", [s.rows[0].id]);
  wallet = await summary(w.parent); assert.equal(wallet.balance, 0); assert.equal(wallet.movements.length, 4);
  assert.equal(wallet.movements.reduce((n, m) => n + m.points, 0), wallet.balance);
});

test('snapshot quantities, product names, beneficiary and rule values survive later edits', async () => {
  const w = await world(); const s = sale(w); await insert(s);
  await rpc(w.admin, 'save_rule', { productId: w.products[1], pointsPerUnit: 99, reason: 'Regla nueva', idempotencyKey: randomUUID() });
  await db.query('update productos set nombre=\'Cambiado\',"tamaño_envio"=\'Grande\' where id=any($1)', [w.products]);
  await db.query('update gestores set nombre=\'Otra identidad visible\' where id=$1', [w.parent]);
  await eligible(s);
  assert.equal((await summary(w.parent)).balance, 8);
  const lines = (await db.query('select quantity,points_per_unit,product_name from pth_points.lines l join pth_points.captures c on c.id=l.capture_id where c.order_id=$1 order by quantity desc', [s.rows[0].id])).rows;
  assert.equal(lines[0].quantity, 2); assert.equal(lines[0].points_per_unit, 2);
  assert.equal(lines[0].product_name, 'Producto Mediano');
});

test('zero override replaces base and null restores defaults for future orders only', async () => {
  const w = await world();
  await rpc(w.admin, 'save_rule', { productId: w.products[2], pointsPerUnit: 0, reason: 'Exclusión', idempotencyKey: randomUUID() });
  const first = sale(w, { lines: [{ producto_id: w.products[2], cantidad: 3 }] }); await insert(first); await eligible(first);
  assert.equal((await summary(w.parent)).balance, 0);
  let rules = await rpc(w.admin, 'rules', { search: 'Grande' });
  assert.equal(rules.rows.find(r => r.productId === w.products[2]).pointsPerUnit, 0);
  assert.equal(rules.rows.find(r => r.productId === w.products[2]).customPoints, 0);
  await rpc(w.admin, 'save_rule', { productId: w.products[2], pointsPerUnit: null, reason: 'Por tamaño', idempotencyKey: randomUUID() });
  const second = sale(w, { lines: [{ producto_id: w.products[2], cantidad: 3 }] }); await insert(second); await eligible(second);
  assert.equal((await summary(w.parent)).balance, 9);
});

test('unknown referral classification preserves an unresolved sale but unverified legacy inserts earn no points', async () => {
  const w = await world(); const s = sale(w, { lines: [{ producto_id: w.products[3], cantidad: 2 }] });
  await insert(s); await eligible(s);
  const legacy = sale(w, { child: true });
  await db.service('select public.pth_insert_checkout($1,$2)', [legacy.table, JSON.stringify(legacy.rows)]);
  assert.equal((await summary(w.parent)).balance, 0);
  const issues = await rpc(w.admin, 'issues');
  const captures = (await db.query('select id from pth_points.captures where order_id=any($1)', [[s.rows[0].id, legacy.rows[0].id]])).rows;
  assert.equal(captures.length, 1);
  assert.ok(captures.every(c => issues.rows.some(i => i.id === c.id)));
  assert.equal((await db.query('select count(*) n from pedidos where id=$1', [s.rows[0].id])).rows[0].n, '1');
});

test('historical receipt retries, delayed activation and organic direct sales never backfill', async () => {
  const w = await world({ enabled: false }); const old = sale(w); await insert(old);
  await db.query('update pth_points.config set enabled=true,started_at=clock_timestamp()');
  await insert(old); await eligible(old);
  assert.equal((await summary(w.parent)).balance, 0);
  const organic = sale(w, { beneficiary: null }); organic.rows[0].gestor = 'Venta Directa';
  await insert(organic); await eligible(organic);
  assert.equal((await db.query('select count(*) n from pth_points.captures where order_id=any($1)', [[old.rows[0].id, organic.rows[0].id]])).rows[0].n, '0');
});

test('approval after activation never backfills uncaptured child orders created before launch or while paused', async () => {
  for (const beforeLaunch of [true, false]) {
    const w = await world();
    await db.query('update pth_points.config set enabled=false,started_at=case when $1 then null else started_at end', [beforeLaunch]);
    const s = sale(w, { child: true }); await insert(s);
    assert.equal((await db.query('select count(*) n from pth_points.captures where order_id=$1', [s.rows[0].id])).rows[0].n, '0');
    await db.query('update pth_points.config set enabled=true,started_at=coalesce(started_at,clock_timestamp())');
    const version = (await db.query('select md5(to_jsonb(s)::text) version from pedidos_subgestores s where id=$1', [s.rows[0].id])).rows[0].version;
    await db.service("select public.pth_review_subgestor($1,'approve',$2,$3)", [w.admin, s.rows[0].id, version]);
    s.table = 'pedidos'; await eligible(s);
    assert.equal((await db.query('select count(*) n from pth_points.captures where order_id=$1', [s.rows[0].id])).rows[0].n, '0',
      beforeLaunch ? 'prelaunch approval must not generate a capture or issue' : 'paused approval must not generate a capture or issue');
    assert.equal((await summary(w.child)).balance, 0);
    assert.equal((await summary(w.parent)).balance, 0);
  }
});

test('disabling new rewards does not freeze reversals or existing eligible obligations', async () => {
  const w = await world(); const s = sale(w); await insert(s);
  await db.query('update pth_points.config set enabled=false'); await eligible(s);
  assert.equal((await summary(w.parent)).balance, 8);
  const next = sale(w); await insert(next); await eligible(next);
  assert.equal((await summary(w.parent)).balance, 8);
  await db.service("update pedidos set estado='Devuelto' where id=$1", [s.rows[0].id]);
  assert.equal((await summary(w.parent)).balance, 0);
});

test('manual recognition retries are exactly once and payload key reuse is rejected', async () => {
  const w = await world(); const key = randomUUID();
  const first = await grant(w, { idempotencyKey: key }); const second = await grant(w, { idempotencyKey: key });
  assert.deepEqual(second, first); assert.ok(first.movement.id);
  assert.equal((await summary(w.parent)).balance, 7);
  await assert.rejects(grant(w, { idempotencyKey: key, points: 9 }), /clave|payload|idempot|solicitud/i);
  await assert.rejects(grant(w, { points: 0 }), /puntos|positive|válid/i);
  await assert.rejects(grant(w, { reason: ' ' }), /motivo|reason|válid/i);
});

test('manual reversal is linked, double-safe, cannot debit arbitrary amounts or reverse reversals', async () => {
  const w = await world(); const movement = await grant(w);
  const body = { movementId: movement.movement.id, reason: 'Error verificado', idempotencyKey: randomUUID() };
  const reversed = await rpc(w.admin, 'reverse', body);
  assert.deepEqual(await rpc(w.admin, 'reverse', body), reversed);
  await rpc(w.admin, 'reverse', { ...body, idempotencyKey: randomUUID() });
  assert.equal((await summary(w.parent)).balance, 0);
  assert.equal((await summary(w.parent)).movements.length, 2);
  await assert.rejects(rpc(w.admin, 'reverse', { movementId: reversed.movement.id, reason: 'No', idempotencyKey: randomUUID() }), /rever|válid/i);
});

test('linked issue resolution requires eligible unresolved ownership and cannot double-credit later', async () => {
  const w = await world(); const s = sale(w, { lines: [] }); await insert(s);
  const capture = (await db.query('select id from pth_points.captures where order_id=$1', [s.rows[0].id])).rows[0].id;
  await assert.rejects(grant(w, { captureId: capture }), /elegib|entreg|concili/i);
  await eligible(s);
  await assert.rejects(grant(w, { captureId: capture, beneficiaryId: w.other }), /benefic|cuenta|destinat/i);
  const award = await grant(w, { captureId: capture });
  await eligible(s); assert.equal((await summary(w.parent)).balance, 7);
  assert.ok(!(await rpc(w.admin, 'issues')).rows.some(i => i.id === capture));
  await db.service("update pedidos set estado='Cancelado' where id=$1", [s.rows[0].id]);
  assert.equal((await summary(w.parent)).balance, 0);
  await eligible(s); assert.equal((await summary(w.parent)).balance, 7);
  await rpc(w.admin, 'reverse', { movementId: award.movement.id, reason: 'Reconocimiento incorrecto', idempotencyKey: randomUUID() });
  await eligible(s); assert.equal((await summary(w.parent)).balance, 0);
  await assert.rejects(grant(w, { captureId: capture }), /resuelt|manual|reconoc|incidencia/i);
});

test('own-account scope rejects parent access to child, logistics and inactive or fake admin actors', async () => {
  const w = await world();
  await assert.rejects(summary(w.parent, { beneficiaryId: w.child }), /autoriz|permiso|propia/i);
  await assert.rejects(rpc(w.logistics, 'accounts'), /autoriz|permiso|admin/i);
  await db.query("update gestores set rol='admin' where id=$1", [w.child]);
  await assert.rejects(rpc(w.child, 'accounts'), /autoriz|permiso|admin/i);
  await assert.rejects(summary(randomUUID()), /autoriz|cuenta/i);
  await db.query('update gestores set activo=false where id=$1', [w.other]);
  await assert.rejects(summary(w.other), /autoriz|activ/i);
  assert.equal((await summary(w.admin, { beneficiaryId: w.parent })).beneficiary.id, w.parent);
});

test('administrators can find inactive accounts and retained histories but cannot grant them new points', async () => {
  const w = await world(); await grant(w);
  const active = await rpc(w.admin, 'accounts', { search: 'parent-' + w.parent });
  await db.query("update gestores set activo=false,estado='inactivo' where id=$1", [w.parent]);
  const accounts = await rpc(w.admin, 'accounts', { search: 'parent-' + w.parent });
  assert.deepEqual(accounts.rows, [{ id: w.parent, name: 'parent-' + w.parent, active: false }]);
  assert.deepEqual(active.rows, [{ id: w.parent, name: 'parent-' + w.parent, active: true }]);
  const wallet = await summary(w.admin, { beneficiaryId: w.parent });
  assert.equal(wallet.balance, 7); assert.equal(wallet.movements.length, 1);
  await assert.rejects(grant(w), /destinataria|válid|activ/i);
  assert.equal((await summary(w.admin, { beneficiaryId: w.parent })).balance, 7);
});

test('native multi-connection inserts and grants are serialized, retries preserve original snapshot', async () => {
  const w = await world(); const s = sale(w);
  const receipts = await Promise.all(Array.from({ length: 8 }, () => insert(s)));
  assert.ok(receipts.every(r => r[0].orden_dia === receipts[0][0].orden_dia));
  await Promise.all(Array.from({ length: 8 }, () => eligible(s)));
  const key = randomUUID(); await Promise.all(Array.from({ length: 8 }, () => grant(w, { idempotencyKey: key })));
  assert.equal((await summary(w.parent)).balance, 15);
  assert.equal((await summary(w.parent)).movements.length, 2);
  const altered = structuredClone(s); altered.captures[0].lines[0].cantidad = 100;
  await assert.rejects(insert(altered), /captur|coincid|payload|solicitud/i);
  assert.equal((await summary(w.parent)).balance, 15);
});

test('concurrent independent delivery and financial updates converge to one credit and one reversal', async () => {
  const w = await world(); const s = sale(w); await insert(s);
  await Promise.all([
    db.service("update pedidos set estado='Entregado' where id=$1", [s.rows[0].id]),
    db.service("update pedidos set estado_financiero='Conciliado_Prov' where id=$1", [s.rows[0].id]),
  ]);
  assert.equal((await summary(w.parent)).balance, 8);
  await Promise.all(Array.from({ length: 6 }, () => db.service("update pedidos set estado='Cancelado' where id=$1", [s.rows[0].id])));
  const wallet = await summary(w.parent); assert.equal(wallet.balance, 0); assert.equal(wallet.movements.length, 2);
});

test('invalid capture batch rolls back order and consecutive while immutable history survives deletion', async () => {
  const w = await world(); const invalid = sale(w); invalid.captures[0].pedido_id = randomUUID();
  const before = (await db.query("select ultimo_numero from pth_private.pedido_consecutivos where proveedor='TEST'")).rows[0]?.ultimo_numero;
  await assert.rejects(insert(invalid), /captur|pedido|lote/i);
  assert.equal((await db.query('select count(*) n from pedidos where id=$1', [invalid.rows[0].id])).rows[0].n, '0');
  assert.equal((await db.query("select ultimo_numero from pth_private.pedido_consecutivos where proveedor='TEST'")).rows[0]?.ultimo_numero, before);
  const s = sale(w); await insert(s); await eligible(s);
  await db.service('delete from pedidos where id=$1', [s.rows[0].id]);
  await db.query('delete from productos where id=any($1)', [w.products]);
  await db.query('delete from gestores where id=$1', [w.parent]);
  assert.equal((await db.query('select sum(points)::integer balance,count(*)::integer n from pth_points.movements where beneficiary_id=$1', [w.parent])).rows[0].balance, 0);
  assert.equal((await db.query('select count(*) n from pth_points.captures where order_id=$1', [s.rows[0].id])).rows[0].n, '1');
});

test('database ACL and RLS deny browser roles and immutable ledger rejects privileged edits', async () => {
  const w = await world(); const m = await grant(w);
  for (const role of ['anon', 'authenticated']) {
    await assert.rejects(db.query(`set role ${role};select public.pth_points_wallet('${w.parent}','summary','{}')`), /permission denied/i);
    await db.query('reset role');
    await assert.rejects(db.query(`set role ${role};select * from pth_points.movements`), /permission denied/i);
    await db.query('reset role');
  }
  await assert.rejects(db.service('update pth_points.movements set points=999 where id=$1', [m.movement.id]), /permission|inmut|immutable/i);
  await assert.rejects(db.query('delete from pth_points.movements where id=$1', [m.movement.id]), /inmut|immutable/i);
  const security = await db.query("select c.relname,c.relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='pth_points' and c.relkind='r'");
  assert.ok(security.rows.length >= 6); assert.ok(security.rows.every(r => r.relrowsecurity));
  const functions = await db.query("select p.prosecdef,has_function_privilege('anon',p.oid,'EXECUTE') as anon,has_function_privilege('authenticated',p.oid,'EXECUTE') as authenticated from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='pth_points' or p.proname in ('pth_points_wallet','pth_insert_checkout_points')");
  assert.ok(functions.rows.every(f => !f.prosecdef && !f.anon && !f.authenticated));
});

test('new legacy writes without a verified referral channel do not create rewards or unresolved issues', async () => {
  const w = await world();
  for (const child of [false, true]) {
    const s = sale(w, { child });
    await db.service('select public.pth_insert_checkout($1,$2)', [s.table, JSON.stringify(s.rows)]);
    await eligible(s);
    assert.equal((await db.query('select count(*) n from pth_points.captures where order_id=$1', [s.rows[0].id])).rows[0].n, '0');
  }
  assert.equal((await summary(w.parent)).balance, 0);
  assert.equal((await summary(w.child)).balance, 0);
});

test('overlapping product rule periods are rejected by database even for service role', async () => {
  const w = await world();
  await rpc(w.admin, 'save_rule', { productId: w.products[0], pointsPerUnit: 10, reason: 'Primera', idempotencyKey: randomUUID() });
  await assert.rejects(db.service("insert into pth_points.rules(product_id,points_per_unit,valid_from,valid_until,actor_id,reason) values($1,100,clock_timestamp()-interval '1 second',clock_timestamp()+interval '1 second',$2,'Solapada')", [w.products[0], w.admin]), /solap|overlap/i);
});

test('linked manual grant racing cancellation cannot escape its capture or deadlock', async () => {
  const w = await world(); const s = sale(w, { lines: [] }); await insert(s); await eligible(s);
  const capture = (await db.query('select id from pth_points.captures where order_id=$1', [s.rows[0].id])).rows[0].id;
  const results = await Promise.allSettled([
    grant(w, { captureId: capture }),
    db.service("update pedidos set estado='Cancelado' where id=$1", [s.rows[0].id]),
  ]);
  assert.equal(results[1].status, 'fulfilled');
  if (results[0].status === 'rejected') assert.match(results[0].reason.message, /elegib|entreg|concili/i);
  assert.equal((await summary(w.parent)).balance, 0);
});

test('receipt and capture insertion roll back together when capture validation fails after numbering', async () => {
  const w = await world(); const s = sale(w, { beneficiary: randomUUID() });
  const previous = (await db.query("select ultimo_numero from pth_private.pedido_consecutivos where proveedor='TEST'")).rows[0]?.ultimo_numero;
  await assert.rejects(insert(s), /benefic/i);
  assert.equal((await db.query('select count(*) n from pedidos where id=$1', [s.rows[0].id])).rows[0].n, '0');
  assert.equal((await db.query("select ultimo_numero from pth_private.pedido_consecutivos where proveedor='TEST'")).rows[0]?.ultimo_numero, previous);
});

test('rule update racing checkout captures the committed override, never an accidental default', async () => {
  const w = await world();
  await rpc(w.admin, 'save_rule', { productId: w.products[0], pointsPerUnit: 10, reason: 'Anterior', idempotencyKey: randomUUID() });
  const writer = await db.connect(); let pending;
  try {
    await writer.query('begin'); await writer.query('set local role service_role');
    await writer.query("select public.pth_points_wallet($1,'save_rule',$2)", [w.admin,
      { productId: w.products[0], pointsPerUnit: 20, reason: 'Nueva', idempotencyKey: randomUUID() }]);
    const s = sale(w, { lines: [{ producto_id: w.products[0], cantidad: 1 }] });
    pending = insert(s);
    const deadline = Date.now() + 2000; let locked = false;
    while (Date.now() < deadline) {
      locked = (await db.query("select exists(select 1 from pg_stat_activity where query like 'select public.pth_insert_checkout_points(%' and wait_event_type='Lock') locked")).rows[0].locked;
      if (locked) break;
      await new Promise(resolve => setTimeout(resolve, 5));
    }
    assert.equal(locked, true, 'checkout must wait for the rule transaction');
    await writer.query('commit'); await pending; pending = null;
    await eligible(s); assert.equal((await summary(w.parent)).balance, 20);
  } finally {
    await writer.query('rollback'); writer.release();
    if (pending) await pending.catch(() => {});
  }
});

test('explicit custom points do not guess an unknown product classification', async () => {
  const w = await world();
  await rpc(w.admin, 'save_rule', { productId: w.products[3], pointsPerUnit: 12, reason: 'Puntos sin clasificar', idempotencyKey: randomUUID() });
  const s = sale(w, { lines: [{ producto_id: w.products[3], cantidad: 1 }] }); await insert(s); await eligible(s);
  assert.equal((await summary(w.parent)).balance, 0);
  const capture = (await db.query('select id from pth_points.captures where order_id=$1', [s.rows[0].id])).rows[0].id;
  assert.ok((await rpc(w.admin, 'issues')).rows.some(i => i.id === capture));
});

test('express wrapper preserves tariff fencing and rolls back rejected receipts and captures', async () => {
  const w = await world(); const municipio = randomUUID();
  const tariff = (await db.query("insert into tarifas_mensajeria(municipio,localidad,precio_pequeno,precio_mediano,precio_grande) values($1,'Prueba',1,2,3) returning to_jsonb(tarifas_mensajeria) tariff", [municipio])).rows[0].tariff;
  const s = sale(w); await insert(s, tariff); await eligible(s);
  assert.equal((await summary(w.parent)).balance, 8);
  const rejected = sale(w);
  await assert.rejects(insert(rejected, { ...tariff, precio_pequeno: 999 }), error => error.code === 'PT409');
  assert.equal((await db.query('select count(*) n from pedidos where id=$1', [rejected.rows[0].id])).rows[0].n, '0');
  assert.equal((await db.query('select count(*) n from pth_points.captures where order_id=$1', [rejected.rows[0].id])).rows[0].n, '0');
});

test('ledger constraints reject a partial or foreign-account reversal even with service privileges', async () => {
  const w = await world(); const original = (await grant(w)).movement;
  const sql = "insert into pth_points.movements(beneficiary_id,points,kind,reason,request_key,reversal_of) values($1,$2,'reversal','Débito inválido',$3,$4)";
  await assert.rejects(db.service(sql, [w.parent, -1, randomUUID(), original.id]), /revers|válid/i);
  await assert.rejects(db.service(sql, [w.other, -7, randomUUID(), original.id]), /revers|válid/i);
  assert.equal((await summary(w.parent)).balance, 7);
});

test('bulk status update racing a linked grant cannot deadlock across captures of one account', async () => {
  const w = await world(); const first = sale(w); const second = sale(w, { lines: [] });
  await insert(first); await insert(second); await eligible(second);
  const capture = (await db.query('select id from pth_points.captures where order_id=$1', [second.rows[0].id])).rows[0].id;
  const manual = await db.connect(); const bulk = await db.connect(); let bulkPending;
  try {
    for (const client of [manual, bulk]) {
      await client.query("begin;set local deadlock_timeout='100ms';set local statement_timeout='5s';set local role service_role");
    }
    await manual.query('select capture_id from pth_points.earning_state where capture_id=$1 for update', [capture]);
    const manualPid = (await manual.query('select pg_backend_pid() pid')).rows[0].pid;
    const bulkPid = (await bulk.query('select pg_backend_pid() pid')).rows[0].pid;
    // Heap order deterministically evaluates the first inserted capture first.
    await bulk.query('set local enable_indexscan=off;set local enable_bitmapscan=off');
    bulkPending = outcome(bulk.query("update pedidos set estado='Entregado',estado_financiero='Conciliado_Prov' where id=any($1::uuid[])", [[first.rows[0].id, second.rows[0].id]]));
    assert.equal(await waitForBlocking(bulkPid, manualPid), true);
    const manualResult = await outcome(manual.query("select public.pth_points_wallet($1,'grant',$2)", [w.admin,
      { beneficiaryId: w.parent, captureId: capture, points: 7, reason: 'Incidencia verificada', idempotencyKey: randomUUID() }]));
    await manual.query(manualResult.ok ? 'commit' : 'rollback');
    const bulkResult = await bulkPending; bulkPending = null;
    await bulk.query(bulkResult.ok ? 'commit' : 'rollback');
    assert.equal(manualResult.ok, true, manualResult.error?.code + ': ' + manualResult.error?.message);
    assert.equal(bulkResult.ok, true, bulkResult.error?.code + ': ' + bulkResult.error?.message);
    const wallet = await summary(w.parent); assert.equal(wallet.balance, 15); assert.equal(wallet.movements.length, 2);
  } finally {
    await manual.query('rollback'); manual.release();
    if (bulkPending) await bulkPending;
    await bulk.query('rollback'); bulk.release();
  }
});

test('bulk financial update and overlapping single delivery update converge without retry or duplicate points', async () => {
  const w = await world(); const first = sale(w); const second = sale(w);
  await insert(first); await insert(second);
  await db.service("update pedidos set estado='Entregado' where id=$1", [first.rows[0].id]);
  await Promise.all([
    db.service("update pedidos set estado_financiero='Conciliado_Prov' where id=any($1::uuid[])", [[first.rows[0].id, second.rows[0].id]]),
    db.service("update pedidos set estado='Entregado' where id=$1", [second.rows[0].id]),
  ]);
  const wallet = await summary(w.parent); assert.equal(wallet.balance, 16); assert.equal(wallet.movements.length, 2);
});

test('simultaneous standalone reversals with different request keys return one exact reversal', async () => {
  const w = await world(); const movement = (await grant(w)).movement;
  const reversals = await Promise.all(Array.from({ length: 8 }, () => rpc(w.admin, 'reverse',
    { movementId: movement.id, reason: 'Corrección verificada', idempotencyKey: randomUUID() })));
  assert.ok(reversals.every(result => result.movement.id === reversals[0].movement.id));
  const wallet = await summary(w.parent); assert.equal(wallet.balance, 0); assert.equal(wallet.movements.length, 2);
});

test('catalog bulk edit cannot deadlock checkout whose captured lines use the reverse product order', async () => {
  const w = await world(); const s = sale(w, { lines: [{ producto_id: w.products[1], cantidad: 1 }, { producto_id: w.products[0], cantidad: 1 }] });
  const editor = await db.connect(); const checkout = await db.connect(); let pending;
  try {
    for (const client of [editor, checkout]) {
      await client.query("begin;set local deadlock_timeout='100ms';set local statement_timeout='5s';set local role service_role");
    }
    await editor.query("update productos set nombre='Editado A' where id=$1", [w.products[0]]);
    const editorPid = (await editor.query('select pg_backend_pid() pid')).rows[0].pid;
    const checkoutPid = (await checkout.query('select pg_backend_pid() pid')).rows[0].pid;
    let checkoutFinished = false;
    pending = outcome(checkout.query('select public.pth_insert_checkout_points($1,$2,$3)', [s.table, JSON.stringify(s.rows), JSON.stringify(s.captures)]))
      .then(result => { checkoutFinished = true; return result; });
    // Before the fix checkout blocks on A after retaining B's FOR SHARE lock.
    // A lock-free snapshot may simply finish, which is equally observable.
    await waitForBlocking(checkoutPid, editorPid, () => checkoutFinished);
    const editorResult = await outcome(editor.query("update productos set nombre='Editado B' where id=$1", [w.products[1]]));
    await editor.query(editorResult.ok ? 'commit' : 'rollback');
    const checkoutResult = await pending; pending = null;
    await checkout.query(checkoutResult.ok ? 'commit' : 'rollback');
    assert.equal(editorResult.ok, true, editorResult.error?.code + ': ' + editorResult.error?.message);
    assert.equal(checkoutResult.ok, true, checkoutResult.error?.code + ': ' + checkoutResult.error?.message);
    await eligible(s); assert.equal((await summary(w.parent)).balance, 3);
  } finally {
    await editor.query('rollback'); editor.release();
    if (pending) await pending;
    await checkout.query('rollback'); checkout.release();
  }
});
