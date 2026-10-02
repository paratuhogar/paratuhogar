import test from 'node:test';
import assert from 'node:assert/strict';
import pending from '../js/pending-checkout.js';
import {fixture} from './fixtures/new-checkout.mjs';

function memory(){const rows=new Map();let chain=Promise.resolve(),denied=false;return {rows,set denied(value){denied=value;},update(owner,mutate){const work=chain.then(()=>{if(denied)throw Object.assign(Error('STORAGE'),{code:'STORAGE'});const next=mutate(structuredClone(rows.get(owner)||null));if(next==null)rows.delete(owner);else rows.set(owner,structuredClone(next));return structuredClone(next);});chain=work.catch(()=>{});return work;}};}
const input={lines:[{id:'pA',qty:1,price:100},{id:'pB',qty:1,price:200}],form:{nombre:'Synthetic Customer',tel:'synthetic-phone',ci:'none',dir:'Synthetic address',municipio:'Centro Habana',localidad:'Centro',moneda:'USD (Efectivo)',notas:'<script>Do not execute submitted text</script>',vuelto:''}};
function setup(){let now=Date.now(),next=0;const store=memory(),queue=pending.create(store,{now:()=>now,id:()=> (++next).toString(16).padStart(64,'0')});return {store,queue,get now(){return now;},advance(ms){now+=ms;}};}
function bridge(f,queue,owner,options={}){return async context=>{
  const row=context.row,body={...f.body,intentId:row.intentId,intentCreatedAt:row.createdAt};
  if(row.outcome?.attempt){const receipt=await f.request({action:'checkout',operation:'receipt',attempt:row.outcome.attempt},null);if(receipt.data?.complete){await context.confirmed(receipt.data.confirmed);return;}}
  if(options.before)throw Object.assign(Error('offline'),{code:'NETWORK_ERROR'});
  const quote=await f.request({...body,operation:'quote',attempt:row.outcome?.attempt});assert.equal(quote.error,null);
  await context.save({outcome:{attempt:quote.data.attempt}});
  if(options.afterQuote)throw Object.assign(Error('offline'),{code:'NETWORK_ERROR'});
  const result=await f.request({...body,operation:'submit',attempt:quote.data.attempt,quote:quote.data.quote});
  if(result.error)throw Object.assign(Error('response lost'),{code:'ORDER_OUTCOME_UNKNOWN'});
  assert.equal(result.data.complete,true);await context.confirmed(result.data.confirmed);
};}

