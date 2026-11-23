import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {fixture} from './fixtures/new-checkout.mjs';
import {createHandler,hash} from '../supabase/functions/secure-data/handler.mjs';

const own='11111111-1111-4111-8111-111111111111';
const other='22222222-2222-4222-8222-222222222222';
const requestId='33333333-3333-4333-8333-333333333333';
const eventId='44444444-4444-4444-8444-444444444444';
const token='a'.repeat(64),key='f'.repeat(64),date='2026-11-22T12:00:00.000Z';
const states={request:'requested',approve:'approved',start_payment:'in_payment',reject:'rejected',cancel:'cancelled',record_payment:'paid',release_payment:'approved',refund:'refunded'};
const publicRequest=(overrides={})=>({id:requestId,beneficiaryId:own,beneficiaryName:'Synthetic seller',usd:10,points:30,state:'requested',revision:1,createdAt:date,updatedAt:date,claimedBy:null,claimedByName:null,paymentMethod:null,paymentReference:null,paidAt:null,reason:null,...overrides});
const cashSummary=(id=own)=>({beneficiary:{id,name:'Synthetic seller'},enabled:true,rate:3,earnedConfirmed:31,available:1,reserved:30,redeemedPoints:0,paidUsd:0,deficit:0});
const event=()=>({id:eventId,operation:'request',state:'requested',revision:1,actorId:own,actorName:'Synthetic seller',reason:null,reference:null,createdAt:date});
const mutation=(operation,overrides={})=>({operation,requestId,revision:1,idempotencyKey:key,...(['reject','cancel','release_payment','refund'].includes(operation)?{reason:'Verified reason'}:{}),...(['record_payment','refund'].includes(operation)?{usd:10}:{}),...(['record_payment','release_payment','refund'].includes(operation)?{reference:'Synthetic receipt'}:{}),...(operation==='record_payment'?{method:'efectivo',confirmPaid:true}:{}),...(operation==='release_payment'?{confirmNotPaid:true}:{}),...(operation==='refund'?{confirmReturned:true}:{}),...overrides});

async function setup({role='gestor',parent=null,enabled=true,id=own,courier=false}={}){
 const f=await fixture();Object.assign(f.rows.gestores[0],{id,rol:role,parent_id:parent});f.rows.pth_secure_sessions[0].gestor_id=id;
 f.rows.gestores[1]={...f.rows.gestores[0],id:other,nombre:'Other principal',parent_id:null,rol:'gestor'};
 if(courier){f.rows.mensajeros=[{id:own,nombre:'Synthetic courier',telefono:'synthetic-phone',activo:true,pin:'synthetic-pin'}];Object.assign(f.rows.pth_secure_sessions[0],{gestor_id:null,mensajero_id:own,credential_hash:await hash('synthetic-pin')});}
 const original=f.db.rpc,calls=[];let override,error,throws=false;
 f.db.rpc=async(name,args)=>{
  if(!['pth_points_cash','pth_points_wallet'].includes(name))return original(name,args);
  calls.push({name,args:structuredClone(args)});
  if(name==='pth_points_wallet')return {data:{beneficiary:{id:args.p_body.beneficiaryId||id,name:'Synthetic'},enabled:true,startedAt:date,balance:31,pending:5,reversed:0,movements:[],nextOffset:null},error:null};
  if(throws)throw Error('private RPC connection details');
  if(error)return {data:null,error:{code:error,message:'private financial SQL',details:'private details'}};
  if(override!==undefined)return {data:override,error:null};
  const beneficiary=args.p_body.beneficiaryId||id;
  let data;
  if(args.p_operation==='summary')data=cashSummary(beneficiary);
  else if(args.p_operation==='list')data={rows:[publicRequest({beneficiaryId:beneficiary})],nextOffset:null,totals:{requestedUsd:10,approvedUsd:0,inPaymentUsd:0,paidUsd:0}};
  else if(args.p_operation==='detail')data={request:publicRequest(),events:[event()],nextOffset:null};
  else data={request:publicRequest({state:states[args.p_operation],...(['in_payment','paid','refunded'].includes(states[args.p_operation])?{claimedBy:own,claimedByName:'Synthetic administrator'}:{}),...(['record_payment','refund'].includes(args.p_operation)?{paymentMethod:args.p_body.method||'efectivo',paymentReference:'Synthetic receipt',paidAt:date}:{})})};
  return {data,error:null};
 };
 const handler=createHandler({db:f.db,checkoutSecret:'synthetic-cash-secret',pointsCashEnabled:enabled});
 return {f,calls,async request(body,auth=token){const r=await handler(new Request('https://example.test',{method:'POST',headers:auth?{Authorization:'Bearer '+auth}:{},body:JSON.stringify({action:'points_cash',...body})}));return {status:r.status,...await r.json()};},set output(value){override=value;},set error(value){error=value;},set throws(value){throws=value;}};
}

