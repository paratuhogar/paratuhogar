// Disposable PostgreSQL WASM fixtures only; never connects to a server.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
const sqlPath=new URL('../supabase/proposals/subgestor-review.sql',import.meta.url);
assert.ok(fs.existsSync(sqlPath),'atomic review SQL must exist');
const {PGlite}=await import(pathToFileURL(process.env.PTH_PGLITE_MODULE).href);
const db=new PGlite();let checks=0;
const admin='00000000-0000-4000-8000-000000000001',parent='00000000-0000-4000-8000-000000000002',other='00000000-0000-4000-8000-000000000003',child='00000000-0000-4000-8000-000000000004';
const id=n=>'10000000-0000-4000-8000-'+String(n).padStart(12,'0');
const check=async(name,run)=>{await run();checks++;console.log('PASS '+name);};
async function seed(n=1){await db.query(`insert into pedidos_subgestores(id,subgestor_id,subgestor_nombre,parent_gestor_id,parent_gestor_nombre,cliente,telefono,direccion,municipio,producto,total,costo_mensajeria,comision_total,comision_subgestor,proveedor,estado,orden_dia,submission_token) values($1,$2,'Child',$3,'Parent','Fixture','50000000','Original [VUELTO: 100]','Habana','1x Fixture [USD]',53,3,7,3,'CA','Pendiente Aprobacion',$4,'signed-fixture')`,[id(n),child,parent,'CA-'+n]);}
async function call(op,n=1,actor=admin,expected=null,changes={},reason=null,offset=0,search=''){
 return (await db.query('select pth_review_subgestor($1,$2,$3,$4,$5,$6,$7,$8) as result',[actor,op,['list','history'].includes(op)?null:id(n),expected,changes,reason,search,offset])).rows[0].result;
}
const version=async n=>(await call('list',n,parent,null,{},null,0,'CA-'+n)).rows.find(r=>r.id===id(n)).review_version;
try{
 await db.exec(`create role anon nologin;create role authenticated nologin;create role service_role nologin bypassrls;
 create table gestores(id uuid primary key,nombre text,estado text,activo boolean,rol text,parent_id uuid);
 create table pedidos(id uuid primary key,fecha timestamptz default now(),gestor text,cliente text,ci text,telefono text,direccion text,municipio text,producto text,total numeric,costo_mensajeria numeric,comision_total numeric,comision_subgestor numeric,comision_parent numeric,proveedor text,estado text,pago_gestor text,pago_subgestor text,origen text,subgestor_nombre text,orden_dia text,garantia_venta text,garantia_dias integer,submission_token text);
 create table pedidos_subgestores(id uuid primary key,subgestor_id uuid,subgestor_nombre text not null,parent_gestor_id uuid,parent_gestor_nombre text not null,cliente text not null,telefono text not null,ci text,direccion text not null,municipio text not null,producto text not null,total numeric not null,costo_mensajeria numeric,comision_total numeric,comision_subgestor numeric,proveedor text,estado text default 'Pendiente Aprobacion',created_at timestamptz default now(),orden_dia text,garantia_venta text,garantia_dias integer,submission_token text);
 grant select on gestores to service_role;grant select,insert,update,delete on pedidos,pedidos_subgestores to service_role;`);
 for(const [who,name,role,owner] of [[admin,'Admin','admin',null],[parent,'Parent','gestor',null],[other,'Other','gestor',null],[child,'Child','admin',parent]])await db.query("insert into gestores values($1,$2,'activo',true,$3,$4)",[who,name,role,owner]);
 await seed();await db.exec(fs.readFileSync(sqlPath,'utf8'));
 await check('migration leaves historical pending rows untouched',async()=>{assert.equal((await db.query('select count(*)::int n from pedidos_subgestores')).rows[0].n,1);});
 await check('anonymous/authenticated cannot execute the internal function or read audit',async()=>{
  for(const role of ['anon','authenticated']){await db.exec('set role '+role);try{await assert.rejects(()=>call('list'));await assert.rejects(()=>db.query('select * from pth_subgestor_review_events'));}finally{await db.exec('reset role');}}
 });
 await db.exec('set role service_role');
 await check('admin sees all; principal only own; child-labelled admin cannot review',async()=>{assert.equal((await call('list')).rows.length,1);assert.equal((await call('list',1,other)).rows.length,0);await assert.rejects(()=>call('list',1,child));});
 let initial=await version(1);
 await check('financial fields cannot be edited',async()=>{await assert.rejects(()=>call('edit',1,parent,initial,{total:1}));});
 await check('editing delivery is audited and makes earlier approval versions stale',async()=>{
  await call('edit',1,parent,initial,{direccion:'Changed [VUELTO: 50]'});await assert.rejects(()=>call('approve',1,admin,initial));
  assert.equal((await db.query('select direccion from pedidos_subgestores')).rows[0].direccion,'Changed [VUELTO: 50]');
 });
 await check('approval preserves saved ID, reference, money and commercial attribution',async()=>{
  const r=await call('approve',1,admin,await version(1));assert.equal(r.reference,'CA-1');
  const row=(await db.query('select * from pedidos')).rows[0];assert.equal(row.id,id(1));assert.equal(row.gestor,'Parent');assert.equal(Number(row.total),53);assert.equal(Number(row.comision_total),7);assert.equal(Number(row.comision_subgestor),3);assert.equal(Number(row.comision_parent),4);assert.equal(row.estado,'Pendiente');assert.equal(row.submission_token,'signed-fixture');
  assert.equal((await db.query('select count(*)::int n from pedidos_subgestores')).rows[0].n,0);
 });
 await check('same approval replay is idempotent; conflicting rejection and foreign principal fail',async()=>{
  assert.equal((await call('approve',1,parent,initial)).replayed,true);await assert.rejects(()=>call('reject',1,admin,initial,{},'Conflict'));await assert.rejects(()=>call('approve',1,other,initial));assert.equal((await db.query('select count(*)::int n from pedidos')).rows[0].n,1);
 });
 await seed(2);
 await check('rejection requires a reason, records it and creates no logistics order',async()=>{
  const v=await version(2);await assert.rejects(()=>call('reject',2,admin,v,{},''));await call('reject',2,admin,v,{},'Cliente desistió');
  assert.equal((await db.query('select count(*)::int n from pedidos where id=$1',[id(2)])).rows[0].n,0);
  assert.equal((await call('history')).rows.find(r=>r.pedido_id===id(2)).reason,'Cliente desistió');await assert.rejects(()=>call('history',1,parent));
 });
 await seed(3);
 await check('an order-insert failure rolls back source removal and audit',async()=>{
  await db.exec('reset role');await db.exec("alter table pedidos add constraint fixture_failure check(id <> '10000000-0000-4000-8000-000000000003')");await db.exec('set role service_role');
  const v=await version(3);await assert.rejects(()=>call('approve',3,admin,v));
  assert.equal((await db.query('select count(*)::int n from pedidos_subgestores where id=$1',[id(3)])).rows[0].n,1);
  assert.equal((await call('history')).rows.some(r=>r.pedido_id===id(3)),false);
  await db.exec('reset role');await db.exec('alter table pedidos drop constraint fixture_failure');await db.exec('set role service_role');
 });
 await check('repeated queued decisions produce one final event and one logistics row',async()=>{
  const v=await version(3);const replies=await Promise.all([call('approve',3,admin,v),call('approve',3,parent,v)]);assert.equal(replies.filter(r=>r.replayed).length,1);
  assert.equal((await db.query("select count(*)::int n from pth_subgestor_review_events where pedido_id=$1 and decision='approve'",[id(3)])).rows[0].n,1);
 });
 await seed(4);
 await db.query("insert into pedidos(id,cliente,telefono,estado) values($1,'Legacy existing','50000000','Pendiente')",[id(4)]);
 await check('legacy partial approvals cannot be rejected or silently reconciled with divergent delivery data',async()=>{
  const v=await version(4);
  for(const op of ['edit','approve','reject'])await assert.rejects(()=>call(op,4,admin,v,op==='edit'?{telefono:'59999999'}:{},'Cliente desistió'));
  assert.equal((await db.query('select telefono from pedidos where id=$1',[id(4)])).rows[0].telefono,'50000000');
  assert.equal((await db.query('select estado from pedidos_subgestores where id=$1',[id(4)])).rows[0].estado,'Pendiente Aprobacion');
  assert.equal((await call('history')).rows.some(r=>r.pedido_id===id(4)),false);
 });
 await check('service gateway cannot rewrite or remove private audit events',async()=>{
  await assert.rejects(()=>db.query("update pth_subgestor_review_events set reason='tampered'"),e=>e.code==='42501');
  await assert.rejects(()=>db.query('delete from pth_subgestor_review_events'),e=>e.code==='42501');
 });
 await db.exec(`insert into pedidos_subgestores(id,subgestor_id,subgestor_nombre,parent_gestor_id,parent_gestor_nombre,cliente,telefono,direccion,municipio,producto,total,comision_total,comision_subgestor,estado,orden_dia)
 select gen_random_uuid(),'${child}','Child','${parent}','Parent','Bulk fixture','50000000','Street','Habana','1x Fixture',53,7,3,'Pendiente Aprobacion','CA-BULK-'||n from generate_series(1,1100) n`);
 await check('server search and pagination find a pending reference beyond the old thousand-row cap',async()=>{
  const result=await call('list',1,admin,null,{},null,1000);assert.equal(result.rows.length,50);assert.equal(result.hasMore,true);
  const found=await call('list',1,parent,null,{},null,0,'CA-BULK-1100');assert.equal(found.rows.length,1);assert.equal(found.rows[0].orden_dia,'CA-BULK-1100');
 });
 console.log(`${checks} SQL checks passed. WASM serializes its connection: true multi-session MVCC still needs a staging Postgres check.`);
}finally{await db.close();}
