// Local PostgreSQL WASM only. No sockets, SDK, credentials or production data.
// Install optional test engine in a temporary folder, not application dependencies.
// PTH_PGLITE_MODULE=/tmp/pth-questionnaire-pg/node_modules/@electric-sql/pglite/dist/index.js node scripts/verify-questionnaire-sql.mjs
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {createHandler} from '../supabase/functions/secure-data/handler.mjs';
const {PGlite}=await import(process.env.PTH_PGLITE_MODULE?pathToFileURL(process.env.PTH_PGLITE_MODULE).href:'@electric-sql/pglite');
const migration=fs.readFileSync(new URL('../supabase/proposals/gestor-questionnaire.sql',import.meta.url),'utf8');
const db=new PGlite();
let checks=0;
async function check(name,work){await work();checks++;console.log('PASS '+name);}
const valid={version:1,source:'recomendacion',referrer:'',referrerGestor:'no_se',experience:'no',platforms:[],clients:'0',loyalty:'',channels:'no',storesCount:0};
async function insert(questionnaire,token=null,phone='fixture-'+Math.random()){
 return db.query('insert into public.gestores(nombre,telefono,password,estado,questionnaire,application_token) values ($1,$2,$3,$4,$5,$6) returning id',['Fixture',phone,'fixture-only','pendiente',questionnaire,token]);
}
const snapshot=async()=>JSON.stringify((await db.query('select id,nombre,telefono,estado,parent_id,created_at from public.gestores order by id')).rows);
const policies=async()=>JSON.stringify((await db.query("select policyname,roles,cmd,qual,with_check from pg_policies where schemaname='public' and tablename='gestores' order by policyname")).rows);
const access=async()=>JSON.stringify((await db.query("select grantee,privilege_type from information_schema.role_table_grants where table_schema='public' and table_name='gestores' order by grantee,privilege_type")).rows);
try{
 console.log('Engine: '+(await db.query('select version() as version')).rows[0].version);
 await db.exec(`
 create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
 create table public.gestores(id uuid primary key default gen_random_uuid(),created_at timestamptz default now(),nombre text,email text,telefono text,password text,estado text,rol text,parent_id uuid,activo boolean);
 alter table public.gestores enable row level security;
 create policy fixture_anon_read on public.gestores for select to anon using (true);
 create policy fixture_public_insert on public.gestores for insert to anon with check (true);
 create policy fixture_public_update on public.gestores for update to anon,authenticated using (true);
 revoke all on public.gestores from public,anon,authenticated;
 grant select,insert,update,delete on public.gestores to service_role;
 insert into public.gestores(nombre,telefono,estado,created_at) select 'Old fixture '||n,'fixture-old-'||n,case when n%4=0 then 'activo' when n%4=1 then 'pendiente' when n%4=2 then 'bloqueado' else 'ausente_definitivo' end,now()-interval '180 days' from generate_series(1,1201) n;
 `);
 const old=await snapshot(),grants=await access(),originalPolicies=await policies();
 await check('exact proposed migration executes and preserves all 1201 historical fixtures',async()=>{await db.exec(migration);assert.equal(await snapshot(),old);});
 await check('historical rows have NULL answers and token; legacy writes remain valid',async()=>{
  assert.equal((await db.query('select count(*)::int as count from public.gestores where questionnaire is null and application_token is null')).rows[0].count,1201);
  await db.exec("insert into public.gestores(nombre,telefono,estado) values ('Legacy fixture','fixture-legacy','pendiente')");
 });
 await check('table grants, RLS and existing fixture policies remain unchanged',async()=>{assert.equal(await access(),grants);assert.equal(await policies(),originalPolicies);assert.equal((await db.query("select relrowsecurity from pg_class where oid='public.gestores'::regclass")).rows[0].relrowsecurity,true);});
 await check('anon and authenticated cannot read answers directly',async()=>{
  for(const role of ['anon','authenticated']){await db.exec('set role '+role);try{await assert.rejects(()=>db.query('select questionnaire from public.gestores'),error=>error.code==='42501');}finally{await db.exec('reset role');}}
 });
 await check('existing service role can store and read answers without added grants',async()=>{await db.exec('set role service_role');try{const result=await insert(valid);assert.ok(result.rows[0].id);assert.equal((await db.query('select count(*)::int as count from public.gestores where questionnaire is not null')).rows[0].count,1);}finally{await db.exec('reset role');}});
 await check('invalid object, missing/wrong version and oversized payload fail the CHECK',async()=>{
  for(const value of [[],{}, {version:2},{version:1,large:'x'.repeat(11000)}])await assert.rejects(()=>insert(value),error=>error.code==='23514');
 });
 await check('partial unique UUID index permits multiple NULLs and denies duplicate non-NULL tokens',async()=>{
  await insert(valid);await insert(valid);const token='00000000-0000-4000-8000-000000000010';await insert(valid,token);await assert.rejects(()=>insert(valid,token),error=>error.code==='23505');
 });
 await check('invalid UUID is rejected',async()=>{await assert.rejects(()=>insert(valid,'invalid-token'),error=>error.code==='22P02');});
 await check('multirow insertion is atomic when one answer fails validation',async()=>{
  const before=(await db.query('select count(*)::int as count from public.gestores')).rows[0].count;
  await assert.rejects(()=>db.query("insert into public.gestores(nombre,questionnaire) values ('atomic-valid',$1),('atomic-invalid',$2)",[valid,{version:2}]),error=>error.code==='23514');
  assert.equal((await db.query('select count(*)::int as count from public.gestores')).rows[0].count,before);
 });
 // Minimal Supabase-shaped query adapter over the actual local PostgreSQL engine.
 const adapter={from(table){assert.equal(table,'gestores');let operation='select',rows,filters=[],single=false,columns='*',limit=1000,returning=false;
  const q={select(value='*'){columns=value;if(operation==='insert')returning=true;return q},eq(key,value){filters.push([key,value]);return q},limit(value){limit=value;return q},maybeSingle(){single=true;return q},order(){return q},insert(value){operation='insert';rows=Array.isArray(value)?value:[value];return q},then(resolve,reject){return (async()=>{
   try{let result;
    if(operation==='insert'){const keys=Object.keys(rows[0]);assert.equal(rows.length,1);const params=keys.map(key=>rows[0][key]);result=await db.query('insert into public.gestores('+keys.join(',')+') values ('+params.map((_,i)=>'$'+(i+1)).join(',')+') returning *',params);}
    else{assert.match(columns,/^(\*|[a-z_,]+)$/);const where=filters.length?' where '+filters.map(([key],i)=>{assert.match(key,/^[a-z_]+$/);return key+'=$'+(i+1)}).join(' and '):'';result=await db.query('select '+columns+' from public.gestores'+where+' limit '+Number(limit),filters.map(([,v])=>v));}
    return {data:operation==='insert'&&!returning?null:single?result.rows[0]||null:result.rows,error:null};
   }catch(error){return {data:null,error:{message:error.message,code:error.code}}}
  })().then(resolve,reject)}};return q}};
 const handler=createHandler({db:adapter});
 const request=async input=>{const response=await handler(new Request('https://fixture.invalid',{method:'POST',body:JSON.stringify({action:'query',table:'gestores',op:'insert',values:[input]})}));return response.json()};
 const applicant={nombre:'Edge Fixture',telefono:'fixture-edge',password:'fixture-only',questionnaire:valid,application_token:'00000000-0000-4000-8000-000000000011'};
 await check('actual Edge handler stores normalized answers in PostgreSQL and confirms retry without duplication',async()=>{
  assert.equal((await request(applicant)).error,null);assert.equal((await request(applicant)).error,null);
  const rows=(await db.query('select estado,rol,questionnaire from public.gestores where telefono=$1',[applicant.telefono])).rows;assert.equal(rows.length,1);assert.equal(rows[0].estado,'pendiente');assert.equal(rows[0].rol,'gestor');assert.equal(rows[0].questionnaire.referrer,'');
 });
 await check('different token for same registered phone does not modify an applicant',async()=>{assert.ok((await request({...applicant,application_token:'00000000-0000-4000-8000-000000000012'})).error);assert.equal((await db.query('select count(*)::int as count from public.gestores where telefono=$1',[applicant.telefono])).rows[0].count,1);});
 await check('simultaneous handler requests for same token create exactly one row',async()=>{
  const concurrent={...applicant,telefono:'fixture-concurrent',application_token:'00000000-0000-4000-8000-000000000013'};
  const replies=await Promise.all([request(concurrent),request(concurrent)]);assert.ok(replies.every(reply=>!reply.error));assert.equal((await db.query('select count(*)::int as count from public.gestores where telefono=$1',[concurrent.telefono])).rows[0].count,1);
 });
 await check('public Edge query hides answers/token and rejects private filters',async()=>{
  const query=async body=>{const response=await handler(new Request('https://fixture.invalid',{method:'POST',body:JSON.stringify({action:'query',table:'gestores',...body})}));return response.json()};
  const result=await query({filters:[{method:'eq',column:'telefono',value:applicant.telefono}]});assert.equal(result.error,null);assert.equal(result.data.length,1);assert.equal(result.data[0].questionnaire,undefined);assert.equal(result.data[0].application_token,undefined);
  assert.ok((await query({filters:[{method:'eq',column:'questionnaire',value:valid}]})).error);
 });
 await check('old code projection and inserts work while keeping new answers for functional rollback',async()=>{
  const count=(await db.query('select count(*)::int as count from public.gestores where questionnaire is not null')).rows[0].count;
  await db.exec("insert into public.gestores(nombre,telefono,estado) values ('Rollback legacy','fixture-rollback','pendiente')");assert.ok((await db.query('select id,nombre,estado from public.gestores')).rows.length);
  assert.equal((await db.query('select count(*)::int as count from public.gestores where questionnaire is not null')).rows[0].count,count);
 });
 await check('optional destructive schema removal works on disposable fixtures and preserves legacy columns/rows',async()=>{
  const before=await snapshot();const rollback='begin;'+migration.split('-- begin;')[1].replace(/^-- ?/gm,'');await db.exec(rollback);assert.equal(await snapshot(),before);assert.equal(await access(),grants);
 });
 await check('missing schema fails safely without inserting or changing any request',async()=>{
  const before=await snapshot();const result=await request({...applicant,telefono:'fixture-missing-schema'});assert.ok(result.error);assert.equal(await snapshot(),before);
 });
 await check('migration rolls back atomically if a later statement fails',async()=>{
  await db.exec('create index gestores_application_token_unique on public.gestores(id)');
  await assert.rejects(()=>db.exec(migration),error=>error.code==='42P07');await db.exec('rollback;');
  assert.equal((await db.query("select count(*)::int as count from information_schema.columns where table_schema='public' and table_name='gestores' and column_name in ('questionnaire','application_token')")).rows[0].count,0);
 });
 console.log(`Result: ${checks} checks passed. Local fixtures only. PGlite has one exclusive connection; this does not verify multi-session PostgreSQL MVCC or Supabase REST deployment.`);
}finally{await db.close()}
