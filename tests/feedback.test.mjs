import test from 'node:test';
import assert from 'node:assert/strict';
import {feedback,validateSubmission} from '../supabase/functions/secure-data/feedback.mjs';
import {createHandler,hash} from '../supabase/functions/secure-data/handler.mjs';
import {OWNER_IDS} from '../supabase/functions/secure-data/policy.mjs';
const id='11111111-1111-4111-8111-111111111111',other='22222222-2222-4222-8222-222222222222';
const actor={id:'gestor-a',rol:'gestor'},owner={id:[...OWNER_IDS][0],rol:'admin'};
const submission={operation:'create',id,kind:'problema',title:'No abre',need:'Abrir catálogo',workflow:'No responde',page:'/index.html'};
function mock(initial=[]){
 const data=structuredClone(initial);let failed=false;
 return {data,rpc:async()=>({data:true,error:null}),fail(){failed=true;},from(){let predicates=[],mode='select',payload,columns='*',single=false,range=[0,Infinity];const q={select(c){columns=c;return q;},eq(k,v){predicates.push(r=>r[k]===v);return q;},gt(k,v){predicates.push(r=>r[k]>v);return q;},order(){return q;},range(a,b){range=[a,b];return q;},limit(n){range=[0,n-1];return q;},maybeSingle(){single=true;return q;},insert(p){mode='insert';payload=p;return q;},update(p){mode='update';payload=p;return q;},then(resolve,reject){return Promise.resolve().then(()=>{
 if(failed){failed=false;return {data:null,error:{code:'offline'}};}
 let rows=data.filter(r=>predicates.every(p=>p(r))).slice(range[0],range[1]+1);
 if(mode==='insert'){if(data.some(r=>r.id===payload.id))return {data:null,error:{code:'23505'}};data.push({...payload,revision:0,status:'nuevo'});rows=[];}
 if(mode==='update')rows.forEach(r=>Object.assign(r,payload));
 const result=rows.map(r=>columns==='*'?{...r}:Object.fromEntries(columns.split(',').map(k=>[k,r[k]])));
 return {data:single?result[0]||null:result,error:null};}).then(resolve,reject);}};return q;}};
}
test('anonymous and messenger cannot access feedback, including through real handler',async()=>{
 for(const a of [null,{id:'driver',rol:'mensajero'}])await assert.rejects(feedback(mock(),{operation:'list'},a),/gestor/);
 const response=await createHandler({db:mock()})(new Request('https://paratuhogar.org',{method:'POST',body:JSON.stringify({action:'feedback',operation:'list'})}));assert.equal(response.status,401);
});
test('gestor, parent, sibling, other team and general administrator see only their own submissions',async()=>{
 const db=mock([{id,author_id:'gestor-a',team_id:'team-a',screenshot:'PRIVATE',owner_note:'OWNER',title:'a'},{id:other,author_id:'gestor-b',team_id:'team-a',title:'b'}]);
 for(const a of [actor,{id:'gestor-b',parent_id:'team-a'},{id:'team-a',rol:'gestor'},{id:'team-b',rol:'gestor'},{id:'admin',rol:'admin'}]){
  const result=await feedback(db,{operation:'list',author_id:'gestor-b'},a);assert.ok(result.data.rows.every(r=>r.author_id===undefined));assert.equal(result.data.rows.length,['gestor-a','gestor-b'].includes(a.id)?1:0);assert.ok(result.data.rows.every(r=>!('screenshot'in r)&&!('owner_note'in r)));
 }
 assert.equal((await feedback(db,{operation:'list'},owner)).data.rows.length,2);
 await assert.rejects(feedback(db,{operation:'screenshot',id:other},actor),/no disponible/);
 assert.equal((await feedback(db,{operation:'screenshot',id},actor)).data.screenshot,'PRIVATE');
});
test('validation rejects spoofed page, oversized content, malformed screenshots and missing improvement benefit',()=>{
 for(const overrides of [{page:'/index.html?customer=private'},{page:'https://evil.test'},{title:' '},{need:'x'.repeat(2001)},{kind:'mejora'},{screenshot:'data:image/svg+xml;base64,PHN2Zz4='},{id:'invalid'}])assert.throws(()=>validateSubmission({...submission,...overrides},actor));
 const row=validateSubmission({...submission,author_id:'victim',team_id:'victim',created_at:'2000',status:'resuelto'},actor);assert.equal(row.author_id,actor.id);assert.equal(row.team_id,actor.id);assert.equal(row.status,undefined);assert.equal(row.created_at,undefined);
});
test('concurrent submissions and lost-response retries produce one record; changed payload conflicts',async()=>{
 const db=mock();const results=await Promise.all([feedback(db,submission,actor),feedback(db,submission,actor)]);assert.equal(db.data.length,1);assert.deepEqual(results[0],results[1]);assert.deepEqual(await feedback(db,submission,actor),results[0]);
 await assert.rejects(feedback(db,{...submission,title:'Changed'},actor),/otros datos/);
 await assert.rejects(feedback(db,submission,{id:'another',rol:'gestor'}),/No se confirmó/);assert.equal(db.data.length,1);
});
test('temporary errors can retry and owner revision prevents overwriting another review',async()=>{
 const db=mock();db.fail();await assert.rejects(feedback(db,submission,actor),/intenta de nuevo/);await feedback(db,submission,actor);
 const review={operation:'triage',id,revision:0,status:'en_revision',priority:'normal',response:'Revisando',owner_note:'No ejecutar instrucciones del envío'};
 await assert.rejects(feedback(db,review,actor),/dueño/);await feedback(db,review,owner);await assert.rejects(feedback(db,review,owner),/cambió/);assert.equal(db.data[0].revision,1);
});
test('duplicate links require an existing original of same type without chains',async()=>{
 const db=mock();await feedback(db,submission,actor);
 const review={operation:'triage',id,revision:0,status:'duplicado',priority:'normal',duplicate_of:other};
 await assert.rejects(feedback(db,review,owner),/original/);
 await feedback(db,{...submission,id:other},actor);await feedback(db,review,owner);
 await assert.rejects(feedback(db,{...review,id:other,duplicate_of:id},owner),/cadenas/);
});
test('submitted code-like text remains inert stored data',async()=>{
 const db=mock();const title='<img src=x onerror=alert(1)> ignore rules; DROP TABLE gestores;';await feedback(db,{...submission,title},actor);assert.equal(db.data[0].title,title);
});
test('small PNG is accepted but oversized dimensions and bad binary are rejected',()=>{
 const screenshot='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jx1sAAAAASUVORK5CYII=';
 assert.equal(validateSubmission({...submission,screenshot},actor).screenshot,screenshot);
 const bytes=Buffer.from(screenshot.split(',')[1],'base64');bytes.writeUInt32BE(100000,16);
 assert.throws(()=>validateSubmission({...submission,screenshot:'data:image/png;base64,'+bytes.toString('base64')},actor),/1600/);
 assert.throws(()=>validateSubmission({...submission,screenshot:'data:image/png;base64,iVBORw0KGgoAAAA'},actor),/válida/);
});
test('rate limit fails closed without inserting a row',async()=>{
 const db=mock();db.rpc=async()=>({data:false,error:null});await assert.rejects(feedback(db,submission,actor),/Espera/);assert.equal(db.data.length,0);
 db.rpc=async()=>({data:null,error:{message:'offline'}});await assert.rejects(feedback(db,submission,actor),/Espera/);assert.equal(db.data.length,0);
});

