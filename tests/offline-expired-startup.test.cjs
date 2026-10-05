const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
test('expired restoration resolving null still adopts prepared local profile before setupSession',async()=>{
 const src=fs.readFileSync('js/storefront.js','utf8');const start=src.indexOf('    try {\n        if (navigator.onLine === false || !window.PTHSecureData.token()');const end=src.indexOf('    initAutoSaveSystem();',start);
 let active=null,called=0,setup=null;
 const profile={id:'actor-a',nombre:'Demo A',rol:'gestor',estado:'activo',password:'__session__'};
 const secure={token:()=>null,offlineProfile:()=>profile,restore:async()=>null};let initial=true;secure.token=()=>initial?'a'.repeat(64):null;secure.restore=async()=>{initial=false;return null;};
 const offlineStorefront={fallback:async()=>{called++;active={profile};return active;},current:()=>active};
 const ctx={navigator:{onLine:true},window:{PTHSecureData:secure},offlineStorefront,localStorage:{getItem:()=>null},setupSession:(name,admin)=>{setup={name,admin};},loadInternalAssets(){},loadProducts(){},renderLowConnectivityPanel(){},showCatalogLoadError(){},document:{getElementById:()=>null}};
 await vm.runInNewContext('(async()=>{'+src.slice(start,end)+'})()',ctx);
 assert.equal(called,1);assert.deepEqual(setup,{name:'Demo A',admin:false});assert.equal(ctx.window.currentUserData.id,'actor-a');
});
test('prepared local view uses familiar gestor product cards without a server session',()=>{
 const src=fs.readFileSync('js/storefront.js','utf8');const start=src.indexOf('function isGestorCatalogMode()');const end=src.indexOf('\nfunction isRecentCatalogProduct',start);
 const ctx={window:{gestorName:'Demo A'},localStorage:{getItem:()=>null},offlineStorefront:{usingCopy:()=>true,current:()=>({owner:'actor-a'})}};
 assert.equal(vm.runInNewContext(src.slice(start,end)+'\nisGestorCatalogMode()',ctx),true);
 ctx.offlineStorefront.current=()=>({owner:null});assert.equal(vm.runInNewContext(src.slice(start,end)+'\nisGestorCatalogMode()',ctx),false);
});
test('checkout keeps own CRM tools visible in a prepared expired-session view',()=>{
 const src=fs.readFileSync('js/storefront.js','utf8');const start=src.indexOf("        const session = localStorage.getItem('pth_session');",src.indexOf('LÓGICA DE VISIBILIDAD'));const end=src.indexOf('\n    }\n}',start);
 let hidden=true;const ctx={localStorage:{getItem:()=>null},isGestorCatalogMode:()=>true,document:{getElementById:()=>({classList:{remove:()=>hidden=false,add:()=>hidden=true}})}};
 vm.runInNewContext(src.slice(start,end),ctx);assert.equal(hidden,false);
});
