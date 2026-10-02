import test from 'node:test';
import assert from 'node:assert/strict';
import {createHandler,hash} from '../supabase/functions/secure-data/handler.mjs';

// All accounts, sessions, products and orders below are synthetic and in memory.
const profile=(id,nombre,extra={})=>({id,nombre,rol:'gestor',estado:'activo',activo:true,parent_id:null,password:'synthetic-password',...extra});
const principals=[profile('principal-a','Shared Seller'),profile('principal-b','Shared Seller')];
const payload=(gestor='Shared Seller',extra={})=>({action:'query',table:'pedidos',op:'insert',returning:true,values:{gestor,proveedor:'Synthetic Provider',cliente:'Synthetic Customer',_lineas:[{producto_id:'product-1',cantidad:2}],costo_mensajeria:5,submission_token:'synthetic-submission',...extra}});

async function fixture({profiles=principals,actorId='principal-a',expired=false,failSellerRead=false}={}){
 const trace=[];let writes=0;
 const token='a'.repeat(64);
 const rows={gestores:structuredClone(profiles),pth_secure_sessions:[],productos:[{id:'product-1',nombre:'Synthetic Product',precio:100,comision:30,precio_flexible:'SI',proveedor:'Synthetic Provider',disponible:'SI'}],precios_personalizados:[{producto_id:'product-1',gestor:'Shared Seller',nuevo_precio:110,comision_subgestor:15,visible_subgestor:true}],pedidos:[],pedidos_subgestores:[]};
 if(actorId)rows.pth_secure_sessions.push({token_hash:await hash(token),gestor_id:actorId,credential_hash:await hash('synthetic-password'),expires_at:expired?'2000-01-01':'2099-01-01'});
 class Query{
  constructor(table){this.table=table;this.filters=[];this.op='select';this.single=false;this.returning=false;this.options={};this.max=Infinity;}
  select(_columns,options={}){this.returning=true;this.options=options;return this;}
  eq(column,value){this.filters.push({method:'eq',column,value});return this;}
  gt(column,value){this.filters.push({method:'gt',column,value});return this;}
  in(column,value){this.filters.push({method:'in',column,value});return this;}
  order(){return this;}range(){return this;}limit(max){this.max=max;return this;}
  maybeSingle(){this.single=true;return this;}
  insert(values){this.op='insert';this.values=Array.isArray(values)?values:[values];this.returning=false;return this;}
  then(resolve,reject){return Promise.resolve().then(()=>{
   trace.push({table:this.table,op:this.op,filters:this.filters});
   if(failSellerRead&&this.table==='gestores'&&trace.some(t=>t.table==='gestores')){
    const gestorReads=trace.filter(t=>t.table==='gestores');
    if(gestorReads.length>1)return{data:null,error:{code:'CONNECTION_ERROR',message:'Synthetic read interruption'}};
   }
   const matches=(rows[this.table]||[]).filter(row=>this.filters.every(f=>f.method==='eq'?row[f.column]===f.value:f.method==='gt'?row[f.column]>f.value:f.value.includes(row[f.column]))).slice(0,this.max);
   if(this.op==='insert'){
    // Match the existing unique(submission_token, proveedor) migration, no real DB writes.
    if(this.values.some(v=>v.submission_token!=null&&rows[this.table].some(r=>r.submission_token===v.submission_token&&r.proveedor===v.proveedor)))return{data:null,error:{code:'23505',message:'Synthetic unique constraint'}};
    writes++;rows[this.table].push(...structuredClone(this.values));return{data:this.returning?this.values:null,error:null};
   }
   if(this.single&&matches.length>1)return{data:null,error:{code:'PGRST116',message:'Synthetic multiple-row result'}};
   return{data:this.single?matches[0]||null:matches,error:null};
  }).then(resolve,reject);}
 }
 const handler=createHandler({db:{from:table=>new Query(table)}});
 async function request(body){const response=await handler(new Request('https://example.test',{method:'POST',headers:actorId?{Authorization:`Bearer ${token}`}:{},body:JSON.stringify(body)}));return{status:response.status,...await response.json()};}
 return{request,rows,trace,get writes(){return writes;}};
}

for(const actorId of ['principal-a','principal-b'])test(`own same-name principal resolves by verified session ID (${actorId})`,async()=>{
 const f=await fixture({actorId});const result=await f.request(payload('Shared Seller',{gestor_id:'principal-other',total:1,comision_total:999,estado:'Entregado',pago_gestor:'Pagado'}));
 assert.equal(result.status,200);assert.equal(result.error,null);assert.equal(f.writes,1);
 const order=f.rows.pedidos[0];assert.equal(order.total,225);assert.equal(order.comision_total,80);assert.equal(order.estado,'Pendiente');assert.equal(order.pago_gestor,'Pendiente');
 assert.equal(order.submission_token,'synthetic-submission');assert.equal('gestor_id' in order,false);
 const sellerReads=f.trace.filter(t=>t.table==='gestores');assert.equal(sellerReads.length,2);assert.ok(sellerReads.every(t=>t.filters.some(q=>q.column==='id'&&q.value===actorId)));
});

