const {before,after,test}=require('node:test');
const assert=require('node:assert/strict');
const {randomUUID,randomBytes}=require('node:crypto');
const {startPointsPostgres}=require('./helpers/points-postgres.cjs');
let db,available;
before(async()=>{db=await startPointsPostgres({cashPayouts:true});available=(await db.query("select to_regprocedure('public.pth_points_cash(uuid,text,jsonb)') is not null ok")).rows[0].ok;});
after(async()=>{if(db)await db.stop();});
const key=()=>randomBytes(32).toString('hex');
const cash=async(actor,op,body={})=>(await db.service('select public.pth_points_cash($1,$2,$3) result',[actor,op,body])).rows[0].result;
const old=async(actor,op,body)=>(await db.service('select public.pth_points_wallet($1,$2,$3) result',[actor,op,body])).rows[0].result;
async function world(points=31){
 assert.equal(available,true,'cash RPC must be installed before testing its behavior');
 const w={admin:randomUUID(),admin2:randomUUID(),parent:randomUUID(),child:randomUUID(),other:randomUUID(),logistics:randomUUID()};
 for(const [name,id]of Object.entries(w))await db.query('insert into gestores(id,nombre,rol,parent_id) values($1,$2,$3,$4)',[id,name+'-'+id,name.startsWith('admin')?'admin':name==='logistics'?'logistica':'gestor',name==='child'?w.parent:null]);
 await db.query("update pth_points.config set enabled=true,started_at=clock_timestamp()-interval '1 second';update pth_points.cash_config set enabled=true");
 if(points)w.credit=(await old(w.admin,'grant',{beneficiaryId:w.parent,points,reason:'Reconocimiento sintético',idempotencyKey:key()})).movement;
 return w;
}
const request=(w,usd=10,actor=w.parent,requestKey=key())=>cash(actor,'request',{usd,idempotencyKey:requestKey});
async function step(actor,op,r,extra={}){return (await cash(actor,op,{requestId:r.id,revision:r.revision,idempotencyKey:key(),...extra})).request;}
async function started(w){let r=(await request(w)).request;r=await step(w.admin,'approve',r);return step(w.admin,'start_payment',r);}
async function paid(w){let r=await started(w);return step(w.admin,'record_payment',r,{usd:r.usd,method:'efectivo',reference:'Recibo sintético',confirmPaid:true});}
const settle=p=>p.then(value=>({ok:true,value}),error=>({ok:false,error}));

