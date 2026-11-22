// Native, disposable PostgreSQL. Never connects to Supabase or uses Docker.
const {before, after, test} = require('node:test');
const assert = require('node:assert/strict');
const {randomUUID} = require('node:crypto');
const {readFileSync} = require('node:fs');
const path = require('node:path');
const {startPointsPostgres} = require('./helpers/points-postgres.cjs');
const migration = readFileSync(path.join(__dirname, '../supabase/migrations/20261122175858_points_referral_sales_only.sql'), 'utf8');
let db, historical;
async function world() {
 const w={admin:randomUUID(),parent:randomUUID(),child:randomUUID(),product:randomUUID()};
 for(const role of ['admin','parent','child'])await db.query('insert into gestores(id,nombre,rol,parent_id) values($1,$2,$3,$4)',[w[role],role+'-'+w[role],role==='admin'?'admin':'gestor',role==='child'?w.parent:null]);
 await db.query('insert into productos(id,nombre,"tamaño_envio") values($1,\'Equipo\',\'Mediano\')',[w.product]);
 return w;
}
function sale(w, {channel='referral_link',child=false}={}) {
 const id=randomUUID(), row={id,submission_token:'pthn2.1795348800000.p.1.'+randomUUID()+'.actor.payload.providers.signature',proveedor:'REF',cliente:'Cliente sintético',telefono:'55555555',ci:'11111111111',direccion:'Dirección',municipio:'Municipio',producto:'Equipo',total:100,costo_mensajeria:0,comision_total:10,estado:child?'Pendiente Aprobacion':'Pendiente',
  ...(child?{subgestor_id:w.child,subgestor_nombre:'child-'+w.child,parent_gestor_id:w.parent,parent_gestor_nombre:'parent-'+w.parent,comision_subgestor:3}:{gestor:'parent-'+w.parent,origen:'Manual (Panel)'})};
 const capture={pedido_id:id,beneficiary_id:child?w.child:w.parent,lines:[{producto_id:w.product,cantidad:1}]};
 if(channel!==null)capture.sales_channel=channel;
 return {table:child?'pedidos_subgestores':'pedidos',row,capture};
}
const insert=s=>db.service('select public.pth_insert_checkout_points($1,$2,$3) value',[s.table,JSON.stringify([s.row]),JSON.stringify([s.capture])]).then(r=>r.rows[0].value);
const eligible=s=>db.service(`update ${s.table} set estado='Entregado',estado_financiero='Conciliado_Prov' where id=$1`,[s.row.id]);
const wallet=(w,id=w.parent)=>db.service("select public.pth_points_wallet($1,'summary',$2) value",[w.admin,{beneficiaryId:id}]).then(r=>r.rows[0].value);
before(async()=>{
 db=await startPointsPostgres({referralOnly:false});
 await db.query('update pth_points.config set enabled=true,started_at=clock_timestamp()');
 const w=await world(), earned=sale(w,{channel:null}), pending=sale(w,{channel:null}), issue=sale(w,{channel:null});
 await insert(earned);await eligible(earned);await insert(pending);
 await db.service('select public.pth_insert_checkout($1,$2)',[issue.table,JSON.stringify([issue.row])]);await eligible(issue);
 const snapshots=(await db.query('select to_jsonb(c) value from pth_points.captures c order by id')).rows;
 historical={w,earned,pending,issue,snapshots};
 await db.query(migration);
});
after(async()=>{await db?.stop();});

for(const child of [false,true])test(`new manual ${child?'child':'principal'} orders create no pending points or issue even when fulfilled`,async()=>{
 const w=await world(),s=sale(w,{channel:'manual',child});
 const receipt=await insert(s);assert.match(receipt[0].orden_dia,/^REF-\d+$/);
 assert.equal((await wallet(w,child?w.child:w.parent)).pending,0);
 await eligible(s);
 const result=await wallet(w,child?w.child:w.parent);assert.equal(result.balance,0);assert.deepEqual(result.movements,[]);
 assert.equal((await db.query('select count(*) n from pth_points.captures where order_id=$1',[s.row.id])).rows[0].n,'0');
 assert.equal((await db.query(`select total,comision_total from ${s.table} where id=$1`,[s.row.id])).rows[0].total,'100');
});

