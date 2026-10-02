// Real browser IndexedDB migration and transactions. Synthetic records only.
const {chromium}=require('playwright');
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const core=fs.readFileSync(path.resolve(__dirname,'../js/pending-checkout.js'));
(async()=>{
  const server=http.createServer((req,res)=>{res.writeHead(200,{'Content-Type':req.url==='/core.js'?'application/javascript':'text/html; charset=utf-8'});res.end(req.url==='/core.js'?core:'<!doctype html><script src="/core.js"></script>');});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const origin='http://127.0.0.1:'+server.address().port;
  const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
  const input={lines:[{id:'synthetic-product',qty:2,price:100}],form:{nombre:'Synthetic Customer',tel:'synthetic-phone',dir:'Synthetic address',municipio:'Synthetic municipality',localidad:'Synthetic locality',moneda:'USD (Efectivo)',notas:'untrusted text <script>never execute</script>'}};
  async function page(){const context=await browser.newContext();await context.route('**/*',route=>new URL(route.request().url()).origin===origin?route.continue():route.abort());const p=await context.newPage();await p.goto(origin);return {context,p};}
  const seed=async(p,row)=>p.evaluate(async row=>{
    const db=await new Promise((resolve,reject)=>{const request=indexedDB.open('pth_pending_checkout_v1',1);request.onupgradeneeded=()=>request.result.createObjectStore('orders',{keyPath:'owner'});request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});
    await new Promise((resolve,reject)=>{const tx=db.transaction('orders','readwrite');tx.objectStore('orders').put(row);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});db.close();
  },row);
  const legacy=(owner='a')=>({version:1,owner,id:'1'.repeat(64),intentId:'2'.repeat(64),createdAt:Date.now(),updatedAt:Date.now(),state:'uncertain',...input,outcome:{attempt:'signed-synthetic-attempt'},priorAttempts:['signed-synthetic-prior'],lease:null});
  async function raw(p,name,table,owner){return p.evaluate(async({name,table,owner})=>{const db=await new Promise((resolve,reject)=>{const request=indexedDB.open(name,1);request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});const row=await new Promise((resolve,reject)=>{const tx=db.transaction(table,'readonly'),request=tx.objectStore(table).get(owner);request.onsuccess=()=>resolve(request.result||null);request.onerror=()=>reject(request.error);});db.close();return row;},{name,table,owner});}
  try{
    // Safe v1 import, no double import across tabs, paused pointer and scoped purge.
    {
      const {context,p}=await page(),old=legacy();await seed(p,old);
      const other=await context.newPage();await other.goto(origin);
      const results=await Promise.all([p,other].map(p=>p.evaluate(()=>PTHPendingCheckout.create(PTHPendingCheckout.indexedStore(indexedDB)).list('a'))));
      for(const rows of results){assert.equal(rows.length,1);assert.equal(rows[0].id,old.id);assert.equal(rows[0].intentId,old.intentId);assert.equal(rows[0].outcome.attempt,old.outcome.attempt);assert.deepEqual(rows[0].priorAttempts,old.priorAttempts);assert.equal(rows[0].form.nombre,input.form.nombre);}
      const pointer=await raw(p,'pth_pending_checkout_v1','orders','a');assert.equal(pointer.version,1);assert.equal(pointer.state,'paused');assert.equal(pointer.code,'MIGRATED_TO_QUEUE');assert.doesNotMatch(JSON.stringify(pointer),/Synthetic Customer|synthetic-phone|Synthetic address|untrusted text/);
      const next=await p.evaluate(async input=>{const q=PTHPendingCheckout.create(PTHPendingCheckout.indexedStore(indexedDB));return q.save('a',{...input,form:{...input.form,nombre:'Second Customer'}},{intentId:'3'.repeat(64),savedAt:Date.now()});},input);
      await other.evaluate(async id=>{const q=PTHPendingCheckout.create(PTHPendingCheckout.indexedStore(indexedDB));await q.confirmed('a',id,[{reference:'legacy-reference'}]);},old.id);
      let bucket=await raw(p,'pth_pending_checkout_v2','queues','a');assert.equal(bucket.orders.length,2);assert.equal(bucket.orders.find(row=>row.id===old.id).form,undefined);assert.equal(bucket.orders.find(row=>row.id===next.id).form.nombre,'Second Customer');
      await p.evaluate(()=>PTHPendingCheckout.create(PTHPendingCheckout.indexedStore(indexedDB)).logout('a'));bucket=await raw(p,'pth_pending_checkout_v2','queues','a');assert.doesNotMatch(JSON.stringify(bucket),/Synthetic Customer|synthetic-phone|Second Customer|Synthetic address/);assert.equal((await raw(p,'pth_pending_checkout_v1','orders','a')).version,1);
      await context.close();
    }
    // Failure before committing v2 leaves the complete original v1 row intact.
    {
      const {context,p}=await page(),old=legacy();await seed(p,old);
      const result=await p.evaluate(async()=>{const put=IDBObjectStore.prototype.put;IDBObjectStore.prototype.put=function(value){if(this.name==='queues')throw new DOMException('synthetic quota','QuotaExceededError');return put.call(this,value);};try{await PTHPendingCheckout.create(PTHPendingCheckout.indexedStore(indexedDB)).list('a');return 'unexpected success';}catch(error){return error.name;}finally{IDBObjectStore.prototype.put=put;}});
      assert.equal(result,'QuotaExceededError');assert.deepEqual(await raw(p,'pth_pending_checkout_v1','orders','a'),old);assert.equal(await raw(p,'pth_pending_checkout_v2','queues','a'),null);
      assert.equal(await p.evaluate(async()=> (await PTHPendingCheckout.create(PTHPendingCheckout.indexedStore(indexedDB)).list('a')).length),1);await context.close();
    }
    // Interruption after v2 commit but before v1 pointer is recoverable and idempotent.
    {
      const {context,p}=await page(),old=legacy();await seed(p,old);
      const result=await p.evaluate(async()=>{const put=IDBObjectStore.prototype.put;IDBObjectStore.prototype.put=function(value){if(this.name==='orders'&&value.code==='MIGRATED_TO_QUEUE')throw new DOMException('synthetic interrupted pointer','QuotaExceededError');return put.call(this,value);};try{await PTHPendingCheckout.create(PTHPendingCheckout.indexedStore(indexedDB)).list('a');return 'unexpected success';}catch(error){return error.name;}finally{IDBObjectStore.prototype.put=put;}});
      assert.equal(result,'QuotaExceededError');assert.deepEqual(await raw(p,'pth_pending_checkout_v1','orders','a'),old);assert.equal((await raw(p,'pth_pending_checkout_v2','queues','a')).orders.length,1);
      for(let i=0;i<3;i++)assert.equal(await p.evaluate(async()=> (await PTHPendingCheckout.create(PTHPendingCheckout.indexedStore(indexedDB)).list('a')).length),1);
      assert.equal((await raw(p,'pth_pending_checkout_v1','orders','a')).code,'MIGRATED_TO_QUEUE');await context.close();
    }
    // Separate browser tabs atomically deduplicate saves and serialize distinct order leases.
    {
      const {context,p}=await page(),other=await context.newPage();await other.goto(origin);const intent={intentId:'4'.repeat(64),savedAt:Date.now()};
      const saved=await Promise.all([p,other].map(p=>p.evaluate(({input,intent})=>PTHPendingCheckout.create(PTHPendingCheckout.indexedStore(indexedDB)).save('a',input,intent),{input,intent})));assert.equal(saved[0].id,saved[1].id);
      const second=await p.evaluate(input=>PTHPendingCheckout.create(PTHPendingCheckout.indexedStore(indexedDB)).save('a',{...input,form:{...input.form,nombre:'Other Customer'}},{intentId:'5'.repeat(64),savedAt:Date.now()}),input);
      await p.evaluate(()=>{window.coreQueue=PTHPendingCheckout.create(PTHPendingCheckout.indexedStore(indexedDB));window.coreRun=coreQueue.run('a',async context=>{window.heldId=context.row.id;await new Promise(resolve=>{window.releaseCoreRun=resolve;});await context.confirmed([{reference:'first-reference'}]);});});await p.waitForFunction(()=>typeof releaseCoreRun==='function');
      assert.equal(await other.evaluate(id=>PTHPendingCheckout.create(PTHPendingCheckout.indexedStore(indexedDB)).run('a',()=>{throw Error('must not acquire');},id),second.id),false);
      await p.evaluate(async()=>{releaseCoreRun();await coreRun;});assert.equal(await other.evaluate(async id=>PTHPendingCheckout.create(PTHPendingCheckout.indexedStore(indexedDB)).run('a',async context=>context.confirmed([{reference:'second-reference'}]),id),second.id),true);
      const rows=await p.evaluate(()=>PTHPendingCheckout.create(PTHPendingCheckout.indexedStore(indexedDB)).list('a'));assert.equal(rows.length,2);assert.equal(rows.every(row=>row.state==='confirmed'&&!row.form&&!row.lines),true);await context.close();
    }
    console.log('PASS real IndexedDB: preserved v1 intent/attempt, two-tab idempotent migration, paused legacy pointer without PII, precommit quota rollback, postcommit interruption recovery, scoped purge, duplicate save nonce, account-wide leases and individual receipts');
  }finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1;});