test('cash request forwards only verified actor, integer USD and the stable attempt key',async()=>{
 const s=await setup(),r=await s.request({operation:'request',usd:10,idempotencyKey:key});
 assert.equal(r.status,200);assert.equal(r.data.request.points,30);
 assert.deepEqual(s.calls,[{name:'pth_points_cash',args:{p_actor_id:own,p_operation:'request',p_body:{usd:10,idempotencyKey:key}}}]);
});

test('anonymous cash access performs no database work',async()=>{
 const s=await setup(),r=await s.request({operation:'summary'},null);
 assert.equal(r.status,401);assert.equal(s.f.trace.length,0);assert.equal(s.calls.length,0);
});

test('disabled gateway never calls a missing cash RPC and legacy wallet stays unchanged',async()=>{
 const s=await setup({enabled:false});
 assert.equal((await s.request({operation:'summary'})).status,503);
 assert.equal(s.calls.length,0);
 const wallet=await s.request({action:'points_wallet',operation:'summary'});
 assert.equal(wallet.status,200);assert.equal(wallet.data.balance,31);assert.equal(wallet.data.cash,undefined);
 assert.deepEqual(s.calls.map(c=>c.name),['pth_points_wallet']);
});

test('wallet summary adds cash without changing earned balance, pending points or movements',async()=>{
 const s=await setup(),r=await s.request({action:'points_wallet',operation:'summary',offset:50});
 assert.equal(r.status,200);assert.equal(r.data.balance,31);assert.equal(r.data.pending,5);assert.deepEqual(r.data.movements,[]);
 assert.deepEqual(r.data.cash,cashSummary());
 assert.deepEqual(s.calls.at(-1),{name:'pth_points_cash',args:{p_actor_id:own,p_operation:'summary',p_body:{}}});
});

test('a principal cannot read its child or another cash account',async()=>{
 const s=await setup();
 for(const operation of ['summary','list'])assert.equal((await s.request({operation,beneficiaryId:other})).status,403);
 assert.equal(s.calls.length,0);
});

for(const role of ['logistica','mensajero','unknown'])test(`${role} cannot request or consult cash`,async()=>{
 const s=await setup({role});
 for(const body of [{operation:'summary'},{operation:'list'},{operation:'request',usd:10,idempotencyKey:key},mutation('approve')])assert.equal((await s.request(body)).status,403);
 assert.equal(s.calls.length,0);
});

test('a valid courier session is forbidden, not falsely reported as expired',async()=>{
 const s=await setup({courier:true}),r=await s.request({operation:'summary'});
 assert.equal(r.status,403);assert.equal(r.error.code,'POINTS_CASH_FORBIDDEN');assert.equal(s.calls.length,0);
});

test('verified child requests only its own cash, not its principal account',async()=>{
 const s=await setup({parent:other});
 assert.equal((await s.request({operation:'request',usd:10,idempotencyKey:key})).status,200);
 assert.equal(s.calls[0].args.p_actor_id,own);
 assert.equal((await s.request({operation:'summary',beneficiaryId:other})).status,403);
 assert.equal((await s.request(mutation('approve'))).status,403);
 assert.equal(s.calls.length,1);
});

