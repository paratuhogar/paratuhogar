import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const id='12345678-1234-4234-8234-123456789abc', other='12345678-1234-4234-8234-123456789abd';
const source=file=>fs.readFileSync(new URL('../'+file,import.meta.url),'utf8');
const opaque=(n,t='5350000000')=>Buffer.from(JSON.stringify({n,t})).toString('base64url');
function fixture(search='',initial={},fetcher=async()=>({ok:false}),blocked=false) {
 const values=new Map(Object.entries(initial)),listeners={},clicks={};
 const anchor=href=>({dataset:{},href,getAttribute(){return this.href;},setAttribute(k,v){if(k==='href')this.href=v;}});
 const links=['/producto/equipo/','/?search=Equipo&accion=pedido','/categoria/cocina/','https://example.test/document.pdf','#','/?ref='+other].map(anchor);
 const root={location:new URL('https://paratuhogar.org/categoria/energia/'+search),localStorage:{
  getItem(k){if(blocked)throw Error('blocked');return values.get(k)||null;},setItem(k,v){if(blocked)throw Error('blocked');values.set(k,v);},removeItem(k){values.delete(k);}
 },atob,fetch:fetcher,setTimeout,clearTimeout,addEventListener:(n,f)=>listeners[n]=f};
 root.history={state:null,replaceState(state,title,url){root.location=new URL(url,root.location.origin);}};
 root.document={querySelectorAll:()=>links,getElementById:()=>({textContent:JSON.stringify({url:'https://fixture.supabase.co',key:'public-fixture'})}),addEventListener:(n,f)=>clicks[n]=f};
 const context=vm.createContext({window:root,URL,URLSearchParams,Date,TextDecoder,Uint8Array,AbortController});
 vm.runInContext(source('js/affiliate-links.js'),context);
 vm.runInContext(source('js/seo-affiliate-navigation.js'),context);
 return {root,values,links,listeners,clicks,context,A:root.PTHAffiliate,ready:root.PTHSeoAffiliate.ready};
}
test('current UUID/contact and legacy names/opaque data share no artificial TTL and preserve navigation',async()=>{
 for(const query of ['?ref='+id+'&contact=5350000000','?gestor=Alina%20Rodr%C3%ADguez&tel=5350000000','?ref=Alina%20Rodr%C3%ADguez&contact=5350000000','?r='+opaque('Alina Rodríguez')]){
  const f=fixture(query+'&catalog_q=bateria#fotos');await f.ready;
  const record=f.A.read();assert.equal(record.expiresAt,null);assert.equal(record.telefono,'5350000000');
  assert.equal(f.root.location.search,'?catalog_q=bateria');assert.equal(f.root.location.hash,'#fotos');
  assert.equal(new URL(f.links[0].href).searchParams.get('ref'),record.id||record.nombre);
  assert.equal(new URL(f.links[1].href).searchParams.get('accion'),'pedido');
  assert.equal(new URL(f.links[1].href).searchParams.get('search'),'Equipo');
  assert.equal(f.links[3].href,'https://example.test/document.pdf');assert.equal(f.links[4].href,'#');
  assert.equal(new URL(f.links[5].href,'https://paratuhogar.org').searchParams.get('ref'),other,'explicit destination is preserved');
  const next=fixture(new URL(f.links[0].href).search,Object.fromEntries(f.values));await next.ready;
  assert.equal(next.A.read().nombre,record.nombre);assert.equal(next.A.read(99999999999999).expiresAt,null);
 }
});
test('direct/no-ref visits retain last link; explicit new ref wins; removal and expired legacy memory stay removed',async()=>{
 const first=fixture('?ref='+id);await first.ready;
 const direct=fixture('',Object.fromEntries(first.values));await direct.ready;assert.equal(direct.A.read().id,id);
 const last=fixture('?ref='+other+'&r='+opaque('old'),Object.fromEntries(first.values));await last.ready;assert.equal(last.A.read().id,other);
 last.A.clear();last.clicks.click();assert.equal(new URL(last.links[0].href).searchParams.has('ref'),false);
 for(const initial of [{},{pth_referrer_smart:JSON.stringify({nombre:'expired',expiresAt:1}),pth_referrer:JSON.stringify({nombre:'older'})}]){
  const f=fixture('',initial);await f.ready;assert.equal(f.A.read(),null);assert.equal(new URL(f.links[0].href).search,'');
 }
 const fresh=fixture('?ref='+id);await fresh.ready;fresh.A.remember({id:other,nombre:other});fresh.listeners.storage({key:'pth_referrer_smart'});
 assert.equal(new URL(fresh.links[0].href).searchParams.get('ref'),other);
 fresh.A.clear();fresh.listeners.storage({key:null});assert.equal(new URL(fresh.links[0].href).search,'');
});
test('malformed input cannot replace memory or execute and disabled storage still carries an explicit link',async()=>{
 for(const query of ['?r=not_json','?ref='+'a'.repeat(201),'?s=bad!']){
  const f=fixture(query,{pth_referrer_smart:JSON.stringify({version:2,nombre:id,id,expiresAt:null})});await f.ready;
  assert.equal(f.A.read().id,id);
 }
 const f=fixture('?ref='+id+'&contact=5350000000',{},undefined,true);await f.ready;
 assert.equal(f.A.read(),null);assert.equal(new URL(f.links[0].href).searchParams.get('ref'),id);
 assert.equal(new URL(f.links[0].href).searchParams.get('contact'),'5350000000');
 const data=fixture('?ref='+encodeURIComponent('<script>globalThis.RUN=1</script>'));await data.ready;
 assert.equal(globalThis.RUN,undefined);assert.equal(new URL(data.links[0].href).searchParams.get('ref'),'<script>globalThis.RUN=1</script>');
});
test('short links parse current UUID/contact, old tel and opaque payload, with public credentials only',async()=>{
 const inputs=[{original_url:'https://paratuhogar.org/?ref='+id+'&contact=5350000000',gestor:'Old name'},
  {original_url:'https://paratuhogar.org/?gestor=Alina&tel=5350000000',gestor:'Alina'},
  {original_url:'https://paratuhogar.org/?r='+opaque('Alina'),gestor:'Alina'},
  {original_url:'https://paratuhogar.org/?tel=5350000000',gestor:'Alina'},
  {original_url:'broken',gestor:'Alina'}];
 for(const record of inputs){
  let request;const f=fixture('?s=abc_123',{pth_session:'PRIVATE_SESSION'},async(url,options)=>{request={url,options};return {ok:true,json:async()=>[record]};});await f.ready;
  assert.equal(f.A.read().nombre,record.original_url.includes(id)?id:'Alina');assert.equal(f.A.read().expiresAt,null);
  if(record.original_url!=='broken')assert.equal(f.A.read().telefono,'5350000000');
  assert.equal(request.options.credentials,'omit');assert.equal(request.options.referrerPolicy,'no-referrer');
  assert.equal(request.options.headers.Authorization,'Bearer public-fixture');assert.doesNotMatch(request.url,/PRIVATE_SESSION/);
  assert.equal(f.root.location.search,'');assert.equal(new URL(f.links[0].href).searchParams.has('s'),false);
 }
});
test('short interruption keeps navigation usable and a late response never replaces a newer referral',async()=>{
 let resolve;const pending=new Promise(r=>resolve=r);
 const f=fixture('?s=slow',{},()=>pending);
 assert.equal(new URL(f.links[0].href).searchParams.get('s'),'slow','new-tab navigation carries pending code');
 f.A.remember({id:other,nombre:other});resolve({ok:true,json:async()=>[{original_url:'https://paratuhogar.org/?ref='+id}]});await f.ready;
 assert.equal(f.A.read().id,other);assert.equal(new URL(f.links[0].href).searchParams.get('ref'),other);
 for(const fetcher of [async()=>{throw Error('offline');},async()=>({ok:false}),async()=>({ok:true,json:async()=>[]})]){
  const failed=fixture('?s=retry',{},fetcher);await failed.ready;assert.equal(failed.A.read(),null);
  assert.equal(new URL(failed.links[0].href).searchParams.get('s'),'retry');
 }
});
test('attribution does not change consent or send contact/referral data to existing analytics',async()=>{
 for(const consent of ['denied','granted']){
  const f=fixture('?ref='+id+'&contact=5350000000',{pth_analytics_consent:consent});await f.ready;
  const scripts=[];const element=tag=>({tag,children:[],appendChild(child){this.children.push(child);},setAttribute(){},addEventListener(){}});
  Object.assign(f.root.document,{readyState:'complete',referrer:'https://example.test/?PRIVATE=1',cookie:'',createElement:element,head:{appendChild:child=>scripts.push(child)},body:element('body')});
  f.context.document=f.root.document;
  vm.runInContext(source('js/google-measurement.js'),f.context);
  assert.equal(f.values.get('pth_analytics_consent'),consent);assert.equal(f.A.read().id,id);
  assert.equal(scripts.filter(s=>s.tag==='script').length,consent==='granted'?1:0);
  assert.doesNotMatch(JSON.stringify(f.root.dataLayer||[]),new RegExp(id+'|5350000000|PRIVATE|contact='));
  if(consent==='denied')assert.equal(f.root.PTHAnalytics.event('view_item'),false);
 }
});

