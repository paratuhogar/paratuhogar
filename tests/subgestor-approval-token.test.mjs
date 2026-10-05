import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {hash} from '../supabase/functions/secure-data/handler.mjs';
import {fixture} from './fixtures/new-checkout.mjs';

// Real gateway + checkout signer; all DB rows and bearer sessions are synthetic.
const parentToken='a'.repeat(64),childToken='c'.repeat(64),otherToken='b'.repeat(64);
async function pendingFixture(){
 const f=await fixture();
 const parent=f.rows.gestores[0];
 const child={...parent,id:'child',nombre:'Synthetic Child',parent_id:parent.id};
 f.rows.gestores.push(child);
 for(const [token,actor] of [[childToken,child],[otherToken,f.rows.gestores[1]]])f.rows.pth_secure_sessions.push({token_hash:await hash(token),gestor_id:actor.id,credential_hash:await hash(actor.password),expires_at:'2099-01-01'});
 const body={...structuredClone(f.body),table:'pedidos_subgestores'};
 for(const input of body.inputs){delete input.gestor;input.subgestor_id=child.id;}
 const quote=await f.request({...body,operation:'quote'},childToken);
 assert.equal(quote.error,null);
 const submitted=await f.request({...body,operation:'submit',attempt:quote.data.attempt,quote:quote.data.quote},childToken);
 assert.equal(submitted.error,null);assert.equal(submitted.data.complete,true);
 const pending=f.rows.pedidos_subgestores[0];
 const payload={action:'query',table:'pedidos',op:'insert',returning:true,values:[{id:pending.id,gestor:parent.nombre,subgestor_nombre:pending.subgestor_nombre,submission_token:pending.submission_token}]};
 return {f,pending,payload,body,approve:(input=payload,token=parentToken)=>f.request(input,token)};
}

test('parent approves a signed new child checkout while preserving its server snapshot and receipt',async()=>{
 const {f,pending,approve}=await pendingFixture();
 const before=structuredClone(pending);const result=await approve();
 assert.equal(result.error,null);assert.equal(f.writes,2);
 const order=f.rows.pedidos.find(row=>row.id===pending.id);
 for(const field of ['submission_token','proveedor','cliente','telefono','ci','direccion','municipio','producto','total','costo_mensajeria','comision_total','comision_subgestor','orden_dia','garantia_venta','garantia_dias','subgestor_nombre'])assert.deepEqual(order[field],before[field],field);
 assert.equal(order.gestor,before.parent_gestor_nombre);assert.equal(order.estado,'Pendiente');assert.equal(order.pago_gestor,'Pendiente');assert.equal(order.pago_subgestor,'Pendiente');
 assert.equal(order.comision_parent,Number(before.comision_total)-Number(before.comision_subgestor));
 assert.deepEqual(f.rows.pedidos_subgestores[0],before);assert.deepEqual(f.rows.pedidos[0],f.historical);
 const receipt=await f.request({action:'checkout',operation:'receipt',attempt:before.submission_token},null);assert.equal(receipt.data.complete,true);
});

test('other same-name principal, child and anonymous callers cannot approve even with exact ID and token',async()=>{
 for(const token of [otherToken,childToken,null]){
  const {f,approve}=await pendingFixture();const result=await approve(undefined,token);
  assert.ok(result.error);assert.equal(f.writes,1);assert.equal(f.rows.pedidos.length,1);
 }
});

test('approval rejects missing, unrelated or tampered tokens after the authorized queue lookup',async()=>{
 for(const mutation of [row=>delete row.submission_token,row=>row.submission_token='pthn1.unrelated',row=>row.submission_token+='x',row=>row.submission_token='legacy-other',row=>row.submission_token=null]){
  const {f,payload,approve}=await pendingFixture();mutation(payload.values[0]);
  const result=await approve();assert.ok(result.error);assert.match(result.error.message,/clave del pedido/);
  assert.equal(f.writes,1);assert.ok(f.trace.some(t=>t.table==='pedidos_subgestores'&&t.op==='select'));
 }
});

test('client approval marker cannot admit a reserved token through either generic creation route',async()=>{
 for(const table of ['pedidos','pedidos_subgestores']){
  const f=await fixture();const result=await f.request({action:'query',table,op:'insert',values:{...f.body.inputs[0],submission_token:'pthn1.forged',_approval_id:'forged'}});
  assert.ok(result.error);assert.equal(result.error.message,'Usa la confirmación de pedidos nuevos para esta clave.');assert.equal(f.writes,0);
  assert.equal(f.trace.some(t=>t.table==='productos'),false);
 }
});

