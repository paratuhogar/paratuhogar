import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const start=html.indexOf('let productsLoadInProgress = false;');
const code=html.slice(start,html.indexOf('// --- FUNCIONES DE APOYO PARA EL RASTREO IP ---',start));
const renderStart=html.indexOf('const CATALOG_PAGE_SIZE = 24;');
const renderCode=html.slice(renderStart,html.indexOf('function loadMoreCatalogProducts()',renderStart));
function fixture(){
 const requests=[],values=new Map([['pth_privacy_schema','commission-v1'],['pth_secure_token','a'.repeat(64)]]);
 const nodes=new Map();
 const node=id=>{if(!nodes.has(id))nodes.set(id,{textContent:'',innerHTML:'',value:'',classList:{add(){},remove(){}},focus(){},addEventListener(event,listener){this[event]=listener;},querySelector(selector){return node(selector);}});return nodes.get(id);};
 const profile={id:'sub',nombre:'Sub de Jomil',parent_id:'principal',parent_nombre:'Jomil',rol:'gestor',estado:'activo'};
 const storage={getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,String(v)),removeItem:k=>values.delete(k),key:i=>[...values.keys()][i],get length(){return values.size;}};
 let failParent=false,failProducts=false,failPrices=false,networkFailure=false,productReads=0;
 const sdk={from:table=>{assert.equal(table,'control_sistema');return{select(){return this;},eq(){return this;},maybeSingle:async()=>({data:{valor:'2026-09-30T23:00:00Z'},error:null})}},rpc(){throw Error('Unexpected RPC');}};
 const context={console:{log(){},error(){}},Set,Map,Promise,URL,URLSearchParams,AbortSignal,Date,
  localStorage:storage,document:{getElementById:node},location:{origin:'https://paratuhogar.org',search:''},
  gestorName:profile.nombre,currentUserData:profile,productosRaw:[],catalogSourceProducts:[],catalogLastSyncAt:null,
  supabase:{createClient:()=>sdk},registrarRastroIP(){},renderCategories(){node('category-list').textContent='ENERGÍA';},
  renderProducts(){node('productos-container').textContent='Catálogo cargado';},updateGestorSalesPulse(){},renderGestorPricing(){},
  openLoginModal(){node('login-overlay').opened=true;},
  fetch:async(url,options)=>{
   assert.ok(url.endsWith('/functions/v1/secure-data'));
   const body=JSON.parse(options.body);requests.push(body);
   if(networkFailure)throw Error('Offline');
   let data,error=null,status=200;
   if(body.action==='session')data={profile};
   else if(body.table==='gestores'){
    if(body.filters.some(f=>f.column==='id'&&f.value==='principal')){
     data=failParent?null:{id:'principal',nombre:'Jomil',estado:'activo',parent_id:null};
     if(failParent){error={message:'Consulta del principal no disponible',code:'ACCESS_DENIED'};status=503;}
    }else data=profile;
   }else if(body.table==='productos'){
    productReads++;
    data=failProducts?null:[{id:'equipo',nombre:'Equipo',precio:100,comision:15,disponible:'SI',categoria:'ENERGÍA',precio_flexible:'NO'}];
    if(failProducts){error={message:'No se pudo consultar tu comisión asignada.',code:'ACCESS_DENIED'};status=503;}
   }else if(body.table==='precios_personalizados'){
    data=failPrices?null:[{producto_id:'equipo',nuevo_precio:100,comision_subgestor:15,visible_subgestor:true}];
    if(failPrices){error={message:'No se pudo actualizar la configuración asignada',code:'NETWORK_ERROR'};status=503;}
   }else throw Error('Unexpected table '+body.table);
   return{status,json:async()=>({data,error})};
  }
 };
 context.window=context;
 vm.runInNewContext(fs.readFileSync(new URL('../js/secure-data.js',import.meta.url),'utf8'),context);
 context.supabaseClient=context.supabase.createClient();
 vm.runInNewContext(code,context);
 return{context,nodes,requests,storage,node,load:()=>context.loadProducts(),get productReads(){return productReads;},failParent:v=>{failParent=v;},failProducts:v=>{failProducts=v;},failPrices:v=>{failPrices=v;},networkFailure:v=>{networkFailure=v;}};
}
test('a hierarchy failure is caught, unlocks catalogue loading and permits a later successful load',async()=>{
 const f=fixture();f.failParent(true);await f.load();
 assert.equal(vm.runInNewContext('productsLoadInProgress',f.context),false);
 assert.match(f.node('[data-catalog-error-message]').textContent,/principal no disponible/);
 assert.equal(f.productReads,0);f.failParent(false);await f.load();
 assert.equal(f.context.productosRaw.length,1);assert.equal(f.context.productosRaw[0].comision,'15.00');
 assert.equal(f.context.activeSalesHierarchy.pricingOwnerName,'Jomil');
});
test('a restored connection loads the assigned catalogue without reentering a password',async()=>{
 const f=fixture();f.networkFailure(true);await f.load();
 assert.equal(vm.runInNewContext('productsLoadInProgress',f.context),false);
 f.networkFailure(false);await f.load();
 assert.equal(f.context.productosRaw.length,1);assert.equal(f.storage.getItem('pth_secure_token'),'a'.repeat(64));
 assert.equal(f.context.productosRaw[0].comision,'15.00');
});
test('product failures show a safe real error and a working retry, not an empty-stock message',async()=>{
 const f=fixture();f.failProducts(true);await f.load();
 assert.match(f.node('[data-catalog-error-message]').textContent,/comisión asignada/);
 assert.equal(typeof f.node('[data-catalog-retry]').click,'function');
 assert.doesNotMatch(f.node('productos-container').innerHTML,/No encontramos productos/);
 f.failProducts(false);await f.node('[data-catalog-retry]').click();
 assert.equal(f.context.productosRaw.length,1);assert.equal(f.productReads,2);
});
test('failed personalized prices are not silently rendered as zero assigned commission',async()=>{
 const f=fixture();f.failPrices(true);await f.load();
 assert.match(f.node('[data-catalog-error-message]').textContent,/configuración asignada/);
 f.failPrices(false);await f.load();assert.equal(f.context.productosRaw[0].comision,'15.00');
});
test('subgestor refresh never reuses a stale personal catalogue after a price change',async()=>{
 const f=fixture();await f.load();await f.load();
 assert.equal(f.productReads,2);assert.equal(f.context.productosRaw[0].comision,'15.00');
 assert.ok(f.requests.every(r=>r.action==='session'||r.table!=='precios_personalizados'||r.filters.some(x=>x.column==='gestor'&&x.value==='Jomil')));
});
test('filter rendering preserves the failure state and never replaces it with an empty catalogue',async()=>{
 const f=fixture();f.failProducts(true);await f.load();
 f.context.getFilteredCatalogProducts=()=>{throw Error('Must not filter a failed catalogue');};
 f.context.renderCatalogProducts=()=>{throw Error('Must not render a failed catalogue');};
 vm.runInNewContext(renderCode,f.context);
 f.context.renderProducts();
 assert.match(f.node('[data-catalog-error-message]').textContent,/comisión asignada/);
 assert.match(f.node('productos-container').innerHTML,/Reintentar catálogo/);
});
test('error rendering uses text and exposes the correct recovery action for setup and invalid sessions',async()=>{
 const f=fixture();let reloads=0;f.context.location.reload=()=>{reloads++;};
 f.context.showCatalogLoadError({message:'<img src=x onerror=alert(1)>'},true);
 assert.equal(f.node('[data-catalog-error-message]').textContent,'<img src=x onerror=alert(1)>');
 assert.doesNotMatch(f.node('productos-container').innerHTML,/onerror/);
 await f.node('[data-catalog-retry]').click();assert.equal(reloads,1);
 f.context.showCatalogLoadError({message:'Sesión caducada',code:'SESSION_INVALID',status:401});
 assert.equal(f.node('[data-catalog-retry]').textContent,'Volver a entrar');
 await f.node('[data-catalog-retry]').click();assert.equal(f.node('login-overlay').opened,true);
 assert.equal(reloads,1);
});
test('sorting cannot discard the error card or display a partially assigned catalogue',async()=>{
 const f=fixture();f.failParent(true);await f.load();
 Object.assign(f.context,{isGestorCatalogMode:()=>false,renderGestorCatalogSummary(){},getFilteredCatalogProducts:()=>[],activeCategory:'TODOS',trackSpy(){}});
 const cardsStart=html.indexOf('function renderCatalogProducts(list)');
 vm.runInNewContext(html.slice(cardsStart,html.indexOf('const CATALOG_PAGE_SIZE =',cardsStart)),f.context);
 const sortStart=html.indexOf('function applySort()');
 vm.runInNewContext(html.slice(sortStart,html.indexOf('function getProductForQuickAction(',sortStart)),f.context);
 f.context.applySort();
 assert.match(f.node('productos-container').innerHTML,/Reintentar catálogo/);
 assert.doesNotMatch(f.node('productos-container').innerHTML,/No encontramos productos/);
});