for(const role of ['admin','administrador','superadmin'])test(`principal ${role} can review accounts and apply administrative transitions`,async()=>{
 const s=await setup({role});
 assert.equal((await s.request({operation:'summary',beneficiaryId:other})).data.beneficiary.id,other);
 assert.equal((await s.request({operation:'list',beneficiaryId:other,state:'requested',search:' Synthetic ',offset:0})).status,200);
 assert.deepEqual(s.calls.at(-1).args.p_body,{beneficiaryId:other,state:'requested',search:'Synthetic',offset:0});
 for(const operation of ['approve','start_payment','reject','cancel','record_payment','release_payment','refund'])assert.equal((await s.request(mutation(operation))).status,200,operation);
 assert.ok(s.calls.every(c=>c.args.p_actor_id===own));
});

test('a child with an administrator role cannot acquire administrative cash permissions',async()=>{
 const s=await setup({role:'admin',parent:other});
 for(const operation of ['approve','start_payment','reject','record_payment','release_payment','refund'])assert.equal((await s.request(mutation(operation))).status,403);
 assert.equal(s.calls.length,0);
});

test('an unverified UUID cannot reach the service RPC',async()=>{
 const s=await setup({id:'actor-not-a-uuid'});
 assert.equal((await s.request({operation:'summary'})).status,403);assert.equal(s.calls.length,0);
});

test('administrators cannot forge actor, beneficiary, points or exchange rate on a request',async()=>{
 const s=await setup({role:'admin'}),body={operation:'request',usd:10,idempotencyKey:key};
 for(const extra of [{actorId:other},{p_actor_id:other},{beneficiaryId:other},{points:300},{rate:30},{enabled:true}])assert.equal((await s.request({...body,...extra})).status,400);
 assert.equal(s.calls.length,0);
});

test('cash request rejects missing, fractional, nonpositive, overflowing USD and unstable keys',async()=>{
 const s=await setup(),body={operation:'request',usd:10,idempotencyKey:key};
 for(const usd of [undefined,null,'10',0,-1,1.5,715827883,Number.MAX_SAFE_INTEGER])assert.equal((await s.request({...body,usd})).status,400);
 for(const idempotencyKey of [undefined,null,'','x'.repeat(64),'f'.repeat(63),'f'.repeat(65)])assert.equal((await s.request({...body,idempotencyKey})).status,400);
 assert.equal(s.calls.length,0);
});

test('cash decisions validate UUID, revision and mandatory bounded reasons before SQL',async()=>{
 const s=await setup({role:'admin'});
 for(const extra of [{requestId:'invalid'},{requestId:undefined},{revision:0},{revision:1.5},{revision:undefined},{reason:''},{reason:'   '},{reason:'x'.repeat(1001)},{reason:null},{idempotencyKey:'bad'},{actor:own}])assert.equal((await s.request(mutation('reject',extra))).status,400);
 assert.equal(s.calls.length,0);
});

test('payment and recovery require exact real-world confirmations, supported method and receipt',async()=>{
 const s=await setup({role:'admin'});
 for(const extra of [{confirmPaid:false},{confirmPaid:1},{confirmPaid:'true'},{confirmPaid:undefined},{method:'zelle'},{method:undefined},{reference:''},{reference:' '},{reference:'x'.repeat(201)},{usd:10.5}])assert.equal((await s.request(mutation('record_payment',extra))).status,400);
 for(const [operation,field] of [['release_payment','confirmNotPaid'],['refund','confirmReturned']])for(const value of [false,undefined,'true'])assert.equal((await s.request(mutation(operation,{[field]:value}))).status,400);
 assert.equal(s.calls.length,0);
 for(const method of ['efectivo','transferencia','otro'])assert.equal((await s.request(mutation('record_payment',{method}))).status,200);
});

