import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from './fixtures/new-checkout.mjs';
import {createHandler} from '../supabase/functions/secure-data/handler.mjs';

const own='11111111-1111-4111-8111-111111111111',other='22222222-2222-4222-8222-222222222222',key='f'.repeat(64);
async function setup({role='gestor',parent=null,enabled=false}={}){
 const f=await fixture();f.rows.gestores[0].id=own;f.rows.gestores[0].rol=role;f.rows.gestores[0].parent_id=parent;f.rows.pth_secure_sessions[0].gestor_id=own;
 f.rows.gestores[1]={...f.rows.gestores[0],id:other,nombre:'Other principal',parent_id:null,rol:'gestor'};
 const original=f.db.rpc;const calls=[];let rpcError=false;
 f.db.rpc=async(name,args)=>{
  if(name==='pth_points_wallet'){calls.push({name,args:structuredClone(args)});return rpcError?{data:null,error:{code:'XX000',message:'private financial SQL'}}:{data:{beneficiary:{id:args.p_body.beneficiaryId||own,name:'Synthetic'},enabled:false,startedAt:null,balance:0,pending:0,reversed:0,movements:[],nextOffset:null},error:null};}
  if(name==='pth_insert_checkout_points'){calls.push({name,args:structuredClone(args)});return rpcError?{data:null,error:{code:'XX000'}}:original(args.p_tariff?'pth_insert_express_checkout':'pth_insert_checkout',args);}
  return original(name,args);
 };
 const handler=createHandler({db:f.db,checkoutSecret:'synthetic-points-secret',pointsEnabled:enabled});
 const request=async(body,token='a'.repeat(64))=>{
  const r=await handler(new Request('https://example.test',{method:'POST',headers:token?{Authorization:'Bearer '+token}:{},body:JSON.stringify(body)}));return {status:r.status,...await r.json()};
 };
 return {f,calls,request,set fail(value){rpcError=value;}};
}

test('points summary uses the verified actor and returns the scoped result',async()=>{
 const s=await setup(),r=await s.request({action:'points_wallet',operation:'summary'});
 assert.equal(r.status,200);assert.equal(r.data.beneficiary.id,own);
 assert.deepEqual(s.calls[0],{name:'pth_points_wallet',args:{p_actor_id:own,p_operation:'summary',p_body:{offset:0}}});
});
test('a principal cannot request the wallet of a child or another account',async()=>{
 const s=await setup();assert.equal((await s.request({action:'points_wallet',operation:'summary',beneficiaryId:other})).status,403);assert.equal(s.calls.length,0);
});
test('anonymous wallet access is rejected before a database operation',async()=>{
 const s=await setup();assert.equal((await s.request({action:'points_wallet',operation:'summary'},null)).status,401);assert.equal(s.calls.length,0);
});
for(const role of ['gestor','logistica'])test(role+' cannot grant rewards or browse other accounts',async()=>{
 const s=await setup({role});for(const operation of ['accounts','grant','rules','issues'])assert.equal((await s.request({action:'points_wallet',operation})).status,403);assert.equal(s.calls.length,0);
});
test('an administrator reads another wallet and grants using its own verified identity',async()=>{
 const s=await setup({role:'admin'});
 assert.equal((await s.request({action:'points_wallet',operation:'summary',beneficiaryId:other})).status,200);
 assert.equal((await s.request({action:'points_wallet',operation:'grant',beneficiaryId:other,points:5,reason:'Vídeo verificado',idempotencyKey:key})).status,200);
 assert.equal(s.calls.at(-1).args.p_actor_id,own);assert.equal(s.calls.at(-1).args.p_body.beneficiaryId,other);
});
test('a child with a misleading admin role does not acquire administrative reward permissions',async()=>{
 const s=await setup({role:'admin',parent:other});assert.equal((await s.request({action:'points_wallet',operation:'accounts'})).status,403);assert.equal(s.calls.length,0);
});
test('manual rewards reject blank reasons, nonpositive values, invalid keys and actor injection',async()=>{
 const s=await setup({role:'admin'}),b={action:'points_wallet',operation:'grant',beneficiaryId:other,points:5,reason:'Reconocimiento',idempotencyKey:key};
 for(const delta of [{points:0},{points:-1},{points:1.5},{reason:'   '},{idempotencyKey:'bad'},{actorId:other},{points:Number.MAX_SAFE_INTEGER+1}])assert.equal((await s.request({...b,...delta})).status,400);
 assert.equal(s.calls.length,0);
});
test('zero points and resetting a product override remain distinct valid rules',async()=>{
 const s=await setup({role:'admin'}),b={action:'points_wallet',operation:'save_rule',productId:other,reason:'Regla revisada',idempotencyKey:key};
 for(const pointsPerUnit of [0,null]){assert.equal((await s.request({...b,pointsPerUnit})).status,200);assert.equal(s.calls.at(-1).args.p_body.pointsPerUnit,pointsPerUnit);}
});
test('wallet pagination and unknown operations are bounded before SQL',async()=>{
 const s=await setup({role:'admin'});
 for(const body of [{operation:'summary',offset:-1},{operation:'summary',offset:0.5},{operation:'accounts',search:'x'.repeat(121)},{operation:'set_enabled',enabled:true}])assert.equal((await s.request({action:'points_wallet',...body})).status,400);
 assert.equal(s.calls.length,0);
});
test('wallet database failures are recoverable and do not expose private SQL',async()=>{
 const s=await setup();s.fail=true;const r=await s.request({action:'points_wallet',operation:'summary'});assert.equal(r.status,503);assert.doesNotMatch(r.error.message,/private financial/);
});
test('feature-off checkout preserves the current insertion RPC and prices',async()=>{
 const s=await setup();const q=await s.request({...s.f.body,operation:'quote'});assert.equal(q.error,null);
 const r=await s.request({...s.f.body,operation:'submit',attempt:q.data.attempt,quote:q.data.quote});assert.equal(r.data.complete,true);assert.equal(s.calls.length,0);
 assert.deepEqual(s.f.rows.pedidos.slice(1).map(x=>[x.total,x.comision_total]),[[106,10],[200,20]]);
});
test('feature-on checkout atomically sends verified seller and product quantities, not client reward values',async()=>{
 const s=await setup({enabled:true});s.f.body.inputs[0].points=999;s.f.body.inputs[0]._points_capture={beneficiary_id:other};
 const q=await s.request({...s.f.body,operation:'quote'});assert.equal(q.error,null);
 const r=await s.request({...s.f.body,operation:'submit',attempt:q.data.attempt,quote:q.data.quote});assert.equal(r.data.complete,true);
 const call=s.calls.find(x=>x.name==='pth_insert_checkout_points');assert.ok(call);
 assert.deepEqual(call.args.p_captures.map(c=>({beneficiary_id:c.beneficiary_id,lines:c.lines})),[{beneficiary_id:own,lines:[{producto_id:'pA',cantidad:1}]},{beneficiary_id:own,lines:[{producto_id:'pB',cantidad:1}]}]);
 assert.deepEqual(call.args.p_captures.map(c=>c.pedido_id),call.args.p_rows.map(r=>r.id));
 assert.ok(call.args.p_rows.every(r=>!Object.keys(r).some(k=>k.startsWith('_'))));
 assert.deepEqual(s.f.rows.pedidos.slice(1).map(x=>[x.total,x.comision_total]),[[106,10],[200,20]]);
});
test('a failed points insertion cannot fall back to an untracked order',async()=>{
 const s=await setup({enabled:true}),q=await s.request({...s.f.body,operation:'quote'});s.fail=true;
 const r=await s.request({...s.f.body,operation:'submit',attempt:q.data.attempt,quote:q.data.quote});assert.equal(r.error.code,'ORDER_OUTCOME_UNKNOWN');assert.equal(s.f.writes,0);
});

