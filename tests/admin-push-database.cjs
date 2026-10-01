const {PGlite}=require(process.env.PTH_PGLITE_MODULE||'/tmp/pth-feedback-db-test/node_modules/@electric-sql/pglite');
const fs=require('node:fs'),assert=require('node:assert/strict'),path=require('node:path');
(async()=>{const db=new PGlite();try{
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
 create table public.gestores(id uuid primary key);create table public.pth_secure_sessions(token_hash text primary key);
 create table public.pedidos(id uuid primary key);create table public.pth_feedback(id uuid primary key,kind text);
 alter default privileges in schema public grant all on tables to anon,authenticated,service_role;`);
 await db.exec(fs.readFileSync(path.join(__dirname,'../supabase/proposals/admin-web-push.sql'),'utf8'));
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
 console.log('PASS proposed SQL locally: privileges/RLS, canonical INSERT, improvement only, duplicate and rollback isolation; production untouched');
}finally{await db.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
