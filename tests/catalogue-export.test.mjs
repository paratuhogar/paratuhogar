import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync(new URL('../js/sales-tools.js',import.meta.url),'utf8');
const start=source.indexOf('let catalogExportOpening = false;');
const code=source.slice(start,source.indexOf('root.PTHSalesTools=',start));
function fixture(){
 const values=new Map(),alerts=[],locations=[],products=[{id:'p1',nombre:'Equipo',precio:100,comision:50,costo_proveedor:80,proveedor:'INTERNAL',disponible:'SI',descripcion:'Descripción',thumbnail:'photo.jpg'}];
 let token='session-a',hydration=Promise.resolve(),writesFail=false;
 const btn={innerHTML:'PDF',disabled:false},profile={id:'a',nombre:'Asesor',telefono:'5350000000'};
 const context={Date,JSON,Set,Map,Promise,catalogLoadError:null,productsLoadInProgress:false,activeCategory:'TODOS',
  document:{getElementById:()=>btn},alert:m=>alerts.push(m),confirm:()=>true,
  PTHSecureData:{token:()=>token,restore:async()=>profile},ensureProductDescriptions:()=>hydration,
  getProductsVisibleOnScreen:()=>products,trackSpy(){},location:{assign:path=>locations.push(path)},
  localStorage:{setItem:(k,v)=>{if(writesFail)throw Error('QuotaExceededError');values.set(k,v);}}
 };context.window=context;vm.runInNewContext(code,context);
 return{context,values,alerts,locations,products,btn,run:()=>context.downloadCatalogPDF(),token:v=>{token=v;},hydrate:v=>{hydration=v;},writesFail:()=>{writesFail=true;}};
}
test('PDF opens in the same tab at a root URL after description hydration; only commercial fields transfer',async()=>{
 const f=fixture();await f.run();
 assert.deepEqual(f.locations,['/catalog-maker.html?v=20261002-catalog1']);
 const payload=JSON.parse(f.values.get('pth_catalog_data'));assert.equal(payload.products[0].precio,100);
 for(const field of ['comision','costo_proveedor','proveedor'])assert.equal(Object.hasOwn(payload.products[0],field),false);
 assert.equal(f.btn.disabled,false);assert.equal(f.btn.innerHTML,'PDF');assert.deepEqual(f.alerts,[]);
});
test('duplicate clicks share one opening; changing session during hydration prevents export',async()=>{
 const f=fixture();let release;f.hydrate(new Promise(resolve=>{release=resolve;}));
 const first=f.run();await Promise.resolve();await f.run();f.token('session-b');release();await first;
 assert.equal(f.locations.length,0);assert.equal(f.values.size,0);assert.equal(f.btn.disabled,false);
 assert.match(f.alerts[0],/sesión cambió/);
});
test('description failure and full storage unlock PDF retry rather than silently doing nothing',async()=>{
 const f=fixture();f.hydrate(Promise.reject(Error('Descripción no disponible')));await f.run();
 assert.equal(f.locations.length,0);assert.match(f.alerts[0],/Descripción no disponible/);assert.equal(f.btn.disabled,false);
 f.hydrate(Promise.resolve());await f.run();assert.equal(f.locations.length,1);
 const full=fixture();full.writesFail();await full.run();assert.equal(full.locations.length,0);assert.match(full.alerts[0],/no tiene espacio/);assert.equal(full.btn.disabled,false);
});
test('an empty, loading or failed catalogue cannot export an old partial selection',async()=>{
 for(const state of ['empty','loading','error']){
  const f=fixture();if(state==='empty')f.products.length=0;if(state==='loading')f.context.productsLoadInProgress=true;if(state==='error')f.context.catalogLoadError={error:'failed'};
  await f.run();assert.equal(f.locations.length,0);assert.equal(f.values.size,0);assert.equal(f.alerts.length,1);
 }
});