test('cash reads enforce state, search, offset, required request ID and no extra fields',async()=>{
 const s=await setup({role:'admin'});
 for(const body of [{operation:'list',offset:-1},{operation:'list',offset:1000001},{operation:'list',offset:0.5},{operation:'list',search:'x'.repeat(121)},{operation:'list',search:4},{operation:'list',state:'any'},{operation:'list',limit:1000},{operation:'summary',offset:0},{operation:'detail'},{operation:'detail',requestId:'bad'},{operation:'set_enabled',enabled:true}])assert.equal((await s.request(body)).status,400,JSON.stringify(body));
 assert.equal(s.calls.length,0);
 assert.equal((await s.request({operation:'list',offset:1000000,search:'x'.repeat(120)})).status,200);
 assert.equal((await s.request({operation:'detail',requestId})).status,200);
});

test('optional pagination and search accept omission, never explicit null coercion',async()=>{
 const s=await setup();
 for(const body of [{operation:'list',offset:null},{operation:'list',search:null},{operation:'detail',requestId,offset:null}])assert.equal((await s.request(body)).status,400);
 assert.equal(s.calls.length,0);
});

test('child admin-labelled accounts retain self-service without principal administration',async()=>{
 const s=await setup({role:'admin',parent:other});
 assert.equal((await s.request({operation:'summary'})).status,200);
 assert.equal((await s.request({operation:'request',usd:10,idempotencyKey:key})).status,200);
 assert.equal((await s.request({operation:'summary',beneficiaryId:other})).status,403);
 assert.equal(s.calls.length,2);
});

test('cash-enabled wallet preserves existing logistics summary without granting cash access',async()=>{
 const s=await setup({role:'logistica'}),r=await s.request({action:'points_wallet',operation:'summary'});
 assert.equal(r.status,200);assert.equal(r.data.balance,31);assert.equal(r.data.cash,undefined);
 assert.deepEqual(s.calls.map(call=>call.name),['pth_points_wallet']);
});

test('public cash output strips unknown internal fields from rows, summaries and events',async()=>{
 const s=await setup();
 s.output={...cashSummary(),private_bank_account:'not public',beneficiary:{id:own,name:'Synthetic',password:'not public'}};
 let r=await s.request({operation:'summary'});assert.equal(r.status,200);assert.doesNotMatch(JSON.stringify(r),/not public|private_bank/);
 s.output={request:{...publicRequest(),private_bank_account:'not public'},events:[{...event(),private_sql:'not public'}],nextOffset:null};
 r=await s.request({operation:'detail',requestId});assert.equal(r.status,200);assert.doesNotMatch(JSON.stringify(r),/not public|private_bank|private_sql/);
});

test('incomplete list, detail and summary results are recoverable failures, never empty success',async()=>{
 const s=await setup();
 for(const [body,output] of [[{operation:'summary'},{...cashSummary(),enabled:'true'}],[{operation:'summary'},{...cashSummary(),rate:4}],[{operation:'summary'},{...cashSummary(),available:-1}],[{operation:'list'},{rows:[],nextOffset:null}],[{operation:'list'},{rows:[],nextOffset:'50',totals:{requestedUsd:0,approvedUsd:0,inPaymentUsd:0,paidUsd:0}}],[{operation:'detail',requestId},{request:publicRequest(),events:[],nextOffset:undefined}],[{operation:'detail',requestId},{request:publicRequest(),events:[{...event(),actorId:'invalid'}],nextOffset:null}]]){
  s.output=output;const r=await s.request(body);assert.equal(r.status,503);assert.equal(r.data,null);
 }
});

test('audited automatic reversal events permit a system actor without inventing an administrator',async()=>{
 const s=await setup();
 s.output={request:publicRequest({state:'cancelled',revision:2,reason:'Backing reversed'}),events:[{...event(),operation:'backing_reversed',state:'cancelled',revision:2,actorId:null,actorName:null,reason:'Backing reversed'}],nextOffset:null};
 const r=await s.request({operation:'detail',requestId});assert.equal(r.status,200);assert.equal(r.data.events[0].actorId,null);assert.equal(r.data.events[0].operation,'backing_reversed');
});

