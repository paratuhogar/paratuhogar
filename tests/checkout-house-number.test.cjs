const test=require('node:test'),assert=require('node:assert/strict');
const shared=require('../js/checkout-form-shared.js'),pending=require('../js/pending-checkout.js');

test('a new delivery needs a house number or explicit S/N; a pickup does not',()=>{
  const build=(number,pickup=false)=>shared.checkoutAddress({address:'Calle Uno',number,pickup});
  for(const value of ['', '   ', 'al fondo', '---']) assert.throws(()=>build(value),{code:'HOUSE_NUMBER_REQUIRED'});
  assert.equal(build(' 123-A '),'N.º 123-A, Calle Uno');
  assert.equal(build('s/n'),'N.º S/N, Calle Uno');
  assert.equal(build('',true),'Recogida presencial en almacén');
});

test('the native field is required for a new delivery but hidden and disabled for pickup',()=>{
  const input={},wrapper={},doc={getElementById:id=>id==='check-houseNumber'?input:wrapper};
  shared.setHouseNumberRequired(doc,{pickup:false,required:true});
  assert.deepEqual([input.required,input.disabled,wrapper.hidden],[true,false,false]);
  shared.setHouseNumberRequired(doc,{pickup:true,required:true});
  assert.deepEqual([input.required,input.disabled,wrapper.hidden],[false,true,true]);
  shared.setHouseNumberRequired(doc,{pickup:false,required:false});
  assert.deepEqual([input.required,input.disabled,wrapper.hidden],[false,false,false]);
});

test('the saved address splits only a standardized house number for reuse without a duplicate',()=>{
  assert.deepEqual(shared.splitHouseNumber('N.º 42-B, Calle A'),{number:'42-B',address:'Calle A'});
  assert.deepEqual(shared.splitHouseNumber('Calle 42, interior'),{number:'',address:'Calle 42, interior'});
});

test('new offline deliveries cannot be saved without a number and retain it when restored',async()=>{
  const data={lines:[{id:'p',qty:1,price:5}],form:{nombre:'Synthetic',tel:'50000000',municipio:'Centro Habana',localidad:'Centro',dir:'Calle Uno',moneda:'USD (Efectivo)'},houseNumberRequired:true};
  let stored;
  const queue=pending.create({update(_owner,mutate){stored=structuredClone(mutate(stored));return Promise.resolve(stored);}});
  assert.throws(()=>pending.clean(data),{code:'HOUSE_NUMBER_REQUIRED'});
  const saved=await queue.save('owner',{...data,form:{...data.form,houseNumber:'12-B'}});
  const restored=await queue.read('owner',saved.id);
  assert.equal(restored.form.houseNumber,'12-B');
  assert.equal(restored.form.dir,'Calle Uno');
  assert.equal(pending.clean({...data,form:{...data.form,pickup:true}}).form.houseNumber,undefined);
  assert.equal(pending.clean({...data,houseNumberRequired:false}).form.houseNumber,undefined);
});

test('server rejects an incomplete new delivery and saves the validated address for each provider',async()=>{
  const {fixture}=await import('./fixtures/new-checkout.mjs');
  const f=await fixture({houseNumberRequiredFrom:0});
  f.body.intentCreatedAt=1;
  for(const row of f.body.inputs)row.direccion='N.º 12-B, Calle Uno (Centro)';
  f.body.inputs[1].direccion='Calle Uno (Centro)';
  assert.equal((await f.quote()).error?.code,'HOUSE_NUMBER_REQUIRED');
  assert.equal(f.writes,0);
  f.body.inputs[1].direccion='N.º S/N, Calle Dos (Centro)';
  assert.equal((await f.quote()).error?.code,'CHECKOUT_INVALID','each provider must have the same house number');
  f.body.inputs[1].direccion=f.body.inputs[0].direccion;
  const q=await f.quote();assert.equal(q.error,null);
  assert.equal((await f.submit(q)).data.complete,true);
  assert.deepEqual(f.rows.pedidos.slice(1).map(row=>row.direccion),['N.º 12-B, Calle Uno (Centro)','N.º 12-B, Calle Uno (Centro)']);
  assert.deepEqual(f.rows.pedidos[0],f.historical);
});

test('server allows S/N and exempts a real pickup and a previously signed delivery',async()=>{
  const {fixture}=await import('./fixtures/new-checkout.mjs');
  let serverTime=Date.now();
  const f=await fixture({houseNumberRequiredFrom:serverTime+1000,serverNow:()=>serverTime});
  const prior=await f.quote();assert.equal(prior.error,null);
  serverTime+=1500;
  assert.equal((await f.submit(prior)).data.complete,true);
  f.body.intentId='c'.repeat(64);
  assert.equal((await f.quote()).error?.code,'HOUSE_NUMBER_REQUIRED');
  for(const row of f.body.inputs)row.direccion='N.º S/N, Calle Uno (Centro)';
  assert.equal((await f.quote()).error,null);
  f.body.delivery={pickup:true,municipio:'Almacén',localidad:'Centro de Entrega'};
  for(const row of f.body.inputs)Object.assign(row,{municipio:'Almacén',direccion:'Recogida presencial en almacén (Centro de Entrega)'});
  assert.equal((await f.quote()).error,null);
});

test('older generic clients cannot save new deliveries without a dwelling number after activation',async()=>{
  const {fixture}=await import('./fixtures/new-checkout.mjs');
  const f=await fixture({houseNumberRequiredFrom:0});
  for(const table of ['pedidos','pedidos_subgestores']){
    const r=await f.request({action:'query',table,op:'insert',values:[f.body.inputs[0]]});
    assert.match(r.error?.message||'',/número de casa/i);assert.equal(f.writes,0);
  }
});

test('a failed quote before activation does not exempt a draft that never received a signed attempt',async()=>{
  const {fixture}=await import('./fixtures/new-checkout.mjs');
  let serverTime=Date.now();
  const f=await fixture({houseNumberRequiredFrom:serverTime+1000,serverNow:()=>serverTime});
  const [tariff]=f.rows.tarifas_mensajeria.splice(0,1);
  assert.equal((await f.quote()).error?.code,'DELIVERY_UNAVAILABLE');
  f.rows.tarifas_mensajeria.push(tariff);serverTime+=1500;
  assert.equal((await f.quote()).error?.code,'HOUSE_NUMBER_REQUIRED');
  assert.equal(f.writes,0);
});

test('legacy signed attempts keep the original address even when the old phone timestamp crosses activation',async()=>{
  const {fixture}=await import('./fixtures/new-checkout.mjs');
  const {legacyAttempt}=await import('./fixtures/legacy-checkout-key.mjs');
  const f=await fixture({houseNumberRequiredFrom:Date.now()-10000});
  f.body.intentCreatedAt=Date.now()-5000;
  const attempt=await legacyAttempt(f);
  const q=await f.request({...f.body,operation:'quote',attempt});
  assert.equal(q.error,null);
  assert.equal((await f.submit(q)).data.complete,true);
  assert.ok(f.rows.pedidos.slice(1).every(row=>row.direccion==='Synthetic address (Centro)'));
  assert.deepEqual(f.rows.pedidos[0],f.historical);
});
