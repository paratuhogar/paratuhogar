const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(require('node:path').join(__dirname,'../js/secure-data.js'),'utf8');
const profile={id:'11111111-1111-4111-8111-111111111111',nombre:'Synthetic seller',rol:'gestor',estado:'activo',activo:true,password:'__session__'};
function setup(){
 const memory=new Map([['pth_secure_token','a'.repeat(64)],['pth_secure_token_expires_at',String(Date.now()+86400000)],['pth_session',JSON.stringify({data:profile})]]);
 const storage={getItem:k=>memory.get(k)??null,setItem:(k,v)=>memory.set(k,String(v)),removeItem:k=>memory.delete(k),key:i=>[...memory.keys()][i],get length(){return memory.size;}};
 const calls=[],root={localStorage:storage,AbortSignal,location:{pathname:'/'},fetch:async(_url,options)=>{const body=JSON.parse(options.body);calls.push({body,headers:options.headers});return {status:200,json:async()=>({data:body.action==='session'?{profile,expiresAt:new Date(Date.now()+86400000).toISOString()}:{balance:5},error:null})};}};
 root.window=root;vm.runInNewContext(source,root);return {api:root.PTHSecureData,root,storage,calls};
}
test('wallet client sends a protected points action with the current token',async()=>{
 const c=setup();assert.equal(typeof c.api.pointsWallet,'function');const r=await c.api.pointsWallet({operation:'summary',action:'query'});assert.equal(r.data.balance,5);
 assert.equal(c.calls.at(-1).body.action,'points_wallet');assert.equal(c.calls.at(-1).headers.Authorization,'Bearer '+'a'.repeat(64));
});
test('wallet client does not send after the session changes while being restored',async()=>{
 const c=setup();assert.equal(typeof c.api.pointsWallet,'function');let release;c.root.fetch=()=>new Promise(resolve=>release=()=>resolve({status:200,json:async()=>({data:{profile,expiresAt:new Date(Date.now()+86400000).toISOString()},error:null})}));
 const pending=c.api.pointsWallet({operation:'grant'});while(!release)await new Promise(setImmediate);c.storage.setItem('pth_secure_token','b'.repeat(64));release();
 assert.equal((await pending).error.code,'SESSION_CHANGED');assert.equal(c.calls.length,0);
});
test('a delayed wallet result cannot expose data after logout',async()=>{
 const c=setup();await c.api.restore();assert.equal(typeof c.api.pointsWallet,'function');let release;
 c.root.fetch=()=>new Promise(resolve=>release=()=>resolve({status:200,json:async()=>({data:{balance:987},error:null})}));
 const pending=c.api.pointsWallet({operation:'summary'});while(!release)await new Promise(setImmediate);c.api.clearSession();release();const r=await pending;
 assert.equal(r.data,null);assert.equal(r.error.code,'SESSION_CHANGED');assert.equal(c.api.accountId(),null);
});
test('an uncertain manual points write is not automatically replayed',async()=>{
 const c=setup();await c.api.restore();assert.equal(typeof c.api.pointsWallet,'function');let attempts=0;
 c.root.fetch=async()=>{attempts++;throw Error('Synthetic disconnected response');};
 const r=await c.api.pointsWallet({operation:'grant',points:5,reason:'Synthetic award',idempotencyKey:'f'.repeat(64)});
 assert.equal(attempts,1);assert.equal(r.error.code,'NETWORK_ERROR');
});
test('a cross-tab account switch cannot send a stale form under the new account',async()=>{
 const c=setup();await c.api.restore();
 const second={...profile,id:'22222222-2222-4222-8222-222222222222',nombre:'Other account'};
 c.storage.setItem('pth_secure_token','b'.repeat(64));c.storage.setItem('pth_session',JSON.stringify({data:second}));let writes=0;
 c.root.fetch=async(_url,options)=>{const body=JSON.parse(options.body);if(body.action==='points_wallet')writes++;return {status:200,json:async()=>({data:body.action==='session'?{profile:second,expiresAt:new Date(Date.now()+86400000).toISOString()}:{beneficiary:{id:second.id}},error:null})};};
 const stale=await c.api.pointsWallet({operation:'grant',points:5,reason:'Old account form'});
 assert.equal(stale.error?.code,'SESSION_CHANGED');assert.equal(stale.data,null);assert.equal(writes,0);
 assert.equal(c.api.accountId(),second.id);
 const fresh=await c.api.pointsWallet({operation:'summary'});assert.equal(fresh.data.beneficiary.id,second.id);assert.equal(writes,1);
});
