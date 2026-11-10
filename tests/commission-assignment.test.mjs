import test from 'node:test';
import assert from 'node:assert/strict';
import {assignHalfCommissions} from '../supabase/functions/secure-data/commission-assignment.mjs';
import {createHandler,hash} from '../supabase/functions/secure-data/handler.mjs';

const actor={id:'a0000000-0000-4000-8000-000000000001',nombre:'Synthetic seller',rol:'gestor',estado:'activo'};
const batchId='b0000000-0000-4000-8000-000000000001';
const ids=Array.from({length:101},(_,i)=>`c0000000-0000-4000-8000-${String(i+1).padStart(12,'0')}`);
const body=(n=1)=>({action:'assign_half_commissions',batchId,productIds:ids.slice(0,n)});
const receipt=(n=1)=>({batchId,requested:n,inserted:n,skippedExisting:0,skippedUnavailable:0});
const noDb={rpc(){throw Error('RPC must not run');}};

for(const [name,bad,status] of [['anonymous',null,401],['subgestor',{...actor,parent_id:'parent'},403],['admin',{...actor,rol:'admin'},403],['messenger',{...actor,rol:'mensajero'},403],['inactive',{...actor,estado:'inactivo'},403],['disabled',{...actor,activo:false},403]])test(`assignment denies ${name} before mutation`,async()=>{
 await assert.rejects(()=>assignHalfCommissions(noDb,body(),bad),e=>e.status===status);
});

test('assignment allows one and 100 products and derives owner solely from actor',async()=>{
 for(const n of [1,100]){
  const calls=[];const db={rpc:async(name,params)=>{calls.push({name,params});return {data:receipt(n),error:null};}};
  const result=await assignHalfCommissions(db,body(n),actor);
  assert.equal(result.error,null);assert.deepEqual(result.data,receipt(n));
  assert.deepEqual(calls,[{name:'pth_assign_half_commissions',params:{p_gestor_id:actor.id,p_batch_id:batchId,p_product_ids:ids.slice(0,n)}}]);
 }
});

test('assignment rejects oversize, empty, malformed and duplicate batches before mutation',async()=>{
 const invalid=[body(0),body(101),{...body(),productIds:'wrong'},{...body(),productIds:[null]},{...body(),productIds:['not-a-uuid']},{...body(),productIds:[ids[0],ids[0].toUpperCase()]},{...body(),batchId:'invalid'},{...body(),batchId:'b0000000-0000-1000-8000-000000000001'}];
 for(const b of invalid)await assert.rejects(()=>assignHalfCommissions(noDb,b,actor),e=>e.status===400&&e.publicCode==='INVALID_BATCH');
});

test('identity, prices, commission and generic RPC parameters cannot be supplied',async()=>{
 for(const key of ['gestor','gestorId','p_gestor_id','actor','params','commission','price','values','operation'])await assert.rejects(()=>assignHalfCommissions(noDb,{...body(),[key]:'untrusted'},actor),e=>e.status===400);
});

test('UUID casing is canonical and receipt exposes only allowed counters',async()=>{
 const db={rpc:async(name,p)=>{assert.equal(p.p_batch_id,batchId);assert.equal(p.p_product_ids[0],ids[0]);return {data:{...receipt(),privateRows:[{secret:'must not return'}]},error:null};}};
 const result=await assignHalfCommissions(db,{...body(),batchId:batchId.toUpperCase(),productIds:[ids[0].toUpperCase()]},actor);
 assert.deepEqual(result.data,receipt());
});

test('database errors are sanitized and never retried implicitly',async()=>{
 for(const [code,status,publicCode] of [['23505',409,'ASSIGNMENT_CONFLICT'],['22023',409,'INVALID_BATCH'],['42501',403,'ACCESS_DENIED'],['40P01',503,'ASSIGNMENT_UNCONFIRMED'],['40001',503,'ASSIGNMENT_UNCONFIRMED'],['XX000',503,'ASSIGNMENT_UNCONFIRMED']]){
  let calls=0;const db={rpc:async()=>{calls++;return{data:null,error:{code,message:'private internal detail'}};}};
  await assert.rejects(()=>assignHalfCommissions(db,body(),actor),e=>e.status===status&&e.publicCode===publicCode&&!e.message.includes('private'));
  assert.equal(calls,1);
 }
});

test('a lost response remains unconfirmed, with no blind mutation retry',async()=>{
 let calls=0;const db={rpc:async()=>{calls++;throw Error('transport interrupted');}};
 await assert.rejects(()=>assignHalfCommissions(db,body(),actor),e=>e.status===503&&e.publicCode==='ASSIGNMENT_UNCONFIRMED');assert.equal(calls,1);
});

