import test from 'node:test';
import assert from 'node:assert/strict';
import {sessionFixture} from './fixtures/session-infrastructure.mjs';
import {createHandler} from '../supabase/functions/secure-data/handler.mjs';

async function fixture(duplicate=false) {
 const f=await sessionFixture();
 f.rows.pth_secure_sessions=[];
 f.rows.gestores=[{id:'owner',nombre:'José Pérez',telefono:'52929310',rol:'gestor',estado:'activo',activo:true,password:'fixture-only'}];
 if(duplicate)f.rows.gestores.push({...f.rows.gestores[0],id:'other',nombre:'Jose Perez',telefono:'53123456',estado:'bloqueado',activo:false});
 return f;
}
test('ambiguous accented name requests phone without issuing a session or exposing account state',async()=>{
 const f=await fixture(true);
 const result=await f.request({action:'login',username:'José Pérez',password:'fixture-only'},null);
 assert.equal(result.status,401);assert.equal(result.data,null);
 assert.match(result.error.message,/teléfono/i);
 assert.doesNotMatch(result.error.message,/bloquead|duplicad|varias|dos cuentas/i);
 assert.equal(f.state.writes,0);
 const wrong=await f.request({action:'login',username:'José Pérez',password:'wrong-fixture'},null);
 const absent=await f.request({action:'login',username:'No existe',password:'fixture-only'},null);
 assert.deepEqual(wrong.error,result.error);assert.deepEqual(absent.error,result.error);
});
for(const stored of ['52929310','+5352929310','+53 5 2929310'])for(const username of ['52929310','+5352929310','+53 5 2929310'])test(`Cuban phone ${username} matches stored ${stored}`,async()=>{
 const f=await fixture(true);f.rows.gestores[0].telefono=stored;
 const result=await f.request({action:'login',username,password:'fixture-only'},null);
 assert.equal(result.error,null);assert.equal(result.data.profile.id,'owner');
 assert.equal(result.data.profile.telefono,stored);assert.equal(f.state.writes,1);
 assert.equal(result.data.profile.password,'__session__');
 assert.equal((await f.request({action:'session'},result.data.token)).error,null);
});
for(const username of ['Jose Perez','JOSÉ PÉREZ','Jose'])test(`unique name ${username} retains access`,async()=>{
 const f=await fixture();const result=await f.request({action:'login',username,password:'fixture-only'},null);
 assert.equal(result.error,null);assert.equal(result.data.profile.id,'owner');
});
for(const state of ['activo','bloqueado'])test(`two matching credentials with second ${state} never select arbitrarily`,async()=>{
 const f=await fixture(true);f.rows.gestores[1].estado=state;f.rows.gestores[1].activo=state==='activo';
 for(const username of ['Jose Perez','Jose'])assert.equal((await f.request({action:'login',username,password:'fixture-only'},null)).status,401);
 assert.equal(f.state.writes,0);
});
test('duplicate phone does not pick an active account over a blocked one',async()=>{
 const f=await fixture(true);f.rows.gestores[1].telefono='+5352929310';
 assert.equal((await f.request({action:'login',username:'52929310',password:'fixture-only'},null)).status,401);
 assert.equal(f.state.writes,0);
});
test('unique blocked credentials retain review rejection and never create a session',async()=>{
 const f=await fixture(true);const result=await f.request({action:'login',username:'53123456',password:'fixture-only'},null);
 assert.equal(result.status,401);assert.match(result.error.message,/revisión/);assert.equal(f.state.writes,0);
});
test('foreign phone is preserved and cannot be mistaken for a Cuban phone',async()=>{
 const f=await fixture();f.rows.gestores[0].telefono='+1 305 529 29310';
 const result=await f.request({action:'login',username:'Jose Perez',password:'fixture-only'},null);
 assert.equal(result.data.profile.telefono,'+1 305 529 29310');
 assert.equal((await f.request({action:'login',username:'+1 305 529 29310',password:'fixture-only'},null)).status,401);
 assert.equal((await f.request({action:'login',username:'52929310',password:'fixture-only'},null)).status,401);
});
test('name collisions with different credentials preserve the existing unique-credential rule',async()=>{
 const f=await fixture(true);f.rows.gestores[1].password='other-fixture';
 const result=await f.request({action:'login',username:'Jose Perez',password:'fixture-only'},null);
 assert.equal(result.error,null);assert.equal(result.data.profile.id,'owner');
});
for(const failedCall of [1,2])test(`rate limiter ${failedCall} stops login before account lookup`,async()=>{
 let calls=0;
 const handler=createHandler({db:{rpc:async()=>({data:++calls!==failedCall,error:null}),from(){assert.fail('Rate-limited login must not read accounts');}}});
 const response=await handler(new Request('http://127.0.0.1:8080/gateway',{method:'POST',body:JSON.stringify({action:'login',username:'+53 5 2929310',password:'fixture-only'})}));
 assert.equal(response.status,429);assert.equal((await response.json()).data,null);assert.equal(calls,failedCall);
});
