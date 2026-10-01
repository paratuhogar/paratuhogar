const {PGlite}=require(process.env.PTH_PGLITE_MODULE||'/tmp/pth-feedback-db-test/node_modules/@electric-sql/pglite');
const fs=require('node:fs'),assert=require('node:assert/strict'),path=require('node:path');
(async()=>{const db=new PGlite();try{
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
 create table public.gestores(id uuid primary key,parent_id uuid,rol text,estado text,activo boolean);create table public.pth_secure_sessions(token_hash text primary key,gestor_id uuid,expires_at timestamptz);
 create table public.pedidos(id uuid primary key);create table public.pth_feedback(id uuid primary key,kind text);
 alter default privileges in schema public grant all on tables to anon,authenticated,service_role;`);
 await db.exec(fs.readFileSync(path.join(__dirname,'../supabase/proposals/admin-web-push.sql'),'utf8'));
 await db.exec(fs.readFileSync(path.join(__dirname,'../supabase/proposals/admin-web-push-dispatch.sql'),'utf8'));
 const disabled=await db.query("select tgenabled from pg_trigger where tgname in ('pth_push_new_order','pth_push_new_suggestion')");assert.ok(disabled.rows.every(r=>r.tgenabled==='D'));
 // Local activation simulation only; production remains disabled.
 await db.exec('alter table pedidos enable trigger pth_push_new_order;alter table pth_feedback enable trigger pth_push_new_suggestion;');
 for(const role of ['anon','authenticated']){
  const result=await db.query(`select has_table_privilege($1,'public.pth_push_subscriptions','select') as allowed`,[role]);assert.equal(result.rows[0].allowed,false);
 }
 await db.exec(`insert into pedidos values('11111111-1111-4111-8111-111111111111');insert into pth_feedback values('22222222-2222-4222-8222-222222222222','mejora'),('33333333-3333-4333-8333-333333333333','problema');`);
 assert.equal((await db.query('select count(*)::int as n from pth_push_events')).rows[0].n,2);
 await db.exec(`insert into pedidos values('11111111-1111-4111-8111-111111111111') on conflict do nothing;update pth_feedback set kind='mejora' where id='33333333-3333-4333-8333-333333333333';`);
 assert.equal((await db.query('select count(*)::int as n from pth_push_events')).rows[0].n,2);
 await db.exec(`begin;insert into pedidos values('44444444-4444-4444-8444-444444444444');rollback;`);
 assert.equal((await db.query('select count(*)::int as n from pth_push_events')).rows[0].n,2);
 const rls=await db.query(`select relrowsecurity from pg_class where relname in ('pth_push_subscriptions','pth_push_events','pth_push_deliveries')`);assert.equal(rls.rows.length,3);assert.ok(rls.rows.every(r=>r.relrowsecurity));
 const owner='38f20b63-a845-4a03-8d10-9a57da2ac2c4',other='55555555-5555-4555-8555-555555555555';
 await db.query("insert into gestores values($1,null,'admin','activo',true),($2,null,'admin','activo',true)",[owner,other]);
 for(const [actor,hash] of [[owner,'owner'],[other,'other']]){
  await db.query("insert into pth_secure_sessions values($1,$2,now()+interval '1 day')",[hash,actor]);
  await db.query("insert into pth_push_subscriptions(gestor_id,session_hash,endpoint,p256dh,auth,topics,created_at,expires_at) values($1,$2,$3,$4,$5,array['orders','suggestions'],now()-interval '1 day',now()+interval '1 day')",[actor,hash,'https://fcm.googleapis.com/'+hash,'a'.repeat(87),'b'.repeat(22)]);
 }
 const claimed=await db.query('select * from pth_claim_push_deliveries(10)');assert.equal(claimed.rows.length,3,'two order recipients, only owner for suggestion');
 assert.equal((await db.query('select * from pth_claim_push_deliveries(10)')).rows.length,0,'live lease not reclaimed');
 await db.exec("update pth_push_deliveries set lease_until=now()-interval '1 second' where state='sending'");
 const retry=await db.query('select * from pth_claim_push_deliveries(10)');assert.equal(retry.rows.length,3);assert.ok(retry.rows.every(r=>r.attempts===2));
 assert.notEqual(retry.rows[0].lease_token,claimed.rows[0].lease_token);
 for(const role of ['anon','authenticated'])assert.equal((await db.query("select has_function_privilege($1,'public.pth_claim_push_deliveries(integer)','execute') allowed",[role])).rows[0].allowed,false);
 console.log('PASS proposed SQL locally: privileges/RLS, canonical INSERT, improvement only, duplicate and rollback isolation; production untouched');
}finally{await db.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
