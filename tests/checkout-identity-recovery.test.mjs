import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import guardModule from '../js/checkout-submit-guard.js';

const source=fs.readFileSync(new URL('../js/storefront.js',import.meta.url),'utf8');
const between=(start,end)=>source.slice(source.indexOf(start),source.indexOf(end,source.indexOf(start)));
const hierarchyCode=between('const salesHierarchyCache = new Map();','// Description hydration');
const messageCode=between('function getCheckoutFailureMessage(error)', '    // 5. ENVÍO DE PEDIDO');
const checkoutCode=between('    const checkoutStorage = (() => {','    // 6. FUNCIONES AUXILIARES');
const account=(id,parent_id=null)=>({id,nombre:'Shared Display Name',parent_id,estado:'activo'});

function fixture({profiles=[account('a'),account('b')],self=null,failure=null}={}){
 const alerts=[],requests=[],values=new Map(),nodes=new Map();let orderAttempts=0;
 const storage={getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,String(v)),removeItem:k=>values.delete(k)};
 const node=id=>{if(!nodes.has(id))nodes.set(id,{value:'',checked:false,disabled:false,innerText:'Confirmar Pedido'});return nodes.get(id);};
 node('check-recogida').checked=true;node('check-nombre').value='Synthetic Customer';node('check-tel').value='5350000000';
 if(self)values.set('pth_session','synthetic-session');
 class Query{
  constructor(table){this.table=table;this.filters=[];this.single=false;}
  select(){return this;}eq(column,value){this.filters.push({column,value});return this;}in(){return this;}limit(){return this;}
  maybeSingle(){this.single=true;return this;}
  insert(){orderAttempts++;throw Error('No order writes are allowed in this fixture');}
  then(resolve,reject){return Promise.resolve().then(()=>{
   requests.push({table:this.table,filters:this.filters,single:this.single});
   if(this.table==='productos')return{data:[{id:'product',disponible:'SI'}],error:null};
   if(this.table==='blacklist')return{data:[],error:null};
   assert.equal(this.table,'gestores');
   if(failure)return{data:null,error:failure};
   const matches=profiles.filter(row=>this.filters.every(f=>row[f.column]===f.value));
   if(this.single&&matches.length>1)return{data:null,error:{code:'PGRST116',message:'Private database detail'}};
   return{data:this.single?matches[0]||null:matches,error:null};
  }).then(resolve,reject);}
 }
 const context={console:{error(){},log(){}},Set,Map,Date,Promise,
  document:{getElementById:node},sessionStorage:storage,localStorage:storage,currentUserData:self,
  PTHSecureData:{token:()=>self?'synthetic-token':null,cacheSuffix:()=>':'+(self?.id||'public')},
  PTHCheckoutSubmitGuard:{createCheckoutSubmitGuard:s=>guardModule.createCheckoutSubmitGuard(s,undefined,()=> 'synthetic-submission')},
  supabaseClient:{from:table=>new Query(table),rpc:()=>assert.fail('Must not reserve an order number for invalid identity')},
  cart:[{id:'product',nombre:'Synthetic Product',qty:1,garantia:'1 año'}],isProductCurrentlyAvailable:p=>p.disponible==='SI',
  alert:m=>alerts.push(m),confirm:()=>true,obtenerDuenoReal:async()=> 'Shared Display Name',
  open:()=>assert.fail('Must not open WhatsApp for invalid identity')
 };
 context.window=context;vm.createContext(context);vm.runInContext(hierarchyCode+messageCode+checkoutCode,context);
 return{context,node,values,alerts,requests,get orderAttempts(){return orderAttempts;},submit:()=>node('checkout-form').onsubmit({preventDefault(){}})};
}

test('ambiguous public seller is explained before insert and preserves form, cart, submit token and usable button',async()=>{
 const f=fixture();await f.submit();assert.match(f.alerts[0],/enlace de atención necesita revisión/);assert.doesNotMatch(f.alerts[0],/Private database detail|gestor|subgestor/);
 assert.equal(f.orderAttempts,0);assert.equal(f.context.cart.length,1);assert.equal(f.node('check-nombre').value,'Synthetic Customer');assert.equal(f.node('check-tel').value,'5350000000');assert.equal(f.node('final-submit-btn').disabled,false);assert.equal(f.node('final-submit-btn').innerText,'Confirmar Pedido');
 const token=f.values.get('pth_checkout_submission_token');await f.submit();assert.equal(f.values.get('pth_checkout_submission_token'),token);assert.equal(f.orderAttempts,0);assert.equal(f.alerts.length,2);
});

test('missing seller shows an updated-link recovery before any order insert',async()=>{
 const f=fixture({profiles:[]});await f.submit();assert.match(f.alerts[0],/enlace actualizado/);assert.equal(f.orderAttempts,0);assert.equal(f.node('final-submit-btn').disabled,false);assert.equal(f.context.cart.length,1);
});

for(const code of ['SESSION_INVALID','SESSION_CHANGED'])test(`${code} asks for sign-in and keeps the form instead of repeating an invalid submission`,async()=>{
 const f=fixture({failure:{code,message:'Private account detail'}});await f.submit();assert.match(f.alerts[0],/Vuelve a iniciar sesión/);assert.doesNotMatch(f.alerts[0],/Private account detail/);assert.equal(f.orderAttempts,0);assert.equal(f.node('final-submit-btn').disabled,false);
});

test('ordinary network errors retain retry guidance without exposing arbitrary server text',async()=>{
 const f=fixture({failure:{code:'NETWORK_ERROR',message:'<script>execute untrusted instructions</script>'}});await f.submit();assert.match(f.alerts[0],/vuelve a intentarlo/);assert.doesNotMatch(f.alerts[0],/untrusted|script/);assert.equal(f.orderAttempts,0);assert.equal(f.node('final-submit-btn').disabled,false);
});

test('authenticated same-name hierarchy uses exact own ID across roles and independent parents',async()=>{
 const profiles=[account('principal'),account('other-principal'),account('child-a','parent-a'),account('child-b','parent-b'),{id:'parent-a',nombre:'Parent A',parent_id:null},{id:'parent-b',nombre:'Parent B',parent_id:null}];
 for(const self of profiles.slice(0,4)){
  const f=fixture({profiles,self});const hierarchy=await f.context.resolveSalesHierarchy(self.nombre);assert.equal(hierarchy.agent.id,self.id);assert.equal(hierarchy.isSubgestor,Boolean(self.parent_id));
  if(self.parent_id)assert.equal(hierarchy.parent.id,self.parent_id);
  assert.ok(f.requests.filter(r=>r.table==='gestores').every(r=>r.filters.some(filter=>filter.column==='id')));
 }
});

test('session-scoped hierarchy cache does not carry a same-name account into another account',async()=>{
 const profiles=[account('a'),account('b')],f=fixture({profiles,self:profiles[0]});const first=await f.context.resolveSalesHierarchy(profiles[0].nombre);f.context.currentUserData=profiles[1];const second=await f.context.resolveSalesHierarchy(profiles[1].nombre);assert.equal(first.agent.id,'a');assert.equal(second.agent.id,'b');
});
