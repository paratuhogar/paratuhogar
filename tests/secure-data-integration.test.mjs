import test from 'node:test';import assert from 'node:assert/strict';
import {createHandler,hash} from '../supabase/functions/secure-data/handler.mjs';
const token='a'.repeat(64);
async function setup(){
 const rows={pth_secure_sessions:[{token_hash:await hash(token),gestor_id:'s',credential_hash:await hash('test-only-password'),expires_at:'2099-01-01'}],gestores:[{id:'s',nombre:'Sub',parent_id:'p',estado:'activo',rol:'admin',password:'test-only-password'},{id:'p',nombre:'Parent',estado:'activo',password:'never-show',rol:'gestor'}],productos:[{id:'x',nombre:'Equipo',precio:100,comision:40,precio_flexible:'SI',costo_proveedor:60,proveedor:'B',disponible:'SI'}],precios_personalizados:[{producto_id:'x',gestor:'Parent',nuevo_precio:110,comision_subgestor:15}],pedidos:[{id:'one',subgestor_nombre:'Sub',gestor:'Parent',comision_total:50,comision_parent:35,comision_subgestor:15},{id:'two',gestor:'Parent',comision_total:90}],inventario_eventos:[{tipo:'comision',producto_id:'x',valor_nuevo:40},{tipo:'precio',producto_id:'x',valor_nuevo:100,datos_producto:{comision:40}}],pedidos_subgestores:[]};
 class Query{
  constructor(table){this.table=table;this.filters=[];this.op='select';this.options={};}
  select(columns,options={}){this.options=options;this.returning=true;return this;}
  eq(k,v){this.filters.push(r=>r[k]===v);return this;}
  gt(k,v){this.filters.push(r=>r[k]>v);return this;}
  in(k,vs){this.filters.push(r=>vs.includes(r[k]));return this;}
  order(){return this;}limit(){return this;}range(){return this;}
  insert(values){this.op='insert';this.values=Array.isArray(values)?values:[values];return this;}
  update(values){this.op='update';this.values=values;return this;}
  maybeSingle(){this.single=true;return this;}
  then(resolve,reject){return Promise.resolve().then(()=>{
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
test('inventory head/count probes cannot recover hidden commission events',async()=>{
 const {request}=await setup();const response=await request({action:'query',table:'inventario_eventos',op:'select',head:true,count:'exact',filters:[{method:'eq',column:'tipo',value:'comision'},{method:'eq',column:'valor_nuevo',value:40}]});
 assert.equal(response.error,null);assert.equal(response.count,0);
});
test('checkout calculates full pool on server and returns only assigned share',async()=>{
 const {request,rows}=await setup();const response=await request({action:'query',table:'pedidos_subgestores',op:'insert',returning:true,values:{subgestor_id:'s',proveedor:'B',cliente:'Test',_lineas:[{producto_id:'x',cantidad:2}],comision_total:999,comision_subgestor:999,estado:'Pagado',estado_financiero:'Liquidado_Gestor',pago_gestor:'Pagado'}});
 assert.equal(response.error,null);assert.equal(response.data[0].comision_total,30);assert.equal(rows.pedidos_subgestores[0].comision_total,100);assert.equal(rows.pedidos_subgestores[0].comision_subgestor,30);assert.equal(rows.pedidos_subgestores[0].estado,'Pendiente Aprobacion');assert.equal('estado_financiero' in rows.pedidos_subgestores[0],false);
});