for(const [sqlCode,status,publicCode] of [['PT400',400,'POINTS_CASH_INVALID'],['PT403',403,'POINTS_CASH_FORBIDDEN'],['PT409',409,'POINTS_CASH_CONFLICT'],['PT503',503,'POINTS_CASH_UNAVAILABLE'],['55P03',409,'POINTS_CASH_BUSY'],['XX000',503,'POINTS_CASH_UNAVAILABLE']])test(`SQL ${sqlCode} stays recoverable, safe and maps to ${status}`,async()=>{
 const s=await setup();s.error=sqlCode;const r=await s.request({operation:'summary'});
 assert.equal(r.status,status);assert.equal(r.error.code,publicCode);assert.equal(r.data,null);
 assert.doesNotMatch(JSON.stringify(r),/private financial|private details|SESSION_INVALID/);
});

test('a thrown cash RPC failure is generic and does not masquerade as lost authorization',async()=>{
 const s=await setup();s.throws=true;const r=await s.request({operation:'summary'});
 assert.equal(r.status,503);assert.equal(r.error.code,'POINTS_CASH_UNAVAILABLE');assert.doesNotMatch(JSON.stringify(r),/private RPC/);
});

for(const [label,output] of [['null',null],['false',false],['true',true],['array',[]],['empty object',{}],['missing request',{request:null}],['wrong conversion',{request:publicRequest({points:31})}],['wrong owner',{request:publicRequest({beneficiaryId:other})}],['string USD',{request:publicRequest({usd:'10'})}],['zero revision',{request:publicRequest({revision:0})}],['missing timestamp',{request:publicRequest({createdAt:null})}]])test(`a malformed or unowned request result is never confirmed: ${label}`,async()=>{
 const s=await setup();s.output=output;const r=await s.request({operation:'request',usd:10,idempotencyKey:key});
 assert.equal(r.status,503);assert.equal(r.data,null);
});

test('cash ownership is checked across summary, list, detail and mutations',async()=>{
 const s=await setup();
 for(const [body,output] of [[{operation:'summary'},cashSummary(other)],[{operation:'list'},{rows:[publicRequest({beneficiaryId:other})],nextOffset:null,totals:{requestedUsd:10,approvedUsd:0,inPaymentUsd:0,paidUsd:0}}],[{operation:'detail',requestId},{request:publicRequest({beneficiaryId:other}),events:[],nextOffset:null}],[mutation('cancel'),{request:publicRequest({beneficiaryId:other,state:'cancelled'})}]]){s.output=output;const r=await s.request(body);assert.equal(r.status,503);assert.equal(r.data,null);}
});

test('a payment result must match request, complete amount and paid state',async()=>{
 const s=await setup({role:'admin'});
 for(const change of [{id:other},{state:'approved'},{usd:9,points:27},{paymentMethod:null},{paymentReference:null},{paidAt:null},{claimedBy:other}]){
  s.output={request:publicRequest({state:'paid',claimedBy:own,claimedByName:'Synthetic administrator',paymentMethod:'efectivo',paymentReference:'Synthetic receipt',paidAt:date,...change})};
  const r=await s.request(mutation('record_payment'));assert.equal(r.status,503);assert.equal(r.data,null);
 }
});

const clientSource=fs.readFileSync(new URL('../js/secure-data.js',import.meta.url),'utf8');
const clientProfile={id:own,nombre:'Synthetic seller',rol:'gestor',estado:'activo',activo:true,password:'__session__'};
function clientSetup(){
 const memory=new Map([['pth_secure_token',token],['pth_secure_token_expires_at',String(Date.now()+86400000)],['pth_session',JSON.stringify({data:clientProfile})]]);
 const storage={getItem:k=>memory.get(k)??null,setItem:(k,v)=>memory.set(k,String(v)),removeItem:k=>memory.delete(k),key:i=>[...memory.keys()][i],get length(){return memory.size;}};
 const calls=[],root={localStorage:storage,AbortSignal,location:{pathname:'/'},fetch:async(_url,options)=>{const body=JSON.parse(options.body);calls.push({body,headers:options.headers});return {status:200,json:async()=>({data:body.action==='session'?{profile:clientProfile,expiresAt:new Date(Date.now()+86400000).toISOString()}:{request:publicRequest()},error:null})};}};
 root.window=root;vm.runInNewContext(clientSource,root);return {root,storage,calls,api:root.PTHSecureData};
}

