import test from 'node:test';import assert from 'node:assert/strict';
import {createHandler,hash} from '../supabase/functions/secure-data/handler.mjs';
const token='a'.repeat(64);
async function setup({maxPriceIds=Infinity,failPriceId=null}={}){
 const rows={pth_secure_sessions:[{token_hash:await hash(token),gestor_id:'s',credential_hash:await hash('test-only-password'),expires_at:'2099-01-01'}],gestores:[{id:'s',nombre:'Sub',parent_id:'p',estado:'activo',rol:'admin',password:'test-only-password'},{id:'p',nombre:'Parent',estado:'activo',password:'never-show',rol:'gestor'}],productos:[{id:'x',nombre:'Equipo',precio:100,comision:40,precio_flexible:'SI',costo_proveedor:60,proveedor:'B',disponible:'SI'}],precios_personalizados:[{producto_id:'x',gestor:'Parent',nuevo_precio:110,comision_subgestor:15}],pedidos:[{id:'one',subgestor_nombre:'Sub',gestor:'Parent',comision_total:50,comision_parent:35,comision_subgestor:15},{id:'two',gestor:'Parent',comision_total:90}],inventario_eventos:[{tipo:'comision',producto_id:'x',valor_nuevo:40},{tipo:'precio',producto_id:'x',valor_nuevo:100,datos_producto:{comision:40}}],pedidos_subgestores:[]};
 class Query{
  constructor(table){this.table=table;this.filters=[];this.op='select';this.options={};}
  select(columns,options={}){this.options=options;this.returning=true;return this;}
  eq(k,v){this.filters.push(r=>r[k]===v);return this;}
  gt(k,v){this.filters.push(r=>r[k]>v);return this;}
  in(k,vs){if(this.table==='precios_personalizados'&&(vs.length>maxPriceIds||vs.includes(failPriceId)))this.queryError={message:'Request URI too long',code:'414'};this.filters.push(r=>vs.includes(r[k]));return this;}
  order(){return this;}limit(){return this;}range(){return this;}
  insert(values){this.op='insert';this.values=Array.isArray(values)?values:[values];return this;}
  update(values){this.op='update';this.values=values;return this;}
  maybeSingle(){this.single=true;return this;}
  then(resolve,reject){return Promise.resolve().then(()=>{
   if(this.queryError)return{data:null,error:this.queryError};
   let data=(rows[this.table]||[]).filter(r=>this.filters.every(f=>f(r)));const count=data.length;
   if(this.op==='insert'){rows[this.table].push(...this.values);data=this.returning?this.values:null;}
   if(this.op==='update'){data.forEach(r=>Object.assign(r,this.values));data=this.returning?data:null;}
   return{data:this.options.head?null:this.single?data?.[0]||null:data,error:null,count:this.options.count==='exact'?count:null};
  }).then(resolve,reject);}
 }
 const db={from:table=>new Query(table)};const handler=createHandler({db});
 const request=async body=>{const response=await handler(new Request('https://example.test',{method:'POST',headers:{Authorization:`Bearer ${token}`},body:JSON.stringify(body)}));return{status:response.status,...await response.json()};};
 return{rows,request};
}
test('subgestor endpoint masks product pool, parent orders and parent password',async()=>{
 const {request}=await setup();
 const products=await request({action:'query',table:'productos',op:'select'});assert.equal(products.data[0].comision,15);assert.equal(products.data[0].precio,110);assert.equal('costo_proveedor' in products.data[0],false);
 const orders=await request({action:'query',table:'pedidos',op:'select'});assert.equal(orders.data.length,1);assert.equal(orders.data[0].comision_total,15);assert.equal('comision_parent' in orders.data[0],false);
 const people=await request({action:'query',table:'gestores',op:'select'});assert.equal('password' in people.data.find(r=>r.id==='p'),false);
});
test('session expiry metadata describes the verified session without exposing its capability or extending it',async()=>{
 const {request,rows}=await setup();const response=await request({action:'session'});
 assert.equal(response.status,200);assert.equal(response.data.expiresAt,rows.pth_secure_sessions[0].expires_at);
 assert.equal(response.data.profile.password,'__session__');assert.equal(response.data.token,undefined);
 assert.equal(response.data.profile.expiresAt,undefined);assert.equal(response.data.profile.token_hash,undefined);
 assert.equal(rows.pth_secure_sessions[0].expires_at,'2099-01-01');
});
test('inventory head/count probes cannot recover hidden commission events',async()=>{
 const {request}=await setup();const response=await request({action:'query',table:'inventario_eventos',op:'select',head:true,count:'exact',filters:[{method:'eq',column:'tipo',value:'comision'},{method:'eq',column:'valor_nuevo',value:40}]});
 assert.equal(response.error,null);assert.equal(response.count,0);
});
test('checkout calculates full pool on server and returns only assigned share',async()=>{
 const {request,rows}=await setup();const response=await request({action:'query',table:'pedidos_subgestores',op:'insert',returning:true,values:{subgestor_id:'s',proveedor:'B',cliente:'Test',_lineas:[{producto_id:'x',cantidad:2}],comision_total:999,comision_subgestor:999,estado:'Pagado',estado_financiero:'Liquidado_Gestor',pago_gestor:'Pagado'}});
 assert.equal(response.error,null);assert.equal(response.data[0].comision_total,30);assert.equal(rows.pedidos_subgestores[0].comision_total,100);assert.equal(rows.pedidos_subgestores[0].comision_subgestor,30);assert.equal(rows.pedidos_subgestores[0].estado,'Pendiente Aprobacion');assert.equal('estado_financiero' in rows.pedidos_subgestores[0],false);
});

