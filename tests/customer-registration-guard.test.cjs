const {before, after, test} = require('node:test');
const assert = require('node:assert/strict');
const {randomUUID} = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {startCustomerBindingsPostgres} = require('./helpers/customer-bindings-postgres.cjs');

let db, parent, child;
const denied = error => error.code === 'PT409' && error.message ===
  'No se puede solicitar una cuenta comercial con este teléfono. Contacta con administración.';
before(async () => {
  db = await startCustomerBindingsPostgres();
  await db.query(`alter table gestores add column telefono text, add column password text,
    add column email text, add column application_token uuid;
    alter table gestores alter column id set default gen_random_uuid()`);
  parent = randomUUID(); child = randomUUID();
  await db.query("insert into gestores(id,nombre,parent_id,telefono) values($1,'parent',null,'50000990'),($2,'child',$1,'50000991')", [parent, child]);
  const migration = fs.readFileSync(path.join(__dirname,
    '../supabase/migrations/20261127101214_prevent_customer_commercial_registration.sql'), 'utf8');
  await db.query(migration);
});
after(async () => { await db?.stop(); });
async function applicant(phone, parentId = null, executor = db.service.bind(db)) {
  return executor("insert into gestores(nombre,telefono,parent_id,estado) values('Synthetic applicant',$1,$2,$3) returning id",
    [phone, parentId, parentId ? 'pendiente_subgestor' : 'pendiente']);
}
async function purchase(phone, {state = 'Pendiente', sub = false, executor = db.service.bind(db)} = {}) {
  const id = randomUUID();
  if (sub) await executor(`insert into pedidos_subgestores(id,telefono,estado,subgestor_id,subgestor_nombre,parent_gestor_id,parent_gestor_nombre)
    values($1,$2,$3,$4,'child',$5,'parent')`, [id, phone, state, child, parent]);
  else await executor("insert into pedidos(id,telefono,estado,gestor,origen) values($1,$2,$3,'Venta Directa','Directo')", [id, phone, state]);
  return id;
}
async function waitForLock(client) {
  const pid = (await client.query('select pg_backend_pid() pid')).rows[0].pid;
  return async () => {
    const until = Date.now() + 3000;
    while (Date.now() < until) {
      const waiting = (await db.query("select wait_event_type='Lock' blocked from pg_stat_activity where pid=$1", [pid])).rows[0]?.blocked;
      if (waiting) return;
      await new Promise(resolve => setTimeout(resolve, 15));
    }
    assert.fail('Competing operation did not wait for the shared phone lock');
  };
}