test('cash transport protects its action and original session credential',async()=>{
 const c=clientSetup();assert.equal(typeof c.api.pointsCash,'function');
 const r=await c.api.pointsCash({operation:'request',usd:10,idempotencyKey:key,action:'query'});
 assert.equal(r.data.request.points,30);assert.equal(c.calls.at(-1).body.action,'points_cash');assert.equal(c.calls.at(-1).headers.Authorization,'Bearer '+token);
});

for(const status of [409,503])test(`cash ${status} preserves session and does not replay the operation`,async()=>{
 const c=clientSetup();await c.api.restore();assert.equal(typeof c.api.pointsCash,'function');let attempts=0;
 c.root.fetch=async()=>{attempts++;return {status,json:async()=>({data:null,error:{message:'Try the same operation again',code:status===409?'POINTS_CASH_BUSY':'POINTS_CASH_UNAVAILABLE'}})};};
 const r=await c.api.pointsCash(mutation('record_payment'));
 assert.equal(r.data,null);assert.equal(r.error.status,status);assert.equal(c.api.token(),token);assert.equal(c.api.accountId(),own);assert.equal(attempts,1);
});

test('an uncertain cash write keeps its caller payload and is never automatically replayed',async()=>{
 const c=clientSetup();await c.api.restore();assert.equal(typeof c.api.pointsCash,'function');let attempts=0;
 c.root.fetch=async()=>{attempts++;throw Error('Synthetic lost response');};
 const body=mutation('record_payment'),snapshot=structuredClone(body),r=await c.api.pointsCash(body);
 assert.equal(r.error.code,'NETWORK_ERROR');assert.deepEqual(body,snapshot);assert.equal(attempts,1);assert.equal(c.api.token(),token);
});

test('cash transport discards a late private result after logout',async()=>{
 const c=clientSetup();await c.api.restore();assert.equal(typeof c.api.pointsCash,'function');let release;
 c.root.fetch=()=>new Promise(resolve=>release=()=>resolve({status:200,json:async()=>({data:{request:publicRequest()},error:null})}));
 const pending=c.api.pointsCash({operation:'detail',requestId});while(!release)await new Promise(setImmediate);c.api.clearSession();release();
 const r=await pending;assert.equal(r.data,null);assert.equal(r.error.code,'SESSION_CHANGED');assert.equal(c.api.accountId(),null);
});

test('a cross-tab account change cannot pay from an old form under the replacement account',async()=>{
 const c=clientSetup();await c.api.restore();assert.equal(typeof c.api.pointsCash,'function');const second={...clientProfile,id:other,nombre:'Other seller'};
 c.storage.setItem('pth_secure_token','b'.repeat(64));c.storage.setItem('pth_session',JSON.stringify({data:second}));let writes=0;
 c.root.fetch=async(_url,options)=>{const body=JSON.parse(options.body);if(body.action==='points_cash')writes++;return {status:200,json:async()=>({data:body.action==='session'?{profile:second,expiresAt:new Date(Date.now()+86400000).toISOString()}:cashSummary(other),error:null})};};
 const stale=await c.api.pointsCash(mutation('record_payment'));assert.equal(stale.error.code,'SESSION_CHANGED');assert.equal(stale.data,null);assert.equal(writes,0);assert.equal(c.api.accountId(),other);
 assert.equal((await c.api.pointsCash({operation:'summary'})).data.beneficiary.id,other);assert.equal(writes,1);
});