test('requires explicit valid account and selection; minimizes stored fields without copying secrets',async()=>{
  const {queue}=setup();await assert.rejects(queue.save(null,input),{code:'ACCOUNT'});
  const row=await queue.save('a',{...input,token:'do-not-store',password:'do-not-store',form:{...input.form,token:'do-not-store'}});
  assert.equal(row.state,'queued');assert.equal(row.owner,'a');assert.equal(row.form.notas,input.form.notas);assert.doesNotMatch(JSON.stringify(row),/do-not-store/);
  assert.equal(await queue.read('b'),null);assert.equal(pending.localOwner({getItem:k=>k==='pth_session'?JSON.stringify({data:{id:'a'}}):null}),null);
});
test('invalid, duplicate, excessive quantities, missing delivery and unbounded data are rejected',()=>{
  for(const qty of [0,-1,1.5,10001,Infinity])assert.throws(()=>pending.clean({...input,lines:[{id:'pA',qty,price:100}]}),{code:'INVALID'});
  assert.throws(()=>pending.clean({...input,lines:[input.lines[0],input.lines[0]]}),{code:'INVALID'});
  assert.throws(()=>pending.clean({...input,form:{...input.form,localidad:''}}),{code:'INVALID'});
  assert.throws(()=>pending.clean({...input,form:{...input.form,dir:'x'.repeat(4001)}}),{code:'INVALID'});
  assert.throws(()=>pending.clean({...input,form:{...input.form,moneda:'invalid'}}),{code:'INVALID'});
});
test('duplicate explicit saves and concurrent tabs retain one stable intent and single active lease',async()=>{
  const {queue}=setup(),results=await Promise.allSettled([queue.save('a',input),queue.save('a',input)]);
  assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(results.find(r=>r.status==='rejected').reason.code,'EXISTS');
  let release,started;const wait=new Promise(resolve=>started=resolve),hold=new Promise(resolve=>release=resolve);let attempts=0;
  const first=queue.run('a',async context=>{attempts++;started();await hold;await context.confirmed([{reference:'A1',proveedor:'A'}]);});await wait;
  assert.equal(await queue.run('a',()=>assert.fail('second tab cannot acquire live lease')),false);release();await first;assert.equal(attempts,1);
});
test('cut before any request retains client data and same intent until real recovery',async()=>{
  const f=await fixture(),{queue}=setup(),row=await queue.save('a',input);
  await queue.run('a',bridge(f,queue,'a',{before:true}));assert.equal(f.writes,0);assert.equal((await queue.read('a')).state,'queued');assert.equal((await queue.read('a')).id,row.id);
  await queue.run('a',bridge(f,queue,'a'));assert.equal(f.writes,1);const confirmed=await queue.read('a');assert.equal(confirmed.state,'confirmed');assert.equal(confirmed.form,undefined);assert.equal(confirmed.lines,undefined);assert.doesNotMatch(JSON.stringify(confirmed),/Synthetic Customer|synthetic-phone|Synthetic address/);assert.deepEqual(f.rows.pedidos[0],f.historical);
});
test('cut after quote and lost response after acceptance both recover through same signed receipt',async()=>{
  for(const stage of ['afterQuote','afterAccept']){
    const f=await fixture(),{queue}=setup(),row=await queue.save('a',input);if(stage==='afterAccept')f.drop=true;
    await queue.run('a',bridge(f,queue,'a',{afterQuote:stage==='afterQuote'}));const pending=await queue.read('a');assert.equal(pending.state,'uncertain');assert.ok(pending.outcome.attempt);assert.equal(pending.id,row.id);
    f.drop=false;await queue.run('a',bridge(f,queue,'a'));assert.equal(f.writes,1);assert.equal((await queue.read('a')).state,'confirmed');assert.deepEqual(f.rows.pedidos[0],f.historical);
  }
});
test('reopening, abandoned lease expiry and two competing retries cannot duplicate an accepted order',async()=>{
  const f=await fixture(),state=setup(),row=await state.queue.save('a',input);f.drop=true;
  await state.queue.run('a',bridge(f,state.queue,'a'));f.drop=false;
  await state.queue.patch('a',row.id,{state:'sending',lease:{id:'old-tab',until:state.now+60000}});
  const reopened=pending.create(state.store,{now:()=>state.now});assert.equal(await reopened.run('a',()=>assert.fail('live tab owns lease')),false);
  state.advance(60001);await Promise.all([reopened.run('a',bridge(f,reopened,'a')),state.queue.run('a',bridge(f,state.queue,'a'))]);assert.equal(f.writes,1);assert.equal((await reopened.read('a')).state,'confirmed');
});
test('cancel before sending erases fields; cancellation or logout after a quote stops retries but preserves receipt capability',async()=>{
  const state=setup(),row=await state.queue.save('a',input);await state.queue.cancel('a',row.id);assert.equal(await state.queue.read('a'),null);
  const second=await state.queue.save('a',input);await state.queue.patch('a',second.id,{outcome:{attempt:'signed-attempt'}});await state.queue.cancel('a',second.id);let paused=await state.queue.read('a');assert.equal(paused.form,undefined);assert.equal(paused.attempt,'signed-attempt');assert.equal(await state.queue.run('a',()=>assert.fail('cancelled never auto sends')),false);await assert.rejects(state.queue.save('a',input),{code:'RECEIPT_REQUIRED'});
  await state.queue.patch('a',second.id,{attempt:null});const resumed=await state.queue.save('a',input);assert.equal(resumed.intentId,second.intentId,'absent receipt reuses the nonce to fence any acceptance still in flight');assert.notEqual(resumed.id,second.id,'new local revision cannot be confirmed by an old response');await assert.rejects(state.queue.confirmed('a',second.id,[{reference:'late-A1'}]),{code:'CHANGED'});await state.queue.logout('a');assert.equal(await state.queue.read('a'),null);
});
test('live submissions cannot be cancelled or replaced in a second tab',async()=>{
  const {queue}=setup(),row=await queue.save('a',input);let release,started;const wait=new Promise(resolve=>started=resolve),hold=new Promise(resolve=>release=resolve);
  const run=queue.run('a',async()=>{started();await hold;});await wait;await assert.rejects(queue.cancel('a',row.id),{code:'BUSY'});await assert.rejects(queue.save('a',input),{code:'EXISTS'});release();await run;
});
test('expired session/account rejection blocks retry and never transfers the customer to another account',async()=>{
  for(const code of ['SESSION_CHANGED','SESSION_INVALID']){const {queue}=setup();await queue.save('a',input);await queue.run('a',()=>{throw Object.assign(Error('private raw server error'),{code,safeMessage:'Vuelve a tu cuenta.'});});const row=await queue.read('a');assert.equal(row.state,'blocked');assert.equal(row.code,code);assert.equal(await queue.read('b'),null);assert.equal(await queue.run('b',()=>assert.fail()),false);}
});
test('quota or storage denial cannot claim an order is saved or call the network',async()=>{
  const {queue,store}=setup();store.denied=true;await assert.rejects(queue.save('a',input),{code:'STORAGE'});assert.equal(store.rows.size,0);await assert.rejects(queue.run('a',()=>assert.fail('storage failure cannot start delivery')),{code:'STORAGE'});
});
test('expiry removes customer data without minting another attempt; lease state is not success evidence',async()=>{
  const state=setup();await state.queue.save('a',input);state.advance(pending.AGE+1);const row=await state.queue.read('a');assert.equal(row.state,'expired');assert.equal(row.form,undefined);assert.equal(await state.queue.run('a',()=>assert.fail('expired order not sent')),false);
});
test('a second explicit order after confirmation never reuses an old saved-cart intent',async()=>{
  const f=await fixture(),{queue}=setup(),intent={intentId:'c'.repeat(64),savedAt:Date.now(),lines:input.lines};
  const first=await queue.save('a',input,intent);await queue.run('a',bridge(f,queue,'a'));assert.equal(f.writes,1);
  const second=await queue.save('a',{...input,form:{...input.form,nombre:'Second Synthetic Customer'}},intent);assert.notEqual(second.intentId,first.intentId);assert.notEqual(second.id,first.id);
  await queue.run('a',bridge(f,queue,'a'));assert.equal(f.writes,2);assert.equal((await queue.read('a')).state,'confirmed');
});
test('a saved-cart intent is reused only for the same exact product quantities',async()=>{
  const {queue}=setup(),intent={intentId:'d'.repeat(64),savedAt:Date.now(),lines:[{id:'another',qty:1}]};const row=await queue.save('a',input,intent);assert.notEqual(row.intentId,intent.intentId);
});
test('review updates and retry are atomic; another tab cannot edit a leased submission',async()=>{
  const {queue}=setup(),row=await queue.save('a',input);
  await queue.patch('a',row.id,{state:'blocked'});
  const edited={...input,form:{...input.form,nombre:'Edited Synthetic'}};
  await queue.revise('a',row.id,edited);assert.equal((await queue.read('a')).form.nombre,edited.form.nombre);
  let release,started;const wait=new Promise(resolve=>started=resolve),hold=new Promise(resolve=>release=resolve);
  const run=queue.run('a',async()=>{started();await hold;});await wait;
  await assert.rejects(queue.revise('a',row.id,input),{code:'BUSY'});
  await assert.rejects(queue.patch('a',row.id,{form:input.form}),{code:'BUSY'});
  assert.equal((await queue.read('a')).form.nombre,edited.form.nombre);release();await run;
});
test('signed pickup review tolerates only normalized display delivery fields and retains the original payload',async()=>{
  const {queue}=setup(),pickup={...input,form:{...input.form,pickup:true}},row=await queue.save('a',pickup);
  await queue.patch('a',row.id,{state:'blocked',outcome:{attempt:'signed-attempt'}});
  const normalized={...pickup,form:{...pickup.form,municipio:'',localidad:'',dir:'Recogida en almacén'}};
  const revised=await queue.revise('a',row.id,normalized);assert.deepEqual(revised.form,pending.clean(pickup).form);assert.equal(revised.outcome.attempt,'signed-attempt');
  for(const change of [{nombre:'Different'},{tel:'different'},{moneda:'Zelle'},{notas:'Different'},{pickup:false}]){
    await queue.patch('a',row.id,{state:'blocked'});
    await assert.rejects(queue.revise('a',row.id,{...pickup,form:{...pickup.form,...change}}),{code:'SIGNED_CHANGE'});
  }
  await assert.rejects(queue.revise('a',row.id,{...pickup,lines:[{id:'pA',qty:2,price:100}]}),{code:'SIGNED_CHANGE'});
});
