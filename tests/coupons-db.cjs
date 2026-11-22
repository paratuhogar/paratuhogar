const { before, after, test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { startCouponsPostgres } = require('./helpers/coupons-postgres.cjs');
let db;
before(async () => { db = await startCouponsPostgres(); });
after(async () => { if (db) await db.stop(); });
let sequence = 10000000;
const phone = () => String(++sequence);
const outcome = promise => promise.then(value => ({ ok:true,value }),error => ({ ok:false,error }));
async function admin(role='admin',parent=null) {
 const id=randomUUID();
 await db.query('insert into gestores(id,nombre,rol,parent_id) values($1,$2,$3,$4)',[id,'Synthetic '+id,role,parent]);return id;
}
async function rpc(actor,operation,body={}) {
 return (await db.service('select public.pth_coupon_admin($1,$2,$3) result',[actor,operation,body])).rows[0].result;
}
async function campaign(overrides={}) {
 const actor=await admin();
 const result=await rpc(actor,'save',{code:'T'+randomUUID().replaceAll('-','').slice(0,12).toUpperCase(),kind:'fixed',value:333,
  minimum_cents:0,starts_at:'2020-01-01T00:00:00Z',ends_at:'2100-01-01T00:00:00Z',total_limit:100,phone_limit:1,
  active:true,reason:'Synthetic campaign test',...overrides});
 return {...result,actor};
}
function cart(ph=phone(),amounts=[1000,2000],token='pthn2.1795348800000.p.1.'+randomUUID()+'.actor.payload.providers.signature') {
 return amounts.map((cents,index)=>({id:randomUUID(),submission_token:token,proveedor:['AA','BB','CC'][index],
  cliente:'Synthetic customer',telefono:ph,ci:'11111111111',direccion:'Synthetic address',municipio:'Habana',
  producto:'Canonical server products',total:cents/100+5,costo_mensajeria:5,comision_total:0,
  estado:'Pendiente',gestor:'Venta Directa',origen:'Web',pago_gestor:'No aplica',garantia_dias:30}));
}
async function rawQuote(c,rows,rateKey=null,ph=rows[0].telefono) {
 return (await db.service('select public.pth_coupon_quote($1,$2,$3,$4) result',[c.code,ph,JSON.stringify(rows),rateKey])).rows[0].result;
}
async function quote(...args) {
 const result=await rawQuote(...args);if(result.error) throw Object.assign(new Error(result.error.message),{code:result.sqlstate});return result;
}
async function insert(rows,q,captures=null,tariff=null) {
 return (await db.service('select public.pth_insert_coupon_checkout($1,$2,$3,$4) result',
  [JSON.stringify(rows),{...q,phone:rows[0].telefono},captures===null?null:JSON.stringify(captures),tariff])).rows[0].result;
}
async function historic(sql,params) {
 const client=await db.connect();try{
  await client.query('begin');await client.query('set local session_replication_role=replica');
  await client.query(sql,params);await client.query('commit');
 }catch(error){await client.query('rollback');throw error;}finally{client.release();}
}
const count = async c => Number((await db.query('select count(*) n from pth_coupons.redemptions where campaign_id=$1',[c.id])).rows[0].n);
async function blockedBy(waiterPid,holderPid) {
 const deadline=Date.now()+2000;
 while(Date.now()<deadline){
  const result=await db.query('select $2::integer=any(pg_blocking_pids($1::integer)) blocked',[waiterPid,holderPid]);
  if(result.rows[0].blocked)return;
  await new Promise(resolve=>setTimeout(resolve,5));
 }
 assert.fail('Expected native PostgreSQL lock barrier was not reached');
}

test('private campaign RPC exists and migration creates no live campaigns',async()=>{
 const result=await db.query("select to_regprocedure('public.pth_coupon_quote(text,text,jsonb,text)') is not null available");
 assert.equal(result.rows[0].available,true,'service-only coupon quote must exist');
 assert.equal((await db.query('select count(*) n from pth_coupons.campaigns')).rows[0].n,'0');
});

test('fixed discounts use product cents, preserve shipping and consume only on confirmation',async()=>{
 const c=await campaign(),rows=cart(),q=await quote({...c,code:' '+c.code.toLowerCase()+' '},rows);
 assert.equal(q.discount_cents,333);assert.equal(q.subtotal_cents,3000);
 assert.deepEqual(q.allocations,[{proveedor:'AA',gross_cents:1000,discount_cents:111,net_cents:889},
  {proveedor:'BB',gross_cents:2000,discount_cents:222,net_cents:1778}]);
 assert.equal(await count(c),0);
 const receipt=await insert(rows,q);assert.equal(receipt.length,2);
 assert.match(receipt[0].orden_dia,/^AA-\d+$/);
 const stored=(await db.query('select subtotal_productos,descuento_productos,cupon_codigo,total,costo_mensajeria,comision_total from pedidos where id=$1',[rows[0].id])).rows[0];
 assert.equal(Number(stored.subtotal_productos),10);assert.equal(Number(stored.descuento_productos),1.11);
 assert.equal(Number(stored.total),13.89);assert.equal(Number(stored.costo_mensajeria),5);
 assert.equal(Number(stored.comision_total),0);assert.equal(stored.cupon_codigo,c.code);assert.equal(await count(c),1);
 assert.equal((await db.query('select count(*) n from pth_coupons.allocations where redemption_id in(select id from pth_coupons.redemptions where campaign_id=$1)',[c.id])).rows[0].n,'2');
});

test('percent, cap and stable provider residual distribution are exact integer arithmetic',async()=>{
 const percent=await campaign({kind:'percent',value:10});
 const rows=cart(phone(),[1001,1001,1001]).reverse(),q=await quote(percent,rows);
 assert.equal(q.discount_cents,300);assert.deepEqual(q.allocations.map(x=>x.proveedor),['AA','BB','CC']);
 assert.deepEqual(q.allocations.map(x=>x.discount_cents),[100,100,100]);
 const fixed=await campaign({value:1}),small=cart(phone(),[100,100,100]).reverse();
 assert.deepEqual((await quote(fixed,small)).allocations.map(x=>x.discount_cents),[1,0,0]);
 const cap=await campaign({value:999999});assert.equal((await quote(cap,cart(phone(),[101]))).discount_cents,101);
 const all=await campaign({kind:'percent',value:100});assert.equal((await quote(all,cart(phone(),[101]))).discount_cents,101);
});

test('minimum, active state, server UTC dates and invalid phones reject generically',async()=>{
 for(const overrides of [{minimum_cents:3001},{active:false},{starts_at:'2090-01-01T00:00:00Z'},{ends_at:'2021-01-01T00:00:00Z'}]){
  const c=await campaign(overrides);await assert.rejects(quote(c,cart()),e=>e.code==='PT409');
 }
 const c=await campaign();for(const ph of ['bad','1234567','123456789','15312345678']) await assert.rejects(quote(c,cart(ph)),e=>e.code==='PT409');
});

test('all canonical telephone variants reject accounts, binding and immutable commercial history',async()=>{
 const c=await campaign();
 for(const format of [x=>x,x=>'53'+x,x=>'0'+x,x=>'0053'+x]){
  const ph=phone(),account=await admin('gestor');await db.query('update gestores set telefono=$2,activo=false where id=$1',[account,format(ph)]);
  await assert.rejects(quote(c,cart(ph)),e=>e.code==='PT409');
 }
 const bound=phone();await db.query("insert into customer_bindings(phone,agent_name) values($1,'Original')",['0'+bound]);
 await assert.rejects(quote(c,cart('53'+bound)),e=>e.code==='PT409');
 const old=phone();await historic("insert into pedidos(id,telefono,gestor,origen) values($1,$2,'Historical seller','Gestor')",[randomUUID(),'0'+old]);
 await assert.rejects(quote(c,cart(old)),e=>e.code==='PT409');
 const child=phone();await historic('insert into pedidos_subgestores(id,telefono,subgestor_id) values($1,$2,$3)',[randomUUID(),'53'+child,randomUUID()]);
 await assert.rejects(quote(c,cart(child)),e=>e.code==='PT409');
 const event=phone();await db.query("insert into customer_binding_events(phone,agent_name,event_type) values($1,'Seller','assigned')",['0'+event]);
 await assert.rejects(quote(c,cart(event)),e=>e.code==='PT409');
});

test('commercial canonical row metadata, mismatched phone and non-cent economics fail closed',async()=>{
 const c=await campaign();
 for(const patch of [{gestor:'Seller'},{origen:'Enlace Compartido'},{subgestor_id:randomUUID()},{parent_gestor_nombre:'Parent'},
  {_referral_reference:'Seller'},{comision_total:1},{comision_subgestor:1},{total:15.001},{costo_mensajeria:-1}]){
  const rows=cart();Object.assign(rows[0],patch);await assert.rejects(quote(c,rows),e=>['PT400','PT409'].includes(e.code));
 }
 const rows=cart();rows[1].telefono=phone();await assert.rejects(quote(c,rows),e=>e.code==='PT409');
 const noCommission=cart();delete noCommission[0].comision_total;await assert.rejects(quote(c,noCommission),e=>e.code==='PT409');
});

test('coupon captures cannot create commercial referral points on a direct order',async()=>{
 const c=await campaign(),rows=cart(),q=await quote(c,rows),seller=await admin('gestor');
 const captures=rows.map(x=>({pedido_id:x.id,beneficiary_id:seller,sales_channel:'referral_link',lines:[]}));
 await assert.rejects(insert(rows,q,captures),e=>e.code==='PT409');assert.equal(await count(c),0);
});

test('snapshots cannot be forged and edits require customer review rather than removal of discount',async()=>{
 const c=await campaign(),rows=cart(),q=await quote(c,rows);
 const forged=structuredClone(q);forged.allocations[0].discount_cents++;
 await assert.rejects(insert(rows,forged),e=>e.code==='PT409');assert.equal(await count(c),0);
 const updated=await rpc(c.actor,'save',{...c,value:500,reason:'New approved revision'});assert.equal(updated.revision,c.revision+1);
 await assert.rejects(insert(rows,q),e=>e.code==='PT409');
 assert.equal((await db.query('select count(*) n from pedidos where id=any($1)',[rows.map(x=>x.id)])).rows[0].n,'0');
});

test('same submission token replays original receipt before campaign and phone eligibility changes',async()=>{
 const c=await campaign(),rows=cart(),q=await quote(c,rows),receipts=await Promise.all(Array.from({length:8},()=>insert(rows,q)));
 assert.ok(receipts.every(x=>JSON.stringify(x)===JSON.stringify(receipts[0])));assert.equal(await count(c),1);
 await rpc(c.actor,'save',{...c,active:false,reason:'Paused campaign'});
 await db.query("insert into customer_bindings(phone,agent_name) values($1,'Later Seller')",[rows[0].telefono]);
 assert.deepEqual(await insert(rows,q),receipts[0]);assert.equal(await count(c),1);
 await db.service("update pedidos set estado='Cancelado' where id=$1",[rows[0].id]);assert.equal(await count(c),1);
});

test('last global usage serializes independent phones and per-phone quota serializes aliases',async()=>{
 const c=await campaign({total_limit:1}),a=cart(),b=cart(),qa=await quote(c,a),qb=await quote(c,b);
 const global=await Promise.all([outcome(insert(a,qa)),outcome(insert(b,qb))]);
 assert.equal(global.filter(x=>x.ok).length,1);assert.equal(global.find(x=>!x.ok).error.code,'PT409');assert.equal(await count(c),1);
 const per=await campaign({phone_limit:1}),ph=phone(),first=cart(ph),second=cart('0'+ph);
 const q1=await quote(per,first),q2=await quote(per,second);
 const local=await Promise.all([outcome(insert(first,q1)),outcome(insert(second,q2))]);assert.equal(local.filter(x=>x.ok).length,1);assert.equal(await count(per),1);
});

test('commercial insertion wins phone lock before a coupon and coupon-first never deadlocks supplier counters',async()=>{
 const c=await campaign(),ph=phone(),rows=cart(ph),q=await quote(c,rows),seller=await admin('gestor');
 const sellerName=(await db.query('select nombre from gestores where id=$1',[seller])).rows[0].nombre;
 const commercial=cart('0'+ph,[1000]);commercial[0].gestor=sellerName;commercial[0].origen='Gestor';
 const holder=await db.connect(),waiter=await db.connect();
 try{
  await holder.query('begin');await holder.query('set local role service_role');
  await holder.query("select public.pth_insert_checkout('pedidos',$1)",[JSON.stringify(commercial)]);
  const holderPid=(await holder.query('select pg_backend_pid() pid')).rows[0].pid;
  await waiter.query('set role service_role');const waiterPid=(await waiter.query('select pg_backend_pid() pid')).rows[0].pid;
  const pending=outcome(waiter.query('select public.pth_insert_coupon_checkout($1,$2,null,null)',[JSON.stringify(rows),{...q,phone:ph}]));
  await blockedBy(waiterPid,holderPid);await holder.query('commit');
  const denied=await pending;assert.equal(denied.ok,false);assert.equal(denied.error.code,'PT409');assert.equal(await count(c),0);
  const otherPhone=phone(),direct=cart(otherPhone,[1000]),approved=await quote(c,direct),later=cart('53'+otherPhone,[1000]);later[0].gestor=sellerName;later[0].origen='Gestor';
  await holder.query('begin');await holder.query('set local role service_role');
  await holder.query('select public.pth_insert_coupon_checkout($1,$2,null,null)',[JSON.stringify(direct),{...approved,phone:otherPhone}]);
  const pendingCommercial=waiter.query("select public.pth_insert_checkout('pedidos',$1)",[JSON.stringify(later)]);
  await blockedBy(waiterPid,holderPid);await holder.query('commit');await pendingCommercial;
  assert.equal(await count(c),1);
 }finally{
  await holder.query('rollback');await holder.query('reset role');holder.release();
  await waiter.query('reset role');waiter.release();
 }
});

test('points-enabled commercial inserts cannot lock a product before waiting for a coupon phone',async()=>{
 const c=await campaign(),ph=phone(),rows=cart(ph,[1000]),q=await quote(c,rows),seller=await admin('gestor'),product=randomUUID();
 await db.query('insert into productos(id,nombre,"tamaño_envio") values($1,$2,$3)',[product,'Synthetic lock product','Pequeño']);
 const sellerName=(await db.query('select nombre from gestores where id=$1',[seller])).rows[0].nombre;
 const commercial=cart('53'+ph,[1000]);commercial[0].gestor=sellerName;commercial[0].origen='Gestor';
 const captures=commercial.map(x=>({pedido_id:x.id,beneficiary_id:seller,sales_channel:'referral_link',lines:[{producto_id:product,cantidad:1}]}));
 const directCaptures=rows.map(x=>({pedido_id:x.id,beneficiary_id:null,sales_channel:'direct',lines:[{producto_id:product,cantidad:1}]}));
 const holder=await db.connect(),waiter=await db.connect();let pending;
 try{
  await holder.query('begin');await holder.query('set local role service_role');
  await holder.query("select pg_advisory_xact_lock(hashtextextended('customer-binding:'||$1,0))",[ph]);
  const holderPid=(await holder.query('select pg_backend_pid() pid')).rows[0].pid;
  await waiter.query('set role service_role');const waiterPid=(await waiter.query('select pg_backend_pid() pid')).rows[0].pid;
  pending=outcome(waiter.query("select public.pth_insert_checkout_points('pedidos',$1,$2,null)",[JSON.stringify(commercial),JSON.stringify(captures)]));
  await blockedBy(waiterPid,holderPid);
  await holder.query('select public.pth_insert_coupon_checkout($1,$2,$3,null)',[JSON.stringify(rows),{...q,phone:ph},JSON.stringify(directCaptures)]);
  await holder.query('commit');assert.equal((await pending).ok,true);assert.equal(await count(c),1);
 }finally{
  await holder.query('rollback');await holder.query('reset role');holder.release();
  if(pending)await pending;await waiter.query('reset role');waiter.release();
 }
});

test('quote rate is separate, persisted for invalid guesses and limited to IP plus normalized phone',async()=>{
 const c=await campaign(),rows=cart(),key='ip-hash-'+randomUUID();
 for(let i=0;i<10;i++) await quote(c,rows,key,i%2?'53'+rows[0].telefono:rows[0].telefono);
 await assert.rejects(quote(c,rows,key),e=>e.code==='PT429');await quote(c,rows,key+'other');await quote(c,rows,null);
 const other=cart(),bad={code:'MISSING-CODE'};for(let i=0;i<10;i++) assert.equal((await rawQuote(bad,other,key)).error.code,'COUPON_UNAVAILABLE');
 await assert.rejects(quote(c,other,key),e=>e.code==='PT429');
});

test('failed underlying points or express insertion rolls back numbering, snapshots and redemption',async()=>{
 const c=await campaign(),rows=cart(),q=await quote(c,rows);
 const before=(await db.query("select ultimo_numero from pth_private.pedido_consecutivos where proveedor='AA'")).rows[0]?.ultimo_numero;
 await assert.rejects(insert(rows,q,[{pedido_id:randomUUID(),lines:[]}]),/captura|pedido|lote/i);
 assert.equal(await count(c),0);assert.equal((await db.query('select count(*) n from pedidos where id=$1',[rows[0].id])).rows[0].n,'0');
 assert.equal((await db.query("select ultimo_numero from pth_private.pedido_consecutivos where proveedor='AA'")).rows[0]?.ultimo_numero,before);
 await assert.rejects(insert(rows,q,null,{municipio:'Missing',localidad:'Missing'}),e=>e.code==='PT409');assert.equal(await count(c),0);
 const captures=rows.map(x=>({pedido_id:x.id,beneficiary_id:null,sales_channel:'organic_direct',lines:[]}));
 const receipt=await insert(rows,q,captures);assert.equal(receipt.length,2);assert.equal(await count(c),1);
 assert.equal((await db.query('select count(*) n from pth_points.captures where order_id=any($1)',[rows.map(x=>x.id)])).rows[0].n,'0');
});

test('a failure after the first numbered order rolls back the entire batch and all coupon ledgers',async()=>{
 const c=await campaign(),rows=cart();rows[1].cliente='Synthetic rejected row';const q=await quote(c,rows);
 const prior=(await db.query("select proveedor,ultimo_numero from pth_private.pedido_consecutivos where proveedor in ('AA','BB') order by proveedor")).rows;
 await db.query("alter table pedidos add constraint synthetic_coupon_failure check(cliente<>'Synthetic rejected row')");
 try{await assert.rejects(insert(rows,q),e=>e.code==='23514');}finally{await db.query('alter table pedidos drop constraint synthetic_coupon_failure');}
 assert.equal((await db.query('select count(*) n from pedidos where id=any($1)',[rows.map(x=>x.id)])).rows[0].n,'0');
 assert.deepEqual((await db.query("select proveedor,ultimo_numero from pth_private.pedido_consecutivos where proveedor in ('AA','BB') order by proveedor")).rows,prior);
 assert.equal(await count(c),0);
 assert.equal((await db.query('select count(*) n from pth_coupons.allocations where order_id=any($1)',[rows.map(x=>x.id)])).rows[0].n,'0');
});

test('admin operations verify principal role, validate campaign fields and retain audited revisions and reserved codes',async()=>{
 for(const role of ['gestor','logistica','administrativo','admin logistica']) await assert.rejects(rpc(await admin(role),'list'),e=>e.code==='PT403');
 const parent=await admin();await assert.rejects(rpc(await admin('admin',parent),'list'),e=>e.code==='PT403');
 const inactive=await admin();await db.query('update gestores set activo=false where id=$1',[inactive]);await assert.rejects(rpc(inactive,'list'),e=>e.code==='PT403');
 await assert.rejects(rpc(randomUUID(),'list'),e=>e.code==='PT403');
 for(const role of ['administrador','superadmin']) assert.ok(Array.isArray((await rpc(await admin(role),'list')).rows));
 const c=await campaign();for(const patch of [{value:0},{kind:'percent',value:101},{value:1.5},{phone_limit:0},{total_limit:0},{minimum_cents:-1},{code:'NO!'},{reason:''}])
  await assert.rejects(rpc(c.actor,'save',{...c,...patch,reason:patch.reason??'Validation'}),e=>e.code==='PT400');
 await assert.rejects(rpc(c.actor,'save',{...c,code:'OTHER-CODE',reason:'Cannot rename'}),e=>e.code==='PT400');
 await rpc(c.actor,'save',{...c,active:false,reason:'Retire'});
 await assert.rejects(rpc(c.actor,'save',{...c,id:undefined,revision:undefined,reason:'Cannot reuse'}),e=>e.code==='PT400');
 assert.equal((await db.query('select count(*) n from pth_coupons.revisions where campaign_id=$1',[c.id])).rows[0].n,'2');
 assert.equal((await db.query('select count(*) n from pth_coupons.audit where campaign_id=$1',[c.id])).rows[0].n,'2');
});

test('anon and authenticated cannot access tables, RPCs or helper functions and old orders stay null',async()=>{
 for(const role of ['anon','authenticated']){
  assert.equal((await db.query("select has_schema_privilege($1,'pth_coupons','usage') allowed",[role])).rows[0].allowed,false);
  for(const fn of ['public.pth_coupon_quote(text,text,jsonb,text)','public.pth_insert_coupon_checkout(jsonb,jsonb,jsonb,jsonb)','public.pth_coupon_admin(uuid,text,jsonb)'])
   assert.equal((await db.query('select has_function_privilege($1,$2,\'execute\') allowed',[role,fn])).rows[0].allowed,false);
  const helpers=await db.query("select p.oid from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='pth_coupons'");
  for(const fn of helpers.rows) assert.equal((await db.query('select has_function_privilege($1,$2,\'execute\') allowed',[role,fn.oid])).rows[0].allowed,false);
 }
 const rows=cart();await db.service("select public.pth_insert_checkout('pedidos',$1)",[JSON.stringify(rows)]);
 assert.deepEqual((await db.query('select subtotal_productos,descuento_productos,cupon_codigo from pedidos where id=$1',[rows[0].id])).rows[0],
  {subtotal_productos:null,descuento_productos:null,cupon_codigo:null});
 await assert.rejects(db.service('update pedidos set subtotal_productos=10 where id=$1',[rows[0].id]),e=>e.code==='23514');
 await assert.rejects(db.service("update pedidos set cupon_codigo='PARTIAL' where id=$1",[rows[0].id]),e=>e.code==='23514');
 const protectedTables=await db.query("select bool_and(relrowsecurity) enabled from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='pth_coupons' and relkind='r'");assert.equal(protectedTables.rows[0].enabled,true);
});

test('campaign revisions, audit, redemptions and allocations cannot be rewritten even by privileged roles',async()=>{
 const c=await campaign(),rows=cart(),q=await quote(c,rows);await insert(rows,q);
 for(const [table,predicate] of [['revisions','campaign_id'],['audit','campaign_id'],['redemptions','campaign_id']]){
  await assert.rejects(db.query(`delete from pth_coupons.${table} where ${predicate}=$1`,[c.id]),/inmutable/i);
 }
 await assert.rejects(db.query('delete from pth_coupons.allocations where order_id=$1',[rows[0].id]),/inmutable/i);
 assert.equal(await count(c),1);
});
test('canonical Directo/Web checkout origin remains eligible without a commercial seller',async()=>{
 const c=await campaign(),rows=cart();for(const row of rows)row.origen='Directo/Web';
 const q=await quote(c,rows);assert.equal(q.discount_cents,333);
});
test('accepted order net cannot diverge from its frozen coupon economics',async()=>{
 const c=await campaign(),rows=cart(),q=await quote(c,rows);await insert(rows,q);
 await assert.rejects(db.service('update pedidos set total=total+1 where id=$1',[rows[0].id]),e=>e.code==='23514');
});
