import {before,after,test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID,randomBytes} from 'node:crypto';
import postgres from './helpers/points-postgres.cjs';
import {pointsCash} from '../supabase/functions/secure-data/points-cash.mjs';
import {pointsWallet} from '../supabase/functions/secure-data/points-wallet.mjs';
let db;
before(async()=>{db=await postgres.startPointsPostgres({cashPayouts:true});});
after(async()=>{await db?.stop();});
const key=()=>randomBytes(32).toString('hex');
const actor=(role='gestor')=>({id:randomUUID(),rol:role,estado:'activo',activo:true,parent_id:null});
const adapter={rpc:async(fn,args)=>{
 assert.ok(['pth_points_cash','pth_points_wallet'].includes(fn));
 try{return {data:(await db.service(`select public.${fn}($1,$2,$3) value`,[args.p_actor_id,args.p_operation,args.p_body])).rows[0].value,error:null};}
 catch(error){return {data:null,error:{code:error.code}};}
}};
async function world(){
 const w={admin:actor('admin'),admin2:actor('administrador'),seller:actor(),child:actor('subgestor')};w.child.parent_id=w.seller.id;
 for(const [name,a]of Object.entries(w))await db.query('insert into gestores(id,nombre,rol,parent_id) values($1,$2,$3,$4)',[a.id,name,a.rol,a.parent_id]);
 await db.query("update pth_points.config set enabled=true,started_at=clock_timestamp();update pth_points.cash_config set enabled=true");
 return w;
}
const cash=async(a,operation,body={})=>(await pointsCash(adapter,{operation,...body},a)).data;
const grant=async(w,points)=>pointsWallet(adapter,{operation:'grant',beneficiaryId:w.seller.id,points,reason:'Reto sintético',idempotencyKey:key()},w.admin);
const change=async(a,operation,r,fields={})=>(await cash(a,operation,{requestId:r.id,revision:r.revision,idempotencyKey:key(),...fields})).request;

test('native SQL and gateway DTOs agree through request, approval, claim, payment and returned-money correction',async()=>{
 const w=await world();await grant(w,31);
 let summary=(await pointsWallet(adapter,{operation:'summary'},w.seller,true)).data;
 assert.equal(summary.balance,31);assert.equal(summary.cash.available,31);assert.equal(summary.cash.beneficiary.id,w.seller.id);
 const body={usd:10,idempotencyKey:key()};let r=(await cash(w.seller,'request',body)).request;
 assert.equal(r.points,30);assert.equal(r.state,'requested');assert.deepEqual((await cash(w.seller,'request',body)).request,r);
 assert.equal((await cash(w.seller,'list')).rows[0].id,r.id);
 r=await change(w.admin,'approve',r);r=await change(w.admin,'start_payment',r);
 r=await change(w.admin2,'release_payment',r,{reason:'Se verificó que no hubo pago',reference:'Comprobación sintética',confirmNotPaid:true});
 assert.equal(r.state,'approved');assert.equal(r.claimedByName,null);
 r=await change(w.admin2,'start_payment',r);
 r=await change(w.admin2,'record_payment',r,{usd:10,method:'efectivo',reference:'Recibo sintético',confirmPaid:true});
 assert.equal(r.state,'paid');assert.equal(r.claimedBy,w.admin2.id);assert.equal(r.paymentReference,'Recibo sintético');
 let detail=await cash(w.seller,'detail',{requestId:r.id});assert.equal(detail.events.length,6);assert.equal(detail.events.at(-1).state,'paid');
 summary=(await pointsWallet(adapter,{operation:'summary'},w.seller,true)).data;assert.equal(summary.balance,31);assert.equal(summary.cash.available,1);assert.equal(summary.cash.paidUsd,10);
 r=await change(w.admin,'refund',r,{usd:10,reason:'Se devolvió el dinero completo',reference:'Recibo de reintegro sintético',confirmReturned:true});
 assert.equal(r.state,'refunded');assert.equal(r.paymentReference,'Recibo sintético');assert.equal((await cash(w.seller,'summary')).available,31);
});

test('native rebalance produces explicitly system-authored events without borrowing a gestor identity',async()=>{
 const w=await world(),awarded=await grant(w,30);
 const r=(await cash(w.seller,'request',{usd:10,idempotencyKey:key()})).request;
 await pointsWallet(adapter,{operation:'reverse',movementId:awarded.data.movement.id,reason:'Reconocimiento anulado',idempotencyKey:key()},w.admin);
 const detail=await cash(w.seller,'detail',{requestId:r.id});assert.equal(detail.request.state,'cancelled');
 assert.equal(detail.events.at(-1).operation,'backing_reversed');assert.equal(detail.events.at(-1).actorId,null);assert.equal(detail.events.at(-1).actorName,null);
});

test('native busy-credit result stays an actionable conflict rather than a false successful payout',async()=>{
 const w=await world(),awarded=await grant(w,30),client=await db.connect();
 try{
  await client.query('begin');await client.query('set local role service_role');
  await client.query("select public.pth_points_wallet($1,'reverse',$2)",[w.admin.id,{movementId:awarded.data.movement.id,reason:'Reverso concurrente',idempotencyKey:key()}]);
  await assert.rejects(cash(w.seller,'request',{usd:10,idempotencyKey:key()}),e=>e.status===409&&e.publicCode==='POINTS_CASH_BUSY');
 }finally{await client.query('rollback');client.release();}
});

test('cash audit remains readable if the administrator who recorded a payment is later removed',async()=>{
 const w=await world();await grant(w,30);let r=(await cash(w.seller,'request',{usd:10,idempotencyKey:key()})).request;
 r=await change(w.admin2,'approve',r);r=await change(w.admin2,'start_payment',r);
 r=await change(w.admin2,'record_payment',r,{usd:10,method:'efectivo',reference:'Recibo histórico',confirmPaid:true});
 await db.query('delete from gestores where id=$1',[w.admin2.id]);
 const detail=await cash(w.admin,'detail',{requestId:r.id});assert.equal(detail.request.state,'paid');assert.equal(detail.request.claimedBy,w.admin2.id);
 assert.equal(typeof detail.request.claimedByName,'string');assert.equal(detail.events.at(-1).actorId,w.admin2.id);assert.equal(typeof detail.events.at(-1).actorName,'string');
});
