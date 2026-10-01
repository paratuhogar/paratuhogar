// Run against temporary embedded PostgreSQL only. No production connection/config is read.
// npm install --prefix /tmp/pth-feedback-db-test --ignore-scripts @electric-sql/pglite@0.5.8
// PTH_PGLITE_MODULE=/tmp/pth-feedback-db-test/node_modules/@electric-sql/pglite node tests/feedback-database.cjs
const {PGlite}=require(process.env.PTH_PGLITE_MODULE||'@electric-sql/pglite');
const {readFileSync}=require('node:fs');
const {join}=require('node:path');
const assert=require('node:assert/strict');
const actor='11111111-1111-4111-8111-111111111111';
const a='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',b='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',c='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
(async()=>{
 const db=new PGlite();let checks=0;
 const pass=message=>{checks++;console.log('PASS '+message);};
 const denied=async(sql,params,code='42501')=>assert.rejects(db.query(sql,params),e=>e.code===code);
 try{
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
   grant usage on schema public to anon,authenticated,service_role;
   alter default privileges in schema public grant all on tables to anon,authenticated,service_role;
   create table public.gestores(id uuid primary key);
   insert into public.gestores values('${actor}');`);
  await db.exec(readFileSync(join(__dirname,'../supabase/proposals/gestor-feedback.sql'),'utf8'));
  const meta=await db.query("select relrowsecurity from pg_class where oid='public.pth_feedback'::regclass");
  assert.equal(meta.rows[0].relrowsecurity,true);
  assert.equal((await db.query("select count(*)::int as n from pg_policies where schemaname='public' and tablename='pth_feedback'")).rows[0].n,0);
  pass('exact proposal executes; RLS enabled with zero browser policies');
  for(const role of ['anon','authenticated','service_role']){
   const result=await db.query(`select has_table_privilege($1,'public.pth_feedback','SELECT') as read,
    has_table_privilege($1,'public.pth_feedback','INSERT') as create,
    has_table_privilege($1,'public.pth_feedback','UPDATE') as update,
    has_table_privilege($1,'public.pth_feedback','DELETE') as delete,
    has_table_privilege($1,'public.pth_feedback','TRUNCATE') as truncate,
    has_function_privilege($1,'public.pth_feedback_guard()','EXECUTE') as execute`,[role]);
   assert.deepEqual(result.rows[0],{read:role==='service_role',create:role==='service_role',update:role==='service_role',delete:false,truncate:false,execute:role==='service_role'});
  }
  pass('effective grants override permissive defaults, including service DELETE/TRUNCATE denial');
  const insert=`insert into public.pth_feedback(id,author_id,team_id,kind,title,need,workflow,page,screenshot)
   values($1,$2,$2,'problema','Title','Action','Outcome','/index.html',null)`;
  await db.exec('set role service_role');
  for(const id of [a,b,c])await db.query(insert,[id,actor]);
  await denied('delete from public.pth_feedback where id=$1',[a]);
  await denied('truncate public.pth_feedback');
  pass('service can create records but cannot delete or truncate');
  await denied(insert,[a,actor],'23505');
  await denied("update public.pth_feedback set title='Changed',revision=revision+1 where id=$1",[a],'P0001');
  await denied("update public.pth_feedback set status='en_revision' where id=$1",[a],'P0001');
  pass('database enforces unique IDs, immutable submissions and revision increments');
  await denied("update public.pth_feedback set status='invalid',revision=revision+1 where id=$1",[a],'23514');
  await denied("update public.pth_feedback set status='duplicado',revision=revision+1 where id=$1",[a],'23514');
  await denied("update public.pth_feedback set duplicate_of=$1,status='duplicado',revision=revision+1 where id=$1",[a],'23514');
  pass('database rejects invalid statuses and missing/self duplicate references');
  await db.query("update public.pth_feedback set status='en_revision',revision=revision+1,updated_at='2000-01-01' where id=$1 and revision=0",[a]);
  assert.ok(new Date((await db.query('select updated_at from public.pth_feedback where id=$1',[a])).rows[0].updated_at)>new Date('2020-01-01'));
  const stale=await db.query("update public.pth_feedback set status='resuelto',revision=revision+1 where id=$1 and revision=0 returning id",[a]);assert.equal(stale.rows.length,0);
  pass('timestamp is server-enforced and stale reviews update zero rows');
  await db.query("update public.pth_feedback set status='duplicado',duplicate_of=$2,revision=revision+1 where id=$1",[a,b]);
  await denied("update public.pth_feedback set status='duplicado',duplicate_of=$2,revision=revision+1 where id=$1",[b,a],'P0001');
  await denied("update public.pth_feedback set status='duplicado',duplicate_of=$2,revision=revision+1 where id=$1",[b,c],'P0001');
  pass('sequential duplicate cycles and chains are rejected by trigger');
  await db.exec('reset role');
  for(const role of ['anon','authenticated']){
   await db.exec(`set role ${role}`);
   await denied('select screenshot from public.pth_feedback');
   await denied(insert,['dddddddd-dddd-4ddd-8ddd-dddddddddddd',actor]);
   await denied("update public.pth_feedback set status='resuelto',revision=revision+1");
   await denied('delete from public.pth_feedback');
   await db.exec('reset role');
  }
  pass('actual SQL roles cannot read screenshots or read/write private rows');
  await db.exec('begin; grant select on public.pth_feedback to authenticated; set local role authenticated;');
  assert.equal((await db.query('select * from public.pth_feedback')).rows.length,0);
  await db.exec('rollback');
  pass('RLS still hides all rows if SELECT is accidentally granted');
  console.log(`${checks} database checks passed. Embedded PostgreSQL only; no multi-session concurrency or deployed gateway validation.`);
 }finally{await db.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