test('cash payout service contract is installed, not a browser table',async()=>{assert.equal(available,true);});
test('31 confirmed points reserve 30 for 10 USD and preserve one point',async()=>{
 const w=await world();const r=(await request(w)).request;assert.equal(r.points,30);assert.equal(r.usd,10);assert.equal(r.beneficiaryId,w.parent);assert.equal(r.state,'requested');
 const s=await cash(w.parent,'summary');assert.deepEqual([s.available,s.reserved,s.redeemedPoints,s.paidUsd,s.rate],[1,30,0,0,3]);
 assert.equal((await old(w.parent,'summary',{})).balance,31,'original earned ledger is not debited');
});
test('feature begins disabled; disabled new requests do not strand existing obligations',async()=>{
 const w=await world(),r=(await request(w)).request;await db.query('update pth_points.cash_config set enabled=false');
 await assert.rejects(request(w,1),/desactiv|habilit/i);assert.equal((await cash(w.parent,'summary')).enabled,false);
 const approved=await step(w.admin,'approve',r);assert.equal(approved.state,'approved');
});
test('fractional, zero, negative and client-supplied points cannot enter the book',async()=>{
 const w=await world();for(const usd of [0,-1,1.5,'10',null,715827883])await assert.rejects(request(w,usd));
 await assert.rejects(cash(w.parent,'request',{usd:1,points:1,idempotencyKey:key()}));
 await assert.rejects(cash(w.parent,'request',{usd:1,beneficiaryId:w.child,idempotencyKey:key()}));
});
test('child owns its cash balance; parent, guest, inactive and logistics cannot borrow it',async()=>{
 const w=await world();await old(w.admin,'grant',{beneficiaryId:w.child,points:6,reason:'Solo del subgestor',idempotencyKey:key()});
 assert.equal((await request(w,2,w.child)).request.beneficiaryId,w.child);
 await assert.rejects(cash(w.parent,'summary',{beneficiaryId:w.child}));await assert.rejects(cash(null,'summary'));await assert.rejects(cash(w.logistics,'summary'));
 await db.query("update gestores set estado='inactivo' where id=$1",[w.other]);await assert.rejects(cash(w.other,'summary'));
});
test('idempotency returns one request and rejects another actor or amount with its key',async()=>{
 const w=await world(),k=key(),a=await request(w,5,w.parent,k),b=await request(w,5,w.parent,k);assert.deepEqual(b,a);
 await assert.rejects(request(w,6,w.parent,k));await assert.rejects(request(w,5,w.child,k));assert.equal((await cash(w.parent,'summary')).reserved,15);
});
test('concurrent requests against the last points cannot both reserve funds',async()=>{
 const w=await world(30),out=await Promise.all([settle(request(w)),settle(request(w))]);assert.equal(out.filter(x=>x.ok).length,1);
 assert.deepEqual([(await cash(w.parent,'summary')).available,(await cash(w.parent,'summary')).reserved],[0,30]);
});
test('reject and cancel release only unpaid reservations and keep an audit reason',async()=>{
 const w=await world(),r=(await request(w)).request;const rejected=await step(w.admin,'reject',r,{reason:'No procede el cobro'});assert.equal(rejected.state,'rejected');assert.equal((await cash(w.parent,'summary')).available,31);
 const r2=(await request(w,2)).request;await assert.rejects(step(w.other,'cancel',r2,{reason:'Ajeno'}));await step(w.parent,'cancel',r2,{reason:'Ya no lo necesito'});
 const detail=await cash(w.parent,'detail',{requestId:r.id});assert.equal(detail.events.at(-1).reason,'No procede el cobro');assert.equal(detail.request.state,'rejected');
});
test('approval does not pay; two administrators cannot start the same payment',async()=>{
 const w=await world();let r=(await request(w)).request;r=await step(w.admin,'approve',r);assert.equal((await cash(w.parent,'summary')).redeemedPoints,0);
 const out=await Promise.all([settle(step(w.admin,'start_payment',r)),settle(step(w.admin2,'start_payment',r))]);assert.equal(out.filter(x=>x.ok).length,1);
 const claimed=out.find(x=>x.ok).value;assert.equal(claimed.state,'in_payment');assert.ok([w.admin,w.admin2].includes(claimed.claimedBy));
 await assert.rejects(step(w.parent,'cancel',claimed,{reason:'No cancelar un pago incierto'}));
});
test('only assigned admin can record full confirmed payment; retries create one debit',async()=>{
 const w=await world();let r=await started(w);const body={requestId:r.id,revision:r.revision,usd:10,method:'efectivo',reference:'Constancia sintética',confirmPaid:true,idempotencyKey:key()};
 await assert.rejects(cash(w.admin2,'record_payment',body));for(const update of [{usd:9},{confirmPaid:false},{reference:''},{method:'invalid'}])await assert.rejects(cash(w.admin,'record_payment',{...body,...update,idempotencyKey:key()}));
 const first=await cash(w.admin,'record_payment',body);assert.deepEqual(await cash(w.admin,'record_payment',body),first);
 assert.equal(first.request.state,'paid');const s=await cash(w.parent,'summary');assert.deepEqual([s.available,s.reserved,s.redeemedPoints,s.paidUsd],[1,0,30,10]);
 assert.equal((await db.query("select count(*)::int n from pth_points.cash_entries where payout_id=$1 and kind='payment'",[r.id])).rows[0].n,1);
});
test('in-payment claims survive refresh and can only be released after confirmed non-payment',async()=>{
 const w=await world(),r=await started(w);assert.equal((await cash(w.admin2,'detail',{requestId:r.id})).request.claimedBy,w.admin);
 await assert.rejects(step(w.admin2,'release_payment',r,{reason:'Comprobado',reference:'Prueba',confirmNotPaid:false}));
 const released=await step(w.admin2,'release_payment',r,{reason:'Comprobado que no hubo desembolso',reference:'Verificación sintética',confirmNotPaid:true});
 assert.equal(released.state,'approved');assert.equal(released.claimedBy,null);assert.equal((await cash(w.parent,'summary')).reserved,30);
});
test('full returned-money correction refunds points once without editing the original credit',async()=>{
 const w=await world(),r=await paid(w);await assert.rejects(step(w.admin,'reject',r,{reason:'No borrar pagos'}));
 const b={requestId:r.id,revision:r.revision,usd:10,reason:'Dinero devuelto íntegro',reference:'Recibo de devolución',confirmReturned:true,idempotencyKey:key()};
 await assert.rejects(cash(w.admin,'refund',{...b,usd:9,idempotencyKey:key()}));const first=await cash(w.admin,'refund',b);assert.deepEqual(await cash(w.admin,'refund',b),first);
 assert.equal(first.request.state,'refunded');assert.deepEqual([(await cash(w.parent,'summary')).available,(await cash(w.parent,'summary')).paidUsd],[31,0]);
 assert.equal((await old(w.parent,'summary',{})).movements.length,1);
});
test('lost earnings cancel newest unspent reservations and explain why',async()=>{
 const w=await world(60);const first=(await request(w)).request;const second=(await request(w)).request;
 await old(w.admin,'reverse',{movementId:w.credit.id,reason:'Reconocimiento revertido',idempotencyKey:key()});
 const s=await cash(w.parent,'summary');assert.deepEqual([s.available,s.reserved],[0,0]);
 for(const r of [first,second]){const d=await cash(w.parent,'detail',{requestId:r.id});assert.equal(d.request.state,'cancelled');assert.match(d.request.reason,/revirt|respaldo/i);}
});
test('earnings reversal preserves an uncertain payment and creates a noncash deficit after payment',async()=>{
 const w=await world(30);let r=await started(w);await old(w.admin,'reverse',{movementId:w.credit.id,reason:'Venta anulada',idempotencyKey:key()});
 let s=await cash(w.parent,'summary');assert.deepEqual([s.available,s.reserved,s.deficit],[0,30,30]);assert.equal((await cash(w.admin,'detail',{requestId:r.id})).request.state,'in_payment');
 r=await step(w.admin,'record_payment',r,{usd:10,method:'transferencia',reference:'Pago ya efectuado',confirmPaid:true});s=await cash(w.parent,'summary');assert.deepEqual([s.available,s.reserved,s.deficit],[0,0,30]);
 await old(w.admin,'grant',{beneficiaryId:w.parent,points:36,reason:'Nuevos puntos',idempotencyKey:key()});s=await cash(w.parent,'summary');assert.deepEqual([s.available,s.deficit],[6,0]);
});
test('revision fences reject stale admin decisions and non-admin approvals',async()=>{
 const w=await world(),r=(await request(w)).request;await assert.rejects(step(w.parent,'approve',r));await step(w.admin,'approve',r);await assert.rejects(step(w.admin,'reject',r,{reason:'Versión vieja'}));
});
test('lists are private, filtered and paginated; paid totals are incentive payouts not commissions',async()=>{
 const w=await world();await paid(w);const list=await cash(w.parent,'list');assert.equal(list.rows.length,1);assert.equal(list.totals.paidUsd,10);
 await assert.rejects(cash(w.other,'detail',{requestId:list.rows[0].id}));await assert.rejects(cash(w.parent,'list',{beneficiaryId:w.child}));
 const admin=await cash(w.admin,'list',{beneficiaryId:w.parent,state:'paid',search:'parent-',offset:0});assert.equal(admin.rows.length,1);
});
test('RLS and service-only functions prevent browser access and books cannot be edited',async()=>{
 const w=await world(),r=(await request(w)).request;
 for(const role of ['anon','authenticated']){
  const c=await db.connect();try{await c.query('set role '+role);await assert.rejects(c.query('select * from pth_points.cash_payouts'));await assert.rejects(c.query("select public.pth_points_cash($1,'summary','{}')",[w.parent]));}finally{await c.query('reset role');c.release();}
 }
 await assert.rejects(db.service('update pth_points.movements set points=999 where beneficiary_id=$1',[w.parent]),/inmutable|permission/i);
 await assert.rejects(db.service('update pth_points.cash_payouts set points=3 where id=$1',[r.id]));
 await assert.rejects(db.service('delete from pth_points.cash_events where payout_id=$1',[r.id]));
});