test('unknown, missing and non-string channel metadata fails closed without failing order creation',async()=>{
 const w=await world();
 for(const channel of [null,'direct','REFERRAL_LINK',true,{},'']){
  const s=sale(w,{channel});await insert(s);await eligible(s);
  assert.equal((await db.query('select count(*) n from pth_points.captures where order_id=$1',[s.row.id])).rows[0].n,'0');
 }
 const s=sale(w);await db.service('select public.pth_insert_checkout($1,$2)',[s.table,JSON.stringify([s.row])]);await eligible(s);
 assert.equal((await wallet(w)).balance,0);assert.equal((await wallet(w)).pending,0);
});

test('a manual receipt cannot be recaptured as referral by a later retry',async()=>{
 const w=await world(),s=sale(w,{channel:'manual'});await insert(s);await eligible(s);
 s.capture.sales_channel='referral_link';await insert(s);
 assert.equal((await wallet(w)).balance,0);assert.equal((await wallet(w)).pending,0);
 assert.equal((await db.query('select count(*) n from pth_points.captures where order_id=$1',[s.row.id])).rows[0].n,'0');
});

test('a referred child keeps its points through approval and concurrent delivery and reconciliation',async()=>{
 const w=await world(),s=sale(w,{child:true});
 await Promise.all(Array.from({length:6},()=>insert(s)));
 assert.equal((await wallet(w,w.child)).pending,2);
 const version=(await db.query('select md5(to_jsonb(s)::text) version from pedidos_subgestores s where id=$1',[s.row.id])).rows[0].version;
 await db.service("select public.pth_review_subgestor($1,'approve',$2,$3)",[w.admin,s.row.id,version]);s.table='pedidos';
 await Promise.all(Array.from({length:6},()=>eligible(s)));
 assert.equal((await wallet(w,w.child)).balance,2);assert.equal((await wallet(w,w.child)).movements.length,1);
 assert.equal((await wallet(w)).balance,0);
 await db.service("update pedidos set estado='Devuelto' where id=$1",[s.row.id]);assert.equal((await wallet(w,w.child)).balance,0);
 await eligible(s);assert.equal((await wallet(w,w.child)).balance,2);
});

test('cutover preserves earned, pending and unresolved legacy captures without rewriting their snapshots',async()=>{
 const {w,earned,pending,issue,snapshots}=historical;
 assert.deepEqual((await db.query('select to_jsonb(c) value from pth_points.captures c where beneficiary_id=$1 or order_id=$2 order by id',[w.parent,issue.row.id])).rows,snapshots);
 assert.equal((await wallet(w)).balance,2);assert.equal((await wallet(w)).pending,2);
 await eligible(pending);assert.equal((await wallet(w)).balance,4,'a pre-cutover obligation remains eligible');
 const retry=structuredClone(earned);retry.capture.sales_channel='manual';
 const receipt=await insert(retry);assert.equal(receipt[0].id,earned.row.id);
 const capture=(await db.query('select request_snapshot from pth_points.captures where order_id=$1',[earned.row.id])).rows[0].request_snapshot;
 assert.equal(Object.hasOwn(capture,'sales_channel'),false,'a retry never upgrades or rewrites historical origin');
 const issueId=(await db.query('select id from pth_points.captures where order_id=$1',[issue.row.id])).rows[0].id;
 await db.service("select public.pth_points_wallet($1,'grant',$2)",[w.admin,{beneficiaryId:w.parent,captureId:issueId,points:5,reason:'Incidencia anterior verificada',idempotencyKey:randomUUID()}]);
 assert.equal((await wallet(w)).balance,9);
});

test('standalone admin recognitions remain available while recorded referral origins cannot be changed by retry',async()=>{
 const w=await world(),s=sale(w);await insert(s);await eligible(s);
 const changed=structuredClone(s);changed.capture.sales_channel='manual';
 await assert.rejects(insert(changed),/captura|coincide/i);
 const key=randomUUID(),body={beneficiaryId:w.parent,points:7,reason:'Reto de vídeos verificado',idempotencyKey:key};
 await Promise.all(Array.from({length:5},()=>db.service("select public.pth_points_wallet($1,'grant',$2)",[w.admin,body])));
 assert.equal((await wallet(w)).balance,9);assert.equal((await wallet(w)).movements.length,2);
 for(const role of ['anon','authenticated']){
  const grants=await db.query("select has_function_privilege($1,'public.pth_insert_checkout_points(text,jsonb,jsonb,jsonb)','execute') allowed",[role]);
  assert.equal(grants.rows[0].allowed,false);
 }
});
