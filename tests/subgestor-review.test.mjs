import test from 'node:test';
import assert from 'node:assert/strict';
let reviewSubgestor;
try { ({reviewSubgestor} = await import('../supabase/functions/secure-data/subgestor-review.mjs')); } catch (error) { if (error.code !== 'ERR_MODULE_NOT_FOUND') throw error; }
const admin={id:'00000000-0000-4000-8000-000000000001',rol:'admin',estado:'activo'};
const order='00000000-0000-4000-8000-000000000010';
function fixture(){const calls=[];return {calls,db:{rpc:async(name,params)=>{calls.push({name,params});return {data:['list','history'].includes(params.p_operation)?{rows:[],hasMore:false}:{id:order,decision:'approve'},error:null};}}};}
test('only a verified principal/admin may review; no RPC for child, guest or inactive actor',async()=>{
 assert.equal(typeof reviewSubgestor,'function');
 for(const actor of [null,{...admin,parent_id:'parent'},{...admin,rol:'mensajero'},{...admin,estado:'inactivo'}]){
  const {db,calls}=fixture();await assert.rejects(()=>reviewSubgestor(db,{operation:'approve',id:order,expected:'a'.repeat(32)},actor));assert.equal(calls.length,0);
 }
});
test('gateway binds the verified actor and strips arbitrary client-supplied actor fields',async()=>{
 assert.equal(typeof reviewSubgestor,'function');const {db,calls}=fixture();
 await reviewSubgestor(db,{operation:'approve',id:order,expected:'a'.repeat(32),actor_id:'forged'},admin);
 assert.equal(calls[0].name,'pth_review_subgestor');assert.equal(calls[0].params.p_actor_id,admin.id);assert.equal(calls[0].params.p_expected,'a'.repeat(32));
});
test('review rejects financial edits, missing version and empty rejection reason before SQL',async()=>{
 assert.equal(typeof reviewSubgestor,'function');
 for(const body of [{operation:'edit',id:order,expected:'a'.repeat(32),changes:{total:1}},{operation:'approve',id:order},{operation:'reject',id:order,expected:'a'.repeat(32),reason:' '},{operation:'approve_legacy',id:order}]){
  const {db,calls}=fixture();await assert.rejects(()=>reviewSubgestor(db,body,admin));assert.equal(calls.length,0);
 }
});
test('search is bounded, a failed SQL request stays an error and history is admin-only',async()=>{
 assert.equal(typeof reviewSubgestor,'function');
 const {db,calls}=fixture();await reviewSubgestor(db,{operation:'list',search:' CA-1587 ',offset:1000},admin);
 assert.equal(calls[0].params.p_search,'CA-1587');assert.equal(calls[0].params.p_offset,1000);
 await assert.rejects(()=>reviewSubgestor(db,{operation:'history'},{...admin,rol:'gestor'}));
 await assert.rejects(()=>reviewSubgestor({rpc:async()=>({error:{message:'internal SQL details',code:'XX000'}})},{operation:'list'},admin),/No se pudo/);
});

test('old two-request approval and unaudited pending edits/deletes require updating the page',async()=>{
 const {fixture}=await import('./fixtures/new-checkout.mjs');
 for(const body of [{table:'pedidos',op:'insert',values:[{id:order,subgestor_nombre:'Child'}]}, {table:'pedidos_subgestores',op:'delete'}, {table:'pedidos_subgestores',op:'update',values:{direccion:'x'}}]){
  const f=await fixture();const result=await f.request({action:'query',...body});assert.ok(result.error);assert.match(result.error.message,/Actualiza la página/);assert.equal(f.writes,0);
 }
});
