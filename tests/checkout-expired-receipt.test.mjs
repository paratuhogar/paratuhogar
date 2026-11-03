import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from './fixtures/new-checkout.mjs';
import {createHandler,hash} from '../supabase/functions/secure-data/handler.mjs';
import {createCheckoutService} from '../supabase/functions/secure-data/checkout.mjs';

const DAY=86400000,secret='synthetic-only-signing-material-not-a-production-secret';
// Mint and optionally accept with the real gateway under an earlier clock,
// then restore server time and recover through a newly created gateway.
async function agedFixture(t,{offset=-8*DAY,accepted=false,child=false}={}){
 const issued=Date.now()+offset;
 t.mock.method(Date,'now',()=>issued);
 let f,q;
 try{
  f=await fixture();
  if(child){
   f.rows.gestores[0].parent_id='parent';
   f.rows.gestores.push({...f.rows.gestores[0],id:'parent',nombre:'Parent',parent_id:null});
   f.body.table='pedidos_subgestores';
   for(const row of f.body.inputs){delete row.gestor;row.subgestor_id='actor-a';}
   f.rows.precios_personalizados=f.rows.productos.map(p=>({gestor:'Parent',producto_id:p.id,comision_subgestor:3,visible_subgestor:true}));
  }
  q=await f.quote();assert.equal(q.error,null);
  if(accepted){
   assert.equal((await f.submit(q)).data.complete,true);
   // The DB double uses new Date() for rows; age the persisted receipts too.
   for(const table of ['pedidos','pedidos_subgestores'])for(const row of f.rows[table])if(row.submission_token===q.data.attempt){
    row.fecha=new Date(issued).toISOString();row.created_at=new Date(issued).toISOString();
   }
  }
 }finally{t.mock.restoreAll();}
 const handler=createHandler({db:f.db,checkoutSecret:secret});
 const request=async(body,auth='a'.repeat(64))=>{
  const response=await handler(new Request('https://example.test',{method:'POST',headers:auth?{Authorization:'Bearer '+auth}:{},body:JSON.stringify(body)}));
  assert.equal(response.headers.get('Cache-Control'),'no-store');
  return response.json();
 };
 f.trace.length=0;
 return {f,q,request,receipt:(extra={},auth=null)=>request({action:'checkout',operation:'receipt',attempt:q.data.attempt,...extra},auth)};
}
function unchanged(f,before,writes){
 assert.deepEqual(f.rows,before);assert.equal(f.writes,writes);
 assert.ok(f.trace.every(row=>row.op==='select'),'receipt must never write, including session renewal');
}

test('expired accepted receipt recovers exact minimal references without a session or any write',async t=>{
 const {f,q,receipt}=await agedFixture(t,{accepted:true}),before=structuredClone(f.rows),writes=f.writes;
 const result=await receipt();
 assert.equal(result.error,null);assert.deepEqual(result.data,{complete:true,confirmed:[{proveedor:'A',reference:'A00001'},{proveedor:'B',reference:'B00001'}]});
 assert.doesNotMatch(JSON.stringify(result),/Synthetic Customer|telefono|cliente|direccion|comision|total|pago/);
 assert.equal(q.data.attempt.split('.')[1],String(f.body.intentCreatedAt));
 unchanged(f,before,writes);
});

test('expired absent receipt remains unconfirmed and ignores caller table and same-reference unrelated orders',async t=>{
 const {f,receipt,request,q}=await agedFixture(t);
 for(const table of ['pedidos','pedidos_subgestores'])f.rows[table].push({id:'unrelated-'+table,orden_dia:'A00001',proveedor:'A',submission_token:'another-key',fecha:new Date().toISOString(),created_at:new Date().toISOString()});
 const before=structuredClone(f.rows),result=await receipt({table:'pedidos_subgestores',actor:'same-name-other'});
 assert.deepEqual(result,{data:{confirmed:[],complete:false},error:null});
 for(const operation of ['quote','submit'])assert.equal((await request({...f.body,operation,attempt:q.data.attempt,quote:q.data.quote})).error.code,'ATTEMPT_EXPIRED');
 unchanged(f,before,0);
});

test('expired partial receipt reports only persisted providers and cannot authorize completion',async t=>{
 const {f,receipt,request,q}=await agedFixture(t,{accepted:true});
 f.rows.pedidos.splice(f.rows.pedidos.findIndex(row=>row.submission_token===q.data.attempt&&row.proveedor==='B'),1);
 const before=structuredClone(f.rows),writes=f.writes,result=await receipt();
 assert.deepEqual(result,{data:{confirmed:[{proveedor:'A',reference:'A00001'}],complete:false},error:null});
 assert.equal((await request({...f.body,operation:'submit',attempt:q.data.attempt,quote:q.data.quote})).error.code,'ATTEMPT_EXPIRED');
 unchanged(f,before,writes);
});

test('expired child receipt follows the exact key through approval and fails closed if either read fails',async t=>{
 const {f,receipt,q}=await agedFixture(t,{accepted:true,child:true});
 const moved=f.rows.pedidos_subgestores.splice(1,1)[0];f.rows.pedidos.push(moved);
 const before=structuredClone(f.rows),writes=f.writes;
 assert.equal((await receipt()).data.complete,true);
 const from=f.db.from;
 f.db.from=table=>{const query=from(table);if(table==='pedidos')query.then=(ok,no)=>Promise.resolve({data:null,error:{code:'synthetic-outage'}}).then(ok,no);return query;};
 assert.equal((await receipt()).error.code,'ORDER_OUTCOME_UNKNOWN');
 f.db.from=from;
 assert.deepEqual((await receipt()).data.confirmed.map(row=>row.reference).sort(),['A00001','B00001']);
 assert.equal(f.rows.pedidos.filter(row=>row.submission_token===q.data.attempt).length,1);
 unchanged(f,before,writes);
});

