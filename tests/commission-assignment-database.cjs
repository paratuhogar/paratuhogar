// Disposable native PostgreSQL only. Never reads production credentials.
const {Client}=require(process.env.PTH_PG_MODULE||'pg');
const {mkdtempSync,readFileSync,rmSync,mkdirSync}=require('node:fs');
const {join}=require('node:path');const {tmpdir}=require('node:os');const {execFileSync}=require('node:child_process');
const assert=require('node:assert/strict');
const native=process.env.PTH_NATIVE_PG;if(!native)throw Error('Set PTH_NATIVE_PG.');
const root=mkdtempSync(join(tmpdir(),'pth-commissions-')),data=join(root,'data'),socket=join(root,'socket');mkdirSync(socket,{mode:0o700});
const env={...process.env,LD_LIBRARY_PATH:join(native,'lib')};
const run=(bin,args)=>execFileSync(join(native,'bin',bin),args,{env,stdio:'pipe',timeout:20000});
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const actor=id(1),child=id(2),other=id(3);let batch=10000;const nextBatch=()=>id(batch++);
let started=false,clients=[],checks=0;
const ok=name=>{checks++;console.log('PASS '+name)};
(async()=>{try{
 run('initdb',['-D',data,'-U','postgres','--auth-local=trust','--auth-host=reject','--no-locale','--encoding=UTF8']);
 run('pg_ctl',['-D',data,'-l',join(root,'postgres.log'),'-o',`-c listen_addresses='' -k ${socket} -p 55439`,'-w','start']);started=true;
 for(let i=0;i<3;i++){const c=new Client({host:socket,port:55439,database:'postgres',user:'postgres'});await c.connect();await c.query("set statement_timeout='12s'");clients.push(c);}
 const [db,a,b]=clients;
 await db.query(`create role anon;create role authenticated;create role service_role bypassrls;
 alter default privileges grant all on tables to anon,authenticated,service_role;
 alter default privileges grant all on functions to anon,authenticated,service_role;
 alter default privileges grant all on schemas to anon,authenticated,service_role;
 create table public.gestores(id uuid primary key,nombre text not null,estado text,activo boolean,rol text,parent_id uuid);
 create table public.productos(id uuid primary key,nombre text not null,precio numeric not null,comision numeric,disponible text);
 create table public.precios_personalizados(id uuid primary key default gen_random_uuid(),created_at timestamptz default now(),gestor text,producto_id uuid,nuevo_precio numeric,comision_subgestor numeric default 0,visible_subgestor boolean default true);
 insert into public.gestores values('${actor}','Principal','activo',true,'gestor',null),('${child}','Sub','activo',true,'gestor','${actor}'),('${other}','Otro','activo',true,'gestor',null);`);
 for(let n=100;n<400;n++)await db.query('insert into public.productos values($1,$2,30,11,\'SI\')',[id(n),'Synthetic '+n]);
 for(let n=100;n<119;n++){for(let j=0;j<(n===100?3:2);j++)await db.query("insert into public.precios_personalizados(gestor,producto_id,nuevo_precio,comision_subgestor,visible_subgestor) values('Principal',$1,$2,$3,$4)",[id(n),40+j,j,j!==0]);}
 for(const [n,comm,visible]of [[119,0,false],[120,null,null],[121,7,true]])await db.query("insert into public.precios_personalizados(gestor,producto_id,nuevo_precio,comision_subgestor,visible_subgestor) values('Principal',$1,42,$2,$3)",[id(n),comm,visible]);
 const before=(await db.query('select * from public.precios_personalizados order by id')).rows;
 await db.query(readFileSync(join(__dirname,'../supabase/proposals/commission-auto-assign.sql'),'utf8'));
 assert.deepEqual((await db.query('select * from public.precios_personalizados order by id')).rows,before);ok('migration preserves every historical row including 19 duplicate pairs');
 for(const role of ['anon','authenticated','service_role']){
   const acl=(await db.query(`select has_schema_privilege($1,'pth_commission_private','USAGE') as usage,has_schema_privilege($1,'pth_commission_private','CREATE') as create_schema,has_table_privilege($1,'pth_commission_private.price_pairs','SELECT,INSERT,UPDATE,DELETE,TRUNCATE') as pairs,has_table_privilege($1,'pth_commission_private.assignment_receipts','SELECT,INSERT,UPDATE,DELETE,TRUNCATE') as receipts,has_function_privilege($1,'pth_commission_private.guard_price_pair()','EXECUTE') as trigger,has_function_privilege($1,'public.pth_assign_half_commissions(uuid,uuid,uuid[])','EXECUTE') as rpc`,[role])).rows[0];
   assert.deepEqual(acl,{usage:false,create_schema:false,pairs:false,receipts:false,trigger:false,rpc:role==='service_role'});
 }ok('explicit ACL overrides permissive table function and schema defaults');
 const rpc=async(c,ids,batchId=nextBatch(),who=actor)=>(await c.query('select public.pth_assign_half_commissions($1,$2,$3) result',[who,batchId,ids])).rows[0].result;
 const insert=(c,n,comm=9)=>c.query("insert into public.precios_personalizados(gestor,producto_id,nuevo_precio,comision_subgestor,visible_subgestor) values('Principal',$1,44,$2,false)",[id(n),comm]);
 const reject=async(p,code)=>{try{await p;assert.fail('Expected rejection '+code)}catch(e){assert.equal(e.code,code)}};
 const registryConsistent=async()=>{const r=await db.query(`select count(*) n from pth_commission_private.price_pairs r full join (select gestor,producto_id,count(*) n from public.precios_personalizados group by gestor,producto_id) p using(gestor,producto_id) where coalesce(r.row_count,0)<>coalesce(p.n,0)`);assert.equal(Number(r.rows[0].n),0)};
 let r=await rpc(db,Array.from({length:22},(_,i)=>id(100+i)));assert.equal(r.skippedExisting,22);assert.equal(r.inserted,0);assert.deepEqual((await db.query('select * from public.precios_personalizados order by id')).rows,before);ok('all existing values including zero NULL visibility and duplicates are untouched');
 const hundred=Array.from({length:100},(_,i)=>id(200+i));const receipt=nextBatch();r=await rpc(db,hundred,receipt);assert.equal(r.inserted,100);assert.deepEqual(await rpc(db,[...hundred].reverse(),receipt),r);ok('100-item atomic batch and identical receipt on reordered replay');
 await reject(rpc(db,hundred.concat(id(300))),'22023');await reject(rpc(db,[id(300),id(300)]),'22023');await reject(rpc(db,[id(300)],receipt),'22023');await reject(rpc(db,[id(300)],nextBatch(),child),'42501');ok('101 items changed payload and subgestor rejected');
 for(const role of ['anon','authenticated']){await db.query('set role '+role);await reject(rpc(db,[id(300)]),'42501');await reject(db.query('select * from pth_commission_private.price_pairs'),'42501');await db.query('reset role')}
 await db.query('set role service_role');await reject(db.query('select * from pth_commission_private.assignment_receipts'),'42501');r=await rpc(db,[id(300)]);assert.equal(r.inserted,1);await db.query('reset role');ok('browser roles denied RPC/private tables; service can only invoke RPC');
 const pid=(await b.query('select pg_backend_pid() pid')).rows[0].pid;
 const wait=async()=>{for(let i=0;i<250;i++){let q=await db.query('select wait_event_type from pg_stat_activity where pid=$1',[pid]);if(q.rows[0].wait_event_type==='Lock')return;await new Promise(r=>setTimeout(r,20))}throw Error('No observed lock wait')};
 const race=async(name,first,second,{rollback=false,code}={})=>{
   await a.query('begin');await b.query('begin');await first(a);
   const pending=second(b).then(result=>({result}),error=>({error}));await wait();await a.query(rollback?'rollback':'commit');const outcome=await pending;
   if(code){assert.equal(outcome.error?.code,code);await b.query('rollback')}else{assert.equal(outcome.error,undefined);await b.query('commit')}
   await registryConsistent();ok(name);return outcome.result;
 };
 await race('manual/manual duplicate waits then rejects',c=>insert(c,301),c=>insert(c,301),{code:'23505'});
 await race('rollback releases pair for waiting insert',c=>insert(c,302),c=>insert(c,302),{rollback:true});
 r=await race('manual first: automatic batch preserves manual value',c=>insert(c,303),c=>rpc(c,[id(303)]));assert.equal(r.inserted,0);assert.equal(r.skippedExisting,1);
 await race('automatic first: stale manual insert rejects instead of duplicate',c=>rpc(c,[id(304)]),c=>insert(c,304),{code:'23505'});
 const same=nextBatch();r=await race('same batch concurrent requests return one receipt',c=>rpc(c,[id(305)],same),c=>rpc(c,[id(305)],same));assert.equal(r.inserted,1);assert.equal((await db.query('select count(*) n from public.precios_personalizados where producto_id=$1',[id(305)])).rows[0].n.toString(),'1');
 await race('different batch concurrent requests skip the already configured pair',c=>rpc(c,[id(306)]),c=>rpc(c,[id(306)]));
 await db.query("delete from public.precios_personalizados where gestor='Principal' and producto_id=$1",[id(302)]);await insert(db,302);await registryConsistent();ok('delete last row then reinsert succeeds with registry consistency');
 await reject(db.query("update public.precios_personalizados set producto_id=$1 where gestor='Principal' and producto_id=$2",[id(301),id(302)]),'23505');await registryConsistent();
 await db.query("update public.precios_personalizados set producto_id=$1 where gestor='Principal' and producto_id=$2",[id(307),id(302)]);await registryConsistent();ok('rekey occupied pair aborts; free pair succeeds without count drift');
 const old=(await db.query("select id from public.precios_personalizados where producto_id=$1",[id(301)])).rows[0].id;
 await db.query("insert into public.precios_personalizados(id,gestor,producto_id) values($1,'Principal',$2) on conflict(id) do nothing",[old,id(308)]);await registryConsistent();await insert(db,308);ok('ON CONFLICT DO NOTHING creates no phantom reservation');
 const invalidBatch=nextBatch();await db.query('update public.productos set comision=-1 where id=$1',[id(310)]);await reject(rpc(db,[id(309),id(310)],invalidBatch),'22023');assert.equal((await db.query('select count(*) n from public.precios_personalizados where producto_id=$1',[id(309)])).rows[0].n.toString(),'0');await registryConsistent();await db.query('update public.productos set comision=10 where id=$1',[id(310)]);assert.equal((await rpc(db,[id(309),id(310)],invalidBatch)).inserted,2);ok('invalid product rolls back entire batch and receipt; safe retry succeeds');
 await db.query("update public.productos set disponible='NO' where id=$1",[id(311)]);r=await rpc(db,[id(311),id(999)]);assert.equal(r.skippedUnavailable,2);ok('unavailable and absent products are skipped');
 await db.query("update public.gestores set estado='inactivo' where id=$1",[actor]);await reject(rpc(db,hundred,receipt),'42501');await db.query("update public.gestores set estado='activo' where id=$1",[actor]);ok('revoked actor cannot retrieve old receipt');
 await db.query("update public.precios_personalizados set comision_subgestor=8,visible_subgestor=false where gestor='Principal' and producto_id=$1",[id(100)]);await registryConsistent();ok('manual updates of legacy duplicate rows remain permitted');
 await db.query("delete from public.precios_personalizados where gestor='Principal' and producto_id=$1",[id(100)]);await insert(db,100);await registryConsistent();ok('deleting all legacy duplicates permits one later insertion');
 await reject(db.query("insert into public.precios_personalizados(gestor,producto_id) values('Principal',$1),('Principal',$1)",[id(312)]),'23505');await registryConsistent();assert.equal(Number((await db.query('select count(*) n from public.precios_personalizados where producto_id=$1',[id(312)])).rows[0].n),0);ok('duplicate rows in a single statement roll back together');
 await db.query("insert into public.precios_personalizados(id,gestor,producto_id,comision_subgestor) values($1,'Principal',$2,6) on conflict(id) do update set comision_subgestor=excluded.comision_subgestor",[old,id(301)]);await registryConsistent();ok('same-ID upsert update does not double-count registry');
 await db.query('truncate public.precios_personalizados');await registryConsistent();await insert(db,301);await registryConsistent();ok('authorized truncate maintains registry for future inserts');
 await db.query('alter table public.productos alter column precio drop not null');await db.query('update public.productos set precio=null where id=$1',[id(313)]);await reject(rpc(db,[id(313)]),'22023');assert.equal(Number((await db.query('select count(*) n from public.precios_personalizados where producto_id=$1',[id(313)])).rows[0].n),0);ok('NULL price fails closed without commercial insertion');
 await registryConsistent();console.log(`${checks} checks passed in isolated PostgreSQL; no production execution.`);
 }catch(error){try{console.error(readFileSync(join(root,'postgres.log'),'utf8'))}catch{};throw error;}finally{await Promise.allSettled(clients.map(c=>c.end()));if(started)run('pg_ctl',['-D',data,'-m','immediate','-w','stop']);rmSync(root,{recursive:true,force:true})}
})().catch(e=>{console.error(e);process.exitCode=1});
