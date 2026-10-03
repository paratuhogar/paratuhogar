import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {ranking, rankingDTO} from '../supabase/functions/secure-data/ranking.mjs';
import {scopeFor, MY_RPCS, ADMIN_RPCS} from '../supabase/functions/secure-data/policy.mjs';
import {createHandler} from '../supabase/functions/secure-data/handler.mjs';
import {own,other,summary} from './fixtures/ranking.mjs';
test('gestor, child and administrator get only the same bounded summary for their verified actor ID',async()=>{
 for(const actor of [{id:own,estado:'activo',rol:'gestor'},{id:own,estado:'activo',parent_id:other,rol:'admin'},{id:own,estado:'activo',rol:'admin'}]){
  const calls=[],db={from(){throw Error('must never return rows from another account');},rpc:async(name,args)=>{calls.push({name,args});return {data:summary(actor.id)};}};
  const result=await ranking(db,{action:'ranking'},actor);assert.deepEqual(calls,[{name:'pth_ranking_summary',args:{p_actor_id:actor.id}}]);assert.equal(result.data.self.id,actor.id);
 }
});
test('anonymous, messenger, inactive, forged IDs and arbitrary arguments cannot call the aggregate',async()=>{
 const db={rpc(){throw Error('must not call database');}};
 for(const actor of [null,{id:own,rol:'mensajero'},{id:own,rol:'gestor',estado:'inactivo'},{id:own,rol:'gestor',estado:'activo',activo:false}])await assert.rejects(ranking(db,{action:'ranking'},actor));
 for(const extra of [{actor_id:other},{month:'2026-09'},{limit:9999},{operation:'update'},{instructions:'execute submitted text'}])await assert.rejects(ranking(db,{action:'ranking',...extra},{id:own,estado:'activo',rol:'gestor'}));
});
test('projection strips all extra order, financial, internal-name and customer fields',()=>{
 const data=summary();Object.assign(data,{orders:['PRIVATE_CUSTOMER'],commission:123});Object.assign(data.self,{nombre:'PRIVATE_INTERNAL_NAME',password:'PRIVATE_SECRET',telefono:'PRIVATE_PHONE'});Object.assign(data.top[0],{cliente:'PRIVATE_CUSTOMER',producto:'PRIVATE_PRODUCT',comision_total:999});
 assert.doesNotMatch(JSON.stringify(rankingDTO(data,own)),/PRIVATE_|commission|comision|password|telefono|producto|nombre/);
 for(const change of [d=>d.self.id=other,d=>d.top=Array(4).fill(d.top[0]),d=>d.nearby=Array(6).fill(d.nearby[0]),d=>d.self.count=-1,d=>d.period.timeZone='UTC']){const invalid=summary();change(invalid);assert.throws(()=>rankingDTO(invalid,own));}
});
test('raw order scope and generic RPC restrictions remain unchanged',()=>{
 assert.deepEqual(scopeFor('pedidos',{id:own,nombre:'Own'},'select'),[['eq','gestor','Own']]);
 assert.deepEqual(scopeFor('pedidos',{id:own,nombre:'Child',parent_id:other},'select'),[['eq','subgestor_nombre','Child']]);
 assert.equal(MY_RPCS.has('pth_ranking_summary'),false);assert.equal(ADMIN_RPCS.has('pth_ranking_summary'),false);
});
test('anonymous gateway request is denied before a privileged database lookup',async()=>{
 const handle=createHandler({db:{from(){throw Error('must not touch db');},rpc(){throw Error('must not touch db');}}});
 const response=await handle(new Request('https://example.test',{method:'POST',body:JSON.stringify({action:'ranking'})}));
 assert.equal(response.status,401);assert.equal((await response.json()).data,null);
});
test('review SQL grants only service-role execution and never backfills or opens order RLS',()=>{
 const sql=fs.readFileSync(new URL('../docs/ranking-summary-proposal.sql',import.meta.url),'utf8');
 assert.match(sql,/security invoker/i);assert.doesNotMatch(sql,/security definer|grant select|create policy|alter table|update public\.pedidos/i);
 assert.match(sql,/revoke all on function public\.pth_ranking_summary\(uuid\) from public, anon, authenticated/i);
 assert.match(sql,/grant execute on function public\.pth_ranking_summary\(uuid\) to service_role/i);
 assert.match(sql,/old\.estado is distinct from 'Entregado'/);assert.match(sql,/coalesce\(old\.fecha_entrega, statement_timestamp\(\)\)/);
 assert.match(sql,/count\(\*\) over \(partition by p\.id\)/);assert.match(sql,/candidate_count = 1/);
});