test('Cuban phone formats cannot bypass new principal or invited-child eligibility', async () => {
  await purchase('+53 5 000-0101');
  for (const phone of ['50000101', '5350000101', '+53 50000101', '050000101', '05350000101', '0053 50000101']) {
    for (const parentId of [null, parent]) await assert.rejects(applicant(phone, parentId), denied);
  }
  assert.equal((await db.query("select count(*) from gestores where nombre='Synthetic applicant'")).rows[0].count, '0');
});
test('non-cancelled principal orders block registration, including pending and pickup', async () => {
  let phone = 50000200;
  for (const state of ['Pendiente', 'Entregado', 'Asignado Mensajero', 'Recogida Almacén', null, '']) {
    await purchase(String(++phone), {state});
    await assert.rejects(applicant('+53' + phone), denied);
  }
});
test('pending child orders block both kinds of new application', async () => {
  await purchase('50000301', {sub: true, state: 'Pendiente Aprobacion'});
  await assert.rejects(applicant('5350000301'), denied);
  await assert.rejects(applicant('50000301', parent), denied);
});
test('cancelled or rejected orders alone and consultation-only bindings do not block', async () => {
  for (const [i, state] of ['Cancelado', ' cancelado ', 'Rechazado'].entries()) {
    const phone = String(50000400 + i);
    await purchase(phone, {state}); await purchase(phone, {state, sub: true});
    assert.equal((await applicant(phone)).rowCount, 1);
  }
  await db.query("insert into customer_bindings(phone,agent_name) values('50000410','parent')");
  assert.equal((await applicant('50000410')).rowCount, 1);
  assert.equal((await applicant('50000411', parent)).rowCount, 1);
});
test('one cancelled order cannot hide a different non-cancelled purchase', async () => {
  await purchase('50000420', {state: 'Cancelado'}); await purchase('+53 50000420');
  await assert.rejects(applicant('50000420'), denied);
});
test('foreign numbers retain eligibility checks without imposing a new Cuba-only registration rule', async () => {
  await purchase('+1 (212) 555-0101');
  await assert.rejects(applicant('0012125550101'), denied);
  assert.equal((await applicant('+34 600 000 101')).rowCount, 1);
});
test('existing accounts, approvals and same-ID upserts are preserved after purchasing', async () => {
  const id = (await applicant('50000501', parent)).rows[0].id;
  await purchase('+53 50000501');
  await db.service("update gestores set estado='activo',activo=true where id=$1", [id]);
  await db.service("insert into gestores(id,telefono,nombre) values($1,'50000501','Updated existing') on conflict(id) do update set nombre=excluded.nombre", [id]);
  const row = (await db.query('select * from gestores where id=$1', [id])).rows[0];
  assert.equal(row.estado, 'activo'); assert.equal(row.activo, true); assert.equal(row.parent_id, parent);
  assert.equal(row.telefono, '50000501'); assert.equal(row.nombre, 'Updated existing');
  await assert.rejects(applicant('5350000501'), denied);
});
test('admin-created commercial accounts cannot bypass the same guard', async () => {
  await purchase('50000510');
  await assert.rejects(db.service("insert into gestores(nombre,telefono,rol,estado) values('Synthetic admin','50000510','admin','activo')"), denied);
});
test('courier-only creation is not a gestor application', async () => {
  await purchase('50000511');
  assert.equal((await db.service("insert into gestores(nombre,telefono,rol) values('Synthetic courier','50000511','mensajero')")).rowCount, 1);
});
test('bulk insertion rolls back entirely if any applicant is ineligible', async () => {
  await purchase('50000520');
  await assert.rejects(db.service("insert into gestores(nombre,telefono) values('Batch new','50000521'),('Batch buyer','50000520')"), denied);
  assert.equal((await db.query("select count(*) from gestores where telefono='50000521'")).rows[0].count, '0');
});
for (const sub of [false, true]) test('purchase-first concurrency blocks registration after commit: ' + (sub ? 'child' : 'direct'), async () => {
  const writer = await db.connect(), registrar = await db.connect();
  const phone = sub ? '50000601' : '50000602';
  try {
    const wait = await waitForLock(registrar);
    await writer.query('begin'); await writer.query('set local role service_role');
    await purchase(phone, {sub, executor: writer.query.bind(writer)});
    await registrar.query('set role service_role');
    const result = applicant('+53' + phone, null, registrar.query.bind(registrar)).then(() => null, e => e);
    await wait(); await writer.query('commit');
    assert.ok(denied(await result));
  } finally { await writer.query('rollback'); await registrar.query('reset role'); writer.release(); registrar.release(); }
});
test('rolled-back purchase does not leave a false permanent eligibility block', async () => {
  const writer = await db.connect(), registrar = await db.connect();
  try {
    const wait = await waitForLock(registrar);
    await writer.query('begin'); await purchase('50000603', {executor: writer.query.bind(writer)});
    const result = applicant('50000603', null, registrar.query.bind(registrar));
    await wait(); await writer.query('rollback'); assert.equal((await result).rowCount, 1);
  } finally { await writer.query('rollback'); writer.release(); registrar.release(); }
});
test('registration-first concurrency preserves the new existing account and allows later purchase', async () => {
  const registrar = await db.connect(), writer = await db.connect();
  try {
    const wait = await waitForLock(writer);
    await registrar.query('begin'); const id = (await applicant('50000604', null, registrar.query.bind(registrar))).rows[0].id;
    const result = purchase('+53 50000604', {executor: writer.query.bind(writer)});
    await wait(); await registrar.query('commit'); await result;
    assert.equal((await db.query('select activo from gestores where id=$1', [id])).rows[0].activo, true);
  } finally { await registrar.query('rollback'); registrar.release(); writer.release(); }
});
test('updates of an order phone or state participate in eligibility checks', async () => {
  const id = await purchase('50000701', {state: 'Cancelado'});
  await db.service("update pedidos set telefono='+53 50000702',estado='Pendiente' where id=$1", [id]);
  await assert.rejects(applicant('50000702'), denied);
  assert.equal((await applicant('50000701')).rowCount, 1);
});
test('reactivating a cancelled order fences a simultaneous new application', async () => {
  const id=await purchase('50000703',{state:'Cancelado'}), writer=await db.connect(), registrar=await db.connect();
  try {
    const wait=await waitForLock(registrar); await writer.query('begin');
    await writer.query("update pedidos set estado='Pendiente' where id=$1",[id]);
    const result=applicant('50000703',null,registrar.query.bind(registrar)).then(()=>null,e=>e);
    await wait(); await writer.query('commit'); assert.ok(denied(await result));
  } finally {await writer.query('rollback');writer.release();registrar.release();}
});
test('real checkout replay and child approval preserve numbering and financial data', async () => {
  const id=randomUUID(), row={id,submission_token:'pthn2.1795348800000.p.1.'+randomUUID()+'.actor.payload.providers.signature',
    proveedor:'TEST',cliente:'Synthetic',telefono:'50000704',producto:'Fixture product',total:20,costo_mensajeria:5,comision_total:2,
    estado:'Pendiente Aprobacion',subgestor_id:child,subgestor_nombre:'child',parent_gestor_id:parent,parent_gestor_nombre:'parent',comision_subgestor:1};
  const insert=()=>db.service('select public.pth_insert_checkout($1,$2) result',['pedidos_subgestores',JSON.stringify([row])]);
  const first=(await insert()).rows[0].result;assert.deepEqual((await insert()).rows[0].result,first);
  await assert.rejects(applicant('+53 50000704'),denied);
  const expected=(await db.query('select md5(to_jsonb(s)::text) version from pedidos_subgestores s where id=$1',[id])).rows[0].version;
  await db.service("select public.pth_review_subgestor($1,'approve',$2,$3)",[parent,id,expected]);
  const saved=(await db.query('select total,costo_mensajeria,comision_total,comision_subgestor,orden_dia from pedidos where id=$1',[id])).rows[0];
  assert.equal(saved.total,'20');assert.equal(saved.costo_mensajeria,'5');assert.equal(saved.comision_total,'2');assert.equal(saved.comision_subgestor,'1');
  assert.ok(saved.orden_dia);await assert.rejects(applicant('50000704'),denied);
});
test('private helpers grant no browser access or privilege escalation', async () => {
  for (const role of ['anon', 'authenticated']) {
    assert.equal((await db.query("select has_function_privilege($1,'pth_customers.registration_phone(text)','EXECUTE') allowed", [role])).rows[0].allowed, false);
    assert.equal((await db.query("select has_schema_privilege($1,'pth_customers','USAGE') allowed", [role])).rows[0].allowed, false);
  }
  const functions = (await db.query("select prosecdef,proconfig from pg_proc where pronamespace='pth_customers'::regnamespace and proname in ('registration_phone','guard_new_commercial_account','lock_registration_phone')")).rows;
  assert.equal(functions.length, 3); assert.ok(functions.every(f => !f.prosecdef && f.proconfig.some(c => c.startsWith('search_path='))));
});
test('the real public gateway returns a bounded eligibility error for principal and invited applications', async () => {
  const {createHandler} = await import('../supabase/functions/secure-data/handler.mjs');
  await purchase('50000801');
  const adapter = {from(table) {
    assert.equal(table, 'gestores'); let cols = '*', values, phone, id, single = false;
    const q = {select(c) { cols = c; return q; }, eq(k,v) { if(k === 'telefono') phone=v; else if(k === 'id') id=v; else assert.fail(k); return q; },
      maybeSingle() {single=true; return q;}, limit() {return q;}, insert(v) {values=v; return q;},
      then(resolve,reject) {return (async () => {try {
        let rows;
        if(values) {
          const v=values[0]; rows=(await db.service('insert into gestores(nombre,email,telefono,password,parent_id,rol,estado) values($1,$2,$3,$4,$5,$6,$7) returning *',
            [v.nombre,v.email,v.telefono,v.password,v.parent_id,v.rol,v.estado])).rows;
        } else {
          assert.match(cols,/^[a-z_, *]+$/i); rows=(await db.service(`select ${cols} from gestores where ${phone ? 'telefono' : 'id'}=$1`,[phone || id])).rows;
        }
        return {data:single ? rows[0] || null : rows,error:null};
      } catch(error) {return {data:null,error:{message:error.message,code:error.code}};}})().then(resolve,reject);}}; return q;
  }};
  const handler = createHandler({db:adapter});
  for(const parentId of [null,parent]) {
    const response = await handler(new Request('https://example.test',{method:'POST',body:JSON.stringify({action:'query',table:'gestores',op:'insert',values:[{
      nombre:'Synthetic gateway',telefono:'+53 50000801',password:'test-only',parent_id:parentId,rol:'admin',estado:'activo'}]})}));
    const body = await response.json(); assert.equal(body.error.code,'PT409'); assert.ok(denied({code:body.error.code,message:body.error.message}));
    assert.doesNotMatch(JSON.stringify(body),/cliente|50000801|subgestor_id/);
  }
});
test('registration UI displays permanent server denial without suggesting a network retry', async () => {
  const source=fs.readFileSync(path.join(__dirname,'../js/storefront.js'),'utf8');
  const start=source.indexOf('let registrationBusy=false;'), end=source.indexOf('\nasync function ',source.indexOf('async function processRegister()',start)+40);
  const fields={}; for(const id of ['reg-name','reg-email','reg-tel','reg-pass']) fields[id]={value:'test-only'};
  fields['reg-submit']={disabled:false,innerText:'Enviar'}; fields['reg-status']={textContent:''};
  const message='No se puede solicitar una cuenta comercial con este teléfono. Contacta con administración.';
  const context=vm.createContext({document:{getElementById:id=>fields[id]},localStorage:{getItem:()=>null},crypto:{randomUUID},PTHQuestionnaire:{read:()=>({})},
    supabaseClient:{from:()=>({select(){return this;},eq(){return this;},maybeSingle:async()=>({data:null}),insert:async()=>({error:{code:'PT409',message}})})}});
  vm.runInContext(source.slice(start,end),context); await vm.runInContext('processRegister()',context);
  assert.equal(fields['reg-status'].textContent,message); assert.equal(fields['reg-submit'].disabled,false); assert.equal(fields['reg-tel'].value,'test-only');
});
test('Chrome displays the guarded error for principal and invitation forms without losing inputs', async () => {
  const {chromium}=require('playwright');
  const browser=await chromium.launch({headless:true,executablePath:process.env.PTH_CHROMIUM||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
  try {
    const source=fs.readFileSync(path.join(__dirname,'../js/storefront.js'),'utf8');
    const start=source.indexOf('let registrationBusy=false;'),end=source.indexOf('\nasync function ',source.indexOf('async function processRegister()',start)+40);
    for(const invitation of [false,true]) {
      const page=await browser.newPage();
      await page.route('https://registration.test/**',route=>route.fulfill({contentType:'text/html',body:`<!doctype html>
        <input id="reg-name" value="Synthetic"><input id="reg-tel" value="+53 50000801"><input id="reg-email" value="test@example.test">
        <input id="reg-pass" type="password" value="test-only"><button id="reg-submit" onclick="processRegister()">Enviar</button><p id="reg-status" role="status"></p>`}));
      await page.goto('https://registration.test/');
      await page.evaluate(invited=>{
        if(invited)localStorage.setItem('pth_invitado_por_id','synthetic-parent');
        window.PTHQuestionnaire={read:()=>({})};window.insertions=0;window.toggleLoginMode=()=>{throw Error('must not show success');};
        window.supabaseClient={from:()=>({select(){return this;},eq(){return this;},maybeSingle:async()=>({data:null,error:null}),insert:async()=>{
          insertions++;return {data:null,error:{code:'PT409',message:'No se puede solicitar una cuenta comercial con este teléfono. Contacta con administración.'}};
        }})};
      },invitation);
      await page.addScriptTag({content:source.slice(start,end)});
      await page.getByRole('button',{name:'Enviar',exact:true}).click();
      assert.equal(await page.locator('[role=status]').innerText(),'No se puede solicitar una cuenta comercial con este teléfono. Contacta con administración.');
      assert.equal(await page.locator('#reg-tel').inputValue(),'+53 50000801');assert.equal(await page.locator('#reg-pass').inputValue(),'test-only');
      assert.equal(await page.locator('#reg-submit').isEnabled(),true);assert.equal(await page.evaluate(()=>insertions),1);await page.close();
    }
  } finally {await browser.close();}
});