test('an approval payload cannot change the saved financial, customer, seller or lifecycle fields',async()=>{
 const {f,pending,payload,approve}=await pendingFixture();
 Object.assign(payload.values[0],{gestor:'Forged',subgestor_nombre:'Forged',parent_gestor_id:'other',cliente:'Forged',telefono:'Forged',producto:'Forged',total:1,comision_total:999,comision_subgestor:999,comision_parent:999,estado:'Entregado',pago_gestor:'Pagado',pago_subgestor:'Pagado',proveedor:'Forged',_approval_id:'forged'});
 const result=await approve();assert.equal(result.error,null);
 const order=f.rows.pedidos.find(row=>row.id===pending.id);
 assert.equal(order.gestor,pending.parent_gestor_nombre);assert.equal(order.cliente,pending.cliente);assert.equal(order.total,pending.total);assert.equal(order.comision_total,pending.comision_total);assert.equal(order.subgestor_nombre,pending.subgestor_nombre);assert.equal(order.proveedor,pending.proveedor);assert.equal(order.estado,'Pendiente');assert.equal(order.pago_gestor,'Pendiente');
 assert.equal('_approval_id' in order,false);assert.equal('parent_gestor_id' in order,false);
});

test('nonpending or removed queue rows cannot create another approved order',async()=>{
 for(const state of ['Aprobado','Cancelado','Entregado',null]){
  const {f,pending,approve}=await pendingFixture();pending.estado=state;const result=await approve();assert.ok(result.error);assert.equal(f.writes,1);
 }
 const {f,pending,approve}=await pendingFixture();assert.equal((await approve()).error,null);
 f.rows.pedidos_subgestores=f.rows.pedidos_subgestores.filter(row=>row.id!==pending.id);
 const result=await approve();assert.ok(result.error);assert.equal(f.writes,2);assert.equal(f.rows.pedidos.filter(row=>row.id===pending.id).length,1);
});

test('concurrent retries and sequential double clicks are fenced by existing primary key and token uniqueness',async()=>{
 const {f,pending,approve}=await pendingFixture();
 const results=await Promise.all([approve(),approve()]);
 assert.equal(results.filter(r=>r.error===null).length,1);assert.equal(results.filter(r=>r.error?.code==='23505').length,1);
 assert.equal((await approve()).error.code,'23505');assert.equal(f.writes,2);assert.equal(f.rows.pedidos.filter(row=>row.id===pending.id).length,1);
 assert.equal(f.trace.some(t=>['upsert','update','delete'].includes(t.op)),false);
});

test('insert failure preserves the queue; lost response never permits a second order on retry',async()=>{
 const {f,pending,approve}=await pendingFixture();const before=structuredClone(pending);
 f.failInsert=true;assert.ok((await approve()).error);assert.equal(f.writes,1);assert.deepEqual(pending,before);
 f.failInsert=false;f.drop=true;assert.ok((await approve()).error);assert.equal(f.writes,2);assert.deepEqual(pending,before);
 f.drop=false;assert.equal((await approve()).error.code,'23505');assert.equal(f.writes,2);assert.equal(f.rows.pedidos.filter(row=>row.id===pending.id).length,1);
});

for(const token of [null,'legacy-submission'])test(`legacy queue approval preserves its exact stored token (${token})`,async()=>{
 const {f,pending,payload,approve}=await pendingFixture();pending.submission_token=token;payload.values[0].submission_token=token;
 const result=await approve();assert.equal(result.error,null);assert.equal(f.rows.pedidos.find(row=>row.id===pending.id).submission_token,token);
});

test('a different valid signed child attempt is not authority to approve a saved queue row',async()=>{
 const {f,payload,body,approve}=await pendingFixture();
 const other=await f.request({...body,operation:'quote',intentId:'e'.repeat(64)},childToken);assert.equal(other.error,null);
 assert.notEqual(other.data.attempt,payload.values[0].submission_token);payload.values[0].submission_token=other.data.attempt;
 const result=await approve();assert.match(result.error.message,/clave del pedido/);assert.equal(f.writes,1);
});

test('the unchanged panel sends its exact approval payload through the fixed gateway without a client marker',async()=>{
 const {f,pending}=await pendingFixture();
 const html=await readFile(new URL('../subgestores.html',import.meta.url),'utf8');
 const start=html.indexOf('async function aprobarPedido(pedidoId)');
 const source=html.slice(start,html.indexOf('async function rechazarPedido',start));
 assert.ok(start>=0);
 const alerts=[],vouchers=[],sent=[];let reloads=0,removals=0;
 const context={pedidosPendientes:[pending],currentParent:f.rows.gestores[0],confirm:()=>true,alert:message=>alerts.push(message),openSubgestorVoucher:row=>vouchers.push(row),loadData:()=>reloads++,supabaseClient:{from:table=>({
  insert:values=>{sent.push(values);return f.request({action:'query',table,op:'insert',values});},
  // Cleanup is stubbed: this test verifies the real panel payload and gateway insert, not a DB transaction.
  delete:()=>({eq:async(column,value)=>{assert.equal(table,'pedidos_subgestores');assert.equal(column,'id');assert.equal(value,pending.id);removals++;return {error:null};}})
 })}};
 vm.runInNewContext(source+'; globalThis.approve=aprobarPedido;',context);
 await context.approve(pending.id);
 assert.equal(sent[0][0].submission_token,pending.submission_token);assert.equal('_approval_id' in sent[0][0],false);
 assert.equal(f.rows.pedidos.filter(row=>row.id===pending.id).length,1);assert.equal(vouchers.length,1);assert.equal(removals,1);assert.equal(reloads,1);
 assert.match(alerts[0],/Pedido aprobado/);
});
