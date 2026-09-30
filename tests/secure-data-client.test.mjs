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
test('restored administrative sessions keep administrative mode for every server role',async()=>{
 for(const rol of ['admin','administrador','superadmin','logistica','ADMIN']){
  const {context,storage}=client();storage.setItem('pth_secure_token','existing-token');
  context.fetch=async()=>({status:200,json:async()=>({data:{profile:{id:'existing-admin',nombre:'Admin',rol,parent_id:null,password:'__session__'}},error:null})});
  await context.PTHSecureData.restore();
  assert.equal(JSON.parse(storage.getItem('pth_session')).isAdmin,true,rol);
  assert.equal(storage.getItem('pth_secure_token'),'existing-token');
 }
});
test('a parent-linked admin-labelled profile remains nonadministrative on restore',async()=>{
 const {context,storage}=client();storage.setItem('pth_secure_token','existing-token');
 context.fetch=async()=>({status:200,json:async()=>({data:{profile:{id:'sub',rol:'admin',parent_id:'parent'}},error:null})});
 await context.PTHSecureData.restore();assert.equal(JSON.parse(storage.getItem('pth_session')).isAdmin,false);
});
test('a transient restore failure is not cached forever after the connection recovers',async()=>{
 const {context,storage,db}=client();storage.setItem('pth_secure_token','a'.repeat(64));
 let offline=true;const bodies=[];
 context.fetch=async(url,options)=>{
  const body=JSON.parse(options.body);bodies.push(body);
  if(offline)throw Error('Offline');
  return{status:200,json:async()=>body.action==='session'?{data:{profile:{id:'sub',nombre:'Sub',rol:'gestor',parent_id:'parent'}},error:null}:{data:[{id:'x',comision:15}],error:null}};
 };
 await assert.rejects(context.PTHSecureData.restore(),/conectar/);
 assert.equal(storage.getItem('pth_secure_token'),'a'.repeat(64));
 offline=false;
 const result=await db.from('productos').select('*');
 assert.equal(result.error,null);assert.equal(result.data[0].comision,15);
 assert.equal(bodies.filter(b=>b.action==='session').length,2);
 assert.equal(JSON.parse(storage.getItem('pth_session')).data.parent_id,'parent');
});
test('server restore errors do not become a public profile or dispatch a protected write',async()=>{
 const {context,storage,db}=client();storage.setItem('pth_secure_token','a'.repeat(64));let calls=0;
 context.fetch=async()=>{calls++;return{status:503,json:async()=>({data:null,error:{message:'Servicio temporalmente no disponible',code:'ACCESS_DENIED'}})};};
 const result=await db.from('productos').insert([{nombre:'No escribir'}]);
 assert.equal(calls,1);assert.equal(result.data,null);assert.equal(result.error.status,503);
 assert.equal(storage.getItem('pth_secure_token'),'a'.repeat(64));
});
test('invalid sessions are cleared and reported instead of querying as anonymous',async()=>{
 const {context,storage,db}=client();storage.setItem('pth_secure_token','a'.repeat(64));let calls=0;
 context.fetch=async()=>{calls++;return{status:401,json:async()=>({data:null,error:{message:'Inicia sesión de nuevo.',code:'SESSION_INVALID'}})};};
 const result=await db.from('productos').select('*');
 assert.equal(calls,1);assert.equal(result.error.code,'SESSION_INVALID');assert.equal(storage.getItem('pth_secure_token'),null);
});
test('concurrent restore callers share the attempt but can retry together after a failure',async()=>{
 const {context,storage}=client();storage.setItem('pth_secure_token','a'.repeat(64));let calls=0,offline=true;
 context.fetch=async()=>{calls++;if(offline)throw Error('Offline');return{status:200,json:async()=>({data:{profile:{id:'sub',rol:'gestor',parent_id:'parent'}},error:null})};};
 const failed=await Promise.allSettled([context.PTHSecureData.restore(),context.PTHSecureData.restore()]);
 assert.equal(calls,1);assert.ok(failed.every(r=>r.status==='rejected'));offline=false;
 const recovered=await Promise.all([context.PTHSecureData.restore(),context.PTHSecureData.restore()]);
 assert.equal(calls,2);assert.ok(recovered.every(p=>p.id==='sub'));
});
test('a delayed restore cannot resurrect a session after logout',async()=>{
 const {context,storage}=client();storage.setItem('pth_secure_token','a'.repeat(64));let release;
 context.fetch=()=>new Promise(resolve=>{release=()=>resolve({status:200,json:async()=>({data:{profile:{id:'old-account',nombre:'Old',rol:'gestor'}},error:null})});});
 const pending=context.PTHSecureData.restore();context.PTHSecureData.clearSession();release();
 await assert.rejects(pending);
 assert.equal(storage.getItem('pth_secure_token'),null);assert.equal(storage.getItem('pth_session'),null);
});