test('a reversal already holding its credit FK returns busy, never an unfunded reservation',async()=>{
 const w=await world(30),client=await db.connect();
 try{
  await client.query('begin');await client.query('set local role service_role');
  await client.query("select public.pth_points_wallet($1,'reverse',$2)",[w.admin,{movementId:w.credit.id,reason:'Reverso aún no confirmado',idempotencyKey:key()}]);
  const out=await settle(request(w));assert.equal(out.ok,false);assert.equal(out.error.code,'55P03','do not silently skip a locked credit');
  await client.query('commit');assert.equal((await cash(w.parent,'summary')).available,0);
  assert.equal((await cash(w.parent,'list')).rows.length,0);
 }finally{await client.query('rollback');client.release();}
});

test('a reserved credit fences a concurrent reversal until commit, then backing loss cancels it',async()=>{
 const w=await world(30),holder=await db.connect(),reverser=await db.connect();let reversal;
 try{
  await holder.query('begin');await holder.query('set local role service_role');
  const created=(await holder.query("select public.pth_points_cash($1,'request',$2) r",[w.parent,{usd:10,idempotencyKey:key()}])).rows[0].r.request;
  await reverser.query('set role service_role');const pid=(await reverser.query('select pg_backend_pid() pid')).rows[0].pid;
  const holderPid=(await holder.query('select pg_backend_pid() pid')).rows[0].pid;
  reversal=reverser.query("select public.pth_points_wallet($1,'reverse',$2)",[w.admin,{movementId:w.credit.id,reason:'Revierte después de reservar',idempotencyKey:key()}]);
  let blocked=false;const until=Date.now()+2000;
  while(Date.now()<until){blocked=(await db.query('select $2::integer=any(pg_blocking_pids($1::integer)) blocked',[pid,holderPid])).rows[0].blocked;if(blocked)break;await new Promise(r=>setTimeout(r,5));}
  assert.equal(blocked,true,'FK key-share must conflict with the exact positive credit lock');
  await holder.query('commit');await reversal;reversal=null;
  const s=await cash(w.parent,'summary');assert.equal(s.available,0);assert.equal(s.reserved,0);
  assert.equal((await cash(w.parent,'detail',{requestId:created.id})).request.state,'cancelled');
 }finally{await holder.query('rollback');if(reversal)await reversal.catch(()=>{});await reverser.query('reset role');holder.release();reverser.release();}
});

