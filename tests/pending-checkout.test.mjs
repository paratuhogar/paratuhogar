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
  const state=setup(),{queue}=state,intent={intentId:'a'.repeat(64),savedAt:state.now},results=await Promise.all([queue.save('a',input,intent),queue.save('a',input,intent)]);
  assert.equal(results[0].id,results[1].id);assert.equal((await queue.list('a')).length,1);
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
  const second=await state.queue.save('a',input);await state.queue.patch('a',second.id,{outcome:{attempt:'signed-attempt'}});await state.queue.cancel('a',second.id);let paused=await state.queue.read('a');assert.equal(paused.form,undefined);assert.equal(paused.attempt,'signed-attempt');assert.equal(await state.queue.run('a',()=>assert.fail('cancelled never auto sends')),false);
  const independent=await state.queue.save('a',{...input,form:{...input.form,nombre:'Independent customer'}});assert.notEqual(independent.intentId,second.intentId);
  await state.queue.confirmed('a',second.id,[{reference:'late-A1'}]);assert.equal((await state.queue.read('a',independent.id)).state,'queued','late receipt changes only its own order');await state.queue.logout('a');assert.equal((await state.queue.list('a')).some(row=>row.form),false);
});
test('live submissions cannot be cancelled or replaced in a second tab',async()=>{
  const state=setup(),{queue}=state,intent={intentId:'a'.repeat(64),savedAt:state.now},row=await queue.save('a',input,intent);let release,started;const wait=new Promise(resolve=>started=resolve),hold=new Promise(resolve=>release=resolve);
  const run=queue.run('a',async()=>{started();await hold;});await wait;await assert.rejects(queue.cancel('a',row.id),{code:'BUSY'});assert.equal((await queue.save('a',input,intent)).id,row.id);await assert.rejects(queue.save('a',{...input,form:{...input.form,nombre:'Replacement'}},intent),{code:'INTENT_CONFLICT'});release();await run;
});
test('expired session retains retryable intention in its own account for verified reauthentication',async()=>{
  for(const code of ['SESSION_CHANGED','SESSION_INVALID','SESSION_EXPIRED']){const {queue}=setup();await queue.save('a',input);await queue.run('a',()=>{throw Object.assign(Error('private raw server error'),{code,safeMessage:'Vuelve a tu cuenta.'});});const row=await queue.read('a');assert.equal(row.state,'queued');assert.equal(row.code,code);assert.equal(await queue.read('b'),null);assert.equal(await queue.run('b',()=>assert.fail()),false);}
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
test('multiple customers with identical products retain separate intents, estimates, reviews and receipts',async()=>{
  const clock=setup(),{queue}=clock,intentA={intentId:'a'.repeat(64),savedAt:clock.now},intentB={intentId:'b'.repeat(64),savedAt:clock.now};
  const a=await queue.save('a',{...input,estimate:{shipping:12,total:312}},intentA),b=await queue.save('a',{...input,form:{...input.form,nombre:'Second customer'},estimate:{shipping:20}},intentB);
  assert.notEqual(a.id,b.id);assert.notEqual(a.intentId,b.intentId);assert.deepEqual(a.estimate,{equipment:300,shipping:12,total:312});assert.deepEqual(b.estimate,{equipment:300,shipping:20,total:320});
  assert.equal((await queue.read('a')).id,a.id);assert.equal((await queue.list('a')).length,2);
  await queue.patch('a',a.id,{state:'blocked'});await queue.revise('a',a.id,{...input,form:{...input.form,nombre:'First edited'}});
  assert.equal((await queue.read('a',b.id)).form.nombre,'Second customer');await queue.confirmed('a',a.id,[{reference:'A1'}]);
  const rows=await queue.list('a');assert.equal(rows.find(row=>row.id===a.id).form,undefined);assert.equal(rows.find(row=>row.id===b.id).form.nombre,'Second customer');assert.equal(await queue.read('other',a.id),null);await assert.rejects(queue.cancel('other',b.id),{code:'CHANGED'});
});
test('reference and reviewed amounts are bounded, internally consistent and cleared after explicit acceptance or receipt',async()=>{
  const {queue}=setup(),a=await queue.save('a',input);
  for(const shipping of [-1,Infinity,NaN,'6'])await assert.rejects(queue.save('a',{...input,estimate:{shipping}}),{code:'INVALID'});
  await assert.rejects(queue.save('a',{...input,estimate:{equipment:299,shipping:6,total:305}}),{code:'INVALID'});
  await assert.rejects(queue.patch('a',a.id,{reviewEstimate:{equipment:300,shipping:12,total:999}}),{code:'INVALID'});
  await queue.patch('a',a.id,{state:'blocked',reviewEstimate:{equipment:300,shipping:12,total:312,untrustedText:'do not persist'}});
  assert.deepEqual((await queue.read('a',a.id)).reviewEstimate,{equipment:300,shipping:12,total:312});
  const accepted=await queue.revise('a',a.id,{...input,estimate:{equipment:300,shipping:12,total:312}});assert.equal(accepted.reviewEstimate,undefined);assert.equal(accepted.estimate.total,312);
  await queue.confirmed('a',a.id,[{reference:'A1'}]);const receipt=await queue.read('a',a.id);assert.equal(receipt.estimate,undefined);assert.equal(receipt.reviewEstimate,undefined);
});
test('scheduler skips blocked orders, serializes the whole account and can target a specific pending',async()=>{
  const {queue}=setup(),a=await queue.save('a',input),b=await queue.save('a',{...input,form:{...input.form,nombre:'Second'}});await queue.patch('a',a.id,{state:'blocked'});
  let started,release;const wait=new Promise(resolve=>started=resolve),hold=new Promise(resolve=>release=resolve);
  const run=queue.run('a',async context=>{assert.equal(context.row.id,b.id);started();await hold;await context.confirmed([{reference:'B1'}]);});await wait;
  await queue.retry('a',a.id);assert.equal(await queue.run('a',()=>assert.fail('another tab cannot send a different row while the account is leased'),a.id),false);release();await run;
  await queue.run('a',async context=>{assert.equal(context.row.id,a.id);await context.confirmed([{reference:'A1'}]);},a.id);assert.equal((await queue.list('a')).every(row=>row.state==='confirmed'),true);
});
test('an uncertain receipt is retained individually while another independent customer can be sent',async()=>{
  const {queue}=setup(),a=await queue.save('a',input),b=await queue.save('a',{...input,form:{...input.form,nombre:'Second'}});
  await queue.run('a',async context=>{await context.save({outcome:{attempt:'signed-A'}});throw Object.assign(Error('lost response'),{code:'ORDER_OUTCOME_UNKNOWN'});},a.id);
  await queue.run('a',async context=>{assert.equal(context.row.id,b.id);await context.confirmed([{reference:'B1'}]);},b.id);
  assert.equal((await queue.read('a',a.id)).state,'uncertain');assert.equal((await queue.read('a',a.id)).outcome.attempt,'signed-A');assert.equal((await queue.read('a',b.id)).state,'confirmed');
});
test('logout, expiry and quota failures protect every customer without crossing accounts',async()=>{
  const state=setup(),a=await state.queue.save('a',input),b=await state.queue.save('a',{...input,form:{...input.form,nombre:'Second'}}),other=await state.queue.save('b',input);
  await state.queue.patch('a',a.id,{outcome:{attempt:'signed-A'}});await state.queue.logout('a');
  const rows=await state.queue.list('a');assert.equal(rows.length,1);assert.equal(rows[0].attempt,'signed-A');assert.doesNotMatch(JSON.stringify(rows),/Synthetic|Second|synthetic-phone/);assert.ok((await state.queue.read('b',other.id)).form);
  state.store.denied=true;await assert.rejects(state.queue.save('b',input),{code:'STORAGE'});state.store.denied=false;assert.equal((await state.queue.list('b')).length,1);
  state.advance(pending.AGE+1);assert.equal((await state.queue.list('b')).every(row=>!row.form&&!row.lines),true);assert.equal(await state.queue.read('a',b.id),null);
});
test('explicit save nonce is required for deduplication and cannot be reused with changed customer or quantities',async()=>{
  const state=setup(),{queue}=state,intent={intentId:'a'.repeat(64),savedAt:state.now},a=await queue.save('a',input,intent);
  await assert.rejects(queue.save('a',{...input,form:{...input.form,tel:'different'}},intent),{code:'INTENT_CONFLICT'});await assert.rejects(queue.save('a',{...input,lines:[{id:'pA',qty:2,price:100}]},intent),{code:'INTENT_CONFLICT'});
  await queue.confirmed('a',a.id,[{reference:'A1'}]);assert.equal((await queue.save('a',input,intent)).id,a.id);assert.equal((await queue.list('a')).length,1);
  await assert.rejects(queue.save('a',input,{intentId:'invalid',savedAt:state.now}),{code:'INVALID_INTENT'});
});
test('pending limit is bounded without deleting existing customers and confirmation frees a slot',async()=>{
  const {queue}=setup();for(let i=0;i<pending.MAX_PENDING;i++)await queue.save('a',{...input,form:{...input.form,nombre:'Customer '+i}});
  await assert.rejects(queue.save('a',input),{code:'LIMIT'});assert.equal((await queue.list('a')).filter(row=>row.form).length,pending.MAX_PENDING);
  const first=await queue.read('a');await queue.confirmed('a',first.id,[{reference:'first'}]);await queue.save('a',input);assert.equal((await queue.list('a')).filter(row=>row.form).length,pending.MAX_PENDING);
});
test('legacy v1 storage value migrates without changing attempt, intent, references or pending customer',async()=>{
  const state=setup(),legacy={version:1,owner:'a',id:'1'.repeat(64),intentId:'2'.repeat(64),createdAt:state.now,updatedAt:state.now,state:'uncertain',...pending.clean(input),outcome:{attempt:'signed-legacy'},priorAttempts:['prior-legacy'],lease:null};
  state.store.rows.set('a',legacy);assert.equal((await state.queue.list('a')).length,1);assert.deepEqual(await state.queue.read('a',legacy.id),legacy);assert.equal(state.store.rows.get('a').version,2);
  const second=await state.queue.save('a',{...input,form:{...input.form,nombre:'New customer'}});assert.notEqual(second.intentId,legacy.intentId);await state.queue.confirmed('a',legacy.id,[{reference:'Legacy1'}]);assert.equal((await state.queue.read('a',second.id)).state,'queued');
});
