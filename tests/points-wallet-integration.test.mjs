// Exercise the browser-facing gateway contract against native PostgreSQL,
// not separately invented RPC response fixtures. Local synthetic data only.
import {after,before,test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import postgres from './helpers/points-postgres.cjs';
import {pointsWallet} from '../supabase/functions/secure-data/points-wallet.mjs';

let db;
before(async()=>{db=await postgres.startPointsPostgres();});
after(async()=>{await db?.stop();});
const key=()=>randomUUID().replaceAll('-','')+randomUUID().replaceAll('-','');

test('actual gateway and SQL agree on write keys, movement DTOs, defaults and inactive history',async()=>{
 const admin={id:randomUUID(),rol:'admin',estado:'activo',activo:true,parent_id:null};
 const seller={...admin,id:randomUUID(),rol:'gestor'};
 const productId=randomUUID();
 for(const actor of [admin,seller])await db.query('insert into gestores(id,nombre,rol) values($1,$2,$3)',[actor.id,actor.rol,actor.rol]);
 await db.query('insert into productos(id,nombre,"tamaño_envio") values($1,$2,$3)',[productId,'Equipo sintético','Mediano']);
 await db.query('update pth_points.config set enabled=true,started_at=clock_timestamp()');
 const adapter={rpc:async(fn,args)=>{
  assert.equal(fn,'pth_points_wallet');
  try{return {data:(await db.service('select public.pth_points_wallet($1,$2,$3) value',[args.p_actor_id,args.p_operation,args.p_body])).rows[0].value,error:null};}
  catch(error){return {data:null,error:{code:error.code}};}
 }};
 const call=(actor,body)=>pointsWallet(adapter,{action:'points_wallet',...body},actor).then(result=>result.data);
 const grant={operation:'grant',beneficiaryId:seller.id,points:7,reason:'Reto verificado',idempotencyKey:key()};
 const awarded=await call(admin,grant);
 assert.equal(awarded.movement.kind,'manual_credit');
 assert.equal(awarded.movement.points,7);
 assert.equal((await call(admin,grant)).movement.id,awarded.movement.id);
 assert.equal((await call(seller,{operation:'summary'})).balance,7);
 const reverse={operation:'reverse',movementId:awarded.movement.id,reason:'Corrección documentada',idempotencyKey:key()};
 assert.equal((await call(admin,reverse)).movement.kind,'reversal');
 assert.equal((await call(admin,reverse)).movement.points,-7);
 assert.equal((await call(seller,{operation:'summary'})).balance,0);
 for(const pointsPerUnit of [0,null]){
  const saved=await call(admin,{operation:'save_rule',productId,pointsPerUnit,reason:'Regla de prueba',idempotencyKey:key()});
  assert.equal(saved.rule.customPoints,pointsPerUnit);
  assert.equal(saved.rule.pointsPerUnit,pointsPerUnit===null?2:0);
 }
 await db.query("update gestores set estado='inactivo',activo=false where id=$1",[seller.id]);
 const account=(await call(admin,{operation:'accounts',search:'gestor'})).rows.find(row=>row.id===seller.id);
 assert.equal(account.active,false);
 const history=await call(admin,{operation:'summary',beneficiaryId:seller.id});
 assert.equal(history.movements.length,2);
 assert.equal(history.reversed,7);
 await assert.rejects(call(admin,{...grant,idempotencyKey:key()}),/No se pudo aplicar/);
});
