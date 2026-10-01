// Isolated native PostgreSQL 17.6. Never reads production connection settings.
// PTH_NATIVE_PG=/tmp/pth-postgres-native/node_modules/@embedded-postgres/linux-x64/native
// PTH_PG_MODULE=/tmp/pth-postgres-native/node_modules/pg node tests/feedback-concurrency.cjs
const {Client}=require(process.env.PTH_PG_MODULE||'pg');
const {mkdtempSync,readFileSync,rmSync,mkdirSync}=require('node:fs');
const {join}=require('node:path');
const {tmpdir}=require('node:os');
const {execFileSync}=require('node:child_process');
const assert=require('node:assert/strict');
const native=process.env.PTH_NATIVE_PG;
if(!native)throw Error('Set PTH_NATIVE_PG to the isolated test binary directory.');
const root=mkdtempSync(join(tmpdir(),'pth-feedback-concurrency-'));
const data=join(root,'data'),socket=join(root,'socket');mkdirSync(socket,{mode:0o700});
const env={...process.env,LD_LIBRARY_PATH:join(native,'lib')};
const run=(bin,args)=>execFileSync(join(native,'bin',bin),args,{env,stdio:'pipe',timeout:20000});
const actor='11111111-1111-4111-8111-111111111111';
const a='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',b='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',c='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
let started=false,clients=[];
(async()=>{
 try{
  run('initdb',['-D',data,'-U','postgres','--auth-local=trust','--auth-host=reject','--no-locale','--encoding=UTF8']);
  run('pg_ctl',['-D',data,'-l',join(root,'postgres.log'),'-o',`-c listen_addresses='' -k ${socket} -p 55438`,'-w','start']);started=true;
  for(let i=0;i<3;i++){const client=new Client({host:socket,port:55438,database:'postgres',user:'postgres'});await client.connect();await client.query("set statement_timeout='10s'");clients.push(client);}
  const [control,first,second]=clients;
  console.log((await control.query('select version()')).rows[0].version);
  await control.query(`create role anon; create role authenticated; create role service_role bypassrls; create table public.gestores(id uuid primary key); insert into public.gestores values('${actor}');`);
  await control.query(readFileSync(join(__dirname,'../supabase/proposals/gestor-feedback.sql'),'utf8'));
  const pid=(await second.query('select pg_backend_pid() as pid')).rows[0].pid;
  const reset=async()=>{await control.query('truncate public.pth_feedback');for(const id of [a,b,c])await control.query("insert into public.pth_feedback(id,author_id,team_id,kind,title,need,workflow,page) values($1,$2,$2,'problema','Synthetic test','Synthetic action','Synthetic outcome','/index.html')",[id,actor]);};
  const link="update public.pth_feedback set duplicate_of=$2,status='duplicado',revision=revision+1 where id=$1 returning id";
  const waitForLock=async()=>{const deadline=Date.now()+5000;while(Date.now()<deadline){const result=await control.query('select wait_event_type,wait_event from pg_stat_activity where pid=$1',[pid]);if(result.rows[0]?.wait_event_type==='Lock')return result.rows[0].wait_event;await new Promise(r=>setTimeout(r,20));}throw Error('Second connection did not demonstrably wait for a database lock.');};
  const scenario=async(name,firstPair,secondPair,rollback=false)=>{
   await reset();await first.query('begin');await second.query('begin');await first.query(link,firstPair);
   const pending=second.query(link,secondPair).then(result=>({result}),error=>({error}));
   assert.equal(await waitForLock(),'advisory');
   await first.query(rollback?'rollback':'commit');const outcome=await pending;
   if(rollback){assert.equal(outcome.error,undefined);await second.query('commit');}
   else{assert.equal(outcome.error?.code,'P0001');await second.query('rollback');}
   const graph=await control.query('select f.id from public.pth_feedback f join public.pth_feedback original on original.id=f.duplicate_of where original.duplicate_of is not null');assert.equal(graph.rows.length,0);
   console.log('PASS '+name);
  };
  await scenario('opposite concurrent links cannot create a cycle',[a,b],[b,a]);
  await scenario('an original gaining a child cannot become a duplicate',[a,b],[b,c]);
  await scenario('a new duplicate cannot become another report\'s original',[b,c],[a,b]);
  await scenario('rolled-back first review lets the waiting valid review proceed',[a,b],[b,a],true);
  await reset();await first.query('begin');await second.query('begin');
  const review="update public.pth_feedback set status='en_revision',revision=revision+1 where id=$1 and revision=0 returning id";
  await first.query(review,[a]);const pending=second.query(review,[a]);await waitForLock();await first.query('commit');assert.equal((await pending).rows.length,0);await second.query('commit');
  console.log('PASS simultaneous same-revision reviews cannot overwrite one another');
  console.log('5 real multi-connection PostgreSQL checks passed; all records stayed in the disposable local cluster.');
 }finally{
  await Promise.allSettled(clients.map(client=>client.end()));
  if(started)run('pg_ctl',['-D',data,'-m','immediate','-w','stop']);
  rmSync(root,{recursive:true,force:true});
 }
})().catch(error=>{console.error(error);process.exitCode=1;});