test('large subgestor catalogue preserves assigned shares and visibility across bounded price requests',async()=>{
 const {request,rows}=await setup({maxPriceIds:100});
 rows.productos=Array.from({length:430},(_,i)=>({id:crypto.randomUUID(),nombre:`Equipo ${i}`,precio:100,comision:80,costo_proveedor:20,precio_flexible:'SI'}));
 rows.precios_personalizados=rows.productos.map((p,i)=>({producto_id:p.id,gestor:'Parent',nuevo_precio:110,comision_subgestor:i%20+1,visible_subgestor:i!==220}));
 rows.precios_personalizados.push({producto_id:rows.productos[0].id,gestor:'Other',comision_subgestor:999});
 const response=await request({action:'query',table:'productos',op:'select'});
 assert.equal(response.status,200);assert.equal(response.data.length,429);
 for(const product of response.data){const assigned=rows.precios_personalizados.find(p=>p.producto_id===product.id&&p.gestor==='Parent');assert.equal(product.comision,assigned.comision_subgestor);assert.equal(product.precio,110);assert.equal('costo_proveedor' in product,false);}
 assert.equal(response.data.some(p=>p.id===rows.productos[220].id),false);
});
test('failure in a later assigned-price batch does not return base manager commissions or partial catalogue',async()=>{
 const {request,rows}=await setup({failPriceId:'broken'});
 rows.productos=Array.from({length:150},(_,i)=>({id:i===130?'broken':crypto.randomUUID(),precio:100,comision:80}));
 const response=await request({action:'query',table:'productos',op:'select'});
 assert.equal(response.status,503);assert.equal(response.data,null);
 assert.match(response.error.message,/comisión asignada/);
});

for(const size of [0,100,101,1000,2000])test(`subgestor catalogue handles ${size} products including unassigned items`,async()=>{
 const {request,rows}=await setup({maxPriceIds:100});
 rows.productos=Array.from({length:size},(_,i)=>({id:crypto.randomUUID(),precio:100,comision:80,costo_proveedor:20}));
 rows.precios_personalizados=rows.productos.filter((_,i)=>i%2===0).map(p=>({producto_id:p.id,gestor:'Parent',comision_subgestor:5,visible_subgestor:true}));
 const response=await request({action:'query',table:'productos',op:'select',limit:2000});
 assert.equal(response.status,200);assert.equal(response.data.length,size);
 response.data.forEach((p,i)=>{assert.equal(p.comision,i%2===0?5:0);assert.equal('costo_proveedor' in p,false);});
});
