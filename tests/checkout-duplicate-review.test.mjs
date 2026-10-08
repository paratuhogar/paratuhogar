import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from './fixtures/new-checkout.mjs';

async function sold() {
  const f=await fixture();
  for(const row of f.body.inputs){row.telefono='51112233';row.ci='90010112345';}
  const q=await f.quote(); assert.equal((await f.submit(q)).data.complete,true);
  const body=structuredClone(f.body);body.intentId='c'.repeat(64);
  return {f,body};
}
test('another device needs explicit review before repeating the same recent sale',async()=>{
  const {f,body}=await sold();body.inputs.forEach(row=>row.telefono='+53 5 1112233');
  const q=await f.request({...body,operation:'quote'});
  assert.ok(Array.isArray(q.data.duplicates),'quote must report possible repeats');
  assert.deepEqual(q.data.duplicates.map(x=>x.reference),['A00001','B00001']);
  assert.equal(typeof q.data.duplicateReview,'string');
  const r=await f.request({...body,operation:'submit',attempt:q.data.attempt,quote:q.data.quote});
  assert.equal(r.error.code,'POSSIBLE_DUPLICATE');assert.equal(f.writes,1);
});
test('reviewed distinct purchase is allowed without modifying or merging the prior sale',async()=>{
  const {f,body}=await sold();const before=structuredClone(f.rows.pedidos);
  const q=await f.request({...body,operation:'quote'});
  assert.ok(q.data.duplicateReview);
  const r=await f.request({...body,operation:'submit',attempt:q.data.attempt,quote:q.data.quote,duplicateReview:q.data.duplicateReview});
  assert.equal(r.data.complete,true);assert.equal(f.writes,2);assert.deepEqual(f.rows.pedidos.slice(0,3),before);
});
test('same intent recovers its receipt without a duplicate warning',async()=>{
  const {f}=await sold();const q=await f.quote();assert.equal(q.data.complete,true);assert.equal(q.data.duplicates,undefined);assert.equal(f.writes,1);
});
test('cancelled orders and another seller cannot cause a warning or expose a reference',async()=>{
  for(const change of ['cancelled','seller']){
    const {f,body}=await sold();for(const r of f.rows.pedidos.slice(1)){if(change==='cancelled')r.estado='Cancelado';else r.gestor='Other Seller';}
    const q=await f.request({...body,operation:'quote'});assert.deepEqual(q.data.duplicates,[]);
    assert.equal((await f.request({...body,operation:'submit',attempt:q.data.attempt,quote:q.data.quote})).data.complete,true);
  }
});
test('review proof is bound to this attempt and rejects a new unreviewed matching sale',async()=>{
  const {f,body}=await sold();const q=await f.request({...body,operation:'quote'});assert.ok(q.data.duplicateReview);
  f.rows.pedidos.push({...f.rows.pedidos[1],id:'third-sale',orden_dia:'A00002'});
  const fresh=await f.request({...body,operation:'quote',attempt:q.data.attempt});
  const r=await f.request({...body,operation:'submit',attempt:fresh.data.attempt,quote:fresh.data.quote,duplicateReview:q.data.duplicateReview});
  assert.equal(r.error.code,'POSSIBLE_DUPLICATE');assert.equal(f.writes,1);
});
test('another actor with the same seller name cannot see signed references',async()=>{
  const {f,body}=await sold();
  f.rows.gestores[0].id='different-actor';f.rows.pth_secure_sessions[0].gestor_id='different-actor';
  const q=await f.request({...body,operation:'quote'});
  assert.equal(q.error,null);assert.deepEqual(q.data.duplicates,[]);
});
test('a child cannot see another principal network or same-named sibling references',async()=>{
  const {f}=await sold();
  const parent={...f.rows.gestores[0],id:'parent-a',nombre:'Parent A'};f.rows.gestores.push(parent);
  f.rows.gestores[0].parent_id=parent.id;
  const body=structuredClone(f.body);body.table='pedidos_subgestores';body.intentId='d'.repeat(64);
  body.inputs.forEach(row=>{row.subgestor_id='actor-a';row.gestor=parent.nombre;});
  for(const row of f.rows.pedidos.slice(1)){row.gestor='Different Parent';row.subgestor_nombre='Shared Seller';}
  const q=await f.request({...body,operation:'quote'});assert.equal(q.error,null);assert.deepEqual(q.data.duplicates,[]);
  // Matching names inside the same network are not proof of the initiating ID.
  for(const row of f.rows.pedidos.slice(1))row.gestor=parent.nombre;
  f.rows.gestores[0].id='same-name-sibling';f.rows.pth_secure_sessions[0].gestor_id='same-name-sibling';
  body.inputs.forEach(row=>row.subgestor_id='same-name-sibling');
  const sibling=await f.request({...body,operation:'quote'});assert.equal(sibling.error,null);assert.deepEqual(sibling.data.duplicates,[]);
});
test('a child still reviews its own approved signed sale',async()=>{
  const f=await fixture();const parent={...f.rows.gestores[0],id:'parent-a',nombre:'Parent A'};
  f.rows.gestores.push(parent);f.rows.gestores[0].parent_id=parent.id;
  f.body.table='pedidos_subgestores';f.body.inputs.forEach(row=>{row.subgestor_id='actor-a';row.gestor=parent.nombre;row.telefono='51112233';});
  const initial=await f.quote();assert.equal(initial.error,null);assert.equal((await f.submit(initial)).data.complete,true);
  // Approval carries the signed attempt unchanged into the existing table.
  f.rows.pedidos.push(...f.rows.pedidos_subgestores.map(row=>({...row,gestor:parent.nombre,estado:'Pendiente'})));f.rows.pedidos_subgestores.length=0;
  const body=structuredClone(f.body);body.intentId='e'.repeat(64);
  const q=await f.request({...body,operation:'quote'});assert.equal(q.error,null);assert.deepEqual(q.data.duplicates.map(r=>r.reference),['A00001','B00001']);
});
test('oversized recent lookup fails safely instead of assuming there are no duplicates',async()=>{
  const {f,body}=await sold();
  for(let i=0;i<201;i++)f.rows.pedidos.push({...f.rows.pedidos[1],id:'extra-'+i,orden_dia:'EXTRA-'+i});
  const q=await f.request({...body,operation:'quote'});assert.equal(q.error.code,'DUPLICATE_CHECK_UNAVAILABLE');assert.equal(f.writes,1);
});
