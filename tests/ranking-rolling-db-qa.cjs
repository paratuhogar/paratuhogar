// Disposable PostgreSQL only; frozen clock substitution never ships to production.
const {PGlite}=require('@electric-sql/pglite');
const fs=require('node:fs'),assert=require('node:assert/strict');
const before=fs.readFileSync('supabase/migrations/20261004102540_monthly_ranking_recognition.sql','utf8');
const file=fs.readdirSync('supabase/migrations').find(f=>f.includes('rolling_30_day_created_delivered_ranking'));
const rolling=file?fs.readFileSync('supabase/migrations/'+file,'utf8'):null;
const own='11111111-1111-4111-8111-111111111111',other='22222222-2222-4222-8222-222222222222',child='33333333-3333-4333-8333-333333333333',admin='44444444-4444-4444-8444-444444444444';
(async()=>{
 const db=new PGlite();let checks=0;const check=(actual,expected)=>{assert.deepEqual(actual,expected);checks++};
 async function install(now){
  if(rolling)await db.exec(rolling.replaceAll('current_timestamp',`timestamptz '${now}'`));
  else{const summary=before.slice(before.indexOf('create or replace function public.pth_ranking_summary'));await db.exec(summary.replaceAll('current_timestamp',`timestamptz '${now}'`));}
 }
 async function summary(id=own){return (await db.query(`select public.pth_ranking_summary('${id}') r`)).rows[0].r;}
 try{
  await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
  create table public.gestores(id uuid primary key,nombre text,nombre_publico text,parent_id uuid,rol text,estado text,activo boolean);
  create table public.pedidos(id bigint generated always as identity primary key,gestor text,subgestor_nombre text,fecha timestamptz,fecha_entrega timestamptz,estado text);
  grant select on public.gestores,public.pedidos to service_role;`);
  await db.exec(before);const aclBefore=(await db.query("select proacl::text acl from pg_proc where oid='public.pth_ranking_summary(uuid)'::regprocedure")).rows[0].acl;
  await db.exec(`insert into public.gestores values('${own}','Principal','DEMO Principal',null,'gestor','activo',true),('${other}','Other','DEMO Other',null,'gestor','activo',true),('${child}','Child','DEMO Child','${own}','admin','activo',true),('${admin}','Admin','DEMO Admin',null,'admin','activo',true),('55555555-5555-4555-8555-555555555555','Ambiguous','A',null,'gestor','activo',true),('66666666-6666-4666-8666-666666666666','Ambiguous','B',null,'gestor','activo',true);`);
  await db.exec(`insert into public.pedidos(gestor,subgestor_nombre,fecha,fecha_entrega,estado) values
  ('Principal',null,'2026-09-05T04:00:00Z',null,'Entregado'),
  ('Principal',null,'2026-10-04T12:00:00Z',null,'Entregado'),
  ('Principal',null,'2026-09-20T12:00:00Z','2026-11-03T12:00:00Z','Entregado'),
  ('Principal',null,'2026-09-30T12:00:00Z','2026-09-01T12:00:00Z','Entregado'),
  ('Principal',null,'2026-09-20T12:00:00Z',null,'Entregado'),
  ('Principal',null,'2026-09-05T03:59:59.999Z','2026-10-02T12:00:00Z','Entregado'),
  ('Principal',null,'2026-10-04T12:00:00.001Z',null,'Entregado'),
  ('Principal',null,null,'2026-10-02T12:00:00Z','Entregado'),
  ('Principal',null,'2026-09-20T12:00:00Z',null,'Pendiente'),
  ('Principal',null,'2026-09-20T12:00:00Z',null,'Cancelado'),
  ('Principal','Child','2026-09-10T12:00:00Z',null,'Entregado'),
  ('Ambiguous',null,'2026-09-10T12:00:00Z',null,'Entregado');
  insert into public.pedidos(gestor,fecha,estado) select 'Other','2026-09-20T12:00:00Z','Entregado' from generate_series(1,5);`);
  await install('2026-10-04T12:00:00Z');const r=await summary();
  check(r.self.count,5);check(r.self.rank,1);check(r.leaderCount,2);check(r.top.map(x=>x.rank),[1,1,3]);
  check(r.period.kind,'created-delivered-30d');check(r.period.key,'2026-10-04');check(r.period.startDate,'2026-09-05');check(r.period.endDate,'2026-10-04');
  check(Date.parse(r.period.startAt),Date.parse('2026-09-05T04:00:00Z'));check(Date.parse(r.period.endAt),Date.parse('2026-10-04T12:00:00Z'));check(Date.parse(r.period.cacheUntil),Date.parse('2026-10-05T04:00:00Z'));
  check((await summary(child)).self.count,1);check((await summary(child)).self.nextHigherCount,5);check((await summary(admin)).self.participates,false);check((await summary('55555555-5555-4555-8555-555555555555')).self.identityReliable,false);check(r.history,[]);
  await db.exec(`update public.pedidos set estado='Cancelado' where gestor='Other' and id=(select min(id) from public.pedidos where gestor='Other')`);check((await summary(other)).self.count,4);
  for(const [now,start,cache] of [
   ['2026-10-31T23:59:59Z','2026-10-02T04:00:00Z','2026-11-01T04:00:00Z'],
   ['2026-11-01T04:00:00Z','2026-10-03T04:00:00Z','2026-11-02T05:00:00Z'],
   ['2026-11-01T05:30:00Z','2026-10-03T04:00:00Z','2026-11-02T05:00:00Z'],
   ['2026-11-30T12:00:00Z','2026-11-01T04:00:00Z','2026-12-01T05:00:00Z'],
   ['2027-03-22T12:00:00Z','2027-02-21T05:00:00Z','2027-03-23T04:00:00Z']]){
   await install(now);const s=await summary();check(Date.parse(s.period.startAt),Date.parse(start));check(Date.parse(s.period.cacheUntil),Date.parse(cache));check(Date.parse(s.period.endAt),Date.parse(now));
  }
  await install('2026-10-04T12:00:00Z');check((await db.query("select proacl::text acl from pg_proc where oid='public.pth_ranking_summary(uuid)'::regprocedure")).rows[0].acl,aclBefore);
  for(const role of ['anon','authenticated']){await db.exec(`set role ${role};`);await assert.rejects(summary(),/permission denied/);checks++;await db.exec('reset role;');}
  await db.exec('set role service_role;');check((await summary()).self.count,5);await db.exec('reset role;');
  check((await db.query("select pg_get_constraintdef(oid) c from pg_constraint where conname='ranking_closure_pending_verification'")).rows[0].c,'CHECK (false)');
  console.log('PASS rolling30 PostgreSQL: '+checks+' assertions; creation dates/current state, inclusive bounds, ties, attribution, Havana DST, roles and unchanged closure block');
 }finally{await db.close();}
})().catch(e=>{console.error(e);process.exit(1)});
