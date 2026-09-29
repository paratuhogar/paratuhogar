import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
function client() {
 const requests=[];const items=new Map();
 const storage={getItem:k=>items.get(k)||null,setItem:(k,v)=>items.set(k,String(v)),removeItem:k=>items.delete(k),key:i=>[...items.keys()][i],get length(){return items.size;}};
 const sdk={from:table=>({direct:table}),rpc:name=>({direct:name})};
 const context={localStorage:storage,console,Set,Map,Promise,AbortSignal,URL,location:{origin:'https://paratuhogar.org'},fetch:async(url,options)=>{requests.push(JSON.parse(options.body));return{ok:true,status:200,json:async()=>({data:[],error:null})};},supabase:{createClient:()=>sdk}};
 context.window=context;
 vm.runInNewContext(fs.readFileSync(new URL('../js/secure-data.js',import.meta.url),'utf8'),context);
 return{context,requests,storage,db:context.supabase.createClient('https://example.supabase.co','public-key')};
}
test('protected queries always use the gateway with all filters and no direct fallback',async()=>{
 const {db,requests}=client();
 await db.from('pedidos').select('id,comision_total').eq('gestor','Fake').order('fecha',{ascending:false}).range(0,199);
 assert.equal(requests[0].action,'query');assert.equal(requests[0].table,'pedidos');assert.deepEqual(requests[0].range,[0,199]);
 assert.equal(db.from('categorias').direct,'categorias');
});
test('private RPC uses the gateway and cannot select another actor through browser credentials',async()=>{
 const {db,requests}=client();await db.rpc('mis_solicitudes_cobro',{p_gestor_id:'fake',p_password:'fake'});
 assert.equal(requests[0].action,'rpc');assert.equal(requests[0].name,'mis_solicitudes_cobro');
});
test('logout removes every account catalogue and token',()=>{
 const {context,storage}=client();storage.setItem('pth_catalogo_cache:parent','[{"comision":50}]');storage.setItem('pth_secure_token','secret');
 context.PTHSecureData.clearSession();assert.equal(storage.getItem('pth_secure_token'),null);assert.equal(storage.getItem('pth_catalogo_cache:parent'),null);
});
test('logout invalidates locally before an unfinished network revocation',()=>{
 const {context,storage}=client();context.fetch=()=>new Promise(()=>{});
 storage.setItem('pth_secure_token','secret');storage.setItem('pth_catalog_data','{"products":[{"comision":50}]}');
 context.PTHSecureData.logout();assert.equal(storage.getItem('pth_secure_token'),null);assert.equal(storage.getItem('pth_catalog_data'),null);
});
test('same account becoming subgestor invalidates its previous financial catalogue',async()=>{
 const {context,storage}=client();storage.setItem('pth_secure_token','secret');storage.setItem('pth_session',JSON.stringify({data:{id:'same',rol:'admin',parent_id:null}}));storage.setItem('pth_catalogo_cache:same','[{"comision":50}]');
 context.fetch=async()=>({status:200,json:async()=>({data:{profile:{id:'same',rol:'gestor',parent_id:'parent'}},error:null})});
 await context.PTHSecureData.restore();assert.equal(storage.getItem('pth_catalogo_cache:same'),null);
});
