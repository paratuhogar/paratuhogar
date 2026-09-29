import test from 'node:test';
import assert from 'node:assert/strict';
import {validateQuery,createHandler} from '../supabase/functions/secure-data/handler.mjs';
test('invalid select expressions and private filter probes are denied',()=>{
 for(const columns of ['*garbage','id;password','id,comision_total()']) assert.throws(()=>validateQuery({table:'productos',columns},null));
 for(const column of ['password','email','rol','comision_acordada']) assert.throws(()=>validateQuery({table:'gestores',filters:[{method:'eq',column,value:'probe'}]},null));
});
test('JSON snapshot filters and escaped-key OR probes cannot infer hidden commissions',()=>{
 const sub={parent_id:'p',id:'s'};
 assert.throws(()=>validateQuery({table:'inventario_eventos',filters:[{method:'or',value:String.raw`datos_producto.cs.{"\u0063omision":40}`}]},sub));
 assert.throws(()=>validateQuery({table:'inventario_eventos',filters:[{method:'eq',column:'datos_producto',value:{comision:40}}]},sub));
 assert.throws(()=>validateQuery({table:'inventario_eventos',orders:[{column:'datos_producto'}]},sub));
});
test('nonadministrator raw OR cannot bypass private identifier guards',()=>{
 for(const actor of [null,{id:'s',parent_id:'p'},{id:'g',rol:'gestor'},{id:'d',rol:'mensajero'}]) {
  for(const [table,value] of [['productos',String.raw`"co\mision".eq.40`],['gestores',String.raw`"pass\word".eq.secret`],['gestores',String.raw`"r\ol".eq.superadmin`]]) {
   assert.throws(()=>validateQuery({table,head:true,count:'exact',filters:[{method:'or',value}]},actor));
  }
 }
});
test('missing session cannot consult orders or invoke a private RPC',async()=>{
 const handler=createHandler({db:{from(){throw Error('database must not be touched');}}});
 for(const body of [{action:'query',table:'pedidos'},{action:'rpc',name:'listar_pedidos_boveda'}]) {
  const response=await handler(new Request('https://example.test',{method:'POST',body:JSON.stringify(body)}));
  assert.equal(response.status,body.action==='rpc'?401:403);assert.equal((await response.json()).data,null);
 }
});