test('unverifiable receipts cannot become success',async()=>{
 for(const data of [null,[],{}, {...receipt(),batchId:ids[0]}, {...receipt(),requested:2}, {...receipt(),inserted:2}, {...receipt(),inserted:0.5}, {...receipt(),skippedExisting:-1}, {...receipt(),inserted:'1'}])await assert.rejects(()=>assignHalfCommissions({rpc:async()=>({data,error:null})},body(),actor),e=>e.status===503&&e.publicCode==='ASSIGNMENT_UNCONFIRMED');
});

test('receipt supports skipped existing and unavailable products without changing them',async()=>{
 const expected={batchId,requested:3,inserted:1,skippedExisting:1,skippedUnavailable:1};
 assert.deepEqual((await assignHalfCommissions({rpc:async()=>({data:expected,error:null})},body(3),actor)).data,expected);
});

async function gatewaySetup(){
 const token='a'.repeat(64),calls=[],writes=[];
 const profile={...actor,password:'synthetic-test-only'};
 const session={token_hash:await hash(token),gestor_id:profile.id,credential_hash:await hash(profile.password),expires_at:'2099-01-01T00:00:00Z'};
 class Query{
  constructor(table){this.table=table;this.filters=[];this.op='select';}
  select(){return this;}eq(k,v){this.filters.push(row=>row[k]===v);return this;}gt(){return this;}limit(){return this;}maybeSingle(){this.single=true;return this;}
  insert(values){this.op='insert';this.values=values;return this;}update(values){this.op='update';this.values=values;return this;}
  then(resolve,reject){return Promise.resolve().then(()=>{
   if(this.op!=='select'){writes.push({table:this.table,op:this.op,values:this.values});return {data:null,error:null};}
   const rows=this.table==='pth_secure_sessions'?[session]:this.table==='gestores'?[profile]:[];
   const found=rows.filter(r=>this.filters.every(f=>f(r)));return {data:this.single?found[0]||null:found,error:null};
  }).then(resolve,reject);}
 }
 const db={from:table=>new Query(table),rpc:async(name,params)=>{calls.push({name,params});return {data:receipt(params.p_product_ids?.length),error:null};}};
 const handler=createHandler({db});
 const request=async(b,bearer=token)=>{const response=await handler(new Request('https://example.test',{method:'POST',headers:{...(bearer?{Authorization:`Bearer ${bearer}`}:{})},body:JSON.stringify(b)}));return {status:response.status,...await response.json()};};
 return{request,calls,writes,profile};
}

test('full gateway resolves session then routes only authenticated actor to assignment RPC',async()=>{
 const {request,calls}=await gatewaySetup();const result=await request(body());
 assert.equal(result.status,200);assert.deepEqual(result.data,receipt());assert.equal(calls[0].params.p_gestor_id,actor.id);
 assert.equal((await request(body(),null)).status,401);assert.equal((await request(body(),'invalid')).status,401);assert.equal(calls.length,1);
});

test('full gateway denies assignment RPC through the generic RPC route',async()=>{
 const {request,calls}=await gatewaySetup();const response=await request({action:'rpc',name:'pth_assign_half_commissions',params:{p_gestor_id:actor.id,p_batch_id:batchId,p_product_ids:ids.slice(0,1)}});
 assert.equal(response.status,403);assert.equal(calls.length,0);
});

test('legacy bulk insert and all upserts are blocked before writes, individual manual save remains',async()=>{
 const {request,writes}=await gatewaySetup();const row={gestor:actor.nombre,producto_id:ids[0],comision_subgestor:0,visible_subgestor:false,nuevo_precio:40};
 for(const b of [{op:'insert',values:[row,{...row,producto_id:ids[1]}]},{op:'upsert',values:[row]},{op:'upsert',values:row}]){
  const result=await request({action:'query',table:'precios_personalizados',...b});assert.equal(result.status,409);assert.equal(result.error.code,'COMMISSION_CLIENT_OUTDATED');
 }
 assert.equal(writes.length,0);
 assert.equal((await request({action:'query',table:'precios_personalizados',op:'insert',values:[row]})).status,200);
 assert.equal((await request({action:'query',table:'precios_personalizados',op:'update',values:{comision_subgestor:0,visible_subgestor:false},filters:[{method:'eq',column:'id',value:ids[0]}]})).status,200);
 assert.deepEqual(writes.map(w=>w.op),['insert','update']);
});
