const {PGlite}=require(process.env.PTH_PGLITE_MODULE||'/tmp/pth-feedback-db-test/node_modules/@electric-sql/pglite');
const fs=require('node:fs'),assert=require('node:assert/strict'),path=require('node:path');
(async()=>{const db=new PGlite();try{
 const sql=name=>fs.readFileSync(path.join(__dirname,'../supabase/proposals/'+name),'utf8');
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
 create table public.gestores(id uuid primary key,parent_id uuid,rol text,estado text,activo boolean);
 create table public.pth_secure_sessions(token_hash text primary key,gestor_id uuid,expires_at timestamptz);
 grant select on public.gestores,public.pth_secure_sessions to service_role;
 create table public.pedidos(id uuid primary key);create table public.pth_feedback(id uuid primary key,kind text);
 alter default privileges in schema public grant all on tables to anon,authenticated,service_role;`);
 await db.exec(sql('admin-web-push.sql'));await db.exec(sql('admin-web-push-dispatch.sql'));
 const angel='6193f310-1e3f-4404-b874-977d0e23a6a0',owner='38f20b63-a845-4a03-8d10-9a57da2ac2c4',admin='55555555-5555-4555-8555-555555555555',child='66666666-6666-4666-8666-666666666666';
 await db.query("insert into gestores values($1,null,'superadmin','activo',true),($2,null,'superadmin','activo',true),($3,null,'admin','activo',true),($4,$1,'superadmin','activo',true)",[angel,owner,admin,child]);
 await db.exec("insert into gestores values('77777777-7777-4777-8777-777777777777',null,'gestor','pendiente',true)");
 await db.exec(sql('admin-push-applications.sql'));
 assert.equal((await db.query('select count(*)::int n from pth_push_events')).rows[0].n,0,'no backfill');
 assert.equal((await db.query("select tgenabled from pg_trigger where tgname='pth_push_new_application'")).rows[0].tgenabled,'D');
 await db.exec('alter table pedidos enable trigger pth_push_new_order;alter table pth_feedback enable trigger pth_push_new_suggestion;');
 await db.exec(sql('admin-push-applications-activate.sql'));
 for(const role of ['anon','authenticated'])for(const table of ['pth_push_subscriptions','pth_push_events','pth_push_deliveries']){
  const privileges=await db.query("select has_table_privilege($1,$2,'select,insert,update,delete,truncate') allowed",[role,'public.'+table]);assert.equal(privileges.rows[0].allowed,false);
 }
 for(const table of ['pth_push_subscriptions','pth_push_events','pth_push_deliveries'])assert.equal((await db.query("select has_table_privilege('service_role',$1,'truncate') allowed",['public.'+table])).rows[0].allowed,false);
 for(const role of ['anon','authenticated'])for(const fn of ['pth_claim_push_deliveries(integer)','pth_enqueue_admin_push()'])assert.equal((await db.query("select has_function_privilege($1,$2,'execute') allowed",[role,'public.'+fn])).rows[0].allowed,false);
 assert.equal((await db.query("select has_function_privilege('service_role','public.pth_claim_push_deliveries(integer)','execute') allowed")).rows[0].allowed,true);
 assert.ok((await db.query("select relrowsecurity from pg_class where relname in('pth_push_subscriptions','pth_push_events','pth_push_deliveries')")).rows.every(r=>r.relrowsecurity));
 for(const [actor,hash] of [[angel,'angel'],[owner,'owner'],[admin,'admin'],[child,'child']]){
  await db.query("insert into pth_secure_sessions values($1,$2,now()+interval '1 day')",[hash,actor]);
  await db.query("insert into pth_push_subscriptions(gestor_id,session_hash,endpoint,p256dh,auth,topics,created_at,expires_at) values($1,$2,$3,$4,$5,array['orders','suggestions','applications'],now()-interval '1 day',now()+interval '1 day')",[actor,hash,'https://fcm.googleapis.com/'+hash,'a'.repeat(87),'b'.repeat(22)]);
 }
 const insert=async(id,state='pendiente',parent=null)=>db.query("insert into gestores values($1,$2,'gestor',$3,true) on conflict do nothing",[id,parent,state]);
 const source='11111111-1111-4111-8111-111111111111';
 await insert(source);await insert(source);await insert('22222222-2222-4222-8222-222222222222','pendiente',angel);await insert('33333333-3333-4333-8333-333333333333','pendiente_subgestor',angel);await insert('44444444-4444-4444-8444-444444444444','activo');
 assert.equal((await db.query("select count(*)::int n from pth_push_events where kind='applications'")).rows[0].n,1,'one new principal request, no duplicate/child/active account events');
 await db.exec("begin;insert into gestores values('88888888-8888-4888-8888-888888888888',null,'gestor','pendiente',true);rollback;");
 await db.exec("update gestores set estado='pendiente' where id='44444444-4444-4444-8444-444444444444'");
 assert.equal((await db.query("select count(*)::int n from pth_push_events where kind='applications'")).rows[0].n,1,'rollback and updates produce no extra events');
 await db.exec("insert into pedidos values('99999999-9999-4999-8999-999999999999');insert into pth_feedback values('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','mejora')");
 const claimed=await db.query('select * from pth_claim_push_deliveries(10)');assert.equal(claimed.rows.length,6,'three order recipients, two improvement recipients, one application recipient');
 assert.equal(claimed.rows.filter(r=>r.kind==='applications').length,1);
 const recipient=await db.query("select s.gestor_id from pth_push_deliveries d join pth_push_subscriptions s on s.id=d.subscription_id join pth_push_events e on e.id=d.event_id where e.kind='applications'");assert.equal(recipient.rows[0].gestor_id,angel);
 assert.equal((await db.query('select * from pth_claim_push_deliveries(10)')).rows.length,0,'duplicate claim does not recreate deliveries or steal a live lease');
 await db.exec("update pth_push_deliveries set state='sent',lease_until=null;update pth_push_subscriptions set topics=array['orders','suggestions'] where gestor_id='"+angel+"'");
 await insert('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');assert.equal((await db.query('select * from pth_claim_push_deliveries(10)')).rows.length,0,'explicit application opt-out excludes even Angel');
 await db.exec("update pth_push_subscriptions set topics=array['applications'],created_at=now()+interval '1 second' where gestor_id='"+angel+"'");
 await insert('cccccccc-cccc-4ccc-8ccc-cccccccccccc');assert.equal((await db.query('select * from pth_claim_push_deliveries(10)')).rows.length,0,'a device enrolled after the event receives no old event');
 await db.exec("update pth_push_subscriptions set created_at=now()-interval '1 day' where gestor_id='"+angel+"';update gestores set activo=false where id='"+angel+"'");
 await insert('dddddddd-dddd-4ddd-8ddd-dddddddddddd');assert.equal((await db.query('select * from pth_claim_push_deliveries(10)')).rows.length,0,'disabled Angel excluded');
 await db.exec("update gestores set activo=true where id='"+angel+"';update pth_secure_sessions set expires_at=now()-interval '1 second' where gestor_id='"+angel+"'");
 await insert('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee');assert.equal((await db.query('select * from pth_claim_push_deliveries(10)')).rows.length,0,'expired session excluded');
 await assert.rejects(db.query("insert into pth_push_events(kind,source_id) values('unknown',$1)",[source]),/check constraint/);
 // Real service role can execute the invoker RPC without public/anonymous grants.
 await db.exec('set role service_role');await db.query('select * from pth_claim_push_deliveries(10)');await db.exec('reset role');
 const beforeRollback=(await db.query("select count(*)::int n from pth_push_events where kind='applications'")).rows[0].n;
 await db.exec(sql('admin-push-applications-rollback.sql'));
 assert.equal((await db.query("select tgenabled from pg_trigger where tgname='pth_push_new_application'")).rows[0].tgenabled,'D');
 await insert('ffffffff-ffff-4fff-8fff-ffffffffffff');
 assert.equal((await db.query("select count(*)::int n from pth_push_events where kind='applications'")).rows[0].n,beforeRollback);
 await db.exec("insert into pedidos values('10101010-1010-4010-8010-101010101010');insert into pth_feedback values('20202020-2020-4020-8020-202020202020','mejora')");
 assert.equal((await db.query("select count(*)::int n from pth_push_events where source_id in('10101010-1010-4010-8010-101010101010','20202020-2020-4020-8020-202020202020')")).rows[0].n,2,'rollback preserves order/improvement inserts');
 console.log('PASS applications SQL locally: no backfill, disabled staging, INSERT/dedupe/rollback, unchanged order/improvement audiences, exclusive Angel/opt-in/session bounds, RLS/grants and service-only execution; production untouched');
}finally{await db.close()}})().catch(e=>{console.error(e);process.exitCode=1});
