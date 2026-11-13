// Real disposable SQL engine only. Never connects to Supabase or sends notifications.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
const {PGlite}=await import(pathToFileURL(process.env.PTH_PGLITE_MODULE).href);
const db=new PGlite();let checks=0;
const id=n=>'10000000-0000-4000-8000-'+String(n).padStart(12,'0');
const token=n=>(n%2?'pthn1':'pthn2')+'.1793700000000.p.1.'+String(n).padStart(64,'0')+'.'+'a'.repeat(64)+'.'+'b'.repeat(64)+'.'+'c'.repeat(64)+'.'+'d'.repeat(64);
const row=(n,provider='RO',key=n)=>({id:id(n),submission_token:token(key),proveedor:provider,cliente:'Synthetic',telefono:'50000000',direccion:'Synthetic street',municipio:'Almacén',producto:'1x Fixture',total:53,costo_mensajeria:3,comision_total:7,gestor:'Synthetic parent',estado:'Pendiente',pago_gestor:'Pendiente'});
const call=(rows,table='pedidos')=>db.query('select pth_insert_checkout($1,$2) result',[table,JSON.stringify(rows)]).then(r=>r.rows[0].result);
const count=async(table)=>Number((await db.query('select count(*) n from '+table)).rows[0].n);
const check=async(name,fn)=>{await fn();checks++;console.log('PASS '+name);};
try{
 await db.exec(`create role anon nologin;create role authenticated nologin;create role service_role nologin bypassrls;
 create schema pth_private;create table pth_private.pedido_consecutivos(proveedor text primary key,ultimo_numero bigint not null,actualizado_en timestamptz default now());alter table pth_private.pedido_consecutivos enable row level security;
 create table pedidos(id uuid primary key,fecha timestamptz default now(),gestor text,cliente text,ci text,telefono text,direccion text,municipio text,producto text,total numeric check(total>=0),costo_mensajeria numeric,comision_total numeric,proveedor text,estado text,pago_gestor text,origen text,orden_dia text,garantia_venta text,garantia_dias integer,submission_token text,subgestor_nombre text);
 create table pedidos_subgestores(id uuid primary key,created_at timestamptz default now(),subgestor_id uuid,subgestor_nombre text,parent_gestor_id uuid,parent_gestor_nombre text,cliente text,ci text,telefono text,direccion text,municipio text,producto text,total numeric check(total>=0),costo_mensajeria numeric,comision_total numeric,comision_subgestor numeric,proveedor text,estado text,orden_dia text,garantia_venta text,garantia_dias integer,submission_token text);
 create unique index on pedidos(submission_token,proveedor);create unique index on pedidos_subgestores(submission_token,proveedor);
 grant select,insert on pedidos,pedidos_subgestores to service_role;
 insert into pth_private.pedido_consecutivos values('RO',21,now());`);
 const sql=new URL('../supabase/proposals/atomic-order-numbering.sql',import.meta.url);
 await db.exec('create table tarifas_mensajeria(municipio text,localidad text,precio_pequeno numeric,precio_mediano numeric,precio_grande numeric);grant select,update on tarifas_mensajeria to service_role;');
 await db.exec(fs.readFileSync(new URL('../supabase/proposals/express-shipping.sql',import.meta.url),'utf8'));
 await check('express tariff requires both values and costs more than ordinary',async()=>{
  await db.exec("insert into tarifas_mensajeria(municipio,localidad,precio_pequeno) values('Fixture','Centro',6)");
  await assert.rejects(()=>db.exec('update tarifas_mensajeria set precio_expres_pequeno=10'));
  await assert.rejects(()=>db.exec('update tarifas_mensajeria set precio_expres_pequeno=6,minutos_expres_pequeno=60'));
  await db.exec('update tarifas_mensajeria set precio_expres_pequeno=10,minutos_expres_pequeno=60');
 });
 if(fs.existsSync(sql))await db.exec(fs.readFileSync(sql,'utf8'));
 await db.exec('set role service_role');
 await check('canonical insert assigns RO-22, ignores supplied number and preserves money',async()=>{
  const r=await call([row(1)]);assert.equal(r[0].orden_dia,'RO-22');
  const saved=(await db.query('select * from pedidos')).rows[0];assert.equal(Number(saved.total),53);assert.equal(Number(saved.comision_total),7);assert.equal(saved.id,id(1));
 });
 await check('retry returns same number without advancing the counter',async()=>{assert.equal((await call([row(1)]))[0].orden_dia,'RO-22');assert.equal(await count('pedidos'),1);assert.equal((await call([row(2)]))[0].orden_dia,'RO-23');});
 await check('multi-provider failure rolls back all rows and all counters',async()=>{
  await assert.rejects(()=>call([row(3,'AA',3),{...row(4,'RO',3),total:-1}]));assert.equal(await count('pedidos'),2);
  assert.equal(await count("pth_private.pedido_consecutivos where proveedor='AA'"),0);
  assert.equal((await call([row(5)]))[0].orden_dia,'RO-24');
 });
 await check('foreign-key identity collision and partial batches fail without overwriting',async()=>{
  await assert.rejects(()=>call([row(1,'RO',6)]));await assert.rejects(()=>call([row(1),row(7,'AA',1)]));assert.equal(await count('pedidos'),3);
 });
 await check('same counter is shared by principal and child; approved child replay retains number',async()=>{
  const child={...row(8),subgestor_id:id(90),subgestor_nombre:'Synthetic child',parent_gestor_id:id(91),parent_gestor_nombre:'Synthetic parent',comision_subgestor:3,estado:'Pendiente Aprobacion'};delete child.gestor;delete child.pago_gestor;
  const r=await call([child],'pedidos_subgestores');assert.equal(r[0].orden_dia,'RO-25');
  await db.exec('reset role');await db.query('insert into pedidos(id,submission_token,proveedor,orden_dia,total) values($1,$2,$3,$4,53)',[id(8),token(8),'RO','RO-25']);await db.query('delete from pedidos_subgestores where id=$1',[id(8)]);await db.exec('set role service_role');
  assert.equal((await call([child],'pedidos_subgestores'))[0].orden_dia,'RO-25');assert.equal((await call([row(9)]))[0].orden_dia,'RO-26');
 });
 await check('invalid tables, duplicated providers and mixed attempt keys cannot insert',async()=>{
  await assert.rejects(()=>call([row(10)],'gestores'));await assert.rejects(()=>call([row(10),row(11,'RO',10)]));await assert.rejects(()=>call([row(10),row(11,'AA')]));
 });
 await check('trimmed historical reference remains a floor, never gets reused',async()=>{
  await db.exec('reset role');await db.query('insert into pedidos(id,proveedor,orden_dia,total) values($1,$2,$3,53)',[id(40),'RO',' RO-50 ']);await db.exec('set role service_role');
  assert.equal((await call([row(41)]))[0].orden_dia,'RO-51');
 });
 await check('private RPC and counter are not accessible to public callers',async()=>{
  await db.exec('reset role');for(const role of ['anon','authenticated']){await db.exec('set role '+role);await assert.rejects(()=>call([row(10)]));await assert.rejects(()=>db.query('select * from pth_private.pedido_consecutivos'));await db.exec('reset role');}
 });
 await check('retiring early reservation returns an update error without consuming a number',async()=>{
  await db.exec(fs.readFileSync(new URL('../supabase/proposals/retire-early-order-reservations.sql',import.meta.url),'utf8'));
  await db.exec('grant execute on function reservar_consecutivo_pedido(text) to anon');
  await db.exec('set role anon');await assert.rejects(()=>db.query("select reservar_consecutivo_pedido('RO')"),/Actualiza la página/);await db.exec('reset role');
  assert.equal(Number((await db.query("select ultimo_numero from pth_private.pedido_consecutivos where proveedor='RO'")).rows[0].ultimo_numero),51);
 });
 await check('express rejects stale tariffs atomically; a current rate is stored once across providers',async()=>{
  const tariff=(await db.query('select to_jsonb(t) tariff from tarifas_mensajeria t')).rows[0].tariff;
  const rows=[{...row(60,'EX',60),costo_mensajeria:10},{...row(61,'EZ',60),costo_mensajeria:0}]
    .map(item=>({...item,servicio_mensajeria:'express',plazo_mensajeria_minutos:60}));
  const express=t=>db.query('select pth_insert_express_checkout($1,$2,$3)',['pedidos',JSON.stringify(rows),JSON.stringify(t)]);
  await db.exec('set role anon');await assert.rejects(()=>express(tariff),e=>e.code==='42501');await db.exec('set role service_role');
  await assert.rejects(()=>express({...tariff,minutos_expres_pequeno:90}),e=>e.code==='PT409');
  assert.equal(await count("pth_private.pedido_consecutivos where proveedor in ('EX','EZ')"),0);
  await express(tariff);await express(tariff);
  const saved=(await db.query("select servicio_mensajeria,plazo_mensajeria_minutos,costo_mensajeria from pedidos where proveedor in ('EX','EZ') order by proveedor")).rows;
  assert.deepEqual(saved.map(r=>[r.servicio_mensajeria,r.plazo_mensajeria_minutos,Number(r.costo_mensajeria)]),[['express',60,10],['express',60,0]]);
 });
 console.log(checks+' SQL checks passed; native multi-connection concurrency is a separate release gate.');
}finally{await db.close();}
