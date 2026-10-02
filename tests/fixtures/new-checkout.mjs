import assert from 'node:assert/strict';
import {createHandler,hash} from '../../supabase/functions/secure-data/handler.mjs';
const secret='synthetic-only-signing-material-not-a-production-secret';
export async function fixture(){
 const actor={id:'actor-a',nombre:'Shared Seller',rol:'gestor',estado:'activo',password:'synthetic-only',parent_id:null},token='a'.repeat(64),trace=[];
 const historical={id:'historical-order',gestor:actor.nombre,proveedor:'A',cliente:'Historical private name',telefono:'old private phone',total:999,comision_total:37,pago_gestor:'Pagado',estado:'Entregado',fecha:'2025-01-01',submission_token:'legacy-key'};
 const rows={gestores:[actor,{...actor,id:'same-name-other'}],pth_secure_sessions:[{token_hash:await hash(token),gestor_id:actor.id,credential_hash:await hash(actor.password),expires_at:'2099-01-01'}],productos:[{id:'pA',nombre:'Equipo A',precio:100,comision:10,precio_flexible:'NO',proveedor:'A',disponible:'SI',garantia:'1 año','tamaño_envio':'Pequeño'},{id:'pB',nombre:'Equipo B',precio:200,comision:20,precio_flexible:'NO',proveedor:'B',disponible:'SI',garantia:'1 año','tamaño_envio':'Pequeño'}],precios_personalizados:[],pedidos:[structuredClone(historical)],pedidos_subgestores:[],tarifas_mensajeria:[{municipio:'Centro Habana',localidad:'Centro',precio_pequeno:6,precio_grande:10}]};
 let writes=0,drop=false,failInsert=false;
 class Query{
  constructor(table){this.table=table;this.filters=[];this.op='select';this.single=false;}
  select(){return this;}eq(c,v){this.filters.push(r=>r[c]===v);return this;}gt(c,v){this.filters.push(r=>r[c]>v);return this;}gte(c,v){this.filters.push(r=>r[c]>=v);return this;}in(c,v){this.filters.push(r=>v.includes(r[c]));return this;}order(){return this;}range(){return this;}limit(){return this;}maybeSingle(){this.single=true;return this;}
  insert(values){this.op='insert';this.values=values;return this;}
  then(resolve,reject){return Promise.resolve().then(()=>{
   trace.push({table:this.table,op:this.op});
   if(this.op==='insert'){
    assert.equal(Array.isArray(this.values),true);const existing=rows[this.table];
    if(this.values.some(v=>existing.some(r=>r.id===v.id||r.submission_token===v.submission_token&&r.proveedor===v.proveedor)))return {data:null,error:{code:'23505'}};
    if(failInsert)return {data:null,error:{code:'synthetic-failure'}};
    writes++;const saved=this.values.map(v=>({...structuredClone(v),fecha:new Date().toISOString(),created_at:new Date().toISOString()}));existing.push(...saved);
    if(drop)return {data:null,error:{code:'synthetic-response-loss'}};
    return {data:saved,error:null};
   }
   const data=(rows[this.table]||[]).filter(r=>this.filters.every(f=>f(r)));if(this.single&&data.length>1)return{data:null,error:{code:'PGRST116'}};
   return {data:this.single?data[0]||null:structuredClone(data),error:null};
  }).then(resolve,reject);}
 }
 const handler=createHandler({db:{from:t=>new Query(t)},checkoutSecret:secret});
 const input=(provider,id)=>({gestor:actor.nombre,proveedor:provider,cliente:'Synthetic Customer',telefono:'synthetic-phone',ci:'none',direccion:'Synthetic address (Centro)',municipio:'Centro Habana',origen:'Manual (Panel)',orden_dia:provider+'00001',_lineas:[{producto_id:id,cantidad:1}]});
 const body={action:'checkout',table:'pedidos',inputs:[input('A','pA'),input('B','pB')],delivery:{pickup:false,municipio:'Centro Habana',localidad:'Centro'},intentId:'b'.repeat(64),intentCreatedAt:Date.now()};
 const request=async(b,auth=token)=>{const response=await handler(new Request('https://example.test',{method:'POST',headers:auth?{Authorization:'Bearer '+auth}:{},body:JSON.stringify(b)}));return response.json();};
 const quote=()=>request({...body,operation:'quote'});
 const submit=q=>request({...body,operation:'submit',attempt:q.data.attempt,quote:q.data.quote});
 return {rows,trace,body,request,quote,submit,historical,get writes(){return writes;},set drop(value){drop=value;},set failInsert(value){failInsert=value;}};
}
