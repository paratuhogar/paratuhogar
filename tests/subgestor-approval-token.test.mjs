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

// Approval moved to a service-only transaction. Token/snapshot preservation,
// rollback and idempotence are exercised against PostgreSQL in the SQL script.
for(const tokenValue of [null,'legacy-submission','pthn1.forged'])test('old approval route cannot bypass review with token '+tokenValue,async()=>{
 const {f,pending,payload,approve}=await pendingFixture();
 pending.submission_token=tokenValue;payload.values[0].submission_token=tokenValue;
 const before=structuredClone(pending);
 for(const token of [parentToken,childToken,otherToken,null]){
  const reply=await approve(payload,token);assert.ok(reply.error);assert.equal(f.writes,1);
 }
 assert.deepEqual(pending,before);assert.equal(f.rows.pedidos.length,1);
});

test('reserved checkout tokens still cannot enter through generic order creation',async()=>{
 for(const table of ['pedidos','pedidos_subgestores']){
  const f=await fixture();const result=await f.request({action:'query',table,op:'insert',values:{...f.body.inputs[0],submission_token:'pthn1.forged',_approval_id:'forged'}});
  assert.ok(result.error);assert.equal(f.writes,0);
 }
});

test('updated parent control sends only saved ID/version and retains voucher amounts',async()=>{
 const {f,pending}=await pendingFixture();pending.review_version='a'.repeat(32);
 const html=await readFile(new URL('../subgestores.html',import.meta.url),'utf8');
 const start=html.indexOf('async function aprobarPedido(pedidoId)');
 const source=html.slice(start,html.indexOf('async function rechazarPedido',start));
 const sent=[],vouchers=[],alerts=[];let reloads=0;
 const secure={token:()=> 'unchanged',reviewSubgestor:async body=>{sent.push(body);return {data:{id:pending.id},error:null};}};
 const context={parentReviewBusy:false,pedidosPendientes:[pending],confirm:()=>true,alert:m=>alerts.push(m),openSubgestorVoucher:p=>vouchers.push(p),loadData:async()=>reloads++,window:{PTHSecureData:secure}};
 vm.runInNewContext(source+'; globalThis.approve=aprobarPedido;',context);
 await context.approve(pending.id);
 assert.equal(sent.length,1);assert.equal(sent[0].operation,'approve');assert.equal(sent[0].id,pending.id);assert.equal(sent[0].expected,pending.review_version);
 assert.equal('total' in sent[0],false);assert.equal('comision_total' in sent[0],false);assert.equal(vouchers[0].comision_total,pending.comision_total);assert.equal(reloads,1);
});
