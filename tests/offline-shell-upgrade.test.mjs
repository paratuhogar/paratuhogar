import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const page=fs.readFileSync(new URL('../js/pending-checkout-storefront.js',import.meta.url),'utf8');
const version=page.match(/const shellVersion = '([^']+)'/)[1];
const start=page.indexOf('  function requestOfflineShell('),end=page.indexOf('  async function checkReadiness(',start);
function fixture({candidateVersion=version,candidateReady=true,failUpdate=false}={}){
 const listeners=new Set(),calls=[];let updates=0;
 class Channel{constructor(){const one=this.port1={onmessage:null,close(){}};this.port2={postMessage:data=>one.onmessage?.({data})};}}
 const old={postMessage(data,ports){calls.push('old:'+data.type);ports[0].postMessage({ready:true,version:'pth-public-static-previous'});}};
 const candidate={postMessage(data,ports){calls.push('candidate:'+data.type);if(data.type==='SKIP_WAITING'){serviceWorker.controller=candidate;registration.waiting=null;for(const listener of [...listeners])listener();}else ports[0].postMessage({ready:candidateReady,version:candidateVersion,missingCount:candidateReady?0:1});}};
 const registration={waiting:null,installing:null,async update(){updates++;if(failUpdate)throw Error('offline');registration.waiting=candidate;}};
 const serviceWorker={controller:old,ready:Promise.resolve(registration),addEventListener(_name,fn){listeners.add(fn);},removeEventListener(_name,fn){listeners.delete(fn);}};
 const context={shellVersion:version,MessageChannel:Channel,setTimeout,clearTimeout,navigator:{onLine:true,serviceWorker}};
 vm.runInNewContext(page.slice(start,end),context);
 return {context,serviceWorker,calls,listeners,updates:()=>updates};
}
test('retry updates and activates a verified compatible waiting worker without reloading or touching private storage',async()=>{
 const f=fixture();const reply=await f.context.requestOfflineShell(true);
 assert.equal(reply.ready,true);assert.equal(reply.version,version);assert.equal(f.updates(),1);assert.equal(f.serviceWorker.controller.postMessage instanceof Function,true);
 assert.ok(f.calls.includes('candidate:SKIP_WAITING'));assert.equal(f.calls.at(-1),'candidate:PTH_CHECK_OFFLINE_SHELL');assert.equal(f.listeners.size,0);
});
test('a check alone never updates or activates a worker',async()=>{
 const f=fixture();assert.equal((await f.context.requestOfflineShell()).ready,false);assert.equal(f.updates(),0);assert.deepEqual(f.calls,['old:PTH_CHECK_OFFLINE_SHELL']);
});
test('retry never activates an incompatible or incomplete candidate',async()=>{
 for(const options of [{candidateVersion:'future-release'},{candidateReady:false}]){
  const f=fixture(options);assert.equal((await f.context.requestOfflineShell(true)).ready,false);assert.equal(f.calls.includes('candidate:SKIP_WAITING'),false);
 }
});
test('failed update preserves honest incomplete readiness and permits another retry',async()=>{
 const f=fixture({failUpdate:true});assert.equal((await f.context.requestOfflineShell(true)).ready,false);assert.equal(f.calls.includes('candidate:SKIP_WAITING'),false);
 assert.equal((await f.context.requestOfflineShell(true)).ready,false);assert.equal(f.updates(),2);assert.equal(f.listeners.size,0);
});