function storefrontFixture(existing=[],locked=false){
 const src=source('js/storefront.js'),calls=[],product={nombre:'Equipo',precio:100,disponible:'SI',categoria:'ENERGIA',mensajeria:'3'};
 const elements={'cart-count':{},'detail-client-consult':{focus:()=>calls.push('focus-consult')},'crm-search':{focus(){}}};
 const context=vm.createContext({window:{PTHPendingCheckoutUI:{cartLocked:()=>locked,message:()=>calls.push('locked')},PTHAnalytics:{event:name=>calls.push('event:'+name)}},
  document:{getElementById:id=>elements[id]},Number,URLSearchParams,cart:existing,selectedProduct:product,setTimeout:()=>{},alert:()=>calls.push('alert'),
  isProductCurrentlyAvailable:p=>p?.disponible==='SI',openDetail:()=>calls.push('detail'),closeDetail:()=>calls.push('close'),toggleCartModal:()=>calls.push('cart'),captureGhostLead:()=>calls.push('write-lead')});
 const start=src.indexOf('let productLinkActionConsumed = false;');
 vm.runInContext(src.slice(start,src.indexOf('function consultSelectedProduct()',start)),context);
 const add=src.indexOf('   function addItemToCart(');vm.runInContext(src.slice(add,src.indexOf('// --- AÑADE ESTA FUNCIÓN',add)),context);
 return {context,calls,product,cart:existing};
}
test('safe pedido prepares one local line, keeps an existing quantity, never submits or captures a lead',()=>{
 const f=storefrontFixture(),params=new URLSearchParams('search=Equipo&accion=pedido');f.context.openSharedProduct(f.product,params);
 assert.equal(f.cart.length,1);assert.equal(f.cart[0].qty,1);assert.equal(f.cart[0].precio_venta,100);
 assert.deepEqual(f.calls,['detail','close','cart']);f.context.openSharedProduct(f.product,params);assert.equal(f.cart[0].qty,1);
 const existing=storefrontFixture([{...f.product,qty:4,shipping_linea:12,precio_venta:100}]);existing.context.openSharedProduct(existing.product,params);
 assert.equal(existing.cart[0].qty,4);assert.equal(existing.cart[0].shipping_linea,12);
 const locked=storefrontFixture([],true);locked.context.openSharedProduct(locked.product,params);assert.equal(locked.cart.length,0);assert.deepEqual(locked.calls,['detail','locked']);
});
test('consultation needs a user click; invalid/multiple actions, mismatched, unavailable and no-ref links cannot mutate cart',()=>{
 const consult=storefrontFixture();consult.context.openSharedProduct(consult.product,new URLSearchParams('search=Equipo&accion=consultar'));assert.deepEqual(consult.calls,['detail','focus-consult']);assert.equal(consult.cart.length,0);
 for(const query of ['search=Equipo','search=Equipo&accion=eval()','search=Equipo&accion=pedido&accion=consultar','search=Otro&accion=pedido','search=Equipo&search=Otro&accion=pedido']){
  const f=storefrontFixture();f.context.openSharedProduct(f.product,new URLSearchParams(query));assert.deepEqual(f.calls,['detail']);assert.equal(f.cart.length,0);
 }
 for(const product of [{disponible:'NO'},{precio:0},{precio:'NaN'}]){
  const f=storefrontFixture();f.context.openSharedProduct({...f.product,...product},new URLSearchParams('search=Equipo&accion=pedido'));assert.equal(f.cart.length,0);
 }
 const manual=storefrontFixture();manual.context.addItemToCart();assert.equal(manual.cart.length,1);assert.ok(manual.calls.includes('write-lead'),'existing explicit-click path unchanged');
});