test('bulk reversed credits cannot deadlock cash locks in another order or leave partial cash books',async()=>{
 const w=await world(0),credits=[];
 for(let i=0;i<3;i++)credits.push((await old(w.admin,'grant',{beneficiaryId:w.parent,points:12,reason:'Crédito '+i,idempotencyKey:key()})).movement);
 credits.sort((a,b)=>a.id.localeCompare(b.id));
 const holder=await db.connect();try{
  await holder.query('begin');await holder.query('set local role service_role');
  // Reverse lock order intentionally: cash scans UUIDs ascending, this batch descending.
  for(const credit of credits.slice().reverse())await holder.query("select public.pth_points_wallet($1,'reverse',$2)",[w.admin,{movementId:credit.id,reason:'Lote inverso',idempotencyKey:key()}]);
  const out=await settle(request(w,10));assert.equal(out.ok,false);assert.equal(out.error.code,'55P03');
  await holder.query('commit');assert.equal((await cash(w.parent,'list')).rows.length,0);
  assert.equal((await cash(w.parent,'summary')).earnedConfirmed,0);
 }finally{await holder.query('rollback');holder.release();}
});

test('deferred audit and payment coupling reject direct malformed state writes atomically',async()=>{
 const w=await world(),r=(await request(w)).request;
 await assert.rejects(db.service("update pth_points.cash_payouts set state='approved',revision=revision+1 where id=$1",[r.id]),/auditoría/i);
 assert.equal((await cash(w.parent,'detail',{requestId:r.id})).request.state,'requested');
 await assert.rejects(db.service("insert into pth_points.cash_entries(payout_id,beneficiary_id,kind,usd,points,actor_id,reference) values($1,$2,'payment',10,30,$3,'Pago inventado')",[r.id,w.parent,w.admin]));
 assert.equal((await cash(w.parent,'summary')).reserved,30);
});

