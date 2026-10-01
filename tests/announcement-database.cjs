const {PGlite}=require(process.env.PTH_PGLITE_MODULE||'@electric-sql/pglite');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
(async()=>{const db=new PGlite();try{
 const id='11111111-1111-4111-8111-111111111111';
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
 grant usage on schema public to anon,authenticated,service_role;
 alter default privileges in schema public grant all on tables to anon,authenticated,service_role;
 create table public.gestores(id uuid primary key);insert into public.gestores values('${id}');`);
 await db.exec(fs.readFileSync(path.join(__dirname,'../supabase/proposals/feedback-announcement.sql'),'utf8'));
 assert.equal((await db.query("select relrowsecurity from pg_class where oid='public.pth_feedback_announcement_ack'::regclass")).rows[0].relrowsecurity,true);
 for(const role of ['anon','authenticated','service_role']){
  await db.exec('set role '+role);
  for(const sql of ["update public.pth_feedback_announcement_ack set acknowledged_at=now()","delete from public.pth_feedback_announcement_ack","truncate public.pth_feedback_announcement_ack"])
   await assert.rejects(db.exec(sql),e=>e.code==='42501');
  if(role!=='service_role')for(const sql of ['select * from public.pth_feedback_announcement_ack',`insert into public.pth_feedback_announcement_ack(gestor_id) values('${id}')`])await assert.rejects(db.exec(sql),e=>e.code==='42501');
  else{
   await db.exec(`insert into public.pth_feedback_announcement_ack(gestor_id) values('${id}')`);
   await assert.rejects(db.exec(`insert into public.pth_feedback_announcement_ack(gestor_id) values('${id}')`),e=>e.code==='23505');
   assert.equal((await db.query('select * from public.pth_feedback_announcement_ack')).rows.length,1);
  }
  await db.exec('reset role');
 }
 console.log('PASS exact SQL: RLS, denied anonymous/authenticated reads+writes, service SELECT/INSERT only, unique account and timestamp');
}finally{await db.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
