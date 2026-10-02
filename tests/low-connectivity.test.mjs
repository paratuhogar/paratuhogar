import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import low from '../js/low-connectivity.js';
import recovery from '../js/checkout-recovery.js';
import guard from '../js/checkout-submit-guard.js';
import {validateQuery} from '../supabase/functions/secure-data/handler.mjs';
const memory=()=>{const values=new Map();return {values,getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,String(v)),removeItem:k=>values.delete(k)};};
const product={id:'p1',nombre:'Nevera <script>arbitrary submitted text</script>',precio:100,categoria:'HOGAR',disponible:'SI',thumbnail:'/test.jpg',comision:800,costo_proveedor:90,password:'never-store',cliente:'private',descripcion:'long text',nuevo_precio:500};
test('new public snapshot keeps public fields only; no financial, customer, description or credential persistence',()=>{
 const storage=memory(),store=low.create(storage,()=>1000);assert.equal(store.savePublic([product]),true);
 const serialized=storage.getItem(low.CATALOG_KEY);assert.doesNotMatch(serialized,/comision|costo_proveedor|password|cliente|descripcion|nuevo_precio/);
 assert.equal(store.readPublic().products[0].precio,100);assert.equal(store.readPublic().products[0].nombre,product.nombre);
 assert.equal(low.escape(product.nombre).includes('<script>'),false);
});
test('new draft isolation uses exact account IDs including accounts sharing a name; visitor and logout removal are separate',()=>{
 const storage=memory(),store=low.create(storage,()=>1000);
 store.saveDraft('id-A',[{...product,qty:2,telefono:'private',direccion:'private'}]);store.saveDraft('id-B',[{id:'p2',qty:1}]);store.saveDraft(null,[{id:'p3',qty:3}]);
 assert.deepEqual(store.readDraft('id-A').lines,[{id:'p1',qty:2}]);assert.deepEqual(store.readDraft('id-B').lines,[{id:'p2',qty:1}]);assert.deepEqual(store.readDraft(null).lines,[{id:'p3',qty:3}]);
 assert.doesNotMatch(storage.getItem(store.draftKey('id-A')),/nombre|precio|password|telefono|direccion|cliente|comision|token/);
 store.clearDraft('id-A');assert.equal(store.readDraft('id-A'),null);assert.ok(store.readDraft('id-B'));assert.ok(store.readDraft(null));
});
test('cache expiry, clock rollback, corruption and invalid line quantities fail safely',()=>{
 const storage=memory();let now=1000;const store=low.create(storage,()=>now);store.savePublic([product]);store.saveDraft('a',[{id:'p1',qty:1}]);
 now+=low.FRESH_AGE+1;assert.equal(store.readPublic().stale,true);now+=low.MAX_AGE;assert.equal(store.readPublic(),null);assert.equal(store.readDraft('a'),null);
 storage.setItem(low.CATALOG_KEY,'{corrupt');assert.equal(store.readPublic(),null);assert.equal(storage.getItem(low.CATALOG_KEY),null);
 now=1000;store.savePublic([product]);now=999;assert.equal(store.readPublic(),null);
 for(const qty of [0,-1,1.5,10001,Infinity])assert.equal(store.saveDraft('a',[{id:'p1',qty}]),false);
 assert.equal(store.saveDraft('a',[{id:'p1',qty:1},{id:'p1',qty:2}]),false);
 storage.setItem(store.draftKey('a'),JSON.stringify({version:1,savedAt:now,lines:'invalid'}));assert.equal(store.saveDraft('a',[{id:'p1',qty:1}]),true);
});
test('storage denial and quota do not throw or manufacture a saved draft',()=>{
 const store=low.create({getItem(){throw Error('private mode');},setItem(){throw Error('quota');},removeItem(){throw Error('quota');}});
 assert.equal(store.savePublic([product]),false);assert.equal(store.readPublic(),null);assert.equal(store.saveDraft('a',[{id:'p1',qty:1}]),false);assert.equal(store.readDraft('a'),null);assert.doesNotThrow(()=>store.clearDraft('a'));
});
test('manual data-saving choice overrides capabilities without requiring NetworkInformation',()=>{
 const store=low.create(memory());assert.equal(Boolean(store.saving()),false);assert.equal(store.saving({saveData:true}),true);assert.equal(store.saving({downlink:0.1}),true);store.setSaving(false);assert.equal(store.saving({saveData:true}),false);store.setSaving(true);assert.equal(store.saving(),true);
});
test('a receipt marker prevents a stale cart revision in another tab and remains account-specific',()=>{
 const store=low.create(memory(),()=>1000);store.markSent('a',900);assert.equal(store.wasSent('a',900),true);assert.equal(store.wasSent('b',900),false);assert.equal(store.wasSent('a',901),false);
});
test('anonymous compact download never reads storage, sends Authorization or returns partially paged results',async()=>{
 const calls=[];let release;const context={AbortController,Promise,JSON,setTimeout,clearTimeout};context.window=context;
 Object.defineProperty(context,'localStorage',{get(){assert.fail('public reader must not access credentials');}});
 context.fetch=async(url,options)=>{calls.push(options);if(calls.length===1)await new Promise(resolve=>release=resolve);const body=JSON.parse(options.body);validateQuery(body,null);return {ok:true,json:async()=>({data:body.range[0]===0?Array.from({length:1000},(_,i)=>({...product,id:'p'+i})):[{...product,id:'tail'}]})};};
 vm.runInNewContext(fs.readFileSync(new URL('../js/public-catalog-api.js',import.meta.url),'utf8'),context);
 const first=context.PTHPublicCatalog.fetch(),second=context.PTHPublicCatalog.fetch();assert.equal(first,second);release();assert.equal((await first).length,1001);assert.equal(calls.length,2);
 for(const options of calls){assert.equal(options.credentials,'omit');assert.equal(options.cache,'no-store');assert.equal(options.headers.Authorization,undefined);assert.doesNotMatch(JSON.parse(options.body).columns,/comision|costo|descripcion|password/);}
});
test('failed second catalogue page cannot publish a partial public cache and download can be retried',async()=>{
 let count=0;const context={AbortController,Promise,JSON,setTimeout,clearTimeout,fetch:async()=>{count++;return count===1?{ok:true,json:async()=>({data:Array(1000).fill(product)})}:{ok:false,json:async()=>({error:{message:'untrusted text'}})};}};context.window=context;
 vm.runInNewContext(fs.readFileSync(new URL('../js/public-catalog-api.js',import.meta.url),'utf8'),context);await assert.rejects(context.PTHPublicCatalog.fetch(),/copia pública/);await assert.rejects(context.PTHPublicCatalog.fetch());assert.equal(count,3);
});
test('retry outcomes require server evidence for every provider; partial, wrong token, missing and network errors stay unconfirmed',async()=>{
 const base={authenticated:true,table:'pedidos',token:'key',providers:['A','B'],codes:['A1','B1']};const receipt=provider=>({id:provider,proveedor:provider,submission_token:'key'});
 assert.equal((await recovery.check({...base,query:async()=>({data:[receipt('A'),receipt('B')]})})).kind,'confirmed');
 assert.equal((await recovery.check({...base,query:async()=>({data:[receipt('A')]})})).kind,'partial');
 assert.equal((await recovery.check({...base,query:async()=>({data:[{...receipt('A'),submission_token:'different'}]})})).kind,'absent');
 assert.equal((await recovery.check({...base,query:async()=>({error:{code:'NETWORK_ERROR'}})})).kind,'unknown');
 assert.equal((await recovery.check({...base,providers:[],codes:[],query:()=>assert.fail()})).kind,'unknown');
 assert.equal((await recovery.check({...base,authenticated:false,query:()=>assert.fail('no unauthorized receipt read')})).kind,'unavailable');
 for(const actor of [{id:'g',rol:'gestor'},{id:'s',parent_id:'g'},{id:'a',rol:'admin'}]){
   assert.doesNotThrow(()=>validateQuery({table:'pedidos',columns:'id,proveedor,submission_token,orden_dia',filters:[{method:'in',column:'orden_dia',value:base.codes}]},actor));
   assert.throws(()=>validateQuery({table:'pedidos',filters:[{method:'eq',column:'submission_token',value:'key'}]},actor),/privados/);
 }
});
test('submit keys are isolated across account changes and survive unavailable storage in the open tab',()=>{
 const storage=memory();let scope='a',id=0;const submit=guard.createCheckoutSubmitGuard(storage,()=>scope,()=> 'key'+(++id));
 const a=submit.acquire();scope='b';assert.equal(submit.acquire().accepted,false);submit.fail();const b=submit.acquire();assert.notEqual(a.token,b.token);submit.succeed();scope='a';assert.equal(submit.acquire().token,a.token);
 const denied=guard.createCheckoutSubmitGuard({getItem(){throw Error();},setItem(){throw Error();},removeItem(){throw Error();}},'a',()=> 'memory-key');assert.equal(denied.acquire().token,'memory-key');denied.fail();assert.equal(denied.acquire().token,'memory-key');
});