test('filtered pages remain fully rebalanced when cancelled rows shift new beneficiaries into view',async()=>{
 const w=await world(0),prefix='Cola-'+randomUUID();
 for(let i=0;i<53;i++){
  const id=randomUUID();await db.query('insert into gestores(id,nombre) values($1,$2)',[id,prefix+'-'+i]);
  const credit=(await old(w.admin,'grant',{beneficiaryId:id,points:3,reason:'Tres puntos de prueba',idempotencyKey:key()})).movement;
  await cash(id,'request',{usd:1,idempotencyKey:key()});
  await old(w.admin,'reverse',{movementId:credit.id,reason:'Se anula el crédito de respaldo',idempotencyKey:key()});
 }
 const list=await cash(w.admin,'list',{state:'requested',search:prefix});
 assert.deepEqual(list.rows,[],'do not return shifted claims that would fail an immediate approval');
 assert.equal(list.nextOffset,null);assert.equal(list.totals.requestedUsd,0);
});

test('a list may wait for its first account rather than conflict with an ordinary same-account read',async()=>{
 const w=await world();await request(w,1);const holder=await db.connect(),reader=await db.connect();let waiting,finished=false;
 try{
  await holder.query('begin');await holder.query("select pg_advisory_xact_lock(hashtextextended('points-cash-account:'||$1::text,0))",[w.parent]);
  const holderPid=(await holder.query('select pg_backend_pid() pid')).rows[0].pid;
  await reader.query('set role service_role');const readerPid=(await reader.query('select pg_backend_pid() pid')).rows[0].pid;
  waiting=settle(reader.query("select public.pth_points_cash($1,'list','{}') value",[w.parent])).then(out=>{finished=true;return out;});
  let blocked=false;const until=Date.now()+2000;
  while(Date.now()<until&&!finished){blocked=(await db.query('select $2::integer=any(pg_blocking_pids($1::integer)) blocked',[readerPid,holderPid])).rows[0].blocked;if(blocked)break;await new Promise(r=>setTimeout(r,5));}
  assert.equal(blocked,true,'first account has no lock inversion and must serialize the read');
  await holder.query('commit');const out=await waiting;assert.equal(out.ok,true);assert.equal(out.value.rows[0].value.rows.length,1);
 }finally{await holder.query('rollback');if(waiting)await waiting;await reader.query('reset role');holder.release();reader.release();}
});
