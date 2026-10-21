const test=require('node:test'),assert=require('node:assert/strict');
const shared=require('../js/checkout-form-shared.js'),pending=require('../js/pending-checkout.js');
test('new orders require exactly eleven digits, keeping initial zeros',()=>{
 for(const ci of ['', '1234567890', '123456789012', '1234567890x', 'No especificado'])assert.throws(()=>shared.validateIdentity(ci),{code:'CI_REQUIRED'});
 assert.equal(shared.validateIdentity('00123456789'),'00123456789');
});
test('old pending identity is not retroactively validated',()=>{
 assert.equal(shared.validateIdentity('',false),'');
 assert.equal(shared.validateIdentity('No especificado',false),'No especificado');
});
test('legacy form constraints can be relaxed then restored for the next new order',()=>{
 const input={required:true,pattern:'[0-9]{11}'},doc={getElementById:()=>input};
 shared.setIdentityRequired(doc,false);assert.equal(input.required,false);assert.equal(input.pattern,'.*');
 shared.setIdentityRequired(doc,true);assert.equal(input.required,true);assert.equal(input.pattern,'[0-9]{11}');
});
test('new queue input validates identity while legacy queue input remains compatible',()=>{
 const input={lines:[{id:'p',qty:1,price:5}],form:{nombre:'Synthetic',tel:'50000000',pickup:true,moneda:'USD (Efectivo)',ci:''}};
 assert.throws(()=>pending.clean({...input,identityRequired:true}),{code:'CI_REQUIRED'});
 assert.equal(pending.clean(input).form.ci,'');
 assert.equal(pending.clean({...input,identityRequired:true,form:{...input.form,ci:'00123456789'}}).identityRequired,true);
});
test('server rejects new missing CI but preserves an earlier pending intent without modifying history',async()=>{
 const {fixture}=await import('./fixtures/new-checkout.mjs');
 const f=await fixture({ciRequiredFrom:Date.now()-10000});
 assert.equal((await f.quote()).error?.code,'CI_REQUIRED');assert.equal(f.writes,0);
 f.body.intentCreatedAt-=20000;
 const q=await f.quote();assert.equal(q.error,null);assert.equal((await f.submit(q)).data.complete,true);
 assert.deepEqual(f.rows.pedidos[0],f.historical);
});
test('server accepts an eleven-digit CI on each provider after activation',async()=>{
 const {fixture}=await import('./fixtures/new-checkout.mjs');
 const f=await fixture({ciRequiredFrom:Date.now()-10000});for(const row of f.body.inputs)row.ci='00123456789';
 const q=await f.quote();assert.equal(q.error,null);assert.equal((await f.submit(q)).data.complete,true);
 assert.ok(f.rows.pedidos.slice(1).every(row=>row.ci==='00123456789'));
});
test('server enforces eleven digits for new principal and subgestor requests before any write',async()=>{
 const {fixture}=await import('./fixtures/new-checkout.mjs');
 for(const table of ['pedidos','pedidos_subgestores'])for(const ci of ['', '1234567890', '123456789012', '1234567890x', 12345678901]){
  const f=await fixture({ciRequiredFrom:0});f.body.table=table;f.body.inputs[0].ci=ci;
  assert.equal((await f.quote()).error?.code,'CI_REQUIRED');assert.equal(f.writes,0);
 }
});
test('activating CI validation cannot revalidate or duplicate an already accepted receipt',async()=>{
 const {fixture}=await import('./fixtures/new-checkout.mjs');
 const {createCheckoutService}=await import('../supabase/functions/secure-data/checkout.mjs');
 const f=await fixture(),q=await f.quote();assert.equal((await f.submit(q)).data.complete,true);
 const service=createCheckoutService({db:f.db,canonicalSale:()=>assert.fail('accepted orders must not be revalidated'),signingSecret:'synthetic-only-signing-material-not-a-production-secret',ciRequiredFrom:0});
 const response=await service({...f.body,operation:'submit',attempt:q.data.attempt,quote:q.data.quote},f.rows.gestores[0]);
 assert.equal(response.data.complete,true);assert.equal(f.writes,1);assert.deepEqual(f.rows.pedidos[0],f.historical);
});
