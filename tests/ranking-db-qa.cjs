// Real PostgreSQL engine in WASM; no production database connection.
// NODE_PATH points to an externally installed @electric-sql/pglite.
const {PGlite}=require('@electric-sql/pglite');
const fs=require('node:fs'),assert=require('node:assert/strict');
const migration=fs.readFileSync('supabase/migrations/20261004102540_monthly_ranking_recognition.sql','utf8');
const baseline=fs.readFileSync('docs/ranking-summary-proposal.sql','utf8');
const own='11111111-1111-4111-8111-111111111111';
const ids=Array.from({length:5},(_,i)=>`${i+1}${i+1}${i+1}${i+1}${i+1}${i+1}${i+1}${i+1}-${i+1}${i+1}${i+1}${i+1}-4${i+1}${i+1}${i+1}-8${i+1}${i+1}${i+1}-${String(i+1).repeat(12)}`);
(async()=>{
 const db=new PGlite();let assertions=0;
 const check=(v)=>{assert.ok(v);assertions++;};
 async function rejects(sql,pattern){await assert.rejects(db.exec(sql),pattern);assertions++;}
 try{
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
 create table public.gestores(id uuid primary key,nombre text,nombre_publico text,parent_id uuid,rol text,estado text,activo boolean);
 create table public.pedidos(id bigint generated always as identity primary key,gestor text,subgestor_nombre text,fecha timestamptz,fecha_entrega timestamptz,estado text);
 grant select on public.gestores,public.pedidos to service_role;`);
 await db.exec(baseline);
 if(process.env.PTH_SKIP_MIGRATION!=='1')await db.exec(migration);
 const rolePrivileges=(await db.query("select has_function_privilege('service_role','public.pth_finalize_monthly_ranking(text)','EXECUTE') as allowed")).rows[0];check(rolePrivileges.allowed);
 // Production SQL and actual server clock: pre-November and still-open months denied.
 await rejects("select public.pth_finalize_monthly_ranking('2026-10')",/predates/);
 await rejects("select public.pth_finalize_monthly_ranking('2099-11')",/Open months/);
 // Only clock literals are substituted in the isolated second migration installation.
 // No production clock override parameter, GUC, hook or API is introduced.
 await db.exec('drop table private.ranking_monthly_results;');
 await db.exec(migration.replaceAll('current_timestamp',"timestamptz '2026-12-03T12:00:00Z'"));
 await rejects("select public.pth_finalize_monthly_ranking('2026-11')",/closure disabled/);
 await db.exec('set role service_role;');
 await rejects("insert into private.ranking_monthly_results values('2026-11','2026-11-01','2026-12-01','2026-12-03',true,'[]')",/ranking_closure_pending_verification/);
 await db.exec('reset role;drop table private.ranking_monthly_results;');
 // Hypothetical closure/projection only: remove both fail-closed guards in this disposable database.
 const hypothetical=migration.replace(',\n -- Fail closed: no reliable coverage/eligibility evidence source exists yet.\n constraint ranking_closure_pending_verification check(false)','').replace(" raise exception 'Coverage and eligibility verification unavailable; closure disabled' using errcode='22023';\n",'');
 await db.exec(hypothetical.replaceAll('current_timestamp',"timestamptz '2026-12-03T12:00:00Z'"));
 for(const role of ['anon','authenticated']){
  await db.exec(`set role ${role};`);
  await rejects('select * from private.ranking_monthly_results',/permission denied/);
  await rejects("select public.pth_finalize_monthly_ranking('2026-11')",/permission denied/);
  await rejects(`select public.pth_ranking_summary('${own}')`,/permission denied/);
  await db.exec('reset role;');
 }
 // Isolated defense-in-depth check: even accidental future grants do not open RLS rows.
 await db.exec('grant usage on schema private to anon;grant select,insert on private.ranking_monthly_results to anon;set role anon;');
 check((await db.query('select count(*)::int n from private.ranking_monthly_results')).rows[0].n===0);
 await rejects("insert into private.ranking_monthly_results values('2026-11','2026-11-01','2026-12-01','2026-12-03',true,'[]')",/row-level security/);
 await db.exec('reset role;revoke select,insert on private.ranking_monthly_results from anon;revoke usage on schema private from anon;');
 const perms=(await db.query("select has_table_privilege('service_role','private.ranking_monthly_results','SELECT') as s,has_table_privilege('service_role','private.ranking_monthly_results','INSERT') as i,has_table_privilege('service_role','private.ranking_monthly_results','UPDATE') as u,has_table_privilege('service_role','private.ranking_monthly_results','DELETE') as d")).rows[0];check(perms.s&&perms.i&&!perms.u&&!perms.d);
 check((await db.query("select relrowsecurity from pg_class where oid='private.ranking_monthly_results'::regclass")).rows[0].relrowsecurity);
 for(let i=0;i<5;i++)await db.query('insert into public.gestores values($1,$2,$3,null,\'gestor\',\'activo\',true)',[ids[i],`Seller ${i}`,`DEMO ${i}`]);
 for(let i=0;i<4;i++)for(let j=0;j<3;j++)await db.query("insert into public.pedidos(gestor,fecha,fecha_entrega,estado) values($1,'2026-11-04T12:00:00Z','2026-11-05T12:00:00Z','Entregado')",[`Seller ${i}`]);
 await db.exec("insert into public.pedidos(gestor,fecha,fecha_entrega,estado) values('Seller 4','2026-11-04T12:00:00Z','2026-11-05T12:00:00Z','Entregado')");
 // Bad target-month dates block closure, no row written.
 await db.exec("insert into public.pedidos(gestor,fecha,estado) values('Seller 0','2026-11-04T12:00:00Z','Entregado')");
 await rejects("select public.pth_finalize_monthly_ranking('2026-11')",/requires date/);
 check((await db.query('select count(*)::int n from private.ranking_monthly_results')).rows[0].n===0);
 await db.exec('delete from public.pedidos where fecha_entrega is null;');
 // Ambiguous seller identity blocks target-month recognition.
 await db.exec("insert into public.gestores values('ffffffff-ffff-4fff-8fff-ffffffffffff','Seller 0','DEMO duplicate',null,'gestor','activo',true)");
 await rejects("select public.pth_finalize_monthly_ranking('2026-11')",/requires date/);
 await db.exec("delete from public.gestores where id='ffffffff-ffff-4fff-8fff-ffffffffffff'");
 // Historical undated deliveries are never assigned to the target period.
 await db.exec("insert into public.pedidos(gestor,fecha,estado) values('Seller 0','2026-09-04T12:00:00Z','Entregado')");
 await db.exec("insert into public.pedidos(gestor,fecha,fecha_entrega,estado) values('Venta Directa','2026-11-04T12:00:00Z','2026-11-05T12:00:00Z','Entregado')");
 await db.exec('set role service_role;');
 const close=async()=> (await db.query("select public.pth_finalize_monthly_ranking('2026-11') as r")).rows[0].r;
 const first=await close(),second=await close();assert.deepEqual(first,second);assertions++;check(first.leaderCount===4);
 const archive=(await db.query('select * from private.ranking_monthly_results')).rows[0];check(archive.winners.length===4);check(archive.start_at.toISOString()==='2026-11-01T04:00:00.000Z');
 await rejects("update private.ranking_monthly_results set reliable=false",/permission denied/);
 await rejects('delete from private.ranking_monthly_results',/permission denied/);
 const result=(await db.query(`select public.pth_ranking_summary('${ids[0]}') r`)).rows[0].r;
 check(result.history.length===1&&result.history[0].leaderCount===4&&result.history[0].aliases.length===3);
 check(result.self.monthlyBadges.length===1&&result.self.monthlyBadges[0].month==='2026-11');
 check(!JSON.stringify(result.history).includes(ids[1]));
 await db.exec('reset role;');
 // December summary: four tied leaders; exact higher count despite limited neighbors.
 for(let i=0;i<4;i++)for(let j=0;j<3;j++)await db.query("insert into public.pedidos(gestor,fecha,fecha_entrega,estado) values($1,'2026-12-01T12:00:00Z','2026-12-02T12:00:00Z','Entregado')",[`Seller ${i}`]);
 await db.exec("insert into public.pedidos(gestor,fecha,fecha_entrega,estado) values('Seller 4','2026-12-01T12:00:00Z','2026-12-02T12:00:00Z','Entregado')");
 const current=(await db.query(`select public.pth_ranking_summary('${ids[4]}') r`)).rows[0].r;check(current.leaderCount===4&&current.self.nextHigherCount===3);
 const {rankingDTO}=await import('../supabase/functions/secure-data/ranking.mjs');check(rankingDTO(current,ids[4]).self.monthlyBadges.length===0);
 // Existing closure remains immutable even if future current aggregates change.
 check(JSON.stringify(await close())===JSON.stringify(first));
 // Role precedence: child with stored admin role competes; standalone admin does not.
 await db.exec(`insert into public.gestores values('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','Admin','DEMO admin',null,'admin','activo',true),('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','Child','DEMO child','${ids[0]}','admin','activo',true);
 insert into public.pedidos(gestor,subgestor_nombre,fecha,fecha_entrega,estado) values('Seller 0','Child','2026-12-01','2026-12-02','Entregado'),('Admin',null,'2026-12-01','2026-12-02','Entregado');`);
 const child=(await db.query("select public.pth_ranking_summary('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb') r")).rows[0].r;
 const admin=(await db.query("select public.pth_ranking_summary('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa') r")).rows[0].r;
 check(child.self.participates&&child.self.count===1);check(!admin.self.participates&&admin.self.rank===null&&admin.self.nextHigherCount===null);
 check((await db.query(`select public.pth_ranking_summary('${ids[0]}') r`)).rows[0].r.self.count===3);
 // Six-month public history window; permanent rows and own November badge retained.
 for(const month of ['2026-12','2027-01','2027-02','2027-03','2027-04','2027-05'])await db.query(`insert into private.ranking_monthly_results(month,start_at,end_at,closed_at,reliable,winners) values($1,($1||'-01')::timestamp at time zone 'America/Havana',(($1||'-01')::timestamp+interval '1 month') at time zone 'America/Havana','2027-06-02',true,$2)`,[month,JSON.stringify(archive.winners)]);
 const summarySQL=migration.slice(migration.indexOf('create or replace function public.pth_ranking_summary')).replaceAll('current_timestamp',"timestamptz '2027-06-03T12:00:00Z'");await db.exec(summarySQL);
 const later=(await db.query(`select public.pth_ranking_summary('${ids[0]}') r`)).rows[0].r;
 check(later.history.length===6&&later.history.every(h=>h.aliases.length<=3));check(later.self.monthlyBadges.length===7&&later.self.monthlyBadges.some(b=>b.month==='2026-11'));check(!JSON.stringify(later.history).includes(ids[1]));
 console.log('PASS PostgreSQL local:',assertions,'assertions; roles/RLS, open/October rejection, unreliable dates, all tied winners, idempotency, Havana fold, bounded aliases and private own badges');
 }finally{await db.close();}
})().catch(e=>{console.error(e.message);process.exit(1)});