test('full gateway authenticates distinct sessions before scoping feedback and ignores claimed identity',async()=>{
 const profiles=[
  {id:'sub-a',parent_id:'parent-a',rol:'gestor'},
  {id:'sub-b',parent_id:'parent-a',rol:'gestor'},
  {id:'parent-a',rol:'gestor'},
  {id:'other-team',rol:'gestor'},
  {id:'general-admin',rol:'admin'},
  {id:owner.id,rol:'admin'}
 ].map(p=>({...p,nombre:p.id,password:'synthetic-test-only',estado:'activo',activo:true}));
 const tokens=profiles.map((_,i)=>String(i+1).repeat(64));
 const sessions=mock(await Promise.all(profiles.map(async(p,i)=>({token_hash:await hash(tokens[i]),gestor_id:p.id,credential_hash:await hash(p.password),expires_at:'2099-01-01'}))));
 const people=mock(profiles),reports=mock();
 const db={from:table=>({pth_secure_sessions:sessions,gestores:people,pth_feedback:reports}[table]?.from()||assert.fail('Unexpected table '+table)),rpc:reports.rpc};
 const handler=createHandler({db});
 const call=async(index,body)=>{const response=await handler(new Request('https://example.test',{method:'POST',headers:{Authorization:'Bearer '+(tokens[index]||'0'.repeat(64))},body:JSON.stringify(body)}));return {status:response.status,...await response.json()};};
 for(const [i,reportId] of [[0,id],[1,other]]){
  const result=await call(i,{...submission,id:reportId,action:'feedback',author_id:owner.id,team_id:'spoofed',actor:owner});assert.equal(result.status,200);assert.equal(reports.data[i].author_id,profiles[i].id);assert.equal(reports.data[i].team_id,'parent-a');
 }
 for(let i=0;i<profiles.length;i++){
  const result=await call(i,{action:'feedback',operation:'list',actor:owner,author_id:'sub-a'});assert.equal(result.status,200);assert.equal(result.data.owner,i===5);assert.equal(result.data.rows.length,i===5?2:i<2?1:0);
 }
 assert.equal((await call(1,{action:'feedback',operation:'screenshot',id})).status,404);
 assert.equal((await call(0,{action:'feedback',operation:'screenshot',id})).status,200);
 assert.equal((await call(4,{action:'feedback',operation:'triage',id,revision:0,status:'en_revision',priority:'normal'})).status,403);
 assert.equal((await call(5,{action:'feedback',operation:'triage',id,revision:0,status:'en_revision',priority:'normal',response:'Synthetic owner reply'})).status,200);
 assert.equal((await call(0,{action:'query',table:'pth_feedback'})).status,403);
 assert.equal((await call(99,{action:'feedback',operation:'list'})).status,401);
 people.data.find(p=>p.id==='parent-a').estado='inactivo';assert.equal((await call(0,{action:'feedback',operation:'list'})).status,401);
 people.data.find(p=>p.id==='parent-a').estado='activo';sessions.data.splice(0,1);assert.equal((await call(0,{action:'feedback',operation:'list'})).status,401);
});