test('expired signatures and signed fields cannot be forged to enumerate receipts',async t=>{
 const {f,q,receipt}=await agedFixture(t,{accepted:true}),parts=q.data.attempt.split('.'),before=structuredClone(f.rows);
 const tampered=index=>{const copy=[...parts];copy[index]=index===2?'s':index===3?'1':'0'.repeat(64);return copy.join('.');};
 for(const attempt of ['legacy-key',q.data.attempt.slice(0,-1)+'x',...Array.from({length:6},(_,i)=>tampered(i+2))]){
  assert.equal((await receipt({attempt})).error.code,'ATTEMPT_INVALID');
 }
 assert.equal(f.trace.length,0,'invalid capability must not reach the DB');unchanged(f,before,1);
});

test('future signed attempt and future draft remain rejected for receipt, quote and submit',async t=>{
 const {f,q,receipt,request}=await agedFixture(t,{offset:DAY}),before=structuredClone(f.rows);
 assert.equal((await receipt()).error.code,'ATTEMPT_EXPIRED');
 for(const operation of ['quote','submit'])assert.equal((await request({...f.body,operation,attempt:q.data.attempt,quote:q.data.quote})).error.code,'ATTEMPT_EXPIRED');
 assert.equal((await request({...f.body,operation:'quote'})).error.code,'ATTEMPT_EXPIRED');
 unchanged(f,before,0);
});

test('receipt capability stays session independent and cannot be rebound to another account or token',async t=>{
 const {f,q,receipt,request}=await agedFixture(t,{accepted:true}),before=structuredClone(f.rows);
 const expected=await receipt();
 for(const auth of [null,'revoked-session','b'.repeat(64)])assert.deepEqual(await receipt({actor:'same-name-other'},auth),expected);
 assert.ok(f.trace.every(row=>row.table==='pedidos'),'receipt must not resolve or renew supplied sessions');
 unchanged(f,before,1);
 const fresh=await fixture(),freshQuote=await fresh.quote(),other='b'.repeat(64);
 fresh.rows.pth_secure_sessions.push({...fresh.rows.pth_secure_sessions[0],token_hash:await hash(other),gestor_id:'same-name-other'});
 assert.equal((await fresh.request({...fresh.body,operation:'submit',attempt:freshQuote.data.attempt,quote:freshQuote.data.quote},other)).error.code,'SESSION_CHANGED');
 assert.equal(fresh.writes,0);
 assert.equal((await request({...f.body,operation:'quote',attempt:q.data.attempt})).error.code,'ATTEMPT_EXPIRED');
});

test('failed expired receipt reads remain unknown; retry uses the same capability without insertion',async t=>{
 const {f,q,receipt}=await agedFixture(t,{accepted:true}),before=structuredClone(f.rows),from=f.db.from;
 let fault='error';
 f.db.from=table=>{const query=from(table);if(table==='pedidos'&&fault)query.then=(ok,no)=>Promise.resolve().then(()=>{
  if(fault==='throw')throw Error('synthetic network failure');
  return fault==='malformed'?{data:null,error:null}:{data:null,error:{code:'synthetic-outage'}};
 }).then(ok,no);return query;};
 for(fault of ['error','throw','malformed']){
  const failed=await receipt();assert.equal(failed.data,null);assert.ok(failed.error);assert.notEqual(failed.error.code,'ATTEMPT_EXPIRED');
 }
 fault=null;
 for(let retry=0;retry<3;retry++)assert.equal((await receipt({attempt:q.data.attempt})).data.complete,true);
 unchanged(f,before,1);
});

test('overlapping expired receipt reads never relax quote/submit validation or cause writes',async t=>{
 const {f,q,receipt,request}=await agedFixture(t,{accepted:true}),before=structuredClone(f.rows),from=f.db.from;
 let release,started;const blocked=new Promise(resolve=>{release=resolve;}),reading=new Promise(resolve=>{started=resolve;});
 f.db.from=table=>{const query=from(table),then=query.then.bind(query);if(table==='pedidos')query.then=(ok,no)=>Promise.resolve().then(async()=>{started();await blocked;return then(value=>value);}).then(ok,no);return query;};
 const first=receipt();await reading;
 try{
  for(const operation of ['quote','submit'])assert.equal((await request({...f.body,operation,attempt:q.data.attempt,quote:q.data.quote})).error.code,'ATTEMPT_EXPIRED');
 }finally{release();}
 const results=await Promise.all([first,receipt(),receipt()]);assert.ok(results.every(row=>row.data.complete));
 unchanged(f,before,1);
});

test('seven-day sending boundary remains strict even after a receipt lookup',async t=>{
 const {f,q}=await agedFixture(t,{accepted:true});let clock=f.body.intentCreatedAt+7*DAY;
 const service=createCheckoutService({db:f.db,signingSecret:secret,now:()=>clock,canonicalSale:()=>assert.fail('accepted rows must not be rewritten')});
 const body={...f.body,operation:'quote',attempt:q.data.attempt};
 assert.equal((await service(body,f.rows.gestores[0])).data.complete,true);
 clock++;
 assert.equal((await service({operation:'receipt',attempt:q.data.attempt},null)).data.complete,true);
 for(const operation of ['quote','submit'])assert.equal((await service({...body,operation},f.rows.gestores[0])).error.code,'ATTEMPT_EXPIRED');
 assert.equal(f.writes,1);
});