test('same name across principal and child roles resolves only own principal on direct orders',async()=>{
 const profiles=[profile('p','Shared Seller'),profile('s','Shared Seller',{parent_id:'p',rol:'admin'})];
 const f=await fixture({profiles,actorId:'p'});const result=await f.request(payload());assert.equal(result.status,200);assert.equal(f.rows.pedidos.length,1);assert.equal(f.rows.pedidos_subgestores.length,0);
});

test('same-name child cannot use principal direct-order route even when submitted IDs imitate principal',async()=>{
 const f=await fixture({profiles:[profile('p','Shared Seller'),profile('s','Shared Seller',{parent_id:'p',rol:'admin'})],actorId:'s'});
 const result=await f.request(payload('Shared Seller',{gestor_id:'p',subgestor_id:'p',parent_id:null}));assert.equal(result.status,403);assert.equal(f.writes,0);
});

test('child own queue remains scoped by ID and retains canonical parent and assigned share',async()=>{
 const f=await fixture({profiles:[profile('p','Shared Seller'),profile('s','Shared Seller',{parent_id:'p'}),profile('other','Shared Seller',{parent_id:'p'})],actorId:'s'});
 const body=payload();body.table='pedidos_subgestores';body.values={...body.values,subgestor_id:'s',comision_total:999,comision_subgestor:999,parent_gestor_id:'forged-parent'};
 const result=await f.request(body);assert.equal(result.status,200);assert.equal(result.error,null);assert.equal(f.writes,1);assert.equal(f.rows.pedidos.length,0);
 const order=f.rows.pedidos_subgestores[0];assert.equal(order.subgestor_id,'s');assert.equal(order.parent_gestor_id,'p');assert.equal(order.total,225);assert.equal(order.comision_total,80);assert.equal(order.comision_subgestor,30);assert.equal(result.data[0].comision_total,30);assert.equal(order.estado,'Pendiente Aprobacion');
});

test('child cannot create an order for a different same-name child',async()=>{
 const f=await fixture({profiles:[profile('p','Shared Seller'),profile('s','Shared Seller',{parent_id:'p'}),profile('other','Shared Seller',{parent_id:'p'})],actorId:'s'});
 const body=payload();body.table='pedidos_subgestores';body.values.subgestor_id='other';const result=await f.request(body);assert.equal(result.status,403);assert.match(result.error.message,/propias ventas/);assert.equal(f.writes,0);
});

test('child cannot submit Venta Directa',async()=>{
 const f=await fixture({profiles:[profile('p','Parent'),profile('s','Child',{parent_id:'p'})],actorId:'s'});const result=await f.request(payload('Venta Directa'));assert.equal(result.status,403);assert.equal(f.writes,0);
});

test(`keeps unique other-seller order routing and financial results`,async()=>{
 const f=await fixture({profiles:[profile('self','Self'),profile('other','Shared Seller')],actorId:'self'});const result=await f.request(payload());assert.equal(result.status,200);assert.equal(f.rows.pedidos[0].total,225);assert.equal(f.rows.pedidos[0].comision_total,80);assert.ok(f.trace.some(t=>t.table==='gestores'&&t.filters.some(q=>q.column==='nombre')));
});

test('authenticated different seller does not pick an arbitrary same-name duplicate',async()=>{
 const f=await fixture({profiles:[...principals,profile('self','Self')],actorId:'self'});const result=await f.request(payload('Shared Seller',{gestor_id:'principal-a'}));assert.equal(result.status,403);assert.equal(f.writes,0);
});

test(`keeps ambiguous public seller rejected without identity`,async()=>{
 const f=await fixture({actorId:null});const result=await f.request(payload('Shared Seller',{gestor_id:'principal-a'}));assert.equal(result.status,403);assert.equal(f.writes,0);
});

test(`keeps public unique seller and organic Venta Directa flows`,async()=>{
 const f=await fixture({profiles:[profile('only','Shared Seller')],actorId:null});const referred=await f.request(payload());assert.equal(referred.status,200);assert.equal(f.rows.pedidos[0].comision_total,80);
 const organic=await f.request(payload('Venta Directa',{submission_token:'organic'}));assert.equal(organic.status,200);assert.equal(f.rows.pedidos[1].comision_total,0);assert.equal(f.rows.pedidos[1].gestor,'Venta Directa');
});

for(const inactive of [{estado:'inactivo'},{activo:false}])test(`inactive own principal remains rejected (${JSON.stringify(inactive)})`,async()=>{
 const f=await fixture({profiles:[profile('principal-a','Shared Seller',inactive)]});const result=await f.request(payload());assert.equal(result.status,401);assert.equal(result.error.code,'SESSION_INVALID');assert.equal(f.writes,0);
});

test('inactive unique referred seller remains rejected',async()=>{
 const f=await fixture({profiles:[profile('self','Self'),profile('other','Shared Seller',{activo:false})],actorId:'self'});const result=await f.request(payload());assert.equal(result.status,403);assert.match(result.error.message,/activo/);assert.equal(f.writes,0);
});

