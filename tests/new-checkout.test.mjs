import test from 'node:test';
import assert from 'node:assert/strict';
import {createCheckoutService,deliveryCost} from '../supabase/functions/secure-data/checkout.mjs';
import {fixture} from './fixtures/new-checkout.mjs';
const secret='synthetic-only-signing-material-not-a-production-secret';
test('new quote and atomic multi-provider insertion preserve historical data and existing commission rules',async()=>{
 const f=await fixture(),q=await f.quote();assert.equal(q.error,null);assert.deepEqual(q.data.terms.map(t=>t.total),[106,200]);assert.equal(q.data.attempt.includes('Synthetic Customer'),false);
 const r=await f.submit(q);assert.equal(r.data.complete,true);assert.equal(f.writes,1);assert.equal(f.rows.pedidos.length,3);assert.deepEqual(f.rows.pedidos[0],f.historical);assert.deepEqual(f.rows.pedidos.slice(1).map(r=>r.comision_total),[10,20]);assert.equal(f.trace.some(t=>['update','delete','upsert'].includes(t.op)),false);
});
test('concurrent tabs with the same draft mint the same capability and insert only one atomic batch',async()=>{
 const f=await fixture();const [a,b]=await Promise.all([f.quote(),f.quote()]);assert.equal(a.data.attempt,b.data.attempt);const results=await Promise.all([f.submit(a),f.submit(b)]);assert.ok(results.every(r=>r.data?.complete));assert.equal(f.writes,1);assert.equal(f.rows.pedidos.length,3);
});
test('lost write response is recovered without session and never retried into duplicate orders',async()=>{
 const f=await fixture(),q=await f.quote();f.drop=true;const r=await f.submit(q);assert.equal(r.error.code,'ORDER_OUTCOME_UNKNOWN');const recovered=await f.request({action:'checkout',operation:'receipt',attempt:q.data.attempt},'expired-invalid-session');assert.equal(recovered.data.complete,true);assert.deepEqual(Object.keys(recovered.data).sort(),['complete','confirmed']);assert.doesNotMatch(JSON.stringify(recovered),/Historical|Synthetic Customer|telefono|cliente|direccion|comision|total|pago/);f.drop=false;assert.equal((await f.submit(q)).data.complete,true);assert.equal(f.writes,1);
});
test('delivery changes and price changes after quote stop all writes until explicit fresh confirmation',async()=>{
 for(const change of ['delivery','price']){const f=await fixture(),q=await f.quote();if(change==='delivery'){f.rows.productos[0].proveedor='Other';}else f.rows.productos[0].precio=120;const r=await f.submit(q);assert.ok(['CONDITIONS_CHANGED','PRODUCT_UNAVAILABLE'].includes(r.error.code));assert.equal(f.writes,0);}
 const f=await fixture();f.rows.productos[0].proveedor='Normal';f.body.inputs[0].proveedor='Normal';const q=await f.quote();f.rows.tarifas_mensajeria[0].precio_pequeno=9;assert.equal((await f.submit(q)).error.code,'CONDITIONS_CHANGED');assert.equal(f.writes,0);const fresh=await f.request({...f.body,operation:'quote',attempt:q.data.attempt});assert.equal(fresh.data.attempt,q.data.attempt);assert.equal((await f.submit(fresh)).data.complete,true);
});
test('unavailable products, duplicate tariffs and failed batch insertion do not write a partial checkout',async()=>{
 const f=await fixture();f.rows.productos[1].disponible='NO';assert.equal((await f.quote()).error.code,'PRODUCT_UNAVAILABLE');assert.equal(f.writes,0);f.rows.productos[1].disponible='SI';f.rows.tarifas_mensajeria.push({...f.rows.tarifas_mensajeria[0]});assert.equal((await f.quote()).error.code,'DELIVERY_UNAVAILABLE');f.rows.tarifas_mensajeria.pop();const q=await f.quote();f.failInsert=true;assert.equal((await f.submit(q)).error.code,'ORDER_OUTCOME_UNKNOWN');assert.equal(f.rows.pedidos.length,1);
});
test('attempt reuse binds customer, products, delivery and actor; changed-payload races are fenced by new-row primary keys',async()=>{
 const f=await fixture(),q=await f.quote();for(const update of [b=>b.inputs[0].cliente='Different',b=>b.inputs[0]._lineas[0].cantidad=2,b=>b.delivery.localidad='Different']){const b=structuredClone(f.body);update(b);assert.equal((await f.request({...b,operation:'quote',attempt:q.data.attempt})).error.code,'PAYLOAD_CHANGED');}
 assert.equal((await f.request({...f.body,operation:'quote',attempt:q.data.attempt},null)).error.code,'SESSION_CHANGED');
 const different=structuredClone(f.body);different.inputs[0].cliente='Another Customer';const q2=await f.request({...different,operation:'quote'});const results=await Promise.all([f.submit(q),f.request({...different,operation:'submit',attempt:q2.data.attempt,quote:q2.data.quote})]);assert.equal(results.filter(r=>r.data?.complete).length,1);assert.equal(f.writes,1);assert.equal(f.rows.pedidos.length,3);
});
test('forged, legacy and expired keys cannot enumerate old orders; reserved new prefix cannot bypass the endpoint',async()=>{
 const f=await fixture(),q=await f.quote();for(const key of ['legacy-key',q.data.attempt.slice(0,-1)+'x','pthn1.fake']){assert.equal((await f.request({action:'checkout',operation:'receipt',attempt:key},null)).error.code,'ATTEMPT_INVALID');}
 const bypass=await f.request({action:'query',table:'pedidos',op:'insert',values:{...f.body.inputs[0],submission_token:q.data.attempt}});assert.ok(bypass.error);assert.equal(f.writes,0);
 let now=f.body.intentCreatedAt;const service=createCheckoutService({db:{from(){throw Error('must not query expired attempts');}},canonicalSale(){},signingSecret:secret,now:()=>now+8*86400000});assert.equal((await service({operation:'receipt',attempt:q.data.attempt},null)).error.code,'ATTEMPT_EXPIRED');assert.deepEqual(f.rows.pedidos[0],f.historical);
});
test('existing delivery rules retain supplier A exceptions, size classes, quantity surcharge and pickup',()=>{
 const p={nombre:'Aspiradora',proveedor:'A','tamaño_envio':'Pequeño'},d={pickup:false,municipio:'Playa'},tariff={precio_pequeno:6,precio_grande:10};assert.equal(deliveryCost([p],[{cantidad:1}],d,tariff),10);assert.equal(deliveryCost([p],[{cantidad:4}],d,tariff),15);assert.equal(deliveryCost([{...p,'tamaño_envio':'Grande'}],[{cantidad:1}],d,tariff),10);assert.equal(deliveryCost([p],[{cantidad:1}],{pickup:true}),0);
});
test('new public, admin and child paths preserve their existing canonical commission accounting',async()=>{
 for(const role of ['public','admin','child']){
  const f=await fixture();let auth='a'.repeat(64);
  if(role==='public'){auth=null;for(const row of f.body.inputs)row.gestor='Venta Directa';}
  if(role==='admin')f.rows.gestores[0].rol='admin';
  if(role==='child'){
   f.rows.gestores[0].parent_id='parent';f.rows.gestores.push({...f.rows.gestores[0],id:'parent',nombre:'Parent',parent_id:null});f.body.table='pedidos_subgestores';
   for(const row of f.body.inputs){delete row.gestor;row.subgestor_id='actor-a';}
   f.rows.precios_personalizados=f.rows.productos.map(p=>({gestor:'Parent',producto_id:p.id,comision_subgestor:3,visible_subgestor:true}));
  }
  const q=await f.request({...f.body,operation:'quote'},auth);assert.equal(q.error,null,role);const r=await f.request({...f.body,operation:'submit',attempt:q.data.attempt,quote:q.data.quote},auth);assert.equal(r.data?.complete,true,role);
  const rows=(role==='child'?f.rows.pedidos_subgestores:f.rows.pedidos.slice(1));assert.deepEqual(rows.map(r=>r.comision_total),role==='public'?[0,0]:[10,20]);
  if(role==='child'){assert.deepEqual(rows.map(r=>r.comision_subgestor),[3,3]);assert.ok(rows.every(r=>r.parent_gestor_id==='parent'&&r.estado==='Pendiente Aprobacion'));}
  assert.deepEqual(f.rows.pedidos[0],f.historical);
 }
});
