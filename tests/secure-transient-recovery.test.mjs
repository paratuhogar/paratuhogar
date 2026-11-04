import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

function fixture(respond) {
 const saved=new Map([['pth_secure_token','a'.repeat(64)]]),calls=[],delays=[];
 const root={AbortSignal,location:{pathname:'/'},localStorage:{getItem:k=>saved.get(k)||null,setItem:(k,v)=>saved.set(k,String(v)),removeItem:k=>saved.delete(k),key:i=>[...saved.keys()][i],get length(){return saved.size;}},setTimeout(fn,ms){delays.push(ms);queueMicrotask(fn);return 1;},clearTimeout(){},fetch:async(url,options)=>{const body=JSON.parse(options.body);calls.push(body);return respond(body,calls.length,options);}};
 root.window=root;
 vm.runInNewContext(fs.readFileSync(new URL('../js/secure-data.js',import.meta.url),'utf8'),root);
 const api=root.PTHSecureData,db=api.install({from(){assert.fail('No public fallback');},rpc(){assert.fail('No public RPC fallback');}});
 return {api,db,calls,delays,root,saved};
}
const ok=body=>({status:200,json:async()=>body.action==='session'?{data:{profile:{id:'owner',rol:'gestor'}},error:null}:{data:[{id:'order'}],error:null}});
const down=()=>({status:503,headers:{get:()=>null},json:async()=>({code:'EDGE_FUNCTION_ERROR',message:'internal detail'})});

test('session and select recover once from 503, returning real data without clearing credentials',async()=>{
 const seen=new Set();const f=fixture(body=>{if(!seen.has(body.action)){seen.add(body.action);return down();}return ok(body);});
 const result=await f.db.from('pedidos').select();
 assert.equal(result.error,null);assert.equal(result.data[0].id,'order');
 assert.deepEqual(f.calls.map(b=>b.action),['session','session','query','query']);assert.equal(f.api.token(),'a'.repeat(64));
 assert.equal(f.delays.length,2);
});
test('persistent 503 is bounded and never reported as a successful empty query',async()=>{
 const f=fixture(down);await assert.rejects(f.api.restore(),e=>e.code==='SERVICE_UNAVAILABLE'&&e.status===503);
 assert.equal(f.calls.length,2);assert.equal(f.api.token(),'a'.repeat(64));
});
for(const status of [502,503,504])test(`HTML ${status} is retried once for session and classified without exposing the response`,async()=>{
 const f=fixture(()=>({status,json:async()=>{throw SyntaxError('internal HTML');}}));
 await assert.rejects(f.api.restore(),e=>e.code==='SERVICE_UNAVAILABLE'&&e.status===status&&!e.message.includes('HTML'));assert.equal(f.calls.length,2);
});
test('transport failure remains NETWORK_ERROR, without clearing credentials or retrying',async()=>{
 const f=fixture(()=>{throw TypeError('Failed to fetch');});await assert.rejects(f.api.restore(),e=>e.code==='NETWORK_ERROR');
 assert.equal(f.calls.length,1);assert.equal(f.api.token(),'a'.repeat(64));
});
test('messenger login is never automatically repeated',async()=>{
 const f=fixture(down);await assert.rejects(f.api.loginMessenger('synthetic'),/servidor.*temporalmente/i);assert.equal(f.calls.length,1);
});
test('switching accounts during backoff never dispatches a read under the old token',async()=>{
 const f=fixture(down);f.root.setTimeout=fn=>{f.saved.set('pth_secure_token','b'.repeat(64));queueMicrotask(fn);};
 await assert.rejects(f.api.restore(),e=>e.code==='SESSION_CHANGED');assert.equal(f.calls.length,1);assert.equal(f.api.token(),'b'.repeat(64));
});
for(const operation of ['insert','update','upsert','delete'])test(`${operation} is never automatically repeated after an ambiguous 503`,async()=>{
 const f=fixture(body=>body.action==='session'?ok(body):down());await f.api.restore();
 const q=f.db.from('pedidos');const result=await (operation==='delete'?q.delete():q[operation]({id:'order'}));
 assert.equal(result.data,null);assert.equal(result.error.status,503);assert.equal(f.calls.filter(b=>b.action==='query').length,1);
});
test('login failure reports server unavailability but never repeats credential submission',async()=>{
 const f=fixture(down);await assert.rejects(f.api.login('synthetic','synthetic'),/servidor.*temporalmente/i);assert.equal(f.calls.length,1);
});
test('malformed server response and network timeout remain distinguishable',async()=>{
 const bad=fixture(()=>({status:200,json:async()=>{throw SyntaxError('not JSON');}}));
 await assert.rejects(bad.api.restore(),e=>e.code==='INVALID_RESPONSE');assert.equal(bad.calls.length,1);
 const slow=fixture(()=>{throw Object.assign(Error('timeout'),{name:'TimeoutError'});});
 await assert.rejects(slow.api.restore(),e=>e.code==='REQUEST_TIMEOUT');assert.equal(slow.calls.length,1);
});
test('a timeout reading a successful response body is not mislabeled as invalid JSON',async()=>{
 const f=fixture(()=>({status:200,json:async()=>{throw Object.assign(Error('body timeout'),{name:'TimeoutError'});}}));
 await assert.rejects(f.api.restore(),e=>e.code==='REQUEST_TIMEOUT');assert.equal(f.calls.length,1);
});
test('logout during retry backoff stops the old request without using another account',async()=>{
 const f=fixture(down);f.root.setTimeout=fn=>{f.api.clearSession();queueMicrotask(fn);};
 await assert.rejects(f.api.restore(),e=>e.code==='SESSION_CHANGED');assert.equal(f.calls.length,1);assert.equal(f.api.token(),null);
});
test('genuine 401 is not retried and still expires the session',async()=>{
 const f=fixture(()=>({status:401,json:async()=>({data:null,error:{code:'SESSION_INVALID',message:'Inicia sesión.'}})}));
 await assert.rejects(f.api.restore(),e=>e.code==='SESSION_INVALID');assert.equal(f.calls.length,1);assert.equal(f.api.token(),null);
});
test('non-idempotent actions including checkout submit, RPC, approvals and logout never retry',async()=>{
 for(const run of [f=>f.api.checkout({operation:'submit'}),f=>f.api.checkout({operation:'quote'}),f=>f.api.reviewSubgestor({operation:'approve',id:'fixture'}),f=>f.db.rpc('solicitar_cobro_comision',{}),f=>f.api.logout()]){
  const f=fixture(body=>body.action==='session'?ok(body):down());await f.api.restore();
  const result=await run(f);assert.equal(result.error.status,503);assert.equal(f.calls.filter(b=>b.action!=='session').length,1);
 }
});
