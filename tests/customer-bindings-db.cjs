const { before, after, test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { startCustomerBindingsPostgres } = require('./helpers/customer-bindings-postgres.cjs');

let db, actors;
before(async () => {
  db = await startCustomerBindingsPostgres();
  actors = { parent: randomUUID(), child: randomUUID(), other: randomUUID(), admin: randomUUID(), logistics: randomUUID() };
  for (const [name, id] of Object.entries(actors)) await db.query(
    'insert into gestores(id,nombre,rol,parent_id) values($1,$2,$3,$4)',
    [id, name, name === 'admin' ? 'admin' : name === 'logistics' ? 'logistica' : 'gestor', name === 'child' ? actors.parent : null]);
});
after(async () => { if (db) await db.stop(); });
async function asRole(role, sql, values = []) {
  const client = await db.connect();
  try { await client.query('set role ' + role); return await client.query(sql, values); }
  finally { await client.query('reset role'); client.release(); }
}
function order(phone, { child = false, seller = 'parent', id = randomUUID() } = {}) {
  return { table: child ? 'pedidos_subgestores' : 'pedidos', rows: [{
    id, submission_token: 'pthn2.1795348800000.p.1.' + randomUUID() + '.actor.payload.providers.signature',
    proveedor: 'TEST', cliente: 'Synthetic', telefono: phone, producto: 'Fixture product',
    total: 20, costo_mensajeria: 5, comision_total: 2,
    estado: child ? 'Pendiente Aprobacion' : 'Pendiente',
    ...(child ? { subgestor_id: actors.child, subgestor_nombre: 'child', parent_gestor_id: actors.parent,
      parent_gestor_nombre: 'parent', comision_subgestor: 1 } : { gestor: seller, origen: 'Gestor' })
  }] };
}
async function insert(s, executor = db.service.bind(db)) {
  return executor('select public.pth_insert_checkout($1,$2) result', [s.table, JSON.stringify(s.rows)]);
}
async function binding(phone) { return (await db.query('select * from customer_bindings where pth_customers.canonical_phone(phone)=$1', [phone])).rows; }
async function renew(actor, phone) {
  return (await db.service('select public.pth_customer_binding($1,$2) result', [actor, phone])).rows[0].result;
}

test('anon and authenticated cannot mutate bindings or forge audit events, but public reads remain available', async () => {
  for (const role of ['anon', 'authenticated']) {
    for (const statement of [
      "insert into customer_bindings(phone,agent_name) values('50000001','forged')",
      "update customer_bindings set agent_name='forged' where phone='58123450'",
      "delete from customer_bindings where phone='58123450'",
      "insert into customer_binding_events(phone,agent_name,event_type) values('50000001','forged','fake')",
      "update customer_binding_events set agent_name='forged'",
      'delete from customer_binding_events',
      'truncate customer_bindings',
      "select nextval('customer_binding_events_id_seq')",
    ]) await assert.rejects(asRole(role, statement), error => error.code === '42501');
    assert.equal((await asRole(role, "select agent_name from customer_bindings where phone='58123450'")).rows[0].agent_name, 'Other owner');
  }
});

test('phone normalization handles Cuban and historic prefixes without rewriting existing rows', async () => {
  const examples = [['+53 5812-3456','58123456'],['58123456','58123456'],['058123456','58123456'],
    ['0053 58123456','58123456'],['05358123456','58123456'],['+1 212 555 1234',null],['123',null],['',null],[null,null]];
  for (const [phone, expected] of examples) assert.equal((await db.service('select pth_customers.canonical_phone($1) phone',[phone])).rows[0].phone,expected);
  const historical = (await db.query("select * from customer_bindings where phone='05358123456'")).rows[0];
  assert.equal(historical.agent_name, 'Historic owner');
  assert.equal(historical.created_at.toISOString(), '2020-01-01T00:00:00.000Z');
  assert.equal(historical.last_activity_type, 'legacy');
  assert.equal(historical.previous_agent_name, 'Previous owner');
});

test('confirmed commercial checkout binds on server time and replay does not duplicate activity', async () => {
  const s = order('+53 58123451');
  await insert(s); await insert(s);
  const [b] = await binding('58123451');
  assert.equal(b.agent_name, 'parent'); assert.equal(b.last_order_id, s.rows[0].id);
  assert.ok(Math.abs(Date.now() - b.last_purchase_at.getTime()) < 10000);
  assert.equal(b.protected_until, null);
  assert.equal((await db.query('select count(*) from customer_binding_events where order_id=$1',[s.rows[0].id])).rows[0].count,'1');
});

test('a new closure preserves the existing normalized owner and transfer history', async () => {
  const s = order('58123456', { seller: 'other' }); await insert(s);
  const rows = await binding('58123456'); assert.equal(rows.length,1);
  assert.equal(rows[0].phone,'05358123456'); assert.equal(rows[0].agent_name,'Historic owner');
  assert.equal(rows[0].previous_agent_name,'Previous owner'); assert.equal(rows[0].transferred_at,null);
  const audit = (await db.query('select agent_name,metadata from customer_binding_events where order_id=$1',[s.rows[0].id])).rows[0];
  assert.equal(audit.agent_name,'Historic owner'); assert.equal(audit.metadata.closing_agent,'other');
  assert.equal((await db.query('select gestor from pedidos where id=$1',[s.rows[0].id])).rows[0].gestor,'other','commission recipient is unchanged');
});

test('child checkout owns its binding and same-ID approval never reassigns ownership to parent', async () => {
  const s = order('58123452',{child:true}); await insert(s);
  assert.equal((await binding('58123452'))[0].agent_name,'child');
  const expected = (await db.query('select md5(to_jsonb(s)::text) version from pedidos_subgestores s where id=$1',[s.rows[0].id])).rows[0].version;
  await db.service("select public.pth_review_subgestor($1,'approve',$2,$3)",[actors.parent,s.rows[0].id,expected]);
  assert.equal((await binding('58123452'))[0].agent_name,'child');
  assert.equal((await db.query('select count(*) from customer_binding_events where order_id=$1',[s.rows[0].id])).rows[0].count,'1');
});

for (const change of ['deactivated','renamed']) test('confirmed child approval survives a '+change+' child without rewriting purchase history', async () => {
  const phone=change==='deactivated'?'58123466':'58123467';
  const s=order(phone,{child:true});await insert(s);
  const beforeBinding=(await db.query('select to_jsonb(b) snapshot from customer_bindings b where phone=$1',[phone])).rows[0].snapshot;
  const beforeEvents=(await db.query('select to_jsonb(e) snapshot from customer_binding_events e where order_id=$1 order by id',[s.rows[0].id])).rows.map(r=>r.snapshot);
  const beforeProof=(await db.service('select to_jsonb(o) snapshot from pth_customers.confirmed_orders o where order_id=$1',[s.rows[0].id])).rows[0].snapshot;
  const expected=(await db.query('select md5(to_jsonb(s)::text) version from pedidos_subgestores s where id=$1',[s.rows[0].id])).rows[0].version;
  if(change==='deactivated')await db.query("update gestores set activo=false,estado='inactivo' where id=$1",[actors.child]);
  else await db.query("update gestores set nombre='Renamed child' where id=$1",[actors.child]);
  try {
    const result=await db.service("select public.pth_review_subgestor($1,'approve',$2,$3) result",[actors.parent,s.rows[0].id,expected]);
    assert.equal(result.rows[0].result.decision,'approve');
    assert.equal((await db.query('select count(*) from pedidos where id=$1',[s.rows[0].id])).rows[0].count,'1');
    assert.deepEqual((await db.query('select to_jsonb(b) snapshot from customer_bindings b where phone=$1',[phone])).rows[0].snapshot,beforeBinding);
    assert.deepEqual((await db.query('select to_jsonb(e) snapshot from customer_binding_events e where order_id=$1 order by id',[s.rows[0].id])).rows.map(r=>r.snapshot),beforeEvents);
    assert.deepEqual((await db.service('select to_jsonb(o) snapshot from pth_customers.confirmed_orders o where order_id=$1',[s.rows[0].id])).rows[0].snapshot,beforeProof);
  } finally {await db.query("update gestores set nombre='child',activo=true,estado='activo' where id=$1",[actors.child]);}
});

test('same-ID approval cannot substitute another child for the recorded confirmation', async () => {
  const s=order('58123468',{child:true});await insert(s);
  const impostor=randomUUID();
  await db.query("insert into gestores(id,nombre,parent_id) values($1,'Replacement child',$2)",[impostor,actors.parent]);
  await db.service("update pedidos_subgestores set subgestor_id=$1,subgestor_nombre='Replacement child' where id=$2",[impostor,s.rows[0].id]);
  // Public audit rows were historically browser-writable and are not authority.
  await db.query("update customer_binding_events set metadata=metadata||jsonb_build_object('seller_id',$1::text,'closing_agent','Replacement child') where order_id=$2",[impostor,s.rows[0].id]);
  const expected=(await db.query('select md5(to_jsonb(s)::text) version from pedidos_subgestores s where id=$1',[s.rows[0].id])).rows[0].version;
  await assert.rejects(db.service("select public.pth_review_subgestor($1,'approve',$2,$3)",[actors.parent,s.rows[0].id,expected]),/verific|confirm|coincid/i);
  assert.equal((await binding('58123468'))[0].agent_name,'child');
  assert.equal((await db.query('select count(*) from pedidos where id=$1',[s.rows[0].id])).rows[0].count,'0');
  assert.equal((await db.query('select count(*) from customer_binding_events where order_id=$1',[s.rows[0].id])).rows[0].count,'1');
});

test('legacy pending approval survives renamed inactive child without backfilling assignments or proof', async () => {
  const legacy=await startCustomerBindingsPostgres({migrate:false});
  try {
    await legacy.query("insert into gestores(id,nombre,parent_id) values($1,'parent',null),($2,'child',$1)",[actors.parent,actors.child]);
    const s=order('58123469',{child:true});
    await legacy.service('select public.pth_insert_checkout($1,$2)',[s.table,JSON.stringify(s.rows)]);
    await legacy.query(fs.readFileSync(path.join(__dirname,'../supabase/migrations/20261122222020_protect_customer_assignment.sql'),'utf8'));
    await legacy.query("update gestores set nombre='Renamed legacy child',activo=false,estado='inactivo' where id=$1",[actors.child]);
    const expected=(await legacy.query('select md5(to_jsonb(s)::text) version from pedidos_subgestores s where id=$1',[s.rows[0].id])).rows[0].version;
    await legacy.service("select public.pth_review_subgestor($1,'approve',$2,$3)",[actors.parent,s.rows[0].id,expected]);
    assert.equal((await legacy.query("select count(*) from customer_bindings where phone='58123469'")).rows[0].count,'0');
    assert.equal((await legacy.query('select count(*) from customer_binding_events')).rows[0].count,'0');
    assert.equal((await legacy.query('select count(*) from pth_customers.binding_owners')).rows[0].count,'0');
    assert.equal((await legacy.query('select count(*) from pth_customers.confirmed_orders')).rows[0].count,'0');
  } finally {await legacy.stop();}
});

test('server rejects forged sellers and rolls order/numbering back if the binding audit fails', async () => {
  const forged = order('58123453',{seller:'unknown'});
  await assert.rejects(insert(forged), /seller|vendedor|gestor/i);
  assert.equal((await db.query('select count(*) from pedidos where id=$1',[forged.rows[0].id])).rows[0].count,'0');
  const s = order('58123454');
  await db.query("alter table customer_binding_events add constraint fixture_reject_audit check(phone<>'58123454')");
  const before = (await db.query("select ultimo_numero from pth_private.pedido_consecutivos where proveedor='TEST'")).rows[0].ultimo_numero;
  try { await assert.rejects(insert(s),error=>error.code==='23514'); }
  finally { await db.query('alter table customer_binding_events drop constraint fixture_reject_audit'); }
  assert.equal((await binding('58123454')).length,0);
  assert.equal((await db.query('select count(*) from pedidos where id=$1',[s.rows[0].id])).rows[0].count,'0');
  assert.equal((await db.query("select ultimo_numero from pth_private.pedido_consecutivos where proveedor='TEST'")).rows[0].ultimo_numero,before);
});

test('unbound direct orders remain unbound and nonnormalizable no-coupon orders remain accepted', async () => {
  await insert(order('58123455',{seller:'Venta Directa'}));
  assert.equal((await binding('58123455')).length,0);
  await insert(order('123',{seller:'parent'}));
});

test('renewal verifies database owner/admin and never takes owner or timestamp from the caller', async () => {
  await assert.rejects(renew(actors.other,'58123451'),error=>error.code==='42501');
  await assert.rejects(renew(actors.logistics,'58123451'),error=>error.code==='42501');
  await assert.rejects(renew(randomUUID(),'58123451'),error=>error.code==='42501');
  assert.equal((await renew(actors.parent,'+53 58123451')).renewed,true);
  assert.equal((await renew(actors.admin,'58123451')).renewed,true);
  const [b] = await binding('58123451');
  assert.equal(b.agent_name,'parent'); assert.equal(b.last_activity_type,'seguimiento_registrado');
  assert.ok(Math.abs(Date.now()-b.last_activity_at.getTime())<10000);
  await db.query('update gestores set activo=false where id=$1',[actors.parent]);
  try { await assert.rejects(renew(actors.parent,'58123451'),error=>error.code==='42501'); }
  finally { await db.query('update gestores set activo=true where id=$1',[actors.parent]); }
  await assert.rejects(renew(actors.parent,'58123459'),error=>error.code==='42501');
});

test('same-named children in different teams cannot renew one another, even after another closure', async () => {
  const first=randomUUID(),second=randomUUID();
  await db.query("insert into gestores(id,nombre,parent_id) values($1,'Shared child',$3),($2,'Shared child',$4)",[first,second,actors.parent,actors.other]);
  function childSale(id,parent,name) {
    const s=order('58123470',{child:true});
    Object.assign(s.rows[0],{subgestor_id:id,subgestor_nombre:'Shared child',parent_gestor_id:parent,parent_gestor_nombre:name});
    return s;
  }
  await insert(childSale(first,actors.parent,'parent'));
  await assert.rejects(renew(second,'58123470'),error=>error.code==='42501');
  assert.equal((await renew(first,'58123470')).renewed,true);
  await insert(childSale(second,actors.other,'other'));
  await assert.rejects(renew(second,'58123470'),error=>error.code==='42501');
  assert.equal((await renew(first,'58123470')).renewed,true);
  assert.equal((await binding('58123470'))[0].agent_name,'Shared child');
});

test('ambiguous legacy owner names fail closed across inactive accounts and never trust public audit identity', async () => {
  const active=randomUUID(),inactive=randomUUID();
  await db.query("insert into gestores(id,nombre,activo,parent_id) values($1,'Legacy shared owner',true,$3),($2,'Legacy shared owner',false,$4)",[active,inactive,actors.parent,actors.other]);
  await db.query("insert into customer_bindings(phone,agent_name) values('58123471','Legacy shared owner')");
  await db.query("insert into customer_binding_events(phone,agent_name,event_type,order_id,metadata) values('58123471','Legacy shared owner','primera_compra',$1,jsonb_build_object('seller_id',$2::text,'closing_agent','Legacy shared owner','source_table','pedidos_subgestores'))",[randomUUID(),active]);
  await assert.rejects(renew(active,'58123471'),error=>error.code==='42501');
  assert.equal((await renew(actors.admin,'58123471')).renewed,true);
  assert.equal((await binding('58123471'))[0].agent_name,'Legacy shared owner');
});

test('private ownership and confirmation proofs cannot be edited and never backfill legacy bindings', async () => {
  await insert(order('58123472'));
  assert.equal((await db.query("select count(*) from pth_customers.binding_owners where phone='58123456'")).rows[0].count,'0');
  assert.equal((await db.service("select owner_id from pth_customers.binding_owners where phone='58123472'")).rows[0].owner_id,actors.parent);
  for(const table of ['binding_owners','confirmed_orders']) {
    for(const role of ['anon','authenticated'])await assert.rejects(asRole(role,'select * from pth_customers.'+table),e=>e.code==='42501');
    await assert.rejects(db.service('delete from pth_customers.'+table),e=>e.code==='42501');
    await assert.rejects(db.service('truncate pth_customers.'+table),e=>e.code==='42501');
  }
  await assert.rejects(db.service("update pth_customers.binding_owners set owner_id=$1 where phone='58123472'",[actors.other]),e=>e.code==='42501');
  await assert.rejects(db.query("update pth_customers.binding_owners set owner_id=$1 where phone='58123472'",[actors.other]),e=>e.code==='42501');
});

test('private binding functions are not browser-callable and custom operational grants survive', async () => {
  for (const role of ['anon','authenticated']) {
    await assert.rejects(asRole(role,'select public.pth_customer_binding($1,$2)',[actors.parent,'58123451']),error=>error.code==='42501');
    await assert.rejects(asRole(role,"select pth_customers.canonical_phone('58123451')"),error=>error.code==='42501');
  }
  await asRole('binding_operations',"insert into customer_bindings(phone,agent_name) values('58123458','Existing operational owner')");
  await asRole('binding_operations',"update customer_bindings set last_activity_type='custom' where phone='58123458'");
  assert.equal((await binding('58123458'))[0].last_activity_type,'custom');
});

for(const existingRls of [false,true]) test('custom operational writers inheriting authenticated retain binding and event writes with prior RLS '+existingRls, async () => {
  const custom=await startCustomerBindingsPostgres({migrate:false});
  async function customWrite(sql) {
    const client=await custom.connect();
    try {await client.query('set role binding_operations');return await client.query(sql);}
    finally {await client.query('reset role');client.release();}
  }
  try {
    await custom.query('grant authenticated to binding_operations');
    // Existing RLS policies must survive, including the previously-enabled case.
    for(const table of existingRls?['customer_bindings','customer_binding_events']:[]) {
      await custom.query('alter table public.'+table+' enable row level security');
      await custom.query('create policy fixture_custom_write on public.'+table+' for all to binding_operations using(true) with check(true)');
    }
    await customWrite("insert into customer_bindings(phone,agent_name) values('58123473','Operational owner')");
    await customWrite("insert into customer_binding_events(phone,agent_name,event_type) values('58123473','Operational owner','operational')");
    await custom.query(fs.readFileSync(path.join(__dirname,'../supabase/migrations/20261122222020_protect_customer_assignment.sql'),'utf8'));
    assert.equal((await customWrite("update customer_bindings set last_activity_type='operational' where phone='58123473'")).rowCount,1);
    assert.equal((await customWrite("update customer_binding_events set event_type='operational-updated' where phone='58123473'")).rowCount,1);
    await customWrite("insert into customer_bindings(phone,agent_name) values('58123474','Operational owner')");
    await customWrite("insert into customer_binding_events(phone,agent_name,event_type) values('58123474','Operational owner','operational')");
    assert.equal((await customWrite("delete from customer_binding_events where phone='58123474'")).rowCount,1);
    assert.equal((await customWrite("delete from customer_bindings where phone='58123474'")).rowCount,1);
    assert.equal((await custom.query("select count(*) from pg_policies where policyname='fixture_custom_write' and tablename in ('customer_bindings','customer_binding_events')")).rows[0].count,existingRls?'2':'0');
    for(const role of ['anon','authenticated']) {
      assert.equal((await custom.query("select pg_has_role($1,'binding_operations','MEMBER') member",[role])).rows[0].member,false,'migration must not grant browser access to the operational role');
      const client=await custom.connect();
      try {
        await client.query('set role '+role);
        await assert.rejects(client.query("insert into customer_bindings(phone,agent_name) values('58123475','forged')"),e=>e.code==='42501');
        await assert.rejects(client.query("insert into customer_binding_events(phone,agent_name,event_type) values('58123475','forged','forged')"),e=>e.code==='42501');
      } finally {await client.query('reset role');client.release();}
    }
  } finally {await custom.stop();}
});

test('conflicting legacy phone variants fail closed without reassigning either owner', async () => {
  await db.query("insert into customer_bindings(phone,agent_name) values('58123460','parent'),('5358123460','other')");
  await assert.rejects(insert(order('058123460')),/conflict|contradict|asignaci/i);
  await assert.rejects(renew(actors.admin,'58123460'),/conflict|contradict|asignaci/i);
  assert.deepEqual((await binding('58123460')).map(b=>b.agent_name).sort(),['other','parent']);
});

test('normalized phone races wait on one transaction lock and preserve the first owner', async () => {
  const a = await db.connect(), b = await db.connect();
  const first = order('58123461'), second = order('+53 58123461',{seller:'other'});
  let pending;
  try {
    await a.query('begin'); await a.query('set local role service_role');
    await insert(first,a.query.bind(a));
    await b.query('begin'); await b.query('set local role service_role');
    pending = insert(second,b.query.bind(b));
    const pid = b.processID;
    const end = Date.now()+3000; let blocked=false;
    while(Date.now()<end) {
      blocked=(await db.query('select cardinality(pg_blocking_pids($1))>0 blocked',[pid])).rows[0].blocked;
      if(blocked) break;
      await new Promise(resolve=>setTimeout(resolve,10));
    }
    assert.equal(blocked,true,'normalized checkout must wait for assignment transaction');
    await a.query('commit'); await pending; await b.query('commit');
    const rows=await binding('58123461'); assert.equal(rows.length,1); assert.equal(rows[0].agent_name,'parent');
  } finally {
    await a.query('rollback'); await b.query('rollback');
    if(pending) await pending.catch(()=>{});
    a.release();b.release();
  }
});

test('phone locks precede supplier counters so a competing coupon transaction can finish', async () => {
  const coupon = await db.connect(), commercial = await db.connect();
  const normal = order('58123462'); let pending;
  try {
    await coupon.query('begin'); await coupon.query('set local role service_role');
    await commercial.query('set role service_role');
    await coupon.query("select pg_advisory_xact_lock(hashtextextended('customer-binding:58123462',0))");
    pending = insert(normal,commercial.query.bind(commercial));
    // The commercial checkout must be blocked on our phone, not hold supplier locks.
    let waiting=false;
    for(let i=0;i<200;i++) {
      waiting=(await db.query('select $2::int=any(pg_blocking_pids($1)) blocked',[commercial.processID,coupon.processID])).rows[0].blocked;
      if(waiting) break;
      await new Promise(resolve=>setTimeout(resolve,10));
    }
    assert.equal(waiting,true);
    await coupon.query("set local lock_timeout='1s'");
    await insert(order('58123463',{seller:'Venta Directa'}),coupon.query.bind(coupon));
    await coupon.query('commit'); await pending;
    assert.equal((await binding('58123462'))[0].agent_name,'parent');
  } finally {
    await coupon.query('rollback');
    if(pending) await pending.catch(()=>{});
    await commercial.query('reset role');
    coupon.release(); commercial.release();
  }
});

test('points wrapper locks phones before products so a competing coupon cannot deadlock', async () => {
  const product=randomUUID();
  await db.query('insert into productos(id,nombre,"tamaño_envio") values($1,$2,$3)',[product,'Concurrency fixture','Pequeño']);
  const coupon=await db.connect(),commercial=await db.connect();let pending;
  const insertWithPoints=(client,s)=>client.query('select public.pth_insert_checkout_points($1,$2,$3,null)',
    [s.table,JSON.stringify(s.rows),JSON.stringify([{pedido_id:s.rows[0].id,beneficiary_id:actors.parent,
      sales_channel:'manual',lines:[{producto_id:product,cantidad:1}]}])]);
  try {
    await coupon.query('begin');await coupon.query('set local role service_role');
    await commercial.query('set role service_role');
    await coupon.query("select pg_advisory_xact_lock(hashtextextended('customer-binding:58123465',0))");
    pending=insertWithPoints(commercial,order('58123465'));pending.catch(()=>{});
    let waiting=false;
    for(let i=0;i<200;i++) {
      waiting=(await db.query('select $2::int=any(pg_blocking_pids($1)) blocked',[commercial.processID,coupon.processID])).rows[0].blocked;
      if(waiting)break;
      await new Promise(resolve=>setTimeout(resolve,10));
    }
    assert.equal(waiting,true);
    await coupon.query("set local lock_timeout='500ms'");
    await insertWithPoints(coupon,order('58123465',{seller:'Venta Directa'}));
    await coupon.query('commit');await pending;
    assert.equal((await binding('58123465'))[0].agent_name,'parent');
    assert.equal((await db.query('select count(*) from pth_points.captures where request_snapshot->>\'sales_channel\'=\'manual\'')).rows[0].count,'0');
  } finally {
    await coupon.query('rollback');if(pending)await pending.catch(()=>{});
    await commercial.query('reset role');coupon.release();commercial.release();
  }
});

function gatewayDatabase() {
  return { async rpc(name, args) {
    if (name !== 'pth_customer_binding') throw Error('Unexpected binding RPC: '+name);
    try { return { data: (await db.service('select public.pth_customer_binding($1,$2) result',
      [args.p_actor_id,args.p_phone])).rows[0].result,error:null }; }
    catch (error) { return {data:null,error}; }
  } };
}

test('closure compatibility is read-only and reports the permanent database owner', async () => {
  const source=fs.readFileSync(path.join(__dirname,'../js/storefront.js'),'utf8');
  const context=vm.createContext({window:{},console,Date,
    canonicalCustomerPhone:phone=>phone,
    findPermanentCustomerOwner:async()=>({phone:'58123450',agent_name:'Other owner'}),
    supabaseClient:{from(){throw Error('Browser binding writes must not occur');}},
  });
  vm.runInContext(source.slice(source.indexOf('async function recordCustomerClosure('),source.indexOf('window.renewCustomerProtection = renewCustomerProtection;')),context);
  const result=await context.recordCustomerClosure('58123450','parent',randomUUID());
  assert.equal(result.owner,'Other owner');assert.equal(result.transferred,false);assert.equal(result.created,false);
});

test('gateway renewal authorizes the current actor and rejects caller-selected ownership fields', async () => {
  const {customerBindings}=await import('../supabase/functions/secure-data/customer-bindings.mjs');
  const parent={id:actors.parent,nombre:'parent',rol:'gestor',estado:'activo',activo:true};
  await insert(order('58123464'));
  assert.equal((await customerBindings(gatewayDatabase(),{action:'customer_binding',operation:'renew',phone:'+53 58123464'},parent)).data.renewed,true);
  await assert.rejects(customerBindings(gatewayDatabase(),{operation:'renew',phone:'58123464',agent_name:'other'},parent),e=>e.status===400);
  await assert.rejects(customerBindings(gatewayDatabase(),{operation:'claim',phone:'58123464'},parent),e=>e.status===400);
  await assert.rejects(customerBindings(gatewayDatabase(),{operation:'renew',phone:'58123464'},null),e=>e.status===401);
  await assert.rejects(customerBindings(gatewayDatabase(),{operation:'renew',phone:'58123464'},{...parent,id:actors.other}),e=>e.status===403);
  await assert.rejects(customerBindings(gatewayDatabase(),{operation:'renew',phone:'invalid'},parent),e=>e.status===400);
  await assert.rejects(customerBindings({rpc:async()=>({error:{code:'08006'},data:null})},{operation:'renew',phone:'58123464'},parent),e=>e.status===503);
  await assert.rejects(customerBindings({rpc:async()=>({error:null,data:{renewed:false}})},{operation:'renew',phone:'58123464'},parent),e=>e.status===503);
});

test('browser follow-up delegates ownership and timestamps to the verified gateway', async () => {
  const source=fs.readFileSync(path.join(__dirname,'../js/storefront.js'),'utf8');
  const context=vm.createContext({console,Date,protectedCustomerCountOwner:'cached',
    window:{PTHSecureData:{customerBinding:async body=>{
      assert.deepEqual(JSON.parse(JSON.stringify(body)),{operation:'renew',phone:'58123464'});
      return {data:{renewed:true},error:null};
    }}},
    findPermanentCustomerOwner:async()=>({agent_name:'parent'}),
    supabaseClient:{from(){throw Error('Browser binding writes must not occur');}},
  });
  vm.runInContext(source.slice(source.indexOf('async function recordCustomerClosure('),source.indexOf('window.renewCustomerProtection = renewCustomerProtection;')),context);
  const result=await context.renewCustomerProtection('58123464','parent','caller-selected-activity');
  assert.equal(result.renewed,true);assert.equal(context.protectedCustomerCountOwner,null);
  context.window.PTHSecureData.customerBinding=async()=>({data:null,error:{code:'SESSION_CHANGED'}});
  assert.equal((await context.renewCustomerProtection('58123464','parent')).renewed,false);
});