test('expired and missing signed-in account sessions remain rejected',async()=>{
 for(const options of [{expired:true},{actorId:'missing'}]){const f=await fixture(options);const result=await f.request(payload());assert.equal(result.status,401);assert.equal(f.writes,0);}
});

test('read interruption fails closed without fallback to another seller or insert',async()=>{
 const f=await fixture({failSellerRead:true});const result=await f.request(payload());assert.equal(result.status,403);assert.equal(f.writes,0);
 assert.equal(f.trace.some(t=>t.table==='gestores'&&t.filters.some(q=>q.column==='nombre')),false);
});

test('unchanged idempotency token reaches insert and existing unique constraint errors are preserved in mock DB',async()=>{
 const f=await fixture();const first=await f.request(payload());const repeat=await f.request(payload());assert.equal(first.error,null);assert.equal(repeat.error.code,'23505');assert.equal(f.rows.pedidos.length,1);assert.equal(f.writes,1);
});

test('principal approval still uses own pending-order authorization and preserves stored amounts',async()=>{
 const f=await fixture({profiles:[profile('p','Shared Seller'),profile('s','Shared Seller',{parent_id:'p'})],actorId:'p'});
 const stored={id:'pending-test',parent_gestor_id:'p',parent_gestor_nombre:'Shared Seller',subgestor_nombre:'Shared Seller',cliente:'Synthetic',producto:'Stored Product',total:300,comision_total:50,comision_subgestor:15,proveedor:'Synthetic Provider'};f.rows.pedidos_subgestores.push(stored);
 const body=payload('Shared Seller',{id:'pending-test',subgestor_nombre:'Shared Seller',total:1,comision_total:999});const result=await f.request(body);assert.equal(result.error,null);const order=f.rows.pedidos[0];assert.equal(order.total,300);assert.equal(order.comision_total,50);assert.equal(order.comision_subgestor,15);assert.equal(order.comision_parent,35);
 assert.equal(f.trace.some(t=>t.table==='productos'),false);
});

test('different principal cannot approve another principal pending order',async()=>{
 const f=await fixture();f.rows.pedidos_subgestores.push({id:'pending-test',parent_gestor_id:'principal-b',parent_gestor_nombre:'Shared Seller',subgestor_nombre:'Child',comision_total:50,comision_subgestor:15});
 const result=await f.request(payload('Shared Seller',{id:'pending-test',subgestor_nombre:'Child'}));assert.equal(result.status,403);assert.equal(f.writes,0);
});

test('new own-ID path still validates current product availability and quantities',async()=>{
 for(const unavailable of [true,false]){const f=await fixture();const body=payload();if(unavailable)f.rows.productos[0].disponible='NO';else body.values._lineas[0].cantidad=0;const result=await f.request(body);assert.equal(result.status,403);assert.equal(f.writes,0);}
});

test('messenger role cannot gain direct-order write permission through own name',async()=>{
 const f=await fixture({profiles:[profile('m','Shared Seller',{rol:'mensajero'})],actorId:'m'});const result=await f.request(payload());assert.equal(result.status,403);assert.equal(f.writes,0);
});

for(const rol of ['gestor','admin','administrador','superadmin','logistica'])test(`own-order identity resolution covers supported principal role ${rol} without special account IDs`,async()=>{
 const profiles=Array.from({length:13},(_,i)=>profile(`account-${i}`,'Repeated Display Name',{rol}));
 const f=await fixture({profiles,actorId:'account-8'});const result=await f.request(payload('Repeated Display Name'));
 assert.equal(result.status,200);assert.equal(f.writes,1);assert.equal(f.rows.pedidos[0].gestor,'Repeated Display Name');
 assert.ok(f.trace.filter(t=>t.table==='gestores').every(t=>t.filters.some(q=>q.column==='id'&&q.value==='account-8')));
});

test('same-name accounts across independent parent teams preserve each child own ID and parent attribution',async()=>{
 const profiles=[profile('parent-a','Parent A'),profile('parent-b','Parent B'),profile('child-a','Repeated Child',{parent_id:'parent-a'}),profile('child-b','Repeated Child',{parent_id:'parent-b'})];
 for(const [actorId,parentId] of [['child-a','parent-a'],['child-b','parent-b']]){
  const f=await fixture({profiles,actorId});const body=payload('Repeated Child');body.table='pedidos_subgestores';body.values.subgestor_id=actorId;
  const result=await f.request(body);assert.equal(result.status,200);assert.equal(f.rows.pedidos_subgestores[0].subgestor_id,actorId);assert.equal(f.rows.pedidos_subgestores[0].parent_gestor_id,parentId);
 }
});

test('a name collision does not authorize a child order attributed to a different parent team',async()=>{
 const f=await fixture({profiles:[profile('parent-a','Parent A'),profile('parent-b','Parent B'),profile('child-a','Repeated Child',{parent_id:'parent-a'}),profile('child-b','Repeated Child',{parent_id:'parent-b'})],actorId:'child-a'});
 const body=payload('Repeated Child');body.table='pedidos_subgestores';body.values.subgestor_id='child-b';const result=await f.request(body);assert.equal(result.status,403);assert.equal(f.writes,0);
});
