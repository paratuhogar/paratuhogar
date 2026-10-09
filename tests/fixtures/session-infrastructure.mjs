import {createHandler,hash} from '../../supabase/functions/secure-data/handler.mjs';

// Synthetic database only: this fixture never connects to Supabase.
export async function sessionFixture({child=false,courier=false}={}){
 const token='a'.repeat(64),expiresAt='2099-01-01T00:00:00.000Z';
 const rows={pth_secure_sessions:[{token_hash:await hash(token),credential_hash:await hash('fixture-only'),expires_at:expiresAt,...(courier?{mensajero_id:'courier'}:{gestor_id:'owner'})}],
  gestores:[{id:'owner',nombre:'Fixture',rol:'gestor',estado:'activo',activo:true,password:'fixture-only',...(child?{parent_id:'parent'}:{})},{id:'parent',nombre:'Parent',rol:'gestor',estado:'activo',password:'parent-fixture'}],
  mensajeros:[{id:'courier',nombre:'Courier',activo:true,pin:'fixture-only'}],pedidos:[],
  productos:[{id:'product',nombre:'Fixture product',precio:100,comision:10,proveedor:'Fixture provider',disponible:'SI'}],precios_personalizados:[]};
 const state={failure:null,network:false,delay:null,trace:[],writes:0,requests:[]};
 class Query{
  constructor(table){this.table=table;this.filters=[];this.op='select';}
  select(){this.returning=true;return this;}eq(key,value){this.filters.push(row=>row[key]===value);if(key==='id')this.id=value;return this;}
  gt(key,value){this.filters.push(row=>row[key]>value);return this;}maybeSingle(){this.single=true;return this;}
  in(key,values){this.filters.push(row=>values.includes(row[key]));return this;}
  insert(values){this.op='insert';this.values=Array.isArray(values)?values:[values];this.returning=false;return this;}
  update(values){this.op='update';this.values=values;return this;}limit(){return this;}order(){return this;}
  then(resolve,reject){return Promise.resolve().then(async()=>{
   state.trace.push({table:this.table,op:this.op,id:this.id});
   const stage=this.table==='pth_secure_sessions'?'session':this.table==='mensajeros'?'courier':this.table==='gestores'?(this.id==='parent'?'parent':'profile'):'protected';
   if(state.delay)await state.delay;
   if(state.failure?.stage===stage){if(state.failure.mode==='throw')throw Error('Synthetic infrastructure interruption');return {data:null,error:{message:'Synthetic infrastructure interruption',code:'CONNECTION_ERROR'}};}
   if(this.table==='pth_secure_sessions'&&this.op==='update'&&state.beforeSessionUpdate)await state.beforeSessionUpdate();
   const matches=(rows[this.table]||[]).filter(row=>this.filters.every(filter=>filter(row)));
   if(this.op==='insert'){
    // Same uniqueness boundary as the existing submission_token/proveedor migration.
    if(this.values.some(value=>value.submission_token&&rows[this.table].some(row=>row.submission_token===value.submission_token&&row.proveedor===value.proveedor)))return {data:null,error:{code:'23505',message:'Synthetic duplicate submission'}};
    state.writes++;rows[this.table].push(...structuredClone(this.values));return {data:this.returning?this.values:null,error:null};
   }
   if(this.op==='update'){state.writes++;matches.forEach(row=>Object.assign(row,this.values));}
   return {data:structuredClone(this.single?matches[0]||null:matches),error:null};
  }).then(resolve,reject);}
 }
 const handler=createHandler({db:{from:table=>new Query(table),rpc:async()=>({data:true,error:null})}});
 const fetch=async(_url,options)=>{
  const body=JSON.parse(options.body);state.requests.push(body);
  if(state.network)throw Error('Synthetic offline');
  return handler(new Request('http://127.0.0.1:8080/gateway',options));
 };
 const request=async(body,bearer=token)=>{const response=await fetch('',{method:'POST',headers:bearer?{Authorization:`Bearer ${bearer}`}:{},body:JSON.stringify(body)});return {status:response.status,...await response.json()};};
 return {rows,state,token,expiresAt,fetch,request};
}
