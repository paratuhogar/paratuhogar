import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import pending from '../js/pending-checkout.js';
import copyApi from '../js/offline-checkout-copy.js';
import adapterApi from '../js/offline-storefront-adapter.js';
import {fixture} from './fixtures/new-checkout.mjs';
function memory(){const rows=new Map();let chain=Promise.resolve();return{rows,update(owner,mutate){const p=chain.then(()=>{const next=mutate(structuredClone(rows.get(owner)||null));if(next===null)rows.delete(owner);else rows.set(owner,structuredClone(next));return structuredClone(next);});chain=p.catch(()=>{});return p;}};}
async function device(){
 const f=await fixture();f.rows.gestores=[{...f.rows.gestores[0],nombre:'Demo A'},{...f.rows.gestores[0],id:'actor-b',nombre:'Demo B',password:'synthetic-b'}];
 const items=new Map(),listeners={};const storage={getItem:k=>items.get(k)||null,setItem:(k,v)=>items.set(k,String(v)),removeItem:k=>items.delete(k),key:i=>[...items.keys()][i],get length(){return items.size;}};
 let online=true;
 const root={localStorage:storage,console,Set,Map,Promise,AbortSignal,URL,location:{origin:'https://fixture.test',pathname:'/'},navigator:{onLine:false},Event:class{constructor(type){this.type=type;}},addEventListener:(n,fn)=>(listeners[n]||=[]).push(fn),dispatchEvent:e=>(listeners[e.type]||[]).forEach(fn=>fn(e)),supabase:{createClient:()=>({from(){throw Error('Protected REST forbidden');},rpc(){throw Error('Protected RPC forbidden');}})},fetch:async(_url,opt)=>{if(!online)throw Error('simulated network');const result=await f.request(JSON.parse(opt.body),(opt.headers.Authorization||'').replace('Bearer ','')||null);return{status:f.lastStatus,json:async()=>result};}};root.window=root;
 vm.runInNewContext(fs.readFileSync('js/secure-data.js','utf8'),root);
 const secure=root.PTHSecureData,db=root.supabase.createClient('fixture','public-key'),copyStore=memory(),copies=copyApi.create(null,{store:copyStore}),queue=pending.create(memory());
 copyApi.bindLifecycle(root,storage,copies);
 const storefront=fs.readFileSync('js/pending-checkout-storefront.js','utf8'),a=storefront.indexOf('  async function drainPrivatePurges()'),b=storefront.indexOf('  function message',a);
 const drainContext={window:root,PTHSecureData:secure,copies,queue,purgePromise:null,message:()=>{}};vm.runInNewContext(storefront.slice(a,b),drainContext);
 const prepare=async()=>{const profile=await secure.refresh();const raw=await copyApi.capture({client:db,profile,products:f.rows.productos,tariffs:f.rows.tarifas_mensajeria,storage,token:secure.token(),secureData:secure});const saved=await copies.save(profile.id,raw,{profile,storage,consent:true,sessionUntil:secure.expiresAt(),localUntil:Date.now()+copyApi.AGE});secure.rememberOfflineProfile(saved.expiresAt);return profile;};
 return{f,root,storage,secure,copies,copyStore,queue,prepare,drain:()=>drainContext.drainPrivatePurges(),network:v=>online=v,adapter:()=>adapterApi.create({root,secureData:secure,copies})};
}
const order={lines:[{id:'pA',qty:1,price:100}],form:{nombre:'DEMO local pending',tel:'demo-phone',ci:'demo-id',dir:'DEMO address',municipio:'Centro Habana',localidad:'Centro',moneda:'USD (Efectivo)',vuelto:''}};
test('real synthetic login -> preparation -> expiry -> logout -> B isolation -> same A reauthentication retains two exact intentions',async()=>{
 const d=await device();await d.secure.login('Demo A','synthetic-only');await d.prepare();const first=await d.queue.save('actor-a',order),second=await d.queue.save('actor-a',{...order,form:{...order.form,nombre:'DEMO order 2'}});
 d.network(false);d.secure.clearSession('expired');assert.equal(d.secure.token(),null);assert.equal(await d.secure.restore(),null);assert.equal((await d.adapter().fallback()).owner,'actor-a');assert.equal((await d.queue.list('actor-a')).length,2);
 await d.secure.logout();assert.equal(d.secure.offlineProfile(),null);assert.equal(d.secure.preserveOfflineOrders('actor-a'),true);assert.equal(await d.drain(),true);assert.equal(await d.copies.read('actor-a',{profile:{id:'actor-a',nombre:'Demo A',rol:'gestor',parent_id:null}}),null);assert.equal((await d.queue.list('actor-a')).length,2);
 d.network(true);await d.secure.login('Demo B','synthetic-b');await d.prepare();assert.equal(pending.localOwner(d.storage),'actor-b');assert.equal((await d.queue.list('actor-b')).length,0);const shown=await d.adapter().fallback();assert.equal(shown.owner,'actor-b');assert.doesNotMatch(JSON.stringify(shown),/DEMO local pending|DEMO order 2/);
 await d.secure.logout();await d.drain();await d.secure.login('Demo A','synthetic-only');await d.prepare();const rows=await d.queue.list('actor-a');assert.deepEqual(rows.map(x=>x.intentId).sort(),[first.intentId,second.intentId].sort());assert.equal(d.f.writes,0);
 let callbackFailure;for(const row of rows)await d.queue.run('actor-a',async context=>{try{assert.equal((await d.secure.refresh()).id,'actor-a');const body={action:'checkout',table:'pedidos',inputs:[{gestor:'Demo A',proveedor:'A',cliente:row.form.nombre,telefono:row.form.tel,ci:row.form.ci,direccion:row.form.dir+' ('+row.form.localidad+')',municipio:row.form.municipio,origen:'Manual (Panel)',orden_dia:'A0000'+(rows.indexOf(row)+1),_lineas:row.lines.map(line=>({producto_id:line.id,cantidad:line.qty}))}],delivery:{pickup:false,municipio:row.form.municipio,localidad:row.form.localidad},intentId:row.intentId,intentCreatedAt:row.createdAt};const q=await d.secure.checkout({...body,operation:'quote'});assert.equal(q.error,null);await context.save({outcome:{attempt:q.data.attempt}});const receipt=await d.secure.checkout({...body,operation:'submit',attempt:q.data.attempt,quote:q.data.quote});assert.equal(receipt.error,null);await context.confirmed(receipt.data.confirmed);}catch(error){callbackFailure=error;throw error;}},row.id);if(callbackFailure)throw callbackFailure;
 assert.equal((await d.queue.list('actor-a')).every(row=>row.state==='confirmed'),true,JSON.stringify(await d.queue.list('actor-a')));assert.equal(d.f.writes,2);await d.queue.run('actor-a',()=>assert.fail('Confirmed rows must never resend'));assert.equal(d.f.writes,2);assert.deepEqual(d.f.rows.pedidos[0],d.f.historical);
});
test('evicted private copy cannot reopen a prepared private form; pending intentions survive independently',async()=>{
 const d=await device();await d.secure.login('Demo A','synthetic-only');const profile=await d.prepare();await d.queue.save(profile.id,order);d.network(false);await d.copies.clear(profile.id);assert.equal(await d.adapter().fallback(),null);assert.equal((await d.queue.list(profile.id)).length,1);assert.equal(d.f.writes,0);
 d.network(true);await d.prepare();assert.equal((await d.adapter().fallback()).owner,profile.id);
});
test('readiness rereads persisted work and refuses incomplete shell or storage eviction',async()=>{
 const d=await device();await d.secure.login('Demo A','synthetic-only');await d.prepare();let shellReady=true,notice='';
 const source=fs.readFileSync('js/pending-checkout-storefront.js','utf8'),start=source.indexOf('  async function checkReadiness()'),end=source.indexOf('  let purgePromise',start);
 class Channel{constructor(){const one=this.port1={onmessage:null,close(){}};this.port2={reply:data=>one.onmessage?.({data})};}}
 const context={readinessGeneration:0,preparedToken:'cached-token',localAccount:()=>pending.localOwner(d.storage),PTHSecureData:d.secure,copies:d.copies,token:()=>d.secure.token(),document:{getElementById:()=>null},readiness:text=>notice=text,setTimeout,clearTimeout,MessageChannel:Channel,navigator:{serviceWorker:{controller:{},ready:Promise.resolve({active:{postMessage:(_,ports)=>ports[0].reply({ready:shellReady})}})}}};
 vm.runInNewContext(source.slice(start,end),context);assert.equal(await context.checkReadiness(),true);assert.match(notice,/Listo para trabajar/);
 shellReady=false;assert.equal(await context.checkReadiness(),false);assert.match(notice,/aún no está listo/);
 shellReady=true;await d.copies.clear('actor-a');assert.equal(await context.checkReadiness(),false);assert.equal(context.preparedToken,null);assert.match(notice,/aún no está listo/);assert.equal(d.f.writes,0);
});