test('a verified child sale captures the child UUID, not its principal or approver',async()=>{
 const s=await setup({enabled:true,parent:other});s.f.body.table='pedidos_subgestores';
 for(const input of s.f.body.inputs){delete input.gestor;input.subgestor_id=own;}
 const q=await s.request({...s.f.body,operation:'quote'});assert.equal(q.error,null);
 const r=await s.request({...s.f.body,operation:'submit',attempt:q.data.attempt,quote:q.data.quote});assert.equal(r.data.complete,true);
 const call=s.calls.find(x=>x.name==='pth_insert_checkout_points');assert.deepEqual(call.args.p_captures.map(c=>c.beneficiary_id),[own,own]);
 assert.ok(s.f.rows.pedidos_subgestores.every(row=>row.parent_gestor_id===other&&row.subgestor_id===own));
});
test('express checkout preserves tariff fencing through the points wrapper',async()=>{
 const s=await setup({enabled:true});Object.assign(s.f.rows.tarifas_mensajeria[0],{precio_expres_pequeno:12,minutos_expres_pequeno:60});s.f.body.delivery.service='express';
 const q=await s.request({...s.f.body,operation:'quote'});assert.equal(q.error,null);
 const r=await s.request({...s.f.body,operation:'submit',attempt:q.data.attempt,quote:q.data.quote});assert.equal(r.data.complete,true);
 const call=s.calls.find(x=>x.name==='pth_insert_checkout_points');assert.equal(call.args.p_tariff.precio_expres_pequeno,12);
 assert.deepEqual(s.f.rows.pedidos.slice(1).map(r=>[r.servicio_mensajeria,r.plazo_mensajeria_minutos,r.costo_mensajeria]),[['express',60,12],['express',60,0]]);
});
test('a receipt retry never recaptures or changes an acknowledged reward order',async()=>{
 const s=await setup({enabled:true}),q=await s.request({...s.f.body,operation:'quote'});
 const body={...s.f.body,operation:'submit',attempt:q.data.attempt,quote:q.data.quote};await s.request(body);const rows=structuredClone(s.f.rows.pedidos);
 assert.equal((await s.request(body)).data.complete,true);assert.equal(s.calls.filter(c=>c.name==='pth_insert_checkout_points').length,1);assert.deepEqual(s.f.rows.pedidos,rows);
});
